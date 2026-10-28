const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { expect, test } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');

function visualSlugs() {
  // CI audits the published repository. Looking at Git-tracked source pages keeps a
  // concurrently authored, untracked draft out of the release gate while a
  // newly committed page still must be added to both catalog and README.
  return execFileSync('git', ['ls-files', '--', 'src/chapters/*/*/index.html'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(repositoryRoot, file)))
    .map((file) => path.basename(path.dirname(file)).replace(/^\d+[a-z]?-/, ''))
    .sort();
}

const slugs = visualSlugs();
const viewports = [
  { name: 'desktop', width: 1280, height: 900 }
];
// These scenes use measured host-font widths or retain SVG labels across the
// initial native-gutter resize. Keep strict Linux baselines for them instead
// of rounding coordinates or discarding draw order from the scene comparison.
const platformScenes = new Set([
  'build-binary-tree-from-preorder-and-inorder-traversals',
  'remove-kth-last-node',
  'serialize-and-deserialize-a-binary-tree'
]);

function routeFor(link) {
  return new URL(link, 'http://algorithm-visuals.test').pathname
    .replace(/^\/algorithm-visuals(?=\/|$)/, '')
    .replace(/\/index\.html$/, '/')
    .replace(/\/$/, '');
}

function readStepCount(value) {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
}

async function stepCount(page) {
  const count = page.locator('[data-count]:visible, [data-step-count]:visible').first();
  return (await count.count()) ? readStepCount(await count.innerText()) : null;
}

async function sceneSnapshot(page) {
  // Keep this portable across CI hosts while preserving the geometry that makes
  // a diagram a diagram. Pixel screenshots would vary with host fonts; this
  // scene baseline instead records node positions, SVG paths, and visual
  // presentation attributes in addition to the accessible state.
  // Linux reserves space for classic scrollbars while macOS overlays them.
  // Normalize only this capture; restore native gutters for the trace and
  // keyboard checks so those still exercise the actual application layout.
  const scrollbarStyle = await page.addStyleTag({content: '[data-animation-panel] { scrollbar-width: none !important; scrollbar-gutter: auto !important; }'});
  const settleLayout = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await settleLayout();
    return await page.locator('[data-animation-panel]').first().evaluate((panel) => {
      const meaningfulAttributes = new Set([
        'aria-current', 'aria-expanded', 'aria-label', 'aria-pressed', 'aria-selected',
        'aria-valuenow', 'aria-hidden', 'disabled', 'hidden', 'role', 'value', 'style'
      ]);
      const sceneAttributes = new Set([
        'd', 'viewBox', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r',
        'width', 'height', 'points', 'transform', 'fill', 'stroke', 'stroke-width',
        'stroke-dasharray', 'stroke-linecap', 'marker-end', 'marker-start', 'opacity'
      ]);
      const cleanText = (value) => value.replace(/\s+/g, ' ').trim();

      function serialize(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = cleanText(node.textContent);
          return text || null;
        }
        if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE'].includes(node.tagName)) {
          return null;
        }

        const attributes = [...node.attributes]
          .filter((attribute) => meaningfulAttributes.has(attribute.name)
            || sceneAttributes.has(attribute.name)
            || attribute.name === 'class'
            || attribute.name.startsWith('data-'))
          .map((attribute) => [attribute.name, attribute.value])
          .sort(([left], [right]) => left.localeCompare(right));
        const children = [...node.childNodes].map(serialize).filter(Boolean);
        return {
          tag: node.tagName.toLowerCase(),
          ...(attributes.length ? { attributes } : {}),
          ...(children.length ? { children } : {})
        };
      }

      return JSON.stringify(serialize(panel), null, 2);
    });
  } finally {
    await scrollbarStyle.evaluate(style => style.remove());
    await settleLayout();
  }
}

async function expectLinesVisibleInScroller(page, lineSelector, scrollerSelector, message) {
  await expect.poll(
    () => page.locator(lineSelector).evaluateAll((lines, selector) => {
      const groups = new Map();
      for (const line of lines) {
        const scroller = line.closest(selector);
        if (!scroller) return false;
        if (!groups.has(scroller)) groups.set(scroller, []);
        groups.get(scroller).push(line.getBoundingClientRect());
      }
      return [...groups].every(([scroller, rects]) => {
        const bounds = scroller.getBoundingClientRect();
        const top = bounds.top + scroller.clientTop;
        const bottom = top + scroller.clientHeight;
        const span = Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top));
        // Wrapped caller/helper statements can be farther apart than the source
        // viewport. Show the first statement and keep the remaining source
        // scrollable; when the group fits, every highlighted line must be visible.
        const visible = span <= scroller.clientHeight ? rects : rects.slice(0, 1);
        return visible.every(rect => rect.top >= top - 1 && rect.bottom <= bottom + 1)
          && rects.every(rect => rect.top - top + scroller.scrollTop >= -1
            && rect.bottom - top + scroller.scrollTop <= scroller.scrollHeight + 1);
      });
    }, scrollerSelector),
    { message }
  ).toBe(true);
}

async function expectCodeLine(page, slug, step) {
  await expect.poll(
    () => page.locator('[data-code-scroll] [aria-current="step"]:visible').count(),
    { message: `${slug}: scripted step ${step} has no active source line` }
  ).toBeGreaterThan(0);

  await expectLinesVisibleInScroller(
    page,
    '[data-code-scroll] [aria-current="step"]:visible',
    '[data-code-scroll]',
    `${slug}: scripted step ${step} is not visible inside its code panel`
  );
}

async function expectStagesUnclipped(page, slug, step) {
  const overflowingStages = await page.locator('[data-stage]:visible').evaluateAll((stages) => stages
    .filter((stage) => stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight)
    .map((stage) => ({
      width: `${stage.scrollWidth}/${stage.clientWidth}`,
      height: `${stage.scrollHeight}/${stage.clientHeight}`,
      label: stage.getAttribute('aria-label')
    })));
  expect(overflowingStages, `${slug}: stage content is clipped at scripted step ${step}`)
    .toEqual([]);
}

async function primaryNextControl(page) {
  for (const selector of ['[data-action="next"]', '[data-next]', '#next']) {
    const control = page.locator(`${selector}:visible`).first();
    if (await control.count()) {
      return control;
    }
  }
  return page.locator('[data-action="next"]:visible');
}

async function isKeyPrevented(locator, key) {
  return locator.evaluate((element, pressedKey) => {
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: pressedKey
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, key);
}

async function collectTrace(page, slug, { checkStageOverflow = false } = {}) {
  const next = await primaryNextControl(page);
  await expect(next, `${slug}: missing a next-step control`).toBeVisible();

  const count = await stepCount(page);
  const maximumSteps = Math.max((count?.total || 0) + 3, 250);
  let visited = 0;

  while (visited < maximumSteps) {
    await expectCodeLine(page, slug, visited + 1);
    if (checkStageOverflow) await expectStagesUnclipped(page, slug, visited + 1);
    visited += 1;

    if (await next.isDisabled()) {
      break;
    }

    await next.click();
  }

  expect(visited, `${slug}: the next-step control did not reach a disabled final frame`).toBeLessThan(maximumSteps);
  if (count) {
    const finalCount = await stepCount(page);
    expect(finalCount, `${slug}: the visible step counter became unreadable`).not.toBeNull();
    expect(finalCount.current, `${slug}: did not visit every frame in its visible step count`).toBe(finalCount.total);
  }
}

async function verifyStandardKeyboardTrace(page, slug) {
  const previous = page.locator('[data-action="previous"]:visible');
  const next = page.locator('[data-action="next"]:visible');
  const count = page.locator('[data-count]:visible');
  const isStandard = await previous.count() === 1 && await next.count() === 1 && await count.count() === 1;
  if (!isStandard) {
    return;
  }

  await expect(count).toContainText('/');
  await next.focus();
  await page.keyboard.press('End');
  await expect.poll(() => stepCount(page), { message: `${slug}: End did not reach the last step` })
    .toMatchObject({ current: expect.any(Number), total: expect.any(Number) });
  const atEnd = await stepCount(page);
  expect(atEnd.current, `${slug}: End did not reach the final step`).toBe(atEnd.total);
  await expect(next).toBeDisabled();

  await page.keyboard.press('Home');
  await expect.poll(() => stepCount(page), { message: `${slug}: Home did not return to the first step` })
    .toMatchObject({ current: 1, total: atEnd.total });
  await expect(previous).toBeDisabled();

  // Lower-page links and help summaries must retain native Home/End behavior;
  // focusing them must not accidentally drive the animation trace.
  const lowerPageFocusTargets = page.locator('.guide-help summary:visible, .related-nav a:visible');
  for (let index = 0; index < await lowerPageFocusTargets.count(); index += 1) {
    const target = lowerPageFocusTargets.nth(index);
    const beforeLowerPageKey = await stepCount(page);
    await target.focus();
    await page.keyboard.press('End');
    await expect.poll(() => stepCount(page), {
      message: `${slug}: End changed the trace from a lower-page focus target`
    }).toMatchObject(beforeLowerPageKey);
    await page.keyboard.press('Home');
    await expect.poll(() => stepCount(page), {
      message: `${slug}: Home changed the trace from a lower-page focus target`
    }).toMatchObject(beforeLowerPageKey);
  }
  await next.focus();

  if (atEnd.total > 1) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => stepCount(page), { message: `${slug}: ArrowRight did not advance the trace` })
      .toMatchObject({ current: 2, total: atEnd.total });
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => stepCount(page), { message: `${slug}: ArrowLeft did not return to the prior step` })
      .toMatchObject({ current: 1, total: atEnd.total });
  }

  const codeScroll = page.locator('[data-code-scroll]:visible').first();
  if (await codeScroll.count()) {
    const beforeCodeScrollKey = await stepCount(page);
    await codeScroll.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => stepCount(page), { message: `${slug}: code scroller ArrowRight changed the trace` })
      .toMatchObject(beforeCodeScrollKey);
    const codeScrollPrevented = await isKeyPrevented(codeScroll, 'ArrowRight');
    expect(codeScrollPrevented, `${slug}: code scroller ArrowRight was prevented`).toBe(false);
  }

  const nativeSelect = page.locator('select:visible').first();
  if (await nativeSelect.count() && await nativeSelect.locator('option').count() > 1) {
    const beforeSelectKey = await stepCount(page);
    const nativeSelectPrevented = await isKeyPrevented(nativeSelect, 'ArrowRight');
    expect(nativeSelectPrevented, `${slug}: ArrowRight was prevented inside a native select`).toBe(false);
    await expect.poll(() => stepCount(page), { message: `${slug}: native select ArrowRight changed the trace` })
      .toMatchObject(beforeSelectKey);
  }

  const stepSelect = page.locator('[data-step-select]:visible').first();
  if (await stepSelect.count() && await stepSelect.locator('option').count() > 1) {
    await stepSelect.selectOption({ index: (await stepSelect.locator('option').count()) - 1 });
    await expect.poll(() => stepCount(page), { message: `${slug}: step select did not reach the final frame` })
      .toMatchObject({ current: atEnd.total, total: atEnd.total });
    await expectCodeLine(page, slug, 'step select final');
    await stepSelect.selectOption('0');
    await expect.poll(() => stepCount(page), { message: `${slug}: step select did not return to the first frame` })
      .toMatchObject({ current: 1, total: atEnd.total });
  }
}

test.describe('catalog and README coverage', () => {
  test('catalog links every visualization directory', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const routes = await page.getByRole('link').evaluateAll((links) => links.map((link) => link.href));

    // Chapter filters and the skip link stay on the catalog.
    const questionRoutes = routes.map(routeFor).filter(route => route !== '');
    for (const slug of slugs) {
      expect(questionRoutes, `catalog is missing ${slug}`).toContain(`/${slug}`);
    }
    expect(questionRoutes.sort(), 'catalog contains a route without a published page')
      .toEqual(slugs.map((slug) => `/${slug}`).sort());
  });

  test('README links every visualization directory', () => {
    const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');
    const links = [...readme.matchAll(/]\(([^\s)]+)\)/g)].map((match) => match[1]);
    const routes = links.map(routeFor);

    for (const slug of slugs) {
      expect(routes, `README is missing ${slug}`).toContain(`/${slug}`);
    }
  });
});

test.describe('shared trace URL state', () => {
  test('intersection opens, copies, and restores a linkable step', async ({ page, context }, testInfo) => {
    const origin = new URL(testInfo.project.use.baseURL).origin;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });

    await page.goto('/linked-list-intersection/#step=2');
    await expect.poll(() => stepCount(page), { message: 'hash step did not select frame 2' })
      .toMatchObject({ current: 3, total: expect.any(Number) });
    expect(new URL(page.url()).hash).toBe('#step=2');

    const copyLink = page.locator('[data-action="copy-link"]:visible');
    await expect(copyLink).toBeVisible();
    await copyLink.click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(page.url());

    const next = await primaryNextControl(page);
    await next.click();
    await expect.poll(() => stepCount(page), { message: 'next did not advance the saved trace step' })
      .toMatchObject({ current: 4, total: expect.any(Number) });
    expect(new URL(page.url()).hash).toBe('#step=3');

    await page.goto('/linked-list-intersection/');
    await expect.poll(() => stepCount(page), { message: 'last trace step was not restored after reload' })
      .toMatchObject({ current: 4, total: expect.any(Number) });
    expect(new URL(page.url()).hash).toBe('#step=3');
  });
});

test.describe('LRU tabs and anchors', () => {
  test('a saved source line remains visible after mounting and desktop embed reflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/lru-cache/#step=5');
    await expect.poll(() => stepCount(page)).toMatchObject({ current: 6 });
    await expectCodeLine(page, 'LRU deep link', 6);
    await page.setViewportSize({ width: 760, height: 700 });
    await expectCodeLine(page, 'LRU embed reflow', 6);
    await page.locator('#lru-tab-helper').click();
    await page.locator('#lru-tab-trace').click();
    await expectCodeLine(page, 'LRU trace tab restoration', 6);
    await expect.poll(() => stepCount(page)).toMatchObject({ current: 6 });
  });

  test('helper anchors and tabs reveal the helper panel without losing trace links', async ({ page }) => {
    const helper = page.locator('#pointer-helpers');
    const helperTab = page.locator('#lru-tab-helper');
    const traceTab = page.locator('#lru-tab-trace');

    await page.goto('/lru-cache/#pointer-helpers');
    await expect(helper).toBeVisible();
    await expect(helperTab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => helper.evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return bounds.top < innerHeight && bounds.bottom > 0;
    })).toBe(true);
    expect(new URL(page.url()).hash).toBe('#pointer-helpers');

    await page.goto('/lru-cache/');
    await helperTab.click();
    await expect(helper).toBeVisible();
    await expect(helperTab).toHaveAttribute('aria-selected', 'true');

    await traceTab.click();
    await expect(traceTab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => new URL(page.url()).hash).toMatch(/^#step=\d+$/);
    await page.reload();
    await expect(traceTab).toHaveAttribute('aria-selected', 'true');

    await page.evaluate(() => { location.hash = 'step=5'; });
    await expect(traceTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#lru-code-trace')).toBeVisible();
    await expect.poll(() => stepCount(page)).toMatchObject({ current: 6, total: expect.any(Number) });
  });

  test('helper trace stays reachable and code-synchronized on desktop', async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/lru-cache/#pointer-helpers');
      const helper = page.locator('#pointer-helpers');
      const modes = page.locator('[data-helper-mode]');
      const previous = page.locator('[data-helper-prev]');
      const next = page.locator('[data-helper-next]');

      await expect(helper).toBeVisible();
      await expect.poll(
        () => page.locator('html').evaluate((documentElement) => documentElement.scrollWidth <= documentElement.clientWidth)
      ).toBe(true);

      for (let modeIndex = 0; modeIndex < await modes.count(); modeIndex += 1) {
        await modes.nth(modeIndex).click();
        let visited = 0;
        while (visited < 25) {
          await expect(page.locator('[data-helper-code] [aria-current="step"]')).toHaveCount(1);
          await expectLinesVisibleInScroller(
            page,
            '[data-helper-code] [aria-current="step"]:visible',
            '[data-helper-code-scroll]',
            `LRU helper mode ${modeIndex}: active code line is clipped at ${viewport.width}px`
          );
          visited += 1;
          if (await next.isDisabled()) break;
          await next.click();
        }
        expect(visited, `LRU helper mode ${modeIndex}: next never reached its final frame`).toBeLessThan(25);

        await helper.focus();
        await page.keyboard.press('Home');
        await expect(previous).toBeDisabled();
        await page.keyboard.press('End');
        await expect(next).toBeDisabled();
      }

      const helperCount = page.locator('[data-helper-count]');
      const helperCodeScroll = page.locator('[data-helper-code-scroll]');
      const countBeforeCodeKey = await helperCount.innerText();
      await helperCodeScroll.focus();
      await page.keyboard.press('ArrowRight');
      await expect(helperCount).toHaveText(countBeforeCodeKey);
      expect(await isKeyPrevented(helperCodeScroll, 'ArrowRight'),
        'LRU helper code scroller ArrowRight was prevented').toBe(false);
    }
    expect(errors, 'LRU helper trace emitted browser errors').toEqual([]);
  });
});

test('reduced motion scrolls a core-only code panel immediately', async ({ page }) => {
  await page.addInitScript(() => {
    const originalScrollTo = Element.prototype.scrollTo;
    window.__visualScrollBehaviors = [];
    Element.prototype.scrollTo = function (...argumentsList) {
      const [options] = argumentsList;
      window.__visualScrollBehaviors.push(typeof options === 'object' ? options.behavior : undefined);
      return originalScrollTo.apply(this, argumentsList);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A short desktop window guarantees the full source needs to scroll.
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('/substring-anagrams/#step=47');
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expectCodeLine(page, 'substring-anagrams reduced motion', '48');
  await expect.poll(() => page.evaluate(() => window.__visualScrollBehaviors.includes('auto'))).toBe(true);
});

for (const slug of slugs) {
  test(`${slug} keeps its scripted trace usable at supported widths`, async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

    const lessonViewports = slug === 'lowest-common-ancestor'
      ? [{ name: 'embed', width: 760, height: 700 }, viewports[0]]
      : viewports;
    for (const viewport of lessonViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${slug}/`);
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveTitle(/ · Algorithm Visuals$/);
      await expect(page.locator('h1').first()).toHaveCSS('font-size', viewport.name === 'desktop' ? '26px' : '21px');
      await expect(page.locator('h1').first()).toHaveCSS('font-weight', '500');
      await expect.poll(
        () => page.locator('html').evaluate((documentElement) => documentElement.scrollWidth <= documentElement.clientWidth),
        { message: `${slug}: page has horizontal overflow at ${viewport.width}px` }
      ).toBe(true);

      await expectCodeLine(page, slug, 'initial');
      if (viewport.name === 'desktop') {
        // Refresh only after reviewing an intentional visual-state change: npm test -- --update-snapshots
        const scene = await sceneSnapshot(page);
        const platform = process.platform === 'linux' && platformScenes.has(slug) ? '.linux' : '';
        expect(scene).toMatchSnapshot(`${slug}${platform}.scene.json`);
      }
      await collectTrace(page, slug, { checkStageOverflow: viewport.name !== 'desktop' });
      await verifyStandardKeyboardTrace(page, slug);
    }
    expect(errors, `${slug}: browser errors`).toEqual([]);
  });
}

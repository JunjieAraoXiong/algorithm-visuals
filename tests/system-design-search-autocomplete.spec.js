const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
const rows = page => page.locator('[data-result]');

test('prefix traversal and cached Top-K return the same ranked candidates', async ({ page }) => {
  await page.goto('/design-search-autocomplete/#step=2');
  await expect(page.locator('.trie-node.is-path')).toHaveCount(3);
  await expect(page.locator('[data-prefix="ca"]')).toHaveClass(/is-path/);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#work-count')).toHaveText('子树访问 5 节点；候选 4 词');
  await expect(page.locator('.trie-node.is-visited')).toHaveCount(5);
  await page.locator('[data-action="next"]').click();
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. cap  6']);
  await page.locator('[data-step-select]').selectOption('6');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. cap  6']);
  await expect(page.locator('.trie-node.is-visited')).toHaveCount(0);
  await expect(page.locator('#result-mode')).toHaveText('读取 v1 缓存');
});

test('frequency updates remain stale until publication, and publication does not invent a new response', async ({ page }) => {
  await page.goto('/design-search-autocomplete/#step=7');
  await expect(page.locator('#source-frequency')).toHaveText('词频源 cap = 30');
  await expect(page.locator('[data-word="cap"]')).toHaveText('cap 6');
  await page.locator('[data-action="next"]').click();
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. cap  6']);
  await expect(page.locator('#result-mode')).toHaveText('更新后再次读取 v1');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#build-state')).toHaveText('离线构建：v2 已就绪');
  await expect(page.locator('#snapshot-label')).toHaveText('服务快照 v1');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#snapshot-label')).toHaveText('服务快照 v2');
  await expect(page.locator('[data-word="cap"]')).toHaveText('cap 30');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. cap  6']);
  await page.locator('[data-action="next"]').click();
  await expect(rows(page)).toHaveText(['1. cap  30', '2. car  20', '3. cat  12']);
  await page.locator('[data-action="previous"]').press('ArrowLeft');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. cap  6']);
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('#snapshot-label')).toHaveText('服务快照 v1');
  await expect(page.locator('[data-word="cap"]')).toHaveText('cap 6');
});

test('query settings and the saved step reproduce a custom update and a deterministic tie', async ({ page }) => {
  await page.goto('/design-search-autocomplete/');
  await page.locator('#prefix').fill('CA');
  await page.locator('#top-k').selectOption('2');
  await page.locator('#new-frequency').fill('12');
  await page.getByRole('button', { name: '应用并重放' }).click();
  await expect(page).toHaveURL(/prefix=ca&k=2&word=cap&frequency=12#step=0$/);
  await page.locator('[data-step-select]').selectOption('11');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cap  12', '']);
  await page.reload();
  await expect(page.locator('#prefix')).toHaveValue('ca');
  await expect(page.locator('#top-k')).toHaveValue('2');
  await expect(page.locator('#new-frequency')).toHaveValue('12');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cap  12', '']);
  await expect(page.locator('[data-count]')).toContainText('12 / 14');
  await page.locator('#prefix').press('ArrowLeft');
  await expect(page.locator('[data-count]')).toContainText('12 / 14');
  await page.locator('[data-action="previous"]').press('Home');
  await expect(rows(page)).toHaveText(['尚未查询', '', '']);
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('[data-count]')).toContainText('14 / 14');
});

test('empty, absent, short-result, and nonmatching updates use the actual dictionary', async ({ page }) => {
  await page.goto('/design-search-autocomplete/?prefix=&k=3#step=4');
  await expect(rows(page)).toHaveText(['1. car  20', '2. cat  12', '3. dog  10']);
  await page.goto('/design-search-autocomplete/?prefix=zzz#step=11');
  await expect(rows(page)).toHaveText(['无匹配结果', '', '']);
  await expect(page.locator('.trie-node.is-path')).toHaveCount(1);
  await page.goto('/design-search-autocomplete/?prefix=do&k=3&word=cap&frequency=99#step=11');
  await expect(rows(page)).toHaveText(['1. dog  10', '2. dot  8', '']);
  await page.goto('/design-search-autocomplete/?prefix=%3Csvg%3E&k=9&word=__proto__&frequency=-1#step=11');
  await expect(page.locator('#prefix')).toHaveValue('ca');
  await expect(page.locator('#top-k')).toHaveValue('3');
  await expect(rows(page)).toHaveText(['1. cap  30', '2. car  20', '3. cat  12']);
});

test('desktop and embed layouts keep the stage and primary controls visible', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 3, 8, 13]) {
      await page.goto(`/design-search-autocomplete/#step=${step}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#architecture')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-action="previous"]')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-action="next"]')).toBeInViewport({ ratio: 1 });
      const overlap = await page.locator('.design-controls').evaluate(controls => {
        const a = controls.getBoundingClientRect(), b = document.querySelector('.drawing-panel').getBoundingClientRect();
        return Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
      });
      expect(overlap).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('the downloadable drawing is editable and has reciprocal arrow bindings', async ({ page }) => {
  await page.goto('/design-search-autocomplete/');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('a[download]').click();
  const download = await downloadEvent;
  const drawing = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(drawing.type).toBe('excalidraw');
  const elements = new Map(drawing.elements.map(element => [element.id, element]));
  expect(elements.size).toBe(drawing.elements.length);
  for (const element of drawing.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding) expect(elements.get(binding.elementId).boundElements).toContainEqual({ id: element.id, type: 'arrow' });
    }
  }
});

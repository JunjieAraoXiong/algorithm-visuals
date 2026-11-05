const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('the system design collection opens its own walkthrough and rewinding removes newly added components', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card:visible')).toHaveCount(61);
  await page.getByRole('tab', { name: 'System Design 系统设计' }).click();
  await expect(page.locator('.card:visible')).toHaveCount(0);
  await page.locator('[data-system-design="design-url-shortener"]').click();
  await expect(page).toHaveURL(/\/design-url-shortener\//);
  await expect(page.locator('[data-count]')).toContainText('1 / 22');
  await expect(page.locator('[data-node="browser"]')).toBeVisible();
  await expect(page.locator('[data-node="destination"]')).toBeVisible();
  await expect(page.locator('[data-node="api"]')).toBeHidden();

  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-count]')).toContainText('2 / 22');
  await expect(page.locator('[data-note="traffic"]')).toBeVisible();
  await page.locator('[data-step-select]').selectOption('3');
  await expect(page.locator('[data-node="api"]')).toBeVisible();
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-count]')).toContainText('3 / 22');
  await expect(page.locator('[data-node="api"]')).toBeHidden();
  await expect(page.locator('[data-note="capacity"]')).toBeVisible();
});

test('step selection, saved URLs, and keyboard controls preserve the current architecture', async ({ page }) => {
  await page.goto('/design-url-shortener/#step=15');
  await expect(page.locator('[data-count]')).toContainText('16 / 22');
  await expect(page.locator('[data-node="cache"]')).toBeVisible();
  await expect(page.locator('[data-node="balancer"]')).toBeHidden();

  await page.locator('[data-step-select]').selectOption('20');
  await expect(page).toHaveURL(/#step=20$/);
  await expect(page.locator('[data-node="balancer"]')).toBeVisible();
  await expect(page.locator('[data-node="api2"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-count]')).toContainText('21 / 22');
  await expect(page.locator('[data-node="api2"]')).toBeVisible();

  const previous = page.locator('[data-action="previous"]');
  const next = page.locator('[data-action="next"]');
  await previous.click();
  await expect(page.locator('[data-node="api2"]')).toBeHidden();
  await previous.press('Home');
  await expect(page).toHaveURL(/#step=0$/);
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(page.locator('[data-node="cache"]')).toBeHidden();
  await next.press('End');
  await expect(page).toHaveURL(/#step=21$/);
  await expect(next).toBeDisabled();
  await previous.press('ArrowLeft');
  await expect(page).toHaveURL(/#step=20$/);
  await expect(page.locator('[data-node="balancer"]')).toBeVisible();
  await previous.press('ArrowLeft');
  await expect(page).toHaveURL(/#step=19$/);
  await expect(page.locator('[data-node="balancer"]')).toBeHidden();
});

test('creation separates existing-URL reuse, ID allocation, and local Base62 encoding when stepping in either direction', async ({ page }) => {
  await page.goto('/design-url-shortener/#step=7');
  await expect(page.locator('[data-note="dedup"]')).toBeVisible();
  await expect(page.locator('[data-node="id"]')).toBeHidden();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-node="id"]')).toBeVisible();
  await expect(page.locator('[data-flow="id-request"]')).toBeVisible();
  await expect(page.locator('[data-note="dedup"]')).toBeHidden();
  await expect(page.locator('[data-note="encoding"]')).toBeHidden();

  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-note="encoding"]')).toBeVisible();
  await expect(page.locator('[data-note="encoding"]')).toContainText(/2\s*c\s*r\s*t\s*g\s*c\s*g/);
  await expect(page.locator('[data-flow="id-request"]')).toBeHidden();
  await expect(page.locator('[data-flow="id-result"]')).toBeHidden();
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-note="encoding"]')).toBeHidden();
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-node="id"]')).toBeHidden();
  await expect(page.locator('[data-note="dedup"]')).toBeVisible();

  await page.locator('[data-step-select]').selectOption('12');
  await expect(page.locator('[data-note="dedup"]')).toBeHidden();
  await expect(page.locator('[data-note="encoding"]')).toBeHidden();
});

test('redirect and cache-aside steps show the request paths separately', async ({ page }) => {
  await page.goto('/design-url-shortener/#step=13');
  await expect(page.locator('[data-flow="redirect"]')).toBeVisible();
  await expect(page.locator('[data-flow="visit"]')).toBeHidden();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-flow="visit"]')).toBeVisible();
  await expect(page.locator('[data-flow="redirect"]')).toBeHidden();

  await page.locator('[data-step-select]').selectOption('16');
  await expect(page.locator('[data-flow="cache-miss"]')).toBeVisible();
  await expect(page.locator('[data-flow="lookup"]')).toBeHidden();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-flow="lookup"]')).toBeVisible();
  await expect(page.locator('[data-flow="db-result"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-flow="cache-fill"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-flow="cache-hit"]')).toBeVisible();
  await expect(page.locator('[data-flow="lookup"]')).toBeHidden();
  await expect(page.locator('[data-flow="db-result"]')).toBeHidden();
});

test('desktop and embedded layouts keep primary controls visible without covering the diagram or step explanation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 9, 13, 21]) {
      await page.goto(`/design-url-shortener/#step=${step}`);
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 22`);
      await expect(page.locator('[data-stage]')).toBeVisible();
      await expect(page.locator('[data-action="previous"]')).toBeVisible();
      await expect(page.locator('[data-action="next"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clipped = await page.locator('[data-stage], [data-action="previous"], [data-action="next"]')
        .evaluateAll(elements => elements.filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < -1 || bounds.right > innerWidth + 1;
        }).map(element => element.getAttribute('data-action') || 'diagram'));
      expect(clipped).toEqual([]);
      const overlaps = await page.locator('.design-controls').evaluate(controls => {
        const box = controls.getBoundingClientRect();
        return ['.drawing-panel', '#step-change'].filter(selector => {
          const other = document.querySelector(selector).getBoundingClientRect();
          return Math.min(box.right, other.right) > Math.max(box.left, other.left) + 1 &&
            Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top) + 1;
        });
      });
      expect(overlaps, `overlap at ${viewport.width}×${viewport.height}, step ${step}`).toEqual([]);
      for (const action of ['previous', 'next']) {
        await expect(page.locator(`[data-action="${action}"]`),
          `${action} at ${viewport.width}×${viewport.height}, step ${step}`).toBeInViewport({ ratio: 1 });
      }
    }
  }
  expect(errors).toEqual([]);
});

test('the downloadable drawing contains editable Excalidraw elements and valid bindings', async ({ page }) => {
  await page.goto('/design-url-shortener/');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('a[download][href$=".excalidraw"]').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.excalidraw$/);
  const drawing = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(drawing.type).toBe('excalidraw');
  expect(drawing.version).toBe(2);
  expect(drawing.elements.some(element => element.type === 'text')).toBe(true);
  expect(drawing.elements.some(element => element.type === 'arrow')).toBe(true);
  const ids = new Set(drawing.elements.map(element => element.id));
  expect(ids.size).toBe(drawing.elements.length);
  for (const element of drawing.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding) expect(ids.has(binding.elementId)).toBe(true);
    }
  }
});

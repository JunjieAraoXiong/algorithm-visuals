const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('three same-time requests pass, the fourth is rejected, and time refills only up to capacity', async ({ page }) => {
  await page.goto('/design-rate-limiter/');
  await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 12');
  await expect(page.locator('[data-node="gateway"]')).toBeHidden();
  await page.locator('[data-step-select]').selectOption('2');
  await expect(page.locator('#token-count')).toHaveText('令牌 3 / 3');
  await expect(page.locator('#request-history')).toBeHidden();

  for (let request = 1; request <= 4; request++) {
    await page.locator('[data-action="next"]').click();
    await expect(page.locator('#clock-state')).toHaveText('t = 0 s');
    await expect(page.locator('#token-count')).toHaveText(`令牌 ${Math.max(0, 3 - request)} / 3`);
    await expect(page.locator('#service-count')).toHaveText(`已收到 ${Math.min(3, request)} 次`);
    await expect(page.locator(`[data-event="${request}"]`)).toHaveAttribute('data-result', request <= 3 ? 'allowed' : 'rejected');
  }
  await expect(page.locator('[data-flow="denied"]')).toBeVisible();
  await expect(page.locator('[data-flow="allowed"]')).toBeHidden();
  await expect(page.locator('#decision-evidence')).toContainText('429 Too Many Requests');
  await expect(page.locator('#decision-evidence')).toContainText('Retry-After: 1');

  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#token-count')).toHaveText('令牌 1 / 3');
  await expect(page.locator('#service-count')).toHaveText('已收到 3 次');
  await expect(page.locator('[data-flow="refill"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-event="5"]')).toHaveAttribute('data-result', 'allowed');
  await expect(page.locator('#token-count')).toHaveText('令牌 0 / 3');
  await expect(page.locator('#service-count')).toHaveText('已收到 4 次');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#clock-state')).toHaveText('t = 11 s');
  await expect(page.locator('#token-count')).toHaveText('令牌 3 / 3');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#token-count')).toHaveText('令牌 2 / 3');
  await expect(page.locator('#service-count')).toHaveText('已收到 5 次');

  await page.locator('[data-step-select]').selectOption('6');
  await expect(page.locator('#token-count')).toHaveText('令牌 0 / 3');
  await expect(page.locator('#clock-state')).toHaveText('t = 0 s');
  await expect(page.locator('#service-count')).toHaveText('已收到 3 次');
  await expect(page.locator('[data-event="5"]')).toBeHidden();
  await expect(page.locator('[data-event="6"]')).toBeHidden();
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-event="4"]')).toBeHidden();
  await expect(page.locator('[data-flow="denied"]')).toBeHidden();
});

test('parameter changes alter outcomes and saved links reproduce the same bucket and step', async ({ page }) => {
  await page.goto('/design-rate-limiter/#step=6');
  await page.getByLabel('桶容量', { exact: true }).selectOption('2');
  await page.getByLabel('每秒补充', { exact: true }).selectOption('2');
  await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 12');
  await expect(page).toHaveURL(/capacity=2&refill=2#step=0$/);
  await page.locator('[data-step-select]').selectOption('6');
  await expect(page.locator('[data-event="3"]')).toHaveAttribute('data-result', 'rejected');
  await expect(page.locator('[data-event="4"]')).toHaveAttribute('data-result', 'rejected');
  await expect(page.locator('#service-count')).toHaveText('已收到 2 次');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#token-count')).toHaveText('令牌 2 / 2');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#token-count')).toHaveText('令牌 1 / 2');
  await page.reload();
  await expect(page.locator('[data-count]')).toHaveText('步骤 9 / 12');
  await expect(page.getByLabel('桶容量', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('每秒补充', { exact: true })).toHaveValue('2');
  await expect(page.locator('#token-count')).toHaveText('令牌 1 / 2');
  await expect(page.locator('#service-count')).toHaveText('已收到 3 次');

  await page.getByLabel('桶容量', { exact: true }).selectOption('6');
  await page.locator('[data-step-select]').selectOption('6');
  await expect(page.locator('[data-event="4"]')).toHaveAttribute('data-result', 'allowed');
  await expect(page.locator('#token-count')).toHaveText('令牌 2 / 6');
  await expect(page.locator('#service-count')).toHaveText('已收到 4 次');
  await page.locator('[data-step-select]').selectOption('9');
  await expect(page.locator('#token-count')).toHaveText('令牌 6 / 6');
  await page.getByRole('button', { name: '从头开始' }).click();
  await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 12');
  await expect(page.getByLabel('桶容量', { exact: true })).toHaveValue('6');
});

test('minimum capacity caps refill, malformed parameters fall back, and keyboard navigation restores the initial design', async ({ page }) => {
  await page.goto('/design-rate-limiter/?capacity=1&refill=3#step=7');
  await expect(page.locator('#token-count')).toHaveText('令牌 1 / 1');
  await expect(page.locator('#service-count')).toHaveText('已收到 1 次');
  await expect(page.locator('[data-token]:visible')).toHaveCount(1);
  await page.goto('/design-rate-limiter/?capacity=-1&refill=99#step=9');
  await expect(page.getByLabel('桶容量', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('每秒补充', { exact: true })).toHaveValue('1');
  await expect(page.locator('#token-count')).toHaveText('令牌 3 / 3');
  const previous = page.locator('[data-action="previous"]');
  await previous.press('Home');
  await expect(previous).toBeDisabled();
  await expect(page.locator('[data-node="gateway"]')).toBeHidden();
  await expect(page.locator('#request-history')).toBeHidden();
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('[data-count]')).toHaveText('步骤 12 / 12');
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await expect(page.locator('#decision-why')).toContainText('原子执行');
});

test('desktop and embedded primary controls fit beneath the diagram without overlap', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 6, 9, 11]) {
      await page.goto(`/design-rate-limiter/#step=${step}`);
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 12`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const selector of ['[data-stage]', '[data-action="previous"]', '[data-action="next"]']) {
        await expect(page.locator(selector), `${selector} at ${viewport.width}, step ${step}`).toBeInViewport({ ratio: 1 });
      }
      expect(await page.locator('.av-transport').evaluate(controls => {
        const box = controls.getBoundingClientRect();
        const diagram = document.querySelector('.drawing-panel').getBoundingClientRect();
        return box.top >= diagram.bottom - 1;
      })).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('the original downloadable drawing is editable with reciprocal arrow bindings', async ({ page }) => {
  await page.goto('/design-rate-limiter/');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('a[download][href$=".excalidraw"]').click();
  const download = await downloadEvent;
  const drawing = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(drawing.type).toBe('excalidraw');
  const ids = new Map(drawing.elements.map(element => [element.id, element]));
  expect(ids.size).toBe(drawing.elements.length);
  expect(drawing.elements.some(element => element.type === 'text')).toBe(true);
  expect(drawing.elements.some(element => element.type === 'arrow')).toBe(true);
  for (const element of drawing.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (!binding) continue;
      expect(ids.has(binding.elementId)).toBe(true);
      expect(ids.get(binding.elementId).boundElements).toContainEqual({ id: element.id, type: 'arrow' });
    }
  }
});

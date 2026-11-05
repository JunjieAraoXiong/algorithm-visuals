const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

const epochMilliseconds = 1200000000000n;
const expectedID = (time, machine, sequence) => (
  time * (2n ** 22n) + 1n * (2n ** 17n) + BigInt(machine) * (2n ** 12n) + BigInt(sequence)
).toString();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('same-millisecond requests keep exact distinct IDs across requests and workers', async ({ page }) => {
  await page.goto('/design-unique-id/#step=5');
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds, 1, 0)}`);
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 0');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds, 1, 1)}`);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#output-b')).toHaveText(`B 最近一次：${expectedID(epochMilliseconds, 2, 0)}`);
  await expect(page.locator('#state-b')).toHaveText('last = T / seq = 0');
  await expect(page.locator('#field-machine')).toHaveText('2');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('#output-b')).toHaveText('B 最近一次：尚未生成');
  await expect(page.locator('#field-machine')).toHaveText('1');
  await page.locator('[data-step-select]').selectOption('11');
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds + 1n, 1, 0)}`);
  await expect(page.locator('#state-a')).toHaveText('last = T + 1 / seq = 0');
});

test('full 12-bit sequence exhaustion waits without issuing a duplicate, then resets in the next millisecond', async ({ page }) => {
  await page.goto('/design-unique-id/');
  await page.locator('#scenario').selectOption('overflow');
  await expect(page).toHaveURL(/\?scenario=overflow#step=8$/);
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 4094');
  await page.locator('[data-action="next"]').click();
  const finalID = expectedID(epochMilliseconds, 1, 4095);
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${finalID}`);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#architecture')).toHaveAttribute('data-status', 'waiting');
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${finalID}`);
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 4095');
  await page.reload();
  await expect(page.locator('#scenario')).toHaveValue('overflow');
  await expect(page.locator('[data-count]')).toContainText('11 / 15');
  await expect(page.locator('#architecture')).toHaveAttribute('data-status', 'waiting');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${finalID}`);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds + 1n, 1, 0)}`);
  await expect(page.locator('#state-a')).toHaveText('last = T + 1 / seq = 0');
});

test('clock rollback rejects without losing the high-water mark and replay restores it', async ({ page }) => {
  await page.goto('/design-unique-id/?scenario=rollback#step=9');
  await expect(page.locator('#architecture')).toHaveAttribute('data-status', 'rejected');
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds, 1, 1)}`);
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 1');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 1');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#output-a')).toHaveText(`A 最近一次：${expectedID(epochMilliseconds, 1, 2)}`);
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 2');
  await page.locator('[data-action="previous"]').press('ArrowLeft');
  await expect(page.locator('#state-a')).toHaveText('last = T / seq = 1');
  await page.locator('[data-action="previous"]').press('Home');
  await expect(page.locator('#bit-fields')).toBeHidden();
  await expect(page.locator('#output-a')).toHaveText('A 最近一次：尚未生成');
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('[data-count]')).toContainText('15 / 15');
  await expect(page.locator('#decision-why')).toContainText('11');
  await page.locator('[data-design-key="generate"]').click();
  await expect(page.locator('[data-count]')).toContainText('5 / 15');
});

test('desktop embeds retain the whole diagram and primary controls at initial, failure, and final states', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 10, 14]) {
      await page.goto(`/design-unique-id/?scenario=overflow#step=${step}`);
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 15`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#architecture')).toBeInViewport({ ratio: 1 });
      for (const action of ['previous', 'next']) {
        await expect(page.locator(`[data-action="${action}"]`), `${action} at ${viewport.width} × ${viewport.height}, step ${step}`).toBeInViewport({ ratio: 1 });
      }
      const overlap = await page.locator('.design-controls').evaluate(controls => {
        const box = controls.getBoundingClientRect();
        const other = document.querySelector('.drawing-panel').getBoundingClientRect();
        return Math.min(box.right, other.right) > Math.max(box.left, other.left) + 1 &&
          Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top) + 1;
      });
      expect(overlap).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('the editable diagram downloads with reciprocal arrow and text bindings', async ({ page }) => {
  await page.goto('/design-unique-id/');
  const downloaded = page.waitForEvent('download');
  await page.locator('a[download]').click();
  const file = await downloaded;
  const diagram = JSON.parse(await fs.readFile(await file.path(), 'utf8'));
  expect(diagram.type).toBe('excalidraw');
  const elements = new Map(diagram.elements.map(element => [element.id, element]));
  expect(elements.size).toBe(diagram.elements.length);
  expect(diagram.elements.filter(element => element.type === 'arrow').length).toBeGreaterThan(0);
  for (const element of diagram.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding) expect(elements.get(binding.elementId).boundElements).toContainEqual({ id: element.id, type: 'arrow' });
    }
    if (element.containerId) expect(elements.get(element.containerId).boundElements).toContainEqual({ id: element.id, type: 'text' });
  }
});

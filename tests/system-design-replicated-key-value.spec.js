const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('storage, acknowledgement, and a stale read are separate reversible events', async ({ page }) => {
  await page.goto('/design-replicated-key-value/?w=1&r=1&scenario=lag#step=2');
  await expect(page.locator('#version-a')).toHaveText('v1 / dark');
  await expect(page.locator('#write-count')).toHaveText('写确认 0 / 1');
  await expect(page.locator('#write-result')).toHaveText('写入：等待确认');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#write-count')).toHaveText('写确认 1 / 1');
  await expect(page.locator('#write-result')).toHaveText('写入：等待确认');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#write-result')).toContainText('成功');
  await expect(page.locator('#version-b')).toHaveText('v0 / light');
  await expect(page.locator('#version-c')).toHaveText('v0 / light');

  await page.locator('[data-step-select]').selectOption('9');
  await expect(page.locator('#read-responses')).toHaveText('已收响应：C:v0');
  await expect(page.locator('#read-count')).toHaveText('读响应 1 / 1');
  await page.locator('[data-step-select]').selectOption('11');
  await expect(page.locator('#read-responses')).toHaveText('已收响应：C:v0');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#read-result')).toHaveText('读取：返回 v0 / light');
  await expect(page.locator('#architecture')).toHaveAttribute('data-write-success', 'true');
  await page.locator('[data-step-select]').selectOption('15');
  for (const name of ['a', 'b', 'c']) await expect(page.locator(`#version-${name}`)).toHaveText('v1 / dark');
  await expect(page.locator('#read-result')).toHaveText('读取：返回 v0 / light');
  await page.locator('[data-step-select]').selectOption('2');
  await expect(page.locator('#write-count')).toHaveText('写确认 0 / 1');
  await expect(page.locator('#read-responses')).toHaveText('已收响应：无');
  await expect(page.locator('#version-c')).toHaveText('v0 / light');
});

test('the first R responses give the expected stale or fresh result for every quorum pair', async ({ page }) => {
  const cases = [
    [1, 1, 'lag', 'v0 / light'], [1, 2, 'lag', 'v0 / light'], [1, 3, 'lag', 'v1 / dark'],
    [2, 1, 'lag', 'v0 / light'], [2, 2, 'lag', 'v1 / dark'], [2, 3, 'lag', 'v1 / dark'],
    [3, 1, 'lag', 'v0 / light'], [3, 2, 'lag', 'v1 / dark'], [3, 3, 'lag', 'v1 / dark'],
    [1, 1, 'offline', 'v0 / light'], [1, 2, 'offline', 'v1 / dark'],
    [2, 1, 'offline', 'v1 / dark'], [2, 2, 'offline', 'v1 / dark'],
    [3, 1, 'offline', 'v1 / dark'], [3, 2, 'offline', 'v1 / dark']
  ];
  for (const [w, r, scenario, result] of cases) {
    await page.goto(`/design-replicated-key-value/?w=${w}&r=${r}&scenario=${scenario}#step=12`);
    await expect(page.locator('#read-result')).toHaveText(`读取：返回 ${result}`);
    await expect(page.locator('#read-count')).toHaveText(`读响应 ${r} / ${r}`);
    await expect(page.locator('#architecture')).toHaveAttribute('data-write-success', String(w < 3));
  }
});

test('offline C cannot satisfy R=3 or W=3 and recovery does not rewrite the old outcome', async ({ page }) => {
  await page.goto('/design-replicated-key-value/?w=3&r=3&scenario=offline#step=7');
  await expect(page.locator('#write-count')).toHaveText('写确认 2 / 3');
  await expect(page.locator('#write-result')).toHaveText('写入：超时，结果不确定');
  await expect(page.locator('#version-a')).toHaveText('v1 / dark');
  await expect(page.locator('#version-b')).toHaveText('v1 / dark');
  await expect(page.locator('[data-node="c"]')).toHaveClass(/is-offline/);
  await page.locator('[data-step-select]').selectOption('12');
  await expect(page.locator('#read-count')).toHaveText('读响应 2 / 3');
  await expect(page.locator('#read-result')).toHaveText('读取：不可用，响应不足');
  await expect(page.locator('#architecture')).toHaveAttribute('data-returned-version', 'none');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-node="c"]')).not.toHaveClass(/is-offline/);
  await expect(page.locator('#version-c')).toHaveText('v0 / light');
  await page.locator('[data-step-select]').selectOption('15');
  await expect(page.locator('#version-c')).toHaveText('v1 / dark');
  await expect(page.locator('#write-result')).toHaveText('写入：超时，结果不确定');
  await expect(page.locator('#read-result')).toHaveText('读取：不可用，响应不足');
});

test('selectors, saved links and keyboard replay restore the chosen failure scenario', async ({ page }) => {
  await page.goto('/design-replicated-key-value/');
  await page.getByLabel('写确认 W', { exact: true }).selectOption('2');
  await page.getByLabel('读响应 R', { exact: true }).selectOption('2');
  await page.getByLabel('副本 C 状态', { exact: true }).selectOption('offline');
  await page.locator('[data-step-select]').selectOption('12');
  await expect(page).toHaveURL(/w=2&r=2&scenario=offline#step=12$/);
  await page.reload();
  await expect(page.locator('#read-result')).toHaveText('读取：返回 v1 / dark');
  await expect(page.getByLabel('副本 C 状态', { exact: true })).toHaveValue('offline');
  await page.locator('[data-action="previous"]').press('Home');
  await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 17');
  await expect(page.locator('[data-action="previous"]')).toBeDisabled();
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('[data-count]')).toHaveText('步骤 17 / 17');
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await expect(page.locator('#decision-evidence')).toContainText('不能单独推出线性一致性');
  await page.goto('/design-replicated-key-value/?w=99&r=-2&scenario=unknown#step=0');
  await expect(page.getByLabel('写确认 W', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('读响应 R', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('副本 C 状态', { exact: true })).toHaveValue('lag');
});

test('primary controls and the stable replica drawing fit desktop and embed views in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 900 }, { width: 900, height: 700 }, { width: 760, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 7, 12, 16]) {
      await page.goto(`/design-replicated-key-value/?w=3&r=3&scenario=offline#step=${step}`);
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 17`);
      for (const selector of ['[data-stage]', '[data-action="previous"]', '[data-action="next"]']) {
        await expect(page.locator(selector), `${selector}: ${viewport.width}, step ${step}`).toBeInViewport({ ratio: 1 });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.av-transport').evaluate(element => element.getBoundingClientRect().top >= document.querySelector('.drawing-panel').getBoundingClientRect().bottom - 1)).toBe(true);
    }
  }
  await page.getByRole('button', { name: '深色模式', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#architecture text').first()).toHaveCSS('fill', 'rgb(231, 227, 219)');
  expect(errors).toEqual([]);
});

test('the editable drawing has unique elements and reciprocal arrow references', async ({ page }) => {
  await page.goto('/design-replicated-key-value/');
  const pending = page.waitForEvent('download');
  await page.locator('a[download][href$=".excalidraw"]').click();
  const download = await pending;
  const drawing = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(drawing.type).toBe('excalidraw');
  const elements = new Map(drawing.elements.map(element => [element.id, element]));
  expect(elements.size).toBe(drawing.elements.length);
  expect(drawing.elements.some(element => element.type === 'text')).toBe(true);
  for (const element of drawing.elements) {
    for (const binding of [element.startBinding, element.endBinding]) {
      if (binding) expect(elements.get(binding.elementId).boundElements).toContainEqual({ id: element.id, type: 'arrow' });
    }
  }
});

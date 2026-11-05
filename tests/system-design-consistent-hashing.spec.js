const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const model = require('../src/system-design/03-consistent-hashing/model');

const route = '/design-consistent-hashing/';
const movedKeys = page => page.locator('[data-key][data-moved="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.key));
const ringState = page => page.locator('#scene').evaluate(node => node.innerHTML);

test('fixed inputs give exact ownership changes and preserve surviving token coordinates', () => {
  const before = model.assignment(model.initial);
  expect(before).toEqual({ k0: 'A', k1: 'B', k2: 'B', k3: 'C', k4: 'C', k5: 'C', k6: 'C', k7: 'C', k8: 'C', k9: 'A', k10: 'A', k11: 'A' });
  expect(model.changed(before, model.assignment(model.members('add')))).toEqual(['k3', 'k4']);
  expect(model.changed(before, model.assignment(model.members('remove')))).toEqual(['k1', 'k2']);
  expect(model.successor(348, model.tokens(model.initial, 1)).id).toBe('A0');
  for (const count of [1, 3, 6]) {
    const oldTokens = model.tokens(model.initial, count);
    const added = model.tokens(model.members('add'), count).filter(token => token.owner !== 'D');
    const removed = model.tokens(model.members('remove'), count);
    expect(added).toEqual(oldTokens);
    expect(removed).toEqual(oldTokens.filter(token => token.owner !== 'B'));
    for (const scenario of ['add', 'remove']) {
      const oldMap = model.assignment(model.initial, count);
      const newMap = model.assignment(model.members(scenario), count);
      for (const id of model.changed(oldMap, newMap)) {
        if (scenario === 'add') expect(newMap[id]).toBe('D');
        else expect(oldMap[id]).toBe('B');
      }
    }
  }
  expect(model.distribution(model.initial, model.assignment(model.initial, 1))).toEqual({ A: 4, B: 2, C: 6 });
  expect(model.distribution(model.initial, model.assignment(model.initial, 3))).toEqual({ A: 4, B: 4, C: 4 });
});

test('modulo and ring compare the same keys, and rewinding restores exact coordinates and ownership', async ({ page }) => {
  await page.goto(`${route}#step=2`);
  await expect(page.locator('#decision-evidence')).toContainText('7 / 12');
  expect(await movedKeys(page)).toEqual(['k1', 'k2', 'k4', 'k7', 'k8', 'k9', 'k10']);
  await page.locator('[data-step-select]').selectOption('5');
  const before = await ringState(page);
  const coordinates = await page.locator('[data-key]').evaluateAll(nodes => nodes.map(node => [node.dataset.key, node.querySelector('circle').getAttribute('cx'), node.querySelector('circle').getAttribute('cy')]));
  await page.locator('[data-action="next"]').click();
  expect(await movedKeys(page)).toEqual(['k3', 'k4']);
  await expect(page.locator('#decision-evidence')).toContainText('环改变 2 / 12');
  await expect(page.locator('[data-server="D"]')).toHaveAttribute('data-keys', 'k3,k4');
  const changedCoordinates = await page.locator('[data-key]').evaluateAll(nodes => nodes.map(node => [node.dataset.key, node.querySelector('circle').getAttribute('cx'), node.querySelector('circle').getAttribute('cy')]));
  expect(changedCoordinates).toEqual(coordinates);
  await page.locator('[data-action="previous"]').click();
  expect(await ringState(page)).toBe(before);
});

test('migration distinguishes the new routing plan, missing data, and prepared static values', async ({ page }) => {
  await page.goto(`${route}#step=6`);
  await expect(page.locator('[data-value-status]')).toHaveCount(0);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-value-status]')).toHaveText('MISS / 未复制');
  await expect(page.locator('#decision-evidence')).toContainText('k3 的路由：C → D');
  await expect(page.locator('#decision-tradeoff')).toContainText('如果节点真正故障且没有副本');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-value-status]')).toHaveText('value 已准备');
  await expect(page.locator('#decision-tradeoff')).toContainText('并未实现网络复制');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-value-status]')).toHaveText('MISS / 未复制');
});

test('membership, selected key, virtual nodes and step reproduce the same state after reload', async ({ page }) => {
  await page.goto(`${route}#step=5`);
  await page.locator('#selected-key').selectOption('k11');
  await expect(page.locator('#decision-evidence')).toContainText('→ A0');
  await page.locator('#membership').selectOption('remove');
  await page.locator('[data-action="next"]').click();
  expect(await movedKeys(page)).toEqual(['k1', 'k2']);
  await page.locator('[data-step-select]').selectOption('10');
  await expect(page.locator('[data-token]')).toHaveCount(9);
  await page.locator('#virtual-count').selectOption('6');
  await expect(page.locator('[data-token]')).toHaveCount(18);
  await expect(page.locator('#decision-evidence')).toContainText('A: 4  B: 4  C: 4');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-token]')).toHaveCount(12);
  expect(await movedKeys(page)).toEqual(['k1', 'k6', 'k10', 'k11']);
  const state = await ringState(page);
  await expect(page).toHaveURL(/membership=remove&key=k11&vnodes=6#step=11$/);
  await page.reload();
  await expect(page.locator('[data-count]')).toContainText('12 / 13');
  expect(await ringState(page)).toBe(state);
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-token]')).toHaveCount(18);
  await page.locator('[data-action="next"]').click();
  expect(await ringState(page)).toBe(state);
  await page.locator('[data-action="next"]').press('End');
  await expect(page.locator('#decision-tradeoff')).toContainText('不能把虚拟节点数量当作可用性的证明');
  await page.locator('#restart').click();
  await expect(page.locator('[data-count]')).toContainText('1 / 13');
  await expect(page.locator('#membership')).toHaveValue('remove');
  await expect(page.locator('[data-action="previous"]')).toBeDisabled();
});

test('primary controls fit desktop and embedded viewports at representative steps', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1440, height: 1000 }, { width: 760, height: 700 }, { width: 900, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const step of [0, 6, 10, 12]) {
      await page.goto(`${route}#step=${step}`);
      await expect(page.locator('[data-count]')).toContainText(`${step + 1} / 13`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const selector of ['[data-stage]', '[data-action="previous"]', '[data-action="next"]']) {
        await expect(page.locator(selector), `${selector}, ${viewport.width}, step ${step}`).toBeInViewport({ ratio: 1 });
      }
      const controlsCoverStage = await page.locator('.design-controls').evaluate(controls => {
        const a = controls.getBoundingClientRect();
        const b = document.querySelector('.drawing-panel').getBoundingClientRect();
        return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      });
      expect(controlsCoverStage).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('download is an original editable diagram with valid element bindings', async ({ page }) => {
  await page.goto(route);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('a[download]').click();
  const download = await downloadEvent;
  const drawing = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(drawing.type).toBe('excalidraw');
  expect(drawing.elements.some(element => element.type === 'ellipse')).toBe(true);
  expect(drawing.elements.some(element => element.type === 'arrow')).toBe(true);
  const ids = new Set(drawing.elements.map(element => element.id));
  expect(ids.size).toBe(drawing.elements.length);
  for (const element of drawing.elements) for (const binding of [element.startBinding, element.endBinding]) {
    if (binding) expect(ids.has(binding.elementId)).toBe(true);
  }
});

const {test, expect} = require('@playwright/test');

async function finish(page) {
  const options = page.locator('[data-step-select] option');
  await page.locator('[data-step-select]').selectOption(String(await options.count() - 1));
}

test('both inversion methods mirror entire subtrees and accept an empty tree', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/invert-binary-tree/#step=0');
  for (const method of ['recursive','iterative']) {
    await page.locator('[data-case]').selectOption(method);
    await finish(page);
    await expect(page.locator('[data-result]')).toContainText('5 → [8, 1]');
    const x = id => page.locator(`[data-visual-element="node-${id}"]`).getAttribute('cx').then(Number);
    expect(await x('c')).toBeLessThan(await x('a'));
    expect(await x('b')).toBeGreaterThan(await x('a'));
    expect(await x('f')).toBeLessThan(await x('c'));
    expect(await x('e')).toBeLessThan(await x('b'));
    expect(await x('d')).toBeGreaterThan(await x('b'));
    await page.locator('[data-step-select]').selectOption('0');
    expect(await x('b')).toBeLessThan(await x('a'));
  }
  await page.locator('[data-case]').selectOption('empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('None');
  await expect(page.locator('svg .node')).toHaveCount(0);
});

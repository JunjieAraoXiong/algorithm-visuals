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

test('balance validation propagates internal imbalance instead of accepting equal root heights', async ({page}) => {
  await page.goto('/balanced-binary-tree-validation/#step=0');
  await finish(page);
  await expect(page.locator('[data-result]')).toContainText('False');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('h=-1');
  await expect(page.locator('[data-visual-element="label-a"]')).toHaveText('h=-1');
  await page.locator('[data-case]').selectOption('balanced');
  await finish(page);
  await expect(page.locator('[data-result]')).toContainText('True');
  await expect(page.locator('[data-visual-element="label-a"]')).toHaveText('h=4');
  await page.locator('[data-case]').selectOption('empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toContainText('True');
});

test('right view includes a deeper node from the left subtree and freezes each BFS level', async ({page}) => {
  await page.goto('/rightmost-nodes-of-a-binary-tree/#step=0');
  const options=page.locator('[data-step-select] option');
  const index=await options.evaluateAll(items=>items.findIndex(o=>o.textContent.includes('queue.append(node.left)')));
  await page.locator('[data-step-select]').selectOption(String(index));
  await expect(page.locator('[data-memory-items]')).toContainText('下一层');
  await expect(page.locator('[data-memory-note]')).toContainText('level_size=1');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('[1, 3, 6, 11]');
  await page.locator('[data-case]').selectOption('empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('[]');
});

test('width includes interior gaps but enqueues only real nodes', async ({page}) => {
  await page.goto('/widest-binary-tree-level/#step=0');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('7');
  await expect(page.locator('[data-visual-element="width-label"]')).toHaveText('width = 7');
  await expect(page.locator('svg .node')).toHaveCount(10);
  await expect(page.locator('svg .ghost')).toHaveCount(4);
  await expect(page.locator('[data-memory-items]')).toHaveText('∅');
  await page.locator('[data-case]').selectOption('empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('0');
});

test('BST bounds reject ancestor violations, short-circuit the right subtree, and reject equality', async ({page}) => {
  await page.goto('/binary-search-tree-validation/#step=0');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('False');
  await expect(page.locator('[data-visual-element="label-e"]')).toHaveText('(2,5)');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('跳过');
  await expect(page.locator('[data-visual-element="label-f"]')).toHaveCount(0);
  await page.locator('[data-case]').selectOption('duplicate');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('False');
  await expect(page.locator('[data-visual-element="label-f"]')).toHaveText('(5,7)');
  for (const mode of ['valid','empty']) {
    await page.locator('[data-case]').selectOption(mode);
    await finish(page);
    await expect(page.locator('[data-result]')).toHaveText('True');
  }
});

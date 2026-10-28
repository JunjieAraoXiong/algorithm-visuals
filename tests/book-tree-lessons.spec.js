const {test, expect} = require('@playwright/test');

async function finish(page) {
  if(new URL(page.url()).pathname==='/lowest-common-ancestor/') {
    await page.locator('[data-stage]').press('End');
    return;
  }
  const options = page.locator('[data-step-select] option');
  await page.locator('[data-step-select]').selectOption(String(await options.count() - 1));
}

async function chooseCase(page, value) {
  const button = page.locator(`[data-case-value="${value}"]`);
  if (await button.count()) await button.click();
  else await page.locator('[data-case]').selectOption(value);
}

test('both inversion methods mirror entire subtrees and accept an empty tree', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/invert-binary-tree/#step=0');
  for (const method of ['recursive','iterative']) {
    const button=page.getByRole('button',{name:method==='recursive'?'递归 Recursive':'迭代 Iterative',exact:true});
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed','true');
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
  await page.getByRole('button',{name:'空树示例',exact:true}).click();
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('None');
  await expect(page.locator('svg .node')).toHaveCount(0);
});

test('iterative inversion keeps root before pop and retains the last node after the stack empties', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/invert-binary-tree/?case=iterative#step=0');
  await expect(page.locator('[data-reference-name="root"]')).toHaveAttribute('data-reference-target','a');
  await expect(page.locator('[data-visual-element="scope-label-root"]')).toHaveText('第 1 层的 root');
  await expect(page.locator('[data-memory] h3')).toContainText('stack');
  const options=page.locator('[data-step-select] option');
  const finalWhile=await options.evaluateAll(items=>items.map((o,i)=>o.textContent.includes('while stack')?i:-1).filter(i=>i>=0).pop());
  await page.locator('[data-step-select]').selectOption(String(finalWhile));
  await expect(page.locator('[data-memory-items]')).toHaveText('∅');
  await expect(page.locator('[data-reference-name="node"]')).toHaveAttribute('data-reference-target','f');
  await expect(page.locator('[data-visual-element="scope-label-node"]')).toHaveText('第 1 层的 node');
  await expect(page.locator('[data-visual-element="null-reference"]')).toHaveCount(0);
  const nodeY=Number(await page.locator('[data-visual-element="node-f"]').getAttribute('cy'));
  const referenceY=Number(await page.locator('[data-visual-element="scope-label-node"]').getAttribute('y'));
  expect(referenceY).toBe(nodeY-45);
  await finish(page);
  await expect(page.locator('[data-reference-name="root"]')).toHaveAttribute('data-reference-target','a');
});

test('balance validation propagates internal imbalance instead of accepting equal root heights', async ({page}) => {
  await page.goto('/balanced-binary-tree-validation/#step=0');
  await finish(page);
  await expect(page.locator('[data-result]')).toContainText('False');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('h=-1');
  await expect(page.locator('[data-visual-element="label-a"]')).toHaveText('h=-1');
  await chooseCase(page, 'balanced');
  await finish(page);
  await expect(page.locator('[data-result]')).toContainText('True');
  await expect(page.locator('[data-visual-element="label-a"]')).toHaveText('h=4');
  await chooseCase(page, 'empty');
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
  await chooseCase(page, 'empty');
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
  await chooseCase(page, 'empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('0');
});

test('BST bounds reject ancestor violations, short-circuit the right subtree, and reject equality', async ({page}) => {
  await page.goto('/binary-search-tree-validation/#step=0');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('False');
  await expect(page.locator('[data-visual-element="label-e"]')).toHaveText('(2,5)');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('跳过');
  await expect(page.locator('[data-visual-element="label-f"]')).toHaveText('跳过');
  await expect(page.locator('[data-visual-element="label-g"]')).toHaveText('跳过');
  await chooseCase(page, 'duplicate');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('False');
  await expect(page.locator('[data-visual-element="label-f"]')).toHaveText('(5,7)');
  for (const mode of ['valid','empty']) {
    await chooseCase(page, mode);
    await finish(page);
    await expect(page.locator('[data-result]')).toHaveText('True');
  }
});

test('LCA handles both child regions, an ancestor target, and targets inside the same child', async ({page}) => {
  await page.goto('/lowest-common-ancestor/#step=0');
  const cases={split:'LCA(8, 7) = 3',selfLeft:'LCA(3, 8) = 3',selfRight:'LCA(3, 7) = 3',same:'LCA(8, 9) = 6'};
  for (const [mode,answer] of Object.entries(cases)) {
    await chooseCase(page, mode);
    await finish(page);
    await expect(page.locator('[data-result]')).toHaveText(answer);
  }
  await expect(page.locator('[data-visual-element="label-f"]')).toHaveText('T*');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('T');
});

test('reconstruction creates roots before connecting returned children and consumes preorder once', async ({page}) => {
  await page.goto('/build-binary-tree-from-preorder-and-inorder-traversals/#step=0');
  const index=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('node = TreeNode(5)')));
  await page.locator('[data-step-select]').selectOption(String(index));
  await expect(page.locator('svg .node')).toHaveCount(1);
  await expect(page.locator('svg .stored-edge')).toHaveCount(0);
  await finish(page);
  await expect(page.locator('svg .node')).toHaveCount(6);
  await expect(page.locator('svg .stored-edge')).toHaveCount(5);
  await expect(page.locator('[data-result]')).toContainText('左 9（左 2）；右 3（左 4，右 7）');
  await expect(page.locator('[data-arrays]')).toContainText('preorder_index = 6');
  await page.locator('[data-step-select]').selectOption(String(index));
  await expect(page.locator('svg .stored-edge')).toHaveCount(0);
  await chooseCase(page, 'empty');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('None');
});

test('maximum path separates the two-arm candidate 30 from gain 21 and accepts all-negative input', async ({page}) => {
  await page.goto('/maximum-sum-of-a-continuous-path-in-a-binary-tree/#step=0');
  const index=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('return 8 + max(9, 13)')));
  await page.locator('[data-step-select]').selectOption(String(index));
  await expect(page.locator('[data-result]')).toHaveText('max_sum = 30');
  await expect(page.locator('[data-visual-element="label-c"]')).toHaveText('↑21');
  const d=await page.locator('[data-visual-element="band-0"]').getAttribute('d');
  expect(d.split('L')).toHaveLength(3);
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('30 · 路径 9 → 8 → 7 → 6');
  await chooseCase(page, 'negative');
  await finish(page);
  await expect(page.locator('[data-result]')).toHaveText('-2 · 路径 -2');
  await expect(page.locator('[data-visual-element="node-b"]')).toHaveClass(/on-path/);
  await expect(page.locator('[data-visual-element="node-a"]')).not.toHaveClass(/on-path/);
});

test('a child reference leaves its parent position label readable on desktop', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const width of [1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/widest-binary-tree-level/#step=0');
    const index=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('node, i = (11, 10)')));
    await page.locator('[data-step-select]').selectOption(String(index));
    const overlaps=await page.locator('[data-stage] svg').evaluate(svg=>{
      const box=svg.querySelector('[data-visual-element="reference-box"]').getBBox();
      const label=svg.querySelector('[data-visual-element="index-e"]').getBBox();
      return box.x<label.x+label.width && box.x+box.width>label.x && box.y<label.y+label.height && box.y+box.height>label.y;
    });
    expect(overlaps).toBe(false);
    await expect(page.locator('[data-visual-element="index-e"]')).toHaveText('i=4');
  }
});

test('queue front and back follow FIFO order even when the next layer is waiting', async ({page}) => {
  await page.goto('/rightmost-nodes-of-a-binary-tree/#step=0');
  const options=page.locator('[data-step-select] option');
  const push=await options.evaluateAll(items=>items.findIndex(o=>o.textContent.includes('queue.append(node.right)')));
  await page.locator('[data-step-select]').selectOption(String(push));
  await expect(page.locator('.queue-head')).toContainText('队首');
  await expect(page.locator('.queue-head > div')).toHaveText('2');
  await expect(page.locator('.queue-tail > div')).toHaveText('3');
  await expect(page.locator('.queue-head')).toHaveClass(/next-level/);
  const pop=await options.evaluateAll((items,after)=>items.findIndex((o,i)=>i>after && o.textContent.includes('node = queue.popleft()')),push);
  await page.locator('[data-step-select]').selectOption(String(pop));
  await expect(page.locator('.queue-head > div')).toHaveText('3');
  await expect(page.locator('.queue-head .memory-role')).toHaveText('队首 / 队尾');
  await expect(page.locator('.queue-head')).not.toHaveClass(/next-level/);
  await finish(page);
  await expect(page.locator('.memory-role')).toHaveCount(0);
});

test('an explicit stack marks the next pop while recursion marks the executing call', async ({page}) => {
  await page.goto('/invert-binary-tree/?case=iterative#step=0');
  const push=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('stack.append(node.right)')));
  await page.locator('[data-step-select]').selectOption(String(push));
  await expect(page.locator('.memory-item.current .memory-role')).toHaveText('栈顶 · 待弹出');
  await expect(page.locator('.memory-item.current > div')).toHaveText('stack[1] → 节点 1');
  await expect(page.locator('[data-visual-element="node-a"]')).toHaveClass(/active/);
  await page.goto('/balanced-binary-tree-validation/#step=0');
  const child=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex((o,i)=>i>2 && o.textContent.includes('if not node')));
  await page.locator('[data-step-select]').selectOption(String(child));
  await expect(page.locator('.memory-item.current .memory-role')).toHaveText('当前调用');
  await expect(page.locator('.memory-item.current > div')).toHaveText('node = 2');
});

test('map insertion emphasis clears on the next iteration', async ({page}) => {
  await page.goto('/build-binary-tree-from-preorder-and-inorder-traversals/#step=0');
  const write=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('inorder_indexes_map[2] = 0')));
  await page.locator('[data-step-select]').selectOption(String(write));
  await expect(page.locator('.memory-item.current .memory-role')).toHaveText('本次写入');
  await expect(page.locator('.memory-item.current > div')).toHaveText('2 → 0');
  await expect(page.locator('[data-stage]')).toBeHidden();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.memory-item.current')).toHaveCount(0);
  await expect(page.locator('.memory-role')).toHaveCount(0);
  const node=await page.locator('[data-step-select] option').evaluateAll(items=>items.findIndex(o=>o.textContent.includes('node = TreeNode(5)')));
  await page.locator('[data-step-select]').selectOption(String(node));
  await expect(page.locator('[data-stage]')).toBeVisible();
  await expect(page.locator('svg .node')).toHaveCount(1);
  await finish(page);
  await expect(page.locator('svg .node')).toHaveCount(6);
});

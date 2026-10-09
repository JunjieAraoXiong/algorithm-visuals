const { test, expect } = require('@playwright/test');

const lessons = [
  'binary-tree-symmetry',
  'binary-tree-columns',
  'kth-smallest-number-in-a-binary-search-tree',
  'serialize-and-deserialize-a-binary-tree'
];
const mark = (page, key) => page.locator(`[data-visual-element="${key}"]`);

async function selectStep(page, label) {
  await page.locator('[data-step-select]').selectOption({ label });
}

for (const slug of lessons) {
  test(`${slug}: every diagram mark fits at 320px and desktop`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${slug}/#step=0`);
      const select = page.locator('[data-step-select]');
      const count = await select.locator('option').count();
      for (let step = 0; step < count; step += 1) {
        await select.selectOption(String(step));
        const clipped = await page.locator('[data-lines]').evaluate(svg => {
          const box = svg.viewBox.baseVal;
          return [...svg.querySelectorAll('text, circle, path')].flatMap(text => {
            if (Number(text.getAttribute('opacity') ?? 1) === 0) return [];
            const b = text.getBBox();
            return b.x < -1 || b.y < -1 || b.x + b.width > box.width + 1 || b.y + b.height > box.height + 1
              ? [text.textContent || text.getAttribute('data-visual-element')] : [];
          });
        });
        expect(clipped, `${slug} step ${step + 1} at ${width}px`).toEqual([]);
        if (width === 1280) {
          const active = page.locator('[data-source-key][aria-current="step"]');
          await expect(active.first()).toBeAttached();
          await expect.poll(() => active.evaluateAll(lines => lines.flatMap(line => {
            const r = line.getBoundingClientRect();
            return r.top < 0 || r.bottom > window.innerHeight
              ? [line.getAttribute('data-source-key')] : [];
          })), { message: `${slug} step ${step + 1}: active code is below the viewport` }).toEqual([]);
        }
      }
    }
  });
}

test('columns: BFS badges agree with the actual dequeue order', async ({ page }) => {
  await page.goto('/binary-tree-columns/#step=2');
  // Node IDs are assigned in DFS order; these badges must describe BFS instead.
  for (const [id, order] of [[0, 1], [1, 2], [4, 3], [2, 4], [3, 5], [5, 6], [6, 7]]) {
    await expect(mark(page, `i3-ov-${id}`)).toHaveText(String(order));
  }
  await selectStep(page, '收集列 2 → [7]');
  await expect(mark(page, 'out-v-2')).toHaveText('[5,1,4]');
});

test('BST: return to the correct ancestor and show right-pointer movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/kth-smallest-number-in-a-binary-search-tree/#step=0');
  await selectStep(page, '访问 5 → 序号 4');
  // The completed left subtree must no longer be shown as an active call path.
  await expect(mark(page, 'e-4')).toHaveAttribute('stroke', '#c4c2b8');
  await selectStep(page, 'inorder 完成 → sorted_list');
  await expect(mark(page, 'sl-result')).toHaveCount(0);
  await selectStep(page, 'return sorted_list[4] = 6 ✓');
  await expect(mark(page, 'sl-result')).toHaveText('return sorted_list[k-1] = sorted_list[4] = 6 ✓');
  await selectStep(page, 'push 2 · 一路向左');
  await expect(page.locator('[data-m-node]')).toHaveText('None');
  await selectStep(page, 'node → 8 · 转向右子树');
  await expect(page.locator('[data-source-key="iter-right"]')).toHaveAttribute('aria-current', 'step');
  await expect(mark(page, 'node-val')).toHaveText('node = 8');
  await expect(page.locator('[data-m-visited]')).toHaveText('4 / 7');
  await selectStep(page, '✦ pop 6 · k = 0');
  await expect(page.locator('[data-m-visited]')).toHaveText('5 / 7');
  await selectStep(page, '⑤ 两版对比');
  await expect(page.locator('[data-m-visited]')).toHaveText('递归 7 · 迭代 5');
});

test('serialization: depths unwind and links appear when child calls return', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/serialize-and-deserialize-a-binary-tree/#step=0');
  await selectStep(page, '6 的右孩子空 → \'#\'');
  await expect(page.locator('[data-m-depth]')).toHaveText('4');
  await selectStep(page, '⑤ 完整串：join');
  await expect(page.locator('[data-m-depth]')).toHaveText('—');
  await expect(mark(page, 'join-t')).toHaveText('"5,3,1,#,#,4,#,#,9,6,#,#,#"');
  const firstRow = Number(await mark(page, 'slt-0').getAttribute('y'));
  const secondRow = Number(await mark(page, 'slt-7').getAttribute('y'));
  expect(secondRow).toBeGreaterThan(firstRow);
  await selectStep(page, '建节点 1（3 的左孩子）');
  await expect(mark(page, 'de-3-1')).toHaveCount(0);
  await selectStep(page, 'return node 1 · 子树构造完成');
  await expect(mark(page, 'de-3-1')).toHaveCount(1);
  await selectStep(page, '⑦ deserialize 返回根 5');
  await expect(page.locator('[data-m-depth]')).toHaveText('—');
  await page.locator('[data-stage]').press('End');
  await expect(page.locator('[data-m-prog-v]')).toHaveText('13 / 13');
  await expect(page.locator('[data-m-nodes-v]')).toHaveText('6 / 6');
});

test('symmetry: finish each child before returning its result to the parent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/binary-tree-symmetry/#step=0');
  await selectStep(page, 'dfs(3, 3) 返回 True');
  await expect(page.locator('[data-source-key="recurse-right"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-m-depth]')).toHaveText('2');
  await expect(page.locator('[data-invariant]')).toContainText('当前这两棵子树互为镜像');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-m-depth]')).toHaveText('1');
  await expect(page.locator('[data-phase]')).toHaveText('主例 · 对称树');
});

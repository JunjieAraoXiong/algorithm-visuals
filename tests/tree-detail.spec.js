const {test, expect} = require('@playwright/test');

const lessons = [
  'balanced-binary-tree-validation', 'widest-binary-tree-level',
  'binary-search-tree-validation', 'lowest-common-ancestor',
  'build-binary-tree-from-preorder-and-inorder-traversals',
  'maximum-sum-of-a-continuous-path-in-a-binary-tree'
];
async function findStep(page, text) {
  const index = await page.locator('[data-step-select] option').evaluateAll((options, text) => options.findIndex(option => option.textContent.includes(text)), text);
  expect(index, `missing step: ${text}`).toBeGreaterThanOrEqual(0);
  await page.locator('[data-step-select]').selectOption(String(index));
  return index;
}

test('a None call returns to the exact parent local, which is assigned only on receipt', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/balanced-binary-tree-validation/#step=0');
  await page.getByRole('button', {name:'空子树返回', exact:true}).click();
  await expect(page.locator('[data-handoff]')).toContainText('第 4 层 · node → None → 第 3 层 · node → 节点 1');
  await expect(page.locator('.handoff-source')).toContainText('left_height = get_height_imbalance(node.left)');
  await expect(page.locator('.handoff-source')).not.toContainText('undefined');
  const parent = page.locator('.call-frame').nth(2);
  await expect(parent.locator('dd')).toHaveText(['未赋值', '未赋值']);
  const before = await page.locator('[data-memory-items]').textContent();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.call-frame')).toHaveCount(3);
  await expect(page.locator('.call-frame.current dd')).toHaveText(['0', '未赋值']);
  await expect(page.locator('[data-source-key="left"]')).toHaveAttribute('aria-current','step');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-memory-items]')).toHaveText(before);
  await page.reload();
  await expect(page.locator('.call-frame')).toHaveCount(4);
  await page.getByRole('button', {name:'发现失衡', exact:true}).click();
  await expect(page.locator('[data-handoff]')).toContainText('return -1');
  await expect(page.locator('[data-decision]')).toContainText('高度差 |0 − 2| = 2');
});

test('tree construction distinguishes choosing a value, allocating a node, and receiving a child', async ({page}) => {
  await page.goto('/build-binary-tree-from-preorder-and-inorder-traversals/#step=0');
  await findStep(page, 'val = preorder[0] = 5');
  await expect(page.locator('.call-frame.current > div')).toHaveText('node = 未创建');
  await expect(page.locator('[data-stage] .node')).toHaveCount(0);
  await page.getByRole('button', {name:'创建根节点',exact:true}).click();
  await expect(page.locator('.call-frame.current > div')).toHaveText('node = 节点 5');
  await expect(page.locator('[data-stage] .stored-edge')).toHaveCount(0);
  await page.getByRole('button', {name:'空区间返回',exact:true}).click();
  await expect(page.locator('[data-handoff]')).toContainText('node.left → None');
  await expect(page.locator('.call-frame.current > div')).toHaveText('node = 未创建');
  await page.getByRole('button', {name:'接回左子树',exact:true}).click();
  await expect(page.locator('[data-handoff]')).toContainText('接收');
});

test('path sum shows the single-arm return separately from the global two-arm answer', async ({page}) => {
  await page.goto('/maximum-sum-of-a-continuous-path-in-a-binary-tree/#step=0');
  await page.getByRole('button', {name:'比较两臂候选',exact:true}).click();
  await expect(page.locator('[data-decision]')).toContainText('8 + 9 + 13 = 30');
  await page.getByRole('button', {name:'只返回一臂',exact:true}).click();
  await expect(page.locator('[data-decision]')).toContainText('8 + max(9, 13) = 21');
  await expect(page.locator('[data-handoff]')).toContainText('return 21');
  await expect(page.locator('[data-handoff]')).toContainText('right_sum = max(21, 0)');
  await expect(page.locator('[data-result]')).toHaveText('max_sum = 30');
});

test('the width strip counts gaps and never adds them to the real-node queue', async ({page}) => {
  await page.goto('/widest-binary-tree-level/#step=0');
  await page.getByRole('button', {name:'第 4 层宽度',exact:true}).click();
  await expect(page.locator('.width-slot')).toHaveCount(7);
  await expect(page.locator('.empty-slot')).toHaveCount(3);
  await expect(page.locator('[data-decision]')).toContainText('13 − 7 + 1 = 7');
  await expect(page.locator('[data-decision]')).toContainText('4 个真实节点');
  await expect(page.locator('[data-memory-items]')).toHaveText('∅');
  await page.getByRole('button', {name:'空树',exact:true}).click();
  await expect(page.locator('.width-slot')).toHaveCount(0);
  await page.locator('[data-stage]').press('End');
  await expect(page.locator('[data-result]')).toHaveText('0');
});

for (const slug of lessons) {
  test(`${slug}: all detailed frames remain legible at supported widths`, async ({page}) => {
    test.setTimeout(120000);
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const width of (slug==='lowest-common-ancestor'?[760,1280]:[320,1280])) {
      await page.setViewportSize({width,height:900});
      await page.goto(`/${slug}/#step=0`);
      const compact=slug==='lowest-common-ancestor';
      const count=compact?Number((await page.locator('[data-count]').innerText()).match(/\/\s*(\d+)/)[1]):await page.locator('[data-step-select] option').count();
      if(compact) expect(count).toBe(96);
      for(let index=0;index<count;index++) {
        if(compact) {
          if(index) await page.locator('[data-action="next"]').click();
          await expect(page.locator('[data-count]')).toHaveText(`步骤 ${index+1} / ${count}`);
        } else await page.locator('[data-step-select]').selectOption(String(index));
        const issues=await page.locator('[data-animation-panel]').evaluate(panel=>{
          const svg=panel.querySelector('[data-stage] svg'), bounds=svg.viewBox.baseVal;
          if (panel.querySelector('[data-stage]').hidden) return [];
          const issues=[...svg.querySelectorAll('text,circle,path')].flatMap(mark=>{
            const b=mark.getBBox();
            return b.x < -1 || b.y < -1 || b.x+b.width > bounds.width+1 || b.y+b.height > bounds.height+1 ? [mark.getAttribute('data-visual-element')] : [];
          });
          const nodes=[...svg.querySelectorAll('.node')];
          for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
            const a=nodes[i],b=nodes[j];
            if(Math.hypot(a.cx.baseVal.value-b.cx.baseVal.value,a.cy.baseVal.value-b.cy.baseVal.value)<a.r.baseVal.value+b.r.baseVal.value+2) issues.push('overlapping nodes');
          }
          if(document.documentElement.scrollWidth>innerWidth) issues.push('page overflow');
          if(panel.textContent.includes('undefined')) issues.push('undefined value');
          return issues;
        });
        expect(issues,`${slug} at ${width}px, step ${index}`).toEqual([]);
        await expect(page.locator('[data-source-key][aria-current="step"]')).toHaveCount(1);
      }
      await page.locator('[data-stage]').press('Home');
      if(compact) await expect(page.locator('[data-count]')).toHaveText(`步骤 1 / ${count}`);
      else await expect(page.locator('[data-step-select]')).toHaveValue('0');
      await page.locator('[data-action="next"]').press('End');
      if(compact) await expect(page.locator('[data-count]')).toHaveText(`步骤 ${count} / ${count}`);
      else await expect(page.locator('[data-step-select]')).toHaveValue(String(count-1));
    }
    expect(errors).toEqual([]);
  });
}

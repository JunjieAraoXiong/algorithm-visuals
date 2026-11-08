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
  await expect(page.locator('[data-expression]')).toContainText('build_subtree(0, -1)');
  await expect(page.locator('[data-expression]')).toContainText('True');
  await expect(page.locator('[data-expression]')).toContainText('return None');
  expect(await page.locator('[data-source-key][aria-current="step"]').evaluateAll(lines=>lines.map(line=>line.dataset.sourceKey).sort())).toEqual(['check','empty','left']);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node = 未创建');
  await expect(page.locator('[data-arrays]')).toContainText('preorder_index = 3');
  const emptyState=await page.locator('[data-memory-items]').textContent();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-expression]')).toHaveText('2.left = None');
  await expect(page.locator('[data-source-key="left"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('[data-source-key][aria-current="step"]')).toHaveCount(1);
  await expect(page.locator('[data-handoff]')).toContainText('接收');
  await expect(page.locator('[data-arrays]')).toContainText('preorder_index = 3');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('[data-memory-items]')).toHaveText(emptyState);
  await findStep(page, 'return 2');
  await expect(page.locator('[data-stage] .stored-edge')).toHaveCount(0);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-expression]')).toHaveText('9.left = 2');
  await expect(page.locator('[data-stage] .stored-edge')).toHaveCount(1);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node = 节点 9');
});

test('construction overview separates preorder consumption from inorder partitions and rewinds exactly', async ({page}) => {
  await page.goto('/build-binary-tree-from-preorder-and-inorder-traversals/#step=0');
  const overview=page.locator('[data-call-overview]');
  const rows=overview.locator('tbody tr');
  const inorder=page.locator('.array-row[data-traversal="inorder"]');
  await findStep(page, '0 > 5');
  await expect(page.locator('[data-expression]')).toContainText('False');
  await expect(rows).toHaveCount(1);
  await findStep(page, 'inorder_indexes_map[5] = 2');
  expect(await rows.first().locator('td').allTextContents().then(values=>values.map(value=>value.replace(/\s/g,'')))).toEqual(['[0,5]','0','5','2','[0,1]','[3,5]']);
  expect(await inorder.locator('.array-cell').evaluateAll(cells=>cells.map(cell=>cell.dataset.region))).toEqual(['left','left','root','right','right','right']);
  await expect(page.locator('[data-partition]')).toContainText(/左\s*\[0,\s*1\]/);
  await expect(page.locator('[data-partition]')).toContainText(/根\s*2/);
  await expect(page.locator('[data-partition]')).toContainText(/右\s*\[3,\s*5\]/);
  const leftStep=await findStep(page, 'inorder_indexes_map[9] = 1');
  await expect(rows).toHaveCount(2);
  const leftRows=await rows.allTextContents();
  await findStep(page, 'inorder_indexes_map[3] = 4');
  await expect(rows).toHaveCount(4);
  expect(await rows.locator('td:nth-child(2)').allTextContents()).toEqual(['0','1','2','3']);
  await expect(overview.locator('tr[aria-current="step"] td:nth-child(3)')).toHaveText('3');
  expect(await inorder.locator('.array-cell').evaluateAll(cells=>cells.map(cell=>cell.dataset.region))).toEqual(['outside','outside','outside','left','root','right']);
  await page.locator('[data-step-select]').selectOption(String(leftStep));
  await expect(rows).toHaveText(leftRows);
  await expect(overview.locator('tr[aria-current="step"] td:nth-child(3)')).toHaveText('9');
  await page.reload();
  await expect(rows).toHaveText(leftRows);
  await page.locator('[data-stage]').press('End');
  await expect(rows).toHaveCount(6);
  expect(await rows.locator('td:nth-child(2)').allTextContents()).toEqual(['0','1','2','3','4','5']);
  expect(await rows.locator('td:nth-child(3)').allTextContents()).toEqual(['5','9','2','3','4','7']);
  expect(await rows.locator('td:nth-child(4)').allTextContents()).toEqual(['2','1','0','4','3','5']);
  await expect(overview.locator('tr[aria-current="step"]')).toHaveCount(0);
});

test('construction keeps the current operation visible when its call overview grows', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:1280,height:900},{width:760,height:700}]) {
    await page.setViewportSize(viewport);
    await page.goto('/build-binary-tree-from-preorder-and-inorder-traversals/#step=0');
    for(const expression of ['preorder_index = 0','build_subtree(0, -1)','inorder_indexes_map[7] = 5','buildTree 返回 5']) {
      await findStep(page,expression);
      await expect.poll(()=>page.locator('.operation').evaluate(operation=>{
        const panel=operation.closest('[data-animation-panel]');
        const bounds=panel.getBoundingClientRect();
        const top=bounds.top+panel.clientTop,bottom=top+panel.clientHeight;
        const current=operation.getBoundingClientRect();
        return current.top>=top-1 && current.bottom<=bottom+1;
      }),{message:`current operation is outside the animation scrollport at ${viewport.width}px: ${expression}`}).toBe(true);
    }
  }
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
    const reconstruction=slug==='build-binary-tree-from-preorder-and-inorder-traversals';
    for (const width of (slug==='lowest-common-ancestor'||reconstruction?[760,1280]:[1280])) {
      await page.setViewportSize({width,height:reconstruction&&width===760?700:900});
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
        const active=await page.locator('[data-source-key][aria-current="step"]').evaluateAll(lines=>lines.map(line=>line.dataset.sourceKey).sort());
        if(reconstruction && active.includes('empty')) {
          expect([['check','empty','left'],['check','empty','right']]).toContainEqual(active);
        } else expect(active).toHaveLength(1);
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

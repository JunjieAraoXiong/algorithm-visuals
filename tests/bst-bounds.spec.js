const {test, expect} = require('@playwright/test');

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/binary-search-tree-validation/#step=0');
});

test('ancestor bounds explain the failed condition and restore the caller on return', async ({page}) => {
  await page.getByRole('button', {name:'边界失败',exact:true}).click();
  await expect(page.locator('[data-bst-context]')).toContainText('root.left.right → 节点 6');
  await expect(page.locator('[data-lower-value]')).toHaveText('lower_bound = 2');
  await expect(page.locator('[data-lower-origin]')).toContainText('来自节点 2');
  await expect(page.locator('[data-upper-value]')).toHaveText('upper_bound = 5');
  await expect(page.locator('[data-upper-origin]')).toContainText('来自节点 5');
  await expect(page.locator('[data-bst-condition]')).toContainText('not False = True：进入 return False');
  await expect(page.locator('[data-source-key="bounds"]')).toHaveAttribute('aria-current','step');
  const upper=Number(await page.locator('[data-upper-end]').getAttribute('cx'));
  const marker=await page.locator('[data-value-marker]').evaluate(node=>node.getBBox().x);
  expect(marker).toBeGreaterThan(upper);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-handoff]')).toContainText('return False');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-bst-context]')).toContainText('root.left → 节点 2');
  await expect(page.locator('[data-lower-value]')).toHaveText('lower_bound = −∞');
  await expect(page.locator('[data-upper-value]')).toHaveText('upper_bound = 5');
  await expect(page.locator('[data-bst-condition]')).toContainText('本层直接返回同一个结果');
  await page.getByRole('button', {name:'最终结果',exact:true}).click();
  await expect(page.locator('[data-bst-context]')).toContainText('首次失败 · root.left.right');
  await expect(page.locator('[data-result]')).toHaveText('False');
  for(const id of ['c','f','g']) {
    await expect(page.locator(`[data-visual-element="node-${id}"]`)).toHaveAttribute('data-bst-status','skipped');
    await expect(page.locator(`[data-visual-element="label-${id}"]`)).toHaveText('跳过');
  }
  await page.locator('[data-stage]').press('Home');
  await expect(page.locator('[data-stage] [data-bst-status="skipped"]')).toHaveCount(0);
  await expect(page.locator('[data-upper-origin]')).toHaveText('没有祖先上界');
});

test('equal-valued nodes remain distinguishable and empty/valid cases clear the failed state', async ({page}) => {
  await page.getByRole('button', {name:'重复 7：等于边界',exact:true}).click();
  await page.getByRole('button', {name:'边界失败',exact:true}).click();
  await expect(page.locator('[data-bst-context]')).toContainText('root.right.left → 节点 7');
  await expect(page.locator('[data-lower-value]')).toHaveText('lower_bound = 5');
  await expect(page.locator('[data-upper-value]')).toHaveText('upper_bound = 7');
  await expect(page.locator('[data-explanation]')).toContainText('7 等于上界');
  const endpoint=Number(await page.locator('[data-upper-end]').getAttribute('cx'));
  const center=await page.locator('[data-value-marker]').evaluate(node=>{const b=node.getBBox();return b.x+b.width/2;});
  expect(center).toBe(endpoint);
  for(const name of ['合法 BST','空树']) {
    await page.getByRole('button', {name,exact:true}).click();
    await page.locator('[data-stage]').press('End');
    await expect(page.locator('[data-result]')).toHaveText('True');
    await expect(page.locator('[data-bst-context]')).toContainText('验证完成');
    await expect(page.locator('[data-stage] [data-bst-status="invalid"]')).toHaveCount(0);
    await expect(page.locator('[data-stage] [data-bst-status="skipped"]')).toHaveCount(0);
  }
  await expect(page.locator('[data-value-marker]')).toHaveAttribute('d','');
  await expect(page.locator('[data-value-label]')).toHaveText('None：不比较数值');
  await expect(page.locator('[data-bst-condition]')).toContainText('空树通过验证');
});

test('range labels and complete source lines fit desktop layouts', async ({page}) => {
  for(const width of [1280]) {
    await page.setViewportSize({width,height:900});
    await page.locator('[data-tree-history] > summary').click();
    await expect(page.locator('.bst-range')).toBeVisible();
    for(const name of ['6 违反祖先上界','重复 7：等于边界','合法 BST','空树']) {
      await page.getByRole('button', {name,exact:true}).click();
      const count=await page.locator('[data-step-select] option').count();
      for(let step=0;step<count;step++) {
        await page.locator('[data-step-select]').selectOption(String(step));
        const issues=await page.locator('#lesson').evaluate(root=>{
          const errors=[],svg=root.querySelector('.bst-range'),view=svg.viewBox.baseVal;
          for(const mark of svg.querySelectorAll('text,path,circle')){
            const b=mark.getBBox();
            if(b.x<0||b.y<0||b.x+b.width>view.width||b.y+b.height>view.height)errors.push('range mark clipped');
          }
          const code=root.querySelector('[data-code-scroll]');
          if(code.scrollWidth>code.clientWidth) {
            // Complete Python now scrolls inside the right-hand workbench.
            // Verify that the far edge remains reachable, rather than requiring
            // the full implementation to be shrunk to the column width.
            if(!['auto','scroll'].includes(getComputedStyle(code).overflowX))errors.push('complete source cannot scroll horizontally');
            const before=code.scrollLeft;
            code.scrollLeft=code.scrollWidth;
            if(code.scrollLeft+code.clientWidth<code.scrollWidth-1)errors.push('complete source far edge is unreachable');
            code.scrollLeft=before;
          }
          const active=code.querySelector('[aria-current="step"]'),a=active.getBoundingClientRect(),c=code.getBoundingClientRect();
          if(a.top<c.top-1||a.bottom>c.bottom+1)errors.push('active code line clipped');
          if(document.documentElement.scrollWidth>innerWidth)errors.push('page overflow');
          return errors;
        });
        expect(issues,`${name}, ${width}px, step ${step}`).toEqual([]);
      }
    }
  }
});

test('stepping keeps the tree and current stack together with controls beneath code', async ({page}) => {
  for(const width of [800,1280,1440]) {
    await page.setViewportSize({width,height:720});
    await page.goto('/binary-search-tree-validation/#step=0');
    const count=await page.locator('[data-step-select] option').count();
    for(let step=0;step<count;step++) {
      await page.locator('[data-step-select]').selectOption(String(step));
      const geometry=await page.locator('[data-learning-layout]').evaluate(layout=>{
        const rect=selector=>layout.querySelector(selector).getBoundingClientRect();
        const tree=rect('[data-stage]'),stack=rect('.av-tree-call-path'),next=rect('[data-action="next"]'),code=rect('[data-code-panel]');
        return {
          stackBelowTree:stack.top>=tree.bottom,
          treeVisible:tree.top>=0&&tree.bottom<=innerHeight,
          stackVisible:stack.top>=0&&stack.bottom<=innerHeight,
          controlsBesideTree:next.left>=tree.right,
          controlsBelowCode:next.top>=code.bottom,
          controlsVisible:next.top>=0&&next.bottom<=innerHeight
        };
      });
      expect(geometry,`${width}px, step ${step}`).toEqual({
        stackBelowTree:true,treeVisible:true,stackVisible:true,controlsBesideTree:true,controlsBelowCode:true,controlsVisible:true
      });
      const calls=await page.locator('.call-frame').count();
      await expect(page.locator('.av-tree-call')).toHaveCount(Math.max(1,calls));
    }
  }
});

test('the return destination stays visible while full history can be expanded', async ({page}) => {
  await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-step-select]').selectOption('11');
  await expect(page.locator('.call-frame')).toHaveCount(4);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node → None');
  await expect(page.locator('.handoff-source')).toHaveText('回到第 17 行 · 检查左子树');
  await expect(page.locator('.av-tree-summary')).toContainText('return True → 第 3 层（待接收）');
  await expect(page.locator('.av-tree-summary')).toBeInViewport({ratio:1});
  const history=page.locator('[data-tree-history]');
  await expect(history).not.toHaveAttribute('open','');
  await history.locator('summary').click();
  await expect(page.locator('[data-handoff]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.call-frame')).toHaveCount(3);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node → 1');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('.call-frame')).toHaveCount(4);
});

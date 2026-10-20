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

test('range labels and complete source lines fit phone and desktop layouts', async ({page}) => {
  for(const width of [320,1280]) {
    await page.setViewportSize({width,height:900});
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
          if(code.scrollWidth>code.clientWidth)errors.push('code needs horizontal scrolling');
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

test('stepping keeps the entire tree and recursive stack together in a laptop viewport', async ({page}) => {
  for(const width of [800,1280,1440]) {
    await page.setViewportSize({width,height:720});
    await page.goto('/binary-search-tree-validation/#step=0');
    const count=await page.locator('[data-step-select] option').count();
    for(let step=0;step<count;step++) {
      await page.locator('[data-step-select]').selectOption(String(step));
      const geometry=await page.locator('[data-animation-panel]').evaluate(panel=>{
        const rect=selector=>panel.querySelector(selector).getBoundingClientRect();
        const tree=rect('[data-stage]'),stack=rect('[data-memory]'),next=rect('[data-action="next"]');
        return {
          parallel:stack.left>=tree.right,
          treeVisible:tree.top>=next.bottom&&tree.bottom<=innerHeight,
          stackVisible:stack.top>=next.bottom&&stack.bottom<=innerHeight,
          controlsVisible:next.top>=0&&next.bottom<=innerHeight
        };
      });
      expect(geometry,`${width}px, step ${step}`).toEqual({
        parallel:true,treeVisible:true,stackVisible:true,controlsVisible:true
      });
    }
  }
});

test('the return destination remains beside the tree and mobile controls stay reachable', async ({page}) => {
  await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-step-select]').selectOption('11');
  await expect(page.locator('.call-frame')).toHaveCount(4);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node → None');
  await expect(page.locator('.handoff-source')).toHaveText('回到第 17 行 · 检查左子树');
  expect(await page.locator('[data-handoff]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.call-frame')).toHaveCount(3);
  await expect(page.locator('.call-frame.current > div')).toHaveText('node → 1');
  await page.locator('[data-action="previous"]').click();
  await expect(page.locator('.call-frame')).toHaveCount(4);
  await page.setViewportSize({width:390,height:844});
  await page.locator('.call-frame.current').scrollIntoViewIfNeeded();
  expect(await page.locator('[data-action="next"]').evaluate(el=> {
    const b=el.getBoundingClientRect();
    return b.top>=0&&b.bottom<=innerHeight;
  })).toBe(true);
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('.call-frame.current > div')).toHaveText('node → 1');
});

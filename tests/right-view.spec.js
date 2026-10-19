const {test, expect} = require('@playwright/test');

test('layer shortcuts preserve the queue boundary and restore the right-view result', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/rightmost-nodes-of-a-binary-tree/#step=0');
  const coordinates = () => page.locator('svg .node').evaluateAll(nodes => nodes.map(node => [node.getAttribute('cx'), node.getAttribute('cy')]));
  const initial = await coordinates();
  await page.getByRole('button',{name:'第 2 层',exact:true}).click();
  await expect(page.locator('[data-source-key="size"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('[data-current-queue] .memory-item > div')).toHaveText(['2','3']);
  await expect(page.locator('[data-next-queue] .memory-item')).toHaveCount(0);
  await expect(page.locator('[data-depth-result]')).toHaveText(['1','·','·','·']);

  const options=await page.locator('[data-step-select] option').allTextContents();
  const rejected=options.findIndex(text => text.endsWith('0 == 2 - 1'));
  await page.locator('[data-step-select]').selectOption(String(rejected));
  await expect(page.locator('[data-decision]')).toHaveAttribute('data-outcome','false');
  await expect(page.locator('[data-current-queue] .memory-item > div')).toHaveText(['3']);
  await expect(page.locator('[data-next-queue] .memory-item > div')).toHaveText(['4','5']);
  await expect(page.locator('[data-size]')).toHaveText('level_size = 2');
  await expect(page.locator('[data-depth-result]')).toHaveText(['1','·','·','·']);

  const append=options.map((text,index)=>text.endsWith('res.append(node.val)')?index:-1).filter(index=>index>=0).pop();
  await page.locator('[data-step-select]').selectOption(String(append));
  await expect(page.locator('[data-depth-result]')).toHaveText(['1','3','6','11']);
  await expect(page.locator('[data-explanation]')).toContainText('来自左子树');
  expect(await coordinates()).toEqual(initial);
  await page.getByRole('button',{name:'← 上一步',exact:true}).click();
  await expect(page.locator('[data-depth-result]')).toHaveText(['1','3','6','·']);
  await expect(page.locator('[data-decision]')).toHaveAttribute('data-outcome','true');
  await page.getByRole('button',{name:'看结果',exact:true}).click();
  await expect(page.locator('[data-result]')).toHaveText('[1, 3, 6, 11]');
  await expect(page.locator('[data-answer-cells]')).toBeHidden();
  await page.reload();
  await expect(page.locator('[data-result]')).toHaveText('[1, 3, 6, 11]');
  await page.getByRole('button',{name:'第 1 层',exact:true}).click();
  await expect(page.locator('[data-depth-result]')).toHaveText(['·','·','·','·']);
  await page.locator('[data-case]').selectOption('empty');
  await expect(page.locator('[data-level-jump]:enabled')).toHaveCount(0);
  await expect(page.locator('svg .node')).toHaveCount(0);
  await page.getByRole('button',{name:'看结果',exact:true}).click();
  await expect(page.locator('[data-result]')).toHaveText('[]');
});

test('the drawing remains readable at 320px in both themes', async ({page}) => {
  await page.setViewportSize({width:320,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/rightmost-nodes-of-a-binary-tree/#step=0');
  for (const iteration of [0,1]) {
    if (iteration) await page.getByRole('button',{name:/深色模式|浅色模式/}).click();
    await page.getByRole('button',{name:'第 4 层',exact:true}).click();
    const problems=await page.locator('[data-stage] svg').evaluate(svg=>{
      const width=svg.viewBox.baseVal.width, height=svg.viewBox.baseVal.height;
      const marks=[...svg.querySelectorAll('text,.node,.view-slot')];
      return marks.filter(mark=>{
        const box=mark.getBBox();
        return box.x<0||box.y<0||box.x+box.width>width||box.y+box.height>height;
      }).map(mark=>mark.dataset.visualElement);
    });
    expect(problems).toEqual([]);
    expect(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.locator('[data-stage]').press('End');
    await expect(page.locator('[data-result]')).toHaveText('[1, 3, 6, 11]');
    await page.locator('[data-stage]').press('Home');
    await expect(page.locator('[data-count]')).toHaveText('步骤 1 / 70');
  }
});

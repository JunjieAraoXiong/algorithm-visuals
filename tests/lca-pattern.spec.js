const {test, expect} = require('@playwright/test');

const variables={self:'node_is_p_or_q',left:'left_contains_p_or_q',right:'right_contains_p_or_q'};

async function expectRegions(page, values) {
  const panel=page.locator('[data-lca-regions]');
  await expect(panel).toBeVisible();
  for(const [region,value] of Object.entries(values)) {
    const cell=panel.locator(`[data-region="${region}"]`);
    await expect(cell).toContainText(variables[region]);
    await expect(cell).toContainText(value);
  }
}

function localValue(call, name) {
  return call.locator(`.call-locals dt:text-is("${name}") + dd`);
}

function diagramClipping(svg) {
  const view=svg.viewBox.baseVal;
  return [...svg.querySelectorAll('text, .reference-box, .reference')].filter(el=>{
    const box=el.getBBox();
    return box.x<0 || box.y<0 || box.x+box.width>view.width || box.y+box.height>view.height;
  }).map(el=>el.getAttribute('data-visual-element') || el.textContent);
}

test('the two-region condition precedes saving a separate global LCA reference', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/lowest-common-ancestor/?case=same#step=72');
  const picker=page.locator('[data-step-select]');
  await expect(picker.locator('option')).toHaveCount(96);
  await expect(page.locator('[data-source-key="two"]')).toHaveAttribute('aria-current','step');
  await expectRegions(page,{self:'False',left:'True',right:'True'});
  await expect(page.locator('[data-region-summary]')).toContainText('条件成立');
  await expect(page.locator('[data-region-summary]')).toContainText(/下一行.*保存/);
  await expect(page.locator('[data-result]')).toHaveText('lca = None');
  await expect(page.locator('[data-reference-name="lca"]')).toHaveAttribute('data-reference-target','None');

  await page.locator('[data-action="next"]').click();
  await expect(page).toHaveURL(/case=same#step=73$/);
  await expect(page.locator('[data-source-key="set"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('[data-region-summary]')).toContainText('已保存');
  await expect(page.locator('[data-result]')).toHaveText('lca = 6');
  await expect(page.locator('[data-reference-name="lca"]')).toHaveAttribute('data-reference-target','f');

  await picker.selectOption('77');
  await expect(page.locator('[data-visual-element="reference-label"]')).toHaveText('第 3 层 node');
  await expect(page.locator('[data-visual-element="node-g"]')).toHaveClass(/active/);
  await expect(page.locator('[data-reference-name="lca"]')).toHaveAttribute('data-reference-target','f');
  await expect(page.locator('[data-result]')).toHaveText('lca = 6');

  await picker.selectOption('90');
  await expect(page.locator('[data-visual-element="reference-label"]')).toHaveText('第 2 层 node');
  await expect(page.locator('[data-visual-element="node-c"]')).toHaveClass(/active/);
  await expectRegions(page,{self:'False',left:'True',right:'False'});
  await expect(page.locator('[data-region-summary]')).toContainText(/保留|不更新/);
  await expect(page.locator('[data-reference-name="lca"]')).toHaveAttribute('data-reference-target','f');
  await expect(page.locator('[data-result]')).toHaveText('lca = 6');
});

test('uncomputed locals stay unassigned until their own line receives a child return', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/lowest-common-ancestor/?case=same#step=2');
  await expectRegions(page,{self:'未赋值',left:'未赋值',right:'未赋值'});
  await page.locator('[data-action="next"]').click();
  await expectRegions(page,{self:'False',left:'未赋值',right:'未赋值'});

  await page.locator('[data-step-select]').selectOption('12');
  await expect(page.locator('[data-source-key="empty"]')).toHaveAttribute('aria-current','step');
  const calls=page.locator('.call-frame');
  await expect(calls).toHaveCount(4);
  await expect(localValue(calls.nth(2),'left_contains_p_or_q')).toHaveText('未赋值');
  await expect(localValue(calls.nth(2),'right_contains_p_or_q')).toHaveText('未赋值');
  await expect(localValue(calls.nth(3),'left_contains_p_or_q')).toHaveText('未赋值');

  await page.locator('[data-action="next"]').click();
  await expect(page).toHaveURL(/#step=13$/);
  await expect(calls).toHaveCount(3);
  await expect(page.locator('[data-source-key="left"]')).toHaveAttribute('aria-current','step');
  await expectRegions(page,{self:'False',left:'False',right:'未赋值'});
  await expect(localValue(calls.nth(2),'left_contains_p_or_q')).toHaveText('False');
  await expect(localValue(calls.nth(1),'left_contains_p_or_q')).toHaveText('未赋值');
});

test('rewinding restores the unsaved reference and each query resets the saved answer', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/lowest-common-ancestor/?case=same#step=73');
  const reference=page.locator('[data-reference-name="lca"]');
  await expect(reference).toHaveAttribute('data-reference-target','f');
  const stage=page.locator('[data-stage]');
  await stage.press('ArrowLeft');
  await expect(page).toHaveURL(/#step=72$/);
  await expect(reference).toHaveAttribute('data-reference-target','None');
  await expect(page.locator('[data-result]')).toHaveText('lca = None');
  await stage.press('ArrowRight');
  await expect(reference).toHaveAttribute('data-reference-target','f');
  await page.reload();
  await expect(page).toHaveURL(/case=same#step=73$/);
  await expect(reference).toHaveAttribute('data-reference-target','f');
  await stage.press('Home');
  await expect(reference).toHaveAttribute('data-reference-target','None');
  await stage.press('End');
  await expect(page.locator('[data-result]')).toHaveText('LCA(8, 9) = 6');
  await expect(reference).toHaveAttribute('data-reference-target','f');

  await page.locator('[data-case-value="selfRight"]').click();
  await expect(page).toHaveURL(/case=selfRight#step=0$/);
  await expect(reference).toHaveAttribute('data-reference-target','None');
  await expect(page.locator('[data-result]')).toHaveText('lca = None');
  await stage.press('End');
  await expect(page.locator('[data-result]')).toHaveText('LCA(3, 7) = 3');
  await expect(reference).toHaveAttribute('data-reference-target','c');
  await page.locator('[data-case-value="same"]').click();
  await expect(reference).toHaveAttribute('data-reference-target','None');
});

test('region variables and both references fit phone, embed and desktop widths', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,760,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/lowest-common-ancestor/?case=same#step=0');
    const picker=page.locator('[data-step-select]');
    for(const step of [2,3,12,13,72,73,75,77,90,95]) {
      await picker.selectOption(String(step));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await page.locator('[data-stage] svg').evaluate(diagramClipping)).toEqual([]);
      const overflowing=await page.locator('[data-region]').evaluateAll(cells=>cells.filter(cell=>cell.scrollWidth>cell.clientWidth+1).map(cell=>cell.dataset.region));
      expect(overflowing).toEqual([]);
      await expect(page.locator('[data-source-key][aria-current="step"]')).toHaveCount(1);
    }
  }
});

test('a returning child flag stays separate from the saved global reference', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,760,1280]) {
    await page.setViewportSize({width,height:900});
    for(const [mode,step] of [['same',75],['split',92]]) {
      await page.goto(`/lowest-common-ancestor/?case=${mode}#step=${step}`);
      await expect(page.locator('[data-visual-element="scope-box-saved-lca"]')).toBeVisible();
      await expect(page.locator('[data-visual-element="return-label"]')).toBeVisible();
      const overlapping=await page.locator('[data-stage] svg').evaluate(svg=>{
        const saved=svg.querySelector('[data-visual-element="scope-box-saved-lca"]').getBBox();
        const returned=svg.querySelector('[data-visual-element="return-label"]').getBBox();
        return saved.x<returned.x+returned.width && saved.x+saved.width>returned.x && saved.y<returned.y+returned.height && saved.y+saved.height>returned.y;
      });
      expect(overlapping,`${mode} #${step} at width ${width}`).toBe(false);
      expect(await page.locator('[data-stage] svg').evaluate(diagramClipping)).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
});

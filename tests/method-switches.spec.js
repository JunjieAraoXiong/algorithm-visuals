const {test,expect}=require('@playwright/test');
const choice=(page,method)=>page.getByRole('button',{name:method==='recursive'?'递归 Recursive':'迭代 Iterative',exact:true});
async function finish(page){
  const picker=page.locator('[data-step-select]');
  await picker.selectOption(String(await picker.locator('option').count()-1));
}
for(const slug of ['kth-smallest-number-in-a-binary-search-tree','the-josephus-problem']) {
  test(`${slug}: visible choices switch independent traces and restore permalinks`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const width of [320,760,1280]) {
      await page.setViewportSize({width,height:700});
      await page.goto(`/${slug}/?method=recursive#step=0`);
      await expect(choice(page,'recursive')).toBeInViewport();
      await expect(choice(page,'iterative')).toBeInViewport();
      await choice(page,'iterative').click();
      await expect(choice(page,'iterative')).toHaveAttribute('aria-pressed','true');
      await expect(choice(page,'recursive')).toHaveAttribute('aria-pressed','false');
      await expect(page).toHaveURL(/method=iterative#step=0$/);
      await expect(page.locator('[data-source-key][aria-current="step"]').first()).toHaveAttribute('data-source-key',/^iter-/);
      await page.locator('[data-action="next"]').click();
      await page.reload();
      await expect(choice(page,'iterative')).toHaveAttribute('aria-pressed','true');
      await expect(page).toHaveURL(/method=iterative#step=1$/);
      await choice(page,'iterative').click();
      await expect(page).toHaveURL(/#step=1$/);
      await finish(page);
      await expect(page.locator('[data-expression]')).toContainText(slug==='the-josephus-problem'?'return res':'return node.val = 6');
      await choice(page,'recursive').focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/method=recursive#step=0$/);
      await expect(choice(page,'recursive')).toHaveAttribute('aria-pressed','true');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  });
}
test('Josephus iterative updates use the previous smaller answer and return the actual survivor',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/the-josephus-problem/?method=iterative#step=0');
  const people=[0,1,2,3,4];let start=0;
  while(people.length>1){start=(start+1)%people.length;people.splice(start,1);}
  const picker=page.locator('[data-step-select]');
  for(const [size,result] of [[2,0],[3,2],[4,0],[5,2]]) {
    await picker.selectOption({label:`${2*size-2}. 循环 i = ${size}`});
    await expect(page.locator('[data-explanation]')).toContainText('尚未更新');
    const before=await page.locator('[data-value="result"]').innerText();
    await page.locator('[data-action="next"]').click();
    expect(result).toBe((Number(before)+2)%size);
    await expect(page.locator('[data-value="result"]')).toHaveText(String(result));
    await expect(page.locator('[data-value="depth"]')).toHaveText('0');
    await expect(page.locator('[data-source-key="iter-update"]')).toHaveAttribute('aria-current','step');
  }
  await finish(page);
  await expect(page.locator('[data-value="result"]')).toHaveText(String(people[0]));
  await choice(page,'recursive').click();await finish(page);
  await expect(page.locator('[data-value="result"]')).toHaveText(`${people[0]}（C）`);
});
test('old combined BST links still open the corresponding iterative frame',async({page})=>{
  await page.goto('/kth-smallest-number-in-a-binary-search-tree/?method=recursive#step=0');
  const recursiveCount=await page.locator('[data-step-select] option').count();
  await page.goto(`/kth-smallest-number-in-a-binary-search-tree/#step=${recursiveCount}`);
  await expect(choice(page,'iterative')).toHaveAttribute('aria-pressed','true');
  await expect(page).toHaveURL(/method=iterative#step=0$/);
  await expect(page.locator('[data-m-k]')).toHaveText('5');
});
test('linked-list method choices navigate inside an embedded frame',async({page,baseURL})=>{
  await page.setViewportSize({width:760,height:700});
  await page.goto('/reverse-linked-list/#step=0');
  await page.setContent(`<iframe title="Notion-style visual" style="width:100%;height:650px;border:0" sandbox="allow-scripts allow-same-origin" src="${baseURL}/reverse-linked-list/#step=0"></iframe>`);
  const visual=page.frameLocator('iframe');
  const recursive=visual.getByRole('link',{name:/递归 Recursive/});
  const iterative=visual.getByRole('link',{name:/迭代 Iterative/});
  await expect(recursive).toBeVisible();await expect(iterative).toHaveAttribute('aria-current','page');
  const outer=page.url();
  await recursive.click();
  await expect(visual.locator('#recursive-lab')).toBeVisible();
  await expect(recursive).toHaveAttribute('aria-current','page');
  await expect(visual.locator('[data-source-key="entry"]')).toHaveAttribute('aria-current','step');
  await iterative.click();
  await expect(visual.locator('#reverse-list-lab')).toBeVisible();
  expect(page.url()).toBe(outer);
});


test('Josephus iteration marks stay inside the diagram at phone and embed widths',async({page})=>{
  for(const width of [320,760]) {
    await page.setViewportSize({width,height:700});
    await page.goto('/the-josephus-problem/?method=iterative#step=0');
    const picker=page.locator('[data-step-select]');
    const count=await picker.locator('option').count();
    for(let i=0;i<count;i++) {
      await picker.selectOption(String(i));
      const clipped=await page.locator('[data-scene]').evaluate(svg=>{
        const v=svg.viewBox.baseVal;
        return [...svg.querySelectorAll('text,circle,path')].filter(el=>{
          if(el.closest('defs')) return false;
          const b=el.getBBox();return b.x<0 || b.y<0 || b.x+b.width>v.width || b.y+b.height>v.height;
        }).map(el=>el.getAttribute('data-visual-element'));
      });
      expect(clipped).toEqual([]);
    }
  }
});

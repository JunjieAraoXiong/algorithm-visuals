const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the page's trace generator without exposing state on the public page.
function framesFor(mode) {
  const html = fs.readFileSync('src/chapters/11-trees/05-invert-binary-tree/index.html', 'utf8');
  const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
  const clone = value => JSON.parse(JSON.stringify(value));
  let frames;
  const selector = {value:mode, options:[], addEventListener(){}};
  const root = {querySelector:() => selector, querySelectorAll:() => []};
  vm.runInNewContext(source, {
    document:{querySelector:() => root}, location:{search:''}, URLSearchParams,
    window:{TreeLesson:{valueOf:(nodes,id) => id == null ? 'None' : String(nodes[id].val),
      recorder(state){const output=[];return {frames:output,emit(key,expression,explanation,changes={}){
        Object.assign(state,{returnEdge:null,edited:null},changes);
        output.push({state:clone(state),sourceKeys:[key],expression,explanation});
      }};},mount(_root,build){frames=build();}}}
  });
  return frames;
}

test('recursive returns unwind one frame at a time and never mutate the tree', () => {
  const frames = framesFor('recursive');
  let nullReturns=0, nodeReturns=0;
  for (let i=1;i<frames.length;i++) {
    const frame=frames[i], previous=frames[i-1];
    const key=frame.sourceKeys[0];
    if(key!=='r-swap') expect(frame.state.nodes).toEqual(previous.state.nodes);
    const drop=previous.state.memory.length-frame.state.memory.length;
    expect(drop).toBeLessThanOrEqual(1);
    if(drop===1) expect(['r-empty','r-return']).toContain(previous.sourceKeys[0]);
    if(key==='r-empty') {
      nullReturns++;
      expect(frame.state.focus).toBeNull();
      expect(frame.state.memory.at(-1).label).toContain('root = None');
    }
    if(key==='r-return' && frame.state.memory.length) nodeReturns++;
  }
  // A binary tree with six real nodes has seven missing child references.
  expect(nullReturns).toBe(7);
  expect(nodeReturns).toBe(6);
  const result=frames.at(-1).state;
  expect(result.memory).toEqual([]);
  expect(result.nodes).toEqual({a:{val:5,left:'c',right:'b'},b:{val:1,left:'e',right:'d'},c:{val:8,left:'f',right:null},d:{val:7,left:null,right:null},e:{val:6,left:null,right:null},f:{val:4,left:null,right:null}});
  expect(framesFor('iterative').at(-1).state.nodes).toEqual(result.nodes);
});

test('empty child returns to leaf 4, resumes the right call, then returns node 4 to 8', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/invert-binary-tree/?case=recursive#step=0');
  const picker=page.locator('[data-step-select]');
  const empty=await picker.locator('option').evaluateAll(options=>options.findIndex(o=>o.textContent.includes('return None')));
  await picker.selectOption(String(empty));
  await expect(page.locator('[data-return-route]')).toHaveText('第 4 层 · root = None → 第 3 层 · root = 4');
  await expect(page.locator('[data-source-key="r-empty"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('.memory-item')).toHaveCount(4);
  await expect(page.locator('[data-reference-scope="#1"]')).toHaveAttribute('data-reference-target','a');
  await expect(page.locator('[data-reference-scope="#2"]')).toHaveAttribute('data-reference-target','c');
  await expect(page.locator('[data-reference-scope="#3"]')).toHaveAttribute('data-reference-target','f');
  await expect(page.locator('[data-reference-scope="#4"]')).toHaveAttribute('data-reference-target','None');
  await expect(page.locator('.call-frame.receiver')).toHaveAttribute('data-call-scope','#3');
  await expect(page.locator('.receiver .call-waiting code')).toHaveText('L13 · root.left 子调用');
  await expect(page.locator('.receiver .call-continuation code')).toHaveText('L14 · root.right 子调用');
  await expect(page.locator('.returning .call-transfer')).toContainText('None → #3');
  await expect(page.locator('[data-object-fields]')).toContainText('left → None');
  await expect(page.locator('[data-object-fields]')).toContainText('right → None');
  const tree=await page.locator('svg .stored-edge').evaluateAll(edges=>edges.map(e=>e.getAttribute('d')));
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-return-route]')).toHaveText('返回 None → 恢复 root = 4 · 第 3 层');
  await expect(page.locator('[data-return-detail]')).toContainText('下一行：invert_binary_tree_recursive(root.right)');
  await expect(page.locator('[data-source-key="r-left"]')).toHaveAttribute('aria-current','step');
  await expect(page.locator('.memory-item')).toHaveCount(3);
  await expect(page.locator('[data-reference-scope="#4"]')).toHaveCount(0);
  await expect(page.locator('.receiver .call-transfer')).toContainText('收到 None · 此返回值未赋值');
  await expect(page.locator('.memory-item.current')).toContainText('root → 节点 4');
  expect(await page.locator('svg .stored-edge').evaluateAll(edges=>edges.map(e=>e.getAttribute('d')))).toEqual(tree);
  await page.locator('[data-stage]').press('ArrowRight');
  await expect(page.locator('[data-source-key="r-right"]')).toHaveAttribute('aria-current','step');
  const rootReturn=await picker.locator('option').evaluateAll((options,after)=>options.findIndex((o,i)=>i>after && o.textContent.includes('return root')),empty);
  await picker.selectOption(String(rootReturn));
  await expect(page.locator('[data-return-route]')).toHaveText('第 3 层 · root = 4 → 第 2 层 · root = 8');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-return-route]')).toHaveText('返回 4 → 恢复 root = 8 · 第 2 层');
  await expect(page.locator('.memory-item')).toHaveCount(2);
  const saved=await page.locator('[data-return-route]').innerText();
  await page.reload();
  await expect(page.locator('[data-return-route]')).toHaveText(saved);
  await page.locator('[data-stage]').press('Home');
  await expect(page.locator('.memory-item')).toHaveCount(1);
  await page.locator('[data-stage]').press('End');
  await expect(page.locator('[data-memory-items]')).toHaveText('∅');
  await expect(page.locator('[data-result]')).toContainText('5 → [8, 1]');
});

test('recursive stack and transfer stay readable at narrow and wide widths', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/invert-binary-tree/?case=recursive#step=0');
    const picker=page.locator('[data-step-select]');
    const count=await picker.locator('option').count();
    for(let i=0;i<count;i++) {
      await picker.selectOption(String(i));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      const clipped=await page.locator('[data-stage] svg').evaluate(svg=>{
        const box=svg.viewBox.baseVal;
        return [...svg.querySelectorAll('text')].filter(el=>{const r=el.getBBox();return r.x<0 || r.y<0 || r.x+r.width>box.width || r.y+r.height>box.height;}).map(el=>el.textContent);
      });
      expect(clipped).toEqual([]);
      await expect(page.locator('[data-source-key][aria-current="step"]')).toHaveCount(1);
    }
  }
});


test('visible method buttons switch the trace and preserve the selected method on reload', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,760,1280]) {
    await page.setViewportSize({width,height:700});
    await page.goto('/invert-binary-tree/?case=recursive#step=11');
    const recursive=page.getByRole('button',{name:'递归 Recursive',exact:true});
    const iterative=page.getByRole('button',{name:'迭代 Iterative',exact:true});
    await expect(recursive).toBeInViewport();
    await expect(iterative).toBeInViewport();
    await expect(page.locator('select[aria-label="翻转方法"]')).toHaveCount(0);
    await iterative.click();
    await expect(iterative).toHaveAttribute('aria-pressed','true');
    await expect(recursive).toHaveAttribute('aria-pressed','false');
    await expect(page).toHaveURL(/case=iterative#step=0$/);
    await expect(page.locator('[data-memory] h3')).toContainText('stack');
    await expect(page.locator('[data-source-key="i-check"]')).toHaveAttribute('aria-current','step');
    await page.locator('[data-action="next"]').click();
    await page.reload();
    await expect(iterative).toHaveAttribute('aria-pressed','true');
    await expect(page).toHaveURL(/case=iterative#step=1$/);
    // Activating the already selected method keeps the current step.
    await iterative.click();
    await expect(page).toHaveURL(/#step=1$/);
    await recursive.focus();
    await page.keyboard.press('Enter');
    await expect(recursive).toHaveAttribute('aria-pressed','true');
    await expect(page).toHaveURL(/case=recursive#step=0$/);
    await expect(page.locator('[data-source-key="r-check"]')).toHaveAttribute('aria-current','step');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});


test('call identities keep their own root and return only to their direct caller', () => {
  const roots=new Map();
  for(const frame of framesFor('recursive')) {
    const {memory,scopedReferences}=frame.state;
    if(!memory.length) continue;
    expect(scopedReferences.length).toBe(memory.length);
    scopedReferences.forEach((ref,index)=>{
      if(roots.has(ref.scope)) expect(ref.id).toBe(roots.get(ref.scope));
      roots.set(ref.scope,ref.id);
      expect(memory[index].scope).toBe(ref.scope);
    });
    const returning=memory.at(-1);
    if(returning.returning && memory.length>1) {
      const receiver=memory.at(-2);
      expect(memory.filter(call=>call.receiver).length).toBe(1);
      expect(receiver.receiver).toBe(true);
      expect(returning.transfer).toContain(`→ ${receiver.scope}`);
      expect(receiver.nextKey).toBe(receiver.waitingKey==='r-left'?'r-right':'r-return');
    }
  }
});

test('iterative local references remain distinct and fit narrow diagrams', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,760,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/invert-binary-tree/?case=iterative#step=0');
    const picker=page.locator('[data-step-select]');
    for(let i=0;i<await picker.locator('option').count();i++) {
      await picker.selectOption(String(i));
      await expect(page.locator('[data-reference-name="root"]')).toHaveAttribute('data-reference-target','a');
      const clipped=await page.locator('[data-stage] svg').evaluate(svg=>{
        const box=svg.viewBox.baseVal;
        return [...svg.querySelectorAll('text, .reference-box, .reference')].filter(el=>{
          const r=el.getBBox();return r.x<0||r.y<0||r.x+r.width>box.width||r.y+r.height>box.height;
        }).map(el=>el.getAttribute('data-visual-element'));
      });
      expect(clipped).toEqual([]);
    }
  }
});

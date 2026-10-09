/* Original tree marks; algorithm-specific frames stay in each question page. */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const valueOf = (nodes, id) => id == null ? 'None' : String(nodes[id].val);
  function recorder(state) {
    const frames = [];
    return {frames, emit(key, expression, explanation, changes = {}) {
      Object.assign(state, {returnEdge: null, edited: null}, changes);
      frames.push({state: clone(state), sourceKeys: [key], expression, explanation, stepLabel: `${frames.length + 1} · ${expression}`});
    }};
  }
  function positions(state, width) {
    const result = {};
    const layout = state.layout || state.nodes;
    function walk(id, depth, index) {
      if (id == null) return;
      result[id] = {x: 20 + (width - 40) * (index + .5) / (2 ** depth), y: 70 + depth * 82, depth, index};
      walk(layout[id].left, depth + 1, index * 2);
      walk(layout[id].right, depth + 1, index * 2 + 1);
    }
    walk(state.root, 0, 0);
    return result;
  }
  function mount(root, makeFrames) {
    const core = window.AlgorithmVisualCore;
    const stage = root.querySelector('[data-stage]');
    const svg = stage.querySelector('svg');
    const scene = core.createSvgScene(svg);
    scene.defineMarker('tree-arrow', {markerWidth: 5, markerHeight: 5, fill: '#333'});
    scene.defineMarker('return-arrow', {markerWidth: 5, markerHeight: 5, fill: '#555'});
    const motion = core.createMotionController();
    const memory = root.querySelector('[data-memory]');
    function draw(state, before = null, progress = 1) {
      const width = stage.clientWidth;
      const current = positions(state, width);
      const old = before ? positions(before, width) : current;
      const points = {};
      for (const [id, p] of Object.entries(current)) {
        const previous = old[id] || p;
        points[id] = { ...p, x: previous.x + (p.x - previous.x) * progress, y: previous.y + (p.y - previous.y) * progress };
      }
      const deepest = Math.max(0, ...Object.values(current).map(p => p.depth));
      const height = 70 + deepest * 82 + (state.widthLevel != null ? 90 : 60);
      stage.style.height = `${height}px`;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const visible = id => id != null && (!state.visible || state.visible.includes(id));
      scene.update(({path, circle, text}) => {
        for (const [index, route] of (state.paths || []).entries()) {
          const parts = route.filter(id => visible(id) && points[id]).map(id => points[id]);
          if (parts.length) path(`band-${index}`, {d: parts.map((p,i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), class: 'path-band'});
        }
        if (state.ghosts) {
          for (const g of state.ghosts) {
            const x = 20 + (width - 40) * (g.index + .5) / (2 ** g.depth), y = 70 + g.depth * 82;
            circle(`ghost-${g.depth}-${g.index}`, {cx:x, cy:y, r:12, class:'ghost'});
            text(`ghost-index-${g.depth}-${g.index}`, {x,y:y+30,class:'annotation'},g.heapIndex);
          }
        }
        for (const [id, node] of Object.entries(state.nodes)) {
          if (!visible(id) || !points[id]) continue;
          const p = points[id];
          for (const side of ['left', 'right']) {
            const child = node[side];
            if (!visible(child) || !points[child]) continue;
            const q = points[child];
            const dx = q.x-p.x, dy=q.y-p.y, length=Math.hypot(dx,dy);
            path(`edge-${id}-${side}`, {d:`M${p.x+dx*17/length},${p.y+dy*17/length} L${q.x-dx*19/length},${q.y-dy*19/length}`,class:`stored-edge${state.edited===id ? ' edited-edge' : ''}`,'marker-end':'url(#tree-arrow)'});
          }
        }
        for (const [id, node] of Object.entries(state.nodes)) {
          if (!visible(id) || !points[id]) continue;
          const p = points[id];
          circle(`node-${id}`, {cx:p.x,cy:p.y,r:16,class:`node${state.focus===id ? ' active' : ''}${(state.marked||[]).includes(id)?' marked':''}`});
          text(`value-${id}`,{x:p.x,y:p.y+1},node.val);
          if (state.labels?.[id] != null) text(`label-${id}`,{x:p.x,y:p.y+31,class:'annotation'},state.labels[id]);
          if (state.indexes?.[id] != null) text(`index-${id}`,{x:p.x,y:p.y+31,class:'annotation'},`i=${state.indexes[id]}`);
          const tag = state.tags?.[id];
          if (tag) text(`tag-${id}`,{x:p.x,y:p.y-24,class:'annotation'},tag);
        }
        if (state.widthLevel != null) {
          const {depth,left,right} = state.widthLevel;
          const x1=20+(width-40)*(left+.5)/2**depth, x2=20+(width-40)*(right+.5)/2**depth, y=70+depth*82+49;
          path('width-bracket',{d:`M${x1},${y-5} V${y} H${x2} V${y-5}`,class:'stored-edge'});
          text('width-label',{x:(x1+x2)/2,y:y+19,class:'annotation'},`width = ${right-left+1}`);
        }
        if (state.returnEdge) {
          const e=state.returnEdge, a=points[e.from], b=points[e.to];
          if(a&&b) {
            const offset=a.x<b.x?-8:8;
            path('return-edge',{d:`M${a.x+offset},${a.y-19} Q${a.x+offset},${b.y+23} ${b.x+offset},${b.y+20}`,class:'return-edge','marker-end':'url(#return-arrow)'});
            text('return-label',{x:a.x+offset,y:(a.y+b.y)/2,class:'annotation'},e.text);
          }
        }
        const target = state.focus && points[state.focus];
        if (target && visible(state.focus)) {
          const oldTarget = before?.focus && old[before.focus];
          // Distant calls fade in near their target; no false node-to-node link.
          const near = oldTarget && Math.hypot(oldTarget.x-target.x,oldTarget.y-target.y)<110;
          const ref = near ? {x:oldTarget.x+(target.x-oldTarget.x)*progress,y:oldTarget.y+(target.y-oldTarget.y)*progress} : target;
          const opacity=before && !near ? Math.min(1,progress*3) : 1;
          const label=state.reference || 'node', labelWidth=Math.max(42,label.length*7+10);
          path('reference-box',{d:`M${ref.x-labelWidth/2},${ref.y-55} h${labelWidth} v20 h${-labelWidth} Z`,class:'reference-box',opacity});
          text('reference-label',{x:ref.x,y:ref.y-45,class:'annotation',opacity},label);
          path('reference',{d:`M${ref.x},${ref.y-35} V${ref.y-19}`,class:'reference','marker-end':'url(#return-arrow)',opacity});
        } else if (state.focus === null) {
          text('null-reference',{x:width/2,y:25,class:'annotation'},`${state.reference||'node'} = None`);
        }
      });
    }
    function renderMemory(state) {
      memory.classList.toggle('queue',state.memoryType==='queue');
      memory.querySelector('h3').textContent=state.memoryTitle||'调用栈 · 最后一个是栈顶';
      const items=state.memory||[];
      memory.querySelector('[data-memory-items]').replaceChildren(...items.map((item,index)=>{
        const entry=document.createElement('div');
        entry.className=`memory-item${index===items.length-1 && state.memoryType!=='queue'?' current':''}${item.next?' next-level':''}`;
        const label=document.createElement('div'); label.textContent=typeof item==='string'?item:item.label;entry.append(label);
        if(item.detail){const detail=document.createElement('span');detail.textContent=item.detail;entry.append(detail);}
        return entry;
      }));
      if (!items.length) memory.querySelector('[data-memory-items]').textContent='∅';
      memory.querySelector('[data-memory-note]').textContent=state.memoryNote||'';
      const arrays=root.querySelector('[data-arrays]');
      arrays.replaceChildren(...(state.arrays||[]).map(row=>{
        const block=document.createElement('div');block.className='array-row';
        const label=document.createElement('p');label.textContent=row.label;block.append(label);
        const cells=document.createElement('div');cells.className='array-cells';
        row.values.forEach((val,index)=>{const cell=document.createElement('div');cell.className=`array-cell${row.range && index>=row.range[0]&&index<=row.range[1]?' in-range':''}${row.cursor===index?' cursor':''}`;cell.textContent=val;const small=document.createElement('small');small.textContent=index;cell.append(small);cells.append(cell);});
        block.append(cells);return block;
      }));
    }
    const trace=core.createTrace({root,cloneState:clone,motion,onBeforeStep:()=>motion.cancel(),
      onRender:({state,frame})=>{
        draw(state);renderMemory(state);
        root.querySelector('[data-expression]').textContent=frame.expression;
        root.querySelector('[data-explanation]').textContent=frame.explanation;
        root.querySelector('[data-caption]').textContent=state.caption||'实线是节点保存的子指针；短箭头是当前变量引用。';
        root.querySelector('[data-invariant]').textContent=state.invariant||'';
        root.querySelector('[data-result]').textContent=state.result||'结果：尚未返回';
        root.querySelector('[data-phase]').textContent=state.phase||'执行过程';
        stage.setAttribute('aria-label',frame.explanation);
      },onTransition:({state,beforeState})=>motion.tween({duration:250,update:p=>draw(state,beforeState,p)})});
    trace.setFrames(makeFrames());
    root.querySelector('[data-case]')?.addEventListener('change',()=>{motion.cancel();trace.setFrames(makeFrames(),{initialStep:0});});
    new ResizeObserver(()=>{motion.cancel();draw(trace.state);}).observe(stage);
    motion.onPreferenceChange(()=>draw(trace.state));
    return trace;
  }
  window.TreeLesson=Object.freeze({clone,valueOf,recorder,mount});
})();

/* Original tree marks; algorithm-specific frames stay in each question page. */
(() => {
  'use strict';
  const DEFAULT_ROW_GAP = 104;
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
      result[id] = {x: 20 + (width - 40) * (index + .5) / (2 ** depth), y: (state.topGap || 70) + depth * (state.rowGap || DEFAULT_ROW_GAP), depth, index};
      walk(layout[id].left, depth + 1, index * 2);
      walk(layout[id].right, depth + 1, index * 2 + 1);
    }
    walk(state.root, 0, 0);
    return result;
  }
  function mount(root, makeFrames, adapter = {}) {
    const core = window.AlgorithmVisualCore;
    const stage = root.querySelector('[data-stage]');
    const svg = stage.querySelector('svg');
    const scene = core.createSvgScene(svg);
    scene.defineMarker('tree-arrow', {markerWidth: 5, markerHeight: 5, fill: '#333'});
    scene.defineMarker('return-arrow', {markerWidth: 5, markerHeight: 5, fill: '#555'});
    const motion = core.createMotionController();
    const memory = root.querySelector('[data-memory]');
    const workspace = root.querySelector('.diagram-workspace');
    const caption = root.querySelector('[data-caption]');
    function draw(state, before = null, progress = 1) {
      const width = stage.clientWidth;
      const place = adapter.positions || positions;
      const current = place(state, width);
      const old = before ? place(before, width) : current;
      const radius = adapter.positions ? (state.indexes ? Math.min(21, (width-40)/16-2) : width < 400 ? 16 : 21) : 16;
      const points = {};
      for (const [id, p] of Object.entries(current)) {
        const previous = old[id] || p;
        points[id] = { ...p, x: previous.x + (p.x - previous.x) * progress, y: previous.y + (p.y - previous.y) * progress };
      }
      const deepest = Math.max(0, ...Object.values(current).map(p => p.depth));
      const height = (state.topGap || 70) + deepest * (state.rowGap || DEFAULT_ROW_GAP) + (state.scopedReferences ? 130 : state.indexes || state.widthLevel != null ? 90 : adapter.positions ? 114 : 60);
      stage.style.height = `${height}px`;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const pathNodes = new Set((state.paths || []).flat());
      const visible = id => id != null && (!state.visible || state.visible.includes(id));
      scene.update(({path, circle, text}) => {
        for (const [index, route] of (state.paths || []).entries()) {
          const parts = route.filter(id => visible(id) && points[id]).map(id => points[id]);
          if (parts.length) path(`band-${index}`, {d: parts.map((p,i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), class: 'path-band'});
        }
        if (state.ghosts) {
          for (const g of state.ghosts) {
            const x = 20 + (width - 40) * (g.index + .5) / (2 ** g.depth), y = 70 + g.depth * (state.rowGap || DEFAULT_ROW_GAP);
            circle(`ghost-${g.depth}-${g.index}`, {cx:x, cy:y, r:12, class:'ghost'});
            text(`ghost-index-${g.depth}-${g.index}`, {x,y:y+30,class:'annotation'},`i=${g.heapIndex}`);
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
            path(`edge-${id}-${side}`, {d:`M${p.x+dx*(radius+1)/length},${p.y+dy*(radius+1)/length} L${q.x-dx*(radius+3)/length},${q.y-dy*(radius+3)/length}`,class:`stored-edge${(state.edited===id || state.edited===`${id}:${side}`) ? ' edited-edge' : ''}`,'marker-end':'url(#tree-arrow)'});
            if (state.showChildSides) text(`side-${id}-${side}`,{x:p.x+dx*.32+(side==='left'?-10:10),y:p.y+dy*.32,class:'annotation'},side==='left'?'L':'R');
          }
        }
        for (const [id, node] of Object.entries(state.nodes)) {
          if (!visible(id) || !points[id]) continue;
          const p = points[id];
          circle(`node-${id}`, {cx:p.x,cy:p.y,r:radius,class:`node${pathNodes.has(id)?' on-path':''}${state.focus===id ? ' active' : ''}${(state.marked||[]).includes(id)?' marked':''}`});
          text(`value-${id}`,{x:p.x,y:p.y+1},node.val);
          if (state.labels?.[id] != null) text(`label-${id}`,{x:p.x,y:p.y+31,class:'annotation'},state.labels[id]);
          if (state.indexes?.[id] != null) text(`index-${id}`,{x:p.x,y:p.y+31,class:'annotation'},`i=${state.indexes[id]}`);
          const tag = state.tags?.[id];
          if (tag) text(`tag-${id}`,{x:p.x,y:p.y-24,class:'annotation'},tag);
        }
        if (state.widthLevel != null) {
          const {depth,left,right} = state.widthLevel;
          const x1=20+(width-40)*(left+.5)/2**depth, x2=20+(width-40)*(right+.5)/2**depth, y=70+depth*(state.rowGap || DEFAULT_ROW_GAP)+49;
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
        if (state.scopedReferences) {
          const offsets = {};
          for (const ref of state.scopedReferences) {
            const target = points[ref.id];
            const slot = offsets[ref.id] || 0; offsets[ref.id] = slot + 1;
            const label = ref.label || `${ref.scope} ${ref.name}`;
            const w = Math.max(56,[...label].reduce((size,char)=>size+(/[^\x00-\x7f]/.test(char)?12:7),12));
            const desiredX = target ? target.x : width/2-24;
            const x = Math.max(w/2+4,Math.min(width-w/2-4,desiredX));
            const y = target ? target.y-45-slot*27 : height-30;
            path(`scope-box-${ref.key}`,{d:`M${x-w/2},${y-11} h${w} v22 h${-w} Z`,class:`reference-box${ref.current?' current-reference':''}`});
            text(`scope-label-${ref.key}`,{x,y,class:'annotation scoped-reference'},label);
            if (target) {
              // Each local owns its arrow; coincident variables occupy separate rows.
              const side = slot ? 20 : 0;
              path(`scope-reference-${ref.key}`,{d:slot?`M${x+w/2},${y} Q${x+w/2+side},${y} ${target.x+17},${target.y-7}`:`M${x},${y+11} L${target.x},${target.y-19}`,class:'reference','marker-end':'url(#return-arrow)','data-reference-scope':ref.scope,'data-reference-name':ref.name,'data-reference-target':ref.id});
            } else {
              path(`scope-reference-${ref.key}`,{d:`M${x+w/2},${y} H${x+w/2+18}`,class:'reference','marker-end':'url(#return-arrow)','data-reference-scope':ref.scope,'data-reference-name':ref.name,'data-reference-target':'None'});
              text(`scope-none-${ref.key}`,{x:x+w/2+42,y,class:'annotation'},'None');
            }
          }
        }
        const target = !state.scopedReferences && state.focus && points[state.focus];
        if (target && visible(state.focus)) {
          const oldTarget = before?.focus && old[before.focus];
          // Distant calls fade in near their target; no false node-to-node link.
          const near = oldTarget && Math.hypot(oldTarget.x-target.x,oldTarget.y-target.y)<110;
          const ref = near ? {x:oldTarget.x+(target.x-oldTarget.x)*progress,y:oldTarget.y+(target.y-oldTarget.y)*progress} : {...target};
          const opacity=before && !near ? Math.min(1,progress*3) : 1;
          const label=state.reference || 'node', labelWidth=Math.max(42,label.length*7+10);
          if (adapter.positions) ref.x=Math.max(labelWidth/2+3,Math.min(width-labelWidth/2-3,ref.x));
          path('reference-box',{d:`M${ref.x-labelWidth/2},${ref.y-55} h${labelWidth} v20 h${-labelWidth} Z`,class:'reference-box',opacity});
          text('reference-label',{x:ref.x,y:ref.y-45,class:'annotation',opacity},label);
          path('reference',{d:adapter.positions?`M${ref.x},${ref.y-35} L${target.x},${ref.y-radius-3}`:`M${ref.x},${ref.y-35} V${ref.y-19}`,class:'reference','marker-end':'url(#return-arrow)',opacity});
        } else if (!state.scopedReferences && state.focus === null) {
          const parent=points[state.nullSlot?.parent];
          const x=parent?Math.max(54,Math.min(width-54,parent.x+(state.nullSlot.side==='left'?-38:38))):width/2;
          const y=parent?parent.y+66:25;
          if (parent) {
            const dx=x-parent.x,dy=y-12-parent.y,length=Math.hypot(dx,dy);
            path('empty-child-link',{d:`M${parent.x+dx*(radius+1)/length},${parent.y+dy*(radius+1)/length} L${x},${y-12}`,class:'stored-edge','marker-end':'url(#tree-arrow)'});
          }
          text('null-reference',{x,y,class:'annotation'},`${state.reference||'node'} = None`);
        }
      });
      // Retained marks added on later frames must stay beneath node values.
      const firstMark = [...svg.children].find(child => child.tagName.toLowerCase() !== 'defs');
      for (const band of svg.querySelectorAll('.path-band')) svg.insertBefore(band, firstMark);
    }
    function positionArrayCursors(state, before = null, progress = 1) {
      for (const [index, block] of [...root.querySelector('[data-arrays]').children].entries()) {
        const marker = block.querySelector('.array-pointer');
        if (!marker) continue;
        const cells = [...block.querySelectorAll('.array-cell, .array-end')];
        const point = cursor => {
          const cell = cells[cursor];
          return cell ? {x:cell.offsetLeft + cell.offsetWidth / 2, y:cell.offsetTop - 17} : null;
        };
        const target = point(state.arrays[index].cursor);
        const previous = point(before?.arrays?.[index]?.cursor) || target;
        if (target) marker.style.transform = `translate(${previous.x + (target.x-previous.x)*progress}px, ${previous.y + (target.y-previous.y)*progress}px) translateX(-50%)`;
      }
    }
    function renderMemory(state, frame) {
      const queue = state.memoryType === 'queue';
      const title = state.memoryTitle || '调用栈 · 最后一个是栈顶';
      const calls = title.startsWith('调用栈');
      const stack = title.startsWith('stack');
      const mapWrite = title.startsWith('inorder_indexes_map') && frame.sourceKeys.includes('map-set');
      memory.classList.toggle('queue',queue);
      memory.querySelector('h3').textContent=title;
      const items=state.memory||[];
      memory.querySelector('[data-memory-items]').replaceChildren(...items.map((item,index)=>{
        const last = index === items.length - 1;
        const current = last && (calls || stack || mapWrite);
        const head = queue && index === 0;
        const tail = queue && last;
        const role = item.scope ? (item.returning ? '当前调用 · 即将返回' : item.receiver ? '接收返回值 · 恢复位置' : current ? '当前调用' : '暂停，等待子调用') : head ? (tail ? '队首 / 队尾' : '队首') : tail ? '队尾' : current ? (calls ? '当前调用' : stack ? '栈顶 · 待弹出' : '本次写入') : '';
        const entry=document.createElement('div');
        entry.className=`memory-item${item.scope?' call-frame':''}${item.receiver?' receiver':''}${item.returning?' returning':''}${current?' current':''}${head?' queue-head':''}${tail?' queue-tail':''}${item.next?' next-level':''}`;
        if (role) {
          const badge = document.createElement('small'); badge.className = 'memory-role'; badge.textContent = role; entry.append(badge);
        }
        if (item.scope) {
          entry.dataset.callScope=item.scope;
          const heading=document.createElement('strong');heading.className='call-heading';heading.textContent=item.heading || `${item.scope} · 第 ${item.depth || 1} 层`;entry.append(heading);
        }
        const label=document.createElement('div'); label.textContent=typeof item==='string'?item:item.label;entry.append(label);
        if (item.locals) {
          const locals=document.createElement('dl');locals.className='call-locals';
          for(const [name,value] of Object.entries(item.locals)) {
            const term=document.createElement('dt'),detail=document.createElement('dd');
            term.textContent=name;detail.textContent=value;locals.append(term,detail);
          }
          entry.append(locals);
        }
        if (item.scope) {
          for (const [title,value,kind,key] of [[item.receiver?'返回到':'暂停在',item.waitingAt,'waiting',item.waitingKey],[item.executing?'本步执行':'接着执行',item.nextAt,'continuation',item.nextKey],['返回交接',item.transfer,'transfer',null]]) {
            if (!value) continue;
            const row=document.createElement('p');row.className=`call-${kind}`;
            const caption=document.createElement('small');caption.textContent=title;
            const code=document.createElement('code');const source=key && root.querySelector(`[data-source-key="${key}"]`);code.textContent=`${source?.dataset.lineNumber ? `第 ${source.dataset.lineNumber} 行：` : ''}${value}`;if(key) {code.dataset.sourceTarget=key;code.title=source?.textContent.trim() || value;}row.append(caption,code);entry.append(row);
          }
        }
        if(item.detail && !item.scope){const detail=document.createElement('span');detail.textContent=item.detail;entry.append(detail);}
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
        if (row.end) {
          const end = document.createElement('span'); end.className='array-end'; end.textContent='结束'; cells.append(end);
        }
        if (Number.isInteger(row.cursor)) {
          const marker=document.createElement('span');marker.className='array-pointer';marker.textContent='↓';marker.setAttribute('aria-hidden','true');cells.append(marker);
        }
        block.append(cells);return block;
      }));
      positionArrayCursors(state);
    }
    const trace=core.createTrace({root,cloneState:clone,motion,onBeforeStep:()=>motion.cancel(),
      onRender:({state,frame})=>{
        const mapping = Boolean(state.layout && state.memoryTitle?.startsWith('inorder_indexes_map'));
        workspace.classList.toggle('building-map',mapping);
        stage.hidden = mapping;
        caption.hidden = mapping;
        draw(state);renderMemory(state,frame);
        const fields=root.querySelector('[data-object-fields]');
        if (fields) {
          const id=state.focus || [...(state.scopedReferences || [])].reverse().find(ref=>ref.id)?.id;
          fields.replaceChildren();
          if (id && state.nodes[id]) {
            const title=document.createElement('small');title.textContent=`${state.focus?'当前节点':'调用者节点'} ${state.nodes[id].val} 保存的孩子引用`;
            fields.append(title);
            for (const side of ['left','right']) {
              const child=state.nodes[id][side], row=document.createElement('code');
              row.textContent=`${side} → ${child?`节点 ${state.nodes[child].val}`:'None'}`;
              fields.append(row);
            }
          }
        }
        root.querySelector('[data-expression]').textContent=frame.expression;
        root.querySelector('[data-explanation]').textContent=frame.explanation;
        caption.textContent=state.caption||'实线是节点保存的子指针；短箭头是当前变量引用。';
        root.querySelector('[data-invariant]').textContent=state.invariant||'';
        root.querySelector('[data-result]').textContent=state.result||'结果：尚未返回';
        root.querySelector('[data-phase]').textContent=state.phase||'执行过程';
        stage.setAttribute('aria-label',frame.explanation);
        const transfer = root.querySelector('[data-return-flow]');
        if (transfer) {
          for (const part of ['kind', 'route', 'detail']) {
            transfer.querySelector(`[data-return-${part}]`).textContent = state.returnFlow?.[part] || '';
          }
        }
        adapter.render?.({state,frame,trace});
      },onTransition:({state,beforeState})=>motion.tween({duration:250,update:p=>{draw(state,beforeState,p);positionArrayCursors(state,beforeState,p);}})});
    trace.setFrames(makeFrames());
    root.querySelector('[data-case]')?.addEventListener('change',()=>{motion.cancel();trace.setFrames(makeFrames(),{initialStep:0});});
    new ResizeObserver(()=>{motion.cancel();draw(trace.state);positionArrayCursors(trace.state);}).observe(stage);
    motion.onPreferenceChange(()=>{draw(trace.state);positionArrayCursors(trace.state);});
    return trace;
  }
  window.TreeLesson=Object.freeze({clone,valueOf,recorder,mount});
})();

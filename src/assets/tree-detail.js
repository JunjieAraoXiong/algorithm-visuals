/* Optional execution detail for the six postorder / indexed-width lessons. */
(() => {
  'use strict';
  const base = window.TreeLesson;
  const shown = value => value == null ? '未赋值' : value === true ? 'True' : value === false ? 'False' : value === Infinity ? '∞' : value === -Infinity ? '−∞' : String(value);
  const nodeName = (state, id) => id == null ? 'None' : `节点 ${state.nodes[id].val}`;

  // Call identity comes from the simulator's real stack, never from a node's value.
  // This distinguishes repeated values and the many separate calls on None.
  function recorder(state, stack = [], spec = {}) {
    const recording = base.recorder(state), metadata = new WeakMap();
    let previous = [], serial = 0;
    const meta = call => {
      if (!metadata.has(call)) metadata.set(call, {scope: `call-${++serial}`, waitingKey: null});
      return metadata.get(call);
    };
    const describe = (call, depth) => `第 ${depth} 层 · ${spec.build ? `build_subtree(${call.left}, ${call.right})` : `node → ${nodeName(state, call.id)}`}`;
    return {frames: recording.frames, emit(key, expression, explanation, changes = {}) {
      Object.assign(state, {returnEdge: null, edited: null}, changes);
      state.landmark = null;
      state.nullSlot = null;
      state.handoff = null;
      const current = stack.at(-1), parent = stack.at(-2);
      const landmark = spec.landmark?.(key, current);
      if (landmark && !recording.frames.some(frame => frame.state.landmark === landmark)) state.landmark = landmark;
      const entering = current && !previous.includes(current);
      const received = current && previous.length > stack.length;
      const calling = current && ['left', 'right'].includes(key) && expression.includes(spec.name);
      const returning = current && spec.returnValue && spec.returnValue(key, current, expression) !== undefined;
      const source = document.querySelector(`[data-source-key="${key}"]`)?.textContent.trim() || expression;
      if (calling) meta(current).waitingKey = key;
      if (received) meta(current).waitingKey = null;

      if (current) {
        const receiverKey = parent && meta(parent).waitingKey;
        const value = returning ? String(spec.returnValue(key, current, expression)) : null;
        if (returning) {
          meta(current).returned = value;
          state.handoff = {
            kind: '返回 · 当前调用即将结束', value: `return ${value}`,
            route: `${describe(current, stack.length)} → ${parent ? describe(parent, stack.length - 1) : '外层函数'}`,
            detail: parent ? spec.receive(receiverKey, value) : spec.outer,
            sourceKey: receiverKey || spec.outerKey
          };
        } else if (received) {
          const child = previous[stack.length], value = meta(child).returned;
          state.handoff = {
            kind: '接收 · 回到暂停的调用', value: expression,
            route: `${describe(child, stack.length + 1)} → ${describe(current, stack.length)}`,
            detail: spec.receive(key, value), sourceKey: key
          };
        } else if (entering && parent) {
          state.handoff = {
            kind: '调用 · 父调用保留自己的变量', value: spec.name,
            route: `${describe(parent, stack.length - 1)} → ${describe(current, stack.length)}`,
            detail: `子调用结束后回到 ${receiverKey === 'left' ? '左侧' : '右侧'}这一行。`, sourceKey: receiverKey
          };
        }
        if (!spec.build && current.id == null && parent) state.nullSlot = {parent: parent.id, side: receiverKey};
        state.memoryTitle = '调用栈 · 每张卡片是一层函数调用';
        state.memory = stack.map((call, index) => {
          const active = index === stack.length - 1, info = meta(call);
          const waiting = info.waitingKey;
          return {
            scope: info.scope, depth: index + 1, heading: `第 ${index + 1} 层${spec.build ? ` · [${call.left}, ${call.right}]` : ''}`,
            label: spec.build ? `node = ${call.created ? nodeName(state, call.id) : '未创建'}` : `node = ${base.valueOf(state.nodes, call.id)}`,
            locals: Object.fromEntries(Object.entries(spec.locals(call)).map(([name, value]) => [name, shown(value)])),
            waitingAt: !active && waiting ? document.querySelector(`[data-source-key="${waiting}"]`).textContent.trim() : null,
            waitingKey: !active ? waiting : null,
            returning: active && returning, receiver: active && received,
            nextAt: active ? source : null, nextKey: active ? key : null, executing: active
          };
        });
        state.decision = spec.decision?.(key, current, state) || null;
      } else {
        state.decision = null;
        if (previous.length && spec.name) {
          state.handoff = {kind: '完成 · 调用栈已清空', value: state.result || expression, route: '最外层函数返回结果', detail: explanation};
        }
      }
      recording.emit(key, expression, explanation, changes);
      previous = stack.slice();
    }};
  }

  function positions(state, width) {
    const layout = state.layout || state.nodes, top = state.topGap || 70, gap = state.rowGap || 104;
    if (state.indexes) {
      const points = {};
      function walk(id, depth, index) {
        if (id == null) return;
        points[id] = {x: 20 + (width - 40) * (index + .5) / 2 ** depth, y: top + depth * gap, depth, index};
        walk(layout[id].left, depth + 1, index * 2); walk(layout[id].right, depth + 1, index * 2 + 1);
      }
      walk(state.root, 0, 0); return points;
    }
    // Separate subtree contours instead of reserving 2^depth tiny bottom slots.
    function subtree(id) {
      if (id == null) return [];
      const left = subtree(layout[id].left), right = subtree(layout[id].right);
      let separation = 1.2;
      for (const a of left) for (const b of right) {
        if (a.depth === b.depth) separation = Math.max(separation, a.x - b.x + 1.2);
      }
      const offset = left.length && right.length ? separation / 2 : .55;
      return [{id, x: 0, depth: 0}, ...left.map(p => ({...p, x: p.x - offset, depth: p.depth + 1})), ...right.map(p => ({...p, x: p.x + offset, depth: p.depth + 1}))];
    }
    const points = subtree(state.root), low = Math.min(0, ...points.map(p => p.x)), high = Math.max(0, ...points.map(p => p.x));
    const scale = (width - 84) / Math.max(1, high - low);
    return Object.fromEntries(points.map(p => [p.id, {...p, x: width / 2 + (p.x - (low + high) / 2) * scale, y: top + p.depth * gap}]));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag); if(className) node.className = className;
    if (text != null) node.textContent = text; return node;
  }
  function mount(root, makeFrames) {
    root.classList.add('tree-detail');
    root.querySelectorAll('[data-code-scroll] .code-line').forEach((line, index) => {line.dataset.lineNumber = index + 1;});
    const workspace = root.querySelector('.diagram-workspace');
    // Keep the current line and its explanation adjacent to the drawing.
    workspace.querySelector('[data-stage]').after(root.querySelector('.operation'));
    const detail = element('div', 'execution-detail'); detail.dataset.executionDetail = '';
    const handoff = element('div', 'call-handoff'); handoff.dataset.handoff = ''; handoff.setAttribute('aria-live', 'polite');
    const decision = element('div', 'call-decision'); decision.dataset.decision = '';
    detail.append(handoff, decision); workspace.querySelector('.operation').after(detail);
    const shortcuts = element('nav', 'tree-shortcuts'); shortcuts.setAttribute('aria-label', '关键步骤');
    root.querySelector('.controls').after(shortcuts);
    const caseSelect = root.querySelector('[data-case]');
    const cases = element('div', 'tree-cases'); cases.setAttribute('role', 'group'); cases.setAttribute('aria-label', caseSelect.getAttribute('aria-label'));
    const caseButtons = [...caseSelect.options].map(option => {
      const button = element('button', '', option.textContent.replace(/^原图：/, '示例：'));
      button.type = 'button'; button.dataset.caseValue = option.value;
      button.addEventListener('click', () => {caseSelect.value = option.value; caseSelect.dispatchEvent(new Event('change', {bubbles: true}));});
      cases.append(button); return button;
    });
    caseSelect.closest('.settings').hidden = true; caseSelect.closest('.settings').after(cases);
    let frameSet;
    return base.mount(root, makeFrames, {positions, render({state, frame, trace}) {
      caseButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.caseValue === caseSelect.value)));
      if (frameSet !== trace.frames) {
        frameSet = trace.frames;
        const landmarks = [{index: 0, label: '初始状态'}, ...trace.frames.flatMap((f, index) => f.state.landmark ? [{index, label: f.state.landmark}] : []), {index: trace.frames.length - 1, label: '最终结果'}];
        shortcuts.replaceChildren(...landmarks.map(({index, label}) => {
          const button = element('button', '', label); button.type = 'button'; button.dataset.landmarkStep = index;
          button.addEventListener('click', () => trace.showStep(index)); return button;
        }));
      }
      shortcuts.querySelectorAll('button').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.landmarkStep) === trace.step)));
      handoff.replaceChildren();
      const flow = state.handoff;
      handoff.hidden = !flow;
      if (flow) {
        handoff.append(element('small', '', flow.kind), element('strong', 'handoff-value', flow.value), element('p', 'handoff-route', flow.route), element('p', '', flow.detail));
        const source = flow.sourceKey && root.querySelector(`[data-source-key="${flow.sourceKey}"]`);
        if (source) handoff.append(element('code', 'handoff-source', `回到第 ${source.dataset.lineNumber} 行：${source.textContent.trim()}`));
      }
      decision.replaceChildren(); decision.hidden = !state.decision;
      if (state.decision) {
        decision.append(element('small', '', state.decision.title), element('strong', '', state.decision.value), element('p', '', state.decision.detail));
      }
      if (state.widthSlots) {
        decision.hidden = false;
        decision.append(element('small', '', `第 ${state.widthSlots.depth + 1} 层 · 位置编号保留空位`));
        const slots = element('div', 'width-slots');
        state.widthSlots.values.forEach(slot => {
          const cell = element('div', `width-slot${slot.value == null ? ' empty-slot' : ''}`);
          cell.append(element('small', '', `i=${slot.index}`), element('strong', '', slot.value == null ? '空位' : String(slot.value))); slots.append(cell);
        });
        decision.append(slots, element('strong', '', state.widthSlots.formula), element('p', '', `${state.widthSlots.real} 个真实节点；跨度内的空位参与宽度计算，不进入 queue。`));
      }
      detail.hidden = handoff.hidden && decision.hidden;
      const svg = root.querySelector('[data-stage] svg');
      let title = svg.querySelector('title'), description = svg.querySelector('desc');
      if (!title) {
        title = document.createElementNS(svg.namespaceURI, 'title'); title.id = 'tree-detail-title';
        description = document.createElementNS(svg.namespaceURI, 'desc'); description.id = 'tree-detail-description';
        svg.prepend(title, description); svg.setAttribute('aria-labelledby', `${title.id} ${description.id}`); svg.removeAttribute('aria-label');
      }
      title.textContent = root.querySelector('h1').textContent;
      description.textContent = `${frame.explanation} ${state.handoff?.route || ''}`;
    }});
  }
  window.TreeDetail = Object.freeze({recorder, mount});
})();

/* A view of recorded calls only; the lesson remains the owner of every frame. */
(() => {
  'use strict';
  const sessions = new WeakMap();
  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  };
  const callFrames = state => (state?.memory || []).filter(call => call && typeof call === 'object' && call.scope);
  const isCallTrace = frames => frames?.some(frame => callFrames(frame.state).length);
  const direction = key => key?.endsWith('left') ? '左侧' : key?.endsWith('right') ? '右侧' : '';

  function mount(root) {
    const workspace = root.querySelector('.diagram-workspace');
    const layout = root.querySelector('[data-learning-layout]');
    const memory = root.querySelector('[data-memory]');
    if (!workspace || !layout || !memory) return null;

    const inspector = element('section', 'av-tree-inspector');
    inspector.dataset.treeInspector = '';
    inspector.setAttribute('aria-label', '调用栈与当前局部变量');
    const heading = element('div', 'av-tree-inspector-heading');
    const result = element('output', 'av-tree-result');
    heading.append(element('h2', '', '调用栈与局部变量'), result);
    const body = element('div', 'av-tree-inspector-body');
    const stack = element('div', 'av-tree-stack');
    const stackLabel = element('p', 'av-tree-stack-label', '栈顶（当前调用）');
    const path = element('ol', 'av-tree-call-path');
    path.setAttribute('aria-label', '调用栈，栈顶在上');
    path.tabIndex = 0;
    stack.append(stackLabel, path);
    const current = element('div', 'av-tree-current');
    const title = element('h3', 'av-tree-current-title');
    const reference = element('code', 'av-tree-reference');
    const locals = element('dl', 'av-tree-locals');
    const summary = element('p', 'av-tree-summary');
    current.append(title, reference, locals, summary);
    body.append(stack, current);
    inspector.append(heading, body);

    const history = element('details', 'av-tree-history');
    history.dataset.treeHistory = '';
    history.append(element('summary', '', '完整调用栈与返回位置'));
    layout.after(history);
    // Comments preserve the exact original locations when another method uses
    // the same memory element (for example, inversion's explicit stack).
    const moved = [];
    const remember = node => {
      if (!node || moved.some(item => item.node === node)) return;
      const marker = document.createComment('recorded tree detail');
      node.before(marker);
      moved.push({node, marker});
    };
    remember(memory);
    remember(root.querySelector('[data-execution-detail]'));
    remember(root.querySelector('[data-return-flow]'));
    remember(root.querySelector('.bst-bounds'));
    remember(root.querySelector('[data-animation-panel] .state-grid'));
    remember(root.querySelector('[data-phase]'));
    remember(root.querySelector('[data-caption]'));
    remember(root.querySelector('[data-object-fields]'));
    remember(root.querySelector('.scene-title'));
    const operation = root.querySelector('.operation');
    const session = {workspace, inspector, history, moved, operation, result, stackLabel, path, title, reference, locals, summary};
    sessions.set(root, session);
    return session;
  }

  function place(root, session, active, mapping) {
    root.classList.toggle('av-recursion', active);
    session.inspector.hidden = !active || mapping;
    session.history.hidden = !active;
    for (const {node, marker} of session.moved) {
      // Before build_subtree starts, this element is the live index map.
      const keepMap = mapping && node.matches('[data-memory]');
      const destination = active && !keepMap ? session.history : marker.parentNode;
      if (node.parentNode !== destination) {
        if (destination === session.history) destination.append(node);
        else marker.after(node);
      }
      if (keepMap && session.operation?.parentElement === session.workspace) session.operation.before(node);
    }
    if (!active) return;
    // BST's adapter places the operation outside its drawing workspace. In all
    // cases the inspector follows the drawing and precedes the operation.
    if (session.operation?.parentElement === session.workspace) {
      if (session.inspector.nextElementSibling !== session.operation) session.operation.before(session.inspector);
    } else if (session.inspector.parentElement !== session.workspace) {
      session.workspace.append(session.inspector);
    }
    session.workspace.classList.toggle('av-tree-mapping', mapping);
  }

  function rowName(call) {
    if (call.locals && Object.hasOwn(call.locals, 'left') && Object.hasOwn(call.locals, 'right')) {
      return `build_subtree(${call.locals.left}, ${call.locals.right})`;
    }
    return call.label;
  }

  function status(call, top, recipient) {
    if (call === top) {
      if (call.returning) return '即将返回';
      if (call.receiver) return '已接收';
      const side = direction(call.nextKey);
      return side && call.executing ? `调用${side}` : '正在执行';
    }
    if (call === recipient) return '待接收';
    const side = direction(call.waitingKey);
    return side ? `等待${side}` : '等待子调用';
  }

  function summaryFor(state, frame, calls) {
    const top = calls.at(-1), parent = calls.at(-2);
    if (top?.returning) {
      const value = state.handoff?.value || frame.expression;
      return `${value} → ${parent ? `第 ${parent.depth} 层（待接收）` : '外层调用者'}`;
    }
    if (top?.receiver) return top.transfer || `已接收：${state.handoff?.value || frame.expression}`;
    if (state.condition) return state.condition;
    if (top && Object.values(top.locals || {}).includes('未赋值')) return '未赋值：该行尚未执行，或子调用尚未返回。';
    if (top?.nextAt && !top.executing) return `接着执行：${top.nextAt}`;
    if (!top) return state.handoff?.kind?.startsWith('完成') || state.result && /完成/.test(state.phase || '') ? '调用栈已清空。' : '当前在外层函数中。';
    return '';
  }

  function render(root, context) {
    if (!root.matches('.tree-lesson') || root.querySelector('[data-lca-regions]')) return;
    const {state, frame, frames} = context;
    if (!state || !frame) return;
    let session = sessions.get(root);
    const supported = isCallTrace(frames) || callFrames(state).length > 0;
    if (!supported && !session) return;
    session ||= mount(root);
    if (!session) return;
    const mapping = Boolean(state.memoryTitle?.startsWith('inorder_indexes_map'));
    place(root, session, supported, mapping);
    if (!supported) return;

    const calls = callFrames(state), top = calls.at(-1);
    const recipient = top?.returning ? calls.at(-2) : null;
    session.result.textContent = state.result || '尚未返回';
    session.result.title = state.result || '尚未返回';
    session.stackLabel.textContent = calls.length ? '栈顶（当前调用）' : '调用栈为空';
    const retained = new Map([...session.path.children].map(row => [row.dataset.scope, row]));
    const visible = calls.length ? [...calls].reverse() : [{scope: 'outer', outer: true}];
    session.path.replaceChildren(...visible.map(call => {
      const existing = retained.get(call.scope);
      const row = existing || element('li', 'av-tree-call');
      row.dataset.scope = call.scope;
      row.toggleAttribute('data-current', call === top);
      row.toggleAttribute('data-recipient', call === recipient);
      if (call === top) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
      row.classList.toggle('is-entering', !existing && !call.outer);
      const name = element('code', '', call.outer ? '外层函数' : rowName(call));
      const role = element('span', '', call.outer ? mapping ? '建立位置表' : '没有活动调用' : status(call, top, recipient));
      const depth = call.outer ? '' : `第 ${call.depth} 层`;
      row.setAttribute('aria-label', `${depth}，${name.textContent}，${role.textContent}`);
      row.replaceChildren(element('small', '', depth), name, role);
      return row;
    }));
    session.path.scrollTop = 0;
    session.title.textContent = top ? `第 ${top.depth} 层${top.returning ? '，即将返回' : top.receiver ? '，接收返回值' : ''}` : '外层函数';
    session.reference.textContent = top?.label || frame.expression;
    session.locals.replaceChildren();
    for (const [name, value] of Object.entries(top?.locals || {})) {
      const field = element('div', 'av-tree-local');
      field.dataset.value = value;
      // Receiving is an assignment performed by this frame, not merely a
      // child announcing its return while the parent's variable is pending.
      field.toggleAttribute('data-received', Boolean(top.receiver && frame.expression.startsWith(`${name} =`)));
      field.append(element('dt', '', name), element('dd', '', value));
      session.locals.append(field);
    }
    session.locals.hidden = !session.locals.children.length;
    session.summary.textContent = summaryFor(state, frame, calls);
    session.summary.hidden = !session.summary.textContent;
  }

  window.AlgorithmTreeInspector = Object.freeze({render});
})();

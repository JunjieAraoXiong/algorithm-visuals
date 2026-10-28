/* Shared presentation only. Traces, source mappings and practice stay page-owned. */
(() => {
  'use strict';
  const mounted = new WeakSet();
  const layouts = new Set();

  function size(layout) {
    if (!layout.getClientRects().length) return;
    const top = layout.getBoundingClientRect().top + window.scrollY;
    layout.style.setProperty('--av-height', `${Math.max(400, Math.min(704, window.innerHeight - top - 20))}px`);
  }

  function mount(root) {
    const layout = root.matches?.('[data-learning-layout]') ? root : root.querySelector('[data-learning-layout]');
    if (!layout || layout.querySelector('[data-call-path]') || mounted.has(layout)) return layout;
    const animation = layout.querySelector('[data-animation-panel]');
    const code = layout.querySelector('[data-code-panel]');
    const previous = layout.querySelector('[data-action="previous"]');
    const next = layout.querySelector('[data-action="next"]');
    const count = layout.querySelector('[data-count]');
    if (!animation || !code || !previous || !next || !count) return null;
    mounted.add(layout);
    layouts.add(layout);
    document.body.classList.add('av-study');
    layout.classList.add('av-workbench');
    animation.classList.add('av-animation');
    code.classList.add('av-code');
    // These static teaching sections are siblings in the older linked-list
    // layouts. They stay visible below the bounded execution workspace.
    let after = layout;
    for (const section of layout.querySelectorAll(':scope > .reason, :scope > .notes, :scope > .related-nav')) {
      after.after(section);
      after = section;
    }

    const bar = previous.closest('.controls, .lab-controls, .toolbar') || previous.parentElement;
    const dock = document.createElement('div');
    dock.className = 'av-controls';
    dock.setAttribute('aria-label', '执行控制');
    const transport = document.createElement('div');
    transport.className = 'av-transport';
    transport.append(previous, count, next);
    previous.textContent = '← 上一步';
    next.textContent = '下一步 →';
    const options = document.createElement('div');
    options.className = 'av-options';
    options.append(...bar.childNodes);
    bar.classList.add('av-controls-block');
    bar.append(transport, options);
    dock.append(bar);
    layout.append(dock);

    if (!layout.closest('#lru-lab')) {
      for (const setting of animation.querySelectorAll('.settings, .method-controls, .tree-cases, .tree-shortcuts')) {
        if (!options.contains(setting)) options.append(setting);
      }
    }
    // Code keeps its complete source, with the same row numbers as the LCA page.
    code.querySelectorAll('.code-line').forEach((line, index) => {
      if (!line.hasAttribute('data-line-number')) line.dataset.lineNumber = index + 1;
    });
    window.AlgorithmLegacyWorkbench?.mount(layout);
    size(layout);
    // Font metrics and late page adapters can alter the header after first paint.
    requestAnimationFrame(() => size(layout));
    return layout;
  }

  function render(root, context) {
    const layout = mount(root);
    if (!layout?.classList.contains('av-workbench')) return;
    layout.classList.toggle('av-practice', context.isManual);
    window.AlgorithmTreeInspector?.render(root, context);
    window.AlgorithmLegacyWorkbench?.render?.(root, context);
  }

  window.addEventListener('resize', () => layouts.forEach(size));
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-learning-layout]').forEach(mount);
    layouts.forEach(size);
  });
  window.AlgorithmWorkbench = Object.freeze({mount, render});
})();

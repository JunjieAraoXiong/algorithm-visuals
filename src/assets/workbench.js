/* Shared presentation only. Traces, source mappings and practice stay page-owned. */
(() => {
  'use strict';
  const mounted = new WeakSet();
  const layouts = new Set();

  function stylePage() {
    const main = document.querySelector('main');
    const layout = main?.querySelector('.av-workbench');
    if (!layout) return;
    const title = main.querySelector('h1');
    let heading = title?.closest('header, .heading, .topline, .lab-head');
    if (heading && layout.contains(heading)) {
      let container = layout;
      while (container.parentElement !== main) container = container.parentElement;
      main.insertBefore(heading, container);
      heading.classList.add('av-heading-before-workspace');
    }
    if (heading) heading.classList.add('av-page-heading');
    title?.classList.add('av-page-title');
    for (const intro of main.querySelectorAll('.problem, .subtitle, .lede, .intro')) {
      if (!layout.contains(intro)) intro.classList.add('av-page-intro');
    }
    // Keep the original teaching nodes and anchors; group their heading and
    // opening paragraph beside the remaining explanation, as on the LCA page.
    for (const section of main.querySelectorAll('.section, .lab-reasoning, .reasoning, .doc-section, .explanation, .notes, .reason')) {
      if (layout.contains(section) || section.closest('.av-teaching')) continue;
      const heading = section.querySelector(':scope > h2, :scope > h3');
      if (!heading) continue;
      const intro = document.createElement('div');
      intro.className = 'av-teaching-intro';
      const paragraph = heading.nextElementSibling;
      intro.append(heading);
      if (paragraph?.tagName === 'P') intro.append(paragraph);
      const body = document.createElement('div');
      body.className = 'av-teaching-body';
      body.append(...section.childNodes);
      section.classList.add('av-teaching');
      section.append(intro, body);
      if (!body.textContent.trim() && !body.querySelector('img, svg, table, input, button')) section.classList.add('av-teaching-brief');
    }
  }

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
    const codeHeading = code.querySelector(':scope > h2, :scope > h3');
    if (codeHeading) codeHeading.textContent = '完整 Python 代码';
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
    stylePage();
    layouts.forEach(size);
  });
  window.AlgorithmWorkbench = Object.freeze({mount, render});
})();

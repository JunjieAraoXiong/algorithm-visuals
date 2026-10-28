(() => {
  'use strict';

  const mounted = new WeakSet();
  const pending = new WeakSet();

  function kindOf(layout) {
    const owner = layout.closest('[id]');
    const ids = {
      'reverse-list-lab': 'reverse',
      'recursive-lab': 'recursive-reverse',
      'remove-lab': 'remove',
      'intersection-lab': 'intersection',
      'lru-lab': 'lru',
      'loop-lab': 'loop',
      'midpoint-lab': 'midpoint'
    };
    if (ids[owner?.id]) return ids[owner.id];
    if (layout.querySelector('#connect-source')) return 'flatten';
    if (layout.querySelector('[data-m-mid]')) return 'palindrome';
    return null;
  }

  // These demonstrations keep their own state and event handlers. Only their
  // existing elements move; no animation state is copied into the workbench.
  function alternateDock(layout, panel, stepper, modes, name) {
    const dock = document.createElement('div');
    dock.className = 'av-controls av-legacy-controls';
    dock.dataset.legacyControls = name;
    dock.setAttribute('aria-label', name === 'helper' ? '辅助函数控制' : '操作概览控制');
    stepper.classList.add('av-transport');
    dock.append(stepper);
    if (modes) {
      const options = document.createElement('div');
      options.className = 'av-options';
      options.append(modes);
      dock.append(options);
    }
    // The original keyboard handler belongs to the diagram panel. Forward
    // navigation from its relocated controls without duplicating step logic.
    dock.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          event.target.closest('input, select, textarea, [contenteditable="true"], [data-code-scroll]') ||
          !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const forwarded = new KeyboardEvent('keydown', {
        key: event.key, code: event.code, bubbles: true, cancelable: true
      });
      panel.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    layout.append(dock);
    return dock;
  }

  function mountLru(layout) {
    const root = layout.closest('#lru-lab');
    const animation = layout.querySelector('[data-animation-panel]');
    const mainCode = layout.querySelector('#complete-code');
    const mainDock = layout.querySelector(':scope > .av-controls');
    const helper = root.querySelector('#pointer-helpers');
    const overview = root.querySelector('#get-put-overview');
    const helperCode = helper?.querySelector('.helper-code');
    if (!animation || !mainCode || !mainDock || !helperCode || !overview) return;

    animation.append(helper);
    helperCode.classList.add('av-code', 'av-helper-code');
    const codeHeading = document.createElement('h2');
    codeHeading.textContent = '辅助函数 Python 代码';
    helperCode.prepend(codeHeading);
    helperCode.setAttribute('aria-label', '当前辅助函数的完整 Python 代码');
    layout.append(helperCode);

    const helperDock = alternateDock(layout, helper,
      helper.querySelector('.helper-stepper'), helper.querySelector('.helper-modes'), 'helper');
    const overviewDock = alternateDock(layout, overview,
      overview.querySelector('.overview-stepper'), overview.querySelector('.overview-modes'), 'overview');

    const mainStatus = mainCode.querySelector('[data-main-line-status]');
    const tabs = [...root.querySelectorAll('[data-lru-tab]')];
    let activeTab = null;
    const syncTab = () => {
      const name = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.lruTab || 'trace';
      layout.dataset.legacyTab = name;
      mainDock.hidden = name !== 'trace';
      helperDock.hidden = name !== 'helper';
      overviewDock.hidden = name !== 'overview';
      helperCode.hidden = name !== 'helper';
      // The overview has no line-level trace. Keep the full implementation
      // available, but never present the main trace's old highlight as its step.
      mainCode.hidden = name === 'helper';
      if (mainStatus) mainStatus.hidden = name === 'overview';
      if (name === 'overview') {
        for (const line of mainCode.querySelectorAll('.is-active, .is-current, [aria-current="step"]')) {
          line.classList.remove('is-active', 'is-current');
          line.removeAttribute('aria-current');
        }
      }
      if (name !== activeTab) {
        animation.scrollTop = 0;
        activeTab = name;
      }
    };
    const observer = new MutationObserver(syncTab);
    tabs.forEach(tab => observer.observe(tab, {attributes: true, attributeFilter: ['aria-selected']}));
    syncTab();
  }

  function mount(layout) {
    if (!layout || mounted.has(layout)) return;
    const kind = kindOf(layout);
    if (!kind) return;
    layout.classList.add('av-legacy');
    layout.dataset.legacyKind = kind;
    if (kind === 'lru' && document.readyState === 'loading') {
      // LRU's later inline scripts first capture their code and controls from
      // inside each panel. Move them only after those handlers are installed.
      if (!pending.has(layout)) {
        pending.add(layout);
        document.addEventListener('DOMContentLoaded', () => mount(layout), {once: true});
      }
      return;
    }
    mounted.add(layout);
    if (kind === 'lru') {
      mountLru(layout);
    } else {
      const animation = layout.querySelector('[data-animation-panel]');
      const options = layout.querySelector('.av-controls .av-options');
      if (options) {
        animation.querySelectorAll(':scope > .examples, :scope > .jump-row')
          .forEach(group => options.append(group));
      }
    }
  }

  // Shared trace rendering calls both adapter interfaces. Legacy diagrams are
  // already rendered by their original page, so this hook has no state work.
  function render() {}

  window.AlgorithmLegacyWorkbench = {mount, render};
})();

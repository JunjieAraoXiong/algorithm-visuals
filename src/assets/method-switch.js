/* Visible method choices; each page owns its trace and code mappings. */
(() => {
  'use strict';
  function create({root, defaultMethod = 'recursive', queryKey = 'method', onChange}) {
    const buttons = [...root.querySelectorAll('button[data-method]')];
    const supported = value => buttons.some(button => button.dataset.method === value);
    const requested = new URLSearchParams(location.search).get(queryKey);
    let value = supported(requested) ? requested : defaultMethod;
    if (!supported(value)) throw new Error(`Unknown default method: ${value}`);
    function sync() {
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.method === value));
      const url = new URL(location.href);
      url.searchParams.set(queryKey, value);
      history.replaceState(history.state, '', url);
    }
    for (const button of buttons) button.addEventListener('click', () => {
      if (value === button.dataset.method) return;
      value = button.dataset.method;
      sync();
      onChange(value);
    });
    sync();
    return {get value() {return value;}};
  }
  window.AlgorithmVisualMethods = Object.freeze({create});
})();

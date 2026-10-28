/* Reflow can move a highlighted statement after a legacy trace has scrolled.
   Keep the current source visible without changing frames or manual scrolling. */
(() => {
  'use strict';
  function mount() {
    for (const scroller of document.querySelectorAll('[data-learning-layout] [data-code-scroll]')) {
      let pending = false;
      const reveal = () => {
        pending = false;
        if (!scroller.getClientRects().length || !scroller.clientHeight) return;
        const lines = [...scroller.querySelectorAll('[aria-current="step"]')];
        if (!lines.length) return;
        const bounds = scroller.getBoundingClientRect();
        const offset = scroller.scrollTop - bounds.top - scroller.clientTop;
        const top = Math.min(...lines.map(line => line.getBoundingClientRect().top)) + offset;
        const bottom = Math.max(...lines.map(line => line.getBoundingClientRect().bottom)) + offset;
        const fits = bottom - top <= scroller.clientHeight;
        const visibleBottom = fits ? bottom : lines[0].getBoundingClientRect().bottom + offset;
        if (top < scroller.scrollTop || visibleBottom > scroller.scrollTop + scroller.clientHeight) {
          const room = fits ? Math.max(0, (scroller.clientHeight - (bottom - top)) / 2) : 0;
          scroller.scrollTo({top: Math.max(0, top - room), behavior: 'auto'});
        }
      };
      const schedule = () => {
        if (!pending) { pending = true; requestAnimationFrame(reveal); }
      };
      new ResizeObserver(schedule).observe(scroller);
      new MutationObserver(schedule).observe(scroller, {
        subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current']
      });
      schedule();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();

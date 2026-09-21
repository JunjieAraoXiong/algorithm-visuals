/*
 * Small, dependency-free primitives shared by Algorithm Visuals pages.
 *
 * A page keeps its algorithm-specific frames, layout, and drawing rules. This
 * file owns the repeated UI contract: trace navigation, code-line sync,
 * keyboard access, reduced-motion-safe tweens, retained SVG elements, and the
 * source-to-target practice interaction.
 */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const smoothstep = progress => progress * progress * (3 - 2 * progress);

  function setAttributes(element, attributes) {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined || value === false) element.removeAttribute(name);
      else element.setAttribute(name, String(value));
    }
    return element;
  }

  function createSvgElement(name) {
    return document.createElementNS(SVG_NS, name);
  }

  /**
   * Keep SVG elements in place across redraws. A drawing function only updates
   * attributes for the paths/text it needs in the current state; stale elements
   * are removed after that pass.
   */
  function createSvgScene(svg) {
    const elements = new Map();
    let visible = null;
    let defs = null;

    function ensureDefinitions() {
      if (defs) return defs;
      defs = [...svg.children].find(child => child.localName === 'defs');
      if (!defs) {
        defs = createSvgElement('defs');
        svg.prepend(defs);
      }
      return defs;
    }

    function element(type, id, attributes = {}, text) {
      let node = elements.get(id);
      if (!node) {
        node = createSvgElement(type);
        node.dataset.visualElement = id;
        svg.append(node);
        elements.set(id, node);
      }
      setAttributes(node, attributes);
      if (text !== undefined) node.textContent = text;
      visible?.add(id);
      return node;
    }

    return {
      defineMarker(id, options = {}) {
        const definitions = ensureDefinitions();
        let marker = [...definitions.children].find(child => child.id === id);
        if (!marker) {
          marker = createSvgElement('marker');
          marker.id = id;
          definitions.append(marker);
        }
        setAttributes(marker, {
          viewBox: options.viewBox || '0 0 8 8',
          markerWidth: options.markerWidth || 8,
          markerHeight: options.markerHeight || 8,
          refX: options.refX ?? 7,
          refY: options.refY ?? 4,
          orient: options.orient || 'auto'
        });
        let shape = marker.firstElementChild;
        if (!shape) {
          shape = createSvgElement('path');
          marker.append(shape);
        }
        setAttributes(shape, {
          d: options.path || 'M0 0 L8 4 L0 8 Z',
          fill: options.fill || '#333'
        });
      },
      update(draw) {
        visible = new Set();
        draw({
          path: (id, attributes) => element('path', id, attributes),
          text: (id, attributes, value) => element('text', id, attributes, value),
          circle: (id, attributes) => element('circle', id, attributes)
        });
        for (const [id, node] of elements) {
          if (!visible.has(id)) {
            node.remove();
            elements.delete(id);
          }
        }
        visible = null;
      },
      clear() {
        for (const node of elements.values()) node.remove();
        elements.clear();
      }
    };
  }

  /** Position absolutely placed controls with compositor-friendly transforms. */
  function position(element, x, y) {
    element.classList.add('visual-positioned');
    element.style.setProperty('--visual-x', `${x}px`);
    element.style.setProperty('--visual-y', `${y}px`);
  }

  function setDragOffset(element, x = 0, y = 0) {
    element.classList.add('visual-positioned');
    element.style.setProperty('--visual-drag-x', `${x}px`);
    element.style.setProperty('--visual-drag-y', `${y}px`);
  }

  function clearDragOffset(element) {
    setDragOffset(element, 0, 0);
  }

  /**
   * One cancellable rAF channel. Pages may create more than one channel when
   * their diagram has independently-timed cues.
   */
  function createMotionController(media = window.matchMedia('(prefers-reduced-motion: reduce)')) {
    let frame = null;
    let active = null;
    const preferenceListeners = new Set();

    function cancel() {
      active = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }

    function tween({duration = 340, easing = smoothstep, update, complete, respectReducedMotion = true}) {
      cancel();
      if (respectReducedMotion && media.matches) {
        update(1);
        complete?.();
        return;
      }
      const token = {};
      active = token;
      const started = performance.now();
      const tick = now => {
        if (active !== token) return;
        const progress = Math.min(1, (now - started) / duration);
        update(easing(progress), progress);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else {
          frame = null;
          active = null;
          complete?.();
        }
      };
      frame = requestAnimationFrame(tick);
    }

    const onPreferenceChange = () => {
      cancel();
      for (const listener of preferenceListeners) listener(media.matches);
    };
    media.addEventListener?.('change', onPreferenceChange);

    return {
      get reduced() { return media.matches; },
      cancel,
      tween,
      onPreferenceChange(listener) {
        preferenceListeners.add(listener);
        return () => preferenceListeners.delete(listener);
      },
      destroy() {
        cancel();
        media.removeEventListener?.('change', onPreferenceChange);
        preferenceListeners.clear();
      }
    };
  }

  /**
   * Shared scripted-trace controller. Frame state remains data owned by the
   * page, while the controller enforces the common navigation and code contract.
   */
  function createTrace({
    root,
    cloneState,
    motion,
    onRender,
    onTransition,
    onBeforeStep,
    codeKeyAttribute = 'data-source-key',
    getCodeLines,
    getCodeScroll,
    getFrameSourceKeys = frame => frame.sourceKeys,
    formatStepOption = (frame, index) => frame.stepLabel || `步骤 ${index + 1}`,
    formatCount = ({step, total, manual}) => `步骤 ${step + 1} / ${total}${manual ? ' · 练习' : ''}`,
    manualCountSuffix = ' · 练习',
    manualCodeStatus = '自由练习不会执行右侧源码；选择上一步或下一步可恢复同步。',
    rememberStep = true,
    syncStepHash = true,
    copyLinkLabel = '复制本步骤链接',
    copiedLinkLabel = '已复制链接'
  }) {
    const previous = root.querySelector('[data-action="previous"]');
    const next = root.querySelector('[data-action="next"]');
    const count = root.querySelector('[data-count]');
    const stepSelect = root.querySelector('[data-step-select]');
    const codeStatus = root.querySelector('[data-code-status]');
    const resolveCodeLines = typeof getCodeLines === 'function'
      ? getCodeLines
      : () => [...root.querySelectorAll(`[${codeKeyAttribute}]`)];
    const resolveCodeScroll = typeof getCodeScroll === 'function'
      ? getCodeScroll
      : () => root.querySelector('[data-code-scroll]');
    let frames = [];
    let step = 0;
    let state = null;
    let practiceMessage = '';
    let previewMessage = '';
    let hasInstalledFrames = false;
    let selectFrames = null;
    let copyResetTimer = null;

    const stepStorageKey = `algorithm-visuals:step:${location.pathname}`;
    let copyLink = root.querySelector('[data-action="copy-link"]');
    if (!copyLink && copyLinkLabel && next) {
      copyLink = document.createElement('button');
      copyLink.type = 'button';
      copyLink.dataset.action = 'copy-link';
      copyLink.textContent = copyLinkLabel;
      next.insertAdjacentElement('afterend', copyLink);
    }

    function currentManualMessage() {
      return previewMessage || practiceMessage;
    }

    function clamp(index) {
      return Math.max(0, Math.min(frames.length - 1, index));
    }

    function requestedHashStep() {
      const value = new URLSearchParams(location.hash.slice(1)).get('step');
      if (value === null || !/^\d+$/.test(value)) return null;
      return Number(value);
    }

    function restoredStep() {
      const fromHash = requestedHashStep();
      if (fromHash !== null) return fromHash;
      if (!rememberStep) return 0;
      try {
        const stored = localStorage.getItem(stepStorageKey);
        return stored !== null && /^\d+$/.test(stored) ? Number(stored) : 0;
      } catch {
        return 0;
      }
    }

    function persistStep({preserveExistingAnchor = false} = {}) {
      if (rememberStep) {
        try { localStorage.setItem(stepStorageKey, String(step)); } catch { /* storage can be disabled in embeds */ }
      }
      if (!syncStepHash || !frames.length) return;
      // A normal document anchor (for example #pointer-helpers) must survive
      // first paint so a page can reveal and scroll to its own content. Once a
      // learner actually navigates the trace, the trace permalink takes over.
      if (preserveExistingAnchor && location.hash && requestedHashStep() === null) return;
      const hash = `step=${step}`;
      if (location.hash.slice(1) !== hash) {
        history.replaceState(history.state, '', `${location.pathname}${location.search}#${hash}`);
      }
    }

    function frameSourceKeys(frame) {
      return getFrameSourceKeys(frame) || [];
    }

    function syncCode(sourceKeys = [], {manual = false} = {}) {
      const activeKeys = new Set(sourceKeys);
      const activeLines = [];
      for (const line of resolveCodeLines()) {
        const active = activeKeys.has(line.getAttribute(codeKeyAttribute));
        line.classList.toggle('is-active', active);
        if (active) {
          line.setAttribute('aria-current', 'step');
          activeLines.push(line);
        } else line.removeAttribute('aria-current');
      }
      if (!activeLines.length) {
        if (codeStatus) codeStatus.textContent = manual ? manualCodeStatus : '当前步骤未映射源码。';
        return;
      }
      if (codeStatus) codeStatus.textContent = `当前执行：${activeLines.map(line => line.textContent.trim()).join('；')}`;
      const codeScroll = resolveCodeScroll();
      if (!codeScroll) return;
      const first = activeLines[0];
      // `offsetTop` is relative to the nearest positioned ancestor, which is
      // often the document rather than the scrolling <pre> after the mobile
      // layout stacks the code panel. Convert viewport coordinates back into
      // the scroller's content coordinates instead.
      const lineRect = first.getBoundingClientRect();
      const scrollRect = codeScroll.getBoundingClientRect();
      const top = lineRect.top - scrollRect.top - codeScroll.clientTop + codeScroll.scrollTop;
      const bottom = top + lineRect.height;
      if (top < codeScroll.scrollTop || bottom > codeScroll.scrollTop + codeScroll.clientHeight) {
        const targetTop = Math.max(0, top - (codeScroll.clientHeight - first.offsetHeight) / 2);
        const reducedMotion = motion?.reduced ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        codeScroll.scrollTo({top: targetTop, behavior: reducedMotion ? 'auto' : 'smooth'});
      }
    }

    function context(extra = {}) {
      return {
        frames,
        frame: frames[step],
        step,
        state,
        manualMessage: currentManualMessage(),
        mode: previewMessage ? 'preview' : practiceMessage ? 'practice' : 'script',
        isManual: Boolean(currentManualMessage()),
        ...extra
      };
    }

    function syncStepSelect() {
      if (!stepSelect) return;
      if (selectFrames !== frames) {
        stepSelect.replaceChildren(...frames.map((frame, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = formatStepOption(frame, index);
          return option;
        }));
        selectFrames = frames;
      }
      stepSelect.value = String(step);
      stepSelect.disabled = frames.length < 2;
    }

    function render() {
      if (!frames.length) return;
      const frame = frames[step];
      const manualMessage = currentManualMessage();
      // Let the page paint its algorithm-specific scene first. The shared
      // controls and code panel deliberately run afterwards so legacy local
      // drawing code cannot drift their common contract.
      onRender?.(context());
      const hadPreviousFocus = document.activeElement === previous;
      const hadNextFocus = document.activeElement === next;
      if (count) count.textContent = formatCount({
        step,
        total: frames.length,
        manual: Boolean(manualMessage),
        manualCountSuffix
      });
      if (previous) previous.disabled = step === 0;
      if (next) next.disabled = step === frames.length - 1;
      syncStepSelect();
      // A focused button cannot remain focused once it becomes disabled. Keep
      // keyboard navigation continuous at either trace boundary.
      if (next?.disabled && hadNextFocus && previous && !previous.disabled) previous.focus({preventScroll: true});
      if (previous?.disabled && hadPreviousFocus && next && !next.disabled) next.focus({preventScroll: true});
      syncCode(manualMessage ? [] : frameSourceKeys(frame), {manual: Boolean(manualMessage)});
    }

    function showStep(index, {animate = true, persist = true} = {}) {
      if (!frames.length) return;
      const nextStep = clamp(index);
      // A disabled boundary control is a no-op. In particular, do not let a
      // boundary key discard a learner's unscripted practice state.
      if (nextStep === step) return;
      const previousStep = step;
      const previousFrame = frames[step];
      const wasManual = Boolean(currentManualMessage());
      const beforeState = !wasManual && state ? cloneState(state) : null;
      onBeforeStep?.(context({nextStep, previousStep, previousFrame, beforeState, wasManual}));
      step = nextStep;
      state = cloneState(frames[step].state);
      practiceMessage = '';
      previewMessage = '';
      render();
      if (animate && beforeState && previousStep !== step) {
        onTransition?.(context({previousStep, previousFrame, beforeState, wasManual}));
      }
      if (persist) persistStep();
    }

    function setFrames(nextFrames, {initialStep} = {}) {
      if (!Array.isArray(nextFrames) || !nextFrames.length) throw new Error('A visual trace needs at least one frame.');
      const codeLines = resolveCodeLines();
      const availableKeys = new Set(codeLines.map(line => line.getAttribute(codeKeyAttribute)));
      if (availableKeys.size !== codeLines.length) {
        throw new Error(`Trace code keys must be unique (${codeKeyAttribute}).`);
      }
      for (const [frameIndex, frame] of nextFrames.entries()) {
        const sourceKeys = frameSourceKeys(frame);
        if (!Array.isArray(sourceKeys) || !sourceKeys.length) {
          throw new Error(`Trace frame ${frameIndex} needs at least one source key.`);
        }
        const missing = sourceKeys.filter(key => !availableKeys.has(key));
        if (missing.length) {
          throw new Error(`Trace frame ${frameIndex} references missing code key(s): ${missing.join(', ')}.`);
        }
      }
      const isInitialInstall = !hasInstalledFrames;
      frames = nextFrames;
      const requestedInitialStep = Number.isInteger(initialStep)
        ? initialStep
        : hasInstalledFrames ? 0 : restoredStep();
      step = clamp(requestedInitialStep);
      state = cloneState(frames[step].state);
      practiceMessage = '';
      previewMessage = '';
      hasInstalledFrames = true;
      render();
      persistStep({preserveExistingAnchor: isInitialInstall});
    }

    function setPreviewMessage(message) {
      previewMessage = message || '';
      render();
    }

    function clearPreviewMessage() {
      if (!previewMessage) return;
      previewMessage = '';
      render();
    }

    function updatePractice(mutator, message) {
      mutator(state);
      practiceMessage = message || '';
      previewMessage = '';
      render();
    }

    function isEditable(target) {
      return target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable="true"], [data-code-scroll]'));
    }

    previous?.addEventListener('click', () => showStep(step - 1));
    next?.addEventListener('click', () => showStep(step + 1));
    stepSelect?.addEventListener('change', () => showStep(Number(stepSelect.value)));
    copyLink?.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.hash = `step=${step}`;
      try {
        await navigator.clipboard.writeText(url.href);
      } catch {
        const fallback = document.createElement('textarea');
        fallback.value = url.href;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.append(fallback);
        fallback.select();
        document.execCommand('copy');
        fallback.remove();
      }
      if (!copyLink) return;
      clearTimeout(copyResetTimer);
      copyLink.textContent = copiedLinkLabel;
      copyResetTimer = setTimeout(() => { if (copyLink) copyLink.textContent = copyLinkLabel; }, 1800);
    });
    const keyboardScope = root.querySelector('[data-animation-panel]') || root;
    keyboardScope.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showStep(step - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showStep(step + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        showStep(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        showStep(frames.length - 1);
      }
    });
    window.addEventListener('hashchange', () => {
      const requested = requestedHashStep();
      if (requested !== null) showStep(requested, {animate: false, persist: false});
    });

    return {
      setFrames,
      showStep,
      render,
      syncCode,
      clearCodeHighlight: () => syncCode([], {manual: true}),
      setPreviewMessage,
      clearPreviewMessage,
      updatePractice,
      get state() { return state; },
      get frame() { return frames[step]; },
      get frames() { return frames; },
      get step() { return step; },
      get manualMessage() { return currentManualMessage(); },
      get mode() { return previewMessage ? 'preview' : practiceMessage ? 'practice' : 'script'; }
    };
  }

  /**
   * Bind click-select and pointer-drag practice interaction once. Page adapters
   * provide geometry and mutation semantics; this controller owns event timing,
   * target hit testing, escape-to-cancel, and drag-click suppression.
   */
  function createManualInteraction({
    root,
    stage,
    sources,
    targets,
    getTargetPoint,
    getSourceKey = source => source.dataset.source,
    getTargetValue = target => target.dataset.target === 'null' ? null : target.dataset.target,
    targetReadyClass = 'ready',
    maxDistance = 40,
    dragThreshold = 5,
    onSelectionChange,
    onPointerStart,
    onPointerMove,
    onPointerEnd,
    onPointerCancel,
    onDrop
  }) {
    const sourceList = typeof sources === 'function' ? sources() : [...sources];
    const targetList = () => typeof targets === 'function' ? targets() : [...targets];
    let selected = null;
    let drag = null;
    let suppressClick = false;

    function setReady(target) {
      for (const candidate of targetList()) candidate.classList.toggle(targetReadyClass, candidate === target);
    }

    function nearestTarget(clientX, clientY) {
      const rect = stage.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let closest = null;
      let distance = maxDistance;
      for (const target of targetList()) {
        const point = getTargetPoint(target);
        if (!point) continue;
        const candidate = Math.hypot(x - point.x, y - point.y);
        if (candidate < distance) {
          closest = target;
          distance = candidate;
        }
      }
      return {target: closest, x, y};
    }

    function setSelected(value, source, {notify = true} = {}) {
      selected = value;
      if (notify) onSelectionChange?.({selected, source});
    }

    function clearSelection(options) {
      if (selected === null) return;
      setSelected(null, null, options);
    }

    for (const source of sourceList) {
      source.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        const key = getSourceKey(source);
        setSelected(selected === key ? null : key, source);
      });
      source.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        drag = {source: getSourceKey(source), button: source, startX: event.clientX, startY: event.clientY, x: 0, y: 0, dx: 0, dy: 0, moved: false};
        source.setPointerCapture?.(event.pointerId);
        onPointerStart?.({event, drag});
      });
      source.addEventListener('pointermove', event => {
        if (!drag || drag.button !== source) return;
        drag.dx = event.clientX - drag.startX;
        drag.dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(drag.dx, drag.dy) < dragThreshold) return;
        drag.moved = true;
        const nearest = nearestTarget(event.clientX, event.clientY);
        drag.x = nearest.x;
        drag.y = nearest.y;
        setDragOffset(source, drag.dx, drag.dy);
        setReady(nearest.target);
        onPointerMove?.({event, drag, target: nearest.target});
      });
      source.addEventListener('pointerup', event => {
        if (!drag || drag.button !== source) return;
        const finished = drag;
        clearDragOffset(source);
        drag = null;
        setReady(null);
        if (finished.moved) {
          const nearest = nearestTarget(event.clientX, event.clientY);
          if (nearest.target) onDrop?.({event, source: finished.source, target: nearest.target, value: getTargetValue(nearest.target), drag: finished});
          else onPointerEnd?.({event, drag: finished});
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
        }
      });
      source.addEventListener('pointercancel', event => {
        if (!drag || drag.button !== source) return;
        const cancelled = drag;
        clearDragOffset(source);
        drag = null;
        setReady(null);
        onPointerCancel?.({event, drag: cancelled});
      });
    }

    stage.addEventListener('click', event => {
      const target = event.target.closest?.('[data-target]');
      if (!target || !stage.contains(target) || selected === null) return;
      onDrop?.({event, source: selected, target, value: getTargetValue(target), drag: null});
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && selected !== null) {
        event.preventDefault();
        clearSelection();
      }
    });

    return {
      get selected() { return selected; },
      get drag() { return drag; },
      clearSelection,
      destroy() {
        // Pages are static; this is intentionally a light lifecycle hook for
        // future multi-instance pages rather than a full listener registry.
        clearSelection({notify: false});
      }
    };
  }

  window.AlgorithmVisualCore = Object.freeze({
    createSvgScene,
    createMotionController,
    createTrace,
    createManualInteraction,
    position,
    setDragOffset,
    clearDragOffset,
    smoothstep
  });
})();

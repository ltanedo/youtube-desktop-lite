// Add consistent momentum to vertical WKWebView scrolling on macOS. Wheel
// events update a coalesced destination while WebKit performs the actual
// smooth animation; avoiding per-frame scrollTop writes keeps motion on the
// browser's optimized scrolling path instead of YouTube's busy main thread.
(() => {
  if (window.__pakeMacSmoothScroll) return;
  if (!/Macintosh|Mac OS X/.test(navigator.userAgent)) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  window.__pakeMacSmoothScroll = true;

  const states = new WeakMap();
  let activeElement = null;
  let lastWheelAt = 0;

  const clamp = (value, minimum, maximum) =>
    Math.min(maximum, Math.max(minimum, value));

  const maximumScrollTop = (element) =>
    Math.max(0, element.scrollHeight - element.clientHeight);

  const canScroll = (element, delta) => {
    const maximum = maximumScrollTop(element);
    if (maximum < 1) return false;
    return delta < 0 ? element.scrollTop > 0 : element.scrollTop < maximum - 1;
  };

  const scrollableElement = (event, delta) => {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];

    for (const candidate of path) {
      if (!(candidate instanceof Element) || typeof candidate.scrollTo !== 'function') continue;
      const style = getComputedStyle(candidate);
      if (!/(auto|scroll|overlay)/.test(style.overflowY)) continue;
      if (canScroll(candidate, delta)) return candidate;
    }

    const root = document.scrollingElement;
    return root && canScroll(root, delta) ? root : null;
  };

  const cancel = () => {
    if (!activeElement) return;
    const state = states.get(activeElement);
    if (state?.frame) cancelAnimationFrame(state.frame);
    if (state?.settleTimer) clearTimeout(state.settleTimer);
    if (state) {
      state.frame = 0;
      state.settleTimer = 0;
      activeElement.scrollTo({ top: activeElement.scrollTop, behavior: 'auto' });
      state.target = activeElement.scrollTop;
    }
    activeElement = null;
  };

  const pixelsFor = (event, element, interval) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * element.clientHeight * 0.9;
    }
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      return event.deltaY * (Number.isFinite(lineHeight) ? lineHeight : 16);
    }
    const magnitude = Math.abs(event.deltaY);
    // A slow Surface Arc Mouse gesture can arrive as a single 1–10 px event,
    // whereas a trackpad produces a dense stream. Normalize only sparse small
    // pixel events; dense input keeps its original distance and merely shares
    // the same continuous spring.
    if (magnitude > 0 && magnitude < 40 && interval > 34) {
      const minimumStep = 54;
      return Math.sign(event.deltaY) * Math.max(magnitude, minimumStep);
    }
    return event.deltaY;
  };

  const animate = (element, delta) => {
    if (activeElement && activeElement !== element) cancel();
    activeElement = element;

    const now = performance.now();
    const maximum = maximumScrollTop(element);
    let state = states.get(element);
    if (!state || now - state.lastInput > 420) {
      state = {
        target: element.scrollTop,
        lastInput: now,
        frame: 0,
        settleTimer: 0,
      };
      states.set(element, state);
    }
    state.target = clamp(state.target + delta, 0, maximum);
    state.lastInput = now;

    // Batch a burst to at most one call per display frame. WebKit owns the
    // interpolation and can coordinate it with its native scrolling layer.
    if (!state.frame) {
      state.frame = requestAnimationFrame(() => {
        state.frame = 0;
        element.scrollTo({ top: state.target, behavior: 'smooth' });
      });
    }

    clearTimeout(state.settleTimer);
    state.settleTimer = setTimeout(() => {
      state.settleTimer = 0;
      state.target = element.scrollTop;
      if (activeElement === element) activeElement = null;
    }, 420);
  };

  window.addEventListener(
    'wheel',
    (event) => {
      const now = performance.now();
      const interval = lastWheelAt ? now - lastWheelAt : Number.POSITIVE_INFINITY;
      lastWheelAt = now;

      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        document.fullscreenElement ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        return;
      }

      const element = scrollableElement(event, event.deltaY);
      if (!element) return;
      const delta = pixelsFor(event, element, interval);
      if (!delta) return;

      event.preventDefault();
      animate(element, delta);
    },
    { capture: true, passive: false },
  );

  window.addEventListener('pointerdown', cancel, true);
  window.addEventListener('keydown', (event) => {
    if (/^(Arrow|Page|Home|End|Space)/.test(event.code)) cancel();
  }, true);
})();

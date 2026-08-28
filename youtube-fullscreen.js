// Native-like YouTube fullscreen for Pake/Tauri.
//
// Pake's fullscreen polyfill reparents the raw <video> element when YouTube
// requests fullscreen on document.documentElement. That separates the video
// from YouTube's controls and captions. This shim performs no DOM surgery: it
// makes the Tauri window fullscreen and exposes the same Fullscreen API state
// and events that YouTube receives in a regular browser.
(function () {
  if (window.__pakeYouTubeFullscreenInjected) return;
  window.__pakeYouTubeFullscreenInjected = true;

  var fullscreenElement = null;
  var operationToken = 0;
  var operationPending = false;
  var enteredAt = 0;

  function appWindow() {
    return window.__TAURI__ && window.__TAURI__.window
      ? window.__TAURI__.window.getCurrentWindow()
      : null;
  }

  function dispatchEvents(target, standardName, webkitName) {
    setTimeout(function () {
      [standardName, webkitName].forEach(function (name) {
        (target || document).dispatchEvent(new Event(name, { bubbles: true }));
      });
    }, 0);
  }

  function dispatchChange(target) {
    dispatchEvents(target, 'fullscreenchange', 'webkitfullscreenchange');
  }

  function dispatchError(target) {
    dispatchEvents(target, 'fullscreenerror', 'webkitfullscreenerror');
  }

  function nudgeLayout() {
    [50, 350, 700].forEach(function (delay) {
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, delay);
    });
  }

  function enterFullscreen(element) {
    var win = appWindow();
    if (!win) {
      return Promise.reject(new TypeError('Tauri window API unavailable'));
    }

    if (fullscreenElement) {
      fullscreenElement = element;
      dispatchChange(element);
      return Promise.resolve();
    }

    // YouTube checks fullscreenElement synchronously after requestFullscreen.
    fullscreenElement = element;
    enteredAt = Date.now();
    operationPending = true;
    var token = ++operationToken;

    return win.setFullscreen(true).then(
      function () {
        if (token !== operationToken) return;
        operationPending = false;
        dispatchChange(element);
        nudgeLayout();
      },
      function (error) {
        if (token === operationToken) {
          operationPending = false;
          fullscreenElement = null;
          dispatchError(element);
        }
        throw error;
      },
    );
  }

  // If skipNative is true, Windows has already left native fullscreen and
  // only the page's Fullscreen API state needs to be synchronized.
  function exitFullscreen(skipNative) {
    if (!fullscreenElement) return Promise.resolve();

    var element = fullscreenElement;
    fullscreenElement = null;
    var token = ++operationToken;
    var win = appWindow();

    if (skipNative || !win) {
      dispatchChange(element);
      nudgeLayout();
      return Promise.resolve();
    }

    operationPending = true;
    return win.setFullscreen(false).then(
      function () {
        if (token !== operationToken) return;
        operationPending = false;
        dispatchChange(element);
        nudgeLayout();
      },
      function (error) {
        if (token === operationToken) {
          operationPending = false;
          fullscreenElement = element;
          dispatchError(element);
        }
        throw error;
      },
    );
  }

  // Handle Escape before YouTube can issue a second, conflicting exit.
  window.addEventListener(
    'keydown',
    function (event) {
      if (event.key === 'Escape' && fullscreenElement) {
        event.preventDefault();
        event.stopImmediatePropagation();
        exitFullscreen();
      }
    },
    true,
  );

  // Keep page state synchronized if fullscreen is left through native window
  // controls or another operating-system action.
  setInterval(function () {
    if (!fullscreenElement || operationPending) return;
    if (Date.now() - enteredAt < 1500) return;

    var win = appWindow();
    if (!win) return;
    var token = operationToken;

    win
      .isFullscreen()
      .then(function (isFullscreen) {
        if (
          !isFullscreen &&
          fullscreenElement &&
          !operationPending &&
          token === operationToken
        ) {
          exitFullscreen(true);
        }
      })
      .catch(function () {});
  }, 500);

  function markedRequest() {
    function requestFullscreen() {
      return enterFullscreen(this);
    }
    requestFullscreen.__pakeYouTubeFullscreen = true;
    return requestFullscreen;
  }

  function markedExit() {
    function documentExitFullscreen() {
      return exitFullscreen();
    }
    documentExitFullscreen.__pakeYouTubeFullscreen = true;
    return documentExitFullscreen;
  }

  function defineGetter(object, name, getter) {
    var current = Object.getOwnPropertyDescriptor(object, name);
    if (current && current.get && current.get.__pakeYouTubeFullscreen) return;
    getter.__pakeYouTubeFullscreen = true;
    Object.defineProperty(object, name, {
      get: getter,
      configurable: true,
    });
  }

  // Pake installs its fullscreen polyfill asynchronously. Reassert these
  // marked overrides until this shim owns the complete Fullscreen API surface.
  function ensureOverrides() {
    ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen'].forEach(
      function (name) {
        var current = Element.prototype[name];
        if (!current || !current.__pakeYouTubeFullscreen) {
          Element.prototype[name] = markedRequest();
        }
      },
    );

    ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen'].forEach(
      function (name) {
        var current = document[name];
        if (!current || !current.__pakeYouTubeFullscreen) {
          document[name] = markedExit();
        }
      },
    );

    ['fullscreenElement', 'webkitFullscreenElement', 'webkitCurrentFullScreenElement'].forEach(
      function (name) {
        defineGetter(document, name, function () {
          return fullscreenElement;
        });
      },
    );

    ['webkitIsFullScreen', 'fullScreen'].forEach(function (name) {
      defineGetter(document, name, function () {
        return !!fullscreenElement;
      });
    });

    ['fullscreenEnabled', 'webkitFullscreenEnabled'].forEach(function (name) {
      defineGetter(document, name, function () {
        return true;
      });
    });
  }

  setInterval(ensureOverrides, 1000);
  ensureOverrides();
})();

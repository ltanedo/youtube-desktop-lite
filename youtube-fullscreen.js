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
  var ultrawideVideo = null;
  var ultrawideScale = '';
  var ultrawideUpdateTimer = 0;
  var ultrawideToastTimer = 0;
  var fullscreenFadeOutTimer = 0;
  var fullscreenFadeCleanupTimer = 0;
  var ultrawideFillEnabled = false;

  try {
    ultrawideFillEnabled =
      localStorage.getItem('pake-youtube-ultrawide-fill') === '1';
  } catch (error) {}

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

  function fullscreenFadeLayer() {
    var layer = document.getElementById('pake-fullscreen-fade');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'pake-fullscreen-fade';
      layer.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(layer);
    }
    return layer;
  }

  function fadeToBlack() {
    var layer = fullscreenFadeLayer();
    clearTimeout(fullscreenFadeOutTimer);
    clearTimeout(fullscreenFadeCleanupTimer);

    return new Promise(function (resolve) {
      // Two frames guarantee that the transparent starting state is painted
      // before the compositor begins the opacity transition.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          layer.classList.add('pake-fullscreen-fade-visible');
          setTimeout(function () {
            // Once the page is fully covered, hide its scrollbars before the
            // native viewport changes size. This prevents the WebView from
            // briefly painting a stale vertical scrollbar during the resize.
            document.documentElement.classList.add(
              'pake-fullscreen-transition',
            );
            resolve();
          }, 200);
        });
      });
    });
  }

  function fadeFromBlack(delay, prepareReveal) {
    var layer = document.getElementById('pake-fullscreen-fade');
    if (!layer) return;

    clearTimeout(fullscreenFadeOutTimer);
    fullscreenFadeOutTimer = setTimeout(function () {
      fullscreenFadeOutTimer = 0;
      window.requestAnimationFrame(function () {
        if (prepareReveal) prepareReveal();

        // Give the WebView one fully covered compositor frame to paint the final
        // ultrawide transform before any part of the video becomes visible.
        window.requestAnimationFrame(function () {
          // Restore the settled page behind the still-opaque cover, then reveal
          // both the page and its correct post-transition scrollbar state.
          document.documentElement.classList.remove(
            'pake-fullscreen-transition',
          );
          layer.classList.remove('pake-fullscreen-fade-visible');
          clearTimeout(fullscreenFadeCleanupTimer);
          fullscreenFadeCleanupTimer = setTimeout(function () {
            if (
              layer.parentNode &&
              !layer.classList.contains('pake-fullscreen-fade-visible')
            ) {
              layer.parentNode.removeChild(layer);
            }
            document.documentElement.classList.remove(
              'pake-fullscreen-transition',
            );
          }, 260);
        });
      });
    }, delay || 0);
  }

  function clearUltrawideFill() {
    if (!ultrawideVideo) return;
    ultrawideVideo.classList.remove('pake-ultrawide-fill');
    ultrawideVideo.style.removeProperty('--pake-ultrawide-scale');
    ultrawideVideo = null;
    ultrawideScale = '';
  }

  // A synthetic Fullscreen API state is enough for WebView2, but current
  // WKWebView does not apply the browser's :fullscreen layout to YouTube's
  // player. Pin the complete player (video, captions and controls together) to
  // the native viewport so macOS fullscreen does not merely enlarge the page.
  function setPlayerFullscreenLayout(active) {
    document.documentElement.classList.toggle(
      'pake-youtube-player-fullscreen',
      active,
    );
    var player = document.getElementById('movie_player');
    if (player) {
      player.classList.toggle('pake-native-fullscreen-player', active);
    }
  }

  function updateUltrawideFill() {
    if (!fullscreenElement || !ultrawideFillEnabled) {
      clearUltrawideFill();
      return 'off';
    }

    var player = document.getElementById('movie_player');
    var video = player && player.querySelector('video.html5-main-video');
    if (!player || !video || !video.videoWidth || !video.videoHeight) {
      clearUltrawideFill();
      return 'waiting';
    }

    var sourceAspect = video.videoWidth / video.videoHeight;
    if (Math.abs(sourceAspect - 16 / 9) > 0.1) {
      clearUltrawideFill();
      return 'not-16-9';
    }

    var bounds = player.getBoundingClientRect();
    var targetWidth = bounds.width || window.innerWidth;
    var targetHeight = bounds.height || window.innerHeight;
    var targetAspect = targetWidth / targetHeight;

    // Leave 16:9 and 16:10 displays alone. On a wider display, scale the
    // already centered video uniformly so it fills the player horizontally.
    // CSS `scale` changes only painting, not YouTube's layout calculations.
    if (!isFinite(targetAspect) || targetAspect <= sourceAspect + 0.12) {
      clearUltrawideFill();
      return 'not-ultrawide';
    }

    if (ultrawideVideo && ultrawideVideo !== video) clearUltrawideFill();

    var scale = Math.min(2, targetAspect / sourceAspect);
    var nextScale = scale.toFixed(5);
    if (
      ultrawideVideo !== video ||
      ultrawideScale !== nextScale ||
      !video.classList.contains('pake-ultrawide-fill')
    ) {
      video.style.setProperty('--pake-ultrawide-scale', nextScale);
      video.classList.add('pake-ultrawide-fill');
    }
    ultrawideVideo = video;
    ultrawideScale = nextScale;
    return 'active';
  }

  function scheduleUltrawideUpdate(delay) {
    clearTimeout(ultrawideUpdateTimer);
    ultrawideUpdateTimer = setTimeout(function () {
      ultrawideUpdateTimer = 0;
      window.requestAnimationFrame(updateUltrawideFill);
    }, delay || 0);
  }

  function showUltrawideToast(message) {
    var toast = document.getElementById('pake-ultrawide-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pake-ultrawide-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('pake-ultrawide-toast-visible');
    clearTimeout(ultrawideToastTimer);
    ultrawideToastTimer = setTimeout(function () {
      toast.classList.remove('pake-ultrawide-toast-visible');
    }, 1800);
  }

  function toggleUltrawideFill() {
    ultrawideFillEnabled = !ultrawideFillEnabled;
    try {
      localStorage.setItem(
        'pake-youtube-ultrawide-fill',
        ultrawideFillEnabled ? '1' : '0',
      );
    } catch (error) {}

    var status = updateUltrawideFill();
    if (!ultrawideFillEnabled) {
      showUltrawideToast('Fill ultrawide: Off');
    } else if (status === 'not-16-9') {
      showUltrawideToast('Fill ultrawide: 16:9 videos only');
    } else if (status === 'not-ultrawide') {
      showUltrawideToast('Fill ultrawide: On (waiting for ultrawide)');
    } else {
      showUltrawideToast('Fill ultrawide: On');
    }
  }

  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    return (
      target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
    );
  }

  function nudgeLayout() {
    [50, 350, 700].forEach(function (delay) {
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, delay);
    });

    // Wait until the native window animation and YouTube's resize work finish.
    // Measuring the player during those steps causes synchronous WebView
    // layouts and makes fullscreen transitions visibly stutter.
    scheduleUltrawideUpdate(800);
  }

  function restoreKeyboardFocus(win) {
    // macOS can return from its fullscreen Space with the native window active
    // but WKWebView no longer acting as the keyboard responder. Reassert both
    // levels after the transition so player shortcuts work without a click.
    [50, 350, 800].forEach(function (delay) {
      setTimeout(function () {
        var invoke = window.__TAURI__ && window.__TAURI__.core
          ? window.__TAURI__.core.invoke
          : null;
        if (invoke) {
          invoke('blocker_focus_webview').catch(function () {});
        } else if (win && typeof win.setFocus === 'function') {
          win.setFocus().catch(function () {});
        }
        window.focus();
        var player = document.getElementById('movie_player');
        if (player && typeof player.focus === 'function') {
          try {
            player.focus({ preventScroll: true });
          } catch (error) {
            player.focus();
          }
        }
      }, delay);
    });
  }

  function enterFullscreen(element) {
    var win = appWindow();
    if (!win) {
      return Promise.reject(new TypeError('Tauri window API unavailable'));
    }

    // YouTube's WKWebView player can keep labelling its control "Full screen"
    // even after the synthetic fullscreenchange event. Treat a repeated
    // request from the same element as the user's exit toggle so the on-screen
    // control remains reliable on macOS. A request from a different element
    // still follows the browser behavior of switching the fullscreen owner.
    if (fullscreenElement === element) {
      return exitFullscreen();
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
    setPlayerFullscreenLayout(true);
    var token = ++operationToken;

    return fadeToBlack().then(function () {
      if (token !== operationToken) return;
      return win.setFullscreen(true);
    }).then(
      function () {
        if (token !== operationToken) return;
        operationPending = false;
        dispatchChange(element);
        nudgeLayout();
        // Tauri resolves before the native WebView resize is visually done.
        // Keep the page covered until that native transition has settled.
        fadeFromBlack(550, updateUltrawideFill);
      },
      function (error) {
        if (token === operationToken) {
          operationPending = false;
          fullscreenElement = null;
          setPlayerFullscreenLayout(false);
          dispatchError(element);
          fadeFromBlack();
        }
        throw error;
      },
    );
  }

  // If skipNative is true, the OS has already left native fullscreen and
  // only the page's Fullscreen API state needs to be synchronized.
  function exitFullscreen(skipNative) {
    if (!fullscreenElement || operationPending) return Promise.resolve();

    var element = fullscreenElement;
    var token = ++operationToken;
    var win = appWindow();

    if (skipNative || !win) {
      fullscreenElement = null;
      setPlayerFullscreenLayout(false);
      clearUltrawideFill();
      dispatchChange(element);
      nudgeLayout();
      restoreKeyboardFocus(win);
      return Promise.resolve();
    }

    operationPending = true;
    return fadeToBlack().then(function () {
      if (token !== operationToken) return;
      // Keep the ultrawide frame visible until the cover is fully opaque.
      // Clearing it here prevents a 16:9 frame from flashing before exit.
      fullscreenElement = null;
      setPlayerFullscreenLayout(false);
      clearUltrawideFill();
      return win.setFullscreen(false);
    }).then(
      function () {
        if (token !== operationToken) return;
        operationPending = false;
        dispatchChange(element);
        nudgeLayout();
        restoreKeyboardFocus(win);
        fadeFromBlack(550);
      },
      function (error) {
        if (token === operationToken) {
          operationPending = false;
          fullscreenElement = element;
          setPlayerFullscreenLayout(true);
          dispatchError(element);
          fadeFromBlack(0, updateUltrawideFill);
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
      } else if (
        !operationPending &&
        !event.repeat &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === 'f'
      ) {
        // WKWebView does not always update YouTube's internal fullscreen flag,
        // so its own F shortcut can become a no-op. Own the toggle here and
        // stop YouTube from issuing a second, conflicting request.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (fullscreenElement) {
          exitFullscreen();
        } else {
          enterFullscreen(document.documentElement);
        }
      } else if (
        fullscreenElement &&
        !operationPending &&
        !event.repeat &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === 'd'
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleUltrawideFill();
      }
    },
    true,
  );

  // YouTube also handles its player shortcuts on keyup. After our keydown
  // enters fullscreen, that delayed handler otherwise sees the stale macOS
  // state and immediately asks to enter again—which our toggle correctly
  // interprets as an exit. Consume the matching keyup as part of the same
  // shortcut transaction.
  window.addEventListener(
    'keyup',
    function (event) {
      if (
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  // A new video can reuse the same player element with different dimensions.
  // Re-evaluate only after its metadata is available instead of polling layout.
  document.addEventListener(
    'loadedmetadata',
    function (event) {
      if (
        fullscreenElement &&
        event.target &&
        event.target.matches &&
        event.target.matches('video.html5-main-video')
      ) {
        scheduleUltrawideUpdate(50);
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

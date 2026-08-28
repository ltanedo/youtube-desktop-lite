(() => {
  const ZOOM_KEYS = new Set(["-", "=", "+", "0"]);
  const REFLOW_DELAYS = [50, 150, 300, 600, 1000];
  let reflowTimers = [];

  const refreshYouTubePlayer = () => {
    // Force style/layout to settle before notifying YouTube. This fixes the
    // player retaining its pre-zoom width while its controls use the new one.
    void document.documentElement.offsetWidth;
    window.dispatchEvent(new Event("resize"));

    const player = document.querySelector("#movie_player");
    if (player) {
      player.dispatchEvent(new Event("resize"));
    }
  };

  const scheduleYouTubeReflow = () => {
    reflowTimers.forEach(clearTimeout);
    reflowTimers = REFLOW_DELAYS.map((delay) =>
      setTimeout(refreshYouTubePlayer, delay)
    );
  };

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.ctrlKey && !event.altKey && ZOOM_KEYS.has(event.key)) {
        scheduleYouTubeReflow();
      }
    },
    true
  );

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        scheduleYouTubeReflow();
      }
    },
    { capture: true, passive: true }
  );

  // Also cover restored zoom values and WebView2-driven viewport changes.
  window.addEventListener("DOMContentLoaded", scheduleYouTubeReflow, {
    once: true
  });
  window.visualViewport?.addEventListener("resize", scheduleYouTubeReflow);
})();

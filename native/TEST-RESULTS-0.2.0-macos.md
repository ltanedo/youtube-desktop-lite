# macOS 0.2.0 acceptance results

Tested on Apple silicon with WKWebView on 2026-09-23.

## Automated checks

- Shared blocker Rust unit tests: pass.
- Generated Pake/Tauri runtime Rust tests, including WKContentRuleList tests: pass.
- Generated runtime `cargo check`: pass.
- Chrome scriptlet fixture: pass for enabled and disabled modes, early and late
  fetch/Request/XHR response pruning, cosmetic rules, and normal content.
- Apple code-signature structural verification: pass with an ad-hoc signature.

## Interactive acceptance

- Application starts and navigates after blocker initialization.
- Normal playback, native controls and captions remain usable.
- The YouTube fullscreen button enters fullscreen and a second click exits.
- **F** enters and exits fullscreen, then immediately re-enters without requiring
  a mouse click or producing the macOS blocked-key sound.
- **Escape** exits fullscreen.
- The player, controls and captions fill fullscreen without the ordinary YouTube
  page UI competing with the player.
- The Shield panel opens, its toggle persists, and toggling reloads the page with
  the selected blocker state.

The macOS package is not Developer ID signed or notarized. Live ad delivery is
variable, and these checks cannot guarantee coverage of future YouTube changes
or server-stitched advertisements.

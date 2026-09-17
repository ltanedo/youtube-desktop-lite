# YouTube Desktop (Pake)

A lightweight, native-feeling desktop client for YouTube built using **Rust**, **Tauri**, and **Pake**. 

This application uses Windows WebView2 rather than bundling a browser runtime. Memory use depends on YouTube and the videos being played.

---

## Key Features

- **Integrated ad blocker (0.1.15):** Enabled-by-default `adblock-rust` network filtering, early scriptlets and cosmetic rules. Use **Shield** or **Ctrl+Alt+B** for the persistent toggle, diagnostics and filter updates. See [coverage and testing notes](native/README.md).
- **Native Look & Feel:** Standard OS window borders are hidden/styled to integrate smoothly with the player window.
- **Custom Dark Title Bar (Fix Applied):** Features a customized dark window frame to match YouTube's dark mode, preventing the default glaring white Windows title bar.
- **Custom Style Injection:** Integrates a custom CSS style injector to style elements (such as making the top bar solid black and adjusting search input visibility).
- **High-DPI Zoom Reflow:** Injects `youtube-reflow.js` so the YouTube player recalculates its size after Pake/WebView2 zoom changes.
- **Native-Like Fullscreen:** Injects `youtube-fullscreen.js` so Pake enters native window fullscreen without moving YouTube's video away from its controls and captions.
- **Smooth Fullscreen Fade:** Covers the WebView with a short Firefox-style black fade while Windows changes fullscreen state.
- **Flash-Free Transitions:** Hides stale scrollbars and uses black document, WebView, and native window surfaces throughout fullscreen resizing.
- **Reliable First Paint:** Wakes WebView2's composition surface after Pake reveals its initially hidden startup window, preventing a black screen that only Alt-Tab would clear.
- **Ultrawide Fill:** Press **D** in fullscreen to zoom a 16:9 video until it fills an ultrawide display. Press it again to restore normal letterboxing. The setting persists between launches.

---

## Prerequisites

Before building this application from source on Windows, ensure you have the following installed:

1. **Node.js** (22 or newer recommended)
   - Check with: `node -v`
2. **Rust Toolchain** (1.95 tested with the pinned blocker dependencies)
   - Install via [rustup.rs](https://rustup.rs/)
   - Check with: `rustc --version`
3. **Visual Studio C++ Build Tools**
   - Install the **Desktop development with C++** workload using the Visual Studio Installer (needed for compiling native Rust/Tauri modules on Windows).

---

## Windows Dark Title Bar Fix

Older Pake builds hardcoded a standard OS-theme window border (`.theme(None)`). The pinned Pake 3.15.7 already includes the dark-mode-aware behavior below; no additional theme patch is needed.

This repository notes a custom patch applied to Pake's internal file (`src-tauri/src/app/window.rs` in the `pake-cli` node package):

```diff
- window_builder = window_builder.data_directory(_data_dir).theme(None);
+ let theme = if window_config.dark_mode {
+     Some(tauri::Theme::Dark)
+ } else {
+     None
+ };
+ window_builder = window_builder.data_directory(_data_dir).theme(theme);
```

Applying this patch allows the `--dark-mode` flag on the CLI to instruct the Windows DWM (Desktop Window Manager) to render the window frame in a native dark theme (solid black).

---

## Windows Fullscreen Controls and Captions Fix

Pake 3.15.7's fullscreen polyfill handles a fullscreen request on the page root by detaching the largest `<video>` element and moving it directly under `<body>`. On YouTube, this separates the video from the player controls and caption overlays.

The injected `youtube-fullscreen.js` performs no DOM reparenting. It overrides Pake's polyfill, changes the native Tauri window's fullscreen state, reports the expected Fullscreen API properties, and dispatches the standard events YouTube uses to update its layout. YouTube therefore remains responsible for sizing the complete player and showing its controls and captions.

This approach is adapted for Windows from the no-DOM-surgery fix developed in [`sssmolkni/pake-youtube-pip`](https://github.com/sssmolkni/pake-youtube-pip/commit/6e6df671687e73ca4ad38e14e99a1199fc827af8) for the known [Pake fullscreen limitation](https://github.com/tw93/Pake/issues/1113).

### Native black transition surface and startup paint

WebView2 can briefly expose its native background before the resized page is painted. It can also finish loading while Pake's startup window is hidden and fail to present that first frame until Windows reactivates the window. Apply [`pake-native-black-background.patch`](pake-native-black-background.patch) to Pake 3.15.7 before building. It sets both the Tauri window and WebView backgrounds to black and performs a one-time WebView2 visibility/bounds refresh after the window is revealed. The injected transition CSS separately covers the page and suppresses stale scrollbars.

### Ultrawide fullscreen

While a 16:9 video is fullscreen on an ultrawide monitor, press **D** to toggle **Fill ultrawide**. The mode uniformly scales the video surface to fill the screen width, which crops the top and bottom of the picture. It does not resize or move YouTube's player, controls, or caption layers. Videos that are not approximately 16:9 are left unchanged. The preference is cached in YouTube's local storage and automatically restored whenever the app restarts.

---

## How to Build

Clone this repository and run from its root on Windows:

```powershell
npm ci --ignore-scripts
npm run build
$env:CARGO_TARGET_DIR = Join-Path (Get-Location) '.build-target'
npm test
```

This installs project-local Pake **3.15.7**, applies the preserved startup patch
and the native blocker integration, restores the Rust dependency lockfile, and
builds `YouTube.exe` plus `YouTube.msi`. Do not build with an unpatched global or
cached Pake CLI: the three JavaScript/CSS injections alone do not include the
native blocker. See [native/README.md](native/README.md) for architecture,
filter provenance, limitations, recovery and the manual acceptance checklist.

---

## License

The original wrapper customizations are MIT-licensed. Pake, the Rust blocker,
filter lists and scriptlet resources retain their own licenses; see
[third-party notices](native/THIRD-PARTY-NOTICES.md).

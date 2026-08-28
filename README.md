# YouTube Desktop (Pake)

A lightweight, native-feeling desktop client for YouTube built using **Rust**, **Tauri**, and **Pake**. 

Unlike bulky Electron-based wrappers, this application uses the operating system's native Webview, yielding a tiny application size (~8 MB) and extremely low memory footprint.

---

## Key Features

- **Ultra Lightweight:** Standalone executable size is only ~8.3 MB.
- **Native Look & Feel:** Standard OS window borders are hidden/styled to integrate smoothly with the player window.
- **Custom Dark Title Bar (Fix Applied):** Features a customized dark window frame to match YouTube's dark mode, preventing the default glaring white Windows title bar.
- **Custom Style Injection:** Integrates a custom CSS style injector to style elements (such as making the top bar solid black and adjusting search input visibility).
- **High-DPI Zoom Reflow:** Injects `youtube-reflow.js` so the YouTube player recalculates its size after Pake/WebView2 zoom changes.
- **Native-Like Fullscreen:** Injects `youtube-fullscreen.js` so Pake enters native window fullscreen without moving YouTube's video away from its controls and captions.

---

## Prerequisites

Before building this application from source on Windows, ensure you have the following installed:

1. **Node.js** ($\ge$ 18.0.0, $\ge$ 22.0 recommended)
   - Check with: `node -v`
2. **Rust Toolchain** ($\ge$ 1.85.0)
   - Install via [rustup.rs](https://rustup.rs/)
   - Check with: `rustc --version`
3. **Visual Studio C++ Build Tools**
   - Install the **Desktop development with C++** workload using the Visual Studio Installer (needed for compiling native Rust/Tauri modules on Windows).

---

## Windows Dark Title Bar Fix

By default, Pake's internal Rust window manager hardcodes a standard OS-theme window border (`.theme(None)`), which renders as a white title bar on Windows even when running the app in dark mode or with the `--dark-mode` flag.

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

---

## How to Build

1. **Install Pake CLI:**
   ```bash
   npm install -g pake-cli
   ```

2. **Generate the App:**
   Clone this repository, navigate to the folder, and run:
   ```bash
   npx pake-cli@3.15.7 https://www.youtube.com --name "YouTube" --identifier "com.pake.a1c202c" --inject youtube-custom.css,youtube-reflow.js,youtube-fullscreen.js --width 1280 --height 800 --min-width 720 --min-height 480 --maximize --dark-mode --app-version 0.1.3 --keep-binary
   ```

3. **Output:**
   Pake will output:
   - `YouTube.msi` (The Windows Installer)
   - The compiled standalone executable `YouTube.exe` is stored in Pake's build directory and can be copied over for direct use.

---

## License

This project is open-sourced under the MIT License.

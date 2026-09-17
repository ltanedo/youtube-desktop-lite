# Windows ad blocker (test build 0.1.15)

`core/` is a reusable Rust library with no Tauri/WebView2 dependency, using
`adblock = 0.13.3` with the thread-safe engine configuration. `pake_adblock.rs`
is the Windows adapter; `ui.js` provides the Shield panel and Ctrl+Alt+B shortcut.

The app starts on about:blank, registers WebResourceRequested interception and
document-created scripts, then navigates to YouTube after script registration.
Filtering is enabled by default. Changing it persists a native setting, replaces
the document-created script, and reloads the page. Browser profiles are not cleared.
Profile identity stays **YouTube / com.pake.a1c202c**. Cookies and ultrawide settings
remain in the existing `%APPDATA%/YouTube` profile. Blocker files are in its
`pake-adblock` subdirectory. Login is still subject to Google's session expiry.

## Scope and limitations

- Requests originating from HTTPS youtube.com, www/m/music.youtube.com and
  youtube-nocookie.com/www.youtube-nocookie.com are checked; other origins and
  document navigations are allowed, including Google sign-in documents.
- Network type/method, Referer (or top document URL fallback), exceptions and
  base64 resource redirects are supported. Blocked requests receive 403.
  Newer WebView2 APIs include worker/frame sources; older runtimes use the legacy
  filter. Referrer-less nested-frame attribution is approximate. WebView2 may not
  expose cached/service-worker responses in the same way as ordinary requests.
- Main-world, document-start scriptlets and domain-specific CSS are applied.
  CSS also covers elements inserted by YouTube SPA navigation. Only procedural
  actions convertible to ordinary CSS are supported; there is no full uBO
  procedural DOM engine, generic-selector survey, response-body rewriting,
  CSP/header manipulation or Brave Shields parity. Resource injections operate
  in supported YouTube frames only.
- A maintained rule may be unsupported by adblock-rust or need a newer resource.
  Server-stitched ads are not guaranteed to be removed. Never infer success just
  from a session where no ad was served.
- Linux/macOS are not supported by this adapter. No Skip-button clicking loop.
- Stats contain counts, bundle fingerprint, runtime/version and a hashed rule ID;
  no request URLs, cookies, authorization headers or browsing history are logged.

## Filter bundles and recovery

Bundled snapshot: 2026-09-17. EasyList from easylist.to; combined uBlock filters
from the official uAssets `filters.min.txt` (includes already expanded), and
quick-fixes/unbreak from uAssets commit
`57a5c31d49185869078326a61449234e8f937886`.
The complete uBlock/Brave resource library is the engine project's test snapshot
at adblock-rust commit `1c0740d27d531a2389c808212a8702592bb74138`.
This is **not** the incomplete Brave-only `adblock-resources/dist` bundle.

The Shield panel's Update filters button fetches HTTPS upstream lists plus the
complete resource bundle. Updates are bounded by time/size, validate schema,
list names, preprocessor conditions, base64 resources and YouTube scriptlet output,
then atomically replace one combined cache file. They apply after restart so
network rules and early scripts use the same bundle. Failed downloads/validation
leave existing filters intact; an invalid cache falls back to the shipped snapshot.
No download is needed at startup. Upstream filter syntax/resource changes may
require an app update. Unknown preprocessor conditions and unresolved includes
fail validation.

## Build and test

From the project root on Windows with Node 22+, Rust 1.95 (tested), Visual Studio
C++ build tools and WebView2:

```powershell
npm ci --ignore-scripts
npm run build
$env:CARGO_TARGET_DIR = Join-Path (Get-Location) '.build-target'
npm test
```

`scripts/prepare.cjs` checks Pake 3.15.7, applies the existing native background/
startup patch and explicit anchor-checked blocker edits, copies the checked-in
adapter/core, and restores `runtime-Cargo.lock` and `runtime-package-lock.json`.
It is idempotent and fails on
unexpected source. Pake's CLI installs its own build-time npm tooling; the app
dependencies are pinned in the committed npm/Cargo lockfiles. The build is
source-reproducible, not a promise of bit-identical artifacts. No shared npm cache
is patched. `assets/youtube.ico` pins the existing icon.

Pake's upstream development tooling currently reports two npm audit findings
(`@rollup/plugin-terser` / `serialize-javascript`, moderate/high). They are not
embedded in the Rust executable. No forced major-version dependency upgrade was
applied as part of this player change; review them before future build-tool work.

Core tests cover block/allow/exception/redirect, origin scoping, conditional
filters, valid cache and corrupt-cache recovery. The Edge headless fixture serves
all content locally and checks document-start property traps, JSON pruning, CSS,
normal content and enabled/disabled behavior, including a restrictive Trusted
Types CSP like YouTube's (the settings UI uses no innerHTML). It uses a fresh isolated browser
context and never accesses the user's YouTube profile. These tests do not prove
live pre-roll/mid-roll removal or WebView2's live request interception.

Before publishing, manually verify signed-in/out videos, ads when served,
playlists/autoplay, seeking, live streams, captions, video navigation, restart
login, Shield toggle/update, fullscreen transitions and D-key fill. Record the
Shield counters, runtime/filter versions and actual ad behavior. Do not publish
or close issue #1 solely based on the deterministic tests.

## Licenses

Keep bundled list headers and `licenses/` with source distributions. See
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Adding the blocker does not
relicense third-party resources under this repository's MIT license.

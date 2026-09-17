# Local test build — 2026-09-17

App 0.1.15; Pake 3.15.7; adblock-rust 0.13.3; Windows x64.

- Release EXE and MSI build succeeded with the project-local patched runtime.
  One pre-existing unused-import warning in Pake navigation.rs remains.
- Four Rust tests passed: decision/exception/redirect fixtures, origin scope,
  preprocessor handling, valid/corrupt cache recovery.
- Edge headless enabled/disabled fixtures passed: scriptlets precede initial
  page code, JSON ads are pruned, CSS hides the ad fixture but not ordinary
  content, settings UI mounts, local preference persists on reload.
- Reproduced the initial settings-panel failure with Trusted Types enforcement;
  replaced innerHTML with DOM construction and passed that regression test.
- Final app launched from the root `YouTube.exe`. Accessibility inspection
  showed the signed-in home page and "Open ad blocker settings" control.
  An earlier test executable was closed before the final one launched.
- Native profile identity and incognito=false verified in generated config.
  All three existing YouTube injections and native startup patch are unchanged.
- Runtime Cargo.lock matches the checked-in lock; native adapter and injected
  UI hashes match their copied build inputs.
- Desktop capture/click geometry was unavailable (black capture, click error
  "coordinate input geometry is unavailable"). Live counters, visible first
  paint, toggle operation, fullscreen, captions, D-key fill and live playback
  still require user acceptance. No claim of proven pre-roll/mid-roll removal.
- These observations were recorded before release publication. They do not
  represent a completed live-ad acceptance matrix or issue closure.

Final SHA-256:

```text
YouTube.exe  7F274C76917E2A04E21C4F4E23479ED03DC4CD72304A6C03E4A410CA8016B50C
YouTube.msi  A025FAF9EBF18EF7C8ABB92A78384736F9806334CF503D96C107F77A25E5B7AC
```

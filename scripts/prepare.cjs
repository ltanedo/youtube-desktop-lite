// Reproducible, version/anchor-checked edits to the project-local Pake runtime.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const pake = path.join(root, 'node_modules/pake-cli');
if (JSON.parse(fs.readFileSync(path.join(pake, 'package.json'))).version !== '3.15.7') throw Error('Expected Pake 3.15.7');
const runtime = path.join(pake, 'src-tauri');
function replace(file, old, updated) {
  const p = path.join(runtime, file);
  const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (s.includes(updated)) return;
  if (s.split(old).length !== 2) throw Error(`Unexpected source anchor: ${file}: ${old}`);
  fs.writeFileSync(p, s.replace(old, updated));
}
const patchArgs = ['apply', '--directory=node_modules/pake-cli', '--whitespace=nowarn'];
try { execFileSync('git', [...patchArgs, '--reverse', '--check', 'pake-native-black-background.patch'], {stdio:'pipe'}); }
catch { execFileSync('git', [...patchArgs, '--check', 'pake-native-black-background.patch']); execFileSync('git', [...patchArgs, 'pake-native-black-background.patch']); }
replace('src/lib.rs', 'mod util;', 'mod util;\n#[cfg(target_os = "windows")]\nmod pake_adblock;');
replace('src/lib.rs', '            webview_navigate,', '            webview_navigate,\n            pake_adblock::blocker_status,\n            pake_adblock::blocker_set_enabled,\n            pake_adblock::blocker_update,');
replace('src/lib.rs', '            let window = set_window(app.app_handle(), &pake_config, &tauri_config)?;', '            #[cfg(target_os = "windows")]\n            pake_adblock::initialize(app.app_handle())?;\n            let window = set_window(app.app_handle(), &pake_config, &tauri_config)?;');
replace('src/app/window.rs', '    let user_agent = config.user_agent.get();', `    #[cfg(target_os = "windows")]
    let blocker_target = if label == "pake" && pake_blocker_core::is_youtube(&window_config.url) {
        Some(window_config.url.clone())
    } else { None };
    #[cfg(target_os = "windows")]
    let url = if blocker_target.is_some() {
        WebviewUrl::CustomProtocol(Url::parse("about:blank").unwrap())
    } else { url };

    let user_agent = config.user_agent.get();`);
replace('src/app/window.rs', '    let window = window_builder.build()?;', `    let window = window_builder.build()?;
    #[cfg(target_os = "windows")]
    if let Some(target) = blocker_target { crate::pake_adblock::install(&window, target)?; }`);
replace('Cargo.toml', 'webview2-com = "0.38"', 'webview2-com = "0.38"\npake-blocker-core = { path = "pake-adblock/core" }\nwindows = { version = "=0.61.3", features = ["Win32_System_Com", "Win32_UI_Shell"] }');
fs.copyFileSync('native/pake_adblock.rs', path.join(runtime, 'src/pake_adblock.rs'));
fs.mkdirSync(path.join(runtime, 'pake-adblock'), {recursive:true});
fs.copyFileSync('native/ui.js', path.join(runtime, 'pake-adblock/ui.js'));
fs.cpSync('native/core', path.join(runtime, 'pake-adblock/core'), {recursive:true, filter: p => !p.split(path.sep).includes('target')});
if (fs.existsSync('native/runtime-Cargo.lock')) fs.copyFileSync('native/runtime-Cargo.lock', path.join(runtime, 'Cargo.lock'));
if (fs.existsSync('native/runtime-package-lock.json')) fs.copyFileSync('native/runtime-package-lock.json', path.join(pake, 'package-lock.json'));
console.log('Prepared local Pake with retained startup fix and native ad blocker.');

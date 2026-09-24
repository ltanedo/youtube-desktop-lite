const { execFileSync } = require('node:child_process');
const path = require('node:path');
process.chdir(path.resolve(__dirname,'..'));
if (!['win32', 'darwin'].includes(process.platform)) {
  throw Error('YouTube Desktop currently supports Windows and macOS.');
}
execFileSync(process.execPath,['scripts/prepare.cjs'],{stdio:'inherit'});
const icon = process.platform === 'darwin' ? 'assets/youtube.icns' : 'assets/youtube.ico';
execFileSync(process.execPath,['node_modules/pake-cli/dist/cli.js',
 'https://www.youtube.com','--name','YouTube','--identifier','com.pake.a1c202c',
 '--icon',icon,'--inject','youtube-custom.css,youtube-reflow.js,youtube-fullscreen.js,youtube-scroll.js',
 '--width','1280','--height','800','--min-width','720','--min-height','480',
 '--maximize','--dark-mode','--app-version',require('../package.json').version,'--keep-binary'
],{stdio:'inherit'});

const { execFileSync } = require('node:child_process');
const path = require('node:path');
process.chdir(path.resolve(__dirname,'..'));
if (process.platform !== 'win32') throw Error('The ad-block adapter supports Windows only.');
execFileSync(process.execPath,['scripts/prepare.cjs'],{stdio:'inherit'});
execFileSync(process.execPath,['node_modules/pake-cli/dist/cli.js',
 'https://www.youtube.com','--name','YouTube','--identifier','com.pake.a1c202c',
 '--icon','assets/youtube.ico','--inject','youtube-custom.css,youtube-reflow.js,youtube-fullscreen.js',
 '--width','1280','--height','800','--min-width','720','--min-height','480',
 '--maximize','--dark-mode','--app-version',require('../package.json').version,'--keep-binary'
],{stdio:'inherit'});

#!/bin/bash
set -e

rm -rf node_modules compiled bundle dist
npm install --ignore-scripts

# Work around @lavamoat/allow-scripts bug: $root$: false doesn't
# prevent the root postinstall (electron-builder install-app-deps)
# from running, which fails on native module rebuilds.
node -e "
  const p = JSON.parse(require('fs').readFileSync('package.json','utf8'));
  delete p.scripts.postinstall;
  require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
npm run setup:scripts
git checkout package.json

node node_modules/electron/install.js

echo ""
echo "Done. Run 'npm run dev' to start Frame."

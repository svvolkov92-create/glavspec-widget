#!/usr/bin/env node
'use strict';
// The window's code is kept in parts by area (src/renderer/app/NN-name.js) and put together into
// src/renderer/app.js — the one file every window loads (Tauri, the web version, Electron).
// The parts share one scope, exactly as before the split: a part may use what another part declares.
// Order matters only for code that runs at load (top-level `const x = …`, listeners): parts go by their number.
//   node tools/build-app.js          — writes src/renderer/app.js
//   node tools/build-app.js --check  — fails if app.js is not built from the parts (edited by hand, or not rebuilt)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PARTS = path.join(ROOT, 'src', 'renderer', 'app');
const OUT = path.join(ROOT, 'src', 'renderer', 'app.js');

function build() {
  const names = fs.readdirSync(PARTS).filter(n => /^\d{2}-[a-z0-9-]+\.js$/.test(n)).sort();
  if (!names.length) throw new Error(`no parts in ${PARTS}`);
  const body = names.map(n => {
    // Windows checkouts may turn line ends into CRLF: the parts are joined with LF all the same.
    const text = fs.readFileSync(path.join(PARTS, n), 'utf8').replace(/\r\n/g, '\n');
    return text.endsWith('\n') ? text : text + '\n';
  }).join('');
  return `(() => {\n'use strict';\n// Built by tools/build-app.js from src/renderer/app/*.js — edit the parts, then run: node tools/build-app.js\n${body}})();\n`;
}

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    if (!isBuilt(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '')) { console.error('src/renderer/app.js is not built from src/renderer/app/*.js — run: node tools/build-app.js'); process.exit(1); }
    console.log('app.js is up to date');
  } else {
    fs.writeFileSync(OUT, text);
    console.log(`app.js: ${text.split('\n').length - 1} lines`);
  }
}
// The same text up to line ends (a Windows checkout has CRLF in app.js and in the parts).
function isBuilt(appJs) { return appJs.replace(/\r\n/g, '\n') === build(); }
module.exports = { build, isBuilt };

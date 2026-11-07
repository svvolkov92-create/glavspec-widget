'use strict';
// Copies the unchanged Electron interface (src/renderer) to build/tauri-ui and plugs in the Tauri bridge:
// tauri-api.js goes before the first script, and the page CSP lets the window talk to Tauri's IPC.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const from = path.join(root, 'src', 'renderer');
const to = path.join(root, 'build', 'tauri-ui');

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'tauri-api.js'), path.join(to, 'tauri-api.js'));

const file = path.join(to, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const firstScript = html.indexOf('<script src=');
const csp = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
if (firstScript < 0 || !csp.test(html)) throw new Error('index.html changed: no <script src=…> or CSP meta to patch');
html = html.slice(0, firstScript) + '<script src="tauri-api.js"></script>\n' + html.slice(firstScript);
html = html.replace(csp, (_m, a, c, b) => `${a}${c}; connect-src ipc: http://ipc.localhost${b}`);
fs.writeFileSync(file, html);
console.log('Interface prepared in', path.relative(root, to));

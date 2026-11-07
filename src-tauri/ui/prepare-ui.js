'use strict';
// Copies the unchanged Electron interface (src/renderer) to build/tauri-ui and plugs in the Tauri bridge:
// tauri-api.js goes before the first script, the shared core (src/core + tauri-core.js) before app.js,
// and the page CSP lets the window talk to Tauri's IPC.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const from = path.join(root, 'src', 'renderer');
const to = path.join(root, 'build', 'tauri-ui');

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'tauri-api.js'), path.join(to, 'tauri-api.js'));
fs.copyFileSync(path.join(__dirname, 'tauri-core.js'), path.join(to, 'tauri-core.js'));
// The shared rules of the Electron main process (src/core), loaded after logic.js / access.js / composition.js.
const CORE = ['store-core.js', 'journal-diff.js', 'handlers.js', 'chats.js', 'files.js', 'cabinet-rules.js'];
fs.mkdirSync(path.join(to, 'core'));
for (const f of CORE) fs.copyFileSync(path.join(root, 'src', 'core', f), path.join(to, 'core', f));

// The shared report and import code (CommonJS, written for Node) for the window: a small module loader with
// browser stand-ins for node:zlib (pako), node:path and node:fs; Buffer comes from shims/buffer.js.
const NODE_MODULES = ['report/model.js', 'report/xlsx.js', 'report/docx.js', 'report/customer.js', 'report/doc-template.js', 'report/zip.js',
  'import/read.js', 'contact.js', 'cabinet.js', 'renderer/logic.js', 'renderer/access.js', 'renderer/composition.js', 'renderer/calendar.js'];
const SHIMS = {
  'node:zlib': `module.exports = {
    deflateRawSync: (buf, o) => Buffer.from(window.pako.deflateRaw(buf, { level: (o && o.level) || 6 })),
    inflateRawSync: buf => Buffer.from(window.pako.inflateRaw(buf)),
  };`,
  'node:path': `const norm = p => String(p).replace(/\\\\/g, '/');
  module.exports = {
    sep: '\\\\',
    join: (...p) => p.filter(Boolean).join('\\\\').replace(/[\\\\/]+/g, '\\\\'),
    basename: p => norm(p).split('/').pop(),
    dirname: p => { const s = norm(p); const i = s.lastIndexOf('/'); return i < 0 ? '.' : String(p).slice(0, i); },
    extname: p => { const b = norm(p).split('/').pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
  };`,
  // Only createHash('sha1') — the cabinet client's fingerprint of a published project.
  'node:crypto': `function sha1(bytes) {
    const ml = bytes.length, words = new Uint32Array((((ml + 8) >> 6) + 1) * 16);
    for (let i = 0; i < ml; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[ml >> 2] |= 0x80 << (24 - (ml % 4) * 8);
    words[words.length - 1] = ml * 8;
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);
    for (let i = 0; i < words.length; i += 16) {
      for (let t = 0; t < 80; t++) w[t] = t < 16 ? words[i + t] : ((x => (x << 1) | (x >>> 31))(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]));
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let t = 0; t < 80; t++) {
        const f = t < 20 ? (b & c) | (~b & d) : t < 40 ? b ^ c ^ d : t < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
        const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) >>> 0;
        e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return [h0, h1, h2, h3, h4].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  module.exports = { createHash: algo => { if (algo !== 'sha1') throw new Error('только sha1'); let data = ''; const h = { update: s => { data += s; return h; }, digest: () => sha1(new TextEncoder().encode(data)) }; return h; } };`,
  'node:fs': `const no = () => { throw new Error('В окне Tauri файлы читает и пишет ядро программы.'); };
  module.exports = { readFileSync: no, writeFileSync: no, existsSync: () => false, statSync: no };`,
};
const resolveId = (from, spec) => {
  if (SHIMS[spec]) return spec;
  const parts = path.posix.join(path.posix.dirname(from), spec).split('/');
  const id = parts.join('/');
  return id.endsWith('.js') ? id : id + '.js';
};
const defs = [
  ...Object.entries(SHIMS).map(([id, code]) => `define(${JSON.stringify(id)}, function (module, exports, require) {\n${code}\n});`),
  ...NODE_MODULES.map(id => {
    const code = fs.readFileSync(path.join(root, 'src', id), 'utf8');
    for (const m of code.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const dep = resolveId(id, m[2]);
      if (!SHIMS[dep] && !NODE_MODULES.includes(dep)) throw new Error(`${id}: ${m[2]} is not bundled for the Tauri window`);
    }
    return `define(${JSON.stringify(id)}, function (module, exports, require) {\nconst __dirname = '';\n${code}\n});`;
  }),
];
fs.writeFileSync(path.join(to, 'node-modules.js'), `'use strict';
// Generated by src-tauri/ui/prepare-ui.js from src/report, src/import and friends — do not edit.
(function () {
  const defs = {}, cache = {};
  function define(id, fn) { defs[id] = fn; }
  const resolveId = ${resolveId.toString().replace('SHIMS[spec]', 'defs[spec] && /^node:/.test(spec)').replace(/path\.posix\./g, 'posix.')};
  const posix = {
    dirname: p => { const i = p.lastIndexOf('/'); return i < 0 ? '.' : p.slice(0, i); },
    join: (a, b) => { const out = []; for (const seg of (a + '/' + b).split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); } return out.join('/'); },
  };
  function load(id) {
    if (cache[id]) return cache[id].exports;
    if (!defs[id]) throw new Error('Модуль не найден: ' + id);
    const module = { exports: {} };
    cache[id] = module;
    defs[id](module, module.exports, spec => load(resolveId(id, spec)));
    return module.exports;
  }
${defs.join('\n')}
  window.NodeModules = { load };
})();
`);
// Built-in files the shared code asks for (io.asset): the office's Word templates; brand and fonts are in the interface already.
fs.cpSync(path.join(root, 'src', 'report', 'templates'), path.join(to, 'templates'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'vendor', 'pako-1.0.11.min.js'), path.join(to, 'pako.min.js'));
fs.copyFileSync(path.join(__dirname, 'shims', 'buffer.js'), path.join(to, 'buffer.js'));

const file = path.join(to, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const firstScript = html.indexOf('<script src=');
const csp = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
if (firstScript < 0 || !csp.test(html)) throw new Error('index.html changed: no <script src=…> or CSP meta to patch');
html = html.slice(0, firstScript) + '<script src="tauri-api.js"></script>\n' + html.slice(firstScript);
const appScript = html.indexOf('<script src="app.js">');
if (appScript < 0) throw new Error('index.html changed: no <script src="app.js">');
html = html.slice(0, appScript) + CORE.map(f => `<script src="core/${f}"></script>\n`).join('')
  + '<script src="buffer.js"></script>\n<script src="pako.min.js"></script>\n<script src="node-modules.js"></script>\n<script src="tauri-core.js"></script>\n' + html.slice(appScript);
html = html.replace(csp, (_m, a, c, b) => `${a}${c}; connect-src 'self' ipc: http://ipc.localhost${b}`);
fs.writeFileSync(file, html);
console.log('Interface prepared in', path.relative(root, to));

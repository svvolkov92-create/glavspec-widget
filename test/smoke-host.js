'use strict';
// Runs one smoke (test/smoke-*.js) against the Tauri window in Chromium — the Electron version is gone (4.8).
//   node test/smoke-host.js <smoke.js> <outDir>      env GLAVSPEC_TEST_APPDATA=<empty profile folder>
// The smokes were written for Electron: they `require('electron')` and end with `require('../src/main.js')`. Here
// `electron` is a stand-in (app, dialog, shell, Notification, screen, BrowserWindow) and «main.js» opens the window
// of the Tauri build (build/tauri-ui, see src-tauri/ui/prepare-ui.js) with the same Rust commands as in Пульт 4.x,
// done in Node over the profile folder: data.json, settings.json and journal.jsonl in <profile>/GlavspecWidget —
// the files the smokes read and prepare.
const Module = require('node:module');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const [smokeFile, outDir] = process.argv.slice(2);
const profile = process.env.GLAVSPEC_TEST_APPDATA;
if (!smokeFile || !outDir || !profile) throw new Error('usage: GLAVSPEC_TEST_APPDATA=<dir> node test/smoke-host.js <smoke.js> <outDir>');
const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'build', 'tauri-ui');
const dataDir = path.join(profile, 'GlavspecWidget');
const docsDir = path.join(profile, 'Documents');
fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

/* ---------- the stand-in for `electron` ---------- */
const app = new EventEmitter();
let finishing = null;
Object.assign(app, {
  getPath: k => ({ appData: profile, userData: dataDir, documents: docsDir, home: profile, temp: os.tmpdir(), downloads: docsDir }[k] || os.tmpdir()),
  setPath() {}, whenReady: () => Promise.resolve(), isPackaged: false, getVersion: () => '4.8.0',
  exit: code => finish(code ?? 0), quit: () => finish(0),
});
class Notification extends EventEmitter {
  constructor(o = {}) { super(); this.title = o.title; this.body = o.body; }
  static isSupported() { return true; }
  show() {}
}
const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 };
let browser = null;
// A second window of the smoke's own (v37 takes pictures of the customer page with scripts off).
class BrowserWindow {
  constructor(o = {}) {
    this.ready = browser.newContext({ viewport: { width: o.width || 1280, height: o.height || 800 }, javaScriptEnabled: o.webPreferences?.javascript !== false }).then(c => c.newPage());
    this.webContents = { capturePage: async () => { const b = await (await this.ready).screenshot(); return { toPNG: () => b }; }, executeJavaScript: async code => (await this.ready).evaluate(code) };
  }
  async loadFile(f, o = {}) { await (await this.ready).goto('file://' + path.resolve(f) + (o.hash ? '#' + o.hash : '')); }
  async loadURL(u) { await (await this.ready).goto(u); }
  destroy() { this.ready.then(p => p.context().close()).catch(() => {}); }
  close() { this.destroy(); }
}
const electron = {
  app, Notification, BrowserWindow,
  dialog: { showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => ({ response: 0 }) },
  shell: { openPath: async () => '', openExternal: async () => {} },
  screen: { getDisplayMatching: () => display, getPrimaryDisplay: () => display, getAllDisplays: () => [display] },
};

/* ---------- the Rust commands, over the profile folder ---------- */
// The window builds Windows paths (C:\\…\\file): off Windows, back to «/».
const P = p => (process.platform === 'win32' || p == null ? p : String(p).replace(/\\/g, '/'));
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const sysCalls = [];
let cab = null;
async function rust(cmd, a) {
  const dataFile = path.join(dataDir, 'data.json'), settingsFile = path.join(dataDir, 'settings.json'), journalFile = path.join(dataDir, 'journal.jsonl');
  switch (cmd) {
    case 'store_load': return { data: readJson(dataFile, null), warning: null, dir: dataDir };
    case 'store_save': {
      // As files.rs: a copy of the file before the first change of the day (backups/data-<day>.json).
      const copy = path.join(dataDir, 'backups', `data-${a.day}.json`);
      if (a.day && fs.existsSync(dataFile) && !fs.existsSync(copy)) fs.copyFileSync(dataFile, copy);
      fs.writeFileSync(dataFile, JSON.stringify(a.data, null, 1)); return null;
    }
    case 'settings_load': return readJson(settingsFile, {});
    case 'settings_save': fs.writeFileSync(settingsFile, JSON.stringify(a.values, null, 1)); return null;
    case 'journal_append': fs.appendFileSync(journalFile, a.lines.map(l => JSON.stringify(l) + '\n').join('')); return null;
    case 'journal_read': {
      const all = fs.existsSync(journalFile) ? fs.readFileSync(journalFile, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
      return all.reverse().filter(e => !a.since || e.ts >= a.since).slice(0, a.limit || 3000);
    }
    case 'known_dirs': return { documents: docsDir, userData: dataDir };
    case 'dialog_save': { const r = await electron.dialog.showSaveDialog(null, { title: a.title, defaultPath: P(a.defaultPath) || '', filters: a.filters }); return r?.canceled ? null : r?.filePath || null; }
    case 'dialog_open': { const r = await electron.dialog.showOpenDialog(null, { title: a.title, defaultPath: P(a.defaultPath) || '', filters: a.filters, properties: [a.directory ? 'openDirectory' : 'openFile'] }); return r?.canceled ? null : r?.filePaths?.[0] || null; }
    case 'dialog_confirm': { const r = await electron.dialog.showMessageBox(null, { title: a.title, message: a.message, detail: a.detail, buttons: [a.ok, 'Отмена'] }); return r?.response === 0; }
    case 'fs_write': fs.mkdirSync(path.dirname(P(a.path)), { recursive: true }); fs.writeFileSync(P(a.path), a.text != null ? Buffer.from(a.text, 'utf8') : Buffer.from(a.base64, 'base64')); return null;
    case 'fs_read': return fs.readFileSync(P(a.path)).toString('base64');
    case 'fs_exists': return !!a.path && fs.existsSync(P(a.path));
    case 'fs_mkdir': fs.mkdirSync(P(a.path), { recursive: true }); return null;
    case 'fs_list': return fs.existsSync(P(a.path)) ? fs.readdirSync(P(a.path)) : [];
    case 'fs_remove': fs.rmSync(P(a.path), { recursive: true, force: true }); return null;
    case 'open_path': return (await electron.shell.openPath(P(a.path))) || '';
    case 'open_url': await electron.shell.openExternal(a.url); return null;
    case 'open_data_folder': await electron.shell.openPath(dataDir); return null;
    case 'print_html': {
      const f = path.join(dataDir, 'print', `страница-${Date.now()}.html`);
      fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, a.html);
      await electron.shell.openPath(f); return null;
    }
    case 'notify': new electron.Notification({ title: a.title, body: a.body }).show(); return true;
    case 'notify_actions': new electron.Notification({ title: a.title, body: a.body }).show(); return true;
    case 'http_request': {
      const r = await fetch(a.url, { method: a.method, headers: a.headers, body: a.body ?? undefined }); return { status: r.status, body: await r.text() }; }
    case 'secret_protect': return Buffer.from('X' + a.text).toString('base64');
    case 'secret_unprotect': return Buffer.from(a.data, 'base64').toString().slice(1);
    case 'cabinet_local_start': {
      if (!cab) {
        const { createServer } = require(path.join(ROOT, 'server', 'cabinet-server.js'));
        const cdir = path.join(dataDir, 'cabinet-server');
        cab = createServer({ dataDir: cdir, port: 0, host: '127.0.0.1', configFile: path.join(cdir, 'none.json') });
        await new Promise(r => cab.server.listen(0, '127.0.0.1', r));
      }
      return { port: cab.server.address().port, lan: [], teamKey: cab.teamKey() };
    }
    case 'cabinet_local_stop': return null;
    case 'cabinet_local_running': return !!cab;
    case 'desktop_supported': return true;
    case 'autostart_get': return false;
    case 'autostart_set': return a.on;
    case 'tray_set': case 'window_to_bottom': case 'app_quit': case 'snap_layouts': case 'update_run': sysCalls.push(cmd); return null;
    case 'app_icon': return a.variant ?? 1;
    default: throw new Error('unknown command ' + cmd);
  }
}

/* ---------- «main.js»: the window ---------- */
let server = null;
async function start() {
  if (!fs.existsSync(path.join(UI, 'index.html'))) throw new Error('build/tauri-ui is missing — run: node src-tauri/ui/prepare-ui.js');
  server = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(UI, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(d);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 }, acceptDownloads: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' });
  await ctx.exposeBinding('__rust', (_s, cmd, args) => rust(cmd, args || {}));
  // Events between windows: every page of the context gets every event; new windows are not opened here.
  await ctx.exposeBinding('__bus', (_s, name, payload) => {
    if (name === '__open' || name === '__close') return;
    for (const pg of ctx.pages()) pg.evaluate(([n, x]) => window.__emit?.(n, x), [name, payload]).catch(() => {});
  });
  await ctx.addInitScript(require(path.join(ROOT, 'src-tauri', 'ui', 'stub-window.js')));
  // 4.3: the role introduction would open over every smoke (fresh profile) and take Esc; smokes test the screens.
  await ctx.addInitScript(() => { try { localStorage.setItem('glavspec.tourOff', 'true'); } catch { /* none */ } });
  const page = await ctx.newPage();
  const consoleCbs = [], loadCbs = [];
  page.on('console', m => { const level = { error: 3, warning: 2 }[m.type()] ?? 1; for (const f of consoleCbs) f({}, level, m.text(), m.location()?.lineNumber || 0, m.location()?.url || ''); });
  page.on('pageerror', e => { for (const f of consoleCbs) f({}, 3, 'Uncaught ' + e.message, 0, 'page'); });
  const win = {
    webContents: {
      on: (ev, f) => { if (ev === 'console-message') consoleCbs.push(f); else if (ev === 'did-finish-load') loadCbs.push(f); },
      once: (ev, f) => { if (ev === 'did-finish-load') loadCbs.push(f); else if (ev === 'console-message') consoleCbs.push(f); },
      executeJavaScript: code => page.evaluate(code),
      // Tauri keeps the zoom in settings.json (the webview's own zoom is set from it).
      getZoomFactor: () => readJson(path.join(dataDir, 'settings.json'), {}).zoom || 1,
      getURL: () => page.url(),
      capturePage: async () => { const b = await page.screenshot(); return { toPNG: () => b }; },
      send() {}, isDestroyed: () => false,
      // 4.21: a CPU profile of `code` run in the page (test/perf-big.js): the functions by own time.
      profile: async code => {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
        await page.evaluate(code);
        const { profile } = await cdp.send('Profiler.stop');
        const dt = profile.timeDeltas || [], self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
        (profile.samples || []).forEach((id, i) => { const f = byId.get(id).callFrame, k = `${f.functionName || '(anon)'} ${String(f.url).split('/').pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
        return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, ms]) => `${ms.toFixed(1).padStart(8)} ms  ${k}`);
      },
    },
    setSize: (w, h) => { page.setViewportSize({ width: w, height: h }).catch(() => {}); },
    getBounds: () => win._bounds || { x: 0, y: 0, width: 1320, height: 860 },
    isAlwaysOnTop: () => !!win._top, isVisible: () => true, getTitle: () => 'Пульт главспеца', isDestroyed: () => false,
    show() {}, focus() {}, close: () => finish(0),
  };
  // getBounds / isAlwaysOnTop are answered from the stand-in window the page talks to (kept fresh every 100 ms).
  const sync = setInterval(() => page.evaluate(() => window.__win && { x: window.__win.x, y: window.__win.y, width: window.__win.width, height: window.__win.height, top: window.__win.top }).then(w => { if (w) { win._bounds = { x: w.x, y: w.y, width: w.width, height: w.height }; win._top = w.top; } }).catch(() => {}), 100);
  sync.unref();
  app.emit('browser-window-created', {}, win);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for (const f of loadCbs.splice(0)) f();
}

async function finish(code) {
  if (finishing) return finishing;
  finishing = (async () => {
    try { cab?.store?.flush?.(); cab?.server?.closeAllConnections?.(); cab?.server?.close(); } catch { /* closing */ }
    try { await browser?.close(); } catch { /* closing */ }
    try { server?.close(); } catch { /* closing */ }
    process.exit(code);
  })();
  return finishing;
}

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electron;
  if (/(^|[\\/])src[\\/]main\.js$/.test(request)) { start().catch(e => { fs.writeFileSync(path.join(outDir, 'log.txt'), '[smoke error] ' + (e.stack || e)); finish(1); }); return {}; }
  return load.apply(this, arguments);
};
process.on('unhandledRejection', e => { fs.appendFileSync(path.join(outDir, 'host-errors.txt'), String(e?.stack || e) + '\n'); });
require(path.resolve(smokeFile));

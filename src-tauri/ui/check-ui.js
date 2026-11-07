// Checks the Tauri window (build/tauri-ui) in Chromium with an in-memory stand-in for the Rust file commands.
// Usage: node src-tauri/ui/prepare-ui.js && node src-tauri/ui/check-ui.js   (needs the playwright package)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve('build/tauri-ui');
const srv = http.createServer((q, res) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(d); }); }).listen(8766);
const disk = { data: null, settings: {}, journal: [], version: 0, seen: 0, saves: 0 };
const log = []; const check = (n, ok, x = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.exposeBinding('__rust', async (_s, cmd, args) => {
    switch (cmd) {
      case 'store_load': disk.seen = disk.version; return { data: disk.data, warning: null, dir: 'C:\\\\AppData\\\\GlavspecWidget-tauri', copiedFrom: null };
      case 'store_save': if (disk.seen !== disk.version) throw 'conflict'; disk.data = JSON.parse(JSON.stringify(args.data)); disk.version++; disk.seen = disk.version; disk.saves++; return null;
      case 'settings_load': return disk.settings;
      case 'settings_save': disk.settings = JSON.parse(JSON.stringify(args.values)); return null;
      case 'journal_append': disk.journal.push(...args.lines); return null;
      case 'journal_read': return [...disk.journal].reverse().filter(e => !args.since || e.ts >= args.since);
      default: throw 'unknown command ' + cmd;
    }
  });
  await ctx.addInitScript(() => {
    const win = { isMaximized: async () => false, onResized: () => {}, minimize: async () => {}, maximize: async () => {}, unmaximize: async () => {}, setSize: async () => {}, startDragging: async () => {},
      setAlwaysOnTop: async () => {}, setTheme: async () => {}, setIgnoreCursorEvents: async () => {}, outerPosition: async () => ({ x: 0, y: 0 }), scaleFactor: async () => 1 };
    window.__TAURI__ = { core: { invoke: (c, a) => window.__rust(c, a || {}) }, event: { listen: async () => {} },
      window: { getCurrentWindow: () => win, LogicalSize: function () {}, cursorPosition: async () => ({ x: 0, y: 0 }) }, webview: { getCurrentWebview: () => ({ setZoom: async () => {} }) } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const js = (f, a) => p.evaluate(f, a);
  await p.goto('http://127.0.0.1:8766/'); await wait(1200);
  check('first start: GIP and chief created and saved', disk.data && Object.keys(disk.data.users).length === 2 && disk.settings.userId === 'u-chief', JSON.stringify(disk.settings.userId));
  await js(() => window.api.switchUser('u-gip')); await wait(300);
  check('user switch saved', disk.settings.userId === 'u-gip');
  await p.click('[data-act="seed-demo"]'); await wait(1200);
  check('samples written to disk', Object.keys(disk.data.tasks).length >= 5 && Object.keys(disk.data.projects).length >= 2, `${Object.keys(disk.data.tasks).length} tasks`);
  check('journal written', disk.journal.length >= 5 && disk.journal[0].action === 'Примеры добавлены', disk.journal.length + ' ' + disk.journal[0]?.action);
  const tid = Object.keys(disk.data.tasks)[0];
  const r1 = await js(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { readiness: 55 } }], { action: 'Готовность' }), tid);
  check('checked write ok and saved', r1.ok && disk.data.tasks[tid].readiness === 55 && !!disk.data.tasks[tid].updatedAt, JSON.stringify(r1));
  const rc = await js(id => window.api.addComment(id, 'Проверка комментария'), tid);
  check('comment saved', rc.ok && disk.data.tasks[tid].comments.some(c => c.text === 'Проверка комментария'));
  await js(() => window.api.setTheme('tandem')); await js(() => window.api.setZoom(1.1)); await js(() => window.api.setOpacity(0.7)); await wait(200);
  check('window settings saved', disk.settings.theme === 'tandem' && disk.settings.zoom === 1.1 && disk.settings.opacity === 0.7, JSON.stringify(disk.settings));
  // A specialist may not change someone else's card: the rule comes from the shared core.
  const spec = Object.entries(disk.data.users).find(([, u]) => u.role === 'specialist')?.[0];
  if (spec) {
    await js(id => window.api.switchUser(id), spec); await wait(300);
    const other = Object.entries(disk.data.tasks).find(([, t]) => t.ownerId !== spec)?.[0];
    const r2 = await js(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { budget: 1 } }], {}), other);
    check('rights checked (specialist, other card)', !r2.ok, JSON.stringify(r2));
    await js(() => window.api.switchUser('u-gip')); await wait(300);
  }
  const j = await js(() => window.api.getJournal(''));
  check('journal read back', Array.isArray(j) && j.length >= 6, String(j?.length));
  // Another program wrote the file: the write is refused with a clear message, fresh data is shown.
  disk.data.tasks[tid].readiness = 10; disk.version++;
  const r3 = await js(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { readiness: 90 } }], {}), tid);
  await wait(300);
  check('conflict reported', !r3.ok && /изменились/.test(r3.message), JSON.stringify(r3));
  check('fresh data shown after conflict', await js(id => window.AppBridge.state.tasks.get(id)?.readiness, tid) === 10);
  const r4 = await js(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { readiness: 90 } }], {}), tid);
  check('next write ok', r4.ok && disk.data.tasks[tid].readiness === 90);
  // Reload: everything comes back from disk.
  await p.reload(); await wait(1200);
  check('after restart: same user, data, theme', await js(() => window.AppBridge.state.me?.id) === 'u-gip' && await js(() => document.documentElement.dataset.theme) === 'tandem' && await js(id => window.AppBridge.state.tasks.get(id)?.readiness, tid) === 90);
  const r5 = await js(() => window.api.chatSend('x', 'y'));
  check('not moved yet → clear message', !r5.ok && /следующем этапе/.test(r5.message));
  await p.screenshot({ path: require('os').tmpdir() + '/tauri-ui-check.png' });
  check('no page errors', errs.length === 0, errs.join(' | '));
  console.log(log.join('\n')); process.exitCode = log.some(l => l.startsWith('FAIL')) ? 1 : 0;
  await b.close(); srv.close();
})();

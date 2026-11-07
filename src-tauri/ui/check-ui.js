// Checks the Tauri window (build/tauri-ui) in Chromium with an in-memory stand-in for the Rust file commands.
// Usage: node src-tauri/ui/prepare-ui.js && node src-tauri/ui/check-ui.js   (needs the playwright package)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve('build/tauri-ui');
const srv = http.createServer((q, res) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(d); }); }).listen(8766);
const disk = { data: null, settings: { fullBounds: { x: 200, y: 100, width: 1200, height: 800 } }, journal: [], version: 0, seen: 0, saves: 0 };
const sysCalls = [];
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
      case 'desktop_supported': return true;
      case 'autostart_get': return false;
      case 'autostart_set': sysCalls.push('autostart:' + args.on); return args.on;
      case 'tray_set': disk.tray = args; return null;
      case 'notify': sysCalls.push('notify:' + args.body); return true;
      case 'window_to_bottom': sysCalls.push('bottom'); return true;
      case 'open_data_folder': sysCalls.push('folder'); return null;
      case 'app_quit': sysCalls.push('quit'); return null;
      default: throw 'unknown command ' + cmd;
    }
  });
  await ctx.addInitScript(() => {
    // A stand-in window that remembers its place and what was asked of it.
    const w = window.__win = { x: 0, y: 0, width: 1320, height: 860, visible: false, top: null, skip: null, min: null, calls: [] };
    const listeners = {};
    const win = { isMaximized: async () => false, isMinimized: async () => false, isVisible: async () => w.visible, onResized: () => {}, onMoved: () => {}, onFocusChanged: () => {},
      minimize: async () => {}, maximize: async () => {}, unmaximize: async () => {}, startDragging: async () => {},
      setSize: async s => { w.width = s.width; w.height = s.height; }, setPosition: async p => { w.x = p.x; w.y = p.y; }, setMinSize: async s => { w.min = s; },
      outerPosition: async () => ({ x: w.x, y: w.y }), outerSize: async () => ({ width: w.width, height: w.height }), scaleFactor: async () => 1,
      show: async () => { w.visible = true; w.calls.push('show'); }, hide: async () => { w.visible = false; w.calls.push('hide'); },
      setAlwaysOnTop: async on => { w.top = on; }, setSkipTaskbar: async on => { w.skip = on; }, setTheme: async () => {}, setIgnoreCursorEvents: async () => {} };
    function Size(width, height) { this.width = width; this.height = height; }
    function Pos(x, y) { this.x = x; this.y = y; }
    window.__emit = (name, payload) => (listeners[name] || []).forEach(f => f({ payload }));
    window.__TAURI__ = { core: { invoke: (c, a) => window.__rust(c, a || {}) }, event: { listen: async (n, f) => { (listeners[n] ||= []).push(f); } },
      dpi: { LogicalSize: Size, LogicalPosition: Pos },
      window: { getCurrentWindow: () => win, availableMonitors: async () => [{ position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, scaleFactor: 1 }], cursorPosition: async () => ({ x: 0, y: 0 }) },
      webview: { getCurrentWebview: () => ({ setZoom: async () => {} }) } };
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
  // Messenger: shared rules from src/core/chats.js.
  check('sample chats written', Object.keys(disk.data.chats || {}).length === 3, Object.keys(disk.data.chats || {}).join());
  await p.click('[data-act="msg-open"]'); await wait(300);
  const chatId = await js(() => [...document.querySelectorAll('[data-act="msg-chat"]')].map(b => b.dataset.id).find(id => !/^[tc]:/.test(id)));
  await p.click(`[data-act="msg-chat"][data-id="${chatId}"]`); await wait(300);
  await p.fill('#msg-text', 'Проверка @все'); await p.press('#msg-text', 'Enter'); await wait(600);
  const sent = disk.data.chats[chatId].messages.at(-1);
  check('chat message saved with mentions, field empty', sent.text === 'Проверка @все' && sent.mentions.length >= 1 && (await js(() => document.querySelector('#msg-text').value)) === '', JSON.stringify(sent));
  await p.click(`[data-act="mc-edit"][data-id="${sent.id}"]`); await wait(200);
  await p.fill('#mc-edit', 'Проверка'); await p.press('#mc-edit', 'Enter'); await wait(600);
  const ed = disk.data.chats[chatId].messages.at(-1);
  check('chat message corrected', ed.text === 'Проверка' && !!ed.editedAt && ed.mentions.length === 0, JSON.stringify(ed));
  const g = await js(async () => window.api.chatCreate({ title: 'Проба Tauri', members: [] }));
  check('group chat needs members', !g.ok, JSON.stringify(g));
  const g2 = await js(async () => window.api.chatCreate({ title: 'Проба Tauri', members: ['demo-u1'] }));
  check('group chat created', g2.ok && disk.data.chats[g2.id]?.title === 'Проба Tauri', JSON.stringify(g2));
  await p.click('[data-act="msg-close"]').catch(() => {}); await wait(200);
  // «Запросить у заказчика» (ИРД): an ordinary checked write of the project.
  await js(() => { const pid = [...window.AppBridge.state.projects.keys()][0]; document.body.insertAdjacentHTML('beforeend', `<button id="aq-open" data-act="ask-customer" data-id="${pid}"></button>`); });
  await p.click('#aq-open'); await wait(300);
  await p.fill('#aq-title', 'ТУ на водоснабжение'); await js(() => document.querySelector('.modal form, form.modal').requestSubmit()); await wait(700);
  const pid = await js(() => [...window.AppBridge.state.projects.keys()][0]);
  const pr = disk.data.projects[pid];
  check('ИРД request saved (request + ИРД row)', (pr.requests || []).some(r => /ТУ на водоснабжение/.test(r.title)) && (pr.ird || []).some(r => /ТУ на водоснабжение/.test(r.title)), JSON.stringify({ req: pr.requests, ird: pr.ird }).slice(0, 300));
  const r5 = await js(() => window.api.exportReport('xlsx', 'all'));
  check('not moved yet → clear message', !r5.ok && /следующем этапе/.test(r5.message));
  // System: the window starts hidden and is shown at its saved place; the tray menu; compact; levels; hide.
  const w0 = await js(() => window.__win);
  check('window shown at its saved place', w0.visible && w0.calls.includes('show') && w0.x === 200 && w0.width === 1200, JSON.stringify(w0));
  check('tray menu sent', Array.isArray(disk.tray?.items) && disk.tray.items.some(i => i.id === 'quit') && /Пульт главспеца/.test(disk.tray.tooltip), JSON.stringify(disk.tray?.items?.map(i => i.id)));
  await js(() => window.__emit('tray:action', 'compact')); await wait(500);
  const w1 = await js(() => window.__win);
  check('tray: compact mode — small window, own min size, full bounds kept', disk.settings.compact === true && w1.width === 360 && w1.min.width === 280 && disk.settings.fullBounds.width === 1200, JSON.stringify({ w1, c: disk.settings.compact }));
  check('interface in compact mode', await js(() => window.AppBridge.state.win.compact === true));
  await js(() => window.__emit('tray:action', 'compact')); await wait(500);
  check('back to the full window at its place', (await js(() => window.__win.width)) === 1200 && disk.settings.compact === false);
  await js(() => window.api.setLevel('desktop')); await wait(300);
  check('«на рабочем столе»: not on top, no taskbar button, sent under the windows', (await js(() => window.__win.top)) === false && (await js(() => window.__win.skip)) === true && sysCalls.includes('bottom') && disk.settings.windowLevel === 'desktop');
  await js(() => window.api.setLevel('top')); await wait(300);
  check('back on top', (await js(() => window.__win.top)) === true && (await js(() => window.__win.skip)) === false);
  await js(() => window.__emit('tray:action', 'autostart')); await wait(800);
  check('tray: start with Windows', sysCalls.includes('autostart:true') && disk.tray.items.find(i => i.id === 'autostart').checked === true);
  await js(() => window.__emit('tray:action', 'digest-now')); await wait(300);
  check('tray: digest now → notification', sysCalls.some(c => c.startsWith('notify:')));
  await js(() => window.api.hide()); await wait(100);
  check('hide → hidden (back via the tray)', (await js(() => window.__win.visible)) === false);
  await js(() => window.__emit('tray:action', 'quit')); await wait(100);
  check('tray: quit', sysCalls.includes('quit'));
  await p.screenshot({ path: require('os').tmpdir() + '/tauri-ui-check.png' });
  check('no page errors', errs.length === 0, errs.join(' | '));
  console.log(log.join('\n')); process.exitCode = log.some(l => l.startsWith('FAIL')) ? 1 : 0;
  await b.close(); srv.close();
})();

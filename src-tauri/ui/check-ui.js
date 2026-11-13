// Checks the Tauri window (build/tauri-ui) in Chromium with an in-memory stand-in for the Rust file commands.
// Usage: node src-tauri/ui/prepare-ui.js && node src-tauri/ui/check-ui.js   (needs the playwright package)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve('build/tauri-ui');
const srv = http.createServer((q, res) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' }); res.end(d); }); }).listen(8766);
const disk = { data: null, settings: { fullBounds: { x: 200, y: 100, width: 1200, height: 800 } }, journal: [], version: 0, seen: 0, saves: 0 };
const sysCalls = [];
const fsMem = {}; // path → Buffer (stand-in for the disk behind the Rust file commands)
const dialogs = []; let nextPath = null, confirmAnswer = true;
// A real cabinet server for the cabinet part (the window reaches it through the http_request stand-in).
const { createServer } = require(require('path').resolve('server/cabinet-server.js'));
const cabDir = fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'tauri-cab-'));
let cab = null, localCab = null;
const log = []; const check = (n, ok, x = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  // Tauri events between windows: every page of the context gets every event; window opening is queued for the test.
  const opened = [], closed = [];
  await ctx.exposeBinding('__bus', (_s, name, payload) => {
    if (name === '__open') { opened.push(payload); return; }
    if (name === '__close') { closed.push(payload); return; }
    for (const pg of ctx.pages()) pg.evaluate(([n, x]) => window.__emit?.(n, x), [name, payload]).catch(() => {});
  });
  await ctx.exposeBinding('__rust', async (_s, cmd, args) => {
    switch (cmd) {
      case 'store_load': disk.seen = disk.version; return { data: disk.data, warning: null, dir: 'C:\\\\AppData\\\\GlavspecWidget' };
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
      case 'known_dirs': return { documents: 'C:\\Users\\gip\\Documents', userData: 'C:\\Users\\gip\\AppData\\Roaming\\GlavspecWidget' };
      case 'dialog_save': case 'dialog_open': dialogs.push({ cmd, ...args }); return nextPath;
      case 'dialog_confirm': dialogs.push({ cmd, ...args }); return confirmAnswer;
      case 'fs_write': fsMem[args.path] = args.text != null ? Buffer.from(args.text, 'utf8') : Buffer.from(args.base64, 'base64'); return null;
      case 'fs_read': if (!fsMem[args.path]) throw 'нет файла ' + args.path; return fsMem[args.path].toString('base64');
      case 'fs_exists': return !!fsMem[args.path] || Object.keys(fsMem).some(k => k.startsWith(args.path + '\\'));
      case 'fs_mkdir': return null;
      case 'fs_list': return Object.keys(fsMem).filter(k => k.startsWith(args.path + '\\')).map(k => k.slice(args.path.length + 1));
      case 'fs_remove': delete fsMem[args.path]; return null;
      case 'open_path': sysCalls.push('open:' + args.path); return '';
      case 'open_url': sysCalls.push('url:' + args.url); return null;
      case 'print_html': sysCalls.push('print'); fsMem.__printed = Buffer.from(args.html); return null;
      case 'http_request': {
        const r = await fetch(args.url, { method: args.method, headers: args.headers, body: args.body ?? undefined });
        return { status: r.status, body: await r.text() };
      }
      case 'secret_protect': return Buffer.from('X' + args.text).toString('base64');
      case 'secret_unprotect': return Buffer.from(args.data, 'base64').toString().slice(1);
      case 'cabinet_local_start': {
        if (!localCab) { localCab = createServer({ dataDir: cabDir, port: 0, host: '127.0.0.1', configFile: cabDir + '/none.json' }); await new Promise(r => localCab.server.listen(0, '127.0.0.1', r)); }
        return { port: localCab.server.address().port, lan: [], teamKey: localCab.teamKey() };
      }
      case 'cabinet_local_stop': return null;
      default: throw 'unknown command ' + cmd;
    }
  });
  await ctx.addInitScript(() => {
    // A stand-in window that remembers its place and what was asked of it.
    const w = window.__win = { x: 0, y: 0, width: 1320, height: 860, visible: false, top: null, skip: null, min: null, calls: [] };
    const sp = new URLSearchParams(location.search).get('w');
    const label = sp ? 'sat-' + sp.replace(/[^a-z0-9]/gi, '') : 'main';
    const listeners = {};
    const win = { label, close: async () => { w.calls.push('close'); window.__bus('__close', label); }, setFocus: async () => { w.calls.push('focus'); }, unminimize: async () => {}, isMaximized: async () => false, isMinimized: async () => false, isVisible: async () => w.visible, onResized: () => {}, onMoved: () => {}, onFocusChanged: () => {},
      minimize: async () => {}, maximize: async () => {}, unmaximize: async () => {}, startDragging: async () => {},
      setSize: async s => { w.width = s.width; w.height = s.height; }, setPosition: async p => { w.x = p.x; w.y = p.y; }, setMinSize: async s => { w.min = s; },
      outerPosition: async () => ({ x: w.x, y: w.y }), outerSize: async () => ({ width: w.width, height: w.height }), scaleFactor: async () => 1,
      show: async () => { w.visible = true; w.calls.push('show'); }, hide: async () => { w.visible = false; w.calls.push('hide'); },
      setAlwaysOnTop: async on => { w.top = on; }, setSkipTaskbar: async on => { w.skip = on; }, setTheme: async () => {}, setIgnoreCursorEvents: async () => {} };
    function Size(width, height) { this.width = width; this.height = height; }
    function Pos(x, y) { this.x = x; this.y = y; }
    window.__emit = (name, payload) => (listeners[name] || []).forEach(f => f({ payload }));
    function WebviewWindow(lbl, opts) { window.__bus('__open', { label: lbl, opts }); this.once = (ev, f) => { if (ev === 'tauri://created') setTimeout(() => f({}), 10); }; }
    WebviewWindow.getByLabel = async () => null;
    window.__TAURI__ = { core: { invoke: (c, a) => window.__rust(c, a || {}) }, event: { listen: async (n, f) => { (listeners[n] ||= []).push(f); }, emit: async (n, x) => window.__bus(n, x) },
      webviewWindow: { WebviewWindow },
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
  const r5 = await js(() => window.api.fbExport());
  check('not moved yet → clear message', !r5.ok && /версии 4.0 этого нет/.test(r5.message));
  // Files through the shared module (src/core/files.js) and the report code of the Electron version.
  {
  const docs = 'C:\\Users\\gip\\Documents';
  nextPath = docs + '\\Отчёт.xlsx';
  const rx = await js(() => window.api.exportReport('xlsx', { type: 'all' }));
  const x = fsMem[nextPath];
  check('report: Excel written (a real .xlsx)', rx.ok && x && x[0] === 0x50 && x[1] === 0x4b && x.length > 3000 && dialogs.at(-1).filters[0].extensions[0] === 'xlsx', JSON.stringify(rx));
  const { readXlsx } = require(require('path').resolve('src/import/read.js'));
  const sheets = readXlsx(x);
  check('report: Excel readable, cards inside', sheets.some(sh => sh.rows.length > 5), sheets.map(sh => sh.name + ':' + sh.rows.length).join());
  nextPath = docs + '\\Отчёт';
  const rd = await js(() => window.api.exportReport('docx', { type: 'all' }));
  check('report: Word written, extension added', rd.ok && fsMem[docs + '\\Отчёт.docx']?.[0] === 0x50, JSON.stringify(rd));
  await js(() => window.api.openLastReport()); await wait(100);
  check('«Открыть» opens the saved file', sysCalls.includes('open:' + docs + '\\Отчёт.docx'));
  const cpid = await js(() => [...window.AppBridge.state.projects.keys()][0]);
  nextPath = docs + '\\Статус.html';
  const rc = await js(id => window.api.customerPage(id, { format: 'html' }), cpid);
  const page = fsMem[nextPath]?.toString('utf8') || '';
  check('customer page: HTML with logo and font inside', rc.ok && /<svg/.test(page) && /@font-face/.test(page) && page.length > 50000, JSON.stringify(rc) + ' ' + page.length);
  const n0 = dialogs.length;
  const rp = await js(id => window.api.customerPage(id, { format: 'pdf' }), cpid);
  check('customer page: PDF → the browser print dialog, no save dialog', rp.ok && rp.viaBrowser && sysCalls.includes('print') && dialogs.length === n0, JSON.stringify(rp));
  nextPath = docs + '\\копия.json';
  const rb = await js(() => window.api.backupSave());
  const backup = JSON.parse(fsMem[nextPath].toString('utf8'));
  check('backup saved', rb.ok && backup.format === 'glavspec-backup' && Object.keys(backup.data.tasks).length > 5);
  const before = Object.keys(disk.data.tasks).length;
  await js(() => window.api.write([{ type: 'set', col: 'tasks', id: 'tmp-x', data: { projectId: [...window.AppBridge.state.projects.keys()][0], sections: ['ЭОМ'], title: 'после копии' } }], {})); await wait(300);
  const rr = await js(() => window.api.backupRestore()); await wait(400);
  check('restore: asks, keeps the current data, replaces, saves', rr.ok && dialogs.some(d => d.cmd === 'dialog_confirm' && /Заменить текущие данные/.test(d.message)) && !disk.data.tasks['tmp-x'] && Object.keys(disk.data.tasks).length === before
    && Object.keys(fsMem).some(k => /before-restore-/.test(k)), JSON.stringify(rr));
  check('restore shown in the window', !(await js(() => window.AppBridge.state.tasks.has('tmp-x'))));
  fsMem[docs + '\\Таблица.csv'] = Buffer.from('\ufeffОбъект;Разделы;Подрядчик\r\nЖК «Восток»;ЭОМ;ООО Свет\r\n', 'utf8');
  nextPath = docs + '\\Таблица.csv';
  const ri = await js(() => window.api.importPick());
  check('import: table read', ri.ok && ri.sheets[0].rows[1][0] === 'ЖК «Восток»', JSON.stringify(ri).slice(0, 200));
  nextPath = 'D:\\Копии';
  fsMem['D:\\Копии\\.keep'] = Buffer.from('');
  const ra = await js(() => window.api.autoBackupSet(false));
  check('automatic copy: folder chosen, first copy written', ra.ok && Object.keys(fsMem).some(k => /^D:\\Копии\\Пульт главспеца — автокопия \d{4}-\d\d-\d\d\.json$/.test(k)) && disk.settings.autoBackupDir === 'D:\\Копии', JSON.stringify(ra));
  nextPath = null;
  const rn = await js(() => window.api.exportReport('xlsx', { type: 'all' }));
  check('cancel in the dialog → nothing written', rn.canceled === true);
  }

  // The customer cabinet: built-in server, publish with a file for approval, the customer's verdict back.
  {
    const docs = 'C:\\Users\\gip\\Documents';
    const st = await js(() => window.api.cabinetLocalStart());
    check('cabinet: built-in server started, key kept encrypted', st.ok && /^dpapi:/.test(disk.settings.cabinetKey || '') && disk.settings.cabinetLocal === true, JSON.stringify(st));
    const port = st.port, base = `http://127.0.0.1:${port}`;
    await js(p => window.api.cabinetConfigure({ url: `http://127.0.0.1:${p}` }), port);
    const pid2 = await js(() => [...window.AppBridge.state.projects.keys()][0]);
    fsMem[docs + '\\План.pdf'] = Buffer.from('%PDF-план');
    nextPath = docs + '\\План.pdf';
    const att = await js(id => window.api.attachAdd(id), pid2);
    check('file attached from disk into the data folder', att.ok && Object.keys(fsMem).some(k => k.endsWith('\\attachments\\' + pid2 + '\\' + att.file.id)), JSON.stringify(att));
    await js(([id, f]) => { const p = window.AppBridge.state.projects.get(id); return window.api.write([{ type: 'update', col: 'projects', id, data: { requests: [...(p.requests || []), { id: 'rq-tauri', title: 'Согласовать план', due: '', why: '', done: false, irdId: '', files: [f] }] } }], {}); }, [pid2, att.file]); await wait(300);
    const pub = await js(id => window.api.cabinetPublish(id), pid2);
    check('published with the file uploaded', pub.ok && fs.existsSync(require('path').join(cabDir, 'files', pid2, att.file.id)), JSON.stringify(pub));
    const cust = await js(id => window.api.cabinetCustomerCreate({ name: 'Иван', login: 'ivan', projectIds: [id] }), pid2);
    let cookie = '';
    const web = async (method, p, form) => { const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, text: await r.text() }; };
    await web('POST', '/login', { login: 'ivan', password: cust.password });
    const page = await web('GET', '/p/' + pid2);
    const dl = await web('GET', `/p/${pid2}/f/${att.file.id}`);
    check('customer downloads the file', dl.status === 200 && dl.text === '%PDF-план');
    await web('POST', '/c/answer', { csrf: page.text.match(/name="csrf" value="([^"]+)"/)[1], project: pid2, request: 'rq-tauri', decision: 'approve' });
    const sy = await js(() => window.api.cabinetSync()); await wait(300);
    const v = await js(() => window.api.cabinetGet());
    check('verdict back in the window', sy.ok && v.messages.some(m => m.decision === 'approve' && m.requestTitle === 'Согласовать план'), JSON.stringify(sy));
    check('cabinet state kept in cabinet.json', Object.keys(fsMem).some(k => k.endsWith('\\cabinet.json')));
  }

  // Separate windows (4.0): bookmarks for open projects, a project and a chat in their own windows.
  {
    const pids = Object.keys(disk.data.projects).filter(id => !disk.data.projects[id].deletedAt);
    await js(() => window.api.switchUser('u-gip')); await wait(300);
    for (const id of pids.slice(0, 2)) { await js(i => { const b = document.createElement('button'); b.dataset.act = 'project-page'; b.dataset.id = i; document.body.append(b); b.click(); b.remove(); }, id); await wait(150); }
    const tabs = await js(() => [...document.querySelectorAll('.doc-tabs .dtab[data-doc]')].map(t => t.dataset.docId));
    check('bookmarks: opened projects stay as tabs', tabs.length === 2 && tabs[0] === pids[0] && tabs[1] === pids[1], JSON.stringify(tabs));
    await p.click(`.dtab[data-doc-id="${pids[0]}"] .dt-open`); await wait(150);
    check('bookmarks: a tab switches the project', await js(() => window.AppBridge.state.openProjectId) === pids[0] && await js(() => !!document.querySelector('.dtab.on[data-doc-id] .dt-open')));
    await p.click(`.dtab[data-doc-id="${pids[1]}"] [data-act="dtab-close"]`); await wait(150);
    check('bookmarks: × closes a tab', (await js(() => document.querySelectorAll('.doc-tabs .dtab[data-doc]').length)) === 1);
    await p.click('.pt-top [data-act="win-detach"]'); await wait(300);
    const o = opened.at(-1);
    check('⧉ opens the project in its own window', o && /^sat-project-/.test(o.label) && o.opts.url === `index.html?w=${encodeURIComponent('project:' + pids[0])}` && o.opts.transparent && o.opts.decorations === false && o.opts.dragDropEnabled === false, JSON.stringify(o));
    check('…and it leaves the main window', await js(() => window.AppBridge.state.openProjectId) === null && (await js(() => document.querySelectorAll('.doc-tabs .dtab[data-doc]').length)) === 0);
    // The separate window: same interface over the main window's data.
    const sp = await ctx.newPage();
    const serr = []; sp.on('pageerror', e => serr.push(e.message)); sp.on('console', m => { if (m.type() === 'error') serr.push(m.text()); });
    await sp.goto('http://127.0.0.1:8766/' + o.opts.url); await wait(1200);
    const sjs = (f, a) => sp.evaluate(f, a);
    const pname = disk.data.projects[pids[0]].name;
    check('project window shows only its project', await sjs(() => document.body.classList.contains('solo-project')) && (await sjs(() => document.querySelector('.pt-top h2')?.textContent)) === pname
      && await sjs(() => getComputedStyle(document.getElementById('nav')).display === 'none') && !(await sjs(() => document.querySelector('.msg-fab'))), (await sjs(() => document.querySelector('#app')?.innerText.slice(0, 60))).replace(/\s+/g, ' '));
    check('project window: title, «в главное окно», no ⧉', (await sjs(() => document.getElementById('app-title').textContent)) === pname && await sjs(() => !!document.querySelector('[data-act="win-dock"]') && !document.querySelector('[data-act="win-detach"]')));
    const t1 = Object.keys(disk.data.tasks).find(id => disk.data.tasks[id].projectId === pids[0] && !disk.data.tasks[id].deletedAt);
    const before = disk.saves;
    const sw = await sjs(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { readiness: 42 } }], { action: 'Готовность' }), t1);
    await wait(400);
    check('a change in the project window is saved by the main one', sw.ok && disk.data.tasks[t1].readiness === 42 && disk.saves > before, JSON.stringify(sw));
    check('…and both windows show it', await js(id => window.AppBridge.state.tasks.get(id)?.readiness, t1) === 42 && await sjs(id => window.AppBridge.state.tasks.get(id)?.readiness, t1) === 42);
    await js(id => window.api.write([{ type: 'update', col: 'tasks', id, data: { readiness: 43 } }], {}), t1); await wait(400);
    check('a change in the main window reaches the project window', await sjs(id => window.AppBridge.state.tasks.get(id)?.readiness, t1) === 43);
    await js(() => window.api.setTheme('graphite')); await wait(400);
    check('theme follows into the separate window', (await sjs(() => document.documentElement.dataset.theme)) === 'graphite');
    await js(() => window.api.setTheme('tandem')); await wait(300);
    const deny = await sjs(() => window.api.windowOpen);
    check('a separate window does not open others', deny === undefined);
    await sp.click('[data-act="win-dock"]'); await wait(400);
    check('«в главное окно»: the window closes', closed.length === 1);
    check('…as a tab, shown', await js(() => window.AppBridge.state.openProjectId) === pids[0] && (await js(() => document.querySelectorAll('.doc-tabs .dtab[data-doc]').length)) === 1);
    check('no errors in the project window', serr.length === 0, serr.join(' | '));
    await sp.screenshot({ path: require('os').tmpdir() + '/tauri-ui-project-window.png' }).catch(() => {});
    await sp.close();
    // A chat in its own window.
    const chatId = Object.keys(disk.data.chats).find(id => { const c = disk.data.chats[id]; return c.kind === 'project' ? pids.includes(c.projectId) && !disk.data.projects[c.projectId].archived : (c.members || []).includes('u-gip'); });
    const cp = await ctx.newPage();
    const cerr = []; cp.on('pageerror', e => cerr.push(e.message)); cp.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
    await cp.goto('http://127.0.0.1:8766/index.html?w=' + encodeURIComponent('chat:' + chatId)); await wait(1200);
    const cjs = (f, a) => cp.evaluate(f, a);
    check('chat window shows only its chat', await cjs(() => !!document.querySelector('.msg-panel.solo #msg-text') && !document.querySelector('.mp-head') && getComputedStyle(document.querySelector('.body')).visibility === 'hidden'));
    await cp.fill('#msg-text', 'Из отдельного окна'); await cp.click('[data-act="mc-send"]'); await wait(500);
    check('message sent from the chat window', disk.data.chats[chatId].messages.at(-1)?.text === 'Из отдельного окна' && (await cjs(() => document.getElementById('msg-text').value)) === '');
    check('…shown in the main window', await js(id => window.AppBridge.state.chats.get(id)?.messages.at(-1)?.text, chatId) === 'Из отдельного окна');
    const n = opened.length;
    check('no errors in the chat window', cerr.length === 0, cerr.join(' | '));
    await cp.setViewportSize({ width: 480, height: 680 }); await wait(200);
    await cp.screenshot({ path: require('os').tmpdir() + '/tauri-ui-chat-window.png' });
    await cp.close();
    // From the messenger: ⧉ in a chat's head.
    await js(id => { const b = document.createElement('button'); b.dataset.act = 'msg-open'; document.body.append(b); b.click(); b.remove(); }, chatId); await wait(200);
    await js(id => { const b = document.createElement('button'); b.dataset.act = 'msg-chat'; b.dataset.id = id; document.body.append(b); b.click(); b.remove(); }, chatId); await wait(200);
    await p.click('.mc-head [data-act="win-detach"]'); await wait(300);
    check('⧉ in a chat opens it in its own window', opened.length === n + 1 && opened.at(-1).opts.url.includes(encodeURIComponent('chat:' + chatId)) && /^sat-chat-/.test(opened.at(-1).label), JSON.stringify(opened.at(-1)));
    await js(() => { const b = document.createElement('button'); b.dataset.act = 'msg-close'; document.body.append(b); b.click(); b.remove(); }); await wait(300);
  }
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
  // A key saved by 3.x (Electron encryption) cannot be read: the cabinet settings ask for it again.
  disk.settings = { ...disk.settings, cabinetUrl: 'http://192.168.1.10:8080', cabinetKey: 'enc:djEwAAAA', cabinetLocal: false };
  await p.reload(); await wait(1200);
  const kl = await js(() => window.api.cabinetGet());
  check('3.x cabinet key: asked again, address kept', kl.keyLost === true && kl.hasKey === false && kl.url === 'http://192.168.1.10:8080', JSON.stringify(kl).slice(0, 200));
  // 4.1 in the Tauri window: org structure (new «depts» collection through the Rust store), Kanban card view, density.
  await js(() => document.querySelector('[data-act="tab"][data-id="people"]').click()); await wait(300);
  await js(() => document.querySelector('[data-act="people-mode"][data-v="org"]').click()); await wait(300);
  check('4.1: org structure renders', await js(() => document.querySelectorAll('.org-card').length > 0));
  const orgBtn = await js(() => !!document.querySelector('[data-act="org-from-groups"]'));
  if (orgBtn) {
    await js(() => document.querySelector('[data-act="org-from-groups"]').click()); await wait(600);
    const saved = disk.data || {};
    check('4.1: departments saved to data.json', Object.keys(saved.depts || {}).length > 0, Object.keys(saved));
  }
  await js(() => document.querySelector('[data-act="tab"][data-id="kanban"]').click()); await wait(300);
  check('4.1: Kanban card view menu and assignments switch', await js(() => !!document.querySelector('.kb-view') && !!document.querySelector('[data-act="show-assign"][data-v="kanban"]')));
  await p.screenshot({ path: require('os').tmpdir() + '/tauri-ui-check.png' });
  check('no page errors', errs.length === 0, errs.join(' | '));
  console.log(log.join('\n')); process.exitCode = log.some(l => l.startsWith('FAIL')) ? 1 : 0;
  if (localCab) { localCab.store.flush(); localCab.server.closeAllConnections?.(); localCab.server.close(); }
  await b.close(); srv.close();
})();

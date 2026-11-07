'use strict';
// Bridge: gives the unchanged interface the same `window.api` the Electron preload gives, on top of Tauri.
// Data and settings go through the shared core (tauri-core.js → src/core/handlers.js → Rust files).
// The window, the tray, notifications: Tauri window API + Rust commands (src-tauri/src/system.rs).
// Anything not provided here answers with a clear message.
(function () {
  const T = window.__TAURI__;
  const win = T.window.getCurrentWindow();
  const LogicalSize = (T.dpi && T.dpi.LogicalSize) || T.window.LogicalSize;
  const LogicalPosition = (T.dpi && T.dpi.LogicalPosition) || T.window.LogicalPosition;
  const { invoke } = T.core;
  // Same values as src/main.js.
  const APP_TITLE = 'Пульт главспеца';
  const FULL_DEFAULT = { width: 1080, height: 700 }, COMPACT_DEFAULT = { width: 360, height: 440 };
  const MIN = { full: { width: 560, height: 360 }, compact: { width: 280, height: 200 } };
  const LEVELS = { top: 'Поверх всех окон', normal: 'Обычное окно', desktop: 'На рабочем столе' };
  const THEMES = { system: 'Как в Windows', light: 'Светлая', dark: 'Тёмная', graphite: 'Графит', tandem: 'Тандем' };
  const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
  const sys = { desktop: false, autostart: false }; // asked from Rust once at start
  const LATER = 'В пробе Tauri этого пока нет — будет на следующем этапе переноса.';
  const later = async () => ({ ok: false, message: LATER });

  const dataListeners = [];
  const emitData = () => { if (!ctx) return; const view = ctx.core.userView(); for (const cb of dataListeners) cb(view); trayLater(); };
  let ctx = null, starting = null;
  const cabListeners = [];
  const emitCabinet = () => { if (!ctx) return; const v = ctx.cabinet.view(); for (const cb of cabListeners) cb(v); };
  const ready = () => (starting ||= window.TauriCore.init({ onChanged: emitData, cabinetChanged: emitCabinet }).then(c => { ctx = c; return c; }));

  // Same mapping as themeSource() in src/main.js: «Графит» is dark, «Тандем» is light.
  const schemeOf = t => (t === 'graphite' ? 'dark' : t === 'tandem' ? 'light' : t === 'light' || t === 'dark' ? t : 'system');
  // Electron switches prefers-color-scheme for the page (nativeTheme.themeSource); here the stylesheet's
  // dark rules are switched directly, so a light theme stays light on a dark Windows and the other way round.
  let darkRules = null;
  function applyScheme(theme) {
    const scheme = schemeOf(theme);
    if (!darkRules) {
      darkRules = [];
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const r of rules) if (r.media && /prefers-color-scheme:\s*dark/.test(r.media.mediaText)) darkRules.push([r, r.media.mediaText]);
      }
    }
    for (const [r, original] of darkRules) r.media.mediaText = scheme === 'dark' ? 'all' : scheme === 'light' ? 'not all' : original;
    win.setTheme?.(scheme === 'system' ? null : scheme).catch(() => {}); // scrollbars and system parts of the window
  }
  let zoomByWebview = false; // true: Webview.setZoom; false: CSS zoom (getBoundingClientRect already scaled)
  const clampZoom = z => Math.round(Math.min(1.5, Math.max(0.8, Number(z) || 1)) * 100) / 100;
  async function applyZoom(z) {
    const wv = T.webview?.getCurrentWebview?.();
    try { if (!wv?.setZoom) throw new Error('no webview zoom'); await wv.setZoom(z); document.documentElement.style.zoom = ''; zoomByWebview = true; }
    catch { document.documentElement.style.zoom = String(z); zoomByWebview = false; } // older Tauri: CSS zoom
  }
  // «On the desktop»: under all other windows (Rust: SetWindowPos HWND_BOTTOM) and no taskbar button —
  // reached via the tray icon, as in the Electron version.
  const toBottom = () => invoke('window_to_bottom').catch(() => {});
  async function applyLevel(level) {
    await win.setAlwaysOnTop(level === 'top').catch(e => console.error('always on top:', e));
    await win.setSkipTaskbar(level === 'desktop').catch(() => {});
    if (level === 'desktop') toBottom();
  }
  // As in src/main.js: before 1.6 there was only «always on top» on/off.
  const levelOf = s => (LEVELS[s.get('windowLevel')] && (s.get('windowLevel') !== 'desktop' || sys.desktop) ? s.get('windowLevel') : s.get('alwaysOnTop') === false ? 'normal' : 'top');
  win.onFocusChanged(({ payload: focused }) => { if (!focused && ctx && levelOf(ctx.settings) === 'desktop') toBottom(); });
  T.event.listen('probe:shown', () => { if (ctx && levelOf(ctx.settings) === 'desktop') setTimeout(toBottom, 50); });

  /* ---------- size and place: remembered separately for the full and the compact window ---------- */
  const boundsKey = () => (ctx.settings.get('compact') ? 'compactBounds' : 'fullBounds');
  async function getBounds() {
    const [pos, size, sf] = await Promise.all([win.outerPosition(), win.outerSize(), win.scaleFactor()]);
    return { x: Math.round(pos.x / sf), y: Math.round(pos.y / sf), width: Math.round(size.width / sf), height: Math.round(size.height / sf) };
  }
  async function setBounds(b) {
    await win.setSize(new LogicalSize(b.width, b.height));
    await win.setPosition(new LogicalPosition(b.x, b.y));
  }
  // Restored bounds may point at a monitor that is no longer connected (same rule as src/main.js).
  async function fitToDisplay(bounds, fallback) {
    let areas = [];
    try { areas = (await T.window.availableMonitors()).map(m => ({ x: m.position.x / m.scaleFactor, y: m.position.y / m.scaleFactor, width: m.size.width / m.scaleFactor, height: m.size.height / m.scaleFactor })); } catch { /* none known */ }
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
      const visible = !areas.length || areas.some(a => bounds.x < a.x + a.width - 40 && bounds.x + bounds.width > a.x + 40 && bounds.y >= a.y - 10 && bounds.y < a.y + a.height - 40);
      if (visible) return bounds;
    }
    const a = areas[0] || { x: 0, y: 0, width: 1920, height: 1040 };
    const w = Math.min(fallback.width, a.width), h = Math.min(fallback.height, a.height - 48);
    return { width: w, height: h, x: Math.round(a.x + a.width - w - 24), y: Math.round(a.y + 24) };
  }
  const applyMinSize = () => { const m = ctx.settings.get('compact') ? MIN.compact : MIN.full; return win.setMinSize(new LogicalSize(m.width, m.height)).catch(() => {}); };
  let boundsTimer = null;
  function rememberBounds() {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(async () => {
      if (!ctx || !(await win.isVisible()) || (await win.isMinimized()) || (await win.isMaximized())) return;
      ctx.settings.set({ [boundsKey()]: await getBounds() });
    }, 400);
  }
  win.onMoved(rememberBounds);
  // Compact mode: a small window with the essentials; each mode keeps its own size and place.
  async function setCompact(on) {
    const s = ctx.settings;
    if (!!on === !!s.get('compact')) return;
    if (await win.isMaximized()) await win.unmaximize();
    const cur = await getBounds();
    s.set({ [boundsKey()]: cur, compact: !!on });
    await applyMinSize();
    const target = s.get(boundsKey()), fallback = on ? COMPACT_DEFAULT : FULL_DEFAULT;
    // Without saved bounds, keep the window's right edge in place so it stays where the user put it.
    await setBounds(target ? await fitToDisplay(target, fallback) : await fitToDisplay({ ...fallback, x: cur.x + cur.width - fallback.width, y: cur.y }, fallback));
    pushState();
  }

  // Click-through. Electron forwards mouse moves to an ignoring window, so the page sees the cursor over its
  // «unlock» handle; Tauri does not, so the bridge watches the cursor itself and lets the mouse in over the handle.
  // Deliberately not saved: the app must never start un-clickable.
  const ghost = { on: false, timer: null, passing: null };
  async function ghostTick() {
    if (!ghost.on) return;
    const el = document.getElementById('unlock');
    const r = el && el.getBoundingClientRect();
    let over = false;
    if (r && r.width) {
      const [cur, pos, scale] = await Promise.all([T.window.cursorPosition(), win.outerPosition(), win.scaleFactor()]);
      const k = scale * (zoomByWebview && ctx ? clampZoom(ctx.settings.get('zoom')) : 1), pad = 6 * scale;
      const x = (cur.x - pos.x) / k, y = (cur.y - pos.y) / k;
      over = x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    }
    if (ghost.passing !== !over) { ghost.passing = !over; await win.setIgnoreCursorEvents(!over); }
  }
  async function setGhost(on) {
    ghost.on = !!on;
    clearInterval(ghost.timer); ghost.timer = null; ghost.passing = null;
    if (ghost.on) { await win.setIgnoreCursorEvents(true); ghost.passing = true; ghost.timer = setInterval(() => ghostTick().catch(() => {}), 80); }
    else await win.setIgnoreCursorEvents(false);
    pushState();
  }
  T.event.listen('probe:ghost-toggle', () => setGhost(!ghost.on));

  const winListeners = [];
  async function windowState() {
    const { settings: s } = await ready();
    const level = levelOf(s);
    return {
      alwaysOnTop: level === 'top', level, desktopSupported: sys.desktop,
      theme: s.get('theme') || 'system', zoom: clampZoom(s.get('zoom')), compact: !!s.get('compact'),
      maximized: await win.isMaximized(), opacity: s.get('opacity') ?? 0.82, // translucency is CSS over a transparent window
      clickThrough: ghost.on, autostart: sys.autostart, hotkey: 'Ctrl+Alt+G',
    };
  }
  const pushState = async () => { const st = await windowState(); for (const cb of winListeners) cb(st); trayLater(); };
  win.onResized(() => { pushState(); rememberBounds(); });
  // Start: the saved look (theme, zoom), size and place, level — then the window is shown (it starts hidden).
  let looked = null;
  const startLook = () => (looked ||= (async () => {
    const c = await ready();
    [sys.desktop, sys.autostart] = await Promise.all([invoke('desktop_supported').catch(() => false), invoke('autostart_get').catch(() => false)]);
    const st = await windowState();
    applyScheme(st.theme); applyZoom(st.zoom);
    await applyMinSize();
    try { await setBounds(await fitToDisplay(c.settings.get(boundsKey()), st.compact ? COMPACT_DEFAULT : FULL_DEFAULT)); } catch (e) { console.error('Размер окна:', e); }
    await win.show();
    await applyLevel(st.level);
    startDigest();
    trayLater();
  })());

  /* ---------- tray icon: the menu of the Electron version; actions come back as events ---------- */
  async function trayItems() {
    const st = await windowState(), s = ctx.settings, hour = s.get('notifyHour');
    const radio = (prefix, entries, cur) => entries.map(([k, l]) => ({ kind: 'check', id: `${prefix}:${k}`, label: l, checked: cur === k }));
    return [
      { id: 'show', label: 'Показать' },
      { kind: 'sep' },
      { kind: 'sub', id: 'm-level', label: 'Положение окна', items: radio('level', Object.entries(LEVELS).filter(([k]) => k !== 'desktop' || sys.desktop), st.level) },
      { kind: 'sub', id: 'm-theme', label: 'Тема', items: radio('theme', Object.entries(THEMES), st.theme) },
      { kind: 'sub', id: 'm-zoom', label: 'Масштаб', items: radio('zoom', ZOOMS.map(z => [String(z), `${Math.round(z * 100)}%`]), String(st.zoom)) },
      { kind: 'check', id: 'ghost', label: 'Сквозные клики (Ctrl+Alt+G)', checked: st.clickThrough },
      { kind: 'check', id: 'compact', label: 'Компактный режим', checked: st.compact },
      { kind: 'sep' },
      { kind: 'check', id: 'notify', label: `Утренняя сводка в уведомлениях (с ${hour}:00)`, checked: !!s.get('notify') },
      { kind: 'sub', id: 'm-hour', label: 'Время сводки', items: [7, 8, 9, 10, 11].map(h => ({ kind: 'check', id: `hour:${h}`, label: `${h}:00`, checked: hour === h })) },
      { id: 'digest-now', label: 'Показать сводку сейчас' },
      { kind: 'sep' },
      { kind: 'check', id: 'autostart', label: 'Запускать вместе с Windows', checked: st.autostart },
      { id: 'data-folder', label: 'Открыть папку с данными' },
      { kind: 'sep' },
      { id: 'quit', label: 'Выход' },
    ];
  }
  // What needs attention, for the tooltip and the morning notification (same text as Electron).
  const digestText = () => {
    const me = ctx.core.currentUser();
    return window.Logic.digestText(window.Logic.visible(ctx.core.userView()).tasks, window.Logic.todayStr(), { money: window.Access.canSeeMoney(me) });
  };
  let trayTimer = null;
  function trayLater() {
    if (!ctx || !looked) return;
    clearTimeout(trayTimer);
    trayTimer = setTimeout(async () => {
      try { await invoke('tray_set', { items: await trayItems(), tooltip: `${APP_TITLE} — ${digestText() || 'всё по плану'}` }); }
      catch (e) { console.error('Меню значка у часов:', e); }
    }, 300);
  }
  async function trayAction(id) {
    const [k, v] = String(id).split(':');
    const s = ctx.settings;
    if (k === 'level') known.setLevel(v);
    else if (k === 'theme') known.setTheme(v);
    else if (k === 'zoom') known.setZoom(Number(v));
    else if (k === 'ghost') setGhost(!ghost.on);
    else if (k === 'compact') setCompact(!s.get('compact'));
    else if (k === 'notify') { s.set({ notify: !s.get('notify') }); trayLater(); }
    else if (k === 'hour') { s.set({ notifyHour: Number(v), lastDigest: null }); trayLater(); }
    else if (k === 'digest-now') { if (!(await morningDigest(true))) { await win.show(); window.AppBridge?.toast('Уведомления Windows недоступны. Проверьте «Параметры → Система → Уведомления».', true); } }
    else if (k === 'autostart') { try { sys.autostart = await invoke('autostart_set', { on: !sys.autostart }); } catch (e) { console.error(e); } pushState(); }
    else if (k === 'data-folder') invoke('open_data_folder').catch(e => console.error(e));
    else if (k === 'quit') invoke('app_quit');
  }
  T.event.listen('tray:action', e => { if (ctx) trayAction(e.payload); });

  /* ---------- morning digest in Windows notifications (once a day after the chosen hour) ---------- */
  async function morningDigest(force = false) {
    const s = ctx.settings, today = window.Logic.todayStr(), text = digestText();
    if (force) return invoke('notify', { body: text || 'Всё по плану: просрочек, сдач в ближайшие дни, проверок и платежей нет.' }).catch(() => false);
    if (!s.get('notify') || s.get('lastDigest') === today || new Date().getHours() < s.get('notifyHour')) return false;
    s.set({ lastDigest: today });
    return text ? invoke('notify', { body: text }).catch(() => false) : false;
  }
  let digestStarted = false;
  function startDigest() {
    if (digestStarted) return;
    digestStarted = true;
    setTimeout(() => morningDigest(), 15 * 1000);
    setInterval(() => { morningDigest(); trayLater(); }, 5 * 60 * 1000);
    // The cabinet: new messages and changed projects, as in Electron — after 20 s, then every 2 minutes.
    setTimeout(() => ctx.cabinet.sync(), 20 * 1000);
    setInterval(() => ctx.cabinet.sync(), 2 * 60 * 1000);
    // The automatic copy into the GIP's folder, as in Electron: shortly after start, then every 30 minutes.
    setTimeout(() => ctx.files.autoBackup(), 30 * 1000);
    setInterval(() => ctx.files.autoBackup(), 30 * 60 * 1000);
  }
  const setting = async patch => { (await ready()).settings.set(patch); pushState(); };

  // The interface marks its title bar with -webkit-app-region: drag; Tauri needs an explicit call.
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.detail > 1) return;
    if (!e.target.closest('.bar, .drag')) return;
    if (e.target.closest('button, input, select, textarea, label, a, .menu, .tabs, .unlock, .adds, .user-wrap, .grip')) return;
    win.startDragging();
  });

  // A change is answered once the file is written: if saving failed, the window gets the error instead of «ok».
  const saved = async result => { const f = await ctx.flush(); return f.ok ? result : f; };

  const known = {
    getData: async () => { const c = await ready(); return { data: c.core.userView(), warning: c.warning }; },
    onData: cb => { dataListeners.push(cb); return () => dataListeners.splice(dataListeners.indexOf(cb), 1); },
    write: async (ops, meta) => { const c = await ready(); return saved(c.core.write(ops, meta)); },
    switchUser: async id => { const c = await ready(); return c.core.switchUser(id); },
    taskSeen: async id => { const c = await ready(); return saved(c.core.taskSeen(id)); },
    addComment: async (id, text) => { const c = await ready(); return saved(c.core.taskComment(id, text)); },
    thankComment: async (id, commentId) => { const c = await ready(); return saved(c.core.taskThank(id, commentId)); },
    editComment: async (id, commentId, text) => { const c = await ready(); return saved(c.core.taskCommentEdit(id, commentId, text)); },
    clearDemo: async () => { const c = await ready(); return saved(c.core.demoClear()); },
    getJournal: async since => { const c = await ready(); return c.core.journalGet({ since }); },
    // Messenger: the shared rules (src/core/chats.js); each answer waits until the file is written.
    chatSend: async (chatId, text, projectId) => { const c = await ready(); return saved(c.chats.send(chatId, text, projectId)); },
    chatEdit: async (chatId, msgId, text) => { const c = await ready(); return saved(c.chats.edit(chatId, msgId, text)); },
    chatSeen: async chatId => { const c = await ready(); return saved(c.chats.seen(chatId)); },
    chatDirect: async uid => { const c = await ready(); return saved(c.chats.direct(uid)); },
    chatCreate: async input => { const c = await ready(); return saved(c.chats.create(input)); },
    chatUpdate: async (chatId, input) => { const c = await ready(); return saved(c.chats.update(chatId, input)); },
    chatLeave: async chatId => { const c = await ready(); return saved(c.chats.leave(chatId)); },
    chatSeedDemo: async () => { const c = await ready(); return saved(c.chats.seedDemo()); },
    reloadWindow: async () => { location.reload(); return { ok: true }; },
    // Files: the shared rules (src/core/files.js); a change the file brings (restore) is saved before the answer.
    exportReport: async (format, scope) => (await ready()).files.exportReport(format, scope),
    openLastReport: async () => (await ready()).files.openLast(),
    customerPage: async (projectId, opts) => (await ready()).files.customerPage(projectId, opts),
    exportComposition: async (projectId, format, opts) => (await ready()).files.composition(projectId, format, opts),
    docDefaults: async () => (await ready()).files.docDefaults(),
    openTemplates: async () => (await ready()).files.openTemplates(),
    openProjectFolder: async id => (await ready()).files.openProjectFolder(id),
    openTaskFolder: async id => (await ready()).files.openTaskFolder(id),
    pickFolder: async current => (await ready()).files.pickFolder(current),
    openContact: async req => (await ready()).files.contactOpen(req),
    backupSave: async () => (await ready()).files.backupSave(),
    backupRestore: async () => { const c = await ready(); return saved(await c.files.backupRestore()); },
    autoBackupGet: async () => (await ready()).files.autoBackupGet(),
    autoBackupSet: async off => (await ready()).files.autoBackupSet(off),
    importPick: async () => (await ready()).files.importPick(),
    attachAdd: async projectId => (await ready()).files.attachAdd(projectId),
    attachOpen: async (projectId, fileId) => (await ready()).files.attachOpen(projectId, fileId),
    // Customer cabinet: the shared rules (src/core/cabinet-rules.js).
    cabinetGet: async () => (await ready()).cabinet.view(),
    onCabinet: cb => { cabListeners.push(cb); return () => cabListeners.splice(cabListeners.indexOf(cb), 1); },
    cabinetConfigure: async cfg => (await ready()).cabinet.configure(cfg),
    cabinetLocalStart: async () => (await ready()).cabinet.localStart(),
    cabinetLocalStop: async () => (await ready()).cabinet.localStop(),
    cabinetSync: async () => (await ready()).cabinet.sync({ quiet: true }),
    cabinetPublish: async projectId => (await ready()).cabinet.publish(projectId),
    cabinetUnpublish: async projectId => (await ready()).cabinet.unpublish(projectId),
    cabinetCustomers: async () => (await ready()).cabinet.customers(),
    cabinetCustomerCreate: async c => (await ready()).cabinet.customerCreate(c),
    cabinetCustomerUpdate: async (id, patch) => (await ready()).cabinet.customerUpdate(id, patch),
    cabinetCustomerDelete: async id => (await ready()).cabinet.customerDelete(id),
    cabinetRead: async (ids, read) => (await ready()).cabinet.read(ids, read),
    cabinetOpen: async projectId => (await ready()).cabinet.open(projectId),

    getWindowState: async () => { await startLook(); return windowState(); },
    onWindowState: cb => { winListeners.push(cb); return () => winListeners.splice(winListeners.indexOf(cb), 1); },
    minimize: () => win.minimize(),
    setMaximized: async on => { (on ? await win.maximize() : await win.unmaximize()); pushState(); },
    hide: () => win.hide(), // back via the tray icon
    openDataFolder: () => invoke('open_data_folder').catch(e => console.error(e)),
    setSize: (w, h) => win.setSize(new LogicalSize(w, h)),
    setTheme: theme => { applyScheme(theme); setting({ theme }); },
    setOpacity: v => { const n = Number(v); if (Number.isFinite(n)) setting({ opacity: Math.min(1, Math.max(0.25, n)) }); },
    setZoom: z => { const zoom = clampZoom(z); applyZoom(zoom); setting({ zoom }); },
    setLevel: level => { if (!LEVELS[level] || (level === 'desktop' && !sys.desktop)) return; applyLevel(level); setting({ windowLevel: level }); },
    setAlwaysOnTop: on => known.setLevel(on ? 'top' : 'normal'),
    setClickThrough: on => setGhost(on),
    setCompact: on => { ready().then(() => setCompact(on)); },
    hoverUnlock: () => {},
    fbList: async () => [],
  };

  window.api = new Proxy(known, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name === 'string' && /^on[A-Z]/.test(name)) return () => () => {};
      return later;
    },
  });
})();

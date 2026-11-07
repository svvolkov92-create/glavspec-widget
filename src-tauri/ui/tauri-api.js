'use strict';
// Bridge: gives the unchanged interface the same `window.api` the Electron preload gives, on top of Tauri.
// Data and settings go through the shared core (tauri-core.js → src/core/handlers.js → Rust files).
// What is not moved yet (stage 3: chats, ИРД, reports, import, backups, cabinet) answers with a clear message.
(function () {
  const T = window.__TAURI__;
  const win = T.window.getCurrentWindow();
  const LogicalSize = (T.dpi && T.dpi.LogicalSize) || T.window.LogicalSize;
  const LATER = 'В пробе Tauri этого пока нет — будет на следующем этапе переноса.';
  const later = async () => ({ ok: false, message: LATER });

  const dataListeners = [];
  const emitData = () => { if (!ctx) return; const view = ctx.core.userView(); for (const cb of dataListeners) cb(view); };
  let ctx = null, starting = null;
  const ready = () => (starting ||= window.TauriCore.init({ onChanged: emitData }).then(c => { ctx = c; return c; }));

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
  const applyLevel = level => win.setAlwaysOnTop(level === 'top').catch(e => console.error('always on top:', e));
  // As in src/main.js: before 1.6 there was only «always on top» on/off; «on the desktop» is not in Tauri yet.
  const levelOf = s => (s.get('windowLevel') === 'top' || s.get('windowLevel') === 'normal' ? s.get('windowLevel') : s.get('alwaysOnTop') === false ? 'normal' : 'top');

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
      alwaysOnTop: level === 'top', level, desktopSupported: false,
      theme: s.get('theme') || 'system', zoom: clampZoom(s.get('zoom')), compact: false,
      maximized: await win.isMaximized(), opacity: s.get('opacity') ?? 0.82, // translucency is CSS over a transparent window
      clickThrough: ghost.on, autostart: false, hotkey: 'Ctrl+Alt+G',
    };
  }
  const pushState = async () => { const st = await windowState(); for (const cb of winListeners) cb(st); };
  win.onResized(() => { pushState(); });
  // Start with the saved look: theme, zoom and level.
  let looked = null;
  const startLook = () => (looked ||= windowState().then(st => { applyScheme(st.theme); applyZoom(st.zoom); applyLevel(st.level); }));
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

    getWindowState: async () => { await startLook(); return windowState(); },
    onWindowState: cb => { winListeners.push(cb); return () => winListeners.splice(winListeners.indexOf(cb), 1); },
    minimize: () => win.minimize(),
    setMaximized: async on => { (on ? await win.maximize() : await win.unmaximize()); pushState(); },
    hide: () => win.minimize(), // no tray yet: hiding would leave no way back
    setSize: (w, h) => win.setSize(new LogicalSize(w, h)),
    setTheme: theme => { applyScheme(theme); setting({ theme }); },
    setOpacity: v => { const n = Number(v); if (Number.isFinite(n)) setting({ opacity: Math.min(1, Math.max(0.25, n)) }); },
    setZoom: z => { const zoom = clampZoom(z); applyZoom(zoom); setting({ zoom }); },
    setLevel: level => { if (level !== 'top' && level !== 'normal') return; applyLevel(level); setting({ windowLevel: level }); },
    setAlwaysOnTop: on => known.setLevel(on ? 'top' : 'normal'),
    setClickThrough: on => setGhost(on),
    hoverUnlock: () => {}, setCompact: () => {},
    fbList: async () => [],
    autoBackupGet: async () => ({ dir: '' }),
    cabinetGet: async () => null,
  };

  window.api = new Proxy(known, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name === 'string' && /^on[A-Z]/.test(name)) return () => () => {};
      return later;
    },
  });
})();

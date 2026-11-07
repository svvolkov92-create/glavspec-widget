'use strict';
// Probe bridge: gives the unchanged interface the same `window.api` the Electron preload gives,
// on top of Tauri. Data is read-only here — every change is refused with a clear message.
(function () {
  const T = window.__TAURI__;
  const invoke = T.core.invoke;
  const win = T.window.getCurrentWindow();
  const LogicalSize = (T.dpi && T.dpi.LogicalSize) || T.window.LogicalSize;
  const READ_ONLY = 'Проба Tauri: только просмотр — изменения не сохраняются.';
  const refused = async () => ({ ok: false, message: READ_ONLY });
  const COLLECTIONS = ['projects', 'contractors', 'tasks', 'users', 'chats'];

  let loading = null;
  const load = () => (loading ||= invoke('probe_load'));

  // Same shape as Store.snapshot() + userView() in src/main.js.
  function userView(data, settings) {
    const snap = {};
    for (const col of COLLECTIONS) snap[col] = Object.entries(data[col] || {}).map(([id, doc]) => ({ ...doc, id }));
    const users = snap.users.filter(u => !u.deletedAt);
    const me = users.find(u => u.id === settings.userId) || users.find(u => u.role === 'gip') || users[0] || null;
    return { ...window.Access.viewFor(me, snap), me };
  }

  // Window settings changed in this session. Not written to settings.json (read-only probe), but kept
  // in sessionStorage so they survive the page reload after a user switch.
  const SESSION_KEY = 'glavspec.probe';
  const local = (() => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; } })();
  const remember = patch => { Object.assign(local, patch); try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(local)); } catch { /* optional */ } };

  // Same mapping as themeSource() in src/main.js: «Графит» is dark, «Тандем» is light.
  const schemeOf = t => (t === 'graphite' ? 'dark' : t === 'tandem' ? 'light' : t === 'light' || t === 'dark' ? t : 'system');
  // Electron switches prefers-color-scheme for the page (nativeTheme.themeSource); the probe switches the
  // stylesheet's dark rules itself, so a light theme stays light on a dark Windows and the other way round.
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

  // Click-through. Electron forwards mouse moves to an ignoring window, so the page sees the cursor over its
  // «unlock» handle; Tauri does not, so the probe watches the cursor itself and lets the mouse in over the handle.
  const ghost = { on: false, timer: null, passing: null };
  async function ghostTick() {
    if (!ghost.on) return;
    const el = document.getElementById('unlock');
    const r = el && el.getBoundingClientRect();
    let over = false;
    if (r && r.width) {
      const [cur, pos, scale] = await Promise.all([T.window.cursorPosition(), win.outerPosition(), win.scaleFactor()]);
      const k = scale * (zoomByWebview ? (local.zoom ?? 1) : 1), pad = 6 * scale;
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
    const { settings: s } = await load();
    const level = local.level || (s.windowLevel === 'top' || (!s.windowLevel && s.alwaysOnTop !== false) ? 'top' : 'normal');
    return {
      alwaysOnTop: level === 'top', level, desktopSupported: false,
      theme: local.theme || s.theme || 'system', zoom: clampZoom(local.zoom ?? s.zoom ?? 1), compact: false,
      maximized: await win.isMaximized(), opacity: local.opacity ?? s.opacity ?? 0.82, // translucency is CSS over a transparent window
      clickThrough: ghost.on, autostart: false, hotkey: 'Ctrl+Alt+G',
    };
  }
  const pushState = async () => { const st = await windowState(); for (const cb of winListeners) cb(st); };
  win.onResized(() => { pushState(); });
  // Start with the saved look: theme, zoom and level from settings.json (or from this session).
  let started = null;
  const start = () => (started ||= windowState().then(st => { applyScheme(st.theme); applyZoom(st.zoom); applyLevel(st.level); }));

  // The interface marks its title bar with -webkit-app-region: drag; Tauri needs an explicit call.
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.detail > 1) return;
    if (!e.target.closest('.bar, .drag')) return;
    if (e.target.closest('button, input, select, textarea, label, a, .menu, .tabs, .unlock, .adds, .user-wrap, .grip')) return;
    win.startDragging();
  });

  const dataListeners = [];
  async function currentView() {
    const { data, settings } = await load();
    return userView(data, { ...settings, userId: local.userId || settings.userId });
  }

  const known = {
    getData: async () => {
      const { found, dir } = await load();
      const warning = found ? `${READ_ONLY} Данные: ${dir}` : `Проба Tauri: в ${dir} нет data.json — откройте сначала Electron-версию.`;
      return { data: await currentView(), warning };
    },
    onData: cb => { dataListeners.push(cb); return () => dataListeners.splice(dataListeners.indexOf(cb), 1); },
    // Trying the roles out is a view change, not a data change: allowed in the probe, kept for this session only.
    switchUser: async id => {
      const { data } = await load();
      const u = (data.users || {})[id];
      if (!u || u.deletedAt) return { ok: false, message: 'Пользователь не найден.' };
      remember({ userId: id });
      const view = await currentView();
      for (const cb of dataListeners) cb(view);
      return { ok: true };
    },
    reloadWindow: async () => { location.reload(); return { ok: true }; },
    getWindowState: async () => { await start(); return windowState(); },
    onWindowState: cb => { winListeners.push(cb); return () => winListeners.splice(winListeners.indexOf(cb), 1); },
    minimize: () => win.minimize(),
    setMaximized: async on => { (on ? await win.maximize() : await win.unmaximize()); pushState(); },
    hide: () => win.minimize(), // no tray in the probe: hiding would leave no way back
    setSize: (w, h) => win.setSize(new LogicalSize(w, h)),
    setTheme: theme => { remember({ theme }); applyScheme(theme); pushState(); },
    setOpacity: v => { remember({ opacity: Number(v) }); pushState(); },
    setZoom: z => { const zoom = clampZoom(z); remember({ zoom }); applyZoom(zoom); pushState(); },
    setLevel: level => { if (level !== 'top' && level !== 'normal') return; remember({ level }); applyLevel(level); pushState(); },
    setAlwaysOnTop: on => known.setLevel(on ? 'top' : 'normal'),
    setClickThrough: on => setGhost(on),
    hoverUnlock: () => {}, setCompact: () => {},
    fbList: async () => [],
    getJournal: async () => [],
    autoBackupGet: async () => ({ dir: '' }),
    cabinetGet: async () => null,
  };

  window.api = new Proxy(known, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name === 'string' && /^on[A-Z]/.test(name)) return () => () => {};
      return refused;
    },
  });
})();

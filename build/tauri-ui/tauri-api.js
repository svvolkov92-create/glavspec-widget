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

  const winListeners = [];
  const local = {}; // theme and opacity changed in this session (not saved: read-only probe)
  async function windowState() {
    const { settings: s } = await load();
    return {
      alwaysOnTop: false, level: 'normal', desktopSupported: false,
      theme: local.theme || s.theme || 'system', zoom: s.zoom || 1, compact: false,
      maximized: await win.isMaximized(), opacity: local.opacity ?? s.opacity ?? 0.82, // translucency is CSS over a transparent window
      clickThrough: false, autostart: false, hotkey: '',
    };
  }
  const pushState = async () => { const st = await windowState(); for (const cb of winListeners) cb(st); };
  win.onResized(() => { pushState(); });

  // The interface marks its title bar with -webkit-app-region: drag; Tauri needs an explicit call.
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.detail > 1) return;
    if (!e.target.closest('.bar, .drag')) return;
    if (e.target.closest('button, input, select, textarea, label, a, .menu, .tabs, .unlock, .adds, .user-wrap, .grip')) return;
    win.startDragging();
  });

  const known = {
    getData: async () => {
      const { data, settings, found, dir } = await load();
      const warning = found ? `${READ_ONLY} Данные: ${dir}` : `Проба Tauri: в ${dir} нет data.json — откройте сначала Electron-версию.`;
      return { data: userView(data, settings), warning };
    },
    onData: () => () => {},
    getWindowState: windowState,
    onWindowState: cb => { winListeners.push(cb); return () => winListeners.splice(winListeners.indexOf(cb), 1); },
    minimize: () => win.minimize(),
    setMaximized: async on => { (on ? await win.maximize() : await win.unmaximize()); pushState(); },
    hide: () => win.hide(),
    setSize: (w, h) => win.setSize(new LogicalSize(w, h)),
    setTheme: theme => { local.theme = theme; pushState(); },
    setOpacity: v => { local.opacity = Number(v); pushState(); },
    setZoom: () => {}, setLevel: () => {}, setAlwaysOnTop: () => {},
    setClickThrough: () => {}, hoverUnlock: () => {}, setCompact: () => {},
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

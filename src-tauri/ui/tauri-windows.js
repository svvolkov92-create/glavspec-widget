'use strict';
// Separate windows for one project or one chat (4.0). The main window keeps the only copy of the data and the
// shared core; a separate window loads the same interface with «?w=project:<id>» / «?w=chat:<key>», and its
// `window.api` forwards every call to the main window over Tauri events and gets data and the window look back
// the same way. Events are broadcast; a reply carries the label of the window it is for.
// Also here, for every window: the look (theme, zoom) and dragging by the title bar.
(function () {
  const T = window.__TAURI__;
  const win = T.window.getCurrentWindow();
  const LABEL = win.label || 'main';
  const emit = (name, payload) => T.event.emit(name, payload);
  const listen = (name, f) => T.event.listen(name, e => f(e.payload || {}));
  const SIZES = { project: { width: 1040, height: 760 }, chat: { width: 480, height: 680 } };
  const KINDS = ['project', 'chat'];

  /* ---------- the look, same in every window ---------- */
  // Electron switches prefers-color-scheme for the page (nativeTheme.themeSource); here the stylesheet's dark
  // rules are switched directly, so a light theme stays light on a dark Windows and the other way round.
  // Same mapping as themeSource() in src/main.js: «Графит» is dark, «Тандем» is light.
  const schemeOf = t => (t === 'graphite' ? 'dark' : t === 'tandem' ? 'light' : t === 'light' || t === 'dark' ? t : 'system');
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
  // true: the webview zooms (Webview.setZoom); false: CSS zoom (older Tauri).
  async function applyZoom(z) {
    const wv = T.webview?.getCurrentWebview?.();
    try { if (!wv?.setZoom) throw new Error('no webview zoom'); await wv.setZoom(z); document.documentElement.style.zoom = ''; return true; }
    catch { document.documentElement.style.zoom = String(z); return false; }
  }
  // The interface marks its title bar with -webkit-app-region: drag; Tauri needs an explicit call.
  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.detail > 1) return;
    if (!e.target.closest('.bar, .drag')) return;
    if (e.target.closest('button, input, select, textarea, label, a, .menu, .tabs, .unlock, .adds, .user-wrap, .grip')) return;
    win.startDragging();
  });

  // One window per project or chat: the label comes from what it shows, so a second ⧉ brings it forward.
  const labelOf = spec => {
    let h = 0x811c9dc5;
    for (const ch of `${spec.kind}:${spec.id}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return `sat-${spec.kind}-${h.toString(36)}`;
  };

  /* ---------- the main window: answers the separate windows, opens them ---------- */
  // Calls a separate window does not forward: they act on that window itself (see satellite()).
  const OWN = new Set(['minimize', 'setMaximized', 'hide', 'setSize', 'reloadWindow', 'onWindowState', 'onData', 'onCabinet',
    'windowOpen', 'windowMain', 'windowDock', 'onWindowMain', 'setCompact', 'setClickThrough', 'hoverUnlock', 'setAlwaysOnTop']);
  function host({ known, focus }) {
    const open = new Set(), mainListeners = [];
    listen('sat:hello', ({ from }) => { if (from) open.add(from); });
    listen('sat:bye', ({ from }) => open.delete(from));
    emit('sat:who', {}); // after a reload of the main window the open ones introduce themselves again
    listen('sat:call', async ({ from, id, method, args }) => {
      let reply;
      try {
        if (OWN.has(method) || typeof known[method] !== 'function') throw new Error(`«${method}» в отдельном окне недоступно.`);
        reply = { ok: true, result: await known[method](...(Array.isArray(args) ? args : [])) };
      } catch (e) { reply = { ok: false, error: String(e?.message || e) }; }
      emit('sat:reply', { to: from, id, ...reply });
    });
    // A separate window hands its page back («В главное окно») or asks to open another project or chat here.
    listen('sat:main', spec => { if (!KINDS.includes(spec.kind) || !spec.id) return; for (const cb of mainListeners) cb(spec); focus(); });

    async function windowOpen(spec) {
      if (!spec || !KINDS.includes(spec.kind) || !spec.id) return { ok: false, message: 'Нечего открыть в отдельном окне.' };
      const label = labelOf(spec);
      const existing = await T.webviewWindow.WebviewWindow.getByLabel(label).catch(() => null);
      if (existing) {
        await existing.unminimize().catch(() => {}); await existing.show().catch(() => {}); await existing.setFocus().catch(() => {});
        return { ok: true, label, existed: true };
      }
      const size = SIZES[spec.kind];
      const opts = {
        url: `index.html?w=${encodeURIComponent(`${spec.kind}:${spec.id}`)}`,
        title: `${String(spec.title || '').slice(0, 80) || (spec.kind === 'project' ? 'Проект' : 'Чат')} — Пульт главспеца`,
        width: size.width, height: size.height, minWidth: 360, minHeight: 280,
        decorations: false, transparent: true, resizable: true, focus: true,
        dragDropEnabled: false, // HTML drag and drop in the page (tabs, kanban) needs this off on Windows
      };
      // Dropped outside the window: the new one appears under the cursor, its title bar where the tab was let go.
      if (Number.isFinite(spec.x) && Number.isFinite(spec.y)) { opts.x = Math.max(0, Math.round(spec.x - 140)); opts.y = Math.max(0, Math.round(spec.y - 18)); }
      return new Promise(resolve => {
        const w = new T.webviewWindow.WebviewWindow(label, opts);
        w.once('tauri://created', () => resolve({ ok: true, label }));
        w.once('tauri://error', e => resolve({ ok: false, message: `Окно не открылось: ${e?.payload ?? 'причина неизвестна'}` }));
      });
    }
    const send = name => payload => { if (open.size) emit(name, payload); };
    return {
      windowOpen,
      onWindowMain: cb => { mainListeners.push(cb); return () => mainListeners.splice(mainListeners.indexOf(cb), 1); },
      data: send('sat:data'), cabinet: send('sat:cabinet'), state: send('sat:state'),
    };
  }

  /* ---------- a separate window: its window.api ---------- */
  function satellite() {
    let seq = 0;
    const pending = new Map(), dataCbs = [], cabCbs = [], winCbs = [];
    listen('sat:reply', ({ to, id, ok, result, error }) => {
      if (to !== LABEL || !pending.has(id)) return;
      const p = pending.get(id);
      pending.delete(id);
      if (ok) p.resolve(result); else p.fail(error);
    });
    // Reading calls fail loudly; changes answer { ok: false, message } like the main window's own refusals.
    const call = (method, args, { strict = false } = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      const fail = msg => (strict ? reject(new Error(msg)) : resolve({ ok: false, message: msg }));
      pending.set(id, { resolve, fail });
      emit('sat:call', { from: LABEL, id, method, args });
      // Long enough for a file dialog the user is looking at.
      setTimeout(() => { if (pending.delete(id)) fail('Главное окно Пульта не отвечает.'); }, 10 * 60 * 1000);
    });
    const hello = () => emit('sat:hello', { from: LABEL });
    hello();
    listen('sat:who', hello);
    window.addEventListener('beforeunload', () => emit('sat:bye', { from: LABEL }));
    listen('sat:data', view => dataCbs.forEach(cb => cb(view)));
    listen('sat:cabinet', v => cabCbs.forEach(cb => cb(v)));

    // The look comes from the main window's settings; size, maximized and the rest belong to this window.
    let shared = null;
    const own = async () => ({ ...shared, compact: false, clickThrough: false, maximized: await win.isMaximized() });
    const pushOwn = async () => { if (!shared) return; const s = await own(); winCbs.forEach(cb => cb(s)); };
    function takeShared(st) {
      shared = st;
      applyScheme(st.theme); applyZoom(st.zoom);
      win.setAlwaysOnTop(st.level === 'top').catch(() => {});
    }
    listen('sat:state', st => { takeShared(st); pushOwn(); });
    win.onResized(() => pushOwn());

    const close = () => { emit('sat:bye', { from: LABEL }); return win.close(); };
    const sub = list => cb => { list.push(cb); return () => list.splice(list.indexOf(cb), 1); };
    const known = {
      getData: async () => ({ ...(await call('getData', [], { strict: true })), warning: null }), // the main window already said it
      getWindowState: async () => { if (!shared) takeShared(await call('getWindowState', [], { strict: true })); return own(); },
      onData: sub(dataCbs), onCabinet: sub(cabCbs), onWindowState: sub(winCbs),
      minimize: () => win.minimize(),
      setMaximized: async on => { (on ? await win.maximize() : await win.unmaximize()); pushOwn(); },
      hide: close, // ✕ and Alt+F4 close a separate window; the main one stays
      setSize: (w, h) => win.setSize(new ((T.dpi && T.dpi.LogicalSize) || T.window.LogicalSize)(w, h)),
      reloadWindow: async () => { location.reload(); return { ok: true }; },
      setCompact: () => {}, setClickThrough: () => {}, hoverUnlock: () => {},
      setAlwaysOnTop: on => call('setLevel', [on ? 'top' : 'normal']),
      windowMain: spec => emit('sat:main', spec),
      windowDock: spec => { emit('sat:main', spec); return close(); },
      onWindowMain: () => () => {},
      fbList: async () => [],
    };
    return new Proxy(known, {
      get(target, name) {
        if (name in target) return target[name];
        if (typeof name !== 'string' || name === 'then' || name === 'windowOpen') return undefined;
        if (/^on[A-Z]/.test(name)) return () => () => {};
        return (...args) => call(name, args);
      },
    });
  }

  const isSatellite = LABEL !== 'main';
  window.TauriWindows = { isSatellite, label: LABEL, host, look: { applyScheme, applyZoom } };
  if (isSatellite) window.api = satellite();
})();

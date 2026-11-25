'use strict';
// The Tauri window without Tauri, for checks in Chromium (check-ui.js, test/smoke-host.js): window.__TAURI__ with a
// stand-in window that remembers its place and what was asked of it. Commands go to window.__rust(cmd, args), events
// between windows to window.__bus(name, payload) — both given by the check (Playwright exposeBinding).
// Runs inside the page (addInitScript): no Node here.
module.exports = function stubTauriWindow() {
  try { Object.defineProperty(navigator, 'userAgentData', { value: { getHighEntropyValues: async () => ({ platformVersion: '15.0.0' }) } }); } catch { /* keep */ }
  // A stand-in window that remembers its place and what was asked of it.
  const w = window.__win = { x: 0, y: 0, width: 1320, height: 860, visible: false, top: null, skip: null, min: null, calls: [] };
  const sp = new URLSearchParams(location.search).get('w');
  const label = sp ? 'sat-' + sp.replace(/[^a-z0-9]/gi, '') : 'main';
  const listeners = {};
  const win = { label, close: async () => { w.calls.push('close'); window.__bus('__close', label); }, setFocus: async () => { w.calls.push('focus'); }, unminimize: async () => {}, isMaximized: async () => !!w.max, isMinimized: async () => false, isVisible: async () => w.visible, onResized: () => {}, onMoved: () => {}, onFocusChanged: () => {},
    minimize: async () => {},
    // Maximized = the work area of the screen (1920×1080 without a 40 px taskbar); back to the place before.
    maximize: async () => { if (!w.max) { w.max = { x: w.x, y: w.y, width: w.width, height: w.height }; Object.assign(w, { x: 0, y: 0, width: 1920, height: 1040 }); } },
    unmaximize: async () => { if (w.max) { Object.assign(w, w.max); w.max = null; } }, startDragging: async () => {},
    setSize: async s => { w.width = s.width; w.height = s.height; }, setPosition: async p => { w.x = p.x; w.y = p.y; }, setMinSize: async s => { w.min = s; },
    outerPosition: async () => ({ x: w.x, y: w.y }), outerSize: async () => ({ width: w.width, height: w.height }), scaleFactor: async () => 1,
    show: async () => { w.visible = true; w.calls.push('show'); }, hide: async () => { w.visible = false; w.calls.push('hide'); },
    setAlwaysOnTop: async on => { w.top = on; }, setSkipTaskbar: async on => { w.skip = on; }, setTheme: async () => {}, setIgnoreCursorEvents: async () => {},
    setEffects: async e => { w.calls.push('fx:' + e.effects.join()); }, clearEffects: async () => { w.calls.push('fx:none'); }, isFocused: async () => w.focused !== false };
  function Size(width, height) { this.width = width; this.height = height; }
  function Pos(x, y) { this.x = x; this.y = y; }
  window.__emit = (name, payload) => (listeners[name] || []).forEach(f => f({ payload }));
  function WebviewWindow(lbl, opts) { window.__bus('__open', { label: lbl, opts }); this.once = (ev, f) => { if (ev === 'tauri://created') setTimeout(() => f({}), 10); }; }
  WebviewWindow.getByLabel = async () => null;
  window.__TAURI__ = { core: { invoke: (c, a) => window.__rust(c, a || {}) }, event: { listen: async (n, f) => { (listeners[n] ||= []).push(f); }, emit: async (n, x) => window.__bus(n, x) },
    webviewWindow: { WebviewWindow },
    dpi: { LogicalSize: Size, LogicalPosition: Pos, PhysicalSize: Size, PhysicalPosition: Pos },
    window: { getCurrentWindow: () => win, availableMonitors: async () => [{ position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, scaleFactor: 1 }], cursorPosition: async () => ({ x: 0, y: 0 }) },
    webview: { getCurrentWebview: () => ({ setZoom: async () => {} }) } };

};

'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen, shell, dialog, Notification, nativeTheme, safeStorage } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store, Settings, StoreError, COLLECTIONS } = require('./store');
const L = require('./renderer/logic');
const A = require('./renderer/access');
const { buildReport } = require('./report/model');
const { buildXlsx, buildCompositionXlsx } = require('./report/xlsx');
const { buildDocx, buildCompositionDocx } = require('./report/docx');
const { customerHtml, pageModel } = require('./report/customer');
const { fillTemplate, TemplateError, TEMPLATES } = require('./report/doc-template');
const { Cabinet, normalizeUrl, isLocalHost, KINDS: CAB_KINDS } = require('./cabinet');
const Composition = require('./renderer/composition.js');
const { readTableBytes, ImportError } = require('./import/read');
const { contactUrl } = require('./contact');
const { DesktopLevel } = require('./desktop-level');
const { Journal, diffBatch } = require('./journal');
const { Feedback } = require('./feedback'); // testing aid: notes on the interface
const createCore = require('./core/handlers');
const createChats = require('./core/chats');
const createFiles = require('./core/files');

const APP_TITLE = 'Пульт главспеца';
const APP_ID = 'ru.glavspec.widget';
const HOTKEY = 'CommandOrControl+Alt+G';
const FULL_DEFAULT = { width: 1080, height: 700 };
const COMPACT_DEFAULT = { width: 360, height: 440 };
const MIN = { full: { width: 560, height: 360 }, compact: { width: 280, height: 200 } };
const TRASH_DAYS = 30;
const ASSETS = path.join(__dirname, '..', 'assets');

// Keep data in an ASCII-named folder: %APPDATA%\GlavspecWidget
app.setPath('userData', path.join(app.getPath('appData'), 'GlavspecWidget'));
app.setAppUserModelId(APP_ID);
// Russian UI locale for native controls (date pickers show дд.мм.гггг regardless of the Windows language).
app.commandLine.appendSwitch('lang', 'ru');

let win = null;
let tray = null;
let store = null;
let settings = null;
let clickThrough = false; // deliberately not persisted: the app must never start un-clickable
let quitting = false;
let journal = null;
let feedback = null;
let cabinet = null;
let localCab = null; // the cabinet server running inside this app: { server, store, port, teamKey }
const desktop = new DesktopLevel();
const LEVELS = { top: 'Поверх всех окон', normal: 'Обычное окно', desktop: 'На рабочем столе' };
const THEMES = { system: 'Как в Windows', light: 'Светлая', dark: 'Тёмная', graphite: 'Графит', tandem: 'Тандем' };
// The page's own colour scheme for each theme: «Графит» is a dark style of its own.
const themeSource = theme => (theme === 'graphite' ? 'dark' : theme === 'tandem' ? 'light' : THEMES[theme] ? theme : 'system');
const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

function windowState() {
  return {
    alwaysOnTop: settings.get('windowLevel') === 'top',
    level: settings.get('windowLevel'),
    desktopSupported: desktop.supported,
    theme: settings.get('theme'),
    zoom: settings.get('zoom'),
    compact: settings.get('compact'),
    maximized: !!maximized,
    opacity: settings.get('opacity'),
    clickThrough,
    autostart: app.getLoginItemSettings().openAtLogin,
    hotkey: 'Ctrl+Alt+G',
  };
}

function broadcastState() {
  if (win && !win.isDestroyed()) win.webContents.send('win:state', windowState());
  refreshTrayMenu();
}

// Restored bounds may point at a monitor that is no longer connected.
function fitToDisplay(bounds, fallback) {
  if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    const visible = screen.getAllDisplays().some(d => {
      const a = d.workArea;
      return bounds.x < a.x + a.width - 40 && bounds.x + bounds.width > a.x + 40 && bounds.y >= a.y - 10 && bounds.y < a.y + a.height - 40;
    });
    if (visible) return bounds;
  }
  const a = screen.getPrimaryDisplay().workArea;
  const w = Math.min(fallback.width, a.width), h = Math.min(fallback.height, a.height);
  return { width: w, height: h, x: a.x + a.width - w - 24, y: a.y + 24 };
}

function boundsKey() { return settings.get('compact') ? 'compactBounds' : 'fullBounds'; }

function createWindow() {
  const compact = settings.get('compact');
  const bounds = fitToDisplay(settings.get(boundsKey()), compact ? COMPACT_DEFAULT : FULL_DEFAULT);
  win = new BrowserWindow({
    ...bounds,
    minWidth: MIN.full.width,
    minHeight: MIN.full.height,
    title: APP_TITLE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    show: false,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  applyMinSize();
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); applyLevel(); });
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(settings.get('zoom')));
  // Desktop mode: whenever the window loses focus it goes back under the other windows.
  win.on('blur', () => { if (settings.get('windowLevel') === 'desktop') desktop.sendToBottom(win); });
  win.on('show', () => { if (settings.get('windowLevel') === 'desktop') setTimeout(() => desktop.sendToBottom(win), 50); });
  // Ctrl+wheel belongs to the Gantt chart; never let Chromium zoom the whole page by it.
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});

  let saveTimer = null;
  const rememberBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { if (win && !win.isDestroyed() && !win.isMinimized() && !maximized) settings.set({ [boundsKey()]: win.getBounds() }); }, 400);
  };
  win.on('moved', rememberBounds);
  // Windows maximizes on a double click in the drag area; do it our way so the transparent window behaves.
  win.on('maximize', () => { win.unmaximize(); setMaximized(true); });
  win.on('resized', rememberBounds);

  // The close button hides to the tray; quitting goes through the tray menu.
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });

  // Never let the page navigate away or open windows.
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function applyMinSize() {
  const m = settings.get('compact') ? MIN.compact : MIN.full;
  win.setMinimumSize(m.width, m.height);
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function setClickThrough(on) {
  clickThrough = !!on;
  win.setIgnoreMouseEvents(clickThrough, { forward: true });
  if (clickThrough) showWindow();
  broadcastState();
}

// «На весь экран»: the window fills the work area of its monitor (taskbar stays visible).
// Done by hand: Windows does not maximize transparent frameless windows reliably.
let maximized = null; // bounds to restore, or null
function setMaximized(on) {
  if (!win || win.isDestroyed() || !!on === !!maximized) return;
  if (on) {
    if (settings.get('compact')) setCompact(false);
    maximized = win.getBounds();
    win.setBounds(screen.getDisplayMatching(maximized).workArea);
  } else {
    const back = maximized;
    maximized = null;
    win.setBounds(fitToDisplay(back, FULL_DEFAULT));
  }
  broadcastState();
}

function setCompact(on) {
  if (!!on === settings.get('compact')) return;
  if (on && maximized) setMaximized(false);
  settings.set({ [boundsKey()]: win.getBounds() });
  settings.set({ compact: !!on });
  applyMinSize();
  const cur = win.getBounds();
  const target = settings.get(boundsKey());
  const fallback = on ? COMPACT_DEFAULT : FULL_DEFAULT;
  // Without saved bounds, keep the window's right edge in place so it stays where the user put it.
  const next = target ? fitToDisplay(target, fallback)
    : fitToDisplay({ ...fallback, x: cur.x + cur.width - fallback.width, y: cur.y }, fallback);
  win.setBounds(next);
  broadcastState();
}

function applyLevel() {
  if (!win || win.isDestroyed()) return;
  const level = settings.get('windowLevel');
  win.setAlwaysOnTop(level === 'top', 'floating');
  // A desktop widget has no taskbar button; it is reached via the tray icon.
  win.setSkipTaskbar(level === 'desktop');
  if (level === 'desktop') desktop.sendToBottom(win);
}
function setWindowLevel(level) {
  if (!LEVELS[level]) return;
  settings.set({ windowLevel: level });
  applyLevel();
  broadcastState();
}
function setAlwaysOnTop(on) { setWindowLevel(on ? 'top' : 'normal'); }
function setTheme(theme) {
  if (!THEMES[theme]) return;
  settings.set({ theme });
  nativeTheme.themeSource = themeSource(theme); // drives prefers-color-scheme in the page
  broadcastState();
}
function setZoom(z) {
  const zoom = Math.round(Math.min(1.5, Math.max(0.8, Number(z) || 1)) * 100) / 100;
  settings.set({ zoom });
  if (win && !win.isDestroyed()) win.webContents.setZoomFactor(zoom);
  broadcastState();
}

function setAutostart(on) {
  app.setLoginItemSettings({ openAtLogin: !!on });
  broadcastState();
}

/* ---------- notifications ---------- */
/* ---------- users and access ---------- */
// Who works, what they see, checked writes, comments, the trash: src/core/handlers.js (shared with the Tauri version).
let core = null;
const currentUser = () => core.currentUser();
const userView = () => core.userView();
const workingTasks = () => L.visible(userView()).tasks;

// Windows shows toasts only for apps with a Start menu shortcut carrying the same AppUserModelID.
function ensureStartMenuShortcut() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_TITLE}.lnk`);
    const options = { target: process.execPath, appUserModelId: APP_ID, description: 'Проекты, разделы, исполнители, сроки и оплата' };
    const ico = path.join(ASSETS, 'icon.ico');
    if (fs.existsSync(ico)) Object.assign(options, { icon: ico, iconIndex: 0 });
    shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'update' : 'create', options);
  } catch (e) {
    console.warn('Не удалось обновить ярлык в меню «Пуск»:', e.message);
  }
}

function notify(body, { silent = false } = {}) {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title: APP_TITLE, body, icon: path.join(ASSETS, 'icon.png'), silent });
  n.on('click', showWindow);
  n.show();
  return true;
}

function morningDigest(force = false) {
  const today = L.todayStr();
  const text = L.digestText(workingTasks(), today, { money: A.canSeeMoney(currentUser()) });
  if (force) return notify(text || 'Всё по плану: просрочек, сдач в ближайшие дни, проверок и платежей нет.');
  if (!settings.get('notify') || settings.get('lastDigest') === today) return false;
  if (new Date().getHours() < settings.get('notifyHour')) return false;
  settings.set({ lastDigest: today });
  return text ? notify(text) : false;
}

// The tooltip summary walks all cards; after a burst of saves it is enough to rebuild it once.
let tooltipTimer = null;
function updateTrayTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(updateTrayTooltipNow, 800);
}
function updateTrayTooltipNow() {
  if (!tray) return;
  const text = L.digestText(workingTasks(), L.todayStr(), { money: A.canSeeMoney(currentUser()) });
  const tip = `${APP_TITLE} — ${text || 'всё по плану'}`;
  tray.setToolTip(tip.length > 120 ? tip.slice(0, 119) + '…' : tip);
}

/* ---------- tray ---------- */
function trayIcon() {
  const img = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function refreshTrayMenu() {
  if (!tray) return;
  const s = windowState();
  const hour = settings.get('notifyHour');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Показать', click: showWindow },
    { type: 'separator' },
    { label: 'Положение окна', submenu: Object.entries(LEVELS).map(([k, l]) => ({ label: l, type: 'radio', checked: s.level === k, enabled: k !== 'desktop' || desktop.supported, click: () => setWindowLevel(k) })) },
    { label: 'Тема', submenu: Object.entries(THEMES).map(([k, l]) => ({ label: l, type: 'radio', checked: s.theme === k, click: () => setTheme(k) })) },
    { label: 'Масштаб', submenu: ZOOMS.map(z => ({ label: `${Math.round(z * 100)}%`, type: 'radio', checked: Math.abs(s.zoom - z) < 0.001, click: () => setZoom(z) })) },
    { label: 'Сквозные клики', type: 'checkbox', checked: s.clickThrough, accelerator: HOTKEY, click: i => setClickThrough(i.checked) },
    { label: 'Компактный режим', type: 'checkbox', checked: s.compact, click: i => setCompact(i.checked) },
    { type: 'separator' },
    { label: `Утренняя сводка в уведомлениях (с ${hour}:00)`, type: 'checkbox', checked: settings.get('notify'), click: i => { settings.set({ notify: i.checked }); refreshTrayMenu(); } },
    { label: 'Время сводки', submenu: [7, 8, 9, 10, 11].map(h => ({ label: `${h}:00`, type: 'radio', checked: hour === h, click: () => { settings.set({ notifyHour: h, lastDigest: null }); refreshTrayMenu(); } })) },
    { label: 'Показать сводку сейчас', click: () => { if (!morningDigest(true)) dialog.showMessageBox({ message: 'Уведомления Windows недоступны. Проверьте «Параметры → Система → Уведомления».' }); } },
    { type: 'separator' },
    { label: 'Запускать вместе с Windows', type: 'checkbox', checked: s.autostart, click: i => setAutostart(i.checked) },
    { label: 'Открыть папку с данными', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.on('click', showWindow);
  refreshTrayMenu();
  updateTrayTooltip();
}

/* ---------- trash ---------- */

/* ---------- customer cabinet ---------- */
// The GIP contact shown to the customer: the project's «контакт для заказчика».
// Project team for the customer page: participants with a customer-readable role («ГИП», «главный специалист,
// электрика», «инженер, слаботочка»). The contact person is shown separately and skipped here.
// The customer page's team and contact: src/core/files.js.
const customerTeam = p => files.customerTeam(p);
const customerContact = p => files.customerContact(p);
// What the cabinet gets for a project: the same customer-safe model as the HTML page, built from the full
// project record and the cards the current user sees. null when the user may not publish it.
/* ---------- files: src/core/files.js (shared with the Tauri version); Windows side here ---------- */
let files = null;
// Built-in files the shared code asks for: the logo, fonts of the customer page, the office's Word templates.
const ASSET_DIRS = { brand: path.join(__dirname, 'renderer', 'brand'), fonts: path.join(__dirname, 'renderer', 'fonts'), templates: path.join(__dirname, 'report', 'templates') };
function electronIo() {
  const filtersOf = list => (list || []).map(f => ({ name: f.name, extensions: f.extensions }));
  return {
    async saveDialog({ title, defaultPath, filters }) { const r = await dialog.showSaveDialog(win, { title, defaultPath, filters: filtersOf(filters) }); return r.canceled ? null : r.filePath || null; },
    async openDialog({ title, defaultPath, filters, directory }) {
      const r = await dialog.showOpenDialog(win, { title, defaultPath, filters: directory ? undefined : filtersOf(filters), properties: directory ? ['openDirectory', 'createDirectory'] : ['openFile'] });
      return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
    },
    async confirm({ title, message, detail, ok }) {
      const { response } = await dialog.showMessageBox(win, { type: 'warning', buttons: [ok || 'Да', 'Отмена'], defaultId: 1, cancelId: 1, noLink: true, title, message, detail });
      return response === 0;
    },
    writeFile: async (file, data) => fs.writeFileSync(file, data, typeof data === 'string' ? 'utf8' : undefined),
    readFile: async file => fs.readFileSync(file),
    exists: async file => fs.existsSync(file),
    mkdir: async dir => { fs.mkdirSync(dir, { recursive: true }); },
    copyFile: async (from, to) => fs.copyFileSync(from, to),
    listDir: async dir => fs.readdirSync(dir),
    remove: async file => fs.unlinkSync(file),
    openPath: file => shell.openPath(file),
    openExternal: url => shell.openExternal(url),
    async pdf(html, target) {
      const pdfWin = new BrowserWindow({ show: false, width: 1240, height: 1600, webPreferences: { sandbox: true, javascript: false } });
      try {
        await pdfWin.loadURL('data:text/html;charset=utf-8;base64,' + Buffer.from(html).toString('base64'));
        fs.writeFileSync(target, await pdfWin.webContents.printToPDF({ pageSize: 'A4', landscape: true, printBackground: true, margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } }));
        return { ok: true };
      } finally { pdfWin.destroy(); }
    },
    async asset(rel) { const [dir, ...rest] = rel.split('/'); if (!ASSET_DIRS[dir]) throw new Error('нет такого файла: ' + rel); return fs.readFileSync(path.join(ASSET_DIRS[dir], ...rest)); },
    dirs: () => ({ documents: app.getPath('documents'), userData: app.getPath('userData') }),
    join: (...p) => path.join(...p), dirname: p => path.dirname(p), basename: p => path.basename(p), extname: p => path.extname(p),
  };
}

/* ---------- messenger: src/core/chats.js (shared with the Tauri version) ---------- */
let chats = null;


function cabinetModel(projectId) {
  const me = currentUser();
  if (!me || A.isSpecialist(me)) return null;
  const view = userView();
  const p = store.data.projects[projectId];
  if (!p || p.deletedAt || !view.projects.some(x => x.id === projectId)) return null;
  return pageModel({ project: { ...p, id: projectId }, tasks: view.tasks, contact: customerContact(p), team: customerTeam(p), today: L.todayStr() });
}
// The team key is kept encrypted with Windows DPAPI when available (safeStorage), never sent to the window.
function cabinetKey() {
  const v = settings.get('cabinetKey') || '';
  if (v.startsWith('enc:')) {
    try { return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64')); } catch { return ''; }
  }
  return v.startsWith('plain:') ? v.slice(6) : '';
}
function storeCabinetKey(key) {
  if (!key) return settings.set({ cabinetKey: '' });
  const enc = safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(key).toString('base64') : 'plain:' + key;
  settings.set({ cabinetKey: enc });
}
const canUseCabinet = me => !!me && !A.isSpecialist(me);
// The window's view of the cabinet: messages only for projects the user sees.
function cabinetView() {
  const me = currentUser();
  if (!canUseCabinet(me)) return { allowed: false };
  const visible = new Set(userView().projects.map(p => p.id));
  const url = normalizeUrl(settings.get('cabinetUrl')) || '';
  const st = cabinet.state;
  return {
    allowed: true, url, hasKey: !!cabinetKey(), local: localCab ? { port: localCab.port, lan: lanUrls(localCab.port) } : null,
    // The address to give customers: for the built-in server the office-network address, not «localhost».
    publicUrl: localCab ? (lanUrls(localCab.port)[0] || url) : url, configured: cabinet.configured(), insecure: !!url && url.startsWith('http:') && !isLocalHost(url),
    lastSync: st.lastSync, lastError: st.lastError, published: st.published,
    messages: st.messages.filter(m => visible.has(m.projectId)).slice(-300).reverse(),
  };
}
function sendCabinet() { if (win && !win.isDestroyed()) win.webContents.send('cabinet:changed', cabinetView()); }
let cabinetBusy = false;
// Every two minutes: re-send changed published projects, take new messages, notify about them.
async function cabinetSync({ quiet = false } = {}) {
  if (!cabinet?.configured() || cabinetBusy) return { ok: false, message: 'Кабинет не настроен.' };
  cabinetBusy = true;
  try {
    const me = currentUser();
    if (canUseCabinet(me)) await cabinet.refreshPublished(cabinetModel);
    const fresh = await cabinet.poll();
    const visible = new Set(userView().projects.map(p => p.id));
    const mine = canUseCabinet(me) ? fresh.filter(m => visible.has(m.projectId)) : [];
    if (mine.length && !quiet) {
      const urgent = mine.find(m => m.kind === 'urgent');
      const m = urgent || mine[0];
      notify(mine.length === 1 ? `${CAB_KINDS[m.kind]} — ${m.projectName}: ${m.text.slice(0, 120)}` : `От заказчиков: ${mine.length} новых сообщения${urgent ? ', есть горящий вопрос' : ''}.`, { silent: false });
    }
    return { ok: true, fresh: mine.length };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    cabinetBusy = false;
    sendCabinet();
  }
}
// Runs a team-API call on behalf of the window with the same guard and error shape everywhere.
async function cabinetCall(fn) {
  if (!canUseCabinet(currentUser())) return { ok: false, message: 'Кабинетом заказчика управляют ГИП и главспецы.' };
  try { return { ok: true, ...(await fn()) }; }
  catch (e) { return { ok: false, message: e.message }; }
  finally { sendCabinet(); }
}
// «Кабинет на этом компьютере»: the same server, started inside the app. Customers in the office network
// open http://<this PC's address>:<port>; Windows asks once whether to allow the app in the firewall.
const lanUrls = port => Object.values(os.networkInterfaces()).flat()
  .filter(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')).map(a => `http://${a.address}:${port}`);
async function startLocalCabinet() {
  if (localCab) return localCab;
  const { createServer } = require('../server/cabinet-server.js');
  const dir = path.join(app.getPath('userData'), 'cabinet-server');
  let lastError = null;
  const first = Number(settings.get('cabinetLocalPort')) || 8080;
  for (let port = first; port < first + 10 && !localCab; port++) {
    const s = createServer({ dataDir: dir, port, host: '0.0.0.0', configFile: path.join(dir, 'config.json') });
    try {
      await new Promise((resolve, reject) => { s.server.once('error', reject); s.server.listen(port, '0.0.0.0', resolve); });
      localCab = { ...s, port };
    } catch (e) {
      lastError = e;
      if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') break;
    }
  }
  if (!localCab) throw new Error(`Не удалось запустить кабинет: ${lastError?.code === 'EADDRINUSE' ? `порты ${first}–${first + 9} заняты другими программами` : lastError?.message}.`);
  settings.set({ cabinetLocal: true, cabinetLocalPort: localCab.port, cabinetUrl: `http://localhost:${localCab.port}` });
  storeCabinetKey(localCab.teamKey());
  return localCab;
}
async function stopLocalCabinet() {
  if (!localCab) return;
  const s = localCab;
  localCab = null;
  s.store.flush();
  await new Promise(r => { s.server.close(() => r()); s.server.closeAllConnections?.(); });
}

function registerCabinetIpc() {
  ipcMain.handle('cabinet:local-start', async () => {
    if (!canUseCabinet(currentUser())) return { ok: false, message: 'Кабинет запускают ГИП и главспецы.' };
    try {
      const prevUrl = normalizeUrl(settings.get('cabinetUrl'));
      const s = await startLocalCabinet();
      if (prevUrl && prevUrl !== `http://localhost:${s.port}`) cabinet.forgetPublished();
      cabinetSync({ quiet: true });
      return { ok: true, port: s.port, lan: lanUrls(s.port) };
    } catch (e) { return { ok: false, message: e.message }; } finally { sendCabinet(); }
  });
  ipcMain.handle('cabinet:local-stop', async () => {
    if (!canUseCabinet(currentUser())) return { ok: false, message: 'Кабинет останавливают ГИП и главспецы.' };
    await stopLocalCabinet();
    settings.set({ cabinetLocal: false, cabinetUrl: '' });
    storeCabinetKey('');
    sendCabinet();
    return { ok: true };
  });
  ipcMain.handle('cabinet:get', () => cabinetView());
  ipcMain.handle('cabinet:configure', async (_e, { url, key } = {}) => {
    if (!canUseCabinet(currentUser())) return { ok: false, message: 'Кабинет настраивают ГИП и главспецы.' };
    const norm = normalizeUrl(url);
    if (url && !norm) return { ok: false, message: 'Адрес сервера не похож на адрес сайта.' };
    const prevUrl = settings.get('cabinetUrl'), prevKey = settings.get('cabinetKey');
    if (localCab && norm !== `http://localhost:${localCab.port}`) { await stopLocalCabinet(); settings.set({ cabinetLocal: false }); }
    settings.set({ cabinetUrl: norm || '' });
    if (key !== undefined && key !== null && String(key).trim() !== '') storeCabinetKey(String(key).trim());
    if (!norm) { storeCabinetKey(''); sendCabinet(); return { ok: true, off: true }; }
    try {
      const r = await cabinet.ping();
      if (prevUrl && normalizeUrl(prevUrl) !== norm) cabinet.forgetPublished(); // another server: start over
      sendCabinet();
      cabinetSync({ quiet: true });
      return { ok: true, version: r.version, projects: r.projects, customers: r.customers };
    } catch (e) {
      settings.set({ cabinetUrl: prevUrl, cabinetKey: prevKey }); // keep the working settings
      sendCabinet();
      return { ok: false, message: e.message };
    }
  });
  ipcMain.handle('cabinet:sync', () => cabinetSync({ quiet: true }));
  ipcMain.handle('cabinet:publish', (_e, projectId) => cabinetCall(async () => {
    const m = cabinetModel(projectId);
    if (!m) throw new Error('Проект не найден или недоступен.');
    return { published: await cabinet.publish(projectId, m) };
  }));
  ipcMain.handle('cabinet:unpublish', (_e, projectId) => cabinetCall(async () => { await cabinet.unpublish(projectId); return {}; }));
  ipcMain.handle('cabinet:customers', () => cabinetCall(async () => ({ customers: await cabinet.customers() })));
  ipcMain.handle('cabinet:customer-create', (_e, c = {}) => cabinetCall(() => cabinet.createCustomer({ name: String(c.name || '').slice(0, 120), login: String(c.login || '').slice(0, 80), projectIds: (c.projectIds || []).map(String) })));
  ipcMain.handle('cabinet:customer-update', (_e, id, patch = {}) => cabinetCall(() => {
    const allowed = {};
    if (Array.isArray(patch.projectIds)) allowed.projectIds = patch.projectIds.map(String);
    if (patch.name !== undefined) allowed.name = String(patch.name).slice(0, 120);
    if (patch.disabled !== undefined) allowed.disabled = !!patch.disabled;
    if (patch.resetPassword) allowed.resetPassword = true;
    return cabinet.updateCustomer(String(id), allowed);
  }));
  ipcMain.handle('cabinet:customer-delete', (_e, id) => cabinetCall(() => cabinet.deleteCustomer(String(id))));
  ipcMain.handle('cabinet:read', (_e, ids, read = true) => {
    if (!canUseCabinet(currentUser())) return { ok: false };
    cabinet.markRead((Array.isArray(ids) ? ids : []).map(String), read !== false);
    sendCabinet();
    return { ok: true };
  });
  ipcMain.handle('cabinet:open', (_e, projectId) => {
    const url = normalizeUrl(settings.get('cabinetUrl'));
    if (!url) return { ok: false, message: 'Кабинет не настроен.' };
    shell.openExternal(projectId ? `${url}/p/${encodeURIComponent(projectId)}` : url);
    return { ok: true };
  });
}

/* ---------- IPC ---------- */
function sendData() { if (win && !win.isDestroyed()) win.webContents.send('data:changed', userView()); }

function registerIpc() {
  ipcMain.handle('data:get', () => ({ data: userView(), warning: store.warning }));
  // Local profiles: switching is for trying the roles out on one computer, not a security boundary.
  // Reload of the window (own view per user after a switch); location.reload() is stopped by the will-navigate guard.
  ipcMain.handle('win:reload', () => { win?.webContents.reload(); return { ok: true }; });
  ipcMain.handle('user:switch', (_e, id) => core.switchUser(id));
  ipcMain.handle('data:write', (_e, ops, meta = {}) => core.write(ops, meta));
  // Opening a card clearsOpening a card clears its «new» mark for the current user. Not journaled, not undoable.
  ipcMain.handle('task:seen', (_e, id) => core.taskSeen(id));
  // Card discussion: anyone who sees the card may write; its people and their chiefs get a «new» mark.
  ipcMain.handle('task:comment', (_e, id, text) => core.taskComment(id, text));
  ipcMain.handle('task:comment-edit', (_e, id, commentId, text) => core.taskCommentEdit(id, commentId, text));
  ipcMain.handle('chat:send', (_e, ...a) => chats.send(...a));
  ipcMain.handle('chat:edit', (_e, ...a) => chats.edit(...a));
  ipcMain.handle('chat:seen', (_e, ...a) => chats.seen(...a));
  ipcMain.handle('chat:direct', (_e, ...a) => chats.direct(...a));
  ipcMain.handle('chat:create', (_e, ...a) => chats.create(...a));
  ipcMain.handle('chat:update', (_e, ...a) => chats.update(...a));
  ipcMain.handle('chat:leave', (_e, ...a) => chats.leave(...a));
  ipcMain.handle('chat:seed-demo', (_e, ...a) => chats.seedDemo(...a));

  // Removes every sample record, including those outside the current user's view.
  ipcMain.handle('demo:clear', () => core.demoClear());
  // The journal is filtered like the data: only cards the user sees, without money for those without access.
  ipcMain.handle('journal:get', (_e, opts) => core.journalGet(opts));
  ipcMain.on('win:set-level', (_e, level) => setWindowLevel(level));
  ipcMain.on('win:set-theme', (_e, theme) => setTheme(theme));
  ipcMain.on('win:set-zoom', (_e, z) => setZoom(z));
  ipcMain.handle('win:get-state', () => windowState());
  ipcMain.on('win:set-opacity', (_e, v) => {
    const n = Number(v);
    if (Number.isFinite(n)) settings.set({ opacity: Math.min(1, Math.max(0.25, n)) });
  });
  ipcMain.on('win:set-always-on-top', (_e, on) => setAlwaysOnTop(on));
  ipcMain.on('win:set-click-through', (_e, on) => setClickThrough(on));
  // While click-through is on, the page re-enables the mouse only over its unlock handle.
  ipcMain.on('win:hover-unlock', (_e, over) => {
    if (clickThrough && win) win.setIgnoreMouseEvents(!over, { forward: true });
  });
  ipcMain.on('win:set-compact', (_e, on) => setCompact(on));
  ipcMain.on('win:minimize', () => win && win.minimize());
  ipcMain.on('win:set-maximized', (_e, on) => setMaximized(on));
  ipcMain.on('win:hide', () => win && win.hide());
  ipcMain.on('win:set-size', (_e, w, h) => {
    if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return;
    const [minW, minH] = win.getMinimumSize();
    const a = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setSize(Math.round(Math.min(a.width, Math.max(minW, w))), Math.round(Math.min(a.height, Math.max(minH, h))));
  });
  ipcMain.on('app:open-data-folder', () => shell.openPath(app.getPath('userData')));

  ipcMain.handle('report:export', (_e, format, scope) => files.exportReport(format, scope));
  // Opens only the file this app just saved, never an arbitrary path from the page.
  ipcMain.on('report:open-last', () => files.openLast());

  // The page passes a project id; the folder path is taken from the stored record.
  ipcMain.handle('project:open-folder', (_e, id) => files.openProjectFolder(id));
  // A section's own folder (drawings of one mark); the path comes from the stored card, never from the page.
  ipcMain.handle('task:open-folder', (_e, id) => files.openTaskFolder(id));
  // «Спасибо» under a comment: one per person, not for own comments; toggles. Not undoable, journaled briefly.
  ipcMain.handle('task:thank', (_e, id, commentId) => core.taskThank(id, commentId));
  // Customer page of one project: one HTML file (logo and font inside) or the same page printed to PDF.
  // Built from the full project record (the plan incl. «Договор»), cards as the user sees them; no money, no contractors.
  ipcMain.handle('report:customer-page', (_e, projectId, opts) => files.customerPage(projectId, opts));
  // «Состав проектной документации» of a project: Word or Excel, form after ГОСТ Р 21.101.
  // «Состав проектной документации» and «Ведомость основных комплектов рабочих чертежей»:
  // Word from the office's templates (sp / vok), or both lists in one Excel workbook.
  ipcMain.handle('report:composition', (_e, projectId, format, opts) => files.composition(projectId, format, opts));
  // Defaults for the export dialog: the director last typed, the folder with the user's own templates.
  ipcMain.handle('report:doc-defaults', () => files.docDefaults());
  ipcMain.handle('report:open-templates', () => files.openTemplates());
  ipcMain.handle('project:pick-folder', (_e, current) => files.pickFolder(current));

  // Opens mail / WhatsApp / Telegram for a stored contractor; the URL is built here, never taken from the page.
  ipcMain.handle('contact:open', (_e, args) => files.contactOpen(args));

  // Interface notes for the developer (testing aid).
  ipcMain.handle('fb:list', () => feedback.list());
  ipcMain.handle('fb:add', async (_e, note) => {
    let png = null;
    const r = note?.rect;
    if (r && r.width > 2 && r.height > 2 && win) {
      try {
        // A little context around the element; the rect comes in CSS pixels of the page (zoom applied by Electron).
        const z = win.webContents.getZoomFactor(), pad = 24, [w, h] = win.getContentSize();
        const x = Math.max(0, Math.floor((r.x - pad) * z)), y = Math.max(0, Math.floor((r.y - pad) * z));
        const rect = { x, y, width: Math.min(w - x, Math.ceil((r.width + pad * 2) * z)), height: Math.min(h - y, Math.ceil((r.height + pad * 2) * z)) };
        if (rect.width > 0 && rect.height > 0) png = (await win.webContents.capturePage(rect)).toPNG();
      } catch (e) { console.warn('Скриншот пометки:', e.message); }
    }
    const me = currentUser();
    return feedback.add({ ...note, user: me?.name || '', role: me ? A.ROLES[me.role]?.label : '' }, png);
  });
  ipcMain.handle('fb:update', (_e, id, text) => feedback.update(id, text));
  ipcMain.handle('fb:delete', (_e, id) => feedback.remove(id));
  ipcMain.handle('fb:clear', () => { feedback.clear(); return true; });
  ipcMain.handle('fb:export', async () => {
    const { zip, count } = feedback.exportZip({ version: app.getVersion() });
    if (!count) return { ok: false, message: 'Пометок пока нет.' };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Выгрузить пометки для разработчика',
      defaultPath: path.join(app.getPath('documents'), `Пометки Пульт главспеца ${L.todayStr()}.zip`),
      filters: [{ name: 'Архив ZIP', extensions: ['zip'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    try { fs.writeFileSync(filePath, zip); return { ok: true, name: path.basename(filePath), count }; }
    catch (e) { return { ok: false, message: `Не удалось сохранить: ${e.message}` }; }
  });

  // Automatic copy (3.6): once a day into a folder the GIP chose (flash drive, network share), the last 14 kept.
  ipcMain.handle('autobackup:get', () => files.autoBackupGet());
  ipcMain.handle('autobackup:set', (_e, off) => files.autoBackupSet(off));
  ipcMain.handle('backup:save', () => files.backupSave());

  ipcMain.handle('backup:restore', () => files.backupRestore());

  ipcMain.handle('import:pick', () => files.importPick());
}


/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    store = new Store(app.getPath('userData'));
    chats = createChats({ store, A, currentUser: () => core.currentUser(), changed: () => sendData() });
    try { chats.migrateProjectChats(); } catch (e) { console.error('chat migration', e); }
    settings = new Settings(app.getPath('userData'), {
      alwaysOnTop: true, compact: false, opacity: 0.82, fullBounds: null, compactBounds: null,
      notify: true, notifyHour: 9, lastDigest: null,
      windowLevel: null, theme: 'system', zoom: 1, cabinetUrl: '', cabinetKey: '', cabinetLocal: false, cabinetLocalPort: 8080,
    });
    // Before 1.6 there was only «always on top» on/off.
    if (!LEVELS[settings.get('windowLevel')]) settings.set({ windowLevel: settings.get('alwaysOnTop') === false ? 'normal' : 'top' });
    if (settings.get('windowLevel') === 'desktop' && !desktop.supported) settings.set({ windowLevel: 'normal' });
    nativeTheme.themeSource = themeSource(settings.get('theme'));
    journal = new Journal(app.getPath('userData'));
    core = createCore({ store, journal, settings, A, L, Composition, diffBatch, StoreError, TRASH_DAYS,
      changed: ({ user = false } = {}) => { sendData(); updateTrayTooltip(); if (user) sendCabinet(); } });
    files = createFiles({ store, journal, settings, A, L, Composition, StoreError, Buffer, io: electronIo(), appVersion: app.getVersion(),
      R: { buildReport, buildXlsx, buildDocx, buildCompositionXlsx, customerHtml, fillTemplate, TEMPLATES, TemplateError, readTableBytes, ImportError, contactUrl },
      currentUser, userView, changed: () => { sendData(); updateTrayTooltip(); } });
    feedback = new Feedback(app.getPath('userData'));
    core.migrateUsers();
    try { core.purgeTrash(); } catch (e) { console.error('Не удалось очистить корзину:', e); }
    ensureStartMenuShortcut();
    cabinet = new Cabinet(app.getPath('userData'), { url: () => settings.get('cabinetUrl'), key: cabinetKey });
    registerIpc();
    registerCabinetIpc();
    createWindow();
    createTray();
    if (!globalShortcut.register(HOTKEY, () => setClickThrough(!clickThrough))) {
      console.warn(`Горячая клавиша ${HOTKEY} занята другой программой; сквозные клики доступны из меню в трее.`);
    }
    // Morning digest: checked shortly after start and then every few minutes, shown once a day.
    setTimeout(() => morningDigest(), 15 * 1000);
    setInterval(() => { morningDigest(); updateTrayTooltip(); }, 5 * 60 * 1000);
    // Customer cabinet: the built-in server comes back with the app; first look soon after start, then every two minutes.
    if (settings.get('cabinetLocal')) startLocalCabinet().then(sendCabinet).catch(e => console.error('Кабинет на этом компьютере:', e.message));
    setTimeout(() => cabinetSync(), 20 * 1000);
    setTimeout(() => files.autoBackup(), 30 * 1000);
    setInterval(() => files.autoBackup(), 30 * 60 * 1000);
    setInterval(() => cabinetSync(), 2 * 60 * 1000);
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); desktop.stop(); localCab?.store.flush(); });
  // The tray keeps the app alive when the window is hidden.
  app.on('window-all-closed', () => {});
}

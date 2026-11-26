'use strict';
// The Tauri side of the shared core: the same rules as the Electron main process (src/core/handlers.js)
// over a store, a journal and settings whose files are kept by the Rust core (src-tauri/src/files.rs).
// Loaded after logic.js, access.js and composition.js; started by tauri-api.js on the first call.
(function () {
  const { invoke } = window.__TAURI__.core;
  // 55: «Не беспокоить» while a focus runs — Windows notifications are held and handed back to the window when it ends.
  // With a target (a card, «day») the notification gets the buttons «Открыть» and «Через час» (36).
  window.PultQuiet = { on: false, held: [], send(text, target = '') {
    if (this.on) { this.held.push(text); return Promise.resolve(false); }
    if (!target) return invoke('notify', { body: text }).catch(() => false);
    return invoke('notify_actions', { body: text, open: target, buttons: [{ label: 'Открыть', action: `open|${target}` }, { label: 'Через час', action: `later|${target}` }] }).catch(() => invoke('notify', { body: text }).catch(() => false));
  } };
  const SC = window.StoreCore, L = window.Logic;

  // Same defaults as `new Settings(…)` in src/main.js.
  const SETTINGS_DEFAULTS = {
    alwaysOnTop: true, compact: false, opacity: 0.82, fullBounds: null, compactBounds: null,
    notify: true, notifyHour: 9, lastDigest: null,
    windowLevel: null, theme: 'system', zoom: 1, cabinetUrl: '', cabinetKey: '', cabinetLocal: false, cabinetLocalPort: 8080,
  };
  const CONFLICT_MESSAGE = 'Данные изменились в другом окне Пульта — показаны свежие. Повторите последнее действие.';

  let onCabinet = null;
  async function init({ onChanged, cabinetChanged }) {
    onCabinet = cabinetChanged;
    const savedSettings = await invoke('settings_load');
    // «Сервер Пульта»: with a sign-in saved, the window works with the shared base instead of the file here.
    if (savedSettings?.server?.url && savedSettings.server.token) {
      const values = { ...SETTINGS_DEFAULTS, ...savedSettings };
      const settings = { get: key => values[key], set(patch) { Object.assign(values, patch); invoke('settings_save', { values }).catch(e => console.error('Не удалось сохранить настройки окна:', e)); } };
      return remoteInit({ settings, onChanged });
    }
    const loaded = await invoke('store_load');

    // Writes go out one at a time; several changes in a row are saved once with the latest state.
    let dirty = false, saving = null, lastError = null;
    async function saveLoop() {
      while (dirty) {
        dirty = false;
        try { await invoke('store_save', { data: store.data, day: L.todayStr() }); }
        catch (e) {
          const msg = String(e?.message || e);
          if (msg === 'conflict') {
            const fresh = await invoke('store_load');
            store.data = fresh.data ? SC.fromParsed(fresh.data) : SC.emptyData();
            lastError = CONFLICT_MESSAGE;
            onChanged();
          } else lastError = `Ошибка записи файла: ${msg}`;
          dirty = false;
        }
      }
    }
    const kick = () => { if (!saving) saving = saveLoop().finally(() => { saving = null; }); return saving; };
    // Waits for the pending saves and hands over their error once (to the call that asked).
    function flush() {
      return kick().then(() => {
        const message = lastError; lastError = null;
        return message ? { ok: false, message } : { ok: true };
      });
    }

    let migrate = () => {};
    const store = {
      data: loaded.data ? SC.fromParsed(loaded.data) : SC.emptyData(),
      warning: loaded.warning || null,
      snapshot() { return SC.snapshot(this.data); },
      apply(op, { save = true } = {}) { SC.applyOp(this.data, op); if (save) this.save(); },
      // Operations before a failing one stay applied and are saved, as in src/store.js.
      applyAll(ops) {
        let applied = 0;
        try { for (const op of ops) { SC.applyOp(this.data, op); applied++; } }
        finally { if (applied) this.save(); }
      },
      save() { dirty = true; kick(); },
      // Restore from a backup: the whole data set at once (records with invalid ids are skipped).
      replaceAll(raw) {
        const { data, count } = SC.fromBackup(raw);
        this.data = data;
        migrate(); // 4.22: an older copy keeps remarks and letters inside projects
        this.save();
        return count;
      },
    };

    const journal = {
      append(entries, meta) {
        if (!entries.length) return;
        invoke('journal_append', { lines: window.JournalDiff.batchLines(entries, meta) })
          .catch(e => console.error('Не удалось записать журнал:', e)); // the journal must never block saving data
      },
      read({ since = '' } = {}) { return invoke('journal_read', { since, limit: 3000 }); },
    };

    const values = { ...SETTINGS_DEFAULTS, ...savedSettings };
    const settings = {
      get: key => values[key],
      set(patch) {
        Object.assign(values, patch);
        invoke('settings_save', { values }).catch(e => console.error('Не удалось сохранить настройки окна:', e));
      },
    };

    const core = window.createCore({
      store, journal, settings, A: window.Access, L, Composition: window.Composition,
      diffBatch: window.JournalDiff.diffBatch, StoreError: SC.StoreError, changed: () => onChanged(),
    });
    const chats = window.createChats({ store, A: window.Access, currentUser: () => core.currentUser(), changed: () => onChanged() });
    // Files: the shared rules (src/core/files.js) with the report and import code of the Electron version
    // (node-modules.js); Windows access through the Rust commands (src-tauri/src/io.rs).
    const dirs = await invoke('known_dirs');
    const files = window.createFiles({
      store, journal, settings, A: window.Access, L, Composition: window.Composition, StoreError: SC.StoreError, Buffer: window.Buffer,
      io: tauriIo(dirs), appVersion: APP_VERSION, R: reportCode(),
      currentUser: () => core.currentUser(), userView: () => core.userView(), changed: () => onChanged(),
    });
    const cabinetRules = await cabinetOf({ store, settings, files, core, dirs, onCabinet: () => onCabinet?.() });
    core.migrateUsers();
    migrate = () => { try { core.migrateDocs(); } catch (e) { console.error('Не удалось перенести замечания и письма:', e); } };
    migrate();
    try { chats.migrateProjectChats(); } catch (e) { console.error('Не удалось перенести чаты проектов:', e); }
    try { core.purgeTrash(); } catch (e) { console.error('Не удалось очистить корзину:', e); }
    await flush();

    return { core, chats, files, cabinet: cabinetRules, store, settings, flush, warning: store.warning || null };
  }

  // The customer cabinet: the client of the Electron version (src/cabinet.js) and the shared rules
  // (src/core/cabinet-rules.js). HTTP, the team key and the built-in server go through Rust (src-tauri/src/cabinet.rs).
  async function cabinetOf({ store, settings, files, core, dirs, onCabinet }) {
    const { Cabinet, normalizeUrl, isLocalHost, KINDS } = window.NodeModules.load('cabinet.js');
    const { pageModel } = window.NodeModules.load('report/customer.js');
    const stateFile = dirs.userData + '\\cabinet.json';
    let saved = null;
    try { if (await invoke('fs_exists', { path: stateFile })) saved = JSON.parse(window.Buffer.from(await invoke('fs_read', { path: stateFile }), 'base64').toString('utf8')); } catch { /* start over */ }
    // The team key: 'dpapi:' — encrypted for this Windows user. A key saved by 3.x ('enc:', Electron's own
    // encryption) cannot be read here: the cabinet settings ask for it again (view().keyLost).
    let key = '';
    const stored = settings.get('cabinetKey') || '';
    const keyLost = stored.startsWith('enc:');
    if (stored.startsWith('dpapi:')) { try { key = await invoke('secret_unprotect', { data: stored.slice(6) }); } catch { key = ''; } }
    else if (stored.startsWith('plain:')) key = stored.slice(6);
    const keyStore = {
      get: () => key,
      async set(k) {
        key = k || '';
        if (!key) return settings.set({ cabinetKey: '' });
        try { settings.set({ cabinetKey: 'dpapi:' + await invoke('secret_protect', { text: key }) }); }
        catch { settings.set({ cabinetKey: 'plain:' + key }); }
      },
    };
    const fetchImpl = async (url, o = {}) => {
      const r = await invoke('http_request', { method: o.method || 'GET', url, headers: o.headers || {}, body: o.body ?? null, timeoutMs: o.timeoutMs || 15000 });
      return { status: r.status, json: async () => JSON.parse(r.body) };
    };
    let saving = Promise.resolve();
    const cabinet = new Cabinet('', {
      url: () => settings.get('cabinetUrl'), key: () => key, fetchImpl,
      storage: { load: () => saved, save: state => { const text = JSON.stringify(state); saving = saving.then(() => invoke('fs_write', { path: stateFile, text, base64: null })).catch(e => console.error('cabinet.json:', e)); } },
    });
    let running = null;
    const local = {
      running: () => running,
      async start() { const r = await invoke('cabinet_local_start', { port: Number(settings.get('cabinetLocalPort')) || 8080 }); running = { port: r.port, lan: r.lan }; return r; },
      async stop() { await invoke('cabinet_local_stop'); running = null; },
    };
    const rules = window.createCabinetRules({
      store, settings, A: window.Access, L: window.Logic, cabinet, files, keyStore, local,
      R: { pageModel, normalizeUrl, isLocalHost, KINDS },
      currentUser: () => core.currentUser(), userView: () => core.userView(),
      notify: (text, target = '') => window.PultQuiet.send(text, target), openExternal: url => invoke('open_url', { url }).catch(e => console.error(e)),
      changed: () => onCabinet(),
    });
    const view = rules.view;
    rules.view = () => { const v = view(); return v.allowed && keyLost && !key ? { ...v, keyLost: true } : v; };
    // The built-in server comes back with the app when it was on (as in Electron), with its own team key —
    // also the way back for a key saved by 3.x.
    if (settings.get('cabinetLocal')) {
      local.start().then(async r => { if (r.teamKey && r.teamKey !== key) await keyStore.set(r.teamKey); onCabinet(); })
        .catch(e => console.error('Кабинет на этом компьютере:', e));
    }
    return rules;
  }

  /* ---------- «Сервер Пульта»: the shared base (src/core/remote-client.js) ---------- */
  const unprotect = async stored => {
    const s = String(stored || '');
    if (s.startsWith('dpapi:')) return invoke('secret_unprotect', { data: s.slice(6) });
    return s.startsWith('plain:') ? s.slice(6) : s;
  };
  const protect = async text => { try { return 'dpapi:' + await invoke('secret_protect', { text }); } catch { return 'plain:' + text; } };
  // Every file a project refers to: request files, source data, letters, cards.
  function fileRefs(view, projectId) {
    const p = (view?.projects || []).find(x => x.id === projectId) || {};
    return [...(p.requests || []).flatMap(r => r.files || []), ...(p.irdFiles || []), ...(view?.letters || []).filter(l => l.projectId === projectId).flatMap(l => l.files || []), ...(p.letters || []).flatMap(l => l.files || []),
      ...(view?.tasks || []).filter(t => t.projectId === projectId).flatMap(t => t.files || [])].filter((f, i, all) => f && f.id && all.findIndex(x => x?.id === f.id) === i);
  }
  async function remoteInit({ settings, onChanged }) {
    const srv = settings.get('server');
    const dirs = await invoke('known_dirs');
    const io = tauriIo(dirs);
    const cacheFile = io.join(dirs.userData, 'server-cache.json');
    let cache = null;
    try { if (await invoke('fs_exists', { path: cacheFile })) cache = JSON.parse(window.Buffer.from(await invoke('fs_read', { path: cacheFile }), 'base64').toString('utf8')); } catch { cache = null; }
    // The cached part of the base belongs to the login it was taken with.
    if (cache && cache.login !== srv.login) cache = null;
    let cacheTimer = null;
    const storage = { load: () => cache, save: obj => { cache = { ...obj, login: srv.login }; clearTimeout(cacheTimer); cacheTimer = setTimeout(() => io.writeFile(cacheFile, JSON.stringify(cache)).catch(e => console.error('Копия данных сервера:', e)), 400); } };
    let authLost = '';
    const remote = window.createRemote({
      url: srv.url, token: await unprotect(srv.token), storage,
      onChanged: () => { rebuild(); onChanged(); }, onAuthLost: m => { authLost = m; onChanged(); }, onConflict: () => onChanged(),
    });
    // What the report and page code reads: a copy of the part of the base this person sees, nothing more.
    const store = {
      data: SC.emptyData(), warning: null,
      snapshot() { return SC.snapshot(this.data); },
      apply() { throw new SC.StoreError('На сервере данные меняются только через сервер.'); },
      applyAll() { throw new SC.StoreError('На сервере данные меняются только через сервер.'); },
      save() {}, replaceAll() { throw new SC.StoreError('Восстановление — через «Восстановить из копии» на сервере.'); },
    };
    function rebuild() {
      const v = remote.view();
      if (!v) return;
      const d = SC.emptyData();
      for (const col of SC.COLLECTIONS) for (const x of v[col] || []) { const { id, ...rest } = x; if (id) d[col][id] = rest; }
      store.data = d;
    }
    rebuild();
    const EMPTY = { projects: [], contractors: [], tasks: [], users: [], chats: [], depts: [], orgs: [], remarks: [], letters: [], me: null };
    const me = () => remote.view()?.me || null;
    const isGip = () => window.Access.isGip(me());
    const core = {
      currentUser: me, userView: () => remote.view() || EMPTY,
      write: (ops, meta) => remote.call('write', ops, meta),
      switchUser: () => ({ ok: false, message: 'На сервере каждый входит своим логином — переключать пользователей не нужно.' }),
      taskSeen: id => remote.call('taskSeen', id), taskComment: (id, t) => remote.call('addComment', id, t),
      taskCommentEdit: (id, c, t) => remote.call('editComment', id, c, t), taskThank: (id, c) => remote.call('thankComment', id, c),
      demoClear: () => remote.call('clearDemo'), journalGet: ({ since } = {}) => remote.call('getJournal', since || ''),
      migrateUsers() {}, purgeTrash() {},
    };
    const chats = {
      send: (a, b, c) => remote.call('chatSend', a, b, c), edit: (a, b, c) => remote.call('chatEdit', a, b, c), seen: a => remote.call('chatSeen', a),
      direct: a => remote.call('chatDirect', a), create: a => remote.call('chatCreate', a), update: (a, b) => remote.call('chatUpdate', a, b),
      leave: a => remote.call('chatLeave', a), seedDemo: () => remote.call('chatSeedDemo'), migrateProjectChats() {},
    };
    const files = window.createFiles({
      store, journal: { append() {}, read: async () => [] }, settings, A: window.Access, L: window.Logic, Composition: window.Composition, StoreError: SC.StoreError, Buffer: window.Buffer,
      io, appVersion: APP_VERSION, R: reportCode(), currentUser: me, userView: core.userView, changed: () => onChanged(),
    });
    // Files live on the server: picked here, sent there; opened from a downloaded copy.
    const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dwg: 'image/vnd.dwg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', zip: 'application/zip' };
    const typeOf = name => TYPES[io.extname(name).slice(1).toLowerCase()] || 'application/octet-stream';
    const up = async (pid, name, bytes) => {
      if (bytes.length > 30 * 1024 * 1024) return { ok: false, message: 'Файл больше 30 МБ — такие лучше класть в папку проекта и давать ссылку.' };
      try { return await remote.upload(pid, name, typeOf(name), bytes); } catch (e) { return { ok: false, message: `Не удалось отправить файл на сервер: ${e.message}` }; }
    };
    files.attachAdd = async pid => {
      const file = await io.openDialog({ title: 'Файл', defaultPath: settings.get('attachDir') || null, filters: [{ name: 'Все файлы', extensions: ['*'] }] });
      if (!file) return { canceled: true };
      settings.set({ attachDir: io.dirname(file) });
      return up(pid, io.basename(file).slice(0, 200), new Uint8Array(await io.readFile(file)));
    };
    files.attachBytes = async (pid, name, bytes) => up(pid, String(name || 'файл').slice(0, 200), bytes instanceof Uint8Array ? bytes : Uint8Array.from(Object.values(bytes || {})));
    files.attachmentBytes = async (pid, fid) => { try { return window.Buffer.from(await remote.download(pid, fid)); } catch { return null; } };
    files.attachOpen = async (pid, fid) => {
      const f = fileRefs(remote.view(), pid).find(x => x.id === fid);
      if (!f) return { ok: false, message: 'Файл не найден.' };
      let bytes;
      try { bytes = await remote.download(pid, fid); } catch (e) { return { ok: false, message: e.message }; }
      const view = io.join(dirs.userData, 'attachments', pid.replace(/[^A-Za-z0-9_-]/g, ''), 'open', `${fid}-${files.safeName(f.name) || 'файл'}`);
      await io.mkdir(io.dirname(view));
      await io.writeFile(view, bytes);
      const err = await io.openPath(view);
      return err ? { ok: false, message: `Не удалось открыть: ${err}` } : { ok: true };
    };
    // Copies: the GIP downloads the whole base from the server (also into the auto-copy folder — the «second place»).
    async function serverCopy() {
      const r = await remote.call('backupGet');
      if (!r?.ok) throw new Error(r?.message || 'Сервер не отдал копию.');
      return JSON.stringify(r.data);
    }
    files.backupSave = async () => {
      if (!isGip()) return { ok: false, message: 'Копию базы с сервера скачивает ГИП.' };
      const target = await io.saveDialog({ title: 'Копия базы с сервера', defaultPath: io.join(dirs.documents, `Пульт-сервер-копия-${window.Logic.todayStr()}.json`), filters: [{ name: 'Копия Пульта', extensions: ['json'] }] });
      if (!target) return { canceled: true };
      try { await io.writeFile(target, await serverCopy()); return { ok: true, path: target }; } catch (e) { return { ok: false, message: e.message }; }
    };
    files.backupRestore = async () => {
      if (!isGip()) return { ok: false, message: 'Восстанавливает ГИП.' };
      const file = await io.openDialog({ title: 'Копия для восстановления на сервере', filters: [{ name: 'Копия Пульта', extensions: ['json'] }] });
      if (!file) return { canceled: true };
      let data;
      try { data = JSON.parse(window.Buffer.from(await io.readFile(file)).toString('utf8')); } catch { return { ok: false, message: 'Это не копия Пульта.' }; }
      if (!(await io.confirm({ title: 'Восстановить на сервере', message: 'Заменить всю общую базу этой копией?', detail: 'Изменения всей команды после этой копии пропадут. Нынешняя база сохранится на сервере в папке копий.', ok: 'Заменить' }))) return { canceled: true };
      return remote.call('backupRestore', data);
    };
    let autoError = null;
    files.autoBackup = async (force = false) => {
      const dir = settings.get('autoBackupDir');
      if (!dir || !isGip()) return { ok: true };
      const last = settings.get('autoBackupLast') || '';
      if (!force && last && Date.now() - Date.parse(last) < 12 * 3600e3) return { ok: true };
      try {
        await io.writeFile(io.join(dir, `Пульт-сервер-копия-${window.Logic.todayStr()}.json`), await serverCopy());
        settings.set({ autoBackupLast: new Date().toISOString() }); autoError = null;
        return { ok: true };
      } catch (e) { autoError = e.message; return { ok: false, message: e.message }; }
    };
    files.autoBackupGet = () => ({ dir: settings.get('autoBackupDir') || '', last: settings.get('autoBackupLast') || '', error: autoError, server: true });
    files.autoBackupSet = async off => {
      if (!isGip()) return { ok: false, message: 'Автокопию настраивает ГИП.' };
      if (off) { settings.set({ autoBackupDir: '' }); return { ok: true, dir: '' }; }
      const dir = await io.openDialog({ title: 'Папка для копии базы с сервера (флешка, облачная папка)', directory: true });
      if (!dir) return { canceled: true };
      settings.set({ autoBackupDir: dir, autoBackupLast: '' });
      const r = await files.autoBackup(true);
      return { ok: r.ok, dir, message: r.message };
    };
    // The customer cabinet is on the server: the same calls go there.
    const cab = (name, ...args) => remote.call('cabinet', name, ...args);
    let seenMsgs = null;
    const cabinet = {
      view: async () => { const v = await cab('view'); return v && v.ok === false && v.offline ? { allowed: false, offline: true } : v; },
      async sync() {
        const r = await cab('sync');
        const v = await cab('view');
        // New messages of customers → a Windows notification, as the local cabinet does.
        if (v?.allowed && Array.isArray(v.messages)) {
          const ids = new Set(v.messages.map(m => m.id));
          if (seenMsgs) {
            const fresh = v.messages.filter(m => !seenMsgs.has(m.id) && !m.read);
            if (fresh.length) window.PultQuiet.send(fresh.length === 1 ? `Заказчик — ${fresh[0].projectName}: ${String(fresh[0].text || '').slice(0, 120)}` : `От заказчиков: ${fresh.length} новых сообщения`, new Set(fresh.map(x => x.projectId)).size === 1 ? `cust:${fresh[0].projectId}` : 'msgs');
          }
          seenMsgs = ids;
        }
        onCabinet?.();
        return r;
      },
      publish: id => cab('publish', id), unpublish: id => cab('unpublish', id), customers: () => cab('customers'),
      customerCreate: c => cab('customerCreate', c), customerUpdate: (id, p) => cab('customerUpdate', id, p), customerDelete: id => cab('customerDelete', id),
      read: async (ids, isRead) => { const r = await cab('read', ids, isRead); onCabinet?.(); return r; },
      configure: async () => ({ ok: false, message: 'Кабинет работает на Сервере Пульта — настраивать ничего не нужно.' }),
      localStart: async () => ({ ok: false, message: 'Кабинет работает на Сервере Пульта.' }), localStop: async () => ({ ok: true }),
      open: async projectId => { const v = await cab('view'); const url = v?.publicUrl; if (!url) return { ok: false, message: 'Адрес кабинета не задан на сервере.' }; await invoke('open_url', { url: projectId ? `${url}/p/${encodeURIComponent(projectId)}` : url }); return { ok: true }; },
      model: () => null, canUse: u => !!u && !window.Access.isSpecialist(u),
    };
    remote.start();
    const ctx = {
      core, chats, files, cabinet, store, settings, remote, flush: async () => ({ ok: true }),
      get warning() { return authLost ? `Сервер Пульта: ${authLost}` : null; },
      status: () => ({ ...remote.status(), login: srv.login, authLost, app: APP_VERSION }),
    };
    return ctx;
  }
  const APP_VERSION = '4.25.0';
  // Sign in / join / move the base (no ctx yet, or switching from the local file).
  const server = {
    async signIn({ url, login, password, code }) {
      const u = window.RemoteSignIn.normalize(url);
      if (!u) return { ok: false, message: 'Адрес сервера не похож на адрес сайта.' };
      const hi = await window.RemoteSignIn.hello(u);
      if (!hi.ok) return hi;
      const device = `Пульт ${APP_VERSION} (Windows)`;
      const r = code ? await window.RemoteSignIn.join(u, code, login, password, device) : await window.RemoteSignIn.login(u, login, password, device);
      if (!r?.ok) return r;
      return { ok: true, server: { url: u, login: r.login || login, token: await protect(r.token) }, me: r.me };
    },
    // The GIP moves the base: the whole file, the journal, then every attached file by its id.
    async moveBase({ url, code, login, password }, local, progress = () => {}) {
      const u = window.RemoteSignIn.normalize(url);
      if (!u) return { ok: false, message: 'Адрес сервера не похож на адрес сайта.' };
      const hi = await window.RemoteSignIn.hello(u);
      if (!hi.ok) return hi;
      if (!hi.setup) return { ok: false, message: 'На этом сервере база уже есть — войдите своим логином («Подключиться»).' };
      const me = local.core.currentUser();
      if (!window.Access.isGip(me)) return { ok: false, message: 'Переносит базу ГИП: выберите себя пользователем.' };
      progress('Отправляю базу…');
      let journal = '';
      try { journal = (await invoke('journal_read', { since: '', limit: 1000000 })).reverse().map(e => JSON.stringify(e)).join('\n'); } catch { journal = ''; }
      const r = await window.RemoteSignIn.setup(u, { code, login, password, userId: me.id, data: { version: 1, ...local.store.data }, journal, device: `Пульт ${APP_VERSION} (Windows)` });
      if (!r?.ok) return r;
      // Files: what this computer has goes up under the same ids.
      const remote = window.createRemote({ url: u, token: r.token, storage: null });
      const dirs = await invoke('known_dirs'), io = tauriIo(dirs);
      const view = local.core.userView();
      let sent = 0, missing = 0;
      for (const p of view.projects) {
        for (const f of fileRefs({ ...view, projects: [p] }, p.id)) {
          const src = io.join(dirs.userData, 'attachments', p.id.replace(/[^A-Za-z0-9_-]/g, ''), f.id.replace(/[^A-Za-z0-9_-]/g, ''));
          if (!(await io.exists(src))) { missing++; continue; }
          progress(`Файлы: ${sent + 1}…`);
          try { await remote.upload(p.id, f.name || 'файл', f.type || '', new Uint8Array(await io.readFile(src)), f.id); sent++; } catch { missing++; }
        }
      }
      return { ok: true, server: { url: u, login, token: await protect(r.token) }, count: r.count, files: sent, missing };
    },
  };

  // The report, template and import code written for Node, loaded in the window (see prepare-ui.js).
  function reportCode() {
    const m = id => window.NodeModules.load(id);
    const { buildXlsx, buildCompositionXlsx } = m('report/xlsx.js'), { buildDocx, buildRemarksDocx } = m('report/docx.js');
    const { fillTemplate, TEMPLATES, TemplateError } = m('report/doc-template.js'), { readTableBytes, ImportError } = m('import/read.js');
    return { buildReport: m('report/model.js').buildReport, buildXlsx, buildDocx, buildRemarksDocx, buildCompositionXlsx, customerHtml: m('report/customer.js').customerHtml, buildMsProject: m('report/msproject.js').buildMsProject,
      fillTemplate, TEMPLATES, TemplateError, readTableBytes, ImportError, contactUrl: m('contact.js').contactUrl };
  }
  // `io` of src/core/files.js on top of the Rust commands; bytes travel as base64.
  function tauriIo(dirs) {
    const B = window.Buffer, P = window.NodeModules.load('node:path');
    const io = {
      saveDialog: ({ title, defaultPath, filters }) => invoke('dialog_save', { title, defaultPath: defaultPath || null, filters: filters || [] }),
      openDialog: ({ title, defaultPath, filters, directory }) => invoke('dialog_open', { title, defaultPath: defaultPath || null, filters: filters || [], directory: !!directory }),
      confirm: ({ title, message, detail, ok }) => invoke('dialog_confirm', { title: title || '', message, detail: detail || '', ok: ok || 'Да' }),
      writeFile: (path, data) => invoke('fs_write', typeof data === 'string' ? { path, text: data, base64: null } : { path, text: null, base64: B.from(data).toString('base64') }),
      readFile: async path => B.from(await invoke('fs_read', { path }), 'base64'),
      exists: path => invoke('fs_exists', { path: String(path || '') }),
      mkdir: path => invoke('fs_mkdir', { path }),
      copyFile: async (from, to) => io.writeFile(to, await io.readFile(from)),
      listDir: path => invoke('fs_list', { path }),
      remove: path => invoke('fs_remove', { path }),
      openPath: path => invoke('open_path', { path }),
      openExternal: url => invoke('open_url', { url }),
      // No print engine of our own: the page opens in the browser with its print dialog («Сохранить как PDF»).
      pdfViaBrowser: true,
      pdf: async html => { await invoke('print_html', { html }); return { ok: true, viaBrowser: true }; },
      asset: async rel => { const r = await fetch(rel); if (!r.ok) throw new Error('нет файла ' + rel); return B.from(await r.arrayBuffer()); },
      dirs: () => dirs,
      join: (...p) => P.join(...p), dirname: p => P.dirname(p), basename: p => P.basename(p), extname: p => P.extname(p),
    };
    return io;
  }

  window.TauriCore = { init, server, version: APP_VERSION };
})();

// The web version of Пульт (a browser, a phone): the same interface (src/renderer) on top of «Сервер Пульта».
// window.api is what the desktop bridge gives the window, here over src/core/remote-client.js; what only the
// desktop can do (window levels, Windows folders, Word/Excel reports) says so instead of failing silently.
(function () {
  'use strict';
  const LS = { get: k => { try { return JSON.parse(localStorage.getItem('pult.' + k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('pult.' + k, JSON.stringify(v)); } catch { /* private mode */ } } };
  const URL0 = location.origin;
  document.documentElement.classList.add('web');
  const phone = () => window.matchMedia('(max-width: 700px)').matches;

  /* ---------- signing in ---------- */
  let resolveReady;
  const readyP = new Promise(r => { resolveReady = r; });
  let remote = null, me = null;
  const dataListeners = [], cabListeners = [];
  function startRemote(token) {
    remote = window.createRemote({
      url: URL0, token,
      storage: { load: () => LS.get('cache'), save: v => LS.set('cache', v) },
      onChanged: () => { const v = remote.view(); if (v) { me = v.me; for (const cb of dataListeners) cb(v); } },
      onAuthLost: () => { LS.set('token', null); LS.set('cache', null); signInScreen('Сеанс закончился — войдите снова.'); },
    });
    remote.start();
    const first = () => (remote.view() ? resolveReady() : setTimeout(first, 100));
    first();
  }
  function signInScreen(note = '') {
    const join = (/#join=([A-Za-z0-9]+)/.exec(location.hash) || [])[1] || '';
    let box = document.getElementById('web-login');
    if (!box) { box = document.createElement('div'); box.id = 'web-login'; document.body.append(box); }
    box.innerHTML = `<form class="wl-card" novalidate><img src="brand/tandem-logo.svg" alt="" class="wl-logo"><h1>Пульт главспеца</h1>
      <p class="wl-sub">${join ? 'Приглашение в общую базу: придумайте логин и пароль.' : 'Вход в общую базу команды'}</p>
      ${note ? `<p class="wl-note">${note}</p>` : ''}
      ${join ? `<label>Код приглашения<input name="code" value="${join}" autocomplete="off"></label>` : ''}
      <label>Логин<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label>Пароль${join ? ' (не короче 8 знаков)' : ''}<input name="password" type="password" autocomplete="${join ? 'new-password' : 'current-password'}" required></label>
      <p class="wl-err" hidden></p>
      <button type="submit">${join ? 'Войти впервые' : 'Войти'}</button>
      ${join ? '' : '<p class="wl-hint">Нет логина? Попросите ГИПа прислать приглашение.</p>'}</form>`;
    box.hidden = false;
    const f = box.querySelector('form');
    f.login.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const err = box.querySelector('.wl-err');
      const b = f.querySelector('button'); b.disabled = true;
      const device = `${phone() ? 'Телефон' : 'Браузер'} (${navigator.platform || 'веб'})`;
      const r = f.code ? await window.RemoteSignIn.join(URL0, f.code.value.trim().toUpperCase(), f.login.value.trim(), f.password.value, device)
        : await window.RemoteSignIn.login(URL0, f.login.value.trim(), f.password.value, device);
      b.disabled = false;
      if (!r?.ok) { err.textContent = r?.message || 'Не получилось.'; err.hidden = false; return; }
      LS.set('token', r.token); LS.set('login', r.login || f.login.value.trim());
      if (join) history.replaceState(null, '', location.pathname);
      box.hidden = true;
      if (remote) location.reload(); else startRemote(r.token);
    });
  }

  /* ---------- the window's state: a browser has no window levels ---------- */
  const winState = () => ({ compact: false, maximized: true, opacity: 1, theme: LS.get('theme') || 'system', zoom: LS.get('zoom') || 1, level: 'normal', alwaysOnTop: false,
    clickThrough: false, autostart: false, web: true, phone: phone(), backdrops: ['none'], backdrop: 'none' });
  const winListeners = [];
  const pushWin = () => { const s = winState(); for (const cb of winListeners) cb(s); };
  const desktopOnly = what => async () => ({ ok: false, message: `${what} — в Пульте на компьютере.` });

  // Files: picked in the browser, sent to the server; opened by download.
  const pickFile = (accept = '') => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept; i.onchange = () => res(i.files?.[0] || null); i.click(); });
  const saveBlob = (bytes, name, type = 'application/octet-stream') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  const refs = pid => {
    const v = remote.view() || {}, p = (v.projects || []).find(x => x.id === pid) || {};
    return [...(p.requests || []).flatMap(r => r.files || []), ...(p.irdFiles || []), ...(p.letters || []).flatMap(l => l.files || []), ...(v.tasks || []).filter(t => t.projectId === pid).flatMap(t => t.files || [])];
  };
  const up = async (pid, name, bytes, type) => {
    if (bytes.length > 30 * 1024 * 1024) return { ok: false, message: 'Файл больше 30 МБ.' };
    try { return await remote.upload(pid, name, type || 'application/octet-stream', bytes); } catch (e) { return { ok: false, message: e.message }; }
  };
  const C = (fn, ...a) => readyP.then(() => remote.call(fn, ...a));

  const known = {
    getData: async () => { await readyP; return { data: remote.view(), warning: null, remote: { ...remote.status(), login: LS.get('login') } }; },
    onData: cb => { dataListeners.push(cb); return () => dataListeners.splice(dataListeners.indexOf(cb), 1); },
    write: (ops, meta) => C('write', ops, meta),
    switchUser: async () => ({ ok: false, message: 'На сервере каждый входит своим логином.' }),
    taskSeen: id => C('taskSeen', id), addComment: (id, t) => C('addComment', id, t), thankComment: (id, c) => C('thankComment', id, c),
    editComment: (id, c, t) => C('editComment', id, c, t), clearDemo: () => C('clearDemo'), getJournal: since => C('getJournal', since || ''),
    chatSend: (a, b, c) => C('chatSend', a, b, c), chatEdit: (a, b, c) => C('chatEdit', a, b, c), chatSeen: a => C('chatSeen', a), chatDirect: a => C('chatDirect', a),
    chatCreate: a => C('chatCreate', a), chatUpdate: (a, b) => C('chatUpdate', a, b), chatLeave: a => C('chatLeave', a), chatSeedDemo: () => C('chatSeedDemo'),
    // The customer cabinet (on the server).
    cabinetGet: () => C('cabinet', 'view'), onCabinet: cb => { cabListeners.push(cb); return () => {}; },
    cabinetSync: () => C('cabinet', 'sync'), cabinetPublish: id => C('cabinet', 'publish', id), cabinetUnpublish: id => C('cabinet', 'unpublish', id),
    cabinetCustomers: () => C('cabinet', 'customers'), cabinetCustomerCreate: c => C('cabinet', 'customerCreate', c), cabinetCustomerUpdate: (id, p) => C('cabinet', 'customerUpdate', id, p),
    cabinetCustomerDelete: id => C('cabinet', 'customerDelete', id), cabinetRead: async (ids, r) => { const x = await C('cabinet', 'read', ids, r); const v = await C('cabinet', 'view'); for (const cb of cabListeners) cb(v); return x; },
    cabinetOpen: async pid => { const v = await C('cabinet', 'view'); if (v?.publicUrl) window.open(pid ? `${v.publicUrl}/p/${encodeURIComponent(pid)}` : v.publicUrl, '_blank', 'noopener'); return { ok: !!v?.publicUrl }; },
    cabinetConfigure: desktopOnly('Кабинет работает на сервере — настраивать ничего не нужно'),
    // Files
    attachAdd: async pid => { const f = await pickFile(); if (!f) return { canceled: true }; return up(pid, f.name.slice(0, 200), new Uint8Array(await f.arrayBuffer()), f.type); },
    attachBytes: (pid, name, bytes) => up(pid, String(name || 'файл').slice(0, 200), bytes instanceof Uint8Array ? bytes : Uint8Array.from(Object.values(bytes || {}))),
    attachOpen: async (pid, fid) => {
      const f = refs(pid).find(x => x.id === fid);
      try { const bytes = await remote.download(pid, fid); saveBlob(bytes, f?.name || 'файл', f?.type); return { ok: true }; } catch (e) { return { ok: false, message: e.message }; }
    },
    backupSave: async () => { const r = await C('backupGet'); if (!r?.ok) return r; saveBlob(JSON.stringify(r.data), `Пульт-сервер-копия-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); return { ok: true }; },
    backupRestore: async () => {
      const f = await pickFile('.json,application/json'); if (!f) return { canceled: true };
      let data; try { data = JSON.parse(await f.text()); } catch { return { ok: false, message: 'Это не копия Пульта.' }; }
      if (!confirm('Заменить всю общую базу этой копией? Изменения команды после неё пропадут (нынешняя база сохранится в копиях на сервере).')) return { canceled: true };
      return C('backupRestore', data);
    },
    // «Сервер Пульта»
    serverInfo: async () => { await readyP; return { mode: 'server', ...remote.status(), login: LS.get('login'), web: true, conflicts: remote.state.conflicts.map((x, i) => ({ i, at: x.at, list: x.list })) }; },
    serverCall: async (fn, ...args) => (['accounts', 'inviteCreate', 'accountDisable', 'accountReset', 'passwordChange', 'signOutOthers'].includes(fn) ? C(fn, ...args) : { ok: false, message: 'Неизвестная команда.' }),
    serverResolve: (i, keep) => readyP.then(() => remote.resolve(i, keep)),
    serverDisconnect: async () => { LS.set('token', null); LS.set('cache', null); location.reload(); return { ok: true }; },
    // The window
    getWindowState: async () => winState(), onWindowState: cb => { winListeners.push(cb); return () => {}; }, onWindowMain: () => () => {}, onOpenTask: () => () => {},
    setTheme: async t => { LS.set('theme', t); pushWin(); }, setZoom: async z => { LS.set('zoom', z); document.body.style.zoom = String(z); pushWin(); },
    setOpacity: async () => {}, setAlwaysOnTop: async () => {}, setClickThrough: async () => {}, setLevel: async () => {}, setCompact: async () => {}, setSize: async () => {},
    setMaximized: async () => {}, minimize: async () => {}, hide: async () => {}, hoverUnlock: async () => {}, reloadWindow: async () => { location.reload(); },
    setBadge: async n => { try { if (n) await navigator.setAppBadge?.(n); else await navigator.clearAppBadge?.(); } catch { /* not supported */ } },
    notifyMe: async (text, target) => {
      if (document.visibilityState === 'visible' || typeof Notification === 'undefined') return false;
      if (Notification.permission !== 'granted') return false;
      const n = new Notification('Пульт главспеца', { body: text, icon: 'brand/tandem-logo.svg', tag: target || 'pult' });
      n.onclick = () => { window.focus(); window.AppBridge?.openTarget?.(target); };
      return true;
    },
    setQuiet: () => [],
    exportReport: desktopOnly('Отчёты Excel и Word'), exportComposition: desktopOnly('Состав в Excel и Word'), customerPage: desktopOnly('Страница заказчика файлом'),
    openTemplates: desktopOnly('Шаблоны Word'), openProjectFolder: desktopOnly('Папка проекта'), openTaskFolder: desktopOnly('Папка карточки'), pickFolder: desktopOnly('Выбор папки'),
    openDataFolder: desktopOnly('Папка с данными'), importPick: desktopOnly('Импорт из Excel'), autoBackupGet: async () => ({ dir: '', web: true }), autoBackupSet: desktopOnly('Автокопия в папку'),
    openLastReport: desktopOnly('Последний отчёт'), docDefaults: async () => ({}), mailOpen: async req => { if (req?.mailto) location.href = req.mailto; return { ok: !!req?.mailto }; },
    openContact: async req => { if (req?.url) window.open(req.url, '_blank', 'noopener'); return { ok: !!req?.url }; },
    windowOpen: desktopOnly('Отдельные окна'), windowDock: async () => {},
  };
  window.api = new Proxy(known, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && k.startsWith('on')) return () => () => {};
      return desktopOnly('Эта функция');
    },
  });

  const token = LS.get('token');
  if (token) startRemote(token);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => signInScreen());
  else signInScreen();
  // A phone: install to the home screen (the service worker only makes it installable; nothing is cached).
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Notifications while the tab is in the background: asked once, after the first click.
  document.addEventListener('click', () => { if (typeof Notification !== 'undefined' && Notification.permission === 'default' && LS.get('askedNotify') !== true) { LS.set('askedNotify', true); Notification.requestPermission().catch(() => {}); } }, { once: true });
})();

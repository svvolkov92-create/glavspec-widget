// The window's side of «Сервер Пульта» (shared by the desktop app and the web version): the person's part of the
// base kept here (also between starts), changes sent to the server, live updates, work without a connection.
//   Without a connection: a change is shown at once and waits in a queue («ждёт отправки»); the queue is sent
//   in order when the server answers again. Two people changed the same field → the person chooses (conflicts).
//   Versions: every request says which version of the exchange this Пульт speaks (PROTOCOL); a server that no longer
//   accepts it answers 426 → «Пульт устарел» (state.outdated), the changes stay in the queue until the update.
//   A server older than MIN_SERVER → «Сервер устарел» the same way.
// deps: { url, token, fetch, storage: { load() → obj|null, save(obj) }, onChanged(), onAuthLost(message), onConflict(list), onQueued() }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createRemote = factory;
})(typeof self !== 'undefined' ? self : this, Object.assign(createRemote, {
  // The version of the exchange with the server. Raise it when a change needs both sides new; the server's
  // MIN_CLIENT (server/pult-server.js) says which Пульты it still accepts, MIN_SERVER — which servers this Пульт needs.
  PROTOCOL: 1, MIN_SERVER: 1,
}));
function createRemote(deps) {
  'use strict';
  const { PROTOCOL, MIN_SERVER } = createRemote;
  const doFetch = deps.fetch || ((...a) => fetch(...a));
  const base = String(deps.url || '').replace(/\/+$/, '');
  let token = deps.token || '';
  const saved = deps.storage?.load?.() || {};
  const state = {
    view: saved.view || null, rev: Number(saved.rev) || 0, queue: Array.isArray(saved.queue) ? saved.queue : [],
    online: false, lastError: '', server: saved.server || null, conflicts: [], failed: [], authLost: false, outdated: null,
  };
  const persist = () => { try { deps.storage?.save?.({ view: state.view, rev: state.rev, queue: state.queue, server: state.server }); } catch (e) { console.error('Копия данных сервера:', e); } };
  const changed = () => { try { deps.onChanged?.(); } catch (e) { console.error(e); } };

  class NetError extends Error {}
  async function request(method, path, body, { raw = false, headers = {}, timeout = 30000 } = {}) {
    let r;
    try {
      r = await doFetch(base + path, {
        method,
        headers: { 'X-Pult-Protocol': String(PROTOCOL), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeout) : undefined,
      });
    } catch (e) {
      throw new NetError(e?.name === 'TimeoutError' ? 'сервер не ответил вовремя' : 'нет связи с сервером');
    }
    if (r.status === 401) {
      let m = 'Войдите заново.';
      try { m = (await r.json()).message || m; } catch { /* plain */ }
      state.authLost = true;
      deps.onAuthLost?.(m);
      throw Object.assign(new Error(m), { auth: true });
    }
    if (r.status === 426) {
      let m = 'Пульт устарел — обновите его.';
      try { m = (await r.json()).message || m; } catch { /* plain */ }
      throw outdated('pult', m);
    }
    if (r.status >= 500 || r.status === 502 || r.status === 504) throw new NetError(`сервер ответил ${r.status}`);
    const type = r.headers.get('content-type') || '';
    if (!type.includes('json')) return new Uint8Array(await r.arrayBuffer());
    return r.json();
  }
  // Versions do not fit: nothing more is sent (the queue waits for the update); the window shows why.
  function outdated(who, message) {
    if (!state.outdated) { state.outdated = { who, message }; state.online = false; state.lastError = message; changed(); }
    return Object.assign(new Error(message), { outdated: true });
  }
  const goneOnline = () => { if (!state.online) { state.online = true; state.lastError = ''; changed(); } };
  const goneOffline = msg => { if (state.online || state.lastError !== msg) { state.online = false; state.lastError = msg; changed(); } };

  /* ---------- the person's part of the base ---------- */
  async function refresh() {
    const r = await request('GET', '/api/view');
    // Not the answer of the server (a proxy page, an error): the copy here stays as it was.
    if (!r || r instanceof Uint8Array || !r.data || typeof r.rev !== 'number') throw new NetError(r?.message || 'сервер ответил не так, как ждали');
    if (Number(r.server?.protocol ?? 1) < MIN_SERVER) throw outdated('server', `Сервер Пульта ${r.server?.version || ''} устарел для этого Пульта — ГИПу нужно обновить сервер (запустить новый установщик).`);
    state.view = r.data; state.rev = r.rev; state.server = r.server || state.server;
    // Changes still waiting are shown on top of what came, so they do not «jump back» until sent.
    for (const q of state.queue) overlayCall(q.fn, q.args, q.at);
    persist();
    goneOnline();
    changed();
  }
  function overlay(ops) {
    if (!state.view) return;
    for (const o of Array.isArray(ops) ? ops : [ops]) {
      const list = state.view[o?.col];
      if (!Array.isArray(list)) continue;
      const i = list.findIndex(d => d.id === o.id);
      if (o.type === 'delete') { if (i >= 0) list.splice(i, 1); }
      else if (o.type === 'set') { const d = { ...JSON.parse(JSON.stringify(o.data || {})), id: o.id }; if (i >= 0) list[i] = d; else list.push(d); }
      else if (o.type === 'update' && i >= 0) list[i] = { ...list[i], ...JSON.parse(JSON.stringify(o.data || {})), id: o.id };
    }
  }
  // «Seen» marks waiting to be sent are shown at once too: otherwise the window, still seeing «new», asks again —
  // without a connection that was a new item in the queue on every redraw.
  // Own comments and chat messages waiting to be sent are shown at once, marked pending (grey, «ждёт отправки»).
  function overlayCall(fn, args, at) {
    if (fn === 'write') return overlay(args[0]);
    const me = state.view?.me, meId = me?.id;
    if (meId && (fn === 'addComment' || fn === 'chatSend')) {
      const item = { id: 'q' + String(at).replace(/\D/g, ''), ts: at, userId: meId, user: me.name || '', text: String(args[1] || '').trim(), pending: true };
      if (!item.text) return;
      if (fn === 'addComment') {
        const t = (state.view.tasks || []).find(x => x.id === args[0]);
        if (t) t.comments = [...(t.comments || []), item];
        return;
      }
      if (!Array.isArray(state.view.chats)) state.view.chats = [];
      let c = state.view.chats.find(x => x.id === args[0]);
      // The first message of a project chat creates it on the server; here it appears at once.
      if (!c && typeof args[2] === 'string') state.view.chats.push(c = { id: args[0], kind: 'project', projectId: args[2], messages: [], seen: {} });
      if (c) { c.messages = [...(c.messages || []), item]; c.lastTs = at; }
      return;
    }
    if (!meId || (fn !== 'taskSeen' && fn !== 'chatSeen')) return;
    const d = (state.view[fn === 'taskSeen' ? 'tasks' : 'chats'] || []).find(x => x.id === args[0]);
    if (d) d.seen = { ...(d.seen || {}), [meId]: new Date().toISOString() };
  }
  // What the person saw before the change, field by field: the server finds conflicts with it.
  function prevOf(ops) {
    const prev = {};
    for (const o of Array.isArray(ops) ? ops : [ops]) {
      if (o?.type !== 'update' || !o.data || !state.view) continue;
      const d = (state.view[o.col] || []).find(x => x.id === o.id);
      if (!d) continue;
      const k = `${o.col}/${o.id}`;
      prev[k] = prev[k] || {};
      for (const f of Object.keys(o.data)) if (!(f in prev[k])) prev[k][f] = d[f] === undefined ? null : JSON.parse(JSON.stringify(d[f]));
    }
    return prev;
  }

  /* ---------- calls ---------- */
  // Changes that may wait for the connection (in this order); everything else needs the server now.
  const QUEUEABLE = new Set(['write', 'taskSeen', 'addComment', 'editComment', 'thankComment', 'chatSend', 'chatEdit', 'chatSeen']);
  // After a change the answer waits for the fresh part of the base, so the window draws the result at once.
  const READ = new Set(['getJournal', 'accounts', 'backupGet']);
  async function rpc(fn, ...args) {
    const r = await request('POST', '/api/rpc', { fn, args });
    goneOnline();
    if (r && typeof r.rev === 'number' && r.rev !== state.rev && !READ.has(fn)) await refresh().catch(() => {});
    return r;
  }
  async function call(fn, ...args) {
    if (fn === 'write') {
      const [ops, meta] = args;
      const prev = prevOf(ops);
      if (state.queue.length || sending || (!state.online && state.view)) return enqueue(fn, [ops, meta || {}, prev]); // keeps the order
      try {
        const r = await rpc('write', ops, meta || {}, prev);
        return r;
      } catch (e) {
        if (e instanceof NetError) { goneOffline(e.message); return enqueue(fn, [ops, meta || {}, prev]); }
        if (e.outdated) return enqueue(fn, [ops, meta || {}, prev]);
        return { ok: false, message: e.message };
      }
    }
    try {
      if ((state.queue.length || sending) && QUEUEABLE.has(fn)) return enqueue(fn, args);
      const r = await rpc(fn, ...args);
      return fn === 'getJournal' ? (r.result || []) : r;
    } catch (e) {
      if (e instanceof NetError) {
        goneOffline(e.message);
        if (QUEUEABLE.has(fn)) return enqueue(fn, args);
        return fn === 'getJournal' ? [] : { ok: false, offline: true, message: `Нет связи с сервером (${e.message}) — это действие нужно делать на связи.` };
      }
      return { ok: false, message: e.message };
    }
  }
  function enqueue(fn, args) {
    const same = (fn === 'taskSeen' || fn === 'chatSeen') && state.queue.some(q => q.fn === fn && q.args[0] === args[0]);
    const at = new Date().toISOString();
    if (!same) state.queue.push({ fn, args: JSON.parse(JSON.stringify(args)), at });
    overlayCall(fn, args, at);
    persist();
    changed();
    deps.onQueued?.();
    return { ok: true, queued: true };
  }
  // The queue goes out in order. A conflict or a refusal is kept aside for the person; the rest continues.
  let sending = false;
  async function sendQueue() {
    if (sending || !state.queue.length) return;
    sending = true;
    try {
      while (state.queue.length) {
        // Taken off the queue while it is being sent: the fresh copy that comes back already has it — it must not be
        // shown once more on top (a comment twice). Put back if it did not go.
        const q = state.queue.shift();
        let r;
        try { r = await rpc(q.fn, ...q.args); }
        catch (e) {
          if (e instanceof NetError) { state.queue.unshift(q); goneOffline(e.message); return; }
          if (e.auth || e.outdated) { state.queue.unshift(q); return; } // signed out / versions do not fit: the changes wait
          r = { ok: false, message: e.message };
        }
        persist();
        if (r?.conflict) state.conflicts.push({ ops: q.args[0], meta: q.args[1], prev: q.args[2], list: r.conflict, at: q.at });
        else if (r && r.ok === false) state.failed.push({ fn: q.fn, message: r.message, at: q.at });
      }
      if (state.conflicts.length) deps.onConflict?.(state.conflicts);
      await refresh();
    } finally { sending = false; changed(); }
  }
  // «Оставить моё» — the change goes again with force; «Оставить их» — dropped.
  async function resolve(index, keepMine) {
    const c = state.conflicts[index];
    if (!c) return { ok: false };
    state.conflicts.splice(index, 1);
    changed();
    if (!keepMine) { await refresh().catch(() => {}); return { ok: true }; }
    return call('write', c.ops, { ...(c.meta || {}), force: true });
  }

  /* ---------- live updates and reconnecting ---------- */
  let stopped = false, delay = 2000;
  async function loop() {
    while (!stopped) {
      try {
        if (!state.view || !state.online) await refresh();
        if (state.queue.length) await sendQueue();
        const r = await request('GET', `/api/wait?rev=${state.rev}`, undefined, { timeout: 40000 });
        // Anything but the server's answer (a proxy page, an error) is waited out like no connection — never a
        // refresh straight away, which would go round without a pause.
        if (!r || typeof r.rev !== 'number') throw new NetError(r?.message || 'сервер ответил не так, как ждали');
        goneOnline();
        delay = 2000;
        if (r.rev !== state.rev) await refresh();
      } catch (e) {
        if (e.auth || e.outdated) return;
        goneOffline(e.message);
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 2, 30000);
      }
    }
  }

  /* ---------- files ---------- */
  async function upload(projectId, name, type, bytes, fileId = '') {
    const r = await request('POST', `/api/files?project=${encodeURIComponent(projectId)}`, bytes, { raw: true, timeout: 300000,
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name), 'X-File-Type': type || 'application/octet-stream', ...(fileId ? { 'X-File-Id': fileId } : {}) } });
    return r;
  }
  async function download(projectId, fileId) {
    const r = await request('GET', `/api/files/${encodeURIComponent(projectId)}/${encodeURIComponent(fileId)}`, undefined, { timeout: 300000 });
    if (r instanceof Uint8Array) return r;
    throw new Error(r?.message || 'Файл не найден на сервере.');
  }

  /* ---------- 65: the new Пульт for Windows on the server ---------- */
  async function uploadUpdate(version, bytes) {
    return request('POST', '/api/update', bytes, { raw: true, timeout: 600000, headers: { 'Content-Type': 'application/octet-stream', 'X-Update-Version': String(version) } });
  }
  async function downloadUpdate() {
    const r = await request('GET', '/api/update/file', undefined, { timeout: 600000 });
    if (r instanceof Uint8Array) return r;
    throw new Error(r?.message || 'Обновления на сервере нет.');
  }

  return {
    state, call, resolve, refresh, upload, download, uploadUpdate, downloadUpdate,
    view: () => state.view,
    status: () => ({ online: state.online, pending: state.queue.length, conflicts: state.conflicts.length, failed: state.failed.splice(0), lastError: state.lastError, server: state.server, url: base, authLost: state.authLost, outdated: state.outdated }),
    start() { stopped = false; loop(); },
    stop() { stopped = true; },
    setToken(t) { token = t; state.authLost = false; },
  };
}

// Signing in (no token yet): login, joining by an invitation, moving the base on a fresh server.
(function (root) {
  const C = typeof module === 'object' && module.exports ? module.exports : root.createRemote;
  async function post(url, path, body, fetchImpl) {
    let r;
    try {
      r = await (fetchImpl || fetch)(String(url).replace(/\/+$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pult-Protocol': String(C.PROTOCOL) }, body: JSON.stringify(body) });
    } catch { return { ok: false, message: 'Сервер не отвечает. Проверьте адрес и интернет.' }; }
    try { return await r.json(); } catch { return { ok: false, message: `По этому адресу отвечает не Сервер Пульта (код ${r.status}).` }; }
  }
  async function hello(url, fetchImpl) {
    try {
      const r = await (fetchImpl || fetch)(String(url).replace(/\/+$/, '') + '/api/hello');
      const j = await r.json();
      if (!(j && j.ok && j.version)) return { ok: false, message: 'По этому адресу отвечает не Сервер Пульта.' };
      // Versions are checked before signing in: a person should not set a password and then learn it cannot work.
      if (Number(j.protocol ?? 1) < C.MIN_SERVER) return { ...j, ok: false, outdated: 'server', message: `Сервер Пульта ${j.version} устарел для этого Пульта — ГИПу нужно обновить сервер (запустить новый установщик).` };
      if (Number(j.minProtocol ?? 1) > C.PROTOCOL) return { ...j, ok: false, outdated: 'pult', message: `Этот Пульт устарел для сервера ${j.version} — обновите Пульт.` };
      return j;
    } catch { return { ok: false, message: 'Сервер не отвечает. Проверьте адрес и интернет.' }; }
  }
  // «1.2.3.4» → «https://1-2-3-4.sslip.io»? No: the address is the one from the installation; only the scheme is added.
  function normalize(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { const u = new URL(s); return u.origin; } catch { return ''; }
  }
  const api = { login: (url, login, password, device, f) => post(url, '/api/login', { login, password, device }, f),
    join: (url, code, login, password, device, f) => post(url, '/api/join', { code, login, password, device }, f),
    setup: (url, body, f) => post(url, '/api/setup', body, f), hello, normalize };
  if (typeof module === 'object' && module.exports) module.exports.signIn = api;
  else root.RemoteSignIn = api;
})(typeof self !== 'undefined' ? self : this);

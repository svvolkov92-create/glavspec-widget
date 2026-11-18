// The window's side of «Сервер Пульта» (shared by the desktop app and the web version): the person's part of the
// base kept here (also between starts), changes sent to the server, live updates, work without a connection.
//   Without a connection: a change is shown at once and waits in a queue («ждёт отправки»); the queue is sent
//   in order when the server answers again. Two people changed the same field → the person chooses (conflicts).
// deps: { url, token, fetch, storage: { load() → obj|null, save(obj) }, onChanged(), onAuthLost(message), onConflict(list), onQueued() }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createRemote = factory;
})(typeof self !== 'undefined' ? self : this, function createRemote(deps) {
  'use strict';
  const doFetch = deps.fetch || ((...a) => fetch(...a));
  const base = String(deps.url || '').replace(/\/+$/, '');
  let token = deps.token || '';
  const saved = deps.storage?.load?.() || {};
  const state = {
    view: saved.view || null, rev: Number(saved.rev) || 0, queue: Array.isArray(saved.queue) ? saved.queue : [],
    online: false, lastError: '', server: saved.server || null, conflicts: [], failed: [], authLost: false,
  };
  const persist = () => { try { deps.storage?.save?.({ view: state.view, rev: state.rev, queue: state.queue, server: state.server }); } catch (e) { console.error('Копия данных сервера:', e); } };
  const changed = () => { try { deps.onChanged?.(); } catch (e) { console.error(e); } };

  class NetError extends Error {}
  async function request(method, path, body, { raw = false, headers = {}, timeout = 30000 } = {}) {
    let r;
    try {
      r = await doFetch(base + path, {
        method,
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
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
    if (r.status >= 500 || r.status === 502 || r.status === 504) throw new NetError(`сервер ответил ${r.status}`);
    const type = r.headers.get('content-type') || '';
    if (!type.includes('json')) return new Uint8Array(await r.arrayBuffer());
    return r.json();
  }
  const goneOnline = () => { if (!state.online) { state.online = true; state.lastError = ''; changed(); } };
  const goneOffline = msg => { if (state.online || state.lastError !== msg) { state.online = false; state.lastError = msg; changed(); } };

  /* ---------- the person's part of the base ---------- */
  async function refresh() {
    const r = await request('GET', '/api/view');
    state.view = r.data; state.rev = r.rev; state.server = r.server || state.server;
    // Changes still waiting are shown on top of what came, so they do not «jump back» until sent.
    for (const q of state.queue) if (q.fn === 'write') overlay(q.args[0]);
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
      if (state.queue.length || (!state.online && state.view)) return enqueue(fn, [ops, meta || {}, prev]);
      try {
        const r = await rpc('write', ops, meta || {}, prev);
        return r;
      } catch (e) {
        if (e instanceof NetError) { goneOffline(e.message); return enqueue(fn, [ops, meta || {}, prev]); }
        return { ok: false, message: e.message };
      }
    }
    try {
      if (state.queue.length && QUEUEABLE.has(fn)) return enqueue(fn, args);
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
    state.queue.push({ fn, args: JSON.parse(JSON.stringify(args)), at: new Date().toISOString() });
    if (fn === 'write') overlay(args[0]);
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
        const q = state.queue[0];
        let r;
        try { r = await rpc(q.fn, ...q.args); }
        catch (e) { if (e instanceof NetError) { goneOffline(e.message); return; } r = { ok: false, message: e.message }; }
        state.queue.shift();
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
        goneOnline();
        delay = 2000;
        if (r.rev !== state.rev) await refresh();
      } catch (e) {
        if (e.auth) return;
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

  return {
    state, call, resolve, refresh, upload, download,
    view: () => state.view,
    status: () => ({ online: state.online, pending: state.queue.length, conflicts: state.conflicts.length, failed: state.failed.splice(0), lastError: state.lastError, server: state.server, url: base, authLost: state.authLost }),
    start() { stopped = false; loop(); },
    stop() { stopped = true; },
    setToken(t) { token = t; state.authLost = false; },
  };
});

// Signing in (no token yet): login, joining by an invitation, moving the base on a fresh server.
(function (root) {
  async function post(url, path, body, fetchImpl) {
    let r;
    try {
      r = await (fetchImpl || fetch)(String(url).replace(/\/+$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { return { ok: false, message: 'Сервер не отвечает. Проверьте адрес и интернет.' }; }
    try { return await r.json(); } catch { return { ok: false, message: `По этому адресу отвечает не Сервер Пульта (код ${r.status}).` }; }
  }
  async function hello(url, fetchImpl) {
    try {
      const r = await (fetchImpl || fetch)(String(url).replace(/\/+$/, '') + '/api/hello');
      const j = await r.json();
      return j && j.ok && j.version ? j : { ok: false, message: 'По этому адресу отвечает не Сервер Пульта.' };
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

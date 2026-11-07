'use strict';
// Desktop side of the customer cabinet: talks to the cabinet server through the team API and keeps
// a small local state (what was published, messages taken from the inbox, the inbox cursor).
// No Electron here, so tests run it against a real server; the key is passed in by main.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const KINDS = { answer: 'Ответ на запрос', call: 'Просьба перезвонить', urgent: 'Горящий вопрос', question: 'Вопрос', meeting: 'Перенос встречи' };
const MAX_MESSAGES = 2000;

// Accepts «cabinet.example.ru», «http://192.168.1.10:8080/», returns «https://cabinet.example.ru» or null.
function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) return null; // ftp://, file://…
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.username || u.password) return null;
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch { return null; }
}
// Plain http is fine inside the office network, not over the internet.
function isLocalHost(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || !h.includes('.');
  } catch { return false; }
}
// Publication fingerprint without the date stamp, so an unchanged project is not re-sent every day.
const modelHash = m => crypto.createHash('sha1').update(JSON.stringify({ ...m, publishedAt: '' })).digest('hex');

class CabinetError extends Error {}

// The local state file: <dir>/cabinet.json. Another place (the Tauri window) passes `storage` { load(), save(state) }.
function fileStorage(dir) {
  const file = path.join(dir, 'cabinet.json');
  return {
    load: () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } },
    save: state => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, file); },
  };
}

class Cabinet {
  constructor(dir, { url = () => '', key = () => '', fetchImpl = globalThis.fetch, timeoutMs = 15000, storage = null } = {}) {
    this.storage = storage || fileStorage(dir);
    this.url = url; this.key = key; this.fetch = fetchImpl; this.timeoutMs = timeoutMs;
    // files: projectId → ids of request files the server already has
    this.state = { seq: 0, messages: [], published: {}, files: {}, lastSync: null, lastError: null, ...(this.storage.load() || {}) };
  }
  save() { this.storage.save(this.state); }
  configured() { return !!(normalizeUrl(this.url()) && this.key()); }

  async request(method, p, body) {
    const base = normalizeUrl(this.url());
    if (!base || !this.key()) throw new CabinetError('Кабинет заказчика не настроен: укажите адрес сервера и ключ команды.');
    let r;
    try {
      r = await this.fetch(base + '/api/team' + p, {
        method, signal: AbortSignal.timeout(this.timeoutMs), timeoutMs: this.timeoutMs,
        headers: { Authorization: 'Bearer ' + this.key(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const why = e.name === 'TimeoutError' ? 'сервер не ответил вовремя' : (e.cause?.code || e.message);
      throw new CabinetError(`Нет связи с кабинетом (${why}). Проверьте адрес и что сервер запущен.`);
    }
    let data = null;
    try { data = await r.json(); } catch { /* not our server */ }
    if (!data || typeof data.ok !== 'boolean') throw new CabinetError(`По адресу ${base} отвечает не сервер кабинета (код ${r.status}).`);
    if (!data.ok) throw new CabinetError(data.message || `Ошибка сервера (${r.status}).`);
    return data;
  }

  ping() { return this.request('GET', '/ping'); }

  async publish(projectId, model) {
    await this.request('PUT', '/projects/' + encodeURIComponent(projectId), { model });
    this.state.published[projectId] = { at: new Date().toISOString(), hash: modelHash(model) };
    this.save();
    return this.state.published[projectId];
  }
  async unpublish(projectId) {
    await this.request('DELETE', '/projects/' + encodeURIComponent(projectId));
    delete this.state.published[projectId];
    delete this.state.files[projectId];
    this.save();
  }
  // A file attached to a request (for the customer to download and approve).
  async uploadFile(projectId, fileId, { name, type, bytes }) {
    await this.request('PUT', `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`, { name, type, data: Buffer.from(bytes).toString('base64') });
    const list = new Set(this.state.files[projectId] || []);
    list.add(fileId);
    this.state.files[projectId] = [...list];
    this.save();
  }
  async deleteFile(projectId, fileId) {
    await this.request('DELETE', `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`);
    this.state.files[projectId] = (this.state.files[projectId] || []).filter(x => x !== fileId);
    this.save();
  }
  // Re-sends published projects whose content changed since the last publication.
  async refreshPublished(modelOf, publish = (id, m) => this.publish(id, m)) {
    let sent = 0;
    for (const id of Object.keys(this.state.published)) {
      const m = modelOf(id);
      if (!m) continue; // project deleted or no longer visible: leave it, the GIP decides
      if (modelHash(m) === this.state.published[id].hash) continue;
      await publish(id, m);
      sent++;
    }
    return sent;
  }

  async customers() { return (await this.request('GET', '/customers')).customers; }
  createCustomer(c) { return this.request('POST', '/customers', c); }
  updateCustomer(id, patch) { return this.request('PATCH', '/customers/' + encodeURIComponent(id), patch); }
  deleteCustomer(id) { return this.request('DELETE', '/customers/' + encodeURIComponent(id)); }

  // Takes new messages from the server inbox; returns only the new ones.
  async poll() {
    try {
      const r = await this.request('GET', '/inbox?after=' + (this.state.seq || 0));
      const known = new Set(this.state.messages.map(m => m.id));
      const fresh = (r.messages || []).filter(m => m && m.id && !known.has(m.id))
        .map(m => ({ id: String(m.id), seq: Number(m.seq) || 0, projectId: String(m.projectId || ''), projectName: String(m.projectName || ''), kind: KINDS[m.kind] ? m.kind : 'urgent',
          text: String(m.text || '').slice(0, 2000), decision: ['approve', 'remarks'].includes(m.decision) ? m.decision : '', requestId: String(m.requestId || ''), requestTitle: String(m.requestTitle || ''), to: String(m.to || '').slice(0, 120), meetingTitle: String(m.meetingTitle || '').slice(0, 200), customerName: String(m.customerName || ''), ts: String(m.ts || ''), read: false }));
      // The server may have been reinstalled with an empty inbox: its counter is then behind ours,
      // so start over from zero next time (messages are de-duplicated by id).
      const top = Math.max(0, ...(r.messages || []).map(m => Number(m.seq) || 0));
      this.state.seq = (Number(r.seq) || 0) < this.state.seq ? 0 : Math.max(this.state.seq, top);
      this.state.messages = [...this.state.messages, ...fresh].slice(-MAX_MESSAGES);
      this.state.lastSync = new Date().toISOString();
      this.state.lastError = null;
      this.save();
      return fresh;
    } catch (e) {
      this.state.lastError = e.message;
      this.save();
      throw e;
    }
  }
  markRead(ids, read = true) {
    const set = new Set(ids);
    for (const m of this.state.messages) if (set.has(m.id)) m.read = read;
    this.save();
  }
  forgetPublished() { this.state.published = {}; this.state.files = {}; this.state.seq = 0; this.save(); }
}

module.exports = { Cabinet, CabinetError, normalizeUrl, isLocalHost, modelHash, KINDS };

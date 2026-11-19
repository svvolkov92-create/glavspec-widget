#!/usr/bin/env node
'use strict';
// «Сервер Пульта»: the shared base of the team. Node.js 20+, no dependencies.
// The data are the same as in a Пульт's own file; the same rules (src/core/handlers.js, chats.js, access.js) run
// here for the person who sent the request, so what someone may not see is never sent to their computer.
//   Accounts: login + password (scrypt); the GIP invites people (one-time code), turns them off.
//   Пульт / browser: GET /api/view — their part of the base; POST /api/rpc — every change; GET /api/wait — live updates.
//   Files: /api/files (attached to requests, cards, source data). Copies: every night, 30 days; the GIP downloads one any time.
//   The customer cabinet runs inside (server/cabinet-server.js) and is fed from this base (see cabinetOnBase).
// Run:  node pult-server.js      (config: config.json next to it, or env; see server/README.md)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = '1.0.1';
const LIB = fs.existsSync(path.join(__dirname, 'lib')) ? path.join(__dirname, 'lib') : path.join(__dirname, '..', 'src');
const SC = require(path.join(LIB, 'core', 'store-core.js'));
const L = require(path.join(LIB, 'renderer', 'logic.js'));
const A = require(path.join(LIB, 'renderer', 'access.js'));
const Composition = require(path.join(LIB, 'renderer', 'composition.js'));
const JournalDiff = require(path.join(LIB, 'core', 'journal-diff.js'));
const createCore = require(path.join(LIB, 'core', 'handlers.js'));
const createChats = require(path.join(LIB, 'core', 'chats.js'));

/* ---------------- config ---------------- */
function loadConfig(overrides = {}) {
  const file = overrides.configFile || process.env.PULT_CONFIG || path.join(__dirname, 'config.json');
  let fromFile = {};
  if (fs.existsSync(file)) fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const env = process.env;
  return {
    port: Number(env.PULT_PORT || fromFile.port || 8090),
    host: env.PULT_HOST || fromFile.host || '127.0.0.1',
    dataDir: path.resolve(__dirname, env.PULT_DATA || fromFile.dataDir || 'data'),
    name: fromFile.name || 'Сервер Пульта',
    publicUrl: env.PULT_PUBLIC_URL || fromFile.publicUrl || '',
    cabinetUrl: env.PULT_CABINET_URL || fromFile.cabinetUrl || '',  // what customers open (shown in Пульт)
    cabinetPort: Number(env.PULT_CABINET_PORT || fromFile.cabinetPort || 0), // 0 — no built-in cabinet
    trustProxy: !!(env.PULT_TRUST_PROXY || fromFile.trustProxy),
    sessionDays: Number(fromFile.sessionDays || 60),
    backupDays: Number(fromFile.backupDays || 30),
    webDir: fromFile.webDir || path.join(__dirname, 'web'),
    rendererDir: fromFile.rendererDir || path.join(LIB, 'renderer'),
    ...overrides,
  };
}

/* ---------------- small helpers ---------------- */
const token = (n = 24) => crypto.randomBytes(n).toString('base64url');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('base64url');
function hashPassword(pw, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(String(pw), salt, 32);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}
function checkPassword(pw, rec) {
  if (!rec?.salt || !rec?.hash) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(rec.salt, 'base64'), 32);
  const want = Buffer.from(rec.hash, 'base64');
  return want.length === hash.length && crypto.timingSafeEqual(hash, want);
}
// Codes people type: no 0/O/1/l.
function newCode(len = 8) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.randomBytes(len)].map(b => abc[b % abc.length]).join('');
}
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
const readJson = (file, dflt) => { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : dflt; } catch (e) { throw new Error(`Файл ${file} повреждён: ${e.message}`); } };
const today = () => L.todayStr();

/* ---------------- the base: data.json + journal.jsonl + accounts.json ---------------- */
function openBase(dir) {
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });
  const dataFile = path.join(dir, 'data.json'), accFile = path.join(dir, 'accounts.json'), journalFile = path.join(dir, 'journal.jsonl');
  const raw = readJson(dataFile, null);
  const store = {
    data: raw ? SC.fromParsed(raw) : SC.emptyData(),
    // Starts from the clock, not 0: after a restart a Пульт's remembered number can never match by chance.
    rev: Date.now(),
    snapshot() { return SC.snapshot(this.data); },
    apply(op) { SC.applyOp(this.data, op); this.save(); },
    applyAll(ops) { let n = 0; try { for (const op of ops) { SC.applyOp(this.data, op); n++; } } finally { if (n) this.save(); } },
    replaceAll(data) { this.data = data; this.save(); },
    save() { this.rev++; dirty = true; if (!timer) timer = setTimeout(flush, 300); wake(); },
  };
  let dirty = false, timer = null;
  // At most 0.3 s after the first unsaved change (a steady stream of changes must not postpone it).
  function flush() {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    dirty = false;
    writeAtomic(dataFile, JSON.stringify({ version: 1, ...store.data }));
  }
  const journal = {
    append(entries, meta) {
      if (!entries.length) return;
      const lines = JournalDiff.batchLines(entries, meta).map(x => JSON.stringify(x)).join('\n') + '\n';
      fs.appendFileSync(journalFile, lines);
    },
    // Newest first, as the Rust journal_read does.
    async read({ since = '' } = {}) {
      if (!fs.existsSync(journalFile)) return [];
      const lines = fs.readFileSync(journalFile, 'utf8').split('\n');
      const out = [];
      for (let i = lines.length - 1; i >= 0 && out.length < 3000; i--) {
        if (!lines[i]) continue;
        let e; try { e = JSON.parse(lines[i]); } catch { continue; }
        if (since && e.ts < since) break;
        out.push(e);
      }
      return out;
    },
  };
  // accounts: { byUser: { userId: { login, pw, disabled, createdAt } }, sessions: { sha(token): { userId, device, created, seen } },
  //             invites: { code: { userId, until, by } }, setupCode, grants }
  const acc = readJson(accFile, null) || { byUser: {}, sessions: {}, invites: {}, setupCode: newCode(10) };
  const saveAcc = () => writeAtomic(accFile, JSON.stringify(acc, null, 1));
  if (!fs.existsSync(accFile)) saveAcc();
  // Waiting clients (GET /api/wait): answered as soon as the base changes.
  const waiters = new Set();
  function wake() { for (const w of waiters) w(); waiters.clear(); }
  return { store, journal, acc, saveAcc, flush, waiters, wake, dir, dataFile, journalFile };
}

/* ---------------- nightly copies: backups/data-YYYY-MM-DD.json, kept N days ---------------- */
function backupNow(base, days) {
  base.flush();
  const file = path.join(base.dir, 'backups', `data-${today()}.json`);
  fs.copyFileSync(base.dataFile, file);
  const keep = Date.now() - days * 864e5;
  for (const name of fs.readdirSync(path.join(base.dir, 'backups'))) {
    const m = /^data-(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
    if (m && Date.parse(m[1]) < keep) fs.rmSync(path.join(base.dir, 'backups', name), { force: true });
  }
  return file;
}

/* ---------------- HTTP plumbing ---------------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// The desktop app's window has its own origin (tauri://localhost, http://tauri.localhost): it may call the API
// with its token. Browsers on other sites may not.
const ALLOWED_ORIGINS = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
function cors(req, res, cfg) {
  const o = req.headers.origin;
  if (!o) return;
  if (ALLOWED_ORIGINS.has(o) || (cfg.publicUrl && o === new URL(cfg.publicUrl).origin) || cfg.devOrigins?.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name, X-File-Type, X-File-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS });
  res.end(body);
}
function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SEC_HEADERS, ...extra });
  res.end(body);
}

/* ---------------- the server ---------------- */
function createServer(cfgIn = {}) {
  const cfg = loadConfig(cfgIn);
  const base = openBase(cfg.dataDir);
  const { store, journal, acc, saveAcc } = base;

  // The rules run for one person at a time: `actor` is who sent the request being answered.
  let actor = null;
  const settings = { get: k => (k === 'userId' ? actor : undefined), set: () => {} };
  const core = createCore({ store, journal, settings, A, L, Composition, diffBatch: JournalDiff.diffBatch, StoreError: SC.StoreError });
  const chats = createChats({ store, A, currentUser: () => core.currentUser() });
  // One request's rules at a time (some are async, e.g. the journal and the cabinet): no mixing of actors.
  let queue = Promise.resolve();
  // The shared rules fall back to «the first GIP» when the current user is unknown — on a server that must never
  // happen, so a person who is gone (deleted, or no such id) gets an error instead.
  function asUser(userId, fn) {
    const run = queue.then(async () => {
      const u = store.data.users[userId];
      if (!u || u.deletedAt) throw Object.assign(new Error('gone'), { status: 401 });
      actor = userId;
      try { return await fn(); } finally { actor = null; }
    });
    queue = run.catch(() => {});
    return run;
  }

  // Inside a request's turn: a part of it as another person (the customer page is always built as the GIP sees it).
  async function inTurnAs(userId, fn) {
    const was = actor;
    actor = userId;
    try { return await fn(); } finally { actor = was; }
  }

  /* ----- who is asking ----- */
  const sessionDays = cfg.sessionDays;
  function whoIs(req) {
    const h = String(req.headers.authorization || '');
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!t) return null;
    const s = acc.sessions[sha(t)];
    if (!s) return null;
    if (Date.now() - Date.parse(s.seen) > sessionDays * 864e5) { delete acc.sessions[sha(t)]; saveAcc(); return null; }
    const a = acc.byUser[s.userId], u = store.data.users[s.userId];
    if (!a || a.disabled || !u || u.deletedAt) return null;
    // «Last seen» is written at most once an hour.
    if (Date.now() - Date.parse(s.seen) > 3600e3) { s.seen = new Date().toISOString(); saveAcc(); }
    return { userId: s.userId, user: { ...u, id: s.userId }, sessionKey: sha(t) };
  }
  function openSession(userId, device) {
    const t = token(32), now = new Date().toISOString();
    acc.sessions[sha(t)] = { userId, device: String(device || '').slice(0, 80), created: now, seen: now };
    saveAcc();
    return t;
  }
  // Brute force: 10 wrong passwords from one address → 10 minutes of «подождите».
  const fails = new Map();
  const clientIp = req => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';
  function tooMany(ip) { const f = fails.get(ip); return f && f.n >= 10 && Date.now() - f.at < 10 * 60e3; }
  function failed(ip) {
    if (fails.size > 10000) for (const [k, f] of fails) if (Date.now() - f.at > 10 * 60e3) fails.delete(k);
    const f = fails.get(ip) || { n: 0, at: 0 }; if (Date.now() - f.at > 10 * 60e3) f.n = 0; f.n++; f.at = Date.now(); fails.set(ip, f); }

  const LOGIN_RE = /^[A-Za-z0-9._@-]{3,60}$/;
  const loginTaken = (login, except = '') => Object.entries(acc.byUser).some(([uid, a]) => uid !== except && a.login.toLowerCase() === String(login).toLowerCase());
  function checkNewAccount(login, password) {
    if (!LOGIN_RE.test(String(login || ''))) return 'Логин — от 3 знаков: латинские буквы, цифры, точка, дефис, @.';
    if (String(password || '').length < 8) return 'Пароль — не короче 8 знаков.';
    return null;
  }

  /* ----- the view of one person, with the rights the GIP gave ----- */
  // Called inside asUser (actor already set to the same person).
  function viewOf(userId) {
    const was = actor;
    actor = userId;
    try { return core.userView(); } finally { actor = was; }
  }

  /* ----- conflicts: two people changed the same field (offline, or at the same moment) ----- */
  // The client sends, for an update, the values it saw before its change (`prev`). A field that someone else
  // changed meanwhile — and that this change would overwrite with something else — is a conflict: the person chooses.
  const NO_CONFLICT = new Set(['notify', 'seen', 'updatedAt', 'history', 'comments']);
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  function conflictsOf(ops, prev) {
    const out = [];
    if (!prev || typeof prev !== 'object') return out;
    for (const o of ops) {
      if (o?.type !== 'update' || !o.data) continue;
      const had = prev[`${o.col}/${o.id}`];
      const cur = store.data[o.col]?.[o.id];
      if (!had || !cur) continue;
      for (const [k, mine] of Object.entries(o.data)) {
        if (NO_CONFLICT.has(k) || !(k in had)) continue;
        if (!same(cur[k], had[k]) && !same(cur[k], mine)) out.push({ col: o.col, id: o.id, field: k, mine, theirs: cur[k], was: had[k] });
      }
    }
    return out;
  }
  // History is a log: what others added meanwhile stays, the client's new items go after it.
  function mergeLogs(ops, prev) {
    for (const o of ops) {
      if (o?.type !== 'update' || !o.data) continue;
      const had = prev?.[`${o.col}/${o.id}`], cur = store.data[o.col]?.[o.id];
      for (const k of ['history', 'comments']) {
        if (!Array.isArray(o.data[k]) || !Array.isArray(had?.[k]) || !Array.isArray(cur?.[k]) || same(cur[k], had[k])) continue;
        const added = o.data[k].slice(had[k].length);
        o.data[k] = [...cur[k], ...added];
      }
    }
  }
  // A «set» of an existing record by someone who does not see all of it keeps what was hidden from them.
  function keepHidden(ops, me) {
    for (const o of ops) {
      if (o?.type !== 'set' || !o.data) continue;
      const cur = store.data[o.col]?.[o.id];
      if (!cur) continue;
      if (o.col === 'tasks' && !A.canSeeMoney(me)) for (const f of ['budget', 'payments', 'plan', 'invoiceReceived', 'invoiceDate', 'actSigned', 'actDate', 'contractNo', 'contractDate']) if (f in cur && !(f in o.data)) o.data[f] = cur[f];
      if (o.col === 'projects' && !A.isGip(me)) for (const f of ['contract', 'payments', 'bills']) if (f in cur && !(f in o.data)) o.data[f] = cur[f];
      if (o.col === 'contractors') for (const f of ['requisites']) if (f in cur && !(f in o.data)) o.data[f] = cur[f];
    }
  }

  /* ----- what a Пульт may call (POST /api/rpc { fn, args }) ----- */
  const RPC = {
    write: (me, ops, meta, prev) => {
      const list = Array.isArray(ops) ? ops : [ops];
      if (list.length > 500) return { ok: false, message: 'Слишком много изменений за раз.' };
      if (!(meta && meta.force)) {
        const c = conflictsOf(list, prev);
        if (c.length) return { ok: false, conflict: c, message: 'Пока вы правили, это же поле изменил другой человек.' };
      }
      mergeLogs(list, prev);
      keepHidden(list, me.user);
      return core.write(list, { action: meta?.action, undo: meta?.undo });
    },
    taskSeen: (me, id) => core.taskSeen(id),
    addComment: (me, id, text) => core.taskComment(id, text),
    editComment: (me, id, cid, text) => core.taskCommentEdit(id, cid, text),
    thankComment: (me, id, cid) => core.taskThank(id, cid),
    clearDemo: me => core.demoClear(),
    getJournal: (me, since) => core.journalGet({ since }),
    chatSend: (me, chatId, text, projectId) => chats.send(chatId, text, projectId),
    chatEdit: (me, chatId, msgId, text) => chats.edit(chatId, msgId, text),
    chatSeen: (me, chatId) => chats.seen(chatId),
    chatDirect: (me, uid) => chats.direct(uid),
    chatCreate: (me, input) => chats.create(input),
    chatUpdate: (me, chatId, input) => chats.update(chatId, input),
    chatLeave: (me, chatId) => chats.leave(chatId),
    chatSeedDemo: me => chats.seedDemo(),
    // Accounts — the GIP: who has a login, invitations, turning off, the devices someone is signed in on.
    accounts: me => {
      if (!A.canManageUsers(me.user)) return { ok: false, message: 'Входом в Пульт управляет ГИП.' };
      const list = Object.values(store.data.users).length ? store.snapshot().users.filter(u => !u.deletedAt).map(u => {
        const a = acc.byUser[u.id];
        const inv = Object.entries(acc.invites).find(([, i]) => i.userId === u.id && Date.parse(i.until) > Date.now());
        const devices = Object.values(acc.sessions).filter(s => s.userId === u.id).map(s => ({ device: s.device, seen: s.seen }));
        return { userId: u.id, name: u.name, role: u.role, login: a?.login || '', disabled: !!a?.disabled, invite: inv ? { code: inv[0], until: inv[1].until } : null, devices };
      }) : [];
      return { ok: true, accounts: list, server: { name: cfg.name, version: VERSION, publicUrl: cfg.publicUrl } };
    },
    inviteCreate: (me, userId) => {
      if (!A.canManageUsers(me.user)) return { ok: false, message: 'Приглашает ГИП.' };
      const u = store.data.users[userId];
      if (!u || u.deletedAt) return { ok: false, message: 'Человек не найден.' };
      for (const [c, i] of Object.entries(acc.invites)) if (i.userId === userId) delete acc.invites[c];
      const code = newCode(8);
      acc.invites[code] = { userId, until: new Date(Date.now() + 7 * 864e5).toISOString(), by: me.userId };
      saveAcc();
      return { ok: true, code, until: acc.invites[code].until, link: cfg.publicUrl ? `${cfg.publicUrl.replace(/\/$/, '')}/join/${code}` : '' };
    },
    accountDisable: (me, userId, off) => {
      if (!A.canManageUsers(me.user)) return { ok: false, message: 'Отключает ГИП.' };
      if (userId === me.userId) return { ok: false, message: 'Себя отключить нельзя.' };
      const a = acc.byUser[userId];
      if (!a) return { ok: false, message: 'У человека ещё нет входа.' };
      a.disabled = off !== false;
      if (a.disabled) for (const [k, s] of Object.entries(acc.sessions)) if (s.userId === userId) delete acc.sessions[k];
      saveAcc();
      return { ok: true };
    },
    // A new password through a new invitation: the old login stays, the person sets the password again.
    accountReset: (me, userId) => {
      if (!A.canManageUsers(me.user)) return { ok: false, message: 'Сбрасывает ГИП.' };
      const a = acc.byUser[userId];
      if (a) { a.pw = null; for (const [k, s] of Object.entries(acc.sessions)) if (s.userId === userId) delete acc.sessions[k]; }
      saveAcc();
      return RPC.inviteCreate(me, userId);
    },
    signOutOthers: me => {
      for (const [k, s] of Object.entries(acc.sessions)) if (s.userId === me.userId && k !== me.sessionKey) delete acc.sessions[k];
      saveAcc();
      return { ok: true };
    },
    passwordChange: (me, oldPw, newPw) => {
      const a = acc.byUser[me.userId];
      if (!a || !checkPassword(oldPw, a.pw)) return { ok: false, message: 'Текущий пароль неверный.' };
      if (String(newPw || '').length < 8) return { ok: false, message: 'Новый пароль — не короче 8 знаков.' };
      a.pw = hashPassword(newPw);
      saveAcc();
      return { ok: true };
    },
    // The whole base for the GIP's own copy (the «second place» of the backups).
    backupGet: me => {
      if (!A.canUseDataTools(me.user)) return { ok: false, message: 'Копию базы скачивает ГИП.' };
      return { ok: true, data: { version: 1, ...store.data }, at: new Date().toISOString() };
    },
    // Restore from a copy (GIP): the whole base is replaced; the current one is kept in backups first.
    backupRestore: (me, data) => {
      if (!A.canUseDataTools(me.user)) return { ok: false, message: 'Восстанавливает ГИП.' };
      let parsed;
      try { parsed = SC.fromBackup(data); } catch (e) { return { ok: false, message: e.message }; }
      if (!parsed.data.users[me.userId]) return { ok: false, message: 'В копии нет вашей учётной записи — восстановление заблокировало бы вход.' };
      base.flush();
      fs.copyFileSync(base.dataFile, path.join(base.dir, 'backups', `before-restore-${Date.now()}.json`));
      store.replaceAll(parsed.data);
      journal.append([{ col: 'users', id: me.userId, kind: 'update', title: 'база', changes: [{ f: 'restore', label: 'Восстановление из копии', to: `${parsed.count} записей` }] }], { action: 'Восстановление из копии', user: me.user.name });
      return { ok: true, count: parsed.count };
    },
  };

  /* ----- files: <data>/attachments/<project>/<file id> — the same layout as on a Пульт's computer ----- */
  const ATTACH_MAX = 30 * 1024 * 1024;
  const safeId = id => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const attachDir = pid => path.join(cfg.dataDir, 'attachments', safeId(pid));
  const projectVisible = (userId, pid) => viewOf(userId).projects.some(p => p.id === pid);

  /* ----- the customer cabinet on this base ----- */
  const cabinet = cfg.cabinetPort ? require('./cabinet-on-base.js')({ cfg, store, core, asUser, inTurnAs, A, L, LIB, attachDir, acc }) : null;
  RPC.cabinet = cabinet ? (me, fn, ...args) => cabinet.call(me, fn, args) : () => ({ ok: false, allowed: false, message: 'Кабинет заказчика на этом сервере не включён.' });

  /* ----- web client ----- */
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  function staticFile(res, root, rel) {
    const file = path.resolve(root, '.' + path.posix.normalize('/' + rel));
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
    return true;
  }

  // The page of the web version: the interface of Пульт with the browser bridge (server/web/web-api.js) in front.
  let webIndexCache = null;
  function webIndex() {
    if (webIndexCache && !cfg.devOrigins) return webIndexCache;
    let html = fs.readFileSync(path.join(cfg.rendererDir, 'index.html'), 'utf8');
    html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'">`);
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#F26A1F"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="web.css">');
    html = html.replace('<script src="calendar.js"></script>', '<script src="core/store-core.js"></script>\n<script src="core/remote-client.js"></script>\n<script src="web-api.js"></script>\n<script src="calendar.js"></script>');
    html = html.replace('<script src="feedback-ui.js"></script>', '');
    webIndexCache = html;
    return html;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    cors(req, res, cfg);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try {
      if (p === '/healthz') return json(res, 200, { ok: true, version: VERSION });
      if (p === '/api/hello') return json(res, 200, { ok: true, name: cfg.name, version: VERSION, setup: !Object.keys(acc.byUser).length, cabinetUrl: cfg.cabinetUrl || '' });

      /* --- first start: the GIP moves the base from their Пульт (code from the installation) --- */
      if (p === '/api/setup' && req.method === 'POST') {
        if (Object.keys(acc.byUser).length) return json(res, 409, { ok: false, message: 'Сервер уже настроен. Войдите своим логином.' });
        const ip = clientIp(req);
        if (tooMany(ip)) return json(res, 429, { ok: false, message: 'Слишком много попыток. Подождите 10 минут.' });
        const b = JSON.parse((await readBody(req, 64 * 1024 * 1024)).toString('utf8')) || {};
        if (String(b.code || '').trim().toUpperCase() !== acc.setupCode) { failed(ip); return json(res, 403, { ok: false, message: 'Код установки неверный — он показан при установке сервера.' }); }
        const err = checkNewAccount(b.login, b.password);
        if (err) return json(res, 400, { ok: false, message: err });
        let parsed;
        try { parsed = SC.fromBackup(b.data || {}); } catch (e) { return json(res, 400, { ok: false, message: e.message }); }
        const gip = parsed.data.users[b.userId];
        if (!gip || gip.deletedAt || gip.role !== 'gip') return json(res, 400, { ok: false, message: 'Переносить базу должен ГИП: выберите себя пользователем в Пульте.' });
        store.replaceAll(parsed.data);
        if (typeof b.journal === 'string' && b.journal.length < 32 * 1024 * 1024) fs.writeFileSync(base.journalFile, b.journal.endsWith('\n') || !b.journal ? b.journal : b.journal + '\n');
        acc.byUser[b.userId] = { login: b.login, pw: hashPassword(b.password), createdAt: new Date().toISOString() };
        acc.setupCode = null;
        saveAcc();
        journal.append([{ col: 'users', id: b.userId, kind: 'update', title: gip.name, changes: [{ f: 'server', label: 'База перенесена на сервер', to: `${parsed.count} записей` }] }], { action: 'Перенос базы на сервер', user: gip.name });
        return json(res, 200, { ok: true, token: openSession(b.userId, b.device), count: parsed.count });
      }

      if (p === '/api/login' && req.method === 'POST') {
        const ip = clientIp(req);
        if (tooMany(ip)) return json(res, 429, { ok: false, message: 'Слишком много попыток входа. Подождите 10 минут.' });
        const b = JSON.parse((await readBody(req, 8 * 1024)).toString('utf8')) || {};
        const hit = Object.entries(acc.byUser).find(([, a]) => a.login.toLowerCase() === String(b.login || '').trim().toLowerCase());
        const ok = hit && hit[1].pw && !hit[1].disabled && checkPassword(b.password, hit[1].pw) && store.data.users[hit[0]] && !store.data.users[hit[0]].deletedAt;
        if (!ok) { failed(ip); return json(res, 401, { ok: false, message: hit?.[1]?.disabled ? 'Вход отключён ГИПом.' : 'Неверный логин или пароль.' }); }
        const u = store.data.users[hit[0]];
        return json(res, 200, { ok: true, token: openSession(hit[0], b.device), me: { id: hit[0], name: u.name, role: u.role } });
      }

      // An invitation: the person sets their login and password once.
      if (p === '/api/join' && req.method === 'POST') {
        const ip = clientIp(req);
        if (tooMany(ip)) return json(res, 429, { ok: false, message: 'Слишком много попыток. Подождите 10 минут.' });
        const b = JSON.parse((await readBody(req, 8 * 1024)).toString('utf8')) || {};
        const code = String(b.code || '').trim().toUpperCase();
        const inv = acc.invites[code];
        if (!inv || Date.parse(inv.until) < Date.now()) { failed(ip); return json(res, 403, { ok: false, message: 'Приглашение не найдено или истекло — попросите ГИПа прислать новое.' }); }
        const u = store.data.users[inv.userId];
        if (!u || u.deletedAt) return json(res, 403, { ok: false, message: 'Этого человека уже нет в команде.' });
        const had = acc.byUser[inv.userId];
        const login = had?.login || b.login;
        const err = checkNewAccount(login, b.password);
        if (err) return json(res, 400, { ok: false, message: err });
        if (!had && loginTaken(login, inv.userId)) return json(res, 400, { ok: false, message: 'Такой логин уже занят — придумайте другой.' });
        acc.byUser[inv.userId] = { ...(had || {}), login, pw: hashPassword(b.password), disabled: false, createdAt: had?.createdAt || new Date().toISOString() };
        delete acc.invites[code];
        saveAcc();
        return json(res, 200, { ok: true, token: openSession(inv.userId, b.device), login, me: { id: inv.userId, name: u.name, role: u.role } });
      }
      if (p.startsWith('/join/')) {
        // The link from the invitation opens the web version with the code filled in.
        res.writeHead(302, { Location: `/app/#join=${encodeURIComponent(p.slice(6))}` });
        return res.end();
      }

      /* --- the web version (also on a phone) --- */
      if (p === '/' || p === '/app') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
      if (p.startsWith('/app/')) {
        const rel = p.slice(5) || 'index.html';
        if (rel === 'index.html' || rel === '') return send(res, 200, webIndex(), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
        if (staticFile(res, cfg.webDir, rel) || staticFile(res, cfg.rendererDir, rel) || (rel.startsWith('core/') && staticFile(res, path.join(LIB, 'core'), rel.slice(5)))) return;
        return send(res, 404, 'Не найдено.', 'text/plain; charset=utf-8');
      }

      if (!p.startsWith('/api/')) return send(res, 404, 'Не найдено.', 'text/plain; charset=utf-8');
      const me = whoIs(req);
      if (!me) return json(res, 401, { ok: false, auth: false, message: 'Войдите заново: сеанс закончился или вход отключён.' });

      if (p === '/api/view') {
        const data = await asUser(me.userId, () => core.userView());
        return json(res, 200, { ok: true, rev: store.rev, data, server: { name: cfg.name, version: VERSION, cabinetUrl: cfg.cabinetUrl || '' } });
      }
      // Live updates: answers when the base changes (or after 25 s with the same number).
      if (p === '/api/wait') {
        const since = Number(url.searchParams.get('rev'));
        if (since !== store.rev) return json(res, 200, { rev: store.rev });
        let done = false;
        const finish = () => { if (done) return; done = true; base.waiters.delete(finish); clearTimeout(t); json(res, 200, { rev: store.rev }); };
        const t = setTimeout(finish, 25_000);
        base.waiters.add(finish);
        req.on('close', () => { done = true; base.waiters.delete(finish); clearTimeout(t); });
        return;
      }
      if (p === '/api/rpc' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 64 * 1024 * 1024)).toString('utf8')) || {};
        const fn = RPC[b.fn];
        if (!fn || !Object.prototype.hasOwnProperty.call(RPC, b.fn)) return json(res, 400, { ok: false, message: `Неизвестная команда: ${b.fn}` });
        const args = Array.isArray(b.args) ? b.args : [];
        let r;
        try { r = await asUser(me.userId, () => fn(me, ...args)); }
        catch (e) {
          if (e.status === 401) throw e;
          // A broken change is refused, not «server error»: a Пульт would keep it in its queue and retry forever.
          console.error(`rpc ${b.fn}:`, e);
          r = { ok: false, message: `Сервер не смог выполнить действие: ${e.message}` };
        }
        return json(res, 200, { rev: store.rev, ...(r && typeof r === 'object' && !Array.isArray(r) ? r : { result: r }) });
      }
      // Upload: raw bytes, the name in X-File-Name (URI-encoded). X-File-Id: the id the file already has in the base
      // (moving files from a Пульт to the server) — only if that id is referenced and the file is not here yet.
      if (p === '/api/files' && req.method === 'POST') {
        const pid = safeId(url.searchParams.get('project'));
        if (!store.data.projects[pid] || !(await asUser(me.userId, () => projectVisible(me.userId, pid)))) return json(res, 404, { ok: false, message: 'Проект не найден.' });
        const bytes = await readBody(req, ATTACH_MAX + 1024);
        if (!bytes.length) return json(res, 400, { ok: false, message: 'Пустой файл.' });
        if (bytes.length > ATTACH_MAX) return json(res, 413, { ok: false, message: 'Файл больше 30 МБ.' });
        let id = safeId(req.headers['x-file-id']);
        const dir = attachDir(pid);
        fs.mkdirSync(dir, { recursive: true });
        if (id) { if (fs.existsSync(path.join(dir, id))) return json(res, 200, { ok: true, existed: true, file: { id } }); }
        else id = 'f' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
        fs.writeFileSync(path.join(dir, id), bytes);
        const name = decodeURIComponent(String(req.headers['x-file-name'] || 'файл')).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200) || 'файл';
        return json(res, 200, { ok: true, file: { id, name, size: bytes.length, type: String(req.headers['x-file-type'] || 'application/octet-stream').slice(0, 100), at: new Date().toISOString(), by: me.userId } });
      }
      const fm = /^\/api\/files\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64})$/.exec(p);
      if (fm) {
        const [, pid, fid] = fm;
        if (!(await asUser(me.userId, () => projectVisible(me.userId, pid)))) return json(res, 404, { ok: false, message: 'Файл не найден.' });
        const f = path.join(attachDir(pid), fid);
        if (!fs.existsSync(f)) return json(res, 404, { ok: false, message: 'Файла нет на сервере — его ещё не перенесли с компьютера, где приложили.' });
        return send(res, 200, fs.readFileSync(f), 'application/octet-stream', { 'Cache-Control': 'private, max-age=3600' });
      }
      return json(res, 404, { ok: false, message: 'Не найдено.' });
    } catch (e) {
      if (e.status === 413) return json(res, 413, { ok: false, message: 'Слишком большой запрос.' });
      if (e.status === 401) return json(res, 401, { ok: false, auth: false, message: 'Войдите заново: вас нет в команде.' });
      if (e instanceof SyntaxError) return json(res, 400, { ok: false, message: 'Неверный формат запроса.' });
      console.error(e);
      return json(res, 500, { ok: false, message: 'Ошибка сервера.' });
    }
  }

  const server = http.createServer(handle);
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;
  // Nightly copy at about 03:00 server time, and once at start if there is none for today.
  let lastBackup = '';
  const tick = () => {
    try {
      if (!Object.keys(acc.byUser).length) return;
      const d = today();
      // Once a day after 03:00; today's copy is never overwritten (a restart in the afternoon keeps the night's state).
      const has = fs.existsSync(path.join(cfg.dataDir, 'backups', `data-${d}.json`));
      if (d !== lastBackup && !has && new Date().getHours() >= 3) { backupNow(base, cfg.backupDays); lastBackup = d; }
      else if (has) lastBackup = d;
      const gip = Object.keys(acc.byUser).find(id => store.data.users[id]?.role === 'gip' && !store.data.users[id]?.deletedAt);
      if (gip) asUser(gip, () => core.purgeTrash()).catch(e => console.error('Корзина:', e.message));
    } catch (e) { console.error('Копия базы:', e); }
  };
  const timers = [setInterval(tick, 30 * 60e3), setTimeout(tick, 5e3)];
  for (const t of timers) t.unref?.();
  return { server, cfg, base, store, acc, core, cabinet, close: () => { for (const t of timers) clearInterval(t); base.flush(); cabinet?.stop(); } };
}

module.exports = { createServer, loadConfig, hashPassword, checkPassword, VERSION };

if (require.main === module) {
  const app = createServer();
  const { server, cfg, acc } = app;
  server.listen(cfg.port, cfg.host, () => {
    console.log(`Сервер Пульта ${VERSION}: http://${cfg.host}:${cfg.port}  данные: ${cfg.dataDir}`);
    if (acc.setupCode) console.log(`Код установки (введите в Пульте ГИПа → «Перенести мою базу на сервер»): ${acc.setupCode}`);
  });
  const stop = () => { app.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

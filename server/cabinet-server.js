#!/usr/bin/env node
'use strict';
// «Кабинет заказчика»: a small web server without dependencies (Node.js 20+).
// The desktop app publishes what a customer may see (page models) and manages customer accounts
// through the team API (one secret key). Customers log in with a login and password, see their
// projects, answer requests, ask for a call back or send an urgent question — the desktop app
// collects those messages from the inbox.
//
// Run:  node cabinet-server.js            (config: config.json next to this file, or env, see README)
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = '1.2.0';
// Shared code: in the repository it lives in ../src, in the server package in ./lib.
const LIB = fs.existsSync(path.join(__dirname, 'lib')) ? path.join(__dirname, 'lib') : path.join(__dirname, '..', 'src');
const { renderPage, meetingIcs } = require(path.join(LIB, 'report', 'customer.js'));
const ASSETS = {
  logo: path.join(LIB, 'renderer', 'brand', 'tandem-logo.svg'),
  golos: path.join(LIB, 'renderer', 'fonts', 'GolosText.ttf'),
  montserrat: path.join(LIB, 'renderer', 'fonts', 'Montserrat.ttf'),
};

/* ---------------- config ---------------- */
function loadConfig(overrides = {}) {
  const file = overrides.configFile || process.env.CABINET_CONFIG || path.join(__dirname, 'config.json');
  let fromFile = {};
  if (fs.existsSync(file)) fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const env = process.env;
  const cfg = {
    port: Number(env.CABINET_PORT || fromFile.port || 8080),
    host: env.CABINET_HOST || fromFile.host || '0.0.0.0',
    dataDir: path.resolve(__dirname, env.CABINET_DATA || fromFile.dataDir || 'data'),
    title: fromFile.title || 'Кабинет заказчика',
    font: fromFile.font === 'montserrat' ? 'montserrat' : 'golos',
    timeZone: env.CABINET_TZ || fromFile.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    tls: fromFile.tls || null, // { cert, key } — or put the server behind Caddy / nginx
    trustProxy: !!(env.CABINET_TRUST_PROXY || fromFile.trustProxy),
    sessionDays: Number(fromFile.sessionDays || 30),
    ...overrides,
  };
  return cfg;
}

/* ---------------- storage: one JSON file, written atomically ---------------- */
function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'cabinet.json');
  let data = { projects: {}, customers: {}, sessions: {}, inbox: [], seq: 0, sent: {}, secrets: {} };
  if (fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  let timer = null;
  const flush = () => {
    timer = null;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  };
  return {
    get data() { return data; },
    save(now = false) { if (now) { clearTimeout(timer); flush(); } else if (!timer) timer = setTimeout(flush, 200); },
    flush() { if (timer) { clearTimeout(timer); flush(); } },
    file,
  };
}

/* ---------------- passwords and tokens ---------------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
function hashPassword(pw, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(String(pw), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}
function checkPassword(pw, rec) {
  if (!rec?.salt || !rec?.hash) { hashPassword(pw); return false; } // same work for unknown logins
  const got = crypto.scryptSync(String(pw), Buffer.from(rec.salt, 'base64'), SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  const want = Buffer.from(rec.hash, 'base64');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const token = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
// Readable generated passwords: no 0/O, 1/l/I.
function newPassword(len = 10) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(len);
  return Array.from(b, x => abc[x % abc.length]).join('');
}
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* ---------------- request helpers ---------------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const parseForm = s => Object.fromEntries(new URLSearchParams(s));
function parseCookies(h = '') {
  const out = {};
  for (const part of h.split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/* ---------------- the server ---------------- */
function createServer(cfgIn = {}) {
  const cfg = loadConfig(cfgIn);
  const store = openStore(cfg.dataDir);
  const D = () => store.data;
  // Secrets are generated on first start and kept with the data.
  if (!D().secrets.teamKey) { D().secrets.teamKey = cfg.teamKey || token(32); store.save(true); }
  if (cfg.teamKey && D().secrets.teamKey !== cfg.teamKey) { D().secrets.teamKey = cfg.teamKey; store.save(true); }

  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const logoSvg = fs.existsSync(ASSETS.logo) ? fs.readFileSync(ASSETS.logo, 'utf8') : '';
  const fontFile = cfg.font === 'montserrat' ? ASSETS.montserrat : ASSETS.golos;
  const fontName = cfg.font === 'montserrat' ? 'Montserrat' : 'Golos Text';

  // Login throttling: per address and per login, failures in a sliding window.
  const fails = new Map();
  const WINDOW = 15 * 60 * 1000;
  const throttled = key => { const list = (fails.get(key) || []).filter(t => Date.now() - t < WINDOW); fails.set(key, list); return list.length; };
  const fail = key => fails.set(key, [...(fails.get(key) || []), Date.now()]);

  function headers(res, extra = {}) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; manifest-src 'self'; worker-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (cfg.tls) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  }
  const send = (res, status, body, type = 'text/html; charset=utf-8', extra = {}) => { headers(res, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.statusCode = status; res.end(body); };
  const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
  const redirect = (res, to, extra = {}) => { headers(res, { Location: to, 'Cache-Control': 'no-store', ...extra }); res.statusCode = 303; res.end(); };
  const clientIp = req => (cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
  const secure = req => !!cfg.tls || (cfg.trustProxy && req.headers['x-forwarded-proto'] === 'https');

  /* ----- sessions ----- */
  function sessionOf(req) {
    const sid = parseCookies(req.headers.cookie).cab;
    const s = sid && D().sessions[sid];
    if (!s) return null;
    const c = D().customers[s.customerId];
    if (!c || c.disabled || s.exp < Date.now() || s.pwAt !== c.pwAt) { delete D().sessions[sid]; store.save(); return null; }
    return { sid, ...s, customer: c };
  }
  function startSession(res, req, customerId) {
    const sid = token(32), c = D().customers[customerId];
    // Old sessions of expired dates are pruned on each login.
    for (const [k, v] of Object.entries(D().sessions)) if (v.exp < Date.now()) delete D().sessions[k];
    D().sessions[sid] = { customerId, exp: Date.now() + cfg.sessionDays * 864e5, csrf: token(18), pwAt: c.pwAt };
    store.save();
    return `cab=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cfg.sessionDays * 86400}${secure(req) ? '; Secure' : ''}`;
  }
  // Forms must come from this site: the Origin (when sent) matches the Host, and the session's CSRF token is present.
  const sameOrigin = req => { const o = req.headers.origin; if (!o || o === 'null') return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };

  /* ----- pages ----- */
  const shell = (title, body) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F26A1F"><link rel="icon" href="/icon.svg"><script src="/sw-register.js" defer></script>
<style>@font-face{font-family:"${fontName}";src:url(/font.ttf) format("truetype");font-weight:300 900}
*{box-sizing:border-box}body{margin:0;background:#F2F4F7;color:#1D1E21;font:15px/1.45 "${fontName}","Segoe UI",Arial,sans-serif}
.wrap{max-width:460px;margin:0 auto;padding:40px 18px}.logo svg{height:36px;display:block;margin-bottom:22px}
.card{background:#fff;border:1px solid #DFE4EA;border-radius:4px;padding:22px}h1{font-size:21px;margin:0 0 14px}
label{display:block;font-size:12px;color:#5E6673;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
input{width:100%;border:1px solid #DFE4EA;border-radius:3px;padding:10px;font:inherit}button{margin-top:16px;width:100%;background:#F26A1F;color:#fff;border:0;border-radius:3px;padding:11px;font:inherit;font-weight:700;cursor:pointer}
.err{color:#B3261E;margin:10px 0 0}.mu{color:#5E6673;font-size:13px}a.pr{display:block;background:#fff;border:1px solid #DFE4EA;border-radius:4px;padding:14px 16px;margin-bottom:10px;text-decoration:none;color:inherit}
a.pr b{display:block;font-size:16px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.top form button{width:auto;margin:0;background:#fff;color:#1D1E21;border:1px solid #DFE4EA;padding:6px 12px}
</style></head><body><div class="wrap"><div class="logo">${logoSvg}</div>${body}</div></body></html>`;
  const loginPage = (err = '', login = '') => shell(cfg.title, `<form class="card" method="post" action="/login"><h1>${esc(cfg.title)}</h1>
    <label for="l">Логин</label><input id="l" name="login" autocomplete="username" required maxlength="80" value="${esc(login)}" autofocus>
    <label for="p">Пароль</label><input id="p" name="password" type="password" autocomplete="current-password" required maxlength="200">
    <button type="submit">Войти</button>${err ? `<p class="err">${esc(err)}</p>` : ''}<p class="mu">Логин и пароль выдаёт главный инженер проекта.</p></form>`);
  const visibleProjects = c => (c.projectIds || []).map(id => D().projects[id]).filter(Boolean);

  /* ----- team API (desktop app) ----- */
  function teamAuth(req) {
    const h = String(req.headers.authorization || '');
    return h.startsWith('Bearer ') && safeEqual(h.slice(7), D().secrets.teamKey);
  }
  const publicCustomer = c => ({ id: c.id, name: c.name, login: c.login, projectIds: c.projectIds || [], disabled: !!c.disabled, createdAt: c.createdAt, lastLoginAt: c.lastLoginAt || null });
  function validModel(id, m) {
    if (!m || typeof m !== 'object' || !m.project || m.project.id !== id) return 'Данные проекта повреждены.';
    if (JSON.stringify(m).length > 1_500_000) return 'Слишком большой проект.';
    if (!Array.isArray(m.sections) || m.sections.length > 600) return 'Разделы проекта повреждены.';
    return null;
  }
  // Files attached to requests: <data>/files/<project>/<file id>, the names in data.files[project][file id].
  const FILE_MAX = 30 * 1024 * 1024;
  const safeId = v => /^[A-Za-z0-9_-]{1,64}$/.test(String(v)) ? String(v) : null;
  const filesDir = pid => path.join(cfg.dataDir, 'files', pid);
  function dropProjectFiles(pid) {
    try { fs.rmSync(filesDir(pid), { recursive: true, force: true }); } catch { /* nothing to drop */ }
    if (D().files) delete D().files[pid];
  }
  async function team(req, res, url) {
    if (!teamAuth(req)) return json(res, 401, { ok: false, message: 'Неверный ключ команды.' });
    const parts = url.pathname.split('/').filter(Boolean).slice(2); // after /api/team
    if (parts[0] === 'projects' && parts[2] === 'files' && parts[3]) {
      const pid = safeId(decodeURIComponent(parts[1])), fid = safeId(decodeURIComponent(parts[3]));
      if (!pid || !fid) return json(res, 400, { ok: false, message: 'Неверный файл.' });
      const meta = ((D().files ||= {})[pid] ||= {});
      if (req.method === 'PUT') {
        const b = JSON.parse((await readBody(req, Math.ceil(FILE_MAX * 1.4) + 4096)) || '{}');
        const bytes = Buffer.from(String(b.data || ''), 'base64');
        if (!bytes.length || bytes.length > FILE_MAX) return json(res, 400, { ok: false, message: 'Файл пустой или больше 30 МБ.' });
        fs.mkdirSync(filesDir(pid), { recursive: true });
        fs.writeFileSync(path.join(filesDir(pid), fid), bytes);
        meta[fid] = { name: str(b.name, 200) || 'файл', type: str(b.type, 100) || 'application/octet-stream', size: bytes.length, at: new Date().toISOString() };
        store.save();
        return json(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        try { fs.unlinkSync(path.join(filesDir(pid), fid)); } catch { /* already gone */ }
        delete meta[fid];
        store.save();
        return json(res, 200, { ok: true });
      }
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.parse((await readBody(req, 2_000_000)) || '{}') : null;
    if (parts[0] === 'ping') return json(res, 200, { ok: true, version: VERSION, projects: Object.keys(D().projects).length, customers: Object.keys(D().customers).length });
    if (parts[0] === 'projects' && parts[1]) {
      const id = decodeURIComponent(parts[1]);
      if (req.method === 'PUT') {
        const err = validModel(id, body?.model);
        if (err) return json(res, 400, { ok: false, message: err });
        D().projects[id] = { ...body.model, receivedAt: new Date().toISOString() };
        store.save();
        return json(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') { delete D().projects[id]; dropProjectFiles(safeId(id) || '_'); store.save(); return json(res, 200, { ok: true }); }
    }
    if (parts[0] === 'customers') {
      const id = parts[1] && decodeURIComponent(parts[1]);
      if (req.method === 'GET' && !id) return json(res, 200, { ok: true, customers: Object.values(D().customers).map(publicCustomer) });
      if (req.method === 'POST' && !id) {
        const login = str(body?.login, 80).toLowerCase(), name = str(body?.name, 120);
        if (!login || !name) return json(res, 400, { ok: false, message: 'Укажите имя и логин заказчика.' });
        if (Object.values(D().customers).some(c => c.login === login)) return json(res, 409, { ok: false, message: 'Такой логин уже есть.' });
        const password = newPassword(), cid = token(9);
        D().customers[cid] = { id: cid, name, login, projectIds: (body.projectIds || []).map(x => str(x, 60)).slice(0, 200), ...hashPassword(password), pwAt: Date.now(), createdAt: new Date().toISOString() };
        store.save();
        return json(res, 200, { ok: true, customer: publicCustomer(D().customers[cid]), password });
      }
      const c = id && D().customers[id];
      if (!c) return json(res, 404, { ok: false, message: 'Заказчик не найден.' });
      if (req.method === 'PATCH') {
        if (body.name !== undefined) c.name = str(body.name, 120) || c.name;
        if (Array.isArray(body.projectIds)) c.projectIds = body.projectIds.map(x => str(x, 60)).slice(0, 200);
        if (body.disabled !== undefined) c.disabled = !!body.disabled;
        let password;
        if (body.resetPassword) { password = newPassword(); Object.assign(c, hashPassword(password), { pwAt: Date.now() }); } // ends all sessions
        store.save();
        return json(res, 200, { ok: true, customer: publicCustomer(c), ...(password ? { password } : {}) });
      }
      if (req.method === 'DELETE') {
        delete D().customers[id];
        for (const [k, s] of Object.entries(D().sessions)) if (s.customerId === id) delete D().sessions[k];
        store.save();
        return json(res, 200, { ok: true });
      }
    }
    if (parts[0] === 'inbox' && req.method === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      return json(res, 200, { ok: true, messages: D().inbox.filter(m => m.seq > after).slice(0, 500), seq: D().seq });
    }
    return json(res, 404, { ok: false, message: 'Нет такого адреса.' });
  }

  /* ----- customer side ----- */
  const KINDS = { answer: 'Ответ на запрос', call: 'Просьба перезвонить', urgent: 'Горящий вопрос', question: 'Вопрос', meeting: 'Перенос встречи' };
  function addMessage(s, projectId, kind, text, request, extra = {}) {
    const m = D().projects[projectId];
    D().seq += 1;
    D().inbox.push({ seq: D().seq, id: token(9), projectId, kind, text, requestId: request?.id || '', requestTitle: request?.title || '', ...extra,
      customerId: s.customerId, customerName: s.customer.name, projectName: m?.project?.name || '', ts: new Date().toISOString() });
    if (D().inbox.length > 5000) D().inbox.splice(0, D().inbox.length - 5000);
    store.save();
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (p.startsWith('/api/team/')) return await team(req, res, url);
      // static
      if (p === '/font.ttf' && fs.existsSync(fontFile)) return send(res, 200, fs.readFileSync(fontFile), 'font/ttf', { 'Cache-Control': 'public, max-age=604800' });
      if (p === '/logo.svg' || p === '/icon.svg') return send(res, 200, p === '/logo.svg' ? logoSvg : ICON, 'image/svg+xml', { 'Cache-Control': 'public, max-age=86400' });
      if (p === '/manifest.webmanifest') return send(res, 200, JSON.stringify({ name: cfg.title, short_name: 'Кабинет', start_url: '/', display: 'standalone', background_color: '#F2F4F7', theme_color: '#F26A1F', lang: 'ru', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }), 'application/manifest+json');
      if (p === '/sw.js') return send(res, 200, SW, 'text/javascript; charset=utf-8', { 'Service-Worker-Allowed': '/' });
      if (p === '/sw-register.js') return send(res, 200, "if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});", 'text/javascript; charset=utf-8');
      if (p === '/health') return json(res, 200, { ok: true });

      if (p === '/login' && req.method === 'GET') return send(res, 200, loginPage());
      if (p === '/login' && req.method === 'POST') {
        if (!sameOrigin(req)) return send(res, 403, loginPage('Форма отправлена не с этого сайта.'));
        const f = parseForm(await readBody(req, 8_000));
        const login = str(f.login, 80).toLowerCase(), ip = clientIp(req);
        if (throttled('ip:' + ip) >= 20 || throttled('login:' + login) >= 8) return send(res, 429, loginPage('Слишком много попыток. Подождите 15 минут.', login));
        const c = Object.values(D().customers).find(x => x.login === login && !x.disabled);
        if (!checkPassword(f.password || '', c)) { fail('ip:' + ip); fail('login:' + login); return send(res, 401, loginPage('Неверный логин или пароль.', login)); }
        c.lastLoginAt = new Date().toISOString();
        return redirect(res, '/', { 'Set-Cookie': startSession(res, req, c.id) });
      }
      const s = sessionOf(req);
      if (!s) return req.method === 'GET' ? redirect(res, '/login') : send(res, 401, loginPage('Сессия закончилась, войдите снова.'));
      if (req.method === 'POST') {
        if (!sameOrigin(req)) return send(res, 403, 'Форма отправлена не с этого сайта.', 'text/plain; charset=utf-8');
        const f = parseForm(await readBody(req, 16_000));
        if (!safeEqual(f.csrf || '', s.csrf)) return send(res, 403, 'Устаревшая форма — обновите страницу.', 'text/plain; charset=utf-8');
        if (p === '/logout') { delete D().sessions[s.sid]; store.save(); return redirect(res, '/login', { 'Set-Cookie': 'cab=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }); }
        const pid = str(f.project, 60), m = D().projects[pid];
        if (!m || !(s.customer.projectIds || []).includes(pid)) return send(res, 404, 'Проект не найден.', 'text/plain; charset=utf-8');
        const text = str(f.text, 2000);
        const back = (flash, hash = '') => redirect(res, `/p/${encodeURIComponent(pid)}?ok=${flash}${hash}`);
        if (p === '/c/answer') {
          const r = (m.project.requests || []).find(x => x.id === f.request);
          // Files sent for approval: «Согласовано» needs no text, remarks do.
          const decision = r?.files?.length && ['approve', 'remarks'].includes(f.decision) ? f.decision : '';
          const said = decision === 'approve' ? (text || 'Согласовано') : text;
          if (!r || !said) return back('empty');
          addMessage(s, pid, 'answer', said, r, decision ? { decision } : {});
          ((D().sent[s.customerId] ||= {})[pid] ||= {})[r.id] = (decision === 'remarks' ? 'Есть замечания: ' : '') + said.slice(0, 200);
          store.save();
          return back('answer', '#q');
        }
        if (p === '/c/call') { addMessage(s, pid, 'call', text || 'Перезвоните, пожалуйста'); return back('call'); }
        if (p === '/c/urgent') { if (!text) return back('empty'); addMessage(s, pid, 'urgent', text); return back('urgent', '#q'); }
        // A question to someone of the project team (names come from the published model).
        if (p === '/c/question') {
          if (!text) return back('empty', '#q');
          const names = [m.contact?.name, ...(m.team || []).map(t => t.name)].filter(Boolean);
          const to = names.includes(f.to) ? f.to : (m.contact?.name || '');
          addMessage(s, pid, 'question', text, null, { to });
          return back('question', '#q');
        }
        if (p === '/c/meeting') {
          const mt = (m.project.meetings || []).find(x => x.id === f.meeting);
          if (!mt || !text) return back('empty', '#meet');
          addMessage(s, pid, 'meeting', text, null, { meetingTitle: `${mt.title || 'Встреча'} ${mt.date}` });
          return back('meeting', '#meet');
        }
        return send(res, 404, 'Нет такого адреса.', 'text/plain; charset=utf-8');
      }
      const list = visibleProjects(s.customer);
      if (p === '/') {
        if (list.length === 1) return redirect(res, `/p/${encodeURIComponent(list[0].project.id)}`);
        return send(res, 200, shell(cfg.title, `<div class="top"><b>${esc(s.customer.name)}</b><form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(s.csrf)}"><button type="submit">Выйти</button></form></div>
          ${list.length ? list.map(x => `<a class="pr" href="/p/${encodeURIComponent(x.project.id)}"><b>${esc(x.project.name)}</b><span class="mu">${esc(x.project.code ? 'Шифр ' + x.project.code + ' · ' : '')}обновлено ${esc(String(x.publishedAt || '').split('-').reverse().join('.'))}</span></a>`).join('')
            : '<div class="card"><p>Проекты ещё не открыты для вас. Главный инженер проекта откроет доступ.</p></div>'}`));
      }
      // A file attached to a request of a project this customer sees.
      const fm = p.match(/^\/p\/([^/]+)\/f\/([^/]+)$/);
      if (fm) {
        const pid = safeId(decodeURIComponent(fm[1])), fid = safeId(decodeURIComponent(fm[2]));
        const m = pid && D().projects[pid];
        const listed = m && (s.customer.projectIds || []).includes(pid) && (m.project.requests || []).some(r => (r.files || []).some(x => x.id === fid));
        const meta = listed && D().files?.[pid]?.[fid];
        const file = meta && path.join(filesDir(pid), fid);
        if (!file || !fs.existsSync(file)) return send(res, 404, 'Файл не найден — возможно, ГИП ещё не отправил его.', 'text/plain; charset=utf-8');
        const ascii = meta.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
        return send(res, 200, fs.readFileSync(file), meta.type, { 'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      }
      const ics = p.match(/^\/p\/([^/]+)\/meeting\/([^/]+)\.ics$/);
      if (ics) {
        const pid = decodeURIComponent(ics[1]), m = D().projects[pid];
        const mt = m && (s.customer.projectIds || []).includes(pid) && (m.project.meetings || []).find(x => x.id === decodeURIComponent(ics[2]));
        if (!mt) return send(res, 404, 'Встреча не найдена.', 'text/plain; charset=utf-8');
        return send(res, 200, meetingIcs(m, mt), 'text/calendar; charset=utf-8', { 'Content-Disposition': 'attachment; filename="meeting.ics"' });
      }
      const mm = p.match(/^\/p\/([^/]+)$/);
      if (mm) {
        const pid = decodeURIComponent(mm[1]), m = D().projects[pid];
        if (!m || !(s.customer.projectIds || []).includes(pid)) return send(res, 404, shell(cfg.title, '<div class="card"><p>Проект не найден.</p><p><a href="/">← Мои проекты</a></p></div>'));
        const flash = { answer: 'Ответ отправлен главному инженеру проекта.', call: 'Просьба перезвонить отправлена.', urgent: 'Вопрос отправлен — ГИП увидит его сразу.', question: 'Вопрос отправлен.', meeting: 'Просьба перенести встречу отправлена.', empty: 'Напишите текст сообщения.' }[url.searchParams.get('ok')] || '';
        // What this customer sent on this project: shown in «Вопросы» (newest first).
        const messages = D().inbox.filter(x => x.customerId === s.customerId && x.projectId === pid).slice(-40).reverse().map(x => ({ kind: x.kind, text: x.text, to: x.to || '', requestTitle: x.requestTitle || '', ts: x.ts }));
        const html = renderPage(m, { today: today(), logoSvg, fontName, fontUrl: '/font.ttf', cabinet: { csrf: s.csrf, base: '', flash, sent: D().sent[s.customerId]?.[pid] || {}, customerName: s.customer.name, projects: list.length, messages, title: cfg.title === 'Кабинет заказчика' ? 'Мой Тандем' : cfg.title } })
          .replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F26A1F"><link rel="icon" href="/icon.svg"><script src="/sw-register.js" defer></script></head>');
        return send(res, 200, html);
      }
      return send(res, 404, shell(cfg.title, '<div class="card"><p>Страница не найдена.</p><p><a href="/">← Мои проекты</a></p></div>'));
    } catch (e) {
      if (e.status === 413) return send(res, 413, 'Слишком большой запрос.', 'text/plain; charset=utf-8');
      if (e instanceof SyntaxError) return json(res, 400, { ok: false, message: 'Неверный формат запроса.' });
      console.error(e);
      return send(res, 500, 'Ошибка сервера.', 'text/plain; charset=utf-8');
    }
  }

  const server = cfg.tls ? https.createServer({ cert: fs.readFileSync(cfg.tls.cert), key: fs.readFileSync(cfg.tls.key) }, handle) : http.createServer(handle);
  server.headersTimeout = 20_000;
  server.requestTimeout = 30_000;
  return { server, cfg, store, KINDS, teamKey: () => D().secrets.teamKey };
}

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#F26A1F"/><path d="M22 30h52M22 48h40M22 66h28" stroke="#fff" stroke-width="9" stroke-linecap="round"/></svg>';
// Network-first service worker: makes the cabinet installable on a phone; nothing is cached for offline use.
const SW = "self.addEventListener('install', e => self.skipWaiting()); self.addEventListener('activate', e => self.clients.claim()); self.addEventListener('fetch', () => {});";

module.exports = { createServer, hashPassword, checkPassword, newPassword, VERSION };

if (require.main === module) {
  if (process.argv.includes('--new-key')) {
    // Replaces the team key: the old one stops working, every «Пульт» needs the new one.
    const cfg = loadConfig();
    const store = openStore(cfg.dataDir);
    store.data.secrets.teamKey = token(32);
    store.save(true);
    console.log(`Новый ключ команды: ${store.data.secrets.teamKey}`);
    process.exit(0);
  }
  const { server, cfg, store, teamKey } = createServer();
  server.listen(cfg.port, cfg.host, () => {
    console.log(`Кабинет заказчика ${VERSION}: ${cfg.tls ? 'https' : 'http'}://${cfg.host}:${cfg.port}`);
    console.log(`Данные: ${store.file}`);
    console.log(`Ключ команды (вставьте в «Пульт» → Настройки → Кабинет заказчика): ${teamKey()}`);
  });
  const stop = () => { store.flush(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

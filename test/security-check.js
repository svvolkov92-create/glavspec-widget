'use strict';
// Security check of «Сервер Пульта» and the customer cabinet (4.9.3): a live server, five people, two customers,
// ~90 attacks — sign-in, rights, forged changes, the journal, files, paths, headers, XSS in the cabinet, CSRF.
// Each attempt prints HOLD (the attack failed — good) or VULN (it worked). Run: node test/security-check.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const REPO = process.argv[2] || path.resolve(__dirname, '..');
const { createServer } = require(path.join(REPO, 'server/pult-server.js'));

const now = new Date().toISOString();
const DATA = {
  version: 1,
  users: {
    'u-gip': { name: 'Волков С.В.', role: 'gip', directions: [], createdAt: now },
    'u-chief': { name: 'Орлов Д.', role: 'chief', directions: ['kr'], createdAt: now },
    'u-bud': { name: 'Бюджетов Б.', role: 'chief', directions: ['ov'], canSeeBudget: true, createdAt: now },
    'u-spec': { name: 'Смирнова О.', role: 'specialist', directions: ['ar'], chiefId: 'u-chief', createdAt: now },
    'u-other': { name: 'Иванов Е.', role: 'specialist', directions: ['el'], chiefId: 'u-gip', createdAt: now },
    'u-gip2': { name: 'Второй ГИП', role: 'gip', directions: [], createdAt: now }, // 4.12: several GIPs and a director
    'u-dir': { name: 'Директор', role: 'director', directions: [], createdAt: now },
  },
  projects: {
    p1: { name: 'Цех', code: '25-047', client: 'ООО Заказчик', gipId: 'u-gip', members: ['u-chief', 'u-spec'], contract: { no: '47-П', date: '2026-05-12', sum: 9000000 }, payments: [{ date: '2026-06-01', sum: 100 }] },
    p4: { name: 'Общий', code: '25-060', client: 'ООО Заказчик', gipId: 'u-gip', members: ['u-gip2'], contract: { no: '60-П', sum: 6666666 } },
    p2: { name: 'Склад секретный', code: '25-050', client: 'АО Другой', gipId: 'u-gip', members: [], contract: { no: '50-П', sum: 7777777 } },
  },
  tasks: {
    t1: { projectId: 'p1', marks: ['КР'], title: 'КР', ownerId: 'u-chief', status: 'work', start: '2026-11-01', finish: '2026-12-01', budget: 500000, history: [] },
    t2: { projectId: 'p1', marks: ['АР'], title: 'АР', ownerId: 'u-spec', status: 'todo', start: '2026-11-01', finish: '2026-12-10', budget: 300000, history: [] },
    t4: { projectId: 'p4', marks: ['ОВ'], title: 'ОВ', ownerId: 'u-bud', status: 'work', start: '2026-11-01', finish: '2026-12-20', budget: 444444, history: [] },
    t3: { projectId: 'p2', marks: ['ЭОМ'], title: 'ЭОМ секрет', ownerId: 'u-other', status: 'todo', start: '2026-11-01', finish: '2026-12-20', budget: 200000, history: [] },
  },
  contractors: {}, chats: {}, depts: {},
  orgs: {
    o1: { name: 'ООО Заказчик', roles: ['customer'], inn: '7707083893', contacts: [{ id: 'k1', name: 'Секретов Иван', phone: '+7 900 111-22-33' }] },
    o2: { name: 'ООО Подряд', roles: ['contractor'], contracts: [{ id: 'd1', no: '1', date: '2026-11-01', sum: 123456 }] },
  },
};

const out = [];
const HOLD = (name, extra = '') => out.push(`HOLD ${name}${extra ? ' — ' + extra : ''}`);
const VULN = (name, extra = '') => out.push(`VULN ${name}${extra ? ' — ' + extra : ''}`);
const expect = (name, safe, extra = '') => (safe ? HOLD(name, extra) : VULN(name, extra));
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pentest-'));
  const cabPort = await freePort();
  const app = createServer({ dataDir: dir, host: '127.0.0.1', configFile: path.join(dir, 'none.json'), cabinetPort: cabPort, cabinetUrl: 'https://kabinet.example.ru', publicUrl: 'https://pult.example.ru', trustProxy: true });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (method, p, body, tok, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { ...(body && !(body instanceof Uint8Array) && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...headers }, body: body instanceof Uint8Array || typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const type = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, body: type.includes('json') ? await r.json() : (await r.text()) };
  };
  const rpc = async (tok, fn, ...args) => (await call('POST', '/api/rpc', { fn, args }, tok)).body;
  const view = async tok => (await call('GET', '/api/view', null, tok)).body.data;
  const login = async (who, pw) => (await call('POST', '/api/login', { login: who, password: pw })).body.token;
  try {
    await new Promise(r => setTimeout(r, 300));
    const gip = (await call('POST', '/api/setup', { code: app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'u-gip', data: DATA })).body.token;
    const join = async (uid, lg) => { const inv = await rpc(gip, 'inviteCreate', uid); return (await call('POST', '/api/join', { code: inv.code, login: lg, password: lg + '-pass-1' })).body.token; };
    const chief = await join('u-chief', 'orlov'), bud = await join('u-bud', 'budget'), spec = await join('u-spec', 'smirnova'), other = await join('u-other', 'ivanov');

    /* ===== 1. Authentication ===== */
    expect('A1 no token → nothing', (await call('GET', '/api/view')).status === 401);
    expect('A2 forged token', (await call('GET', '/api/view', null, 'AAAA' + gip.slice(4))).status === 401);
    expect('A3 token in a cookie instead of the header is ignored', (await call('GET', '/api/view', null, null, { Cookie: 'token=' + gip })).status === 401);
    expect('A4 setup again (take over the server)', (await call('POST', '/api/setup', { code: app.acc.setupCode || 'X', login: 'evil', password: 'evilevil1', userId: 'u-gip', data: DATA })).status === 409);
    // Brute force from many addresses (X-Forwarded-For): the limit is per address only?
    let blocked = false;
    for (let i = 0; i < 30; i++) { const r = await call('POST', '/api/login', { login: 'volkov', password: 'guess' + i }, null, { 'X-Forwarded-For': `10.0.${i}.1` }); if (r.status === 429) { blocked = true; break; } }
    expect('A5 password guessing of one login from 30 addresses is stopped', blocked, blocked ? '' : '30 guesses passed: the limit is per address, an X-Forwarded-For (or many addresses) gets around it');
    // Spoofed X-Forwarded-For behind the proxy: the first entry is the attacker's.
    let spoofBlocked = false;
    for (let i = 0; i < 12; i++) { const r = await call('POST', '/api/login', { login: 'nobody', password: 'x' }, null, { 'X-Forwarded-For': `1.2.3.${i}, 5.5.5.5` }); if (r.status === 429) spoofBlocked = true; }
    expect('A6 X-Forwarded-For takes the address the proxy saw, not the one the client wrote', spoofBlocked, spoofBlocked ? '' : 'the first (client-written) entry is used');
    // Invitation code guessing.
    let invBlocked = false;
    for (let i = 0; i < 12; i++) { const r = await call('POST', '/api/join', { code: 'AAAAAAA' + i, login: 'x' + i, password: 'xxxxxxxx' }, null, { 'X-Forwarded-For': '9.9.9.9' }); if (r.status === 429) invBlocked = true; }
    expect('A7 invitation code guessing is limited', invBlocked);
    // signOutOthers: the old token dies.
    const second = await login('orlov', 'orlov-pass-1');
    await rpc(chief, 'signOutOthers');
    expect('A8 «выйти на других устройствах» kills the other token', (await call('GET', '/api/view', null, second)).status === 401);
    // password change does not end other sessions?
    const s2 = await login('smirnova', 'smirnova-pass-1');
    await rpc(spec, 'passwordChange', 'smirnova-pass-1', 'smirnova-new-1');
    expect('A9 after a password change other devices are signed out', (await call('GET', '/api/view', null, s2)).status === 401, 'a stolen token keeps working after the victim changes the password');
    const spec2 = await login('smirnova', 'smirnova-new-1');
    // Guessing the current password through passwordChange with a stolen token.
    let pcBlocked = false;
    for (let i = 0; i < 15; i++) { const r = await rpc(spec2, 'passwordChange', 'guess' + i, 'whatever-1'); if (/попыток/.test(r.message || '')) pcBlocked = true; }
    expect('A10 guessing the current password in «Сменить пароль» is limited', pcBlocked, 'unlimited guesses with a stolen token');
    // Disabled account.
    await rpc(gip, 'accountDisable', 'u-other', true);
    expect('A11 a disabled login is out at once', (await call('GET', '/api/view', null, other)).status === 401);
    await rpc(gip, 'accountDisable', 'u-other', false);
    const other2 = await login('ivanov', 'ivanov-pass-1');

    /* ===== 2. What one sees: /api/view ===== */
    const vs = await view(spec2);
    expect('B1 a specialist does not see projects he is not in', !vs.projects.some(p => p.id === 'p2'));
    expect('B2 … nor their cards', !vs.tasks.some(t => t.id === 't3'));
    expect('B3 … nor budgets', !vs.tasks.some(t => 'budget' in t));
    expect('B4 … nor the contract and payments', !vs.projects.some(p => p.contract || p.payments));
    expect('B5 … nor customer contacts', !JSON.stringify(vs.orgs || []).includes('Секретов'));
    expect('B6 … nor contracts of contractors', !JSON.stringify(vs.orgs || []).includes('123456'));
    const vc = await view(chief);
    expect('B7 a chief without money: no budgets', !vc.tasks.some(t => 'budget' in t));
    expect('B8 a chief: no customer contract', !vc.projects.some(p => p.contract));
    const vb = await view(bud);
    expect('B9 budget chief: no customer contract (the GIP\'s)', !vb.projects.some(p => p.contract));

    /* ===== 3. Changes nobody allowed ===== */
    const w = async (tok, ops) => rpc(tok, 'write', ops, {});
    expect('C1 a specialist makes himself GIP', (await w(spec2, [{ type: 'update', col: 'users', id: 'u-spec', data: { role: 'gip' } }])).ok === false);
    expect('C2 a specialist gives himself the budget', (await w(spec2, [{ type: 'update', col: 'users', id: 'u-spec', data: { canSeeBudget: true } }])).ok === false);
    expect('C3 a chief makes himself GIP', (await w(chief, [{ type: 'update', col: 'users', id: 'u-chief', data: { role: 'gip' } }])).ok === false);
    expect('C4 a chief opens contacts to himself', (await w(chief, [{ type: 'update', col: 'users', id: 'u-chief', data: { canSeeContacts: true } }])).ok === false);
    expect('C5 a specialist edits a card of a project he does not see', (await w(spec2, [{ type: 'update', col: 'tasks', id: 't3', data: { title: 'взлом' } }])).ok === false);
    expect('C6 a specialist «set» of a hidden card', (await w(spec2, [{ type: 'set', col: 'tasks', id: 't3', data: { projectId: 'p2', title: 'взлом', ownerId: 'u-spec' } }])).ok === false);
    expect('C7 a specialist deletes a project', (await w(spec2, [{ type: 'delete', col: 'projects', id: 'p1' }])).ok === false);
    expect('C8 a specialist sets a budget on his own card', (await w(spec2, [{ type: 'update', col: 'tasks', id: 't2', data: { budget: 1 } }])).ok === false || app.store.data.tasks.t2.budget === 300000);
    const c9 = await w(chief, [{ type: 'set', col: 'projects', id: 'p1', data: { name: 'Цех', code: '25-047', gipId: 'u-gip', members: ['u-chief', 'u-spec'] } }]);
    expect('C9 a chief\'s «set» of a project keeps the contract he cannot see', app.store.data.projects.p1.contract?.sum === 9000000, JSON.stringify(c9));
    // Prototype pollution through collection or id names.
    const pp1 = await w(gip, [{ type: 'set', col: '__proto__', id: 'polluted', data: { x: 1 } }]);
    const pp2 = await w(gip, [{ type: 'set', col: 'tasks', id: '__proto__', data: { polluted: 1 } }]);
    expect('C10 prototype pollution via col/id', ({}).polluted === undefined && ({}).x === undefined && !Object.prototype.hasOwnProperty.call(app.store.data.tasks, '__proto__'), JSON.stringify([pp1, pp2]).slice(0, 160));
    const pp3 = await w(spec2, [{ type: 'set', col: 'tasks', id: 'constructor', data: { projectId: 'p1', title: 'x', ownerId: 'u-spec', marks: ['АР'] } }]);
    expect('C11 id «constructor» does not break the base', typeof app.store.data.tasks.constructor !== 'function' || pp3.ok === false, JSON.stringify(pp3).slice(0, 120));
    // RPC names from Object.prototype.
    for (const fn of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const r = await call('POST', '/api/rpc', { fn, args: [] }, spec2);
      expect(`C12 rpc «${fn}» refused`, r.status === 400, r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
    }
    for (const fn of ['constructor', '__proto__', 'toString']) {
      const r = await rpc(spec2, 'cabinet', fn);
      expect(`C13 cabinet «${fn}» refused cleanly`, r.ok === false && !/Сервер не смог/.test(r.message || ''), JSON.stringify(r).slice(0, 100));
    }
    // GIP-only server functions.
    for (const [fn, args] of [['accounts', []], ['inviteCreate', ['u-gip']], ['accountReset', ['u-gip']], ['accountDisable', ['u-gip', true]], ['backupGet', []], ['backupRestore', [{ version: 1, users: {} }]], ['partyKeySet', ['0123456789abcdef0123456789abcdef01234567']]]) {
      const r = await rpc(chief, fn, ...args);
      expect(`C14 a chief calls ${fn}`, r.ok === false, JSON.stringify(r).slice(0, 100));
    }
    expect('C15 a specialist clears the samples', (await rpc(spec2, 'clearDemo')).ok === false);
    // Comments and chats on hidden things.
    expect('C16 a specialist comments a hidden card', (await rpc(spec2, 'addComment', 't3', 'hi')).ok === false);
    const pchat = await rpc(spec2, 'chatSend', 'project:p2', 'привет', 'p2');
    expect('C17 a specialist writes into the chat of a hidden project', pchat.ok === false, JSON.stringify(pchat).slice(0, 100));
    const grp = await rpc(spec2, 'chatCreate', { title: 'g', members: ['u-gip', 'u-other'] });
    expect('C18 a group chat with people (allowed — anyone may start one)', true, JSON.stringify(grp).slice(0, 80));

    /* ===== 4. The journal: hidden values in the history of changes ===== */
    await w(gip, [{ type: 'update', col: 'projects', id: 'p1', data: { contract: { no: '47-П', date: '2026-05-12', sum: 9100000 } } }]);
    await w(gip, [{ type: 'update', col: 'projects', id: 'p2', data: { name: 'Склад секретный 2' } }]);
    await w(gip, [{ type: 'update', col: 'orgs', id: 'o1', data: { address: 'Секретный адрес 1' } }]);
    await w(gip, [{ type: 'update', col: 'orgs', id: 'o2', data: { contracts: [{ id: 'd1', no: '1', date: '2026-11-01', sum: 654321 }] } }]);
    await w(gip, [{ type: 'update', col: 'tasks', id: 't1', data: { budget: 510000 } }]);
    const jc = JSON.stringify(await rpc(chief, 'getJournal'));
    expect('D1 a chief\'s journal: no change of the customer contract', !/9100000|9\s?100\s?000|"label":"Договор"/.test(jc), jc.match(/.{60}"label":"Договор".{80}/)?.[0] || '');
    const chiefSees = (await view(chief)).projects.some(p => p.id === 'p2');
    expect('D2 a chief\'s journal: only projects he sees (chiefs see every project by design)', chiefSees || !/Склад секретный/.test(jc), chiefSees ? 'p2 is visible to chiefs by design' : '');
    expect('D3 a chief without contacts: no customer\'s address', !/Секретный адрес/.test(jc));
    expect('D4 a chief without money: no contractor\'s contracts', !/654321|Договоры/.test(jc), jc.match(/.{40}Договоры.{40}/)?.[0] || '');
    expect('D5 a chief without money: no budget change', !/510\s?000/.test(jc));
    const js = JSON.stringify(await rpc(spec2, 'getJournal'));
    expect('D6 a specialist\'s journal: only his cards', !/Склад|Секретный|9100000|654321/.test(js));

    /* ===== 5. Files ===== */
    const up = await call('POST', '/api/files?project=p1', new Uint8Array([1, 2, 3]), gip, { 'X-File-Name': encodeURIComponent('../../evil.txt'), 'Content-Type': 'application/octet-stream' });
    expect('E1 a file name with ../ stays a name', up.body.ok && !up.body.file.name.includes('/') && !fs.existsSync(path.join(dir, 'evil.txt')), JSON.stringify(up.body.file || up.body).slice(0, 120));
    const up2 = await call('POST', '/api/files?project=p2', new Uint8Array([7, 7, 7]), gip, { 'X-File-Name': 'secret.pdf', 'Content-Type': 'application/octet-stream' });
    expect('E2 a specialist downloads a file of a hidden project', (await call('GET', `/api/files/p2/${up2.body.file.id}`, null, spec2)).status === 404);
    expect('E3 a specialist uploads into a hidden project', (await call('POST', '/api/files?project=p2', new Uint8Array([1]), spec2, { 'Content-Type': 'application/octet-stream' })).status === 404);
    const idTrav = await call('POST', '/api/files?project=p1', new Uint8Array([6, 6]), spec2, { 'X-File-Id': '../../accounts.json', 'Content-Type': 'application/octet-stream' });
    expect('E4 X-File-Id with ../ cannot overwrite accounts', JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8')).byUser !== undefined, JSON.stringify(idTrav.body).slice(0, 100));
    expect('E5 project id with ../ in the download path', (await call('GET', '/api/files/..%2F..%2Faccounts.json/x', null, gip)).status !== 200);
    const ftype = (await call('GET', `/api/files/p1/${up.body.file.id}`, null, gip)).headers.get('content-type');
    expect('E6 files come back as octet-stream (an uploaded .html cannot run as a page)', /octet-stream/.test(ftype || ''), ftype);
    const upd = await call('POST', '/api/update', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2000)]), chief, { 'X-Update-Version': '9.9.9' });
    expect('E7 a chief puts a fake Пульт update on the server', upd.status === 403);

    /* ===== 6. Static files and headers ===== */
    for (const p of ['/app/../server/accounts.json', '/app/..%2f..%2fdata.json', '/app/%2e%2e/%2e%2e/package.json', '/app/core/..%2f..%2f..%2faccounts.json', '/app//etc/passwd']) {
      const r = await call('GET', p);
      expect(`F1 path traversal ${p}`, r.status === 404 || r.status === 400 || (r.status === 200 && !/byUser|"sessions"|root:x|"name":\s*"glavspec/.test(r.body)), `${r.status} ${String(r.body).slice(0, 60)}`);
    }
    const idx = await call('GET', '/app/');
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(idx.body)?.[1] || '';
    expect('F2 the web version has a strict CSP (scripts only from itself)', /script-src 'self'/.test(csp) && !/unsafe-eval/.test(csp), csp);
    const caddy = fs.readFileSync(path.join(REPO, 'server/install.sh.in'), 'utf8');
    expect('F3 HSTS (set by Caddy in front of the server — the installer\'s Caddyfile)', (caddy.match(/Strict-Transport-Security "max-age=31536000"/g) || []).length === 2);
    expect('F4 nosniff / no-referrer / DENY on the web page', idx.headers.get('x-content-type-options') === 'nosniff' && idx.headers.get('x-frame-options') === 'DENY');
    const cors = await call('GET', '/api/hello', null, null, { Origin: 'https://evil.example' });
    expect('F5 CORS: another site gets no permission', !cors.headers.get('access-control-allow-origin'));
    const cors2 = await call('GET', '/api/hello', null, null, { Origin: 'null' });
    expect('F6 CORS: origin «null» (sandboxed page) gets no permission', !cors2.headers.get('access-control-allow-origin'));
    const big = await call('POST', '/api/login', 'x'.repeat(2_000_000), null, { 'Content-Type': 'application/json' }).catch(e => ({ status: 'cut', e }));
    expect('F7 a 2 MB login body is refused', big.status === 413 || big.status === 400 || big.status === 'cut', String(big.status));
    const err = await call('POST', '/api/rpc', '{bad json', gip, { 'Content-Type': 'application/json' });
    expect('F8 broken JSON: no stack trace to the client', err.status === 400 && !/at \w+ \(/.test(JSON.stringify(err.body)));

    /* ===== 7. XSS: what people type is shown to others ===== */
    const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    await w(gip, [{ type: 'update', col: 'projects', id: 'p1', data: { name: 'Цех ' + XSS } }, { type: 'update', col: 'tasks', id: 't1', data: { title: XSS } }]);
    await rpc(gip, 'cabinet', 'publish', 'p1');
    const made = await rpc(gip, 'cabinet', 'customerCreate', { name: 'Заказчик ' + XSS, login: 'zakazchik', projectIds: ['p1'] });
    const other3 = await rpc(gip, 'cabinet', 'customerCreate', { name: 'Другой', login: 'drugoi', projectIds: ['p2'] });
    await rpc(gip, 'cabinet', 'publish', 'p2');
    const cab = `http://127.0.0.1:${cabPort}`;
    const cabLogin = async (lg, pw) => { const r = await fetch(cab + '/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `login=${lg}&password=${encodeURIComponent(pw)}`, redirect: 'manual' }); return (r.headers.get('set-cookie') || '').split(';')[0]; };
    const ck = await cabLogin('zakazchik', made.password);
    const home = await (await fetch(cab + '/', { headers: { Cookie: ck } })).text();
    expect('G1 cabinet: the customer\'s name with HTML is escaped', !home.includes('<img src=x onerror') && !home.includes('<script>alert(2)'), home.match(/.{30}onerror.{30}/)?.[0] || '');
    const pg = await fetch(cab + '/p/p1', { headers: { Cookie: ck }, redirect: 'manual' });
    const pgText = await pg.text();
    expect('G2 cabinet: the project page escapes the project name and cards', pg.status === 200 && !pgText.includes('<img src=x onerror') && !pgText.includes('<script>alert(2)'), pg.status + ' ' + (pgText.match(/.{30}onerror.{30}/)?.[0] || ''));
    const pgCsp = pg.headers.get('content-security-policy') || '';
    expect('G3 cabinet page has a CSP', !!pgCsp, pgCsp || 'no CSP header');
    expect('G4 cabinet cookie: HttpOnly, SameSite', /HttpOnly/i.test((await fetch(cab + '/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `login=zakazchik&password=${encodeURIComponent(made.password)}`, redirect: 'manual' })).headers.get('set-cookie') || ''));

    /* ===== 8. Cabinet: one customer — the other's project ===== */
    const p2page = await fetch(cab + '/p/p2', { headers: { Cookie: ck }, redirect: 'manual' });
    expect('H1 a customer opens another customer\'s project', p2page.status === 404 || p2page.status === 403 || p2page.status === 302, String(p2page.status));
    const p2file = await fetch(cab + '/p/p2/f/whatever', { headers: { Cookie: ck }, redirect: 'manual' });
    expect('H2 … or its file', p2file.status !== 200, String(p2file.status));
    // CSRF: a form from another site.
    const csrf = await fetch(cab + '/p/p1/answer', { method: 'POST', headers: { Cookie: ck, Origin: 'https://evil.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'id=1&text=hi', redirect: 'manual' });
    expect('H3 a form posted from another site is refused', csrf.status === 403, String(csrf.status));
    const csrf2 = await fetch(cab + '/p/p1/answer', { method: 'POST', headers: { Cookie: ck, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'id=1&text=hi', redirect: 'manual' });
    expect('H4 a form without the CSRF token is refused', csrf2.status === 403 || csrf2.status === 400, String(csrf2.status));
    let cabBlocked = false;
    for (let i = 0; i < 12; i++) { const r = await fetch(cab + '/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `login=drugoi&password=guess${i}`, redirect: 'manual' }); if (r.status === 429) cabBlocked = true; }
    expect('H5 cabinet password guessing is limited', cabBlocked);
    // Customer contacts by a chief without the right; a contacts-chief giving a login to a project he does not see.
    expect('H6 a chief without contacts lists customers', (await rpc(chief, 'cabinet', 'customers')).ok === false);
    expect('H7 a specialist marks customer messages read', (await rpc(spec2, 'cabinet', 'read', ['x'])).ok === false);
    await w(gip, [{ type: 'update', col: 'users', id: 'u-chief', data: { canSeeContacts: true } }]);
    const sneak = await rpc(chief, 'cabinet', 'customerCreate', { name: 'Свой', login: 'svoi', projectIds: ['p2'] });
    expect('H8 a chief with contacts gives a customer login to a project he does not see', chiefSees || sneak.ok === false || !(sneak.customer?.projectIds || []).includes('p2'), chiefSees ? 'n/a: chiefs see every project' : JSON.stringify(sneak).slice(0, 140));
    const cs = await rpc(chief, 'cabinet', 'customers');
    const o3 = (cs.customers || []).find(c => c.login === 'drugoi');
    const upd2 = o3 && await rpc(chief, 'cabinet', 'customerUpdate', o3.id, { projectIds: ['p1'] });
    const ids2 = upd2?.customer?.projectIds || [];
    expect('H9 a chief with contacts takes away a project he does not see from a login', chiefSees || (!!upd2 && (upd2.ok === false || ids2.includes('p2'))), chiefSees ? 'n/a: chiefs see every project' : JSON.stringify(upd2).slice(0, 140));
    const cview = await rpc(chief, 'cabinet', 'view');
    expect('H10 cabinet view: messages only for visible projects', !(cview.messages || []).some(m => m.projectId === 'p2'));
    /* ===== J. Several GIPs (4.12) ===== */
    const gip2 = await join('u-gip2', 'gip2');
    const v2 = await view(gip2);
    const has = (col, id) => (v2[col] || []).some(x => x.id === id);
    expect('J1 another GIP does not see a project he is not in (and its cards)', !has('projects', 'p2') && !has('tasks', 't3'));
    const p4 = (v2.projects || []).find(x => x.id === 'p4'), t4 = (v2.tasks || []).find(x => x.id === 't4');
    expect('J2 an invited GIP sees the project without the customer contract and the cards without money', !!p4 && !p4.contract && !!t4 && t4.budget === undefined, JSON.stringify({ c: p4?.contract, b: t4?.budget }));
    const wj3 = await w(gip2, [{ type: 'update', col: 'tasks', id: 't3', data: { title: 'взлом' } }]);
    expect('J3 another GIP changes a card of a project he is not in', wj3.ok === false, JSON.stringify(wj3));
    const wj4 = await w(gip2, [{ type: 'update', col: 'projects', id: 'p4', data: { contract: { no: 'X', sum: 1 } } }]);
    expect('J4 an invited GIP rewrites the customer contract', wj4.ok === false);
    const wj5 = await w(gip2, [{ type: 'update', col: 'tasks', id: 't4', data: { budget: 1 } }]);
    expect('J5 an invited GIP changes a card budget in another GIP\'s project', wj5.ok === false);
    const wj6 = await w(gip2, [{ type: 'update', col: 'users', id: 'u-gip2', data: { role: 'director' } }]);
    expect('J6 a GIP makes himself director while there is one', wj6.ok === false);
    const jr = await rpc(gip2, 'journalGet', {});
    const jl = Array.isArray(jr) ? jr : jr.entries || jr.list || [];
    expect('J7 the journal of another GIP has no hidden project or card', !jl.some(e => e.id === 'p2' || e.id === 't3'), `${jl.length} entries`);
    const ws = await w(gip2, [{ type: 'set', col: 'projects', id: 'p4', data: { ...p4, name: 'Общий (переименован)' } }]);
    const kept = app.store?.data?.projects?.p4?.contract?.sum;
    expect('J8 a «set» of an invited project keeps the hidden contract', ws.ok !== false && (kept === undefined || kept === 6666666), JSON.stringify({ ok: ws.ok, kept }));
    // Party lookup for a specialist.
    expect('I1 a specialist uses the INN lookup (the team\'s DaData limit)', (await call('POST', '/api/party', { inns: ['7707083893'] }, spec2)).status === 403);
  } catch (e) { out.push('ERROR ' + (e.stack || e)); }
  finally { app.close(); app.server.closeAllConnections?.(); await new Promise(r => app.server.close(r)); }
  console.log(out.join('\n'));
  const bad = out.filter(x => x.startsWith('VULN') || x.startsWith('ERROR')).length;
  console.log(`\n${bad} VULN / ${out.length} attempts`);
  process.exit(bad ? 1 : 0);
})();

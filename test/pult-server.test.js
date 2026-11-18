'use strict';
// «Сервер Пульта» over real HTTP: moving the base, invitations, logins, what each role gets, conflicts,
// live updates, files, turning a login off, too many wrong passwords.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/pult-server.js');

const now = new Date().toISOString();
const DATA = {
  version: 1,
  users: {
    'u-gip': { name: 'Волков С.В.', role: 'gip', directions: [], createdAt: now },
    'u-chief': { name: 'Орлов Д.', role: 'chief', directions: ['kr'], createdAt: now },
    'u-spec': { name: 'Смирнова О.', role: 'specialist', directions: ['ar'], chiefId: 'u-chief', createdAt: now },
    'u-other': { name: 'Иванов Е.', role: 'specialist', directions: ['el'], chiefId: 'u-gip', createdAt: now },
  },
  projects: {
    p1: { name: 'Цех', code: '25-047', client: 'ООО Заказчик', gipId: 'u-gip', members: ['u-chief', 'u-spec'], contract: { no: '47-П', date: '2026-05-12', sum: 9000000 }, payments: [{ date: '2026-06-01', sum: 100 }] },
    p2: { name: 'Склад', code: '25-050', gipId: 'u-gip', members: [] },
  },
  tasks: {
    t1: { projectId: 'p1', marks: ['КР'], title: 'КР', ownerId: 'u-chief', status: 'work', start: '2026-11-01', finish: '2026-12-01', budget: 500000, history: [] },
    t2: { projectId: 'p1', marks: ['АР'], title: 'АР', ownerId: 'u-spec', status: 'todo', start: '2026-11-01', finish: '2026-12-10', budget: 300000, history: [] },
    t3: { projectId: 'p2', marks: ['ЭОМ'], title: 'ЭОМ', ownerId: 'u-other', status: 'todo', start: '2026-11-01', finish: '2026-12-20', budget: 200000, history: [] },
  },
  contractors: {}, chats: {}, depts: {},
};

function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pult-server-'));
  const app = createServer({ dataDir: dir, port: 0, host: '127.0.0.1', configFile: path.join(dir, 'none.json'), publicUrl: 'https://pult.example.ru' });
  return new Promise(resolve => app.server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const call = async (method, p, body, tok, headers = {}) => {
      const r = await fetch(base + p, { method, headers: { ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...headers }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
      const type = r.headers.get('content-type') || '';
      return { status: r.status, headers: r.headers, body: type.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };
    const rpc = async (tok, fn, ...args) => (await call('POST', '/api/rpc', { fn, args }, tok)).body;
    resolve({ app, base, call, rpc, dir, stop: () => new Promise(r => { app.close(); app.server.closeAllConnections?.(); app.server.close(() => r()); }) });
  }));
}

test('pult server: setup, invitations, rights, conflicts, live updates, files', async () => {
  const s = await start();
  try {
    const hello = await s.call('GET', '/api/hello');
    assert.equal(hello.body.setup, true);

    // Moving the base: the code from the installation, the GIP chooses login and password.
    const bad = await s.call('POST', '/api/setup', { code: 'WRONG', login: 'volkov', password: 'secret123', userId: 'u-gip', data: DATA });
    assert.equal(bad.status, 403);
    const notGip = await s.call('POST', '/api/setup', { code: s.app.acc.setupCode, login: 'orlov', password: 'secret123', userId: 'u-chief', data: DATA });
    assert.equal(notGip.status, 400, 'only the GIP moves the base');
    const setup = await s.call('POST', '/api/setup', { code: s.app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'u-gip', data: DATA, device: 'ПК ГИПа' });
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    const gip = setup.body.token;
    assert.equal((await s.call('POST', '/api/setup', { code: 'X', login: 'a', password: 'b', userId: 'u-gip', data: DATA })).status, 409);
    assert.equal((await s.call('GET', '/api/hello')).body.setup, false);

    // Without a token — nothing.
    assert.equal((await s.call('GET', '/api/view')).status, 401);

    const gv = (await s.call('GET', '/api/view', null, gip)).body;
    assert.equal(gv.data.tasks.length, 3);
    assert.equal(gv.data.projects.find(p => p.id === 'p1').contract.no, '47-П', 'the GIP sees the contract');

    // Invitations → logins.
    const inv = await s.rpc(gip, 'inviteCreate', 'u-chief');
    assert.ok(inv.ok && /^[A-Z2-9]{8}$/.test(inv.code) && inv.link.endsWith('/join/' + inv.code));
    const join = await s.call('POST', '/api/join', { code: inv.code, login: 'orlov', password: 'short' });
    assert.equal(join.status, 400, 'password too short');
    const joined = await s.call('POST', '/api/join', { code: inv.code, login: 'orlov', password: 'orlov-pass-1', device: 'ПК главспеца' });
    assert.equal(joined.status, 200);
    assert.equal((await s.call('POST', '/api/join', { code: inv.code, login: 'orlov2', password: 'orlov-pass-1' })).status, 403, 'an invitation works once');
    const chief = (await s.call('POST', '/api/login', { login: 'ORLOV', password: 'orlov-pass-1' })).body.token;
    assert.ok(chief);
    const invS = await s.rpc(gip, 'inviteCreate', 'u-spec');
    const spec = (await s.call('POST', '/api/join', { code: invS.code, login: 'smirnova', password: 'smirnova-1' })).body.token;
    const invO = await s.rpc(gip, 'inviteCreate', 'u-other');
    const taken = await s.call('POST', '/api/join', { code: invO.code, login: 'orlov', password: 'ivanov-pass' });
    assert.equal(taken.status, 400, 'a login is unique');

    // What a chief gets: no money unless the GIP gives it, no contract, payments, bills.
    const cv = (await s.call('GET', '/api/view', null, chief)).body.data;
    const ct1 = cv.tasks.find(t => t.id === 't1');
    assert.ok(ct1 && ct1.budget === undefined && ct1.moneyHidden, 'the chief does not get the budget');
    const cp1 = cv.projects.find(p => p.id === 'p1');
    assert.ok(cp1 && cp1.contract === undefined && cp1.payments === undefined, 'nor the contract and payments');
    assert.ok(!cv.tasks.some(t => t.id === 't3'), 'not the cards of someone else\'s people');
    // The GIP gives the chief the money: then the budget comes.
    assert.ok((await s.rpc(gip, 'write', [{ type: 'update', col: 'users', id: 'u-chief', data: { canSeeBudget: true } }], { action: 'Права' })).ok);
    const cv2 = (await s.call('GET', '/api/view', null, chief)).body.data;
    assert.equal(cv2.tasks.find(t => t.id === 't1').budget, 500000);
    assert.equal(cv2.projects.find(p => p.id === 'p1').contract.no, '47-П', 'with the money — the contract too');

    // The specialist: own cards, own project; may not edit someone else's card.
    const sv = (await s.call('GET', '/api/view', null, spec)).body.data;
    assert.deepEqual(sv.tasks.map(t => t.id), ['t2']);
    assert.deepEqual(sv.projects.map(p => p.id), ['p1']);
    const refused = await s.rpc(spec, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { status: 'done' } }], {});
    assert.equal(refused.ok, false);
    // A «set» of the whole card by someone without money keeps the hidden budget.
    const t2 = sv.tasks[0];
    const { moneyHidden, id: _id, ...t2data } = t2; void moneyHidden; void _id;
    assert.ok((await s.rpc(spec, 'write', [{ type: 'set', col: 'tasks', id: 't2', data: { ...t2data, status: 'work' } }], {})).ok);
    assert.equal(s.app.store.data.tasks.t2.budget, 300000, 'the hidden budget survived');

    // Live updates: a waiting client is answered when someone changes something.
    const rev0 = (await s.call('GET', '/api/view', null, gip)).body.rev;
    const waiting = s.call('GET', `/api/wait?rev=${rev0}`, null, gip);
    await new Promise(r => setTimeout(r, 100));
    await s.rpc(chief, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { finish: '2026-12-05' } }], {}, { 'tasks/t1': { finish: '2026-12-01' } });
    const woke = await waiting;
    assert.ok(woke.body.rev > rev0, 'woken by the change');

    // Conflict: the GIP saw the old date and changes it — the chief changed it meanwhile.
    const conflict = await s.rpc(gip, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { finish: '2026-12-15' } }], {}, { 'tasks/t1': { finish: '2026-12-01' } });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.conflict[0].field, 'finish');
    assert.equal(conflict.conflict[0].theirs, '2026-12-05');
    // Different fields — no conflict; «оставить моё» — force.
    assert.ok((await s.rpc(gip, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { title: 'КР цех' } }], {}, { 'tasks/t1': { title: 'КР' } })).ok);
    assert.ok((await s.rpc(gip, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { finish: '2026-12-15' } }], { force: true }, { 'tasks/t1': { finish: '2026-12-01' } })).ok);
    assert.equal(s.app.store.data.tasks.t1.finish, '2026-12-15');
    // History: what others added stays.
    s.app.store.data.tasks.t1.history = [{ type: 'status', to: 'work', ts: now }];
    const mine = [{ type: 'status', to: 'review', ts: now }];
    assert.ok((await s.rpc(gip, 'write', [{ type: 'update', col: 'tasks', id: 't1', data: { history: mine } }], {}, { 'tasks/t1': { history: [] } })).ok);
    assert.equal(s.app.store.data.tasks.t1.history.length, 2);

    // Messenger and comments through the same rules.
    const chat = await s.rpc(gip, 'chatCreate', { title: 'Цех: КР', members: ['u-chief'] });
    assert.ok(chat.ok, JSON.stringify(chat));
    assert.ok((await s.rpc(chief, 'chatSend', chat.id, 'Принял', '')).ok);
    assert.ok(!(await s.call('GET', '/api/view', null, spec)).body.data.chats.some(c => c.id === chat.id), 'not a member — not seen');
    assert.ok((await s.rpc(spec, 'addComment', 't2', 'Готово наполовину')).ok);
    const journal = await s.rpc(gip, 'getJournal', '');
    assert.ok(Array.isArray(journal.result) && journal.result.length > 3);

    // Files: the project must be visible; the id of a file moved from a Пульт stays.
    const up = await s.call('POST', '/api/files?project=p1', new Uint8Array([1, 2, 3, 4]), spec, { 'X-File-Name': encodeURIComponent('Обмер.pdf'), 'X-File-Type': 'application/pdf' });
    assert.equal(up.status, 200);
    assert.equal(up.body.file.name, 'Обмер.pdf');
    const down = await s.call('GET', `/api/files/p1/${up.body.file.id}`, null, chief);
    assert.deepEqual([...down.body], [1, 2, 3, 4]);
    assert.equal((await s.call('GET', `/api/files/p1/${up.body.file.id}`, null, null)).status, 401);
    assert.equal((await s.call('POST', '/api/files?project=p2', new Uint8Array([1]), spec, { 'X-File-Name': 'x' })).status, 404, 'not the specialist\'s project');
    const moved = await s.call('POST', '/api/files?project=p1', new Uint8Array([9]), gip, { 'X-File-Name': 'a.pdf', 'X-File-Id': 'fOLD123' });
    assert.equal(moved.body.file.id, 'fOLD123');

    // The GIP's copy of the base and the accounts list; others may not.
    assert.equal((await s.rpc(chief, 'backupGet')).ok, false);
    const copy = await s.rpc(gip, 'backupGet');
    assert.ok(copy.ok && copy.data.tasks.t1);
    const accs = await s.rpc(gip, 'accounts');
    assert.equal(accs.accounts.find(a => a.userId === 'u-chief').login, 'orlov');
    assert.ok(accs.accounts.find(a => a.userId === 'u-other').invite, 'a pending invitation is listed');

    // Turning a login off ends its sessions at once.
    assert.ok((await s.rpc(gip, 'accountDisable', 'u-spec', true)).ok);
    assert.equal((await s.call('GET', '/api/view', null, spec)).status, 401);
    const denied = await s.call('POST', '/api/login', { login: 'smirnova', password: 'smirnova-1' });
    assert.equal(denied.status, 401);
    assert.match(denied.body.message, /отключ/);

    // The desktop app's window may call the API (CORS), another site may not.
    const pre = await fetch(s.base + '/api/view', { method: 'OPTIONS', headers: { Origin: 'http://tauri.localhost' } });
    assert.equal(pre.headers.get('access-control-allow-origin'), 'http://tauri.localhost');
    const evil = await fetch(s.base + '/api/view', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);

    // Too many wrong passwords → wait.
    for (let i = 0; i < 10; i++) await s.call('POST', '/api/login', { login: 'volkov', password: 'nope' + i });
    assert.equal((await s.call('POST', '/api/login', { login: 'volkov', password: 'secret123' })).status, 429);

    // The base is on disk after a flush; the nightly copy is made.
    s.app.base.flush();
    assert.ok(JSON.parse(fs.readFileSync(path.join(s.dir, 'data.json'), 'utf8')).tasks.t1);
    assert.ok(!JSON.stringify(JSON.parse(fs.readFileSync(path.join(s.dir, 'accounts.json'), 'utf8'))).includes('secret123'), 'passwords are not stored as text');
  } finally { await s.stop(); }
});

test('pult server: the customer cabinet on the shared base', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pult-cab-'));
  const cabPort = 20000 + Math.floor(Math.random() * 20000);
  const app = createServer({ dataDir: dir, host: '127.0.0.1', configFile: path.join(dir, 'none.json'), cabinetPort: cabPort, cabinetUrl: 'https://kabinet.example.ru' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (p, body, tok) => (await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) })).json();
  const rpc = (tok, fn, ...args) => post('/api/rpc', { fn, args }, tok);
  try {
    await new Promise(r => setTimeout(r, 200));
    const gip = (await post('/api/setup', { code: app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'u-gip', data: DATA })).token;
    const inv = await rpc(gip, 'inviteCreate', 'u-chief');
    const chief = (await post('/api/join', { code: inv.code, login: 'orlov', password: 'orlov-pass-1' })).token;

    const v = await rpc(gip, 'cabinet', 'view');
    assert.ok(v.allowed && v.onServer && v.configured, JSON.stringify(v));
    assert.equal(v.publicUrl, 'https://kabinet.example.ru');
    const pub = await rpc(gip, 'cabinet', 'publish', 'p1');
    assert.ok(pub.ok, JSON.stringify(pub));
    // Customers and their contacts: the GIP; a chief only if the GIP opened contacts to them.
    const made = await rpc(gip, 'cabinet', 'customerCreate', { name: 'ООО Заказчик', login: 'zakazchik', projectIds: ['p1'] });
    assert.ok(made.ok && made.password, JSON.stringify(made));
    const no = await rpc(chief, 'cabinet', 'customers');
    assert.equal(no.ok, false);
    await rpc(gip, 'write', [{ type: 'update', col: 'users', id: 'u-chief', data: { canSeeContacts: true } }], {});
    const yes = await rpc(chief, 'cabinet', 'customers');
    assert.ok(yes.ok && yes.customers.length === 1, JSON.stringify(yes));
    // The customer logs into the inner cabinet and sees the project page.
    const page = await fetch(`http://127.0.0.1:${cabPort}/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `login=zakazchik&password=${encodeURIComponent(made.password)}`, redirect: 'manual' });
    assert.ok([302, 303].includes(page.status), 'customer login works: ' + page.status);
  } finally { app.close(); app.server.closeAllConnections?.(); await new Promise(r => app.server.close(r)); }
});

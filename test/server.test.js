'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/cabinet-server.js');
const { pageModel } = require('../src/report/customer.js');

const project = { id: 'p1', name: 'ЖК «Тест»', code: '01-26', client: 'ООО Заказчик', status: 'expertise',
  phases: [{ key: 'contract', start: '2026-01-01', finish: '2026-02-01', done: '2026-02-01' }, { key: 'expertise', start: '2026-09-18', finish: '2026-12-27', done: '' }],
  requests: [{ id: 'r1', title: 'ТУ 630 кВт', due: '2026-12-07' }], milestones: [], docs: [] };
const tasks = [{ id: 't1', projectId: 'p1', sections: ['СС'], status: 'in_progress', budget: 777000, contractorId: 'c', finish: '2026-11-20' }];
const model = pageModel({ project, tasks, contact: { name: 'ГИП', phone: '+7 900' }, today: '2026-11-05' });

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cab-'));
  const s = createServer({ dataDir: dir, port: 0, host: '127.0.0.1', configFile: path.join(dir, 'none.json') });
  await new Promise(r => s.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.server.address().port}`;
  const key = s.teamKey();
  const api = async (method, p, body) => {
    const r = await fetch(base + '/api/team' + p, { method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  // A tiny browser: keeps the cookie, never follows redirects.
  const jar = {};
  const web = async (method, p, form, headers = {}) => {
    const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(jar.c ? { Cookie: jar.c } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers }, body: form ? new URLSearchParams(form).toString() : undefined });
    const set = r.headers.get('set-cookie');
    if (set) jar.c = set.split(';')[0];
    return { status: r.status, location: r.headers.get('location'), text: await r.text(), headers: r.headers };
  };
  const stop = () => new Promise(r => { s.store.flush(); s.server.close(r); });
  return { s, base, api, web, jar, stop, dir };
}
const csrfOf = html => html.match(/name="csrf" value="([^"]+)"/)?.[1];

test('team API needs the key', async () => {
  const t = await start();
  try {
    const r = await fetch(t.base + '/api/team/ping');
    assert.equal(r.status, 401);
    const bad = await fetch(t.base + '/api/team/ping', { headers: { Authorization: 'Bearer nope' } });
    assert.equal(bad.status, 401);
    assert.equal((await t.api('GET', '/ping')).ok, true);
  } finally { await t.stop(); }
});

test('customer flow: publish, log in, see only own project, answer, call, urgent, inbox', async () => {
  const t = await start();
  try {
    assert.equal((await t.api('PUT', '/projects/p1', { model })).ok, true);
    assert.equal((await t.api('PUT', '/projects/p2', { model: { ...model, project: { ...model.project, id: 'p2', name: 'Чужой объект' } } })).ok, true);
    assert.equal((await t.api('PUT', '/projects/p3', { model })).status, 400, 'id in the path must match the model');
    const created = await t.api('POST', '/customers', { name: 'Иван Заказчиков', login: 'Ivan', projectIds: ['p1'] });
    assert.equal(created.ok, true);
    assert.match(created.password, /^[a-zA-Z2-9]{10}$/);
    assert.equal((await t.api('POST', '/customers', { name: 'X', login: 'ivan' })).status, 409, 'logins are case-insensitive and unique');

    assert.equal((await t.web('GET', '/')).location, '/login');
    assert.equal((await t.web('POST', '/login', { login: 'ivan', password: 'wrong' })).status, 401);
    const evil = await t.web('POST', '/login', { login: 'ivan', password: created.password }, { Origin: 'https://evil.example' });
    assert.equal(evil.status, 403, 'login form from another site is refused');
    const ok = await t.web('POST', '/login', { login: 'IVAN', password: created.password });
    assert.equal(ok.status, 303);
    assert.match(ok.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
    assert.equal((await t.web('GET', '/')).location, '/p/p1', 'a single project opens directly');

    const page = await t.web('GET', '/p/p1');
    assert.equal(page.status, 200);
    assert.match(page.text, /ЖК «Тест»/);
    assert.match(page.text, /ТУ 630 кВт/);
    assert.doesNotMatch(page.text, /777 ?000|₽/, 'no money on the customer side');
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await t.web('GET', '/p/p2')).status, 404, 'another customer\'s project is invisible');
    const csrf = csrfOf(page.text);
    assert.ok(csrf);

    assert.equal((await t.web('POST', '/c/answer', { csrf: 'forged', project: 'p1', request: 'r1', text: 'x' })).status, 403);
    assert.equal((await t.web('POST', '/c/answer', { csrf, project: 'p2', request: 'r1', text: 'x' })).status, 404);
    const ans = await t.web('POST', '/c/answer', { csrf, project: 'p1', request: 'r1', text: 'ТУ получены, ссылка: disk/1' });
    assert.equal(ans.location, '/p/p1?ok=answer#q');
    const after = await t.web('GET', ans.location);
    assert.match(after.text, /Ответ отправлен/);
    assert.match(after.text, /Ваш ответ отправлен: «ТУ получены/);
    await t.web('POST', '/c/call', { csrf, project: 'p1', text: '' });
    assert.equal((await t.web('POST', '/c/urgent', { csrf, project: 'p1', text: '' })).location, '/p/p1?ok=empty');
    await t.web('POST', '/c/urgent', { csrf, project: 'p1', text: 'Срочно: <script>alert(1)</script>' });

    const inbox = await t.api('GET', '/inbox?after=0');
    assert.deepEqual(inbox.messages.map(m => m.kind), ['answer', 'call', 'urgent']);
    assert.equal(inbox.messages[0].requestId, 'r1');
    assert.equal(inbox.messages[0].customerName, 'Иван Заказчиков');
    assert.equal(inbox.messages[1].text, 'Перезвоните, пожалуйста');
    assert.equal((await t.api('GET', `/inbox?after=${inbox.seq}`)).messages.length, 0, 'the cursor skips what was already taken');

    const out = await t.web('POST', '/logout', { csrf });
    assert.equal(out.location, '/login');
    assert.equal((await t.web('GET', '/p/p1')).location, '/login');
  } finally { await t.stop(); }
});

test('password reset ends sessions; disabled customers cannot log in; data survives a restart', async () => {
  const t = await start();
  let dir;
  try {
    dir = t.dir;
    await t.api('PUT', '/projects/p1', { model });
    const c = await t.api('POST', '/customers', { name: 'Пётр', login: 'petr', projectIds: ['p1', 'p2'] });
    await t.web('POST', '/login', { login: 'petr', password: c.password });
    assert.equal((await t.web('GET', '/')).location, '/p/p1', 'an unpublished linked project is skipped');
    const reset = await t.api('PATCH', '/customers/' + c.customer.id, { resetPassword: true });
    assert.notEqual(reset.password, c.password);
    assert.equal((await t.web('GET', '/')).location, '/login', 'old session ended');
    assert.equal((await t.web('POST', '/login', { login: 'petr', password: c.password })).status, 401);
    await t.api('PATCH', '/customers/' + c.customer.id, { disabled: true });
    assert.equal((await t.web('POST', '/login', { login: 'petr', password: reset.password })).status, 401);
    const list = await t.api('GET', '/customers');
    assert.equal(list.customers[0].disabled, true);
    assert.ok(!('hash' in list.customers[0]) && !('salt' in list.customers[0]), 'password hashes never leave the server');
  } finally { await t.stop(); }
  const again = createServer({ dataDir: dir, port: 0, configFile: path.join(dir, 'none.json') });
  assert.equal(Object.keys(again.store.data.customers).length, 1);
  assert.ok(again.store.data.projects.p1);
});

test('login throttling after repeated failures', async () => {
  const t = await start();
  try {
    await t.api('POST', '/customers', { name: 'A', login: 'a' });
    let last;
    for (let i = 0; i < 9; i++) last = await t.web('POST', '/login', { login: 'a', password: 'x' + i });
    assert.equal(last.status, 429);
  } finally { await t.stop(); }
});

test('3.7 customer page: blocks, questions to the team, meeting reschedule and calendar file', async () => {
  const t = await start();
  try {
    const p = { ...project, members: ['u2'], contactId: 'u1',
      ird: [{ id: 'i1', title: 'ГПЗУ', who: 'Заказчик', status: 'wait', due: '2026-12-01' }],
      meetings: [{ id: 'mt1', date: '2026-12-10', from: '11:00', to: '12:00', title: 'Совещание', place: 'онлайн' }],
      contract: { no: '26/07', date: '2026-04-14', sum: 1000000, status: 'signed' }, payments: [{ id: 'pay', title: 'Аванс', sum: 300000, status: 'paid' }], bills: [] };
    const m = pageModel({ project: p, tasks, contact: { name: 'Сериков Сергей', role: 'ГИП', phone: '+7 900' }, team: [{ name: 'Волков Сергей', role: 'главный специалист, электрика' }], today: '2026-11-05' });
    await t.api('PUT', '/projects/p1', { model: m });
    const c = await t.api('POST', '/customers', { name: 'Игорь', login: 'igor', projectIds: ['p1'] });
    await t.web('POST', '/login', { login: 'igor', password: c.password });
    const page = await t.web('GET', '/p/p1');
    for (const s of ['Главная', 'План работ', 'Договор и финансы', 'Исходные данные', 'Вопросы', 'Встречи и протоколы', 'Навигатор по проекту', '3D-модель', 'Вы вошли как', 'Игорь', 'Волков С.']) assert.ok(page.text.includes(s), s);
    assert.match(page.text, /1 000 000 ₽/, 'the contract the GIP filled in');
    assert.doesNotMatch(page.text, /777 ?000/, 'internal budgets never');
    assert.doesNotMatch(page.text, /<script(?![^>]*src=)/i, 'no inline scripts: blocks switch by anchors');
    const csrf = csrfOf(page.text);
    const q = await t.web('POST', '/c/question', { csrf, project: 'p1', to: 'Волков Сергей', text: 'Где ввод электроснабжения?' });
    assert.equal(q.location, '/p/p1?ok=question#q');
    const forged = await t.web('POST', '/c/question', { csrf, project: 'p1', to: 'Посторонний', text: 'x' });
    assert.equal(forged.status, 303);
    const mt = await t.web('POST', '/c/meeting', { csrf, project: 'p1', meeting: 'mt1', text: 'Можно в четверг?' });
    assert.equal(mt.location, '/p/p1?ok=meeting#meet');
    const inbox = await t.api('GET', '/inbox?after=0');
    assert.deepEqual(inbox.messages.map(x => [x.kind, x.to || '']), [['question', 'Волков Сергей'], ['question', 'Сериков Сергей'], ['meeting', '']]);
    const after = await t.web('GET', '/p/p1');
    assert.match(after.text, /Где ввод электроснабжения\?/, 'own questions are listed');
    const ics = await t.web('GET', '/p/p1/meeting/mt1.ics');
    assert.equal(ics.status, 200);
    assert.match(ics.text, /DTSTART:20261210T110000/);
    assert.equal((await t.web('GET', '/p/p1/meeting/none.ics')).status, 404);
  } finally { await t.stop(); }
});

test('4.0: files for approval — upload, customer downloads, «Согласовано» / remarks, delete with the project', async () => {
  const t = await start();
  try {
    const withFiles = pageModel({ project: { ...project, requests: [{ id: 'r2', title: 'Согласовать планировку', due: '2026-12-07', files: [{ id: 'f1', name: 'Планировка этажа.pdf', size: 5 }] }] }, tasks, contact: { name: 'ГИП' }, today: '2026-11-05' });
    assert.deepEqual(withFiles.project.requests[0].files, [{ id: 'f1', name: 'Планировка этажа.pdf', size: 5 }]);
    assert.equal((await t.api('PUT', '/projects/p1', { model: withFiles })).ok, true);
    const up = await t.api('PUT', '/projects/p1/files/f1', { name: 'Планировка этажа.pdf', type: 'application/pdf', data: Buffer.from('%PDF-').toString('base64') });
    assert.equal(up.ok, true);
    assert.equal((await t.api('PUT', '/projects/p1/files/..%2Fx', { name: 'x', data: 'AA==' })).status, 400, 'file ids are plain');
    const c = await t.api('POST', '/customers', { name: 'Иван', login: 'ivan', projectIds: ['p1'] });
    await t.web('POST', '/login', { login: 'ivan', password: c.password });
    const page = await t.web('GET', '/p/p1');
    assert.match(page.text, /href="\/p\/p1\/f\/f1" download>Планировка этажа\.pdf</);
    assert.match(page.text, /name="decision" value="approve"/);
    const file = await t.web('GET', '/p/p1/f/f1');
    assert.equal(file.status, 200);
    assert.equal(file.text, '%PDF-');
    assert.match(file.headers.get('content-disposition'), /filename\*=UTF-8''%D0%9F/);
    assert.equal((await t.web('GET', '/p/p1/f/nope')).status, 404);
    const csrf = csrfOf(page.text);
    const ok = await t.web('POST', '/c/answer', { csrf, project: 'p1', request: 'r2', decision: 'approve' });
    assert.equal(ok.status, 303);
    const inbox = await t.api('GET', '/inbox?after=0');
    const m = inbox.messages.at(-1);
    assert.equal(m.decision, 'approve');
    assert.equal(m.text, 'Согласовано');
    // Without a text remarks are refused.
    assert.match((await t.web('POST', '/c/answer', { csrf, project: 'p1', request: 'r2', decision: 'remarks' })).location, /ok=empty/);
    assert.equal((await t.api('DELETE', '/projects/p1')).ok, true);
    assert.equal(fs.existsSync(path.join(t.dir, 'files', 'p1')), false, 'files go with the project');
  } finally { await t.stop(); }
});

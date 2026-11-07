'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/cabinet-server.js');
const { Cabinet, normalizeUrl, isLocalHost, modelHash } = require('../src/cabinet.js');
const { pageModel } = require('../src/report/customer.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cabc-'));
const project = { id: 'p1', name: 'Объект', requests: [{ id: 'r1', title: 'ТУ', due: '2026-12-01' }] };
const model = (over = {}) => pageModel({ project: { ...project, ...over }, tasks: [], contact: null, today: '2026-11-05' });

async function withServer(fn) {
  const dir = tmp();
  const s = createServer({ dataDir: dir, configFile: path.join(dir, 'none.json') });
  await new Promise(r => s.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${s.server.address().port}`;
  try { await fn({ url, key: s.teamKey(), s }); } finally { await new Promise(r => s.server.close(r)); }
}

test('urls: normalized, local addresses recognised', () => {
  assert.equal(normalizeUrl('cabinet.example.ru/'), 'https://cabinet.example.ru');
  assert.equal(normalizeUrl(' http://192.168.1.10:8080/ '), 'http://192.168.1.10:8080');
  assert.equal(normalizeUrl('ftp://x'), null);
  assert.equal(normalizeUrl('https://user:pw@x.ru'), null);
  assert.equal(normalizeUrl(''), null);
  assert.ok(isLocalHost('http://192.168.1.10:8080') && isLocalHost('http://office-pc:8080') && !isLocalHost('http://cabinet.example.ru'));
  assert.equal(modelHash({ ...model(), publishedAt: 'x' }), modelHash({ ...model(), publishedAt: 'y' }), 'the date stamp alone does not count as a change');
});

test('client: publish, refresh only changed projects, poll messages with a cursor', async () => {
  await withServer(async ({ url, key, s }) => {
    const dir = tmp();
    const c = new Cabinet(dir, { url: () => url, key: () => key });
    assert.equal((await c.ping()).ok, true);
    await c.publish('p1', model());
    assert.ok(s.store.data.projects.p1);
    let current = model();
    assert.equal(await c.refreshPublished(() => current), 0, 'unchanged project is not re-sent');
    current = model({ name: 'Объект (новое имя)' });
    assert.equal(await c.refreshPublished(() => current), 1);
    assert.equal(s.store.data.projects.p1.project.name, 'Объект (новое имя)');

    const created = await c.createCustomer({ name: 'Заказчик', login: 'z', projectIds: ['p1'] });
    assert.ok(created.password);
    assert.equal((await c.customers()).length, 1);
    // A message arrives through the customer's web form.
    s.store.data.seq = 1;
    s.store.data.inbox.push({ seq: 1, id: 'm1', projectId: 'p1', kind: 'urgent', text: 'Срочно', customerName: 'Заказчик', ts: new Date().toISOString() });
    const fresh = await c.poll();
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].read, false);
    assert.equal((await c.poll()).length, 0, 'already taken');
    c.markRead(['m1']);
    const again = new Cabinet(dir, { url: () => url, key: () => key });
    assert.equal(again.state.messages[0].read, true, 'state survives a restart');
    assert.equal(again.state.seq, 1);

    // Server reinstalled with an empty inbox: the cursor starts over, nothing is lost or duplicated.
    s.store.data.seq = 0; s.store.data.inbox = [];
    await again.poll();
    assert.equal(again.state.seq, 0);
    s.store.data.seq = 1; s.store.data.inbox.push({ seq: 1, id: 'm2', projectId: 'p1', kind: 'call', text: '', ts: '' });
    assert.deepEqual((await again.poll()).map(m => m.id), ['m2']);

    await c.unpublish('p1');
    assert.ok(!s.store.data.projects.p1);
  });
});

test('client: clear errors for a wrong key, a dead address and a foreign server', async () => {
  await withServer(async ({ url }) => {
    const c = new Cabinet(tmp(), { url: () => url, key: () => 'wrong' });
    await assert.rejects(c.ping(), /Неверный ключ команды/);
    await assert.rejects(c.poll(), /Неверный ключ/);
    assert.match(c.state.lastError, /Неверный ключ/);
  });
  const dead = new Cabinet(tmp(), { url: () => 'http://127.0.0.1:1', key: () => 'k', timeoutMs: 3000 });
  await assert.rejects(dead.ping(), /Нет связи с кабинетом/);
  const foreign = new Cabinet(tmp(), { url: () => 'http://x.local', key: () => 'k', fetchImpl: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(foreign.ping(), /отвечает не сервер кабинета/);
  await assert.rejects(new Cabinet(tmp()).ping(), /не настроен/);
});

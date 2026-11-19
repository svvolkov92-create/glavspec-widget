'use strict';
// src/core/remote-client.js without a server: a fake fetch plays the server, the proxy in front of it, no network.
const test = require('node:test');
const assert = require('node:assert');
const createRemote = require('../src/core/remote-client.js');

const VIEW = () => ({ me: { id: 'u1', name: 'Я' }, tasks: [{ id: 't1', notify: { u1: '2026-11-01T00:00:00Z' }, seen: {} }], chats: [{ id: 'c1', seen: {}, messages: [{ ts: '2026-11-01T00:00:00Z' }] }], projects: [], users: [], contractors: [] });
const res = (status, body, type = 'application/json') => ({
  status, headers: { get: () => type },
  json: async () => body, arrayBuffer: async () => new TextEncoder().encode(String(body)).buffer,
});
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

test('remote: «seen» without a connection is kept once and shown at once (no endless queue)', async () => {
  let changes = 0;
  const r = createRemote({ url: 'https://x', token: 't', fetch: async () => { throw new TypeError('offline'); },
    storage: { load: () => ({ view: VIEW(), rev: 5, queue: [] }), save() {} }, onChanged: () => { changes++; } });
  for (let i = 0; i < 20; i++) { await r.call('taskSeen', 't1'); await r.call('chatSeen', 'c1'); }
  assert.equal(r.state.queue.length, 2, 'one item per card / chat, however often the window asks');
  assert.ok(r.view().tasks[0].seen.u1, 'the card is no longer «new» in the window');
  assert.ok(r.view().chats[0].seen.u1, 'the chat is read in the window');
  assert.ok(changes > 0);
});

test('remote: signed out while sending — the queue is kept, not thrown away', async () => {
  const fetch = async url => (url.endsWith('/api/view') ? res(200, { ok: true, rev: 5, data: VIEW() }) : res(401, { message: 'Войдите заново.' }));
  let lost = 0;
  const r = createRemote({ url: 'https://x', token: 't', fetch, onAuthLost() { lost++; },
    storage: { load: () => ({ view: VIEW(), rev: 5, queue: [{ fn: 'write', args: [[{ type: 'update', col: 'tasks', id: 't1', data: { title: 'Новое' } }], {}, {}], at: 'x' }] }), save() {} } });
  await r.refresh();
  r.start(); await tick(50); r.stop();
  assert.ok(lost >= 1);
  assert.equal(r.state.queue.length, 1, 'the change still waits for signing in again');
  assert.equal(r.state.failed.length, 0);
});

test('remote: a proxy page instead of the server — the copy stays, retries wait (no tight loop)', async () => {
  let calls = 0;
  const r = createRemote({ url: 'https://x', token: 't', fetch: async () => { calls++; return res(404, '<html>nginx</html>', 'text/html'); },
    storage: { load: () => ({ view: VIEW(), rev: 5, queue: [] }), save() {} } });
  await assert.rejects(r.refresh());
  assert.ok(r.view()?.tasks?.length, 'the copy here is not replaced by nothing');
  r.start();
  await tick(300);
  r.stop();
  assert.ok(calls <= 3, `requests in 0.3 s: ${calls}`);
  assert.equal(r.state.online, false);
});

test('remote: a change the server refuses leaves the queue; the next ones go on', async () => {
  const sent = [];
  let rev = 5;
  const fetch = async (url, o) => {
    if (url.endsWith('/api/view')) return res(200, { ok: true, rev, data: VIEW() });
    const b = JSON.parse(o.body); sent.push(b.args[0]?.[0]?.data?.title);
    rev++;
    return res(200, b.args[0]?.[0]?.data?.title === 'плохо' ? { ok: false, rev, message: 'Сервер не смог выполнить действие' } : { ok: true, rev });
  };
  const op = title => [[{ type: 'update', col: 'tasks', id: 't1', data: { title } }], {}, {}];
  const r = createRemote({ url: 'https://x', token: 't', fetch,
    storage: { load: () => ({ view: VIEW(), rev: 5, queue: [{ fn: 'write', args: op('плохо'), at: 'a' }, { fn: 'write', args: op('хорошо'), at: 'b' }] }), save() {} } });
  r.state.online = true;
  await r.refresh();
  // sendQueue runs inside the loop; one pass is enough here
  r.start(); await tick(50); r.stop();
  assert.deepEqual(sent.slice(0, 2), ['плохо', 'хорошо']);
  assert.equal(r.state.queue.length, 0);
  assert.equal(r.status().failed.length, 1);
});

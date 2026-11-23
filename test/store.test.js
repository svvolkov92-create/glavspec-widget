'use strict';
// The data set and its operations (src/core/store-core.js) — the rules both the Tauri window and the Сервер Пульта
// keep the data by. The files themselves (atomic writes, daily copies, a broken file put aside) are the Rust core's
// (src-tauri/src/files.rs, its own tests) and the server's.
const test = require('node:test');
const assert = require('node:assert/strict');
const { StoreError, emptyData, fromParsed, snapshot, fromBackup, applyOp } = require('../src/core/store-core.js');

test('set, update, delete', () => {
  const d = emptyData();
  applyOp(d, { type: 'set', col: 'projects', id: 'p1', data: { name: 'Объект', code: 'A' } });
  applyOp(d, { type: 'update', col: 'projects', id: 'p1', data: { code: 'B' } });
  applyOp(d, { type: 'set', col: 'tasks', id: 't1', data: { section: 'ЭОМ', payments: [{ id: 'x', amount: 1 }] } });
  applyOp(d, { type: 'delete', col: 'tasks', id: 't1' });
  const again = fromParsed(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(snapshot(again).projects, [{ id: 'p1', name: 'Объект', code: 'B' }]);
  assert.deepEqual(snapshot(again).tasks, []);
});

test('rejects unknown collections, bad ids and non-object data', () => {
  const d = emptyData();
  assert.throws(() => applyOp(d, { type: 'set', col: '__proto__', id: 'a', data: {} }), StoreError);
  assert.throws(() => applyOp(d, { type: 'set', col: 'tasks', id: '../x', data: {} }), StoreError);
  assert.throws(() => applyOp(d, { type: 'set', col: 'tasks', id: 'a', data: [1] }), StoreError);
  assert.throws(() => applyOp(d, { type: 'update', col: 'tasks', id: 'missing', data: {} }), StoreError);
  assert.throws(() => applyOp(d, { type: 'drop', col: 'tasks', id: 'a' }), StoreError);
});

test('stored id field cannot override the record key', () => {
  const d = emptyData();
  applyOp(d, { type: 'set', col: 'contractors', id: 'c1', data: { id: 'evil', name: 'Петров' } });
  assert.deepEqual(snapshot(d).contractors, [{ id: 'c1', name: 'Петров' }]);
});

test('a broken data file: unknown or broken collections become empty, a non-object root is refused', () => {
  assert.deepEqual(snapshot(fromParsed({ tasks: 'x', projects: { p: { n: 1 } } })), { projects: [{ id: 'p', n: 1 }], contractors: [], tasks: [], users: [], chats: [], depts: [], orgs: [] });
  assert.throws(() => fromParsed([1, 2]));
});

test('restore from a copy: invalid ids skipped, the structure checked', () => {
  const { data, count } = fromBackup({ projects: { p1: { name: 'Новый', id: 'evil' } }, tasks: { t1: { status: 'done' }, '../x': { status: 'done' } } });
  assert.equal(count, 2);
  assert.deepEqual(snapshot(data).projects, [{ id: 'p1', name: 'Новый' }]);
  assert.throws(() => fromBackup([1, 2]), StoreError);
  assert.throws(() => fromBackup({ tasks: 'x' }), StoreError);
});

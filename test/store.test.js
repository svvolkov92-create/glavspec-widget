'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store, StoreError } = require('../src/store.js');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'glavspec-'));

test('set, update, delete persist across reloads', () => {
  const dir = tmpDir();
  const s = new Store(dir);
  s.apply({ type: 'set', col: 'projects', id: 'p1', data: { name: 'Объект', code: 'A' } });
  s.apply({ type: 'update', col: 'projects', id: 'p1', data: { code: 'B' } });
  s.apply({ type: 'set', col: 'tasks', id: 't1', data: { section: 'ЭОМ', payments: [{ id: 'x', amount: 1 }] } });
  s.apply({ type: 'delete', col: 'tasks', id: 't1' });

  const again = new Store(dir);
  assert.deepEqual(again.snapshot().projects, [{ id: 'p1', name: 'Объект', code: 'B' }]);
  assert.deepEqual(again.snapshot().tasks, []);
  assert.equal(fs.existsSync(path.join(dir, 'data.json.tmp')), false);
});

test('rejects unknown collections, bad ids and non-object data', () => {
  const s = new Store(tmpDir());
  assert.throws(() => s.apply({ type: 'set', col: '__proto__', id: 'a', data: {} }), StoreError);
  assert.throws(() => s.apply({ type: 'set', col: 'tasks', id: '../x', data: {} }), StoreError);
  assert.throws(() => s.apply({ type: 'set', col: 'tasks', id: 'a', data: [1] }), StoreError);
  assert.throws(() => s.apply({ type: 'update', col: 'tasks', id: 'missing', data: {} }), StoreError);
  assert.throws(() => s.apply({ type: 'drop', col: 'tasks', id: 'a' }), StoreError);
});

test('stored id field cannot override the record key', () => {
  const s = new Store(tmpDir());
  s.apply({ type: 'set', col: 'contractors', id: 'c1', data: { id: 'evil', name: 'Петров' } });
  assert.deepEqual(s.snapshot().contractors, [{ id: 'c1', name: 'Петров' }]);
});

test('corrupted file is set aside, not overwritten', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'data.json'), '{ broken');
  const s = new Store(dir);
  assert.ok(s.warning);
  assert.deepEqual(s.snapshot(), { projects: [], contractors: [], tasks: [], users: [], chats: [], depts: [] });
  const aside = fs.readdirSync(dir).filter(f => f.startsWith('data.corrupt-'));
  assert.equal(aside.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, aside[0]), 'utf8'), '{ broken');
});

test('one backup per day, pruned to the last 30', () => {
  const dir = tmpDir();
  let day = new Date(2026, 0, 1);
  const s = new Store(dir, { now: () => day });
  s.apply({ type: 'set', col: 'projects', id: 'p', data: { n: 0 } }); // no file yet → no backup
  for (let i = 1; i <= 35; i++) {
    day = new Date(2026, 0, 1 + i);
    s.apply({ type: 'set', col: 'projects', id: 'p', data: { n: i } });
    s.apply({ type: 'set', col: 'projects', id: 'p', data: { n: i + 0.5 } }); // same day: no second backup
  }
  const backups = fs.readdirSync(path.join(dir, 'backups')).sort();
  assert.equal(backups.length, 30);
  assert.equal(backups.at(-1), 'data-2026-02-05.json');
  // the backup holds the state from before the first change of that day
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'backups', backups.at(-1)), 'utf8')).projects.p.n, 34.5);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Journal, describe, diffBatch } = require('../src/journal.js');
const { DesktopLevel, hwndString, encodeCommand, HELPER_SCRIPT } = require('../src/desktop-level.js');

const ctx = { projects: { p1: { name: 'ЖК Северный' } }, contractors: { c1: { name: 'Петров' }, c2: { name: 'Сидорова' } } };

test('journal: task changes are described in plain words', () => {
  const before = { projectId: 'p1', sections: ['ЭОМ'], status: 'in_progress', finish: '2026-10-20', contractorId: 'c1', budget: 100,
    payments: [{ id: 'x', amount: 50, date: '2026-10-01' }], milestones: [{ id: 'm', title: 'Задание', date: '2026-10-10' }], history: [] };
  const after = { ...before, status: 'review', finish: '2026-10-27', contractorId: 'c2',
    payments: [...before.payments, { id: 'y', amount: 20000, date: '2026-10-13', note: 'Аванс' }],
    milestones: [{ id: 'm', title: 'Задание', date: '2026-10-10', done: true }], history: [{ any: 1 }] };
  const e = describe('tasks', 't1', before, after, ctx);
  assert.equal(e.kind, 'update');
  assert.equal(e.title, 'ЭОМ · ЖК Северный');
  const byLabel = Object.fromEntries(e.changes.map(c => [c.label, c]));
  assert.deepEqual([byLabel['Статус'].from, byLabel['Статус'].to], ['В работе', 'На проверке']);
  assert.deepEqual([byLabel['Финиш'].from, byLabel['Финиш'].to], ['20.10.26', '27.10.26']);
  assert.deepEqual([byLabel['Исполнитель'].from, byLabel['Исполнитель'].to], ['Петров', 'Сидорова']);
  assert.match(byLabel['Платёж внесён'].to, /^20\s000 ₽ \(Аванс\) от 13\.10\.26$/);
  assert.equal(byLabel['Контрольная точка выполнена'].to, 'Задание');
});

test('journal: kinds, and bookkeeping-only changes are skipped', () => {
  const doc = { projectId: 'p1', sections: ['СС'], status: 'not_started' };
  assert.equal(describe('tasks', 't', null, doc, ctx).kind, 'create');
  assert.equal(describe('tasks', 't', doc, null, ctx).kind, 'delete');
  assert.equal(describe('tasks', 't', doc, { ...doc, deletedAt: 'x' }, ctx).kind, 'trash');
  assert.equal(describe('tasks', 't', { ...doc, deletedAt: 'x' }, { ...doc, deletedAt: null }, ctx).kind, 'restore');
  assert.equal(describe('tasks', 't', doc, { ...doc, history: [1], createdAt: 'z' }, ctx), null);
  assert.equal(describe('tasks', 't', doc, doc, ctx), null);
  assert.equal(describe('projects', 'p1', { name: 'А' }, { name: 'А', archived: true }, ctx).changes[0].label, 'В архиве');
});

test('journal: append, read newest first, period filter, batch and torn lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-'));
  const j = new Journal(dir);
  const ops = [{ col: 'tasks', id: 'a' }, { col: 'tasks', id: 'a' }, { col: 'tasks', id: 'b' }];
  const before = { 'tasks/a': null, 'tasks/b': { sections: ['АПС'], status: 'review' } };
  const after = { 'tasks/a': { sections: ['ЭС'], status: 'not_started' }, 'tasks/b': { sections: ['АПС'], status: 'done' } };
  const entries = diffBatch(ops, (c, id) => before[c + '/' + id], (c, id) => after[c + '/' + id], ctx);
  assert.equal(entries.length, 2);
  j.append(entries, { action: 'Импорт' });
  fs.appendFileSync(j.file, '{"broken": ');
  const read = j.read();
  assert.equal(read.length, 2);
  assert.equal(read[0].batch, read[1].batch);
  assert.equal(read[0].action, 'Импорт');
  assert.deepEqual(j.read({ since: '2999-01-01' }), []);
  assert.deepEqual(new Journal(path.join(dir, 'missing')).read(), []);
});

test('desktop level: HWND parsing and the encoded helper command', () => {
  const b8 = Buffer.alloc(8); b8.writeBigUInt64LE(0x3001an);
  assert.equal(hwndString(b8), String(0x3001a));
  const b4 = Buffer.alloc(4); b4.writeUInt32LE(77);
  assert.equal(hwndString(b4), '77');
  assert.equal(hwndString(null), null);
  assert.equal(Buffer.from(encodeCommand(HELPER_SCRIPT), 'base64').toString('utf16le'), HELPER_SCRIPT);
});

test('desktop level: sends HWNDs to the helper; off outside Windows; survives a failed start', () => {
  const written = [];
  const fakeProc = Object.assign(new EventEmitter(), { stdin: { writable: true, write: s => written.push(s), end() {} }, stderr: new EventEmitter(), kill() {} });
  let spawned = 0;
  const d = new DesktopLevel({ platform: 'win32', spawnFn: () => { spawned++; return fakeProc; }, log: {} });
  const hwnd = Buffer.alloc(8); hwnd.writeBigUInt64LE(42n);
  const win = { isDestroyed: () => false, getNativeWindowHandle: () => hwnd };
  assert.equal(d.sendToBottom(win), true);
  assert.equal(d.sendToBottom(win), true);
  assert.deepEqual(written, ['42\n', '42\n']);
  assert.equal(spawned, 1);

  const linux = new DesktopLevel({ platform: 'linux', spawnFn: () => { throw new Error('must not spawn'); }, log: {} });
  assert.equal(linux.supported, false);
  assert.equal(linux.sendToBottom(win), false);

  const broken = new DesktopLevel({ platform: 'win32', spawnFn: () => { throw new Error('no powershell'); }, log: {} });
  assert.equal(broken.sendToBottom(win), false);
  assert.equal(broken.supported, false);
});

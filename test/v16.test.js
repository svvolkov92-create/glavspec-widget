'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { describe, diffBatch, batchLines } = require('../src/core/journal-diff.js');

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

test('journal: a batch of changes → one entry per record, lines share the batch', () => {
  const ops = [{ col: 'tasks', id: 'a' }, { col: 'tasks', id: 'a' }, { col: 'tasks', id: 'b' }];
  const before = { 'tasks/a': null, 'tasks/b': { sections: ['АПС'], status: 'review' } };
  const after = { 'tasks/a': { sections: ['ЭС'], status: 'not_started' }, 'tasks/b': { sections: ['АПС'], status: 'done' } };
  const entries = diffBatch(ops, (c, id) => before[c + '/' + id], (c, id) => after[c + '/' + id], ctx);
  assert.equal(entries.length, 2);
  const lines = batchLines(entries, { action: 'Импорт' });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].batch, lines[1].batch);
  assert.equal(lines[0].action, 'Импорт');
});

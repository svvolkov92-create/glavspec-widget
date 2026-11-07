'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/renderer/logic.js');

const TODAY = '2026-10-12';

test('overdue only for active statuses past the finish date', () => {
  const base = { finish: '2026-10-10' };
  for (const status of ['not_started', 'in_progress', 'revision', 'paused']) {
    const t = L.timing({ ...base, status }, TODAY);
    assert.equal(t.overdue, true, status);
    assert.equal(t.late, 2);
  }
  assert.equal(L.timing({ ...base, status: 'review' }, TODAY).overdue, false);
  assert.equal(L.timing({ ...base, status: 'done' }, TODAY).overdue, false);
});

test('deadline today is not overdue; days left are calendar days', () => {
  assert.equal(L.timing({ status: 'in_progress', finish: TODAY }, TODAY).overdue, false);
  assert.equal(L.timing({ status: 'in_progress', finish: TODAY }, TODAY).text, 'сдача сегодня');
  assert.equal(L.timing({ status: 'in_progress', finish: '2026-10-19' }, TODAY).diff, 7);
  // across the end of March (DST in many zones) the count must stay exact
  assert.equal(L.timing({ status: 'in_progress', finish: '2027-04-01' }, '2027-03-25').diff, 7);
});

test('missing finish date is never overdue', () => {
  assert.equal(L.timing({ status: 'in_progress' }, TODAY).overdue, false);
});

test('missed start is flagged for not-started work', () => {
  const t = L.timing({ status: 'not_started', start: '2026-10-01', finish: '2026-10-30' }, TODAY);
  assert.match(t.text, /старт пропущен/);
});

test('parseMoney accepts Russian formatting and rejects garbage', () => {
  assert.equal(L.parseMoney('150 000,50'), 150000.5);
  assert.equal(L.parseMoney('150 000 ₽'), 150000);
  assert.equal(L.parseMoney(''), 0);
  assert.ok(Number.isNaN(L.parseMoney('-5')));
  assert.ok(Number.isNaN(L.parseMoney('abc')));
});

test('paid and rest are summed without float drift', () => {
  const t = { budget: 0.3, payments: [{ amount: 0.1 }, { amount: 0.2 }] };
  assert.equal(L.paidOf(t), 0.3);
  assert.equal(L.restOf(t), 0);
  assert.equal(L.restOf({ budget: 100, payments: [{ amount: 150 }] }), -50);
  assert.equal(L.paidOf({ budget: 100 }), 0);
});

test('totals aggregate counts and money', () => {
  const list = [
    { status: 'in_progress', finish: '2026-10-01', budget: 100, payments: [{ amount: 40 }] },
    { status: 'review', finish: '2026-10-01', budget: 50, payments: [] },
    { status: 'done', budget: 10, payments: [{ amount: 10 }] },
  ];
  assert.deepEqual(L.totals(list, TODAY), { budget: 160, paid: 50, rest: 110, overdue: 1, review: 1, active: 1, done: 1, count: 3 });
});

test('marks: legacy single field, normalization and catalogue order', () => {
  assert.deepEqual(L.sectionsOf({ section: 'ЭОМ' }), ['ЭОМ']);
  assert.deepEqual(L.sectionsOf({ section: 'сс, ЭОМ' }), ['ЭОМ', 'СС']);
  assert.deepEqual(L.sectionsOf({ sections: ['АПС'], section: 'старое' }), ['АПС']);
  assert.deepEqual(L.sectionsOf({}), []);
  assert.deepEqual(L.normalizeMarks(['СКУД', ' эом ', 'АИИС  КУЭ', 'ЭОМ', '', 'ЭОМ1']), ['ЭОМ', 'СКУД', 'АИИС КУЭ', 'ЭОМ1']);
  assert.deepEqual(L.splitMarks('ЭОМ1, АИИС КУЭ;ОВ'), ['ЭОМ1', ' АИИС КУЭ', 'ОВ']);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(L.addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
});

test('working days: fast running count equals day-by-day count', () => {
  const C = require('../src/renderer/calendar.js');
  const brute = (from, to) => {
    if (from === to) return 0;
    const sign = to > from ? 1 : -1;
    const a = new Date((sign > 0 ? from : to) + 'T00:00Z'), b = new Date((sign > 0 ? to : from) + 'T00:00Z');
    let n = 0;
    for (const d = new Date(a); ;) { d.setUTCDate(d.getUTCDate() + 1); if (d > b) break; if (C.isWorkday(d.toISOString().slice(0, 10))) n++; }
    return n * sign;
  };
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < 400; i++) {
    const a = new Date(start + ((i * 37) % 1500) * 864e5).toISOString().slice(0, 10);
    const b = new Date(start + ((i * 91 + 13) % 1500) * 864e5).toISOString().slice(0, 10);
    assert.equal(C.workdaysBetween(a, b), brute(a, b), `${a} → ${b}`);
  }
  assert.equal(C.workdaysBetween('2025-12-31', '2026-12-31'), 247);
});

test('per-card results are cached per card object and date', () => {
  const t = { status: 'in_progress', start: '2026-10-01', finish: '2026-10-20' };
  assert.equal(L.timing(t, '2026-10-12'), L.timing(t, '2026-10-12'));
  assert.notEqual(L.timing(t, '2026-10-12'), L.timing(t, '2026-10-13'));
  assert.notEqual(L.timing({ ...t }, '2026-10-12'), L.timing(t, '2026-10-12'));
  assert.deepEqual(L.timing({ ...t }, '2026-10-12'), L.timing(t, '2026-10-12'));
});

test('progress: fact, plan to date and lag, by count and by budget', () => {
  const today = '2026-10-15';
  const tasks = [
    { status: 'done', finish: '2026-10-01', budget: 100 },
    { status: 'review', finish: '2026-10-10', budget: 100 },
    { status: 'in_progress', finish: '2026-10-05', start: '2026-09-01', budget: 200 },
    { status: 'not_started', finish: '2026-11-30', budget: 600 },
  ];
  const c = L.progress(tasks, today);
  assert.equal(c.fact, 25);
  assert.equal(c.plan, 75);
  assert.equal(c.readyPct, 47.8); // (100 + 90 + 1 + 0) / 4
  assert.equal(c.lag, 27.2);
  assert.equal(c.late, 1);
  assert.deepEqual(c.parts, { done: 25, review: 25, work: 25, idle: 25 });
  const b = L.progress(tasks, today, 'budget');
  assert.equal(b.fact, 10);
  assert.equal(b.plan, 40);
  assert.equal(L.progress([], today).fact, 0);
});

test('readiness: fixed by status, manual 1…90 in work', () => {
  assert.equal(L.readiness({ status: 'not_started', readiness: 50 }), 0);
  assert.equal(L.readiness({ status: 'in_progress' }), 1);
  assert.equal(L.readiness({ status: 'in_progress', readiness: 60 }), 60);
  assert.equal(L.readiness({ status: 'in_progress', readiness: 99 }), 90);
  assert.equal(L.readiness({ status: 'paused', readiness: 40 }), 40);
  assert.equal(L.readiness({ status: 'review', readiness: 40 }), 90);
  assert.equal(L.readiness({ status: 'revision', readiness: 40 }), 80);
  assert.equal(L.readiness({ status: 'done' }), 100);
  const A = require('../src/renderer/access.js');
  const users = [{ id: 'c', role: 'chief', name: 'Ч', directions: ['el'] }, { id: 's', role: 'specialist', name: 'С', directions: ['el'], chiefId: 'c' }];
  const t = { ownerId: 's', status: 'in_progress', sections: ['ЭОМ'] };
  assert.equal(A.checkWrite(users[0], 'tasks', t, { ...t, readiness: 60 }, users), null);
  assert.match(A.checkWrite(users[0], 'tasks', t, { ...t, readiness: 95 }, users), /от 1 до 90/);
  assert.match(A.checkWrite(users[1], 'tasks', t, { ...t, readiness: 60 }, users), /Специалист/);
});

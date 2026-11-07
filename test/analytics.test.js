'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/renderer/logic.js');

const TODAY = '2026-10-13';
const st = (date, from, to) => ({ ts: date + 'T10:00:00Z', date, type: 'status', from, to });
const sh = (date, from, to, reason) => ({ ts: date + 'T09:00:00Z', date, type: 'finish', from, to, reason });

test('shifts: count, days and the deadline the contractor answers for', () => {
  const t = { finish: '2026-11-20', history: [
    sh('2026-10-01', '2026-10-20', '2026-10-30', 'customer'),   // +10, excused
    sh('2026-10-05', '2026-10-30', '2026-11-10', 'contractor'), // +11, contractor's fault
    sh('2026-10-07', '2026-11-10', '2026-11-20', 'input'),      // +10, excused
  ] };
  const s = L.shiftsOf(t);
  assert.equal(s.count, 3);
  assert.equal(s.days, 31);
  assert.equal(s.original, '2026-10-20');
  assert.equal(s.contractorDeadline, '2026-11-09'); // 20.10 + 10 + 10
  assert.deepEqual(s.byReason, { customer: 1, contractor: 1, input: 1 });
  assert.equal(L.shiftsOf({ finish: '2026-12-01' }).contractorDeadline, '2026-12-01');
});

test('review stats: rounds and who held the work', () => {
  const t = { status: 'review', history: [
    st('2026-09-01', 'not_started', 'in_progress'),
    st('2026-09-20', 'in_progress', 'review'),
    st('2026-09-25', 'review', 'revision'),   // 5 days with the chief
    st('2026-10-02', 'revision', 'review'),   // 7 days with the contractor
    st('2026-10-06', 'review', 'revision'),   // 4 days with the chief
    st('2026-10-10', 'revision', 'review'),   // 4 days with the contractor; now in review 3 days
  ] };
  const r = L.reviewStats(t, TODAY);
  assert.equal(r.rounds, 2);
  assert.equal(r.chiefDays, 5 + 4 + 3);
  assert.equal(r.contractorDays, 7 + 4);
  assert.equal(r.submitted, '2026-09-20');
  assert.equal(r.accepted, null);
});

test('reliability: on time vs late, excused shifts do not count against', () => {
  const onTime = { status: 'done', finish: '2026-10-10', history: [sh('2026-09-01', '2026-09-30', '2026-10-10', 'customer'), st('2026-10-08', 'in_progress', 'review'), st('2026-10-09', 'review', 'done')] };
  const late = { status: 'done', finish: '2026-10-10', history: [sh('2026-09-01', '2026-09-30', '2026-10-10', 'contractor'), st('2026-10-08', 'in_progress', 'review'), st('2026-10-12', 'review', 'revision'), st('2026-10-12', 'revision', 'done')] };
  const runningLate = { status: 'in_progress', finish: '2026-10-03' };
  const notRated = { status: 'in_progress', finish: '2026-12-01' };
  assert.equal(L.lateness(late, TODAY).late, 8); // deadline stayed 30.09, submitted 08.10
  const r = L.reliability([onTime, late, runningLate, notRated], TODAY);
  assert.equal(r.rated, 3);
  assert.equal(r.onTime, 1);
  assert.equal(r.pct, 33);
  assert.equal(r.grade, 'bad');
  assert.equal(r.avgLate, 9); // (8 + 10) / 2
  assert.equal(r.avgRounds, 0.5);
  assert.equal(r.contractorShifts, 1);
  assert.equal(L.reliability([notRated], TODAY).grade, 'none');
});

test('payment plan: percent rows, triggers and FIFO matching of payments', () => {
  const t = {
    status: 'review', start: '2026-09-01', budget: 100000,
    plan: [
      { id: 'a', title: 'Аванс', pct: 30, trigger: 'start' },
      { id: 'b', title: 'При сдаче', pct: 30, trigger: 'review' },
      { id: 'c', title: 'Окончательно', pct: 40, trigger: 'accepted' },
    ],
    payments: [{ amount: 40000 }],
    history: [st('2026-10-01', 'in_progress', 'review')],
  };
  const p = L.paymentPlan(t, TODAY);
  assert.deepEqual(p.rows.map(r => [r.amount, r.paid, r.state]), [[30000, 30000, 'paid'], [30000, 10000, 'due'], [40000, 0, 'upcoming']]);
  assert.equal(p.dueNow, 20000);
  assert.equal(p.later, 40000);
  assert.equal(p.mismatch, 0);
  assert.equal(p.rows[1].dueDate, '2026-10-01');
});

test('payment plan: no plan means the rest is due after acceptance; unplanned budget is added', () => {
  assert.equal(L.paymentPlan({ status: 'done', budget: 1000, payments: [{ amount: 300 }] }, TODAY).dueNow, 700);
  assert.equal(L.paymentPlan({ status: 'in_progress', budget: 1000 }, TODAY).later, 1000);
  const p = L.paymentPlan({ status: 'in_progress', budget: 1000, plan: [{ id: 'x', amount: 200, trigger: 'date', date: '2026-10-01' }] }, TODAY);
  assert.equal(p.dueNow, 200);
  assert.equal(p.later, 800);
  assert.equal(p.mismatch, -800);
  assert.equal(p.rows.at(-1).virtual, true);
});

test('milestones: overdue and next, ignored once the card is accepted', () => {
  const ms = [{ id: 1, title: 'Задание', date: '2026-10-01', done: true }, { id: 2, title: 'Промежуточная', date: '2026-10-10' }, { id: 3, title: 'Финал', date: '2026-10-30' }];
  const m = L.milestonesOf({ status: 'in_progress', milestones: ms }, TODAY);
  assert.deepEqual(m.overdue.map(x => x.id), [2]);
  assert.equal(m.next.id, 3);
  assert.equal(m.done, 1);
  assert.equal(L.milestonesOf({ status: 'done', milestones: ms }, TODAY).overdue.length, 0);
});

test('visible(): trash and archive', () => {
  const snap = {
    projects: [{ id: 'p1' }, { id: 'p2', archived: true }, { id: 'p3', deletedAt: '2026-10-01' }],
    contractors: [{ id: 'c1' }, { id: 'c2', deletedAt: '2026-10-01' }],
    tasks: [{ id: 't1', projectId: 'p1' }, { id: 't2', projectId: 'p2' }, { id: 't3', projectId: 'p3', deletedAt: 'x' }, { id: 't4', projectId: 'gone' }],
  };
  const v = L.visible(snap);
  assert.deepEqual(v.projects.map(x => x.id), ['p1']);
  assert.deepEqual(v.contractors.map(x => x.id), ['c1']);
  assert.deepEqual(v.tasks.map(x => x.id), ['t1', 't4']);
  assert.deepEqual(L.visible(snap, { includeArchived: true }).tasks.map(x => x.id), ['t1', 't2', 't4']);
});

test('specialty matching and digest text', () => {
  assert.equal(L.matchCount({ specialty: 'АПС, соуэ / СКУД' }, ['АПС', 'СОУЭ', 'ЭОМ']), 2);
  assert.equal(L.matchCount({}, ['АПС']), 0);
  const tasks = [
    { status: 'in_progress', finish: '2026-10-10' },
    { status: 'in_progress', finish: TODAY },
    { status: 'done', budget: 100, payments: [] },
  ];
  assert.equal(L.digestText(tasks, TODAY), 'сорван срок: 1 · сдача сегодня: 1 · пора платить: 1');
  assert.equal(L.digestText([], TODAY), null);
});

'use strict';
// 4.1: project phases — duration ↔ end date, «сразу после предыдущего»; document validity.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/renderer/logic.js');

test('phase length: days from dates, finish from days', () => {
  assert.equal(L.phaseDays({ start: '2026-11-01', finish: '2026-11-30' }), 30);
  let ph = L.planPhases([{ key: 'p', start: '2026-11-01', finish: '', days: '10' }], 0, 'days');
  assert.equal(ph[0].finish, '2026-11-10');
  assert.equal(ph[0].days, undefined);
  // no start yet: days are kept until a start is typed
  ph = L.planPhases([{ key: 'p', start: '', finish: '', days: '15' }], 0, 'days');
  assert.equal(ph[0].days, 15);
  ph = L.planPhases([{ ...ph[0], start: '2026-12-01' }], 0, 'start');
  assert.equal(ph[0].finish, '2026-12-15');
  // a typed finish wins over the length
  ph = L.planPhases([{ key: 'p', start: '2026-11-01', finish: '2026-11-05' }], 0, 'finish');
  assert.equal(L.phaseDays(ph[0]), 5);
});

test('a new start keeps the typed finish (the length follows)', () => {
  const ph = L.planPhases([{ key: 'p', start: '2026-11-05', finish: '2026-11-10' }], 0, 'start');
  assert.equal(ph[0].finish, '2026-11-10');
  assert.equal(L.phaseDays(ph[0]), 6);
});

test('chained phases follow the previous one and keep their length', () => {
  const list = [
    { key: 'p', start: '2026-11-01', finish: '2026-11-30' },
    { key: 'expertise', start: '2026-12-10', finish: '2026-12-29', chain: true }, // 20 days
    { key: 'r', start: '', finish: '', days: 31, chain: true },
  ];
  const out = L.planPhases(list);
  assert.equal(out[1].start, '2026-12-01');
  assert.equal(out[1].finish, '2026-12-20');
  assert.equal(out[2].start, '2026-12-21');
  assert.equal(out[2].finish, '2027-01-20');
  // the first phase moves → everything after it moves
  const later = L.planPhases([{ ...out[0], finish: '2026-12-10' }, out[1], out[2]], 0, 'finish');
  assert.equal(later[1].start, '2026-12-11');
  assert.equal(later[2].start, '2026-12-31');
  // not chained: stays where it is
  const free = L.planPhases([out[0], { ...out[1], chain: false }]);
  assert.equal(free[1].start, '2026-12-01');
});

test('document validity: ГПЗУ 3 years, topography 2 years, ТУ by hand', () => {
  assert.equal(L.docUntil('gpzu', '2026-03-15'), '2029-03-14');
  assert.equal(L.docUntil('geodesy', '2026-03-15'), '2028-03-14');
  assert.equal(L.docUntil('tu', '2026-03-15'), '');
  assert.equal(L.docUntil('gpzu', ''), '');
  assert.equal(L.docKindOf('ГПЗУ № RU27-1'), 'gpzu');
  assert.equal(L.docKindOf('ТУ на водоснабжение и водоотведение'), 'tu');
  assert.equal(L.docKindOf('СТУ по пожарной безопасности'), 'stu');
  assert.equal(L.docKindOf('Инженерные изыскания'), 'other');
  assert.equal(L.docKindOf('Топосъёмка М 1:500'), 'geodesy');
});

// Backlog item 15: what a specialist (executor) may not see or change.
const A = require('../src/renderer/access.js');
test('specialist: no renaming, no contract numbers, customer money, budgets, foreign projects', () => {
  const users = [
    { id: 'g', name: 'ГИП', role: 'gip' },
    { id: 'c', name: 'Главспец', role: 'chief', directions: ['el'], canSeeBudget: true },
    { id: 's', name: 'Специалист', role: 'specialist', directions: ['el'], chiefId: 'c', canSeeBudget: true },
  ];
  const snap = {
    users,
    projects: [
      { id: 'p1', name: 'Мой', members: ['s'], contract: { no: '12/26' }, payments: [{ amount: 1 }], bills: [{}] },
      { id: 'p2', name: 'Чужой', members: ['c'] },
    ],
    tasks: [{ id: 't1', projectId: 'p1', ownerId: 's', sections: ['ЭОМ'], budget: 100000, contractNo: 'Д-1', payments: [{ amount: 5 }] }],
    contractors: [], chats: [],
  };
  const v = A.viewFor(users[2], snap);
  assert.deepEqual(v.projects.map(p => p.id), ['p1'], 'only projects he takes part in');
  assert.equal(v.projects[0].contract, undefined);
  assert.equal(v.projects[0].payments, undefined);
  assert.equal(v.tasks[0].budget, undefined);
  assert.equal(v.tasks[0].contractNo, undefined);
  assert.equal(v.tasks[0].payments, undefined);
  assert.match(A.checkWrite(users[2], 'projects', snap.projects[0], { ...snap.projects[0], name: 'Новое' }, users), /ведут ГИП и главспецы/);
});

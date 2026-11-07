'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/renderer/access.js');

const users = [
  { id: 'g', name: 'ГИП', role: 'gip' },
  { id: 'c1', name: 'Главспец ЭОМ', role: 'chief', directions: ['el', 'ss'], canSeeBudget: true },
  { id: 'c2', name: 'Главспец ВК', role: 'chief', directions: ['vk'] },
  { id: 's1', name: 'Спец ЭОМ', role: 'specialist', chiefId: 'c1' },
  { id: 's2', name: 'Спец ВК', role: 'specialist', chiefId: 'c2' },
];
const U = id => users.find(u => u.id === id);
const tasks = [
  { id: 't1', ownerId: 'c1', status: 'in_progress', budget: 100, payments: [{ amount: 10 }] },
  { id: 't2', ownerId: 's1', status: 'in_progress', budget: 50 },
  { id: 't3', ownerId: 's2', status: 'not_started', budget: 70 },
  { id: 't4', ownerId: 'g', status: 'not_started', budget: 30 },
  { id: 't5', status: 'not_started' }, // no owner yet
];
const snap = { users, tasks, projects: [{ id: 'p' }], contractors: [{ id: 'k', requisites: 'ИНН' }] };
const ids = list => list.map(t => t.id);

test('visibility follows the hierarchy', () => {
  assert.deepEqual(ids(A.viewFor(U('g'), snap).tasks), ['t1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(ids(A.viewFor(U('c1'), snap).tasks), ['t1', 't2']);
  assert.deepEqual(ids(A.viewFor(U('c2'), snap).tasks), ['t3']);
  assert.deepEqual(ids(A.viewFor(U('s1'), snap).tasks), ['t2']);
});

test('budget: GIP and chiefs with access see money; others get redacted cards', () => {
  assert.equal(A.viewFor(U('c1'), snap).tasks[0].budget, 100);
  const c2 = A.viewFor(U('c2'), snap).tasks[0];
  assert.equal(c2.budget, undefined);
  assert.equal(c2.moneyHidden, true);
  assert.equal(A.viewFor(U('s1'), snap).tasks[0].payments, undefined);
  assert.equal(A.canSeeMoney(U('s1')), false);
  assert.equal(A.canSeeMoney({ ...U('c2'), canSeeBudget: true }), true);
});

test('specialist sees only projects/contractors of own cards, without requisites', () => {
  const v = A.viewFor(U('s1'), { ...snap, tasks: [{ id: 'x', ownerId: 's1', projectId: 'p', contractorId: 'k' }] });
  assert.deepEqual(ids(v.projects), ['p']);
  assert.equal(v.contractors[0].requisites, undefined);
  assert.deepEqual(A.viewFor(U('s1'), snap).projects, []);
});

test('who can hand cards down to whom', () => {
  assert.deepEqual(ids(A.assignableOwners(U('g'), users)), ['g', 'c1', 'c2', 's1', 's2']);
  assert.deepEqual(ids(A.assignableOwners(U('c1'), users)), ['c1', 's1']);
  assert.deepEqual(ids(A.assignableOwners(U('s1'), users)), ['s1']);
});

test('write checks', () => {
  const t2 = tasks[1];
  // chief: own specialist ok, another chief's specialist not
  assert.equal(A.checkWrite(U('c1'), 'tasks', null, { ownerId: 's1' }, users), null);
  assert.match(A.checkWrite(U('c1'), 'tasks', null, { ownerId: 's2' }, users), /своим специалистам/);
  assert.match(A.checkWrite(U('c1'), 'tasks', t2, { ...t2, ownerId: 'c2' }, users), /своим специалистам/);
  assert.match(A.checkWrite(U('c2'), 'tasks', t2, { ...t2, status: 'done' }, users), /вне вашей зоны/);
  // chief without budget cannot touch money
  const t3 = tasks[2];
  assert.match(A.checkWrite(U('c2'), 'tasks', t3, { ...t3, budget: 1 }, users), /бюджету/);
  assert.equal(A.checkWrite(U('c2'), 'tasks', t3, { ...t3, finish: '2026-12-01' }, users), null);
  // specialist: status yes, dates no, create no, delete no
  assert.equal(A.checkWrite(U('s1'), 'tasks', t2, { ...t2, status: 'review', history: [1] }, users), null);
  assert.match(A.checkWrite(U('s1'), 'tasks', t2, { ...t2, finish: '2027-01-01' }, users), /только статус/);
  assert.match(A.checkWrite(U('s1'), 'tasks', null, { ownerId: 's1' }, users), /не создаёт/);
  assert.match(A.checkWrite(U('s1'), 'tasks', t2, null, users), /не удаляет/);
  // catalogs and team
  assert.equal(A.checkWrite(U('c1'), 'projects', null, { name: 'x' }, users), null);
  assert.match(A.checkWrite(U('s1'), 'contractors', null, { name: 'x' }, users), /ГИП и главспецы/);
  assert.match(A.checkWrite(U('c1'), 'users', null, { name: 'x' }, users), /только ГИП/);
  assert.equal(A.checkWrite(U('g'), 'users', null, { name: 'x' }, users), null);
});

test('titles', () => {
  assert.equal(A.titleFor(U('g')), 'Пульт ГИПа');
  assert.equal(A.titleFor(U('c1')), 'Пульт главспеца');
  assert.equal(A.titleFor(U('s1')), 'Пульт специалиста');
  assert.deepEqual(A.directionLabels(U('c1')), ['Электрика', 'Слаботочка']);
});

test('cards go only to people with the needed direction', () => {
  const users = [
    { id: 'g', role: 'gip', name: 'ГИП' },
    { id: 'c', role: 'chief', name: 'Ч', directions: ['vk', 'ov'] },
    { id: 's', role: 'specialist', name: 'Зайцев', directions: ['vk'], chiefId: 'c' },
  ];
  const A2 = require('../src/renderer/access.js');
  assert.deepEqual(A2.profileGaps(users[2], { sections: ['ВК', 'АР'] }), []);
  assert.equal(A2.profileGaps(users[2], { sections: ['ОВ2'] })[0].direction.id, 'ov');
  assert.equal(A2.profileGaps(users[0], { sections: ['ОВ'] }).length, 0);
  const t = { ownerId: 'c', sections: ['ОВ'] };
  assert.match(A2.checkWrite(users[1], 'tasks', t, { ...t, ownerId: 's' }, users), /Отопление/);
  assert.match(A2.checkWrite(users[0], 'tasks', null, { ownerId: 's', section: 'ИТП' }, users), /Зайцев/);
  assert.equal(A2.checkWrite(users[1], 'tasks', t, { ...t, ownerId: 's', sections: ['НВК'] }, users), null);
  assert.equal(A2.checkWrite(users[1], 'tasks', t, { ...t, status: 'in_progress' }, users), null);
});

test('co-owners see the card; confirmed misfits pass', () => {
  const users = [
    { id: 'c', role: 'chief', name: 'Ч', directions: ['el', 'ss'] },
    { id: 's', role: 'specialist', name: 'Орлов', directions: ['el'], chiefId: 'c' },
    { id: 's2', role: 'specialist', name: 'Сом', directions: ['ss'], chiefId: 'c' },
  ];
  const t = { ownerId: 'c', coOwnerIds: ['s2'], sections: ['СКС'] };
  assert.equal(A.canSeeTask(users[2], t, users), true);
  assert.equal(A.canSeeTask(users[1], t, users), false);
  const moved = { ...t, coOwnerIds: ['s'] };
  assert.match(A.checkWrite(users[0], 'tasks', t, moved, users), /не подходит по специальности.*Орлов делает: Электрика/);
  assert.equal(A.checkWrite(users[0], 'tasks', t, { ...moved, profileOk: true }, users), null);
  assert.deepEqual(A.contractorGaps({ specialty: 'ЭОМ, ЭС' }, { sections: ['ЭОМ1', 'СКС'] }), ['СКС']);
  assert.deepEqual(A.contractorGaps({ specialty: '' }, { sections: ['СКС'] }), []);
});

test('absences, inbox, activity, reviewers', () => {
  const users = [
    { id: 'g', role: 'gip', name: 'ГИП' },
    { id: 'c', role: 'chief', name: 'Ч', directions: ['el'] },
    { id: 's', role: 'specialist', name: 'Орлов', directions: ['el'], chiefId: 'c', absences: [{ kind: 'vacation', from: '2026-10-20', to: '2026-10-30' }] },
  ];
  const t = { ownerId: 's', start: '2026-10-01', finish: '2026-10-25', status: 'in_progress' };
  const hits = A.absenceHits(t, users);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].onFinish, true);
  assert.match(A.absenceText(hits[0]), /Орлов: отпуск 20\.10\.2026–30\.10\.2026/);
  assert.equal(A.absenceHits({ ...t, finish: '2026-10-15' }, users).length, 0);
  assert.equal(A.absenceHits({ ...t, status: 'done' }, users).length, 0);
  assert.equal(A.isUnread({ notify: { s: '2026-10-02T00:00' }, seen: { s: '2026-10-01T00:00' } }, 's'), true);
  assert.equal(A.isUnread({ notify: { s: '2026-10-02T00:00' }, seen: { s: '2026-10-03T00:00' } }, 's'), false);
  assert.equal(A.lastActivity({ createdAt: '2026-01-01', history: [{ ts: '2026-02-01' }], comments: [{ ts: '2026-03-01' }] }), '2026-03-01');
  assert.deepEqual(A.reviewersOf(t, users), ['c']);
  assert.deepEqual(A.reviewersOf({ ownerId: 'c' }, users), ['g']);
  // absences: the person, the chief and the GIP may edit; nobody else touches other fields
  const before = users[2];
  assert.equal(A.checkWrite(users[2], 'users', before, { ...before, absences: [] }, users, 's'), null);
  assert.equal(A.checkWrite(users[1], 'users', before, { ...before, absences: [] }, users, 's'), null);
  assert.match(A.checkWrite(users[2], 'users', before, { ...before, directions: ['el', 'ss'] }, users, 's'), /ГИП/);
});

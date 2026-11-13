'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/renderer/logic.js');
const A = require('../src/renderer/access.js');
const { customerHtml, customerStatus } = require('../src/report/customer.js');

const day = n => L.addDays('2026-10-01', n);
const st = (n, from, to) => ({ ts: day(n) + 'T10:00:00.000Z', date: day(n), type: 'status', from, to });

test('project statuses: the seven stages from the request', () => {
  assert.deepEqual(Object.values(L.PROJECT_STATUSES).map(s => s.label), [
    'Не начат', 'В работе, стадия П', 'Передан заказчику', 'На доработке', 'Экспертиза', 'В работе, стадия Р', 'Завершён',
  ]);
});

test('transitions: no jumping from «не начат» to «принят»', () => {
  const to = s => L.TRANSITIONS[s].map(x => x[0]);
  assert.deepEqual(to('not_started'), ['in_progress', 'paused']);
  assert.deepEqual(to('in_progress'), ['review', 'paused']);
  assert.deepEqual(to('review'), ['done', 'revision']);
  assert.ok(!to('not_started').includes('done'));
  for (const s of Object.keys(L.STATUSES)) assert.ok(L.TRANSITIONS[s], s);
});

test('first-time acceptance counts only accepted cards without remarks', () => {
  const clean = { status: 'done', history: [st(0, null, 'in_progress'), st(5, 'in_progress', 'review'), st(6, 'review', 'done')] };
  const rework = { status: 'done', history: [st(0, null, 'in_progress'), st(5, 'in_progress', 'review'), st(6, 'review', 'revision'), st(8, 'revision', 'review'), st(9, 'review', 'done')] };
  const open = { status: 'in_progress', history: [st(0, null, 'in_progress')] };
  assert.deepEqual(L.firstTime([clean, rework, open], day(20)), { done: 2, clean: 1, pct: 50 });
  assert.equal(L.firstTime([open], day(20)).pct, null);
});

test('project goal: every mark accepted; a mark in two cards needs both', () => {
  const g = L.projectGoal([{ sections: ['ЭОМ', 'ЭО'], status: 'done' }, { sections: ['СС'], status: 'review' }, { sections: ['ЭОМ'], status: 'in_progress' }]);
  assert.deepEqual(g, { total: 3, done: 1, pct: 33, complete: false });
  assert.equal(L.projectGoal([{ sections: ['ВК'], status: 'done' }]).complete, true);
  assert.equal(L.projectGoal([]).complete, false);
});

test('thanks are counted for the author, never self-thanks', () => {
  const tasks = [{ comments: [{ userId: 'a', thanks: ['b', 'c'] }, { userId: 'b', thanks: ['a'] }, { userId: 'a', thanks: ['a'] }] }];
  assert.equal(L.thanksFor(tasks, 'a'), 2);
  assert.equal(L.thanksFor(tasks, 'b'), 1);
  assert.equal(L.thanksFor(tasks, 'z'), 0);
});

test('mark kinds: water supply and sewerage are told apart', () => {
  const k = m => A.markKind(m);
  assert.equal(k('ЭОМ'), 'el');
  assert.equal(k('ЭО2'), 'el');
  assert.equal(k('СКУД'), 'ss');
  assert.equal(k('ВК'), 'water');
  assert.equal(k('В1'), 'water');
  assert.equal(k('К'), 'sewer');
  assert.equal(k('НК'), 'sewer');
  assert.equal(k('К2'), 'sewer');
  assert.equal(k('ОВ'), 'ov');
  assert.equal(k('АР'), 'ar'); assert.equal(k('ООС'), ''); assert.equal(k('ПОД'), 'pos'); assert.equal(k('АСКУЭ'), 'ss');
  assert.deepEqual(A.contractorKinds({ specialty: 'ВК, НК, ЭОМ' }), ['water', 'sewer', 'el']);
  assert.equal(A.userKind({ directions: ['vk', 'el'] }), 'water');
});

test('customer page: plan, requests, sections — no money, no contractors', () => {
  const project = { id: 'p', name: 'ЖК «Тест»', code: '01-26', client: 'ООО Заказчик', status: 'expertise',
    phases: [{ key: 'p', start: '2026-05-01', finish: '2026-09-18', done: '2026-09-18' }, { key: 'expertise', start: '2026-09-18', finish: '2026-11-27', done: '' }],
    milestones: [{ title: 'заключение', date: '2026-11-27' }], requests: [{ title: 'ТУ 630 кВт', due: '2026-11-07' }, { title: 'получено уже', done: true }],
    protocol: { no: '7', date: '2026-10-28', items: [{ text: 'Ворота', status: 'done' }] }, docs: [{ title: 'ГПЗУ', until: '2027-03-15' }] };
  const tasks = [
    { id: 't1', projectId: 'p', sections: ['СС'], status: 'revision', budget: 777000, contractorId: 'c', ownerId: 'u', finish: '2026-11-20', revisions: [{ no: '2', date: '2026-10-20' }] },
    { id: 't2', projectId: 'p', sections: ['ЭОМ'], status: 'done', budget: 555000, finish: '2026-10-10' },
  ];
  const html = customerHtml({ project, tasks, contact: { name: 'Сериков Сергей', phone: '+7 914 000', email: 'gip@example.ru' }, today: '2026-11-05' });
  assert.match(html, /ЖК «Тест»/);
  assert.match(html, /Сейчас: экспертиза/);
  assert.match(html, /по графику/);
  assert.match(html, /22<\/span>/);
  assert.match(html, /ТУ 630 кВт/);
  assert.doesNotMatch(html, /получено уже/);
  assert.match(html, /Протокол № 7/);
  assert.match(html, /ГПЗУ/);
  assert.match(html, /tel:\+7 914 000/);
  assert.doesNotMatch(html, /777|555|₽|Петров/);
  assert.doesNotMatch(html, /доработк/i, 'internal remarks are shown as «внутренняя проверка»');
  assert.equal(customerStatus({ status: 'revision' }, '2026-10-30').label, 'Внутренняя проверка');
  // behind schedule: the current phase finished in the past and is not done
  const late = customerHtml({ project: { ...project, phases: [{ key: 'expertise', start: '2026-09-01', finish: '2026-10-30', done: '' }] }, tasks, contact: null, today: '2026-11-05' });
  assert.match(late, /Отставание/);
});

test('phases: contract is hidden from non-GIPs and kept when they save', () => {
  const users = [{ id: 'g', role: 'gip' }, { id: 'c', role: 'chief', directions: ['el'] }];
  const snap = { users, tasks: [], contractors: [], projects: [{ id: 'p', phases: [{ key: 'contract', done: '2026-01-01' }, { key: 'p' }] }] };
  assert.equal(A.viewFor(users[1], snap).projects[0].phases.length, 1);
  assert.equal(A.viewFor(users[0], snap).projects[0].phases.length, 2);
  const merged = A.keepHiddenPhases(users[1], snap.projects[0], { phases: [{ key: 'p', start: '2026-02-01' }] });
  assert.deepEqual(merged.phases.map(p => p.key), ['contract', 'p']);
  assert.ok(A.projectDataError({ phases: [{ key: 'p', start: '01.02.2026' }] }));
  assert.equal(A.projectDataError({ phases: [{ key: 'p', start: '2026-02-01' }] }), null);
});

test('project now: current phase, behind, next milestone', () => {
  const n = L.projectNow({ phases: [{ key: 'r', start: '2026-10-01', finish: '2026-10-31', done: '' }], milestones: [{ title: 'РД', date: '2026-12-01' }] }, '2026-11-05');
  assert.equal(n.current.key, 'r');
  assert.equal(n.behind, 5);
  assert.equal(n.daysToNext, 26);
  assert.deepEqual(L.PHASES.map(p => p[1]), ['Договор', 'Изыскания', 'Сбор ИРД', 'Стадия П', 'Экспертиза', 'Стадия Р', 'Авторский надзор']);
});

test('composition by Decree 87: bases, codes, volumes, cleaning', () => {
  const K = require('../src/renderer/composition.js');
  const prod = K.fromBase('prod');
  assert.equal(prod.nodes.filter(n => n.kind === 'section').length, 13);
  assert.deepEqual(prod.nodes.filter(n => n.kind === 'sub').map(n => n.abbr), ['ИОС1', 'ИОС2', 'ИОС3', 'ИОС4', 'ИОС5', 'ИОС6']);
  assert.equal(K.fromBase('linear').nodes.length, 10);
  assert.equal(K.fromBase('nonprod').nodes.find(n => n.abbr === 'ТХ').on, false);
  const ios1 = prod.nodes.find(n => n.abbr === 'ИОС1');
  prod.nodes.push({ id: 'b1', parentId: ios1.id, kind: 'book', title: 'Книга 1', on: true, marks: [] }, { id: 'b2', parentId: ios1.id, kind: 'book', title: 'Книга 2', on: true, marks: ['ЭОМ'] });
  const vols = K.volumes(prod, '26.07.12');
  const v = Object.fromEntries(vols.map(x => [x.code, x]));
  assert.ok(v['26.07.12-ИОС1.1'] && v['26.07.12-ИОС1.2'] && !v['26.07.12-ИОС1'], 'books replace their subsection as volumes');
  assert.equal(v['26.07.12-ИОС1.2'].tom, '5.1.2');
  assert.equal(v['26.07.12-ИОС1.2'].name, 'Раздел 5. Сведения об инженерном оборудовании, о сетях и системах инженерно-технического обеспечения. Подраздел 1. Система электроснабжения. Книга 2. Книга 2');
  assert.ok(!v['26.07.12-ИОС6'] && !v['26.07.12-СМ'], 'switched-off sections are not volumes');
  ios1.code = 'СВОЙ-1';
  assert.ok(!K.volumes(prod, '26.07.12').some(x => x.code === 'СВОЙ-1'), 'a subsection with books is not a volume itself');
  assert.equal(K.clean({ nodes: [{ id: 'x', parentId: 'nope', kind: 'book' }] }).ok, false);
  assert.equal(K.clean({ nodes: [{ id: 'x', kind: 'hack' }] }).ok, false);
  assert.equal(K.clean(prod).ok, true);
});

test('participants: a specialist member sees the project; the list is validated', () => {
  const users = [{ id: 'g', role: 'gip' }, { id: 's', role: 'specialist', chiefId: 'c' }, { id: 'c', role: 'chief' }];
  const snap = { users, tasks: [], contractors: [], projects: [{ id: 'p1', members: ['s'] }, { id: 'p2' }] };
  assert.deepEqual(A.viewFor(users[1], snap).projects.map(p => p.id), ['p1']);
  assert.equal(A.projectDataError({ members: ['s'] }), null);
  assert.ok(A.projectDataError({ members: [{}] }));
});

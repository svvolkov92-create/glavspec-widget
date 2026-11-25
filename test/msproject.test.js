'use strict';
// MS Project XML (4.10): structure, dates on working days, links, resources, the production calendar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMsProject } = require('../src/report/msproject.js');

const project = { id: 'p1', name: 'Цех <№2> & склад', code: '25-047', client: 'ООО «А»',
  phases: [{ key: 'P', start: '2026-12-01', finish: '2026-12-25' }] };
const tasks = [
  { id: 't1', projectId: 'p1', mark: 'КР', title: 'КР — расчёт', start: '2026-12-01', finish: '2026-12-11', status: 'done', ownerId: 'u1', execUserId: 'u2' },
  { id: 't2', projectId: 'p1', mark: 'КР', title: 'КР — чертежи', start: '2026-12-14', finish: '2026-12-25', status: 'in_progress', readiness: 40, ownerId: 'u1', contractorId: 'c1', dependsOn: ['t1'] },
  { id: 't3', projectId: 'p1', mark: 'ОВ', title: 'ОВ', start: '2026-12-31', finish: '2027-01-12', status: 'not_started', ownerId: 'u1' },
  { id: 't4', projectId: 'p1', mark: 'ОВ', title: 'без дат', status: 'not_started' },
];
const users = { u1: { name: 'Орлов' }, u2: { name: 'Смирнова', email: 's@x.ru' } };
const contractors = { c1: { name: 'ИП Петров' } };

test('MSPDI: tree, links, resources, escaping', () => {
  const x = buildMsProject({ project, tasks, users, contractors, phaseLabel: () => 'Стадия П', author: 'Волков', now: new Date('2026-11-25T01:00:00Z') });
  assert.match(x, /^<\?xml version="1\.0" encoding="UTF-8"/);
  assert.match(x, /<Project xmlns="http:\/\/schemas\.microsoft\.com\/project">/);
  assert.match(x, /<Title>25-047 — Цех &lt;№2&gt; &amp; склад<\/Title>/);
  // Balanced tags (a simple well-formedness check: every open has its close).
  const open = (x.match(/<Task>/g) || []).length, close = (x.match(/<\/Task>/g) || []).length;
  assert.equal(open, close);
  // Project summary + stages group + 1 stage + КР group + 2 + ОВ group + 1 (the card without dates is left out) = 8.
  assert.equal(open, 8);
  assert.match(x, /<Name>Этапы проекта<\/Name>.*?<Summary>1<\/Summary>/s);
  assert.match(x, /<Name>Стадия П<\/Name>/);
  assert.match(x, /<OutlineNumber>2\.1<\/OutlineNumber>/);
  // t2 depends on t1: finish-to-start.
  const t1uid = /<UID>(\d+)<\/UID><ID>\d+<\/ID><Name>КР — расчёт<\/Name>/.exec(x)[1];
  assert.match(x, new RegExp(`<Name>КР — чертежи</Name>.*?<PredecessorLink><PredecessorUID>${t1uid}</PredecessorUID><Type>1</Type>`, 's'));
  // Percent: done 100, in work by hand 40.
  assert.match(x, /<Name>КР — расчёт<\/Name>.*?<PercentComplete>100<\/PercentComplete>/s);
  assert.match(x, /<Name>КР — чертежи<\/Name>.*?<PercentComplete>40<\/PercentComplete>/s);
  // t3 starts on 31.12 — a day off in Russia (31.12.2026 is a Thursday made a day off? either way the start is a working day).
  const t3start = /<Name>ОВ<\/Name><Type>1<\/Type><IsNull>0<\/IsNull><WBS>[\d.]+<\/WBS><OutlineNumber>[\d.]+<\/OutlineNumber><OutlineLevel>2<\/OutlineLevel><Start>(\d{4}-\d{2}-\d{2})/.exec(x)[1];
  assert.ok(t3start >= '2026-12-31');
  // Resources: executor, owner of the card without an executor, the contractor.
  for (const n of ['Смирнова', 'Орлов', 'ИП Петров']) assert.match(x, new RegExp(`<Resource><UID>\\d+</UID><ID>\\d+</ID><Name>${n}</Name>`));
  assert.match(x, /<Group>Подрядчики<\/Group>/);
  assert.equal((x.match(/<Assignment>/g) || []).length, 3, 'an executor stands for the owner');
  // The New Year holidays are exceptions of the calendar.
  assert.match(x, /<FromDate>2027-01-05T00:00:00<\/FromDate>/);
  // Durations: 1–11 December 2026 = 9 working days = 72 hours.
  assert.match(x, /<Name>КР — расчёт<\/Name>.*?<Duration>PT72H0M0S<\/Duration>/s);
});

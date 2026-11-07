'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { buildReport } = require('../src/report/model.js');
const { buildXlsx, colName } = require('../src/report/xlsx.js');
const { buildDocx } = require('../src/report/docx.js');
const { crc32 } = require('../src/report/zip.js');

const TODAY = '2026-10-12';
const snapshot = {
  projects: [
    { id: 'p1', name: 'ЖК «Северный», корп. 2', code: '0425-24', client: 'ООО <Девелопмент> & Ко' },
    { id: 'p2', name: 'Склад', code: '', client: '' },
  ],
  contractors: [
    { id: 'c1', name: 'Петров А.С.', phone: '+7 900 000-00-01', email: 'p@example.com' },
    { id: 'c2', name: 'Сидорова Е.В.' },
  ],
  tasks: [
    { id: 't1', projectId: 'p1', section: 'ЭОМ', title: 'стадия Р', contractorId: 'c1', start: '2026-09-01', finish: '2026-10-07', status: 'in_progress', budget: 180000, payments: [{ id: 'a', date: '2026-09-01', amount: 54000.1, note: 'Аванс' }] },
    { id: 't2', projectId: 'p1', sections: ['СС', 'СКС', 'СКУД'], contractorId: 'c2', start: '2026-09-10', finish: '2026-10-15', status: 'in_progress', budget: 95000, payments: [] },
    { id: 't3', projectId: 'p2', section: 'АПС', contractorId: 'c1', finish: '2026-10-01', status: 'review', budget: 70000, payments: [{ id: 'b', date: '2026-09-20', amount: 80000 }] },
    { id: 't4', projectId: 'gone', section: 'СОТ', status: 'not_started', budget: 0 },
  ],
};

// Reads entries of our own (deflate-only) ZIP output.
function unzip(buf) {
  const files = {};
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28), crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 20), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const localNameLen = buf.readUInt16LE(off + 26);
    const data = zlib.inflateRawSync(buf.subarray(off + 30 + localNameLen, off + 30 + localNameLen + size));
    assert.equal(crc32(data), crc, `crc of ${name}`);
    files[name] = data.toString('utf8');
    p += 46 + nameLen;
  }
  return files;
}

test('report model: effective statuses, orphans, attention lists', () => {
  const rep = buildReport(snapshot, TODAY);
  const t1 = rep.rows.find(r => r.id === 't1');
  assert.equal(t1.statusLabel, 'Срок сорван');
  assert.equal(t1.overdueDays, 5);
  assert.equal(rep.rows.find(r => r.id === 't3').statusLabel, 'На проверке');
  assert.equal(rep.rows.find(r => r.id === 't2').section, 'СС, СКС, СКУД');
  assert.equal(t1.section, 'ЭОМ'); // legacy single-mark card
  assert.deepEqual(rep.attention.overdue.map(r => r.id), ['t1']);
  assert.deepEqual(rep.attention.week.map(r => r.id), ['t2']);
  assert.deepEqual(rep.attention.review.map(r => r.id), ['t3']);
  assert.equal(rep.projects.at(-1).name, 'Без проекта');
  assert.equal(rep.payments.length, 2);
  assert.equal(rep.totals.rest, 210999.9);
});

test('column names', () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52].map(colName), ['A', 'Z', 'AA', 'AB', 'AZ', 'BA']);
});

test('xlsx package: parts, escaping, formulas and dates', () => {
  const files = unzip(buildXlsx(buildReport(snapshot, TODAY), new Date(2026, 9, 12, 18, 30)));
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet4.xml']) assert.ok(files[part], part);
  const tasks = files['xl/worksheets/sheet2.xml'];
  assert.match(tasks, /<f>O2-P2<\/f>/);
  assert.match(tasks, /SUBTOTAL\(9,O2:O5\)/);
  assert.match(tasks, /<v>46302<\/v>/); // 2026-10-07 as an Excel serial date
  assert.match(files['xl/worksheets/sheet1.xml'], /ООО &lt;Девелопмент&gt; &amp; Ко/);
  assert.match(files['xl/workbook.xml'], /'Карточки'!\$A\$1:\$U\$5/);
});

test('docx package: parts, tables and footer fields', () => {
  const files = unzip(buildDocx(buildReport(snapshot, TODAY), new Date(2026, 9, 12, 18, 30)));
  const doc = files['word/document.xml'];
  assert.ok(files['word/footer1.xml'].includes('NUMPAGES'));
  assert.match(doc, /w:orient="landscape"/);
  assert.match(doc, /Срок сорван \(1\)/);
  assert.match(doc, /ООО &lt;Девелопмент&gt; &amp; Ко/);
  assert.ok((doc.match(/<w:tbl>/g) || []).length >= 5);
});

test('empty data still produces valid packages', () => {
  const rep = buildReport({ projects: [], contractors: [], tasks: [] }, TODAY);
  assert.ok(unzip(buildXlsx(rep))['xl/worksheets/sheet2.xml'].includes('Карточек нет'));
  assert.ok(unzip(buildDocx(rep))['word/document.xml'].includes('Проектов нет.'));
});

test('reports without budget access contain no money', () => {
  const rep = { ...buildReport(snapshot, TODAY), money: false };
  const x = unzip(buildXlsx(rep));
  assert.equal(x['xl/worksheets/sheet4.xml'], undefined, 'no payments sheet');
  const sheets = Object.keys(x).filter(n => n.startsWith('xl/worksheets/')).map(n => x[n].toString('utf8')).join('');
  for (const word of ['Бюджет', 'Оплачено', 'Остаток', 'Пора платить', 'Договор', '180000']) assert.ok(!sheets.includes(word), word);
  assert.ok(sheets.includes('Петров А.С.'));
  const d = unzip(buildDocx(rep))['word/document.xml'].toString('utf8');
  for (const word of ['Бюджет', 'Оплачено', 'остаток', 'Пора платить', '180 000']) assert.ok(!d.includes(word), word);
  assert.ok(d.includes('ЭОМ'));
});

test('employee report: delivered on time vs late, active work', () => {
  const { employeeSection } = require('../src/report/model.js');
  const u = { id: 's', role: 'specialist', name: 'Орлов', directions: ['el'] };
  const tasks = [
    { id: 'a', projectId: 'p1', sections: ['ЭОМ'], ownerId: 's', finish: '2026-10-05', status: 'done',
      history: [{ type: 'status', to: 'in_progress', date: '2026-09-01' }, { type: 'status', to: 'review', date: '2026-10-04' }, { type: 'status', from: 'review', to: 'done', date: '2026-10-06' }] },
    { id: 'b', projectId: 'p1', sections: ['ЭО'], ownerId: 'c', coOwnerIds: ['s'], finish: '2026-10-01', status: 'review',
      history: [{ type: 'status', to: 'review', date: '2026-10-03' }] },
    { id: 'c', projectId: 'p1', sections: ['ЭН'], ownerId: 's', finish: '2026-10-10', status: 'in_progress', history: [] },
  ];
  const e = employeeSection(u, tasks, '2026-10-12', 'month', new Map([['p1', { name: 'Склад' }]]));
  assert.equal(e.summary.delivered, 2);
  assert.equal(e.summary.onTime, 1);
  assert.equal(e.delivered.find(d => d.section === 'ЭО').late, 2);
  assert.equal(e.delivered.find(d => d.section === 'ЭО').role, 'соисполнитель');
  assert.equal(e.summary.overdueNow, 1);
  const rep = buildReport({ ...snapshot, users: [u], tasks: tasks.map(t => ({ ...t })) , projects: [{ id: 'p1', name: 'Склад' }] }, '2026-10-12', { type: 'user', id: 's', period: 'month' });
  assert.equal(rep.employee.name, 'Орлов');
  const d = unzip(buildDocx(rep))['word/document.xml'].toString('utf8');
  assert.ok(d.includes('Отчёт по сотруднику: Орлов') && d.includes('опоздание 2 дн.'));
  assert.ok(unzip(buildXlsx(rep))['xl/worksheets/sheet1.xml'].toString('utf8').includes('Отчёт по сотруднику'));
});

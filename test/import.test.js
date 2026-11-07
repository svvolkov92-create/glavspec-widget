'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const I = require('../src/renderer/importer.js');
const { readXlsx, readCsv, readTable, ImportError } = require('../src/import/read.js');
const { buildReport } = require('../src/report/model.js');
const { buildXlsx } = require('../src/report/xlsx.js');

const TODAY = '2026-10-13';

test('header detection finds the header row and maps Russian column names', () => {
  const rows = [
    ['Реестр проектов', '', ''],
    [],
    ['Объект', 'Шифр', 'Марка', 'Подрядчик', 'Тел.', 'Начало', 'Срок сдачи', 'Статус', 'Стоимость, руб', 'Оплачено', 'Комментарий'],
    ['ЖК Северный', '0425', 'ЭОМ, ЭС', 'Петров', '+7 900', '01.09.2026', '15.10.2026', 'в работе', '150 000', '45000', ''],
  ];
  const d = I.detect(rows);
  assert.equal(d.headerRow, 2);
  assert.equal(d.mapping.project, 0);
  assert.equal(d.mapping.marks, 2);
  assert.equal(d.mapping.contractor, 3);
  assert.equal(d.mapping.phone, 4);
  assert.equal(d.mapping.finish, 6);
  assert.equal(d.mapping.budget, 8);
  assert.equal(d.mapping.paid, 9);
});

test('build: fill-down of merged project cells, dedupe, existing records, payments', () => {
  const rows = [
    ['Объект', 'Марки', 'Исполнитель', 'Старт', 'Финиш', 'Статус', 'Бюджет', 'Оплачено'],
    ['ЖК Северный', 'ЭОМ; ЭО', 'Петров', 46266, '2026-10-20', 'На проверке', 100000, 30000],
    ['', 'СС/СКС', 'сидорова', '10.09.26', '01.10.2026', 'принят', '50 000 руб.', ''],
    ['Склад', '', 'Петров', '', '', '', '', ''],
    ['Склад', 'АПС', 'Петров', '', '31.02.2026', 'замечания', 'abc', ''],
    ['Итого', '', '', '', '', '', 150000, 30000],
  ];
  const d = I.detect(rows);
  const r = I.build(rows, d.headerRow, d.mapping, {
    projects: [{ id: 'p-old', name: 'жк  северный' }],
    contractors: [{ id: 'c-old', name: 'Сидорова' }],
    today: TODAY,
  });
  assert.equal(r.error, null);
  assert.equal(r.tasks.length, 3);
  assert.deepEqual(r.skipped, [{ row: 4, reason: 'не указаны разделы (марки)' }]);
  assert.deepEqual(r.projects.map(p => p.name), ['Склад']);
  assert.deepEqual(r.contractors.map(c => [c.name, c.specialty]), [['Петров', 'ЭОМ, ЭО, АПС']]);
  const [a, b, c] = r.tasks;
  assert.equal(a.projectId, 'p-old');
  assert.deepEqual(a.sections, ['ЭОМ', 'ЭО']);
  assert.equal(a.start, '2026-09-01'); // Excel serial 46266
  assert.equal(a.status, 'review');
  assert.deepEqual(a.payments.map(p => [p.amount, p.date]), [[30000, '2026-09-01']]);
  assert.equal(b.projectId, 'p-old'); // filled down
  assert.equal(b.contractorId, 'c-old'); // matched case-insensitively
  assert.equal(b.start, '2026-09-10');
  assert.equal(b.status, 'done');
  assert.equal(b.budget, 50000);
  assert.equal(c.finish, ''); // 31 February is not a date
  assert.equal(c.status, 'revision');
  assert.equal(c.budget, 0);
});

test('build reports missing required columns', () => {
  const r = I.build([['a', 'b']], 0, { project: 0, marks: -1 }, {});
  assert.match(r.error, /марки/);
});

test('status words', () => {
  const cases = { 'В работе': 'in_progress', 'на доработке': 'revision', 'Сдан, принят': 'done', 'на экспертизе': 'review', '': 'not_started', 'Приостановлен': 'paused', 'Срок сорван': 'in_progress' };
  for (const [s, want] of Object.entries(cases)) assert.equal(I.parseStatus(s), want, s);
});

test('xlsx reader reads back our own export (strings, dates, numbers)', () => {
  const snap = {
    projects: [{ id: 'p1', name: 'ЖК «Северный» & Ко', code: '0425' }],
    contractors: [{ id: 'c1', name: 'Петров А.С.', phone: '+7 900' }],
    tasks: [{ id: 't1', projectId: 'p1', sections: ['ЭОМ', 'ЭС'], contractorId: 'c1', start: '2026-09-01', finish: '2026-10-20', status: 'in_progress', budget: 123456.5, payments: [{ amount: 1000 }] }],
  };
  const sheets = readXlsx(buildXlsx(buildReport(snap, TODAY)));
  assert.deepEqual(sheets.map(s => s.name), ['Сводка', 'Карточки', 'Исполнители', 'Платежи']);
  const cards = sheets[1].rows;
  assert.equal(cards[0][0], 'Проект');
  assert.equal(cards[1][0], 'ЖК «Северный» & Ко');
  assert.equal(cards[1][2], 'ЭОМ, ЭС');
  assert.equal(cards[1][7], '2026-09-01');
  assert.equal(cards[1][14], 123456.5);
  // and the importer understands it
  const d = I.detect(cards);
  const r = I.build(cards, d.headerRow, d.mapping, { today: TODAY });
  assert.equal(r.tasks.length, 1);
  assert.deepEqual(r.tasks[0].sections, ['ЭОМ', 'ЭС']);
  assert.equal(r.tasks[0].finish, '2026-10-20');
  assert.equal(r.tasks[0].budget, 123456.5);
  assert.equal(r.tasks[0].payments[0].amount, 1000);
});

test('csv: Windows-1251 with semicolons and quoted fields', () => {
  const text = 'Объект;Марки;Бюджет\r\n"ЖК ""Северный""";"ЭОМ; ЭС";150000\r\nСклад;АПС;1\r\n';
  const cp1251 = Buffer.from(new TextEncoder().encode(text)); // placeholder, replaced below
  const encoded = encode1251(text);
  const [sheet] = readCsv(encoded);
  assert.deepEqual(sheet.rows[0], ['Объект', 'Марки', 'Бюджет']);
  assert.deepEqual(sheet.rows[1], ['ЖК "Северный"', 'ЭОМ; ЭС', '150000']);
  assert.equal(sheet.rows.length, 3);
  assert.ok(cp1251.length > encoded.length); // UTF-8 is longer than cp1251 for Cyrillic
  const [utf] = readCsv(Buffer.from('﻿A,B\n1,2\n'));
  assert.deepEqual(utf.rows, [['A', 'B'], ['1', '2']]);
});

test('readTable rejects legacy .xls with a clear message', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'imp-')), 'old.xls');
  fs.writeFileSync(f, 'x');
  assert.throws(() => readTable(f), e => e instanceof ImportError && /xlsx/.test(e.message));
});

function encode1251(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c >= 0x410 && c <= 0x44f) out.push(c - 0x410 + 0xc0);
    else if (c === 0x401) out.push(0xa8);
    else if (c === 0x451) out.push(0xb8);
    else out.push(0x3f);
  }
  return Buffer.from(out);
}

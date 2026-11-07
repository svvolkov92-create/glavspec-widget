'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../src/renderer/composition.js');
const T = require('../src/report/doc-template.js');
const { readZipRaw } = T;

test('working documentation: suggestions by sections of the project documentation', () => {
  const c = K.fromBase('prod');
  const marks = c.rd.map(x => x.mark);
  for (const m of ['ГП', 'АР', 'КЖ', 'ЭОМ', 'ЭС', 'ВК', 'НВ', 'ВПВ', 'НК', 'ОВ', 'СС', 'ПС']) assert.ok(marks.includes(m), m);
  assert.equal(new Set(marks).size, marks.length, 'each mark once (ВК is suggested for ИОС2 and ИОС3)');
  assert.ok(!marks.includes('ГСН'), 'ИОС6 is off by default — no gas marks');
  const ios1 = c.nodes.find(n => n.abbr === 'ИОС1');
  assert.ok(c.rd.filter(x => x.pdId === ios1.id).map(x => x.mark).join() === 'ЭОМ,ЭС,ЭН');
  const g = K.rdGroups(c).find(x => x.node.abbr === 'ИОС2');
  assert.ok(g.items.some(i => i.mark === 'АУПТ' && !i.on), 'АУПТ is offered, not switched on');
  assert.equal(K.markBase('КЖ1.1'), 'КЖ');
  const rows = K.rdRows(c, '04-12-23-2');
  assert.equal(rows[0].tom, '1');
  assert.equal(rows[0].code, '04-12-23-2-ГП');
  c.rd[1].tom = '2а'; c.rd[2].on = false;
  const r2 = K.rdRows(c, '04-12-23-2');
  assert.equal(r2[1].tom, '2а');
  assert.equal(r2.length, rows.length - 1);
});

test('«Состав ПД» rows match the office example', () => {
  const c = K.fromBase('nonprod');
  const sp = K.spRows(c, '04-12-23-2');
  const s5 = sp.find(r => r.label === 'Раздел 5');
  assert.equal(s5.vol, false);
  assert.equal(s5.tom, '');
  assert.deepEqual(sp.filter(r => r.kind === 'sub').map(r => `${r.tom} ${r.code}`), ['5.1 04-12-23-2-ИОС1', '5.2 04-12-23-2-ИОС2', '5.3 04-12-23-2-ИОС3', '5.4 04-12-23-2-ИОС4', '5.5 04-12-23-2-ИОС5']);
  assert.ok(!sp.some(r => r.title === 'Технологические решения'), 'ТХ off for a non-production object');
  assert.equal(sp.at(-1).label, 'Раздел 11');
});

test('clean keeps the working documentation and drops broken links', () => {
  const c = K.fromBase('prod');
  c.rd.push({ id: 'x', pdId: 'nope', mark: 'КЖ1.1', title: 'Захватка 1' });
  const r = K.clean(c);
  assert.equal(r.ok, true);
  const x = r.value.rd.find(i => i.id === 'x');
  assert.equal(x.pdId, '');
  assert.equal(x.mark, 'КЖ1.1');
  assert.equal(K.clean({ nodes: [], rd: [{ mark: 'X' }] }).ok, false);
  assert.equal(K.clean({ nodes: [], rd: Array.from({ length: 301 }, (_, i) => ({ id: 'r' + i })) }).ok, false);
});

function fill(kind, rows) {
  const t = T.templateFile(kind);
  return readZipRaw(T.fillTemplate(fs.readFileSync(t.file), {
    prefix: '07-01-26-', object: '«Школа <№1> & сад»', customer: 'ООО «Тест»', year: '2027',
    names: { gip: 'Петров П.П.', gipShort: 'Петров', developer: 'Иванов' }, from: t.names, stage: kind === 'vok' ? 'Р' : 'П', fromStage: t.stage, rows,
  }));
}
const text = (entries, name) => entries.find(e => e.name === name).data.toString('utf8');

test('Word from the office template: properties, names, rows, stage', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ tom: String(i + 1), code: `07-01-26-КЖ${i + 1}`, title: `Захватка ${i + 1}`, note: i % 2 ? 'Выдано' : '' }));
  const e = fill('vok', rows);
  const doc = text(e, 'word/document.xml');
  assert.equal((doc.match(/<w:tr[ >]/g) || []).length - 2 * 1 - 4, 40 + 2, 'header + own line + 40 rows in the main table (+4 rows of the cover table, +2 signature tables)');
  assert.match(doc, /Захватка 40/);
  assert.doesNotMatch(doc, /04-12-23-2-|Санитарн|АСК2|Сериков|Волков/, 'nothing of the sample project left');
  assert.match(doc, /Школа &lt;№1&gt; &amp; сад/, 'XML-escaped');
  assert.match(doc, /Петров П\.П\./);
  assert.match(text(e, 'docProps/core.xml'), /<cp:keywords>07-01-26-<\/cp:keywords>/);
  assert.match(e.find(x => /customXml\/item\d\.xml/.test(x.name) && x.data.includes('CompanyFax')).data.toString(), /2027г\./);
  const footers = e.filter(x => /word\/footer\d\.xml/.test(x.name)).map(x => x.data.toString()).join('');
  assert.match(footers, />Р<\/w:t>/, 'stage Р in the stamp of the ВОК');
  assert.match(footers, />Иванов</);
  assert.ok(e.some(x => x.name === 'word/media/image1.png' && x.data.length > 1000), 'pictures kept');
  const sp = fill('sp', [{ tom: '', code: '', label: 'Раздел 5', title: 'Сведения…', heading: true }, { tom: '5.1', code: '07-01-26-ИОС1', label: 'Подраздел 1', title: 'Система электроснабжения' }]);
  const spDoc = text(sp, 'word/document.xml');
  assert.match(spDoc, /<w:b\/><\/w:rPr><w:t xml:space="preserve">Подраздел 1<\/w:t>/, 'label in bold');
  assert.match(spDoc, /«Система электроснабжения»/);
  assert.match(spDoc, /keywords\[1\][\s\S]*?07-01-26-<\/w:t>[\s\S]*?ИОС1/, 'cipher prefix kept as the bound field');
});

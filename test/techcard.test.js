'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/renderer/techcard.js');

test('pairs: ИОС* expanded only to present subsections, no self-pairs, repeats joined', () => {
  const p = T.pairs(['АР', 'КР', 'ИОС1', 'ИОС4', 'ПЗУ']);
  const keys = p.map(x => `${x.from}>${x.to}`);
  assert.ok(keys.includes('АР>КР') && keys.includes('ИОС4>ИОС1') && keys.includes('ИОС1>ПЗУ'));
  assert.ok(!keys.some(k => /ИОС2|ИОС3|ТХ/.test(k)));
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.ok(!p.some(x => x.from === x.to));
  const kr = p.find(x => x.from === 'КР' && x.to === 'ИОС4');
  assert.ok(kr && !kr.forward, 'КР and ИОС4 are both wave 2');
  assert.ok(p.find(x => x.from === 'АР' && x.to === 'КР').forward);
  assert.ok(/;/.test(p.find(x => x.from === 'ИОС1' && x.to === 'ПЗУ').what), 'two rows for one pair are joined');
});

test('waveDates and assignDue stay inside the stage; forward due before the recipient wave', () => {
  assert.strictEqual(T.waveDates(1, '', '2026-02-01'), null);
  assert.strictEqual(T.waveDates(1, '2026-03-01', '2026-02-01'), null);
  const w1 = T.waveDates(1, '2026-01-01', '2026-04-30'), w4 = T.waveDates(4, '2026-01-01', '2026-04-30');
  assert.strictEqual(w1.start, '2026-01-01');
  assert.strictEqual(w4.finish, '2026-04-30');
  const w2 = T.waveDates(2, '2026-01-01', '2026-04-30');
  const due = T.assignDue(1, 2, '2026-01-01', '2026-04-30');
  assert.ok(due.finish < w2.start, `${due.finish} < ${w2.start}`);
  const back = T.assignDue(2, 1, '2026-01-01', '2026-04-30');
  assert.ok(back.start === w2.start && back.finish <= w2.finish);
  const short = T.assignDue(1, 2, '2026-01-01', '2026-01-03'); // a tiny stage still gives sane dates
  assert.ok(short.finish >= short.start);
});

test('every section of Decree 87 has a wave', () => {
  const C = require('../src/renderer/composition.js');
  const keys = new Set(Object.values(C.BASES).filter(b => b !== C.BASES.linear).flatMap(b => b.sections.flatMap(s => (s[4] ? s[4].map(x => x[0]) : [s[1]]))));
  const missing = [...keys].filter(k => !T.WAVES[k]);
  assert.deepStrictEqual(missing, []);
});

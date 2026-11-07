'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const C = require('../src/renderer/calendar.js');
const L = require('../src/renderer/logic.js');
const M = require('../src/renderer/messages.js');
const { contactUrl, phoneDigits, telegramUser } = require('../src/contact.js');
const { Store, StoreError } = require('../src/store.js');

test('production calendar: 247 working days in 2025–2027 per the decrees', () => {
  for (const y of [2025, 2026, 2027]) {
    assert.equal(C.workdaysInYear(y), 247, String(y));
    assert.ok(C.isOfficialYear(y));
  }
});

test('production calendar: transfers and working Saturdays', () => {
  assert.equal(C.isWorkday('2025-11-01'), true);  // working Saturday
  assert.equal(C.isWorkday('2025-11-03'), false); // its day off
  assert.equal(C.isWorkday('2026-01-09'), false); // from 03.01
  assert.equal(C.isWorkday('2026-03-09'), false); // 08.03 on Sunday
  assert.equal(C.isWorkday('2026-05-11'), false); // 09.05 on Saturday
  assert.equal(C.isWorkday('2027-02-20'), true);  // working Saturday
  assert.equal(C.isWorkday('2027-02-22'), false);
  assert.equal(C.isWorkday('2027-06-14'), false); // 12.06 on Saturday
  assert.equal(C.dayInfo('2026-03-08').holiday, 'Международный женский день');
  assert.equal(C.dayInfo('2026-03-09').transfer, true);
});

test('production calendar: years without a decree follow art. 112', () => {
  assert.equal(C.isOfficialYear(2028), false);
  // 2028: 23.02 Wed, 08.03 Wed, 01.05 Mon, 09.05 Tue, 12.06 Mon, 04.11 Sat → moves to Mon 06.11
  assert.equal(C.isWorkday('2028-11-06'), false);
  assert.equal(C.isWorkday('2028-11-07'), true);
});

test('working days between dates', () => {
  assert.equal(C.workdaysBetween('2026-10-13', '2026-10-19'), 4); // Wed..Mon
  assert.equal(C.workdaysBetween('2026-12-30', '2027-01-11'), 1);  // the whole New Year break is off
  assert.equal(C.workdaysBetween('2026-10-19', '2026-10-13'), -4);
  assert.equal(C.workdaysBetween('2026-10-13', '2026-10-13'), 0);
});

test('timing text shows working days left', () => {
  const t = L.timing({ status: 'in_progress', finish: '2026-10-19' }, '2026-10-13');
  assert.equal(t.text, 'осталось 4 раб. дн.');
  assert.equal(t.diff, 6);
  assert.equal(t.workdays, 4);
});

test('dependencies: issues and cycle detection', () => {
  const T = '2026-10-13';
  const eom = { id: 'a', sections: ['ЭОМ'], status: 'in_progress', start: '2026-09-01', finish: '2026-10-05' };      // overdue
  const ss = { id: 'b', sections: ['СС'], status: 'not_started', start: '2026-10-20', finish: '2026-11-20', dependsOn: ['a'] };
  const aps = { id: 'c', sections: ['АПС'], status: 'not_started', start: '2026-10-25', finish: '2026-11-30', dependsOn: ['d'] };
  const sot = { id: 'd', sections: ['СОТ'], status: 'in_progress', start: '2026-10-01', finish: '2026-11-01' };       // ends after АПС starts
  const done = { id: 'e', sections: ['ЭС'], status: 'done', dependsOn: ['a'] };
  const byId = new Map([eom, ss, aps, sot, done].map(t => [t.id, t]));
  assert.deepEqual(L.dependencyIssues(ss, byId, T).map(i => i.kind), ['overdue']);
  assert.deepEqual(L.dependencyIssues(aps, byId, T).map(i => i.kind), ['overlap']);
  assert.deepEqual(L.dependencyIssues(done, byId, T), []);
  assert.deepEqual(L.attention([eom, ss, aps, sot], T).blocked.map(t => t.id), ['b', 'c']);
  assert.equal(L.wouldCycle('a', 'b', byId), true);  // b already waits for a
  assert.equal(L.wouldCycle('b', 'd', byId), false);
});

test('messages: greeting, templates and suggestion', () => {
  assert.equal(M.greeting('Петров Алексей Сергеевич'), 'Алексей Сергеевич, добрый день!');
  assert.equal(M.greeting('Пример: Петров А.С.'), 'Добрый день!');
  assert.equal(M.greeting('ИП Кузнецов'), 'Добрый день!');
  const task = { id: 't', sections: ['АПС', 'СОУЭ'], status: 'revision', start: '2026-09-01', finish: '2026-10-20', budget: 100000,
    history: [{ ts: '2026-10-10T00:00:00Z', date: '2026-10-10', type: 'status', from: 'review', to: 'revision', note: 'нет расчёта АКБ' }] };
  const ctx = { task, project: { name: 'ЖК Северный', code: '0425' }, contractor: { name: 'Кузнецов Иван Петрович' }, signature: 'Иванов И.И.', today: '2026-10-13' };
  assert.equal(M.suggest(task, '2026-10-13'), 'remarks');
  const r = M.build('remarks', ctx);
  assert.match(r.subject, /Замечания: АПС, СОУЭ/);
  assert.match(r.text, /^Иван Петрович, добрый день!/);
  assert.match(r.text, /нет расчёта АКБ/);
  assert.match(r.text, /Иванов И\.И\.$/);
  assert.match(M.build('remind', ctx).text, /осталось 5 раб\. дн\./);
  for (const { id } of M.TEMPLATES) assert.ok(M.build(id, ctx).text.length > 40, id);
});

test('contact links are built only from stored contacts', () => {
  assert.equal(phoneDigits('8 (900) 123-45-67'), '79001234567');
  assert.equal(phoneDigits('900 123 45 67'), '79001234567');
  assert.equal(phoneDigits('12'), '');
  assert.equal(telegramUser('Telegram @petrov_eom'), 'petrov_eom');
  assert.equal(telegramUser('https://t.me/sidorova_ss'), 'sidorova_ss');
  const c = { email: 'p@example.com', phone: '+7 900 123-45-67', messenger: 'Telegram @petrov_eom' };
  assert.equal(contactUrl(c, 'mail', { subject: 'Срок', text: 'a\nb' }), 'mailto:p@example.com?subject=%D0%A1%D1%80%D0%BE%D0%BA&body=a%0D%0Ab');
  assert.equal(contactUrl(c, 'whatsapp', { text: 'привет' }), 'https://wa.me/79001234567?text=%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82');
  assert.equal(contactUrl(c, 'telegram'), 'https://t.me/petrov_eom');
  assert.equal(contactUrl({ phone: '+7 900 123-45-67' }, 'telegram'), 'https://t.me/+79001234567');
  assert.equal(contactUrl({ email: 'bad?x@y.ru' }, 'mail'), null);
  assert.equal(contactUrl({}, 'whatsapp'), null);
  assert.equal(contactUrl(c, 'sms'), null);
});

test('store.replaceAll restores a backup, skipping invalid ids', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const s = new Store(dir);
  s.apply({ type: 'set', col: 'projects', id: 'old', data: { name: 'Старый' } });
  const n = s.replaceAll({ projects: { p1: { name: 'Новый', id: 'evil' } }, tasks: { 't1': { status: 'done' }, '../x': { status: 'done' } } });
  assert.equal(n, 2);
  assert.deepEqual(new Store(dir).snapshot().projects, [{ id: 'p1', name: 'Новый' }]);
  assert.throws(() => s.replaceAll([1, 2]), StoreError);
  assert.throws(() => s.replaceAll({ tasks: 'x' }), StoreError);
});

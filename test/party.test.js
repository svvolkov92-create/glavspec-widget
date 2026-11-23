'use strict';
// Requisites by INN from DaData (src/core/party.js): the request, reading the answer, errors, the key.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/core/party.js');

const LEGAL = { suggestions: [{ value: 'ПАО СБЕРБАНК', unrestricted_value: 'ПАО СБЕРБАНК', data: {
  type: 'LEGAL', inn: '7707083893', kpp: '773601001', ogrn: '1027700132195',
  name: { full_with_opf: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «СБЕРБАНК РОССИИ»', short_with_opf: 'ПАО СБЕРБАНК' },
  management: { name: 'Греф Герман Оскарович', post: 'ПРЕЗИДЕНТ, ПРЕДСЕДАТЕЛЬ ПРАВЛЕНИЯ' },
  address: { value: 'г Москва, ул Вавилова, д 19', unrestricted_value: '117312, г Москва, ул Вавилова, д 19' },
  state: { status: 'ACTIVE', liquidation_date: null } } }] };
const PERSON = { suggestions: [{ value: 'ИП Иванов Иван Иванович', data: {
  type: 'INDIVIDUAL', inn: '500100732259', kpp: null, ogrn: '304500116000157',
  name: { full_with_opf: 'Индивидуальный предприниматель Иванов Иван Иванович', short_with_opf: 'ИП Иванов Иван Иванович' },
  address: { value: 'Московская обл, г Коломна' }, state: { status: 'LIQUIDATED', liquidation_date: 1700000000000 } } }] };

test('the request: the head office by INN, the key in Authorization', () => {
  const r = P.request('7707083893', 'abc');
  assert.equal(r.method, 'POST');
  assert.equal(r.url, 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party');
  assert.equal(r.headers.Authorization, 'Token abc');
  assert.deepEqual(JSON.parse(r.body), { query: '7707083893', branch_type: 'MAIN', count: 1 });
});

test('the answer: a company and an ИП', () => {
  assert.deepEqual(P.fromDadata(LEGAL), {
    inn: '7707083893', name: 'ПАО СБЕРБАНК', fullName: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «СБЕРБАНК РОССИИ»', kpp: '773601001', ogrn: '1027700132195',
    address: '117312, г Москва, ул Вавилова, д 19', director: 'ПРЕЗИДЕНТ, ПРЕДСЕДАТЕЛЬ ПРАВЛЕНИЯ Греф Герман Оскарович', status: '', liquidated: '' });
  const ip = P.fromDadata(PERSON);
  assert.equal(ip.kpp, '');
  assert.equal(ip.director, '');
  assert.equal(ip.status, 'ликвидирована');
  assert.equal(ip.liquidated, '2023-11-14');
  assert.equal(P.fromDadata({ suggestions: [] }), null);
  assert.equal(P.fromDadata(null), null);
});

test('find: no key, wrong INN, HTTP errors, a found company; the key', async () => {
  let key = '', asked = 0;
  const answers = [];
  const party = P.createParty({ http: async req => { asked++; return answers.shift(); }, key: { get: async () => key, set: async k => { key = k; } } });
  assert.equal((await party.find('7707083893')).needKey, true);
  assert.equal((await party.setKey('кириллица')).ok, false);
  assert.deepEqual(await party.setKey('0123456789abcdef0123456789abcdef01234567'), { ok: true, has: true });
  assert.deepEqual(await party.keyInfo(), { ok: true, has: true });
  assert.match((await party.find('123')).message, /10 цифр/);
  assert.equal(asked, 0);
  answers.push({ status: 403, body: '' }, { status: 429, body: '' }, { status: 200, body: 'not json' }, { status: 200, body: '{"suggestions":[]}' }, { status: 200, body: JSON.stringify(LEGAL) });
  assert.match((await party.find('7707083893')).message, /ключ/);
  assert.match((await party.find('7707083893')).message, /лимит/);
  assert.match((await party.find('7707083893')).message, /непонятно/);
  assert.match((await party.find('7707083893')).message, /не найден/);
  const ok = await party.find('7707083893');
  assert.equal(ok.ok, true);
  assert.equal(ok.party.kpp, '773601001');
  const off = P.createParty({ http: async () => { throw new Error('timeout'); }, key: { get: async () => 'k', set: async () => {} } });
  assert.match((await off.find('7707083893')).message, /Нет связи.*timeout/);
  assert.deepEqual(await party.setKey(''), { ok: true, has: false });
});

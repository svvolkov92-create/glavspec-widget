// Company requisites by INN from DaData (ЕГРЮЛ / ЕГРИП): «Заполнить по ИНН» and «Сверить с ЕГРЮЛ» (4.9.1–4.9.2).
// Runs on the Сервер Пульта (one key for the team, kept on the server): pure request building and answer reading
// (tested); the key store and the HTTP are given by the server.
// API: POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party, «Authorization: Token <key>».
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Party = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';
const STATUS = { ACTIVE: '', LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизуется' };

function request(inn, key) {
  return {
    method: 'POST', url: URL,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Token ' + key },
    // The head office (not a branch with its own KPP).
    body: JSON.stringify({ query: String(inn), branch_type: 'MAIN', count: 1 }),
  };
}

const str = v => (typeof v === 'string' ? v.trim() : '');
const dateOf = ms => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : '');

// DaData's answer → the fields of our card; null when nothing was found.
function fromDadata(json) {
  const s = Array.isArray(json?.suggestions) ? json.suggestions[0] : null;
  const d = s?.data;
  if (!d) return null;
  const n = d.name || {}, m = d.management || {}, st = d.state || {};
  const person = d.type === 'INDIVIDUAL';
  return {
    inn: str(d.inn),
    name: str(n.short_with_opf) || str(s.value),
    fullName: str(n.full_with_opf) || str(s.unrestricted_value) || str(s.value),
    kpp: person ? '' : str(d.kpp),
    ogrn: str(d.ogrn),
    address: str(d.address?.unrestricted_value) || str(d.address?.value),
    director: person ? '' : [str(m.post), str(m.name)].filter(Boolean).join(' '),
    status: STATUS[st.status] ?? '',
    liquidated: dateOf(st.liquidation_date),
  };
}

// The message for an unsuccessful answer (the text is shown to the user as it is).
function errorOf(status) {
  if (status === 401 || status === 403) return 'DaData не приняла ключ. ГИП: проверьте ключ API в окне «Сервер Пульта» → «Реквизиты по ИНН».';
  if (status === 429) return 'Исчерпан дневной лимит запросов DaData. Попробуйте завтра.';
  if (status === 402) return 'DaData: на счёте закончились средства (платный тариф).';
  return `DaData ответила ошибкой ${status}. Попробуйте позже.`;
}

/**
 * http(req) → { status, body } (a string); key: { get() → '', set(k) → Promise }.
 * find(inn) → { ok: true, party } | { ok: false, message, needKey? }.
 */
function createParty({ http, key }) {
  async function find(inn) {
    const k = await key.get();
    if (!k) return { ok: false, needKey: true, fatal: true, message: 'Ключ DaData на Сервере Пульта не введён. ГИП вводит его в окне «Сервер Пульта» → «Реквизиты по ИНН».' };
    if (!/^\d{10}$|^\d{12}$/.test(String(inn))) return { ok: false, message: 'ИНН — 10 цифр у организации или 12 у ИП.' };
    let r;
    try { r = await http(request(inn, k)); } catch (e) { return { ok: false, fatal: true, message: `Нет связи с DaData: ${e?.message || e}` }; }
    // A wrong key, the day's limit, no money: the next INNs would get the same — the caller stops (fatal).
    if (r.status !== 200) return { ok: false, fatal: [401, 402, 403, 429].includes(r.status), message: errorOf(r.status) };
    let json;
    try { json = JSON.parse(r.body); } catch { return { ok: false, message: 'DaData ответила непонятно — попробуйте позже.' }; }
    const party = fromDadata(json);
    return party ? { ok: true, party } : { ok: false, message: `В ЕГРЮЛ и ЕГРИП не найден ИНН ${inn}.` };
  }
  // Several INNs (the check of the whole catalogue): a few at a time; after a fatal answer the rest get the same.
  async function findMany(inns, { parallel = 3 } = {}) {
    const list = [...new Set((inns || []).map(String))], out = new Array(list.length);
    let next = 0, stop = null;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = stop ? { ok: false, message: stop } : await find(list[i]);
        if (out[i].fatal) stop = stop || out[i].message;
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, list.length) }, worker));
    return list.map((inn, i) => ({ inn, ...(stop && !out[i].ok ? { ok: false, message: stop } : out[i]) }));
  }
  return {
    find, findMany,
    keyInfo: async () => ({ ok: true, has: !!(await key.get()) }),
    setKey: async k => {
      const v = String(k || '').trim();
      if (v && !/^[A-Za-z0-9]{20,80}$/.test(v)) return { ok: false, message: 'Ключ API — латинские буквы и цифры (40 знаков из личного кабинета DaData).' };
      await key.set(v);
      return { ok: true, has: !!v };
    },
  };
}

return { URL, request, fromDadata, errorOf, createParty };
});

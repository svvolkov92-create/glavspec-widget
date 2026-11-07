// Russian production calendar: working days, holidays and day-off transfers.
// Official years come from government decrees; other years follow the Labour Code (art. 112) rules,
// which cannot predict the January transfers the government decides each year.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkCalendar = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOLIDAYS = {
    '01-01': 'Новогодние каникулы', '01-02': 'Новогодние каникулы', '01-03': 'Новогодние каникулы', '01-04': 'Новогодние каникулы',
    '01-05': 'Новогодние каникулы', '01-06': 'Новогодние каникулы', '01-07': 'Рождество Христово', '01-08': 'Новогодние каникулы',
    '02-23': 'День защитника Отечества', '03-08': 'Международный женский день', '05-01': 'Праздник Весны и Труда',
    '05-09': 'День Победы', '06-12': 'День России', '11-04': 'День народного единства',
  };

  // Weekday days off (holidays on weekdays + transferred days) and working weekend days, per decree.
  const OFFICIAL = {
    // Постановление Правительства РФ от 04.10.2024 № 1335
    2025: {
      off: ['01-01', '01-02', '01-03', '01-06', '01-07', '01-08', '05-01', '05-02', '05-08', '05-09', '06-12', '06-13', '11-03', '11-04', '12-31'],
      work: ['11-01'],
      source: 'постановление Правительства РФ от 04.10.2024 № 1335',
    },
    // Постановление Правительства РФ от 24.09.2025 № 1466
    2026: {
      off: ['01-01', '01-02', '01-05', '01-06', '01-07', '01-08', '01-09', '02-23', '03-09', '05-01', '05-11', '06-12', '11-04', '12-31'],
      work: [],
      source: 'постановление Правительства РФ от 24.09.2025 № 1466',
    },
    // Постановление Правительства РФ от 17.09.2026 № 1187
    2027: {
      off: ['01-01', '01-04', '01-05', '01-06', '01-07', '01-08', '02-22', '02-23', '03-08', '05-03', '05-10', '06-14', '11-04', '11-05', '12-31'],
      work: ['02-20'],
      source: 'постановление Правительства РФ от 17.09.2026 № 1187',
    },
  };

  const pad = n => String(n).padStart(2, '0');
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = dt => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  const weekend = dt => dt.getUTCDay() === 0 || dt.getUTCDay() === 6;

  // Years without a decree: weekday holidays are off; a non-January holiday on a weekend moves
  // to the next working day (art. 112 of the Labour Code).
  const ruleCache = new Map();
  function ruleYear(y) {
    if (ruleCache.has(y)) return ruleCache.get(y);
    const off = new Set();
    for (const md of Object.keys(HOLIDAYS)) {
      const dt = parse(`${y}-${md}`);
      if (!weekend(dt)) { off.add(md); continue; }
      if (md.startsWith('01-')) continue;
      const next = new Date(dt);
      do next.setUTCDate(next.getUTCDate() + 1);
      while (weekend(next) || HOLIDAYS[fmt(next).slice(5)] !== undefined || off.has(fmt(next).slice(5)));
      off.add(fmt(next).slice(5));
    }
    const res = { off: [...off], work: [], source: null };
    ruleCache.set(y, res);
    return res;
  }

  const yearSets = new Map();
  function yearData(y) {
    if (!yearSets.has(y)) {
      const src = OFFICIAL[y] || ruleYear(y);
      yearSets.set(y, { off: new Set(src.off), work: new Set(src.work), source: src.source });
    }
    return yearSets.get(y);
  }

  function dayInfo(iso) {
    const dt = parse(iso);
    const y = dt.getUTCFullYear(), md = iso.slice(5);
    const yd = yearData(y);
    const holiday = HOLIDAYS[md] || null;
    if (yd.work.has(md)) return { off: false, holiday: null, workingWeekend: true, transfer: false };
    if (yd.off.has(md)) return { off: true, holiday, workingWeekend: false, transfer: !holiday };
    return { off: weekend(dt) || !!holiday, holiday, workingWeekend: false, transfer: false };
  }
  const isWorkday = iso => !dayInfo(iso).off;

  // Running count of working days, so that workdaysBetween is two lookups instead of a loop over days.
  // cumYear(y)[i] — working days among the first i days of year y; base(y) — working days in BASE_YEAR…y-1.
  const BASE_YEAR = 1990;
  const cumCache = new Map(), baseCache = new Map();
  function cumYear(y) {
    let c = cumCache.get(y);
    if (c) return c;
    const out = [0];
    for (const d = parse(`${y}-01-01`); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) out.push(out[out.length - 1] + (isWorkday(fmt(d)) ? 1 : 0));
    cumCache.set(y, out);
    return out;
  }
  function base(y) {
    if (y <= BASE_YEAR) return 0;
    if (!baseCache.has(y)) {
      let from = y - 1;
      while (from > BASE_YEAR && !baseCache.has(from)) from--;
      let acc = from <= BASE_YEAR ? 0 : baseCache.get(from);
      for (let k = Math.max(from, BASE_YEAR); k < y; k++) { const c = cumYear(k); acc += c[c.length - 1]; baseCache.set(k + 1, acc); }
    }
    return baseCache.get(y);
  }
  // Working days from BASE_YEAR-01-01 through `iso` inclusive.
  function runningCount(iso) {
    const dt = parse(iso), y = dt.getUTCFullYear();
    const doy = Math.round((dt - Date.UTC(y, 0, 1)) / 864e5) + 1;
    return base(y) + cumYear(y)[doy];
  }

  // Working days after `from` up to and including `to`; negative when `to` is earlier.
  function workdaysBetween(from, to) {
    if (from === to) return 0;
    if (from.slice(0, 4) > String(BASE_YEAR) && to.slice(0, 4) > String(BASE_YEAR) && from.length === 10 && to.length === 10) return runningCount(to) - runningCount(from);
    const sign = to > from ? 1 : -1;
    const a = parse(sign > 0 ? from : to), b = parse(sign > 0 ? to : from);
    let n = 0;
    for (const d = new Date(a); ;) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d > b) break;
      if (isWorkday(fmt(d))) n++;
    }
    return n * sign;
  }

  function workdaysInYear(y) {
    let n = 0;
    for (const d = parse(`${y}-01-01`); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) if (isWorkday(fmt(d))) n++;
    return n;
  }

  const isOfficialYear = y => !!OFFICIAL[y];
  const sourceOf = y => OFFICIAL[y]?.source || null;
  const transferLabel = 'Перенесённый выходной';

  return { dayInfo, isWorkday, workdaysBetween, workdaysInYear, isOfficialYear, sourceOf, transferLabel };
});

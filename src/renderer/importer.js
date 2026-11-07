// Table import: detects columns in a spreadsheet and turns rows into projects, contractors and cards.
// Pure: no DOM, no Electron; used by the UI and by the tests.
(function (root, factory) {
  const logic = typeof module === 'object' && module.exports ? require('./logic.js') : root.Logic;
  const api = factory(logic);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Importer = api;
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  const FIELDS = [
    { key: 'project', label: 'Проект / объект', required: true, syn: ['проект', 'объект', 'наименование объекта', 'название объекта', 'объект строительства', 'название проекта'] },
    { key: 'code', label: 'Шифр', syn: ['шифр', 'шифр проекта', 'код проекта'] },
    { key: 'client', label: 'Заказчик / ГИП', syn: ['заказчик', 'заказчик гип', 'гип'] },
    { key: 'marks', label: 'Разделы (марки)', required: true, syn: ['разделы марки', 'разделы', 'раздел', 'марки', 'марка', 'марка раздела', 'марки разделов'] },
    { key: 'title', label: 'Уточнение', syn: ['уточнение', 'этап', 'стадия', 'описание', 'состав работ'] },
    { key: 'contractor', label: 'Подрядчик', syn: ['исполнитель', 'подрядчик', 'субподрядчик', 'проектировщик', 'фио', 'фио исполнителя'] },
    { key: 'phone', label: 'Телефон подрядчика', syn: ['телефон', 'тел', 'телефон исполнителя', 'контактный телефон'] },
    { key: 'email', label: 'Почта подрядчика', syn: ['почта', 'email', 'e mail', 'эл почта', 'электронная почта'] },
    { key: 'start', label: 'Старт', syn: ['старт', 'начало', 'дата начала', 'старт работ', 'начало работ'] },
    { key: 'finish', label: 'Плановый финиш', syn: ['плановый финиш', 'финиш', 'срок', 'срок сдачи', 'окончание', 'дата окончания', 'дедлайн', 'план финиш', 'срок выполнения'] },
    { key: 'status', label: 'Статус', syn: ['статус', 'состояние'] },
    { key: 'budget', label: 'Бюджет', syn: ['бюджет', 'стоимость', 'сумма договора', 'стоимость работ', 'цена', 'сумма'] },
    { key: 'paid', label: 'Оплачено', syn: ['оплачено', 'выплачено', 'оплата', 'оплачено всего'] },
    { key: 'note', label: 'Примечание', syn: ['примечание', 'комментарий', 'заметки', 'примечания'] },
  ];

  const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  const nameKey = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

  function mapHeader(row) {
    const cells = row.map(norm);
    const mapping = {}, used = new Set();
    // Exact names first, then "contains" for the fields still unmapped.
    for (const pass of ['exact', 'contains']) {
      for (const f of FIELDS) {
        if (mapping[f.key] !== undefined) continue;
        for (const syn of f.syn) {
          const i = cells.findIndex((c, idx) => !used.has(idx) && c && (pass === 'exact' ? c === syn : syn.length >= 4 && c.includes(syn)));
          if (i >= 0) { mapping[f.key] = i; used.add(i); break; }
        }
      }
    }
    return mapping;
  }

  function detect(rows, forcedHeader) {
    const candidates = forcedHeader !== undefined ? [forcedHeader] : Array.from({ length: Math.min(15, rows.length) }, (_, i) => i);
    let best = { headerRow: candidates[0] ?? 0, mapping: {}, score: -1 };
    for (const i of candidates) {
      const mapping = mapHeader(rows[i] || []);
      const score = Object.keys(mapping).length + (mapping.project !== undefined ? 2 : 0) + (mapping.marks !== undefined ? 2 : 0);
      if (score > best.score) best = { headerRow: i, mapping, score };
    }
    const full = {};
    for (const f of FIELDS) full[f.key] = best.mapping[f.key] ?? -1;
    return { headerRow: best.headerRow, mapping: full, score: best.score };
  }

  const EXCEL_EPOCH = '1899-12-30';
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return v > 20000 && v < 80000 ? L.addDays(EXCEL_EPOCH, Math.floor(v)) : '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
    if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
    return '';
  }
  function valid(y, mo, d) {
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return L.todayStr(dt);
  }

  function parseAmount(v) {
    if (typeof v === 'number') return v >= 0 ? Math.round(v * 100) / 100 : 0;
    const s = String(v ?? '').replace(/руб\.?|р\.|₽|rub/gi, '');
    const n = L.parseMoney(s);
    return Number.isNaN(n) ? 0 : n;
  }

  function parseStatus(v) {
    const s = norm(v);
    if (!s) return 'not_started';
    if (/доработ|замечан|исправл/.test(s)) return 'revision';
    if (/провер|согласован|экспертиз/.test(s)) return 'review';
    if (/приостан|пауз|заморож/.test(s)) return 'paused';
    if (/принят|выполн|готов|заверш|сдан|закрыт/.test(s)) return 'done';
    if (/не начат|не начата|ожидан|план/.test(s)) return 'not_started';
    if (/работ|начат|процесс|сорван|просроч/.test(s)) return 'in_progress';
    return 'not_started';
  }

  let seq = 0;
  const newId = () => 'im' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

  function build(rows, headerRow, mapping, { projects = [], contractors = [], today = L.todayStr() } = {}) {
    const result = { projects: [], contractors: [], tasks: [], skipped: [], error: null };
    const projById = new Map(projects.map(p => [p.id, p]));
    const conById = new Map(contractors.map(c => [c.id, c]));
    result.projectName = id => projById.get(id)?.name || '';
    result.contractorName = id => conById.get(id)?.name || '';
    if (!(mapping.project >= 0) || !(mapping.marks >= 0)) {
      result.error = 'Укажите, в каком столбце проект и в каком разделы (марки).';
      return result;
    }
    const projByName = new Map(projects.filter(p => !p.deletedAt).map(p => [nameKey(p.name), p]));
    const conByName = new Map(contractors.filter(c => !c.deletedAt).map(c => [nameKey(c.name), c]));
    const newSpecs = new Map(); // new contractor id -> marks they get in this import
    const cell = (row, key) => (mapping[key] >= 0 ? row[mapping[key]] : '');
    const text = (row, key) => String(cell(row, key) ?? '').trim();

    let lastProject = '', lastCode = '', lastClient = '';
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const rowNo = r + 1;
      if (!row.some(v => v !== '' && v !== null && v !== undefined)) continue;
      let projectName = text(row, 'project');
      if (/^итог/i.test(projectName) || /^итог/i.test(text(row, 'marks'))) continue;
      // Merged cells in Excel leave the project only on the first row of a group.
      if (projectName) { lastProject = projectName; lastCode = text(row, 'code'); lastClient = text(row, 'client'); }
      else projectName = lastProject;
      if (!projectName) { result.skipped.push({ row: rowNo, reason: 'не указан проект' }); continue; }
      const marks = L.normalizeMarks(String(cell(row, 'marks') ?? '').split(/[,;\n/+]+/));
      if (!marks.length) { result.skipped.push({ row: rowNo, reason: 'не указаны разделы (марки)' }); continue; }

      let project = projByName.get(nameKey(projectName));
      if (!project) {
        project = { id: newId(), name: projectName.slice(0, 160), code: (text(row, 'code') || lastCode).slice(0, 40), client: (text(row, 'client') || lastClient).slice(0, 160), note: '' };
        projByName.set(nameKey(projectName), project);
        projById.set(project.id, project);
        result.projects.push(project);
      }

      let contractorId = '';
      const cName = text(row, 'contractor');
      if (cName) {
        let c = conByName.get(nameKey(cName));
        if (!c) {
          c = { id: newId(), name: cName.slice(0, 160), specialty: '', phone: text(row, 'phone').slice(0, 40), email: text(row, 'email').slice(0, 120), messenger: '', note: '' };
          conByName.set(nameKey(cName), c);
          conById.set(c.id, c);
          result.contractors.push(c);
          newSpecs.set(c.id, []);
        }
        if (newSpecs.has(c.id)) newSpecs.get(c.id).push(...marks);
        contractorId = c.id;
      }

      const start = parseDate(cell(row, 'start'));
      let finish = parseDate(cell(row, 'finish'));
      if (start && finish && finish < start) finish = '';
      const budget = parseAmount(cell(row, 'budget'));
      const paid = parseAmount(cell(row, 'paid'));
      result.tasks.push({
        id: newId(), projectId: project.id, sections: marks, section: marks.join(', '), title: text(row, 'title').slice(0, 120),
        contractorId, start, finish, status: parseStatus(cell(row, 'status')), budget, note: text(row, 'note').slice(0, 2000),
        payments: paid > 0 ? [{ id: newId(), date: start || today, amount: paid, note: 'Оплачено до импорта' }] : [],
      });
    }
    for (const c of result.contractors) c.specialty = L.normalizeMarks(newSpecs.get(c.id) || []).join(', ');
    return result;
  }

  return { FIELDS, detect, build, parseDate, parseAmount, parseStatus };
});

// Pure domain logic shared by the UI and the tests (no DOM, no Electron).
(function (root, factory) {
  const cal = typeof module === 'object' && module.exports ? require('./calendar.js') : root.WorkCalendar;
  const api = factory(cal);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== 'undefined' ? self : this, function (Cal) {
  'use strict';

  const STATUSES = {
    not_started: { label: 'Не начат', tone: 'idle' },
    in_progress: { label: 'В работе', tone: 'work' },
    review: { label: 'На проверке', tone: 'review' },
    revision: { label: 'На доработке', tone: 'warn' },
    paused: { label: 'Приостановлен', tone: 'idle' },
    done: { label: 'Принят', tone: 'ok' },
  };
  // Statuses in which the contractor still owes the work: only these can miss the deadline.
  const ACTIVE = new Set(['not_started', 'in_progress', 'revision', 'paused']);

  // Project stages (set by hand on the project, independent of its cards).
  const PROJECT_STATUSES = {
    not_started: { label: 'Не начат', tone: 'idle' },
    p_work: { label: 'В работе, стадия П', tone: 'work' },
    handed: { label: 'Передан заказчику', tone: 'review' },
    revision: { label: 'На доработке', tone: 'warn' },
    expertise: { label: 'Экспертиза', tone: 'review' },
    r_work: { label: 'В работе, стадия Р', tone: 'work' },
    done: { label: 'Завершён', tone: 'ok' },
  };
  // Project plan for the customer page: fixed list of phases. «Договор» is seen only by GIPs inside the program.
  const PHASES = [['contract', 'Договор'], ['survey', 'Изыскания'], ['ird', 'Сбор ИРД'], ['p', 'Стадия П'], ['expertise', 'Экспертиза'], ['r', 'Стадия Р'], ['an', 'Авторский надзор']];
  const phaseLabel = k => (PHASES.find(x => x[0] === k) || [k, k])[1];
  const defaultPhases = () => PHASES.map(([key]) => ({ key, start: '', finish: '', done: '' }));
  // Phase state on a date: done, late (finish passed, not done), now, next.
  function phaseState(ph, today) {
    if (isDate(ph.done)) return 'done';
    if (isDate(ph.finish) && ph.finish < today) return 'late';
    if (isDate(ph.start) && ph.start <= today) return 'now';
    return 'next';
  }
  // Where the project is: current phase, how far behind, the next dated milestone.
  function projectNow(p, today) {
    const phases = (p?.phases || []).filter(ph => isDate(ph.start) || isDate(ph.finish));
    const states = phases.map(ph => ({ ...ph, state: phaseState(ph, today), label: phaseLabel(ph.key) }));
    const current = states.find(x => x.state === 'now' || x.state === 'late') || states.find(x => x.state === 'next') || null;
    const behind = states.filter(x => x.state === 'late').reduce((m, x) => Math.max(m, dayNum(today) - dayNum(x.finish)), 0);
    const ms = (p?.milestones || []).filter(m => isDate(m.date) && !m.done && m.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
      || (current && isDate(current.finish) && current.finish >= today ? { title: `окончание: ${current.label.toLowerCase()}`, date: current.finish } : null);
    return { phases: states, current, behind, next: ms, daysToNext: ms ? dayNum(ms.date) - dayNum(today) : null, planned: states.length > 0 };
  }

  // Allowed status changes: statuses change only by these actions (buttons, the status cell, the kanban).
  const TRANSITIONS = {
    not_started: [['in_progress', 'Начать работу'], ['paused', 'Приостановить']],
    in_progress: [['review', 'Сдал на проверку'], ['paused', 'Приостановить']],
    revision: [['review', 'Сдал на проверку'], ['paused', 'Приостановить']],
    review: [['done', 'Принять работу'], ['revision', 'Выдать замечания']],
    paused: [['in_progress', 'Возобновить']],
    done: [['in_progress', 'Вернуть в работу']],
  };

  // Standard drawing sets (марки) offered as checkboxes; anything else goes into the free-text field.
  const MARK_GROUPS = [
    { title: 'Электрика', marks: [
      ['ЭОМ', 'Электрооборудование и электроосвещение'], ['ЭС', 'Электроснабжение'], ['ЭМ', 'Силовое электрооборудование'],
      ['ЭО', 'Электроосвещение'], ['ЭН', 'Наружное освещение'], ['КЭ', 'Кабельные линии'], ['АСКУЭ', 'Учёт электроэнергии'],
    ] },
    { title: 'Слаботочка', marks: [
      ['СС', 'Сети связи'], ['СКС', 'Структурированная кабельная система'], ['АПС', 'Пожарная сигнализация'],
      ['СОУЭ', 'Оповещение и управление эвакуацией'], ['СОТ', 'Охранное телевидение'], ['СКУД', 'Контроль доступа'],
      ['ОС', 'Охранная сигнализация'], ['ДС', 'Диспетчеризация'],
    ] },
    { title: 'Водоснабжение и канализация', marks: [
      ['ВК', 'Водоснабжение и канализация'], ['НВК', 'Наружные сети ВК'], ['АУПТ', 'Автоматическое пожаротушение'],
    ] },
    { title: 'Отопление и вентиляция', marks: [
      ['ОВ', 'Отопление и вентиляция'], ['ТС', 'Тепловые сети'], ['ИТП', 'Индивидуальный тепловой пункт'], ['ТМ', 'Тепломеханические решения'],
    ] },
  ];
  const MARK_ORDER = new Map(MARK_GROUPS.flatMap(g => g.marks.map(m => m[0])).map((m, i) => [m, i]));

  // Deduplicates, uppercases and orders marks: catalogue order first, custom marks after in the given order.
  function normalizeMarks(list) {
    const seen = new Set(), out = [];
    for (const raw of list) {
      const m = String(raw ?? '').trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 20);
      if (m && !seen.has(m)) { seen.add(m); out.push(m); }
    }
    const rank = m => (MARK_ORDER.has(m) ? MARK_ORDER.get(m) : 1000);
    return out.map((m, i) => [m, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
  }
  // "ЭОМ1, АИИС КУЭ; ОВ" → ['ЭОМ1', 'АИИС КУЭ', 'ОВ']
  const splitMarks = s => String(s ?? '').split(/[,;\n]+/);

  // Cards created before multi-mark support store a single `section` string.
  function sectionsOf(t) {
    if (Array.isArray(t.sections) && t.sections.length) return t.sections;
    return t.section ? normalizeMarks(splitMarks(t.section)) : [];
  }

  const pad = n => String(n).padStart(2, '0');
  function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function dayNum(s) { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); }
  function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return todayStr(new Date(y, m - 1, d + n)); }
  function fmtDate(s) { if (!isDate(s)) return '—'; const [y, m, d] = s.split('-'); return `${d}.${m}.${y.slice(2)}`; }

  function parseMoney(v) {
    const s = String(v ?? '').replace(/[\s ₽]/g, '').replace(',', '.');
    if (s === '') return 0;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  }
  // Money is summed in kopecks to avoid float drift (0.1 + 0.2).
  const cents = n => Math.round((Number(n) || 0) * 100);
  const budgetOf = t => Number(t.budget) || 0;
  const paidOf = t => (t.payments || []).reduce((a, p) => a + cents(p.amount), 0) / 100;
  const restOf = t => (cents(budgetOf(t)) - cents(paidOf(t))) / 100;

  function timingRaw(t, today = todayStr()) {
    if (t.status === 'done') return { cls: '', text: 'принят', overdue: false };
    if (t.status === 'review') return { cls: '', text: 'сдан на проверку', overdue: false };
    if (!isDate(t.finish)) return { cls: '', text: 'финиш не задан', overdue: false };
    const diff = dayNum(t.finish) - dayNum(today);
    // Lateness is counted in calendar days; time left in working days (production calendar).
    if (diff < 0) return { cls: 'bad', text: `сорван на ${-diff} дн.`, overdue: true, late: -diff, diff };
    if (diff === 0) return { cls: 'warn', text: 'сдача сегодня', overdue: false, soon: true, diff, workdays: 0 };
    const wd = Cal.workdaysBetween(today, t.finish);
    const left = `${wd} раб. дн.`;
    if (t.status === 'not_started' && isDate(t.start) && t.start < today) {
      return { cls: 'warn', text: `старт пропущен · ещё ${left}`, overdue: false, soon: diff <= 14, diff, workdays: wd };
    }
    return { cls: diff <= 7 ? 'warn' : '', text: `осталось ${left}`, overdue: false, soon: diff <= 14, diff, workdays: wd };
  }

  function totals(list, today = todayStr()) {
    let budget = 0, paid = 0, overdue = 0, review = 0, active = 0, done = 0;
    for (const t of list) {
      budget += cents(budgetOf(t)); paid += cents(paidOf(t));
      if (timing(t, today).overdue) overdue++;
      if (t.status === 'review') review++;
      if (ACTIVE.has(t.status)) active++;
      if (t.status === 'done') done++;
    }
    return { budget: budget / 100, paid: paid / 100, rest: (budget - paid) / 100, overdue, review, active, done, count: list.length };
  }

  const sortByDeadline = (a, b) => {
    const ra = a.status === 'done' ? 1 : 0, rb = b.status === 'done' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return (a.finish || '9999').localeCompare(b.finish || '9999');
  };

  /* ---------- visibility: trash and archive ---------- */
  // Soft-deleted records carry `deletedAt`; archived projects hide their cards from working views.
  function visible(snapshot, { includeArchived = false } = {}) {
    const allProjects = snapshot.projects || [];
    const known = new Set(allProjects.map(p => p.id));
    const projects = allProjects.filter(p => !p.deletedAt && (includeArchived || !p.archived));
    const shown = new Set(projects.map(p => p.id));
    return {
      projects,
      contractors: (snapshot.contractors || []).filter(c => !c.deletedAt),
      // A card whose project record is gone entirely stays visible as "без проекта".
      tasks: (snapshot.tasks || []).filter(t => !t.deletedAt && (shown.has(t.projectId) || !known.has(t.projectId))),
    };
  }

  /* ---------- history: deadline shifts and status changes ---------- */
  // history entries: { ts: ISO time, date: 'YYYY-MM-DD', type: 'status'|'finish', from, to, reason?, note? }
  const SHIFT_REASONS = {
    customer: 'Изменения или замечания заказчика',
    input: 'Задержка исходных данных',
    contractor: 'По вине исполнителя',
    other: 'Другая причина',
  };
  const historyOf = t => (Array.isArray(t.history) ? t.history : [])
    .filter(h => h && isDate(h.date))
    .slice().sort((a, b) => String(a.ts || a.date).localeCompare(String(b.ts || b.date)));

  function shiftsOfRaw(t) {
    const list = historyOf(t).filter(h => h.type === 'finish' && isDate(h.from) && isDate(h.to));
    const byReason = {};
    let days = 0;
    for (const h of list) {
      days += dayNum(h.to) - dayNum(h.from);
      const r = SHIFT_REASONS[h.reason] ? h.reason : 'other';
      byReason[r] = (byReason[r] || 0) + 1;
    }
    const original = list.length ? list[0].from : (isDate(t.finish) ? t.finish : null);
    // The deadline the contractor answers for moves only with shifts that were not their fault.
    let contractorDeadline = original;
    if (contractorDeadline) for (const h of list) if (h.reason !== 'contractor') contractorDeadline = addDays(contractorDeadline, dayNum(h.to) - dayNum(h.from));
    return { count: list.length, days, byReason, list, original, contractorDeadline };
  }

  function reviewStatsRaw(t, today = todayStr()) {
    const list = historyOf(t).filter(h => h.type === 'status');
    let rounds = 0, chiefDays = 0, contractorDays = 0, submitted = null, accepted = null, cur = null, since = null;
    const close = until => {
      if (!cur || !since) return;
      const d = Math.max(0, dayNum(until) - dayNum(since));
      if (cur === 'review') chiefDays += d;
      else if (cur === 'revision') contractorDays += d;
    };
    for (const h of list) {
      close(h.date);
      if (h.to === 'revision') rounds++;
      if ((h.to === 'review' || h.to === 'done') && !submitted) submitted = h.date;
      if (h.to === 'done') accepted = h.date; else if (h.from === 'done') accepted = null;
      cur = h.to; since = h.date;
    }
    if (cur === t.status) close(today); // the current stage is still running
    return { rounds, chiefDays, contractorDays, submitted, accepted, stageSince: cur === t.status ? since : null };
  }

  /* ---------- contractor reliability ---------- */
  function latenessRaw(t, today = todayStr()) {
    const deadline = shiftsOf(t).contractorDeadline;
    if (!isDate(deadline)) return null;
    const { submitted } = reviewStats(t, today);
    if (submitted) return { late: Math.max(0, dayNum(submitted) - dayNum(deadline)), final: true };
    if (ACTIVE.has(t.status) && today > deadline) return { late: dayNum(today) - dayNum(deadline), final: false };
    return null; // not finished and not late yet, or finished before history was kept
  }

  function reliability(tasks, today = todayStr()) {
    let rated = 0, onTime = 0, lateSum = 0, lateN = 0, roundsSum = 0, roundsN = 0, contractorShifts = 0;
    for (const t of tasks) {
      const l = lateness(t, today);
      if (l) { rated++; if (l.late === 0) onTime++; else { lateSum += l.late; lateN++; } }
      const rs = reviewStats(t, today);
      if (rs.submitted) { roundsSum += rs.rounds; roundsN++; }
      contractorShifts += shiftsOf(t).byReason.contractor || 0;
    }
    const pct = rated ? Math.round((onTime / rated) * 100) : null;
    const grade = rated < 2 ? 'none' : pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad';
    return {
      rated, onTime, pct, grade, contractorShifts,
      avgLate: lateN ? Math.round((lateSum / lateN) * 10) / 10 : 0,
      avgRounds: roundsN ? Math.round((roundsSum / roundsN) * 10) / 10 : null,
    };
  }

  /* ---------- payment schedule ---------- */
  const PAY_TRIGGERS = { start: 'при старте работ', review: 'при сдаче на проверку', accepted: 'после приёмки', date: 'к дате' };

  // plan rows: { id, title, pct?: number, amount?: number, trigger: keyof PAY_TRIGGERS, date? }
  // Payments made are matched to plan rows in order; unplanned budget is treated as due after acceptance.
  function paymentPlanRaw(t, today = todayStr()) {
    const budgetC = cents(budgetOf(t));
    const rs = reviewStats(t, today);
    const rows = (Array.isArray(t.plan) ? t.plan : []).map(p => {
      const hasPct = p.pct !== null && p.pct !== undefined && p.pct !== '' && Number.isFinite(Number(p.pct));
      const amountC = hasPct ? Math.round((budgetC * Number(p.pct)) / 100) : cents(p.amount);
      let dueDate = null, triggered = false;
      switch (p.trigger) {
        case 'start':
          dueDate = isDate(t.start) ? t.start : null;
          triggered = (dueDate !== null && dueDate <= today) || t.status !== 'not_started';
          break;
        case 'review':
          dueDate = rs.submitted;
          triggered = !!rs.submitted || t.status === 'review' || t.status === 'done';
          break;
        case 'date':
          dueDate = isDate(p.date) ? p.date : null;
          triggered = dueDate !== null && dueDate <= today;
          break;
        default: // accepted
          dueDate = rs.accepted;
          triggered = t.status === 'done';
      }
      return { ...p, hasPct, amountC, dueDate, triggered };
    });
    const planC = rows.reduce((a, r) => a + r.amountC, 0);
    const remainderC = Math.max(0, budgetC - planC);
    if (remainderC > 0) rows.push({ id: '_rest', title: rows.length ? 'Остаток бюджета вне графика' : 'Оплата после приёмки', virtual: true, amountC: remainderC, dueDate: rs.accepted, triggered: t.status === 'done', trigger: 'accepted' });

    let paidLeft = cents(paidOf(t)), dueNowC = 0, laterC = 0;
    for (const r of rows) {
      const cover = Math.min(paidLeft, r.amountC);
      paidLeft -= cover;
      const openC = r.amountC - cover;
      r.amount = r.amountC / 100;
      r.paid = cover / 100;
      r.open = openC / 100;
      r.state = openC <= 0 ? 'paid' : r.triggered ? 'due' : 'upcoming';
      if (openC > 0) { if (r.triggered) dueNowC += openC; else laterC += openC; }
    }
    return {
      rows, hasPlan: Array.isArray(t.plan) && t.plan.length > 0,
      dueNow: dueNowC / 100, later: laterC / 100, planTotal: planC / 100, mismatch: (planC - budgetC) / 100,
    };
  }

  /* ---------- milestones ---------- */
  // milestones: { id, title, date, done: boolean, doneAt? }
  function milestonesOfRaw(t, today = todayStr()) {
    const list = (Array.isArray(t.milestones) ? t.milestones : []).slice()
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    const open = list.filter(m => !m.done);
    const working = t.status !== 'done';
    return {
      list,
      done: list.length - open.length,
      overdue: working ? open.filter(m => isDate(m.date) && m.date < today) : [],
      next: working ? open.find(m => !isDate(m.date) || m.date >= today) || null : null,
    };
  }

  /* ---------- who fits the selected marks ---------- */
  const specialtyMarks = s => new Set(String(s ?? '').toUpperCase().split(/[\s,;/+]+/).filter(Boolean));
  function matchCount(contractor, marks) {
    const spec = specialtyMarks(contractor.specialty);
    return marks.filter(m => spec.has(m)).length;
  }


  /* ---------- dependencies between cards ---------- */
  // t.dependsOn: ids of cards that must be finished before this one (e.g. СС waits for the ЭОМ assignment).
  const depsOf = t => (Array.isArray(t.dependsOn) ? t.dependsOn : []);

  function dependencyIssues(t, byId, today = todayStr()) {
    if (t.status === 'done') return [];
    const out = [];
    for (const id of depsOf(t)) {
      const p = byId.get(id);
      if (!p || p.deletedAt || p.status === 'done') continue;
      const tm = timing(p, today);
      if (tm.overdue) out.push({ pred: p, kind: 'overdue', text: `смежник сорвал срок (${sectionsOf(p).join(', ')})` });
      else if (isDate(p.finish) && isDate(t.start) && p.finish > t.start) out.push({ pred: p, kind: 'overlap', text: `смежник (${sectionsOf(p).join(', ')}) заканчивает позже вашего старта` });
    }
    return out;
  }

  // True if making `candidateId` a predecessor of `taskId` would create a loop.
  function wouldCycle(taskId, candidateId, byId) {
    const seen = new Set();
    const stack = [candidateId];
    while (stack.length) {
      const id = stack.pop();
      if (id === taskId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = byId.get(id);
      if (t) stack.push(...depsOf(t));
    }
    return false;
  }

  /* ---------- what needs attention (UI lists, compact mode, notifications) ---------- */
  function attention(tasks, today = todayStr()) {
    const out = { overdue: [], week: [], soon: [], dueIn3: [], review: [], milestones: [], pay: [], noAct: [], blocked: [] };
    const byId = new Map(tasks.map(t => [t.id, t]));
    for (const t of tasks) {
      if (dependencyIssues(t, byId, today).length) out.blocked.push(t);
      const tm = timing(t, today);
      if (tm.overdue) out.overdue.push(t);
      else if (ACTIVE.has(t.status) && tm.diff != null) {
        if (tm.diff <= 3) out.dueIn3.push(t);
        if (tm.diff <= 7) out.week.push(t);
        if (tm.soon) out.soon.push(t);
      }
      if (t.status === 'review') out.review.push(t);
      if (milestonesOf(t, today).overdue.length) out.milestones.push(t);
      if (paymentPlan(t, today).dueNow > 0) out.pay.push(t);
      if (t.status === 'done' && !t.actSigned) out.noAct.push(t);
    }
    out.overdue.sort((a, b) => timing(b, today).late - timing(a, today).late);
    for (const k of ['week', 'soon', 'dueIn3', 'review', 'milestones', 'blocked']) out[k].sort(sortByDeadline);
    out.pay.sort((a, b) => paymentPlan(b, today).dueNow - paymentPlan(a, today).dueNow);
    return out;
  }

  // Short text for the morning notification; null when nothing needs attention.
  function digestText(tasks, today = todayStr(), { money = true } = {}) {
    const a = attention(tasks, today);
    const dueToday = a.dueIn3.filter(t => t.finish === today).length;
    const parts = [];
    if (a.overdue.length) parts.push(`сорван срок: ${a.overdue.length}`);
    if (dueToday) parts.push(`сдача сегодня: ${dueToday}`);
    if (a.dueIn3.length - dueToday) parts.push(`сдача в ближайшие 3 дня: ${a.dueIn3.length - dueToday}`);
    if (a.milestones.length) parts.push(`сорваны контрольные точки: ${a.milestones.length}`);
    if (a.review.length) parts.push(`ждут проверки: ${a.review.length}`);
    if (money && a.pay.length) parts.push(`пора платить: ${a.pay.length}`);
    return parts.length ? parts.join(' · ') : null;
  }

  // Readiness of a card, %: not started 0; in work — set by hand by the chief, 1…90 (1 until set);
  // on review 90; returned for revision 80; accepted 100. Paused keeps the hand-set value.
  const READY_FIXED = { not_started: 0, review: 90, revision: 80, done: 100 };
  const READY_MIN = 1, READY_MAX = 90;
  const readinessManual = status => status === 'in_progress' || status === 'paused';
  function readiness(t) {
    if (!t) return 0;
    if (READY_FIXED[t.status] !== undefined) return READY_FIXED[t.status];
    const v = Math.round(Number(t.readiness));
    return Number.isFinite(v) && v >= READY_MIN ? Math.min(READY_MAX, v) : READY_MIN;
  }

  // Completion of a set of cards. Weight: 1 per card or its budget. «fact» — accepted share,
  // «plan» — share that should be accepted by today (finish already passed), both in %.
  function progress(tasks, today = todayStr(), weight = 'count') {
    const w = t => (weight === 'budget' ? Math.max(0, budgetOf(t)) : 1);
    const out = { total: 0, done: 0, review: 0, work: 0, idle: 0, due: 0, ready: 0, count: tasks.length, late: 0 };
    for (const t of tasks) {
      const k = w(t);
      out.total += k;
      out.ready += (k * readiness(t)) / 100;
      if (t.status === 'done') out.done += k;
      else if (t.status === 'review') out.review += k;
      else if (t.status === 'in_progress' || t.status === 'revision') out.work += k;
      else out.idle += k;
      if (isDate(t.finish) && t.finish <= today) out.due += k;
      if (timing(t, today).overdue) out.late++;
    }
    const pct = v => (out.total ? Math.round((v / out.total) * 1000) / 10 : 0);
    out.fact = pct(out.done);          // accepted
    out.readyPct = pct(out.ready);     // weighted readiness
    out.plan = pct(out.due);
    out.lag = Math.round((out.plan - out.readyPct) * 10) / 10;
    out.parts = { done: pct(out.done), review: pct(out.review), work: pct(out.work), idle: pct(out.idle) };
    return out;
  }

  // Per-card caches: these results depend only on the card and the date, and cards are replaced, never
  // edited in place, when data changes — so a WeakMap keyed by the card object stays correct and frees itself.
  function memo(fn) {
    const cache = new WeakMap();
    return (t, today = todayStr()) => {
      if (!t || typeof t !== 'object') return fn(t, today);
      let m = cache.get(t);
      if (!m) cache.set(t, (m = new Map()));
      if (!m.has(today)) m.set(today, fn(t, today));
      return m.get(today);
    };
  }
  const timing = memo(timingRaw), reviewStats = memo(reviewStatsRaw), lateness = memo(latenessRaw);

  /* ---------- light gamification: quality and a shared goal, never counts of cards ---------- */
  // Accepted cards: how many went through without a single round of remarks.
  function firstTime(tasks, today = todayStr()) {
    const done = tasks.filter(t => t.status === 'done');
    const clean = done.filter(t => reviewStats(t, today).rounds === 0).length;
    return { done: done.length, clean, pct: done.length ? Math.round((clean / done.length) * 100) : null };
  }
  // A project's goal: every mark of its cards accepted. Marks of one card count separately («6 из 9 марок»).
  function projectGoal(tasks) {
    const marks = new Map();
    for (const t of tasks) for (const m of sectionsOf(t)) marks.set(m, (marks.get(m) ?? true) && t.status === 'done');
    const total = marks.size, done = [...marks.values()].filter(Boolean).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
  }
  // Thanks received by a person in card discussions.
  function thanksFor(tasks, uid) {
    let n = 0;
    for (const t of tasks) for (const c of t.comments || []) if (c.userId === uid) n += (c.thanks || []).filter(x => x !== uid).length;
    return n;
  }
  const paymentPlan = memo(paymentPlanRaw), milestonesOf = memo(milestonesOfRaw);
  const shiftsOf = memo(t => shiftsOfRaw(t));

  return {
    STATUSES, ACTIVE, PROJECT_STATUSES, PHASES, phaseLabel, defaultPhases, phaseState, projectNow, TRANSITIONS, firstTime, projectGoal, thanksFor, MARK_GROUPS, SHIFT_REASONS, PAY_TRIGGERS, progress, readiness, readinessManual, READY_MIN, READY_MAX,
    normalizeMarks, splitMarks, sectionsOf, todayStr, isDate, dayNum, addDays, fmtDate, parseMoney, cents,
    budgetOf, paidOf, restOf, timing, totals, sortByDeadline,
    visible, historyOf, shiftsOf, depsOf, dependencyIssues, wouldCycle, Cal, reviewStats, lateness, reliability, paymentPlan, milestonesOf, matchCount, attention, digestText,
  };
});

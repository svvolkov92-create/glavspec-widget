'use strict';

// Turns the stored snapshot into plain report rows shared by the Excel and Word builders.
const L = require('../renderer/logic.js');
const A = require('../renderer/access.js');

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ru');

function statusOf(t, today) {
  const tm = L.timing(t, today);
  if (tm.overdue) return { label: 'Срок сорван', tone: 'bad', overdueDays: tm.late, timing: tm };
  const s = L.STATUSES[t.status] || L.STATUSES.not_started;
  return { label: s.label, tone: s.tone, overdueDays: 0, timing: tm };
}

/**
 * @param scope {type: 'all'} — active projects; {type: 'project', id}; {type: 'contractor', id} (archived projects included,
 *   since a reconciliation statement must cover all work with the contractor).
 */
function buildReport(snapshot, today = L.todayStr(), scope = { type: 'all' }) {
  const vis = L.visible(snapshot, { includeArchived: scope.type !== 'all' });
  let tasks = vis.tasks;
  if (scope.type === 'project') tasks = tasks.filter(t => t.projectId === scope.id);
  if (scope.type === 'contractor') tasks = tasks.filter(t => t.contractorId === scope.id);
  const users = snapshot.users || [];
  const person = scope.type === 'user' ? users.find(u => u.id === scope.id) : null;
  if (scope.type === 'user') tasks = tasks.filter(t => A.ownersOf(t).includes(scope.id));

  const allProjects = new Map(vis.projects.map(p => [p.id, p]));
  const allContractors = new Map(vis.contractors.map(c => [c.id, c]));
  const projects = new Map([...allProjects].filter(([id]) => scope.type === 'all' ? true : tasks.some(t => t.projectId === id) || (scope.type === 'project' && id === scope.id)));
  const contractors = new Map([...allContractors].filter(([id]) => scope.type === 'all' ? true : scope.type === 'contractor' ? id === scope.id : tasks.some(t => t.contractorId === id)));

  const rowOf = t => {
    const p = allProjects.get(t.projectId), c = allContractors.get(t.contractorId), st = statusOf(t, today);
    const sh = L.shiftsOf(t), rs = L.reviewStats(t, today), pp = L.paymentPlan(t, today), ms = L.milestonesOf(t, today);
    return {
      id: t.id,
      projectId: t.projectId,
      project: p?.name || '— проект удалён —',
      code: p?.code || '',
      section: L.sectionsOf(t).join(', '),
      title: t.title || '',
      contractorId: t.contractorId || '',
      contractor: c?.name || '',
      phone: c?.phone || '',
      start: L.isDate(t.start) ? t.start : '',
      finish: L.isDate(t.finish) ? t.finish : '',
      status: t.status,
      statusLabel: st.label,
      tone: st.tone,
      overdueDays: st.overdueDays,
      dueText: st.timing.text,
      budget: L.budgetOf(t),
      paid: L.paidOf(t),
      rest: L.restOf(t),
      dueNow: pp.dueNow,
      shifts: sh.count,
      shiftDays: sh.days,
      rounds: rs.rounds,
      accepted: rs.accepted || '',
      msOverdue: ms.overdue.length,
      contractNo: t.contractNo || '',
      contractDate: L.isDate(t.contractDate) ? t.contractDate : '',
      invoiceReceived: !!t.invoiceReceived,
      actSigned: !!t.actSigned,
      actDate: L.isDate(t.actDate) ? t.actDate : '',
      note: t.note || '',
    };
  };

  const rows = tasks.map(rowOf).sort((a, b) =>
    a.project.localeCompare(b.project, 'ru') || L.sortByDeadline({ status: a.status, finish: a.finish }, { status: b.status, finish: b.finish }));

  const projectList = [...projects.values()].sort(byName).map(p => {
    const pt = tasks.filter(t => t.projectId === p.id);
    return { name: p.name || '', code: p.code || '', client: p.client || '', archived: !!p.archived, rows: rows.filter(r => r.projectId === p.id), totals: L.totals(pt, today) };
  });
  const orphanRows = rows.filter(r => !allProjects.has(r.projectId));
  if (orphanRows.length) {
    projectList.push({ name: 'Без проекта', code: '', client: '', rows: orphanRows, totals: L.totals(tasks.filter(t => !allProjects.has(t.projectId)), today) });
  }

  const contractorList = [...contractors.values()].sort(byName).map(c => {
    const ct = tasks.filter(t => t.contractorId === c.id);
    // Reliability looks at all of the contractor's work, not only the cards in this report.
    const rel = L.reliability(vis.tasks.filter(t => t.contractorId === c.id), today);
    return {
      name: c.name || '', specialty: c.specialty || '', phone: c.phone || '', email: c.email || '', messenger: c.messenger || '', requisites: c.requisites || '',
      totals: L.totals(ct, today), dueNow: ct.reduce((a, t) => a + L.cents(L.paymentPlan(t, today).dueNow), 0) / 100, reliability: rel,
    };
  });

  const payments = [];
  for (const t of tasks) {
    const r = rowOf(t);
    for (const p of t.payments || []) {
      payments.push({ date: L.isDate(p.date) ? p.date : '', project: r.project, section: r.section, contractor: r.contractor, amount: Number(p.amount) || 0, note: p.note || '' });
    }
  }
  payments.sort((a, b) => a.date.localeCompare(b.date) || a.project.localeCompare(b.project, 'ru'));

  const a = L.attention(tasks, today);
  const toRows = list => list.map(t => rows.find(r => r.id === t.id));
  const attention = { overdue: toRows(a.overdue), week: toRows(a.week), review: toRows(a.review), pay: toRows(a.pay), milestones: toRows(a.milestones), noAct: toRows(a.noAct) };

  // Settlement summary for a reconciliation statement with one contractor.
  let settlement = null;
  if (scope.type === 'contractor') {
    const c = L.cents;
    const acceptedC = tasks.filter(t => t.status === 'done').reduce((s, t) => s + c(L.budgetOf(t)), 0);
    const paidC = tasks.reduce((s, t) => s + c(L.paidOf(t)), 0);
    settlement = { budget: tasks.reduce((s, t) => s + c(L.budgetOf(t)), 0) / 100, accepted: acceptedC / 100, paid: paidC / 100, balance: (acceptedC - paidC) / 100 };
  }

  const employee = person ? employeeSection(person, tasks, today, scope.period, allProjects) : null;
  const scopeTitle = scope.type === 'user' ? person?.name || '' : scope.type === 'project' ? allProjects.get(scope.id)?.name || 'проект'
    : scope.type === 'contractor' ? allContractors.get(scope.id)?.name || 'исполнитель' : '';
  return {
    today, scope: { ...scope, title: scopeTitle, contractor: scope.type === 'contractor' ? contractorList[0] || null : null },
    totals: L.totals(tasks, today), dueNow: rows.reduce((s, r) => s + L.cents(r.dueNow), 0) / 100,
    rows, projects: projectList, contractors: contractorList, payments, attention, settlement, employee,
  };
}

const PERIODS = { month: [30, 'за 30 дней'], quarter: [91, 'за 3 месяца'], year: [365, 'за год'], all: [0, 'за всё время'] };

// Employee report: what the person handed in during the period, on time or not, how many review rounds.
function employeeSection(user, tasks, today, period = 'quarter', projects = new Map()) {
  const [daysBack, periodLabel] = PERIODS[period] || PERIODS.quarter;
  const from = daysBack ? L.addDays(today, -daysBack + 1) : '';
  const delivered = [];
  for (const t of tasks) {
    const subs = (t.history || []).filter(h => h.type === 'status' && h.to === 'review' && h.date);
    const first = subs[0]?.date || '';
    const rs = L.reviewStats(t, today);
    const handed = first || (t.status === 'done' ? rs.accepted || '' : '');
    if (!handed || (from && handed < from) || handed > today) continue;
    // On time = handed in by the deadline that stood when the work was handed in (shifts before it count).
    const finishThen = (t.history || []).filter(h => h.type === 'finish' && h.date && h.date <= handed).map(h => h.to).at(-1) || t.finish;
    const late = L.isDate(finishThen) && handed > finishThen ? L.dayNum(handed) - L.dayNum(finishThen) : 0;
    delivered.push({
      project: projects.get(t.projectId)?.name || '—', section: L.sectionsOf(t).join(', '), title: t.title || '',
      role: t.ownerId === user.id ? 'ответственный' : 'соисполнитель',
      finish: L.isDate(finishThen) ? finishThen : '', handed, accepted: rs.accepted || '', late, rounds: rs.rounds, status: t.status,
      statusLabel: (L.STATUSES[t.status] || {}).label || '',
    });
  }
  delivered.sort((a, b) => a.handed.localeCompare(b.handed));
  const onTime = delivered.filter(d => !d.late).length;
  const active = tasks.filter(t => L.ACTIVE.has(t.status)).map(t => {
    const tm = L.timing(t, today);
    return { project: projects.get(t.projectId)?.name || '—', section: L.sectionsOf(t).join(', '), finish: L.isDate(t.finish) ? t.finish : '', dueText: tm.text, overdue: !!tm.overdue, statusLabel: (L.STATUSES[t.status] || {}).label || '', ready: L.readiness(t) };
  }).sort((a, b) => (a.finish || '9').localeCompare(b.finish || '9'));
  return {
    name: user.name, role: A.ROLES[user.role]?.label || '', directions: A.directionLabels(user).join(', '),
    period, periodLabel, from, to: today,
    delivered, active,
    summary: {
      delivered: delivered.length, onTime, pct: delivered.length ? Math.round((onTime / delivered.length) * 100) : null,
      late: delivered.length - onTime, avgRounds: delivered.length ? Math.round((delivered.reduce((s, d) => s + d.rounds, 0) / delivered.length) * 10) / 10 : 0,
      overdueNow: active.filter(a => a.overdue).length, activeNow: active.length,
    },
  };
}

module.exports = { buildReport, employeeSection, PERIODS };

'use strict';
// A project as MS Project XML (MSPDI, Project 2007 and later: «Файл → Открыть» → XML). 4.10.
// Summary rows: the project, its stages (when set), then its sections (marks) with their cards; a card's «зависит от»
// becomes a finish-to-start link; owners and contractors become resources. The calendar is the Russian production
// calendar of the Пульт (holidays and transferred days as exceptions), 8 hours a day, 08:00–17:00 with a lunch hour.
// Dates stay as in the Пульт: every card is pinned «начало не ранее» its start.
const Cal = require('../renderer/calendar.js');
const L = require('../renderer/logic.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dur = hours => `PT${hours}H0M0S`;

// Working days of a span, at least one for a bar (a card that starts and ends on a day off still lasts its day).
function workdays(start, finish) {
  if (!isDate(start) || !isDate(finish) || finish < start) return 1;
  return Math.max(1, Cal.workdaysBetween(start, finish));
}
// The first working day on or after a date: Project starts work there anyway.
function workStart(iso) {
  let d = iso;
  for (let i = 0; i < 30 && !Cal.isWorkday(d); i++) d = addDays(d, 1);
  return d;
}

function calendarXml(from, to) {
  const hours = '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>';
  const week = [1, 2, 3, 4, 5, 6, 7].map(t => (t === 1 || t === 7
    ? `<WeekDay><DayType>${t}</DayType><DayWorking>0</DayWorking></WeekDay>`
    : `<WeekDay><DayType>${t}</DayType><DayWorking>1</DayWorking>${hours}</WeekDay>`)).join('');
  // Exceptions: weekdays off (holidays, transfers) and working Saturdays, over the project's span and a year after.
  const ex = [];
  if (isDate(from) && isDate(to)) {
    const end = addDays(to, 366);
    for (let d = addDays(from, -31); d <= end; d = addDays(d, 1)) {
      const wd = new Date(d + 'T00:00:00Z').getUTCDay(), weekend = wd === 0 || wd === 6, work = Cal.isWorkday(d);
      if (weekend === !work) continue;
      ex.push(`<WeekDay><DayType>0</DayType><DayWorking>${work ? 1 : 0}</DayWorking><TimePeriod><FromDate>${d}T00:00:00</FromDate><ToDate>${d}T23:59:00</ToDate></TimePeriod>${work ? hours : ''}</WeekDay>`);
    }
  }
  return `<Calendars><Calendar><UID>1</UID><Name>Производственный календарь РФ</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID><WeekDays>${week}${ex.join('')}</WeekDays></Calendar></Calendars>`;
}

/**
 * opts: { project: {...p, id}, tasks: [cards of the project as the user sees them], users: {id: user}, contractors: {id: c},
 *         phaseLabel: key → name, author, now: Date }
 * → the XML text.
 */
function buildMsProject({ project: p, tasks, users = {}, contractors = {}, phaseLabel = k => k, author = '', now = new Date() }) {
  const cards = tasks.filter(t => !t.deletedAt && isDate(t.start) && isDate(t.finish)).sort((a, b) => a.start.localeCompare(b.start) || String(a.title).localeCompare(String(b.title), 'ru'));
  const phases = (p.phases || []).filter(ph => isDate(ph.start) && isDate(ph.finish));
  const all = [...cards.flatMap(t => [t.start, t.finish]), ...phases.flatMap(ph => [ph.start, ph.finish])].sort();
  const from = all[0] || L.todayStr(now), to = all[all.length - 1] || from;
  const rows = []; // { name, level, start?, finish?, summary, card?, milestone?, percent?, notes? }
  let uid = 0;
  const add = r => { r.uid = ++uid; rows.push(r); return r; };
  if (phases.length) {
    add({ name: 'Этапы проекта', level: 1, summary: true });
    for (const ph of phases) add({ name: phaseLabel(ph.key) || ph.key || 'Этап', level: 2, start: ph.start, finish: ph.finish, milestone: ph.start === ph.finish && !ph.days });
  }
  const groups = new Map();
  for (const t of cards) { const g = t.mark || (Array.isArray(t.marks) && t.marks[0]) || 'Без раздела'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(t); }
  const uidOf = new Map();
  for (const [g, list] of groups) {
    add({ name: g, level: 1, summary: true });
    for (const t of list) {
      const r = add({ name: t.title || g, level: 2, start: t.start, finish: t.finish, card: t, milestone: false,
        percent: L.readiness(t),
        notes: [t.note, t.status === 'review' ? 'На проверке' : ''].filter(Boolean).join('\n') });
      uidOf.set(t.id, r.uid);
    }
  }
  // Outline numbers and the dates of summary rows (span of their children).
  const counters = [];
  rows.forEach((r, i) => {
    counters.length = r.level; counters[r.level - 1] = (counters[r.level - 1] || 0) + 1;
    r.outline = counters.join('.');
    if (r.summary) {
      const kids = []; for (let j = i + 1; j < rows.length && rows[j].level > r.level; j++) kids.push(rows[j]);
      const ds = kids.flatMap(k => [k.start, k.finish]).filter(isDate).sort();
      r.start = ds[0] || from; r.finish = ds[ds.length - 1] || from;
    }
  });

  // Resources: the people who own cards and the contractors doing them.
  const res = new Map();
  const resOf = (kind, id) => {
    const key = `${kind}:${id}`;
    if (res.has(key)) return res.get(key).uid;
    const who = kind === 'u' ? users[id] : contractors[id];
    if (!who) return null;
    const r = { uid: res.size + 1, name: who.name || '—', group: kind === 'u' ? 'Штат' : 'Подрядчики', email: who.email || '' };
    res.set(key, r);
    return r.uid;
  };
  const assigns = [];
  for (const r of rows) {
    if (!r.card) continue;
    const t = r.card;
    // Who does the card (a staff executor or a contractor), else its owner; co-executors too.
    const people = [...new Set([t.execUserId || (t.contractorId ? null : t.ownerId), ...(Array.isArray(t.coOwnerIds) ? t.coOwnerIds : [])].filter(Boolean))];
    for (const o of people) { const ru = resOf('u', o); if (ru) assigns.push({ task: r.uid, res: ru }); }
    if (t.contractorId) { const ru = resOf('c', t.contractorId); if (ru) assigns.push({ task: r.uid, res: ru }); }
  }

  const taskXml = r => {
    const start = workStart(r.start), days = r.milestone ? 0 : workdays(start, r.finish < start ? start : r.finish);
    const links = r.card ? (Array.isArray(r.card.dependsOn) ? r.card.dependsOn : []).map(id => uidOf.get(id)).filter(Boolean)
      .map(u => `<PredecessorLink><PredecessorUID>${u}</PredecessorUID><Type>1</Type><CrossProject>0</CrossProject><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join('') : '';
    return `<Task><UID>${r.uid}</UID><ID>${r.uid}</ID><Name>${esc(r.name)}</Name><Type>1</Type><IsNull>0</IsNull><WBS>${r.outline}</WBS><OutlineNumber>${r.outline}</OutlineNumber><OutlineLevel>${r.level}</OutlineLevel>`
      + `<Start>${start}T08:00:00</Start><Finish>${r.milestone ? start + 'T08:00:00' : (r.finish < start ? start : r.finish) + 'T17:00:00'}</Finish><Duration>${dur(days * 8)}</Duration><DurationFormat>7</DurationFormat>`
      + `<Milestone>${r.milestone ? 1 : 0}</Milestone><Summary>${r.summary ? 1 : 0}</Summary><Critical>0</Critical><PercentComplete>${r.percent || 0}</PercentComplete>`
      + (r.summary ? '' : `<ConstraintType>4</ConstraintType><ConstraintDate>${start}T08:00:00</ConstraintDate>`)
      + `<CalendarUID>-1</CalendarUID>${r.notes ? `<Notes>${esc(r.notes)}</Notes>` : ''}${links}</Task>`;
  };
  const title = [p.code, p.name].filter(Boolean).join(' — ') || 'Проект';
  const iso = now.toISOString().slice(0, 19);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
<SaveVersion>14</SaveVersion><Name>${esc(title)}.xml</Name><Title>${esc(title)}</Title><Subject>${esc(p.client || '')}</Subject><Company>ПМ «Тандем»</Company><Author>${esc(author)}</Author>
<CreationDate>${iso}</CreationDate><LastSaved>${iso}</LastSaved><ScheduleFromStart>1</ScheduleFromStart><StartDate>${workStart(from)}T08:00:00</StartDate><FinishDate>${to}T17:00:00</FinishDate>
<CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth>
<DefaultTaskType>1</DefaultTaskType><DurationFormat>7</DurationFormat><WeekStartDay>1</WeekStartDay><CurrencySymbol>₽</CurrencySymbol><CurrencyCode>RUB</CurrencyCode>
${calendarXml(from, to)}
<Tasks><Task><UID>0</UID><ID>0</ID><Name>${esc(title)}</Name><Type>1</Type><IsNull>0</IsNull><OutlineNumber>0</OutlineNumber><OutlineLevel>0</OutlineLevel><Start>${workStart(from)}T08:00:00</Start><Finish>${to}T17:00:00</Finish><Summary>1</Summary></Task>
${rows.map(taskXml).join('\n')}
</Tasks>
<Resources><Resource><UID>0</UID><ID>0</ID><IsNull>0</IsNull></Resource>${[...res.values()].map(r => `<Resource><UID>${r.uid}</UID><ID>${r.uid}</ID><Name>${esc(r.name)}</Name><Type>1</Type><IsNull>0</IsNull><Group>${esc(r.group)}</Group>${r.email ? `<EmailAddress>${esc(r.email)}</EmailAddress>` : ''}<MaxUnits>1.00</MaxUnits><CalendarUID>1</CalendarUID></Resource>`).join('')}</Resources>
<Assignments>${assigns.map((a, i) => `<Assignment><UID>${i + 1}</UID><TaskUID>${a.task}</TaskUID><ResourceUID>${a.res}</ResourceUID><Units>1</Units></Assignment>`).join('')}</Assignments>
</Project>
`;
}

module.exports = { buildMsProject };

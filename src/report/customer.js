'use strict';

// Customer page of one project («Мой Тандем»): sidebar with the project's blocks — Главная, План работ, Договор и
// финансы, Исходные данные, Вопросы, Встречи и протоколы, Документация, Навигатор, 3D-модель. One renderer for the
// cabinet (with forms) and for the saved file (logo and font inside). Blocks switch by anchors and CSS :target —
// no scripts, so it works under the cabinet's strict CSP and in a file opened without a server. Printed (PDF), all
// blocks follow one another. Never shows internal money, contractors, owners or internal remarks; the contract and
// payments of the customer are shown only when the GIP filled them and switched them on.
const L = require('../renderer/logic.js');
const Composition = require('../renderer/composition.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dayMonth = iso => (L.isDate(iso) ? `${Number(iso.slice(8))} ${MONTHS_GEN[Number(iso.slice(5, 7)) - 1]}` : '');
const fileSize = n => (Number(n) >= 1048576 ? `${(Number(n) / 1048576).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(Number(n || 0) / 1024))} КБ`);
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const days = n => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
const rub = n => `${Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
// «Сериков Сергей Андреевич» → «Сериков С.»
const shortName = name => { const [f, ...r] = String(name || '').replace(/^Пример:\s*/, '').split(/\s+/).filter(Boolean); return r.length ? `${f} ${r.map(w => w[0] + '.').join('')}` : f || ''; };
const initials = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Customer wording of a card state: internal remarks are «внутренняя проверка».
function customerStatus(t, today) {
  if (!t) return { label: 'Запланирован', tone: 'neu' };
  if (t.status === 'done') return { label: 'Выполнен', tone: 'ok' };
  if (t.status === 'review' || t.status === 'revision') return { label: 'Внутренняя проверка', tone: 'wk' };
  if (t.status === 'paused') return { label: 'Приостановлен', tone: 'neu' };
  if (t.status === 'not_started') return { label: 'Запланирован', tone: 'neu' };
  return { label: L.timing(t, today).overdue ? 'В работе, срок уточняется' : 'В работе', tone: 'wk' };
}

const PROTO = { work: ['в работе', 'wk'], wait: ['ждём от вас', 'ac'], done: ['готово', 'ok'] };
// Source data (ИРД) statuses, as the customer reads them.
const IRD = { accepted: ['Принято', 'ok'], done: ['Выполнено', 'ok'], wait: ['Ждём от вас', 'ac'], clarify: ['Ждём уточнения', 'ac'], requested: ['Запрошено', 'wk'], remark: ['Замечание', 'bd'], plan: ['Не начато', 'neu'] };
const IRD_KIND = { tu: 'ТУ', letter: 'Письмо', approval: 'Согласование', survey: 'Изыскания', doc: '' };
const PAY = { paid: ['Оплачен', 'ok'], invoiced: ['Счёт выставлен', 'ac'], upcoming: ['Предстоит', 'neu'] };
const BILL = { to_pay: ['К оплате', 'ac'], to_sign: ['На подписании', 'ac'], signed: ['Подписан', 'ok'], paid: ['Оплачен', 'ok'] };
const CONTRACT = { draft: ['Готовится', 'neu'], signing: ['На подписании', 'ac'], signed: ['Подписан', 'ok'], signed_edo: ['Подписан в ЭДО', 'ok'] };

function remainText(n) {
  if (n < 0) return { text: 'истёк', tone: 'bd' };
  if (n <= 60) return { text: days(n), tone: 'bd' };
  const m = Math.round(n / 30.4);
  return { text: `${m} мес.`, tone: n <= 183 ? 'wr' : 'ok' };
}

// Sections for the customer: volumes of the composition (with the card linked to each), or the cards by marks.
function sectionRows(project, tasks, today) {
  const comp = project.composition, code = project.code || '';
  const byId = new Map(tasks.map(t => [t.id, t]));
  const lastRev = t => (t && Array.isArray(t.revisions) && t.revisions.length ? t.revisions[t.revisions.length - 1] : null);
  const row = (t, base) => ({ ...base, st: customerStatus(t, today), ready: t ? L.readiness(t) : 0, rev: lastRev(t), revs: t && Array.isArray(t.revisions) ? t.revisions : [], finish: t?.finish || '', status: t?.status || '' });
  const vols = Composition.volumes(comp, code);
  if (vols.length) {
    const pd = vols.map(v => row(byId.get(v.node.taskId), { group: 'pd', k: v.abbr, title: v.title, code: v.code }));
    const rd = Composition.rdRows(comp, code).map(r => row(byId.get(r.item.taskId), { group: 'rd', k: r.mark, title: r.title, code: r.code }));
    return [...pd, ...rd];
  }
  return tasks.filter(t => t.kind !== 'assign').map(t => row(t, { group: 'pd', k: L.sectionsOf(t).join(', '), title: t.title || '', code: '' }));
}

// What the customer may see, extracted once: the desktop builds it, the cabinet server stores and renders it.
// `team`: participants as { name, role } (only when the GIP shows the team). The «Договор» stage is shown too.
function pageModel({ project: p, tasks, contact, today, team = [] }) {
  const own = tasks.filter(t => t.projectId === p.id && !t.deletedAt);
  const pick = (list, keys) => (Array.isArray(list) ? list : []).map(x => Object.fromEntries(keys.map(k => [k, x?.[k] ?? ''])));
  const show = { plan: true, sections: true, advice: true, revisions: false, finance: true, ird: true, meetings: true, team: true, soon: true, ...(p.show || {}) };
  const c = p.contract || {};
  const finance = show.finance && String(c.no || '').trim() ? {
    contract: { no: c.no || '', date: c.date || '', subject: c.subject || '', sum: Number(c.sum) || 0, status: c.status || 'signed' },
    payments: pick(p.payments, ['id', 'title', 'sum', 'cond', 'status', 'date']).map(x => ({ ...x, sum: Number(x.sum) || 0 })),
    bills: pick(p.bills, ['id', 'title', 'date', 'status', 'due']),
  } : null;
  return {
    v: 2, publishedAt: today,
    project: {
      id: p.id, name: p.name || '', code: p.code || '', client: p.client || '', status: p.status || '',
      phases: pick(p.phases, ['key', 'start', 'finish', 'done']), milestones: pick(p.milestones, ['id', 'title', 'date', 'done']),
      requests: (p.requests || []).filter(r => !r.done && r.title).map(r => ({ ...pick([r], ['id', 'title', 'due', 'why', 'irdId'])[0], ...(Array.isArray(r.files) && r.files.length ? { files: r.files.map(f => ({ id: f.id, name: f.name, size: f.size })) } : {}) })),
      protocol: p.protocol ? { no: p.protocol.no || '', date: p.protocol.date || '', items: pick(p.protocol.items, ['id', 'text', 'status', 'pct', 'who', 'due']) } : null,
      docs: pick(p.docs, ['id', 'title', 'until']), advice: p.advice ? { title: p.advice.title || '', text: p.advice.text || '' } : null,
      ird: show.ird ? pick((p.ird || []).filter(x => x.title), ['id', 'title', 'kind', 'who', 'status', 'due', 'note']) : [],
      meetings: show.meetings ? pick((p.meetings || []).filter(x => x.title || L.isDate(x.date)), ['id', 'date', 'from', 'to', 'title', 'place', 'protocolNo']) : [],
      rdMode: p.rdMode || '',
      show,
    },
    finance,
    byDecree: !!p.composition,
    sections: sectionRows(p, own, today).map(s => ({ group: s.group, k: s.k, title: s.title, code: s.code, st: s.st, ready: s.ready, finish: s.finish,
      rev: s.rev ? { no: s.rev.no, date: s.rev.date } : null, revs: show.revisions ? s.revs.slice(-6).map(r => ({ no: r.no, date: r.date, note: r.note || '' })) : [] })),
    contact: contact ? { name: contact.name || '', role: contact.role || '', phone: contact.phone || '', email: contact.email || '' } : null,
    team: show.team ? pick(team, ['name', 'role']).slice(0, 12) : [],
  };
}

/* ---------- icons (stroke, 20×20 box) ---------- */
const ICONS = {
  home: 'M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z',
  plan: 'M3 3v14h14M6 7h6M8 10.5h7M6 14h5',
  finance: 'M3.5 6h13v10h-13zM3.5 6l2-2.5h8l2 2.5M13 11h1.5',
  ird: 'M3 6.5h5l1.5 1.5H17v8.5H3zM10 10v4.5M8 12.5l2 2 2-2',
  q: 'M3.5 4.5h13v9h-7l-3.5 3v-3H3.5z',
  meet: 'M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5',
  docs: 'M5.5 2.5h6l3.5 3.5v11.5h-9.5zM11.5 2.5V6H15M8 10h5M8 13h5',
  nav: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM12.8 7.2l-1.5 4.1-4.1 1.5 1.5-4.1z',
  model: 'M10 2.5 16.5 6v8L10 17.5 3.5 14V6zM3.5 6 10 9.5 16.5 6M10 9.5v8',
  phone: 'M6.5 3H4.5a1.5 1.5 0 0 0-1.5 1.6C3.5 11.5 8.5 16.5 15.4 17a1.5 1.5 0 0 0 1.6-1.5v-2l-3-1.2-1.6 1.6a9 9 0 0 1-5.3-5.3l1.6-1.6z',
  fire: 'M10 17.5c3 0 5-2 5-4.8 0-3.2-2.6-4.6-3.4-8.2-1.6 1-2.4 2.8-2.2 4.6-1-.6-1.6-1.6-1.8-2.8C6.2 7.6 5 9.6 5 12.7c0 2.8 2 4.8 5 4.8z',
  more: 'M4.5 10h.01M10 10h.01M15.5 10h.01',
  bulb: 'M7.5 14.5h5M8 17h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z',
  cal: 'M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5',
  shield: 'M10 2.5 16 5v5c0 3.6-2.6 6.5-6 7.5-3.4-1-6-3.9-6-7.5V5z',
  out: 'M8 4H4v12h4M13 6.5 16.5 10 13 13.5M16.5 10H8',
  briefcase: 'M3 6.5h14v10H3zM7.5 6.5V4h5v2.5M3 11h14',
};
const ic = k => `<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;
const TABS = [['home', 'Главная', 'Главная'], ['plan', 'План работ', 'План'], ['finance', 'Договор и финансы', 'Договор'], ['ird', 'Исходные данные', 'Данные'],
  ['q', 'Вопросы', 'Вопросы'], ['meet', 'Встречи и протоколы', 'Встречи'], ['docs', 'Документация', 'Документы'], ['nav', 'Навигатор по проекту', 'Навигатор'], ['model', '3D-модель', '3D']];

/**
 * Renders the customer page from a page model.
 * @param {object} m           result of pageModel()
 * @param {object} o
 * @param {string} o.today     date the day counts are computed for (the cabinet uses the current date)
 * @param {string} o.logoSvg   brand logo (inline SVG)
 * @param {string} o.fontBase64, o.fontName, o.fontUrl  embedded font, or a URL served by the cabinet
 * @param {object} [o.cabinet] { csrf, base, flash, sent: { requestId: text }, customerName, projects, messages, title }
 */
function renderPage(m, { today, logoSvg = '', fontBase64 = '', fontName = 'Golos Text', fontUrl = '', cabinet = null }) {
  const p = m.project, contact = m.contact, team = m.team || [], fin = m.finance;
  const show = { plan: true, sections: true, advice: true, revisions: false, finance: true, ird: true, meetings: true, team: true, soon: true, ...(p.show || {}) };
  const now = L.projectNow(p, today);
  const sections = m.sections || [];
  const pdSecs = sections.filter(s => s.group !== 'rd'), rdSecs = sections.filter(s => s.group === 'rd');
  const stage = L.PROJECT_STATUSES[p.status]?.label || now.current?.label || '';
  const requests = (p.requests || []).filter(r => !r.done && r.title);
  const cab = cabinet, base = cab ? cab.base : '';
  const hid = cab ? `<input type="hidden" name="csrf" value="${esc(cab.csrf)}"><input type="hidden" name="project" value="${esc(p.id)}">` : '';
  const proto = p.protocol && (p.protocol.items || []).some(i => i.text) ? p.protocol : null;
  const docs = (p.docs || []).filter(d => d.title && L.isDate(d.until)).sort((a, b) => a.until.localeCompare(b.until));
  const advice = show.advice && p.advice?.title ? p.advice : null;
  const ird = p.ird || [];
  const meetings = (p.meetings || []).filter(x => L.isDate(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  const nextMeet = meetings.find(x => x.date >= today), pastMeet = meetings.filter(x => x.date < today).reverse();
  const msgs = cab?.messages || [];
  const has = { finance: !!fin, ird: show.ird && ird.length > 0, meet: show.meetings && (meetings.length > 0 || !!proto), docs: show.sections && sections.length > 0, plan: show.plan, nav: show.soon, model: show.soon };
  const tabs = TABS.filter(([k]) => has[k] !== false);
  const badge = { ird: ird.filter(x => ['wait', 'clarify', 'remark'].includes(x.status)).length, q: requests.length };
  const H = (a, b, sub = '', right = '') => `<div class="ph"><div><h2>${esc(a)} <span class="hl">${esc(b)}</span></h2>${sub ? `<p class="mu">${sub}</p>` : ''}</div>${right}</div>`;
  const chip = (tone, text) => `<span class="chip ${tone}">${esc(text)}</span>`;
  const form = (action, body, btn, cls = '') => (cab ? `<form class="fm${cls ? ' ' + cls : ''}" method="post" action="${base}${action}">${hid}${body}<button class="btn pri" type="submit">${esc(btn)}</button></form>` : '');
  const pop = (summary, cls, inner) => `<details class="pop"><summary class="btn ${cls}">${summary}</summary><div class="pop-b">${inner}</div></details>`;
  const mailHref = subject => (contact?.email ? `mailto:${esc(contact.email)}?subject=${encodeURIComponent((p.code ? p.code + ' ' : '') + p.name + (subject ? ' — ' + subject : ''))}` : contact?.phone ? `tel:${esc(contact.phone)}` : '');

  /* ---------- plan (Gantt of the stages with milestones) ---------- */
  const phases = now.phases;
  function gantt(full) {
    if (!phases.length) return `<p class="mu">План по этапам появится, когда ГИП задаст даты этапов.</p>`;
    const dates = phases.flatMap(x => [x.start, x.finish, x.done]).concat((p.milestones || []).map(x => x.date)).filter(L.isDate).sort();
    const from = dates[0].slice(0, 8) + '01', last = dates[dates.length - 1];
    const toD = new Date(last + 'T12:00:00Z'); toD.setUTCMonth(toD.getUTCMonth() + 1, 1);
    const to = toD.toISOString().slice(0, 10);
    const span = Math.max(1, L.dayNum(to) - L.dayNum(from));
    const pos = d => Math.min(100, Math.max(0, ((L.dayNum(d) - L.dayNum(from)) / span) * 100));
    const months = [];
    for (let d = new Date(from + 'T12:00:00Z'); d < toD; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 10));
    const year0 = from.slice(0, 4);
    const mlabel = x => `${MONTHS[Number(x.slice(5, 7)) - 1]}${x.slice(0, 4) !== year0 && x.slice(5, 7) === '01' ? ' ' + x.slice(2, 4) : ''}`;
    const rows = phases.map(x => {
      const s = L.isDate(x.start) ? x.start : x.finish, f = L.isDate(x.done) ? x.done : L.isDate(x.finish) ? x.finish : x.start;
      const cls = x.state === 'done' ? 'done' : x.state === 'now' ? 'now' : x.state === 'late' ? 'late' : 'next';
      const sub = full ? `<small>${L.isDate(x.start) ? esc(L.fmtDate(x.start)) : ''} – ${L.isDate(x.done) ? esc(L.fmtDate(x.done)) : L.isDate(x.finish) ? esc(L.fmtDate(x.finish)) : '…'}</small>` : '';
      // The current stage: the passed part solid, the rest light.
      const bar = cls === 'now' && today > s && today < f
        ? `<i class="bar now" style="left:${pos(s).toFixed(2)}%;width:${(pos(today) - pos(s)).toFixed(2)}%"></i><i class="bar rest" style="left:${pos(today).toFixed(2)}%;width:${(pos(f) - pos(today)).toFixed(2)}%"></i>`
        : `<i class="bar ${cls}" style="left:${pos(s).toFixed(2)}%;width:${Math.max(0.8, pos(f) - pos(s)).toFixed(2)}%"></i>`;
      return `<div class="gr${cls === 'now' || cls === 'late' ? ' cur' : ''}"><span class="gl">${esc(x.label)}${sub}</span><div class="gt">${bar}</div></div>`;
    }).join('');
    let lastLeft = -100, row = 0;
    const ms = (p.milestones || []).filter(x => L.isDate(x.date)).sort((a, b) => a.date.localeCompare(b.date)).map(x => {
      const left = pos(x.date); row = left - lastLeft < 14 ? 1 - row : 0; lastLeft = left;
      const up = x.date >= today && !x.done;
      return `<span class="ms${x.done || x.date < today ? ' done' : ''}${up ? ' up' : ''}${row ? ' alt' : ''}${left > 82 ? ' end' : ''}" style="left:${left.toFixed(2)}%"><i></i><b>${esc(L.fmtDate(x.date).slice(0, 5))}</b>${esc(x.title)}</span>`;
    }).join('');
    const nowLine = today >= from && today <= to ? `<i class="now-line" style="left:${pos(today).toFixed(2)}%"><b>сегодня</b></i>` : '';
    const list = `<div class="plist">${phases.map(x => `<div class="pli ${x.state}"><b>${esc(x.label)}</b><span>${L.isDate(x.start) ? esc(L.fmtDate(x.start).slice(0, 5)) : ''}–${esc(L.fmtDate(L.isDate(x.done) ? x.done : x.finish).slice(0, 8))}</span><i>${{ done: 'завершён', late: 'просрочен', now: 'идёт', next: 'впереди' }[x.state]}</i></div>`).join('')}</div>`;
    const every = Math.max(1, Math.ceil(months.length / (full ? 16 : 11))); // long plans: every 2nd or 3rd month label
    return `<div class="gantt${full ? ' full' : ''}"><div class="gr gm"><span class="gl"></span><div class="gt">${months.filter((x, i) => i % every === 0 || x.slice(0, 7) === today.slice(0, 7)).map(x => `<b style="left:${pos(x).toFixed(2)}%"${x.slice(0, 7) === today.slice(0, 7) ? ' class="hl"' : ''}>${mlabel(x)}</b>`).join('')}</div></div>
      <div class="gbody"><div class="glines"><span class="gl"></span><div>${months.map(x => `<i style="left:${pos(x).toFixed(2)}%"></i>`).join('')}${nowLine}</div></div>${rows}${ms ? `<div class="gr gms"><span class="gl">Вехи</span><div class="gt">${ms}</div></div>` : ''}</div></div>${list}`;
  }

  /* ---------- Главная ---------- */
  const late = now.behind > 0;
  // «до вехи «Заключение»» / «до окончания этапа «Экспертиза»» (projectNow gives «окончание: экспертиза» for a stage).
  const nextText = n => (/^окончание: /.test(n.title) ? `до окончания этапа «${esc(n.title.slice(11).replace(/^./, c => c.toUpperCase()))}»` : `до вехи «${esc(n.title)}»`);
  const heroLeft = now.planned ? `<div class="lbl ac"><i class="dot ac"></i>Сейчас: ${esc((now.current?.label || stage || 'проект').toLowerCase())}</div>
      <h2 class="state">${late ? `Отставание <span class="bd">${days(now.behind)}</span>` : 'Проект идёт <span class="hl">по графику</span>'}</h2>
      ${now.next ? `<div class="cnt"><span class="big">${now.daysToNext}</span><span class="mu">${plural(now.daysToNext, 'день', 'дня', 'дней')} ${nextText(now.next)}<br><b>${esc(dayMonth(now.next.date))}</b></span></div>` : ''}`
    : `<div class="lbl ac"><i class="dot ac"></i>${esc(stage || 'Проект')}</div><h2 class="state">Готовность разделов <span class="hl">${pdSecs.length ? Math.round(pdSecs.reduce((a, s) => a + (s.st.tone === 'ok' ? 100 : s.ready), 0) / pdSecs.length) : 0}%</span></h2>`;
  const meetLine = nextMeet ? `<a class="meetline" href="#meet">${ic('cal')}<span><b>${esc(dayMonth(nextMeet.date))}</b>${nextMeet.from ? ', ' + esc(nextMeet.from) : ''} · ${esc(nextMeet.title || 'Встреча')}</span></a>` : '';
  // Answer to a request: a button that opens the form in place (no scripts: <details>).
  // Files the GIP sent for approval: links in the cabinet, names on a saved page (no server to download from).
  const filesOf = r => (Array.isArray(r.files) && r.files.length ? `<ul class="files">${r.files.map(f => `<li>${cab ? `<a href="${esc(cab.base || '')}/p/${encodeURIComponent(m.project.id)}/f/${encodeURIComponent(f.id)}" download>${esc(f.name)}</a>` : esc(f.name)} <span class="mu">${fileSize(f.size)}</span></li>`).join('')}</ul>` : '');
  // With files: «Согласовано» in one click, or remarks with a text; without: a free answer.
  const answerForm = r => (cab ? (cab.sent?.[r.id] ? `<p class="sent">✓ Ваш ответ отправлен: «${esc(cab.sent[r.id])}»</p>`
    : r.files?.length ? `<div class="approve">${form('/c/answer', `<input type="hidden" name="request" value="${esc(r.id)}"><input type="hidden" name="decision" value="approve">`, 'Согласовано')}
        <details class="inl"><summary class="btn ghost">Есть замечания</summary>${form('/c/answer', `<input type="hidden" name="request" value="${esc(r.id)}"><input type="hidden" name="decision" value="remarks"><textarea name="text" required maxlength="2000" placeholder="Что поправить"></textarea>`, 'Отправить замечания')}</details></div>`
    : `<details class="inl"><summary class="btn pri">Ответить</summary>${form('/c/answer', `<input type="hidden" name="request" value="${esc(r.id)}"><textarea name="text" required maxlength="2000" placeholder="Ответ или ссылка на документ: где лежит, как передали"></textarea>`, 'Отправить ответ')}</details>`) : '');
  const dueText = r => (L.isDate(r.due) ? `до ${esc(dayMonth(r.due))}${r.due >= today ? ` · ${days(L.dayNum(r.due) - L.dayNum(today))}` : ' · срок прошёл'}` : '');
  const needCard = requests.length ? `<section class="card need"><div class="row"><span class="lbl ac">Нужно от вас</span><span class="badge">${requests.length}</span></div>
      ${requests.map((r, i) => i === 0
        ? `<div class="req"><h3>${esc(r.title)}</h3>${dueText(r) ? `<span class="pill">${dueText(r)}</span>` : ''}${r.why ? `<p class="mu">${esc(r.why)}</p>` : ''}${filesOf(r)}${answerForm(r)}${!cab && mailHref() ? `<a class="btn pri" href="${mailHref(r.title)}">Ответить ГИПу</a>` : ''}</div>`
        : `<div class="req more"><div class="row"><span><b>${esc(r.title)}</b>${dueText(r) ? `<br><span class="mu">${dueText(r)}</span>` : ''}${filesOf(r)}</span>${cab ? (cab.sent?.[r.id] ? '<span class="chip ok">ответ отправлен</span>' : pop('Ответить', 'sm ghost', answerForm(r))) : ''}</div></div>`).join('')}</section>` : '';
  const protoCard = proto ? `<section class="card"><div class="lbl">Последняя договорённость</div><a class="proto" href="#meet">Протокол${proto.no ? ` № ${esc(proto.no)}` : ''}${L.isDate(proto.date) ? ` · ${esc(L.fmtDate(proto.date))}` : ''}</a>
      ${proto.items.filter(i => i.text).slice(0, 5).map(i => { const [lbl, tone] = PROTO[i.status] || PROTO.work; return `<div class="li"><span><i class="dot ${tone}"></i>${esc(i.text)}</span><b class="${tone}">${i.status === 'work' && Number(i.pct) ? `${Number(i.pct)} %` : lbl}</b></div>`; }).join('')}</section>` : '';
  const docsCard = docs.length ? `<section class="card"><div class="row"><span class="lbl">Сроки документов</span></div>${docs.map(d => {
      const n = L.dayNum(d.until) - L.dayNum(today), r = remainText(n);
      const width = Math.max(4, Math.min(100, 100 - (n / 730) * 100));
      return `<div class="doc"><div class="row"><b>${esc(d.title)}</b>${chip(r.tone, r.text)}</div><div class="pb"><i class="${r.tone}" style="width:${width.toFixed(0)}%"></i></div><div class="mu r">до ${esc(L.fmtDate(d.until))}</div></div>`;
    }).join('')}</section>` : '';
  const adviceBar = advice ? `<section class="card rec"><span class="rec-ic">${ic('bulb')}</span><div class="grow"><div class="lbl">Рекомендуем на этом этапе</div><h3>${esc(advice.title)}</h3>${advice.text ? `<p class="mu">${esc(advice.text)}${contact ? ` — Рекомендует ${esc(contact.role || 'ГИП')} ${esc(contact.name)}` : ''}</p>` : ''}</div>
      ${cab ? pop('Обсудить', 'pri', form('/c/question', `<input type="hidden" name="to" value="${esc(contact?.name || 'ГИП')}"><textarea name="text" required maxlength="2000">Хотим обсудить: ${esc(advice.title)}</textarea>`, 'Отправить')) : mailHref() ? `<a class="btn pri" href="${mailHref(advice.title)}">Обсудить</a>` : ''}</section>` : '';
  const home = `<section class="pg" id="home">
    <div class="hero"><div class="hero-l">${heroLeft}${meetLine}</div><div class="hero-r">${show.plan ? gantt(false) + `<a class="allplan" href="#plan">Весь план работ →</a>` : ''}</div></div>
    ${needCard || protoCard || docsCard ? `<div class="g3">${needCard}${protoCard}${docsCard}</div>` : ''}
    ${adviceBar}</section>`;

  /* ---------- План работ ---------- */
  const msCards = (p.milestones || []).filter(x => L.isDate(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  const nextMs = msCards.find(x => !x.done && x.date >= today);
  const plan = has.plan ? `<section class="pg" id="plan">${H('План', 'работ', 'Укрупнённый календарный план с реперными датами. Сроки меняются только через протокол')}
    <div class="panel sky">${gantt(true)}</div>
    ${msCards.length ? `<div class="mscards">${msCards.map(x => { const k = x === nextMs ? 'next' : x.done || x.date < today ? 'done' : 'ahead';
      return `<div class="card msc ${k}"><div class="lbl${k === 'next' ? ' ac' : ''}">${k === 'next' ? `Следующая · через ${days(L.dayNum(x.date) - L.dayNum(today))}` : k === 'done' ? 'Пройдено' : 'Впереди'}</div><div class="msd">${esc(L.fmtDate(x.date))}</div><b>${esc(x.title)}</b></div>`; }).join('')}</div>` : ''}</section>` : '';

  /* ---------- Договор и финансы ---------- */
  let finance = '';
  if (fin) {
    const c = fin.contract, paid = fin.payments.filter(x => x.status === 'paid').reduce((a, x) => a + x.sum, 0), sum = c.sum || fin.payments.reduce((a, x) => a + x.sum, 0);
    const [cl, ct] = CONTRACT[c.status] || CONTRACT.signed;
    finance = `<section class="pg" id="finance">${H('Договор', 'и финансы', 'Стоимость, график оплат, договор, счета и акты')}
      <div class="g2"><div class="stack"><section class="card"><div class="row"><span class="lbl">Договор</span>${chip(ct, cl)}</div><h3>№ ${esc(c.no)}${L.isDate(c.date) ? ` от ${esc(L.fmtDate(c.date))}` : ''}</h3>${c.subject ? `<p class="mu">${esc(c.subject)}</p>` : ''}
          <div class="money"><div><span class="lbl">Стоимость</span><b>${rub(sum)}</b></div><div><span class="lbl">Оплачено</span><b class="ok">${rub(paid)}</b></div><div><span class="lbl">Осталось</span><b>${rub(Math.max(0, sum - paid))}</b></div></div>
          <div class="pb big"><i class="wr" style="width:${sum ? Math.min(100, (paid / sum) * 100).toFixed(1) : 0}%"></i></div></section>
        ${fin.payments.length ? `<section class="card"><div class="lbl">График оплат</div><div class="tw"><table class="tb"><thead><tr><th>Этап</th><th>Сумма</th><th>Условие</th><th>Статус</th></tr></thead><tbody>
          ${fin.payments.map(x => { const [l, t] = PAY[x.status] || PAY.upcoming; return `<tr><td><b>${esc(x.title)}</b></td><td class="nw">${rub(x.sum)}</td><td class="mu">${esc(x.cond)}</td><td>${chip(t, l + (L.isDate(x.date) ? ` ${x.status === 'upcoming' ? '· ~' : ''}${L.fmtDate(x.date).slice(0, 5)}` : ''))}</td></tr>`; }).join('')}</tbody></table></div></section>` : ''}</div>
        ${fin.bills.length ? `<section class="card"><div class="lbl">Счета и акты</div>${fin.bills.map(x => { const [l, t] = BILL[x.status] || BILL.to_pay; return `<div class="bill"><b>${esc(x.title)}</b><span class="mu nw">${L.isDate(x.date) ? esc(L.fmtDate(x.date)) : ''}</span>${chip(t, l + (x.status === 'to_pay' && L.isDate(x.due) ? ` до ${L.fmtDate(x.due).slice(0, 5)}` : ''))}</div>`; }).join('')}
          <p class="note">${ic('shield')}Оригиналы документов — у ГИПа и в бухгалтерии; по вопросам оплаты свяжитесь с ГИПом.</p></section>` : ''}</div></section>`;
  }

  /* ---------- Исходные данные ---------- */
  let irdPage = '';
  if (has.ird) {
    const acc = ird.filter(x => ['accepted', 'done'].includes(x.status)).length;
    const cnt = k => ird.filter(x => x.status === k).length;
    irdPage = `<section class="pg" id="ird">${H('Исходные', 'данные', 'Что нужно для проектирования и в каком оно состоянии')}
      <div class="g2 wide"><section class="card"><div class="tw"><table class="tb"><thead><tr><th>Документ</th><th>Кто готовит</th><th>Статус</th><th>Срок</th></tr></thead><tbody>
        ${ird.map(x => { const [l, t] = IRD[x.status] || IRD.plan, rq = requests.find(r => r.irdId === x.id);
          // Asked by the GIP: the customer hands it over right from the row (cabinet), the answer goes to the GIP.
          const hand = rq && cab ? (cab.sent?.[rq.id] ? `<p class="sent">✓ Отправлено: «${esc(cab.sent[rq.id])}»</p>` : `<details class="inl"><summary class="btn sm pri">Передать</summary>${form('/c/answer', `<input type="hidden" name="request" value="${esc(rq.id)}"><textarea name="text" required maxlength="2000" placeholder="Ссылка на документ, номер письма или как передали"></textarea>`, 'Отправить ГИПу')}</details>`) : '';
          return `<tr${rq ? ' class="asked"' : ''}><td>${IRD_KIND[x.kind] ? `<span class="kind">${IRD_KIND[x.kind]}</span>` : ''}<b>${esc(x.title)}</b>${x.note ? `<br><span class="mu">${esc(x.note)}</span>` : ''}${hand}</td><td class="mu">${esc(x.who)}</td><td>${chip(t, rq && x.status !== 'remark' ? 'Ждём от вас' : l)}</td><td class="nw">${L.isDate(x.due) ? `${['accepted', 'done'].includes(x.status) ? '' : 'до '}${esc(L.fmtDate(x.due))}` : esc(x.due || '')}</td></tr>`; }).join('')}</tbody></table></div></section>
        <div class="stack"><section class="card"><div class="lbl">Принято</div><div class="bignum">${acc} <span class="mu">из ${ird.length}</span></div><div class="pb big"><i class="wr" style="width:${ird.length ? ((acc / ird.length) * 100).toFixed(1) : 0}%"></i></div>
          <div class="chips">${cnt('wait') + cnt('clarify') ? chip('ac', `Ждём от вас · ${cnt('wait') + cnt('clarify')}`) : ''}${cnt('requested') ? chip('wk', `Запросили мы · ${cnt('requested')}`) : ''}${cnt('remark') ? chip('bd', `Замечание · ${cnt('remark')}`) : ''}</div></section>
          <section class="card sky"><div class="lbl ac"><i class="dot ac"></i>Как передать документ</div><p>${cab ? 'Нажмите «Передать» в строке документа, который мы запросили: дайте ссылку на файл, номер письма или напишите, как передали оригинал. ГИП примет документ или вернёт с замечанием.' : 'Пришлите документ ГИПу по почте или передайте с курьером.'}</p>${cab ? '' : mailHref() ? `<a class="btn pri" href="${mailHref('исходные данные')}">Написать ГИПу</a>` : ''}</section></div></div></section>`;
  }

  /* ---------- Вопросы ---------- */
  const sentQ = msgs.filter(x => ['question', 'urgent', 'call', 'meeting'].includes(x.kind));
  const sentA = msgs.filter(x => x.kind === 'answer');
  const qItems = [
    ...requests.map((r, i) => ({ cls: 'wait', html: `<div class="qi wait"><div class="row"><span><span class="mu">#${requests.length - i}</span> <b>${esc(r.title)}</b></span><span class="st ac">Ждёт вас</span></div><p class="mu">${esc(contact?.name || 'ГИП')} → вам${L.isDate(r.due) ? ` · до ${esc(L.fmtDate(r.due).slice(0, 5))}` : ''}${r.why ? ` · ${esc(r.why)}` : ''}</p>${filesOf(r)}${answerForm(r)}</div>` })),
    ...sentQ.map(x => ({ cls: 'tandem', html: `<div class="qi tandem"><div class="row"><b>${esc(x.text.slice(0, 160))}</b><span class="st wk">${x.kind === 'urgent' ? 'Горящий · ждёт «Тандем»' : x.kind === 'call' ? 'Просьба перезвонить' : x.kind === 'meeting' ? 'Перенос встречи' : 'Ждёт «Тандем»'}</span></div><p class="mu">Вы → ${esc(x.to || contact?.name || 'ГИП')} · ${esc(L.fmtDate(String(x.ts).slice(0, 10)))}</p></div>` })),
    ...sentA.map(x => ({ cls: 'answered', html: `<div class="qi answered"><div class="row"><b>${esc(x.requestTitle || 'Ответ на запрос')}</b><span class="st ok">Ответ отправлен</span></div><p class="mu">Вы → ${esc(contact?.name || 'ГИП')} · ${esc(L.fmtDate(String(x.ts).slice(0, 10)))}</p><div class="ans">${esc(x.text)}</div></div>` })),
  ];
  const nQ = k => qItems.filter(x => x.cls === k).length;
  const toList = [...(contact ? [{ name: contact.name, role: contact.role || 'ГИП' }] : []), ...team.filter(t => t.name !== contact?.name)];
  const askBox = cab ? `<section class="card"><div class="lbl">Задать вопрос</div><form class="fm" method="post" action="${base}/c/question">${hid}
      ${toList.length ? `<div class="to">${toList.map((t, i) => `<label><input type="radio" name="to" value="${esc(t.name)}"${i ? '' : ' checked'}><span>${esc(shortName(t.name))}${t.role ? ', ' + esc(String(t.role).split(', ').slice(-1)[0]) : ''}</span></label>`).join('')}</div>` : ''}
      <textarea name="text" required maxlength="2000" placeholder="Например: можно ли перенести въезд на северную сторону участка?"></textarea><button class="btn pri" type="submit">Отправить</button></form>
      <div class="burnbox">${ic('fire')}<div class="grow"><b>Нужно срочно?</b><p class="mu">Горящий вопрос — ГИП увидит его сразу</p></div>${pop('Горящий', 'pri sm', form('/c/urgent', '<textarea name="text" required maxlength="2000" placeholder="Опишите вопрос — ГИП увидит его сразу"></textarea>', 'Отправить ГИПу'))}</div>
      <p class="mu small">Ответ придёт от специалиста по телефону или почте.</p></section>`
    : `<section class="card"><div class="lbl">Задать вопрос</div><p class="mu">Вопросы по проекту — главному инженеру проекта.</p>${mailHref() ? `<a class="btn pri" href="${mailHref('вопрос')}">Написать ГИПу</a>` : ''}${contact?.phone ? `<a class="btn" href="tel:${esc(contact.phone)}">${ic('phone')}${esc(contact.phone)}</a>` : ''}</section>`;
  const qPage = `<section class="pg" id="q"><span id="q-wait" class="anchor"></span><span id="q-tandem" class="anchor"></span><span id="q-answered" class="anchor"></span>
    ${H('Вопросы', 'и ответы', 'У каждого вопроса есть ответственный и срок', `<div class="seg qf"><a href="#q" class="all">Все · ${qItems.length}</a><a href="#q-wait" class="f-wait">Ждут вас · ${nQ('wait')}</a>${cab ? `<a href="#q-tandem" class="f-tandem">Ждут «Тандем» · ${nQ('tandem')}</a><a href="#q-answered" class="f-answered">Отвеченные · ${nQ('answered')}</a>` : ''}</div>`)}
    <div class="g2 wide"><div class="stack ql">${qItems.map(x => x.html).join('') || '<section class="card"><p class="mu">Открытых вопросов нет.</p></section>'}</div>${askBox}</div></section>`;

  /* ---------- Встречи и протоколы ---------- */
  let meetPage = '';
  if (has.meet) {
    const W = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const wd = d => WD[new Date(d + 'T12:00:00Z').getUTCDay()];
    meetPage = `<section class="pg" id="meet">${H('Встречи', 'и протоколы', 'Встреча → протокол → поручения. Статус проекта обновляется по последнему протоколу')}
      <div class="g2"><div class="stack">${nextMeet ? `<section class="card sky"><div class="lbl ac"><i class="dot ac"></i>Ближайшая встреча</div>
          <div class="mt"><div class="dbox"><b>${Number(nextMeet.date.slice(8))}</b><span>${MONTHS[Number(nextMeet.date.slice(5, 7)) - 1]}</span></div><div><h3>${esc(nextMeet.title || 'Встреча')}</h3><p class="mu">${wd(nextMeet.date)}${nextMeet.from ? `, ${esc(nextMeet.from)}${nextMeet.to ? '–' + esc(nextMeet.to) : ''}` : ''}${nextMeet.place ? ` · ${esc(nextMeet.place)}` : ''}</p></div></div>
          ${cab ? `<div class="btns"><a class="btn" href="${base}/p/${encodeURIComponent(p.id)}/meeting/${encodeURIComponent(nextMeet.id)}.ics">В календарь</a>${pop('Перенести', '', form('/c/meeting', `<input type="hidden" name="meeting" value="${esc(nextMeet.id)}"><textarea name="text" required maxlength="600" placeholder="Когда вам удобно?"></textarea>`, 'Попросить перенести'))}</div>` : ''}</section>` : ''}
        ${pastMeet.length ? `<section class="card"><div class="lbl">Прошедшие</div>${pastMeet.slice(0, 8).map(x => `<div class="pm"><b>${x.protocolNo ? `№ ${esc(x.protocolNo)}` : esc(L.fmtDate(x.date).slice(0, 5))}</b><span><b>${esc(x.title || 'Встреча')}</b><br><span class="mu">${esc(L.fmtDate(x.date))}${x.place ? ' · ' + esc(x.place) : ''}</span></span></div>`).join('')}</section>` : ''}
        ${!nextMeet && !pastMeet.length ? '<section class="card"><p class="mu">Встречи пока не назначены.</p></section>' : ''}</div>
        ${proto ? `<section class="card"><div class="lbl">Протокол${proto.no ? ` № ${esc(proto.no)}` : ''}${L.isDate(proto.date) ? ` · ${esc(L.fmtDate(proto.date))}` : ''}</div><h3>Решения и поручения</h3>
          <div class="tw"><table class="tb"><thead><tr><th>Решение</th><th>Ответственный</th><th>Срок</th><th>Статус</th></tr></thead><tbody>
          ${proto.items.filter(i => i.text).map((i, n) => { const [l, t] = PROTO[i.status] || PROTO.work; return `<tr><td><b>${n + 1}. ${esc(i.text)}</b></td><td class="mu">${i.who === 'customer' ? 'Заказчик' : '«Тандем»'}</td><td class="nw">${L.isDate(i.due) ? esc(L.fmtDate(i.due).slice(0, 5)) : '—'}</td><td>${chip(t, i.status === 'work' && Number(i.pct) ? `${Number(i.pct)} %` : l.replace(/^./, s => s.toUpperCase()))}</td></tr>`; }).join('')}</tbody></table></div></section>` : '<section class="card"><p class="mu">Протокол последней встречи появится здесь.</p></section>'}</div></section>`;
  }

  /* ---------- Документация ---------- */
  let docsPage = '';
  if (has.docs) {
    const stOf = s => (s.st.tone === 'ok' ? (s.rev ? ['Актуальная', 'ok'] : ['Выпущен', 'ok']) : s.st.label === 'Внутренняя проверка' ? ['Внутренняя проверка', 'wk'] : [s.st.label, s.st.tone]);
    const table = (list, title) => `<section class="card"><div class="lbl">${esc(title)}</div><div class="tw"><table class="tb"><thead><tr><th>Раздел</th><th>Шифр</th>${show.revisions ? '<th>Изм.</th>' : ''}<th>Статус</th><th>Дата</th></tr></thead><tbody>
      ${list.map(s => { const [l, t] = stOf(s); return `<tr><td><b>${esc(s.title || s.k)}</b>${s.title && s.k && !s.code ? `<br><span class="mu">${esc(s.k)}</span>` : ''}</td><td class="mono nw">${esc(s.code || s.k)}</td>${show.revisions ? `<td>${s.rev ? esc(s.rev.no) : '0'}</td>` : ''}<td>${chip(t, l + (t === 'wk' && s.ready && s.st.tone !== 'ok' && l === 'В работе' ? ` · ${s.ready} %` : ''))}</td><td class="nw">${s.rev && L.isDate(s.rev.date) ? esc(L.fmtDate(s.rev.date)) : L.isDate(s.finish) ? esc(L.fmtDate(s.finish)) : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    const doneN = pdSecs.filter(s => s.st.tone === 'ok').length;
    const history = show.revisions ? sections.flatMap(s => (s.revs || []).map(r => ({ ...r, k: s.k }))).filter(r => L.isDate(r.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8) : [];
    const stageLabel = rdSecs.length ? (p.rdMode === 'parallel' ? 'Стадии П и Р · РД параллельно с экспертизой' : 'Стадии П и Р') : 'Стадия П';
    docsPage = `<section class="pg" id="docs">${H('Проектная', 'документация', `${stageLabel}${m.byDecree ? ' · состав по ПП РФ № 87' : ''}`)}
      <div class="g2 wide"><div class="stack">${pdSecs.length ? table(pdSecs, 'Проектная документация') : ''}${rdSecs.length ? table(rdSecs, 'Рабочая документация') : ''}</div>
        <div class="stack"><section class="card"><div class="lbl">Выполнено</div><div class="bignum">${doneN} <span class="mu">из ${pdSecs.length}</span></div><div class="pb big"><i class="ok" style="width:${pdSecs.length ? ((doneN / pdSecs.length) * 100).toFixed(1) : 0}%"></i></div><p class="mu small">Готовность разделов — по оценке проектной команды.</p></section>
        ${history.length ? `<section class="card"><div class="lbl">История изменений</div>${history.map(r => `<div class="hi"><div class="row"><b>${esc(r.k)} · Изм. ${esc(r.no)}</b><span class="mu">${esc(L.fmtDate(r.date).slice(0, 5))}</span></div>${r.note ? `<p class="mu">${esc(r.note)}</p>` : ''}</div>`).join('')}</section>` : ''}
        <section class="card sky"><div class="lbl ac"><i class="dot ac"></i>Файлы разделов</div><p class="mu">Скачивание разделов и ссылки для подрядчика появятся в кабинете позже. Сейчас актуальную редакцию присылает ГИП.</p></section></div></div></section>`;
  }

  /* ---------- Навигатор и 3D: «скоро» ---------- */
  const soon = (id, a, b, icon, text) => `<section class="pg" id="${id}">${H(a, b)}<section class="card soon"><span class="soon-ic">${ic(icon)}</span><div><span class="chip neu">Скоро</span><h3>${esc(a)} ${esc(b)}</h3><p class="mu">${text}</p><a class="btn" href="#q">Задать вопрос</a></div></section></section>`;
  const navPage = has.nav ? soon('nav', 'Навигатор', 'по проекту', 'nav', 'Спросите, где что в документации, — покажем раздел, лист и место на листе. Пока задайте вопрос во вкладке «Вопросы».') : '';
  const modelPage = has.model ? soon('model', '3D-модель', 'объекта', 'model', 'Просмотр модели здания в браузере — без установки программ. Пока модель показывает ГИП на встрече.') : '';

  /* ---------- «Ещё» for phones ---------- */
  const morePage = `<section class="pg" id="more">${H('Все', 'разделы')}<div class="morelist">${tabs.map(([k, l]) => `<a href="#${k}">${ic(k)}<span>${esc(l)}</span>${badge[k] ? `<i class="bdg">${badge[k]}</i>` : ''}</a>`).join('')}
    ${cab && cab.projects > 1 ? `<a href="${base}/">${ic('briefcase')}<span>Мои проекты</span><i class="bdg neu">${cab.projects}</i></a>` : ''}</div>
    ${contact ? `<section class="card"><div class="lbl">Ваш ГИП</div><div class="gip"><span class="ava ac">${esc(initials(contact.name))}</span><span><b>${esc(contact.name)}</b><br><span class="mu">${esc(contact.role || 'Главный инженер проекта')}</span>${contact.phone ? `<br><a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a>` : ''}${contact.email ? `<br><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}</span></div></section>` : ''}
    ${cab ? `<form method="post" action="${base}/logout"><input type="hidden" name="csrf" value="${esc(cab.csrf)}"><button class="btn" type="submit">${ic('out')}Выйти (${esc(cab.customerName || '')})</button></form>` : ''}</section>`;

  /* ---------- frame: sidebar, top bar, phone bottom bar ---------- */
  const teamBlock = contact || team.length ? `<div class="team"><span class="nav-l">Команда проекта</span>${contact ? `<div class="gip"><span class="ava ac">${esc(initials(contact.name))}</span><span><b>${esc(contact.name)}</b><br><span class="mu">${esc(contact.role || 'ГИП')}</span>${contact.phone ? `<br><a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a>` : ''}${contact.email ? `<br><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}</span></div>` : ''}
    ${team.filter(t => t.name !== contact?.name).length ? `<div class="others"><span class="avas">${team.filter(t => t.name !== contact?.name).slice(0, 4).map(t => `<span class="ava sm" title="${esc(t.name)}">${esc(initials(t.name))}</span>`).join('')}</span><span class="mu">${esc([...new Set(team.filter(t => t.name !== contact?.name).map(t => String(t.role || '').split(', ').slice(1).join(', ') || t.role).filter(Boolean))].join(', '))}</span></div>` : ''}</div>` : '';
  const side = `<aside class="side"><div class="brand">${logoSvg}<b>${esc(cab?.title || 'Мой Тандем')}</b></div>
    ${cab && cab.projects > 1 ? `<a class="myp" href="${base}/">${ic('briefcase')}<span>Мои проекты</span><i>${cab.projects}</i></a>` : ''}
    <nav class="tabs" aria-label="Разделы проекта"><span class="nav-l">${esc(p.name)}</span>${tabs.map(([k, l]) => `<a class="tab t-${k}" href="#${k}">${ic(k)}<span>${esc(l)}</span>${badge[k] ? `<i class="bdg">${badge[k]}</i>` : ''}</a>`).join('')}</nav>
    <div class="grow"></div>${teamBlock}
    ${cab ? `<div class="who"><span class="mu">Вы вошли как</span> <b>${esc(cab.customerName || '')}</b><form method="post" action="${base}/logout"><input type="hidden" name="csrf" value="${esc(cab.csrf)}"><button class="lnk" type="submit">${ic('out')}Выйти</button></form></div>` : `<div class="who mu">${p.client ? esc(p.client) + ' · ' : ''}данные на ${esc(L.fmtDate(today))}</div>`}</aside>`;
  const actions = cab
    ? `${pop(`${ic('phone')}<span>Перезвоните мне</span>`, '', form('/c/call', '<input name="text" maxlength="300" placeholder="Когда удобно и по какому вопросу">', 'Попросить звонок'))}${pop(`${ic('fire')}<span>Горящий вопрос</span>`, 'burn', form('/c/urgent', '<textarea name="text" required maxlength="2000" placeholder="Опишите вопрос — ГИП увидит его сразу"></textarea>', 'Отправить ГИПу'))}`
    : `${contact?.phone ? `<a class="btn" href="tel:${esc(contact.phone)}">${ic('phone')}<span>Позвонить ГИПу</span></a>` : ''}${contact?.email ? `<a class="btn burn" href="mailto:${esc(contact.email)}">${ic('q')}<span>Написать</span></a>` : ''}`;
  const top = `<header class="top"><div class="top-t"><h1>${esc(p.name)}</h1>${p.code ? `<span class="mu">Шифр ${esc(p.code)}</span>` : ''}${stage ? `<span class="chip wk">${esc(stage)}</span>` : ''}</div><div class="top-a">${actions}</div></header>${cab?.flash ? `<div class="flash">${esc(cab.flash)}</div>` : ''}`;
  const bn = ['home', 'plan', has.ird ? 'ird' : 'docs', 'q'].filter(k => tabs.some(t => t[0] === k));
  const bnav = `<nav class="bnav" aria-label="Разделы проекта">${bn.map(k => `<a class="bn t-${k}" href="#${k}">${ic(k)}<span>${esc(TABS.find(t => t[0] === k)[2])}</span>${badge[k] ? `<i class="bdg">${badge[k]}</i>` : ''}</a>`).join('')}<a class="bn t-more" href="#more">${ic('more')}<span>Ещё</span></a></nav>`;

  // Active section: the target, or «Главная» when nothing is targeted (q-* anchors keep «Вопросы» open).
  const ids = [...tabs.map(t => t[0]), 'more'];
  const activeCss = ids.map(k => `body:has(#${k}:target) #${k}{display:flex}body:has(#${k}:target) .t-${k}{background:var(--acs);color:var(--act);font-weight:600;box-shadow:inset 3px 0 0 var(--ac)}body:has(#${k}:target) .bn.t-${k}{box-shadow:inset 0 2px 0 var(--ac);background:none}`).join('')
    + `body:not(:has(.pg:target)):not(:has(.anchor:target)) #home{display:flex}body:not(:has(.pg:target)):not(:has(.anchor:target)) .t-home{background:var(--acs);color:var(--act);font-weight:600;box-shadow:inset 3px 0 0 var(--ac)}body:not(:has(.pg:target)):not(:has(.anchor:target)) .bn.t-home{box-shadow:inset 0 2px 0 var(--ac);background:none}`
    + `body:has(.anchor:target) #q{display:flex}body:has(.anchor:target) .t-q{background:var(--acs);color:var(--act);font-weight:600;box-shadow:inset 3px 0 0 var(--ac)}`
    + ['wait', 'tandem', 'answered'].map(k => `body:has(#q-${k}:target) .qi:not(.${k}){display:none}body:has(#q-${k}:target) .qf .f-${k}{background:var(--acs);color:var(--act);box-shadow:inset 0 -2px 0 var(--ac)}`).join('')
    + `body:not(:has(.anchor:target)) .qf .all{background:var(--acs);color:var(--act);box-shadow:inset 0 -2px 0 var(--ac)}`;

  const face = fontBase64 || fontUrl ? `@font-face{font-family:"${fontName}";src:url(${fontUrl ? esc(fontUrl) : `data:font/ttf;base64,${fontBase64}`}) format("truetype");font-weight:300 900}` : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.name)} — Мой Тандем</title><style>
${face}
:root{--bg:#F2F4F7;--s:#fff;--ink:#1D1E21;--mu:#5E6673;--ln:#DFE4EA;--ln2:#EDF0F4;--ac:#F26A1F;--act:#B04E0D;--hl:#EE6418;--acs:#FFF4EC;--acl:#F6D6C1;--sky:#EAF0F7;--sky2:#D6E0EC;--slate:#3B4B60;--slates:#9DAEC2;
--ok:#1E7A45;--okb:#E3F2E8;--wk:#2457A6;--wkb:#E4ECF8;--wr:#A34700;--wrb:#FFF0E3;--bd:#B3261E;--bdb:#FCE8E6;--neu:#4B5361;--nb:#EDF0F4;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--ink);font:14.5px/1.45 "${fontName}","Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;display:grid;grid-template-columns:248px minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:"side top" "side main";min-height:100vh}
a{color:inherit}h1,h2,h3{font-weight:500;letter-spacing:-.01em;margin:0}p{margin:0}button,input,textarea{font:inherit;color:inherit}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.mu{color:var(--mu)}.small{font-size:12.5px}.r{text-align:right}.nw{white-space:nowrap}.mono{font-variant-numeric:tabular-nums;letter-spacing:.02em}.grow{flex:1}
.hl{color:var(--hl)}.ac{color:var(--act)}.bd{color:var(--bd)}.ok{color:var(--ok)}.wk{color:var(--wk)}
.lbl{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--mu);display:flex;align-items:center;gap:8px}.lbl.ac{color:var(--act)}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--wk);flex:none}.dot.ac{background:var(--ac);box-shadow:0 0 0 3px var(--acl)}.dot.ok{background:var(--ok)}.dot.wk{background:var(--wk)}
/* sidebar */
.side{grid-area:side;background:var(--s);border-right:1px solid var(--ln);display:flex;flex-direction:column;gap:16px;padding:18px 12px 16px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{padding:0 8px}.brand svg{height:38px;display:block}.brand b{display:block;color:var(--act);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:6px}
.myp{display:flex;align-items:center;gap:10px;border:1px solid var(--ln);padding:11px 12px;text-decoration:none;font-weight:600}.myp i{margin-left:auto;font-style:normal;color:var(--mu);font-weight:500}
.nav-l{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);padding:0 12px 6px;display:block;line-height:1.35}
.tabs{display:flex;flex-direction:column;gap:2px}.tab{display:flex;align-items:center;gap:11px;padding:10px 12px;text-decoration:none;font-weight:500;font-size:14px;white-space:nowrap}.tab span{overflow:hidden;text-overflow:ellipsis}.tab .ic{color:var(--mu)}.tab:hover{background:var(--ln2)}
.bdg{margin-left:auto;min-width:21px;height:21px;padding:0 6px;background:var(--ac);color:#fff;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-style:normal;border-radius:11px}
.team{border-top:1px solid var(--ln);padding-top:14px;display:grid;gap:10px}.team .nav-l{padding-left:8px}.gip,.others{display:flex;gap:10px;align-items:center;padding:0 8px;font-size:13px}.gip b{font-weight:600}
.ava{width:34px;height:34px;border-radius:50%;background:var(--nb);color:var(--slate);display:grid;place-items:center;font-weight:700;font-size:12px;flex:none}.ava.ac{background:var(--ac);color:#fff}.ava.sm{width:28px;height:28px;font-size:10.5px;margin-right:-4px;border:2px solid var(--s)}.avas{display:flex}.others .mu{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.who{font-size:12.5px;padding:0 8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}.who form{margin-left:auto}.lnk{background:none;border:0;padding:0;display:inline-flex;gap:4px;align-items:center;color:var(--mu);cursor:pointer;font-size:12.5px}.lnk .ic{width:16px;height:16px}
/* top bar */
.top{grid-area:top;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 24px;background:var(--s);border-bottom:1px solid var(--ln);position:sticky;top:0;z-index:4}
.top-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;flex:1;min-width:0}.top-t h1{font-size:18px;font-weight:600}.top-a{display:flex;gap:8px;flex-wrap:wrap}
.flash{grid-column:2;margin:12px 24px 0;padding:10px 14px;background:var(--okb);color:var(--ok);font-weight:600}
main{grid-area:main;padding:24px;min-width:0}
/* controls */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:1px solid var(--ln);background:var(--s);color:var(--ink);font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap;cursor:pointer;list-style:none}
.btn::-webkit-details-marker{display:none}.btn:hover{border-color:var(--ac)}.btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}.btn.pri:hover{background:#E45E14}
.btn.burn{background:var(--acs);border-color:var(--acl);color:var(--act)}.btn.sm{min-height:34px;padding:0 12px;font-size:12.5px}.btn.ghost{color:var(--act);border-color:var(--acl)}
.btns{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-block;padding:3px 8px;font-size:12px;font-weight:600;white-space:nowrap;line-height:1.35}.chip.ok{background:var(--okb);color:var(--ok)}.chip.wk{background:var(--wkb);color:var(--wk)}.chip.wr,.chip.ac{background:var(--wrb);color:var(--wr)}.chip.bd{background:var(--bdb);color:var(--bd)}.chip.neu{background:var(--nb);color:var(--neu)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.pill{display:inline-block;border:1px solid var(--acl);color:var(--act);background:var(--s);padding:3px 9px;font-size:12.5px;font-weight:600}
.badge{background:var(--ac);color:#fff;border-radius:12px;min-width:24px;height:24px;display:inline-grid;place-items:center;font-weight:700;font-size:12.5px;padding:0 7px}
textarea,input[name=text]{width:100%;border:1px solid var(--ln);background:var(--s);padding:10px 12px;font-size:13.5px;min-height:42px}textarea{min-height:84px;resize:vertical}textarea:focus,input:focus{outline:0;border-color:var(--ac)}
.fm{display:grid;gap:8px;margin-top:10px}.sent{color:var(--ok);font-size:13px;margin-top:8px}
.inl>summary{list-style:none;display:inline-flex}.inl>summary::-webkit-details-marker{display:none}.inl[open]>summary{display:none}.inl .fm{margin-top:0}
.pop{position:relative}.pop>summary{list-style:none}.pop-b{position:absolute;right:0;top:calc(100% + 6px);z-index:6;width:340px;max-width:80vw;background:var(--s);border:1px solid var(--ln);padding:14px;box-shadow:0 10px 28px rgba(29,30,33,.14)}.pop-b .fm{margin:0}
.seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--ln);background:var(--s)}.seg a{min-height:38px;display:inline-flex;align-items:center;padding:0 12px;border-right:1px solid var(--ln);font-size:12.5px;font-weight:600;color:var(--mu);text-decoration:none}.seg a:last-child{border-right:0}
/* pages */
.pg{display:none;flex-direction:column;gap:16px;scroll-margin-top:400px}.pg{position:relative}.anchor{position:absolute;top:0;left:0;height:0;scroll-margin-top:400px}
.ph{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px}.ph h2{font-size:26px}.ph p{margin-top:4px}
.card{background:var(--s);border:1px solid var(--ln);padding:18px;min-width:0;display:flex;flex-direction:column;gap:12px}.card h3{font-size:18px}.card.sky,.panel.sky{background:var(--sky);border-color:var(--sky2)}
.panel{border:1px solid var(--ln);padding:20px 22px}.stack{display:flex;flex-direction:column;gap:16px;min-width:0}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}.g2{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start}.g2.wide{grid-template-columns:minmax(0,1fr) 340px}
.hero{display:grid;grid-template-columns:300px minmax(0,1fr);gap:28px;background:var(--sky);border:1px solid var(--sky2);padding:22px 24px}.hero-l{display:flex;flex-direction:column;gap:12px}
.state{font-size:30px;line-height:1.15}.state span{display:block}.cnt{display:flex;gap:14px;align-items:center}.big{font-size:84px;font-weight:600;color:var(--ac);line-height:.9;letter-spacing:-.04em}.cnt .mu{font-size:13.5px}.cnt b{color:var(--ink)}
.meetline{display:flex;gap:10px;align-items:flex-start;text-decoration:none;font-size:13px;color:var(--mu)}.meetline .ic{color:var(--ac)}.meetline b{color:var(--ink)}
.hero-r{position:relative;min-width:0;padding-top:26px}.allplan{position:absolute;right:0;top:0;font-size:13px;font-weight:600;color:var(--act);text-decoration:none}
/* gantt */
.gantt{position:relative}.gr{display:grid;grid-template-columns:170px minmax(0,1fr);align-items:center;min-height:23px;font-size:12.5px;color:var(--mu)}.gantt.full .gr{grid-template-columns:240px minmax(0,1fr);min-height:44px;font-size:13.5px}
.gl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:10px}.gl small{display:block;font-size:11px;color:var(--mu)}.gr.cur .gl{color:var(--ink);font-weight:600}.gantt.full .gl{color:var(--ink)}
.gt{position:relative;height:12px}.gm .gt{height:22px}.gm b{position:absolute;font-size:10.5px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.05em}.gm b.hl{color:var(--ac)}
.gbody{position:relative}.glines{position:absolute;inset:0;display:grid;grid-template-columns:170px minmax(0,1fr)}.gantt.full .glines{grid-template-columns:240px minmax(0,1fr)}.glines>div{position:relative}.glines i{position:absolute;top:0;bottom:0;border-left:1px solid var(--sky2)}
.now-line{position:absolute;top:-30px;bottom:0;border-left:1.5px dashed var(--ac)!important;z-index:1}.now-line b{position:absolute;top:-2px;left:4px;font-size:10.5px;font-weight:700;color:var(--ac);text-transform:uppercase;letter-spacing:.05em}
.bar{position:absolute;top:0;height:12px}.bar.done{background:var(--slates)}.bar.now{background:var(--ac)}.bar.rest{background:var(--acl)}.bar.late{background:var(--bd)}.bar.next{background:var(--s);border:1px solid var(--sky2)}
.gms{min-height:96px!important;align-items:start;padding-top:10px}.ms{position:absolute;font-size:11px;color:var(--mu);white-space:nowrap;transform:translateX(-6px);line-height:1.3}.ms i{display:block;width:11px;height:11px;transform:rotate(45deg);background:var(--slate);margin-bottom:4px}.ms b{display:block;color:var(--ink)}
.ms.done i{background:var(--slate)}.ms:not(.done) i{background:var(--s);border:1.5px solid var(--slate)}.ms.up i{background:var(--ac);border-color:var(--ac);box-shadow:0 0 0 3px var(--acl)}.ms.up,.ms.up b{color:var(--act)}.ms.alt{top:46px}.ms.end{transform:translateX(calc(-100% + 6px));text-align:right}.ms.end i{margin-left:auto}
.plist{display:none}
/* home cards */
.files{list-style:none;margin:0;padding:0;display:grid;gap:4px}.files li{font-size:14px}.files a{color:var(--act);font-weight:600}.approve{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}.approve .fm{margin:0}.need{background:var(--acs);border-color:var(--acl)}.req{display:flex;flex-direction:column;gap:10px;align-items:flex-start}.req h3{font-size:19px}.req .btn{align-self:flex-start}.req.more{border-top:1px solid var(--acl);padding-top:12px}.req.more .row{width:100%;align-items:center}
.proto{color:var(--act);font-weight:600;text-decoration:underline;text-underline-offset:3px}.li{display:flex;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid var(--ln2);font-size:13.5px}.li b{white-space:nowrap}.li span{display:flex;gap:10px;align-items:baseline}.li .dot{transform:translateY(-1px)}
.doc{padding:4px 0 10px;border-bottom:1px solid var(--ln2)}.doc:last-child{border:0}.doc .mu{font-size:12px}
.pb{height:5px;background:var(--ln);margin:8px 0 3px}.pb.big{height:7px}.pb i{display:block;height:100%}.pb i.bd{background:var(--bd)}.pb i.wr{background:var(--ac)}.pb i.ok{background:var(--ok)}
.rec{flex-direction:row;align-items:center;gap:18px}.rec-ic{width:44px;height:44px;border-radius:50%;background:var(--acs);display:grid;place-items:center;color:var(--ac);flex:none}.rec h3{font-size:16px;margin:4px 0}
/* plan cards */
.mscards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}.msc{gap:6px}.msc.next{background:var(--acs);border-color:var(--acl)}.msd{font-size:22px;font-weight:500}.msc.next .msd{color:var(--act)}
/* tables */
.tw{overflow-x:auto}.tb{width:100%;border-collapse:collapse;font-size:13.5px}.tb th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--mu);padding:0 10px 10px 0;border-bottom:1px solid var(--ln)}
.kind{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);background:var(--nb);padding:1px 6px;margin-right:8px}tr.asked td:first-child{box-shadow:inset 3px 0 0 var(--ac);padding-left:10px}.tb .inl{margin-top:8px}.tb .inl .fm{max-width:440px}
.tb td{padding:12px 10px 12px 0;border-bottom:1px solid var(--ln2);vertical-align:middle}.tb td b{font-weight:600}.tb tr:last-child td{border:0}
.money{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.money b{display:block;font-size:22px;font-weight:500;margin-top:4px}
.bill{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--ln2)}.bill:last-of-type{border:0}
.note{display:flex;gap:8px;font-size:12.5px;color:var(--mu)}.note .ic{width:16px;height:16px}
.bignum{font-size:44px;font-weight:500;line-height:1}.bignum .mu{font-size:18px}
/* questions */
.qi{background:var(--s);border:1px solid var(--ln);padding:16px 18px;display:flex;flex-direction:column;gap:6px}.qi.wait{background:var(--acs);border-color:var(--acl)}.qi .row b{font-weight:600}.qi p{font-size:12.5px}
.st{font-size:12px;font-weight:600;white-space:nowrap;padding:2px 8px}.st.ac{color:var(--act)}.st.wk{background:var(--wkb);color:var(--wk)}.st.ok{background:var(--okb);color:var(--ok)}
.ans{background:var(--ln2);padding:10px 12px;font-size:13.5px}
.to{display:flex;flex-wrap:wrap;gap:8px}.to label{cursor:pointer}.to input{position:absolute;opacity:0;pointer-events:none}.to span{display:inline-block;border:1px solid var(--ln);padding:8px 10px;font-size:13px;font-weight:600}.to input:checked+span{border-color:var(--ac);color:var(--act);background:var(--acs)}.to input:focus-visible+span{outline:2px solid var(--ac)}
.burnbox{display:flex;gap:12px;align-items:center;background:var(--acs);border:1px solid var(--acl);padding:12px 14px}.burnbox .ic{color:var(--ac)}.burnbox p{font-size:12px}
/* meetings */
.mt{display:flex;gap:16px;align-items:flex-start}.dbox{border:1px solid var(--ln);background:var(--s);width:58px;text-align:center;padding:6px 0;flex:none}.dbox b{display:block;font-size:22px;font-weight:600;line-height:1.1}.dbox span{font-size:11px;font-weight:700;color:var(--act);text-transform:uppercase}
.pm{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;padding:12px 0;border-bottom:1px solid var(--ln2);font-size:13.5px}.pm:last-child{border:0}
.hi{padding:8px 0;border-bottom:1px solid var(--ln2)}.hi:last-child{border:0}.hi p{font-size:12.5px}
.soon{flex-direction:row;gap:20px;align-items:flex-start;max-width:720px}.soon-ic{width:64px;height:64px;border-radius:50%;background:var(--sky);color:var(--slate);display:grid;place-items:center;flex:none}.soon-ic .ic{width:32px;height:32px}.soon h3{margin:8px 0 6px}.soon .btn{margin-top:12px}
.morelist{display:grid;gap:2px}.bdg.neu{background:var(--nb);color:var(--neu)}.morelist a{display:flex;gap:12px;align-items:center;padding:14px;background:var(--s);border:1px solid var(--ln);text-decoration:none;font-weight:500}
.bnav{display:none}
${activeCss}
@media (max-width:1100px){.g3{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.hero{grid-template-columns:minmax(0,1fr)}.g2,.g2.wide{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){body{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "main";padding-bottom:64px}.side{display:none}.top{padding:10px 16px}.top-t h1{font-size:16px;flex-basis:100%}.top-a .btn span{display:none}.top-a .btn{min-height:38px;padding:0 11px}main{padding:16px}.flash{grid-column:1;margin:10px 16px 0}
.g3{grid-template-columns:minmax(0,1fr)}.ph h2{font-size:22px}.state{font-size:24px}.big{font-size:60px}.gm,.gbody{display:none}.plist{display:grid;gap:2px}.pli{display:grid;grid-template-columns:1fr auto 74px;gap:8px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--sky2)}.pli i{font-style:normal;font-size:11.5px;text-align:right;color:var(--mu)}.pli.now b,.pli.now i{color:var(--act)}.pli.late i{color:var(--bd)}.pli.done{color:var(--mu)}.allplan{position:static;display:block;margin-top:10px}
.money{grid-template-columns:minmax(0,1fr)}.rec{flex-wrap:wrap}.bill{grid-template-columns:minmax(0,1fr) auto}.bill .mu{display:none}.soon{flex-direction:column}.pop-b{position:fixed;left:12px;right:12px;top:auto;bottom:72px;width:auto;max-width:none}
.bnav{display:grid;grid-template-columns:repeat(${bn.length + 1},minmax(0,1fr));position:fixed;left:0;right:0;bottom:0;background:var(--s);border-top:1px solid var(--ln);z-index:5}.bn{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px 10px;font-size:11px;font-weight:600;color:var(--mu);text-decoration:none}.bn .bdg{position:absolute;top:4px;left:calc(50% + 6px);margin:0;min-width:17px;height:17px;font-size:10.5px}}
@media print{body{display:block;background:#fff}.side,.bnav,.top-a,.pop,.fm,.burnbox,#nav,#model,#more,.seg,.anchor{display:none!important}.pg{display:flex!important;break-before:page}.pg#home{break-before:auto}.top{position:static}.card,.hero,.panel{break-inside:avoid}}
</style></head><body>
${side}${top}
<main>${home}${plan}${finance}${irdPage}${qPage}${meetPage}${docsPage}${navPage}${modelPage}${morePage}</main>
${bnav}
</body></html>`;
}

// The file version: model and render in one go (desktop «Сохранить и создать страницу»).
function customerHtml({ project, tasks, contact, today, team, ...render }) {
  return renderPage(pageModel({ project, tasks, contact, today, team }), { today, ...render });
}

// Calendar file of a meeting (cabinet «В календарь»). Times are local («floating»), as the customer reads them.
function meetingIcs(m, meeting) {
  const d = String(meeting.date || '').replace(/-/g, '');
  const t = v => (/^\d{1,2}:\d{2}$/.test(v || '') ? v.padStart(5, '0').replace(':', '') + '00' : '');
  const from = t(meeting.from), to = t(meeting.to) || from;
  const icsEsc = s => String(s || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\r?\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tandem//Cabinet//RU', 'BEGIN:VEVENT', `UID:${icsEsc(meeting.id)}@${icsEsc(m.project.id)}`,
    from ? `DTSTART:${d}T${from}` : `DTSTART;VALUE=DATE:${d}`, from ? `DTEND:${d}T${to}` : '', `SUMMARY:${icsEsc(`${meeting.title || 'Встреча'} — ${m.project.name}`)}`,
    meeting.place ? `LOCATION:${icsEsc(meeting.place)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}

module.exports = { customerHtml, renderPage, pageModel, customerStatus, sectionRows, meetingIcs };

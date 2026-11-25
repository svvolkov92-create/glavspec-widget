/* ---------- project: composition by Decree 87 and data for the customer page ---------- */
const PROTO_STATUS = [['work', 'в работе'], ['wait', 'ждём от заказчика'], ['done', 'готово']];
// Kinds of what the GIP asks the customer for: source data (ТУ, letters, approvals…) and decisions.
const IRD_KINDS = [['doc', 'Документ'], ['tu', 'ТУ'], ['letter', 'Письмо'], ['approval', 'Согласование'], ['survey', 'Изыскания']];
const irdKindOf = title => (/^ТУ(\s|$)|технические условия/i.test(title) ? 'tu' : /изыскани/i.test(title) ? 'survey' : /письм/i.test(title) ? 'letter' : /согласован/i.test(title) ? 'approval' : 'doc');
const IRD_STATUS = [['plan', 'не начато'], ['wait', 'ждём от заказчика'], ['clarify', 'ждём уточнения'], ['requested', 'запрошено нами'], ['remark', 'замечание'], ['accepted', 'принято'], ['done', 'выполнено']];
const PAY_STATUS = [['upcoming', 'предстоит'], ['invoiced', 'счёт выставлен'], ['paid', 'оплачен']];
const BILL_STATUS = [['to_pay', 'к оплате'], ['to_sign', 'на подписании'], ['signed', 'подписан'], ['paid', 'оплачен']];
const CONTRACT_STATUS = [['draft', 'готовится'], ['signing', 'на подписании'], ['signed', 'подписан'], ['signed_edo', 'подписан в ЭДО']];
const tm = v => (/^\d{1,2}:\d{2}$/.test(String(v || '').trim()) ? String(v).trim().padStart(5, '0') : '');
const money0 = v => { const n = parseMoney(String(v ?? '')); return Number.isNaN(n) ? 0 : n; };
// 4.12: the customer's contract and money — the project's own GIP and the director (an invited GIP does not see them).
const projMoney = () => A.seesProjectMoney(state.me, state.drawer?.kind === 'project' ? state.projects.get(state.drawer.id) : null);
function projectDraft(p) {
  const phases = (Array.isArray(p.phases) && p.phases.length ? p.phases : L.defaultPhases().filter(ph => projMoney() || ph.key !== 'contract'))
    .map(ph => ({ key: ph.key, start: ph.start || '', finish: ph.finish || '', done: ph.done || '' }));
  return {
    phases, milestones: clone(p.milestones || []), requests: clone(p.requests || []), docs: clone(p.docs || []),
    protocol: clone(p.protocol || { no: '', date: '', items: [] }), advice: clone(p.advice || { title: '', text: '' }),
    show: { plan: true, sections: true, advice: true, revisions: false, finance: true, ird: true, meetings: true, team: true, soon: true, passport: true, ...(p.show || {}) }, passport: clone(p.passport || {}), tep: clone(p.passport?.tep || []), contactId: p.contactId || (A.isGip(state.me) ? state.me.id : (liveUsers().find(u => u.role === 'gip')?.id || '')),
    ird: clone(p.ird || []), meetings: clone(p.meetings || []),
    contract: { no: '', date: '', subject: '', sum: '', status: 'signed', ...clone(p.contract || {}) }, payments: clone(p.payments || []), bills: clone(p.bills || []),
    composition: p.composition ? clone(p.composition) : null,
  };
}
// Everything from the «Состав» and «Для заказчика» tabs, checked; empty rows are dropped.
function projectDraftData() {
  const d = state.draft;
  if (!d) return { data: {} };
  const bad = [...d.phases.flatMap(x => [x.start, x.finish, x.done]), ...d.milestones.map(x => x.date), ...d.requests.map(x => x.due), ...d.docs.flatMap(x => [x.until, x.issued]), d.protocol.date,
    ...d.ird.map(x => x.due), ...d.meetings.map(x => x.date), ...d.protocol.items.map(x => x.due), d.contract.date, ...d.payments.map(x => x.date), ...d.bills.flatMap(x => [x.date, x.due])].some(v => v && !isDate(v));
  if (bad) return { error: 'Проверьте даты на вкладке «Для заказчика».', tab: 'cust' };
  for (const ph of d.phases) if (isDate(ph.start) && isDate(ph.finish) && ph.finish < ph.start) return { error: `Этап «${L.phaseLabel(ph.key)}»: окончание раньше начала.`, tab: 'cust' };
  const keep = (list, f) => list.filter(x => String(x[f] || '').trim());
  return { data: {
    phases: d.phases, milestones: keep(d.milestones, 'title').map(m => ({ id: m.id || newId(), title: m.title.trim(), date: m.date || '', done: !!m.done })),
    // A request tied to a row of source data is closed when that row is accepted.
    requests: keep(d.requests, 'title').map(r => { const row = r.irdId && d.ird.find(x => x.id === r.irdId); return { id: r.id || newId(), title: r.title.trim(), due: r.due || '', why: (r.why || '').trim(), done: !!r.done || !!(row && ['accepted', 'done'].includes(row.status)), irdId: row ? row.id : '' }; }),
    docs: keep(d.docs, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), kind: x.kind || L.docKindOf(x.title), no: String(x.no || '').trim(), issued: x.issued || '', until: x.until || '', remind: Math.max(0, Math.min(730, parseInt(x.remind, 10) || 60)) })),
    protocol: { no: String(d.protocol.no || '').trim(), date: d.protocol.date || '', items: keep(d.protocol.items, 'text').map(i => ({ id: i.id || newId(), text: i.text.trim(), who: i.who === 'customer' ? 'customer' : 'us', status: PROTO_STATUS.some(s => s[0] === i.status) ? i.status : 'work', pct: Math.max(0, Math.min(100, parseInt(i.pct, 10) || 0)), due: i.due || '' })) },
    advice: { title: (d.advice.title || '').trim(), text: (d.advice.text || '').trim() }, show: d.show,
    passport: { ...Object.fromEntries(PASSPORT_FIELDS.map(([k]) => [k, String(d.passport?.[k] ?? '').trim().slice(0, 300)])), tep: (d.tep || []).filter(x => String(x.k || '').trim()).slice(0, 30).map(x => ({ k: String(x.k).trim().slice(0, 80), v: String(x.v || '').trim().slice(0, 80) })) }, contactId: d.contactId, composition: d.composition,
    ird: keep(d.ird, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), kind: IRD_KINDS.some(k => k[0] === x.kind) ? x.kind : irdKindOf(x.title), who: String(x.who || '').trim(), status: IRD_STATUS.some(s => s[0] === x.status) ? x.status : 'plan', due: x.due || '', note: String(x.note || '').trim(), for: L.irdForList(x.for) })),
    meetings: d.meetings.filter(x => String(x.title || '').trim() || isDate(x.date)).map(x => ({ id: x.id || newId(), date: x.date || '', from: tm(x.from), to: tm(x.to), title: String(x.title || '').trim(), place: String(x.place || '').trim(), protocolNo: String(x.protocolNo || '').trim() })),
    // The customer's contract and payments: kept only from the GIP (others do not see them, so they never overwrite).
    ...(projMoney() ? {
      contract: { no: String(d.contract.no || '').trim(), date: d.contract.date || '', subject: String(d.contract.subject || '').trim(), sum: money0(d.contract.sum), status: CONTRACT_STATUS.some(s => s[0] === d.contract.status) ? d.contract.status : 'signed' },
      payments: keep(d.payments, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), sum: money0(x.sum), cond: String(x.cond || '').trim(), status: PAY_STATUS.some(s => s[0] === x.status) ? x.status : 'upcoming', date: x.date || '' })),
      bills: keep(d.bills, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), date: x.date || '', status: BILL_STATUS.some(s => s[0] === x.status) ? x.status : 'to_pay', due: x.due || '' })),
    } : {}),
  } };
}
// Edits in the two tabs: inputs carry data-pd="path.to.field" into state.draft.
function setDraftPath(path, value) {
  const keys = path.split('.');
  let o = state.draft;
  for (const k of keys.slice(0, -1)) o = o[/^\d+$/.test(k) ? Number(k) : k];
  o[keys.at(-1)] = value;
}
/* ---------- 4.1: project phases — one editor for «Сроки» and «Для заказчика», with length in days, «сразу после
   предыдущего» and a small Gantt of the phases. `bind(i, field)` gives the input's data attribute. ---------- */
function phaseTableHtml(phases, bind) {
  const st = { done: ['ok', 'завершён'], late: ['bad', 'просрочен'], now: ['work', 'идёт'], next: ['idle', 'впереди'] };
  return `<div class="tablewrap"><table class="pd-t ph-t"><thead><tr><th>Этап</th><th>Начало</th><th title="Календарных дней, включая первый и последний">Дней</th><th>Окончание</th><th title="Этап начинается на следующий день после окончания предыдущего">Сразу после предыдущего</th><th>Завершён (факт)</th><th>Состояние</th></tr></thead><tbody>
    ${phases.map((ph, i) => { const s = L.phaseState(ph, state.today), has = isDate(ph.start) || isDate(ph.finish);
      return `<tr${ph.key === 'contract' ? ' class="gip-only" title="Видят только ГИПы"' : ''}><td><b>${esc(L.phaseLabel(ph.key))}</b>${ph.key === 'contract' ? ' <span class="chip tone-idle">только ГИП</span>' : ''}</td>
        <td><input type="date" ${bind(i, 'start')} value="${esc(ph.start || '')}"${ph.chain && i ? ' readonly title="Считается от предыдущего этапа"' : ''}></td>
        <td><input class="ph-days num" type="number" min="1" max="3650" ${bind(i, 'days')} value="${esc(L.phaseDays(ph))}" placeholder="—"></td>
        <td><input type="date" ${bind(i, 'finish')} value="${esc(ph.finish || '')}"></td>
        <td class="c">${i ? `<input type="checkbox" ${bind(i, 'chain')}${ph.chain ? ' checked' : ''} aria-label="Сразу после предыдущего">` : ''}</td>
        <td><input type="date" ${bind(i, 'done')} value="${esc(ph.done || '')}"></td>
        <td>${has ? `<span class="chip tone-${st[s][0]}">${st[s][1]}</span>` : '<span class="hint">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">Укажите начало и длительность или начало и окончание — второе посчитается само. Галка «Сразу после предыдущего» сдвигает этап вслед за предыдущим.</p>`;
}
// Phases as bars on one time scale (the same picture the customer sees on the page).
function phaseGanttHtml(phases, milestones = []) {
  const dated = phases.filter(ph => isDate(ph.start) && isDate(ph.finish));
  if (!dated.length) return '';
  const all = [...dated.flatMap(ph => [ph.start, ph.finish]), state.today, ...milestones.map(m => m.date).filter(isDate)].sort();
  const from = all[0], to = all.at(-1), span = Math.max(1, dayNum(to) - dayNum(from) + 1);
  const x = d => ((dayNum(d) - dayNum(from)) / span) * 100;
  const months = []; for (let d = from.slice(0, 8) + '01'; d <= to; d = addDays(d, 32).slice(0, 8) + '01') if (d >= from) months.push(d);
  const every = Math.ceil(months.length / 10);
  return `<div class="ph-g" aria-label="График этапов">
    <div class="ph-gr ph-gm"><span></span><div class="ph-gt">${months.filter((_, i) => i % every === 0).map(m => `<span style="left:${x(m)}%">${fmtDate(m).slice(3)}</span>`).join('')}</div></div>
    ${dated.map(ph => { const s = L.phaseState(ph, state.today); return `<div class="ph-gr"><span class="ph-gl">${esc(L.phaseLabel(ph.key))}</span><div class="ph-gt">
      <i class="ph-bar ph-${s}" style="left:${x(ph.start)}%;width:${Math.max(0.8, x(addDays(ph.finish, 1)) - x(ph.start))}%" title="${esc(L.phaseLabel(ph.key))}: ${fmtDate(ph.start)} – ${fmtDate(ph.finish)} · ${L.phaseDays(ph)} дн."></i></div></div>`; }).join('')}
    <div class="ph-now" style="left:calc(var(--ph-l) + (100% - var(--ph-l)) * ${x(state.today) / 100})" title="Сегодня"></div>
    ${milestones.filter(m => isDate(m.date) && m.date >= from && m.date <= to).map(m => `<div class="ph-ms" style="left:calc(var(--ph-l) + (100% - var(--ph-l)) * ${x(m.date) / 100})" title="${esc(m.title)} · ${fmtDate(m.date)}"></div>`).join('')}
  </div>`;
}
// The project's phases are one list (p.phases): «Сроки» and «Для заказчика» edit the same records.
function syncPhasesDraft(pid, phases, milestones) {
  if (state.drawer?.kind !== 'project' || state.drawer.id !== pid || !state.draft) return;
  state.draft.phases = phases.map(x => ({ ...x }));
  if (milestones) state.draft.milestones = milestones.map(x => ({ ...x }));
  renderCustomer();
}
const pdIn = (path, value, attrs = '') => `<input data-pd="${path}" value="${esc(value ?? '')}" ${attrs}>`;
const pdDate = (path, value) => `<input type="date" data-pd="${path}" value="${esc(value || '')}">`;
const pdSel = (path, opts, cur) => `<select data-pd="${path}">${opts.map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const pdChk = (path, on, label = '') => `<label class="chk"><input type="checkbox" data-pd="${path}"${on ? ' checked' : ''}>${label}</label>`;
/* ---------- 4.6 (item 1): «Для заказчика» by tabs; a mark where the customer has written something new ---------- */
// 4.17: «Паспорт объекта» — what the customer sees on one page: the object, ТЭП, stages, expertise.
const PASSPORT_FIELDS = [['address', 'Адрес', 'г. Хабаровск, ул. Северная, 14'], ['purpose', 'Назначение', 'Многоквартирный жилой дом с подземной автостоянкой'], ['level', 'Уровень ответственности', 'нормальный'], ['area', 'Площадь участка', '0,86 га'], ['built', 'Площадь застройки', '1 940 м²'], ['total', 'Общая площадь', '18 450 м²'], ['floors', 'Этажность', '17 эт.'], ['units', 'Квартир / помещений', '236'], ['parking', 'Машино-мест', '84'], ['volume', 'Строительный объём', '62 000 м³']];
const CUST_SECS = [['cab', 'Кабинет'], ['plan', 'Этапы и вехи'], ['pass', 'Паспорт объекта'], ['req', 'Нужно от заказчика'], ['ird', 'Исходные данные'], ['meet', 'Договорённости и встречи'], ['docs', 'Сроки документов'], ['money', 'Договор и финансы'], ['show', 'Что показывать']];
let custSec = loadLocal('custSec', 'plan');
// Unread messages of the customer for this project, by the tab they belong to.
function custUnread(pid) {
  const out = {};
  for (const m of cab?.messages || []) {
    if (m.projectId !== pid || m.read) continue;
    const req = (state.draft?.requests || []).find(r => r.id === m.requestId);
    const k = m.kind === 'answer' ? (req?.irdId ? 'ird' : 'req') : m.kind === 'meeting' ? 'meet' : 'cab';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
function custNav() {
  const panel = $('.dpanel[data-panel="cust"]');
  if (!panel) return;
  const secs = CUST_SECS.filter(([k]) => k !== 'money' || projMoney());
  if (!secs.some(([k]) => k === custSec)) custSec = 'plan';
  const unread = custUnread(state.drawer?.id);
  let nav = panel.querySelector('.cust-nav');
  if (!nav) { nav = document.createElement('nav'); nav.className = 'cust-nav'; nav.setAttribute('role', 'tablist'); panel.prepend(nav); }
  nav.innerHTML = secs.map(([k, l]) => `<button class="btn sm${k === custSec ? ' on' : ''}" type="button" role="tab" aria-selected="${k === custSec}" data-act="cust-sec" data-v="${k}">${l}${unread[k] ? `<i class="cust-new" title="Новое от заказчика: ${unread[k]}">${unread[k]}</i>` : ''}</button>`).join('');
  panel.dataset.cs = custSec;
}
function renderCustomer() {
  const box = $('#cust-box'), d = state.draft;
  if (!box || !d) return;
  const now = L.projectNow({ phases: d.phases, milestones: d.milestones }, state.today);
  const staff = liveUsers().filter(u => u.role !== 'specialist').sort(byName);
  const list = (key, cols, head, empty) => `<table class="pd-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}<th></th></tr></thead><tbody>
    ${d[key].map((x, i) => `<tr>${cols(x, i)}<td><button class="btn ghostbtn sm" type="button" data-act="pd-del" data-list="${key}" data-i="${i}" aria-label="Удалить">✕</button></td></tr>`).join('') || `<tr><td colspan="${head.length + 1}" class="hint">${empty}</td></tr>`}</tbody></table>
    <button class="btn sm" type="button" data-act="pd-add" data-list="${key}">+ Добавить</button>`;
  custNav();
  box.innerHTML = `<div class="cust-top"><span class="hint">${now.planned ? `Сейчас: <b>${esc(now.current?.label || '—')}</b> · ${now.behind ? `<span class="neg">отставание ${now.behind} дн.</span>` : 'по графику'}${now.next ? ` · до «${esc(now.next.title)}» ${now.daysToNext} дн.` : ''}` : 'Задайте даты этапов — по ним строится план и «N дней до…» на странице заказчика.'}</span><span class="spacer"></span>
      <button class="btn" type="button" data-act="cust-page" data-format="pdf">PDF</button><button class="btn primary" type="button" data-act="cust-page" data-format="html">Сохранить и создать страницу</button></div>
    <div class="sub" data-cs="plan"><h3>Этапы проекта</h3>${projMoney() ? '' : '<p class="hint">Этап «Договор» ведёт ГИП.</p>'}
      ${phaseTableHtml(d.phases, (i, f) => `data-pd="phases.${i}.${f}"`)}${phaseGanttHtml(d.phases, d.milestones)}</div>
    <div class="sub" data-cs="plan"><h3>Вехи</h3>${list('milestones', (x, i) => `<td class="grow">${pdIn(`milestones.${i}.title`, x.title, 'placeholder="Заключение экспертизы" maxlength="120"')}</td><td>${pdDate(`milestones.${i}.date`, x.date)}</td><td>${pdChk(`milestones.${i}.done`, x.done, ' пройдена')}</td>`, ['Веха', 'Дата', ''], 'Ключевые даты для заказчика: договор, ПД на экспертизу, заключение, выдача РД.')}</div>
    <div class="sub" data-cs="req"><h3>Нужно от заказчика</h3>${list('requests', (x, i) => `<td class="grow">${pdIn(`requests.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}
        <div class="req-files">${(x.files || []).map((f, k) => `<span class="aq-file"><button class="linkbtn" type="button" data-act="att-open" data-fid="${esc(f.id)}" title="Открыть">${icon('file')}${esc(f.name)}</button><button class="linkbtn" type="button" data-act="req-unattach" data-i="${i}" data-k="${k}" aria-label="Убрать файл">✕</button></span>`).join('')}<button class="linkbtn" type="button" data-act="req-attach" data-i="${i}">+ файл для согласования</button></div></td><td>${pdDate(`requests.${i}.due`, x.due)}</td><td class="grow">${pdIn(`requests.${i}.why`, x.why, 'placeholder="Зачем: без них экспертиза не примет ИОС1" maxlength="200"')}</td><td>${pdChk(`requests.${i}.done`, x.done, ' получено')}</td>`, ['Что', 'Срок', 'Зачем', ''], 'Исходные данные, решения и ответы, которые ждём от заказчика. «Получено» убирает строку со страницы.')}</div>
    <div class="sub" data-cs="ird"><h3>Исходные данные</h3><p class="hint">Что нужно для проектирования и в каком оно состоянии — вкладка «Исходные данные» у заказчика. «Запросить» ставит строку в «Нужно от вас»: заказчик отвечает прямо со страницы, ответ приходит сюда — его можно принять или вернуть с замечанием.</p>${list('ird', (x, i) => { const rq = irdRequest(x);
        const sug = L.irdSuggestFor(x.title).join(', ');
        return `<td>${pdSel(`ird.${i}.kind`, IRD_KINDS, x.kind || irdKindOf(x.title))}</td><td class="grow">${pdIn(`ird.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}</td><td>${pdIn(`ird.${i}.who`, x.who, 'placeholder="Заказчик" maxlength="60" list="ird-who"')}</td>
        <td>${pdIn(`ird.${i}.for`, Array.isArray(x.for) ? x.for.join(', ') : (x.for || ''), `class="ird-for" placeholder="${esc(sug || 'КР, ОВ')}" maxlength="80" title="Каким разделам нужен документ: пока он не принят, карточки этих разделов помечены «ждёт ИД»"`)}</td>
        <td>${pdSel(`ird.${i}.status`, IRD_STATUS, x.status)}</td><td>${pdDate(`ird.${i}.due`, x.due)}</td><td class="grow">${pdIn(`ird.${i}.note`, x.note, 'placeholder="Примечание для заказчика" maxlength="200"')}</td>
        <td class="nowrap">${rq ? `<span class="chip tone-work" title="${esc(rq.title)}">запрошено${rq.due ? ' до ' + fmtDate(rq.due).slice(0, 5) : ''}</span>` : ['accepted', 'done'].includes(x.status) ? '' : `<button class="btn sm" type="button" data-act="ird-request" data-i="${i}">Запросить</button>`}</td>`; }, ['Тип', 'Что нужно', 'Кто готовит', 'Нужно для разделов', 'Статус', 'Срок', 'Примечание', ''], 'Задание на проектирование, ГПЗУ, ТУ, письма, согласования…')}
      <div class="row-in">${irdAskable().length ? `<button class="btn sm" type="button" data-act="ird-request-all">Запросить у заказчика всё недостающее (${irdAskable().length})</button>` : ''}${(d.requests || []).some(r => !r.done && r.title) ? '<button class="btn ghostbtn sm" type="button" data-act="ird-letter">Текст письма-запроса</button>' : ''}</div>
      <datalist id="ird-who"><option value="Заказчик"><option value="«Тандем»"><option value="Изыскатели"><option value="«Тандем» по доверенности"><option value="Заказчик и «Тандем»"></datalist>
      ${d.ird.some(x => x.title && !L.irdForList(x.for).length && L.irdSuggestFor(x.title).length) ? '<button class="btn ghostbtn sm" type="button" data-act="ird-for-fill" title="Где «Нужно для разделов» пусто — подставить обычные разделы по названию документа">Подставить разделы</button>' : ''}
      ${Techcard.SOURCE_DATA.some(([t]) => !d.ird.some(x => x.title.trim().toLowerCase() === t.toLowerCase())) ? `<button class="btn sm" type="button" data-act="ird-techcard">${d.ird.length ? 'Дополнить по техкарте' : 'Заполнить по техкарте'}</button>` : ''}</div>
    <div class="sub" data-cs="meet"><h3>Последняя договорённость</h3><div class="row-in">Протокол № ${pdIn('protocol.no', d.protocol.no, 'class="sm-in" maxlength="20"')} от ${pdDate('protocol.date', d.protocol.date)}</div>
      <table class="pd-t"><thead><tr><th>Пункт</th><th>Кто</th><th>Срок</th><th>Статус</th><th>%</th><th></th></tr></thead><tbody>
      ${d.protocol.items.map((x, i) => `<tr><td class="grow">${pdIn(`protocol.items.${i}.text`, x.text, 'placeholder="Ответы экспертизе по КР" maxlength="200"')}</td>
        <td><select data-pd="protocol.items.${i}.who"><option value="us"${x.who !== 'customer' ? ' selected' : ''}>мы</option><option value="customer"${x.who === 'customer' ? ' selected' : ''}>заказчик</option></select></td>
        <td>${pdDate(`protocol.items.${i}.due`, x.due)}</td>
        <td><select data-pd="protocol.items.${i}.status">${PROTO_STATUS.map(([k, l]) => `<option value="${k}"${x.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${pdIn(`protocol.items.${i}.pct`, x.pct || '', 'class="sm-in" inputmode="numeric" placeholder="—"')}</td>
        <td><button class="btn ghostbtn sm" type="button" data-act="pd-del" data-list="protocol.items" data-i="${i}" aria-label="Удалить">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="hint">Пункты протокола последней встречи — заказчик увидит их со статусом.</td></tr>'}</tbody></table>
      <button class="btn sm" type="button" data-act="pd-add" data-list="protocol.items">+ Пункт</button></div>
    <div class="sub" data-cs="meet"><h3>Встречи</h3><p class="hint">Ближайшая встреча — на главной и во «Встречах» у заказчика, с кнопками «В календарь» и «Перенести»; прошедшие — с номером протокола.</p>${list('meetings', (x, i) => `<td>${pdDate(`meetings.${i}.date`, x.date)}</td><td>${pdIn(`meetings.${i}.from`, x.from, 'class="sm-in" placeholder="11:00" maxlength="5"')}–${pdIn(`meetings.${i}.to`, x.to, 'class="sm-in" placeholder="12:00" maxlength="5"')}</td>
        <td class="grow">${pdIn(`meetings.${i}.title`, x.title, 'placeholder="Совещание по замечаниям экспертизы" maxlength="160"')}</td><td class="grow">${pdIn(`meetings.${i}.place`, x.place, 'placeholder="онлайн или адрес" maxlength="160"')}</td><td>${pdIn(`meetings.${i}.protocolNo`, x.protocolNo, 'class="sm-in" placeholder="№" maxlength="20"')}</td>`, ['Дата', 'Время', 'Тема', 'Где', 'Протокол'], 'Встречи с заказчиком: прошедшие и ближайшая.')}</div>
    <div class="sub" data-cs="pass"><h3>Паспорт объекта</h3><p class="hint">Заказчик видит его в кабинете отдельной вкладкой «Паспорт объекта» — вместе с этапами, экспертизой и вашим контактом. Пустые поля не показываются.</p>
      <div class="fgrid pass-grid">${PASSPORT_FIELDS.map(([k, l, ph]) => `<div class="f${['address', 'purpose'].includes(k) ? ' wide' : ''}"><label>${l}</label>${pdIn(`passport.${k}`, d.passport?.[k], `placeholder="${esc(ph)}" maxlength="300"`)}</div>`).join('')}</div>
      <h4>Другие показатели</h4>${list('tep', (x, i) => `<td class="grow">${pdIn(`tep.${i}.k`, x.k, 'placeholder="Площадь квартир" maxlength="80"')}</td><td>${pdIn(`tep.${i}.v`, x.v, 'placeholder="11 200 м²" maxlength="80"')}</td>`, ['Показатель', 'Значение'], 'Ещё ТЭП, если нужно: площадь квартир, высота, класс энергоэффективности…')}
      <div class="pd-show">${pdChk('show.passport', d.show.passport !== false, ' показывать паспорт заказчику')}</div></div>
    <div class="sub" data-cs="docs"><h3>Сроки документов</h3>${list('docs', (x, i) => { const kind = x.kind || L.docKindOf(x.title), rule = L.docRule(kind), auto = L.docUntil(kind, x.issued), left = isDate(x.until) ? dayNum(x.until) - dayNum(state.today) : null;
        return `<td>${pdSel(`docs.${i}.kind`, L.DOC_KINDS.map(([k, l]) => [k, l]), kind)}</td><td class="grow">${pdIn(`docs.${i}.title`, x.title, 'placeholder="ТУ на водоснабжение и водоотведение" maxlength="160"')}</td>
          <td>${pdIn(`docs.${i}.no`, x.no, 'class="sm-in" placeholder="№" maxlength="40"')}</td><td>${pdDate(`docs.${i}.issued`, x.issued)}</td>
          <td>${pdDate(`docs.${i}.until`, x.until)}<div class="hint doc-rule">${rule ? (x.until && x.until !== auto && auto ? `вручную · по правилу: ${fmtDate(auto)}` : esc(rule.basis)) : 'по тексту документа'}${left !== null ? ` · ${left < 0 ? `<span class="neg">истёк</span>` : left <= (x.remind ?? 60) ? `<span class="warnv">истекает через ${left} дн.</span>` : `ещё ${left} дн.`}` : ''}</div>${left !== null && left <= (x.remind ?? 60) ? docRenewHtml(x, i) : ''}</td>
          <td>за ${pdIn(`docs.${i}.remind`, x.remind ?? 60, 'class="sm-in" inputmode="numeric"')} дн.</td>`; }, ['Тип', 'Документ', '№', 'Дата выпуска', 'Действует до', 'Напомнить в сводке'], 'ГПЗУ, изыскания, ТУ — когда истекают. Для ГПЗУ и топосъёмки срок считается от даты выпуска сам; ТУ, СТУ и прочее — по тексту документа. Напоминание появится в сводке.')}</div>
    ${projMoney() ? `<div class="sub" data-cs="money"><h3>Договор и финансы <span class="chip tone-idle">только ГИП</span></h3><p class="hint">Договор заказчика с «Тандемом» — не путать с бюджетами подрядчиков. Пока номер договора пуст, вкладки «Договор и финансы» у заказчика нет.</p>
      <div class="fgrid"><div class="f"><label>Номер договора</label>${pdIn('contract.no', d.contract.no, 'placeholder="26/07-12" maxlength="40"')}</div><div class="f"><label>Дата</label>${pdDate('contract.date', d.contract.date)}</div>
        <div class="f wide"><label>Предмет</label>${pdIn('contract.subject', d.contract.subject, 'placeholder="Инженерные изыскания и проектная документация, стадия П" maxlength="200"')}</div>
        <div class="f"><label>Стоимость, ₽</label>${pdIn('contract.sum', d.contract.sum, 'inputmode="decimal" placeholder="4 860 000" maxlength="20"')}</div><div class="f"><label>Статус</label>${pdSel('contract.status', CONTRACT_STATUS, d.contract.status)}</div></div>
      <h4>График оплат</h4>${list('payments', (x, i) => `<td class="grow">${pdIn(`payments.${i}.title`, x.title, 'placeholder="Аванс" maxlength="120"')}</td><td>${pdIn(`payments.${i}.sum`, x.sum, 'inputmode="decimal" placeholder="1 458 000" maxlength="20"')}</td><td class="grow">${pdIn(`payments.${i}.cond`, x.cond, 'placeholder="при подписании" maxlength="120"')}</td><td>${pdSel(`payments.${i}.status`, PAY_STATUS, x.status)}</td><td>${pdDate(`payments.${i}.date`, x.date)}</td>`, ['Этап', 'Сумма', 'Условие', 'Статус', 'Дата'], 'Аванс, оплата за этапы, окончательный расчёт.')}
      <h4>Счета и акты</h4>${list('bills', (x, i) => `<td class="grow">${pdIn(`bills.${i}.title`, x.title, 'placeholder="Акт № 2 по проектной документации" maxlength="160"')}</td><td>${pdDate(`bills.${i}.date`, x.date)}</td><td>${pdSel(`bills.${i}.status`, BILL_STATUS, x.status)}</td><td>${pdDate(`bills.${i}.due`, x.due)}</td>`, ['Документ', 'Дата', 'Статус', 'Оплатить до'], 'Счета и акты по договору — без файлов, только статус.')}</div>` : ''}
    <div class="sub" data-cs="show"><h3>Рекомендация ГИПа и контакт</h3>
      <div class="fgrid"><div class="f wide"><label>Заголовок</label>${pdIn('advice.title', d.advice.title, 'placeholder="Рабочая документация на сети" maxlength="120"')}</div>
        <div class="f wide"><label>Текст</label><textarea data-pd="advice.text" maxlength="600" placeholder="Что посоветовать заказчику на этом этапе">${esc(d.advice.text)}</textarea></div>
        <div class="f"><label>Контакт на странице</label><select data-pd="contactId"><option value="">— не показывать —</option>${staff.map(u => `<option value="${esc(u.id)}"${u.id === d.contactId ? ' selected' : ''}>${esc(u.name)}${u.phone ? '' : ' (нет телефона)'}</option>`).join('')}</select><span class="hint">Телефон и почта — из карточки сотрудника.</span></div></div></div>
    <div class="sub" data-cs="show"><h3>Что показывать заказчику</h3><div class="pd-show">${pdChk('show.plan', d.show.plan, ' план и вехи')}${pdChk('show.sections', d.show.sections, ' разделы проекта')}${pdChk('show.advice', d.show.advice, ' рекомендация ГИПа')}${pdChk('show.revisions', d.show.revisions, ' номера изменений')}${pdChk('show.ird', d.show.ird, ' исходные данные')}${pdChk('show.meetings', d.show.meetings, ' встречи и протокол')}${pdChk('show.team', d.show.team, ' команда проекта (участники)')}${projMoney() ? pdChk('show.finance', d.show.finance, ' договор и финансы') : ''}${pdChk('show.soon', d.show.soon, ' «Навигатор» и «3D-модель» с пометкой «скоро»')}</div>
      <p class="hint">Подрядчики, бюджеты подрядчиков и внутренние замечания на странице не показываются никогда; договор заказчика — только если ГИП его заполнил и включил.</p></div>`;
}
// Source data and requests: a row is «asked» when an open request points to it.
// 4.13: a document that runs out — «Запросить актуализацию» makes an outgoing letter by the template, tied to the document.
const docLetter = (p, docId) => (p ? lettersOf(p.id) : []).filter(l => l.docId === docId).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
function docRenewHtml(x, i) {
  const p = state.projects.get(state.drawer?.id), l = x.id && docLetter(p, x.id);
  if (l) return `<div class="doc-renew"><span class="chip tone-work" title="${esc(l.subject || '')}">${esc(letterNo(l))} от ${fmtDate(l.date)}</span></div>`;
  return A.canManageCatalog(state.me) ? `<div class="doc-renew"><button class="btn sm" type="button" data-act="doc-renew" data-i="${i}">Запросить актуализацию</button></div>` : '';
}
function docRenew(p, x) {
  if (!p || !x) return;
  const vars = { doc: x.title, docno: [x.no ? ` № ${x.no}` : '', isDate(x.issued) ? ` от ${fmtDate(x.issued)}` : ''].join(''), until: isDate(x.until) ? fmtDate(x.until) : '' };
  askLetter(p, null, 'out', { tpl: 'renew', corr: '', docId: x.id, vars });
}
const irdRequest = x => (state.draft?.requests || []).find(r => !r.done && r.irdId === x.id);
// Everything not made by «Тандем» or the surveyors is the customer's to provide (ТУ from utilities too — the customer obtains them).
const irdAskable = () => (state.draft?.ird || []).filter(x => x.title && !irdRequest(x) && !/тандем|изыскател/i.test(x.who || '') && ['plan', 'wait', 'clarify', 'remark'].includes(x.status));
const IRD_WHY = { tu: 'Нужны для проектирования сетей и раздела, без них экспертиза не примет раздел.', letter: 'Нужно для исходных данных проекта.', approval: 'Без согласования раздел не уйдёт в экспертизу.', survey: 'Нужны для проектирования.', doc: 'Нужно для проектирования.' };
function irdAsk(x) {
  const d = state.draft, kindLbl = IRD_KINDS.find(k => k[0] === (x.kind || irdKindOf(x.title)))?.[1] || '';
  const title = new RegExp('^' + kindLbl, 'i').test(x.title) || kindLbl === 'Документ' ? x.title : `${kindLbl}: ${x.title}`;
  const r = { id: newId(), title, due: isDate(x.due) && x.due >= state.today ? x.due : addDays(state.today, 10), why: x.note || IRD_WHY[x.kind || irdKindOf(x.title)], done: false, irdId: x.id || (x.id = newId()) };
  d.requests.push(r);
  if (['plan', 'remark', 'clarify'].includes(x.status) || !x.status) x.status = 'wait';
  if (!isDate(x.due)) x.due = r.due;
  return r;
}
// Formal letter text with every open request — for a letter on the letterhead or an e-mail.
function irdLetterText() {
  const d = state.draft, p = state.projects.get(state.drawer?.id) || {}, open = d.requests.filter(r => !r.done && r.title);
  const me = state.users.get(d.contactId) || state.me;
  return `${p.client ? p.client + '\n\n' : ''}О предоставлении исходных данных\n\nДля выполнения работ по объекту «${p.name || ''}»${p.code ? ` (шифр ${p.code})` : ''} просим предоставить:\n\n`
    + open.map((r, i) => `${i + 1}. ${r.title}${isDate(r.due) ? ` — до ${fmtDate(r.due)}` : ''}${r.why ? `. ${r.why}` : ''}`).join('\n')
    + `\n\nДокументы можно передать через личный кабинет заказчика или направить в наш адрес.\n\n${me?.name || ''}${me ? ', главный инженер проекта' : ''}${me?.phone ? '\n' + me.phone : ''}${me?.email ? '\n' + me.email : ''}`;
}
const PD_NEW = { milestones: () => ({ id: newId(), title: '', date: '', done: false }), requests: () => ({ id: newId(), title: '', due: '', why: '', done: false }),
  docs: () => ({ id: newId(), kind: 'other', title: '', no: '', issued: '', until: '', remind: 60 }), 'protocol.items': () => ({ id: newId(), text: '', who: 'us', status: 'work', pct: '', due: '' }),
  tep: () => ({ k: '', v: '' }),
  ird: () => ({ id: newId(), title: '', kind: 'doc', who: 'Заказчик', status: 'plan', due: '', note: '' }), meetings: () => ({ id: newId(), date: '', from: '', to: '', title: '', place: '', protocolNo: '' }),
  payments: () => ({ id: newId(), title: '', sum: '', cond: '', status: 'upcoming', date: '' }), bills: () => ({ id: newId(), title: '', date: '', status: 'to_pay', due: '' }) };
const draftList = key => key.split('.').reduce((o, k) => o[k], state.draft);

async function customerPage(format) {
  const id = state.drawer?.id;
  if (!id) return;
  const ok = await submitSimple(true);
  if (!ok) return;
  try {
    const res = await api.customerPage(id, { format, font: brandFont });
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    if (res.viaBrowser) return toast('Страница открылась в браузере — в окне печати выберите «Сохранить как PDF».');
    toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) { toast('Не удалось сохранить страницу: ' + (e?.message || e), true); }
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'ird-request': ({ el }) => { const x = state.draft.ird[Number(el.dataset.i)]; if (x?.title) { irdAsk(x); renderCustomer(); toast('Запрос добавлен в «Нужно от заказчика». Сохраните проект — заказчик увидит его на странице.'); } },
  'ird-request-all': () => { const list = irdAskable(); list.forEach(irdAsk); renderCustomer(); toast(`Запрошено: ${list.length}. Сохраните проект — заказчик увидит запросы на странице.`); },
  'ird-letter': () => { navigator.clipboard.writeText(irdLetterText()).then(() => toast('Текст письма-запроса скопирован — вставьте в письмо или на бланк.'), () => toast('Не удалось скопировать.', true)); },
  'ird-techcard': ({ id }) => { state.draft.ird.push(...Techcard.SOURCE_DATA.filter(([t]) => !state.draft.ird.some(x => x.title.trim().toLowerCase() === t.toLowerCase())).map(([title, who]) => ({ id: newId(), title, kind: irdKindOf(title), who: who === 'Изыскатели' ? '«Тандем»' : who.replace('Заказчик / технолог', 'Заказчик'), status: 'plan', due: '', note: '', for: L.irdSuggestFor(title) }))); renderCustomer(); },
  'doc-renew': ({ el }) => { const x = state.draft?.docs[Number(el.dataset.i)]; if (!x?.title) return; x.id ||= newId(); docRenew(state.projects.get(state.drawer.id), x); },
  'goto-ird': ({ id }) => { custSec = 'ird'; saveLocal('custSec', 'ird'); openProject(id, 'cust'); },
  'ird-for-fill': () => { let n = 0; for (const x of state.draft.ird) if (x.title && !L.irdForList(x.for).length) { const f = L.irdSuggestFor(x.title); if (f.length) { x.for = f; n++; } } renderCustomer(); toast(n ? `Разделы подставлены у ${n} ${plural(n, 'документа', 'документов', 'документов')} — проверьте и сохраните проект.` : 'Подставлять нечего.'); },
  'pd-add': ({ el }) => { draftList(el.dataset.list).push(PD_NEW[el.dataset.list]()); renderCustomer(); },
  'pd-del': ({ el }) => { draftList(el.dataset.list).splice(Number(el.dataset.i), 1); renderCustomer(); },
  'cust-page': ({ el }) => { customerPage(el.dataset.format); },
  'req-attach': ({ el }) => { const x = state.draft?.requests?.[Number(el.dataset.i)], pid = state.drawer?.id; if (x && pid) api.attachAdd(pid).then(r => { if (r?.ok) { x.files = [...(x.files || []), r.file]; renderCustomer(); toast('Файл приложен — сохраните проект, и заказчик увидит его в кабинете.'); } else if (r && !r.canceled) toast(r.message, true); }); },
  'req-unattach': ({ el }) => { const x = state.draft?.requests?.[Number(el.dataset.i)]; if (x) { x.files = (x.files || []).filter((_, k) => k !== Number(el.dataset.k)); renderCustomer(); } },
  'att-open': ({ el }) => { const pid = state.drawer?.id; if (pid) api.attachOpen(pid, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть', true); }); },
  'cust-sec': ({ el }) => { custSec = el.dataset.v; saveLocal('custSec', custSec); custNav(); },
  'ask-customer': ({ id }) => { const pr = state.projects.get(id); if (pr) askCustomer(pr); },
});

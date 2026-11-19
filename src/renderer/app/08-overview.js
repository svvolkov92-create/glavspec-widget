/* ---------- views ---------- */
// 54: an empty list says what to do next — reset the filters, or create the first card.
function tasksEmpty() {
  const base = { tall: true, limitKey: 'tasks', select: canEditFields() };
  if (!sameFilters(state.filters, EMPTY_FILTERS)) return { ...base, empty: 'Под фильтр ничего не попало.', emptyActs: '<button class="btn sm" type="button" data-act="preset-reset">Сбросить фильтры</button>' };
  const can = A.canCreateTasks(state.me);
  return { ...base, empty: can ? 'Карточек пока нет. Создайте первую или загрузите список из Excel.' : 'Вам пока не назначено ни одной карточки.',
    emptyActs: can ? '<button class="btn primary sm" type="button" data-act="new-task">+ Карточка</button><button class="btn sm" type="button" data-act="import">Импорт из Excel</button>' : '' };
}
function emptyState() {
  return `<section class="empty">
    <h2>Здесь пока пусто</h2>
    <p class="hint">Пульт собирает проекты, карточки работ и подрядчиков в одном окне. Начните так:</p>
    <ol>
      <li>Добавьте исполнителей с контактами.</li>
      <li>Заведите проект (объект, шифр, заказчик).</li>
      <li>Добавьте в проект карточки: выберите разделы из состава проекта (ИОС1, АР, ЭОМ…), назначьте ответственного, подрядчика, сроки и бюджет.</li>
      <li>По мере оплаты вносите платежи — остаток посчитается сам.</li>
    </ol>
    <div class="acts">
      <button class="btn primary" data-act="new-contractor" type="button">Добавить исполнителя</button>
      <button class="btn" data-act="new-project" type="button">Добавить проект</button>
      <button class="btn" data-act="import" type="button">Импорт из Excel или CSV</button>
      <button class="btn ghostbtn" data-act="seed-demo" type="button">Показать на примере</button>
    </div>
    <p class="hint">«Показать на примере» добавит несколько записей с пометкой «Пример»; их можно удалить одной кнопкой внизу.</p>
  </section>`;
}
const isEmpty = () => !state.tasks.size && !state.projects.size && !state.contractors.size;

/* ---------- project stage and goal ---------- */
const projectStageChip = p => { const s = L.PROJECT_STATUSES[p?.status]; return s ? `<span class="chip tone-${s.tone} stage">${esc(s.label)}</span>` : '<span class="hint">стадия не задана</span>'; };
// «6 из 9 марок»: the shared goal of a project — every mark accepted. With encouragement off it is a plain count.
function goalHtml(list, compact = false) {
  const g = L.projectGoal(list);
  if (!g.total) return compact ? '<span class="hint">—</span>' : '';
  return `<span class="goal${g.complete ? ' done' : ''}" title="Принято разделов: ${g.done} из ${g.total}${g.complete ? ' — комплект готов' : ''}"><span class="goal-bar"><i style="width:${g.pct}%"></i></span><b class="num">${g.done}/${g.total}</b>${compact ? '' : ` <span class="hint">разделов принято</span>`}${g.complete && game ? '<span class="goal-flag" aria-hidden="true">⚑</span>' : ''}</span>`;
}

/* ---------- completion dashboard (GIP) ---------- */
// Fact = accepted share; plan = share whose finish has already passed. The gap shows who is behind.
let progWeight = loadLocal('progWeight', 'count');
// Two layers: the thin top line is readiness, the bar below — what share of work is in which status.
function progBar(p) {
  const seg = (k, v) => v > 0 ? `<i class="pg-${k}" style="width:${v}%"></i>` : '';
  return `<div class="pg-wrap" title="Готовность ${p.readyPct}% · принято ${p.parts.done}% · на проверке ${p.parts.review}% · в работе ${p.parts.work}% · не начато ${p.parts.idle}% · по плану к сегодня ${p.plan}%">
    <div class="pg-ready"><i style="width:${p.readyPct}%"></i></div>
    <div class="pg-bar">${seg('done', p.parts.done)}${seg('review', p.parts.review)}${seg('work', p.parts.work)}${seg('idle', p.parts.idle)}
    ${p.plan > 0 ? `<b class="pg-plan" style="left:${Math.min(100, p.plan)}%"></b>` : ''}</div></div>`;
}
const lagCls = p => (p.lag >= 15 ? 'neg' : p.lag >= 5 ? 'warnv' : 'okv');
const lagText = p => (p.lag > 0 ? `отставание ${String(p.lag).replace('.', ',')} п.п.` : p.lag < 0 ? `опережение ${String(-p.lag).replace('.', ',')} п.п.` : 'по плану');
function progRow(label, p, act = '', id = '') {
  return `<tr${act ? ` class="row" data-act="${act}" data-id="${esc(id)}"` : ''}><td><b>${esc(label)}</b><div class="hint">${p.count} карт.${p.late ? ` · <span class="neg">сорвано ${p.late}</span>` : ''}</div></td>
    <td class="pg-cell">${progBar(p)}</td><td class="r num"><b>${String(p.readyPct).replace('.', ',')}%</b></td><td class="r num">${String(p.fact).replace('.', ',')}%</td><td class="r num hint">${String(p.plan).replace('.', ',')}%</td>
    <td class="r ${lagCls(p)}">${lagText(p)}</td></tr>`;
}
function progressDashboard(list) {
  const today = state.today, wgt = canMoney() ? progWeight : 'count';
  const P = l => L.progress(l, today, wgt);
  const all = P(list);
  const projects = liveProjects().map(pr => ({ pr, p: P(list.filter(t => t.projectId === pr.id)) })).filter(x => x.p.count).sort((a, b) => b.p.lag - a.p.lag);
  const dirOf = t => A.directionOfMark(sectionsOf(t)[0])?.id || '';
  const dirs = [...A.DIRECTIONS.map(d => ({ id: d.id, label: d.label })), { id: '', label: 'Прочие' }]
    .map(d => ({ d, p: P(list.filter(t => dirOf(t) === d.id)) })).filter(x => x.p.count);
  const chiefOf = t => { const o = ownerOf(t); return !o ? '' : o.role === 'specialist' ? o.chiefId || '' : o.role === 'chief' ? o.id : ''; };
  const groups = [...usersByRole('chief').map(c => ({ id: c.id, label: `Группа: ${c.name}` })), { id: '', label: 'ГИП / без группы' }]
    .map(g => ({ g, p: P(list.filter(t => chiefOf(t) === g.id)) })).filter(x => x.p.count);
  const behind = projects.filter(x => x.p.lag >= 15).length;
  const head = `<thead><tr><th></th><th>Структура выполнения <span class="pg-legend"><i class="pg-done"></i>принято <i class="pg-review"></i>на проверке <i class="pg-work"></i>в работе <i class="pg-idle"></i>не начато <b class="pg-plan-l"></b>план к сегодня <i class="pg-ready-l"></i>готовность</span></th><th class="r">Готовность</th><th class="r">Принято</th><th class="r">План</th><th></th></tr></thead>`;
  const f = isFolded('o:progress');
  return `<section class="panel pg${f ? ' folded' : ''}" data-ov="progress"><div class="panel-h">${foldBtn('o:progress', f)}<h3>Выполнение</h3>
      <span class="meta">${canMoney() ? (wgt === 'budget' ? 'по бюджету' : 'по количеству карточек') : 'по количеству карточек'}</span><span class="spacer"></span>
      ${canMoney() ? `<span class="seg"><button class="btn sm ${wgt === 'count' ? 'on' : ''}" type="button" data-act="prog-weight" data-v="count">По карточкам</button><button class="btn sm ${wgt === 'budget' ? 'on' : ''}" type="button" data-act="prog-weight" data-v="budget">По бюджету</button></span>` : ''}</div>
    ${f ? '' : `<div class="pg-top">
      <div class="pg-big"><span class="k">Готовность</span><b>${String(all.readyPct).replace('.', ',')}%</b><span class="hint">принято ${String(all.fact).replace('.', ',')}% · ${wgt === 'budget' ? `${money(all.done)} из ${money(all.total)}` : `${all.done} из ${all.total} карточек`}</span></div>
      <div class="pg-big"><span class="k">По плану к сегодня</span><b>${String(all.plan).replace('.', ',')}%</b><span class="hint">срок финиша уже наступил</span></div>
      <div class="pg-big"><span class="k">Разница</span><b class="${lagCls(all)}">${all.lag > 0 ? '−' : all.lag < 0 ? '+' : ''}${String(Math.abs(all.lag)).replace('.', ',')} п.п.</b><span class="hint">${lagText(all)}</span></div>
      <div class="pg-big"><span class="k">Проектов отстают</span><b class="${behind ? 'neg' : 'okv'}">${behind}</b><span class="hint">отставание ≥ 15 п.п.</span></div>
      <div class="pg-wide">${progBar(all)}</div></div>
    <div class="tablewrap"><table class="pg-t">${head}<tbody>
      <tr class="grp"><td colspan="6"><b>По проектам</b> <span class="hint">сначала отстающие</span></td></tr>${projects.map(x => progRow(x.pr.name, x.p, 'goto-project', x.pr.id)).join('')}
      <tr class="grp"><td colspan="6"><b>По направлениям</b></td></tr>${dirs.map(x => progRow(x.d.label, x.p)).join('')}
      ${groups.length > 1 ? `<tr class="grp"><td colspan="6"><b>По группам главспецов</b></td></tr>${groups.map(x => progRow(x.g.label, x.p)).join('')}` : ''}
    </tbody></table></div>`}</section>`;
}

function kpiStrip(list) {
  const tt = totals(list);
  if (!canMoney()) return `<div class="kpis">
    <div class="kpi"><span class="k">В работе</span><span class="v">${tt.active}</span></div>
    <div class="kpi ${tt.overdue ? 'bad' : ''}"><span class="k">Срок сорван</span><span class="v">${tt.overdue}</span></div>
    <div class="kpi ${tt.review ? 'review' : ''}"><span class="k">На проверке</span><span class="v">${tt.review}</span></div>
    <div class="kpi ok"><span class="k">Принято</span><span class="v">${tt.done}</span></div>
    <div class="kpi"><span class="k">Всего карточек</span><span class="v">${tt.count}</span></div>
  </div>`;
  const dueNow = list.reduce((a, t) => a + L.cents(L.paymentPlan(t, state.today).dueNow), 0) / 100;
  return `<div class="kpis">
    <div class="kpi"><span class="k">В работе</span><span class="v">${tt.active}</span></div>
    <div class="kpi ${tt.overdue ? 'bad' : ''}"><span class="k">Срок сорван</span><span class="v">${tt.overdue}</span></div>
    <div class="kpi ${tt.review ? 'review' : ''}"><span class="k">На проверке</span><span class="v">${tt.review}</span></div>
    <div class="kpi"><span class="k">Бюджет</span><span class="v" title="${money(tt.budget)}">${money(tt.budget)}</span></div>
    <div class="kpi ok"><span class="k">Оплачено</span><span class="v" title="${money(tt.paid)}">${money(tt.paid)}</span></div>
    <div class="kpi ${dueNow > 0 ? 'warn' : ''}"><span class="k">Пора платить</span><span class="v" title="${money(dueNow)}">${money(dueNow)}</span></div>
    <div class="kpi"><span class="k">Всего осталось</span><span class="v" title="${money(tt.rest)}">${money(tt.rest)}</span></div>
  </div>`;
}

const panel = (title, items, emptyText, side) => `<section class="panel"><div class="panel-h"><h3>${title}</h3><span class="meta">${items.length}</span></div>
  <div>${items.length ? items.map(t => attItem(t, side)).join('') : `<div class="none">${emptyText}</div>`}</div></section>`;
/* ---------- long lists: draw the first part, «Показать ещё» for the rest ---------- */
// Building thousands of rows at once is what makes tabs slow; nobody reads past the first screens anyway.
const shownLimits = new Map();
const limitOf = (key, def) => shownLimits.get(key) || def;
function moreBtn(key, total, shown, step) {
  return total > shown ? `<button class="btn ghostbtn sm more-btn" type="button" data-act="show-more" data-key="${esc(key)}" data-step="${step}" data-shown="${shown}">Показать ещё ${Math.min(step, total - shown)} из ${total - shown}</button>` : '';
}
// Overview panel that can be folded (key → «o:key» in the folded set).
const panelK = (key, title, items, emptyText, side, extra = '') => {
  const f = isFolded('o:' + key);
  const lim = limitOf('o:' + key, 12);
  return `<section class="panel${f ? ' folded' : ''}" data-ov="${key}"><div class="panel-h">${foldBtn('o:' + key, f)}<h3>${title}</h3><span class="meta">${items.length}</span>${extra ? `<span class="spacer"></span>${extra}` : ''}</div>
  ${f ? '' : `<div>${items.length ? items.slice(0, lim).map(t => attItem(t, side)).join('') + moreBtn('o:' + key, items.length, Math.min(lim, items.length), 30) : `<div class="none">${emptyText}</div>`}</div>`}</section>`;
};

/* ---------- 4.1.1 (item 21): analytics in «Сводка» — from what Пульт already records ---------- */
function analyticsData(tasks) {
  const done = tasks.filter(t => t.status === 'done');
  const doneAt = t => [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'done')?.date || '';
  const onTime = done.filter(t => isDate(t.finish) && doneAt(t) && doneAt(t) <= t.finish).length;
  const rounds = done.map(t => (t.history || []).filter(h => h.type === 'status' && h.to === 'revision').length);
  const shifts = tasks.flatMap(t => (t.history || []).filter(h => h.type === 'finish' && isDate(h.from) && isDate(h.to) && h.to > h.from).map(h => ({ t, days: dayNum(h.to) - dayNum(h.from), reason: h.reason || '' })));
  const reasons = {};
  for (const x of shifts) reasons[x.reason] = (reasons[x.reason] || 0) + 1;
  const minutes = tasks.reduce((n, t) => n + spentOf(t), 0);
  const dirs = new Map();
  for (const t of done) {
    const d = A.directionOfMark(sectionsOf(t)[0] || '')?.label || 'Прочие', x = dirs.get(d) || { n: 0, ok: 0 };
    x.n++; if (isDate(t.finish) && doneAt(t) && doneAt(t) <= t.finish) x.ok++;
    dirs.set(d, x);
  }
  return { done: done.length, onTime, rounds: rounds.length ? rounds.reduce((a, b) => a + b, 0) / rounds.length : null,
    shift: shifts.length ? Math.round(shifts.reduce((a, x) => a + x.days, 0) / shifts.length) : null, shifts: shifts.length, reasons, hours: Math.round(minutes / 60), dirs };
}
function analyticsPanel(tasks) {
  const key = 'o:analytics', fold = isFolded(key), a = analyticsData(tasks);
  if (!a.done && !a.shifts && !a.hours) return '';
  const pct = (x, n) => (n ? Math.round((x / n) * 100) : 0);
  const kpi = (label, val, sub = '', tone = '') => `<div class="an-kpi"><span class="hint">${label}</span><b class="${tone}">${val}</b>${sub ? `<span class="hint">${sub}</span>` : ''}</div>`;
  const reasons = Object.entries(a.reasons).sort((x, y) => y[1] - x[1]);
  const rmax = Math.max(1, ...reasons.map(r => r[1]));
  const bar = (label, v, max, txt, cls = '') => `<div class="an-row"><span class="an-l">${esc(label)}</span><span class="an-b"><i class="${cls}" style="width:${Math.round((v / max) * 100)}%"></i></span><span class="an-v num">${txt}</span></div>`;
  const dirs = [...a.dirs.entries()].sort((x, y) => pct(y[1].ok, y[1].n) - pct(x[1].ok, x[1].n));
  const tone = p => (p >= 80 ? 'ok' : p >= 60 ? 'warn' : 'bad');
  return `<section class="panel an${fold ? ' folded' : ''}"><div class="panel-h">${foldBtn(key, fold)}<h3>Аналитика</h3><span class="meta">по всем карточкам, что вам видны</span></div>
    ${fold ? '' : `<div class="an-kpis">${kpi('Сдано в срок', a.done ? pct(a.onTime, a.done) + '%' : '—', a.done ? `${a.onTime} из ${a.done} принятых` : 'принятых пока нет', a.done ? 'kv-' + tone(pct(a.onTime, a.done)) : '')}
      ${kpi('Кругов замечаний', a.rounds === null ? '—' : String(a.rounds.toFixed(1)).replace('.', ','), 'в среднем на работу')}
      ${kpi('Средний перенос', a.shift === null ? '—' : `${a.shift} дн.`, a.shifts ? `переносов: ${a.shifts}` : 'переносов не было')}
      ${kpi('Часов по «Фокусу»', a.hours || '—', 'по таймеру в карточках')}</div>
    <div class="an-cols"><div><h4>Причины переносов</h4>${reasons.length ? reasons.map(([r, n]) => bar(SHIFT_REASONS[r] || 'не указана', n, rmax, `${pct(n, a.shifts)}%`)).join('') : '<p class="hint">Переносов не было.</p>'}</div>
      <div><h4>По направлениям — сдано в срок</h4>${dirs.length ? dirs.map(([d, x]) => bar(d, pct(x.ok, x.n), 100, `${pct(x.ok, x.n)}%`, 'an-' + tone(pct(x.ok, x.n)))).join('') : '<p class="hint">Принятых работ пока нет.</p>'}</div></div>`}</section>`;
}
function viewOverview() {
  if (isEmpty()) return emptyState();
  const list = tasksArr();
  const a = attention();
  const projects = liveProjects();
  const projRows = projects.map(p => {
    const pt = list.filter(t => t.projectId === p.id), x = totals(pt);
    return `<tr class="row" data-act="goto-project" data-id="${esc(p.id)}">
      <td><b>${esc(p.name)}</b>${p.code ? ` <span class="hint mono">${esc(p.code)}</span>` : ''}</td>
      <td>${projectStageChip(p)}</td>
      <td>${goalHtml(pt, true)}</td>
      <td class="num ${x.overdue ? 'neg' : ''}">${x.overdue || '—'}</td>
      <td class="num">${x.review || '—'}</td>
      ${canMoney() ? `<td class="r num">${money(x.budget)}</td><td class="r num">${money(x.paid)}</td>` : ''}
      ${canMoney() ? `<td class="r num ${x.rest < 0 ? 'neg' : ''}">${money(x.rest)}</td>` : ''}</tr>`;
  }).join('');
  const fresh = list.filter(unread), absent = list.filter(t => absHits(t).length), quiet = quietList(list);
  // Panels: [key, title, items, empty text (shown even when empty) | '' (hidden when empty), side renderer, extra header].
  const defs = [
    ['overdue', 'Срок сорван', a.overdue, 'Просроченных карточек нет.'],
    ['soon', 'Сдача в ближайшие 14 дней', a.soon, 'В ближайшие две недели сдач нет.'],
    ['new', 'Новое для вас', fresh, '', sideNew],
    ['review', 'Ждут вашей проверки', a.review, '', sideReview],
    ['absence', 'Срок попадает на отпуск или больничный', absent, '', sideAbsence],
    ['quiet', 'Тишина по карточкам', quiet, '', sideQuiet, quietSelect()],
    ['profile', 'Поручено не по профилю', offProfile(list), '', sideProfile],
    ['blocked', 'Под угрозой из-за смежников', a.blocked, '', sideBlocked],
    ['milestones', 'Сорваны контрольные точки', a.milestones, '', sideMilestone],
    ...(canMoney() ? [['pay', 'Пора платить', a.pay, '', sidePay], ['noact', 'Принято, но акт не подписан', a.noAct, '', sideNoAct]] : []),
  ];
  const byKey = new Map(defs.map(d => [d[0], d]));
  const shown = ovOrder(defs.map(d => d[0])).filter(k => !ovPrefs.hidden.includes(k)).map(k => byKey.get(k)).filter(d => d[2].length || d[3]);
  const projectsHidden = ovPrefs.hidden.includes('projects');
  // Hidden by default (or by the user) but not empty: say so, so nothing urgent slips by unnoticed.
  const hiddenWithCards = defs.filter(d => ovPrefs.hidden.includes(d[0]) && d[2].length);
  return `<div class="ov-bar">${ovMenu()}</div>
  ${A.isGip(state.me) && !ovPrefs.hidden.includes('progress') ? '' : kpiStrip(list)}
  ${A.isGip(state.me) && !ovPrefs.hidden.includes('progress') ? progressDashboard(list) : ''}
  ${shown.length ? `<div class="two">${shown.map(([key, title, items, emptyText, side, extra]) => panelK(key, title, items, emptyText, side, extra)).join('')}</div>` : ''}
  ${isSpec() ? '' : analyticsPanel(list)}
  ${cabinetInbox()}
  ${customerAlerts()}
  ${hiddenWithCards.length ? `<div class="ov-hidden hint">Скрытые панели, в которых есть карточки: ${hiddenWithCards.map(([k, t, items]) => `<button class="linkbtn" type="button" data-act="ov-show" data-id="${k}" title="Показать панель в сводке">${esc(t)} (${items.length})</button>`).join(', ')}
    · <button class="linkbtn" type="button" data-act="ov-show-all">показать все</button></div>` : ''}
  ${projectsHidden ? '' : `<section class="panel${isFolded('o:projects') ? ' folded' : ''}"><div class="panel-h">${foldBtn('o:projects', isFolded('o:projects'))}<h3>Проекты</h3><span class="meta">${projects.length}</span></div>
    ${isFolded('o:projects') ? '' : `<div class="tablewrap"><table><thead><tr><th>Проект</th><th>Стадия</th><th>${game ? 'Цель: разделы приняты' : 'Разделы приняты'}</th><th>Сорвано</th><th>На проверке</th>${canMoney() ? '<th class="r">Бюджет</th><th class="r">Оплачено</th><th class="r">Остаток</th>' : ''}</tr></thead>
    <tbody>${projRows || '<tr class="empty-row"><td colspan="8">Проектов пока нет.</td></tr>'}</tbody></table></div>`}</section>`}`;
}
// Customer side of projects: documents running out (within «напомнить за N дн.») and overdue requests to the customer.
function customerAlerts() {
  if (isSpec()) return '';
  const items = [];
  for (const p of liveProjects()) {
    for (const d of p.docs || []) {
      if (!isDate(d.until)) continue;
      const left = dayNum(d.until) - dayNum(state.today);
      if (left <= (d.remind ?? 60)) items.push({ p, sort: left, text: `${d.title}`, side: left < 0 ? `<span class="neg">истёк ${fmtDate(d.until)}</span>` : `<span class="warnv">до ${fmtDate(d.until)} · ${left} дн.</span>` });
    }
    for (const r of p.requests || []) if (!r.done && isDate(r.due) && r.due <= addDays(state.today, 3)) items.push({ p, sort: dayNum(r.due) - dayNum(state.today), text: `Ждём от заказчика: ${r.title}`, side: r.due < state.today ? `<span class="neg">срок прошёл ${fmtDate(r.due)}</span>` : `<span class="warnv">до ${fmtDate(r.due)}</span>` });
  }
  if (!items.length) return '';
  items.sort((a, b) => a.sort - b.sort);
  return `<section class="panel"><div class="panel-h"><h3>Заказчик: сроки документов и запросы</h3><span class="meta">${items.length}</span></div>
    ${items.map(x => `<button class="att cust-alert" type="button" data-act="open-project-cust" data-id="${esc(x.p.id)}"><span><b>${esc(x.text)}</b><br><span class="hint">${esc(x.p.name)}</span></span><span class="r">${x.side}</span></button>`).join('')}</section>`;
}
// Overview layout: panel order and hidden panels, per computer. Folding uses the shared «folded» set (o:key).
const OV_TITLES = { overdue: 'Срок сорван', soon: 'Сдача в ближайшие 14 дней', new: 'Новое для вас', review: 'Ждут вашей проверки', absence: 'Отпуск/больничный на сроке',
  quiet: 'Тишина по карточкам', progress: 'Выполнение (дашборд)', profile: 'Не по профилю', blocked: 'Под угрозой из-за смежников', milestones: 'Сорваны контрольные точки', pay: 'Пора платить', noact: 'Акт не подписан', projects: 'Проекты (таблица)' };
let ovPrefs = { order: [], hidden: [], ...loadLocal('overview', {}) };
// 2.5: a shorter overview by default — the rest is switched on in «Настройки → Панели сводки».
const OV_DEFAULT_HIDDEN = ['absence', 'quiet', 'profile', 'blocked', 'milestones', 'pay', 'noact'];
if (!ovPrefs.v) { ovPrefs = { ...ovPrefs, hidden: [...new Set([...ovPrefs.hidden, ...OV_DEFAULT_HIDDEN])], v: 2 }; saveLocal('overview', ovPrefs); }
function ovOrder(keys) {
  const order = ovPrefs.order.filter(k => keys.includes(k));
  for (const k of keys) if (!order.includes(k)) order.push(k);
  return order;
}
function setOvPrefs(patch) { ovPrefs = { ...ovPrefs, ...patch }; saveLocal('overview', ovPrefs); renderNow(); }
function ovMenu() {
  return `<button class="btn ghostbtn sm" type="button" data-act="settings" data-sec="ov" title="Какие панели показывать и в каком порядке">⚙ Панели</button>`;
}
const ovKeys = () => Object.keys(OV_TITLES).filter(k => !['projects', 'progress'].includes(k) && (canMoney() || !['pay', 'noact'].includes(k)));
function ovRowsHtml() {
  const keys = ovOrder(ovKeys());
  const row = (k, i, n) => `<div class="cols-row"><label class="chk"><input type="checkbox" data-act="ov-toggle" data-id="${k}"${ovPrefs.hidden.includes(k) ? '' : ' checked'}> ${OV_TITLES[k] || k}</label><span class="spacer"></span>${
    i >= 0 ? `<button class="btn ghostbtn sm" type="button" data-act="ov-move" data-id="${k}" data-dir="-1"${i ? '' : ' disabled'}>↑</button><button class="btn ghostbtn sm" type="button" data-act="ov-move" data-id="${k}" data-dir="1"${i < n - 1 ? '' : ' disabled'}>↓</button>` : ''}</div>`;
  return `<p class="hint">Пустые панели прячутся сами. Свернуть панель — стрелка ▾ у её названия.</p>${keys.map((k, i) => row(k, i, keys.length)).join('')}${A.isGip(state.me) ? row('progress', -1, 0) : ''}${row('projects', -1, 0)}
    <button class="btn ghostbtn sm" type="button" data-act="ov-reset">Как было</button>`;
}
function moveOv(id, dir) {
  const keys = ovOrder(ovKeys()), i = keys.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  setOvPrefs({ order: keys });
}

// The list shows projects as compact cards; a click opens the project page.
function projectPanel(p, list) {
  const pt = list.filter(t => t.projectId === p.id), x = totals(pt);
  const now = L.projectNow(p, state.today);
  return `<section class="panel pcard ${p.archived ? 'archived' : ''}" id="p-${esc(p.id)}">
    <div class="panel-h">
      <button class="pcard-open" type="button" data-act="project-page" data-id="${esc(p.id)}">${projIcon(p)}<h3>${esc(p.name)}</h3></button>
      ${p.archived ? '<span class="chip tone-idle">в архиве</span>' : projectStageChip(p)}
      ${p.code ? `<span class="pcode mono">${esc(p.code)}</span>` : ''}
      ${p.client ? `<span class="meta">${esc(p.client)}</span>` : ''}
      <span class="spacer"></span>
      ${p.folder ? `<button class="btn ghostbtn sm" data-act="open-folder" data-id="${esc(p.id)}" type="button" title="${esc(p.folder)}">Папка проекта</button>` : ''}
      ${p.archived ? `<button class="btn sm" data-act="unarchive" data-id="${esc(p.id)}" type="button">Вернуть из архива</button>` : ''}
      <button class="btn ghostbtn sm" data-act="open-project" data-id="${esc(p.id)}" type="button">Изменить</button>
    </div>
    <button class="pcard-body" type="button" data-act="project-page" data-id="${esc(p.id)}">
      ${ptProgress(pt) || '<span class="hint">задач пока нет</span>'}
      <span class="meta">${[taskCounts(pt).work ? `в работе ${taskCounts(pt).work}` : '', x.review ? `на проверке ${x.review}` : '',
        now.current ? `этап: ${esc(L.phaseLabel(now.current.key))}${now.behind ? ` <span class="neg">(отставание ${now.behind} дн.)</span>` : ''}` : '',
        memberIds(p).length ? `участников ${memberIds(p).length}` : '', (() => { const c = chatById(projectChatId(p.id)); const n = c ? msgUnread(c).length : 0; return n ? `<b class="chat-new">чат: новых ${n}</b>` : ''; })()].filter(Boolean).join(' · ')}</span>
    </button>
  </section>`;
}

// Completion forecast (3.6): at the pace of the last 60 days (works accepted per day), when will the remaining
// works of the project be accepted, against the latest planned finish. Assignments are not counted.
function projectForecast(tasks) {
  const work = tasks.filter(t => t.kind !== 'assign');
  const left = work.filter(t => t.status !== 'done');
  if (!work.length) return null;
  if (!left.length) return { done: true };
  const from = addDays(state.today, -60);
  const accepted = work.filter(t => t.status === 'done' && (([...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'done')?.date) || '') >= from).length;
  const plan = left.map(t => t.finish).filter(isDate).sort().at(-1) || '';
  if (accepted < 2) return { few: true, accepted, left: left.length, plan };
  const date = addDays(state.today, Math.ceil(left.length / (accepted / 60)));
  return { date, plan, accepted, left: left.length, late: plan ? dayNum(date) - dayNum(plan) : null };
}
function forecastTile(tasks, tile) {
  const f = projectForecast(tasks);
  if (!f || f.done) return '';
  if (f.few) return `<div class="pt-kpi" title="Прогноз считается по темпу приёмки за 60 дней; принято за это время: ${f.accepted}"><b>—</b><span>прогноз сдачи: мало данных (принято за 60 дн.: ${f.accepted})</span></div>`;
  const tone = f.late > 14 ? 'bad' : f.late > 0 ? 'warn' : '';
  return tile(fmtDate(f.date), `прогноз сдачи всех работ · темп ${f.accepted} за 60 дн.${f.plan ? ` · план ${fmtDate(f.plan)}${f.late ? ` (${f.late > 0 ? '+' : ''}${f.late} дн.)` : ''}` : ''}`, tone);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'prog-weight': ({ el }) => { progWeight = el.dataset.v; saveLocal('progWeight', progWeight); renderNow(); },
  'show-more': ({ el }) => { shownLimits.set(el.dataset.key, Number(el.dataset.shown) + Number(el.dataset.step)); renderNow(); },
  'ov-move': ({ el }) => { moveOv(el.dataset.id, Number(el.dataset.dir)); },
  'ov-show': ({ el }) => { setOvPrefs({ hidden: ovPrefs.hidden.filter(k => k !== el.dataset.id) }); },
  'ov-show-all': () => { setOvPrefs({ hidden: ovPrefs.hidden.filter(k => k === 'projects' && ovPrefs.hidden.includes('projects')) }); },
  'ov-reset': () => { setOvPrefs({ order: [], hidden: [...OV_DEFAULT_HIDDEN] }); },
});

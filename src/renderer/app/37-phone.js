/* ---------- 4.23: Пульт on a phone (item 64) — its own screens for the web version on a narrow screen ---------- */
// Not the desktop squeezed: what a GIP does away from the desk — what needs me now, accept or return work, the
// cards as a board, a project's critical path and a moved deadline, messages. The same data, rights and actions
// as the desktop screens (changeStatus, commitDates, reassign, the messenger, the card form). «Полная версия» in
// «Ещё» switches back to the desktop screens on the phone (remembered), the user menu brings this back.
const PHONE_MQ = window.matchMedia?.('(max-width: 700px)');
const phoneOn = () => !SOLO && !!PHONE_MQ?.matches && document.documentElement.classList.contains('web') && !loadLocal('phoneOff', false);
PHONE_MQ?.addEventListener?.('change', () => render());
let ph = { v: 'day', pid: '', proj: '', rq: 0, cpAll: false, scroll: {} };
const PH_TABS = [['day', 'Мой день'], ['cards', 'Карточки'], ['msgs', 'Сообщения'], ['projs', 'Проекты'], ['more', 'Ещё']];
const PH_PARENT = { review: 'day', list: 'day', proj: 'projs', letters: 'more', people: 'more' };
const PH_NAV = { review: 'day', list: 'day', proj: 'projs', letters: 'more', people: 'more' };
const PH_ICON = {
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  cards: '<rect x="3" y="4" width="5" height="16"/><rect x="10" y="4" width="5" height="11"/><rect x="17" y="4" width="4" height="7"/>',
  msgs: '<path d="M4 5h16v11H9l-5 4z"/>',
  projs: '<path d="M3 7h7l2 2h9v11H3z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
  fire: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>', ok: '<path d="M5 12l4 4 10-10"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/>', exp: '<path d="M7 3h7l5 5v13H7z"/><path d="M10 13l2 2 4-4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 015 5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  desk: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>', chev: '<path d="M9 6l6 6-6 6"/>',
};
const phI = (k, cls = '') => `<svg class="ph-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PH_ICON[k] || ''}</svg>`;
const phCnt = n => (n ? `<span class="ph-bdg">${n > 99 ? '99+' : n}</span>` : '');
const phInitials = u => esc(initials(u?.name || '?'));
const phDays = iso => (isDate(iso) ? dayNum(iso) - dayNum(state.today) : null);
// Who does a card: the executor, else the one responsible in the team.
const phWho = t => executorOf(t)?.name || ownerOf(t)?.name || 'нет исполнителя';
const phCustUnread = () => (cab?.allowed ? cab.messages.filter(m => !m.read).length : 0);
// The «first» row: an icon, what, where, a figure on the right; `act` is the data-act with its data.
const phFirst = (tone, ico, title, sub, side, act) => `<button class="ph-first ${tone}" type="button" ${act}><span class="ic">${phI(ico)}</span><span class="mn"><b>${title}</b><small>${sub}</small></span>${side ? `<span class="tm">${side}</span>` : ''}</button>`;

/* ---- Мой день ---- */
function phDay() {
  const a = attention(), spec = isSpec(), me = state.me, mine = myCards();
  const review = spec ? [] : a.review, overdue = spec ? mine.filter(t => timing(t).overdue) : a.overdue;
  const soon = (spec ? mine : tasksArr().filter(t => ACTIVE.has(t.status))).filter(t => !timing(t).overdue && isDate(t.finish) && phDays(t.finish) <= 1);
  const mt = msgTotals(), cust = phCustUnread();
  const hour = new Date().getHours(), hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = me?.name ? me.name.split(' ').slice(1).join(' ') || me.name : '';
  const kpi = (n, label, cls, act) => `<button class="ph-kpi ${n ? cls : ''}" type="button" ${act}><b class="num">${n}</b><span>${label}</span></button>`;
  const kpis = spec
    ? kpi(mine.length, 'мои карточки', '', 'data-act="ph-go" data-v="cards"') + kpi(overdue.length, 'срок сорван', 'r', 'data-act="ph-go" data-v="list" data-id="overdue"')
    : kpi(review.length, 'на проверке у вас', 'o', 'data-act="ph-go" data-v="review"') + kpi(overdue.length, 'срок сорван', 'r', 'data-act="ph-go" data-v="list" data-id="overdue"');
  const kpis2 = kpi(mt.n + cust, cust ? `сообщений · ${cust} от заказчиков` : 'новых сообщений', '', 'data-act="ph-msgs"') + kpi(soon.length, 'сдать сегодня–завтра', '', 'data-act="ph-go" data-v="list" data-id="soon"');
  const first = [];
  // A burning question of a customer first: the GIP answers it within the hour.
  if (cab?.allowed) for (const m of cab.messages.filter(x => !x.read && x.kind === 'urgent').slice(0, 3)) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(m.ts)) / 60000));
    first.push(phFirst('r', 'fire', `Горящий вопрос заказчика`, `${esc(state.projects.get(m.projectId)?.name || m.projectName || '')} · ${esc(m.customerName || '')}${m.text ? ' · ' + esc(m.text.slice(0, 60)) : ''}`, mins < 600 ? `${mins} мин` : '', `data-act="ph-msgs" data-id="c:${esc(m.projectId)}"`));
  }
  if (review.length) first.push(phFirst('', 'ok', `Проверить ${review.length} ${plural(review.length, 'карточку', 'карточки', 'карточек')}`, esc(review.slice(0, 3).map(t => marksText(t)).join(', ')), '→', 'data-act="ph-go" data-v="review"'));
  for (const t of overdue.slice(0, 5)) {
    const late = dayNum(state.today) - dayNum(t.finish), crit = cpOf(t.projectId).critical.has(t.id);
    first.push(phFirst('r', 'clock', `${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}`, `${esc(projectOf(t)?.name || '')} · ${esc(phWho(t))}${crit ? ' · на критическом пути' : ''}`, `−${late} дн`, `data-act="open-task" data-id="${esc(t.id)}"`));
  }
  for (const { p, r } of myRemarks().slice(0, 4)) first.push(phFirst(exLate(r) ? 'r' : '', 'exp', `Замечание экспертизы ${esc(r.n || '')}${r.mark ? ' · ' + esc(r.mark) : ''}`, `${esc(p.name)} · ${esc(String(r.text || '').slice(0, 70))}`, isDate(r.due) ? `до ${fmtDate(r.due).slice(0, 5)}` : '', `data-act="ph-remark" data-id="${esc(p.id)}" data-v="${esc(r.id)}"`));
  const asgIn = tasksArr().filter(t => t.kind === 'assign' && t.status === 'review' && asgTo(t).some(x => hasOwner(x, me?.id)));
  for (const t of asgIn.slice(0, 3)) first.push(phFirst('b', 'arrow', `Вам выдано задание: ${esc(t.note || t.title)}`, `${esc(projectOf(t)?.name || '')} · примите или верните`, '', `data-act="ph-go" data-v="proj" data-id="${esc(t.projectId)}"`));
  const asgLateMine = asgToGive(me?.id).filter(asgLate);
  for (const t of asgLateMine.slice(0, 3)) first.push(phFirst('r', 'arrow', `Задание не выдано: ${esc(t.note || t.title)}`, `${esc(projectOf(t)?.name || '')} · ждут ${esc(asgTo(t).map(x => marksText(x)).join(', '))}`, `−${dayNum(state.today) - dayNum(t.finish)} дн`, `data-act="ph-go" data-v="proj" data-id="${esc(t.projectId)}"`));
  if (!spec) for (const { p, d, left } of dayDocs().slice(0, 3)) first.push(phFirst(left < 0 ? 'r' : 'b', 'doc', `${esc(d.title || d.kind || 'Документ')} ${left < 0 ? 'истёк' : `истекает через ${left} дн.`}`, esc(p.name), `${left} д`, `data-act="ph-go" data-v="proj" data-id="${esc(p.id)}"`));
  const work = mine.filter(t => ['in_progress', 'revision', 'not_started'].includes(t.status)).sort(sortByDeadline).slice(0, 8);
  const workRow = t => `<div class="ph-row"><button class="mn" type="button" data-act="open-task" data-id="${esc(t.id)}"><b>${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</b><small>${esc(projectOf(t)?.name || '')} · <span class="${timing(t).cls}">${esc(timing(t).text)}</span></small></button>
    ${t.status === 'not_started' ? `<button class="ph-btn sm" type="button" data-act="cm-quick" data-q="start" data-id="${esc(t.id)}">Начать</button>` : `<button class="ph-btn sm dark" type="button" data-act="${focus?.taskId === t.id ? 'focus-stop' : 'focus-start'}" data-id="${esc(t.id)}">${focus?.taskId === t.id ? 'Стоп' : 'Фокус'}</button>`}</div>`;
  const idle = idlePeople();
  return { title: 'Мой день', sub: new Date(state.today + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }), body: `
    <div class="ph-h2">${hello}${name ? `, <em>${esc(name)}</em>` : ''}</div>
    <div class="ph-kpis">${kpis}${kpis2}</div>
    <div class="ph-h3">Сначала это</div>${first.join('') || '<p class="ph-empty">Ничего срочного — всё по плану.</p>'}
    ${work.length ? `<div class="ph-h3">Мои карточки <span>${mine.length}</span></div><div class="ph-card ph-rows">${work.map(workRow).join('')}</div>` : ''}
    ${idle.length ? `<div class="ph-h3">Свободны или без задач</div><div class="ph-people">${idle.slice(0, 12).map(u => `<button class="ph-pp" type="button" data-act="ph-assign" data-id="${esc(u.id)}">${avatarHtml(u, 'sm')}<b>${esc(surnameOf(u.name))}</b><small>${esc(A.directionLabels(u).join(', ') || A.ROLES[u.role]?.label || '')}</small></button>`).join('')}</div>` : ''}` };
}

/* ---- Проверка: one card after another, accept or return with a remark ---- */
function phReview() {
  const ids = attention().review.map(t => t.id);
  if (!ids.length) return { title: 'Проверка', sub: 'очередь пуста', body: `<div class="ph-card ph-center"><b>Очередь пуста</b><p class="ph-empty">Всё, что сдали на проверку, разобрано.</p></div>` };
  ph.rq = Math.max(0, Math.min(ph.rq, ids.length - 1));
  const t = state.tasks.get(ids[ph.rq]), p = projectOf(t);
  const sub = [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'review');
  const files = [...(t.files || []), ...[...(t.history || [])].reverse().flatMap(h => h.files || [])].slice(0, 4);
  return { title: 'Проверка', sub: `${ph.rq + 1} из ${ids.length}`, body: `
    <div class="ph-prog">${ids.map((_, i) => `<i class="${i < ph.rq ? 'ok' : i === ph.rq ? 'on' : ''}"></i>`).join('')}</div>
    <div class="ph-card"><div class="ph-row0"><span class="chip tone-review">на проверке</span><span class="ph-xs">${sub ? 'сдано ' + fmtDate(sub.date || String(sub.ts).slice(0, 10)) : ''}</span></div>
      <div class="ph-big">${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</div>
      <div class="ph-xs">${esc(phWho(t))} · ${esc(p?.name || '')} · срок ${fmtDate(t.finish)}</div>
      <div class="ph-lbl">Что сделано</div><div class="ph-note">${sub?.note ? esc(sub.note) : '<span class="ph-xs">Без описания.</span>'}</div>
      ${files.length ? `<div class="ph-lbl">Файлы</div>${files.map(f => `<div class="ph-file"><span class="ext">${esc(String(f.name || f).split('.').pop().slice(0, 4).toUpperCase())}</span><span>${esc(f.name || f)}</span></div>`).join('')}` : ''}
      <button class="ph-link" type="button" data-act="open-task" data-id="${esc(t.id)}">Открыть карточку целиком</button></div>
    <label class="ph-lbl" for="ph-rq-note">Замечание — обязательно, если вернуть</label><textarea id="ph-rq-note" class="ph-ta" rows="3" maxlength="1500" placeholder="Что исправить…"></textarea>
    <div class="ph-act2"><button class="ph-btn back" type="button" data-act="ph-rq" data-v="back">${phI('back')}Вернуть</button><button class="ph-btn ok" type="button" data-act="ph-rq" data-v="ok">${phI('ok')}Принять</button></div>
    <div class="ph-act2 thin"><button class="ph-btn ghost" type="button" data-act="ph-rq" data-v="prev"${ph.rq ? '' : ' disabled'}>← Назад</button><button class="ph-btn ghost" type="button" data-act="ph-rq" data-v="next"${ph.rq < ids.length - 1 ? '' : ' disabled'}>Пропустить →</button></div>` };
}
async function phRq(v) {
  const ids = attention().review.map(t => t.id), id = ids[ph.rq];
  if (v === 'prev') { ph.rq--; return renderNow(); }
  if (v === 'next') { ph.rq++; return renderNow(); }
  if (!id) return;
  if (v === 'ok') return changeStatus(id, QUICK.accept.to, 'принято с телефона');
  const ta = $('#ph-rq-note'), note = ta?.value.trim();
  if (!note) { ta?.classList.add('field-bad'); ta?.focus(); return toast('Напишите, что исправить, — без замечания вернуть нельзя.', true); }
  return changeStatus(id, QUICK.remarks.to, note);
}

/* ---- a plain list from «Мой день»: overdue, due today–tomorrow ---- */
function phList() {
  const spec = isSpec(), mine = myCards(), a = attention();
  const lists = {
    overdue: ['Срок сорван', spec ? mine.filter(t => timing(t).overdue) : a.overdue],
    soon: ['Сдать сегодня–завтра', (spec ? mine : tasksArr().filter(t => ACTIVE.has(t.status))).filter(t => !timing(t).overdue && isDate(t.finish) && phDays(t.finish) <= 1)],
  };
  const [title, list] = lists[ph.pid] || lists.overdue;
  return { title, sub: `${list.length} ${plural(list.length, 'карточка', 'карточки', 'карточек')}`, body: list.length ? list.sort(sortByDeadline).map(phKc).join('') : '<p class="ph-empty">Здесь пусто.</p>' };
}

/* ---- Карточки: the board, a column per screen, swiped sideways ---- */
const PH_COLS = [['Очередь', ['not_started', 'paused'], ''], ['В работе', ['in_progress', 'revision'], 'w'], ['На проверке', ['review'], 'r'], ['Готово', ['done'], 'd']];
function phKc(t) {
  const ex = executorOf(t) || (ownerOf(t) ? { u: ownerOf(t), name: ownerOf(t).name } : null), tm = timing(t), crit = t.status !== 'done' && cpOf(t.projectId).critical.has(t.id);
  return `<button class="ph-kc${crit ? ' cp' : ''}" type="button" data-act="open-task" data-id="${esc(t.id)}"><span class="p">${esc(projectOf(t)?.name || '')} · ${esc(sectionsOf(t).join(', ') || '—')}</span>
    <span class="n">${esc(t.title || marksText(t) || 'Карточка')}</span>
    <span class="f">${ex?.u ? avatarHtml(ex.u, 'xs') : ex ? `<span class="ava xs">${esc(initials(ex.name))}</span>` : '<span class="chip tone-bad">нет исполнителя</span>'}${t.status === 'revision' ? '<span class="chip tone-warn">доработка</span>' : ''}${crit ? '<span class="chip tone-bad">крит. путь</span>' : ''}<span class="d ${tm.cls}">${t.status === 'done' ? fmtDate(t.finish).slice(0, 5) : esc(tm.text)}</span></span></button>`;
}
function phCards() {
  const all = tasksArr().filter(t => t.kind !== 'assign' && (!ph.proj || t.projectId === ph.proj));
  const pids = [...new Set(tasksArr().filter(t => t.kind !== 'assign' && t.status !== 'done').map(t => t.projectId))].map(id => state.projects.get(id)).filter(Boolean).sort(byName);
  const chips = `<div class="ph-chips"><button type="button" class="${ph.proj ? '' : 'on'}" data-act="ph-proj" data-id="">Все проекты</button>${pids.map(p => `<button type="button" class="${ph.proj === p.id ? 'on' : ''}" data-act="ph-proj" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`;
  const cols = PH_COLS.map(([label, sts, cls]) => {
    let list = all.filter(t => sts.includes(t.status));
    list = cls === 'd' ? list.sort((a, b) => String(b.finish || '').localeCompare(String(a.finish || ''))).slice(0, 15) : list.sort(sortByDeadline);
    return `<div class="ph-col ${cls}"><div class="ch"><span>${label}</span><span class="chip tone-idle">${all.filter(t => sts.includes(t.status)).length}</span></div>${list.map(phKc).join('') || '<p class="ph-empty">Пусто</p>'}</div>`;
  }).join('');
  return { title: 'Карточки', sub: ph.proj ? state.projects.get(ph.proj)?.name || '' : 'все проекты', body: `${chips}<div class="ph-kb" id="ph-kb">${cols}</div>
    <div class="ph-dots" id="ph-dots">${PH_COLS.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><p class="ph-hint">Листайте колонки влево-вправо · карточка открывается целиком</p>` };
}

/* ---- Проекты: the portfolio, then a project — critical path, moving a deadline, what it waits for ---- */
function phProjRisk(p) {
  const cp = cpOf(p.id), dl = projDeadline(p), ts = tasksArr().filter(t => t.projectId === p.id && t.kind !== 'assign');
  const late = ts.filter(t => timing(t).overdue).length;
  if (cp.end && dl && cp.end > dl) return ['bad', `риск +${dayNum(cp.end) - dayNum(dl)} дн`];
  if (late) return ['warn', `сорвано ${late}`];
  return ts.some(t => t.status !== 'done') ? ['ok', 'по графику'] : ['idle', 'нет работ'];
}
function phLane(p) {
  const [tone, label] = phProjRisk(p);
  const ph0 = (p.phases || []).filter(x => isDate(x.start) && isDate(x.finish));
  let bar = '';
  if (ph0.length) {
    const s = Math.min(...ph0.map(x => dayNum(x.start))), e = Math.max(...ph0.map(x => dayNum(x.finish))), w = Math.max(1, e - s), now = dayNum(state.today);
    bar = `<span class="ph-tl">${ph0.map(x => `<i class="${dayNum(x.finish) < now ? 'done' : dayNum(x.start) <= now ? 'cur' : ''}" style="left:${((dayNum(x.start) - s) / w) * 100}%;width:${Math.max(2, ((dayNum(x.finish) - dayNum(x.start)) / w) * 100)}%"></i>`).join('')}${now >= s && now <= e ? `<span class="now" style="left:${((now - s) / w) * 100}%"></span>` : ''}</span>
      <span class="ph-tll">${ph0.map(x => `<span>${esc(L.phaseLabel(x.key))}</span>`).join('')}</span>`;
  } else {
    const ts = tasksArr().filter(t => t.projectId === p.id && t.kind !== 'assign'), done = ts.filter(t => t.status === 'done').length;
    bar = `<span class="ph-tl"><i class="done" style="left:0;width:${ts.length ? (done / ts.length) * 100 : 0}%"></i></span><span class="ph-tll"><span>принято ${done} из ${ts.length}</span></span>`;
  }
  return `<button class="ph-lane" type="button" data-act="ph-go" data-v="proj" data-id="${esc(p.id)}"><span class="t"><b>${esc(p.name)}</b><span class="chip tone-${tone}">${label}</span></span>${bar}</button>`;
}
function phLoad() {
  // Active cards per working week for the next 4 weeks, against the people who carry them.
  const staff = liveUsers().filter(u => !A.isGip(u)).length || 1, out = [];
  for (let w = 0; w < 8; w++) {
    const a = addDays(state.today, w * 7), b = addDays(a, 6);
    const n = tasksArr().filter(t => ACTIVE.has(t.status) && t.kind !== 'assign' && isDate(t.start) && isDate(t.finish) && t.start <= b && t.finish >= a).length;
    out.push({ a, n });
  }
  const max = Math.max(...out.map(x => x.n), staff);
  return `<div class="ph-card"><div class="ph-wl">${out.map(x => `<i class="${x.n > staff * 1.5 ? 'over' : x.n > staff ? 'hi' : ''}" style="height:${Math.max(4, (x.n / max) * 100)}%" title="${fmtDate(x.a)}: ${x.n}"></i>`).join('')}</div>
    <div class="ph-tll"><span>${fmtDate(out[0].a).slice(0, 5)}</span><span>карточек в работе на неделе · людей ${staff}</span><span>${fmtDate(out.at(-1).a).slice(0, 5)}</span></div></div>`;
}
function phProjs() {
  const ps = liveProjects();
  return { title: 'Проекты', sub: `${ps.length} ${plural(ps.length, 'активный', 'активных', 'активных')}`, body: `${ps.map(phLane).join('') || '<p class="ph-empty">Проектов пока нет.</p>'}
    ${isSpec() ? '' : `<div class="ph-h3">Загрузка · 8 недель</div>${phLoad()}`}` };
}
function phProj() {
  const p = state.projects.get(ph.pid);
  if (!p) { ph.v = 'projs'; return phProjs(); }
  const ts = tasksArr().filter(t => t.projectId === p.id && t.kind !== 'assign'), cp = cpOf(p.id), dl = projDeadline(p), end = cp.end;
  const slack = dl && end ? dayNum(dl) - dayNum(end) : null, toEnd = phDays(dl || end);
  const ird = (p.ird || []).filter(r => r.title), got = ird.filter(r => L.IRD_RECEIVED.includes(r.status)).length;
  const act = ts.filter(t => t.status !== 'done' && isDate(t.finish)).sort((a, b) => a.finish.localeCompare(b.finish));
  const rows = act.filter(t => ph.cpAll || cp.critical.has(t.id)).slice(0, 30).map(t => {
    const f = cp.float.get(t.id) ?? null, crit = cp.critical.has(t.id);
    return `<li class="${crit ? 'c' : 'nc'}"><span class="rh"></span><button class="mn" type="button" data-act="open-task" data-id="${esc(t.id)}"><b>${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</b><small>${esc(phWho(t))} · до ${fmtDate(t.finish)}</small></button>
      <span class="fl ${crit ? 'bad' : 'ok'}">${timing(t).overdue ? `−${dayNum(state.today) - dayNum(t.finish)} дн` : f === null ? '' : crit ? '0 дн' : `запас ${f} дн`}</span></li>`;
  }).join('');
  const waitIrd = ird.filter(r => !L.IRD_RECEIVED.includes(r.status)).slice(0, 6);
  const letters = lettersOf(p.id).filter(l => l.dir === 'in' && l.status === 'answer').slice(0, 5);
  const asg = asgOf(p.id).filter(t => t.status !== 'done').slice(0, 6);
  const remarksOpen = [...state.remarks.values()].filter(r => r.projectId === p.id && r.status !== 'closed').length;
  const kpi = (v, l, cls = '') => `<div><b class="num ${cls}">${v}</b><span>${l}</span></div>`;
  return { title: p.name, sub: [p.code, dl ? `сдача ${fmtDate(dl)}` : ''].filter(Boolean).join(' · '), body: `
    <div class="ph-card ph-k3">${kpi(toEnd === null ? '—' : toEnd, dl ? 'дней до сдачи' : 'дней до конца работ', 'o')}${kpi(slack === null ? '—' : slack, 'запас крит. пути', slack !== null && slack < 0 ? 'bad' : '')}${kpi(ird.length ? `${got}/${ird.length}` : '—', 'ИРД получено')}</div>
    <div class="ph-h3">Критический путь <button class="ph-tog${ph.cpAll ? ' off' : ''}" type="button" data-act="ph-cp" aria-pressed="${!ph.cpAll}">только критические</button></div>
    <div class="ph-card"><ul class="ph-cp">${rows || '<li class="ph-empty">Работ с датами нет.</li>'}</ul></div>
    ${A.canEditTaskFields(state.me) && act.length ? `<button class="ph-btn ghost" type="button" data-act="ph-shift" data-id="${esc(p.id)}">Перенести срок…</button>` : ''}
    ${remarksOpen ? `<div class="ph-h3">Экспертиза</div>${phFirst('', 'exp', `Замечаний без закрытия: ${remarksOpen}`, esc(exOf(p).org || 'экспертиза'), '', `data-act="ph-full" data-id="${esc(p.id)}"`)}` : ''}
    ${asg.length ? `<div class="ph-h3">Задания смежникам</div><div class="ph-card ph-rows">${asg.map(t => { const [tone, l] = ASG_STATE[t.status] || ['idle', '']; return `<div class="ph-row"><span class="mn"><b>${esc(t.note || t.title)}</b><small>${esc(asgFrom(t) ? marksText(asgFrom(t)) : '—')} → ${esc(asgTo(t).map(x => marksText(x)).join(', ') || '—')} · ${isDate(t.finish) ? fmtDate(t.finish) : '—'}</small></span><span class="chip tone-${asgLate(t) ? 'bad' : tone}">${asgLate(t) ? 'сорвано' : l}</span></div>`; }).join('')}</div>` : ''}
    ${waitIrd.length || letters.length ? `<div class="ph-h3">Исходные данные и письма</div><div class="ph-card ph-rows">
      ${waitIrd.map(r => `<div class="ph-row"><span class="ext x">ИРД</span><span class="mn"><b>${esc(r.title)}</b><small>${esc(r.who || '')}${isDate(r.due) ? ' · до ' + fmtDate(r.due) : ''}</small></span>${isDate(r.due) && phDays(r.due) <= 3 ? `<span class="chip tone-${phDays(r.due) < 0 ? 'bad' : 'warn'}">${phDays(r.due)} дн</span>` : ''}</div>`).join('')}
      ${letters.map(l => `<button class="ph-row" type="button" data-act="ph-letter" data-id="${esc(l.id)}"><span class="ext dwg">ВХ</span><span class="mn"><b>Вх. ${esc(l.seq || '')} · ${esc(l.subject || '')}</b><small>${esc(l.corr || '')}${isDate(l.due) ? ' · ответить до ' + fmtDate(l.due) : ''}</small></span></button>`).join('')}</div>` : ''}
    <button class="ph-btn ghost" type="button" data-act="ph-full" data-id="${esc(p.id)}">${phI('desk')}Полная страница проекта</button>` };
}
// «Перенести срок…»: a card of the project, a new finish; what moves with it is asked in the same dialog as on the desktop.
function phShift(pid) {
  const act = tasksArr().filter(t => t.projectId === pid && t.kind !== 'assign' && t.status !== 'done' && isDate(t.finish)).sort((a, b) => a.finish.localeCompare(b.finish));
  const cp = cpOf(pid);
  const { root, q, close } = openModal(`<form class="modal ph-sheet" role="dialog" aria-modal="true" aria-labelledby="phs-t" novalidate><h2 id="phs-t">Перенести срок</h2>
    <div class="f"><label for="phs-task">Карточка</label><select id="phs-task">${act.map(t => `<option value="${esc(t.id)}">${cp.critical.has(t.id) ? '◆ ' : ''}${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''} — ${fmtDate(t.finish)}</option>`).join('')}</select></div>
    <div class="f"><label for="phs-date">Новый срок</label><input id="phs-date" type="date"></div>
    <div class="hint2" id="phs-eff"></div><div class="err" id="phs-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Дальше</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
  const effect = () => {
    const t = state.tasks.get(q('#phs-task').value), d = q('#phs-date').value;
    if (!t || !isDate(d)) { q('#phs-eff').textContent = ''; return null; }
    const next = { start: isDate(t.start) && d < t.start ? d : t.start, finish: d };
    const all = tasksArr().filter(x => x.projectId === pid), moved = L.shiftFollowers(all, t.id, next);
    moved.delete(t.id);
    const end1 = L.criticalPath(all.map(x => (x.id === t.id ? { ...x, ...next } : moved.has(x.id) ? { ...x, ...moved.get(x.id) } : x))).end;
    q('#phs-eff').innerHTML = `<b>Последствия:</b> ${moved.size ? `сдвинутся ещё ${moved.size} ${plural(moved.size, 'карточка', 'карточки', 'карточек')}` : 'другие карточки не сдвигаются'}${cp.end && end1 && end1 !== cp.end ? `; конец работ ${fmtDate(cp.end)} → <b>${fmtDate(end1)}</b>` : ''}.`;
    return { t, next, moved };
  };
  const pickDefault = () => { const t = state.tasks.get(q('#phs-task').value); q('#phs-date').value = t ? nextWorkDay(t.finish) : ''; effect(); };
  q('#phs-task').addEventListener('change', pickDefault); q('#phs-date').addEventListener('input', effect);
  pickDefault();
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const x = effect();
    if (!x) return modalErr(root, '#phs-err', 'Укажите новый срок.', '#phs-date');
    close();
    await commitDates(x.t.id, x.next, x.moved.size ? x.moved : null);
  });
}

/* ---- Ещё ---- */
function phMore() {
  const waiting = [...state.letters.values()].filter(l => l.dir === 'in' && l.status === 'answer' && !state.projects.get(l.projectId)?.archived).length;
  const item = (ico, label, act, extra = '') => `<button class="ph-mi" type="button" ${act}>${phI(ico)}<span>${label}</span>${extra}${phI('chev', 'ar')}</button>`;
  return { title: 'Ещё', sub: '', body: `<div class="ph-menu">
    ${isSpec() ? '' : item('mail', 'Письма', 'data-act="ph-go" data-v="letters"', waiting ? `<span class="chip tone-warn">${waiting} ждут ответа</span>` : '')}
    ${item('people', 'Люди', 'data-act="ph-go" data-v="people"')}
    ${item('bell', 'Мой профиль', 'data-act="my-profile"')}
    ${item('gear', 'Настройки', 'data-act="settings"')}
    ${item('desk', 'Полная версия', 'data-act="ph-full"', '<span class="ph-xs">как на компьютере</span>')}
    </div><p class="ph-hint">Гант целиком, таблицы ИРД, составление писем и отчёты удобнее на компьютере — здесь просмотр и быстрые действия.</p>` };
}
function phLetters() {
  const list = [...state.letters.values()].filter(l => !state.projects.get(l.projectId)?.archived)
    .sort((a, b) => (b.dir === 'in' && b.status === 'answer') - (a.dir === 'in' && a.status === 'answer') || String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 40);
  return { title: 'Письма', sub: 'входящие, ждущие ответа, — сверху', body: list.length ? `<div class="ph-card ph-rows">${list.map(l => `<button class="ph-row" type="button" data-act="ph-letter" data-id="${esc(l.id)}"><span class="ext ${l.dir === 'in' ? 'dwg' : 'x'}">${l.dir === 'in' ? 'ВХ' : 'ИСХ'}</span><span class="mn"><b>${l.dir === 'in' ? 'Вх.' : 'Исх.'} ${esc(l.seq || '')} · ${esc(l.subject || '')}</b><small>${esc(state.projects.get(l.projectId)?.name || '')} · ${esc(l.corr || '')} · ${isDate(l.date) ? fmtDate(l.date) : ''}</small></span>${l.dir === 'in' && l.status === 'answer' ? '<span class="chip tone-warn">ответ</span>' : ''}</button>`).join('')}</div>` : '<p class="ph-empty">Писем пока нет.</p>' };
}
function phPeople() {
  const list = liveUsers().sort(byName);
  return { title: 'Люди', sub: `${list.length}`, body: `<div class="ph-card ph-rows">${list.map(u => { const st = personState(u); return `<button class="ph-row" type="button" data-act="person-open" data-id="${esc(u.id)}">${avatarHtml(u, 'sm')}<span class="mn"><b>${esc(u.name)}</b><small>${esc(u.position || A.ROLES[u.role]?.label || '')}</small></span>${personStateChip(st)}</button>`; }).join('')}</div>` };
}

/* ---- the frame: a header, the screen, the menu at the bottom ---- */
const PH_VIEWS = { day: phDay, review: phReview, list: phList, cards: phCards, projs: phProjs, proj: phProj, more: phMore, letters: phLetters, people: phPeople };
function renderPhone() {
  let root = $('#phone');
  if (!root) { root = document.createElement('div'); root.id = 'phone'; document.body.prepend(root); }
  if (!state.loaded) { root.innerHTML = '<div class="ph-load">Загружаем данные…</div>'; return; }
  const body = root.querySelector('.ph-body'), kb = root.querySelector('#ph-kb');
  if (body && root.dataset.v) ph.scroll[root.dataset.v] = { y: body.scrollTop, x: kb?.scrollLeft || 0 };
  const active = document.activeElement?.id, typed = active === 'ph-rq-note' ? $('#ph-rq-note').value : null;
  const v = (PH_VIEWS[ph.v] || phDay)();
  const parent = PH_PARENT[ph.v], navOn = PH_NAV[ph.v] || ph.v;
  const mt = msgTotals(), badge = { day: badgeCount(), msgs: mt.n + phCustUnread() };
  root.dataset.v = ph.v;
  root.innerHTML = `<header class="ph-hdr">${parent ? `<button class="ph-hb" type="button" data-act="ph-go" data-v="${parent}" aria-label="Назад">${phI('back')}</button>` : `<span class="ph-logo">${phI('day')}</span>`}
      <div class="tt"><b>${esc(v.title)}</b><small>${esc(v.sub || '')}</small></div>
      ${A.canCreateTasks?.(state.me) ? `<button class="ph-hb" type="button" data-act="new-task" aria-label="Новая карточка">${phI('plus')}</button>` : ''}
      <button class="ph-hb" type="button" data-act="ph-go" data-v="day" aria-label="Что требует внимания">${phI('bell')}${badge.day ? '<span class="dot"></span>' : ''}</button></header>
    <main class="ph-body">${v.body}</main>
    <nav class="ph-nav">${PH_TABS.map(([k, l]) => `<button type="button" class="${navOn === k ? 'on' : ''}" data-act="${k === 'msgs' ? 'ph-msgs' : 'ph-go'}" data-v="${k}">${phI(k)}${l}${phCnt(badge[k])}</button>`).join('')}</nav>`;
  const s = ph.scroll[ph.v];
  if (s) { root.querySelector('.ph-body').scrollTop = s.y; const k = root.querySelector('#ph-kb'); if (k) k.scrollLeft = s.x; }
  const k = root.querySelector('#ph-kb');
  if (k) k.addEventListener('scroll', () => { const i = Math.round(k.scrollLeft / Math.max(1, k.clientWidth - 24)); root.querySelectorAll('#ph-dots i').forEach((d, j) => d.classList.toggle('on', j === i)); }, { passive: true });
  if (typed !== null) { const ta = $('#ph-rq-note'); ta.value = typed; ta.focus(); }
}
function phGo(v, id = '') {
  ph.v = v;
  if (v === 'proj') ph.pid = id;
  if (v === 'list') ph.pid = id;
  if (v === 'review') ph.rq = 0;
  ph.scroll[v] = null;
  renderNow();
}

/* ---------- buttons of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'ph-go': ({ el, id }) => phGo(el.dataset.v, id || ''),
  'ph-msgs': ({ id }) => { if (id) msg.chatId = id; msgFull(); },
  'ph-rq': ({ el }) => { phRq(el.dataset.v); },
  'ph-proj': ({ id }) => { ph.proj = id || ''; ph.scroll.cards = null; renderNow(); },
  'ph-cp': () => { ph.cpAll = !ph.cpAll; renderNow(); },
  'ph-shift': ({ id }) => phShift(id),
  'ph-remark': ({ el, id }) => { const p = state.projects.get(id); if (p) askRemark(p, el.dataset.v); },
  'ph-letter': ({ id }) => { const l = state.letters.get(id), p = l && state.projects.get(l.projectId); if (p) askLetter(p, l); },
  'ph-assign': ({ id }) => {
    // A free person: give one of the cards nobody does yet.
    const free = tasksArr().filter(t => t.kind !== 'assign' && ['not_started', 'in_progress'].includes(t.status) && !executorOf(t)).sort(sortByDeadline);
    if (!free.length) return toast('Карточек без исполнителя нет — назначьте с компьютера или создайте новую.');
    const { q, close } = openModal(`<form class="modal ph-sheet" role="dialog" aria-modal="true" aria-labelledby="pha-t" novalidate><h2 id="pha-t">Назначить: ${esc(state.users.get(id)?.name || '')}</h2>
      <p class="hint">Карточки без исполнителя, по сроку</p><div class="ph-pick">${free.slice(0, 12).map((t, i) => `<label class="ph-opt"><input type="radio" name="pha" value="${esc(t.id)}"${i ? '' : ' checked'}><span><b>${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</b><small>${esc(projectOf(t)?.name || '')} · ${isDate(t.finish) ? 'до ' + fmtDate(t.finish) : 'без срока'}</small></span></label>`).join('')}</div>
      <div class="modal-f"><button class="btn primary" type="submit">Назначить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
    q('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const tid = q('input[name="pha"]:checked')?.value; close(); if (tid) reassign(tid, 'staff', '', id); });
  },
  'ph-full': ({ id }) => { saveLocal('phoneOff', true); document.documentElement.classList.remove('phone'); if (id) openProjectPage(id); else renderNow(); toast('Полная версия. Вернуть экраны телефона — меню под вашим именем → «Версия для телефона».'); },
  'ph-phone': () => { setUserMenu(false); saveLocal('phoneOff', false); renderNow(); },
});

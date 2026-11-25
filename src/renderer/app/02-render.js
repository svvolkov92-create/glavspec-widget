// One row in an attention list; `side` overrides the default deadline text on the right.
function attItem(t, side) {
  const p = projectOf(t), c = executorOf(t), tm = timing(t);
  const right = side ? side(t) : `<div class="due ${tm.cls}">${esc(tm.text)}</div><div class="num hint">${fmtDate(t.finish)}</div>`;
  return `<div class="att-item" data-act="open-task" data-id="${esc(t.id)}" role="button" tabindex="0">
    ${marksHtml(t)}
    <span class="main">${unread(t) ? '<span class="new-dot" title="Новое для вас"></span>' : ''}${esc(p?.name || '—')}${t.title ? ' · ' + esc(t.title) : ''}</span>
    <span class="side">${right}</span>
    <span class="who">${ownerOf(t) ? `<span class="who-o" title="Ответственный в команде">${esc(ownerOf(t).name)}${coOwnersOf(t).length ? ' +' + coOwnersOf(t).length : ''}</span> · ` : ''}${c ? esc(c.name) + (c.phone ? ' · ' + esc(c.phone) : '') : 'исполнитель не назначен'}</span>
  </div>`;
}
// One «Требует внимания» button instead of a row of counters; the list opens under it.
function counters() {
  if (!state.loaded || isEmpty()) return '';
  const a = attention();
  const items = [
    ['new', tasksArr().filter(unread).length, 'work', 'Новое для вас', 'поручено, комментарии и сдачи, которые вы ещё не открыли'],
    ['review', a.review.length, 'review', 'Ждут вашей проверки', 'сданы на проверку'],
    ['overdue', a.overdue.length, 'bad', 'Срок сорван', 'финиш прошёл, работа не сдана'],
    ['att:week', a.week.length, 'warn', 'Сдача в течение 7 дней', ''],
    ['att:milestones', a.milestones.length, 'bad', 'Сорваны контрольные точки', ''],
    ...(canMoney() ? [['att:pay', a.pay.length, 'work', 'Пора платить', 'подрядчикам по графику']] : []),
  ].filter(x => x[1]);
  const total = items.reduce((s, x) => s + x[1], 0);
  const worst = items.some(x => x[2] === 'bad') ? 'bad' : items.length ? 'warn' : 'ok';
  return `<button type="button" class="att-btn tone-${worst}" data-act="att-menu" aria-haspopup="menu" aria-expanded="${attOpen}" title="Что ждёт вашего решения">
      ${total ? `Требует внимания <b class="num">${total}</b>` : 'Всё по плану'}<svg class="caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="menu att-menu" role="menu"${attOpen ? '' : ' hidden'}>${items.length ? items.map(([f, n, tone, label, sub]) => `<button role="menuitem" type="button" class="ccount" data-act="counter" data-f="${f}"><span class="att-n tone-${tone} num">${n}</span><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`).join('')
      : '<div class="none">Просрочек, проверок и платежей нет.</div>'}</div>`;
}
function setAttMenu(open) { attOpen = open; const w = $('#att-wrap'); if (w) w.innerHTML = counters(); }
function setCreateMenu(open) {
  $('#create-menu').hidden = !open;
  $('#btn-create').setAttribute('aria-expanded', String(open));
}
// The footer keeps only the search; journal, trash, data folder and help live in «Отчёты и данные».
function footer() {
  const hasDemo = !isSpec() && [...state.projects.values(), ...state.contractors.values(), ...state.tasks.values(), ...liveUsers()].some(x => x.demo);
  return `<div class="foot">
    ${tip('foot', 'Срок сорван — финиш прошёл, а работа не сдана на проверку и не принята. «Осталось» — в рабочих днях по производственному календарю.')}
    <span class="spacer"></span>
    <button class="btn ghostbtn sm" data-act="open-search" type="button" title="Ctrl+K — поиск · Ctrl+N — новая карточка · Ctrl+Z — отменить · Alt+1…7 — вкладки · двойной щелчок по ячейке — правка">Поиск Ctrl+K</button>
    ${hasDemo ? '<button class="btn ghostbtn sm" data-act="clear-demo" type="button">Удалить примеры</button>' : ''}
  </div>`;
}
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}
function renderNow() {
  state.today = todayStr();
  $('#att-wrap').innerHTML = counters();
  const overdueCount = state.loaded ? attention().overdue.length : 0;
  const title = !SOLO ? A.titleFor(state.me) : SOLO.kind === 'project' ? (state.projects.get(SOLO.id)?.name || 'Проект') : threadTitle(SOLO.id);
  $('#app-title').textContent = title;
  document.title = title;
  $('#user-name').textContent = state.me ? `${state.me.name}${A.directionLabels(state.me).length ? ' · ' + A.directionLabels(state.me).join(', ') : ''}` : '—';
  document.querySelectorAll('[data-role-hide]').forEach(el => { el.hidden = !roleAllows(el.dataset.roleHide); });
  const mt = msgInMenu() ? msgTotals() : null;
  $('#tabs').innerHTML = menuItems().map(t => t.act ? `<button class="tab tab-act" type="button" draggable="true" data-act="${t.act}" data-id="${t.id}" title="${t.label} — чаты на всё окно">${icon('chat')}<span class="lbl">${t.label}</span>${mt?.n ? `<span class="cnt">${mt.n}</span>` : ''}${mt?.at ? `<span class="cnt bad" title="Вас упомянули">@${mt.at}</span>` : ''}</button>` : `<button class="tab" role="tab" type="button" draggable="true" data-act="tab" data-id="${t.id}" aria-selected="${state.tab === t.id}" title="${t.label} — перетащите, чтобы поменять порядок вкладок">${icon(t.id)}<span class="lbl">${t.label}</span>${
    t.id === 'tasks' ? `<span class="cnt">${tasksArr().length}</span>` : t.id === 'overview' && overdueCount ? `<span class="cnt bad">${overdueCount}</span>` : ''}</button>`).join('');

  const app = $('#app');
  if (!state.loaded) { app.innerHTML = '<div class="hint">Загружаем данные…</div>'; return; }
  const active = document.activeElement?.id, caret = document.activeElement?.selectionStart;
  if (SOLO?.kind === 'tray') { app.innerHTML = viewTrayPanel(); return; }
  if (!SOLO && state.me) api.setBadge?.(badgeCount()); // 4.1.1 (34): the number over the taskbar icon
  if (!SOLO && state.me) needsMeNotify();
  if (!SOLO && state.me && !tour) maybeStartTour();
  if (state.win.compact) { app.innerHTML = viewCompact(); renderMsg(); renderFocus(); return; }
  if (state.tab === 'team') { state.tab = 'people'; peopleMode = 'tree'; } // «Команда» merged into «Исполнители» in 2.5
  const view = { day: viewDay, overview: viewOverview, projects: viewProjects, people: viewPeople, orgs: viewOrgs, office: viewOffice, gantt: viewGantt, kanban: viewKanban, tasks: viewTasks }[state.tab] || viewOverview;
  app.innerHTML = docTabsHtml() + view() + footer();
  renderMsg(); msgNotify(); renderFocus();
  if (active === 'f-q') { const el = $('#f-q'); el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* not a text input any more */ } }
  if (state.tab === 'gantt') drawGanttLinks();
  if (state.tab === 'kanban') fitKanban();
  if (state.drawer?.kind === 'task' && state.drawer.id) { renderPayments(); renderPlanPreview(); renderTalk(); if (state.drawer.tab === 'log') loadTaskLog(state.drawer.id); }
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'att-menu': () => { setAttMenu(!attOpen); },
  'create-menu': () => { setCreateMenu($('#create-menu').hidden); },
  'att-go': ({ el }) => { state.tab = 'tasks'; state.filters.status = el.dataset.v; renderNow(); },
});

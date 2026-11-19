/* ---------- Kanban ---------- */
const KANBAN_COLS = ['not_started', 'in_progress', 'revision', 'review', 'paused', 'done'];
const KANBAN_DONE_LIMIT = 15;
// What a Kanban card shows (4.1): project, executor, deadline, flags — each can be switched off for a compact board.
const KB_SHOW = [['proj', 'Проект и название'], ['who', 'Исполнитель'], ['due', 'Сроки'], ['flags', 'Оплаты и контрольные точки']];
function kbViewMenu() {
  const on = KB_SHOW.filter(([k]) => state.kbShow[k]).length;
  return `<details class="kb-view"><summary class="btn sm" title="Что показывать на карточках">Вид карточек${on < KB_SHOW.length ? ` · ${on}/${KB_SHOW.length}` : ''}</summary>
    <div class="kb-view-m">${KB_SHOW.map(([k, l]) => `<label class="chk"><input type="checkbox" data-act="kb-show" data-v="${k}"${state.kbShow[k] ? ' checked' : ''}> ${l}</label>`).join('')}
    <div class="row-in"><button class="btn sm" type="button" data-act="kb-show-all" data-v="0">Кратко</button><button class="btn sm" type="button" data-act="kb-show-all" data-v="1">Подробно</button></div></div></details>`;
}
function kanbanCard(t) {
  const p = projectOf(t), c = executorOf(t), tm = timing(t), v = state.kbShow;
  const due = L.paymentPlan(t, state.today).dueNow;
  const msLate = L.milestonesOf(t, state.today).overdue.length;
  const flags = v.flags && ((due > 0 && canMoney()) || msLate);
  return `<article class="kb-card ${c ? '' : 'noexec'} ${tm.overdue ? 'late' : ''}" draggable="true" data-kb-id="${esc(t.id)}" data-act="open-task" data-id="${esc(t.id)}" role="button" tabindex="0"
      title="${esc(p?.name || '')}${t.title ? ' · ' + esc(t.title) : ''}\n${c ? '' : 'Исполнитель не назначен. '}Перетащите карточку в другую колонку, чтобы сменить статус">
    <div class="kb-top">${marksHtml(t)}${tm.overdue ? '<span class="chip tone-bad">срок сорван</span>' : ''}</div>
    ${v.proj ? `<div class="kb-proj">${esc(p?.name || '—')}${t.title ? ` · ${esc(t.title)}` : ''}</div>` : ''}
    ${v.who ? `<div class="kb-who">${c ? execLine(t) : '<b class="kb-noexec">нет исполнителя</b>'}</div>` : ''}
    ${v.due ? `<div class="kb-foot"><span class="due ${tm.cls}">${esc(tm.text)}</span><span class="num hint">${fmtDate(t.finish)}</span></div>` : ''}
    ${flags ? `<div class="kb-flags">${msLate ? `<span class="tag bad">КТ сорвана</span>` : ''}${due > 0 && canMoney() ? `<span class="tag warn">пора платить ${money(due)}</span>` : ''}</div>` : ''}
  </article>`;
}
// 4.1: the single board scrolls inside itself, so the column heads stay on top and every column is full height
// (a card can be dropped anywhere in it, also below the last card).
function fitKanban() {
  const kb = $('#kb-board');
  if (!kb) return;
  const top = kb.getBoundingClientRect().top, room = window.innerHeight - top - 30;
  kb.style.height = ''; kb.style.minHeight = `${Math.max(320, room)}px`; // a floor, not a cap: long columns make the page scroll
}
window.addEventListener('resize', () => { if (state.tab === 'kanban') fitKanban(); });
// «Вид карточек» sits in a horizontally scrolling filter row, which clips anything dropping out of it (4.1-1):
// the open list is placed over the window (position: fixed) under its button; a click outside closes it.
function placeKbView(d) {
  const m = d?.querySelector('.kb-view-m'), r = d?.querySelector('summary')?.getBoundingClientRect();
  if (!m || !r) return;
  m.style.top = `${Math.round(r.bottom + 4)}px`;
  m.style.left = `${Math.round(Math.min(r.left, innerWidth - m.offsetWidth - 8))}px`;
}
document.addEventListener('toggle', e => { if (e.target.matches?.('.kb-view') && e.target.open) placeKbView(e.target); }, true);
document.addEventListener('pointerdown', e => { const d = $('.kb-view[open]'); if (d && !d.contains(e.target)) d.open = false; }, true);
window.addEventListener('resize', () => placeKbView($('.kb-view[open]')));
document.addEventListener('scroll', () => placeKbView($('.kb-view[open]')), true);
// Re-render but keep an open <details> menu open.
function renderKeepMenu(sel) { renderNow(); const d = $(sel); if (d) { d.open = true; placeKbView(d); } }
function viewKanban() {
  if (isEmpty()) return emptyState();
  const f = state.kanban;
  const list = tasksArr().filter(t => (state.showAssign.kanban || t.kind !== 'assign') && (!f.project || t.projectId === f.project) && execMatch(t, f.contractor));
  const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
  const noExec = list.filter(t => !executorOf(t) && t.status !== 'done').length;
  const lanes = f.lanes === 'owner' && !isSpec();
  const colsOf = (list, lane = false) => KANBAN_COLS.map(st => {
    let items = list.filter(t => t.status === st);
    // Late cards first, then by deadline; accepted ones newest first and capped.
    if (st === 'done') items.sort((a, b) => (L.reviewStats(b, state.today).accepted || b.finish || '').localeCompare(L.reviewStats(a, state.today).accepted || a.finish || ''));
    else items.sort((a, b) => (timing(b).overdue - timing(a).overdue) || sortByDeadline(a, b));
    const sum = items.reduce((a, t) => a + L.cents(budgetOf(t)), 0) / 100; // whole column, also the part not drawn
    const hidden = st === 'done' ? Math.max(0, items.length - KANBAN_DONE_LIMIT) : 0;
    if (hidden) items = items.slice(0, KANBAN_DONE_LIMIT);
    const colKey = 'kb:' + st + (lane ? ':' + (list[0]?.ownerId || '') : ''), colLim = limitOf(colKey, 25), colAll = items.length;
    items = items.slice(0, colLim);
    return `<section class="kb-col tone-col-${STATUSES[st].tone}" data-kb-col="${st}">
      <header class="kb-col-h"><span class="dot"></span><b>${STATUSES[st].label}</b><span class="cnt">${colAll + hidden}</span>${canMoney() ? `<span class="hint num">${money(sum)}</span>` : ''}</header>
      <div class="kb-list">${items.map(kanbanCard).join('') || `<div class="kb-empty">${lane ? '—' : 'Перетащите карточку сюда'}</div>`}
      ${moreBtn(colKey, colAll, items.length, 50)}${hidden ? `<div class="hint kb-more">Ещё ${hidden} принятых — см. «Все карточки»</div>` : ''}</div>
    </section>`;
  }).join('');
  // Swimlanes: one row of columns per responsible person (by the main owner, so a card appears once).
  const body = !lanes ? `<div class="kb kb-fit" id="kb-board">${colsOf(list)}</div>` : [...liveUsers().sort(byName), null].map(u => {
    const own = list.filter(t => (u ? t.ownerId === u.id : !ownerOf(t)));
    if (!own.length) return '';
    const key = 'k:' + (u ? u.id : 'none'), fold = isFolded(key), active = own.filter(t => t.status !== 'done').length;
    const stuck = own.filter(t => t.status === 'review').length;
    return `<section class="kb-lane${fold ? ' folded' : ''}"><header class="kb-lane-h">${foldBtn(key, fold)}<b>${u ? esc(u.name) : 'Без ответственного'}</b>
      <span class="hint">${u ? esc(A.ROLES[u.role]?.label || '') + ' · ' : ''}в работе ${active}${stuck ? ` · на проверке ${stuck}` : ''}</span></header>
      ${fold ? '' : `<div class="kb kb-in-lane">${colsOf(own, true)}</div>`}</section>`;
  }).join('');
  return `<div class="filters one-row">
      <select id="kb-project" aria-label="Проект">${opt('', 'Все проекты', f.project)}${liveProjects().map(p => opt(p.id, p.name, f.project)).join('')}</select>
      <select id="kb-contractor" aria-label="Исполнитель">${execFilterOpts(opt, f.contractor)}</select>
      ${isSpec() ? '' : `<span class="seg"><button class="btn sm ${lanes ? '' : 'on'}" type="button" data-act="kb-lanes" data-v="">Одной доской</button><button class="btn sm ${lanes ? 'on' : ''}" type="button" data-act="kb-lanes" data-v="owner">По ответственным</button></span>`}
      ${assignChk('kanban')}${kbViewMenu()}
      ${noExec ? `<span class="kb-warn">Без исполнителя: <b>${noExec}</b></span>` : ''}
      <span class="help-dot" tabindex="0" title="Перетаскивайте карточки между колонками, чтобы менять статус: можно только туда, куда ведут кнопки карточки (например, «В работе» → «На проверке»).">?</span>
    </div>
    ${body}`;
}

async function changeStatus(id, to, note = 'перенесено на канбане') {
  const t = state.tasks.get(id);
  if (!t || t.status === to || !STATUSES[to]) return;
  // Same rule as the buttons: «Не начат» cannot jump to «Принят», a specialist only hands work in.
  const q = quickFor(t.status, to);
  if (!q) {
    const can = quickKeys(t.status).map(k => `«${QUICK[k].label}»`).join(' или ');
    toast(`Из «${STATUSES[t.status].label}» сразу в «${STATUSES[to].label}» нельзя${can ? `: доступно ${can}` : ''}.`, true);
    return renderNow();
  }
  if (q === 'submit' && isSpec()) { toast('Чтобы сдать на проверку, откройте карточку и опишите, что сделано.', true); renderNow(); return openTask(id); }
  const now = new Date();
  const history = [...(Array.isArray(t.history) ? t.history : []), { ts: now.toISOString(), date: todayStr(now), type: 'status', from: t.status, to, note }];
  if (await write(op.update('tasks', id, { status: to, history }), `${marksText(t)}: ${STATUSES[to].label.toLowerCase()}`) && q === 'accept') celebrateAccept(id);
}
document.addEventListener('dragstart', e => {
  const card = e.target.closest?.('[data-kb-id]');
  if (!card) return;
  e.dataTransfer.setData('text/plain', card.dataset.kbId);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragend', e => { e.target.closest?.('[data-kb-id]')?.classList.remove('dragging'); $$('.kb-col.over').forEach(c => c.classList.remove('over')); });
document.addEventListener('dragover', e => {
  const col = e.target.closest?.('[data-kb-col]');
  if (!col) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  $$('.kb-col.over').forEach(c => { if (c !== col) c.classList.remove('over'); });
  col.classList.add('over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest?.('[data-kb-col]');
  if (!col) return;
  e.preventDefault();
  col.classList.remove('over');
  const id = e.dataTransfer.getData('text/plain');
  if (id) { track('drop:kanban'); changeStatus(id, col.dataset.kbCol); }
});

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'kb-lanes': ({ el }) => { state.kanban.lanes = el.dataset.v; saveLocal('kbLanes', el.dataset.v); renderNow(); },
  'kb-show-all': ({ el }) => { for (const [k] of KB_SHOW) state.kbShow[k] = el.dataset.v === '1'; saveLocal('kbShow', state.kbShow); renderKeepMenu('.kb-view'); },
});

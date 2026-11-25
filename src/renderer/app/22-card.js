/* ---------- drawer shell ---------- */
function closeDrawer() {
  state.drawer = null; state.draft = null; state.dirtyBase = null; state.importData = null;
  const root = $('#drawer-root');
  leaveAnimated(root.querySelector('.scrim'), root.querySelector('.drawer'));
  root.innerHTML = '';
}
function formSnapshot() {
  const f = $('#dform');
  if (!f) return null;
  const fields = $$('input, select, textarea', f).filter(i => i.name && !i.closest('[data-transient]'))
    .map(i => [i.name, i.type === 'checkbox' || i.type === 'radio' ? i.checked : i.value]);
  return JSON.stringify([fields, state.draft]);
}
function markClean() { state.dirtyBase = formSnapshot(); }
// ✕, Esc and the backdrop ask before dropping unsaved edits; «Отмена» discards on purpose.
function requestClose() {
  flushTaskDraft();
  if (state.dirtyBase && formSnapshot() !== state.dirtyBase) {
    $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm warnc">Есть несохранённые изменения.
      <span class="confirm-acts"><button class="btn primary sm" data-act="save-close" type="button">Сохранить</button>
      <button class="btn sm" data-act="discard" type="button">Не сохранять</button>
      <button class="btn ghostbtn sm" data-act="cancel-delete" type="button">Остаться</button></span></div></div>`;
    return;
  }
  closeDrawer();
}

/* ---------- 47: the card's unsaved edits survive closing ---------- */
// While a card is edited, what differs from the opened state is kept on this computer (only changed fields,
// so a later save by someone else is not overwritten with stale values). The next time the card is opened:
// «Восстановить несохранённое?». Saving the card drops its draft; drafts older than a week are forgotten.
const DRAFT_DAYS = 7, DRAFT_MAX = 20;
let taskDrafts = loadLocal('taskDrafts', {}), draftTimer = null;
const draftKeyOf = d => (d?.kind === 'task' ? d.id || 'new' : '');
function snapFields(snap) { const [f, d] = JSON.parse(snap); const m = {}; for (const [k, v] of f) if (!(k in m)) m[k] = v; return [m, d]; }
function taskDraftNow() {
  const key = draftKeyOf(state.drawer), cur = formSnapshot();
  if (!key || !state.dirtyBase || !cur) return null;
  if (cur === state.dirtyBase) return { key, draft: null };
  const [base, baseD] = snapFields(state.dirtyBase), [now, nowD] = snapFields(cur);
  const fields = {};
  for (const [k, v] of Object.entries(now)) if (base[k] !== v) fields[k] = v;
  const draftChanged = JSON.stringify(baseD) !== JSON.stringify(nowD);
  if (!Object.keys(fields).length && !draftChanged) return { key, draft: null };
  return { key, draft: { at: new Date().toISOString(), fields, ...(draftChanged ? { draft: nowD } : {}) } };
}
function saveTaskDrafts() {
  const cut = Date.now() - DRAFT_DAYS * 864e5;
  const list = Object.entries(taskDrafts).filter(([, d]) => Date.parse(d.at) > cut).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, DRAFT_MAX);
  taskDrafts = Object.fromEntries(list);
  saveLocal('taskDrafts', taskDrafts);
}
function flushTaskDraft() {
  clearTimeout(draftTimer); draftTimer = null;
  const r = taskDraftNow();
  if (!r) return;
  if (r.draft) taskDrafts[r.key] = r.draft; else delete taskDrafts[r.key];
  saveTaskDrafts();
}
function dropTaskDraft(key) { clearTimeout(draftTimer); draftTimer = null; if (key && taskDrafts[key]) { delete taskDrafts[key]; saveTaskDrafts(); } }
function scheduleTaskDraft(e) {
  if (state.drawer?.kind !== 'task' || !e.target.closest?.('#dform') || e.target.closest('[data-transient]')) return;
  clearTimeout(draftTimer); draftTimer = setTimeout(flushTaskDraft, 500);
}
document.addEventListener('input', scheduleTaskDraft);
document.addEventListener('change', scheduleTaskDraft);
window.addEventListener('pagehide', () => { if (draftTimer) flushTaskDraft(); });
const fieldLabel = name => {
  const el = $(`#dform [name="${name}"]`), box = el?.closest('.f, .exec-pick');
  const l = (el?.id && $(`#dform label[for="${el.id}"]`)) || box?.querySelector('label, .lbl');
  return (l?.firstChild?.textContent || l?.textContent || name).trim().replace(/[,:]$/, '');
};
// Called at the end of openTask: offer the kept edits if they still change something.
function offerTaskDraft() {
  const key = draftKeyOf(state.drawer), d = taskDrafts[key];
  if (!d) return;
  const [now] = snapFields(formSnapshot());
  const names = Object.keys(d.fields).filter(k => k in now && now[k] !== d.fields[k]);
  if (!names.length && !d.draft) { dropTaskDraft(key); return; }
  const what = [...new Set(names.map(fieldLabel))];
  const list = what.slice(0, 3).join(', ') + (what.length > 3 ? ` и ещё ${what.length - 3}` : '') || 'сроки, этапы оплаты или связи';
  const at = new Date(d.at);
  $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm warnc draft-offer">Восстановить несохранённое от ${fmtDate(d.at.slice(0, 10))}, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}? <span class="hint">${esc(list)}</span>
    <span class="confirm-acts"><button class="btn primary sm" data-act="draft-restore" type="button">Восстановить</button>
    <button class="btn sm" data-act="draft-drop" type="button">Удалить черновик</button></span></div></div>`;
}
function restoreTaskDraft() {
  const key = draftKeyOf(state.drawer), d = taskDrafts[key];
  $('#confirm-slot').innerHTML = '';
  if (!d) return;
  const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const put = (name, v, events) => {
    const m = /^(exec|coexec)Ref$/.exec(name);
    if (m) return epSet(m[1], v);
    const el = $(`#dform [name="${name}"]`);
    if (!el || el.disabled) return;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    if (events) fire(el);
  };
  // The project first: it redraws the section field; then the section; then the rest, twice, so fields drawn
  // by an earlier change get their values too.
  const order = Object.keys(d.fields).sort((a, b) => (a === 'projectId' ? -1 : b === 'projectId' ? 1 : 0));
  for (const k of order) put(k, d.fields[k], true);
  for (const k of order) put(k, d.fields[k], false);
  if (d.draft) {
    state.draft = { ...state.draft, ...clone(d.draft) };
    renderMilestones(); renderDeps(); renderPlanRows(); renderPlanPreview(); renderRevisions();
  }
  onMarksChanged(); updateShiftBox(); syncReady(); execPickersRefresh();
  toast('Несохранённые изменения восстановлены — проверьте и сохраните');
}

// Drawer width is dragged by its left edge and remembered; «⤢» stretches it over the whole window.
let drawerPrefs = { w: 0, full: false, ...loadLocal('drawer', {}) };
function applyDrawerSize() {
  const d = $('#dform');
  if (!d) return;
  d.classList.toggle('full', !!drawerPrefs.full);
  if (drawerPrefs.w && !drawerPrefs.full) d.style.width = `min(${drawerPrefs.w}px, 100%)`; else d.style.removeProperty('width');
  const b = $('[data-act="drawer-wide"]');
  if (b) b.title = drawerPrefs.full ? 'Обычная ширина' : 'Развернуть на всё окно';
}
function setDrawerFull(on) { drawerPrefs.full = on; saveLocal('drawer', drawerPrefs); applyDrawerSize(); }
function drawerShell({ title, body, footer: foot, wide = false, form = true, head = '', nav = '' }) {
  $('#drawer-root').innerHTML = `<div class="scrim" data-act="request-close"></div>
    <${form ? 'form' : 'div'} class="drawer ${wide ? 'wide' : ''}" id="dform" ${form ? 'novalidate' : ''} role="dialog" aria-modal="true" aria-labelledby="dtitle">
      <div class="drawer-grip" data-drawer-grip title="Потяните, чтобы изменить ширину"></div>
      <div class="drawer-h"><h2 id="dtitle">${title}</h2>${nav}<button class="icon" data-act="drawer-wide" type="button" title="Развернуть на всё окно"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="icon" data-act="request-close" type="button" aria-label="Закрыть"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button></div>
      ${head}
      <div class="drawer-b">${body}</div>
      ${foot ? `<div class="drawer-f">${foot}</div>` : ''}
      <div id="confirm-slot"></div>
    </${form ? 'form' : 'div'}>`;
  applyDrawerSize();
}
document.addEventListener('pointerdown', e => {
  const g = e.target.closest?.('[data-drawer-grip]');
  if (!g || e.button !== 0) return;
  e.preventDefault();
  const d = $('#dform');
  const move = ev => { drawerPrefs.full = false; drawerPrefs.w = Math.max(420, Math.min(window.innerWidth, window.innerWidth - ev.clientX)); applyDrawerSize(); };
  const up = () => { document.removeEventListener('pointermove', move); saveLocal('drawer', drawerPrefs); document.body.classList.remove('col-resizing'); };
  document.body.classList.add('col-resizing');
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up, { once: true });
  d?.classList.remove('full');
});

/* ---------- task card ---------- */
function selOpts(items, sel, emptyLabel) {
  return `<option value="">${esc(emptyLabel)}</option>` +
    items.map(x => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
}

// Contractors whose specialty covers the selected marks go first, with their current load.
function contractorOptions(marks, selected) {
  const load = id => tasksArr().filter(t => t.contractorId === id && ACTIVE.has(t.status)).length;
  const label = c => `${c.name} — в работе ${load(c.id)}`;
  const opt = c => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(label(c))}</option>`;
  const people = contractorsArr();
  // A card may still point at someone moved to the trash; keep them selectable so saving does not drop them.
  const gone = selected && !state.contractors.has(selected) ? `<option value="${esc(selected)}" selected>(подрядчик в корзине)</option>` : '';
  const scored = people.map(c => ({ c, n: marks.length ? L.matchCount(c, marks) : 0 }));
  const fit = scored.filter(s => s.n > 0).sort((a, b) => b.n - a.n || load(a.c.id) - load(b.c.id));
  const rest = scored.filter(s => s.n === 0).map(s => s.c);
  if (!fit.length) return `<option value="">— не назначен —</option>${gone}${people.map(opt).join('')}`;
  return `<option value="">— не назначен —</option>${gone}<optgroup label="Подходят по специализации">${fit.map(s => opt(s.c)).join('')}</optgroup>`
    + (rest.length ? `<optgroup label="Остальные">${rest.map(opt).join('')}</optgroup>` : '');
}

// `marks`: the card's marks; people without the needed direction are marked (choosing them needs a confirmation).
function ownerOptions(selected, marks = []) {
  const list = A.assignableOwners(state.me, [...state.users.values()]);
  const byRole = r => list.filter(u => u.role === r);
  const opt = u => {
    const gaps = A.profileGaps(u, { sections: marks });
    const why = gaps.length ? ` — нет «${[...new Set(gaps.map(g => g.direction.label))].join(', ')}»` : u.role !== 'gip' && A.directionLabels(u).length ? ' — ' + A.directionLabels(u).join(', ') : '';
    return `<option value="${esc(u.id)}"${u.id === selected ? ' selected' : ''}${gaps.length ? ' class="misfit"' : ''}>${esc(userLabel(u) + why)}</option>`;
  };
  // Keep a current owner who is outside the list (e.g. moved to another chief) visible rather than silently dropped.
  const extra = selected && !list.some(u => u.id === selected) ? `<option value="${esc(selected)}" selected>${esc(userLabel(state.users.get(selected)))}</option>` : '';
  return extra + [['director', 'Директор'], ['gip', 'ГИП'], ['chief', 'Главспецы'], ['specialist', 'Специалисты']]
    .map(([r, l]) => byRole(r).length ? `<optgroup label="${l}">${byRole(r).map(opt).join('')}</optgroup>` : '').join('');
}

// Card header as a drawing title block (штамп): object, marks, people, deadline, status, revision — and the actions.
const lastRevision = t => (Array.isArray(t.revisions) && t.revisions.length ? t.revisions[t.revisions.length - 1] : null);
function taskStrip(t) {
  const tm = timing(t), o = ownerOf(t), c = contractorOf(t), p = projectOf(t), rev = lastRevision(t);
  const keys = quickKeys(t.status);
  const cell = (k, v, cls = '') => `<div class="st-c ${cls}"><span class="st-k">${k}</span><span class="st-v">${v}</span></div>`;
  const note = keys.includes('submit') ? (isSpec() ? 'Что сделано — отчёт для проверяющего (обязательно)' : 'Что сделано — уйдёт проверяющему') : keys.includes('remarks') ? 'Суть замечаний (необязательно)' : 'Комментарий (необязательно)';
  return `<div class="stamp">
    <div class="st-grid">
      ${cell('Объект', `${esc(p?.name || '—')}${p?.code ? ` <span class="mono hint">${esc(p.code)}</span>` : ''}`, 'st-obj')}
      ${cell('Раздел', marksHtml(t), 'st-mark')}
      ${cell('Стадия', p ? projectStageChip(p) : '—', 'st-stage')}
      ${cell('Ответственный', o ? `${userIcons(o)}<b>${esc(o.name)}</b>${coOwnersOf(t).length ? ` +${coOwnersOf(t).length}` : ''}` : '<span class="hint">не назначен</span>', 'st-owner')}
      ${cell('Исполнитель', executorOf(t) ? execLine(t) : '<span class="hint">—</span>', 'st-contr')}
      ${cell('Финиш', `${isDate(t.finish) ? `<span class="num">${fmtDate(t.finish)}</span><br>` : ''}<span class="due ${tm.cls}">${esc(tm.text)}</span>`)}
      ${cell('Статус', `${statusChip(t)} <span class="num hint" title="Готовность">${L.readiness(t)}%</span>`, 'st-status')}
      ${cell('Изм.', rev ? `<b class="num" title="от ${fmtDate(rev.date)}${rev.note ? ': ' + esc(rev.note) : ''}">${esc(rev.no)}</b><br><span class="hint num">${fmtDate(rev.date).slice(0, 5)}</span>` : '<span class="hint">—</span>', 'st-rev')}
    </div>
    ${(rs => (rs.length ? `<div class="st-wait"><span class="chip tone-warn">замечания экспертизы: ${rs.length}</span> ${esc(rs.slice(0, 3).map(r => `№ ${r.n}`).join(', '))}${rs.length > 3 ? '…' : ''} <button class="linkbtn" type="button" data-act="project-page" data-id="${esc(t.projectId)}">к экспертизе</button></div>` : ''))(exRemarksOf(t))}
    ${(w => (w.length ? `<div class="st-wait"><span class="chip tone-bad">ждёт исходные данные</span> ${esc(irdWaitText(w))} <button class="linkbtn" type="button" data-act="goto-ird" data-id="${esc(t.projectId)}">к списку ИД</button></div>` : ''))(irdWaitOf(t))}
    <div class="st-acts" data-transient>
      ${keys.map(k => `<button class="btn sm ${k === 'accept' ? 'okbtn' : k === 'remarks' ? 'warnbtn' : k === 'submit' || k === 'start' ? 'primary' : ''}" data-act="quick" data-q="${k}" type="button">${QUICK[k].label}</button>`).join('')}
      ${keys.length ? `<input id="qa-note" class="qa-in" placeholder="${note}" maxlength="500" aria-label="Комментарий к действию">` : ''}
      ${focusBtn(t)}
      <span class="spacer"></span>
      ${t.folder ? `<button class="btn ghostbtn sm" type="button" data-act="open-task-folder" data-id="${esc(t.id)}" title="${esc(t.folder)}">📁 Папка</button>` : ''}
    </div>
  </div>`;
}
let stepping = false;
function stepTask(dir) {
  const ids = state.navIds || [], i = ids.indexOf(state.drawer?.id), next = ids[i + dir];
  if (!next) return;
  if (state.dirtyBase && formSnapshot() !== state.dirtyBase) return toast('Сначала сохраните или отмените изменения в карточке.', true);
  stepping = true;
  try { openTask(next, {}, state.drawer.tab === 'msg' ? 'main' : state.drawer.tab); } finally { stepping = false; }
}

function openTask(id, preset = {}, tab = 'main') {
  if (tab === 'msg') tab = 'talk'; // the message composer lives inside «Обсуждение» since 2.5
  const saved = id ? state.tasks.get(id) : null;
  if (id && !saved) return toast('Карточка не найдена — возможно, её удалили.', true);
  noteRecent('task', id);
  const t = saved || { status: 'not_started', projectId: preset.projectId || (state.tab === 'tasks' ? state.filters.project : '') || '', start: todayStr(), ...(preset.draft || {}) };
  const isNew = !saved;
  state.drawer = { kind: 'task', id, tab, coInit: [...(t.coOwnerIds || [])] };
  // Prev/next: the cards of the list the card was opened from, in screen order.
  if (!stepping) state.navIds = [...new Set($$('#app [data-act="open-task"][data-id]').map(el => el.dataset.id))];
  const navAt = id ? (state.navIds || []).indexOf(id) : -1;
  const navHtml = navAt >= 0 && state.navIds.length > 1 ? `<span class="d-nav"><button class="icon" type="button" data-act="task-step" data-dir="-1"${navAt ? '' : ' disabled'} title="Предыдущая карточка списка (Alt+↑)">‹</button><span class="hint num">${navAt + 1}/${state.navIds.length}</span><button class="icon" type="button" data-act="task-step" data-dir="1"${navAt < state.navIds.length - 1 ? '' : ' disabled'} title="Следующая карточка (Alt+↓)">›</button></span>` : '';
  state.draft = { milestones: clone(t.milestones || []), plan: clone(t.plan || []), dependsOn: [...L.depsOf(t)], revisions: clone(t.revisions || []) };
  const tabsDef = [['main', 'Основное'], ['time', 'Сроки и проверка'], ...(canMoney() ? [['money', 'Оплата и документы']] : []), ...(isNew ? [] : [['talk', 'Обсуждение'], ['log', 'Журнал']])];
  const sh = isNew ? null : L.shiftsOf(t);
  const badge = k => {
    if (isNew) return '';
    if (k === 'time') { const n = L.milestonesOf(t, state.today).overdue.length; return n ? `<span class="cnt bad">${n}</span>` : sh.count ? `<span class="cnt">↻${sh.count}</span>` : ''; }
    if (k === 'talk') { const n = (t.comments || []).length; return n ? `<span class="cnt${unread(t) ? ' bad' : ''}">${n}</span>` : ''; }
    if (k === 'money') { const d = L.paymentPlan(t, state.today).dueNow; return d > 0 ? '<span class="cnt warn">₽</span>' : ''; }
    return '';
  };
  drawerShell({
    title: isNew ? 'Новая карточка' : t.kind === 'assign' ? esc(t.title) : `Карточка ${esc(marksText(t))}`,
    wide: true,
    nav: navHtml,
    head: isNew ? '' : taskStrip(t),
    body: `<div class="dtabs" role="tablist">${tabsDef.map(([k, l]) => `<button class="dtab" role="tab" type="button" data-act="dtab" data-id="${k}" aria-selected="${k === tab}">${l}${badge(k)}</button>`).join('')}</div>
      <div class="dpanel" data-panel="main" ${tab === 'main' ? '' : 'hidden'}>${taskMainPanel(t, isNew)}</div>
      <div class="dpanel" data-panel="time" ${tab === 'time' ? '' : 'hidden'}>${taskTimePanel(t, isNew)}</div>
      ${canMoney() ? `<div class="dpanel" data-panel="money" ${tab === 'money' ? '' : 'hidden'}>${taskMoneyPanel(t, isNew)}</div>` : ''}
      ${isNew ? '' : `<div class="dpanel" data-panel="talk" data-transient ${tab === 'talk' ? '' : 'hidden'}><div id="talk-box"></div>
        <details class="msg-details"${tab === 'msg' ? ' open' : ''}><summary>Написать подрядчику — готовые тексты для почты и мессенджеров</summary><div id="msg-box"></div></details></div>
      <div class="dpanel" data-panel="log" data-transient ${tab === 'log' ? '' : 'hidden'}><div id="tlog-box"><div class="hint">Загружаем…</div></div></div>`}
      <div class="err" id="form-err" hidden></div>`,
    // «Сохранить» keeps the card open (Ctrl+S), «Сохранить и выйти» closes it (Enter in a field), «Выйти без сохранения» drops edits.
    footer: `<button class="btn primary" data-act="save-stay" type="button" title="Ctrl+S">${isNew ? 'Добавить' : 'Сохранить'}</button>
      <button class="btn" type="submit">${isNew ? 'Добавить и выйти' : 'Сохранить и выйти'}</button>
      <button class="btn" data-act="discard" type="button">Выйти без сохранения</button>
      <span class="spacer"></span>
      ${isNew || isSpec() ? '' : '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>'}`,
  });
  renderMilestones(); renderDeps(); renderPlanRows(); renderPlanPreview(); renderRevisions();
  if (!isNew) { renderMessage(); renderTalk(); if (unread(t)) api.taskSeen(id); }
  if (isSpec()) lockForSpecialist();
  if (!isNew) renderPayments();
  onMarksChanged();
  updateShiftBox();
  syncReady();
  markClean();
  offerTaskDraft();
  if (isNew) $('#t-project')?.focus();
}

// A specialist works with own cards: status (quick actions), milestones done, note. Everything else is read-only.
function lockForSpecialist() {
  const keep = new Set(['note', 'qa-note']);
  $$('#dform .dpanel[data-panel="main"] input, #dform .dpanel[data-panel="main"] select, #dform .dpanel[data-panel="main"] textarea')
    .forEach(el => { if (!keep.has(el.name) && !keep.has(el.id)) el.disabled = true; });
  $$('#ms-box input:not([data-k="done"])').forEach(el => { el.disabled = true; });
  $$('#dform [data-act="ms-add"], #dform [data-act="ms-del"], #dform [data-act="dep-del"], #dep-add, #dform [data-act="pick-task-folder"], #dform [data-act="suggest-task-folder"], #dform [data-act="rev-add"], #dform [data-act="rev-del"]').forEach(el => { el.hidden = true; });
  $$('#rev-box input').forEach(el => { el.disabled = true; });
  const note = $('#t-status')?.closest('.f')?.querySelector('.hint');
  if (note) note.textContent = 'Сдать на проверку — кнопкой в шапке карточки.';
}

function setDrawerTab(k) {
  if (!state.drawer) return;
  state.drawer.tab = k;
  // The composition table needs the whole window.
  if (state.drawer.kind === 'project') $('#dform')?.classList.toggle('full', k === 'comp');
  $$('.dtab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === k)));
  $$('.dpanel').forEach(p => { p.hidden = p.dataset.panel !== k; });
  if (k === 'log' && state.drawer.kind === 'task') loadTaskLog(state.drawer.id);
}

// «Журнал» of one card: its entries from the action journal (who changed what and when), newest first.
// The journal is already filtered for the user (money hidden from those without access).
async function loadTaskLog(id) {
  let list = [];
  try { list = (await api.getJournal('')).filter(e => e.col === 'tasks' && e.id === id); } catch { /* shown as empty */ }
  const box = $('#tlog-box');
  if (!box || state.drawer?.id !== id) return;
  const when = ts => { const d = new Date(ts); return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' }); };
  box.innerHTML = list.length ? `<div class="tlog">${list.map(e => `<div class="jr-item">
      <span class="num hint jr-time tlog-time">${when(e.ts)}</span>
      <div class="jr-main">
        <div class="jr-line"><span class="chip tone-${e.kind === 'trash' || e.kind === 'delete' ? 'bad' : e.kind === 'create' ? 'ok' : e.undo ? 'warn' : 'idle'}">${esc(e.undo ? 'отмена' : KIND_LABEL[e.kind] || e.kind)}</span>
          ${e.action ? `<span>${esc(e.action)}</span>` : ''}${e.user ? `<span class="hint jr-user">· ${esc(e.user)}</span>` : ''}</div>
        ${(e.changes || []).length ? `<ul class="jr-ch">${e.changes.map(c => `<li><span class="hint">${esc(c.label)}:</span> ${c.from !== undefined ? `${esc(c.from)} → ` : ''}<b>${esc(c.to ?? '')}</b></li>`).join('')}</ul>` : ''}
      </div></div>`).join('')}</div>`
    : '<div class="hint">По этой карточке изменений в журнале пока нет. В журнал попадают правки карточки: сроки, статусы, исполнители, поля, оплаты.</div>';
}

// Readiness field: editable (1…90) only while the card is in work or paused and only by the chief/GIP.
function syncReady() {
  const st = $('#t-status')?.value, num = $('#t-ready'), rng = $('#t-ready-r'), hint = $('#ready-hint');
  if (!num) return;
  const manual = L.readinessManual(st), can = canEditFields();
  num.disabled = rng.disabled = !manual || !can;
  if (!manual) { const fixed = L.readiness({ status: st }); num.value = fixed; rng.value = Math.min(L.READY_MAX, Math.max(L.READY_MIN, fixed)); }
  else if (!num.value) { num.value = L.READY_MIN; rng.value = L.READY_MIN; }
  hint.textContent = !manual ? `Задаётся статусом: не начат — 0 %, на проверке — 90 %, на доработке — 80 %, принят — 100 %.`
    : can ? 'В работе ставит главспец: от 1 до 90 %.' : 'Готовность ставит главспец.';
}

function updateShiftBox() {
  const box = $('#shift-box'), fin = $('#t-finish');
  if (!box || !fin) return;
  const orig = fin.dataset.orig;
  const show = isDate(orig) && isDate(fin.value) && fin.value !== orig;
  box.hidden = !show;
  if (show) {
    const d = dayNum(fin.value) - dayNum(orig);
    $('#shift-text').textContent = `${fmtDate(orig)} → ${fmtDate(fin.value)} (${d >= 0 ? '+' : ''}${d} дн.)`;
  }
}

// 4.1 (backlog item 45): a save that stops is never silent — the message is also a toast, the card switches to the
// tab, scrolls to the message and to the field it is about (if given), and the field is highlighted.
function formError(msg, tab, field = '') {
  const el = $('#form-err');
  if (el) { el.textContent = msg; el.hidden = !msg; }
  if (!msg) { $$('#dform .field-bad').forEach(x => x.classList.remove('field-bad')); return false; }
  if (tab) setDrawerTab(tab);
  toast(msg, true);
  requestAnimationFrame(() => {
    const err = $('#form-err');
    const f = field && ($(`#dform [name="${field}"]`) || $(`#dform #${field}`));
    const target = (f && f.closest('.f, .exec-pick, fieldset, label')) || f || err;
    if (f) { f.classList.add('field-bad'); f.addEventListener('input', () => f.classList.remove('field-bad'), { once: true }); }
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (f && f.focus) f.focus({ preventScroll: true });
    else if (err) err.scrollIntoView({ block: 'nearest' });
  });
  return false;
}
const val = name => ($(`#dform [name="${name}"]`)?.value ?? '').trim();
const checked = name => !!$(`#dform [name="${name}"]`)?.checked;

function cleanMilestones() {
  const out = [];
  for (const m of state.draft.milestones) {
    const title = String(m.title || '').trim();
    if (!title && !m.date) continue;
    if (m.date && !isDate(m.date)) return { error: 'Проверьте даты контрольных точек.' };
    out.push({ id: m.id || newId(), title: title || 'Контрольная точка', date: m.date || '', done: !!m.done, ...(m.done ? { doneAt: m.doneAt || todayStr() } : {}) });
  }
  return { list: out };
}
function cleanPlan() {
  const out = [];
  for (const r of state.draft.plan) {
    const hasPct = r.pct !== null && r.pct !== undefined && r.pct !== '';
    if (!String(r.title || '').trim() && !hasPct && !r.amount) continue;
    if (hasPct && !(Number(r.pct) > 0 && Number(r.pct) <= 100)) return { error: 'Процент в графике платежей — от 1 до 100.' };
    if (!hasPct && !(Number(r.amount) > 0)) return { error: 'Укажите сумму или процент для каждого платежа в графике.' };
    if (r.trigger === 'date' && !isDate(r.date)) return { error: 'Для платежа «к дате» укажите дату.' };
    out.push({ id: r.id || newId(), title: String(r.title || '').trim() || 'Платёж', ...(hasPct ? { pct: Number(r.pct) } : { amount: Number(r.amount) }),
      trigger: PAY_TRIGGERS[r.trigger] ? r.trigger : 'accepted', ...(r.trigger === 'date' ? { date: r.date } : {}) });
  }
  return { list: out };
}

async function submitTask(quick = null, { stay = false } = {}) {
  const id = state.drawer.id;
  const old = id ? state.tasks.get(id) : null;
  formError('');
  const docRef = $('#t-doc') ? val('docRef') : null; // null: no composition picker in this card
  const linkRef = docRef && docRef !== 'free' ? docRef : '';
  const sections = linkRef ? docRefSections(val('projectId'), linkRef) : docRef === '' ? [] : selectedMarks();
  const status = quick ? QUICK[quick].to : old ? old.status : checked('startNow') ? 'in_progress' : 'not_started';
  const data = {
    // `section` keeps a readable copy for older versions of the app that read only this field.
    projectId: val('projectId'), sections, section: sections.join(', '), title: val('title'),
    contractorId: refContractor(val('execRef'))?.id || (val('execRef').startsWith('c:') ? val('execRef').slice(2) : ''), execUserId: refUser(val('execRef'))?.id || '', coExecRef: val('coexecRef') || '', start: val('start'), finish: val('finish'),
    status: STATUSES[status] ? status : 'not_started', budget: parseMoney(val('budget')), note: val('note'),
    contractNo: val('contractNo'), contractDate: val('contractDate'),
    invoiceReceived: checked('invoiceReceived'), actSigned: checked('actSigned'), folder: val('folder'),
  };
  if (!data.projectId) return formError('Выберите проект.', 'main', 'projectId');
  if (!sections.length && !data.title) return formError('Выберите раздел или, для задачи без раздела, напишите уточнение в «Дополнительно».', 'main');
  if (old?.kind === 'assign' || $('#dform input[name="official"]')) Object.assign(data, { official: checked('official'), officialNo: val('officialNo'), officialBy: val('officialBy') });
  if (Number.isNaN(data.budget)) return formError('Бюджет — неотрицательное число, например 150000 или 150 000,50.', 'main');
  if (data.start && data.finish && data.finish < data.start) return formError('Финиш не может быть раньше старта.', 'main', 'finish');
  const ms = cleanMilestones(); if (ms.error) return formError(ms.error, 'time');
  const plan = cleanPlan(); if (plan.error) return formError(plan.error, 'money');
  const revs = cleanRevisions(); if (revs.error) return formError(revs.error, 'time');
  data.revisions = revs.list;
  data.milestones = ms.list;
  data.dependsOn = state.draft.dependsOn.filter(x => state.tasks.has(x) && x !== id);
  data.plan = plan.list;
  data.invoiceDate = data.invoiceReceived ? (old?.invoiceReceived && old.invoiceDate) || todayStr() : '';
  data.actDate = data.actSigned ? (old?.actSigned && old.actDate) || todayStr() : '';

  const now = new Date();
  const entry = o => ({ ts: now.toISOString(), date: todayStr(now), ...o });
  const history = Array.isArray(old?.history) ? [...old.history] : [];
  if (!old) history.push(entry({ type: 'status', from: null, to: data.status }));
  else {
    if (isDate(old.finish) && isDate(data.finish) && old.finish !== data.finish) {
      const reason = val('shiftReason');
      if (!reason) return formError('Укажите причину переноса срока.', 'main');
      history.push(entry({ type: 'finish', from: old.finish, to: data.finish, reason, note: val('shiftNote') }));
    }
    if (quick === 'submit' && isSpec() && !($('#qa-note')?.value || '').trim()) { $('#qa-note')?.focus(); return formError('Опишите, что сделано, — это увидит проверяющий.', 'main'); }
    if (old.status !== data.status) history.push(entry({ type: 'status', from: old.status, to: data.status, note: quick ? ($('#qa-note')?.value || '').trim() : '' }));
  }
  data.history = history;

  // Send only what this role may change: main re-checks every key and rejects the whole save otherwise.
  if (isSpec()) {
    for (const k of Object.keys(data)) if (!A.SPECIALIST_FIELDS.includes(k)) delete data[k];
  } else {
    data.ownerId = val('ownerId') || (old ? old.ownerId : state.me?.id) || '';
    if (!data.ownerId) return formError('Выберите ответственного в команде.', 'main', 'ownerId');
    data.coOwnerIds = formOwners().filter(x => x !== data.ownerId);
    if (L.readinessManual(data.status)) {
      // Entering «в работе» from a status without manual readiness (not started: 0 %) — start at the minimum,
      // the user did not type anything (4.1-3: «Начать работу» silently stopped here).
      const typed = Number(val('readiness'));
      const entering = !old || !L.readinessManual(old.status);
      const r = entering && !(typed >= L.READY_MIN) ? L.READY_MIN : Math.round(Number(val('readiness') || L.READY_MIN));
      if (!Number.isFinite(r) || r < L.READY_MIN || r > L.READY_MAX) return formError(`Готовность в работе — от ${L.READY_MIN} до ${L.READY_MAX} %: 90 % ставится сдачей на проверку, 100 % — приёмкой.`, 'main', 'readiness');
      data.readiness = r;
    }
    const misfit = formGaps();
    data.profileOk = misfit.length ? checked('profileOk') : false;
    if (misfit.length && !data.profileOk) return formError(`${misfit.join(' ')} Отметьте «Всё равно назначить», если это осознанно.`, 'main', 't-profile-ok');
    if (!canMoney()) for (const k of A.MONEY_FIELDS) delete data[k];
  }

  const tab = state.drawer.tab, savedId = old ? id : newId();
  const taskOp = old ? op.update('tasks', id, data) : op.set('tasks', savedId, { ...data, payments: [], createdAt: now.toISOString() });
  // Linking the card to a composition section (or off it) changes the project in the same step.
  const ops = [taskOp];
  if (docRef !== null) {
    const comp = compWithLink(data.projectId, savedId, linkRef);
    if (comp) ops.push(op.update('projects', data.projectId, { composition: comp }));
    if (old && old.projectId !== data.projectId) { const back = compWithLink(old.projectId, savedId, ''); if (back) ops.push(op.update('projects', old.projectId, { composition: back })); }
  }
  const ok = await write(ops.length > 1 ? ops : taskOp, old ? (quick ? QUICK[quick].okMsg : 'Карточка сохранена') : 'Карточка добавлена');
  if (!ok) return false;
  dropTaskDraft(old ? id : 'new');
  if (quick === 'accept' && old) celebrateAccept(id);
  if (old && quick) focusAfterQuick(id, quick);
  if (quick || stay) { await refresh(); openTask(savedId, {}, tab); } else closeDrawer();
  return true;
}
// After acceptance: «с первого раза» when there were no remarks; the project's goal when its last mark is accepted.
function celebrateAccept(id) {
  if (!game) return;
  setTimeout(() => {
    const t = state.tasks.get(id);
    if (!t || t.status !== 'done') return;
    const goal = L.projectGoal(tasksArr().filter(x => x.projectId === t.projectId));
    if (goal.complete) toast(`⚑ Все разделы проекта «${projectOf(t)?.name || ''}» приняты — комплект готов!`);
    else if (L.reviewStats(t, state.today).rounds === 0) toast(`✓ ${marksText(t)}: принято с первого раза · проект ${goal.done} из ${goal.total} разделов`);
  }, 400);
}

/* ---------- 50: a new card suggests its dates and executor ---------- */
// Dates: a ПД section takes the project's «Стадия П», a РД section «Стадия Р» — while the dates were not typed by hand.
// Executor: the best fit by section and load (the picker's own order) is offered with one click, never set silently.
function smartDefaults() {
  const box_hide = () => { const b = $('#smart-hint'); if (b) b.hidden = true; };
  if (state.drawer?.kind !== 'task' || state.drawer.id) return;
  const p = state.projects.get($('#t-project')?.value || ''), ref = $('#t-doc')?.value || '';
  const key = ref.startsWith('pd:') ? 'p' : ref.startsWith('rd:') ? 'r' : '';
  const ph = key && (p?.phases || []).find(x => x.key === key);
  const st = $('#t-start'), fin = $('#t-finish');
  const notes = [];
  if (ph && st && fin && !st.dataset.typed && !fin.dataset.typed && (isDate(ph.start) || isDate(ph.finish))) {
    const start = isDate(ph.start) ? (ph.start > state.today ? ph.start : state.today) : st.value;
    const finish = isDate(ph.finish) ? ph.finish : fin.value;
    // A stage already over gives nothing to take: the card would finish before it starts.
    if (finish && start && finish < start) { box_hide(); return; }
    if (st.value !== start || fin.value !== finish) { st.value = start; fin.value = finish; updateShiftBox(); }
    notes.push(`Сроки — из этапа «${L.phaseLabel(key)}» проекта${isDate(ph.finish) ? ` (до ${fmtDate(ph.finish)})` : ''}.`);
  }
  const execBox = $('#dform .exec-pick[data-pick="exec"]'), marks = selectedMarks();
  let pick = null;
  if (execBox && !execBox.querySelector('input[type="hidden"]').value && marks.length) {
    // Someone whose own direction it is first; otherwise any fitting one — but not the GIP, who «fits» everything.
    const cands = execCandidates(marks, true);
    pick = cands.find(x => x.own) || cands.find(x => x.fit && !A.isGip(refUser(x.ref))) || null;
  }
  let box = $('#smart-hint');
  if (!box) {
    const anchor = $('#t-finish')?.closest('.f');
    if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', '<div class="f wide smart-hint" id="smart-hint" hidden></div>');
    box = $('#smart-hint');
  }
  const pickHtml = pick ? `<span>Подходит по разделу: <b>${esc(pick.name)}</b>${pick.n ? ` · в работе ${pick.n}` : ' · сейчас свободен'}</span> <button class="btn sm" type="button" data-act="smart-exec" data-ref="${esc(pick.ref)}">Назначить исполнителем</button>` : '';
  box.innerHTML = notes.map(n => `<span>${esc(n)}</span>`).join('') + pickHtml;
  box.hidden = !notes.length && !pick;
}
document.addEventListener('input', e => { if (e.target.id === 't-start' || e.target.id === 't-finish') e.target.dataset.typed = '1'; });

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'drawer-wide': () => { setDrawerFull(!drawerPrefs.full); },
  'task-step': ({ el }) => { stepTask(Number(el.dataset.dir)); },
  'new-task': ({ el }) => { setCreateMenu(false); openTask(null, { projectId: el.dataset.project }); },
  'dtab': ({ id }) => { setDrawerTab(id); },
  'request-close': () => { requestClose(); },
  'discard': () => { flushTaskDraft(); closeDrawer(); },
  'draft-restore': () => { restoreTaskDraft(); },
  'draft-drop': () => { dropTaskDraft(draftKeyOf(state.drawer)); $('#confirm-slot').innerHTML = ''; },
  'save-close': () => { $('#dform').requestSubmit(); },
  'save-stay': () => { saveStay(); },
  'cancel-delete': () => { $('#confirm-slot').innerHTML = ''; },
  'quick': ({ el }) => { el.disabled = true; submitTask(el.dataset.q).finally(() => { el.disabled = false; }); },
});

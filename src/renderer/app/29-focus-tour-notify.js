/* ---------- message to the contractor ---------- */

/* ---------- 4.1: focus on a task — «Начать работу» starts a timer; the time is kept on the card ---------- */
// One focus per computer user: { taskId, since }. Stopped by «Пауза», «Сдал на проверку», another focus or ✕.
let focus = loadLocal('focus', null);
if (focus) setTimeout(() => api.setQuiet?.(true), 0); // a focus kept from the last run keeps «Не беспокоить»
const fmtSpent = min => (min >= 60 ? `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, '0')} мин` : `${min} мин`);
const spentOf = (t, userId = null) => (Array.isArray(t?.timeLog) ? t.timeLog : []).filter(x => !userId || x.userId === userId)
  .reduce((a, x) => a + Math.max(0, Math.round((Date.parse(x.to) - Date.parse(x.from)) / 60000)), 0);
function focusBtn(t) {
  const mine = focus?.taskId === t.id, spent = spentOf(t);
  const can = ['in_progress', 'revision'].includes(t.status);
  return `<span id="focus-slot" class="focus-slot">${can ? `<button class="btn sm ${mine ? 'on' : ''}" type="button" data-act="${mine ? 'focus-stop' : 'focus-start'}" data-id="${esc(t.id)}" title="${mine ? 'Остановить таймер' : 'Таймер работы над карточкой; время сохранится в карточке'}">${mine ? 'Пауза' : '▶ Фокус'}</button>` : ''}${spent ? `<span class="hint" title="Время по таймеру «Фокус»">затрачено ${fmtSpent(spent)}</span>` : ''}</span>`;
}
// The card stays as it is (unsaved edits too): only its focus button is redrawn.
function refreshFocusSlot() { const slot = $('#focus-slot'), t = state.drawer?.kind === 'task' && state.tasks.get(state.drawer.id); if (slot && t) slot.outerHTML = focusBtn(t); }
/* ---------- 56: a short introduction by role, once ---------- */
// 4–5 hints over the real interface the first time a person opens Пульт with data; «Знакомство с Пультом»
// in the menu shows it again. A hint whose element is not on the screen is skipped.
function tourSteps() {
  const me = state.me, gip = A.isGip(me), chief = A.isChief(me);
  const search = { sel: '[data-act="open-search"]', title: 'Поиск — Ctrl+K', text: A.canCreateTasks(me) ? 'Ищет проекты, карточки и людей. Начните с «+», чтобы сразу завести карточку: «+ ЭОМ Корпус 3 до 15.12 @Орлов».' : 'Ищет проекты, карточки и людей. Недавно открытое — первым.' };
  const msgs = { sel: '[data-act="msg-open"]', title: 'Сообщения', text: 'Чаты проектов, личные и групповые. Сразу уведомляем только о том, где нужны вы.' };
  if (gip) return [
    { sel: '#tabs [data-id="day"]', tab: 'day', title: 'Мой день', text: 'С него удобно начинать: что ждёт вашей проверки, что просрочено, кто остался без работы.' },
    { sel: '[data-act="review-queue"]', tab: 'day', title: 'Очередь проверки', text: 'Карточки «на проверке» подряд: «Принять» или «Вернуть с замечанием», клавиши A и R.' },
    { sel: '#tabs [data-id="projects"]', title: 'Проекты', text: 'Страница проекта: сроки этапов, состав, исходные данные и письма. В Ганте — критический путь.' },
    search, msgs];
  if (chief) return [
    { sel: '#tabs [data-id="day"]', tab: 'day', title: 'Мой день', text: 'Ваша группа: что ждёт проверки, что горит, кто свободен.' },
    { sel: '#tabs [data-id="kanban"]', title: 'Канбан', text: 'Перетаскивайте карточки между статусами; «Вид карточек» — что показывать на карточке.' },
    search, msgs];
  return [
    { sel: '#tabs [data-id="day"]', tab: 'day', title: 'Мой день', text: 'Ваши карточки на сегодня. «Начать» — и карточка в работе.' },
    { sel: '#tabs [data-id="tasks"]', title: 'Все карточки', text: 'В карточке — «Начать работу», готовность и «Сдать на проверку». Несохранённое не потеряется: предложим восстановить.' },
    search, msgs];
}
let tour = null;
function tourDoneFor(id) { return !!loadLocal('tourDone', {})[id]; }
function tourMarkDone() { const d = loadLocal('tourDone', {}); d[state.me.id] = new Date().toISOString(); saveLocal('tourDone', d); }
function maybeStartTour() {
  if (tour || SOLO || state.win.compact || !state.me || isEmpty() || tourDoneFor(state.me.id) || loadLocal('tourOff', false)) return;
  clearTimeout(maybeStartTour._t);
  maybeStartTour._t = setTimeout(() => { if (!state.drawer && !document.querySelector('.modal-back, .palette-back') && !tourDoneFor(state.me.id) && !loadLocal('tourOff', false)) startTour(); }, 900);
}
function startTour() {
  tour = { i: 0, steps: tourSteps(), tab: state.tab };
  drawTour();
}
function endTour() {
  document.querySelector('.tour')?.remove();
  document.querySelector('.tour-on')?.classList.remove('tour-on');
  const back = tour?.tab;
  if (tour) tourMarkDone();
  tour = null;
  // The hints may switch to «Мой день»: the tab the person had comes back.
  if (back && state.tab !== back) { state.tab = back; renderNow(); }
}
function drawTour() {
  document.querySelector('.tour')?.remove();
  document.querySelector('.tour-on')?.classList.remove('tour-on');
  if (!tour) return;
  let st, el;
  while (tour.i < tour.steps.length) {
    st = tour.steps[tour.i];
    if (st.tab && state.tab !== st.tab) { state.tab = st.tab; renderNow(); }
    el = document.querySelector(st.sel);
    if (el && el.offsetParent !== null) break;
    tour.i++;
  }
  if (tour.i >= tour.steps.length) return endTour();
  const n = tour.steps.length, last = tour.i === n - 1;
  el.classList.add('tour-on');
  el.scrollIntoView({ block: 'nearest' });
  const box = document.createElement('div');
  box.className = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Знакомство с Пультом');
  box.innerHTML = `<div class="tour-n hint">${tour.i + 1} из ${n}</div><b>${esc(st.title)}</b><p>${esc(st.text)}</p>
    <div class="tour-acts"><button class="btn primary sm" type="button" data-tour="next">${last ? 'Понятно' : 'Далее'}</button>${last ? '' : '<button class="btn ghostbtn sm" type="button" data-tour="skip">Пропустить</button>'}</div>`;
  document.body.append(box);
  const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  const below = r.bottom + 10 + h < window.innerHeight;
  box.style.top = `${below ? r.bottom + 10 : Math.max(8, r.top - h - 10)}px`;
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  box.querySelector('[data-tour="next"]').focus();
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-tour]');
  if (!b) return;
  if (b.dataset.tour === 'skip') endTour(); else { tour.i++; drawTour(); }
});
document.addEventListener('keydown', e => { if (tour && e.key === 'Escape') { e.stopPropagation(); endTour(); } }, true);
window.addEventListener('resize', () => { if (tour) drawTour(); });

/* ---------- 55: notifications without noise ---------- */
// Right away (a Windows notification when the window is not in front) only what needs me: a card assigned to me,
// returned, waiting for my review, a message addressed to me. Everything else stays in the morning digest.
// While a focus runs, notifications are held and shown together when it ends.
let needSeen = loadLocal('needSeen', '');
function needsMeNotify() {
  const me = state.me.id;
  const fresh = tasksArr().filter(t => unread(t) && t.notify[me] > needSeen);
  const top = fresh.reduce((m, t) => (t.notify[me] > m ? t.notify[me] : m), needSeen);
  // The first run on this computer only takes the mark: no burst about everything unread so far.
  if (!needSeen) { needSeen = top || new Date().toISOString(); saveLocal('needSeen', needSeen); return; }
  if (!fresh.length) return;
  needSeen = top; saveLocal('needSeen', needSeen);
  const why = t => (t.status === 'review' ? 'ждёт вашей проверки' : t.status === 'revision' ? 'вернули на доработку'
    : (t.comments || []).at(-1)?.ts === t.notify[me] ? 'новое сообщение' : 'назначено вам');
  const one = t => `${marksText(t)} · ${projectOf(t)?.name || ''}: ${why(t)}`;
  api.notifyMe?.(fresh.length === 1 ? one(fresh[0]) : `Нужно ваше внимание (${fresh.length}): ${fresh.slice(0, 3).map(one).join('; ')}${fresh.length > 3 ? '…' : ''}`, fresh.length === 1 ? `task:${fresh[0].id}` : 'day');
}
function focusQuiet(on) {
  const held = api.setQuiet?.(on) || [];
  if (!on && held.length) toast(`Пока шёл фокус: ${held.length} ${plural(held.length, 'уведомление', 'уведомления', 'уведомлений')} — ${held.at(-1).slice(0, 120)}`);
}
async function focusStart(id) {
  if (focus?.taskId === id) return;
  if (focus) await focusStop({ quiet: true });
  focus = { taskId: id, since: new Date().toISOString() };
  saveLocal('focus', focus); renderFocus(); focusQuiet(true);
}
// Writes the stretch to the card (≥ 1 min). quiet: no toast (another focus starts or the card is handed in).
async function focusStop({ quiet = false } = {}) {
  if (!focus) return;
  const f = focus; focus = null; saveLocal('focus', null); renderFocus(); focusQuiet(false);
  const t = state.tasks.get(f.taskId), to = new Date().toISOString();
  const min = Math.round((Date.parse(to) - Date.parse(f.since)) / 60000);
  if (!t || min < 1 || !state.me) return;
  const timeLog = [...(Array.isArray(t.timeLog) ? t.timeLog : []), { userId: state.me.id, from: f.since, to }].slice(-500);
  await write(op.update('tasks', t.id, { timeLog }), quiet ? '' : `${marksText(t)}: +${fmtSpent(min)}`, { undo: false });
}
function focusAfterQuick(id, quick) {
  if (['start', 'resume', 'reopen'].includes(quick)) focusStart(id);
  else if (focus?.taskId === id) focusStop({ quiet: true });
}
function renderFocus() {
  let el = document.getElementById('focus-bar');
  const t = focus && state.tasks.get(focus.taskId);
  if (!t || SOLO) { el?.remove(); clearInterval(renderFocus.tick); return; }
  if (!el) { el = document.createElement('div'); el.id = 'focus-bar'; el.className = 'focus-bar'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.innerHTML = `<span class="fb-dot"></span><button class="fb-t" type="button" data-act="open-task" data-id="${esc(t.id)}" title="Открыть карточку"><b>${esc(marksText(t))}</b> <span class="hint">${esc(projectOf(t)?.name || '')}</span></button>
    <span class="fb-time num" id="fb-time"></span>
    <button class="btn sm" type="button" data-act="focus-stop" title="Остановить таймер, время сохранится в карточке">Пауза</button>${state.win.compact ? '' : '<button class="btn ghostbtn sm" type="button" data-act="toggle-compact" title="Свернуть Пульт в маленький виджет поверх окон — таймер останется на виду">Свернуть</button>'}`;
  el.classList.toggle('in-compact', !!state.win.compact);
  const tick = () => { const s = Math.max(0, Math.floor((Date.now() - Date.parse(focus?.since || Date.now())) / 1000)); const n = document.getElementById('fb-time'); if (n) n.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  tick(); clearInterval(renderFocus.tick); renderFocus.tick = setInterval(tick, 1000);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'tour': () => { setFileMenu(false); endTour(); startTour(); },
  'focus-start': ({ el }) => { closeCardMenu(); focusStart(el.dataset.id).then(refreshFocusSlot); },
  'focus-stop': () => { closeCardMenu(); focusStop().then(refreshFocusSlot); },
});

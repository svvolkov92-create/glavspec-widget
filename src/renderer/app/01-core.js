
const L = window.Logic;
const { STATUSES, ACTIVE, MARK_GROUPS, SHIFT_REASONS, PAY_TRIGGERS, normalizeMarks, splitMarks, sectionsOf, todayStr, isDate, dayNum, addDays,
  fmtDate, parseMoney, budgetOf, paidOf, restOf, sortByDeadline } = L;
const api = window.api;
const A = window.Access;

// Tab icons: 16×16 strokes in currentColor.
const ICON = {
  file: '<path d="M4 1.8h5.4L12.6 5v9.2H4z" stroke-linejoin="round"/><path d="M9.2 1.8V5.2h3.4" stroke-linejoin="round"/>',
  pin: '<path d="M6 2h4l-.6 4 2.4 2.2v1.2H4.2V8.2L6.6 6z" stroke-linejoin="round"/><path d="M8 9.4V14" stroke-linecap="round"/>',
  chat: '<path d="M2 3.2h12v7.6H7.2L4.4 13.2v-2.4H2z" stroke-linejoin="round"/><path d="M4.8 6.2h6.4M4.8 8.2h4" stroke-linecap="round"/>',
  day: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
  overview: '<rect x="2" y="2" width="5" height="6" rx="1"/><rect x="9" y="2" width="5" height="3.5" rx="1"/><rect x="2" y="10" width="5" height="4" rx="1"/><rect x="9" y="7.5" width="5" height="6.5" rx="1"/>',
  projects: '<path d="M1.8 4.2v8.6h12.4V5.6H7.6L6.2 3.6H2.4z" stroke-linejoin="round"/>',
  people: '<circle cx="6" cy="5.4" r="2.4"/><path d="M1.6 13.6c.5-2.6 2.3-3.9 4.4-3.9s3.9 1.3 4.4 3.9" stroke-linecap="round"/><path d="M10.6 3.3a2.3 2.3 0 0 1 0 4.3M12.2 9.9c1.2.5 2 1.7 2.3 3.6" stroke-linecap="round"/>',
  team: '<rect x="5.8" y="1.6" width="4.4" height="3.2" rx=".8"/><rect x="1.6" y="11.2" width="4.4" height="3.2" rx=".8"/><rect x="10" y="11.2" width="4.4" height="3.2" rx=".8"/><path d="M8 4.8v3.2M3.8 11.2V8h8.4v3.2"/>',
  gantt: '<path d="M2 2v12h12" stroke-linecap="round"/><path d="M4.5 5h5M6.5 8h6M4.5 11h4" stroke-width="2.2" stroke-linecap="round"/>',
  kanban: '<rect x="1.8" y="2" width="3.6" height="11.5" rx=".9"/><rect x="6.2" y="2" width="3.6" height="7.5" rx=".9"/><rect x="10.6" y="2" width="3.6" height="9.5" rx=".9"/>',
  tasks: '<path d="M6 4h8M6 8h8M6 12h8" stroke-linecap="round"/><path d="M2 4h1.4M2 8h1.4M2 12h1.4" stroke-width="1.8" stroke-linecap="round"/>',
  office: '<path d="M2 14V6.5L8 2l6 4.5V14z" stroke-linejoin="round"/><path d="M6 14v-3.5h4V14M5 7.5h1.5M9.5 7.5H11" stroke-linecap="round"/>',
  detach: '<rect x="1.8" y="4.8" width="9.4" height="9.4" rx="1.2"/><path d="M8.5 2h5.5v5.5M14 2L7.5 8.5" stroke-linecap="round" stroke-linejoin="round"/>',
  dock: '<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1.4"/><path d="M11 5L6 10M6 6v4h4" stroke-linecap="round" stroke-linejoin="round"/>',
};
// Direction icons (filled, own colours): электрика — молния, слаботочка — чип, водоснабжение — кран с каплей,
// водоотведение — капли, отопление и вентиляция — ветерок.
const KIND = {
  ar: { label: 'Архитекторы', color: '#7A4FB0', svg: '<path d="M8 1.6 1.6 6.4v1.4h12.8V6.4z" fill="currentColor"/><rect x="2.8" y="8.6" width="2.2" height="4.6" fill="currentColor"/><rect x="6.9" y="8.6" width="2.2" height="4.6" fill="currentColor"/><rect x="11" y="8.6" width="2.2" height="4.6" fill="currentColor"/><rect x="1.6" y="13.4" width="12.8" height="1.4" fill="currentColor"/>' },
  kr: { label: 'Конструкторы', color: '#4A5A68', svg: '<path d="M1.8 3h12.4v2.4H9.3v5.2h4.9V13H1.8v-2.4h4.9V5.4H1.8z" fill="currentColor"/>' },
  el: { label: 'Электрики', color: '#E8820C', svg: '<path d="M9.2 1.5 3.6 9h3.6l-1 5.5L12.4 7H8.7z" fill="currentColor"/>' },
  ss: { label: 'Слаботочники', color: '#2E8B57', svg: '<rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor"/><rect x="6.2" y="6.2" width="3.6" height="3.6" rx=".5" fill="#fff" opacity=".85"/><path d="M6 1.8v2M10 1.8v2M6 12.2v2M10 12.2v2M1.8 6h2M1.8 10h2M12.2 6h2M12.2 10h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' },
  water: { label: 'Водоснабжение', color: '#1D6FD1', svg: '<path d="M2 5h6.5a2.5 2.5 0 0 1 2.5 2.5V9H9.2V7.6a.9.9 0 0 0-.9-.9H2z" fill="currentColor"/><rect x="4.2" y="2.4" width="1.6" height="2.8" rx=".5" fill="currentColor"/><path d="M3 2.4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.1 10.6c.9 1.2 1.4 2 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.6z" fill="currentColor"/>' },
  sewer: { label: 'Водоотведение', color: '#8B5A2B', svg: '<path d="M5.2 2.2c1.5 2 2.3 3.3 2.3 4.3a2.3 2.3 0 0 1-4.6 0c0-1 .8-2.3 2.3-4.3zM11 6.4c1.2 1.6 1.9 2.7 1.9 3.5a1.9 1.9 0 0 1-3.8 0c0-.8.7-1.9 1.9-3.5zM6.4 10.2c.9 1.2 1.4 2 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.6z" fill="currentColor"/>' },
  pos: { label: 'ПОС', color: '#B07A00', svg: '<path d="M3 14.4V2.2h1.8v12.2zM4.8 2.2h9.4v1.6H4.8zM12.2 3.8v3.6" stroke="currentColor" stroke-width="1" fill="currentColor"/><rect x="10.8" y="7.4" width="2.8" height="2.2" fill="currentColor"/><path d="M1.4 14.4h5.4" stroke="currentColor" stroke-width="1.6"/>' },
  ov: { label: 'Отопление и вентиляция', color: '#D23C2C', svg: '<path d="M1.8 5.6h7.4a1.9 1.9 0 1 0-1.9-1.9M1.8 8.4h10.3a1.9 1.9 0 1 1-1.9 1.9M1.8 11.2h5.2a1.6 1.6 0 1 1-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
};
const kindIcon = (k, cls = '') => (KIND[k] ? `<svg class="kico ${cls}" viewBox="0 0 16 16" style="color:${KIND[k].color}" aria-label="${KIND[k].label}" role="img"><title>${KIND[k].label}</title>${KIND[k].svg}</svg>` : '');
const userKinds = u => (u?.directions || []).map(d => (d === 'vk' ? 'water' : d)).filter(k => KIND[k]);
const userIcons = u => userKinds(u).map(k => kindIcon(k)).join('');
const icon = id => `<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${ICON[id] || ''}</svg>`;
const fileSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
const TABS = [
  { id: 'day', label: 'Мой день' }, // 4.1.1 (item 48)
  { id: 'overview', label: 'Сводка' },
  { id: 'projects', label: 'Проекты' },
  { id: 'people', label: 'Люди' },
  { id: 'office', label: 'Офис' },
  { id: 'gantt', label: 'Диаграмма Ганта' },
  { id: 'kanban', label: 'Канбан' },
  { id: 'tasks', label: 'Все карточки' },
];
// The user's own tab order (dragged on the panel or set in «Настройки»); new tabs join at their default place.
let tabOrder = loadLocal('tabOrder', []);
// Dragging a tab onto another one puts it in that place.
let tabDrag = null;
document.addEventListener('dragstart', e => {
  const tab = e.target.closest?.('#tabs .tab');
  if (!tab) return;
  tabDrag = tab.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'tab:' + tabDrag);
  tab.classList.add('dragging');
});
document.addEventListener('dragover', e => {
  if (!tabDrag) return;
  const tab = e.target.closest?.('#tabs .tab');
  $$('#tabs .tab.drop-ok').forEach(x => { if (x !== tab) x.classList.remove('drop-ok'); });
  if (!tab || tab.dataset.id === tabDrag) return;
  e.preventDefault();
  tab.classList.add('drop-ok');
});
document.addEventListener('drop', e => {
  if (!tabDrag) return;
  const tab = e.target.closest?.('#tabs .tab');
  const from = tabDrag;
  tabDrag = null;
  if (!tab || tab.dataset.id === from) return;
  e.preventDefault();
  const order = orderedTabs().map(x => x.id).filter(id => id !== from);
  order.splice(order.indexOf(tab.dataset.id) + (orderedTabs().findIndex(x => x.id === from) < orderedTabs().findIndex(x => x.id === tab.dataset.id) ? 1 : 0), 0, from);
  setTabOrder(order);
  toast('Порядок вкладок сохранён');
});
document.addEventListener('dragend', () => { tabDrag = null; $$('#tabs .dragging, #tabs .drop-ok').forEach(x => x.classList.remove('dragging', 'drop-ok')); });
// Light encouragement (first-time acceptance, project goal, «спасибо»): can be switched off in «Настройки».
let game = loadLocal('game', true) !== false;
// Closable hint paragraphs: once closed, a hint stays closed on this computer.
const tipsClosed = new Set(loadLocal('tipsClosed', []));
const tip = (key, html, cls = '') => (tipsClosed.has(key) ? '' : `<div class="tip ${cls}" data-tipbox="${key}"><span>${html}</span><button class="tip-x" type="button" data-act="tip-close" data-tip="${key}" title="Скрыть подсказку" aria-label="Скрыть подсказку">✕</button></div>`);
function closeTip(key) { tipsClosed.add(key); saveLocal('tipsClosed', [...tipsClosed]); document.querySelector(`[data-tipbox="${key}"]`)?.remove(); }
// Where the tab panel sits: top, bottom or left; on the left it can shrink to icons only.
const NAV_POS = [['top', 'Сверху'], ['bottom', 'Снизу'], ['left', 'Слева']];
const nav = { pos: 'top', mini: false, ...loadLocal('nav', {}) };
function applyNav() {
  if (!NAV_POS.some(([k]) => k === nav.pos)) nav.pos = 'top';
  const shell = $('#shell');
  for (const [k] of NAV_POS) shell.classList.toggle('nav-' + k, nav.pos === k);
  shell.classList.toggle('nav-mini', nav.pos === 'left' && nav.mini);
  const b = $('[data-act="nav-mini"]');
  if (b) { b.title = nav.mini ? 'Развернуть панель' : 'Свернуть панель до значков'; b.setAttribute('aria-pressed', String(nav.mini)); }
}
let dense = !!loadLocal('dense', false);
// Animations: panels slide, dialogs and menus fade in. On unless Windows asks for less motion; per computer.
let anim = loadLocal('anim', null) ?? !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function applyAnim() { document.documentElement.classList.toggle('anim', !!anim); }
// A closing panel leaves as a detached copy (without ids, not clickable) that slides out, so the real one
// can go at once and nothing waits for the animation.
function leaveAnimated(...els) {
  if (!anim) return;
  for (const el of els.filter(Boolean)) {
    const ghost = el.cloneNode(true);
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    ghost.classList.remove('enter'); ghost.classList.add('leaving'); ghost.inert = true; ghost.setAttribute('aria-hidden', 'true');
    document.body.append(ghost);
    setTimeout(() => ghost.remove(), 220);
  }
}
let searchTimer = null;
function applyDense() { $('#shell').classList.toggle('dense', dense); }
function setNav(patch) {
  Object.assign(nav, patch);
  saveLocal('nav', nav);
  applyNav();
  if (!$('#view-menu').hidden) renderViewMenu();
}
const TRASH_DAYS = 30;
// Tabs depend on the role: a specialist has no outside contractors or team management.
const visibleTabs = () => orderedTabs(); // 4.1: «Люди» for everyone — a specialist sees staff and the org structure

const state = {
  // Non-deleted records (archived projects included). Deleted ones live in state.trash.
  projects: new Map(), contractors: new Map(), tasks: new Map(),
  trash: { projects: [], contractors: [], tasks: [] },
  loaded: false,
  tab: ((t) => (TABS.some(x => x.id === t) ? t : 'overview'))(loadLocal('tab', 'overview')),
  showArchive: false,
  filters: { project: '', contractor: '', status: '', mark: '', q: '', owner: '' },
  drawer: null,      // { kind, id, tab }
  draft: null,       // task drawer: { milestones, plan } edited before saving
  dirtyBase: null,   // serialized form at open, to warn about unsaved changes
  importData: null,  // parsed file while the import drawer is open
  sort: loadLocal('sort', { key: '', dir: '' }),
  gantt: { from: addDays(todayStr(), -7), days: 63, nameW: 190, group: 'contractor', ...loadLocal('gantt', {}) },
  kanban: { project: '', contractor: '', lanes: '' },
  // 4.1: inter-section assignments are hidden in the Gantt and the Kanban until the checkbox is on.
  showAssign: { gantt: false, kanban: false },
  kbShow: { proj: true, who: true, due: true, flags: true },
  reportScope: 'all',
  win: { compact: false, clickThrough: false, alwaysOnTop: true, opacity: 0.82 },
  today: todayStr(),
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const money = n => nf.format(Number(n) || 0) + '\u00a0₽';
const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ru');
const timing = t => L.timing(t, state.today);
const totals = list => L.totals(list, state.today);
const projectOf = t => state.projects.get(t.projectId);
const contractorOf = t => state.contractors.get(t.contractorId);
const isArchived = t => !!projectOf(t)?.archived;
// Working set: cards of archived projects are hidden from every working view.
// Role helpers for the current user.
const canMoney = () => A.canSeeMoney(state.me);
const isSpec = () => A.isSpecialist(state.me);
const canEditFields = () => A.canEditTaskFields(state.me);
const ownerOf = t => state.users?.get(t.ownerId);
const hasOwner = (t, uid) => A.ownersOf(t).includes(uid);
const unread = t => A.isUnread(t, state.me?.id);
const absHits = t => A.absenceHits(t, liveUsers());
// «Quiet» cards: in work but nothing happened for `quietDays` days.
let quietDays = Number(loadLocal('quietDays', 7)) || 7;
const quietList = list => list.filter(t => ['in_progress', 'revision'].includes(t.status) && A.lastActivity(t)
  && dayNum(state.today) - dayNum(A.lastActivity(t).slice(0, 10)) >= quietDays);
const coOwnersOf = t => (t.coOwnerIds || []).map(id => state.users?.get(id)).filter(Boolean);
const userLabel = u => (u ? `${u.name}${u.id === state.me?.id ? ' (вы)' : ''}` : 'не назначен');
const tasksArr = () => [...state.tasks.values()].filter(t => !isArchived(t));
const liveProjects = () => [...state.projects.values()].filter(p => !p.archived).sort(byName);
const archivedProjects = () => [...state.projects.values()].filter(p => p.archived).sort(byName);
const contractorsArr = () => [...state.contractors.values()].sort(byName);
const clone = v => JSON.parse(JSON.stringify(v ?? null));
// Per-user view preferences (sort, Gantt zoom and column width, last tab); data itself lives in data.json.
function loadLocal(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem('glavspec.' + key)); return v ?? fallback; } catch { return fallback; }
}
function saveLocal(key, value) { try { localStorage.setItem('glavspec.' + key, JSON.stringify(value)); } catch { /* preferences are optional */ } }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const days = n => `${n}\u00a0${plural(Math.abs(n), 'день', 'дня', 'дней')}`;

const TOAST_UNDO_MS = 10000;
function toast(msg, bad = false, action = null) {
  const el = $('#toast');
  el.replaceChildren();
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { el.hidden = true; action.run(); });
    el.append(btn);
  }
  // Short for plain notes; an error stays 7 s; a note with «Отменить» stays 10 s (backlog 46) with a bar
  // running down, so it is clear how long the undo is offered. Hovering keeps it open.
  const ms = bad ? 7000 : action ? TOAST_UNDO_MS : 1800;
  if (action && !bad) {
    const bar = document.createElement('i');
    bar.className = 'toast-left';
    bar.style.animationDuration = ms + 'ms';
    el.append(bar);
  }
  el.className = 'toast' + (bad ? ' bad' : '') + (action ? ' has-act' : ''); el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms);
  el.onmouseenter = () => { clearTimeout(toast._t); el.classList.add('held'); };
  el.onmouseleave = () => {
    el.classList.remove('held');
    const bar = el.querySelector('.toast-left');
    // The bar starts again for the shorter time left after hovering.
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; bar.style.animationDuration = '3000ms'; }
    toast._t = setTimeout(() => { el.hidden = true; }, action ? 3000 : 1500);
  };
}

/* ---------- data ---------- */
function setData(snap) {
  const prevMe = state.me?.id;
  state.me = snap.me || null;
  state.users = new Map((snap.users || []).filter(u => !u.deletedAt).map(u => [u.id, u]));
  if (prevMe && prevMe !== state.me?.id) { undoStack.length = 0; closeDrawer(); }
  if (!visibleTabs().some(t => t.id === state.tab)) state.tab = 'overview';
  state.trash = { projects: [], contractors: [], tasks: [] };
  for (const col of ['projects', 'contractors', 'tasks']) {
    const live = new Map();
    for (const d of snap[col] || []) {
      if (d.deletedAt) state.trash[col].push(d); else live.set(d.id, d);
    }
    state[col] = live;
  }
  state.chats = new Map((snap.chats || []).map(c => [c.id, c]));
  state.depts = new Map((snap.depts || []).filter(d => !d.deletedAt).map(d => [d.id, d]));
  const first = !state.loaded;
  state.loaded = true;
  if (prevMe !== state.me?.id) { mentionSeenTs = null; msg.chatId = SOLO?.kind === 'chat' ? SOLO.id : ''; } // a chat window stays on its chat
  const d = state.drawer;
  if (d?.id && ['task', 'project', 'contractor'].includes(d.kind)) {
    const map = { task: state.tasks, project: state.projects, contractor: state.contractors }[d.kind];
    if (!map.has(d.id)) closeDrawer();
  }
  if (d?.kind === 'trash') renderTrash();
  render();
  if (first) requestAnimationFrame(() => requestAnimationFrame(restoreScroll)); // after the first real render
}
// Each tab keeps its scroll position, also across restarts.
const scrollPos = loadLocal('scroll', {});
let scrollTimer = null;
function rememberScroll() {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrollPos[state.tab] = $('#app').scrollTop; saveLocal('scroll', scrollPos); }, 250);
}
function restoreScroll() { $('#app').scrollTop = scrollPos[state.tab] || 0; }
const op = {
  set: (col, id, data) => ({ type: 'set', col, id, data }),
  update: (col, id, data) => ({ type: 'update', col, id, data }),
  del: (col, id) => ({ type: 'delete', col, id }),
};
// Undo: before each write, remember how the touched records looked, so Ctrl+Z can put them back.
const undoStack = [];
const UNDO_LIMIT = 50;
function findDoc(col, id) {
  return state[col]?.get(id) || state.trash[col]?.find(d => d.id === id) || null;
}
function inverseOf(opsIn) {
  const ops = Array.isArray(opsIn) ? opsIn : [opsIn];
  const seen = new Set(), inverse = [];
  for (const o of ops) {
    const key = o.col + '/' + o.id;
    if (seen.has(key)) continue; // the first state seen is the one to restore
    seen.add(key);
    const before = findDoc(o.col, o.id);
    if (!before) { inverse.push(op.del(o.col, o.id)); continue; }
    if (o.type === 'update') {
      // Restore only the touched fields: the window may not hold the whole record (money is stripped for some roles).
      const keys = new Set(ops.filter(x => x.col === o.col && x.id === o.id && x.type === 'update').flatMap(x => Object.keys(x.data || {})));
      inverse.push(op.update(o.col, o.id, Object.fromEntries([...keys].map(k => [k, before[k] === undefined ? null : clone(before[k])]))));
    } else { const { id, moneyHidden, ...data } = clone(before); inverse.push(op.set(o.col, o.id, data)); }
  }
  return inverse.reverse();
}
async function write(ops, okMsg, { undo = true, undoLabel } = {}) {
  const inverse = undo ? inverseOf(ops) : null;
  let res;
  try { res = await api.write(ops, { action: undoLabel || okMsg || '', undo: !undo }); }
  catch (e) { res = { ok: false, message: 'Не удалось сохранить: ' + (e?.message || e) }; }
  if (!res.ok) { toast(res.message, true); return false; }
  if (inverse) {
    undoStack.push({ label: undoLabel || okMsg || 'изменение', ops: inverse });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  if (okMsg) toast(okMsg, false, inverse ? { label: 'Отменить', run: undoLast } : null);
  return true;
}
async function undoLast() {
  const last = undoStack.pop();
  if (!last) return toast('Отменять нечего.');
  if (state.drawer && ['task', 'project', 'contractor'].includes(state.drawer.kind)) closeDrawer();
  if (await write(last.ops, null, { undo: false, undoLabel: `Отмена: ${last.label}` })) toast(`Отменено: ${last.label.replace(/^[А-ЯЁ]/, c => c.toLowerCase())}`);
}
async function refresh() { try { const r = await api.getData(); state.remote = r.remote || null; setData(r.data); renderRemote(); } catch { /* the change event will follow */ } }


/* ---------- buttons and links: data-act="name" → the handler its part registers with onAct ----------
   Each part (src/renderer/app/NN-*.js) ends with onAct({ name: ({ e, el, id, act }) => … }): what its own
   buttons do. 38-events.js finds the handler on a click. A name registered twice is a mistake, caught at start. */
const ACTIONS = new Map();
function onAct(handlers) {
  for (const [name, fn] of Object.entries(handlers)) {
    if (ACTIONS.has(name)) throw new Error(`data-act «${name}» registered twice`);
    ACTIONS.set(name, fn);
  }
}

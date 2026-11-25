(() => {
'use strict';
// Built by tools/build-app.js from src/renderer/app/*.js — edit the parts, then run: node tools/build-app.js

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
  orgs: '<path d="M2.4 14V2.6h7.2V14M9.6 6.2h4V14M1.4 14h13.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M4.6 5h.8M7 5h.8M4.6 7.6h.8M7 7.6h.8M4.6 10.2h.8M7 10.2h.8M11.4 8.8h.4M11.4 11.2h.4" stroke-linecap="round"/>',
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
  { id: 'orgs', label: 'Контрагенты' }, // 4.9 — only for those who work with customers or the budget
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
const visibleTabs = () => orderedTabs().filter(t => t.id !== 'orgs' || A.canSeeOrgs(state.me)); // 4.1: «Люди» for everyone — a specialist sees staff and the org structure

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
  state.trash = { projects: [], contractors: [], tasks: [], orgs: [] };
  for (const col of ['projects', 'contractors', 'tasks', 'orgs']) {
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
  if (d?.id && ['task', 'project', 'contractor', 'org'].includes(d.kind)) {
    const map = { task: state.tasks, project: state.projects, contractor: state.contractors, org: state.orgs }[d.kind];
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
  if (state.drawer && ['task', 'project', 'contractor', 'org'].includes(state.drawer.kind)) closeDrawer();
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
  $('#tabs').innerHTML = visibleTabs().map(t => `<button class="tab" role="tab" type="button" draggable="true" data-act="tab" data-id="${t.id}" aria-selected="${state.tab === t.id}" title="${t.label} — перетащите, чтобы поменять порядок вкладок">${icon(t.id)}<span class="lbl">${t.label}</span>${
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
// Small modal with one text field; resolves to the text or null.
// A longer note (up to 200 characters) in a small dialog; null when cancelled.
// «Запросить у заказчика» from the project page: one request (and a row of source data unless it is a decision).
function askCustomer(p) {
  const kinds = [...IRD_KINDS, ['decision', 'Решение или ответ']];
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="aqt" novalidate><h2 id="aqt">Запросить у заказчика · ${esc(p.name)}</h2>
      <p class="hint">Заказчик увидит запрос в «Нужно от вас» и в «Вопросах» и ответит прямо со страницы. ТУ, письма, согласования и документы попадут ещё и в «Исходные данные».</p>
      <div class="f"><span class="lbl">Что запрашиваем</span><div class="aq-kinds" role="radiogroup">${kinds.map(([k, l], i) => `<label><input type="radio" name="aq-kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
      <div class="f"><label for="aq-title" class="req">Что нужно</label><input id="aq-title" maxlength="160" placeholder="ТУ на электроснабжение 630 кВт" list="aq-dl"><datalist id="aq-dl">${Techcard.SOURCE_DATA.map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div class="fgrid"><div class="f"><label for="aq-due">Срок</label><input id="aq-due" type="date" value="${addDays(state.today, 10)}"></div>
        <div class="f"><label for="aq-who">Кто готовит</label><input id="aq-who" value="Заказчик" maxlength="60"></div></div>
      <div class="f"><label for="aq-why">Зачем (увидит заказчик)</label><input id="aq-why" maxlength="200" placeholder="Без них экспертиза не примет раздел ИОС1"></div>
      <div class="f"><span class="lbl">Файлы для согласования</span><div class="aq-files" id="aq-files"></div>
        <div class="row-in"><button class="btn sm" type="button" data-m="attach">Приложить файл…</button><span class="hint">Заказчик скачает их в кабинете и ответит «Согласовано» или «Есть замечания».</span></div></div>
      <p class="neg" id="aq-err"></p>
      <div class="modal-f"><button class="btn primary" type="submit">Запросить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
    document.body.append(root);
    const q = s => root.querySelector(s), close = v => { root.remove(); resolve(v); };
    const files = [];
    const drawFiles = () => { q('#aq-files').innerHTML = files.map((f, i) => `<span class="aq-file">${icon('file')}${esc(f.name)} <span class="hint">${fileSize(f.size)}</span><button type="button" class="linkbtn" data-m="unattach" data-i="${i}" aria-label="Убрать">✕</button></span>`).join(''); };
    q('#aq-title').focus();
    root.addEventListener('click', async e => {
      if (e.target === root || e.target.dataset.m === 'cancel') return close(false);
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (m === 'attach') { const r = await api.attachAdd(p.id); if (r?.ok) { files.push(r.file); drawFiles(); } else if (r && !r.canceled) q('#aq-err').textContent = r.message; }
      if (m === 'unattach') { files.splice(Number(e.target.closest('[data-m]').dataset.i), 1); drawFiles(); }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } });
    root.addEventListener('change', e => { if (e.target.id === 'aq-title' && !root.querySelector('input[name="aq-kind"]:checked').dataset.touched) { const k = irdKindOf(e.target.value); root.querySelector(`input[name="aq-kind"][value="${k}"]`).checked = true; } if (e.target.name === 'aq-kind') e.target.dataset.touched = '1'; });
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const title = q('#aq-title').value.trim(), kind = root.querySelector('input[name="aq-kind"]:checked').value, due = q('#aq-due').value, why = q('#aq-why').value.trim();
      if (!title) return modalErr(root, '#aq-err', 'Напишите, что нужно.', '#aq-title');
      const lbl = kinds.find(k => k[0] === kind)[1];
      const reqTitle = kind === 'decision' || kind === 'doc' || new RegExp('^' + lbl, 'i').test(title) ? title : `${lbl}: ${title}`;
      const requests = [...(p.requests || [])], ird = [...(p.ird || [])];
      const r = { id: newId(), title: reqTitle, due: isDate(due) ? due : '', why: why || (kind === 'decision' ? '' : IRD_WHY[kind]), done: false, irdId: '', ...(files.length ? { files } : {}) };
      if (kind !== 'decision') {
        const same = ird.find(x => x.title.trim().toLowerCase() === title.toLowerCase());
        const row = same ? { ...same, status: ['accepted', 'done'].includes(same.status) ? same.status : 'wait', due: r.due || same.due } : { id: newId(), title, kind, who: q('#aq-who').value.trim() || 'Заказчик', status: 'wait', due: r.due, note: why };
        if (same) ird[ird.indexOf(same)] = row; else ird.push(row);
        r.irdId = row.id;
      }
      requests.push(r);
      const ok = await write(op.update('projects', p.id, kind === 'decision' ? { requests } : { requests, ird }), `Запрос добавлен: ${reqTitle}${cab?.published?.[p.id] ? ' — отправляем в кабинет заказчика' : ''}`);
      if (ok) { close(true); if (cab?.published?.[p.id]) api.cabinetSync(); } // republish right away, not in 2 minutes
    });
  });
}
function askNote(title, label, value = '') {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ntitle" novalidate><h2 id="ntitle">${esc(title)}</h2>
      <div class="f"><label for="n-text">${esc(label)}</label><textarea id="n-text" rows="3" maxlength="200">${esc(value)}</textarea></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
    document.body.append(root);
    const close = v => { root.remove(); resolve(v); };
    root.querySelector('#n-text').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); close(root.querySelector('#n-text').value.trim()); });
  });
}
// Backlog 45 for dialogs: a stopped submit shows its reason in the dialog, highlights the field it is about,
// scrolls to it and puts the cursor there. `msg` empty clears the error.
function modalErr(root, errSel, msg, fieldSel = '') {
  const err = root.querySelector(errSel);
  if (err) { err.textContent = msg; err.hidden = !msg; err.setAttribute('role', 'alert'); }
  if (!msg) { root.querySelectorAll('.field-bad').forEach(x => x.classList.remove('field-bad')); return false; }
  const f = fieldSel && root.querySelector(fieldSel);
  if (f) {
    f.classList.add('field-bad');
    const off = () => f.classList.remove('field-bad');
    f.addEventListener('input', off, { once: true }); f.addEventListener('change', off, { once: true });
    f.scrollIntoView({ block: 'center' });
    f.focus?.({ preventScroll: true });
  } else err?.scrollIntoView({ block: 'nearest' });
  return false;
}
// The same outside dialogs: an error plate plus the highlighted field.
function pageErr(msg, fieldSel) { toast(msg, true); return modalErr(document, '#page-err-none', msg, fieldSel); }
function askText(title, label, placeholder = '') {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate><h2 id="mtitle">${esc(title)}</h2>
      <div class="f"><label class="req" for="m-text">${esc(label)}</label><input id="m-text" maxlength="40" placeholder="${esc(placeholder)}"></div>
      <div class="err" id="m-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
    document.body.append(root);
    const close = v => { root.remove(); resolve(v); };
    root.querySelector('#m-text').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const v = root.querySelector('#m-text').value.trim(); if (v) close(v); else modalErr(root, '#m-err', 'Заполните поле «' + label + '».', '#m-text'); });
  });
}
function confirmBox(text, yes = 'Да', no = 'Отмена') {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><p>${esc(text)}</p><div class="modal-f"><button class="btn danger solid" type="button" data-m="yes">${esc(yes)}</button><button class="btn" type="button" data-m="no">${esc(no)}</button></div></div>`;
    document.body.append(root);
    const close = r => { root.remove(); resolve(r); };
    // Yes → true, the second button → false, dismissed (backdrop, Esc) → null.
    root.addEventListener('click', e => { if (e.target === root) close(null); if (e.target.dataset.m === 'no') close(false); if (e.target.dataset.m === 'yes') close(true); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('[data-m="no"]').focus();
  });
}
async function askDocNames(format) {
  const p = state.projects.get(state.drawer.id) || {};
  const def = await api.docDefaults();
  const saved = loadLocal('docNames', {});
  const contact = p.contactId && state.users.get(p.contactId);
  const gipUser = contact || (A.isGip(state.me) ? state.me : liveUsers().find(u => u.role === 'gip'));
  const v = { customer: p.client || '', gip: saved.gip || gipUser?.name || '', developer: saved.developer || state.me?.name || '', director: saved.director || def.director || '', year: todayStr().slice(0, 4) };
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const f = (k, label, hint = '') => `<div class="f"><label for="dn-${k}">${label}</label><input id="dn-${k}" value="${esc(v[k])}" maxlength="${k === 'customer' ? 300 : 60}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="dntitle" novalidate><h2 id="dntitle">${format === 'vok' ? 'Ведомость основных комплектов (РД)' : 'Состав проектной документации'}</h2>
      <p class="hint">Обложка, титульный лист и штампы — из шаблона офиса. Номера листов и «Листов» Word пересчитает сам при открытии.${def.own.includes(format) ? ' Используется ваш шаблон из папки шаблонов.' : ''}</p>
      ${f('customer', 'Заказчик', 'На обложке: «Заказчик – …»')}${f('gip', 'Главный инженер проекта', 'Титульный лист; в штамп — фамилия')}${f('developer', 'Разработал', 'В штамп — фамилия')}${f('director', 'Генеральный директор')}${f('year', 'Год')}
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить файл…</button><button class="btn" type="button" data-m="cancel">Отмена</button><button class="linkbtn" type="button" data-m="tpl">Свои шаблоны…</button></div></form>`;
    document.body.append(root);
    const close = r => { root.remove(); resolve(r); };
    root.querySelector('#dn-customer').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); if (e.target.dataset.m === 'tpl') api.openTemplates(); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const out = Object.fromEntries(Object.keys(v).map(k => [k, root.querySelector('#dn-' + k).value.trim()]));
      saveLocal('docNames', { gip: out.gip, developer: out.developer, director: out.director });
      close(out);
    });
  });
}
/* ---------- «Сервер Пульта»: the shared base ---------- */
// With every change of the data the window asks where it stands with the server (a cheap local call).
async function remoteStatus() {
  if (!api.serverInfo) return;
  const r = await api.serverInfo().catch(() => null);
  state.remote = r?.mode === 'server' ? r : null;
  renderRemote();
}
// The chip in the title bar: «на связи» / «нет связи · ждут отправки N»; conflicts open their dialog.
// «4.10.0» is newer than «4.9.3»: compared part by part as numbers.
function newerVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}
function renderRemote() {
  let chip = $('#srv-chip');
  const r = state.remote;
  if (!r) { if (chip) chip.hidden = true; return; }
  if (!chip) {
    $('.user-wrap')?.insertAdjacentHTML('afterend', '<button class="srv-chip" id="srv-chip" type="button" data-act="server"></button>');
    chip = $('#srv-chip');
  }
  const off = !r.online, wait = r.pending || 0;
  // The web version is always as new as its server: an «outdated» answer means the page is old — load it again (once).
  if (r.outdated?.who === 'pult' && r.web) {
    let again = false;
    try { again = sessionStorage.getItem('pult.reloaded') === '1'; sessionStorage.setItem('pult.reloaded', '1'); } catch { /* no storage */ }
    if (!again) { location.reload(); return; }
  } else if (r.web && r.online) { try { sessionStorage.removeItem('pult.reloaded'); } catch { /* no storage */ } }
  const old = r.outdated ? (r.outdated.who === 'server' ? 'Сервер устарел' : 'Обновите Пульт') : '';
  // 65: the GIP put a newer Пульт on the server — said once per version, then a word on the chip.
  const upd = r.app && r.server?.pult && newerVersion(r.server.pult.version, r.app) ? r.server.pult.version : '';
  if (upd && loadLocal('updToldFor', '') !== upd) { saveLocal('updToldFor', upd); toast(`Есть новый Пульт ${upd} — «Сервер» вверху → «Обновить»`); }
  chip.hidden = false;
  chip.className = `srv-chip${r.authLost || old ? ' bad' : off ? ' off' : wait ? ' wait' : ''}`;
  chip.innerHTML = `<i></i>${old ? `${old}${wait ? ` · ждут отправки ${wait}` : ''}` : r.authLost ? 'Войдите заново' : off ? `Нет связи${wait ? ` · ждут отправки ${wait}` : ''}` : wait ? `Отправляю ${wait}…` : upd ? 'Сервер · обновление' : 'Сервер'}`;
  chip.title = old ? `${r.outdated.message} Изменения не потеряются: они ждут и уйдут после обновления.` : r.authLost ? r.authLost : off ? `Нет связи с сервером (${r.lastError || 'нет ответа'}). Работайте дальше: изменения отправятся сами, когда связь вернётся.` : `Общая база: ${r.url} · вы ${r.login}`;
  for (const f of r.failed || []) toast(`Не отправлено: ${f.message}`, true);
  const nConf = Array.isArray(r.conflicts) ? r.conflicts.length : r.conflicts;
  if (nConf && !document.querySelector('.conflict-modal')) conflictsDialog();
}
const FIELD_L = { finish: 'Плановый финиш', start: 'Старт', status: 'Статус', title: 'Название', ownerId: 'Ответственный', execRef: 'Исполнитель', readiness: 'Готовность', name: 'Название', note: 'Заметка', budget: 'Бюджет', marks: 'Разделы', projectId: 'Проект' };
const fieldVal = (f, v) => (v == null || v === '' ? '—' : /finish|start|date/i.test(f) && isDate(v) ? fmtDate(v) : f === 'status' ? (STATUSES[v]?.label || v) : f === 'ownerId' ? (state.users.get(v)?.name || v) : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 80));
async function conflictsDialog() {
  const info = await api.serverInfo?.();
  const list = info?.conflicts || [];
  if (!list.length) return;
  const c = list[0];
  const what = x => { const d = x.col === 'tasks' ? state.tasks.get(x.id) : state[x.col]?.get?.(x.id); return x.col === 'tasks' && d ? `Карточка «${marksText(d)}»` : d?.name ? `«${d.name}»` : 'Запись'; };
  const root = document.createElement('div');
  root.className = 'modal-back conflict-modal';
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cf-t"><h2 id="cf-t">Двое поправили одно</h2>
    <p class="hint">Пока вы работали${c.at ? ` (с ${fmtDate(c.at.slice(0, 10))})` : ''}, это же поле изменил другой человек. Что оставить?</p>
    <table class="pd-t"><thead><tr><th>Что</th><th>Было</th><th>У вас</th><th>Сейчас на сервере</th></tr></thead><tbody>
    ${c.list.map(x => `<tr><td>${esc(what(x))}: ${esc(FIELD_L[x.field] || x.field)}</td><td>${esc(fieldVal(x.field, x.was))}</td><td><b>${esc(fieldVal(x.field, x.mine))}</b></td><td><b>${esc(fieldVal(x.field, x.theirs))}</b></td></tr>`).join('')}</tbody></table>
    <div class="modal-f"><button class="btn primary" type="button" data-cf="mine">Оставить моё</button><button class="btn" type="button" data-cf="theirs">Оставить как на сервере</button>${list.length > 1 ? `<span class="hint">ещё ${list.length - 1}</span>` : ''}</div></div>`;
  document.body.append(root);
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-cf]');
    if (!b) return;
    root.remove();
    const r = await api.serverResolve(c.i, b.dataset.cf === 'mine');
    if (r?.ok === false && r.message) toast(r.message, true); else toast(b.dataset.cf === 'mine' ? 'Оставлено ваше' : 'Оставлено как на сервере');
    await refresh();
  });
}
// The «Сервер Пульта» window: connect / move the base (the GIP) / who has a login (the GIP) / password / disconnect.
async function serverDialog(tab = '') {
  const info = await api.serverInfo?.();
  if (!info) return toast('В этой версии Пульта нет работы с сервером.', true);
  const remoteOn = info.mode === 'server', gip = A.isGip(state.me);
  const root = document.createElement('div');
  root.className = 'modal-back srv-modal';
  const field = (id, label, type = 'text', ph = '', extra = '') => `<div class="f"><label for="${id}">${label}</label><input id="${id}" type="${type}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"${extra}></div>`;
  let html;
  if (!remoteOn) {
    const t = tab || 'join';
    html = `<h2 id="srv-t">Сервер Пульта</h2>
      <p class="hint">Общая база команды в интернете: все работают с одними данными, каждый входит своим логином и видит только своё. Без связи Пульт работает дальше и отправит изменения потом.</p>
      <div class="seg srv-tabs"><button class="btn sm${t === 'join' ? ' on' : ''}" type="button" data-st="join">Подключиться</button>${gip ? `<button class="btn sm${t === 'move' ? ' on' : ''}" type="button" data-st="move">Перенести мою базу на сервер</button>` : ''}</div>
      ${t === 'move' ? `<p class="hint">Один раз, ГИПом, на только что установленный сервер. Ваш файл на этом компьютере останется как есть — копией.</p>
        ${field('sv-url', 'Адрес сервера', 'text', 'например 1-2-3-4.sslip.io')}${field('sv-code', 'Код установки', 'text', 'показан в конце установки сервера')}
        ${field('sv-login', 'Ваш логин', 'text', 'volkov')}${field('sv-pass', 'Пароль (не короче 8 знаков)', 'password')}`
      : `<p class="hint">По приглашению ГИПа — введите код и придумайте логин и пароль. Уже есть логин — оставьте код пустым.</p>
        ${field('sv-url', 'Адрес сервера', 'text', 'например 1-2-3-4.sslip.io')}${field('sv-code', 'Код приглашения (если впервые)', 'text', '8 букв и цифр')}
        ${field('sv-login', 'Логин', 'text', '')}${field('sv-pass', 'Пароль', 'password')}`}
      <div class="err" id="sv-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="button" data-sv="${t}">${t === 'move' ? 'Перенести базу' : 'Подключиться'}</button><button class="btn" type="button" data-sv="close">Отмена</button></div>`;
  } else {
    let acc = null;
    if (gip) acc = await api.serverCall('accounts');
    const upd = await api.updateInfo?.(); // 65: only the desktop Пульт updates itself (the web version is always new)
    const devs = n => (n ? `${n} ${plural(n, 'устройство', 'устройства', 'устройств')}` : 'не входил');
    html = `<h2 id="srv-t">Сервер Пульта</h2>
      <p>${info.online ? '<span class="chip tone-ok">на связи</span>' : `<span class="chip tone-warn">нет связи</span> <span class="hint">${esc(info.lastError || '')}</span>`} ${info.pending ? `<span class="chip tone-warn">ждут отправки: ${info.pending}</span>` : ''}</p>
      <p class="hint">Адрес: <b>${esc(info.url)}</b> · вы вошли как <b>${esc(info.login)}</b>${info.server?.version ? ` · сервер ${esc(info.server.version)}` : ''}</p>
      ${gip && acc?.ok ? `<h3>Вход в Пульт</h3><p class="hint">Пригласите человека — он введёт код в Пульте (или откроет ссылку на телефоне) и придумает себе пароль. Права — как в «Людях»: деньги и контакты заказчика видит только ГИП, если не отметить иначе.</p>
        <table class="pd-t srv-acc"><thead><tr><th>Кто</th><th>Логин</th><th>Где входил</th><th></th></tr></thead><tbody>
        ${acc.accounts.map(a => `<tr${a.disabled ? ' class="off"' : ''}><td><b>${esc(a.name)}</b><br><span class="hint">${esc(A.ROLES[a.role]?.label || a.role)}</span></td>
          <td>${a.login ? esc(a.login) : '<span class="hint">нет</span>'}${a.disabled ? ' <span class="chip tone-bad">вход отключён</span>' : ''}</td>
          <td class="hint">${devs(a.devices.length)}${a.devices[0] ? `<br>${esc(a.devices.map(d => d.device || 'устройство').join(', ')).slice(0, 80)}` : ''}</td>
          <td class="srv-acts">${a.invite ? `<span class="hint sv-code">код <b class="mono">${esc(a.invite.code)}</b> до ${fmtDate(a.invite.until.slice(0, 10))}</span> ` : ''}
            ${a.userId === state.me?.id ? '<span class="hint">это вы</span>' : `${!a.login || a.invite ? `<button class="btn sm" type="button" data-sv="invite" data-id="${esc(a.userId)}">${a.invite ? 'Новый код' : 'Пригласить'}</button>` : `<button class="btn sm" type="button" data-sv="reset" data-id="${esc(a.userId)}">Сбросить пароль</button>`}
            ${a.login ? `<button class="btn ghostbtn sm" type="button" data-sv="${a.disabled ? 'enable' : 'disable'}" data-id="${esc(a.userId)}">${a.disabled ? 'Включить вход' : 'Отключить вход'}</button>` : ''}`}</td></tr>`).join('')}</tbody></table>
        <div class="srv-invite" id="sv-inv" hidden></div>` : ''}
      ${upd ? `<h3>Обновление Пульта</h3>
        <p>${upd.newer ? `<span class="chip tone-work">есть новая версия ${esc(upd.server.version)}</span> у вас ${esc(upd.app)} <button class="btn primary sm" type="button" data-sv="upd-run">Обновить</button>`
          : `<span class="hint">У вас Пульт ${esc(upd.app)}${upd.server ? ` · на сервере ${esc(upd.server.version)}` : ''} — обновлять нечего.</span>`}</p>
        <p class="hint">Пульт скачает установщик с сервера, проверит, что файл тот самый, и запустит его — нажмите в нём «Далее». Ваши данные не затрагиваются.</p>
        ${upd.gip ? `<p class="hint">ГИП: скачайте с GitHub новый установщик (PultGlavspeca_…_x64-setup.exe) и положите его сюда — у всех появится «Обновить».</p>
          <div class="row-in"><button class="btn sm" type="button" data-sv="upd-put">Положить новую версию на сервер…</button><span class="hint" id="sv-upd-st"></span></div>` : ''}` : ''}
      ${gip ? `<h3>Реквизиты по ИНН</h3><p class="hint">${info.server?.party ? 'Ключ DaData введён: у всех, кому открыты контрагенты, реквизиты подтягиваются по ИНН, работает «Сверить с ЕГРЮЛ».' : 'Введите ключ DaData один раз — и у всех, кому открыты контрагенты, название, КПП, ОГРН, адрес и руководитель будут подтягиваться по ИНН.'}</p>
        <div class="row-in"><button class="btn sm" type="button" data-sv="party-key">${info.server?.party ? 'Изменить ключ…' : 'Ввести ключ DaData…'}</button></div>` : ''}
      <h3>Мой вход</h3>
      <div class="row-in">${field('sv-old', 'Текущий пароль', 'password')}${field('sv-new', 'Новый пароль', 'password')}<button class="btn sm" type="button" data-sv="pw">Сменить пароль</button></div>
      <div class="err" id="sv-err" hidden></div>
      <div class="modal-f"><button class="btn" type="button" data-sv="others">Выйти на других устройствах</button><button class="btn ghostbtn" type="button" data-sv="disconnect">Отключить этот Пульт от сервера</button><button class="btn primary" type="button" data-sv="close">Готово</button></div>`;
  }
  root.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="srv-t">${html}</div>`;
  document.body.append(root);
  root.querySelector('input')?.focus();
  const q = s => root.querySelector(s), val = s => (q(s)?.value || '').trim();
  const err = (m, f) => modalErr(root, '#sv-err', m, f);
  const busy = (b, on) => { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? 'Подождите…' : b.dataset.label; };
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  root.addEventListener('click', async e => {
    if (e.target === root) return root.remove();
    const st = e.target.closest('[data-st]');
    if (st) { root.remove(); return serverDialog(st.dataset.st); }
    const b = e.target.closest('[data-sv]');
    if (!b) return;
    const a = b.dataset.sv, id = b.dataset.id;
    if (a === 'close') return root.remove();
    if (a === 'join' || a === 'move') {
      if (!val('#sv-url')) return err('Укажите адрес сервера.', '#sv-url');
      if (a === 'move' && !val('#sv-code')) return err('Введите код установки — он показан в конце установки сервера.', '#sv-code');
      if (!val('#sv-login')) return err('Укажите логин.', '#sv-login');
      if (!val('#sv-pass')) return err('Укажите пароль.', '#sv-pass');
      busy(b, true);
      const req = { url: val('#sv-url'), code: val('#sv-code').toUpperCase(), login: val('#sv-login'), password: q('#sv-pass').value };
      const r = a === 'move' ? await api.serverMove(req) : await api.serverSignIn(req);
      busy(b, false);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove();
      toast(a === 'move' ? `База на сервере: записей ${r.count}, файлов ${r.files}${r.missing ? `, не найдено на этом компьютере: ${r.missing}` : ''}. Пульт перезапускается…` : 'Вход выполнен. Пульт перезапускается с общей базой…');
      return;
    }
    if (a === 'invite' || a === 'reset') {
      const r = await api.serverCall(a === 'invite' ? 'inviteCreate' : 'accountReset', id);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      const u = state.users.get(id);
      // The row shows the code that works now (the previous one is no longer valid).
      const cell = b.closest('td');
      const codeHtml = `<span class="hint sv-code">код <b class="mono">${esc(r.code)}</b> до ${fmtDate(r.until.slice(0, 10))}</span> `;
      const old = cell.querySelector('.sv-code, .hint');
      if (old && /код/.test(old.textContent)) old.outerHTML = codeHtml; else cell.insertAdjacentHTML('afterbegin', codeHtml);
      if (a === 'invite') b.textContent = 'Новый код';
      const box = q('#sv-inv');
      const text = `${u?.name || ''}, вход в Пульт «Тандема»:\nадрес: ${info.url}\nкод приглашения: ${r.code} (действует до ${fmtDate(r.until.slice(0, 10))})\n${r.link ? `или откройте на телефоне: ${r.link}\n` : ''}В Пульте: меню → «Сервер Пульта» → «Подключиться», введите код и придумайте логин и пароль.`;
      box.hidden = false;
      box.innerHTML = `<p><b>Код для ${esc(u?.name || '')}: <span class="mono big">${esc(r.code)}</span></b></p><textarea readonly rows="5">${esc(text)}</textarea><button class="btn sm" type="button" data-sv="copy">Скопировать текст приглашения</button>`;
      return;
    }
    if (a === 'copy') { const t = q('#sv-inv textarea'); t.select(); try { await navigator.clipboard.writeText(t.value); toast('Текст приглашения скопирован — отправьте его человеку'); } catch { document.execCommand('copy'); } return; }
    if (a === 'disable' || a === 'enable') {
      const r = await api.serverCall('accountDisable', id, a === 'disable');
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove(); toast(a === 'disable' ? 'Вход отключён, сеансы закрыты' : 'Вход включён'); return serverDialog();
    }
    if (a === 'pw') {
      if (q('#sv-new').value.length < 8) return err('Новый пароль — не короче 8 знаков.', '#sv-new');
      const r = await api.serverCall('passwordChange', q('#sv-old').value, q('#sv-new').value);
      if (!r?.ok) return err(r?.message || 'Не получилось.', '#sv-old');
      toast(r.signedOut ? 'Пароль изменён — на других устройствах нужно войти заново' : 'Пароль изменён'); q('#sv-old').value = ''; q('#sv-new').value = ''; return;
    }
    if (a === 'upd-run') {
      if (!(await confirmBox('Обновить Пульт сейчас? Он закроется и запустится установщик новой версии. Несохранённые карточки сохраните заранее.', 'Обновить'))) return;
      busy(b, true);
      const r = await api.updateInstall(m => toast(m));
      busy(b, false);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      return;
    }
    if (a === 'upd-put') {
      const f = await api.updatePick();
      if (!f) return;
      // The version comes from the file name (PultGlavspeca_4.8.0_x64-setup.exe); asked only if the name has none.
      const version = f.version || (await askText('Номер версии этого установщика', 'Версия', '4.8.0'))?.trim();
      if (!version) return;
      if (f.version && !(await confirmBox(`Положить на сервер Пульт ${version} (${f.name})? У всех, у кого Пульт старее, появится «Обновить».`, 'Положить'))) return;
      if (!/^\d+\.\d+\.\d+$/.test(version)) return err('Номер версии — три числа через точку, например 4.8.0.');
      busy(b, true);
      q('#sv-upd-st').textContent = `Загружаю ${f.name}…`;
      const r = await api.updateUpload(f.path, version);
      busy(b, false);
      q('#sv-upd-st').textContent = '';
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove(); toast(`Пульт ${version} на сервере — у всех появится «Обновить»`); return serverDialog();
    }
    if (a === 'party-key') { root.remove(); return openPartyKey(); }
    if (a === 'others') { const r = await api.serverCall('signOutOthers'); toast(r?.ok ? 'Другие устройства вышли' : (r?.message || 'Не получилось'), !r?.ok); return; }
    if (a === 'disconnect') {
      if (!(await confirmBox('Отключить этот Пульт от сервера? Он вернётся к своему файлу на этом компьютере — к данным на момент переноса или подключения. Общая база на сервере останется.', 'Отключить'))) return;
      await api.serverDisconnect(); root.remove(); toast('Пульт отключён от сервера и перезапускается…');
    }
  });
}

/* ---------- small renderers ---------- */
// Mark chips: a colour stripe and the direction icon, in the italic «drawing» face.
const markChip = m => { const k = A.markKind(m); return `<span class="code${k ? ' k-' + k : ''}">${k ? kindIcon(k) : ''}${esc(m)}</span>`; };
function marksHtml(t) {
  // A card of the composition shows its section (ИОС1.1 · ПД, ЭОМ · РД); the codes behind it only colour the chip.
  const place = t?.id && placeIndex().get(t.id);
  if (place) { const k = A.markKind(sectionsOf(t)[0] || ''); return `<span class="marks" title="${esc(`${place.stage} · ${place.code} · ${place.title}`)}"><span class="code${k ? ' k-' + k : ''}">${k ? kindIcon(k) : ''}${esc(place.short)}</span><span class="st-stage">${place.stage === 'ПД' ? 'П' : 'Р'}</span></span>`; }
  const list = sectionsOf(t);
  return `<span class="marks">${list.length ? list.map(markChip).join('') : '<span class="code">—</span>'}</span>`;
}
// A card is a section of the project's documentation: a volume of ПД (ИОС1.1, АР…) or a section of РД (ЭОМ…)
// from the project composition. Index card id → its place, rebuilt when the data changes.
let placeIdx = null, placeIdxFor = null;
function placeIndex() {
  if (placeIdxFor === state.projects) return placeIdx;
  const m = new Map();
  for (const p of state.projects.values()) {
    const comp = p.composition;
    if (!comp) continue;
    try {
      for (const v of Composition.volumes(comp, p.code || '')) {
        const n = comp.nodes.find(x => x.id === v.id);
        if (n?.taskId) m.set(n.taskId, { stage: 'ПД', ref: 'pd:' + v.id, short: v.abbr || v.code, code: v.code, title: v.title, tom: v.tom });
      }
      for (const r of Composition.rdRows(comp, p.code || '')) if (r.item.taskId) m.set(r.item.taskId, { stage: 'РД', ref: 'rd:' + r.id, short: r.mark, code: r.code, title: r.title, tom: r.tom });
    } catch (e) { console.error('Состав проекта', p.id, e); }
  }
  placeIdx = m; placeIdxFor = state.projects;
  return m;
}
// Short name of a card's section: ИОС1.1, ЭОМ… (cards outside the composition: their codes or the task text).
const marksText = t => (t?.id && placeIndex().get(t.id)?.short) || sectionsOf(t).join(', ') || t.title || '—';
function statusChip(t) {
  if (timing(t).overdue) return `<span class="chip tone-bad" title="Статус: ${esc(STATUSES[t.status]?.label)}">Срок сорван</span>`;
  const s = STATUSES[t.status] || STATUSES.not_started;
  return `<span class="chip tone-${s.tone}">${esc(s.label)}</span>`;
}
// Readiness as a thin bar with the number; «✎» when the chief can set it by hand.
function readyHtml(t) {
  const r = L.readiness(t), manual = L.readinessManual(t.status);
  return `<div class="rd${r === 100 ? ' full' : ''}" title="${manual ? 'В работе: готовность ставит главспец (1–90 %)' : 'Задано статусом'}"><span class="rd-bar"><i style="width:${r}%"></i></span><b class="num">${r}%</b>${manual && !t.readiness ? '<span class="hint">не задано</span>' : ''}</div>`;
}
function payBar(t) {
  const b = budgetOf(t), p = paidOf(t), over = p > b;
  const pct = over ? 100 : b > 0 ? (p / b) * 100 : 0;
  return `<div class="pay"><div class="bar-p ${over ? 'over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
}
// Extra lines under the finish date: shifts and the next/overdue milestone.
function finishExtras(t) {
  const out = [];
  const sh = L.shiftsOf(t);
  if (sh.count) out.push(`<span class="tag" title="Срок переносился ${sh.count} раз(а), всего ${sh.days >= 0 ? '+' : ''}${sh.days} дн.">↻ ${sh.count} · ${sh.days >= 0 ? '+' : ''}${sh.days} дн.</span>`);
  const ms = L.milestonesOf(t, state.today);
  if (ms.overdue.length) out.push(`<span class="tag bad" title="Сорвана контрольная точка">КТ «${esc(ms.overdue[0].title || 'без названия')}» ${fmtDate(ms.overdue[0].date)}</span>`);
  else if (ms.next) out.push(`<span class="tag" title="Ближайшая контрольная точка">КТ «${esc(ms.next.title || 'без названия')}» ${fmtDate(ms.next.date)}</span>`);
  const issues = L.dependencyIssues(t, state.tasks, state.today);
  if (issues.length) out.push(`<span class="tag bad" title="${esc(issues.map(i => i.text).join('; '))}">⛓ ждёт ${esc(sectionsOf(issues[0].pred).join(', '))}</span>`);
  return out.length ? `<div class="tags">${out.join('')}</div>` : '';
}

/* ---------- sortable card tables (shared by «Проекты» and «Все карточки») ---------- */
// Status order follows the workflow; an overdue card sorts first, as the table shows it as «Срок сорван».
const STATUS_RANK = { not_started: 1, in_progress: 2, revision: 3, review: 4, paused: 5, done: 6 };
const SORT_KEYS = {
  project: t => projectOf(t)?.name || '',
  marks: t => sectionsOf(t).join(', '),
  contractor: t => executorOf(t)?.name || '',
  owner: t => ownerOf(t)?.name || '',
  start: t => t.start || '',
  finish: t => t.finish || '',
  status: t => (timing(t).overdue ? 0 : STATUS_RANK[t.status] ?? 9),
  ready: t => L.readiness(t),
  budget: t => budgetOf(t),
  paid: t => paidOf(t),
  rest: t => restOf(t),
};
function sortTasks(list) {
  const { key, dir } = state.sort;
  const get = SORT_KEYS[key];
  if (!get) return list.sort(sortByDeadline);
  const sign = dir === 'desc' ? -1 : 1;
  return list.sort((a, b) => {
    const va = get(a), vb = get(b);
    const ea = va === '' || va == null, eb = vb === '' || vb == null;
    if (ea !== eb) return ea ? 1 : -1; // empty values stay at the bottom in both directions
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru', { numeric: true, sensitivity: 'base' });
    return c * sign || sortByDeadline(a, b);
  });
}
// Header click cycles: ascending → descending → default order (by deadline).
function toggleSort(key) {
  const s = state.sort;
  state.sort = s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: '', dir: '' };
  saveLocal('sort', state.sort);
  renderNow();
}
function sortTh(key, label, cls = '') {
  const s = state.sort, on = s.key === key;
  const aria = on ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<th class="sortable ${cls} ${on ? 'sorted' : ''}" aria-sort="${aria}"><button type="button" data-act="sort" data-key="${key}" title="Сортировать">${label}<span class="sort-ind" aria-hidden="true">${on ? (s.dir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>`;
}

const EDIT_HINT = 'Двойной щелчок — изменить прямо в таблице';

/* ---------- editing a card's dates and fields outside the card form ---------- */
// Asks why the deadline moves; resolves to {reason, note} or null when cancelled.
function askShiftReason(t, from, to, followers = null) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const d = dayNum(to) - dayNum(from);
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
      <h2 id="mtitle">Перенос срока</h2>
      <p><b>${esc(marksText(t))}</b> · ${esc(projectOf(t)?.name || '')}</p>
      <p class="shift-h">${fmtDate(from)} → ${fmtDate(to)} <b>(${d >= 0 ? '+' : ''}${d} дн.)</b></p>
      ${followers?.size ? `<div class="hint2 shift-follow"><label class="chk"><input type="checkbox" id="m-follow" checked> Сдвинуть и зависимые карточки (${followers.size}): ${[...followers.keys()].map(fid => esc(marksText(state.tasks.get(fid) || {}))).join(', ')}</label></div>` : ''}
      <div class="f"><label class="req" for="m-reason">Причина переноса</label>
        <select id="m-reason"><option value="">— выберите —</option>${Object.entries(SHIFT_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
      <div class="f"><label for="m-note">Комментарий</label><input id="m-note" maxlength="200" placeholder="Например: заказчик сменил ТУ"></div>
      <div class="err" id="m-err" hidden>Выберите причину переноса.</div>
      <div class="modal-f"><button class="btn primary" type="submit">Перенести</button><button class="btn" type="button" data-m="cancel">Отмена</button></div>
    </form>`;
    document.body.append(root);
    const close = v => { root.remove(); resolve(v); };
    root.querySelector('#m-reason').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      e.stopPropagation();
      const reason = root.querySelector('#m-reason').value;
      if (!reason) return modalErr(root, '#m-err', 'Выберите причину переноса.', '#m-reason');
      close({ reason, note: root.querySelector('#m-note').value.trim(), follow: !!root.querySelector('#m-follow')?.checked });
    });
  });
}

// Saves new start/finish; a moved finish is logged with its reason like in the card form.
async function commitDates(id, patch, followers = null) {
  const t = state.tasks.get(id);
  if (!t) return false;
  const next = { start: patch.start !== undefined ? patch.start : t.start || '', finish: patch.finish !== undefined ? patch.finish : t.finish || '' };
  if ((next.start || '') === (t.start || '') && (next.finish || '') === (t.finish || '')) { renderNow(); return false; }
  if (isDate(next.start) && isDate(next.finish) && next.finish < next.start) { toast('Финиш не может быть раньше старта.', true); renderNow(); return false; }
  const history = Array.isArray(t.history) ? [...t.history] : [];
  if (isDate(t.finish) && isDate(next.finish) && t.finish !== next.finish) {
    const r = await askShiftReason(t, t.finish, next.finish, followers);
    if (!r) { renderNow(); return false; }
    const now = new Date();
    history.push({ ts: now.toISOString(), date: todayStr(now), type: 'finish', from: t.finish, to: next.finish, reason: r.reason, note: r.note });
    // 4.1.1 (57): the cards waiting for this one move with it, each with the same reason in its history.
    if (followers?.size && r.follow) {
      const ops = [op.update('tasks', id, { ...next, history })];
      for (const [fid, x] of followers) {
        const f = state.tasks.get(fid);
        if (!f) continue;
        ops.push(op.update('tasks', fid, { start: x.start, finish: x.finish, history: [...(f.history || []), { ts: now.toISOString(), date: todayStr(now), type: 'finish', from: f.finish, to: x.finish, reason: r.reason, note: `вслед за «${marksText(t)}»${r.note ? ' · ' + r.note : ''}` }] }));
      }
      return write(ops, `${marksText(t)} и ещё ${followers.size}: сроки перенесены`);
    }
  }
  return write(op.update('tasks', id, { ...next, history }), `${marksText(t)}: ${fmtDate(next.start)} → ${fmtDate(next.finish)}`);
}

/* ---------- 4.1: right click on a card (Kanban, Gantt, lists): the usual actions without opening it ---------- */
const nextWorkDay = iso => { let d = addDays(iso, 1); for (let i = 0; i < 20 && L.Cal.dayInfo(d).off; i++) d = addDays(d, 1); return d; };
function cardMenuHtml(t) {
  const item = (act, label, extra = '') => `<button role="menuitem" type="button" data-act="${act}" data-id="${esc(t.id)}"${extra}>${label}</button>`;
  const quick = quickKeys(t.status).map(k => item('cm-quick', QUICK[k].label, ` data-q="${k}"`)).join('');
  const editor = A.canEditTaskFields(state.me);
  const p = projectOf(t), chat = p && A.canChat?.(state.me, p);
  return `<div class="cm-h"><b>${esc(marksText(t))}</b><span class="hint">${esc(p?.name || '')}</span></div>
    ${item('open-task', 'Открыть карточку')}${quick}
    ${['in_progress', 'revision'].includes(t.status) ? item(focus?.taskId === t.id ? 'focus-stop' : 'focus-start', focus?.taskId === t.id ? 'Остановить фокус' : '▶ Фокус — таймер работы') : ''}
    ${editor && isDate(t.finish) ? item('cm-plus1', `Срок +1 рабочий день <span class="hint">→ ${fmtDate(nextWorkDay(t.finish))}</span>`) : ''}
    ${editor ? item('cm-assign', 'Назначить исполнителя…') : ''}
    ${chat ? item('cm-chat', 'Обсудить в чате проекта') : ''}
    ${item('cm-copy', 'Копировать название')}
    ${p && canDetach() ? item('cm-window', 'Проект в отдельном окне') : ''}`;
}
function openCardMenu(t, x, y) {
  closeCardMenu();
  const m = document.createElement('div');
  m.className = 'menu card-menu'; m.id = 'card-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = cardMenuHtml(t);
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 6))}px`;
  m.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 6))}px`;
  m.querySelector('button')?.focus();
}
function closeCardMenu() { document.getElementById('card-menu')?.remove(); }
document.addEventListener('contextmenu', e => {
  const el = e.target.closest?.('[data-act="open-task"][data-id], tr[data-id]');
  const t = el && state.tasks.get(el.dataset.id);
  if (!t || e.target.closest('input, textarea, select, .drawer')) return;
  e.preventDefault(); track('act:card-menu');
  openCardMenu(t, e.clientX, e.clientY);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#card-menu')) closeCardMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('card-menu')) { e.stopPropagation(); closeCardMenu(); } }, true);
window.addEventListener('blur', closeCardMenu);
async function cardMenuAct(act, t, el) {
  closeCardMenu();
  if (act === 'cm-quick') {
    if (el.dataset.q === 'submit' && isSpec()) { openTask(t.id); return; } // a specialist describes what was done
    await changeStatus(t.id, QUICK[el.dataset.q].to, 'из меню карточки');
    focusAfterQuick(t.id, el.dataset.q);
  } else if (act === 'cm-plus1') await commitDates(t.id, { finish: nextWorkDay(t.finish) });
  else if (act === 'cm-assign') openTask(t.id, {}, 'main');
  else if (act === 'cm-chat') { const id = projectChatId(t.projectId); msg.drafts[id] = `${msg.drafts[id] ? msg.drafts[id] + '\n' : ''}По карточке «${marksText(t)}» (${projectOf(t)?.name || ''}): `; msgOpen(id); }
  else if (act === 'cm-copy') { try { await navigator.clipboard.writeText(`${marksText(t)} · ${projectOf(t)?.name || ''}${projectOf(t)?.code ? ' (' + projectOf(t).code + ')' : ''}`); toast('Название скопировано'); } catch { toast('Не удалось скопировать.', true); } }
  else if (act === 'cm-window') detachDoc('project', t.projectId);
}

let openTimer = null; // a single click on an editable cell waits briefly in case it becomes a double click
function startCellEdit(td) {
  track('edit:cell');
  const id = td.closest('tr')?.dataset.id, field = td.dataset.edit, t = state.tasks.get(id);
  if (!t) return;
  const inputs = {
    // Only the actions this status allows (as the buttons in the card): «В работе» → «Сдал на проверку»…
    status: () => `<select class="cell-in"><option value="${t.status}" selected>${esc(STATUSES[t.status]?.label || '')}</option>${quickKeys(t.status).map(k => `<option value="${QUICK[k].to}">→ ${esc(QUICK[k].label)}</option>`).join('')}</select>`,
    contractor: () => `<select class="cell-in">${contractorOptions(sectionsOf(t), t.contractorId || '')}</select>`,
    start: () => `<input class="cell-in" type="date" value="${esc(t.start || '')}">`,
    finish: () => `<input class="cell-in" type="date" value="${esc(t.finish || '')}">`,
    ready: () => `<input class="cell-in" type="number" min="${L.READY_MIN}" max="${L.READY_MAX}" step="5" value="${L.readiness(t)}">`,
    owner: () => `<select class="cell-in">${ownerOptions(t.ownerId || '', sectionsOf(t))}</select>`,
    budget: () => `<input class="cell-in" inputmode="decimal" value="${t.budget ? esc(String(t.budget).replace('.', ',')) : ''}">`,
  };
  if (!inputs[field]) return;
  td.innerHTML = `<div class="cell-edit">${inputs[field]()}</div>`;
  const el = td.querySelector('.cell-in');
  el.focus();
  if (el.select && field === 'budget') el.select();
  let done = false;
  const finish = commit => { if (done) return; done = true; if (commit) commitCell(id, field, el.value); else renderNow(); };
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  });
  if (el.tagName === 'SELECT') el.addEventListener('change', () => finish(true));
  el.addEventListener('blur', () => finish(true));
}
async function commitCell(id, field, value) {
  const t = state.tasks.get(id);
  if (!t) return;
  if (field === 'status') return value !== t.status ? changeStatus(id, value, 'изменено в таблице') : renderNow();
  if (field === 'contractor') {
    if ((t.contractorId || '') === value) return renderNow();
    if (value && misfitText(t, 'contractor', value)) { renderNow(); return reassign(id, 'contractor', t.contractorId || '', value); }
    const c = state.contractors.get(value);
    return write(op.update('tasks', id, { contractorId: value, ...(value ? { execUserId: '' } : {}) }), `${marksText(t)}: ${c ? c.name : 'подрядчик снят'}`);
  }
  if (field === 'ready') {
    const n = Math.round(Number(String(value).replace(',', '.')));
    if (!Number.isFinite(n) || n < L.READY_MIN || n > L.READY_MAX) { toast(`Готовность в работе — от ${L.READY_MIN} до ${L.READY_MAX} %. 90 % ставится сдачей на проверку, 100 % — приёмкой.`, true); return renderNow(); }
    if (n === L.readiness(t) && t.readiness) return renderNow();
    return write(op.update('tasks', id, { readiness: n }), `${marksText(t)}: готовность ${n} %`);
  }
  if (field === 'owner') {
    if ((t.ownerId || '') === value || !value) return renderNow();
    if (misfitText(t, 'staff', value)) { renderNow(); return reassign(id, 'staff', t.ownerId || '', value); }
    const u = state.users.get(value);
    return write(op.update('tasks', id, { ownerId: value }), `${marksText(t)}: ответственный ${u ? u.name : ''}`);
  }
  if (field === 'start' || field === 'finish') return commitDates(id, { [field]: value });
  if (field === 'budget') {
    const n = parseMoney(value);
    if (Number.isNaN(n)) { toast('Бюджет — неотрицательное число, например 150000 или 150 000,50.', true); return renderNow(); }
    if (n === budgetOf(t)) return renderNow();
    return write(op.update('tasks', id, { budget: n }), `${marksText(t)}: бюджет ${money(n)}`);
  }
}

/* ---------- card tables: columns can be hidden and reordered («⚙ Столбцы») ---------- */
const COLS = [
  { id: 'project', label: 'Проект' }, { id: 'marks', label: 'Разделы', fixed: true }, { id: 'owner', label: 'Ответственный' },
  { id: 'contractor', label: 'Исполнитель' }, { id: 'start', label: 'Старт' }, { id: 'finish', label: 'Финиш' }, { id: 'status', label: 'Статус' }, { id: 'ready', label: 'Готовность' },
  { id: 'budget', label: 'Бюджет', money: true }, { id: 'paid', label: 'Оплачено', money: true }, { id: 'rest', label: 'Остаток', money: true },
];
let colPrefs = { order: COLS.map(c => c.id), hidden: [], ...loadLocal('cols', {}) };
function colOrder() {
  const known = new Set(COLS.map(c => c.id));
  const order = colPrefs.order.filter(id => known.has(id));
  for (const c of COLS) if (!order.includes(c.id)) order.push(c.id);
  return order.map(id => COLS.find(c => c.id === id));
}
function setColPrefs(patch) { colPrefs = { ...colPrefs, ...patch }; saveLocal('cols', colPrefs); renderNow(); }

function colsMenu() {
  return `<div class="menu-wrap cols-wrap"><button class="btn ghostbtn sm" type="button" data-act="cols-pop" title="Какие столбцы показывать и в каком порядке. Порядок можно менять и перетаскиванием заголовков">⚙ Столбцы</button>
    <div class="menu cols-menu"${colsOpen ? '' : ' hidden'}><p class="hint">Галка — показывать. Стрелки или перетаскивание заголовка таблицы — порядок.</p>${colRowsHtml()}</div></div>`;
}
function colRowsHtml() {
  return `${colOrder().filter(c => (!c.money || canMoney()) && (c.id !== 'owner' || !isSpec())).map((c, i, all) => `<div class="cols-row">
      <label class="chk"><input type="checkbox" data-act="col-toggle" data-id="${c.id}"${colPrefs.hidden.includes(c.id) ? '' : ' checked'}${c.fixed ? ' disabled' : ''}> ${c.label}${c.money ? ' <span class="hint">₽</span>' : ''}</label>
      <span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="col-move" data-id="${c.id}" data-dir="-1"${i ? '' : ' disabled'} title="Выше">↑</button><button class="btn ghostbtn sm" type="button" data-act="col-move" data-id="${c.id}" data-dir="1"${i < all.length - 1 ? '' : ' disabled'} title="Ниже">↓</button></div>`).join('')}
      <button class="btn ghostbtn sm" type="button" data-act="cols-reset">Как было</button>`;
}
function moveCol(id, dir) {
  const order = colOrder().map(c => c.id), i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setColPrefs({ order });
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'sort': ({ el }) => { toggleSort(el.dataset.key); },
  'open-task': ({ e, el, id }) => {
    closeCardMenu();
    // On an editable table cell wait a moment: a second click turns this into inline editing.
    if (el.matches('tr.row') && e.target.closest('td[data-edit]')) {
      clearTimeout(openTimer);
      openTimer = setTimeout(() => openTask(id), 260);
      return;
    }
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    openTask(id);
  },
  'col-move': ({ el }) => { moveCol(el.dataset.id, Number(el.dataset.dir)); },
  'cols-reset': () => { setColPrefs({ order: COLS.map(c => c.id), hidden: [] }); },
  'cm-quick': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-plus1': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-assign': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-chat': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-copy': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-window': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
});
/* ---------- «Настройки»: one window for everything about the look ---------- */
function openSettings(sec = '') {
  setViewMenu(false);
  let root = document.querySelector('.settings-modal');
  if (!root) {
    root = document.createElement('div');
    root.className = 'modal-back settings-modal';
    root.innerHTML = `<div class="modal wide-modal settings" role="dialog" aria-modal="true" aria-labelledby="stitle"><h2 id="stitle">Настройки</h2><div id="set-body"></div>
      <div class="modal-f"><button class="btn primary" type="button" data-m="close">Готово</button><span class="hint">Настройки вида хранятся на этом компьютере.</span></div></div>`;
    document.body.append(root);
    root.addEventListener('click', e => {
      if (e.target === root || e.target.dataset.m === 'close') { root.remove(); return; }
      setTimeout(renderSettings, 30); // after the global handler applied the change
    });
    root.addEventListener('change', () => setTimeout(renderSettings, 30));
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  }
  renderSettings();
  if (sec) root.querySelector(`[data-sec-id="${sec}"]`)?.scrollIntoView({ block: 'start' });
}
function renderSettings() {
  const body = $('#set-body');
  if (!body) return;
  const top = body.scrollTop;
  const tabs = visibleTabs();
  body.innerHTML = `<section class="set-sec" data-sec-id="view"><h3>Вид и окно</h3>${viewSectionsHtml(true)}<p class="hint">Прозрачность, «поверх окон» и сквозные клики — в меню «Окно» в заголовке.</p></section>
    <section class="set-sec" data-sec-id="tabs"><h3>Порядок вкладок</h3><p class="hint">Вкладки можно и просто перетащить мышью на панели.</p>${tabs.map((x, i) => `<div class="cols-row"><span>${icon(x.id)} ${esc(x.label)}</span><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="-1"${i ? '' : ' disabled'}>↑</button><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="1"${i < tabs.length - 1 ? '' : ' disabled'}>↓</button></div>`).join('')}
      <button class="btn ghostbtn sm" type="button" data-act="tabs-reset">Как было</button></section>
    <section class="set-sec" data-sec-id="game"><h3>Поощрения</h3><p class="hint">«Принято с первого раза», общая цель проекта и «Спасибо» в обсуждении. Считаются качество и общий результат, а не количество карточек.</p>
      <div class="seg"><button class="btn sm ${game ? 'on' : ''}" type="button" data-act="set-game" data-v="1">Показывать</button><button class="btn sm ${game ? '' : 'on'}" type="button" data-act="set-game" data-v="0">Выключить</button></div></section>
    <section class="set-sec" data-sec-id="ov"><h3>Панели сводки</h3>${ovRowsHtml()}</section>
    ${cab?.allowed ? `<section class="set-sec" data-sec-id="cab"><h3>Кабинет заказчика</h3><p class="hint">${cab.local ? '' : cab.configured ? `Подключён: ${esc(cab.url)}${cab.lastSync ? ` · связь ${cabTime(cab.lastSync)}` : ''}${cab.lastError ? ` · <span class="neg">${esc(cab.lastError)}</span>` : ''}` : cab.keyLost ? `<span class="neg">Адрес сервера ${esc(cab.url)} сохранён, а ключ команды из прошлой версии не переносится — откройте настройку кабинета и введите ключ заново.</span>` : 'Не подключён. Заказчик сможет смотреть свой проект в браузере или на телефоне.'}</p>
      ${cab.local ? `<p class="hint">Работает на этом компьютере · для заказчиков в офисе: ${esc(cab.publicUrl)}</p><button class="btn sm" type="button" data-act="cab-local-stop">Остановить</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>`
        : cab.configured ? '<button class="btn sm" type="button" data-act="cab-settings">Изменить подключение…</button>'
        : '<button class="btn primary sm" type="button" data-act="cab-local-start">Запустить на этом компьютере</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>'}</section>` : ''}
    ${isSpec() ? '' : `<section class="set-sec" data-sec-id="cols"><h3>Столбцы в таблицах карточек</h3>${colRowsHtml()}</section>`}
    ${tipsClosed.size ? `<section class="set-sec"><h3>Подсказки</h3><p class="hint">Скрыто подсказок: ${tipsClosed.size}.</p><button class="btn ghostbtn sm" type="button" data-act="tips-reset">Показать снова</button></section>` : ''}`;
  body.scrollTop = top;
}
// «⚙ Столбцы» opens right next to the table; headers can also be dragged to a new place.
let colsOpen = false;
// Header drag: drop a column onto another header to put it there.
let colDrag = null;
document.addEventListener('dragstart', e => {
  const th = e.target.closest?.('th[data-col]');
  if (!th) return;
  colDrag = th.dataset.col;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'col:' + colDrag);
  th.classList.add('dragging');
});
document.addEventListener('dragover', e => {
  if (!colDrag) return;
  const th = e.target.closest?.('th[data-col]');
  $$('th.drop-ok').forEach(x => { if (x !== th) x.classList.remove('drop-ok'); });
  if (!th || th.dataset.col === colDrag) return;
  e.preventDefault();
  th.classList.add('drop-ok');
});
document.addEventListener('drop', e => {
  if (!colDrag) return;
  const th = e.target.closest?.('th[data-col]'), from = colDrag;
  colDrag = null;
  if (!th || th.dataset.col === from) return;
  e.preventDefault();
  const all = colOrder().map(c => c.id), fi = all.indexOf(from), ti = all.indexOf(th.dataset.col);
  all.splice(fi, 1);
  all.splice(all.indexOf(th.dataset.col) + (fi < ti ? 1 : 0), 0, from);
  setColPrefs({ order: all });
});
document.addEventListener('dragend', () => { colDrag = null; $$('th.dragging, th.drop-ok').forEach(x => x.classList.remove('dragging', 'drop-ok')); });


// Cards whose responsible person has no direction for some of the marks (e.g. directions were changed later).
// Per responsible person whose directions don't cover the card's marks: [{ user, gaps, text }].
const gapsOf = t => A.ownersOf(t).map(id => state.users?.get(id)).filter(Boolean)
  .map(user => ({ user, gaps: A.profileGaps(user, t) })).filter(x => x.gaps.length)
  .map(x => ({ ...x, text: A.profileMessage(x.user, x.gaps) }));
// Confirmed («всё равно назначить») cards are not repeated as warnings in the overview.
const offProfile = list => list.filter(t => t.status !== 'done' && !t.profileOk && gapsOf(t).length);
const sideProfile = t => {
  const g = gapsOf(t)[0];
  return `<div class="due bad">${esc(g.gaps.map(x => x.mark).join(', '))} — не по профилю</div><div class="hint">${esc(g.user.name)}: нет «${esc([...new Set(g.gaps.map(x => x.direction.label))].join(', '))}»</div>`;
};
const sideMilestone = t => {
  const m = L.milestonesOf(t, state.today).overdue[0];
  return `<div class="due bad">КТ «${esc(m.title || 'без названия')}»</div><div class="num hint">сорвана на ${dayNum(state.today) - dayNum(m.date)} дн.</div>`;
};
const sidePay = t => {
  const pp = L.paymentPlan(t, state.today);
  const docs = [!t.invoiceReceived ? 'счёт не получен' : '', t.status === 'done' && !t.actSigned ? 'акт не подписан' : ''].filter(Boolean).join(' · ');
  return `<div class="due warn num">${money(pp.dueNow)}</div><div class="hint">${esc(docs || 'документы в порядке')}</div>`;
};
const sideNoAct = t => `<div class="due warn">акт не подписан</div><div class="num hint">принято ${fmtDate(L.reviewStats(t, state.today).accepted)}</div>`;
const lastSubmit = t => [...(t.comments || [])].reverse().find(c => c.kind === 'submit');
const sideReview = t => {
  const rs = L.reviewStats(t, state.today), rep = lastSubmit(t);
  return `<div class="due">на проверке${rs.stageSince ? ` ${dayNum(state.today) - dayNum(rs.stageSince)} дн.` : ''}</div><div class="num hint">${rs.rounds ? `круг замечаний ${rs.rounds + 1}` : 'первая сдача'}</div>`
    + (rep ? `<div class="hint rep-line" title="${esc(rep.text)}">${esc(rep.user)}: ${esc(rep.text)}</div>` : '');
};
const sideNew = t => {
  const c = (t.comments || []).at(-1);
  const fresh = c && c.ts > (t.seen?.[state.me?.id] || '') && c.userId !== state.me?.id;
  return fresh ? `<div class="due work">${c.kind === 'submit' ? 'сдано на проверку' : 'комментарий'}</div><div class="hint rep-line">${esc(c.user)}: ${esc(c.text)}</div>`
    : '<div class="due work">поручено вам</div><div class="hint">откройте карточку</div>';
};
const sideAbsence = t => {
  const h = absHits(t)[0];
  return `<div class="due ${h.onFinish ? 'bad' : 'warn'}">${h.onFinish ? 'финиш во время отсутствия' : 'отсутствие в период работы'}</div><div class="hint">${esc(A.absenceText(h))}</div>`;
};
const sideQuiet = t => {
  const d = dayNum(state.today) - dayNum(A.lastActivity(t).slice(0, 10));
  return `<div class="due warn">тишина ${days(d)}</div><div class="hint">последнее: ${fmtDate(A.lastActivity(t).slice(0, 10))}</div>`;
};
function quietSelect() {
  const opt = n => `<option value="${n}"${n === quietDays ? ' selected' : ''}>${n} дн.</option>`;
  return `<label class="hint quiet-sel">без изменений от <select id="quiet-days">${[3, 5, 7, 10, 14, 21].map(opt).join('')}</select></label>`;
}

const sideBlocked = t => {
  const i = L.dependencyIssues(t, state.tasks, state.today)[0];
  return `<div class="due bad">ждёт ${esc(sectionsOf(i.pred).join(', '))}</div><div class="hint">${i.kind === 'overdue' ? 'смежник сорвал срок' : `смежник до ${fmtDate(i.pred.finish)}`}</div>`;
};
// The attention lists feed the header counters, the overview and filters — compute once per data/date change.
let attCache = null;
const attention = () => {
  if (attCache && attCache.tasks === state.tasks && attCache.projects === state.projects && attCache.today === state.today) return attCache.v;
  attCache = { tasks: state.tasks, projects: state.projects, today: state.today, v: L.attention(tasksArr(), state.today) };
  return attCache.v;
};

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'tips-reset': () => { tipsClosed.clear(); saveLocal('tipsClosed', []); renderNow(); },
  'cols-pop': ({ el }) => { colsOpen = !colsOpen; el.closest('.cols-wrap').querySelector('.cols-menu').hidden = !colsOpen; },
  'settings': ({ el }) => { openSettings(el.dataset.sec); },
  'set-backdrop': ({ el }) => { api.setBackdrop?.(el.dataset.v).then(ok => { if (ok === false) toast('Этот фон Windows здесь недоступен — осталась своя прозрачность.', true); }); },
  'set-dock': ({ el }) => { api.setDock?.(el.dataset.v); },
  'nav-pos': ({ el }) => { setNav({ pos: el.dataset.v }); },
  'nav-mini': () => { setNav({ mini: !nav.mini }); },
  'nav-mini-chk': ({ el }) => { setNav({ mini: el.checked }); },
  'set-theme': ({ el }) => { api.setTheme(el.dataset.v); },
});
/* ---------- 4.1.1: «Мой день» (item 48) — what is mine today, per role; every row is a button ---------- */
const inScope = t => A.isGip(state.me) || hasOwner(t, state.me?.id) || executorOf(t)?.u?.id === state.me?.id || A.isChief(state.me);
function myCards() { const me = state.me?.id; return tasksArr().filter(t => ACTIVE.has(t.status) && (t.ownerId === me || executorOf(t)?.u?.id === me || hasOwner(t, me))); }
function dayDocs() {
  const out = [];
  for (const p of liveProjects()) for (const d of p.docs || []) {
    if (!isDate(d.until)) continue;
    const left = dayNum(d.until) - dayNum(state.today);
    if (left <= (d.remind ?? 60)) out.push({ p, d, left });
  }
  return out.sort((a, b) => a.left - b.left);
}
function idlePeople() {
  if (isSpec()) return [];
  const busy = new Set(tasksArr().filter(t => ACTIVE.has(t.status)).flatMap(t => [t.ownerId, ...(t.coOwnerIds || []), executorOf(t)?.u?.id]).filter(Boolean));
  const scope = A.isGip(state.me) ? liveUsers().filter(u => u.role !== 'gip') : liveUsers().filter(u => u.chiefId === state.me?.id);
  return scope.filter(u => !busy.has(u.id) && !A.absencesOf(u).some(x => x.from <= state.today && x.to >= state.today)).sort(byName);
}
function viewDay() {
  if (isEmpty()) return emptyState();
  const a = attention(), me = state.me, spec = isSpec();
  const hour = new Date().getHours(), hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const mine = myCards(), notStarted = mine.filter(t => t.status === 'not_started'), working = mine.filter(t => ['in_progress', 'revision'].includes(t.status));
  const review = spec ? [] : a.review, overdue = spec ? mine.filter(t => timing(t).overdue) : a.overdue;
  const week = (spec ? mine : a.week).filter(t => !timing(t).overdue && isDate(t.finish) && dayNum(t.finish) - dayNum(state.today) <= 7);
  const unread = [...state.chats.values()].reduce((n, c) => n + msgUnread(c).length, 0);
  const idle = idlePeople(), docs = spec ? [] : dayDocs();
  const kpi = (label, n, tone, act, extra = '') => `<button class="kpi day-kpi" type="button"${act}><span class="hint">${label}</span><b class="num kv-${n ? tone : 'idle'}">${n}</b>${extra}</button>`;
  const kpis = spec
    ? kpi('Мои карточки', mine.length, 'work', ' data-act="tab" data-id="kanban"') + kpi('Срок на неделе', week.length, 'warn', ' data-act="att-go" data-v="att:week"') + kpi('Срок сорван', overdue.length, 'bad', ' data-act="att-go" data-v="overdue"') + kpi('Новые сообщения', unread, 'work', ' data-act="msg-open-any"')
    : kpi('Ждёт моей проверки', review.length, 'review', review.length ? ' data-act="review-queue"' : '') + kpi('Срок сорван', overdue.length, 'bad', ' data-act="att-go" data-v="overdue"') + kpi('Новые сообщения', unread, 'work', ' data-act="msg-open-any"') + kpi('Без работы', idle.length, 'warn', ' data-act="tab" data-id="people"', idle.length ? `<span class="hint">${esc(idle.slice(0, 2).map(u => u.name).join(', '))}${idle.length > 2 ? '…' : ''}</span>` : '');
  const row = (tag, tone, t, btn = '') => `<div class="day-row"><span class="chip tone-${tone}">${tag}</span><button class="linkbtn day-t" type="button" data-act="open-task" data-id="${esc(t.id)}">${marksHtml(t)} ${esc(projectOf(t)?.name || '')}<span class="hint"> — ${esc(executorOf(t)?.name || 'нет исполнителя')}</span></button><span class="spacer"></span>${btn}</div>`;
  const first = [
    ...overdue.slice(0, 6).map(t => row(isDate(t.finish) ? `сорван ${dayNum(state.today) - dayNum(t.finish)} дн.` : 'срок сорван', 'bad', t)),
    ...(review.length ? [`<div class="day-row"><span class="chip tone-review">на проверке</span><span>${review.length} ${plural(review.length, 'карточка ждёт', 'карточки ждут', 'карточек ждут')} вашего решения</span><span class="spacer"></span><button class="btn primary sm" type="button" data-act="review-queue">Проверить ${review.length > 1 ? 'все ' + review.length : ''}</button></div>`] : []),
    ...week.slice(0, 6).map(t => row(`срок ${fmtDate(t.finish).slice(0, 5)}`, 'warn', t)),
    ...docs.slice(0, 4).map(({ p, d, left }) => `<div class="day-row"><span class="chip tone-${left < 0 ? 'bad' : 'warn'}">${left < 0 ? 'документ истёк' : `истекает через ${left} дн.`}</span><button class="linkbtn day-t" type="button" data-act="goto-project" data-id="${esc(p.id)}">${esc(d.title)}<span class="hint"> — ${esc(p.name)}</span></button></div>`),
  ];
  const todo = [
    ...working.map(t => row(STATUSES[t.status].label.toLowerCase(), 'work', t, `<button class="btn sm${focus?.taskId === t.id ? ' on' : ''}" type="button" data-act="${focus?.taskId === t.id ? 'focus-stop' : 'focus-start'}" data-id="${esc(t.id)}">${focus?.taskId === t.id ? 'Пауза' : '▶ Фокус'}</button>`)),
    ...notStarted.map(t => row('не начат', 'idle', t, `<button class="btn primary sm" type="button" data-act="cm-quick" data-q="start" data-id="${esc(t.id)}">▶ Начать</button>`)),
  ];
  return `<section class="day"><div class="day-h"><h2>${hello}${me?.name ? ', ' + esc(me.name.split(' ').slice(1).join(' ') || me.name) : ''}</h2><span class="hint">${esc(new Date(state.today + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
    <div class="day-kpis">${kpis}</div>
    <div class="day-cols"><section class="panel"><div class="panel-h"><h3>Сначала это</h3></div><div class="day-list">${first.join('') || '<p class="hint day-empty">Ничего срочного — всё по плану.</p>'}</div></section>
      <section class="panel"><div class="panel-h"><h3>Мои карточки</h3><span class="meta">${mine.length}</span></div><div class="day-list">${todo.join('') || `<p class="hint day-empty">${spec ? 'Карточек пока нет — их выдаёт главспец или ГИП.' : 'Лично на вас карточек нет.'}</p>`}</div></section></div></section>`;
}

// What waits for the user right now: to check, overdue of mine (or all, for GIP/chief), unread mentions.
function badgeCount() {
  const a = attention(), spec = isSpec();
  const overdue = spec ? myCards().filter(t => timing(t).overdue).length : a.overdue.length;
  const mentions = [...state.chats.values()].reduce((n, c) => n + msgMentions(c).length, 0);
  return (spec ? 0 : a.review.length) + overdue + mentions;
}
/* ---------- 4.1.1: the «Сегодня» panel from the tray (item 35): what is urgent, without opening the whole Пульт ---------- */
function viewTrayPanel() {
  if (!state.me) return '<div class="hint tp-empty">Откройте Пульт и выберите пользователя.</div>';
  const a = attention(), mine = myCards(), spec = isSpec();
  const review = spec ? [] : a.review, overdue = spec ? mine.filter(t => timing(t).overdue) : a.overdue;
  const soon = (spec ? mine : a.week).filter(t => !timing(t).overdue && isDate(t.finish) && dayNum(t.finish) - dayNum(state.today) <= 3);
  const unread = [...state.chats.values()].reduce((n, c) => n + msgUnread(c).length, 0);
  const row = (t, tone, side) => `<button class="tp-row" type="button" data-act="tp-task" data-id="${esc(t.id)}"><span class="chip tone-${tone}">${side}</span><span class="tp-t">${marksHtml(t)} ${esc(projectOf(t)?.name || '')}</span></button>`;
  const notStarted = mine.filter(t => t.status === 'not_started').slice(0, 3);
  const sec = (title, html) => (html ? `<section class="tp-sec"><h4>${title}</h4>${html}</section>` : '');
  const body = sec('Срок сорван', overdue.slice(0, 5).map(t => row(t, 'bad', isDate(t.finish) ? `−${dayNum(state.today) - dayNum(t.finish)} дн.` : 'сорван')).join(''))
    + sec('Ждут проверки', review.slice(0, 5).map(t => row(t, 'review', 'проверить')).join(''))
    + sec('Срок в ближайшие 3 дня', soon.slice(0, 5).map(t => row(t, 'warn', fmtDate(t.finish).slice(0, 5))).join(''))
    + sec('Можно начать', notStarted.map(t => `<div class="tp-row tp-start">${marksHtml(t)} <span class="tp-t">${esc(projectOf(t)?.name || '')}</span><button class="btn primary sm" type="button" data-act="cm-quick" data-q="start" data-id="${esc(t.id)}">▶ Начать</button></div>`).join(''));
  return `<div class="tp"><div class="tp-h drag"><b>Сегодня</b><span class="hint">${esc(new Date(state.today + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }))}</span><span class="spacer"></span>
      ${unread ? `<button class="chip tone-work" type="button" data-act="tp-main" data-v="msg">сообщения ${unread}</button>` : ''}</div>
    <div class="tp-body">${body || '<p class="hint tp-empty">Ничего срочного — всё по плану.</p>'}</div>
    <div class="tp-f"><button class="btn primary" type="button" data-act="tp-main" data-v="open">Открыть Пульт</button><button class="btn" type="button" data-act="tp-main" data-v="day">Мой день</button></div></div>`;
}

/* ---------- 4.1.1: review queue (item 49) — the cards waiting for my decision, one after another ---------- */
let rq = null; // { ids, i }
function openReviewQueue() {
  const ids = attention().review.map(t => t.id);
  if (!ids.length) return toast('На проверке ничего нет.');
  rq = { ids, i: 0 };
  renderReviewQueue();
}
function closeReviewQueue() { rq = null; $('#rq-root')?.remove(); renderNow(); }
function renderReviewQueue() {
  let root = $('#rq-root');
  rq.ids = rq.ids.filter(id => state.tasks.get(id)?.status === 'review');
  if (!rq.ids.length) { root?.remove(); rq = null; toast('Очередь проверки пуста — всё разобрано.'); renderNow(); return; }
  rq.i = Math.max(0, Math.min(rq.i, rq.ids.length - 1));
  const t = state.tasks.get(rq.ids[rq.i]), p = projectOf(t);
  const sub = [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'review');
  const files = [...(t.history || [])].reverse().flatMap(h => h.files || []).slice(0, 6);
  if (!root) { root = document.createElement('div'); root.id = 'rq-root'; root.className = 'modal-back'; document.body.append(root); }
  root.innerHTML = `<div class="modal rq" role="dialog" aria-modal="true" aria-labelledby="rq-t">
    <div class="rq-h"><h2 id="rq-t">Проверка <b class="num">${rq.i + 1} из ${rq.ids.length}</b></h2><span class="spacer"></span><span class="hint">← → листать · A принять · R вернуть · Esc закрыть</span><button class="btn ghostbtn sm" type="button" data-rq="close" aria-label="Закрыть">✕</button></div>
    <div class="rq-bar"><i style="width:${Math.round(((rq.i + 1) / rq.ids.length) * 100)}%"></i></div>
    <div class="rq-body"><div><div class="rq-title">${marksHtml(t)} <b>${esc(p?.name || '')}</b>${t.title ? ` · ${esc(t.title)}` : ''}</div>
      <div class="hint">${esc(executorOf(t)?.name || 'нет исполнителя')} · сдано ${sub ? fmtDate(sub.date || sub.ts.slice(0, 10)) : '—'} · срок ${fmtDate(t.finish)}${timing(t).overdue ? ' · <span class="neg">срок сорван</span>' : ''}</div>
      <div class="lbl">Что сделано</div><div class="rq-note">${sub?.note ? esc(sub.note) : '<span class="hint">Без описания.</span>'}</div>
      ${files.length ? `<div class="lbl">Файлы</div><div class="hint">${files.map(f => esc(f.name || f)).join(' · ')}</div>` : ''}
      <button class="linkbtn" type="button" data-rq="open">Открыть карточку целиком</button></div>
      <div><label class="lbl" for="rq-note">Замечания (обязательно, если вернуть)</label><textarea id="rq-note" rows="7" maxlength="1500" placeholder="Что исправить…"></textarea></div></div>
    <div class="modal-f"><button class="btn primary rq-ok" type="button" data-rq="accept">✓ Принять <span class="kbd">A</span></button><button class="btn" type="button" data-rq="remarks">↩ Вернуть с замечаниями <span class="kbd">R</span></button><span class="spacer"></span>
      <button class="btn ghostbtn" type="button" data-rq="prev"${rq.i ? '' : ' disabled'}>←</button><button class="btn" type="button" data-rq="next">${rq.i < rq.ids.length - 1 ? 'Пропустить →' : 'Готово'}</button></div></div>`;
  root.querySelector('[data-rq="accept"]').focus();
}
async function rqAct(a) {
  if (!rq) return;
  const t = state.tasks.get(rq.ids[rq.i]);
  if (a === 'close') return closeReviewQueue();
  if (a === 'open') { const id = t.id; closeReviewQueue(); return openTask(id); }
  if (a === 'prev') { rq.i--; return renderReviewQueue(); }
  if (a === 'next') { if (rq.i >= rq.ids.length - 1) return closeReviewQueue(); rq.i++; return renderReviewQueue(); }
  if (a === 'accept') { await changeStatus(t.id, QUICK.accept.to, 'принято в очереди проверки'); return renderReviewQueue(); }
  if (a === 'remarks') {
    const note = $('#rq-note').value.trim();
    if (!note) { const n = $('#rq-note'); n.classList.add('field-bad'); n.focus(); toast('Напишите, что исправить, — без замечаний вернуть нельзя.', true); return; }
    await changeStatus(t.id, QUICK.remarks.to, note);
    return renderReviewQueue();
  }
}
document.addEventListener('click', e => { const b = e.target.closest?.('#rq-root [data-rq]'); if (b && !b.disabled) rqAct(b.dataset.rq); else if (e.target.id === 'rq-root') closeReviewQueue(); });
document.addEventListener('keydown', e => {
  if (!rq || !$('#rq-root')) return;
  const typing = e.target.matches?.('textarea, input');
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeReviewQueue(); }
  else if (typing) return;
  else if (e.key === 'ArrowRight') { e.preventDefault(); rqAct('next'); }
  else if (e.key === 'ArrowLeft' && rq.i) { e.preventDefault(); rqAct('prev'); }
  else if (e.key === 'a' || e.key === 'ф' || e.key === 'A' || e.key === 'Ф') { e.preventDefault(); rqAct('accept'); }
  else if (e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К') { e.preventDefault(); $('#rq-note')?.focus(); }
}, true);

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'review-queue': () => { openReviewQueue(); },
  'tp-task': ({ el, id }) => { api.windowMain?.({ kind: 'task', id: el.dataset.id }); api.hide?.(); },
  'tp-main': ({ el, id }) => { const c = [...state.chats.values()].find(x => msgUnread(x).length); api.windowMain?.(el.dataset.v === 'msg' && c ? { kind: 'chat', id: c.id } : { kind: 'main', id: el.dataset.v === 'day' ? 'day' : 'open' }); api.hide?.(); },
});
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
/* ---------- project page: summary, participants, tasks grouped by the composition ---------- */
// Every switched-on section of the composition is a task. Missing tasks are made when the project is saved;
// an existing card of the project with the same mark (or the same title) is linked instead of a duplicate.
// With the tech card on (comp.links), assignments between sections become subtasks of the source section's task
// (seen in the recipient's task as incoming); forward assignments hold the recipient's start («начать после»).
// New tasks get preliminary dates from the stage windows (phases П and Р) split into waves.
function compTaskOps(comp, projectId, code, phases = state.draft?.phases || state.projects.get(projectId)?.phases || []) {
  if (!comp) return { ops: [], created: 0, linked: 0, assigns: 0 };
  const pTasks = [...state.tasks.values()].filter(t => t.projectId === projectId);
  const used = new Set([...(comp.nodes || []).map(n => n.taskId), ...(comp.rd || []).map(x => x.taskId)].filter(id => id && state.tasks.has(id)));
  const free = () => pTasks.filter(t => !used.has(t.id) && t.kind !== 'assign');
  const same = (t, marks) => sectionsOf(t).join(',').toUpperCase() === normalizeMarks(marks).join(',').toUpperCase();
  const now = new Date().toISOString(), today = todayStr(), ops = [], fresh = new Map(); // id → data of tasks made here
  const phase = k => phases.find(ph => ph.key === k) || {};
  const win = { pd: [phase('p').start, phase('p').finish], rd: [phase('r').start, phase('r').finish] };
  let created = 0, linked = 0, assigns = 0;
  const ensure = (ref, marks, title, note, stage, key) => {
    if (ref.taskId && state.tasks.has(ref.taskId)) return;
    // Exact marks first, then a card that carries this mark among others («ЭОМ, ЭО» → ЭОМ), then the same title.
    const want = normalizeMarks(marks).map(m => m.toUpperCase());
    const match = free().find(t => same(t, marks)) || free().find(t => want.length === 1 && sectionsOf(t).some(m => m.toUpperCase() === want[0]))
      || free().find(t => (t.title || '').trim() && t.title.trim() === title.trim());
    if (match) { ref.taskId = match.id; used.add(match.id); linked++; return; }
    const sections = normalizeMarks(marks);
    const ownerId = ref.ownerId || state.me?.id || '';
    const tid = newId();
    const dates = Techcard.waveDates(Techcard.waveOf(key), ...win[stage]);
    ref.taskId = tid; used.add(tid); created++;
    const data = { projectId, sections, section: sections.join(', '), title, contractorId: ref.contractorId || '', start: dates?.start || today, finish: dates?.finish || '', status: 'not_started', budget: 0,
      note, ownerId, coOwnerIds: [], profileOk: A.profileGaps(state.users.get(ownerId), { sections }).length > 0, milestones: [], plan: [], payments: [], dependsOn: [],
      history: [{ ts: now, date: today, type: 'status', from: null, to: 'not_started', note: 'из состава проекта' }], createdAt: now };
    fresh.set(tid, data);
    ops.push(op.set('tasks', tid, data));
  };
  const vols = Composition.volumes(comp, code), rds = Composition.rdRows(comp, code);
  for (const v of vols) ensure(comp.nodes.find(n => n.id === v.id), v.node.marks?.length ? v.node.marks : [v.abbr], v.title, `${v.code} · том ${v.tom}`, 'pd', v.key);
  for (const r of rds) ensure(r.item, [r.mark], r.title, `${r.code} · том ${r.tom} (РД)`, 'rd', r.key);

  // Assignments by the tech card, per stage: groups of tasks by tech-card key.
  const taskOf = id => fresh.get(id) || state.tasks.get(id);
  const haveKey = new Set(pTasks.filter(t => t.kind === 'assign' && !t.deletedAt).map(t => t.assignKey));
  const deps = new Map(); // task id → assignment ids to wait for
  const stageAssign = (stage, groups, labelOf) => {
    for (const pr of Techcard.pairs([...groups.keys()])) {
      const akey = `${stage}:${pr.from}>${pr.to}`;
      if (haveKey.has(akey)) continue;
      const src = groups.get(pr.from)[0], dst = groups.get(pr.to);
      const parent = taskOf(src);
      if (!parent) continue;
      const due = Techcard.assignDue(Techcard.waveOf(pr.from), Techcard.waveOf(pr.to), ...win[stage]);
      const tid = newId(), sections = sectionsOf(parent);
      ops.push(op.set('tasks', tid, { projectId, kind: 'assign', parentId: src, toTaskIds: dst, assignKey: akey, sections, section: sections.join(', '),
        title: `Задание ${labelOf(pr.from)} → ${labelOf(pr.to)}`, note: pr.what, contractorId: '', start: due?.start || today, finish: due?.finish || '', status: 'not_started', budget: 0,
        ownerId: parent.ownerId || state.me?.id || '', coOwnerIds: [], profileOk: true, milestones: [], plan: [], payments: [], dependsOn: [], official: false, officialNo: '', officialBy: '',
        history: [{ ts: now, date: today, type: 'status', from: null, to: 'not_started', note: 'задание по техкарте' }], createdAt: now }));
      assigns++;
      if (pr.forward) for (const d of dst) { if (!deps.has(d)) deps.set(d, new Set()); deps.get(d).add(tid); }
    }
  };
  const group = (list, keyOf, idOf) => { const m = new Map(); for (const x of list) { const k = keyOf(x), id = idOf(x); if (!k || !id) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(id); } return m; };
  if (comp.links?.pd !== false) {
    const g = group(vols, v => v.key, v => comp.nodes.find(n => n.id === v.id)?.taskId);
    stageAssign('pd', g, k => k.replace(/^ИОС(\d)$/, 'ИОС $1'));
  }
  if (comp.links?.rd !== false) {
    const g = group(rds, r => r.key, r => r.item.taskId);
    const marksOfKey = new Map([...group(rds, r => r.key, r => r.mark)].map(([k, ms]) => [k, ms.slice(0, 3).join(', ') + (ms.length > 3 ? '…' : '')]));
    stageAssign('rd', g, k => marksOfKey.get(k) || k);
  }
  for (const [tid, add] of deps) {
    const t = taskOf(tid);
    if (!t) continue;
    const next = [...new Set([...(t.dependsOn || []), ...add])];
    if (fresh.has(tid)) fresh.get(tid).dependsOn = next;
    else ops.push(op.update('tasks', tid, { dependsOn: next }));
  }
  return { ops, created, linked, assigns };
}
// Assignments around a task: outgoing (subtasks of this task) and incoming (addressed to it).
function assignsOf(t) {
  if (!t) return { out: [], inc: [] };
  const list = [...state.tasks.values()].filter(x => x.kind === 'assign' && !x.deletedAt && x.projectId === t.projectId);
  return { out: list.filter(x => x.parentId === t.id), inc: list.filter(x => (x.toTaskIds || []).includes(t.id)) };
}

function openProjectPage(id) {
  noteRecent('project', id);
  if (SOLO) { if (id !== SOLO.id) api.windowMain?.({ kind: 'project', id }); return; } // other projects open in the main window
  docTabAdd(id);
  state.openProjectId = id;
  if (state.tab !== 'projects') state.tab = 'projects';
  render();
  const app = $('#app'); if (app) app.scrollTop = 0;
}
async function setMembers(p, ids, msg) {
  await write(op.update('projects', p.id, { members: [...new Set(ids)] }), msg);
}
// One line of the tree: a heading (section with nested parts) or a task row.
function ptTaskCells(t) {
  if (!t) return '<td colspan="4" class="hint">задача появится после сохранения состава</td>';
  const owner = state.users.get(t.ownerId), c = t.contractorId && state.contractors.get(t.contractorId);
  return `<td>${esc(owner?.name || '—')}${c ? `<br><span class="hint">${esc(c.name)}</span>` : ''}</td><td class="nowrap${timing(t).overdue ? ' neg' : ''}">${t.finish ? fmtDate(t.finish) : '<span class="hint">срок не задан</span>'}</td><td>${readyHtml(t)}</td><td>${statusChip(t)}</td>`;
}
function ptProgress(tasks) {
  if (!tasks.length) return '';
  const done = tasks.filter(t => t.status === 'done').length, late = tasks.filter(t => timing(t).overdue).length;
  return `<span class="pt-agg" title="Сдано задач из всех"><span class="rd-bar"><i style="width:${Math.round((done / tasks.length) * 100)}%"></i></span>сдано ${done} из ${tasks.length}${late ? ` · <span class="neg">сорвано ${late}</span>` : ''}</span>`;
}
function ptRow({ depth, label, title, code, task, heading, agg }) {
  const attrs = task ? ` class="row pt-task" data-act="open-task" data-id="${esc(task.id)}" tabindex="0"` : ` class="pt-head lvl${depth}"`;
  return `<tr${attrs}><td><div class="pt-name" style="--d:${depth}">${label ? `<span class="comp-k">${esc(label)}</span>` : ''}<span>${esc(title)}</span></div></td><td class="mono nowrap">${esc(code || '')}</td>${heading ? `<td colspan="4">${agg || ''}</td>` : ptTaskCells(task)}</tr>${task ? ptAssignRows(task, depth + 1) : ''}`;
}
// Assignments of a section task, under it: a folded summary line, opened — outgoing (subtasks) and incoming.
function ptAssignRows(t, depth) {
  const { out, inc } = assignsOf(t);
  if (!out.length && !inc.length) return '';
  const key = 'pao:' + t.id, open = isFolded(key); // stored as «opened»: assignments are folded by default
  const done = l => l.filter(x => x.status === 'done').length;
  const late = [...out, ...inc].filter(x => timing(x).overdue).length;
  const sum = `<tr class="pt-asg-sum"><td colspan="6"><div class="pt-name" style="--d:${depth}"><button class="tree-tg" type="button" data-act="fold" data-key="${esc(key)}" aria-expanded="${open}">${open ? '▾' : '▸'}</button>
    <span class="hint">Задания смежникам: ${out.length ? `исходящих ${out.length} (выдано ${done(out)})` : 'исходящих нет'} · ${inc.length ? `входящих ${inc.length} (получено ${done(inc)})` : 'входящих нет'}${late ? ` · <span class="neg">сорвано ${late}</span>` : ''}</span></div></td></tr>`;
  if (!open) return sum;
  const row = (x, dir) => `<tr class="row pt-task pt-asg" data-act="open-task" data-id="${esc(x.id)}" tabindex="0"><td><div class="pt-name" style="--d:${depth}"><span class="chip ${dir === 'out' ? 'tone-work' : 'tone-idle'} asg-dir">${dir === 'out' ? 'исх.' : 'вх.'}</span><span>${esc(x.title)}</span></div></td><td class="hint">${x.official ? `офиц.${x.officialNo ? ' № ' + esc(x.officialNo) : ''}` : ''}</td>${ptTaskCells(x)}</tr>`;
  return sum + out.map(x => row(x, 'out')).join('') + inc.map(x => row(x, 'in')).join('');
}
function ptBlock(key, title, count, body, extra = '') {
  const fold = isFolded(key);
  return `<section class="panel pt-block${fold ? ' folded' : ''}"><div class="panel-h">${foldBtn(key, fold)}<h3>${esc(title)}</h3>${count}<span class="spacer"></span>${extra}</div>${fold ? '' : body}</section>`;
}
function viewProjectPage(p) {
  const code = p.code || '', comp = p.composition;
  const tasks = [...state.tasks.values()].filter(t => t.projectId === p.id);
  const byId = id => (id ? state.tasks.get(id) : null);
  const linked = new Set();
  // Project documentation: the tree exactly as in the composition (Раздел 5 → ИОС1…6 → книги → части).
  let pdHtml = '';
  if (comp) {
    const rows = Composition.rowsFor(comp, code).filter(r => !r.disabled);
    const vols = new Set(Composition.volumes(comp, code).map(v => v.id));
    const under = id => { const out = []; const rec = pid => rows.filter(r => r.node.parentId === pid).forEach(r => { if (vols.has(r.node.id)) { const t = byId(r.node.taskId); if (t) out.push(t); } rec(r.node.id); }); rec(id); return out; };
    const html = rows.map(r => {
      const n = r.node, no = n.kind === 'section' ? (n.num ?? r.idx[0]) : r.idx.at(-1), label = `${Composition.KINDS[n.kind]} ${no}`;
      if (vols.has(n.id)) { const t = byId(n.taskId); if (t) linked.add(t.id); return ptRow({ depth: r.depth, label, title: n.title, code: r.code, task: t }); }
      return ptRow({ depth: r.depth, label, title: n.title, code: '', heading: true, agg: ptProgress(under(n.id)) });
    });
    const all = [...vols].map(id => byId(comp.nodes.find(n => n.id === id)?.taskId)).filter(Boolean);
    pdHtml = ptBlock('pp:' + p.id, 'Проектная документация', ptProgress(all), ptTable(html));
  }
  // Working documentation: grouped by the section of the project documentation it belongs to.
  let rdHtml = '';
  const rd = comp ? Composition.rdRows(comp, code) : [];
  if (rd.length) {
    const groups = new Map();
    for (const r of rd) { const k = r.item.pdId || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const html = [], all = [];
    for (const [pdId, list] of groups) {
      const n = pdId && comp.nodes.find(x => x.id === pdId);
      const ts = list.map(r => byId(r.item.taskId)).filter(Boolean);
      all.push(...ts);
      html.push(ptRow({ depth: 0, label: n ? n.abbr : '', title: n ? n.title : 'Прочие комплекты', heading: true, agg: ptProgress(ts) }));
      for (const r of list) { const t = byId(r.item.taskId); if (t) linked.add(t.id); html.push(ptRow({ depth: 1, label: r.mark, title: r.title, code: r.code, task: t })); }
    }
    rdHtml = ptBlock('pr:' + p.id, 'Рабочая документация', ptProgress(all), ptTable(html));
  }
  // Assignments live under their sections (and under recipients), not among the other tasks.
  const other = tasks.filter(t => !linked.has(t.id) && !(t.kind === 'assign' && state.tasks.has(t.parentId))).sort(sortByDeadline);
  const otherHtml = ptBlock('po:' + p.id, 'Прочие задачи', `<span class="meta">${other.length}</span>`,
    taskTable(other, { showProject: false, empty: 'Задачи вне состава проекта: согласования, изыскания, сбор исходных данных…', limitKey: 'po:' + p.id }),
    p.archived ? '' : `<button class="btn sm" type="button" data-act="new-task" data-project="${esc(p.id)}">+ задача</button>`);

  // Summary.
  const x = totals(tasks), now = L.projectNow(p, state.today);
  const reqOpen = (p.requests || []).filter(r => !r.done);
  const tile = (num, label, tone = '') => `<div class="pt-kpi${tone ? ' ' + tone : ''}"><b>${num}</b><span>${label}</span></div>`;
  const summary = `<section class="panel pt-sum"><div class="pt-kpis">
      ${tile(`${x.done} из ${x.count}`, 'задач сдано')}
      ${tile(taskCounts(tasks).idle, 'не начато')}
      ${tile(taskCounts(tasks).work, 'в работе')}
      ${tile(x.review, 'на проверке')}
      ${tile(x.overdue, 'сорвано сроков', x.overdue ? 'bad' : '')}
      ${now.current ? tile(esc(L.phaseLabel(now.current.key)), now.behind ? `текущий этап · отставание ${now.behind} дн.` : 'текущий этап', now.behind ? 'bad' : '') : ''}
      ${now.next ? tile(now.daysToNext != null ? `${now.daysToNext} дн.` : '—', `до вехи «${esc(now.next.title)}»`) : ''}
      ${reqOpen.length ? tile(reqOpen.length, 'ждём от заказчика', 'warn') : ''}
      ${forecastTile(tasks, tile)}
      ${canMoney() ? tile(money(x.rest), 'остаток к оплате') : ''}
    </div>${goalHtml(tasks)}</section>`;

  // Participants: who works on the project (the future project chat is made from them).
  const members = memberIds(p);
  const inTasks = [...new Set(tasks.flatMap(t => [t.ownerId, ...(t.coOwnerIds || [])]))].filter(id => id && state.users.has(id) && !members.includes(id));
  const canEdit = A.canManageCatalog(state.me);
  const roleOf = u => A.ROLES[u.role]?.label || '';
  const addable = liveUsers().filter(u => !members.includes(u.id)).sort(byName);
  const people = `<section class="panel pt-people"><div class="panel-h"><h3>Участники</h3><span class="meta">${members.length}</span><span class="spacer"></span><span class="hint">из них будет собран чат проекта</span></div>
    <div class="pt-members">${members.map(id => { const u = state.users.get(id); return `<span class="pt-member"><span class="pt-ava">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b><br><span class="hint">${esc(roleOf(u))}${p.contactId === id ? ' · контакт для заказчика' : ''}</span></span>${canEdit ? `<button class="btn ghostbtn sm" type="button" data-act="member-del" data-id="${esc(id)}" aria-label="Убрать из проекта">✕</button>` : ''}</span>`; }).join('') || '<span class="hint">Пока никого. Добавьте тех, кто так или иначе задействован в проекте.</span>'}</div>
    ${canEdit ? `<div class="row-in pt-add"><select id="pt-member"><option value="">— добавить участника —</option>${addable.map(u => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(roleOf(u))}</option>`).join('')}</select><button class="btn sm" type="button" data-act="member-add">Добавить</button>
      ${inTasks.length ? `<span class="hint">Работают в задачах, но не в участниках: ${inTasks.map(id => esc(state.users.get(id).name)).join(', ')}</span><button class="btn ghostbtn sm" type="button" data-act="member-add-tasks">Добавить их</button>` : ''}</div>` : ''}</section>`;

  const head = `<div class="pt-top">${SOLO ? '' : '<button class="btn ghostbtn sm" type="button" data-act="project-back">← Все проекты</button>'}
    ${projIcon(p).replace('proj-ic', 'proj-ic big')}<h2>${esc(p.name)}</h2>${p.archived ? '<span class="chip tone-idle">в архиве</span>' : projectStageChip(p)}${code ? `<span class="pcode mono">${esc(code)}</span>` : ''}${p.client ? `<span class="meta">${esc(p.client)}</span>` : ''}${projectGip(p) ? `<span class="meta">ГИП: ${esc(projectGip(p).name)}</span>` : ''}
    <span class="spacer"></span>${winBtn('project', p.id)}
    ${p.folder ? `<button class="btn ghostbtn sm" data-act="open-folder" data-id="${esc(p.id)}" type="button" title="${esc(p.folder)}">Папка проекта</button>` : ''}
    <button class="btn ghostbtn sm" type="button" data-act="techcard" title="Этапы, волны, задания смежникам">Техкарта</button>
    ${canEdit ? `<button class="btn sm" type="button" data-act="project-timeline" data-id="${esc(p.id)}">Сроки</button><button class="btn sm" type="button" data-act="assign-board" data-id="${esc(p.id)}">Назначить исполнителей</button><button class="btn sm" type="button" data-act="ask-customer" data-id="${esc(p.id)}" title="ТУ, письма, согласования, решения — заказчик увидит в «Нужно от вас»">Запросить у заказчика</button>${A.canChat(state.me, p) ? (() => { const c = chatById(projectChatId(p.id)), n = c ? msgUnread(c).length : 0; return `<button class="btn sm" type="button" data-act="msg-project" data-id="${esc(p.id)}">Чат проекта${n ? ` <span class="cnt bad">${n}</span>` : ''}</button>`; })() : ''}<button class="btn sm" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="comp">Состав проекта</button><button class="btn sm" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="cust">Для заказчика</button><button class="btn sm" type="button" data-act="open-project" data-id="${esc(p.id)}">Изменить</button>` : ''}</div>`;
  const noComp = !comp ? `<section class="panel"><div class="empty-in"><p>Состав проекта ещё не сформирован. Генератор предложит разделы по ПП РФ № 87 и рабочую документацию к ним; каждый раздел станет задачей.</p>${canEdit ? `<button class="btn primary" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="comp">Открыть генератор состава</button>` : ''}</div></section>` : '';
  return `<div class="pt-page">${head}${summary}${people}${noComp}${pdHtml}${rdHtml}${otherHtml}${irdBlock(p)}${surveysBlock(p)}${lettersBlock(p)}</div>`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'project-page': ({ id }) => { openProjectPage(id); },
  'project-back': () => { state.openProjectId = null; render(); },
  'member-add': () => { const p = state.projects.get(state.openProjectId), uid = $('#pt-member')?.value; if (p && uid) setMembers(p, [...memberIds(p), uid], `${state.users.get(uid)?.name} — в участниках проекта`); },
  'member-del': ({ id }) => { const p = state.projects.get(state.openProjectId); if (p) setMembers(p, memberIds(p).filter(x => x !== id), 'Убран из участников'); },
  'member-add-tasks': () => { const p = state.projects.get(state.openProjectId); if (p) { const tasks = [...state.tasks.values()].filter(t => t.projectId === p.id); setMembers(p, [...memberIds(p), ...tasks.flatMap(t => [t.ownerId, ...(t.coOwnerIds || [])]).filter(x => x && state.users.has(x))], 'Участники добавлены'); } },
});
/* ---------- bookmarks and separate windows (4.0) ---------- */
// A separate window shows one project or one chat: «?w=project:<id>» / «?w=chat:<key>». It runs this same
// interface over the main window's data (the bridge forwards every call there) and shows only that page.
const SOLO = (() => {
  try {
    const v = new URLSearchParams(location.search).get('w') || '', i = v.indexOf(':');
    return i > 0 && ['project', 'chat', 'tray'].includes(v.slice(0, i)) && v.length > i + 1 ? { kind: v.slice(0, i), id: v.slice(i + 1) } : null;
  } catch { return null; }
})();
// Only where the app can open windows (the Tauri version); the Electron preload has no windowOpen.
const canDetach = () => !SOLO && typeof api.windowOpen === 'function';
// Projects opened in the main window stay as tabs above the page, like in a browser: × closes, the middle mouse
// button too, dragging a tab out of the window (or ⧉) moves the project into its own window.
const DOC_TABS_MAX = 12;
let docTabs = (v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x).slice(-DOC_TABS_MAX) : []))(loadLocal('docTabs', []));
const saveDocTabs = () => saveLocal('docTabs', docTabs);
function docTabAdd(id) {
  if (docTabs.includes(id)) return;
  docTabs.push(id);
  if (docTabs.length > DOC_TABS_MAX) docTabs = docTabs.filter(x => x === state.openProjectId || x === id).concat(docTabs.filter(x => x !== state.openProjectId && x !== id).slice(-(DOC_TABS_MAX - 2)));
  saveDocTabs();
}
function docTabClose(id) {
  const i = docTabs.indexOf(id);
  if (i < 0) return;
  docTabs.splice(i, 1);
  saveDocTabs();
  delete wsFilters[id]; if (wsActive === id) wsActive = ''; saveWs();
  if (state.openProjectId === id) { const next = docTabs.slice(0, i + 1).reverse().find(k => wsKind(k) === 'project') || docTabs.find(k => wsKind(k) === 'project'); state.openProjectId = next || null; }
  render(); renderMsg();
}
/* ---------- 13: tabs like a browser's, for the whole program ---------- */
// The strip holds projects (plain id, as before), sections «tab:<section>» (several of one section: «tab:tasks~2»,
// each with its own filters) and chats «chat:<id>». Middle click or Ctrl+click on a section opens it as a tab;
// «＋» opens the current view once more; Ctrl+Tab / Ctrl+Shift+Tab go round, Ctrl+W closes.
const wsKind = k => (k.startsWith('tab:') ? 'tab' : k.startsWith('chat:') ? 'chat' : 'project');
const wsSection = k => k.slice(4).split('~')[0];
let wsActive = loadLocal('wsActive', '');
let wsFilters = loadLocal('wsFilters', {});
const saveWs = () => { saveLocal('wsActive', wsActive); saveLocal('wsFilters', wsFilters); };
// Which strip tab the screen shows now.
function wsCurrent() {
  if (state.tab === 'projects' && state.openProjectId && docTabs.includes(state.openProjectId)) return state.openProjectId;
  if (wsActive && wsKind(wsActive) === 'tab' && docTabs.includes(wsActive) && wsSection(wsActive) === state.tab && !(state.tab === 'projects' && state.openProjectId)) return wsActive;
  return '';
}
function wsRemember() {
  const cur = wsCurrent();
  if (cur && wsKind(cur) === 'tab') wsFilters[cur] = { ...state.filters };
}
function wsOpen(key) {
  if (!docTabs.includes(key)) return;
  wsRemember();
  const k = wsKind(key);
  if (k === 'chat') { msgOpen(key.slice(5)); return; }
  scrollPos[state.tab] = $('#app').scrollTop;
  if (k === 'project') { openProjectPage(key); wsActive = key; saveWs(); return; }
  const sec = wsSection(key);
  if (!visibleTabs().some(t => t.id === sec)) return toast('Этот раздел вам сейчас недоступен.', true);
  state.tab = sec; saveLocal('tab', sec);
  if (sec === 'projects') state.openProjectId = null;
  if (wsFilters[key]) state.filters = { ...EMPTY_FILTERS, ...wsFilters[key] };
  wsActive = key; saveWs();
  renderNow(); restoreScroll();
}
function wsAddSection(sec, focus = true) {
  if (!visibleTabs().some(t => t.id === sec)) return;
  wsRemember();
  let key = `tab:${sec}`, n = 1;
  while (docTabs.includes(key)) key = `tab:${sec}~${++n}`;
  docTabs.push(key);
  if (docTabs.length > DOC_TABS_MAX) docTabs.splice(docTabs.findIndex(x => x !== key && x !== wsCurrent()), 1);
  wsFilters[key] = sec === state.tab ? { ...state.filters } : { ...EMPTY_FILTERS };
  saveDocTabs(); saveWs();
  if (focus) wsOpen(key); else render();
}
function wsAddChat(chatId) {
  const key = `chat:${chatId}`;
  if (!docTabs.includes(key)) { docTabs.push(key); if (docTabs.length > DOC_TABS_MAX) docTabs.shift(); saveDocTabs(); }
  render(); renderMsg();
  toast('Чат — во вкладке сверху');
}
function wsCycle(dir) {
  if (!docTabs.length) return;
  const cur = wsCurrent() || (msg.mode !== 'pill' && msg.chatId ? `chat:${msg.chatId}` : '');
  const i = docTabs.indexOf(cur);
  wsOpen(docTabs[(i + dir + docTabs.length) % docTabs.length]);
}
function wsLabel(key) {
  const k = wsKind(key);
  if (k === 'project') { const p = state.projects.get(key); return p && !p.deletedAt ? { ico: projIcon(p), code: p.code, name: p.name, title: p.name } : null; }
  if (k === 'chat') { const id = key.slice(5), c = chatById(id); return c ? { ico: chatIcon(c), name: chatTitle(c), title: `Чат: ${chatTitle(c)}` } : null; }
  const sec = wsSection(key), t = TABS.find(x => x.id === sec);
  if (!t || !visibleTabs().some(x => x.id === sec)) return null;
  const f = wsFilters[key], nf = f ? Object.entries(f).filter(([fk, v]) => v && v !== EMPTY_FILTERS[fk]).length : 0;
  return { ico: icon(sec), name: t.label, extra: nf ? `<span class="hint">· фильтр ${nf}</span>` : '', title: `${t.label}${nf ? ' — со своими фильтрами' : ''}` };
}
function docTabsHtml() {
  if (SOLO || state.win.compact) return '';
  const tabs = docTabs.map(k => [k, wsLabel(k)]).filter(([, l]) => l);
  if (!tabs.length) return '';
  const dt = canDetach(), cur = wsCurrent(), chatOn = msg.mode !== 'pill' && msg.chatId ? `chat:${msg.chatId}` : '';
  const home = state.tab === 'projects' ? `<button class="dtab home${state.openProjectId ? '' : ' on'}" type="button" role="tab" aria-selected="${!state.openProjectId}" data-act="project-back">${icon('projects')}<span>Все проекты</span></button>` : '';
  return `<div class="doc-tabs" role="tablist" aria-label="Открытые вкладки">${home}${tabs.map(([k, l]) => {
    const kind = wsKind(k), on = k === cur || k === chatOn, id = kind === 'chat' ? k.slice(5) : k;
    const open = kind === 'project' ? `data-act="project-page" data-id="${esc(k)}"` : `data-act="ws-open" data-key="${esc(k)}"`;
    const det = dt && kind !== 'tab' ? `<button class="dt-btn" type="button" data-act="win-detach" data-kind="${kind}" data-id="${esc(id)}" title="Открыть в отдельном окне" aria-label="Открыть в отдельном окне">${icon('detach')}</button>` : '';
    return `<div class="dtab${on ? ' on' : ''} ws-${kind}" role="tab" aria-selected="${on}" draggable="true" data-doc="${kind}" data-doc-id="${esc(k)}" title="${esc(l.title)}${dt && kind !== 'tab' ? ' — перетащите за пределы окна, чтобы открыть отдельно' : ''}"><button class="dt-open" type="button" ${open}>${l.ico || ''}${l.code ? `<span class="mono">${esc(l.code)}</span>` : ''}<span class="dt-name">${esc(l.name)}</span>${l.extra || ''}</button>${det}<button class="dt-btn" type="button" data-act="dtab-close" data-id="${esc(k)}" title="Закрыть вкладку (средняя кнопка мыши, Ctrl+W)" aria-label="Закрыть вкладку">×</button></div>`;
  }).join('')}<button class="dtab ws-plus" type="button" data-act="ws-plus" title="Открыть этот раздел ещё одной вкладкой — со своими фильтрами (или щёлкните по разделу средней кнопкой мыши)" aria-label="Новая вкладка">＋</button></div>`;
}
const threadTitle = key => msgThreads().find(t => t.key === key)?.title || 'Чат';
// Moves a project or a chat into its own window; `at` — the screen point where a dragged tab was dropped.
async function detachDoc(kind, id, at) {
  if (!canDetach() || !id) return;
  const title = kind === 'project' ? (state.projects.get(id)?.name || 'Проект') : threadTitle(id);
  const r = await api.windowOpen({ kind, id, title, ...(at && Number.isFinite(at.x) ? { x: at.x, y: at.y } : {}) });
  if (!r?.ok) return toast(r?.message || 'Не удалось открыть отдельное окно.', true);
  if (kind === 'project') {
    const i = docTabs.indexOf(id);
    if (i >= 0) { docTabs.splice(i, 1); saveDocTabs(); }
    if (state.openProjectId === id) state.openProjectId = null;
    render();
  } else if (msg.chatId === id) { msg.chatId = ''; renderMsg(); }
}
// Buttons in a page head: «в отдельное окно» here, «в главное окно» inside a separate window.
const winBtn = (kind, id) => (SOLO ? `<button class="btn ghostbtn sm" type="button" data-act="win-dock" title="Закрыть это окно и открыть здесь же в главном">${icon('dock')} В главное окно</button>`
  : canDetach() ? `<button class="btn ghostbtn sm" type="button" data-act="win-detach" data-kind="${kind}" data-id="${esc(id)}" title="Открыть в отдельном окне — удобно держать рядом несколько проектов и чатов">${icon('detach')}</button>` : '');
// Dragging: a project tab onto another one changes the order; a tab or a chat dropped outside the window opens
// it in its own window.
let docDrag = null;
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('[data-doc]');
  if (!el) return;
  docDrag = { kind: el.dataset.doc, id: el.dataset.docId };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', el.title || el.textContent.trim());
});
document.addEventListener('dragover', e => {
  if (!docDrag || !docTabs.includes(docDrag.id)) return;
  const t = e.target.closest?.('.dtab[data-doc]');
  if (t && t.dataset.docId !== docDrag.id) e.preventDefault();
});
document.addEventListener('drop', e => {
  const d = docDrag, t = e.target.closest?.('.dtab[data-doc]');
  if (!d || !docTabs.includes(d.id) || !t || t.dataset.docId === d.id) return;
  e.preventDefault();
  docTabs = docTabs.filter(x => x !== d.id);
  docTabs.splice(docTabs.indexOf(t.dataset.docId), 0, d.id);
  saveDocTabs();
  render();
});
document.addEventListener('dragend', e => {
  const d = docDrag;
  docDrag = null;
  if (!d) return;
  const outside = e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight;
  const stripId = docTabs.includes(d.id) ? (d.kind === 'chat' ? d.id.slice(5) : d.id) : d.id;
  if (outside && e.dataTransfer?.dropEffect === 'none' && d.kind !== 'tab') { if (d.kind === 'chat' && docTabs.includes(d.id)) { docTabs = docTabs.filter(x => x !== d.id); saveDocTabs(); } detachDoc(d.kind, stripId, { x: e.screenX, y: e.screenY }); }
});
document.addEventListener('auxclick', e => {
  if (e.button !== 1) return;
  const t = e.target.closest?.('.dtab[data-doc]');
  if (t) { e.preventDefault(); docTabClose(t.dataset.docId); return; }
  // 13: middle click on a section opens it as a tab.
  const s = e.target.closest?.('#tabs .tab[data-id]');
  if (s) { e.preventDefault(); wsAddSection(s.dataset.id); }
});
document.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest?.('#tabs .tab[data-id], .dtab[data-doc]')) e.preventDefault(); }); // no autoscroll
function orderedTabs() {
  const known = TABS.map(x => x.id), order = tabOrder.filter(id => known.includes(id));
  TABS.forEach((x, i) => { if (!order.includes(x.id)) order.splice(Math.min(i, order.length), 0, x.id); });
  return order.map(id => TABS.find(x => x.id === id));
}
function setTabOrder(order) { tabOrder = order; saveLocal('tabOrder', order); renderNow(); if (document.querySelector('.settings-modal')) renderSettings(); }
function moveTab(id, dir) {
  const order = orderedTabs().map(x => x.id), i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setTabOrder(order);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'tab-move': ({ el, id }) => { moveTab(id, Number(el.dataset.dir)); },
  'tabs-reset': () => { setTabOrder([]); },
  'tab': ({ e, id }) => { if (e.ctrlKey) { wsAddSection(id); return; } wsRemember(); wsActive = ''; saveWs(); if (id === 'projects' && state.tab === 'projects') state.openProjectId = null; scrollPos[state.tab] = $('#app').scrollTop; state.tab = id; saveLocal('tab', id); renderNow(); restoreScroll(); },
  'dtab-close': ({ id }) => { docTabClose(id); },
  'ws-open': ({ el }) => { wsOpen(el.dataset.key); },
  'ws-plus': () => { if (state.tab === 'projects' && state.openProjectId) toast('Проект уже во вкладке — откройте другой раздел и нажмите «＋», или щёлкните по разделу средней кнопкой мыши.'); else wsAddSection(state.tab); },
  'ws-chat': ({ id }) => { wsAddChat(id); },
  'win-detach': ({ el, id }) => { detachDoc(el.dataset.kind, id); },
  'win-dock': () => { api.windowDock?.(SOLO); },
});
/* ---------- assigning people by drag and drop (3.6) ---------- */
// People of the project (participants the current user may assign, plus contractors) on the left; sections of the
// composition on the right, grouped like the project page. Drop a person on a section — or on a group heading to
// give the whole group. Nothing is written until «Сохранить»; one batch, main re-checks every change.
function openAssignBoard(pid) {
  const p = state.projects.get(pid);
  if (!p) return;
  const comp = p.composition, code = p.code || '';
  const can = new Set(A.assignableOwners(state.me, liveUsers()).map(u => u.id));
  const people = [...new Set([...memberIds(p), ...(A.isGip(state.me) ? [] : [state.me.id])])].map(id => state.users.get(id)).filter(u => u && can.has(u.id));
  const others = A.assignableOwners(state.me, liveUsers()).filter(u => !people.includes(u)).sort(byName);
  const groups = [];
  const byId = id => (id ? state.tasks.get(id) : null);
  if (comp) {
    const vols = Composition.volumes(comp, code);
    const pd = vols.map(v => byId(comp.nodes.find(n => n.id === v.id)?.taskId)).filter(Boolean);
    if (pd.length) groups.push({ title: 'Проектная документация', tasks: pd });
    const rd = Composition.rdRows(comp, code), byPd = new Map();
    for (const r of rd) { const t = byId(r.item.taskId); if (!t) continue; const k = r.item.pdId || ''; if (!byPd.has(k)) byPd.set(k, []); byPd.get(k).push(t); }
    for (const [k, list] of byPd) { const n = k && comp.nodes.find(x => x.id === k); groups.push({ title: `РД · ${n ? n.abbr : 'прочие'}`, tasks: list }); }
  }
  const inGroups = new Set(groups.flatMap(g => g.tasks.map(t => t.id)));
  const rest = [...state.tasks.values()].filter(t => t.projectId === pid && t.kind !== 'assign' && !inGroups.has(t.id)).sort(sortByDeadline);
  if (rest.length) groups.push({ title: 'Прочие задачи', tasks: rest });
  if (!groups.length) return toast('В проекте пока нет задач — сформируйте состав проекта.');
  const pending = new Map(); // task id → { ownerId?, contractorId? }
  const load = id => [...state.tasks.values()].filter(t => !t.deletedAt && t.status !== 'done' && t.kind !== 'assign' && (pending.get(t.id)?.ownerId ?? t.ownerId) === id).length;
  const root = document.createElement('div');
  root.className = 'modal-back ab-back';
  const nowOf = t => ({ ownerId: pending.get(t.id)?.ownerId ?? t.ownerId, contractorId: pending.get(t.id)?.contractorId ?? t.contractorId });
  const misfit = t => { const u = state.users.get(nowOf(t).ownerId); return u ? A.profileGaps(u, t).length > 0 : false; };
  const label = t => { const pl = compPlaceOf(t); return pl ? `${pl.code.replace(code + '-', '') || marksText(t)} · ${pl.title}` : `${marksText(t)}${t.title && t.title !== marksText(t) ? ' · ' + t.title : ''}`; };
  const chip = (u, kind) => `<div class="ab-person" draggable="true" data-drag="${kind}:${esc(u.id)}" title="${esc(kind === 'u' ? A.profileText(u) : u.specialty || '')}"><span class="pt-ava">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b><br><span class="hint">${kind === 'u' ? `${esc(A.ROLES[u.role]?.label || '')} · в работе ${load(u.id)}` : esc(u.specialty || 'подрядчик')}</span></span></div>`;
  const draw = () => {
    const changed = pending.size, bad = [...pending.keys()].map(id => state.tasks.get(id)).filter(misfit);
    root.innerHTML = `<div class="modal ab-modal" role="dialog" aria-modal="true" aria-labelledby="abtitle"><div class="tc-head"><h2 id="abtitle">Назначение исполнителей · ${esc(p.name)}</h2><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-m="close" aria-label="Закрыть">✕</button></div>
      <p class="hint">Перетащите человека на раздел — или на заголовок группы, чтобы отдать её целиком. Задания смежникам переходят вместе с разделом.</p>
      <div class="ab-grid"><aside class="ab-people"><div class="lbl">Участники проекта</div>${people.map(u => chip(u, 'u')).join('') || '<p class="hint">Участников нет — добавьте на странице проекта.</p>'}
        ${others.length ? `<details><summary class="lbl">Остальные сотрудники (${others.length})</summary>${others.map(u => chip(u, 'u')).join('')}</details>` : ''}
        ${contractorsArr().length ? `<details><summary class="lbl">Подрядчики (${contractorsArr().length})</summary>${contractorsArr().map(c => chip(c, 'c')).join('')}</details>` : ''}</aside>
      <div class="ab-tasks">${groups.map((g, gi) => `<div class="ab-group"><div class="ab-gh" data-drop="g:${gi}">${esc(g.title)} <span class="hint">${g.tasks.length} · сюда — всю группу</span></div>
        ${g.tasks.map(t => { const n = nowOf(t), u = state.users.get(n.ownerId), c = n.contractorId && state.contractors.get(n.contractorId), ch = pending.has(t.id);
          return `<div class="ab-task${ch ? ' changed' : ''}${misfit(t) ? ' misfit' : ''}" data-drop="t:${esc(t.id)}"><span class="ab-name">${esc(label(t))}</span><span class="ab-who">${u ? `<span class="pt-ava sm">${esc(initials(u.name))}</span>${esc(u.name)}` : '<span class="hint">не назначен</span>'}${c ? ` <span class="hint">· ${esc(c.name)}</span>` : ''}${misfit(t) ? ' <span class="chip tone-bad" title="Нет нужного направления">не по профилю</span>' : ''}</span>${ch ? `<button class="btn ghostbtn sm" type="button" data-m="undo" data-id="${esc(t.id)}" title="Вернуть как было">↺</button>` : ''}</div>`; }).join('')}</div>`).join('')}</div></div>
      <div class="modal-f">${bad.length ? `<label class="chk ab-ok"><input type="checkbox" id="ab-force"> Назначить не по профилю (${bad.length})</label>` : ''}<button class="btn primary" type="button" data-m="save"${changed ? '' : ' disabled title="Изменений пока нет — перетащите человека на карточку"'}>Сохранить${changed ? ` (${changed})` : ''}</button><button class="btn" type="button" data-m="close">Отмена</button></div></div>`;
  };
  const give = (t, kind, id) => {
    const cur = pending.get(t.id) || {};
    if (kind === 'u') cur.ownerId = id; else cur.contractorId = id;
    if ((cur.ownerId ?? t.ownerId) === t.ownerId && (cur.contractorId ?? t.contractorId) === t.contractorId) pending.delete(t.id); else pending.set(t.id, cur);
  };
  root.addEventListener('dragstart', e => { const d = e.target.closest('[data-drag]'); if (d) { e.dataTransfer.setData('text/plain', d.dataset.drag); e.dataTransfer.effectAllowed = 'move'; } });
  root.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); root.querySelectorAll('.drop-on').forEach(x => x.classList.remove('drop-on')); z.classList.add('drop-on'); } });
  root.addEventListener('drop', e => {
    const z = e.target.closest('[data-drop]'), v = e.dataTransfer.getData('text/plain');
    if (!z || !/^[uc]:/.test(v)) return;
    e.preventDefault();
    const [kind, id] = [v[0], v.slice(2)], [zk, zid] = [z.dataset.drop[0], z.dataset.drop.slice(2)];
    const list = zk === 'g' ? groups[Number(zid)].tasks : [state.tasks.get(zid)].filter(Boolean);
    for (const t of list) give(t, kind, id);
    draw();
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-m]'), m = b?.dataset.m;
    if (e.target === root || m === 'close') { root.remove(); return; }
    if (m === 'undo') { pending.delete(b.dataset.id); draw(); }
    if (m === 'save') {
      const bad = [...pending.keys()].map(id => state.tasks.get(id)).filter(misfit);
      if (bad.length && !root.querySelector('#ab-force')?.checked) return toast(`Не по профилю: ${bad.map(marksText).join(', ')}. Отметьте «Назначить не по профилю» или выберите другого.`);
      const ops = [];
      for (const [id, ch] of pending) {
        const t = state.tasks.get(id), data = { ...ch };
        if (ch.ownerId !== undefined) {
          data.profileOk = misfit(t);
          // A section's outgoing assignments follow it when they were with the same person.
          for (const a of assignsOf(t).out) if (a.ownerId === t.ownerId) ops.push(op.update('tasks', a.id, { ownerId: ch.ownerId }));
        }
        ops.push(op.update('tasks', id, data));
      }
      if (await write(ops, `Назначено: ${pending.size}`)) root.remove();
    }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  draw();
  document.body.append(root);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'assign-board': ({ id }) => { openAssignBoard(id); },
});
/* ---------- messenger (3.8): a dock at the bottom right, a side panel and a window with every chat ----------
   Project chats (GIP and participants, made with the first message), personal chats and group chats without a
   project. «@Фамилия» marks a colleague: their mention counter lights up separately. Written only by main. */
const msg = { mode: 'pill', chatId: '', filter: 'all', drafts: {}, newKind: '', newPick: new Set(), newTitle: '', ac: null, info: false, stick: !!loadLocal('msgStick', false) };
const projectChatId = pid => ('p_' + pid).slice(0, 64);
const surnameOf = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/)[0] || '';
// Chats this user sees: every project chat they may write in (even without messages yet) and their own chats.
function chatsAll() {
  const out = new Map();
  for (const c of state.chats?.values() || []) out.set(c.id, c);
  for (const p of state.projects.values()) {
    if (p.archived || !A.canChat(state.me, p)) continue;
    const id = projectChatId(p.id);
    if (!out.has(id)) out.set(id, { id, kind: 'project', projectId: p.id, messages: [], seen: {}, virtual: true });
  }
  return [...out.values()].filter(c => c.kind !== 'project' || state.projects.has(c.projectId));
}
const chatById = id => chatsAll().find(c => c.id === id);
function chatTitle(c) {
  if (c.kind === 'project') return state.projects.get(c.projectId)?.name || 'Проект';
  if (c.kind === 'direct') return state.users.get((c.members || []).find(id => id !== state.me?.id))?.name || 'Сотрудник';
  return c.title || 'Чат';
}
function chatPeople(c) {
  if (c.kind === 'project') { const p = state.projects.get(c.projectId) || {}; return liveUsers().filter(u => u.role === 'gip' || (p.members || []).includes(u.id)); }
  return liveUsers().filter(u => (c.members || []).includes(u.id));
}
const msgUnread = c => { const me = state.me?.id, seen = c.seen?.[me] || ''; return (c.messages || []).filter(m => m.userId !== me && m.ts > seen); };
const msgMentions = c => msgUnread(c).filter(m => (m.mentions || []).includes(state.me?.id));
const lastTs = c => (c.messages || []).at(-1)?.ts || '';
function msgTotals() {
  let n = 0, at = 0;
  for (const th of msgThreads()) { n += th.unread; at += th.at; }
  return { n, at };
}
/* Messenger threads. One list for everything that is written to the user: chats (project, personal, group),
   card discussions and messages from customers. Key: a chat id, «t:<task id>» or «c:<project id>». */
const MSG_SECTIONS = [['all', 'Все'], ['cust', 'От заказчиков'], ['proj', 'Проекты'], ['task', 'Задачи'], ['other', 'Прочие'], ['at', '@']];
const taskUnreadN = t => { if (!unread(t)) return 0; const me = state.me?.id, seen = t.seen?.[me] || ''; return Math.max(1, (t.comments || []).filter(c => c.userId !== me && c.ts > seen).length); };
const custMsgs = pid => (cab?.allowed ? cab.messages.filter(m => m.projectId === pid) : []);
function msgThread(key) {
  if (!key || key === 'new') return null;
  if (key.startsWith('t:')) { const t = state.tasks.get(key.slice(2)); return t ? { key, type: 'task', t } : null; }
  if (key.startsWith('c:')) { const pid = key.slice(2), list = custMsgs(pid); return list.length ? { key, type: 'cust', pid, list } : null; }
  const c = chatById(key); return c ? { key, type: 'chat', c } : null;
}
function msgThreads() {
  const me = state.me?.id, out = [];
  for (const c of chatsAll()) {
    const last = (c.messages || []).at(-1);
    out.push({ key: c.id, sec: c.kind === 'project' ? 'proj' : 'other', title: chatTitle(c), icon: chatIcon(c), last: last?.ts || '', unread: msgUnread(c).length, at: msgMentions(c).length,
      prev: last ? `${last.userId === me ? 'Вы' : esc(surnameOf(last.user))}: ${esc(last.text.slice(0, 80))}` : `<span class="hint">${c.kind === 'project' ? 'чат проекта · сообщений нет' : 'сообщений нет'}</span>` });
  }
  for (const t of state.tasks.values()) {
    const last = (t.comments || []).at(-1);
    if (!last) continue;
    out.push({ key: 't:' + t.id, sec: 'task', title: `${marksText(t) || t.title || 'Карточка'} · ${projectOf(t)?.name || ''}`, icon: '<span class="mc-ic task">✎</span>', last: last.ts, unread: taskUnreadN(t), at: 0,
      prev: `${last.userId === me ? 'Вы' : esc(surnameOf(last.user))}: ${esc(String(last.text).slice(0, 80))}` });
  }
  if (cab?.allowed) {
    const byProject = new Map();
    for (const m of cab.messages) { if (!byProject.has(m.projectId)) byProject.set(m.projectId, []); byProject.get(m.projectId).push(m); }
    for (const [pid, list] of byProject) {
      const last = list.reduce((a, b) => (b.ts > a.ts ? b : a));
      const urgent = list.some(m => !m.read && m.kind === 'urgent');
      out.push({ key: 'c:' + pid, sec: 'cust', title: state.projects.get(pid)?.name || last.projectName || 'Проект', icon: `<span class="mc-ic cust${urgent ? ' urgent' : ''}">З</span>`, last: last.ts,
        unread: list.filter(m => !m.read).length, at: 0, urgent, prev: `${esc(last.customerName || 'Заказчик')}: ${esc(CAB_KINDS[last.kind] || '')}${last.text ? ' — ' + esc(last.text.slice(0, 60)) : ''}` });
    }
  }
  return out;
}
// Pinned threads: per user on this computer, shown first in every section.
const msgPins = () => new Set(loadLocal('msgPins:' + (state.me?.id || ''), []));
function msgTogglePin(key) {
  const pins = msgPins();
  if (pins.has(key)) pins.delete(key); else pins.add(key);
  saveLocal('msgPins:' + (state.me?.id || ''), [...pins]);
  renderMsg();
}
const timeOf = ts => (ts.slice(0, 10) === state.today ? ts.slice(11, 16) : fmtDate(ts.slice(0, 10)).slice(0, 5));
// Local time of an ISO stamp (messages are stored in UTC).
const localTs = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
/* ---------- 14: own pictures for projects and chats ---------- */
// Any picture becomes a 64×64 square (cropped to the middle) PNG kept with the project or the chat, so everyone
// sees the same one. A project chat shows its project's picture.
const ICON_OK = v => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length <= 60000;
const imgIcon = (src, cls = '') => `<img class="own-ic ${cls}" src="${esc(src)}" alt="">`;
function pickIcon() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 15 * 1024 * 1024) { toast('Картинка больше 15 МБ — выберите поменьше.', true); return resolve(null); }
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const s = Math.min(img.naturalWidth, img.naturalHeight) || 1;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 64, 64);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/png');
        if (out.length > 60000) out = c.toDataURL('image/jpeg', 0.85);
        resolve(ICON_OK(out) ? out : null);
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Это не картинка, которую можно прочитать.', true); resolve(null); };
      img.src = url;
    };
    inp.click();
  });
}
const projIcon = p => (ICON_OK(p?.icon) ? imgIcon(p.icon, 'proj-ic') : '');
async function setChatIcon(id, pick) {
  const icon = pick ? await pickIcon() : '';
  if (icon === null) return;
  const r = await api.chatUpdate(id, { icon });
  if (!r?.ok) return toast(r?.message || 'Не удалось сохранить значок.', true);
  toast(icon ? 'Значок чата обновлён' : 'Значок чата убран');
  await refresh();
}
// In the project card: the picture goes into the form, saved with «Сохранить» like the other fields.
async function setProjectIconField(pick) {
  const icon = pick ? await pickIcon() : '';
  if (icon === null) return;
  const inp = $('#dform [name="icon"]');
  if (!inp) return;
  inp.value = icon; inp.dispatchEvent(new Event('input', { bubbles: true }));
  const box = $('#pr-icon-box'); if (box) box.innerHTML = icon ? imgIcon(icon, 'proj-ic big') : '<span class="hint">нет</span>';
  $('[data-act="proj-icon-clear"]')?.toggleAttribute('hidden', !icon);
}
const chatIcon = c => {
  const own = c.kind === 'project' ? state.projects.get(c.projectId)?.icon : c.icon;
  if (ICON_OK(own)) return `<span class="mc-ic pic">${imgIcon(own)}</span>`;
  return c.kind === 'project' ? '<span class="mc-ic proj">#</span>' : c.kind === 'direct' ? `<span class="mc-ic ava">${esc(initials(chatTitle(c)))}</span>` : '<span class="mc-ic grp">⁂</span>';
};
// Text with @mentions highlighted (mine stronger).
function msgText(t, c, preview = false) {
  const people = chatPeople(c), meSur = surnameOf(state.me?.name).toLowerCase();
  return cardLinks(esc(t).replace(/@([\p{L}-]+)/gu, (all, w) => { const lw = w.toLowerCase(); const hit = lw === 'все' || people.some(u => surnameOf(u.name).toLowerCase() === lw);
    return hit ? `<b class="mention${lw === meSur || lw === 'все' ? ' me' : ''}">${all}</b>` : all; }), preview);
}
// 12: a card dropped into a chat travels as «[[task:<id>]]»; the reader sees the card and opens it with a click.
// Someone who may not see that card gets «карточка недоступна».
const CARD_TOKEN = /\[\[task:([\w-]{1,64})\]\]/g;
function cardLinks(html, preview = false) {
  return html.replace(CARD_TOKEN, (all, id) => {
    const t = state.tasks.get(id);
    if (!t) return '<span class="msg-card off">карточка недоступна</span>';
    const label = `${marksText(t)} · ${projectOf(t)?.name || ''}`;
    return preview ? `<span class="msg-card">${esc(label)}</span>`
      : `<button class="msg-card" type="button" data-act="open-task" data-id="${esc(id)}" title="Открыть карточку">${icon('tasks')}<span>${esc(label)}</span><span class="hint">${esc(STATUSES[t.status]?.label || '')}</span></button>`;
  });
}
function msgListHtml() {
  const all = msgThreads(), pins = msgPins();
  const sections = MSG_SECTIONS.filter(([k]) => k !== 'cust' || all.some(t => t.sec === 'cust'));
  if (!sections.some(([k]) => k === msg.filter)) msg.filter = 'all';
  const count = k => (k === 'at' ? all.reduce((a, t) => a + t.at, 0) : all.filter(t => k === 'all' || t.sec === k).reduce((a, t) => a + t.unread, 0));
  const tabs = `<div class="mc-tabs" role="tablist">${sections.map(([k, l]) => { const n = count(k); return `<button class="mc-tab${msg.filter === k ? ' on' : ''}" type="button" role="tab" aria-selected="${msg.filter === k}" data-act="msg-filter" data-v="${k}">${l}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>`;
  if (msg.filter === 'at') {
    const hits = chatsAll().flatMap(c => (c.messages || []).filter(m => (m.mentions || []).includes(state.me?.id)).map(m => ({ c, m }))).sort((a, b) => b.m.ts.localeCompare(a.m.ts)).slice(0, 60);
    return tabs + `<div class="mc-list">${hits.map(({ c, m }) => `<button class="mc-item${m.ts > (c.seen?.[state.me.id] || '') ? ' unread' : ''}" type="button" data-act="msg-chat" data-id="${esc(c.id)}">${chatIcon(c)}<span class="mc-body"><span class="mc-top"><b>${esc(chatTitle(c))}</b><span class="hint">${timeOf(localTs(m.ts))}</span></span><span class="mc-prev">${esc(surnameOf(m.user))}: ${msgText(m.text.slice(0, 120), c, true)}</span></span></button>`).join('') || '<p class="hint mc-empty">Вас пока не упоминали.</p>'}</div>`;
  }
  const list = all.filter(t => msg.filter === 'all' || t.sec === msg.filter)
    .sort((a, b) => (b.urgent && b.unread ? 1 : 0) - (a.urgent && a.unread ? 1 : 0) || b.last.localeCompare(a.last) || a.title.localeCompare(b.title, 'ru'));
  const drag = canDetach() ? ' draggable="true" data-doc="chat"' : '';
  const item = t => `<div class="mc-row"><button class="mc-item${t.unread ? ' unread' : ''}${msg.chatId === t.key ? ' sel' : ''}" type="button" data-act="msg-chat" data-id="${esc(t.key)}"${drag}${drag ? ` data-doc-id="${esc(t.key)}" title="${esc(t.title)} — перетащите за пределы окна, чтобы открыть отдельно"` : ''}>${t.icon}<span class="mc-body"><span class="mc-top"><b>${esc(t.title)}</b><span class="hint">${t.last ? timeOf(localTs(t.last)) : ''}</span></span>
      <span class="mc-prev">${t.prev}</span></span>${t.at ? '<i class="mc-at">@</i>' : ''}${t.unread ? `<i class="mc-n${t.urgent ? ' urgent' : ''}">${t.unread}</i>` : ''}</button>
    <button class="mc-pin${pins.has(t.key) ? ' on' : ''}" type="button" data-act="msg-pin" data-id="${esc(t.key)}" aria-pressed="${pins.has(t.key)}" title="${pins.has(t.key) ? 'Открепить' : 'Закрепить сверху'}">${icon('pin')}</button></div>`;
  const pinned = list.filter(t => pins.has(t.key)), rest = list.filter(t => !pins.has(t.key));
  const withMsg = rest.filter(t => t.last), empty = rest.filter(t => !t.last);
  const emptyText = { all: 'Сообщений пока нет.', cust: 'От заказчиков сообщений нет.', proj: 'Чатов проектов нет.', task: 'Обсуждений в карточках пока нет. Они появляются, когда в карточке пишут во вкладке «Обсуждение».', other: 'Личных и групповых чатов нет. «+ Новый чат» — создать.' }[msg.filter];
  return tabs + `<div class="mc-list">${pinned.length ? `<div class="mc-sep">Закреплённые</div>${pinned.map(item).join('')}${withMsg.length || empty.length ? '<div class="mc-sep">Остальные</div>' : ''}` : ''}${withMsg.map(item).join('')}${empty.length ? `<div class="mc-sep">Без сообщений</div>${empty.map(item).join('')}` : ''}${list.length ? '' : `<p class="hint mc-empty">${emptyText}</p>`}</div>`;
}
function msgChatHtml(c) {
  const me = state.me?.id, seen = msg.mark?.id === c.id ? msg.mark.since : (c.seen?.[me] || '');
  const people = chatPeople(c);
  let day = '';
  const rows = (c.messages || []).map(m => {
    const lt = localTs(m.ts), d = lt.slice(0, 10), sep = d !== day ? `<div class="mc-day">${d === state.today ? 'Сегодня' : fmtDate(d)}</div>` : '';
    day = d;
    const out = m.userId === me, tome = (m.mentions || []).includes(me), fresh = !out && m.ts > seen;
    const editing = out && msg.edit?.mid === m.id;
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${tome ? ' tome' : ''}${fresh ? ' fresh' : ''}${m.pending ? ' pending' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(m.user)}</b> <span class="hint">${lt.slice(11, 16)}${m.editedAt ? ' · изменено' : ''}</span>${tome ? ' <span class="chip tone-work">вас упомянули</span>' : ''}${m.pending ? ' <span class="hint pending-t">ждёт отправки</span>' : out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(m.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${msgText(m.text, c)}</div>`}</div>`;
  }).join('');
  const sub = c.kind === 'project' ? `чат проекта · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}` : c.kind === 'direct' ? 'личный чат' : `группа · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}`;
  const canEdit = c.kind === 'group' && (c.createdBy === me || A.isGip(state.me));
  const info = msg.info ? `<div class="mc-info">${people.map(u => `<span class="chip tone-idle">${esc(u.name)}${u.id === c.createdBy ? ' · автор' : ''}</span>`).join(' ')}
      ${canEdit ? `<div class="row-in"><select id="mc-add"><option value="">— добавить участника —</option>${liveUsers().filter(u => !people.includes(u)).sort(byName).map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="msg-add-member">Добавить</button></div>` : ''}
      ${canEdit ? `<div class="row-in"><span class="hint">Значок чата:</span><button class="btn sm" type="button" data-act="chat-icon" data-id="${esc(c.id)}">Выбрать картинку…</button>${ICON_OK(c.icon) ? `<button class="btn ghostbtn sm" type="button" data-act="chat-icon-clear" data-id="${esc(c.id)}">Убрать</button>` : ''}</div>` : ''}
      ${c.kind === 'group' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-leave">Выйти из чата</button>' : ''}${c.kind === 'project' ? `<button class="btn ghostbtn sm" type="button" data-act="project-page" data-id="${esc(c.projectId)}">Открыть проект</button><span class="hint">Участники проекта меняются на его странице.</span>` : ''}</div>` : '';
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку чатов">←</button>' : ''}${chatIcon(c)}<span class="mc-ht"><b>${esc(chatTitle(c))}</b><span class="hint">${sub}</span></span>
      ${msgPinBtn(c.id)}${winBtn('chat', c.id)}${SOLO || docTabs.includes('chat:' + c.id) ? '' : `<button class="btn ghostbtn sm" type="button" data-act="ws-chat" data-id="${esc(c.id)}" title="Положить чат во вкладки сверху — рядом с проектами и разделами">Во вкладку</button>`}<button class="btn ghostbtn sm" type="button" data-act="msg-info" aria-pressed="${msg.info}">Участники</button></div>${info}
    <div class="mc-msgs" id="mc-msgs">${rows || `<p class="hint mc-empty">Напишите первое сообщение. «@» и фамилия — упомянуть коллегу${c.kind !== 'direct' ? ', «@все» — всех' : ''}.</p>`}</div>
    <div class="mc-compose"><div class="mc-ac" id="mc-ac" hidden></div><textarea id="msg-text" rows="2" maxlength="2000" placeholder="Сообщение… Enter — отправить, Shift+Enter — новая строка, @ — упомянуть">${esc(msg.drafts[c.id] || '')}</textarea><button class="btn primary sm" type="button" data-act="mc-send">Отправить</button></div></div>`;
}
// A card discussion inside the messenger: the same messages as the card's «Обсуждение».
function msgTaskHtml(t) {
  const me = state.me?.id, list = t.comments || [];
  let day = '';
  const rows = list.map(c => {
    const lt = localTs(c.ts), d = lt.slice(0, 10), sep = d !== day ? `<div class="mc-day">${d === state.today ? 'Сегодня' : fmtDate(d)}</div>` : '';
    day = d;
    const out = c.userId === me, editing = out && msg.edit?.mid === c.id;
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${c.kind === 'submit' ? ' submit' : ''}${c.pending ? ' pending' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(c.user || '—')}</b> <span class="hint">${lt.slice(11, 16)}${c.editedAt ? ' · изменено' : ''}</span>${c.kind === 'submit' ? ' <span class="chip tone-review">сдал на проверку</span>' : ''}${c.pending ? ' <span class="hint pending-t">ждёт отправки</span>' : out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${cardLinks(esc(c.text))}</div>`}${thankBtn(t, c)}</div>`;
  }).join('');
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку">←</button>' : ''}<span class="mc-ic task">✎</span><span class="mc-ht"><b>${esc(marksText(t) || t.title || 'Карточка')}</b><span class="hint">обсуждение карточки · ${esc(projectOf(t)?.name || '')}</span></span>
      ${msgPinBtn('t:' + t.id)}${winBtn('chat', 't:' + t.id)}<button class="btn ghostbtn sm" type="button" data-act="open-task" data-id="${esc(t.id)}">Открыть карточку</button></div>
    <div class="mc-msgs" id="mc-msgs">${rows || '<p class="hint mc-empty">Сообщений нет.</p>'}</div>
    <div class="mc-compose"><textarea id="msg-text" rows="2" maxlength="2000" placeholder="Сообщение в обсуждение карточки… Enter — отправить, Shift+Enter — новая строка">${esc(msg.drafts['t:' + t.id] || '')}</textarea><button class="btn primary sm" type="button" data-act="mc-send">Отправить</button></div></div>`;
}
// Messages from a project's customer (cabinet): read here, answered by the actions in the project.
function msgCustHtml(pid, list) {
  const sorted = [...list].sort((a, b) => a.ts.localeCompare(b.ts));
  const rows = sorted.map(m => `<div class="chat-msg in cust${m.kind === 'urgent' ? ' urgent' : ''}${m.read ? '' : ' fresh'}"><div class="chat-meta"><b>${esc(m.customerName || 'Заказчик')}</b> <span class="hint">${fmtDate(localTs(m.ts).slice(0, 10))} ${localTs(m.ts).slice(11, 16)}</span>
      <span class="chip ${m.kind === 'urgent' ? 'tone-bad' : 'tone-idle'}">${esc(CAB_KINDS[m.kind] || 'Сообщение')}</span>${decisionChip(m)}</div>
    ${m.requestTitle || m.meetingTitle || m.to ? `<div class="hint">${esc(m.requestTitle || m.meetingTitle || '')}${m.to ? ` → ${esc(m.to)}` : ''}</div>` : ''}<div class="chat-text">${esc(m.text || '')}</div></div>`).join('');
  const name = state.projects.get(pid)?.name || sorted.at(-1)?.projectName || 'Проект';
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку">←</button>' : ''}<span class="mc-ic cust">З</span><span class="mc-ht"><b>${esc(name)}</b><span class="hint">от заказчика · через кабинет</span></span>
      ${msgPinBtn('c:' + pid)}${winBtn('chat', 'c:' + pid)}${state.projects.has(pid) ? `<button class="btn ghostbtn sm" type="button" data-act="msg-cust-project" data-id="${esc(pid)}" title="Открыть проект: принять исходные данные, ответить, перенести встречу">В проект</button>` : ''}</div>
    <div class="mc-msgs" id="mc-msgs">${rows}</div>
    <p class="hint mc-note">Заказчик пишет из кабинета, ответ ему — действиями в проекте: принять исходные данные, перенести встречу, перезвонить.</p></div>`;
}
const msgPinBtn = key => { const on = msgPins().has(key); return `<button class="btn ghostbtn sm mc-pinbtn${on ? ' on' : ''}" type="button" data-act="msg-pin" data-id="${esc(key)}" aria-pressed="${on}" title="${on ? 'Открепить' : 'Закрепить сверху списка'}">${icon('pin')}</button>`; };
function msgNewHtml() {
  const others = liveUsers().filter(u => u.id !== state.me?.id).sort(byName);
  return `<div class="mc-chat mc-new"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back">←</button>' : ''}<span class="mc-ht"><b>Новый чат</b><span class="hint">личный — с одним человеком, группа — без привязки к проекту</span></span></div>
    <div class="mc-newbody"><div class="seg"><button class="btn sm${msg.newKind !== 'group' ? ' on' : ''}" type="button" data-act="msg-newkind" data-v="direct">Личный</button><button class="btn sm${msg.newKind === 'group' ? ' on' : ''}" type="button" data-act="msg-newkind" data-v="group">Группа</button></div>
    ${msg.newKind === 'group' ? `<div class="f"><label for="mc-title">Название</label><input id="mc-title" maxlength="80" placeholder="Планёрка ГИПов, Котельная — рабочая группа…" value="${esc(msg.newTitle)}"></div><span class="lbl">Участники</span>
      <div class="mc-pick">${others.map(u => `<label class="chk"><input type="checkbox" data-act="msg-pick" value="${esc(u.id)}"${msg.newPick.has(u.id) ? ' checked' : ''}> ${esc(u.name)} <span class="hint">${esc(A.ROLES[u.role]?.label || '')}</span></label>`).join('')}</div>
      <button class="btn primary" type="button" data-act="msg-create">Создать чат${msg.newPick.size ? ` (${msg.newPick.size + 1})` : ''}</button>`
    : `<div class="mc-list">${others.map(u => `<button class="mc-item" type="button" data-act="msg-direct" data-id="${esc(u.id)}"><span class="mc-ic ava">${esc(initials(u.name))}</span><span class="mc-body"><b>${esc(u.name)}</b><span class="hint">${esc(A.ROLES[u.role]?.label || '')}</span></span></button>`).join('')}</div>`}</div></div>`;
}
function renderMsg() {
  let root = document.getElementById('msg-root');
  if (!root) { root = document.createElement('div'); root.id = 'msg-root'; document.body.append(root); }
  if (!state.loaded || !state.me || state.win.compact || SOLO?.kind === 'project') { root.innerHTML = ''; return; }
  const focus = document.activeElement?.id === 'msg-text', caret = focus ? document.activeElement.selectionStart : 0;
  const editFocus = document.activeElement?.id === 'mc-edit';
  if (msg.edit && document.getElementById('mc-edit')) msg.edit.text = document.getElementById('mc-edit').value; // keep the edit through a re-render
  const t = msgTotals(), th = msgThread(msg.chatId), c = th?.type === 'chat' ? th.c : null;
  if (msg.chatId && msg.chatId !== 'new' && !th && msg.mode !== 'solo') msg.chatId = ''; // a chat window keeps waiting for its chat
  const pill = `<button class="msg-fab${t.n ? ' has' : ''}" type="button" data-act="msg-open" title="Сообщения: чаты проектов, личные и групповые">${icon('chat')}<span>Сообщения</span>${t.n ? `<i class="mc-n">${t.n}</i>` : ''}${t.at ? `<i class="mc-at" title="Вас упомянули">@${t.at}</i>` : ''}</button>`;
  if (msg.mode === 'pill') { root.innerHTML = pill; return; }
  const head = `<div class="mp-head"><b>Сообщения</b><span class="spacer"></span><button class="btn sm" type="button" data-act="msg-new">+ Новый чат</button>
    <button class="btn ghostbtn sm msg-stick${msg.stick ? ' on' : ''}" type="button" data-act="msg-stick" aria-pressed="${!!msg.stick}" title="${msg.stick ? 'Окно закреплено: остаётся, пока не закроете. В чат можно перетащить карточку. Нажмите, чтобы открепить' : 'Закрепить окно: не будет сворачиваться при щелчке мимо, в чат можно перетащить карточку'}">${icon('pin')}</button>
    <button class="btn ghostbtn sm" type="button" data-act="msg-size" title="${msg.mode === 'full' ? 'Свернуть в боковую панель' : 'Открыть окно со всеми чатами'}">${msg.mode === 'full' ? '⇲' : '⤢'}</button><button class="btn ghostbtn sm" type="button" data-act="msg-close" aria-label="Свернуть">✕</button></div>`;
  const right = msg.chatId === 'new' ? msgNewHtml() : c ? msgChatHtml(c) : th?.type === 'task' ? msgTaskHtml(th.t) : th?.type === 'cust' ? msgCustHtml(th.pid, th.list) : msg.mode === 'solo' ? '<div class="mc-chat"><p class="hint mc-empty">Разговор недоступен: его удалили или вы больше в нём не участвуете. Это окно можно закрыть.</p></div>' : '<div class="mc-chat"><p class="hint mc-empty">Выберите разговор слева или создайте новый чат.</p></div>';
  const body = msg.mode === 'full' ? `<div class="mp-full"><div class="mp-left">${msgListHtml()}</div><div class="mp-right">${right}</div></div>` : (msg.chatId ? right : msgListHtml());
  const enter = msg.enter ? ' enter' : ''; msg.enter = false; // slide in only when the panel opens, not on every refresh
  if (msg.mode === 'solo') document.documentElement.style.setProperty('--bar-h', `${document.getElementById('bar')?.offsetHeight || 48}px`);
  if (msg.mode === 'solo') root.innerHTML = `<section class="msg-panel solo" aria-label="${esc(threadTitle(msg.chatId))}">${right}</section>`;
  else root.innerHTML = `${msg.mode === 'full' ? `<div class="mp-back${enter}" data-act="msg-close"></div>` : ''}<section class="msg-panel ${msg.mode}${enter}" role="dialog" aria-label="Сообщения">${head}${body}</section>`;
  const box = document.getElementById('mc-msgs');
  if (box) box.scrollTop = box.scrollHeight;
  if (focus) { const ta = document.getElementById('msg-text'); if (ta) { ta.focus(); try { ta.setSelectionRange(caret, caret); } catch { /* fine */ } } }
  if (editFocus) { const ta = document.getElementById('mc-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  if (c) msgSeenLater(c);
  if (th?.type === 'task' && unread(th.t)) api.taskSeen(th.t.id);
  if (th?.type === 'cust') { const ids = th.list.filter(m => !m.read).map(m => m.id); if (ids.length) api.cabinetRead?.(ids); }
}
/* ---------- 12: two modes of the messages window ---------- */
// Not pinned: a click anywhere outside folds it to the right (back to the «Сообщения» button).
// Pinned: it stays until closed, and a card dragged from the Kanban, a table or «Люди» into the chat is attached.
document.addEventListener('mousedown', e => {
  if (msg.stick || msg.mode !== 'side' || SOLO) return;
  if (e.target.closest?.('#msg-root, .modal-back, .palette-back, .menu, #toast, .tour, .drawer, #drawer-root')) return;
  msgClose();
}, true);
let msgDragTask = '';
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('[data-kb-id], .ctask[data-move][data-id], tr.row[data-act="open-task"][data-id]');
  msgDragTask = el ? (el.dataset.kbId || el.dataset.id || '') : '';
  if (msgDragTask && el.matches('tr.row')) { e.dataTransfer.setData('text/plain', msgDragTask); e.dataTransfer.effectAllowed = 'copyMove'; }
});
document.addEventListener('dragend', () => { msgDragTask = ''; document.querySelector('.msg-panel.drop-card')?.classList.remove('drop-card'); });
// Table rows become draggable while the messages window is open (otherwise text in them stays selectable).
document.addEventListener('mousedown', e => {
  const row = e.target.closest?.('tr.row[data-act="open-task"][data-id]');
  if (row) row.draggable = msg.mode !== 'pill' && !!msg.chatId && msg.chatId !== 'new';
}, true);
const msgCanTakeCard = () => msgDragTask && msg.mode !== 'pill' && msg.chatId && msg.chatId !== 'new' && !!document.getElementById('msg-text');
document.addEventListener('dragover', e => {
  if (!msgCanTakeCard() || !e.target.closest?.('.msg-panel')) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  e.target.closest('.msg-panel').classList.add('drop-card');
});
document.addEventListener('dragleave', e => { if (e.target.classList?.contains('msg-panel')) e.target.classList.remove('drop-card'); });
document.addEventListener('drop', e => {
  if (!msgCanTakeCard() || !e.target.closest?.('.msg-panel')) return;
  e.preventDefault(); e.stopPropagation();
  e.target.closest('.msg-panel').classList.remove('drop-card');
  msgAttachCard(msgDragTask);
  msgDragTask = '';
}, true);
function msgAttachCard(id) {
  const ta = document.getElementById('msg-text');
  if (!ta || !state.tasks.has(id)) return;
  const tok = `[[task:${id}]]`, at = ta.selectionStart ?? ta.value.length;
  const before = ta.value.slice(0, at), after = ta.value.slice(at);
  ta.value = `${before}${before && !/\s$/.test(before) ? ' ' : ''}${tok} ${after}`.slice(0, 2000);
  msg.drafts[msg.chatId] = ta.value;
  ta.focus();
  toast(`Карточка «${marksText(state.tasks.get(id))}» в сообщении — нажмите «Отправить»`);
}
function msgSeenLater(c) {
  if (msg.mark?.id !== c.id) msg.mark = { id: c.id, since: c.seen?.[state.me?.id] || '' };
  if (!msgUnread(c).length || c.virtual) return;
  clearTimeout(msgSeenLater.t);
  msgSeenLater.t = setTimeout(() => { if (msg.chatId === c.id && msg.mode !== 'pill') api.chatSeen(c.id); }, 900);
}
function msgOpen(chatId = msg.chatId) {
  if (SOLO && !(SOLO.kind === 'chat' && chatId === SOLO.id)) { if (chatId && chatId !== 'new') api.windowMain?.({ kind: 'chat', id: chatId }); return; }
  if (msg.mode === 'pill') { msg.mode = 'side'; msg.enter = true; }
  msg.chatId = chatId; msg.info = false; msg.mark = null; msg.edit = null;
  renderMsg();
  setTimeout(() => document.getElementById('msg-text')?.focus(), 30);
}
async function msgSend() {
  if (msg.chatId.startsWith('t:')) return msgTaskSend();
  const c = chatById(msg.chatId), ta = document.getElementById('msg-text');
  if (!c || !ta) return;
  const text = ta.value.trim();
  if (!text) return ta.focus();
  // Emptied before sending: the panel re-renders from the draft while the message is saved.
  msg.drafts[c.id] = '';
  ta.value = '';
  const r = await api.chatSend(c.id, text, c.kind === 'project' ? c.projectId : undefined);
  if (!r?.ok) {
    if (!msg.drafts[c.id]) { msg.drafts[c.id] = text; const cur = document.getElementById('msg-text'); if (cur && !cur.value) cur.value = text; }
    return toast(r?.message || 'Не отправлено', true);
  }
  await refresh();
}
async function msgTaskSend() {
  const key = msg.chatId, id = key.slice(2), ta = document.getElementById('msg-text');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) return ta.focus();
  msg.drafts[key] = ''; ta.value = '';
  const r = await api.addComment(id, text);
  if (!r?.ok) {
    if (!msg.drafts[key]) { msg.drafts[key] = text; const cur = document.getElementById('msg-text'); if (cur && !cur.value) cur.value = text; }
    return toast(r?.message || 'Не отправлено', true);
  }
  await refresh();
}
const threadMessages = () => { const th = msgThread(msg.chatId); return th?.type === 'chat' ? th.c.messages || [] : th?.type === 'task' ? th.t.comments || [] : []; };
// Editing one's own message: inline, Enter saves, Esc cancels; mentions are re-read from the new text.
function mcEditStart(mid) {
  const m = threadMessages().find(x => x.id === mid);
  if (!m || m.userId !== state.me?.id) return;
  msg.edit = { mid, text: m.text };
  renderMsg();
  const ta = document.getElementById('mc-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
async function mcEditSave() {
  const th = msgThread(msg.chatId), ta = document.getElementById('mc-edit');
  if (!th || !msg.edit || !ta) return;
  const text = ta.value.trim();
  if (!text) return toast('Сообщение не может быть пустым.', true);
  const r = th.type === 'task' ? await api.editComment(th.t.id, msg.edit.mid, text) : await api.chatEdit(th.c.id, msg.edit.mid, text);
  if (!r?.ok) return toast(r?.message || 'Не удалось сохранить.', true);
  msg.edit = null;
  await refresh();
}
function mcEditCancel() { msg.edit = null; renderMsg(); }
// Closing slides the panel out to the right (when animations are on).
function msgClose() {
  if (msg.mode === 'pill' || msg.mode === 'solo') return; // a chat window closes with its own ✕
  leaveAnimated(document.querySelector('#msg-root .mp-back'), document.querySelector('#msg-root .msg-panel'));
  msg.mode = 'pill';
  renderMsg();
}
// «@» autocomplete: the chat's people by surname; Enter/Tab or a click inserts «@Фамилия ».
function msgAutocomplete(ta) {
  const box = document.getElementById('mc-ac'), c = chatById(msg.chatId);
  const m = ta.value.slice(0, ta.selectionStart).match(/(^|\s)@([\p{L}-]*)$/u);
  if (!box || !c || !m) { if (box) box.hidden = true; msg.ac = null; return; }
  const q = m[2].toLowerCase();
  const list = [...(c.kind !== 'direct' ? [{ id: '*', name: 'все', label: 'Все участники чата' }] : []), ...chatPeople(c).filter(u => u.id !== state.me?.id).map(u => ({ id: u.id, name: surnameOf(u.name), label: u.name }))]
    .filter(u => u.name.toLowerCase().startsWith(q) || u.label.toLowerCase().includes(q)).slice(0, 8);
  if (!list.length) { box.hidden = true; msg.ac = null; return; }
  msg.ac = { list, sel: 0, from: ta.selectionStart - m[2].length - 1 };
  box.innerHTML = list.map((u, i) => `<button type="button" class="${i ? '' : 'sel'}" data-act="msg-ac" data-i="${i}">@${esc(u.name)} <span class="hint">${esc(u.label)}</span></button>`).join('');
  box.hidden = false;
}
function msgAcPick(i) {
  const ta = document.getElementById('msg-text'), a = msg.ac;
  if (!ta || !a || !a.list[i]) return;
  const ins = '@' + a.list[i].name + ' ';
  ta.value = ta.value.slice(0, a.from) + ins + ta.value.slice(ta.selectionStart);
  const pos = a.from + ins.length;
  ta.focus(); ta.setSelectionRange(pos, pos);
  msg.drafts[msg.chatId] = ta.value;
  document.getElementById('mc-ac').hidden = true; msg.ac = null;
}
// A fresh mention of me since the last data: a toast that opens that chat.
let mentionSeenTs = null;
function msgNotify() {
  const me = state.me?.id;
  if (!me) return;
  const hits = chatsAll().flatMap(c => msgMentions(c).map(m => ({ c, m }))).sort((a, b) => b.m.ts.localeCompare(a.m.ts));
  const top = hits[0]?.m.ts || '';
  if (mentionSeenTs !== null && top > mentionSeenTs && !focus && !(msg.mode !== 'pill' && msg.chatId === hits[0].c.id)) toast(`@ ${hits[0].m.user} — «${chatTitle(hits[0].c)}»: ${hits[0].m.text.slice(0, 90)}`);
  mentionSeenTs = top > (mentionSeenTs || '') ? top : (mentionSeenTs ?? top);
}

const memberIds = p => (Array.isArray(p.members) ? p.members : []).filter(id => state.users.has(id) && !state.users.get(id).deletedAt);

const ptTable = rows => `<div class="tablewrap"><table class="pt-t"><thead><tr><th>Раздел</th><th>Обозначение</th><th>Ответственный</th><th>Срок</th><th>Готовность</th><th>Статус</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

// «В работе» — started and not handed in (in progress, on revision); «не начато» — not started or paused.
const taskCounts = list => ({ work: list.filter(t => ['in_progress', 'revision'].includes(t.status)).length, idle: list.filter(t => ['not_started', 'paused'].includes(t.status)).length });
// Blocks of the project page that are not its documentation (source data, letters).
const auxBlock = (...a) => ptBlock(...a).replace('class="panel pt-block', 'class="panel pt-block pt-aux');

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'msg-open-any': () => { msgOpen(); },
  'msg-open': () => { msgOpen(); },
  'msg-close': () => { msgClose(); },
  'msg-size': () => { msg.mode = msg.mode === 'full' ? 'side' : 'full'; renderMsg(); },
  'msg-stick': () => { msg.stick = !msg.stick; saveLocal('msgStick', msg.stick); renderMsg(); toast(msg.stick ? 'Окно сообщений закреплено — перетащите карточку в чат, чтобы отправить её' : 'Окно сообщений свернётся при щелчке мимо'); },
  'msg-chat': ({ id }) => { msgOpen(id); },
  'msg-back': () => { msg.chatId = ''; renderMsg(); },
  'msg-filter': ({ el }) => { msg.filter = el.dataset.v; renderMsg(); },
  'msg-pin': ({ id }) => { msgTogglePin(id); },
  'msg-cust-project': ({ id }) => { msgClose(); openProject(id, 'cust'); },
  'mc-send': () => { msgSend(); },
  'mc-edit': ({ id }) => { mcEditStart(id); },
  'mc-edit-save': () => { mcEditSave(); },
  'mc-edit-cancel': () => { mcEditCancel(); },
  'msg-info': () => { msg.info = !msg.info; renderMsg(); },
  'chat-icon': ({ id, act }) => { setChatIcon(id, act === 'chat-icon'); },
  'chat-icon-clear': ({ id, act }) => { setChatIcon(id, act === 'chat-icon'); },
  'proj-icon': ({ act }) => { setProjectIconField(act === 'proj-icon'); },
  'proj-icon-clear': ({ act }) => { setProjectIconField(act === 'proj-icon'); },
  'msg-project': ({ id }) => { msgOpen(projectChatId(id)); },
  'msg-new': () => { msg.chatId = 'new'; msg.newKind = 'direct'; if (msg.mode === 'pill') { msg.mode = 'side'; msg.enter = true; } renderMsg(); },
  'msg-newkind': ({ el }) => { msg.newKind = el.dataset.v; renderMsg(); },
  'msg-pick': ({ el }) => { if (el.checked) msg.newPick.add(el.value); else msg.newPick.delete(el.value); msg.newTitle = $('#mc-title')?.value || msg.newTitle; renderMsg(); },
  'msg-ac': ({ el }) => { msgAcPick(Number(el.dataset.i)); },
  'msg-direct': ({ id }) => { api.chatDirect(id).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); await refresh(); msgOpen(r.id); }); },
  'msg-create': () => { const title = ($('#mc-title')?.value || '').trim(); api.chatCreate({ title, members: [...msg.newPick] }).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); msg.newPick = new Set(); msg.newTitle = ''; await refresh(); msgOpen(r.id); toast(`Чат «${title}» создан`); }); },
  'msg-add-member': () => { const c = chatById(msg.chatId), uid = $('#mc-add')?.value; if (c && uid) api.chatUpdate(c.id, { members: [...(c.members || []), uid] }).then(r => (r?.ok ? refresh() : toast(r?.message || 'Ошибка', true))); },
  'msg-leave': () => { const c = chatById(msg.chatId); if (c) confirmBox(`Выйти из чата «${chatTitle(c)}»? Вернуть может автор чата.`, 'Выйти').then(ok => ok && api.chatLeave(c.id).then(() => { msg.chatId = ''; refresh(); })); },
});
/* ---------- 4.1.1 (item 60): source data in folders, with files, dates of issue and validity ---------- */
const IRD_FOLDERS = [['rights', 'Правоустанавливающие документы'], ['gpzu', 'ГПЗУ'], ['tz', 'Техническое задание'], ['tu', 'Технические условия'],
  ['geology', 'Инженерная геология'], ['geodesy', 'Инженерная геодезия'], ['ecology', 'Инженерная экология'], ['survey', 'Обмеры / обследование'],
  ['sketch', 'Согласование эскиза'], ['other', 'Прочее']];
const SURVEY_FOLDERS = ['geodesy', 'geology', 'ecology', 'hydromet', 'survey'];
// When the surveys are «ours» (item 11), their folders live in the «Инженерные изыскания» block, unless files are already there.
const irdFolderList = p => [...IRD_FOLDERS, ...(p.irdFolders || []).map(f => [f.id, f.name])]
  .filter(([id]) => p.surveys !== 'ours' || !SURVEY_FOLDERS.includes(id) || (p.irdFiles || []).some(x => x.folder === id));
const irdKind = folder => ({ gpzu: 'gpzu', geodesy: 'geodesy', geology: 'geology', ecology: 'ecology', tu: 'tu' }[folder] || 'other');
let irdOpen = {}; // project id → folder id
function irdStatus(f) {
  if (!isDate(f.until)) return ['idle', isDate(f.issued) ? 'срок не указан' : ''];
  const left = dayNum(f.until) - dayNum(state.today);
  return left < 0 ? ['bad', 'истёк'] : left <= 60 ? ['warn', `истекает через ${left} дн.`] : ['ok', `действует до ${fmtDate(f.until)}`];
}
function irdBlock(p) {
  if (!canFiles() && !(p.irdFiles || []).length) return '';
  const files = p.irdFiles || [], folders = irdFolderList(p), edit = A.canManageCatalog(state.me) && !p.archived;
  const cur = irdOpen[p.id] && folders.some(f => f[0] === irdOpen[p.id]) ? irdOpen[p.id] : (folders.find(f => files.some(x => x.folder === f[0]))?.[0] || folders[0][0]);
  const inF = files.filter(x => x.folder === cur);
  const bad = files.filter(x => irdStatus(x)[0] === 'bad').length, warn = files.filter(x => irdStatus(x)[0] === 'warn').length;
  const ext = n => (String(n).split('.').pop() || '').slice(0, 4).toUpperCase();
  const body = `<div class="ird" data-ird-project="${esc(p.id)}"><nav class="ird-folders">${folders.map(([id, name]) => { const n = files.filter(x => x.folder === id).length, w = files.some(x => x.folder === id && ['bad', 'warn'].includes(irdStatus(x)[0])); return `<button type="button" class="ird-f${id === cur ? ' on' : ''}" data-act="ird-folder" data-id="${esc(p.id)}" data-v="${esc(id)}">📁 <span>${esc(name)}</span>${w ? '<i class="ird-dot"></i>' : ''}<b class="hint">${n || ''}</b></button>`; }).join('')}
      ${edit ? `<button type="button" class="ird-f ird-add" data-act="ird-newfolder" data-id="${esc(p.id)}">＋ Папка</button>` : ''}</nav>
    <div class="ird-files" data-ird-folder="${esc(cur)}"><div class="ird-h"><b>${esc(folders.find(f => f[0] === cur)?.[1] || '')}</b><span class="spacer"></span>${edit ? `<button class="btn primary sm" type="button" data-act="ird-upload" data-id="${esc(p.id)}">＋ Загрузить</button>` : ''}</div>
      ${inF.map(f => { const [tone, st] = irdStatus(f); return `<div class="ird-row"><span class="ird-ext e-${esc(ext(f.name).toLowerCase())}">${esc(ext(f.name))}</span><span class="ird-n"><button class="linkbtn" type="button" data-act="ird-open" data-id="${esc(p.id)}" data-fid="${esc(f.id)}"><b>${esc(f.name)}</b></button><span class="hint">${fileSize(f.size)}${f.at ? ' · загружен ' + fmtDate(f.at.slice(0, 10)) : ''}</span></span>
        ${edit ? `<label class="ird-d">выдан <input type="date" data-ird="issued" data-pid="${esc(p.id)}" data-fid="${esc(f.id)}" value="${esc(f.issued || '')}"></label><label class="ird-d">до <input type="date" data-ird="until" data-pid="${esc(p.id)}" data-fid="${esc(f.id)}" value="${esc(f.until || '')}"></label>` : `<span class="hint">${f.issued ? 'выдан ' + fmtDate(f.issued) : ''}</span>`}
        ${st ? `<span class="chip tone-${tone}">${st}</span>` : ''}${edit ? `<button class="btn ghostbtn sm" type="button" data-act="ird-del" data-id="${esc(p.id)}" data-fid="${esc(f.id)}" title="Убрать" aria-label="Убрать">×</button>` : ''}</div>`; }).join('') || `<p class="hint ird-empty">${edit ? 'Перетащите сюда файлы из Проводника или нажмите «Загрузить».' : 'В этой папке пока ничего нет.'}</p>`}
      ${edit && inF.length ? '<p class="hint ird-tip">Для ГПЗУ и топосъёмки срок действия считается от даты выдачи сам; для ТУ и остального — впишите по тексту документа.</p>' : ''}</div></div>`;
  return auxBlock('pi:' + p.id, 'Сбор ИРД', `<span class="meta">${files.length}${bad ? ` · <span class="neg">истёк ${bad}</span>` : ''}${warn ? ` · истекает ${warn}` : ''}</span>`, body);
}
/* ---------- 4.6 (item 11): engineering surveys as their own block when «Тандем» does them ---------- */
const SURVEY_KINDS = [['geodesy', 'Инженерно-геодезические'], ['geology', 'Инженерно-геологические'], ['ecology', 'Инженерно-экологические'],
  ['hydromet', 'Инженерно-гидрометеорологические'], ['survey', 'Обследование конструкций']];
const SURVEY_STATUS = [['plan', 'Не начаты'], ['work', 'В работе'], ['report', 'Отчёт получен'], ['passed', 'Прошли экспертизу']];
const surveyRows = p => SURVEY_KINDS.map(([k, title], i) => ({ k, title, ...(i < 3 ? { on: true } : { on: false }), ...(p.surveyRows || {})[k] }));
function surveysBlock(p) {
  if (p.surveys !== 'ours') return '';
  const edit = A.canManageCatalog(state.me) && !p.archived, files = p.irdFiles || [];
  const rows = surveyRows(p).filter(r => edit || r.on);
  const late = rows.filter(r => r.on && isDate(r.finish) && r.finish < state.today && !['report', 'passed'].includes(r.status)).length;
  const body = `<table class="pd-t sv-t"><thead><tr>${edit ? '<th></th>' : ''}<th>Вид изысканий</th><th>Кто делает</th><th>Срок отчёта</th><th>Состояние</th><th>Отчёт</th></tr></thead><tbody>
    ${rows.map(r => { const n = files.filter(f => f.folder === r.k).length, overdue = r.on && isDate(r.finish) && r.finish < state.today && !['report', 'passed'].includes(r.status);
      return `<tr class="${r.on ? '' : 'off'}">${edit ? `<td><input type="checkbox" data-sv="on" data-pid="${esc(p.id)}" data-k="${r.k}"${r.on ? ' checked' : ''} aria-label="Нужны"></td>` : ''}
        <td><b>${esc(r.title)}</b></td>
        <td>${edit ? `<input data-sv="who" data-pid="${esc(p.id)}" data-k="${r.k}" value="${esc(r.who || '')}" list="sv-who" placeholder="ООО «Геоплан» или сотрудник" maxlength="120"${r.on ? '' : ' disabled'}>` : esc(r.who || '—')}</td>
        <td>${edit ? `<input type="date" data-sv="finish" data-pid="${esc(p.id)}" data-k="${r.k}" value="${esc(r.finish || '')}"${r.on ? '' : ' disabled'}>` : (isDate(r.finish) ? fmtDate(r.finish) : '—')}${overdue ? ' <span class="chip tone-bad">просрочен</span>' : ''}</td>
        <td>${edit ? `<select data-sv="status" data-pid="${esc(p.id)}" data-k="${r.k}"${r.on ? '' : ' disabled'}>${SURVEY_STATUS.map(([k, l]) => `<option value="${k}"${(r.status || 'plan') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` : esc(SURVEY_STATUS.find(x => x[0] === (r.status || 'plan'))[1])}</td>
        <td>${n ? `<button class="linkbtn" type="button" data-act="sv-files" data-id="${esc(p.id)}" data-folder="${r.k}">файлы (${n})</button>` : ''}${edit && r.on && canFiles() ? ` <button class="btn ghostbtn sm" type="button" data-act="sv-upload" data-id="${esc(p.id)}" data-folder="${r.k}">Загрузить</button>` : ''}</td></tr>`; }).join('')}</tbody></table>
    <datalist id="sv-who">${[...state.contractors.values()].filter(c => !c.deletedAt).map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
    <p class="hint">Изыскания делает «Тандем» — поэтому они отдельным блоком. Если их даёт заказчик, переключите в карточке проекта: тогда отчёты — в «Сборе ИРД».</p>`;
  return auxBlock('sv:' + p.id, 'Инженерные изыскания', `<span class="meta">${rows.filter(r => r.on && ['report', 'passed'].includes(r.status)).length} из ${rows.filter(r => r.on).length} готово${late ? ` · <span class="neg">просрочено ${late}</span>` : ''}</span>`, body);
}
function surveyPatch(pid, k, patch) {
  const p = state.projects.get(pid);
  if (!p) return;
  const cur = { ...(p.surveyRows || {}) };
  cur[k] = { ...(cur[k] || {}), ...patch };
  write(op.update('projects', pid, { surveyRows: cur }), 'Изыскания обновлены');
}
async function irdAdd(pid, fileObjs, folder) {
  const p = state.projects.get(pid);
  if (!p) return;
  const added = [];
  for (const f of fileObjs) {
    const r = f instanceof File ? await api.attachBytes(pid, f.name, new Uint8Array(await f.arrayBuffer())) : f;
    if (r?.ok) added.push({ ...r.file, folder }); else if (r && !r.canceled) toast(r?.message || 'Не удалось загрузить файл.', true);
  }
  if (!added.length) return;
  const cur = state.projects.get(pid);
  await write(op.update('projects', pid, { irdFiles: [...(cur.irdFiles || []), ...added] }), added.length === 1 ? `Загружен «${added[0].name}»` : `Загружено файлов: ${added.length}`);
}
function irdPatch(pid, fid, patch) {
  const p = state.projects.get(pid);
  if (!p) return;
  const list = (p.irdFiles || []).map(f => {
    if (f.id !== fid) return f;
    const next = { ...f, ...patch };
    // Fixed-term kinds (ГПЗУ, топосъёмка) fill «до» from the date of issue unless it was typed by hand.
    if ('issued' in patch) { const auto = L.docUntil(irdKind(f.folder), next.issued); if (auto && (!f.until || f.until === f.autoUntil)) next.until = auto; next.autoUntil = auto; }
    return next;
  });
  return write(op.update('projects', pid, { irdFiles: list }), 'Сохранено');
}
document.addEventListener('drop', e => {
  const box = e.target.closest?.('.ird'), files = [...(e.dataTransfer?.files || [])];
  if (!box || !files.length || !canFiles()) return;
  e.preventDefault(); e.stopPropagation();
  irdAdd(box.dataset.irdProject, files, box.querySelector('[data-ird-folder]')?.dataset.irdFolder || 'other');
}, true);
document.addEventListener('dragover', e => { if (e.target.closest?.('.ird') && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }, true);

/* ---------- 4.1.1 (item 61): letters of a project — incoming and outgoing with through numbering, templates ---------- */
const LETTER_TPL = {
  free: { label: 'Без шаблона', subject: '', body: '' },
  cover: { label: 'Сопроводительное к выдаче документации', subject: 'О направлении документации по объекту «{project}»', body: 'Направляем Вам документацию по объекту «{project}» (шифр {code}) в составе:\n1. \n\nПросим подтвердить получение.' },
  tu: { label: 'Запрос технических условий', subject: 'Запрос технических условий — «{project}»', body: 'Просим выдать технические условия на подключение объекта «{project}» ({address}) к сетям инженерно-технического обеспечения.\nНагрузки: \n\nПриложение: ' },
  ird: { label: 'Запрос исходных данных', subject: 'Запрос исходных данных — «{project}»', body: 'Для выполнения проектных работ по объекту «{project}» просим предоставить:\n1. \n\nСрок предоставления: ' },
  remarks: { label: 'Ответ на замечания', subject: 'Ответ на замечания по объекту «{project}»', body: 'На Ваше письмо № ___ от ___ сообщаем:\n1. Замечание: \n   Ответ: \n\nИсправленная документация прилагается.' },
};
const LETTER_STATUS = { in: { new: ['work', 'зарегистрировано'], answer: ['warn', 'нужен ответ'], done: ['ok', 'отработано'] }, out: { draft: ['idle', 'черновик'], sent: ['ok', 'отправлено'] } };
// Through numbering per year over all projects: «Исх. 320», «Вх. 246».
function nextLetterNo(dir, year = state.today.slice(0, 4)) {
  let max = 0;
  for (const p of state.projects.values()) for (const l of p.letters || []) if (l.dir === dir && String(l.date || '').slice(0, 4) === year) max = Math.max(max, Number(l.seq) || 0);
  return max + 1;
}
const letterNo = l => `${l.dir === 'in' ? 'Вх.' : 'Исх.'} ${l.seq}`;
let letterView = {};
function lettersBlock(p) {
  const all = [...(p.letters || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.seq || 0) - (a.seq || 0));
  const edit = A.canManageCatalog(state.me) && !p.archived;
  if (!all.length && !edit) return '';
  const v = letterView[p.id] || 'all', list = v === 'all' ? all : all.filter(l => l.dir === v);
  const waiting = all.filter(l => l.dir === 'in' && l.status === 'answer').length;
  const seg = ['all', 'in', 'out'].map(k => `<button class="btn sm ${v === k ? 'on' : ''}" type="button" data-act="let-view" data-id="${esc(p.id)}" data-v="${k}">${{ all: 'Все', in: 'Входящие', out: 'Исходящие' }[k]}</button>`).join('');
  const body = `<div class="let"><div class="let-bar"><span class="seg">${seg}</span><span class="spacer"></span>${edit ? `<button class="btn primary sm" type="button" data-act="let-new" data-id="${esc(p.id)}" data-v="out">✉ Новое исходящее</button><button class="btn sm" type="button" data-act="let-new" data-id="${esc(p.id)}" data-v="in">＋ Входящее</button>` : ''}</div>
    ${list.length ? `<table class="let-t"><thead><tr><th>№</th><th>Дата</th><th>Корреспондент</th><th>Тема</th><th>Состояние</th><th></th></tr></thead><tbody>${list.map(l => { const [tone, st] = (LETTER_STATUS[l.dir] || {})[l.status] || ['idle', '']; const late = l.dir === 'in' && l.status === 'answer' && isDate(l.due) && l.due < state.today;
      return `<tr><td class="num"><b>${esc(letterNo(l))}</b></td><td class="num">${fmtDate(l.date)}</td><td>${esc(l.corr || '')}</td><td>${esc(l.subject || '')}${(l.files || []).length ? ` <span class="hint">📎${l.files.length}</span>` : ''}</td>
        <td><span class="chip tone-${late ? 'bad' : tone}">${late ? 'ответ просрочен' : esc(st)}</span>${l.dir === 'in' && l.status === 'answer' && isDate(l.due) && !late ? ` <span class="hint">до ${fmtDate(l.due)}</span>` : ''}</td>
        <td class="let-acts">${l.dir === 'out' ? `<button class="btn ghostbtn sm" type="button" data-act="let-mail" data-id="${esc(p.id)}" data-lid="${esc(l.id)}" title="Открыть в почтовой программе">✉</button>` : ''}${edit ? `<button class="btn ghostbtn sm" type="button" data-act="let-edit" data-id="${esc(p.id)}" data-lid="${esc(l.id)}" title="Открыть">✎</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`
      : `<p class="hint let-empty">${v === 'in' ? 'Входящих пока нет.' : v === 'out' ? 'Исходящих пока нет.' : 'Писем по проекту пока нет. Номера присваиваются сами, сквозные за год.'}</p>`}</div>`;
  return auxBlock('pl:' + p.id, 'Письма', `<span class="meta">${all.length}${waiting ? ` · <span class="neg">ждут ответа ${waiting}</span>` : ''}</span>`, body);
}
function fillTpl(text, p) {
  return String(text || '').replace(/\{project\}/g, p.name || '').replace(/\{code\}/g, p.code || '—').replace(/\{address\}/g, p.address || p.client || '');
}
function askLetter(p, letter = null, dir = 'out') {
  const isNew = !letter;
  const l = letter ? clone(letter) : { id: newId(), dir, seq: nextLetterNo(dir), date: state.today, corr: dir === 'out' ? (p.client || '') : '', email: '', subject: '', body: '', status: dir === 'in' ? 'answer' : 'draft', due: dir === 'in' ? addDays(state.today, 10) : '', files: [], tpl: 'free' };
  const sig = `\n\n${A.isGip(state.me) ? 'Главный инженер проекта' : A.ROLES[state.me?.role]?.label || ''}\n${(state.me?.name || '').replace(/^Пример:\s*/, '')}`;
  const root = document.createElement('div');
  root.className = 'modal-back';
  const st = LETTER_STATUS[l.dir];
  root.innerHTML = `<form class="modal let-modal" role="dialog" aria-modal="true" aria-labelledby="let-t" novalidate>
    <h2 id="let-t">${l.dir === 'in' ? 'Входящее' : 'Исходящее'} письмо <span class="num">№ ${l.seq}</span> <span class="hint">${isNew ? '(номер присвоен сам)' : ''}</span></h2>
    <div class="fgrid"><div class="f"><label for="let-date">Дата</label><input type="date" id="let-date" value="${esc(l.date)}"></div>
      <div class="f"><label for="let-corr">${l.dir === 'in' ? 'От кого' : 'Кому'}</label><input id="let-corr" maxlength="160" value="${esc(l.corr || '')}" placeholder="${l.dir === 'in' ? 'Минстрой края' : 'Заказчик, организация'}"></div>
      ${l.dir === 'out' ? `<div class="f"><label for="let-email">Почта получателя</label><input id="let-email" type="email" maxlength="200" value="${esc(l.email || '')}" placeholder="name@example.ru"></div>
      <div class="f"><label for="let-tpl">Шаблон</label><select id="let-tpl">${Object.entries(LETTER_TPL).map(([k, x]) => `<option value="${k}"${k === l.tpl ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>` : `<div class="f"><label for="let-no2">Их номер</label><input id="let-no2" maxlength="60" value="${esc(l.theirNo || '')}" placeholder="№ 12-04/345"></div>
      <div class="f"><label for="let-due">Ответить до</label><input type="date" id="let-due" value="${esc(l.due || '')}"></div>`}
      <div class="f wide"><label class="req" for="let-subj">Тема</label><input id="let-subj" maxlength="300" value="${esc(l.subject || '')}"></div>
      <div class="f wide"><label for="let-body">${l.dir === 'in' ? 'Кратко о чём' : 'Текст'}</label><textarea id="let-body" rows="${l.dir === 'in' ? 3 : 8}" maxlength="6000">${esc(l.body || '')}</textarea></div>
      <div class="f"><label for="let-st">Состояние</label><select id="let-st">${Object.entries(st).map(([k, [, t]]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      ${canFiles() ? `<div class="f wide let-files"><span class="lbl">Вложения</span><div id="let-flist"></div><div class="tf-drop" id="let-drop">Перетащите файлы сюда</div></div>` : ''}</div>
    <div class="err" id="let-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">${isNew ? 'Зарегистрировать' : 'Сохранить'}</button>${l.dir === 'out' ? '<button class="btn" type="button" data-m="mail">Сохранить и открыть в почте</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button><span class="spacer"></span>${isNew ? '' : '<button class="btn danger" type="button" data-m="del">Удалить</button>'}</div></form>`;
  document.body.append(root);
  const q = sel => root.querySelector(sel);
  const drawFiles = () => { const el = q('#let-flist'); if (el) el.innerHTML = (l.files || []).map((f, i) => `<span class="aq-file">${icon('file')}${esc(f.name)} <span class="hint">${fileSize(f.size)}</span><button class="btn ghostbtn sm" type="button" data-m="unf" data-i="${i}">×</button></span>`).join(''); };
  drawFiles();
  q('#let-subj').focus();
  q('#let-tpl')?.addEventListener('change', e => { const t = LETTER_TPL[e.target.value]; l.tpl = e.target.value; if (!t) return; if (t.subject) q('#let-subj').value = fillTpl(t.subject, p); if (t.body) q('#let-body').value = fillTpl(t.body, p) + sig; });
  root.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.stopPropagation(); } }, true);
  root.addEventListener('drop', async e => {
    const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
    e.preventDefault(); e.stopPropagation();
    for (const f of files) { const r = await api.attachBytes(p.id, f.name, new Uint8Array(await f.arrayBuffer())); if (r?.ok) l.files.push(r.file); else toast(r?.message || 'Не удалось приложить файл.', true); }
    drawFiles();
  }, true);
  const close = () => root.remove();
  const collect = () => Object.assign(l, { date: q('#let-date').value || state.today, corr: q('#let-corr').value.trim(), email: q('#let-email')?.value.trim() || l.email || '', subject: q('#let-subj').value.trim(), body: q('#let-body').value, status: q('#let-st').value, due: q('#let-due')?.value || l.due || '', theirNo: q('#let-no2')?.value.trim() || l.theirNo || '' });
  const save = async () => {
    collect();
    if (!l.subject) { q('#let-err').textContent = 'Укажите тему письма.'; q('#let-err').hidden = false; q('#let-subj').classList.add('field-bad'); q('#let-subj').focus(); return false; }
    // The number belongs to the year of the date; a letter moved to another year gets that year's next number.
    if (isNew || String(letter.date).slice(0, 4) !== l.date.slice(0, 4)) l.seq = nextLetterNo(l.dir, l.date.slice(0, 4));
    const cur = state.projects.get(p.id), list = [...(cur.letters || []).filter(x => x.id !== l.id), l];
    return write(op.update('projects', p.id, { letters: list }), `${letterNo(l)} от ${fmtDate(l.date)} — ${isNew ? 'зарегистрировано' : 'сохранено'}`);
  };
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (e.target === root || m === 'cancel') return close();
    if (m === 'unf') { l.files.splice(Number(e.target.closest('[data-m]').dataset.i), 1); drawFiles(); }
    if (m === 'del') { const cur = state.projects.get(p.id); if (await write(op.update('projects', p.id, { letters: (cur.letters || []).filter(x => x.id !== l.id) }), `${letterNo(l)} удалено`)) close(); }
    if (m === 'mail') { if (await save()) { close(); mailLetter(l); } }
  });
  q('form').addEventListener('submit', async e => { e.preventDefault(); e.stopPropagation(); if (await save()) close(); });
}
async function mailLetter(l) {
  if (typeof api.mailOpen !== 'function') return toast('Открыть в почте можно в версии для Windows.', true);
  const r = await api.mailOpen({ to: l.email, subject: `${letterNo(l)} от ${fmtDate(l.date)} — ${l.subject}`, text: l.body });
  if (!r?.ok) toast(r?.message || 'Не удалось открыть почтовую программу.', true);
  else if ((l.files || []).length) toast('Вложения добавьте в письме вручную: почтовая ссылка не умеет прикладывать файлы.');
}

const initials = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'ird-folder': ({ el }) => { irdOpen[el.dataset.id] = el.dataset.v; renderNow(); },
  'ird-upload': ({ el }) => { const pid = el.dataset.id, folder = el.closest('.ird')?.querySelector('[data-ird-folder]')?.dataset.irdFolder || 'other'; api.attachAdd(pid).then(r => irdAdd(pid, [r], folder)); },
  'sv-upload': ({ el }) => { const pid = el.dataset.id, folder = el.dataset.folder; api.attachAdd(pid).then(r => irdAdd(pid, [r], folder)); },
  'sv-files': ({ el }) => {
    const p = state.projects.get(el.dataset.id), list = (p?.irdFiles || []).filter(f => f.folder === el.dataset.folder);
    // The newest report opens; with several, the plate names the others.
    const last = list.at(-1);
    if (last) api.attachOpen(p.id, last.id).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); else if (list.length > 1) toast(`Открыт последний: ${last.name}. Ещё: ${list.slice(0, -1).map(f => f.name).join(', ')}`); });
  },
  'ird-open': ({ el }) => { api.attachOpen(el.dataset.id, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); }); },
  'ird-del': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) write(op.update('projects', p.id, { irdFiles: (p.irdFiles || []).filter(f => f.id !== el.dataset.fid) }), 'Файл убран'); },
  'ird-newfolder': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) askText('Новая папка', 'Название папки', 'Например: Согласования с сетевыми').then(name => { if (!name?.trim()) return; const id = newId(); irdOpen[p.id] = id; write(op.update('projects', p.id, { irdFolders: [...(p.irdFolders || []), { id, name: name.trim().slice(0, 80) }] }), 'Папка добавлена'); }); },
  'let-view': ({ el }) => { letterView[el.dataset.id] = el.dataset.v; renderNow(); },
  'let-new': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) askLetter(p, null, el.dataset.v); },
  'let-edit': ({ el }) => { const p = state.projects.get(el.dataset.id), l = p?.letters?.find(x => x.id === el.dataset.lid); if (l) askLetter(p, l); },
  'let-mail': ({ el }) => { const p = state.projects.get(el.dataset.id), l = p?.letters?.find(x => x.id === el.dataset.lid); if (l) mailLetter(l); },
});
/* ---------- 4.1.1: portfolio chart (item 59) — every project on one time scale, phases inside, studio load below ---------- */
let projMode = loadLocal('projMode', 'list');
function viewPortfolio(projects) {
  const rows = projects.map(p => ({ p, ph: (p.phases || []).filter(x => isDate(x.start) && isDate(x.finish) && x.key !== 'contract' && x.key !== 'an') })).filter(r => r.ph.length);
  const noPlan = projects.filter(p => !rows.some(r => r.p === p));
  if (!rows.length) return `<section class="empty"><h2>Нет сроков этапов</h2><p class="hint">График портфеля строится из сроков этапов проектов. Задайте их в проекте: кнопка «Сроки».</p></section>`;
  const all = rows.flatMap(r => r.ph.flatMap(x => [x.start, x.finish]));
  const from = addDays(all.reduce((a, b) => (a < b ? a : b)).slice(0, 8) + '01', 0), to = all.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(30, dayNum(to) - dayNum(from) + 1), x = d => ((dayNum(d) - dayNum(from)) / span) * 100;
  const months = []; for (let d = from; d <= to; d = addDays(d, 32).slice(0, 8) + '01') months.push(d);
  const every = Math.ceil(months.length / 14);
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const ticks = months.map((m, i) => `<span class="pf-tick${i % every ? ' minor' : ''}" style="left:${x(m)}%">${i % every ? '' : MON[Number(m.slice(5, 7)) - 1] + (m.slice(5, 7) === '01' || i === 0 ? ' ' + m.slice(2, 4) : '')}</span>`).join('');
  const now = state.today >= from && state.today <= to ? `<span class="pf-now" style="left:${x(state.today)}%" title="Сегодня"></span>` : '';
  // Overlapping phases (изыскания, ИРД and П often run together) go on separate lanes of the project row.
  const laned = ph => { const ends = []; return [...ph].sort((a, b) => a.start.localeCompare(b.start)).map(f => { let l = ends.findIndex(e => e < f.start); if (l < 0) { l = ends.length; ends.push(''); } ends[l] = f.finish; return { f, l }; }); };
  const body = rows.map(({ p, ph }) => { const ls = laned(ph), n = Math.max(1, ...ls.map(y => y.l + 1)); return `<div class="pf-row"><button class="pf-name linkbtn" type="button" data-act="goto-project" data-id="${esc(p.id)}" title="${esc(p.name)}">${esc(p.name)}</button><div class="pf-track" style="height:${n * 21 + 4}px">${now}
    ${ls.map(({ f, l }) => { const st = L.phaseState(f, state.today); return `<span class="pf-bar pf-${f.key} st-${st}" style="top:${l * 21 + 3}px;left:${x(f.start)}%;width:${Math.max(0.6, x(addDays(f.finish, 1)) - x(f.start))}%" title="${esc(p.name)} · ${esc(L.phaseLabel(f.key))}: ${fmtDate(f.start)} – ${fmtDate(f.finish)}">${esc(L.phaseLabel(f.key).replace('Стадия ', ''))}</span>`; }).join('')}</div></div>`; }).join('');
  // Studio load: cards in work per week across the shown projects.
  const ids = new Set(rows.map(r => r.p.id)), cards = tasksArr().filter(t => ids.has(t.projectId) && t.status !== 'done' && isDate(t.start) && isDate(t.finish));
  const weeks = []; for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
  const load = weeks.map(w => cards.filter(t => t.start <= addDays(w, 6) && t.finish >= w).length), max = Math.max(1, ...load);
  const hi = Math.max(3, Math.round(max * 0.75));
  const bars = weeks.map((w, i) => `<span class="pf-load${load[i] >= hi ? ' hi' : ''}" style="left:${x(w)}%;width:${Math.max(0.4, (7 / span) * 100 - 0.25)}%;height:${Math.round((load[i] / max) * 100)}%" title="Неделя с ${fmtDate(w)}: карточек в работе ${load[i]}"></span>`).join('');
  return `<section class="panel pf"><div class="panel-h"><h3>График портфеля</h3><span class="meta">${rows.length} ${plural(rows.length, 'проект', 'проекта', 'проектов')} · ${fmtDate(from)} — ${fmtDate(to)}</span><span class="spacer"></span>
      <span class="pf-legend">${L.PHASES.filter(([k]) => !['contract', 'an'].includes(k)).map(([k]) => `<span class="pf-key pf-${k}"></span>${esc(L.phaseLabel(k).replace('Стадия ', 'стадия '))}`).join(' ')}</span></div>
    <div class="pf-body"><div class="pf-row pf-head"><span class="pf-name"></span><div class="pf-track">${ticks}</div></div>${body}
      <div class="pf-row pf-loadrow"><span class="pf-name hint">Загрузка<br>карточек в неделю</span><div class="pf-track">${bars}${now}</div></div></div>
    ${noPlan.length ? `<p class="hint pf-noplan">Без сроков этапов (не на графике): ${noPlan.map(p => esc(p.name)).join(', ')}.</p>` : ''}</section>`;
}
function viewProjects() {
  if (isEmpty()) return emptyState();
  if (state.openProjectId) {
    const op = state.projects.get(state.openProjectId);
    if (op && !op.deletedAt) return viewProjectPage(op);
    if (SOLO) return '<section class="empty"><h2>Проект недоступен</h2><p class="hint">Его удалили или у вас больше нет к нему доступа. Это окно можно закрыть.</p></section>';
    state.openProjectId = null;
  }
  const projects = liveProjects(), archived = archivedProjects();
  const all = [...state.tasks.values()];
  const orphans = all.filter(t => !state.projects.has(t.projectId));
  const archToggle = archived.length ? `<div class="filters"><button class="btn ghostbtn sm" data-act="toggle-archive" type="button">${state.showArchive ? 'Скрыть архив' : `Показать архив (${archived.length})`}</button></div>` : '';
  // Filter by project stage (кнопки над списком); counts show how many projects are at each stage.
  const stage = state.projectStage || '';
  const stageCount = k => projects.filter(p => (p.status || '') === k).length;
  const stageBar = `<div class="filters one-row stage-bar"><span class="hint">Стадия:</span><span class="seg"><button class="btn sm ${stage ? '' : 'on'}" type="button" data-act="pstage" data-v="">Все ${projects.length}</button>${Object.entries(L.PROJECT_STATUSES).filter(([k]) => stageCount(k)).map(([k, s]) => `<button class="btn sm ${stage === k ? 'on' : ''}" type="button" data-act="pstage" data-v="${k}">${esc(s.label)} ${stageCount(k)}</button>`).join('')}${stageCount('') && stageCount('') < projects.length ? `<button class="btn sm ${stage === '-' ? 'on' : ''}" type="button" data-act="pstage" data-v="-">Без стадии ${stageCount('')}</button>` : ''}</span></div>`;
  const shownProjects = stage ? projects.filter(p => (p.status || '') === (stage === '-' ? '' : stage)) : projects;
  const modeSeg = `<span class="seg proj-mode"><button class="btn sm ${projMode === 'list' ? 'on' : ''}" type="button" data-act="proj-mode" data-v="list">Список</button><button class="btn sm ${projMode === 'portfolio' ? 'on' : ''}" type="button" data-act="proj-mode" data-v="portfolio" title="Все проекты на одной шкале: этапы и загрузка мастерской">График портфеля</button></span>`;
  if (projMode === 'portfolio') return `<div class="proj-top">${modeSeg}${projects.some(p => p.status) ? stageBar : ''}</div>` + viewPortfolio(shownProjects);
  const live = shownProjects.length ? shownProjects.map(p => projectPanel(p, all)).join('')
    : `<section class="empty"><h2>Активных проектов нет</h2><p class="hint">Заведите проект, затем добавьте в него карточки работ.</p><div class="acts"><button class="btn primary" data-act="new-project" type="button">Добавить проект</button></div></section>`;
  return `<div class="proj-top">${modeSeg}${projects.length && projects.some(p => p.status) ? stageBar : ''}</div>` + live
    + (orphans.length ? `<section class="panel"><div class="panel-h"><h3>Без проекта</h3></div>${taskTable(orphans, { showProject: false })}</section>` : '')
    + archToggle
    + (state.showArchive ? archived.map(p => projectPanel(p, all)).join('') : '');
}

function contactLine(label, value) {
  if (!value) return '';
  return `<div class="contact"><span class="lbl">${label}</span><span class="val" title="${esc(value)}">${esc(value)}</span>
    <button class="btn ghostbtn sm" data-act="copy" data-value="${esc(value)}" type="button">Копировать</button></div>`;
}
function reliabilityHtml(c) {
  // Reliability uses archived projects too: history matters after a project is closed.
  const r = L.reliability([...state.tasks.values()].filter(t => t.contractorId === c.id), state.today);
  if (r.grade === 'none') {
    return `<div class="rel"><span class="chip tone-idle">мало данных</span><span class="hint">Оценка появится после двух сданных работ${r.rated ? ` (сейчас ${r.rated})` : ''}.</span></div>`;
  }
  const tone = { ok: 'ok', warn: 'warn', bad: 'bad' }[r.grade];
  const bits = [
    `${r.onTime} из ${r.rated} в срок`,
    r.avgLate ? `ср. просрочка ${r.avgLate} дн.` : '',
    r.avgRounds != null ? `замечаний ${String(r.avgRounds).replace('.', ',')} на работу` : '',
    r.contractorShifts ? `переносов по его вине: ${r.contractorShifts}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="rel"><span class="chip tone-${tone}" title="Доля работ, сданных к контрольному сроку исполнителя">${r.pct}% в срок</span><span class="hint">${esc(bits)}</span></div>`;
}
/* ---------- folding (people and projects) ---------- */
const folded = new Set(loadLocal('folded', []));
const isFolded = key => folded.has(key);
const foldBtn = (key, on) => `<button class="tree-tg fold" type="button" data-act="fold" data-key="${esc(key)}" aria-expanded="${!on}" title="${on ? 'Развернуть' : 'Свернуть'}">${on ? '▸' : '▾'}</button>`;
function setFold(keys, on) {
  for (const k of keys) { if (on) folded.add(k); else folded.delete(k); }
  saveLocal('folded', [...folded]);
  renderNow();
}
function foldAllBar(keys) {
  return `<div class="fold-bar"><button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="1" data-keys="${esc(keys.join(' '))}"${keys.length && keys.every(isFolded) ? ' disabled' : ''}>▸ Свернуть все</button>
    <button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="0" data-keys="${esc(keys.join(' '))}"${keys.some(isFolded) ? '' : ' disabled'}>▾ Развернуть все</button></div>`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'pstage': ({ el }) => { state.projectStage = el.dataset.v; renderNow(); },
  'fold': ({ el }) => { setFold([el.dataset.key], !isFolded(el.dataset.key)); },
  'fold-all': ({ el }) => { setFold(el.dataset.keys.split(' ').filter(Boolean), el.dataset.on === '1'); },
  'proj-mode': ({ el }) => { projMode = el.dataset.v === 'portfolio' ? 'portfolio' : 'list'; saveLocal('projMode', projMode); renderNow(); },
  'goto-project': ({ id }) => {
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    state.tab = 'projects'; renderNow();
    document.getElementById('p-' + id)?.scrollIntoView({ block: 'start' });
  },
  'toggle-archive': () => { state.showArchive = !state.showArchive; renderNow(); },
});
/* ---------- «Контрагенты» (4.9): customers, contractors, suppliers — one catalogue of companies ---------- */
// A company has roles (one may be a customer and a supplier at once) and contact people; a project points to its
// customer (customerId; the name stays in `client` for reports and the customer page). Customers with their contacts
// are open to the GIP and to a chief with «видит заказчиков и их контакты», contractors and suppliers with contracts —
// to the budget people; the rest of the team sees names only (src/renderer/access.js).
let orgFilter = (v => (['all', 'customer', 'contractor', 'supplier'].includes(v) ? v : 'all'))(loadLocal('orgFilter', 'all'));
let orgQ = '', orgQTimer = null;
const orgDismissed = new Set(loadLocal('orgDismissed', [])); // «Заказчики из проектов» the user waved away
const ORG_TONE = { customer: 'ok', contractor: 'warn', supplier: 'idle' };
const LOGIN_RE = /^[a-zA-Z0-9._@-]{3,80}$/;
const orgsArr = () => [...(state.orgs?.values() || [])].sort(byName);
const orgProjects = id => [...state.projects.values()].filter(p => p.customerId === id).sort(byName);
const orgChips = o => A.orgRoles(o).map(r => `<span class="chip tone-${ORG_TONE[r]}">${A.ORG_ROLES[r].toLowerCase()}</span>`).join(' ');
const contractSum = o => (o.contracts || []).reduce((s, c) => s + (Number(c.sum) || 0), 0);
// The customer from the catalogue for a typed name: quotes and the legal form do not matter («Альфа строй» = ООО «Альфа-Строй»).
const customerByName = name => { const k = L.orgKey(name); return k ? orgsArr().find(o => A.isCustomerOrg(o) && L.orgKey(o.name) === k) || null : null; };
// Contracts are kept for contractors and suppliers (a customer's contract is the project's «Договор»).
const orgContractsOn = roles => roles.some(r => r !== 'customer') && A.canSeeOrgContracts(state.me, { roles });
const orgRoleLocked = r => (r === 'customer' ? !A.canSeeContacts(state.me) : !A.canSeeMoney(state.me));

function viewOrgs() {
  const all = orgsArr(), showMoney = A.isGip(state.me) || A.canSeeMoney(state.me);
  const count = r => (r === 'all' ? all.length : all.filter(o => A.orgRoles(o).includes(r)).length);
  const norm = v => String(v ?? '').toLowerCase().replace(/ё/g, 'е');
  const words = norm(orgQ).split(/\s+/).filter(Boolean);
  const hay = o => norm([o.name, o.inn, o.address, o.phone, o.email, ...(o.contacts || []).flatMap(c => [c.name, c.position, c.phone, c.email])].join(' '));
  const list = all.filter(o => (orgFilter === 'all' || A.orgRoles(o).includes(orgFilter)) && words.every(w => hay(o).includes(w)));
  const seg = `<span class="seg">${[['all', 'Все'], ['customer', 'Заказчики'], ['contractor', 'Подрядчики'], ['supplier', 'Поставщики']]
    .map(([k, l]) => `<button class="btn sm ${orgFilter === k ? 'on' : ''}" type="button" data-act="org-filter" data-v="${k}" aria-pressed="${orgFilter === k}">${l} <span class="cnt">${count(k)}</span></button>`).join('')}</span>`;
  return `<div class="people-h"><h2>Контрагенты</h2>${tip('orgs', 'Организации, с которыми работаем. Одна фирма может быть и заказчиком, и подрядчиком. У заказчика — контактные лица со своим входом в кабинет: каждый видит все проекты своей организации.', 'inline')}
      <span class="spacer"></span>${seg}<input id="org-q" class="org-q" type="search" placeholder="Название, ИНН, контакт" value="${esc(orgQ)}" aria-label="Поиск контрагента">${partyOn() && all.some(o => o.inn) ? '<button class="btn sm" type="button" data-act="orgcheck" title="Проверить по реестру всех, у кого записан ИНН">Сверить с ЕГРЮЛ</button>' : ''}<button class="btn sm" type="button" data-act="new-org">+ Контрагент</button></div>
    ${orgMigration()}
    ${list.length ? `<div class="tablewrap"><table class="staff-t org-t"><thead><tr><th>Организация</th><th>ИНН</th><th>Контакт</th><th class="r">Проектов</th>${showMoney ? '<th class="r">Договоры</th>' : ''}</tr></thead><tbody>
      ${list.map(o => {
        const n = orgProjects(o.id).length, k = (o.contacts || [])[0];
        return `<tr class="row" data-act="open-org" data-id="${esc(o.id)}" title="Открыть карточку"><td><b>${esc(o.name)}</b> ${orgChips(o)}${o.regStatus ? ` <span class="chip tone-bad" title="По ЕГРЮЛ${o.regCheckedAt ? ' на ' + fmtDate(o.regCheckedAt) : ''}">${esc(o.regStatus)}</span>` : ''}</td><td class="num hint">${esc(o.inn || '')}</td>
          <td class="hint">${k ? `${esc(k.name)}${k.position ? `, ${esc(k.position)}` : ''}${k.phone ? ` · ${esc(k.phone)}` : ''}${o.contacts.length > 1 ? ` <span class="cnt">+${o.contacts.length - 1}</span>` : ''}` : ''}</td>
          <td class="r num">${n || '—'}</td>${showMoney ? `<td class="r num">${o.contracts?.length ? `${o.contracts.length} · ${money(contractSum(o))}${o.contracts.some(c => contractPaid(c)) ? ` <span class="hint">· остаток ${money(o.contracts.reduce((s, c) => s + contractLeft(c), 0))}</span>` : ''}` : '—'}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`
      : `<p class="hint people-empty">${all.length ? 'Ничего не нашлось — смените фильтр или строку поиска.' : 'Каталог пока пуст. Добавьте заказчиков и подрядчиков кнопкой «+ Контрагент».'}</p>`}`;
}

/* ----- moving the old text «Заказчик» of projects into the catalogue (the user confirms each group) ----- */
function orgSuggestions() {
  const groups = new Map();
  for (const p of state.projects.values()) {
    if (p.customerId && state.orgs.has(p.customerId)) continue;
    const k = L.orgKey(p.client);
    if (!k || orgDismissed.has(k)) continue;
    const g = groups.get(k) || { key: k, names: [], projects: [] };
    if (!g.names.includes(p.client.trim())) g.names.push(p.client.trim());
    g.projects.push(p);
    groups.set(k, g);
  }
  const all = orgsArr();
  return [...groups.values()].map(g => ({ ...g, match: all.find(o => A.isCustomerOrg(o) && L.orgKey(o.name) === g.key) || null }));
}
function orgMigration() {
  if (!A.canSeeContacts(state.me) || !A.canManageCatalog(state.me)) return '';
  const list = orgSuggestions();
  if (!list.length) return '';
  const customers = orgsArr().filter(A.isCustomerOrg);
  return `<section class="panel org-mig"><div class="panel-h"><h3>Заказчики из проектов</h3><span class="meta">${list.length}</span></div>
    <p class="hint">В этих проектах заказчик записан просто текстом. Создайте его в каталоге или выберите того, кто уже есть, — проекты привяжутся к нему, и в кабинете заказчик увидит их все. Похожие написания собраны вместе.</p>
    ${list.map(g => `<div class="org-sug" data-key="${esc(g.key)}"><div class="grow"><b>${esc(g.names[0])}</b>${g.names.length > 1 ? ` <span class="hint">и как ${g.names.slice(1).map(n => `«${esc(n)}»`).join(', ')}</span>` : ''}<br><span class="hint">${g.projects.map(p => esc(p.name)).join(' · ')}</span></div>
      <select class="org-sug-to" aria-label="К кому привязать"><option value="">новый заказчик «${esc(g.names[0])}»</option>${customers.map(o => `<option value="${esc(o.id)}"${g.match?.id === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
      <button class="btn sm primary" type="button" data-act="org-mig-link">Привязать проекты (${g.projects.length})</button><button class="btn ghostbtn sm" type="button" data-act="org-mig-skip">Не предлагать</button></div>`).join('')}</section>`;
}
async function orgMigLink(el) {
  const row = el.closest('.org-sug'), g = row && orgSuggestions().find(x => x.key === row.dataset.key);
  if (!g) return;
  let id = row.querySelector('.org-sug-to').value;
  const ops = [];
  if (!state.orgs.has(id)) {
    id = newId();
    ops.push(op.set('orgs', id, { name: g.names[0], roles: ['customer'], contacts: [], createdAt: new Date().toISOString(), createdBy: state.me?.id || '' }));
  }
  const name = state.orgs.get(id)?.name || g.names[0];
  for (const p of g.projects) ops.push(op.update('projects', p.id, { customerId: id, client: name }));
  if (await write(ops, `${name}: привязано проектов — ${g.projects.length}`)) syncOrgCabinet(id);
}

/* ----- the card of a company ----- */
function openOrg(id, preset = {}) {
  const o = id ? state.orgs.get(id) : { roles: [orgFilter !== 'all' && !orgRoleLocked(orgFilter) ? orgFilter : A.canSeeContacts(state.me) ? 'customer' : 'contractor'], ...preset };
  if (!o) return toast('Контрагент не найден.', true);
  if (id) noteRecent('org', id);
  state.drawer = { kind: 'org', id };
  const projectsBox = () => {
    const ps = id ? orgProjects(id) : [];
    return ps.length ? `<div class="org-projs">${ps.map(p => `<button class="linkbtn" type="button" data-act="open-project" data-id="${esc(p.id)}">${esc(p.name)}${p.code ? ` <span class="hint">${esc(p.code)}</span>` : ''}${p.archived ? ' <span class="hint">в архиве</span>' : ''}</button>`).join('')}</div>`
      : '<p class="hint">Проектов пока нет. Заказчик выбирается в окне проекта, в поле «Заказчик».</p>';
  };
  if (id && !A.orgCard(state.me, o)) {
    state.draft = null;
    drawerShell({ title: esc(o.name), form: false,
      body: `<p>${orgChips(o)}</p><p class="hint">Реквизиты и контакты этой организации открыты ГИПу и тем, кому он дал доступ ${A.isCustomerOrg(o) ? 'к заказчикам и их контактам' : 'к бюджету'}.</p>${A.isCustomerOrg(o) ? `<div class="sub"><h3>Проекты заказчика</h3>${projectsBox()}</div>` : ''}` });
    return;
  }
  const roles = A.orgRoles(o);
  state.draft = { contacts: structuredClone(o.contacts || []), contracts: structuredClone(o.contracts || []).map(c => ({ ...c, sum: c.sum ? String(c.sum) : '' })) };
  const f = (name, label, attrs = '', wide = false) => `<div class="f${wide ? ' wide' : ''}"><label for="o-${name}">${label}</label><input id="o-${name}" name="${name}" value="${esc(o[name] || '')}" ${attrs}></div>`;
  drawerShell({
    title: id ? esc(o.name) : 'Новый контрагент',
    wide: !!id,
    body: `<div class="fgrid">
      <div class="f wide"><label class="req" for="o-name">Название</label><input id="o-name" name="name" value="${esc(o.name || '')}" placeholder="ООО «Альфа-Строй»" maxlength="200"></div>
      <div class="f wide"><span class="lbl-t">Роль</span><div class="org-roles">${Object.entries(A.ORG_ROLES).map(([k, l]) => `<label class="chk"><input type="checkbox" name="role-${k}" data-org-role${roles.includes(k) ? ' checked' : ''}${orgRoleLocked(k) ? ' disabled title="Эту роль отмечает ГИП"' : ''}> ${l}</label>`).join('')}</div>
        <span class="hint">Одна организация может быть и заказчиком, и подрядчиком.</span></div>
      <div class="f wide"><label for="o-inn">ИНН</label><div class="row-in"><input id="o-inn" name="inn" value="${esc(o.inn || '')}" inputmode="numeric" maxlength="14" placeholder="10 или 12 цифр — остальное заполнится из ЕГРЮЛ">${partyServer() ? `<button class="btn" type="button" data-act="party-fill"${partyOn() ? '' : ' disabled title="На сервере нет ключа DaData"'}>Заполнить по ИНН</button>` : ''}</div>
        <span class="hint" id="o-inn-hint"></span><div id="o-party" class="o-party" hidden></div></div>
      ${f('fullName', 'Полное наименование', 'maxlength="500" placeholder="Общество с ограниченной ответственностью «…»"', true)}
      ${f('kpp', 'КПП', 'inputmode="numeric" maxlength="9"')}${f('ogrn', 'ОГРН / ОГРНИП', 'inputmode="numeric" maxlength="15"')}
      ${f('director', 'Руководитель', 'maxlength="200" placeholder="Генеральный директор Иванов Иван Иванович"', true)}
      ${f('phone', 'Телефон', 'type="tel" maxlength="40" placeholder="+7 4217 00-00-00"')}${f('email', 'Почта', 'type="email" maxlength="120"')}${f('site', 'Сайт', 'maxlength="120"')}
      ${f('address', 'Адрес', 'maxlength="200" placeholder="681000, г. Комсомольск-на-Амуре, …"', true)}
      <details class="f wide more"${o.requisites || o.note ? ' open' : ''}><summary>Банковские реквизиты, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="o-req">Банковские реквизиты</label><textarea id="o-req" name="requisites" maxlength="1000" placeholder="р/с, банк, БИК, к/с">${esc(o.requisites || '')}</textarea></div>
        <div class="f wide"><label for="o-note">Примечание</label><textarea id="o-note" name="note" maxlength="2000">${esc(o.note || '')}</textarea></div>
      </div></details>
    </div>
    <div class="sub"><h3>Контактные лица</h3><div id="org-contacts"></div></div>
    <div class="sub" id="org-contracts-sub"${orgContractsOn(roles) ? '' : ' hidden'}><h3>Договоры</h3><div id="org-contracts"></div></div>
    ${id ? orgPeopleHtml(id) : ''}
    ${id && A.isCustomerOrg(o) ? `<div class="sub"><h3>Проекты заказчика</h3>${projectsBox()}</div><div id="org-cab"></div>` : ''}
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button><span class="spacer"></span>
      ${id ? '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>' : ''}`,
  });
  renderOrgContacts(); renderOrgContracts(); orgInnHint(); renderOrgCabinet();
  partyLast = String(o.inn || ''); partySeen = null; partyDiff = [];
  partyIntro({ ...o, id });
  markClean();
  if (!id) $('#o-inn').focus();
}
function renderOrgContacts() {
  const box = $('#org-contacts');
  if (!box || !state.draft) return;
  const list = state.draft.contacts;
  box.innerHTML = `${list.length ? `<div class="org-rows">${list.map((c, i) => `<div class="org-row org-contact">
      <input data-oc="${i}" data-k="name" value="${esc(c.name || '')}" placeholder="ФИО" maxlength="160" aria-label="ФИО">
      <input data-oc="${i}" data-k="position" value="${esc(c.position || '')}" placeholder="Должность: директор, технадзор" maxlength="120" aria-label="Должность">
      <input data-oc="${i}" data-k="phone" type="tel" value="${esc(c.phone || '')}" placeholder="Телефон" maxlength="40" aria-label="Телефон">
      <input data-oc="${i}" data-k="email" type="email" value="${esc(c.email || '')}" placeholder="Почта" maxlength="120" aria-label="Почта">
      <button class="icon" type="button" data-act="org-contact-del" data-i="${i}" title="Убрать контактное лицо" aria-label="Убрать">✕</button></div>`).join('')}</div>` : '<p class="hint">Пока никого.</p>'}
    <button class="btn sm" type="button" data-act="org-contact-add">+ Контактное лицо</button>`;
}
function renderOrgContracts() {
  const box = $('#org-contracts');
  if (!box || !state.draft) return;
  const list = state.draft.contracts, projs = [...state.projects.values()].sort(byName);
  const total = list.reduce((s, c) => s + (money0(c.sum) || 0), 0);
  box.innerHTML = `${list.length ? `<div class="org-rows">${list.map((c, i) => `<div class="org-row org-contract">
      <input data-ok="${i}" data-k="no" value="${esc(c.no || '')}" placeholder="№ договора" maxlength="80" aria-label="Номер">
      <input data-ok="${i}" data-k="date" type="date" value="${esc(c.date || '')}" aria-label="Дата">
      <input data-ok="${i}" data-k="sum" value="${esc(c.sum || '')}" inputmode="decimal" placeholder="Сумма, ₽" maxlength="20" aria-label="Сумма">
      <input data-ok="${i}" data-k="subject" value="${esc(c.subject || '')}" placeholder="Предмет: раздел КР, поставка…" maxlength="200" aria-label="Предмет">
      <select data-ok="${i}" data-k="projectId" aria-label="Проект"><option value="">— проект —</option>${projs.map(p => `<option value="${esc(p.id)}"${p.id === c.projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <button class="icon" type="button" data-act="org-contract-del" data-i="${i}" title="Убрать договор" aria-label="Убрать">✕</button></div>
      ${contractPayHtml(c, i)}`).join('')}</div>
      <p class="hint" id="org-ctotal">${contractsTotalText(list)}</p>` : '<p class="hint">Договоров пока нет.</p>'}
    <button class="btn sm" type="button" data-act="org-contract-add">+ Договор</button>`;
}
// 4.11: payments under a contract — paid so far and what is left.
const contractPaid = c => (Array.isArray(c.payments) ? c.payments : []).reduce((s, x) => s + (Number(x.sum) || 0), 0);
const contractLeft = c => (money0(c.sum) || 0) - contractPaid(c);
function contractsTotalText(list) {
  const total = list.reduce((s, c) => s + (money0(c.sum) || 0), 0), paid = list.reduce((s, c) => s + contractPaid(c), 0);
  return `Всего по договорам: ${money(total)} · оплачено ${money(paid)} · остаток ${money(total - paid)}`;
}
function contractPayHtml(c, i) {
  const pays = Array.isArray(c.payments) ? c.payments : [], left = contractLeft(c);
  return `<div class="org-pay" data-pay="${i}"><span class="hint">Оплачено <b>${money(contractPaid(c))}</b> · остаток <b class="${left < 0 ? 'neg' : ''}">${money(left)}</b>${left < 0 ? ' — переплата' : ''}</span>
    ${pays.map((x, j) => `<span class="chip pay-chip">${esc(fmtDate(x.date))} — ${money(x.sum)}${x.note ? ` · ${esc(x.note)}` : ''}<button class="icon" type="button" data-act="org-pay-del" data-i="${i}" data-j="${j}" aria-label="Убрать оплату">✕</button></span>`).join('')}
    <span class="pay-add"><input type="date" id="org-pay-d-${i}" value="${todayStr()}" aria-label="Дата оплаты"><input id="org-pay-s-${i}" inputmode="decimal" placeholder="Сумма, ₽" maxlength="20" aria-label="Сумма оплаты"><input id="org-pay-n-${i}" placeholder="п/п №, за что" maxlength="80" aria-label="Примечание"><button class="btn ghostbtn sm" type="button" data-act="org-pay-add" data-i="${i}">+ оплата</button></span></div>`;
}
// The totals follow the typed sums without redrawing the rows (the caret stays put).
function renderOrgContractsTotal() {
  const el = $('#org-ctotal');
  if (!el || !state.draft) return;
  el.textContent = contractsTotalText(state.draft.contracts);
  state.draft.contracts.forEach((c, i) => { const box = document.querySelector(`#org-contracts [data-pay="${i}"] > .hint`); if (box) { const left = contractLeft(c); box.innerHTML = `Оплачено <b>${money(contractPaid(c))}</b> · остаток <b class="${left < 0 ? 'neg' : ''}">${money(left)}</b>${left < 0 ? ' — переплата' : ''}`; } });
}
function orgInnHint() {
  const el = $('#o-inn-hint'), v = val('inn');
  if (!el) return;
  const bad = L.innError(v), twin = !bad && v && orgsArr().find(x => x.id !== state.drawer?.id && x.inn === v.replace(/\s+/g, ''));
  el.textContent = bad || (twin ? `Уже есть в каталоге: ${twin.name}` : '');
  el.classList.toggle('neg', !!(bad || twin));
}
const orgRolesPicked = before => Object.keys(A.ORG_ROLES).filter(k => { const b = $(`#dform [name="role-${k}"]`); return b?.disabled ? A.orgRoles(before).includes(k) : !!b?.checked; });

async function submitOrg(keepOpen = false) {
  const { id } = state.drawer, before = id ? state.orgs.get(id) : {};
  formError('');
  const roles = orgRolesPicked(before);
  const data = { name: val('name'), fullName: val('fullName'), director: val('director'), roles, inn: val('inn').replace(/\s+/g, ''), kpp: val('kpp'), ogrn: val('ogrn'), phone: val('phone'), email: val('email'), site: val('site'), address: val('address'), requisites: val('requisites'), note: val('note') };
  if (!data.name) return formError('Укажите название организации.', '', 'name');
  if (!roles.length) return formError('Отметьте роль: заказчик, подрядчик или поставщик.');
  const innBad = L.innError(data.inn);
  if (innBad) return formError(innBad, '', 'inn');
  const twin = data.inn && orgsArr().find(x => x.id !== id && x.inn === data.inn);
  if (twin) return formError(`ИНН ${data.inn} уже есть в каталоге: «${twin.name}». Откройте её карточку и отметьте нужную роль там.`, '', 'inn');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
  const contacts = state.draft.contacts.map(c => ({ ...c, name: String(c.name || '').trim(), position: String(c.position || '').trim(), phone: String(c.phone || '').trim(), email: String(c.email || '').trim() }))
    .filter(c => c.name || c.position || c.phone || c.email || c.cabinetId);
  if (contacts.some(c => !c.name)) return formError('У каждого контактного лица укажите ФИО.');
  if (contacts.some(c => c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))) return formError('Проверьте почту контактного лица.');
  data.contacts = contacts;
  if (orgContractsOn(roles)) {
    const list = [];
    for (const c of state.draft.contracts) {
      const no = String(c.no || '').trim(), subject = String(c.subject || '').trim(), s = String(c.sum || '').trim();
      if (!no && !subject && !s && !c.date) continue;
      const sum = s ? parseMoney(s) : 0;
      if (Number.isNaN(sum) || sum < 0) return formError(`Сумма договора ${no ? `№ ${no}` : ''} — число, например 1 250 000.`);
      list.push({ id: c.id, no, date: isDate(c.date) ? c.date : '', sum, subject, projectId: state.projects.has(c.projectId) ? c.projectId : '',
        payments: (Array.isArray(c.payments) ? c.payments : []).filter(x => isDate(x.date) && Number(x.sum) > 0).map(x => ({ id: x.id, date: x.date, sum: Number(x.sum), note: String(x.note || '').slice(0, 80) })) });
    }
    data.contracts = list;
  }
  Object.assign(data, partyStamp(data.inn));
  const oid = id || newId();
  const ops = [id ? op.update('orgs', id, data) : op.set('orgs', oid, { ...data, createdAt: new Date().toISOString(), createdBy: state.me?.id || '' })];
  // Projects keep the customer's name in «client» (reports, the customer page): a renamed customer is renamed there too.
  if (id && A.canManageCatalog(state.me)) for (const p of orgProjects(id)) if (p.client !== data.name) ops.push(op.update('projects', p.id, { client: data.name }));
  if (!(await write(ops, id ? 'Контрагент сохранён' : 'Контрагент добавлен'))) return false;
  if (keepOpen) { await refresh(); openOrg(oid); return true; }
  closeDrawer();
  return true;
}

/* ----- requisites by INN from ЕГРЮЛ / ЕГРИП: the Сервер Пульта asks DaData with the team's key (4.9.2) ----- */
let partyLast = '', partyTimer = null, partyDiff = [], partySeen = null; // partySeen: { inn, status } of the last lookup
const PARTY_FIELDS = [['name', 'Название'], ['fullName', 'Полное наименование'], ['kpp', 'КПП'], ['ogrn', 'ОГРН'], ['address', 'Адрес'], ['director', 'Руководитель']];
const partyOn = () => !!state.remote?.server?.party;            // the server has the key
const partyServer = () => !!state.remote && !!api.partyLookup;   // this Пульт works with the server
// What the card says under the INN before any lookup.
function partyIntro(o) {
  const box = $('#o-party');
  if (!box) return;
  const gip = A.isGip(state.me);
  const msg = !partyServer() ? (o.id ? '' : 'Название, КПП, ОГРН, адрес и руководитель будут подтягиваться по ИНН, когда Пульт подключён к Серверу Пульта.')
    : !partyOn() ? `Заполнение по ИНН ждёт ключа DaData на сервере.${gip ? ' <button class="linkbtn" type="button" data-act="party-key">Ввести ключ…</button>' : ' Его вводит ГИП.'}`
    : o.regCheckedAt ? `Сверено с ЕГРЮЛ ${fmtDate(o.regCheckedAt)}${o.regStatus ? ` — <b class="neg">${esc(o.regStatus)}</b>` : ''}.` : '';
  box.hidden = !msg;
  box.innerHTML = msg ? `<p class="hint">${msg}</p>` : '';
}
// Typing the INN: once it is whole and right, the card asks the registry by itself. Empty fields fill, differing ones
// are offered with «Заменить» — nothing typed by hand is overwritten silently.
function partyAuto() {
  clearTimeout(partyTimer);
  const inn = val('inn').replace(/\s+/g, '');
  if (!partyOn() || !inn || L.innError(inn) || inn === partyLast) return;
  partyTimer = setTimeout(() => partyFill(true), 350);
}
async function partyFill(auto = false) {
  const box = $('#o-party');
  if (!box) return;
  const inn = val('inn').replace(/\s+/g, ''), bad = inn ? L.innError(inn) : 'Введите ИНН — 10 или 12 цифр.';
  if (bad) { if (!auto) formError(bad, '', 'inn'); return; }
  partyLast = inn;
  box.hidden = false;
  box.innerHTML = '<p class="hint">Ищем в ЕГРЮЛ…</p>';
  const r = await api.partyLookup([inn]);
  if (!$('#o-party') || val('inn').replace(/\s+/g, '') !== inn) return; // the card closed or the INN changed meanwhile
  const one = r.ok ? r.results?.[0] : r;
  if (!one?.ok) { box.innerHTML = `<p class="neg">${esc(one?.message || 'Не получилось.')}</p>`; return; }
  const p = one.party, filled = [];
  partySeen = { inn, status: p.status || '' };
  partyDiff = [];
  for (const [k, label] of PARTY_FIELDS) {
    const el = $(`#dform [name="${k}"]`), v = p[k];
    if (!el || !v) continue;
    if (!el.value.trim()) { el.value = v; filled.push(label); } else if (el.value.trim() !== v) partyDiff.push({ k, label, v });
  }
  renderPartyBox(p, filled);
}
const partyStatusLine = p => (p.status ? `<p class="neg"><b>По ЕГРЮЛ организация ${esc(p.status)}${p.liquidated ? ` (${fmtDate(p.liquidated)})` : ''}.</b> Проверьте, прежде чем заключать договор.</p>` : '');
function renderPartyBox(p, filled = []) {
  const box = $('#o-party');
  if (!box) return;
  box.innerHTML = `${partyStatusLine(p)}
    ${filled.length ? `<p class="okv">Заполнено из ЕГРЮЛ: ${filled.join(', ')}.</p>` : ''}
    ${partyDiff.length ? `<div class="party-diff">${partyDiff.map(d => `<div class="party-row"><span class="grow"><b>${esc(d.label)}</b> в реестре: ${esc(d.v)}</span><button class="btn ghostbtn sm" type="button" data-act="party-take" data-k="${d.k}">Заменить</button></div>`).join('')}
      ${partyDiff.length > 1 ? '<button class="btn sm" type="button" data-act="party-take-all">Заменить всё по реестру</button>' : ''}</div>` : filled.length ? '' : '<p class="hint">Сведения совпадают с ЕГРЮЛ.</p>'}`;
}
function partyTake(keys) {
  for (const k of keys) { const d = partyDiff.find(x => x.k === k), el = $(`#dform [name="${k}"]`); if (d && el) el.value = d.v; }
  partyDiff = partyDiff.filter(x => !keys.includes(x.k));
  const box = $('#o-party');
  if (box && !partyDiff.length) box.innerHTML = '<p class="okv">Заменено по реестру — не забудьте сохранить.</p>';
  else renderPartyBox({});
}
// What the save adds after a lookup of this INN: the date of the check and the registry status.
const partyStamp = inn => (partySeen && partySeen.inn === inn ? { regCheckedAt: todayStr(), regStatus: partySeen.status } : {});

// The team's key — the GIP enters it once, it stays on the server.
function openPartyKey() {
  const has = partyOn();
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-title" novalidate><h2 id="pk-title">Реквизиты по ИНН</h2>
    <p class="hint">Название, полное наименование, КПП, ОГРН, адрес и руководитель подтягиваются из ЕГРЮЛ и ЕГРИП через сервис DaData. Зарегистрируйтесь на dadata.ru (бесплатный тариф — до 10 000 запросов в день), в личном кабинете скопируйте «API-ключ» и вставьте сюда.</p>
    <p class="hint">Ключ хранится только на Сервере Пульта — на компьютеры и телефоны сотрудников он не попадает; в DaData уходит только ИНН. Работает у всех, кому открыты контрагенты.</p>
    <div class="f"><label for="pk-key">API-ключ DaData</label><input id="pk-key" type="password" autocomplete="off" maxlength="80" placeholder="${has ? 'сохранён — оставьте пустым, чтобы не менять' : '40 латинских букв и цифр'}"></div>
    <p class="neg" id="pk-err"></p>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button>${api.openDadata ? '<button class="btn ghostbtn" type="button" data-m="site">Открыть dadata.ru</button>' : ''}${has ? '<button class="btn" type="button" data-m="off">Удалить ключ</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelector('#pk-key').focus();
  const save = async k => {
    const r = await api.serverCall('partyKeySet', k);
    if (!r?.ok) { root.querySelector('#pk-err').textContent = r?.message || 'Не получилось.'; root.querySelector('#pk-key').focus(); return; }
    close();
    toast(r.has ? 'Ключ DaData на сервере — реквизиты по ИНН работают у всей команды' : 'Ключ DaData удалён с сервера');
    await refresh(); await remoteStatus();
    if ($('#o-party') && state.drawer?.kind === 'org') { partyLast = ''; if (r.has) partyFill(true); else partyIntro(state.orgs.get(state.drawer.id) || {}); }
    if (state.tab === 'orgs') renderNow();
  };
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'off') save('');
    if (e.target.dataset.m === 'site') api.openDadata();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const k = root.querySelector('#pk-key').value.trim(); if (!k && has) return close(); if (!k) { root.querySelector('#pk-err').textContent = 'Вставьте ключ.'; return; } save(k); });
}

/* ----- «Сверить с ЕГРЮЛ»: every counterparty with an INN at once; differences ticked, «Обновить отмеченное» ----- */
let orgCheck = null; // { running, done, total, noInn, error, items: [{ id, inn, party?, message?, diffs: [{ k, label, cur, v, on }] }] }
async function runOrgCheck() {
  const mine = orgsArr().filter(o => A.orgCard(state.me, o));
  const list = mine.filter(o => o.inn && !L.innError(o.inn));
  orgCheck = { running: true, done: 0, total: list.length, noInn: mine.filter(o => !o.inn).length, error: '', items: [] };
  state.drawer = { kind: 'orgcheck' };
  state.draft = null;
  drawerShell({ title: 'Сверка с ЕГРЮЛ', wide: true, form: false, body: '<div id="orgcheck-box"></div>' });
  renderOrgCheck();
  for (let i = 0; i < list.length; i += 20) {
    if (state.drawer?.kind !== 'orgcheck') return; // closed — stop asking
    const chunk = list.slice(i, i + 20);
    const r = await api.partyLookup(chunk.map(o => o.inn));
    if (!r.ok) { orgCheck.error = r.message; break; }
    const byInn = new Map(r.results.map(x => [x.inn, x]));
    for (const o of chunk) {
      const x = byInn.get(o.inn) || { ok: false, message: 'Нет ответа.' };
      if (!x.ok) { orgCheck.items.push({ id: o.id, inn: o.inn, message: x.message, diffs: [] }); if (x.fatal || /лимит|ключ|Ключ|связи/.test(x.message)) orgCheck.error = x.message; continue; }
      const p = x.party;
      // The short name is often our own («Газпром (наш)») — offered, not ticked; empty fields and real changes are ticked.
      const diffs = PARTY_FIELDS.filter(([k]) => p[k] && String(o[k] || '').trim() !== p[k])
        .map(([k, label]) => ({ k, label, cur: String(o[k] || '').trim(), v: p[k], on: k !== 'name' || !o[k] }));
      orgCheck.items.push({ id: o.id, inn: o.inn, party: p, diffs });
    }
    orgCheck.done = Math.min(list.length, i + chunk.length);
    renderOrgCheck();
    if (orgCheck.error) break;
  }
  orgCheck.running = false;
  renderOrgCheck();
}
function renderOrgCheck() {
  const box = $('#orgcheck-box'), c = orgCheck;
  if (!box || !c) return;
  const changed = c.items.filter(x => x.diffs.length), flagged = c.items.filter(x => x.party?.status), missing = c.items.filter(x => !x.party);
  const ticked = changed.reduce((n, x) => n + x.diffs.filter(d => d.on).length, 0);
  const show = c.items.filter(x => x.diffs.length || x.party?.status || !x.party);
  box.innerHTML = `<p>${c.running ? `Проверяем: ${c.done} из ${c.total}…` : `Проверено: ${c.done} из ${c.total}.`}
      ${changed.length ? ` Расхождения: <b>${changed.length}</b>.` : ''}${flagged.length ? ` <span class="neg">Не действуют: ${flagged.length}.</span>` : ''}${missing.length ? ` Не найдены: ${missing.length}.` : ''}${c.noInn ? ` <span class="hint">Без ИНН (не проверить): ${c.noInn}.</span>` : ''}</p>
    ${c.error ? `<p class="neg">${esc(c.error)}</p>` : ''}
    ${!c.running && !show.length && !c.error ? '<p class="okv">Все сведения совпадают с ЕГРЮЛ.</p>' : ''}
    ${show.map((x, i) => { const o = state.orgs.get(x.id); if (!o) return ''; const n = c.items.indexOf(x);
      return `<div class="oc-item"><div class="oc-h"><button class="linkbtn" type="button" data-act="open-org" data-id="${esc(o.id)}"><b>${esc(o.name)}</b></button> <span class="hint">ИНН ${esc(x.inn)}</span>
        ${x.party?.status ? ` <span class="chip tone-bad">${esc(x.party.status)}${x.party.liquidated ? ' ' + fmtDate(x.party.liquidated) : ''}</span>` : ''}${x.party ? '' : ` <span class="hint">${esc(x.message || '')}</span>`}</div>
        ${x.diffs.map(d => `<label class="chk oc-row"><input type="checkbox" data-oc-pick="${n}:${d.k}"${d.on ? ' checked' : ''}> <span class="oc-f">${esc(d.label)}</span>
          <span class="oc-v">${d.cur ? `<s class="hint">${esc(d.cur)}</s> → ` : '<span class="hint">пусто</span> → '}${esc(d.v)}</span></label>`).join('')}</div>`; }).join('')}
    ${changed.length || flagged.length ? `<div class="oc-acts"><button class="btn primary" type="button" data-act="orgcheck-apply"${c.running ? ' disabled title="Дождитесь окончания проверки"' : ''}>Обновить отмеченное (${ticked})</button>
      <button class="btn ghostbtn sm" type="button" data-act="orgcheck-all" data-on="1">Отметить всё</button><button class="btn ghostbtn sm" type="button" data-act="orgcheck-all" data-on="0">Снять всё</button></div>` : ''}`;
}
async function applyOrgCheck() {
  const c = orgCheck, today = todayStr(), ops = [];
  if (!c || c.running) return;
  let fields = 0;
  for (const x of c.items) {
    const o = state.orgs.get(x.id);
    if (!o || !x.party) continue;
    const patch = { regCheckedAt: today, regStatus: x.party.status || '' };
    for (const d of x.diffs) if (d.on) { patch[d.k] = d.v; fields++; }
    ops.push(op.update('orgs', o.id, patch));
    if (patch.name && patch.name !== o.name && A.canManageCatalog(state.me)) for (const p of orgProjects(o.id)) ops.push(op.update('projects', p.id, { client: patch.name }));
  }
  if (!ops.length) return;
  if (await write(ops, fields ? `Обновлено по ЕГРЮЛ: полей ${fields}` : 'Отмечено: сверено с ЕГРЮЛ')) { closeDrawer(); orgCheck = null; }
}

/* ----- the customer cabinet from the company's card: a login for each contact person, all projects of the customer ----- */
function renderOrgCabinet() {
  const box = $('#org-cab'), id = state.drawer?.kind === 'org' && state.drawer.id, o = id && state.orgs.get(id);
  if (!box || !o) return;
  if (!cab?.allowed || !A.canSeeContacts(state.me)) { box.innerHTML = ''; return; }
  if (!cab.configured) {
    box.innerHTML = '<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Кабинет пока не запущен. Запустите его в любом проекте на вкладке «Для заказчика» (или подключите сервер Пульта) — тогда здесь можно будет открыть вход каждому контактному лицу.</p></div>';
    return;
  }
  if (!cabCustomers && !cabLoadErr) { loadCabCustomers(); box.innerHTML = '<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Загружаем…</p></div>'; return; }
  const ps = orgProjects(id), want = ps.map(p => p.id);
  const linkedIds = new Set(orgsArr().flatMap(x => (x.contacts || []).map(k => k.cabinetId)).filter(Boolean));
  const free = (cabCustomers || []).filter(c => !linkedIds.has(c.id));
  const unpub = ps.filter(p => !cab.published[p.id]);
  const person = k => {
    const c = k.cabinetId && cabCustomer(k.cabinetId);
    if (!c) return `<div class="cab-person"><div class="grow"><b>${esc(k.name)}</b>${k.position ? ` <span class="hint">${esc(k.position)}</span>` : ''}<br><span class="hint">${k.cabinetId ? 'вход удалён в кабинете' : 'входа нет'}</span></div>
      <div class="acts"><input id="org-login-${esc(k.id)}" class="org-login" placeholder="логин: ivanov" maxlength="80" aria-label="Логин для ${esc(k.name)}"><button class="btn sm" type="button" data-act="org-cab-open" data-id="${esc(k.id)}">Открыть вход</button></div></div>`;
    const miss = want.filter(pid => !c.projectIds.includes(pid)).length;
    return `<div class="cab-person"><div class="grow"><b>${esc(k.name)}</b> <span class="hint">${esc(c.login)}</span>${c.disabled ? ' <span class="chip tone-bad">вход закрыт</span>' : ''}${miss ? ` <span class="chip tone-warn">не видит проектов: ${miss}</span>` : ''}<br><span class="hint">${c.lastLoginAt ? 'последний вход ' + cabTime(c.lastLoginAt) : 'ещё не входил'}</span></div>
      <div class="acts"><button class="btn ghostbtn sm" type="button" data-act="cab-reset" data-id="${esc(c.id)}">Новый пароль</button><button class="btn ghostbtn sm" type="button" data-act="cab-toggle" data-id="${esc(c.id)}">${c.disabled ? 'Открыть вход' : 'Закрыть вход'}</button></div></div>`;
  };
  const anyMiss = (o.contacts || []).some(k => { const c = k.cabinetId && cabCustomer(k.cabinetId); return c && want.some(pid => !c.projectIds.includes(pid)); });
  box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3>
    <p class="hint">Каждое контактное лицо входит под своим логином и видит все проекты организации${ps.length ? ` (сейчас ${ps.length})` : ''}. Новый проект этого заказчика добавится в кабинет сам.</p>
    ${cabLoadErr ? `<p class="neg">${esc(cabLoadErr)} <button class="linkbtn" type="button" data-act="cab-reload">Повторить</button></p>` : ''}
    ${unpub.length ? `<p class="warnv">Не опубликованы: ${unpub.map(p => esc(p.name)).join(', ')} — заказчик их пока не видит. <button class="btn sm" type="button" data-act="org-cab-publish">Опубликовать</button></p>` : ''}
    ${cabPw ? `<div class="cab-pw"><b>Доступ для ${esc(cabPw.name)}</b><div>Адрес: <code>${esc(cab.publicUrl || cab.url)}</code></div><div>Логин: <code>${esc(cabPw.login)}</code> · Пароль: <code>${esc(cabPw.password)}</code></div>
      <span class="hint">Пароль показывается один раз — передайте его заказчику.</span><div><button class="btn sm" type="button" data-act="cab-pw-copy">Скопировать для заказчика</button><button class="btn ghostbtn sm" type="button" data-act="cab-pw-hide">Скрыть</button></div></div>` : ''}
    ${(o.contacts || []).length ? `<div class="cab-people">${o.contacts.map(person).join('')}</div>` : '<p class="hint">Добавьте контактных лиц выше и сохраните карточку — здесь появится кнопка «Открыть вход».</p>'}
    ${anyMiss ? '<div class="cab-row"><button class="btn sm" type="button" data-act="org-cab-sync">Открыть им все проекты заказчика</button></div>' : ''}
    ${free.length ? `<div class="row-in cab-add"><select id="org-cab-free" aria-label="Вход, который уже есть в кабинете"><option value="">— уже есть в кабинете, ни к кому не привязан —</option>${free.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.login)})</option>`).join('')}</select><button class="btn sm" type="button" data-act="org-cab-adopt">Привязать к организации</button></div>` : ''}
  </div>`;
}
// The draft follows what was saved straight away (a login), so «Сохранить» later does not drop it.
async function orgSaveContacts(o, contacts, okText) {
  const clean = formSnapshot() === state.dirtyBase;
  if (!(await write(op.update('orgs', o.id, { contacts }), okText))) return false;
  if (state.draft && state.drawer?.id === o.id) {
    for (const k of contacts) { const d = state.draft.contacts.find(x => x.id === k.id); if (d) d.cabinetId = k.cabinetId; else state.draft.contacts.push({ ...k }); }
    renderOrgContacts();
    if (clean) markClean();
  }
  return true;
}
async function orgCabOpen(kid) {
  const o = state.orgs.get(state.drawer?.id), k = o?.contacts?.find(x => x.id === kid);
  if (!k) return;
  const login = ($(`#org-login-${kid}`)?.value || '').trim();
  if (!LOGIN_RE.test(login)) return toast('Логин — латиница, цифры, точка, дефис; от 3 знаков.', true);
  const r = await cabAction(api.cabinetCustomerCreate({ name: `${k.name}, ${o.name}`.slice(0, 120), login, projectIds: orgProjects(o.id).map(p => p.id) }));
  if (!r) return;
  cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  await orgSaveContacts(o, o.contacts.map(x => (x.id === kid ? { ...x, cabinetId: r.customer.id } : x)), null);
  await loadCabCustomers(true);
}
async function orgCabAdopt() {
  const o = state.orgs.get(state.drawer?.id), c = cabCustomer($('#org-cab-free')?.value);
  if (!o || !c) return toast('Выберите вход из списка.', true);
  const name = c.name.replace(new RegExp(`,\\s*${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '').trim() || c.name;
  if (!(await orgSaveContacts(o, [...(o.contacts || []), { id: newId(), name, position: '', phone: '', email: '', cabinetId: c.id }], `${name}: вход привязан к «${o.name}»`))) return;
  await syncOrgCabinet(o.id);
  renderOrgCabinet();
}
// Every login of the customer's contact people sees all projects of the customer. Projects given by hand that belong
// to no customer of the catalogue stay; projects of another customer go.
async function syncOrgCabinet(orgId) {
  const o = state.orgs?.get(orgId);
  if (!o || !cab?.configured || !A.canSeeContacts(state.me)) return 0;
  if (!cabCustomers) await loadCabCustomers(true);
  if (!cabCustomers) return 0;
  const want = orgProjects(orgId).map(p => p.id);
  let n = 0;
  for (const k of o.contacts || []) {
    const c = k.cabinetId && cabCustomer(k.cabinetId);
    if (!c) continue;
    const ids = [...new Set([...c.projectIds.filter(pid => { const p = state.projects.get(pid); return !p || !state.orgs.has(p.customerId); }), ...want])];
    if (ids.length === c.projectIds.length && ids.every(x => c.projectIds.includes(x))) continue;
    const r = await api.cabinetCustomerUpdate(c.id, { projectIds: ids });
    if (r.ok) n++; else toast(r.message, true);
  }
  if (n) await loadCabCustomers(true);
  return n;
}
async function orgCabPublish() {
  const ps = orgProjects(state.drawer?.id).filter(p => !cab.published[p.id]);
  let n = 0;
  for (const p of ps) { const r = await api.cabinetPublish(p.id); if (r.ok) n++; else { toast(`${p.name}: ${r.message}`, true); break; } }
  if (n) toast(`Опубликовано проектов: ${n}`);
}

/* ----- «Заказчик» in the project window: picked from the catalogue (or typed — and added to it with one button) ----- */
function customerField(p) {
  const list = orgsArr().filter(A.isCustomerOrg);
  return `<div class="f"><label for="pr-client">Заказчик</label><input id="pr-client" name="client" value="${esc(p.client || '')}" placeholder="ООО «…»" maxlength="160" list="org-customers" autocomplete="off">
    <datalist id="org-customers">${list.map(o => `<option value="${esc(o.name)}"></option>`).join('')}</datalist><span class="hint" id="pr-client-hint"></span></div>`;
}
function customerHint() {
  const el = $('#pr-client-hint'), v = val('client');
  if (!el) return;
  const o = customerByName(v);
  el.innerHTML = o ? `из каталога контрагентов · <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(o.id)}">карточка</button>`
    : v ? `нет в каталоге${A.canSeeContacts(state.me) ? ' · <button class="linkbtn" type="button" data-act="org-from-project">добавить заказчика</button>' : ''}` : '';
}
// What the project form saves: the catalogue's customer when the name matches, otherwise the text as typed.
function customerOf(p, typed) {
  const o = customerByName(typed);
  if (o) return { customerId: o.id, client: o.name };
  if (p?.customerId && typed === p.client) return { customerId: p.customerId, client: typed }; // its company is in the trash
  return { customerId: '', client: typed };
}
async function orgFromProject() {
  const name = val('client');
  if (!name || customerByName(name)) return;
  const id = newId();
  if (await write(op.set('orgs', id, { name, roles: ['customer'], contacts: [], createdAt: new Date().toISOString(), createdBy: state.me?.id || '' }), `«${name}» — в каталоге заказчиков. Сохраните проект, чтобы привязать его.`)) {
    const dl = $('#org-customers');
    if (dl && !dl.querySelector(`option[value="${CSS.escape(name)}"]`)) dl.insertAdjacentHTML('beforeend', `<option value="${esc(name)}"></option>`);
    customerHint();
  }
}

/* ----- 4.11: a contractor (a person from «Люди → Подрядчики») and his ИП or firm in the catalogue ----- */
// Everyone who sees «Люди» sees the companies' names; picking is for whoever edits the contractor (GIP, chiefs).
const workOrgs = () => orgsArr().filter(o => A.orgRoles(o).some(r => r !== 'customer'));
function contractorOrgField(c) {
  const list = workOrgs(), cur = c.orgId && state.orgs.get(c.orgId);
  if (!list.length && !cur) return '';
  return `<div class="f wide"><label for="c-org">ИП или фирма (каталог контрагентов)</label><select id="c-org" name="orgId"><option value="">— не указана —</option>${(cur && !list.includes(cur) ? [cur, ...list] : list).map(o => `<option value="${esc(o.id)}"${o.id === c.orgId ? ' selected' : ''}>${esc(o.name)}${o.inn ? ` · ИНН ${esc(o.inn)}` : ''}</option>`).join('')}</select>
    <span class="hint">Через неё идут договоры и оплаты. Сама карточка подрядчика — для назначения на разделы.${cur && A.canSeeOrgs(state.me) ? ` <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(cur.id)}">Карточка организации</button>` : ''}</span></div>`;
}
const contractorOrgPicked = () => { const v = $('#dform [name="orgId"]')?.value || ''; return state.orgs?.has(v) ? v : ''; };
// The people of a company: contractors linked to it (shown in its card).
function orgPeopleHtml(id) {
  const ps = [...state.contractors.values()].filter(c => c.orgId === id && !c.deletedAt).sort(byName);
  return ps.length ? `<div class="sub"><h3>Исполнители этой организации</h3><div class="org-projs">${ps.map(c => `<button class="linkbtn" type="button" data-act="open-contractor" data-id="${esc(c.id)}">${esc(c.name)}${c.specialty ? ` <span class="hint">${esc(c.specialty)}</span>` : ''}</button>`).join('')}</div></div>` : '';
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'org-filter': ({ el }) => { orgFilter = el.dataset.v; saveLocal('orgFilter', orgFilter); renderNow(); },
  'new-org': () => { setCreateMenu(false); openOrg(null); },
  'open-org': ({ e, id }) => { e.preventDefault(); openOrg(id); },
  'org-contact-add': () => { state.draft.contacts.push({ id: newId(), name: '', position: '', phone: '', email: '' }); renderOrgContacts(); $(`#org-contacts [data-oc="${state.draft.contacts.length - 1}"][data-k="name"]`)?.focus(); },
  'org-contact-del': ({ el }) => {
    const i = Number(el.dataset.i), k = state.draft.contacts[i];
    if (k?.cabinetId && cabCustomer(k.cabinetId)) return toast('У этого человека есть вход в кабинет — сначала закройте вход (ниже, в «Кабинете заказчика»).', true);
    state.draft.contacts.splice(i, 1); renderOrgContacts();
  },
  'org-contract-add': () => { state.draft.contracts.push({ id: newId(), no: '', date: '', sum: '', subject: '', projectId: '' }); renderOrgContracts(); $(`#org-contracts [data-ok="${state.draft.contracts.length - 1}"][data-k="no"]`)?.focus(); },
  'org-contract-del': ({ el }) => { state.draft.contracts.splice(Number(el.dataset.i), 1); renderOrgContracts(); },
  'org-pay-add': ({ el }) => {
    const i = Number(el.dataset.i), c = state.draft.contracts[i];
    const date = $(`#org-pay-d-${i}`)?.value, sum = parseMoney($(`#org-pay-s-${i}`)?.value || ''), note = ($(`#org-pay-n-${i}`)?.value || '').trim();
    if (!c || !isDate(date)) return toast('Укажите дату оплаты.', true);
    if (!(sum > 0)) { toast('Сумма оплаты — число больше нуля, например 150 000.', true); return $(`#org-pay-s-${i}`)?.focus(); }
    c.payments = [...(c.payments || []), { id: newId(), date, sum, note }].sort((a, b) => a.date.localeCompare(b.date));
    renderOrgContracts();
  },
  'org-pay-del': ({ el }) => { const c = state.draft.contracts[Number(el.dataset.i)]; if (c?.payments) { c.payments.splice(Number(el.dataset.j), 1); renderOrgContracts(); } },
  'org-mig-link': ({ el }) => { el.disabled = true; orgMigLink(el).finally(() => { el.disabled = false; }); },
  'org-mig-skip': ({ el }) => { const k = el.closest('.org-sug')?.dataset.key; if (k) { orgDismissed.add(k); saveLocal('orgDismissed', [...orgDismissed]); renderNow(); } },
  'org-cab-open': ({ id }) => { orgCabOpen(id); },
  'org-cab-adopt': () => { orgCabAdopt(); },
  'org-cab-sync': () => { syncOrgCabinet(state.drawer?.id).then(n => { toast(n ? `Доступ обновлён: входов — ${n}` : 'Все входы уже видят проекты заказчика'); renderOrgCabinet(); }); },
  'org-cab-publish': ({ el }) => { el.disabled = true; orgCabPublish().finally(() => { el.disabled = false; }); },
  'org-from-project': () => { orgFromProject(); },
  'party-fill': ({ el }) => { el.disabled = true; partyFill(false).finally(() => { el.disabled = false; }); },
  'party-take': ({ el }) => { partyTake([el.dataset.k]); },
  'party-take-all': () => { partyTake(partyDiff.map(d => d.k)); },
  'party-key': () => { openPartyKey(); },
  'orgcheck': () => { runOrgCheck(); },
  'orgcheck-apply': ({ el }) => { el.disabled = true; applyOrgCheck().finally(() => { el.disabled = false; }); },
  'orgcheck-all': ({ el }) => { for (const x of orgCheck?.items || []) for (const d of x.diffs) d.on = el.dataset.on === '1'; renderOrgCheck(); },
});
/* ---------- handing a card from one person to another ---------- */
// Specialization check for giving card `t` to a staff member or an outside contractor; '' when it fits.
function misfitText(t, kind, toId) {
  if (kind === 'staff') {
    const u = state.users.get(toId), g = A.profileGaps(u, t);
    return g.length ? `Не подходит по специальности: ${g.map(x => x.mark).join(', ')}. ${u.name} делает: ${A.profileText(u)}.` : '';
  }
  const c = state.contractors.get(toId), g = A.contractorGaps(c, t);
  return g.length ? `Не подходит по специальности: ${g.join(', ')}. ${c.name} делает: ${c.specialty}.` : '';
}
// Modal: pick a recipient (unless `toId` is given) and confirm a misfit with «Всё равно назначить».
function askReassign(t, kind, fromId, toId = '') {
  return new Promise(resolve => {
    const cands = kind === 'staff'
      ? A.assignableOwners(state.me, liveUsers()).filter(u => u.role !== 'gip' && u.id !== fromId).sort(byName)
      : contractorsArr().filter(c => c.id !== fromId);
    const nameOf = id => (kind === 'staff' ? state.users.get(id)?.name : state.contractors.get(id)?.name) || 'не назначен';
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
      <h2 id="mtitle">Передать карточку</h2>
      <p><b>${esc(marksText(t))}</b> · ${esc(projectOf(t)?.name || '')}</p>
      <p class="hint">Сейчас: ${esc(nameOf(fromId))}</p>
      <div class="f"><label class="req" for="m-to">Кому</label><select id="m-to"><option value="">— выберите —</option>${cands.map(x => {
        const bad = misfitText(t, kind, x.id);
        return `<option value="${esc(x.id)}"${x.id === toId ? ' selected' : ''}>${esc(x.name)}${bad ? ' — не по специальности' : ''}</option>`;
      }).join('')}</select></div>
      <div class="warnline" id="m-warn" hidden><span id="m-warn-text"></span>
        <label class="chk"><input type="checkbox" id="m-force"> Всё равно назначить</label></div>
      <div class="err" id="m-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Передать</button><button class="btn" type="button" data-m="cancel">Отмена</button></div>
    </form>`;
    document.body.append(root);
    const sel = root.querySelector('#m-to'), warn = root.querySelector('#m-warn');
    const sync = () => { const txt = sel.value ? misfitText(t, kind, sel.value) : ''; warn.hidden = !txt; root.querySelector('#m-warn-text').textContent = txt; root.querySelector('#m-force').checked = false; };
    sync();
    sel.addEventListener('change', sync);
    (toId ? root.querySelector('#m-force') : sel).focus();
    const close = v => { root.remove(); resolve(v); };
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const err = root.querySelector('#m-err');
      if (!sel.value) return modalErr(root, '#m-err', 'Выберите, кому передать.', 'select');
      const bad = misfitText(t, kind, sel.value);
      if (bad && !root.querySelector('#m-force').checked) return modalErr(root, '#m-err', 'Отметьте «Всё равно назначить» или выберите другого.', '#m-force');
      close({ toId: sel.value, forced: !!bad });
    });
  });
}
async function reassign(taskId, kind, fromId, toId = '') {
  const t = state.tasks.get(taskId);
  if (!t) return;
  const pick = await askReassign(t, kind, fromId, toId);
  if (!pick) return;
  let data;
  if (kind === 'staff') {
    const now = A.ownersOf(t);
    const owners = (now.includes(fromId) ? now.map(id => (id === fromId ? pick.toId : id)) : [pick.toId, ...now]).filter((v, i, a) => a.indexOf(v) === i);
    data = { ownerId: owners[0], coOwnerIds: owners.slice(1) };
    // The confirmation covers the card while any of its people stays out of profile.
    const anyGaps = owners.some(id => A.profileGaps(state.users.get(id), t).length);
    data.profileOk = anyGaps ? (pick.forced || !!t.profileOk) : false;
  } else data = { contractorId: pick.toId };
  const name = kind === 'staff' ? state.users.get(pick.toId)?.name : state.contractors.get(pick.toId)?.name;
  await write(op.update('tasks', taskId, data), `${marksText(t)} → ${name}${pick.forced ? ' (не по специальности)' : ''}`);
}

function taskList(ct, kind = '', holderId = '') {
  const movable = kind && canEditFields();
  const key = 'l:' + kind + holderId, lim = limitOf(key, 8), all = ct;
  ct = ct.slice(0, lim);
  return ct.length ? ct.map(t => {
    const p = projectOf(t), tm = timing(t);
    const role = kind === 'staff' && t.ownerId !== holderId ? (executorOf(t)?.u?.id === holderId ? 'исполнитель' : 'соисполнитель') : '';
    const co = role ? `<span class="chip tone-idle co-chip">${role}</span>` : '';
    return `<div class="ctask" data-act="open-task" data-id="${esc(t.id)}" role="button" tabindex="0"${movable ? ` draggable="true" data-move="${kind}:${esc(holderId)}"` : ''}>
      ${movable ? `<button class="btn ghostbtn sm ct-move" type="button" data-act="move-task" data-id="${esc(t.id)}" data-kind="${kind}" data-from="${esc(holderId)}" title="Передать другому (или перетащите карточку мышью на другого исполнителя)">⇄</button>` : ''}${co}
      <div class="l">${marksHtml(t)}<span class="num">${fmtDate(t.start)} → ${fmtDate(t.finish)}</span></div>
      <div class="r">${statusChip(t)}<span class="due ${tm.cls}">${esc(tm.text)}</span></div>
      <div class="p">${esc(p?.name || '—')}${t.title ? ' · ' + esc(t.title) : ''}</div>
    </div>`;
  }).join('') + moreBtn(key, all.length, ct.length, 30) : '<div class="none">Карточек не назначено.</div>';
}
function staffCard(u, list) {
  const ct = list.filter(t => hasOwner(t, u.id)).sort(sortByDeadline), x = totals(ct);
  const chief = u.role === 'specialist' && u.chiefId ? state.users.get(u.chiefId) : null;
  const key = 'u:' + u.id, folded = isFolded(key);
  return `<article class="card staff${folded ? ' folded' : ''}" data-drop="staff:${esc(u.id)}">
    <div class="card-h">
      <div class="row1">${foldBtn(key, folded)}<span class="kicons">${userIcons(u)}</span><h3>${esc(userLabel(u))}</h3><span class="chip tone-work">${esc(A.ROLES[u.role]?.label || '')}</span>
        ${A.isGip(state.me) ? `<button class="btn ghostbtn sm" data-act="open-user" data-id="${esc(u.id)}" type="button">Изменить</button>` : ''}</div>
      <div class="spec">${esc(A.directionLabels(u).join(', ') || 'направления не заданы')}${chief ? ' · главспец ' + esc(chief.name) : ''}</div>
      ${upcomingAbsences(u).length || A.canEditAbsences(state.me, u) ? `<div class="abs-line">${upcomingAbsences(u).map(a => `<span class="chip tone-warn">${esc(A.ABSENCE_KINDS[a.kind] || 'нет')} ${fmtDate(a.from)}–${fmtDate(a.to)}</span>`).join('')}
        ${A.canEditAbsences(state.me, u) ? `<button class="btn ghostbtn sm" type="button" data-act="absences" data-id="${esc(u.id)}">Отпуска и больничные</button>` : ''}</div>` : ''}
      <div class="contacts">
        ${contactLine('Телефон', u.phone)}${contactLine('Почта', u.email)}${contactLine('Мессенджер', u.messenger)}
        ${!u.phone && !u.email && !u.messenger ? '<div class="hint">Контакты не указаны</div>' : ''}
      </div>
    </div>
    <div class="stats">
      <div class="stat"><span class="k">Карточек</span><span class="v">${x.count}</span></div>
      <div class="stat"><span class="k">В работе</span><span class="v">${x.active}</span></div>
      <div class="stat ${x.overdue ? 'bad' : ''}"><span class="k">Сорвано</span><span class="v">${x.overdue}</span></div>
      <div class="stat"><span class="k">На проверке</span><span class="v">${x.review}</span></div>
    </div>
    ${game ? gameStats(u, ct) : ''}
    <div class="ctasks">${taskList(ct, 'staff', u.id)}</div>
  </article>`;
}
// «С первого раза» and thanks, counted over all the person's cards (archived projects too: history matters).
function gameStats(u, ct = null) {
  const all = [...state.tasks.values()].filter(t => hasOwner(t, u.id));
  const ft = L.firstTime(all, state.today), th = L.thanksFor(all, u.id);
  if (!ft.done && !th) return '';
  return `<div class="game-line">${ft.done ? `<span title="Принято без единого круга замечаний: ${ft.clean} из ${ft.done}">✓ с первого раза <b>${ft.pct}%</b> <span class="hint">(${ft.clean} из ${ft.done})</span></span>` : ''}${th ? `<span title="Сколько раз коллеги сказали «спасибо» в обсуждениях">♥ спасибо <b>${th}</b></span>` : ''}</div>`;
}
function contractorCard(c, list) {
    const ct = list.filter(t => t.contractorId === c.id).sort(sortByDeadline), x = totals(ct);
    const dueNow = ct.reduce((a, t) => a + L.cents(L.paymentPlan(t, state.today).dueNow), 0) / 100;
    const key = 'c:' + c.id, folded = isFolded(key);
    return `<article class="card${folded ? ' folded' : ''}" data-drop="contractor:${esc(c.id)}">
      <div class="card-h">
        <div class="row1">${foldBtn(key, folded)}<h3>${esc(c.name)}</h3><button class="btn ghostbtn sm" data-act="open-contractor" data-id="${esc(c.id)}" type="button">Изменить</button></div>
        ${c.specialty ? `<div class="spec">${esc(c.specialty)}</div>` : ''}
        <div class="contacts">
          ${contactLine('Телефон', c.phone)}${contactLine('Почта', c.email)}${contactLine('Мессенджер', c.messenger)}
          ${!c.phone && !c.email && !c.messenger ? '<div class="hint">Контакты не указаны</div>' : ''}
        </div>
        ${reliabilityHtml(c)}
        ${c.note ? `<div class="hint">${esc(c.note)}</div>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><span class="k">Карточек</span><span class="v">${x.count}</span></div>
        <div class="stat"><span class="k">В работе</span><span class="v">${x.active}</span></div>
        <div class="stat ${x.overdue ? 'bad' : ''}"><span class="k">Сорвано</span><span class="v">${x.overdue}</span></div>
        ${canMoney() ? `<div class="stat"><span class="k">${dueNow > 0 ? 'Пора платить' : 'К оплате'}</span><span class="v ${dueNow > 0 ? 'warnv' : ''}" title="Всего осталось ${money(x.rest)}">${money(dueNow > 0 ? dueNow : x.rest)}</span></div>`
          : `<div class="stat"><span class="k">На проверке</span><span class="v">${x.review}</span></div>`}
      </div>
      <div class="ctasks">${taskList(ct, 'contractor', c.id)}</div>
    </article>`;
}
let peopleMode = loadLocal('peopleMode', 'cards');
// Outside contractors: grouped by direction (from the marks of their specialty), groups and people open on click.
const cgOpen = new Set(loadLocal('cgOpen', []));
const coOpen = new Set(loadLocal('coOpen', []));
function toggleSet(set, key, store) { if (set.has(key)) set.delete(key); else set.add(key); saveLocal(store, [...set]); renderNow(); }
const CONTRACTOR_GROUPS = [['ar', 'Архитекторы'], ['kr', 'Конструкторы'], ['el', 'Электрики'], ['ss', 'Слаботочники'], ['water', 'Водоснабжение'], ['sewer', 'Водоотведение'], ['ov', 'Отопление и вентиляция'], ['pos', 'ПОС'], ['', 'Прочие и без специализации']];
function contractorRow(c, list) {
  const ct = list.filter(t => t.contractorId === c.id), x = totals(ct);
  const dueNow = ct.reduce((a, t) => a + L.cents(L.paymentPlan(t, state.today).dueNow), 0) / 100;
  const open = coOpen.has(c.id), r = L.reliability([...state.tasks.values()].filter(t => t.contractorId === c.id), state.today);
  const rel = r.grade === 'none' ? '<span class="hint">мало данных</span>' : `<span class="chip tone-${{ ok: 'ok', warn: 'warn', bad: 'bad' }[r.grade]}">${r.pct}% в срок</span>`;
  return `<div class="co-row${open ? ' open' : ''}" data-drop="contractor:${esc(c.id)}">
    <button class="co-line" type="button" data-act="co-toggle" data-id="${esc(c.id)}" aria-expanded="${open}">
      <span class="tree-tg">${open ? '▾' : '▸'}</span><span class="kicons">${A.contractorKinds(c).map(k => kindIcon(k)).join('')}</span>
      <b class="co-name">${esc(c.name)}</b><span class="hint co-spec">${esc(c.specialty || '')}${c.orgId && state.orgs?.get(c.orgId) ? ` · ${esc(state.orgs.get(c.orgId).name)}` : ''}</span>
      <span class="co-n" title="В работе">${x.active ? `в работе <b class="num">${x.active}</b>` : '<span class="hint">свободен</span>'}</span>
      <span class="co-n">${x.overdue ? `<span class="neg">сорвано <b class="num">${x.overdue}</b></span>` : ''}</span>
      ${canMoney() ? `<span class="co-n r">${dueNow > 0 ? `<span class="warnv">пора платить ${money(dueNow)}</span>` : ''}</span>` : `<span class="co-n">${x.review ? `на проверке ${x.review}` : ''}</span>`}
      <span class="co-rel">${rel}</span></button>
    ${open ? `<div class="co-body">${contractorCard(c, list)}</div>` : ''}
  </div>`;
}
function contractorsGrouped(people, list) {
  const groups = CONTRACTOR_GROUPS.map(([k, label]) => ({ k, label, people: people.filter(c => (A.contractorKinds(c)[0] || '') === k) })).filter(g => g.people.length);
  return `<div class="co-groups">${groups.map(g => {
    const open = cgOpen.has(g.k || '-'), active = list.filter(t => g.people.some(c => c.id === t.contractorId) && ACTIVE.has(t.status));
    const late = active.filter(t => timing(t).overdue).length;
    return `<section class="panel co-group${open ? '' : ' folded'}"><button class="panel-h co-gh" type="button" data-act="cg-toggle" data-id="${g.k || '-'}" aria-expanded="${open}">
        <span class="tree-tg">${open ? '▾' : '▸'}</span>${g.k ? kindIcon(g.k, 'big') : ''}<h3>${esc(g.label)}</h3><span class="meta">${g.people.length} · в работе ${active.length}${late ? ` · <span class="neg">сорвано ${late}</span>` : ''}</span></button>
      ${open ? `<div class="co-list">${g.people.map(c => contractorRow(c, list)).join('')}</div>` : ''}</section>`;
  }).join('')}</div>`;
}
// Compact list of staff: one line per person.
function staffList(staff, list) {
  return `<div class="tablewrap"><table class="staff-t"><thead><tr><th>Сотрудник</th><th>Роль</th><th class="r">В работе</th><th class="r">Сорвано</th><th class="r">На проверке</th>${game ? '<th class="r">С первого раза</th><th class="r">Спасибо</th>' : ''}<th>Отсутствие</th><th></th></tr></thead><tbody>
    ${staff.map(u => {
      const ct = list.filter(t => hasOwner(t, u.id)), x = totals(ct), all = [...state.tasks.values()].filter(t => hasOwner(t, u.id)), ft = L.firstTime(all, state.today), th = L.thanksFor(all, u.id);
      const ab = upcomingAbsences(u)[0];
      return `<tr class="row" data-act="person-tasks" data-id="${esc(u.id)}" data-drop="staff:${esc(u.id)}" title="Показать карточки сотрудника"><td><span class="kicons">${userIcons(u)}</span><b>${esc(userLabel(u))}</b></td><td class="hint">${esc(A.ROLES[u.role]?.label || '')}${u.chiefId && state.users.get(u.chiefId) ? ` · ${esc(state.users.get(u.chiefId).name)}` : ''}</td>
        <td class="r num">${x.active || '—'}</td><td class="r num ${x.overdue ? 'neg' : ''}">${x.overdue || '—'}</td><td class="r num">${x.review || '—'}</td>
        ${game ? `<td class="r num">${ft.pct === null ? '—' : ft.pct + '%'}</td><td class="r num">${th ? '♥ ' + th : '—'}</td>` : ''}
        <td>${ab ? `<span class="chip tone-warn">${esc(A.ABSENCE_KINDS[ab.kind] || 'нет')} ${fmtDate(ab.from)}–${fmtDate(ab.to)}</span>` : ''}</td>
        <td class="nowrap">${A.canEditAbsences(state.me, u) ? `<button class="btn ghostbtn sm" type="button" data-act="absences" data-id="${esc(u.id)}">Отпуска</button>` : ''}${A.isGip(state.me) ? `<button class="btn ghostbtn sm" data-act="open-user" data-id="${esc(u.id)}" type="button">Изменить</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
// «Люди» (4.1, backlog item 17): the GIP sees all staff and all outside people; a chief — all staff and own outside
// people (added by him or working on his team's cards); a specialist — staff only.
function peopleStaff() {
  return liveUsers().filter(u => u.role !== 'gip').sort((a, b) => (a.role === b.role ? byName(a, b) : a.role === 'chief' ? -1 : 1));
}
function peopleOutside() {
  if (A.isGip(state.me)) return contractorsArr();
  if (isSpec()) return [];
  const used = new Set(tasksArr().flatMap(t => [t.contractorId, String(t.coExecRef || '').startsWith('c:') ? t.coExecRef.slice(2) : '']).filter(Boolean));
  return contractorsArr().filter(c => c.createdBy === state.me?.id || used.has(c.id));
}
function viewPeople() {
  if (isEmpty()) return emptyState();
  const list = tasksArr(), staff = peopleStaff(), people = peopleOutside();
  const gip = A.isGip(state.me);
  const head = (title, hint, btn) => `<div class="people-h"><h2>${title}</h2>${hint}<span class="spacer"></span>${btn}</div>`;
  const mode = ['cards', 'list', 'tree', 'org'].includes(peopleMode) && !(peopleMode === 'tree' && isSpec()) ? peopleMode : 'cards';
  const modeSeg = `<span class="seg"><button class="btn sm ${mode === 'cards' ? 'on' : ''}" type="button" data-act="people-mode" data-v="cards" title="Карточки с контактами и задачами">Карточки</button><button class="btn sm ${mode === 'list' ? 'on' : ''}" type="button" data-act="people-mode" data-v="list" title="Одна строка на человека">Список</button><button class="btn sm ${mode === 'tree' ? 'on' : ''}" type="button" data-act="people-mode" data-v="tree" title="Структура: ГИП → главспецы → специалисты, цифры по группам, доступ к бюджету"${isSpec() ? ' hidden' : ''}>Структура</button><button class="btn sm ${mode === 'org' ? 'on' : ''}" type="button" data-act="people-mode" data-v="org" title="Оргструктура: отделы и группы с руководителями — видна всем штатным">Оргструктура</button></span>`;
  return head(`Штатные <span class="cnt">${staff.length}</span>`, tip('people-staff', 'У каждого штатного свой пульт — войти можно, выбрав имя в заголовке.', 'inline'),
      modeSeg + (gip && mode !== 'tree' && mode !== 'org' ? '<button class="btn sm" data-act="new-user" data-role="specialist" type="button">+ Сотрудник</button>' : ''))
    + (mode === 'org' ? viewOrg() : mode === 'tree' ? viewTeam()
      : !staff.length ? `<p class="hint people-empty">${gip ? 'Штатных сотрудников пока нет.' : 'Специалистов в вашей команде пока нет — их добавляет ГИП.'}</p>`
      : mode === 'list' ? staffList(staff, list)
      : foldAllBar(staff.map(u => 'u:' + u.id)) + `<div class="cards">${staff.map(u => staffCard(u, list)).join('')}</div>`)
    + (isSpec() ? '' : head(`Подрядчики <span class="cnt">${people.length}</span>`, tip('people-outside', 'Внештатные, без доступа к программе — сроки и оплату по ним ведёт главспец. Сгруппированы по направлениям из специализации.', 'inline'),
      `${people.length ? `<button class="btn ghostbtn sm" type="button" data-act="cg-all" data-on="1">▾ Раскрыть группы</button><button class="btn ghostbtn sm" type="button" data-act="cg-all" data-on="0">▸ Свернуть</button>` : ''}<button class="btn sm" data-act="new-contractor" type="button">+ Подрядчик</button>`)
    + (people.length ? contractorsGrouped(people, list)
      : `<p class="hint people-empty">${A.isGip(state.me) ? 'Добавьте подрядчиков с контактами — затем их можно будет назначать на карточки.' : 'Здесь — ваши подрядчики: добавленные вами и работающие по карточкам вашей группы.'}</p>`));
}

// Staff have their own panel in the program; outside contractors do not and are tracked by the chief.
function staffArr() {
  const all = liveUsers().filter(u => u.role !== 'gip');
  const mine = A.isGip(state.me) ? all : all.filter(u => u.id === state.me?.id || (u.role === 'specialist' && u.chiefId === state.me?.id));
  return mine.sort((a, b) => (a.role === b.role ? byName(a, b) : a.role === 'chief' ? -1 : 1));
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'set-game': ({ el }) => { game = el.dataset.v === '1'; saveLocal('game', game); renderNow(); },
  'people-mode': ({ el }) => { peopleMode = el.dataset.v; saveLocal('peopleMode', peopleMode); renderNow(); },
  'cg-toggle': ({ id }) => { toggleSet(cgOpen, id, 'cgOpen'); },
  'co-toggle': ({ id }) => { toggleSet(coOpen, id, 'coOpen'); },
  'cg-all': ({ el }) => { if (el.dataset.on === '1') CONTRACTOR_GROUPS.forEach(([k]) => cgOpen.add(k || '-')); else cgOpen.clear(); saveLocal('cgOpen', [...cgOpen]); renderNow(); },
  'person-tasks': ({ e, id }) => { if (!e.target.closest('button')) { state.filters = { ...EMPTY_FILTERS, owner: id }; state.tab = 'tasks'; saveLocal('tab', 'tasks'); renderNow(); } },
  'move-task': ({ e, el, id }) => { e.stopPropagation(); reassign(id, el.dataset.kind, el.dataset.from); },
});
/* ---------- 4.1: «Оргструктура» — departments and groups top-down, seen by every staff member ----------
   A department: { name, headId, parentId }; people belong by user.deptId. Without departments the tree is built from
   the roles (company → chiefs' groups). The GIP adds, renames and moves departments; «+» on a card adds a sub-department. */
let orgOpen = new Set(loadLocal('orgOpen', []));
const orgToggle = id => { if (orgOpen.has(id)) orgOpen.delete(id); else orgOpen.add(id); saveLocal('orgOpen', [...orgOpen]); renderNow(); };
function orgTree() {
  const staff = liveUsers();
  const depts = [...(state.depts?.values() || [])];
  if (!depts.length) {
    // Virtual: the company with the GIP(s) on top, a group per chief with the chief's specialists.
    const gips = staff.filter(u => u.role === 'gip'), chiefs = staff.filter(u => u.role === 'chief').sort(byName);
    const loose = staff.filter(u => u.role === 'specialist' && !chiefs.some(c => c.id === u.chiefId));
    const groups = chiefs.map(c => ({ id: 'v:' + c.id, name: `Группа: ${A.directionLabels(c).join(', ') || c.name}`, head: c, people: staff.filter(u => u.role === 'specialist' && u.chiefId === c.id).sort(byName), kids: [], virtual: true }));
    return [{ id: 'v:root', name: 'ПМ «Тандем»', head: gips[0] || null, people: [...gips.slice(1), ...loose], kids: groups, virtual: true }];
  }
  const build = d => ({ id: d.id, name: d.name, head: state.users.get(d.headId) || null, d,
    people: staff.filter(u => u.deptId === d.id && u.id !== d.headId).sort(byName),
    kids: depts.filter(x => x.parentId === d.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || byName(a, b)).map(build) });
  const roots = depts.filter(d => !d.parentId || !state.depts.has(d.parentId)).sort(byName).map(build);
  const placed = new Set(depts.flatMap(d => [d.headId]).concat(staff.filter(u => state.depts.has(u.deptId)).map(u => u.id)));
  const outside = staff.filter(u => !placed.has(u.id)).sort(byName);
  if (outside.length) roots.push({ id: 'v:none', name: 'Без отдела', head: null, people: outside, kids: [], virtual: true, none: true });
  return roots;
}
const orgCount = n => (n.head ? 1 : 0) + n.people.length + n.kids.reduce((a, k) => a + orgCount(k), 0);
const orgHas = (n, id) => n.head?.id === id || n.people.some(u => u.id === id);
function orgNodeHtml(n, depth = 0) {
  const gip = A.isGip(state.me), mine = orgHas(n, state.me?.id);
  // Open: the top level, and the way down to the user's own department; what the user folded stays folded.
  const inside = x => orgHas(x, state.me?.id) || x.kids.some(inside);
  const open = orgOpen.has(n.id) || ((depth < 1 || n.kids.some(inside)) && !orgOpen.has('x:' + n.id));
  const peopleOpen = orgOpen.has('p:' + n.id);
  const h = n.head, total = orgCount(n), subs = n.kids.length;
  const card = `<div class="org-card${mine ? ' mine' : ''}${n.none ? ' none' : ''}">
    <div class="org-name"><b>${esc(n.name)}</b>${mine ? '<span class="chip tone-work">Ваш отдел</span>' : ''}${gip && !n.virtual ? `<button class="btn ghostbtn sm" type="button" data-act="org-edit" data-id="${esc(n.id)}" title="Изменить отдел">✎</button>` : ''}</div>
    ${h ? `<div class="org-head"><span class="pt-ava">${esc(initials(h.name))}</span><span><b>${esc(h.name)}</b><br><span class="hint">${esc(A.ROLES[h.role]?.label || '')}${A.directionLabels(h).length ? ' · ' + esc(A.directionLabels(h).join(', ')) : ''}</span></span></div>` : n.none ? '' : '<div class="hint org-head">Руководитель не назначен</div>'}
    <div class="org-foot"><button class="linkbtn" type="button" data-act="org-people" data-id="${esc(n.id)}" aria-expanded="${peopleOpen}">${total} ${plural(total, 'сотрудник', 'сотрудника', 'сотрудников')}</button>
      ${subs ? `<button class="linkbtn" type="button" data-act="org-fold" data-id="${esc(n.id)}" data-open="${open}" aria-expanded="${open}">${subs} ${plural(subs, 'отдел', 'отдела', 'отделов')} ${open ? '▴' : '▾'}</button>` : ''}
      ${gip && !n.none ? `<button class="org-add" type="button" data-act="org-add" data-parent="${esc(n.virtual ? '' : n.id)}" title="Добавить подотдел">+</button>` : ''}</div>
    ${peopleOpen ? `<div class="org-people">${[h, ...n.people].filter(Boolean).map(u => `<span class="pt-member${u.id === state.me?.id ? ' me' : ''}"><span class="pt-ava">${esc(initials(u.name))}</span><span>${esc(u.name)}<br><span class="hint">${esc(A.ROLES[u.role]?.label || '')}</span></span></span>`).join('') || '<span class="hint">никого</span>'}</div>` : ''}
  </div>`;
  return `<li>${card}${subs && open ? `<ul>${n.kids.map(k => orgNodeHtml(k, depth + 1)).join('')}</ul>` : ''}</li>`;
}
function viewOrg() {
  const roots = orgTree(), gip = A.isGip(state.me), virtual = !state.depts?.size;
  return `<section class="panel org-panel"><div class="panel-h"><h3>Оргструктура</h3><span class="meta">видна всем штатным</span><span class="spacer"></span>
      ${gip && virtual ? '<button class="btn sm" type="button" data-act="org-from-groups" title="Сделать отделы из групп главспецов — потом их можно переименовать и вложить друг в друга">Создать отделы из групп</button>' : ''}
      ${gip ? '<button class="btn sm" type="button" data-act="org-add" data-parent="">+ Отдел</button>' : ''}</div>
    ${virtual ? `<p class="hint org-note">Отделов пока нет — показана структура по ролям: ГИП, группы главспецов и их специалисты.${gip ? ' Создайте отделы, чтобы задать названия, руководителей и вложенность.' : ''}</p>` : ''}
    <div class="org-scroll"><ul class="org-tree">${roots.map(r => orgNodeHtml(r)).join('')}</ul></div></section>`;
}
// Add or edit a department: name, head, parent; people are moved in by choosing the department in their card.
function askDept(dept = null, parentId = '') {
  const d = dept || { name: '', headId: '', parentId };
  const others = [...state.depts.values()].filter(x => x.id !== d.id);
  const staff = liveUsers().sort(byName);
  const members = new Set(staff.filter(u => dept && u.deptId === dept.id).map(u => u.id));
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal org-modal" role="dialog" aria-modal="true" aria-labelledby="org-t" novalidate><h2 id="org-t">${dept ? 'Отдел' : 'Новый отдел'}</h2>
    <div class="f"><label class="req" for="org-name">Название</label><input id="org-name" maxlength="120" value="${esc(d.name)}" placeholder="Отдел инженерных систем"></div>
    <div class="f"><label for="org-head">Руководитель</label><select id="org-head"><option value="">— не назначен —</option>${staff.map(u => `<option value="${esc(u.id)}"${u.id === d.headId ? ' selected' : ''}>${esc(u.name)} · ${esc(A.ROLES[u.role]?.label || '')}</option>`).join('')}</select></div>
    <div class="f"><label for="org-parent">Входит в</label><select id="org-parent"><option value="">— верхний уровень —</option>${others.map(x => `<option value="${esc(x.id)}"${x.id === d.parentId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <fieldset class="f org-mem"><legend>Сотрудники отдела <span class="hint" id="org-cnt"></span></legend>
      <div class="pick-tools"><input type="search" id="org-find" placeholder="Найти по фамилии" aria-label="Найти сотрудника"><label class="chk"><input type="checkbox" id="org-free"> только без отдела</label></div>
      <div class="pick-list">${staff.sort((a, b) => members.has(b.id) - members.has(a.id)).map(u => {
        // Where the person is now: one grey line on the right, cut with «…» (whole — in the tooltip).
        const now = u.deptId && u.deptId !== d.id ? state.depts.get(u.deptId)?.name : '';
        return `<label class="pick-row" data-name="${esc(u.name.toLowerCase())}" data-free="${u.deptId && state.depts.get(u.deptId) ? '0' : '1'}"><input type="checkbox" value="${esc(u.id)}"${members.has(u.id) ? ' checked' : ''}><span class="pick-name">${esc(u.name)}</span>${now ? `<span class="pick-now" title="Сейчас: ${esc(now)}">сейчас: ${esc(now)}</span>` : ''}</label>`;
      }).join('')}<p class="hint pick-none" hidden>Никого не найдено.</p></div></fieldset>
    <div class="err" id="org-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button><span class="spacer"></span>${dept ? '<button class="btn danger" type="button" data-m="del">Удалить отдел</button>' : ''}</div></form>`;
  document.body.append(root);
  const q = sel => root.querySelector(sel), close = () => root.remove();
  q('#org-name').focus();
  // The list: search by surname, «только без отдела», how many are chosen.
  const pickList = () => {
    const find = q('#org-find').value.trim().toLowerCase(), free = q('#org-free').checked;
    let shown = 0;
    for (const r of root.querySelectorAll('.pick-row')) {
      const on = r.querySelector('input').checked;
      r.hidden = !on && ((find && !r.dataset.name.includes(find)) || (free && r.dataset.free !== '1'));
      if (!r.hidden) shown++;
    }
    q('.pick-none').hidden = shown > 0;
    const n = root.querySelectorAll('.pick-list input:checked').length;
    q('#org-cnt').textContent = n ? `· выбрано ${n}` : '';
  };
  pickList();
  q('#org-find').addEventListener('input', pickList);
  q('#org-free').addEventListener('change', pickList);
  q('.pick-list').addEventListener('change', pickList);
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.addEventListener('click', async e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'del') {
      // Sub-departments move up a level, people become «без отдела».
      const ops = [op.update('depts', dept.id, { deletedAt: new Date().toISOString() }),
        ...others.filter(x => x.parentId === dept.id).map(x => op.update('depts', x.id, { parentId: dept.parentId || '' })),
        ...staff.filter(u => u.deptId === dept.id).map(u => op.update('users', u.id, { deptId: '' }))];
      if (await write(ops, `Отдел «${dept.name}» удалён`)) close();
    }
  });
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const name = q('#org-name').value.trim(), headId = q('#org-head').value, parent = q('#org-parent').value;
    const err = (t, f) => modalErr(root, '#org-err', t, f);
    if (!name) return err('Укажите название отдела.', '#org-name');
    // No loops: the parent may not be inside this department.
    for (let x = parent; x; x = state.depts.get(x)?.parentId) if (x === d.id) return err('Отдел не может входить сам в себя или в свой подотдел.', '#org-parent');
    const id = dept?.id || newId();
    const chosen = new Set([...root.querySelectorAll('.pick-list input:checked')].map(i => i.value));
    if (headId) chosen.add(headId);
    const ops = [dept ? op.update('depts', id, { name, headId, parentId: parent }) : op.set('depts', id, { name, headId, parentId: parent, createdAt: new Date().toISOString() }),
      ...staff.filter(u => chosen.has(u.id) && u.deptId !== id).map(u => op.update('users', u.id, { deptId: id })),
      ...staff.filter(u => !chosen.has(u.id) && u.deptId === id).map(u => op.update('users', u.id, { deptId: '' }))];
    if (await write(ops, dept ? 'Отдел сохранён' : `Отдел «${name}» добавлен`)) close();
  });
}
// The groups of chiefs become departments under one top department with the GIP as its head.
async function orgFromGroups() {
  const gip = liveUsers().find(u => u.role === 'gip'), chiefs = liveUsers().filter(u => u.role === 'chief');
  const top = newId(), at = new Date().toISOString();
  const ops = [op.set('depts', top, { name: 'ПМ «Тандем»', headId: gip?.id || '', parentId: '', createdAt: at })];
  if (gip) ops.push(op.update('users', gip.id, { deptId: top }));
  for (const c of chiefs) {
    const id = newId();
    ops.push(op.set('depts', id, { name: `Группа: ${A.directionLabels(c).join(', ') || c.name}`, headId: c.id, parentId: top, createdAt: at }), op.update('users', c.id, { deptId: id }));
    for (const s of liveUsers().filter(u => u.role === 'specialist' && u.chiefId === c.id)) ops.push(op.update('users', s.id, { deptId: id }));
  }
  await write(ops, `Создано отделов: ${chiefs.length + 1}`);
}

/* ---------- «Офис»: the team as people at desks, projects as buildings ---------- */
let officePrefs = { zoom: 1, labels: true, ...loadLocal('office', {}) };
function setOffice(patch) { officePrefs = { ...officePrefs, ...patch }; saveLocal('office', officePrefs); renderNow(); }
const shortName = n => { const [f, ...rest] = String(n || '').replace(/^Пример:\s*/, '').split(/\s+/); return rest.length ? `${f} ${rest.map(x => x[0]).filter(Boolean).join('.')}.`.replace(/\.\.$/, '.') : f; };
// What the person is doing, from the state of their cards (the most urgent wins).
function officeState(u) {
  const away = A.absencesOf(u).find(a => a.from <= state.today && a.to >= state.today);
  if (away) return { state: 'away', awayText: `${A.ABSENCE_KINDS[away.kind] || 'нет'} до ${fmtDate(away.to).slice(0, 5)}`, cards: [] };
  const cards = tasksArr().filter(t => hasOwner(t, u.id) && t.status !== 'done').sort(sortByDeadline);
  const toCheck = u.role === 'specialist' ? 0 : tasksArr().filter(t => t.status === 'review' && A.reviewersOf(t, liveUsers()).includes(u.id)).length;
  if (cards.some(t => timing(t).overdue)) return { state: 'late', cards };
  if (toCheck) return { state: 'checking', bubble: [`проверяет ${toCheck}`, '#EDE8F7', '#5A3FA0'], cards };
  if (cards.some(t => t.status === 'review')) return { state: 'carry', cards };
  if (cards.some(t => t.status === 'revision')) return { state: 'revision', cards };
  if (cards.some(t => t.status === 'in_progress')) return { state: 'work', cards };
  if (cards.length) return { state: 'idle', cards };
  return { state: 'free', cards };
}
const OFFICE_STATE_TEXT = { late: 'срок сорван', checking: 'проверяет работы', carry: 'сдал на проверку', revision: 'на доработке', work: 'в работе', idle: 'работы не начаты', free: 'свободен — можно дать работу', away: 'отсутствует' };
// Birthday today (month and day of the stored date).
const isBirthday = u => isDate(u?.birthday) && u.birthday.slice(5) === state.today.slice(5);
// Crown: who had the most cards accepted in the last 30 days (ties share it). Counted from the status history.
function officeLeaders(staff) {
  const from = addDays(state.today, -30), n = new Map();
  for (const t of tasksArr()) {
    if (t.status !== 'done') continue;
    const acc = [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'done');
    if (!acc || (acc.date || '') < from) continue;
    for (const id of [t.ownerId, ...(t.coOwnerIds || [])]) if (id) n.set(id, (n.get(id) || 0) + 1);
  }
  const best = Math.max(0, ...staff.map(u => n.get(u.id) || 0));
  return { best, ids: new Set(best ? staff.filter(u => (n.get(u.id) || 0) === best).map(u => u.id) : []) };
}
function officeModel() {
  const staff = staffArr();
  const lead = officeLeaders(staff);
  const pers = u => {
    const st = officeState(u);
    const lines = st.cards.slice(0, 6).map(t => `• ${marksText(t)} — ${projectOf(t)?.name || ''}: ${timing(t).overdue ? 'срок сорван' : STATUSES[t.status]?.label || ''}`);
    const bday = isBirthday(u), crown = lead.ids.has(u.id);
    return { id: u.id, name: u.name, short: shortName(u.name), kind: userKinds(u)[0] || '', me: u.id === state.me?.id, ...st, birthday: bday, crown,
      tip: `${bday ? '🎉 Сегодня день рождения!\n' : ''}${crown ? `👑 Больше всех принятых работ за 30 дней: ${lead.best}\n` : ''}${u.name} · ${A.ROLES[u.role]?.label || ''}${A.directionLabels(u).length ? ' · ' + A.directionLabels(u).join(', ') : ''}\n${st.awayText || OFFICE_STATE_TEXT[st.state]}${lines.length ? '\n' + lines.join('\n') + (st.cards.length > 6 ? `\n…и ещё ${st.cards.length - 6}` : '') : ''}\nЩелчок — карточки; перетащите на коллегу — передать работу` };
  };
  let rooms;
  if (A.isGip(state.me)) {
    const chiefs = staff.filter(u => u.role === 'chief');
    rooms = chiefs.map(c => ({ title: `Группа: ${shortName(c.name)}`, people: [c, ...staff.filter(u => u.role === 'specialist' && u.chiefId === c.id)].map(pers) }));
    const loose = staff.filter(u => u.role === 'specialist' && !chiefs.some(c => c.id === u.chiefId));
    if (loose.length) rooms.push({ title: 'Без главспеца', people: loose.map(pers) });
  } else rooms = staff.length ? [{ title: isSpec() ? 'Ваш стол' : 'Ваша группа', people: staff.map(pers) }] : [];
  const rank = { done: 0, review: 1, revision: 2, late: 3, work: 4, todo: 5 };
  const buildings = liveProjects().map(p => {
    const pt = tasksArr().filter(t => t.projectId === p.id);
    if (!pt.length) return null;
    const floors = pt.map(t => {
      const s = timing(t).overdue ? 'late' : t.status === 'done' ? 'done' : t.status === 'review' ? 'review' : t.status === 'revision' ? 'revision' : t.status === 'in_progress' ? 'work' : 'todo';
      return { taskId: t.id, state: s, label: marksText(t), tip: `${marksText(t)}${t.title ? ' · ' + t.title : ''}\n${timing(t).overdue ? 'Срок сорван' : STATUSES[t.status]?.label}${isDate(t.finish) ? ` · до ${fmtDate(t.finish)}` : ''}\n${ownerOf(t)?.name || 'ответственный не назначен'}${contractorOf(t) ? ' · ' + contractorOf(t).name : ''}` };
    }).sort((a, b) => rank[a.state] - rank[b.state]);
    const goal = L.projectGoal(pt), late = floors.filter(f => f.state === 'late').length;
    return { id: p.id, name: p.name.replace(/^Пример:\s*/, ''), floors, crane: floors.some(f => ['work', 'revision', 'late'].includes(f.state)), late: late > 0, complete: goal.complete, more: Math.max(0, floors.length - 14),
      sub: `${goal.done}/${goal.total} разделов${late ? ` · сорвано ${late}` : ''}`, subTone: late ? 'bad' : goal.complete ? 'ok' : '',
      tip: `${p.name}${p.code ? ' · ' + p.code : ''}\n${L.PROJECT_STATUSES[p.status]?.label || 'стадия не задана'} · принято разделов ${goal.done} из ${goal.total}\nЩелчок по зданию — проект, по этажу — карточка` };
  }).filter(Boolean);
  return { rooms, buildings };
}
function viewOffice() {
  if (isEmpty()) return emptyState();
  const m = officeModel();
  const wide = ($('#app')?.clientWidth || 1000) > 1300;
  const svg = window.Office.render(m, { labels: officePrefs.labels, zoom: officePrefs.zoom, cols: m.rooms.some(r => r.people.length > 8) ? 5 : 4, siteCols: wide ? 4 : 3 });
  const free = m.rooms.flatMap(r => r.people).filter(p => p.state === 'free').length, late = m.rooms.flatMap(r => r.people).filter(p => p.state === 'late').length;
  const away = m.rooms.flatMap(r => r.people).filter(p => p.state === 'away').length;
  const bdays = staffArr().filter(isBirthday);
  return `<section class="panel office-panel"><div class="panel-h"><h3>Офис</h3>
      <span class="meta">${m.rooms.reduce((s, r) => s + r.people.length, 0)} чел.${late ? ` · <span class="neg">со сорванным сроком ${late}</span>` : ''}${free ? ` · свободны ${free}` : ''}${away ? ` · отсутствуют ${away}` : ''} · объектов ${m.buildings.length}</span><span class="spacer"></span>
      <button class="btn ghostbtn sm ${officePrefs.anim !== false ? 'on' : ''}" type="button" data-act="office-anim" aria-pressed="${officePrefs.anim !== false}" title="Человечки печатают, кран поворачивается">Анимация</button>
      <button class="btn ghostbtn sm ${officePrefs.labels ? 'on' : ''}" type="button" data-act="office-labels" aria-pressed="${officePrefs.labels}">Подписи</button>
      <span class="seg"><button class="btn sm" type="button" data-act="office-zoom" data-dir="out" title="Мельче">−</button><button class="btn sm" type="button" data-act="office-fit" title="Обычный масштаб">${Math.round((officePrefs.zoom || 1) * 100)}%</button><button class="btn sm" type="button" data-act="office-zoom" data-dir="in" title="Крупнее">+</button></span></div>
    ${tip('office', 'Каждый штатный — человечек за своим столом: чем он занят, показывает состояние его карточек. Проекты — здания: этаж — карточка, цвет — статус, флаг — все разделы приняты, конус — сорван срок. Подрядчики здесь не показываются. Щелчок по человечку — его карточки, перетаскивание на коллегу — передать работу.')}
    ${bdays.length ? `<div class="note-box office-bday">🎉 Сегодня день рождения: <b>${bdays.map(u => esc(u.name.replace(/^Пример:\s*/, ''))).join(', ')}</b></div>` : ''}
    <div class="office-wrap${officePrefs.anim !== false ? ' anim' : ''}" id="office">${svg}</div>
    <div class="tl-legend hint office-legend"><span class="ol ol-late"></span>срок сорван <span class="ol ol-check"></span>проверяет <span class="ol ol-carry"></span>сдал на проверку <span class="ol ol-rev"></span>доработка <span class="ol ol-free"></span>свободен (у кулера) <span class="ol ol-away"></span>отпуск — пустой стол · 👑 больше всех принято за 30 дней · колпак — день рождения
      · этажи: <span class="fl fl-done"></span>принят <span class="fl fl-review"></span>проверка <span class="fl fl-work"></span>в работе <span class="fl fl-late"></span>сорван <span class="fl fl-todo"></span>не начат
      · цвет человечка — направление: ${Object.entries(KIND).map(([k, x]) => `${kindIcon(k)}${x.label.split(' ')[0].toLowerCase()}`).join(' ')}</div>
  </section>`;
}
// Click on a person: their open cards, with «передать» and a link to all their cards.
function officePerson(uid) {
  const u = state.users.get(uid);
  if (!u) return;
  const st = officeState(u);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="optitle"><h2 id="optitle"><span class="kicons">${userIcons(u)}</span>${esc(u.name)}</h2>
    <p class="hint">${esc(A.ROLES[u.role]?.label || '')}${A.directionLabels(u).length ? ' · ' + esc(A.directionLabels(u).join(', ')) : ''} · ${esc(st.awayText || OFFICE_STATE_TEXT[st.state])}</p>
    ${st.cards.length ? `<div class="op-list">${st.cards.map(t => `<div class="op-row"><button class="linkbtn" type="button" data-op-open="${esc(t.id)}">${marksHtml(t)} <span>${esc(projectOf(t)?.name || '')}</span></button>${statusChip(t)}<span class="due ${timing(t).cls}">${esc(timing(t).text)}</span>
      ${canEditFields() ? `<button class="btn ghostbtn sm" type="button" data-op-move="${esc(t.id)}" title="Передать другому сотруднику">⇄ Передать</button>` : ''}</div>`).join('')}</div>`
      : `<div class="none">${st.state === 'away' ? 'Сотрудник отсутствует.' : 'Открытых карточек нет — можно дать работу.'}</div>`}
    <div class="modal-f"><button class="btn" type="button" data-op-all>Все карточки сотрудника</button>${A.canEditAbsences(state.me, u) ? '<button class="btn ghostbtn" type="button" data-op-abs>Отпуска и больничные</button>' : ''}<span class="spacer"></span><button class="btn primary" type="button" data-m="close">Закрыть</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === root || b?.dataset.m === 'close') return close();
    if (!b) return;
    if (b.dataset.opOpen) { close(); openTask(b.dataset.opOpen); }
    else if (b.dataset.opMove) { close(); reassign(b.dataset.opMove, 'staff', uid); }
    else if (b.hasAttribute('data-op-all')) { close(); state.filters = { ...EMPTY_FILTERS, owner: uid }; state.tab = 'tasks'; saveLocal('tab', 'tasks'); renderNow(); }
    else if (b.hasAttribute('data-op-abs')) { close(); openAbsences(uid); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('[data-m="close"]').focus();
}
// Drag a person onto a colleague: choose which card to hand over, then the usual confirmation (specialization check).
function pickCardToHand(from, to) {
  const cards = officeState(from).cards;
  if (!cards.length) return toast(`У ${from.name} нет открытых карточек.`, true);
  if (cards.length === 1) return reassign(cards[0].id, 'staff', from.id, to.id);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="pctitle"><h2 id="pctitle">Что передать: ${esc(shortName(from.name))} → ${esc(shortName(to.name))}</h2>
    <div class="op-list">${cards.map(t => `<button class="op-row op-pick" type="button" data-pick="${esc(t.id)}">${marksHtml(t)}<span>${esc(projectOf(t)?.name || '')}</span><span class="spacer"></span>${statusChip(t)}</button>`).join('')}</div>
    <div class="modal-f"><button class="btn" type="button" data-m="close">Отмена</button></div></div>`;
  document.body.append(root);
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === root || b?.dataset.m === 'close') return root.remove();
    if (b?.dataset.pick) { root.remove(); reassign(b.dataset.pick, 'staff', from.id, to.id); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
}
let officeDrag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest?.('#office .o-person');
  if (!g || e.button !== 0 || !canEditFields()) return;
  officeDrag = { id: g.dataset.person, x: e.clientX, y: e.clientY, moved: false, ghost: null };
});
document.addEventListener('pointermove', e => {
  const d = officeDrag;
  if (!d) return;
  if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
    d.moved = true;
    d.ghost = document.createElement('div');
    d.ghost.className = 'office-ghost';
    d.ghost.textContent = '📁 передать…';
    document.body.append(d.ghost);
    document.body.classList.add('col-resizing');
  }
  if (d.ghost) {
    d.ghost.style.left = e.clientX + 12 + 'px'; d.ghost.style.top = e.clientY + 8 + 'px';
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#office .o-person');
    $$('#office .o-person.drop-ok').forEach(x => { if (x !== over) x.classList.remove('drop-ok'); });
    if (over && over.dataset.person !== d.id) over.classList.add('drop-ok');
  }
});
document.addEventListener('pointerup', e => {
  const d = officeDrag;
  officeDrag = null;
  if (!d) return;
  d.ghost?.remove();
  document.body.classList.remove('col-resizing');
  $$('#office .o-person.drop-ok').forEach(x => x.classList.remove('drop-ok'));
  if (!d.moved) return;
  suppressClick = true; // the drag ends with a click on the person under the mouse
  setTimeout(() => { suppressClick = false; }, 0);
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#office .o-person');
  if (!over || over.dataset.person === d.id) return;
  const from = state.users.get(d.id), to = state.users.get(over.dataset.person);
  if (from && to) { track('drop:office'); pickCardToHand(from, to); }
});

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'office-person': ({ id }) => { officePerson(id); },
  'office-zoom': ({ el }) => { setOffice({ zoom: Math.min(2, Math.max(0.5, (officePrefs.zoom || 1) * (el.dataset.dir === 'in' ? 1.2 : 1 / 1.2))) }); },
  'office-fit': () => { setOffice({ zoom: 1 }); },
  'office-anim': () => { setOffice({ anim: officePrefs.anim === false }); },
  'office-labels': () => { setOffice({ labels: !officePrefs.labels }); },
  'org-fold': ({ el }) => { const id = el.dataset.id; if (el.dataset.open === 'true') { orgOpen.delete(id); orgOpen.add('x:' + id); } else { orgOpen.add(id); orgOpen.delete('x:' + id); } saveLocal('orgOpen', [...orgOpen]); renderNow(); },
  'org-people': ({ el }) => { orgToggle('p:' + el.dataset.id); },
  'org-add': ({ el }) => { askDept(null, el.dataset.parent || ''); },
  'org-edit': ({ el }) => { const d = state.depts.get(el.dataset.id); if (d) askDept(d); },
  'org-from-groups': () => { orgFromGroups(); },
});
/* ---------- Gantt chart: drag to pan, Ctrl+wheel or buttons to zoom ---------- */
const GANTT_MIN_DAYS = 7, GANTT_MAX_DAYS = 730;
const GANTT_PRESETS = [[14, '2 нед'], [31, 'Месяц'], [63, '2 мес'], [92, 'Квартал'], [183, 'Полгода'], [365, 'Год']];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const isoOf = n => new Date(n * 864e5).toISOString().slice(0, 10); // n = dayNum (UTC days)

// Tick marks adapt to the zoom: days → weeks → months → quarters.
function ganttTicks(from, span) {
  const start = dayNum(from), end = start + span, out = [];
  if (span <= 31) {
    for (let n = start; n <= end; n++) {
      const iso = isoOf(n), [, m, d] = iso.split('-');
      out.push({ iso, label: d === '01' || n === start ? `${+d} ${MONTHS[+m - 1]}` : String(+d), major: d === '01' });
    }
  } else if (span <= 120) {
    for (let n = start; n <= end; n++) {
      const iso = isoOf(n);
      if (new Date(n * 864e5).getUTCDay() === 1) out.push({ iso, label: fmtDate(iso).slice(0, 5), major: false });
    }
  } else {
    const step = span <= 400 ? 1 : 3;
    let [y, m] = from.split('-').map(Number);
    for (;;) {
      const iso = `${y}-${String(m).padStart(2, '0')}-01`;
      if (dayNum(iso) > end) break;
      if (dayNum(iso) >= start) out.push({ iso, label: m === 1 ? `${MONTHS[0]} ${y}` : MONTHS[m - 1], major: m === 1 });
      m += step; if (m > 12) { m -= 12; y++; }
    }
  }
  return out;
}

const ganttModeSeg = () => `<span class="seg g-mode"><button class="btn sm ${state.gantt.mode === 'vac' ? '' : 'on'}" type="button" data-act="g-mode" data-v="work">Работы</button><button class="btn sm ${state.gantt.mode === 'vac' ? 'on' : ''}" type="button" data-act="g-mode" data-v="vac">График отпусков</button></span>`;
// 4.1: a card without an executor — a red person with a question mark (Gantt bars and the legend).
const NOEXEC_ICON = '<svg class="noexec-ic" viewBox="0 0 16 16" aria-label="нет исполнителя" role="img"><circle cx="6" cy="4.6" r="2.6" fill="currentColor"/><path d="M1.2 14.5c.3-3.3 2.2-5.2 4.8-5.2s4.5 1.9 4.8 5.2z" fill="currentColor"/><text x="12.6" y="8.6" font-size="8.5" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Arial,sans-serif">?</text></svg>';
// «Межраздельные задания» — shown or hidden in one view; remembered per view.
const assignChk = view => `<label class="chk sm-chk" title="Задания смежным разделам (кто кому что выдаёт)"><input type="checkbox" data-act="show-assign" data-v="${view}"${state.showAssign[view] ? ' checked' : ''}> Межраздельные задания</label>`;
/* ---------- 4.1.1: critical path (58) and the effect of a move (57) ---------- */
let cpCache = null;
function cpOf(pid) {
  if (!cpCache || cpCache.tasks !== state.tasks) cpCache = { tasks: state.tasks, m: new Map() };
  if (!cpCache.m.has(pid)) cpCache.m.set(pid, L.criticalPath(tasksArr().filter(t => t.projectId === pid)));
  return cpCache.m.get(pid);
}
// The contract date the project must meet: the end of «Стадия Р», else of «Стадия П».
const projDeadline = p => { const ph = k => (p?.phases || []).find(x => x.key === k); return (isDate(ph('r')?.finish) && ph('r').finish) || (isDate(ph('p')?.finish) && ph('p').finish) || ''; };
function cpSummary(p, end = cpOf(p.id).end) {
  if (!end) return '';
  const dl = projDeadline(p), diff = dl ? dayNum(dl) - dayNum(end) : null;
  return `<span class="cp-sum ${diff !== null && diff < 0 ? 'bad' : ''}" title="Расчётная сдача — окончание последней работы с учётом зависимостей">сдача ${fmtDate(end)}${dl ? ` · договор ${fmtDate(dl)} · ${diff >= 0 ? `запас ${diff} дн.` : `опоздание ${-diff} дн.`}` : ''}</span>`;
}
function viewGantt() {
  if (isEmpty()) return emptyState();
  if (state.gantt.mode === 'vac') return viewVacations();
  const g = state.gantt;
  const from = g.from, span = g.days, to = addDays(from, span);
  const pos = d => ((dayNum(d) - dayNum(from)) / span) * 100;
  const clamp = v => Math.min(100, Math.max(0, v));
  const inRange = d => d >= from && d <= to;
  const dayW = 100 / span;
  const gq = state.ganttFilter || (state.ganttFilter = { project: '', mark: '' });
  const active = tasksArr().filter(t => t.status !== 'done' && (state.showAssign.gantt || t.kind !== 'assign') && (!gq.project || t.projectId === gq.project) && (!gq.mark || sectionsOf(t).includes(gq.mark)));
  const byProject = g.group === 'project', byOwner = g.group === 'owner' && !isSpec();
  const crit = !!g.crit;
  const groups = byProject
    ? liveProjects().map(p => ({ key: 'p' + p.id, name: p.name, sub: p.code, tasks: active.filter(t => t.projectId === p.id) }))
    : byOwner ? liveUsers().sort(byName).map(u => ({ key: 'u' + u.id, name: u.name, user: u, sub: A.ROLES[u.role]?.label, tasks: active.filter(t => hasOwner(t, u.id)) }))
    : [...execStaff().map(u => ({ key: 'x' + u.id, name: u.name, sub: 'штатный', tasks: active.filter(t => executorOf(t)?.u?.id === u.id) })), ...contractorsArr().map(c => ({ key: 'c' + c.id, name: c.name, tasks: active.filter(t => t.contractorId === c.id) }))];
  // With a filter on, rows without matching cards only add noise.
  if (gq.project || gq.mark) for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].tasks.length) groups.splice(i, 1);
  if (byOwner) {
    const none = active.filter(t => !ownerOf(t));
    if (none.length) groups.push({ key: 'u-none', name: 'Без ответственного', tasks: none, unassigned: true });
  } else if (byProject) {
    const orphans = active.filter(t => !state.projects.has(t.projectId));
    if (orphans.length) groups.push({ key: 'p-none', name: 'Без проекта', tasks: orphans });
  } else {
    const none = active.filter(t => !executorOf(t));
    if (none.length) groups.push({ key: 'c-none', name: 'Не назначен', tasks: none, unassigned: true });
  }

  const ticks = ganttTicks(from, span);
  // Non-working days from the production calendar (weekends, holidays, transfers); working Saturdays stay clear.
  const offDays = span <= 120 ? Array.from({ length: span + 1 }, (_, i) => addDays(from, i)).map(d => ({ d, info: L.Cal.dayInfo(d) })).filter(x => x.info.off) : [];
  const shade = offDays.map(({ d, info }) => `<span class="tl-we ${info.holiday || info.transfer ? 'hol' : ''}" style="left:${pos(d)}%;width:${dayW}%"${info.holiday || info.transfer ? ` title="${esc(info.holiday || L.Cal.transferLabel)} · ${fmtDate(d)}"` : ''}></span>`).join('');
  const today = inRange(state.today) ? `<span class="tl-now" style="left:${pos(state.today) + dayW / 2}%"></span>` : '';
  const grid = ticks.map(t => `<span class="tq-grid ${t.major ? 'major' : ''}" style="left:${pos(t.iso)}%"></span>`).join('');
  const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
  const unofficial = years.filter(y => !L.Cal.isOfficialYear(y));

  const head = `<div class="tl-row tl-head"><div class="tl-name">${byProject ? 'Проект' : byOwner ? 'Ответственный' : 'Исполнитель'}<span class="tl-resize" data-gantt-resize title="Потяните, чтобы изменить ширину"></span></div>
    <div class="tl-track" data-gantt-track>${ticks.map(t => `<span class="tl-tick ${t.major ? 'major' : ''}" style="left:${pos(t.iso)}%">${esc(t.label)}</span>`).join('')}
    ${inRange(state.today) ? `<span class="tl-today" style="left:${pos(state.today) + dayW / 2}%"><b>сегодня</b></span>` : ''}</div></div>`;

  const rows = groups.map(grp => {
    const gkey = 'g:' + grp.key;
    if (isFolded(gkey)) {
      const late = grp.tasks.filter(t => timing(t).overdue).length;
      return `<div class="tl-row tl-folded ${grp.unassigned ? 'tl-unassigned' : ''}"><div class="tl-name">${foldBtn(gkey, true)}<b title="${esc(grp.name)}">${esc(grp.name)}</b><span class="hint">в работе ${grp.tasks.length}${late ? ` · <span class="neg">сорвано ${late}</span>` : ''}</span></div><div class="tl-track" data-gantt-track style="height:22px">${shade}${grid}${today}</div></div>`;
    }
    let before = 0, after = 0;
    const items = [];
    for (const t of grp.tasks) {
      const tm = timing(t);
      const s = isDate(t.start) ? t.start : state.today;
      const e = tm.overdue ? state.today : isDate(t.finish) ? t.finish : addDays(s, 30);
      if (s > to) { after++; continue; }
      if (e < from) { before++; continue; }
      items.push({ t, s, e, tm });
    }
    items.sort((a, b) => a.s.localeCompare(b.s));
    const lanes = [];
    for (const it of items) {
      let lane = lanes.findIndex(end => end < it.s);
      if (lane < 0) { lane = lanes.length; lanes.push(''); }
      lanes[lane] = it.e;
      it.lane = lane;
    }
    const bars = items.map(({ t, s, e, tm, lane }) => {
      const tone = tm.overdue ? 'bad' : (STATUSES[t.status] || STATUSES.not_started).tone;
      const planEnd = tm.overdue && isDate(t.finish) ? t.finish : e;
      const left = clamp(pos(s)), right = clamp(pos(planEnd) + dayW); // the finish day itself is included
      const who = byProject ? executorOf(t)?.name || 'нет исполнителя' : projectOf(t)?.name || '';
      const label = `${marksText(t)} · ${who}`;
      const ext = tm.overdue && isDate(t.finish)
        ? (() => { const l = clamp(pos(t.finish) + dayW), r = clamp(pos(state.today) + dayW); return r > l ? `<span class="tl-late" style="left:${l}%;width:${r - l}%;top:${lane * 26 + 6}px" title="Просрочка ${tm.late} дн."></span>` : ''; })() : '';
      const ms = L.milestonesOf(t, state.today).list.filter(m => isDate(m.date) && inRange(m.date))
        .map(m => `<span class="tq-ms ${m.done ? 'done' : m.date < state.today ? 'bad' : ''}" style="left:${pos(m.date) + dayW / 2}%;top:${lane * 26 + 8}px" title="КТ «${esc(m.title)}» ${fmtDate(m.date)}${m.done ? ' — выполнена' : ''}"></span>`).join('');
      const blocked = L.dependencyIssues(t, state.tasks, state.today).length > 0;
      const noexec = !executorOf(t);
      const awayHit = absHits(t).some(h => h.onFinish);
      const cp = crit ? cpOf(t.projectId) : null, isCrit = cp?.critical.has(t.id), fl = cp?.float.get(t.id);
      const bar = right > left ? `<button class="tl-bar tone-${tone} ${isCrit ? 'crit' : ''} ${pos(s) < 0 ? 'cut-l' : ''} ${pos(planEnd) + dayW > 100 ? 'cut-r' : ''} ${blocked ? 'blocked' : ''} ${noexec ? 'noexec' : ''} ${awayHit ? 'away' : ''}" type="button"
        data-act="open-task" data-id="${esc(t.id)}" data-bar="${esc(t.id)}"
        style="left:${left}%;width:${Math.max(0.5, right - left)}%;top:${lane * 26 + 3}px"
        title="${esc(label)}\n${fmtDate(t.start)} → ${fmtDate(t.finish)} · ${esc(tm.text)}${awayHit ? '\nФиниш приходится на отсутствие: ' + esc(absHits(t).filter(h => h.onFinish).map(A.absenceText).join('; ')) : ''}\nТяните — сдвинуть работу, края — изменить старт или финиш">${isCrit ? '<span class="tl-cp" title="Критический путь: задержка сдвинет сдачу проекта">КП</span>' : ''}${noexec ? NOEXEC_ICON : ''}${esc(label)}${crit && !isCrit && fl > 0 ? `<span class="tl-float">запас ${fl} дн.</span>` : ''}</button>` : '';
      return bar + ext + ms;
    }).join('');
    // Staff rows: vacation / sick leave as a hatched band over the row.
    const away = grp.user ? A.absencesOf(grp.user).filter(a => a.to >= from && a.from <= to).map(a => {
      const l = clamp(pos(a.from)), r = clamp(pos(a.to) + dayW);
      return `<span class="tl-away" style="left:${l}%;width:${Math.max(0.5, r - l)}%" title="${esc(grp.user.name)}: ${esc(A.ABSENCE_KINDS[a.kind] || 'отсутствует')} ${fmtDate(a.from)}–${fmtDate(a.to)}${a.note ? ' · ' + esc(a.note) : ''}"></span>`;
    }).join('') : '';
    const busy = lanes.length;
    const outside = [before ? `${before} раньше` : '', after ? `${after} позже` : ''].filter(Boolean).join(', ');
    return `<div class="tl-row ${grp.unassigned ? 'tl-unassigned' : ''}">
      <div class="tl-name">${foldBtn(gkey, false)}<b title="${esc(grp.name)}">${esc(grp.name)}</b>${crit && byProject && state.projects.get(grp.key.slice(1)) ? cpSummary(state.projects.get(grp.key.slice(1))) : ''}<span class="hint">${grp.sub ? `${esc(grp.sub)} · ` : ''}${grp.tasks.length ? `в работе ${grp.tasks.length}` : byProject ? 'нет незавершённых' : 'свободен'}${!byProject && busy > 1 ? ` · одновременно до <span class="${busy >= 3 ? 'neg' : ''}">${busy}</span>` : ''}${outside ? ` · вне экрана: ${outside}` : ''}</span></div>
      <div class="tl-track" data-gantt-track style="height:${Math.max(1, lanes.length) * 26 + 6}px">${shade}${away}${grid}${today}${bars}</div>
    </div>`;
  }).join('');

  const preset = GANTT_PRESETS.map(([d, l]) => `<button class="btn sm ${g.days === d ? 'on' : ''}" type="button" data-act="g-scale" data-days="${d}">${l}</button>`).join('');
  return `<section class="panel">
    <div class="panel-h"><h3>Диаграмма Ганта</h3>${ganttModeSeg()}<span class="meta">${fmtDate(from)} — ${fmtDate(to)} · ${span} дн. · незавершённые карточки</span></div>
    <div class="gantt-bar one-row">
      <select id="gq-project" aria-label="Проект" class="sm-sel"><option value="">Все проекты</option>${liveProjects().map(p => `<option value="${esc(p.id)}"${gq.project === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select id="gq-mark" aria-label="Раздел" class="sm-sel"><option value="">Все разделы</option>${normalizeMarks(tasksArr().filter(t => t.status !== 'done').flatMap(sectionsOf)).map(m => `<option value="${esc(m)}"${gq.mark === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
      ${assignChk('gantt')}
      <button class="btn sm ${crit ? 'on' : ''}" type="button" data-act="g-crit" title="Подсветить работы, от которых зависит дата сдачи; у остальных — запас дней">Критический путь</button>${crit && gq.project && state.projects.get(gq.project) ? cpSummary(state.projects.get(gq.project)) : ''}
      <button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="1" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Свернуть все строки">▸ все</button><button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="0" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Развернуть все строки">▾ все</button>
      <div class="seg" role="group" aria-label="Группировка"><button class="btn sm ${byProject || byOwner ? '' : 'on'}" type="button" data-act="g-group" data-group="contractor">По исполнителям</button>${isSpec() ? '' : `<button class="btn sm ${byOwner ? 'on' : ''}" type="button" data-act="g-group" data-group="owner">По ответственным</button>`}<button class="btn sm ${byProject ? 'on' : ''}" type="button" data-act="g-group" data-group="project">По проектам</button></div>
      <div class="seg" role="group" aria-label="Масштаб">${preset}</div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-zoom" data-dir="in" title="Крупнее (Ctrl + колесо вверх)">+</button><button class="btn sm" type="button" data-act="g-zoom" data-dir="out" title="Мельче (Ctrl + колесо вниз)">−</button></div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-shift" data-dir="-1" title="Назад">←</button><button class="btn sm" type="button" data-act="g-today">Сегодня</button><button class="btn sm" type="button" data-act="g-shift" data-dir="1" title="Вперёд">→</button></div>
      <span class="help-dot" tabindex="0" title="Фон диаграммы тяните мышью — прокрутка по датам; полоску — сдвиг работы; край полоски — старт или финиш. Ctrl + колесо — масштаб.">?</span>
    </div>
    <div class="tablewrap"><div class="tl" id="gantt" style="--tl-name:${g.nameW}px">${head}${rows || `<div class="none">${gq.project || gq.mark ? 'Под выбранный проект и раздел незавершённых карточек нет — сбросьте фильтр над диаграммой.' : 'Нет незавершённых карточек. Когда у карточек появятся старт и финиш, здесь будет видно, кто чем занят и где пересекаются сроки.'}</div>`}</div></div>
    <div class="tl-legend hint"><span class="tl-key tone-work"></span>в работе <span class="tl-key tone-idle"></span>не начат <span class="tl-key tone-review"></span>на проверке
      <span class="tl-key tone-warn"></span>на доработке <span class="tl-key tone-bad"></span>срок сорван <span class="tq-ms"></span>контрольная точка
      <span class="tl-arrow"></span>зависимость <span class="tl-key tl-key-hol"></span>выходные и праздники ${NOEXEC_ICON}нет исполнителя
      ${unofficial.length ? `<span class="cal-note">Календарь на ${unofficial.join(', ')} г. — по общему правилу (постановления о переносах нет в программе).</span>` : ''}</div>
  </section>`;
}

// «График отпусков»: staff rows with vacations and sick leaves on the same time scale, and how many are away each day.
function viewVacations() {
  const g = state.gantt, from = g.from, span = g.days, to = addDays(from, span);
  const pos = d => ((dayNum(d) - dayNum(from)) / span) * 100, dayW = 100 / span;
  const clamp = v => Math.min(100, Math.max(0, v));
  const staff = staffArr();
  const ticks = ganttTicks(from, span);
  const grid = ticks.map(tk => `<span class="tq-grid ${tk.major ? 'major' : ''}" style="left:${pos(tk.iso)}%"></span>`).join('');
  const nowIn = state.today >= from && state.today <= to;
  const today = nowIn ? `<span class="tl-now" style="left:${pos(state.today) + dayW / 2}%"></span>` : '';
  const offDays = span <= 120 ? Array.from({ length: span + 1 }, (_, i) => addDays(from, i)).filter(d => L.Cal.dayInfo(d).off) : [];
  const shade = offDays.map(d => `<span class="tl-we" style="left:${pos(d)}%;width:${dayW}%"></span>`).join('');
  // Away per day → a strip of cells; deeper colour = more people away at once.
  const awayOn = d => staff.filter(u => A.absencesOf(u).some(a => a.from <= d && a.to >= d));
  const step = span <= 120 ? 1 : 7;
  const cells = [];
  for (let i = 0; i <= span; i += step) {
    const d = addDays(from, i), n = Math.max(...Array.from({ length: step }, (_, k) => awayOn(addDays(d, k)).length));
    if (n) cells.push(`<span class="vac-cell v${Math.min(4, n)}" style="left:${pos(d)}%;width:${dayW * step}%" title="${fmtDate(d)}${step > 1 ? ' (неделя)' : ''}: отсутствуют ${n} — ${esc(awayOn(d).map(u => u.name).join(', '))}">${span <= 63 ? n : ''}</span>`);
  }
  const rows = staff.map(u => {
    const list = A.absencesOf(u).filter(a => a.to >= from && a.from <= to);
    const bars = list.map(a => {
      const l = clamp(pos(a.from)), r = clamp(pos(a.to) + dayW);
      return `<span class="vac-bar k-${a.kind}" style="left:${l}%;width:${Math.max(0.6, r - l)}%" title="${esc(u.name)}: ${esc(A.ABSENCE_KINDS[a.kind] || 'отсутствует')} ${fmtDate(a.from)}–${fmtDate(a.to)}${a.note ? ' · ' + esc(a.note) : ''}">${esc(A.ABSENCE_KINDS[a.kind] || '')} ${fmtDate(a.from).slice(0, 5)}–${fmtDate(a.to).slice(0, 5)}</span>`;
    }).join('');
    // Deadlines of the person's cards that fall into an absence: the reason this chart exists.
    const hits = tasksArr().filter(t => hasOwner(t, u.id) && absHits(t).some(h => h.user.id === u.id && h.onFinish) && t.finish >= from && t.finish <= to)
      .map(t => `<span class="vac-hit" style="left:${pos(t.finish) + dayW / 2}%" title="Финиш ${marksText(t)} (${esc(projectOf(t)?.name || '')}) ${fmtDate(t.finish)} — во время отсутствия"></span>`).join('');
    return `<div class="tl-row"><div class="tl-name"><span class="kicons">${userIcons(u)}</span><b title="${esc(u.name)}">${esc(u.name)}</b>${A.canEditAbsences(state.me, u) ? `<button class="btn ghostbtn sm" type="button" data-act="absences" data-id="${esc(u.id)}" title="Отпуска и больничные">＋</button>` : ''}</div>
      <div class="tl-track" style="height:28px">${shade}${grid}${today}${bars}${hits}</div></div>`;
  }).join('');
  const preset = GANTT_PRESETS.map(([d, l]) => `<button class="btn sm ${g.days === d ? 'on' : ''}" type="button" data-act="g-scale" data-days="${d}">${l}</button>`).join('');
  return `<section class="panel">
    <div class="panel-h"><h3>Диаграмма Ганта</h3>${ganttModeSeg()}<span class="meta">${fmtDate(from)} — ${fmtDate(to)} · штатные: ${staff.length}</span></div>
    <div class="gantt-bar one-row"><div class="seg" role="group" aria-label="Масштаб">${preset}</div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-shift" data-dir="-1" title="Назад">←</button><button class="btn sm" type="button" data-act="g-today">Сегодня</button><button class="btn sm" type="button" data-act="g-shift" data-dir="1" title="Вперёд">→</button></div>
      <span class="help-dot" tabindex="0" title="Отпуска и больничные штатных. Красная риска — финиш карточки во время отсутствия. Строка «Отсутствуют» — сколько человек нет одновременно. «＋» у имени — добавить отпуск.">?</span></div>
    <div class="tablewrap"><div class="tl vac" style="--tl-name:${g.nameW}px">
      <div class="tl-row tl-head"><div class="tl-name">Сотрудник</div><div class="tl-track">${ticks.map(tk => `<span class="tl-tick ${tk.major ? 'major' : ''}" style="left:${pos(tk.iso)}%">${esc(tk.label)}</span>`).join('')}${nowIn ? `<span class="tl-today" style="left:${pos(state.today) + dayW / 2}%"><b>сегодня</b></span>` : ''}</div></div>
      <div class="tl-row vac-sum"><div class="tl-name" title="Сколько штатных отсутствует одновременно"><b>Отсутствуют</b></div><div class="tl-track" style="height:24px">${grid}${cells.join('')}</div></div>
      ${rows || '<div class="none">Штатных сотрудников пока нет.</div>'}</div></div>
    <div class="tl-legend hint"><span class="vac-key k-vacation"></span>отпуск <span class="vac-key k-sick"></span>больничный <span class="vac-key k-other"></span>другое <span class="vac-hit legend"></span>финиш карточки на отсутствие</div>
  </section>`;
}

// Dependency arrows: drawn after layout, from the end of a predecessor bar to the start of the dependent one.
function drawGanttLinks() {
  const root = document.getElementById('gantt');
  if (!root) return;
  root.querySelector('.tl-links')?.remove();
  const box = root.getBoundingClientRect();
  const paths = [];
  for (const t of tasksArr()) {
    const deps = L.depsOf(t);
    if (!deps.length) continue;
    const b = root.querySelector(`.tl-bar[data-bar="${CSS.escape(t.id)}"]`);
    if (!b) continue;
    const rb = b.getBoundingClientRect();
    const issues = new Set(L.dependencyIssues(t, state.tasks, state.today).map(i => i.pred.id));
    for (const pid of deps) {
      const a = root.querySelector(`.tl-bar[data-bar="${CSS.escape(pid)}"]`);
      if (!a) continue;
      const ra = a.getBoundingClientRect();
      const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top;
      const d = x2 - x1 >= 14
        ? `M${x1} ${y1} H${x1 + 7} V${y2} H${x2 - 2}`
        : `M${x1} ${y1} h7 V${(y1 + y2) / 2} H${x2 - 9} V${y2} H${x2 - 2}`; // the dependent starts before: route around
      paths.push(`<path d="${d}" class="${issues.has(pid) ? 'bad' : ''}" marker-end="url(#${issues.has(pid) ? 'arr-bad' : 'arr'})"/>`);
    }
  }
  if (!paths.length) return;
  const svg = `<svg class="tl-links" width="${root.scrollWidth}" height="${root.scrollHeight}" aria-hidden="true">
    <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="arr-head"/></marker>
    <marker id="arr-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="arr-head bad"/></marker></defs>
    ${paths.join('')}</svg>`;
  root.insertAdjacentHTML('beforeend', svg);
}

function setGantt(patch) {
  const g = state.gantt;
  Object.assign(g, patch);
  g.days = Math.round(Math.min(GANTT_MAX_DAYS, Math.max(GANTT_MIN_DAYS, g.days)));
  saveLocal('gantt', { days: g.days, nameW: g.nameW, group: g.group, mode: g.mode || 'work' });
  renderNow();
}
// Zoom keeping the day under `anchor` (0..1 across the track) in place.
function zoomGantt(factor, anchor = 0.5) {
  const g = state.gantt;
  const days = Math.round(Math.min(GANTT_MAX_DAYS, Math.max(GANTT_MIN_DAYS, g.days * factor)));
  if (days === g.days) return;
  const pivot = dayNum(g.from) + g.days * anchor;
  setGantt({ days, from: isoOf(Math.round(pivot - days * anchor)) });
}
const trackRect = () => document.querySelector('#gantt [data-gantt-track]')?.getBoundingClientRect();

// Mouse on the chart: the background pans; a bar moves the work; its edges change start or finish.
// A press that moves less than 4 px is a click (opens the card).
let ganttDrag = null, suppressClick = false;
const EDGE_PX = 7;
document.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  suppressClick = false;
  const handle = e.target.closest('[data-gantt-resize]');
  if (handle) {
    e.preventDefault();
    ganttDrag = { mode: 'resize', x: e.clientX, w: state.gantt.nameW };
    document.body.classList.add('col-resizing');
    return;
  }
  if (!e.target.closest('#gantt [data-gantt-track]')) return;
  const r = trackRect();
  if (!r) return;
  const bar = canEditFields() ? e.target.closest('.tl-bar[data-bar]') : null; // specialists only pan the chart
  if (bar) {
    const t = state.tasks.get(bar.dataset.bar);
    if (!t) return;
    const br = bar.getBoundingClientRect();
    const x = e.clientX - br.left;
    const edit = x <= EDGE_PX && !bar.classList.contains('cut-l') ? 'start' : br.width - x <= EDGE_PX && !bar.classList.contains('cut-r') ? 'finish' : 'move';
    track('drag:gantt');
    ganttDrag = { mode: 'bar', edit, id: t.id, x: e.clientX, width: r.width, el: bar, left: parseFloat(bar.style.left), w: parseFloat(bar.style.width), moved: false, delta: 0 };
    return;
  }
  ganttDrag = { mode: 'pan', x: e.clientX, from: state.gantt.from, width: r.width, moved: false };
});
document.addEventListener('pointermove', e => {
  const d = ganttDrag;
  if (!d) {
    // Hint the edges with a resize cursor.
    const bar = e.target.closest?.('#gantt .tl-bar[data-bar]');
    if (bar) {
      const br = bar.getBoundingClientRect(), x = e.clientX - br.left;
      bar.style.cursor = (x <= EDGE_PX && !bar.classList.contains('cut-l')) || (br.width - x <= EDGE_PX && !bar.classList.contains('cut-r')) ? 'ew-resize' : 'grab';
    }
    return;
  }
  const dx = e.clientX - d.x;
  if (d.mode === 'resize') {
    state.gantt.nameW = Math.round(Math.min(420, Math.max(110, d.w + dx)));
    document.getElementById('gantt')?.style.setProperty('--tl-name', state.gantt.nameW + 'px');
    drawGanttLinks();
    return;
  }
  if (!d.moved && Math.abs(dx) < 4) return;
  if (!d.moved) { d.moved = true; document.body.classList.add(d.mode === 'bar' ? 'bar-dragging' : 'panning'); }
  const days = Math.round((dx / d.width) * state.gantt.days);
  if (d.mode === 'pan') {
    const from = addDays(d.from, -days);
    if (from !== state.gantt.from) { state.gantt.from = from; renderNow(); }
    return;
  }
  // Bar: preview only; saved on release.
  d.delta = days;
  const step = 100 / state.gantt.days;
  let left = d.left, w = d.w;
  if (d.edit === 'move') left = d.left + days * step;
  if (d.edit === 'start') { left = d.left + days * step; w = d.w - days * step; }
  if (d.edit === 'finish') w = d.w + days * step;
  if (w < step) { w = step; if (d.edit === 'start') left = d.left + d.w - step; }
  d.el.style.left = left + '%';
  d.el.style.width = w + '%';
  d.el.classList.add('editing');
  previewFollowers(d);
  showDragHint(e, d);
});
// While a bar is dragged: where the cards waiting for it would go (hatched ghosts) and the new end of the project.
function previewFollowers(d) {
  const t = state.tasks.get(d.id);
  $$('#gantt .tl-ghost').forEach(x => x.remove());
  d.follow = null;
  if (!t || !d.delta || d.edit === 'start') return;
  const next = draggedDates(t, d), moved = L.shiftFollowers(tasksArr(), t.id, next);
  moved.delete(t.id);
  if (!moved.size) return;
  const g = state.gantt, pct = x => ((dayNum(x) - dayNum(g.from)) / g.days) * 100, dayW = 100 / g.days;
  for (const [id, x] of moved) {
    const bar = $(`#gantt .tl-bar[data-bar="${CSS.escape(id)}"]`);
    if (!bar || !isDate(x.start) || !isDate(x.finish)) continue;
    const gh = document.createElement('span');
    gh.className = 'tl-ghost';
    gh.style.cssText = `left:${pct(x.start)}%;width:${Math.max(0.5, pct(x.finish) + dayW - pct(x.start))}%;top:${bar.style.top}`;
    bar.parentElement.append(gh);
    bar.classList.add('will-move');
  }
  const p = projectOf(t), all = tasksArr().filter(y => y.projectId === t.projectId).map(y => moved.has(y.id) || y.id === t.id ? { ...y, ...(y.id === t.id ? next : moved.get(y.id)) } : y);
  d.follow = { moved, end0: cpOf(t.projectId).end, end1: L.criticalPath(all).end, p };
}
function showDragHint(e, d) {
  const t = state.tasks.get(d.id);
  const { start, finish } = draggedDates(t, d);
  let hint = document.getElementById('drag-hint');
  if (!hint) { hint = document.createElement('div'); hint.id = 'drag-hint'; document.body.append(hint); }
  const sign = d.delta > 0 ? '+' : '';
  hint.textContent = `${fmtDate(start)} → ${fmtDate(finish)}${d.delta ? ` (${sign}${d.delta} дн.)` : ''}`;
  const f = d.follow;
  if (f) {
    const dl = projDeadline(f.p), late = dl && f.end1 > dl ? dayNum(f.end1) - dayNum(dl) : 0;
    const more = document.createElement('div');
    more.className = 'dh-more';
    more.innerHTML = `сдвинутся ещё ${f.moved.size} ${plural(f.moved.size, 'карточка', 'карточки', 'карточек')}${f.end1 !== f.end0 ? `<br>сдача проекта ${fmtDate(f.end0)} → <b>${fmtDate(f.end1)}</b>` : ''}${late ? `<br><b class="neg">позже договора на ${late} дн.</b>` : ''}`;
    hint.append(more);
  }
  hint.style.left = e.clientX + 14 + 'px';
  hint.style.top = e.clientY + 16 + 'px';
}
function draggedDates(t, d) {
  const s0 = isDate(t.start) ? t.start : state.today;
  const f0 = isDate(t.finish) ? t.finish : addDays(s0, 30);
  if (d.edit === 'move') return { start: addDays(s0, d.delta), finish: isDate(t.finish) ? addDays(f0, d.delta) : t.finish || '' };
  if (d.edit === 'start') { const st = addDays(s0, d.delta); return { start: st > f0 ? f0 : st, finish: t.finish || '' }; }
  const fn = addDays(f0, d.delta);
  return { start: t.start || '', finish: fn < s0 ? s0 : fn };
}
document.addEventListener('pointerup', () => {
  const d = ganttDrag;
  if (!d) return;
  ganttDrag = null;
  document.body.classList.remove('panning', 'col-resizing', 'bar-dragging');
  document.getElementById('drag-hint')?.remove();
  $$('#gantt .tl-ghost').forEach(x => x.remove()); $$('#gantt .will-move').forEach(x => x.classList.remove('will-move'));
  if (d.mode === 'resize') saveLocal('gantt', { days: state.gantt.days, nameW: state.gantt.nameW, group: state.gantt.group });
  // The click that ends a drag must not open a card. Chromium may skip that click when the bar under the
  // pointer was re-rendered, so the guard is cleared on the next task and can never swallow a later click.
  if (d.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  if (d.mode === 'bar' && d.moved) {
    const t = state.tasks.get(d.id);
    if (!t || !d.delta) { renderNow(); return; }
    commitDates(d.id, draggedDates(t, d), d.follow?.moved);
  }
});
document.addEventListener('wheel', e => {
  if (!e.target.closest('#gantt')) return;
  const r = trackRect();
  if (!r) return;
  if (e.ctrlKey) {
    e.preventDefault();
    const anchor = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    zoomGantt(e.deltaY < 0 ? 0.8 : 1.25, anchor);
  } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
    const delta = e.shiftKey ? e.deltaY : e.deltaX;
    const shift = Math.round((delta / r.width) * state.gantt.days) || Math.sign(delta);
    setGantt({ from: addDays(state.gantt.from, shift) });
  }
}, { passive: false });

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'g-mode': ({ el }) => { setGantt({ mode: el.dataset.v }); },
  'g-scale': ({ el }) => { zoomGantt(Number(el.dataset.days) / state.gantt.days, dayNum(state.today) >= dayNum(state.gantt.from) && dayNum(state.today) <= dayNum(state.gantt.from) + state.gantt.days ? (dayNum(state.today) - dayNum(state.gantt.from)) / state.gantt.days : 0.5); },
  'g-zoom': ({ el }) => { zoomGantt(el.dataset.dir === 'in' ? 0.7 : 1 / 0.7); },
  'g-shift': ({ el }) => { setGantt({ from: addDays(state.gantt.from, Math.round(state.gantt.days / 3) * Number(el.dataset.dir)) }); },
  'g-group': ({ el }) => { setGantt({ group: el.dataset.group }); },
  'g-today': () => { setGantt({ from: addDays(state.today, -Math.round(state.gantt.days / 9)) }); },
  'g-crit': () => { state.gantt.crit = !state.gantt.crit; saveLocal('ganttCrit', state.gantt.crit); renderNow(); },
});
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
function taskTable(list, { showProject = true, showContractor = true, empty = 'Карточек пока нет.', emptyActs = '', tall = false, limitKey = 'table', select = false } = {}) {
  list = sortTasks(list.slice());
  const showMoney = canMoney(), edit = canEditFields(), showOwner = !isSpec();
  const cols = colOrder().filter(c => !colPrefs.hidden.includes(c.id) || c.fixed)
    .filter(c => (c.id !== 'project' || showProject) && (c.id !== 'contractor' || showContractor) && (c.id !== 'owner' || showOwner) && (!c.money || showMoney));
  const cell = (field, cls, inner) => `<td class="${cls}"${edit || field === 'status' ? ` data-edit="${field}" title="${EDIT_HINT}"` : ''}>${inner}</td>`;
  const HEAD = { project: () => sortTh('project', 'Проект'), marks: () => sortTh('marks', 'Разделы'), owner: () => sortTh('owner', 'Ответственный'),
    contractor: () => sortTh('contractor', 'Исполнитель'), start: () => sortTh('start', 'Старт'), finish: () => sortTh('finish', 'Финиш'),
    status: () => sortTh('status', 'Статус'), ready: () => sortTh('ready', 'Готовность'), budget: () => sortTh('budget', 'Бюджет', 'r'), paid: () => sortTh('paid', 'Оплачено', 'r'), rest: () => sortTh('rest', 'Остаток', 'r') };
  const CELL = {
    project: t => `<td>${esc(projectOf(t)?.name || '— проект удалён —')}</td>`,
    marks: t => `<td><div class="sec">${unread(t) ? '<span class="new-dot" title="Новое для вас"></span>' : ''}${marksHtml(t)}${t.title ? `<span class="t">${esc(t.title)}</span>` : ''}</div></td>`,
    owner: t => { const o = ownerOf(t); return cell('owner', '', o ? `${esc(o.name)}${coOwnersOf(t).length ? ` <span class="chip tone-idle" title="Соисполнители: ${esc(coOwnersOf(t).map(u => u.name).join(', '))}">+${coOwnersOf(t).length}</span>` : ''}<div class="hint role-hint">${esc(A.ROLES[o.role]?.label || '')}</div>${absHits(t).length ? `<div class="due warn" title="${esc(absHits(t).map(A.absenceText).join('; '))}">отпуск/больничный</div>` : ''}${gapsOf(t).length ? `<div class="due ${t.profileOk ? 'warn' : 'bad'}" title="${esc(gapsOf(t).map(x => x.text).join(' '))}">${t.profileOk ? 'не по профилю (подтверждено)' : 'не по профилю'}</div>` : ''}` : '<span class="hint">не назначен</span>'); },
    contractor: t => { const e = executorOf(t); return cell('contractor', '', e ? execLine(t) : '<span class="hint">не назначен</span>'); },
    start: t => cell('start', 'num', fmtDate(t.start)),
    finish: t => { const tm = timing(t); return cell('finish', '', `<div class="num">${fmtDate(t.finish)}</div><div class="due ${tm.cls}">${esc(tm.text)}</div>${finishExtras(t)}`); },
    status: t => cell('status', '', statusChip(t)),
    ready: t => (canEditFields() && L.readinessManual(t.status) ? cell('ready', '', readyHtml(t)) : `<td>${readyHtml(t)}</td>`),
    budget: t => cell('budget', 'r num', money(budgetOf(t))),
    paid: t => `<td class="r"><div class="num">${money(paidOf(t))}</div>${payBar(t)}</td>`,
    rest: t => { const rest = restOf(t), due = L.paymentPlan(t, state.today).dueNow; return `<td class="r"><div class="num ${rest < 0 ? 'neg' : ''}">${money(rest)}</div>${due > 0 ? `<div class="due warn">пора платить ${money(due)}</div>` : ''}</td>`; },
  };
  const lim = limitOf(limitKey, tall ? 150 : 15), shown = list.slice(0, lim);
  const pick = select && state.bulk;
  const allOn = pick && shown.length && shown.every(t => state.bulk.has(t.id));
  const head = `<tr>${pick ? `<th class="bulk-c"><input type="checkbox" data-act="bulk-all" aria-label="Выбрать все показанные"${allOn ? ' checked' : ''} data-ids="${esc(shown.map(t => t.id).join(' '))}"></th>` : ''}${cols.map(c => HEAD[c.id]().replace('<th', `<th draggable="true" data-col="${c.id}"`)).join('')}</tr>`;
  const rows = list.length ? shown.map(t => `<tr class="row${pick && state.bulk.has(t.id) ? ' picked' : ''}" data-act="open-task" data-id="${esc(t.id)}">${pick ? `<td class="bulk-c"><input type="checkbox" data-act="bulk-pick" data-id="${esc(t.id)}"${state.bulk.has(t.id) ? ' checked' : ''} aria-label="Выбрать"></td>` : ''}${cols.map(c => CELL[c.id](t)).join('')}</tr>`).join('')
    : `<tr class="empty-row"><td colspan="${cols.length + (pick ? 1 : 0)}">${esc(empty)}${emptyActs ? ` <span class="empty-acts">${emptyActs}</span>` : ''}</td></tr>`;
  const more = moreBtn(limitKey, list.length, shown.length, tall ? 300 : 100);
  return `<div class="tablewrap${tall ? ' tall' : ''}"><table><thead>${head}</thead><tbody>${rows}</tbody></table>${more ? `<div class="more-row">${more}</div>` : ''}</div>`;
}
function viewTasks() {
  if (isEmpty()) return emptyState();
  const f = state.filters, q = f.q.trim().toLowerCase();
  // «att:…» statuses come from the header counters: the same lists the overview shows.
  const attIds = f.status.startsWith('att:') ? new Set((attention()[f.status.slice(4)] || []).map(t => t.id)) : null;
  const list = tasksArr().filter(t => {
    if (f.project && t.projectId !== f.project) return false;
    if (!execMatch(t, f.contractor)) return false;
    if (attIds && !attIds.has(t.id)) return false;
    if (f.status.startsWith('att:') ? false : f.status === 'overdue' ? !timing(t).overdue : f.status === 'new' ? !unread(t) : f.status === 'quiet' ? !quietList([t]).length : (f.status && t.status !== f.status)) return false;
    if (f.owner && !hasOwner(t, f.owner === 'me' ? state.me?.id : f.owner)) return false;
    if (f.mark && !sectionsOf(t).includes(f.mark)) return false;
    if (q) {
      const hay = [sectionsOf(t).join(' '), t.title, t.note, t.contractNo, projectOf(t)?.name, contractorOf(t)?.name].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort(sortByDeadline);
  const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
  const tt = totals(list);
  return `<div class="filters one-row">${presetBar()}
      ${isSpec() ? '' : `<select id="f-owner" aria-label="Ответственный">${opt('', 'Все ответственные', f.owner)}${opt('me', 'Мои карточки', f.owner)}${liveUsers().sort(byName).map(u => opt(u.id, u.name, f.owner)).join('')}</select>`}
      <select id="f-project" aria-label="Проект">${opt('', 'Все проекты', f.project)}${liveProjects().map(p => opt(p.id, p.name, f.project)).join('')}</select>
      <select id="f-contractor" aria-label="Исполнитель">${execFilterOpts(opt, f.contractor)}</select>
      <select id="f-status" aria-label="Статус">${opt('', 'Любой статус', f.status)}${opt('overdue', 'Срок сорван', f.status)}${opt('new', 'Новое для меня', f.status)}${opt('att:week', 'Сдача ≤ 7 дней', f.status)}${opt('att:milestones', 'Сорваны КТ', f.status)}${opt('att:pay', 'Пора платить', f.status)}${opt('quiet', 'Тишина', f.status)}${Object.entries(STATUSES).map(([k, s]) => opt(k, s.label, f.status)).join('')}</select>
      <select id="f-mark" aria-label="Раздел">${opt('', 'Любой раздел', f.mark)}${normalizeMarks(tasksArr().flatMap(sectionsOf)).map(m => opt(m, m, f.mark)).join('')}</select>
      <input id="f-q" type="search" placeholder="Поиск: раздел, проект, подрядчик, договор" value="${esc(f.q)}">
    </div>
    <section class="panel"><div class="panel-h"><h3>Карточки</h3><span class="meta">${tt.count}${canMoney() ? ` · бюджет ${money(tt.budget)} · оплачено ${money(tt.paid)} · остаток ${money(tt.rest)}` : ''}</span><span class="spacer"></span>${canEditFields() ? `<button class="btn ghostbtn sm${state.bulk ? ' on' : ''}" type="button" data-act="bulk-toggle" title="Отметить несколько карточек и изменить их разом">${state.bulk ? 'Готово' : 'Выбрать несколько'}</button>` : ''}${colsMenu()}</div>
    ${state.bulk ? bulkBar() : ''}
    ${taskTable(list, list.length ? { tall: true, limitKey: 'tasks', select: canEditFields() } : tasksEmpty())}</section>`;
}
// Compact widget: one line per card, grouped by what to do; the header says how many wait for you.
function compactRow(t, side = '') {
  const tm = timing(t), p = projectOf(t);
  return `<button class="cw-row" type="button" data-act="open-task" data-id="${esc(t.id)}">${marksHtml(t)}<span class="cw-p">${esc(p?.name || '—')}</span><span class="cw-d due ${tm.cls}">${side || esc(tm.text)}</span></button>`;
}
function viewCompact() {
  if (isEmpty()) return `<div class="none">Данных пока нет. Разверните окно, чтобы добавить проекты и карточки.</div>`;
  const a = attention(), fresh = tasksArr().filter(unread);
  const mine = [...new Map([...a.review, ...fresh].map(t => [t.id, t])).values()];
  const group = (title, items, tone, side) => items.length ? `<section class="cw-g"><h4 class="tone-${tone}">${title} <b class="num">${items.length}</b></h4>${items.slice(0, 6).map(t => compactRow(t, side?.(t))).join('')}${items.length > 6 ? `<div class="hint cw-more">и ещё ${items.length - 6}</div>` : ''}</section>` : '';
  const waits = mine.length + a.overdue.length;
  const goals = liveProjects().map(p => ({ p, g: L.projectGoal(tasksArr().filter(t => t.projectId === p.id)) })).filter(x => x.g.total).slice(0, 4);
  const html = `<div class="cw-head"><b>${waits ? `Ждут вас: <span class="num">${waits}</span>` : 'Всё по плану'}</b><span class="hint">${fmtDate(state.today)}</span></div>`
    + group('Проверить и прочитать', mine, 'review', t => (t.status === 'review' ? 'на проверке' : 'новое'))
    + group('Срок сорван', a.overdue, 'bad')
    + group('Сдача за 7 дней', a.week, 'warn')
    + group('Сорваны КТ', a.milestones, 'bad', t => esc(L.milestonesOf(t, state.today).overdue[0]?.title || 'КТ'))
    + (canMoney() ? group('Пора платить', a.pay, 'work', t => money(L.paymentPlan(t, state.today).dueNow)) : '')
    + (goals.length ? `<section class="cw-g"><h4>Проекты</h4>${goals.map(({ p, g }) => `<button class="cw-row cw-goal" type="button" data-act="goto-project" data-id="${esc(p.id)}"><span class="cw-p"><b>${esc(p.name)}</b></span>${goalHtml(tasksArr().filter(t => t.projectId === p.id), true)}</button>`).join('')}</section>` : '');
  return `<div class="cw">${html}</div>`;
}
/* ---------- saved filters ---------- */
const EMPTY_FILTERS = { project: '', contractor: '', status: '', mark: '', q: '', owner: '' };
const BUILTIN_PRESETS = [
  { id: 'b-mine', name: 'Мои', f: { owner: 'me' } },
  { id: 'b-overdue', name: 'Сорванные', f: { status: 'overdue' } },
  { id: 'b-new', name: 'Новое для меня', f: { status: 'new' } },
  { id: 'b-review', name: 'На проверке', f: { status: 'review' } },
];
let presets = loadLocal('presets', []);
const sameFilters = (a, b) => Object.keys(EMPTY_FILTERS).every(k => (a[k] || '') === (b[k] || ''));
// Saved filters as one compact list at the start of the filter row.
function presetBar() {
  const cur = state.filters, all = [...BUILTIN_PRESETS, ...presets];
  const isEmptyF = sameFilters(cur, EMPTY_FILTERS);
  const on = all.find(p => sameFilters(cur, { ...EMPTY_FILTERS, ...p.f }));
  return `<select id="f-preset" class="preset-sel" aria-label="Подборка" title="Готовые и сохранённые подборки фильтров"><option value="">${on ? '' : isEmptyF ? 'Подборки…' : 'Свой фильтр'}</option>
      <optgroup label="Готовые">${BUILTIN_PRESETS.map(p => `<option value="${esc(p.id)}"${on?.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
      ${presets.length ? `<optgroup label="Сохранённые">${presets.map(p => `<option value="${esc(p.id)}"${on?.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''}</select>
    ${on && !on.id.startsWith('b-') ? `<button class="btn ghostbtn sm" type="button" data-act="preset-del" data-id="${esc(on.id)}" title="Удалить сохранённую подборку">✕</button>` : ''}
    ${isEmptyF || on ? '' : '<button class="btn ghostbtn sm" type="button" data-act="preset-save" title="Сохранить текущие фильтры как подборку">＋</button>'}
    ${isEmptyF ? '' : '<button class="btn ghostbtn sm" type="button" data-act="preset-reset" title="Сбросить фильтры">Сбросить</button>'}`;
}
function applyPreset(id) {
  const p = [...BUILTIN_PRESETS, ...presets].find(x => x.id === id);
  if (!p) return;
  state.filters = sameFilters(state.filters, { ...EMPTY_FILTERS, ...p.f }) ? { ...EMPTY_FILTERS } : { ...EMPTY_FILTERS, ...p.f };
  renderNow();
}
async function savePreset() {
  const name = await askText('Сохранить фильтр', 'Название', 'Например: ВК по складу');
  if (!name) return;
  presets = [...presets, { id: newId(), name: name.slice(0, 40), f: { ...state.filters } }];
  saveLocal('presets', presets);
  renderNow();
}
function deletePreset(id) {
  presets = presets.filter(p => p.id !== id);
  saveLocal('presets', presets);
  renderNow();
}

/* ---------- usage statistics: what is actually used (kept only on this computer) ---------- */
const usage = { since: new Date().toISOString(), n: {}, ...loadLocal('usage', {}) };
let usageTimer = null;
function track(key) {
  usage.n[key] = (usage.n[key] || 0) + 1;
  clearTimeout(usageTimer);
  usageTimer = setTimeout(() => saveLocal('usage', usage), 1000);
}
// Features worth judging; anything else counted is listed under «Прочее».
const FEATURES = [
  ['tab:overview', 'Вкладка «Сводка»'], ['tab:projects', 'Вкладка «Проекты»'], ['tab:people', 'Вкладка «Люди»'], ['tab:gantt', 'Вкладка «Диаграмма Ганта»'],
  ['tab:kanban', 'Вкладка «Канбан»'], ['tab:tasks', 'Вкладка «Все карточки»'], ['act:people-mode', 'Люди: «Структура / Карточки»'],
  ['act:open-task', 'Открыть карточку'], ['act:new-task', 'Новая карточка'], ['act:quick', 'Быстрые действия (сдал / принять / замечания)'], ['edit:cell', 'Правка прямо в таблице'],
  ['act:task-step', 'Соседняя карточка ‹ ›'], ['act:drawer-wide', 'Карточка на всё окно'], ['act:talk-send', 'Сообщение в обсуждении'], ['act:msg-copy', 'Текст для исполнителя (копировать)'],
  ['act:msg-send', 'Текст для подрядчика (отправить)'], ['act:move-task', 'Передать карточку (кнопка)'], ['drop:move', 'Передать карточку (перетаскиванием)'],
  ['act:absences', 'Отпуска и больничные'], ['act:counter', 'Счётчики в заголовке'], ['act:preset', 'Готовые и свои фильтры'], ['act:preset-save', 'Сохранить свой фильтр'],
  ['act:weekly', 'Сводка за неделю'], ['act:export', 'Отчёт Excel / Word'], ['act:import', 'Импорт из Excel / CSV'], ['act:open-journal', 'Журнал действий'],
  ['act:open-search', 'Поиск (кнопка)'], ['key:search', 'Поиск (Ctrl+K)'], ['key:undo', 'Отменить (Ctrl+Z)'], ['act:open-trash', 'Корзина'],
  ['act:g-group', 'Ганта: группировка'], ['act:g-scale', 'Ганта: масштаб'], ['drag:gantt', 'Ганта: перетаскивание полосок'], ['act:kb-lanes', 'Канбан: дорожки по ответственным'],
  ['drop:kanban', 'Канбан: перетаскивание'], ['act:fold', 'Свернуть / развернуть блок'], ['act:fold-all', 'Свернуть / развернуть все'], ['act:prog-weight', 'Дашборд: по карточкам / по бюджету'],
  ['act:toggle-compact', 'Компактный режим'], ['act:ghost-on', 'Сквозные клики'], ['act:toggle-max', 'На весь экран'], ['act:settings', 'Окно «Настройки»'], ['key:help', 'Справка F1'],
];
function openUsage() {
  setFileMenu(false);
  const days = Math.max(1, Math.round((Date.now() - Date.parse(usage.since)) / 864e5));
  const known = new Map(FEATURES);
  const used = FEATURES.filter(([k]) => usage.n[k]).sort((a, b) => usage.n[b[0]] - usage.n[a[0]]);
  const unused = FEATURES.filter(([k]) => !usage.n[k]);
  const max = Math.max(1, ...used.map(([k]) => usage.n[k]));
  const root = document.createElement('div');
  root.className = 'modal-back usage-modal';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">Статистика использования</h2>
    <p class="hint">С ${fmtDate(usage.since.slice(0, 10))} (${days} дн.). Считается только на этом компьютере и никуда не отправляется — чтобы понять, что в программе нужно, а что можно убрать.</p>
    <h3 class="help-h">Пользуетесь</h3>${used.length ? `<table class="help-t">${used.map(([k, l]) => `<tr><td>${esc(l)}</td><td class="us-bar"><i style="width:${Math.round((usage.n[k] / max) * 100)}%"></i></td><td class="r num">${usage.n[k]}</td></tr>`).join('')}</table>` : '<p class="hint">Пока ничего не набралось.</p>'}
    <h3 class="help-h">Ни разу за этот период</h3><p class="us-unused">${unused.map(([, l]) => `<span class="chip tone-idle">${esc(l)}</span>`).join(' ') || '—'}</p>
    <div class="modal-f"><button class="btn primary" type="button" data-m="cancel">Закрыть</button><button class="btn ghostbtn" type="button" data-m="reset">Начать счёт заново</button></div></div>`;
  document.body.append(root);
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') root.remove();
    if (e.target.dataset.m === 'reset') { usage.since = new Date().toISOString(); usage.n = {}; saveLocal('usage', usage); root.remove(); toast('Счёт начат заново'); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  void known;
}

/* ---------- keyboard help (F1) ---------- */
const HOTKEYS = [
  ['Общие', [['Ctrl+K или Ctrl+F', 'поиск по карточкам, проектам, людям'], ['Ctrl+N', 'новая карточка'], ['Ctrl+Z', 'отменить последнее действие'], ['Ctrl+J', 'журнал действий'],
    ['Alt+1…9', 'вкладки по порядку (зажмите Alt — подсказки на экране)'], ['F11 или двойной щелчок по заголовку', 'окно на весь экран / обратно'], ['Ctrl+Alt+G', 'сквозные клики вкл/выкл (работает и из других программ)'],
    ['Ctrl+щелчок или средняя кнопка по разделу', 'открыть раздел вкладкой — со своими фильтрами'], ['Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+W', 'следующая / предыдущая вкладка, закрыть вкладку'],
    ['Ctrl+Alt+N', 'быстрая карточка из любой программы: «+ ЭОМ #шифр !15.12 @Орлов», Enter — и Пульт снова в трее'],
    ['Ctrl + = / − / 0', 'масштаб интерфейса'], ['F1 или ?', 'эта подсказка']]],
  ['Таблицы и списки', [['Двойной щелчок по ячейке', 'правка прямо в таблице: статус, подрядчик, даты, бюджет'], ['Щелчок по заголовку столбца', 'сортировка'],
    ['Счётчик в заголовке («сорвано 2»…)', 'открыть эти карточки списком']]],
  ['Открытая карточка', [['Alt+↑ / Alt+↓', 'предыдущая / следующая карточка списка'], ['Ctrl+Enter в обсуждении', 'отправить сообщение'], ['Esc', 'закрыть (спросит про несохранённое)']]],
  ['Диаграмма Ганта и Канбан', [['Shift + колесо', 'прокрутка вбок'], ['Тянуть фон', 'прокрутка по датам (Гант)'], ['Ctrl + колесо', 'масштаб (Гант)'], ['Тянуть полоску / её край', 'сдвинуть работу / изменить старт или финиш']]],
];
function openHelp() {
  if (document.querySelector('.help-modal')) return;
  const root = document.createElement('div');
  root.className = 'modal-back help-modal';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">Горячие клавиши</h2>
    ${HOTKEYS.map(([h, rows]) => `<h3 class="help-h">${h}</h3><table class="help-t">${rows.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`).join('')}
    <div class="modal-f"><button class="btn primary" type="button" data-m="cancel">Понятно</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'F1') { e.preventDefault(); e.stopPropagation(); close(); } });
  root.querySelector('button').focus();
}

function openCounter(f) {
  if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
  state.filters = { ...EMPTY_FILTERS, status: f };
  state.tab = 'tasks'; saveLocal('tab', 'tasks');
  renderNow();
  $('#app').scrollTop = 0;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'preset': ({ id }) => { applyPreset(id); },
  'preset-del': ({ id }) => { deletePreset(id); },
  'preset-save': () => { savePreset(); },
  'preset-reset': () => { state.filters = { ...EMPTY_FILTERS }; renderNow(); },
});
/* ---------- bulk actions over picked cards (3.6) ---------- */
function bulkBar() {
  const ids = [...state.bulk].filter(id => state.tasks.has(id)), n = ids.length;
  const owners = A.assignableOwners(state.me, liveUsers()).sort(byName);
  const dis = n ? '' : ' disabled title="Сначала отметьте карточки галочками в таблице"';
  return `<div class="bulk-bar"><b>Выбрано: ${n}</b>
    <span class="bulk-g"><select id="bulk-owner"${dis}><option value="">— ответственный —</option>${owners.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="bulk-owner"${dis}>Назначить</button></span>
    <span class="bulk-g"><select id="bulk-contr"${dis}><option value="">— подрядчик —</option><option value="__none">снять подрядчика</option>${contractorsArr().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="bulk-contr"${dis}>Назначить</button></span>
    <span class="bulk-g">Сдвинуть сроки на <input id="bulk-days" type="number" value="7" step="1" min="-365" max="365"${dis}> дн. <button class="btn sm" type="button" data-act="bulk-shift"${dis}>Сдвинуть</button></span>
    <span class="bulk-g"><button class="btn sm" type="button" data-act="bulk-start"${dis || ' title="Только не начатые и приостановленные"'}>В работу</button><button class="btn danger sm" type="button" data-act="bulk-trash"${dis}>В корзину</button></span>
    ${n ? '<button class="btn ghostbtn sm" type="button" data-act="bulk-clear">Снять выбор</button>' : '<span class="hint">Отметьте карточки галочками в таблице.</span>'}</div>`;
}
async function bulkDo(kind) {
  const list = [...state.bulk].map(id => state.tasks.get(id)).filter(Boolean);
  if (!list.length) return;
  const now = new Date(), stamp = { ts: now.toISOString(), date: todayStr(now) };
  let ops = [], msg = '';
  if (kind === 'owner') {
    const uid = $('#bulk-owner').value, u = state.users.get(uid);
    if (!u) return pageErr('Выберите ответственного.', '#bulk-owner');
    const misfit = list.filter(t => A.profileGaps(u, t).length);
    if (misfit.length && !(await confirmBox(`${u.name} не по профилю для: ${misfit.map(marksText).join(', ')}. Всё равно назначить?`, 'Назначить'))) return;
    ops = list.map(t => op.update('tasks', t.id, { ownerId: uid, coOwnerIds: (t.coOwnerIds || []).filter(x => x !== uid), profileOk: misfit.includes(t) }));
    msg = `${u.name}: назначено карточек ${list.length}`;
  } else if (kind === 'contr') {
    const cid = $('#bulk-contr').value;
    if (!cid) return pageErr('Выберите подрядчика.', '#bulk-contr');
    ops = list.map(t => op.update('tasks', t.id, { contractorId: cid === '__none' ? '' : cid }));
    msg = cid === '__none' ? `Подрядчик снят: ${list.length}` : `${state.contractors.get(cid)?.name}: карточек ${list.length}`;
  } else if (kind === 'shift') {
    const d = Math.round(Number($('#bulk-days').value));
    if (!d || Math.abs(d) > 365) return pageErr('Укажите сдвиг в днях, например 7 или −3.', '#bulk-days');
    const dated = list.filter(t => isDate(t.finish) || isDate(t.start));
    if (!dated.length) return toast('У выбранных карточек нет сроков.');
    const first = dated.find(t => isDate(t.finish));
    const r = first ? await askShiftReason(first, first.finish, addDays(first.finish, d)) : { reason: '', note: '' };
    if (!r) return;
    ops = dated.map(t => {
      const next = { start: isDate(t.start) ? addDays(t.start, d) : t.start || '', finish: isDate(t.finish) ? addDays(t.finish, d) : t.finish || '' };
      const history = [...(t.history || [])];
      if (isDate(t.finish)) history.push({ ...stamp, type: 'finish', from: t.finish, to: next.finish, reason: r.reason, note: r.note ? `${r.note} (массово)` : 'массовый перенос' });
      return op.update('tasks', t.id, { ...next, history });
    });
    msg = `Сроки сдвинуты на ${d > 0 ? '+' : ''}${d} дн.: ${dated.length}`;
  } else if (kind === 'start') {
    const ok = list.filter(t => ['not_started', 'paused'].includes(t.status));
    if (!ok.length) return toast('Среди выбранных нет не начатых или приостановленных.');
    ops = ok.map(t => op.update('tasks', t.id, { status: 'in_progress', history: [...(t.history || []), { ...stamp, type: 'status', from: t.status, to: 'in_progress', note: 'массово' }] }));
    msg = `В работу: ${ok.length}${ok.length < list.length ? ` (остальные не трогали: ${list.length - ok.length})` : ''}`;
  } else if (kind === 'trash') {
    ops = list.map(t => op.update('tasks', t.id, { deletedAt: now.toISOString() }));
    msg = `В корзину: ${list.length}`;
  }
  if (await write(ops, msg)) { state.bulk = new Set(); renderNow(); }
}


let attOpen = false;


let renderQueued = false;

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'bulk-toggle': () => { state.bulk = state.bulk ? null : new Set(); renderNow(); },
  'bulk-pick': ({ e, el, id }) => { e.stopPropagation(); if (el.checked) state.bulk.add(id); else state.bulk.delete(id); renderNow(); },
  'bulk-all': ({ e, el }) => { e.stopPropagation(); const ids = el.dataset.ids.split(' ').filter(Boolean); for (const x of ids) { if (el.checked) state.bulk.add(x); else state.bulk.delete(x); } renderNow(); },
  'bulk-clear': () => { state.bulk = new Set(); renderNow(); },
  'bulk-owner': ({ act }) => { bulkDo(act.slice(5)); },
  'bulk-contr': ({ act }) => { bulkDo(act.slice(5)); },
  'bulk-shift': ({ act }) => { bulkDo(act.slice(5)); },
  'bulk-start': ({ act }) => { bulkDo(act.slice(5)); },
  'bulk-trash': ({ act }) => { bulkDo(act.slice(5)); },
  'counter': ({ el }) => { attOpen = false; openCounter(el.dataset.f); },
});
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
  return extra + [['gip', 'ГИП'], ['chief', 'Главспецы'], ['specialist', 'Специалисты']]
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
// Warns in the card when the chosen person has no direction for some of the marks.
/* ---------- 4.1: «Кто делает» — responsible in the team, executor (staff or outside), one optional co-executor ----------
   Stored: ownerId; contractorId (an outside executor) or execUserId (a staff one); coExecRef 'u:<id>' | 'c:<id>'.
   Staff executor and co-executor also go into coOwnerIds, so visibility and rights stay as before. */
const refUser = r => (String(r || '').startsWith('u:') ? state.users.get(r.slice(2)) || null : null);
const refContractor = r => (String(r || '').startsWith('c:') ? state.contractors.get(r.slice(2)) || null : null);
const refName = r => refUser(r)?.name || refContractor(r)?.name || '';
// Before 4.1 staff co-owners stood in coOwnerIds: the first becomes the executor (when there is no contractor) or the co-executor.
function legacyCo(t) {
  if (t.execUserId !== undefined || t.coExecRef !== undefined) return [];
  return (t.coOwnerIds || []).filter(id => id !== t.ownerId && state.users.has(id));
}
const execRefOf = t => (t.contractorId ? 'c:' + t.contractorId : t.execUserId ? 'u:' + t.execUserId : !t.contractorId && legacyCo(t)[0] ? 'u:' + legacyCo(t)[0] : '');
const coExecRefOf = t => (t.coExecRef !== undefined ? t.coExecRef : (() => { const l = legacyCo(t); const rest = t.contractorId ? l : l.slice(1); return rest[0] ? 'u:' + rest[0] : ''; })());
// Older co-owners beyond the two new fields are kept (and listed) so saving never drops them.
function legacyExtra(t) { const l = legacyCo(t); return t.contractorId ? l.slice(1) : l.slice(2); }
function legacyCoHtml(t) {
  const extra = legacyExtra(t).map(id => state.users.get(id)).filter(Boolean);
  return extra.length ? `<div class="hint legacy-co" data-ids="${esc(extra.map(u => u.id).join(','))}">Ещё работают по карточке (из прежней версии): ${esc(extra.map(u => u.name).join(', '))}</div>` : '';
}
// Executor of a card for lists and the Gantt: { kind: 'staff'|'contractor', name, phone } or null.
function executorOf(t) {
  const c = contractorOf(t);
  if (c) return { kind: 'contractor', name: c.name, phone: c.phone || '', c };
  const u = t.execUserId ? state.users.get(t.execUserId) : (t.coExecRef === undefined ? state.users.get(legacyCo(t)[0] || '') : null);
  return u ? { kind: 'staff', name: u.name, phone: u.phone || '', u } : null;
}
// Filters «Все исполнители / Без исполнителя / <who>»: a contractor id (as before 4.1) or 'u:<staff id>'.
const execMatch = (t, f) => !f || (f === '__none' ? !executorOf(t) : f.startsWith('u:') ? executorOf(t)?.u?.id === f.slice(2) : t.contractorId === f);
const execStaff = () => liveUsers().filter(u => tasksArr().some(t => executorOf(t)?.u?.id === u.id)).sort(byName);
const execFilterOpts = (opt, sel) => `${opt('', 'Все исполнители', sel)}${opt('__none', 'Без исполнителя', sel)}${execStaff().length ? `<optgroup label="Штатные">${execStaff().map(u => opt('u:' + u.id, u.name, sel)).join('')}</optgroup><optgroup label="Внештатные">` : ''}${contractorsArr().map(c => opt(c.id, c.name, sel)).join('')}${execStaff().length ? '</optgroup>' : ''}`;
const execLine = t => { const e = executorOf(t), co = coExecRefOf(t) ? refName(coExecRefOf(t)) : ''; return e ? `${esc(e.name)}${co ? ` <span class="hint">+ ${esc(co)}</span>` : ''}` : ''; };
function execCandidates(marks, onlyFit) {
  const can = new Set(A.assignableOwners(state.me, liveUsers()).map(u => u.id));
  const load = { u: id => tasksArr().filter(t => ACTIVE.has(t.status) && (t.execUserId === id || hasOwner(t, id))).length, c: id => tasksArr().filter(t => t.contractorId === id && ACTIVE.has(t.status)).length };
  // `own`: the section is in the person's own directions / specialty — such people come first; the GIP (not limited) after them.
  const ownDir = u => marks.some(m => (u.directions || []).includes(A.directionOfMark(m)?.id));
  const staff = liveUsers().filter(u => can.has(u.id)).map(u => ({ ref: 'u:' + u.id, name: u.name, sub: `штатный · ${A.ROLES[u.role]?.label || ''}${A.directionLabels(u).length ? ' · ' + A.directionLabels(u).join(', ') : ''}`, fit: !A.profileGaps(u, { sections: marks }).length, own: ownDir(u), n: load.u(u.id) }));
  const outside = contractorsArr().map(c => { const n = marks.length ? L.matchCount(c, marks) : 0; return { ref: 'c:' + c.id, name: c.name, sub: `внештатный${c.specialty ? ' · ' + c.specialty : ''}`, fit: !marks.length || n > 0, own: n > 0, n: load.c(c.id) }; });
  const all = [...staff, ...outside];
  return (onlyFit && marks.length ? all.filter(x => x.fit) : all).sort((a, b) => (b.own - a.own) || (b.fit - a.fit) || a.n - b.n || a.name.localeCompare(b.name, 'ru'));
}
function execPickerHtml(key, label, hint, ref) {
  return `<div class="f exec-pick" data-pick="${key}"><label for="t-${key}-q">${label} <span class="hint">${hint}</span></label>
    <div class="ep-box"><input id="t-${key}-q" class="ep-q" autocomplete="off" placeholder="Начните вводить фамилию или название…" value="${esc(refName(ref))}" role="combobox" aria-expanded="false" aria-controls="t-${key}-list">
      <button class="btn ghostbtn sm ep-clear" type="button" data-act="ep-clear" data-pick="${key}" title="Убрать"${ref ? '' : ' hidden'}>×</button>
      <input type="hidden" name="${key}Ref" value="${esc(ref)}"><div class="ep-list" id="t-${key}-list" role="listbox" hidden></div></div></div>`;
}
function execPickersRefresh() { for (const box of $$('#dform .exec-pick')) epRender(box, false); updateOwnerWarn(); }
function epRender(box, open = true) {
  const q = box.querySelector('.ep-q'), list = box.querySelector('.ep-list');
  const ref = box.querySelector('input[type="hidden"]').value;
  const text = q.value.trim().toLowerCase(), current = refName(ref).toLowerCase();
  const items = execCandidates(selectedMarks(), $('#exec-fit')?.checked).filter(x => !text || text === current || x.name.toLowerCase().includes(text)).slice(0, 40);
  list.innerHTML = items.map((x, i) => `<button type="button" role="option" class="ep-opt${x.ref === ref ? ' sel' : ''}${i === 0 ? ' act' : ''}" data-act="ep-pick" data-pick="${box.dataset.pick}" data-ref="${esc(x.ref)}"><b>${esc(x.name)}</b>${x.fit ? '' : ' <span class="chip tone-warn">не по профилю</span>'}<span class="hint">${esc(x.sub)} · в работе ${x.n}</span></button>`).join('')
    || `<div class="hint ep-none">${$('#exec-fit')?.checked ? 'Подходящих по специальности нет — снимите галку «Только подходящие».' : 'Никого не нашлось.'}</div>`;
  list.hidden = !open; q.setAttribute('aria-expanded', String(open));
}
function epSet(key, ref) {
  const box = $(`#dform .exec-pick[data-pick="${key}"]`);
  if (!box) return;
  box.querySelector('input[type="hidden"]').value = ref;
  box.querySelector('.ep-q').value = refName(ref);
  box.querySelector('.ep-clear').hidden = !ref;
  box.querySelector('.ep-list').hidden = true;
  updateOwnerWarn();
}
document.addEventListener('focusin', e => { const box = e.target.closest?.('.exec-pick'); if (box && e.target.matches('.ep-q')) { e.target.select(); epRender(box, true); } });
document.addEventListener('input', e => { const box = e.target.closest?.('.exec-pick'); if (box && e.target.matches('.ep-q')) epRender(box, true); });
document.addEventListener('keydown', e => {
  const box = e.target.closest?.('.exec-pick');
  if (!box || !e.target.matches('.ep-q')) return;
  const opts = $$('.ep-opt', box), i = opts.findIndex(o => o.classList.contains('act'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (box.querySelector('.ep-list').hidden) epRender(box, true); const j = Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); opts.forEach((o, k) => o.classList.toggle('act', k === j)); opts[j]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter' && !box.querySelector('.ep-list').hidden) { e.preventDefault(); if (opts[i]) epSet(box.dataset.pick, opts[i].dataset.ref); }
  else if (e.key === 'Escape' && !box.querySelector('.ep-list').hidden) { e.preventDefault(); e.stopPropagation(); epSet(box.dataset.pick, box.querySelector('input[type="hidden"]').value); }
});
document.addEventListener('focusout', e => {
  const box = e.target.closest?.('.exec-pick');
  if (!box) return;
  setTimeout(() => { if (!box.contains(document.activeElement)) epSet(box.dataset.pick, box.querySelector('input[type="hidden"]').value); }, 150);
});
// Staff ids on the card besides the responsible one: executor, co-executor and the older co-owners that were kept.
function formOwners() {
  const owner = $('#t-owner')?.value || '';
  const exec = val('execRef'), co = val('coexecRef');
  const legacy = ($('#dform .legacy-co')?.dataset.ids || '').split(',').filter(Boolean);
  return [owner, refUser(exec)?.id, refUser(co)?.id, ...legacy].filter((v, i, a) => v && a.indexOf(v) === i);
}
function formGaps() {
  const marks = selectedMarks();
  return formOwners().map(id => state.users.get(id)).filter(Boolean)
    .map(u => ({ u, g: A.profileGaps(u, { sections: marks }) })).filter(x => x.g.length).map(x => A.profileMessage(x.u, x.g));
}
function updateAbsenceWarn() {
  const box = $('#abs-warn');
  if (!box) return;
  const hits = A.absenceHits({ ownerId: $('#t-owner')?.value, coOwnerIds: formOwners().slice(1), start: val('start'), finish: val('finish') }, liveUsers());
  box.hidden = !hits.length;
  box.textContent = hits.length ? `Внимание: ${hits.map(h => A.absenceText(h) + (h.onFinish ? ' — на эти дни приходится финиш' : '')).join('; ')}.` : '';
}
function updateOwnerWarn() {
  updateAbsenceWarn();
  const box = $('#owner-warn');
  if (!box) return;
  const texts = formGaps();
  box.hidden = !texts.length;
  $('#owner-warn-text').textContent = texts.join(' ');
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'ep-pick': ({ el }) => { epSet(el.dataset.pick, el.dataset.ref); },
  'ep-clear': ({ el }) => { epSet(el.dataset.pick, ''); $(`#t-${el.dataset.pick}-q`)?.focus(); },
  'smart-exec': ({ el }) => { epSet('exec', el.dataset.ref); execPickersRefresh(); smartDefaults(); scheduleTaskDraft({ target: el }); },
});
// The task's place in the composition: a section/volume of ПД or a set of РД.
function compPlaceOf(t) {
  return t?.id ? placeIndex().get(t.id) || null : null;
}
// «Марка» in the task card: no checkbox grid any more. A section of the composition shows where it sits;
// an assignment shows from whom to whom; any other task gets one text field (marks are optional there).
function marksField(t) {
  const marks = sectionsOf(t), hidden = `<input type="hidden" name="marksExtra" value="${esc(marks.join(', '))}">`;
  if (t.kind === 'assign') {
    const from = state.tasks.get(t.parentId), to = (t.toTaskIds || []).map(id => state.tasks.get(id)).filter(Boolean);
    return `<div class="f wide asg-box">${hidden}<div class="asg-h"><b>Задание смежнику</b> <button class="btn ghostbtn sm" type="button" data-act="techcard" data-sec="assign" title="Откуда берутся задания — техкарта">? техкарта</button></div>
      <div class="asg-route"><span>от</span> ${from ? `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(from.id)}">${esc(marksText(from))}${from.title ? ' · ' + esc(from.title) : ''}</button>` : '<span class="hint">раздел удалён</span>'}
        <span>→</span> ${to.map(x => `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(x.id)}">${esc(marksText(x))}${x.title ? ' · ' + esc(x.title) : ''}</button>`).join(', ') || '<span class="hint">получатель удалён</span>'}</div>
      <div class="fgrid asg-off"><label class="chk"><input type="checkbox" name="official"${t.official ? ' checked' : ''}> Оформляется официально</label>
        <div class="f"><label for="t-off-no">Номер задания</label><input id="t-off-no" name="officialNo" value="${esc(t.officialNo || '')}" maxlength="40" placeholder="ЗД-ОВ-03"></div>
        <div class="f"><label for="t-off-by">Подписывает</label><input id="t-off-by" name="officialBy" value="${esc(t.officialBy || '')}" maxlength="80" placeholder="ГИП, главспец ОВ"></div></div>
      <span class="hint">Получатель видит это задание у себя как входящее. Пока задание не выдано, смежник ждёт его${state.tasks.get(t.toTaskIds?.[0])?.dependsOn?.includes(t.id) ? ' — срок его старта связан с этим заданием' : ''}.</span></div>`;
  }
  return taskAssignsBlock(t) + `<div class="f wide" id="t-doc-box">${docFieldHtml(t.projectId, t)}</div>`;
}
// «Раздел» of a card: chosen from the project composition (ПД volumes and РД sections not yet taken by another
// card). Without a composition — a code typed by hand. Without a section — a task with an explanation
// (согласование, сбор ИРД). The composition itself is edited on the project's «Состав» tab.
function docFieldHtml(projectId, t, typed = null) {
  const p = state.projects.get(projectId), comp = p?.composition;
  const place = t.projectId === projectId ? compPlaceOf(t) : null;
  const marks = typed ?? sectionsOf(t);
  // Suggestions: ПД sections (ПП РФ № 87) and РД sections (ГОСТ Р 21.101 and practice).
  const known = [...new Map([...Composition.BASES.nonprod.sections.flatMap(([, abbr, title, , subs]) => [[abbr, title], ...(subs || []).map(([a, tl]) => [a, tl])]),
    ...MARK_GROUPS.flatMap(g => g.marks), ...Object.entries(Composition.RD_MARKS).map(([m, [tl]]) => [m, tl])]).entries()];
  const freeInput = (show, value) => `<div class="doc-free"${show ? '' : ' hidden'}><input id="t-marks-extra" name="marksExtra" value="${esc(value)}" placeholder="Шифр раздела: ЭОМ, ИОС1, АР…" maxlength="200" autocomplete="off" aria-label="Шифр раздела" list="marks-dl">
    <datalist id="marks-dl">${known.map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join('')}</datalist>
    <span class="hint">Несколько — через запятую.</span></div>`;
  if (!comp) {
    return `<label for="t-marks-extra">Раздел</label>${freeInput(true, marks.join(', '))}
      <span class="hint">${p ? 'У проекта нет состава документации — разделы можно выбрать из списка, если сформировать состав на вкладке проекта «Состав».' : 'Сначала выберите проект.'} Без раздела — задача с уточнением (согласование, сбор ИРД).</span>`;
  }
  const taken = id => id && id !== t.id && state.tasks.has(id);
  const vols = Composition.volumes(comp, p.code || ''), rds = Composition.rdRows(comp, p.code || '');
  const cur = place?.ref || (marks.length ? 'free' : '');
  const opt = (v, l, dis = false) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`;
  const pdOpts = vols.map(v => { const n = comp.nodes.find(x => x.id === v.id); return opt('pd:' + v.id, `${v.abbr || v.code} · ${v.title}${taken(n?.taskId) ? ' — уже есть карточка' : ''}`, taken(n?.taskId)); }).join('');
  const rdOpts = rds.map(r => opt('rd:' + r.id, `${r.mark} · ${r.title}${taken(r.item.taskId) ? ' — уже есть карточка' : ''}`, taken(r.item.taskId))).join('');
  return `<label for="t-doc">Раздел</label>
    <select id="t-doc" name="docRef">${opt('', '— без раздела: задача (согласование, сбор ИРД…)')}
      ${pdOpts ? `<optgroup label="Проектная документация · стадия П">${pdOpts}</optgroup>` : ''}${rdOpts ? `<optgroup label="Рабочая документация · стадия Р">${rdOpts}</optgroup>` : ''}
      <optgroup label="Другое">${opt('free', 'Свой раздел — вписать шифр…')}</optgroup></select>
    ${freeInput(cur === 'free', place ? '' : marks.join(', '))}
    <span class="hint">${place ? `Том ${esc(String(place.tom))} · ${esc(place.code)}. ` : ''}Разделы берутся из состава проекта (вкладка «Состав»).</span>`;
}
// Codes of the chosen composition section, for directions and contractor suggestions (ИОС1 → ЭС, ЭН, ЭОМ, ЭО).
function docRefSections(projectId, ref) {
  const p = state.projects.get(projectId), comp = p?.composition;
  if (!comp || !ref) return [];
  const [kind, id] = ref.split(':');
  if (kind === 'pd') { const v = Composition.volumes(comp, p.code || '').find(x => x.id === id); return v ? normalizeMarks(v.node.marks?.length ? v.node.marks : [v.abbr]) : []; }
  if (kind === 'rd') { const r = Composition.rdRows(comp, p.code || '').find(x => x.id === id); return r ? normalizeMarks([r.mark]) : []; }
  return [];
}
// The composition with this card linked to `ref` (and unlinked from where it was). null — nothing to change.
function compWithLink(projectId, taskId, ref) {
  const p = state.projects.get(projectId), comp = p?.composition;
  if (!comp) return null;
  const next = JSON.parse(JSON.stringify(comp));
  let changed = false;
  for (const n of next.nodes || []) if (n.taskId === taskId && 'pd:' + n.id !== ref) { n.taskId = ''; changed = true; }
  for (const x of next.rd || []) if (x.taskId === taskId && 'rd:' + x.id !== ref) { x.taskId = ''; changed = true; }
  const [kind, id] = (ref || '').split(':');
  const target = kind === 'pd' ? (next.nodes || []).find(n => n.id === id) : kind === 'rd' ? (next.rd || []).find(x => x.id === id) : null;
  if (target && target.taskId !== taskId) { target.taskId = taskId; changed = true; }
  return changed ? next : null;
}
// In a section's card: its outgoing assignments (subtasks) and the incoming ones it waits for.
function taskAssignsBlock(t) {
  const { out, inc } = assignsOf(t);
  if (!out.length && !inc.length) return '';
  const line = (x, dir) => { const other = dir === 'out' ? (x.toTaskIds || []).map(id => state.tasks.get(id)).filter(Boolean).map(marksText).join(', ') : marksText(state.tasks.get(x.parentId) || {});
    return `<li><button class="linkbtn" type="button" data-act="open-task" data-id="${esc(x.id)}">${dir === 'out' ? '→' : '←'} ${esc(other || x.title)}</button> ${statusChip(x)} <span class="hint">${x.finish ? 'до ' + fmtDate(x.finish) : ''} · ${esc((x.note || '').slice(0, 90))}${(x.note || '').length > 90 ? '…' : ''}</span></li>`; };
  return `<div class="f wide asg-list">${out.length ? `<span class="lbl">Исходящие задания (${out.length})</span><ul>${out.map(x => line(x, 'out')).join('')}</ul>` : ''}
    ${inc.length ? `<span class="lbl">Входящие задания (${inc.length})</span><ul>${inc.map(x => line(x, 'in')).join('')}</ul>` : ''}</div>`;
}
function marksPicker(selected) {
  const known = new Set(MARK_GROUPS.flatMap(g => g.marks.map(m => m[0])));
  const custom = selected.filter(m => !known.has(m));
  const groups = MARK_GROUPS.map(g => `<fieldset class="mk-group" data-dir="${esc(g.dir || '')}"><legend>${esc(g.title)}</legend><div class="mk-grid">${g.marks.map(([code, name]) =>
    `<label class="mk" title="${esc(name)}"><input type="checkbox" name="mark" value="${esc(code)}"${selected.includes(code) ? ' checked' : ''}><span class="code">${esc(code)}</span><small>${esc(name)}</small></label>`).join('')}</div></fieldset>`).join('');
  return `<div class="f wide marks-f">
    <div class="mk-head"><span class="lbl req" id="marks-lbl">Разделы</span><span class="hint" id="marks-count"></span></div>
    <div class="mk-tools" data-transient><input id="mk-search" type="search" placeholder="Найти раздел: ЭО, вент, пожар…" autocomplete="off">
      <button class="btn ghostbtn sm" type="button" data-act="mk-all" id="mk-all"></button></div>
    <div class="mk-groups" role="group" aria-labelledby="marks-lbl">${groups}</div>
    <label for="t-marks-extra">Другие разделы, через запятую</label>
    <input id="t-marks-extra" name="marksExtra" value="${esc(custom.join(', '))}" placeholder="ЭОМ1, АИИС КУЭ" maxlength="200" autocomplete="off">
  </div>`;
}
// Shows only the directions of the chosen responsible person (plus groups with ticked marks); search looks everywhere.
function applyMarksFilter() {
  const box = $('#dform .mk-groups');
  if (!box) return;
  const q = ($('#mk-search')?.value || '').trim().toLowerCase();
  const owner = state.users?.get($('#t-owner')?.value);
  const own = new Set(owner && !A.isGip(owner) ? owner.directions || [] : []);
  const limit = !state.drawer?.allMarks && own.size > 0 && !q;
  let hiddenGroups = 0;
  for (const g of $$('.mk-group', box)) {
    let any = false;
    for (const l of $$('.mk', g)) {
      const hit = !q || l.textContent.toLowerCase().includes(q);
      l.hidden = !hit;
      any ||= hit;
    }
    const keep = any && (!limit || own.has(g.dataset.dir) || $$('input:checked', g).length > 0);
    g.hidden = !keep;
    if (!keep && any) hiddenGroups++;
  }
  const btn = $('#mk-all');
  if (btn) {
    btn.hidden = !(own.size && !q);
    btn.textContent = state.drawer?.allMarks ? 'Только направления ответственного' : `Все направления${hiddenGroups ? ` (+${hiddenGroups})` : ''}`;
  }
}
function selectedMarks() {
  const doc = $('#t-doc');
  if (doc && doc.value && doc.value !== 'free') return docRefSections(val('projectId'), doc.value);
  if (doc && !doc.value) return [];
  const checked = $$('#dform input[name="mark"]:checked').map(i => i.value);
  return normalizeMarks([...checked, ...splitMarks(val('marksExtra'))]);
}
function onMarksChanged() {
  const list = selectedMarks();
  const el = $('#dform .mk-groups') && $('#marks-count');
  if (el) el.textContent = list.length ? `выбрано ${list.length}: ${list.join(', ')}` : 'ничего не выбрано';
  const own = $('#t-owner');
  if (own && !own.disabled) { const v = own.value; own.innerHTML = ownerOptions(v, list); own.value = v; }
  execPickersRefresh();
  updateOwnerWarn();
  applyMarksFilter();
  smartDefaults();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'mk-all': () => { state.drawer.allMarks = !state.drawer.allMarks; applyMarksFilter(); },
});
/* ---------- card discussion ---------- */
function renderTalk() {
  const box = $('#talk-box'), t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const draft = $('#talk-text')?.value || '', typing = document.activeElement?.id === 'talk-text';
  if (talkEdit && $('#talk-edit')) talkEdit.text = $('#talk-edit').value; // keep the edit through a re-render
  if (talkEdit && !(t.comments || []).some(c => c.id === talkEdit.cid)) talkEdit = null;
  const editingNow = document.activeElement?.id === 'talk-edit';
  const list = t.comments || [];
  const when = ts => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `<div class="talk">${list.length ? list.map(c => `<div class="msg-item${c.userId === state.me?.id ? ' mine' : ''}${c.kind === 'submit' ? ' submit' : ''}${c.pending ? ' pending' : ''}">
      <div class="msg-h"><b>${esc(c.user || '—')}</b>${c.kind === 'submit' ? '<span class="chip tone-review">сдал на проверку</span>' : ''}<span class="hint">${when(c.ts)}${c.editedAt ? ' · изменено' : ''}</span>${c.pending ? ' <span class="hint pending-t">ждёт отправки</span>' : c.userId === state.me?.id && talkEdit?.cid !== c.id ? `<button class="edit-msg" type="button" data-act="talk-edit" data-cid="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>
      ${talkEdit?.cid === c.id ? `<div class="msg-edit"><textarea id="talk-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(talkEdit.text)}</textarea>
        <div class="row-in"><button class="btn primary sm" type="button" data-act="talk-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="talk-edit-cancel">Отмена</button><span class="hint">Ctrl+Enter — сохранить, Esc — отмена</span></div></div>`
        : `<div class="msg-t">${esc(c.text)}</div>`}${thankBtn(t, c)}</div>`).join('') : '<div class="hint">Обсуждения пока нет. Здесь видят друг друга ответственные по карточке и их руководители.</div>'}</div>
    <div class="talk-new"><textarea id="talk-text" rows="2" maxlength="2000" placeholder="Написать… (Ctrl+Enter — отправить)">${esc(draft)}</textarea>
      <button class="btn primary" type="button" data-act="talk-send">Отправить</button></div>`;
  const tl = box.querySelector('.talk'); tl.scrollTop = tl.scrollHeight;
  if (typing) { const ta = $('#talk-text'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  if (editingNow) { const ta = $('#talk-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
}
// «Спасибо» under a colleague's message: one per person; the author sees the count and it adds up on their card.
function thankBtn(t, c) {
  if (!game) return '';
  const n = (c.thanks || []).length, mine = (c.thanks || []).includes(state.me?.id), own = c.userId === state.me?.id;
  if (own) return n ? `<div class="thanks-row"><span class="thanks-n" title="Вас поблагодарили">♥ спасибо: ${n}</span></div>` : '';
  if (!c.userId) return '';
  return `<div class="thanks-row"><button class="thanks-btn${mine ? ' on' : ''}" type="button" data-act="thank" data-task="${esc(t.id)}" data-cid="${esc(c.id)}" aria-pressed="${mine}" title="${mine ? 'Убрать спасибо' : 'Поблагодарить — например, за помощь или быструю проверку'}">♥ Спасибо${n ? ` · ${n}` : ''}</button></div>`;
}
async function thank(taskId, cid) {
  const res = await api.thankComment(taskId, cid);
  if (!res?.ok) return toast(res?.message || 'Не удалось.', true);
  await refresh();
  renderTalk();
  if (res.on) toast('Спасибо отправлено');
}
// The field is emptied before sending: the card re-renders while the message is saved, and it must not
// come back with the old text. On failure the text is put back.
async function sendComment() {
  const el = $('#talk-text'), id = state.drawer?.id;
  if (!el || !id || !el.value.trim()) return;
  const text = el.value;
  el.value = '';
  const res = await api.addComment(id, text);
  if (!res?.ok) { const cur = $('#talk-text'); if (cur && !cur.value) cur.value = text; return toast(res?.message || 'Не удалось отправить.', true); }
  await refresh();
  renderTalk();
}
// Editing one's own message in a card discussion: inline, Ctrl+Enter saves, Esc cancels.
let talkEdit = null; // { cid, text }
function talkEditStart(cid) {
  const c = (state.tasks.get(state.drawer?.id)?.comments || []).find(x => x.id === cid);
  if (!c || c.userId !== state.me?.id) return;
  talkEdit = { cid, text: c.text };
  renderTalk();
  const ta = $('#talk-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
async function talkEditSave() {
  const ta = $('#talk-edit'), id = state.drawer?.id;
  if (!talkEdit || !ta || !id) return;
  const text = ta.value.trim();
  if (!text) return toast('Сообщение не может быть пустым.', true);
  const res = await api.editComment(id, talkEdit.cid, text);
  if (!res?.ok) return toast(res?.message || 'Не удалось сохранить.', true);
  talkEdit = null;
  await refresh();
  renderTalk();
}
function talkEditCancel() { talkEdit = null; renderTalk(); }

// Status changes are actions (buttons in the card header, the status cell, the kanban), not a free list.
const QUICK = {
  start: { to: 'in_progress', label: 'Начать работу', okMsg: 'Карточка в работе' },
  submit: { to: 'review', label: 'Сдал на проверку', okMsg: 'Отмечено: сдано на проверку' },
  remarks: { to: 'revision', label: 'Выдать замечания', okMsg: 'Замечания выданы — карточка на доработке' },
  accept: { to: 'done', label: 'Принять работу', okMsg: 'Работа принята' },
  pause: { to: 'paused', label: 'Приостановить', okMsg: 'Карточка приостановлена' },
  resume: { to: 'in_progress', label: 'Возобновить', okMsg: 'Работа возобновлена' },
  reopen: { to: 'in_progress', label: 'Вернуть в работу', okMsg: 'Карточка снова в работе' },
};
// Which actions a status offers. A specialist only submits own work.
function quickKeys(status) {
  const map = { not_started: ['start', 'pause'], in_progress: ['submit', 'pause'], revision: ['submit', 'pause'], review: ['accept', 'remarks'], paused: ['resume'], done: ['reopen'] };
  const keys = map[status] || ['start'];
  return isSpec() ? keys.filter(k => k === 'submit' || (k === 'start' && status === 'not_started')) : keys;
}
const quickFor = (from, to) => Object.keys(QUICK).find(k => QUICK[k].to === to && quickKeys(from).includes(k));

function taskMainPanel(t, isNew) {
  const projects = [...state.projects.values()].filter(p => !p.archived || p.id === t.projectId).sort(byName);
  const marks = sectionsOf(t);
  return `
    ${!projects.length ? '<div class="note-box">Сначала добавьте проект — карточка всегда относится к проекту.</div>' : ''}
    <div class="fgrid">
      <div class="f wide"><label class="req" for="t-project">Проект</label><select id="t-project" name="projectId">${selOpts(projects, t.projectId, '— выберите —')}</select></div>
      ${marksField(t)}
      <fieldset class="f wide who-box"><legend>Кто делает</legend>
        <div class="who-grid">
          <div class="f"><label class="req" for="t-owner" title="${A.isGip(state.me) ? 'ГИП может спустить карточку любому главспецу или специалисту.' : A.isChief(state.me) ? 'Главспец спускает карточки только своим специалистам.' : 'Карточку спустил вам руководитель.'}">Ответственный в команде</label><select id="t-owner" name="ownerId">${ownerOptions(t.ownerId || state.me?.id, marks)}</select></div>
          ${execPickerHtml('exec', 'Исполнитель', 'штатный или внештатный', execRefOf(t))}
          ${execPickerHtml('coexec', 'Соисполнитель', 'необязательно', coExecRefOf(t))}
        </div>
        <label class="chk sm-chk exec-fit"><input type="checkbox" id="exec-fit"${loadLocal('execFit', true) ? ' checked' : ''}> Только подходящие по специальности</label>
        ${legacyCoHtml(t)}
        <div class="warnline soft" id="abs-warn" hidden></div>
        <div class="warnline" id="owner-warn" hidden><span id="owner-warn-text"></span>
          <label class="chk"><input type="checkbox" id="t-profile-ok" name="profileOk"${t.profileOk ? ' checked' : ''}> Всё равно назначить</label></div>
      </fieldset>
      <div class="f"><label for="t-start">Старт работ</label><input id="t-start" name="start" type="date" value="${esc(t.start || '')}"></div>
      <div class="f"><label for="t-finish">Плановый финиш</label><input id="t-finish" name="finish" type="date" value="${esc(t.finish || '')}" data-orig="${esc(isNew ? '' : t.finish || '')}"></div>
      <div class="f wide shift" id="shift-box" hidden>
        <div class="shift-h">Срок переносится: <b id="shift-text"></b></div>
        <div class="fgrid">
          <div class="f"><label class="req" for="t-shift-reason">Причина переноса</label><select id="t-shift-reason" name="shiftReason"><option value="">— выберите —</option>${Object.entries(SHIFT_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          <div class="f"><label for="t-shift-note">Комментарий</label><input id="t-shift-note" name="shiftNote" maxlength="200" placeholder="Например: заказчик сменил ТУ"></div>
        </div>
        <span class="hint">Переносы по вине исполнителя не сдвигают его контрольный срок и учитываются в надёжности.</span>
      </div>
      <div class="f"><span class="lbl">Статус</span>${isNew ? `<label class="chk"><input type="checkbox" id="t-start-now" name="startNow"> Сразу в работу</label><input type="hidden" id="t-status" name="status" value="not_started">`
        : `<div class="status-ro">${statusChip(t)}<input type="hidden" id="t-status" name="status" value="${esc(t.status)}"></div><span class="hint">Меняется кнопками в шапке карточки. «Срок сорван» ставится сам.</span>`}</div>
      <div class="f"><label for="t-ready">Готовность, %</label>
        <div class="ready-in"><input type="range" id="t-ready-r" min="${L.READY_MIN}" max="${L.READY_MAX}" step="5" value="${L.readinessManual(t.status) ? L.readiness(t) : L.READY_MIN}" data-transient aria-label="Готовность, ползунок">
          <input id="t-ready" name="readiness" type="number" min="${L.READY_MIN}" max="${L.READY_MAX}" step="1" value="${L.readinessManual(t.status) ? L.readiness(t) : ''}"></div>
        <span class="hint" id="ready-hint"></span></div>
      ${canMoney() ? `<div class="f"><label for="t-budget">Бюджет, ₽</label><input id="t-budget" name="budget" inputmode="decimal" value="${t.budget ? esc(String(t.budget).replace('.', ',')) : ''}" placeholder="150 000"></div>` : ''}
      <details class="f wide more"${t.title || t.note || t.folder ? ' open' : ''}><summary>Дополнительно: уточнение, папка раздела, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="t-title">Уточнение</label><input id="t-title" name="title" value="${esc(t.title || '')}" placeholder="Корпус 2, стадия Р" maxlength="120"></div>
        <div class="f wide"><label for="t-folder">Папка раздела</label>
          <div class="row-in"><input id="t-folder" name="folder" value="${esc(t.folder || '')}" placeholder="\\\\server\\Проекты\\0425-24\\ЭОМ" maxlength="400">
            <button class="btn" data-act="pick-task-folder" type="button">Выбрать…</button>${projectOf(t)?.folder ? '<button class="btn ghostbtn" data-act="suggest-task-folder" type="button" title="Папка проекта + раздел">Из папки проекта</button>' : ''}</div>
          <span class="hint">Чертежи и файлы раздела. Кнопка «📁 Папка» в шапке карточки откроет её в Проводнике.</span></div>
        <div class="f wide"><label for="t-note">Примечание</label><textarea id="t-note" name="note" maxlength="2000">${esc(t.note || '')}</textarea></div>
      </div></details>
      ${taskFilesHtml(t)}
    </div>`;
}
function renderMessage(kind) {
  const box = $('#msg-box');
  const t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const c = contractorOf(t);
  const M = window.Messages;
  kind = kind || state.msgKind || M.suggest(t, state.today);
  state.msgKind = kind;
  const signature = loadLocal('signature', '');
  const msg = M.build(kind, { task: t, project: projectOf(t), contractor: c, signature, today: state.today });
  const can = { mail: !!c?.email, whatsapp: !!(c?.phone || /whatsapp/i.test(c?.messenger || '')), telegram: !!(c?.phone || /@|t\.me/.test(c?.messenger || '')) };
  box.innerHTML = `${c ? '' : '<div class="note-box">У карточки нет подрядчика — текст можно скопировать, но отправить некому.</div>'}
    <div class="tpl-row">${M.TEMPLATES.map(x => `<button class="btn sm ${x.id === kind ? 'on' : ''}" type="button" data-act="msg-kind" data-kind="${x.id}">${esc(x.label)}</button>`).join('')}</div>
    <div class="f"><label for="msg-subject">Тема (для почты)</label><input id="msg-subject" value="${esc(msg.subject)}" maxlength="200"></div>
    <div class="f"><label for="msg-text">Текст — можно поправить перед отправкой</label><textarea id="msg-text" rows="11">${esc(msg.text)}</textarea></div>
    <div class="f"><label for="msg-sign">Подпись (запоминается)</label><input id="msg-sign" value="${esc(signature)}" maxlength="200" placeholder="С уважением, Иванов И.И., ГС ЭОМ/СС, +7 …"></div>
    <div class="msg-acts">
      <button class="btn primary" data-act="msg-copy" type="button">Копировать текст</button>
      <button class="btn" data-act="msg-send" data-via="mail" type="button" ${can.mail ? '' : 'disabled title="У подрядчика не указана почта"'}>Открыть в почте</button>
      <button class="btn" data-act="msg-send" data-via="whatsapp" type="button" ${can.whatsapp ? '' : 'disabled title="У подрядчика не указан телефон"'}>WhatsApp</button>
      <button class="btn" data-act="msg-send" data-via="telegram" type="button" ${can.telegram ? '' : 'disabled title="Не указан ник Telegram или телефон"'}>Telegram</button>
    </div>
    <span class="hint">В WhatsApp текст подставится сам. В Telegram откроется чат с подрядчиком, а текст будет скопирован — вставьте его Ctrl+V.</span>`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = $('#msg-text');
    if (ta) { ta.focus(); ta.select(); }
    return false;
  }
}
async function sendMessage(via) {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  const text = $('#msg-text').value, subject = $('#msg-subject').value;
  if (via === 'telegram') await copyText(text);
  const res = await api.openContact({ contractorId: t.contractorId, kind: via, subject, text });
  if (!res.ok) return toast(res.message, true);
  toast(via === 'telegram' ? 'Текст скопирован — вставьте его в чат (Ctrl+V)' : via === 'mail' ? 'Письмо открыто в почтовой программе' : 'Открыт WhatsApp');
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'thank': ({ el }) => { thank(el.dataset.task, el.dataset.cid); },
  'msg-kind': ({ el }) => { renderMessage(el.dataset.kind); },
  'msg-copy': () => { copyText($('#msg-text').value).then(ok => toast(ok ? 'Текст скопирован' : 'Текст выделен — нажмите Ctrl+C')); },
  'msg-send': ({ el }) => { el.disabled = true; sendMessage(el.dataset.via).finally(() => { el.disabled = false; }); },
  'talk-send': () => { sendComment(); },
  'talk-edit': ({ el }) => { talkEditStart(el.dataset.cid); },
  'talk-edit-save': () => { talkEditSave(); },
  'talk-edit-cancel': () => { talkEditCancel(); },
});
/* ---------- 4.1.1 (item 39): files of a card — dropped from Explorer, a screenshot pasted with Ctrl+V ---------- */
const canFiles = () => typeof api.attachBytes === 'function';
function taskFilesHtml(t) {
  if (!canFiles()) return '';
  const files = Array.isArray(t.files) ? t.files : [];
  return `<div class="f wide tf" id="tf-box"><span class="lbl">Файлы${files.length ? ` <span class="hint">${files.length}</span>` : ''}</span>
    <div class="tf-list">${files.map(f => `<span class="aq-file tf-file">${icon('file')}<button class="linkbtn" type="button" data-act="tf-open" data-fid="${esc(f.id)}" title="Открыть">${esc(f.name)}</button> <span class="hint">${fileSize(f.size)}</span><button class="btn ghostbtn sm" type="button" data-act="tf-del" data-fid="${esc(f.id)}" title="Убрать из карточки" aria-label="Убрать">×</button></span>`).join('')}</div>
    <div class="tf-drop">${t.id ? 'Перетащите сюда файлы из Проводника или нажмите <b>Ctrl+V</b>, чтобы вставить скриншот' : 'Сохраните карточку — потом сюда можно будет перетаскивать файлы'}</div></div>`;
}
async function attachToTask(taskId, fileList) {
  const t = state.tasks.get(taskId);
  if (!t || !canFiles()) return;
  const added = [];
  for (const f of [...fileList].slice(0, 20)) {
    if (!f || !f.size) continue;
    const name = f.name && f.name !== 'image.png' ? f.name : `Скриншот ${new Date().toLocaleString('ru-RU').replace(/[:.,]/g, '-').replace(/\s+/g, ' ')}.png`;
    const r = await api.attachBytes(t.projectId, name, new Uint8Array(await f.arrayBuffer()));
    if (r?.ok) added.push(r.file); else toast(r?.message || `Не удалось приложить «${name}».`, true);
  }
  if (!added.length) return;
  const cur = state.tasks.get(taskId);
  await write(op.update('tasks', taskId, { files: [...(Array.isArray(cur.files) ? cur.files : []), ...added] }), `${marksText(t)}: ${added.length === 1 ? `приложен «${added[0].name}»` : `приложено файлов: ${added.length}`}`);
  refreshTaskFiles();
}
// The open card shows its file list without losing what is typed in the form.
function refreshTaskFiles() { const box = $('#tf-box'), t = state.drawer?.kind === 'task' && state.tasks.get(state.drawer.id); if (box && t) box.outerHTML = taskFilesHtml(t); }
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
const fileTarget = e => {
  if (e.target.closest?.('#dform') && state.drawer?.kind === 'task' && state.drawer.id) return state.drawer.id;
  return e.target.closest?.('[data-kb-id]')?.dataset.kbId || e.target.closest?.('.tl-bar[data-bar]')?.dataset.bar || '';
};
document.addEventListener('dragover', e => {
  if (!hasFiles(e) || !canFiles()) return;
  const id = fileTarget(e);
  $$('.file-over').forEach(x => x.classList.remove('file-over'));
  if (!id) return;
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  (e.target.closest('#tf-box, #dform, [data-kb-id], .tl-bar') || e.target).classList.add('file-over');
}, true);
document.addEventListener('dragleave', e => { if (hasFiles(e) && !e.relatedTarget) $$('.file-over').forEach(x => x.classList.remove('file-over')); }, true);
document.addEventListener('drop', e => {
  if (!hasFiles(e) || !canFiles()) return;
  $$('.file-over').forEach(x => x.classList.remove('file-over'));
  const id = fileTarget(e);
  if (!id) return;
  e.preventDefault(); e.stopPropagation();
  attachToTask(id, e.dataTransfer.files);
}, true);
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length || !canFiles() || state.drawer?.kind !== 'task' || !state.drawer.id) return;
  e.preventDefault();
  attachToTask(state.drawer.id, files);
});

function historyLine(h) {
  if (h.type === 'finish') {
    const d = dayNum(h.to) - dayNum(h.from);
    return `<b>Срок перенесён</b> ${fmtDate(h.from)} → ${fmtDate(h.to)} (${d >= 0 ? '+' : ''}${d} дн.) · ${esc(SHIFT_REASONS[h.reason] || SHIFT_REASONS.other)}${h.note ? ` · «${esc(h.note)}»` : ''}`;
  }
  const lbl = s => (s ? STATUSES[s]?.label || s : 'создана');
  return h.from ? `<b>${esc(lbl(h.to))}</b> <span class="hint">(было: ${esc(lbl(h.from))})</span>${h.note ? ` · «${esc(h.note)}»` : ''}` : `<b>Карточка создана</b> · ${esc(lbl(h.to))}`;
}
function taskTimePanel(t, isNew) {
  const summary = isNew ? '' : (() => {
    const sh = L.shiftsOf(t), rs = L.reviewStats(t, state.today);
    const lt = L.lateness(t, state.today);
    const cells = [
      ['Переносов срока', sh.count ? `${sh.count} · ${sh.days >= 0 ? '+' : ''}${sh.days} дн.` : 'не было'],
      ['Первоначальный срок', fmtDate(sh.original)],
      ['Контрольный срок исполнителя', fmtDate(sh.contractorDeadline)],
      ['Кругов замечаний', String(rs.rounds)],
      ['На проверке у вас', days(rs.chiefDays)],
      ['На доработке у исполнителя', days(rs.contractorDays)],
    ];
    return `<div class="sub0"><div class="kv">${cells.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
      ${lt && lt.late ? `<div class="err">${lt.final ? `Сдано на ${days(lt.late)} позже контрольного срока.` : `Просрочка от контрольного срока: ${days(lt.late)}.`}</div>` : ''}</div>`;
  })();
  const hist = isNew ? '' : (() => {
    const list = L.historyOf(t).slice().reverse();
    return `<div class="sub"><h3>История</h3>${list.length ? `<ol class="hist">${list.map(h => `<li><span class="num hint">${fmtDate(h.date)}</span><span>${historyLine(h)}</span></li>`).join('')}</ol>`
      : '<div class="hint">История пишется с момента обновления программы: переносы сроков и смены статусов.</div>'}</div>`;
  })();
  const issues = isNew ? [] : L.dependencyIssues(t, state.tasks, state.today);
  return `${summary}
    <div class="sub"><h3>Зависит от (смежные разделы)</h3>
      ${issues.length ? `<div class="err">${issues.map(i => esc(i.text)).join('<br>')}</div>` : ''}
      <div id="dep-box"></div>
      <span class="hint">Например: СС ждёт задание от ЭОМ. На диаграмме Ганта связь показана стрелкой; если смежник срывает срок, карточка попадёт в «Под угрозой».</span></div>
    <div class="sub"><h3>Контрольные точки</h3><div id="ms-box"></div>
      <button class="btn sm" data-act="ms-add" type="button">+ Контрольная точка</button>
      <span class="hint">Например: выдача заданий смежникам, промежуточная сдача, согласование с заказчиком.</span></div>
    <div class="sub"><h3>Изменения (ревизии)</h3><div id="rev-box"></div>
      <button class="btn sm" data-act="rev-add" type="button">+ Изменение</button>
      <span class="hint">Учёт выпусков: «Изм. 1 — по замечаниям экспертизы». Последнее изменение видно в штампе карточки и на странице для заказчика.</span></div>
    ${hist}`;
}
// Candidates: other cards of the same project that would not create a loop.
function renderDeps() {
  const box = $('#dep-box');
  if (!box || !state.draft) return;
  const selfId = state.drawer.id || '__new';
  const projectId = val('projectId');
  const byId = new Map(state.tasks);
  const chosen = state.draft.dependsOn.filter(id => state.tasks.has(id));
  const label = x => `${marksText(x)} · ${executorOf(x)?.name || 'нет исполнителя'} · до ${fmtDate(x.finish)}`;
  const options = [...state.tasks.values()]
    .filter(x => x.id !== selfId && x.projectId === projectId && !chosen.includes(x.id) && !(state.drawer.id && L.wouldCycle(state.drawer.id, x.id, byId)))
    .sort(sortByDeadline);
  box.innerHTML = `${chosen.length ? `<div class="dep-list">${chosen.map(id => {
      const x = state.tasks.get(id), tm = timing(x);
      return `<div class="dep-row">${marksHtml(x)}<span class="dep-who">${esc(executorOf(x)?.name || 'нет исполнителя')}</span>
        <span class="due ${tm.cls}">${x.status === 'done' ? 'принят' : esc(tm.text)}</span>
        <button class="btn ghostbtn sm" data-act="dep-del" data-id="${esc(id)}" type="button" aria-label="Убрать зависимость">✕</button></div>`;
    }).join('')}</div>` : '<div class="hint">Зависимостей нет.</div>'}
    ${options.length ? `<select id="dep-add" data-transient aria-label="Добавить зависимость"><option value="">+ Добавить: эта карточка ждёт…</option>${options.map(x => `<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('')}</select>`
      : `<div class="hint">${projectId ? 'В проекте нет других карточек, от которых можно зависеть.' : 'Сначала выберите проект.'}</div>`}`;
}

function renderMilestones() {
  const box = $('#ms-box');
  if (!box) return;
  const list = state.draft.milestones;
  box.innerHTML = list.length ? `<div class="ms-list">${list.map((m, i) => {
    const late = !m.done && isDate(m.date) && m.date < state.today;
    return `<div class="ms-row ${m.done ? 'done' : ''} ${late ? 'late' : ''}">
      <input type="checkbox" data-ms="${i}" data-k="done" ${m.done ? 'checked' : ''} aria-label="Выполнена">
      <input data-ms="${i}" data-k="title" value="${esc(m.title || '')}" placeholder="Название" maxlength="120" aria-label="Название контрольной точки">
      <input type="date" data-ms="${i}" data-k="date" value="${esc(m.date || '')}" aria-label="Дата">
      <button class="btn ghostbtn sm" data-act="ms-del" data-i="${i}" type="button" aria-label="Удалить">✕</button>
    </div>`;
  }).join('')}</div>` : '<div class="hint">Контрольных точек нет.</div>';
  if (isSpec()) $$('#ms-box input:not([data-k="done"])').forEach(el => { el.disabled = true; });
}

function renderRevisions() {
  const box = $('#rev-box');
  if (!box || !state.draft) return;
  const list = state.draft.revisions;
  box.innerHTML = list.length ? `<div class="rev-list">${list.map((r, i) => `<div class="rev-row">
      <span class="rev-no">Изм.&nbsp;<input data-rev="${i}" data-k="no" value="${esc(r.no)}" maxlength="6" aria-label="Номер изменения" inputmode="numeric"></span>
      <input type="date" data-rev="${i}" data-k="date" value="${esc(r.date || '')}" aria-label="Дата изменения">
      <input data-rev="${i}" data-k="note" value="${esc(r.note || '')}" placeholder="Что изменено и почему" maxlength="200" aria-label="Содержание изменения">
      <button class="btn ghostbtn sm" data-act="rev-del" data-i="${i}" type="button" aria-label="Удалить">✕</button></div>`).join('')}</div>`
    : '<div class="hint">Изменений не было — выпуск первоначальный.</div>';
}
function addRevision() {
  const list = state.draft.revisions;
  const next = list.reduce((m, r) => Math.max(m, parseInt(r.no, 10) || 0), 0) + 1;
  list.push({ id: newId(), no: String(next), date: todayStr(), note: '' });
  renderRevisions();
  $$('#rev-box [data-k="note"]').at(-1)?.focus();
}
function cleanRevisions() {
  const out = [];
  for (const r of state.draft.revisions || []) {
    const no = String(r.no || '').trim(), note = String(r.note || '').trim();
    if (!no && !note) continue;
    if (!no) return { error: 'Укажите номер изменения.' };
    if (r.date && !isDate(r.date)) return { error: 'Проверьте даты изменений.' };
    out.push({ id: r.id || newId(), no, date: r.date || todayStr(), note });
  }
  return { list: out };
}
async function openTaskFolder(id) {
  const res = await api.openTaskFolder(id);
  if (!res.ok) toast(res.message, true);
}
async function pickTaskFolder() {
  const res = await api.pickFolder(val('folder') || projectOf({ projectId: val('projectId') })?.folder || '');
  if (res?.path) $('#t-folder').value = res.path;
}
function suggestTaskFolder() {
  const p = projectOf({ projectId: val('projectId') });
  if (!p?.folder) return toast('У проекта не указана папка.', true);
  const m = selectedMarks()[0] || '';
  $('#t-folder').value = p.folder.replace(/[\\/]+$/, '') + (p.folder.includes('/') && !p.folder.includes('\\') ? '/' : '\\') + m;
}

function taskMoneyPanel(t, isNew) {
  return `
    <div class="sub0"><h3 class="h3">Договор и документы</h3>
      <div class="fgrid">
        <div class="f"><label for="t-contract">Договор №</label><input id="t-contract" name="contractNo" value="${esc(t.contractNo || '')}" maxlength="60" placeholder="15/24-П"></div>
        <div class="f"><label for="t-contract-date">от</label><input id="t-contract-date" name="contractDate" type="date" value="${esc(t.contractDate || '')}"></div>
        <label class="chk"><input type="checkbox" name="invoiceReceived" ${t.invoiceReceived ? 'checked' : ''}> Счёт получен${t.invoiceDate ? ` <span class="hint">${fmtDate(t.invoiceDate)}</span>` : ''}</label>
        <label class="chk"><input type="checkbox" name="actSigned" ${t.actSigned ? 'checked' : ''}> Акт подписан${t.actDate ? ` <span class="hint">${fmtDate(t.actDate)}</span>` : ''}</label>
      </div>
    </div>
    <div class="sub"><h3>График платежей по договору</h3>
      <div class="tpl-row"><span class="hint">Шаблон:</span>
        <button class="btn sm" data-act="plan-tpl" data-tpl="30-70" type="button">Аванс 30% + 70% после приёмки</button>
        <button class="btn sm" data-act="plan-tpl" data-tpl="50-50" type="button">50% + 50%</button>
        <button class="btn sm" data-act="plan-tpl" data-tpl="100" type="button">100% после приёмки</button>
      </div>
      <div id="plan-box"></div>
      <button class="btn sm" data-act="plan-add" type="button">+ Платёж в график</button>
      <div id="plan-preview"></div>
    </div>
    ${isNew ? '<p class="hint">Фактические платежи можно будет вносить после сохранения карточки.</p>' : '<div class="sub" id="payments"></div>'}`;
}
const planValue = r => (r.pct !== null && r.pct !== undefined && r.pct !== '' ? `${String(r.pct).replace('.', ',')}%` : r.amount ? String(r.amount).replace('.', ',') : '');
function renderPlanRows() {
  const box = $('#plan-box');
  if (!box) return;
  const list = state.draft.plan;
  box.innerHTML = list.length ? `<div class="plan-list">${list.map((r, i) => `<div class="plan-row">
      <input data-pl="${i}" data-k="title" value="${esc(r.title || '')}" placeholder="Аванс" maxlength="80" aria-label="Назначение платежа">
      <input data-pl="${i}" data-k="value" value="${esc(planValue(r))}" placeholder="30% или 50 000" inputmode="decimal" aria-label="Сумма или процент">
      <select data-pl="${i}" data-k="trigger" aria-label="Когда платить">${Object.entries(PAY_TRIGGERS).map(([k, l]) => `<option value="${k}"${(r.trigger || 'accepted') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <input type="date" data-pl="${i}" data-k="date" value="${esc(r.date || '')}" ${r.trigger === 'date' ? '' : 'hidden'} aria-label="Дата платежа">
      <button class="btn ghostbtn sm" data-act="plan-del" data-i="${i}" type="button" aria-label="Удалить">✕</button>
    </div>`).join('')}</div>` : '<div class="hint">Графика нет — весь остаток считается к оплате после приёмки.</div>';
}
// Live preview from the form: budget, status and start may be edited but not saved yet.
function renderPlanPreview() {
  const box = $('#plan-preview');
  if (!box || !state.draft) return;
  const saved = state.drawer.id ? state.tasks.get(state.drawer.id) : {};
  const budget = parseMoney(val('budget'));
  const t = { ...saved, budget: Number.isNaN(budget) ? 0 : budget, status: val('status') || saved?.status, start: val('start'), plan: state.draft.plan, payments: saved?.payments || [] };
  const pp = L.paymentPlan(t, state.today);
  const stateChip = r => ({ paid: '<span class="chip tone-ok">оплачено</span>', due: '<span class="chip tone-warn">пора платить</span>', upcoming: '<span class="chip tone-idle">позже</span>' }[r.state]);
  box.innerHTML = `<div class="plan-prev">
    ${pp.rows.map(r => `<div class="pp-row ${r.virtual ? 'virtual' : ''}"><span>${esc(r.title || 'Платёж')}<span class="hint"> · ${esc(PAY_TRIGGERS[r.trigger] || '')}${r.dueDate ? ` ${fmtDate(r.dueDate)}` : ''}</span></span>
      <span class="num">${r.paid > 0 && r.paid < r.amount ? `<span class="hint">оплачено ${money(r.paid)} из </span>` : ''}${money(r.amount)}</span>${stateChip(r)}</div>`).join('')}
    <div class="pp-sum"><span>Пора платить: <b class="num">${money(pp.dueNow)}</b></span><span>Позже по договору: <b class="num">${money(pp.later)}</b></span></div>
    ${pp.hasPlan && pp.mismatch > 0 ? `<div class="err">График больше бюджета на ${money(pp.mismatch)}.</div>` : ''}
    ${pp.hasPlan && pp.mismatch < 0 ? `<div class="hint">В графике не распределено ${money(-pp.mismatch)} — они считаются к оплате после приёмки.</div>` : ''}
  </div>`;
}

function renderPayments() {
  const box = $('#payments');
  const t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const pays = [...(t.payments || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rest = restOf(t);
  const keep = { d: $('#p-date')?.value, a: $('#p-amount')?.value, n: $('#p-note')?.value };
  box.innerHTML = `<h3>Фактические платежи</h3>
    <div class="money3">
      <div><span class="k">Бюджет</span><span class="v">${money(budgetOf(t))}</span></div>
      <div><span class="k">Оплачено</span><span class="v">${money(paidOf(t))}</span></div>
      <div><span class="k">Остаток</span><span class="v ${rest < 0 ? 'neg' : ''}">${money(rest)}</span></div>
    </div>
    ${rest < 0 ? `<div class="err">Оплачено больше бюджета на ${money(-rest)}.</div>` : ''}
    ${pays.length ? `<div class="plist">${pays.map(p => `<div class="prow"><span class="num">${fmtDate(p.date)}</span><span class="n">${esc(p.note || 'платёж')}</span><span class="num">${money(p.amount)}</span>
      <button class="btn ghostbtn sm" data-act="del-payment" data-pid="${esc(p.id)}" type="button" aria-label="Удалить платёж">✕</button></div>`).join('')}</div>` : '<div class="hint">Платежей ещё не было.</div>'}
    <div class="padd" data-transient>
      <div class="f"><label for="p-date">Дата</label><input id="p-date" type="date" value="${esc(keep.d || todayStr())}"></div>
      <div class="f"><label for="p-amount">Сумма, ₽</label><input id="p-amount" inputmode="decimal" placeholder="50 000" value="${esc(keep.a || '')}"></div>
      <div class="f"><label for="p-note">Комментарий</label><input id="p-note" placeholder="Аванс 30%" maxlength="120" value="${esc(keep.n || '')}"></div>
      <button class="btn" data-act="add-payment" type="button">Внести</button>
    </div>
    <span class="hint">Платёж сохраняется сразу.</span>`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-task-folder': ({ e, id }) => { e.stopPropagation(); openTaskFolder(id); },
  'pick-task-folder': () => { pickTaskFolder(); },
  'suggest-task-folder': () => { suggestTaskFolder(); },
  'rev-add': () => { addRevision(); },
  'rev-del': ({ el }) => { state.draft.revisions.splice(Number(el.dataset.i), 1); renderRevisions(); },
  'dep-del': ({ id }) => { state.draft.dependsOn = state.draft.dependsOn.filter(x => x !== id); renderDeps(); },
  'tf-open': ({ el }) => { const t = state.tasks.get(state.drawer?.id); if (t) api.attachOpen(t.projectId, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); }); },
  'tf-del': ({ el }) => { const t = state.tasks.get(state.drawer?.id); if (t) write(op.update('tasks', t.id, { files: (t.files || []).filter(f => f.id !== el.dataset.fid) }), 'Файл убран из карточки').then(refreshTaskFiles); },
  'ms-add': ({ id }) => { state.draft.milestones.push({ id: newId(), title: '', date: '', done: false }); renderMilestones(); $$('#ms-box [data-k="title"]').at(-1)?.focus(); },
  'ms-del': ({ el }) => { state.draft.milestones.splice(Number(el.dataset.i), 1); renderMilestones(); },
  'plan-add': ({ id }) => { state.draft.plan.push({ id: newId(), title: '', amount: 0, trigger: 'accepted' }); renderPlanRows(); renderPlanPreview(); },
  'plan-del': ({ el }) => { state.draft.plan.splice(Number(el.dataset.i), 1); renderPlanRows(); renderPlanPreview(); },
  'plan-tpl': ({ el }) => { applyPlanTemplate(el.dataset.tpl); },
});
/* ---------- roles: header markup, user switch, team ---------- */
// data-role-hide="spec" — hidden from specialists; "gip" — shown to the GIP only.
function roleAllows(spec) {
  if (spec === 'gip') return A.isGip(state.me);
  if (spec === 'spec') return !isSpec();
  return true;
}
const liveUsers = () => [...(state.users?.values() || [])];
const usersByRole = r => liveUsers().filter(u => u.role === r).sort(byName);
const userTag = u => `${A.ROLES[u.role]?.label || ''}${A.directionLabels(u).length ? ' · ' + A.directionLabels(u).join(', ') : ''}`;

function setUserMenu(open) {
  const menu = $('#user-menu');
  if (open) {
    const item = u => `<button role="menuitem" type="button" data-act="switch-user" data-id="${esc(u.id)}"${u.id === state.me?.id ? ' aria-current="true"' : ''}>
      <b>${esc(u.name)}</b><small>${esc(userTag(u))}</small></button>`;
    if (state.remote) {
      menu.innerHTML = `<div class="menu-h">${esc(state.me?.name || '')}</div><p class="role-hint">${esc(userTag(state.me || {}))} · общая база ${esc(state.remote.url || '')}, вход «${esc(state.remote.login || '')}»</p>
        <button role="menuitem" type="button" data-act="server"><b>Сервер Пульта…</b><small>Связь, пароль${A.isGip(state.me) ? ', кто может входить' : ''}</small></button>`;
      menu.hidden = !open; $('#btn-user').setAttribute('aria-expanded', String(open)); return;
    }
    menu.innerHTML = [['gip', 'ГИП'], ['chief', 'Главспецы'], ['specialist', 'Специалисты']]
      .map(([r, l]) => usersByRole(r).length ? `<div class="menu-h">${l}</div>${usersByRole(r).map(item).join('')}` : '').join('')
      + '<p class="role-hint">Локальная версия: вход без пароля, роли разделяют интерфейс, но не защищают файл данных.</p>'
      + (api.serverInfo ? '<button role="menuitem" type="button" data-act="server"><b>Сервер Пульта…</b><small>Общая база команды: подключиться или перенести</small></button>' : '');
  }
  menu.hidden = !open;
  $('#btn-user').setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('[aria-current]')?.focus();
}
// «Свой вид» (3.6): each person on this computer keeps their own tab, columns, sorting, folded blocks, Gantt and
// office settings. Switching the user stores the current set under the old user and brings back the new one's.
const VIEW_KEYS = ['tab', 'cols', 'sort', 'folded', 'gantt', 'kbLanes', 'office', 'overview', 'peopleMode', 'presets', 'dense', 'teamCollapsed', 'progWeight', 'quietDays', 'tabOrder', 'nav', 'scroll'];
function swapView(fromId, toId) {
  try {
    if (fromId) localStorage.setItem('glavspec.view:' + fromId, JSON.stringify(Object.fromEntries(VIEW_KEYS.map(k => [k, localStorage.getItem('glavspec.' + k)]))));
    const saved = JSON.parse(localStorage.getItem('glavspec.view:' + toId) || 'null');
    if (!saved) return false; // first visit: keep the current view as a start
    for (const k of VIEW_KEYS) { if (saved[k] == null) localStorage.removeItem('glavspec.' + k); else localStorage.setItem('glavspec.' + k, saved[k]); }
    return true;
  } catch { return false; }
}
async function switchUser(id) {
  setUserMenu(false);
  if (id === state.me?.id) return;
  if (state.drawer) closeDrawer();
  const from = state.me?.id;
  const res = await api.switchUser(id);
  if (!res?.ok) return toast(res?.message || 'Не удалось сменить пользователя.', true);
  const u = state.users.get(id);
  const msg = `Вы вошли как ${u ? u.name : 'другой пользователь'} — ${A.titleFor(u)}`;
  if (swapView(from, id)) { try { sessionStorage.setItem('glavspec.toast', msg + ' · свой вид восстановлен'); } catch { /* optional */ } api.reloadWindow(); return; }
  toast(msg);
}

function ownerStats(uid) {
  const list = tasksArr().filter(t => hasOwner(t, uid));
  const active = list.filter(t => L.ACTIVE.has(t.status));
  return { total: list.length, active: active.length, overdue: active.filter(t => timing(t).overdue).length, review: list.filter(t => t.status === 'review').length };
}
// Tree: GIP → chiefs → their specialists. Specialists without a chief hang under «Без главспеца».
const teamCollapsed = new Set(loadLocal('teamCollapsed', []));
function toggleTeamNode(id) {
  if (teamCollapsed.has(id)) teamCollapsed.delete(id); else teamCollapsed.add(id);
  saveLocal('teamCollapsed', [...teamCollapsed]);
  renderNow();
}
function viewTeam() {
  const gip = A.isGip(state.me);
  const visible = gip ? liveUsers() : liveUsers().filter(u => u.id === state.me.id || (u.role === 'specialist' && u.chiefId === state.me.id));
  const subsOf = id => visible.filter(u => u.role === 'specialist' && u.chiefId === id).sort(byName);
  const budgetCell = u => u.role === 'chief' ? (gip
    ? `<label class="chk"><input type="checkbox" data-act="toggle-budget" data-id="${esc(u.id)}"${u.canSeeBudget ? ' checked' : ''}> видит бюджет</label>`
    : (u.canSeeBudget ? 'видит бюджет' : 'бюджет скрыт')) : u.role === 'gip' ? 'полный доступ' : 'без бюджета';
  // depth: 0 GIP, 1 chief, 2 specialist; `kids` — ids under this node, for branch totals and collapsing.
  const row = (u, depth, kids = [], last = false, trunk = false) => {
    const own = ownerStats(u.id);
    const branch = kids.reduce((a, id) => { const x = ownerStats(id); return { active: a.active + x.active, overdue: a.overdue + x.overdue, review: a.review + x.review }; }, own);
    const s = kids.length && u.role === 'chief' ? branch : own;
    const open = !teamCollapsed.has(u.id);
    const toggle = kids.length ? `<button class="tree-tg" type="button" data-act="team-toggle" data-id="${esc(u.id)}" aria-expanded="${open}" title="${open ? 'Свернуть' : 'Развернуть'}">${open ? '▾' : '▸'}</button>` : '<span class="tree-tg ph"></span>';
    const addSub = gip && u.role === 'chief' ? `<button class="btn ghostbtn sm" data-act="new-user" data-role="specialist" data-chief="${esc(u.id)}" type="button" title="Добавить специалиста в группу">+ специалист</button>` : '';
    return `<tr class="tree d${depth}${last ? ' last' : ''}${trunk ? ' trunk' : ''}" style="--d:${depth}">
      <td><div class="tree-cell" style="--d:${depth}">${toggle}<span class="tree-dot r-${u.role}"></span><span class="kicons">${userIcons(u)}</span>
        <span><b>${esc(userLabel(u))}</b>${kids.length && u.role === 'chief' ? `<div class="hint">в группе ${kids.length + 1} · цифры по группе</div>` : ''}</span></div></td>
      <td>${esc(userTag(u))}</td>
      <td class="r num">${s.active}</td><td class="r num${s.overdue ? ' neg' : ''}">${s.overdue}</td><td class="r num">${s.review}</td>
      <td>${budgetCell(u)}</td>
      <td class="nowrap">${addSub}${gip ? `<button class="btn ghostbtn sm" data-act="open-user" data-id="${esc(u.id)}" type="button">Изменить</button>` : ''}</td></tr>`;
  };
  // `lastChief`: no sibling below, so the GIP's line stops at this chief.
  const chiefBranch = (c, depth, lastChief = true) => {
    const subs = subsOf(c.id);
    return row(c, depth, subs.map(x => x.id), lastChief) + (teamCollapsed.has(c.id) ? '' : subs.map((x, i) => row(x, depth + 1, [], i === subs.length - 1, !lastChief)).join(''));
  };
  let body;
  if (gip) {
    const chiefs = visible.filter(u => u.role === 'chief').sort(byName);
    const orphans = visible.filter(u => u.role === 'specialist' && !chiefs.some(c => c.id === u.chiefId)).sort(byName);
    const gips = visible.filter(u => u.role === 'gip').sort(byName);
    const top = gips[0];
    const under = chiefs.map((c, i) => chiefBranch(c, 1, i === chiefs.length - 1 && !orphans.length)).join('')
      + (orphans.length ? `<tr class="tree d1 last orphan-h" style="--d:1"><td colspan="7"><div class="tree-cell" style="--d:1"><span class="tree-tg ph"></span><span class="hint">Без главспеца — ${orphans.length}: назначьте руководителя в карточке сотрудника</span></div></td></tr>`
        + orphans.map((x, i) => row(x, 2, [], i === orphans.length - 1)).join('') : '');
    body = (top ? row(top, 0, chiefs.map(c => c.id).concat(orphans.map(o => o.id))) : '')
      + (top && teamCollapsed.has(top.id) ? '' : under)
      + gips.slice(1).map(g => row(g, 0)).join('');
  } else {
    body = chiefBranch(state.me, 0);
  }
  return `<section class="panel team">
    <div class="panel-h"><h3>Структура команды</h3><span class="spacer"></span>${gip ? '<button class="btn primary sm" data-act="new-user" type="button">+ Сотрудник</button>' : ''}</div>
    ${tip('team', gip ? 'Структура: ГИП → главспецы → их специалисты. Цифры у главспеца — по всей его группе. Подрядчики (внештатные) — ниже на этой же вкладке.'
      : 'Вы и ваши специалисты. Состав команды и доступ к бюджету меняет ГИП.', 'team-hint')}
    <div class="tablewrap"><table class="tree-tbl"><thead><tr><th>Сотрудник</th><th>Роль и направления</th><th class="r">В работе</th><th class="r">Сорвано</th><th class="r">На проверке</th><th>Бюджет</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></div>
    ${visible.some(u => u.role === 'specialist') ? '' : `<div class="empty-hint">${gip
      ? '<b>Специалистов пока нет.</b> Нажмите «+ Сотрудник» или «+ специалист» в строке главспеца — каждому сразу создаётся свой пульт. Затем карточки можно спускать им, а здесь будет видна загрузка группы.'
      : '<b>В вашей группе пока нет специалистов.</b> Их добавляет ГИП; после этого вы сможете спускать им карточки и видеть их работу здесь.'}</div>`}</section>`;
}
async function toggleBudget(id, on) {
  const u = state.users.get(id);
  if (!u) return;
  await write(op.update('users', id, { canSeeBudget: on }), on ? `${u.name} теперь видит бюджет` : `${u.name} больше не видит бюджет`);
}

function openUser(id, role = 'specialist', chiefId = '') {
  const chief = chiefId && state.users.get(chiefId);
  const u = id ? state.users.get(id) : { role: A.ROLES[role] ? role : 'specialist', chiefId: chief ? chiefId : '', directions: chief ? [...(chief.directions || [])] : [] };
  if (!u) return toast('Сотрудник не найден.', true);
  state.drawer = { kind: 'user', id };
  const chiefs = usersByRole('chief');
  const owned = id ? [...state.tasks.values()].filter(t => hasOwner(t, id)).length : 0;
  drawerShell({
    title: id ? 'Штатный сотрудник' : 'Новый сотрудник',
    body: `${id ? '' : kindSwitch('staff')}<div class="fgrid">
      <div class="f wide"><label class="req" for="u-name">Имя</label><input id="u-name" name="name" value="${esc(u.name || '')}" maxlength="120" placeholder="Иванов И. И."></div>
      <div class="f"><label for="u-role">Роль</label><select id="u-role" name="role"${id === state.me.id ? ' disabled' : ''}>
        ${Object.entries(A.ROLES).map(([r, x]) => `<option value="${r}"${u.role === r ? ' selected' : ''}>${x.label}</option>`).join('')}</select></div>
      <div class="f" data-for-role="specialist"><label for="u-chief">Главспец</label><select id="u-chief" name="chiefId">
        <option value="">— не назначен —</option>${chiefs.map(c => `<option value="${esc(c.id)}"${u.chiefId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="f wide" data-for-role="chief specialist"><span class="lbl">Направления</span><div class="chk-row">
        ${A.DIRECTIONS.map(d => `<label class="chk"><input type="checkbox" name="dir" value="${d.id}"${(u.directions || []).includes(d.id) ? ' checked' : ''}> ${esc(d.label)}</label>`).join('')}</div></div>
      <div class="f wide" data-for-role="chief"><label class="chk"><input type="checkbox" name="canSeeContacts"${u.canSeeContacts ? ' checked' : ''}> Видит заказчиков и их контакты (кабинет заказчика)</label></div>
      <div class="f wide" data-for-role="chief"><label class="chk"><input type="checkbox" name="canSeeBudget"${u.canSeeBudget ? ' checked' : ''}> Видит бюджет и оплаты своих карточек</label></div>
      <div class="f"><label for="u-phone">Телефон</label><input id="u-phone" name="phone" type="tel" value="${esc(u.phone || '')}" maxlength="40"></div>
      <div class="f"><label for="u-email">Почта</label><input id="u-email" name="email" type="email" value="${esc(u.email || '')}" maxlength="120"></div>
      <div class="f"><label for="u-msg">Мессенджер</label><input id="u-msg" name="messenger" value="${esc(u.messenger || '')}" maxlength="120"></div>
      <div class="f"><label for="u-bday">День рождения</label><input id="u-bday" name="birthday" type="date" value="${esc(u.birthday || '')}"><span class="hint">В «Офисе» в этот день — колпак. Год не показывается.</span></div>
    </div>
    <p class="hint">${id ? 'Пульт сотрудника' : 'Пульт для сотрудника создаётся автоматически'}: войти в него — щелчок по имени в заголовке программы.</p>
    <div class="err" id="form-err" hidden></div>
    ${id ? `<p class="hint">Карточек на сотруднике: ${owned}.</p>` : ''}`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id && id !== state.me.id ? '<button class="btn danger" data-act="ask-delete" type="button">Удалить</button>' : ''}`,
  });
  syncUserForm();
  markClean();
  if (!id) $('#u-name').focus();
}
function syncUserForm() {
  const role = $('#u-role')?.value;
  $$('[data-for-role]').forEach(el => { el.hidden = !el.dataset.forRole.split(' ').includes(role); });
}
async function submitUser() {
  const { id } = state.drawer;
  const role = id === state.me.id ? state.me.role : val('role');
  const data = { name: val('name'), role, directions: $$('input[name="dir"]:checked').map(i => i.value), phone: val('phone'), email: val('email'), messenger: val('messenger'), birthday: isDate(val('birthday')) ? val('birthday') : '' };
  if (!data.name) return formError('Укажите имя сотрудника.', '', 'name');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
  if (!A.ROLES[role]) return formError('Выберите роль.', '', 'role');
  data.chiefId = role === 'specialist' ? val('chiefId') : '';
  data.canSeeBudget = role === 'chief' && checked('canSeeBudget');
  data.canSeeContacts = role === 'chief' && checked('canSeeContacts');
  if (role === 'gip') data.directions = [];
  if (id && role !== 'chief' && state.users.get(id)?.role === 'chief' && usersByRole('specialist').some(s => s.chiefId === id))
    return formError('У этого главспеца есть специалисты — сначала переведите их к другому главспецу.');
  const left = id ? [...state.tasks.values()].filter(t => hasOwner(t, id) && t.status !== 'done' && A.profileGaps({ ...state.users.get(id), ...data }, t).length).length : 0;
  const ok = id ? await write(op.update('users', id, data), left ? `Сохранено. Внимание: карточек не по профилю — ${left}, они в сводке` : 'Сотрудник сохранён')
    : await write(op.set('users', newId(), { ...data, createdAt: new Date().toISOString() }), `${data.name}: штатный сотрудник добавлен, пульт создан`);
  if (ok) closeDrawer();
  return ok;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'user-menu': () => { setUserMenu($('#user-menu').hidden); },
  'switch-user': ({ id }) => { switchUser(id); },
  'server': () => { setUserMenu(false); setFileMenu(false); serverDialog(); },
  'open-user': ({ id }) => { openUser(id); },
  'new-user': ({ el }) => { setCreateMenu(false); openUser(null, el.dataset.role, el.dataset.chief); },
  'team-toggle': ({ id }) => { toggleTeamNode(id); },
});
/* ---------- weekly summary for management ---------- */
function weeklyText(list = tasksArr()) {
  const today = state.today, from = addDays(today, -6), next = addDays(today, 7);
  const line = t => `• ${projectOf(t)?.name || '—'} — ${marksText(t)}${t.title ? ' (' + t.title + ')' : ''}${ownerOf(t) ? ', ' + ownerOf(t).name : ''}${contractorOf(t) ? ', ' + contractorOf(t).name : ''}`;
  const inWeek = d => d && d >= from && d <= today;
  const accepted = list.filter(t => t.status === 'done' && inWeek(L.reviewStats(t, today).accepted));
  const submitted = list.filter(t => (t.history || []).some(h => h.type === 'status' && h.to === 'review' && inWeek(h.date)) && !accepted.includes(t));
  const shifted = list.flatMap(t => (t.history || []).filter(h => h.type === 'finish' && inWeek(h.date)).map(h => ({ t, h })));
  const overdue = list.filter(t => timing(t).overdue);
  const coming = list.filter(t => L.ACTIVE.has(t.status) && !timing(t).overdue && isDate(t.finish) && t.finish >= today && t.finish <= next).sort(sortByDeadline);
  const review = list.filter(t => t.status === 'review');
  const sec = (title, items, fmt = line) => items.length ? `\n${title} (${items.length}):\n${items.map(fmt).join('\n')}\n` : '';
  const head = `Сводка за неделю ${fmtDate(from)}–${fmtDate(today)}${state.me ? ' · ' + state.me.name : ''}\n`
    + `В работе ${list.filter(t => L.ACTIVE.has(t.status)).length}, сорвано ${overdue.length}, на проверке ${review.length}.\n`;
  return head
    + sec('Принято', accepted)
    + sec('Сдано на проверку', submitted)
    + sec('Перенесены сроки', shifted, ({ t, h }) => `${line(t)}: ${fmtDate(h.from)} → ${fmtDate(h.to)}${h.reason ? ' — ' + (SHIFT_REASONS[h.reason] || h.reason).toLowerCase() : ''}${h.note ? ' (' + h.note + ')' : ''}`)
    + sec('Срок сорван', overdue, t => `${line(t)} — ${timing(t).text}`)
    + sec('Сдача на следующей неделе', coming, t => `${line(t)} — до ${fmtDate(t.finish)}`)
    + sec('Ждут проверки', review);
}
function openWeekly() {
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <h2 id="mtitle">Сводка за неделю</h2>
    <p class="hint">Текст можно поправить перед отправкой. Деньги в сводку не попадают.</p>
    <textarea id="wk-text" class="wk-text" rows="16">${esc(weeklyText())}</textarea>
    <div class="modal-f"><button class="btn primary" type="button" data-m="copy">Копировать</button><button class="btn" type="button" data-m="cancel">Закрыть</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'copy') copyText($('#wk-text').value).then(ok => toast(ok ? 'Сводка скопирована — вставьте в мессенджер или почту' : 'Текст выделен — нажмите Ctrl+C'));
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $('#wk-text').focus();
}

/* ---------- absences of staff (vacation, sick leave) ---------- */
function openAbsences(uid) {
  const u = state.users.get(uid);
  if (!u || !A.canEditAbsences(state.me, u)) return toast('Отсутствия этого сотрудника ведут ГИП или его главспец.', true);
  let rows = clone(A.absencesOf(u).length ? u.absences : []);
  const root = document.createElement('div');
  root.className = 'modal-back';
  const draw = () => {
    root.querySelector('#abs-rows').innerHTML = rows.length ? rows.map((a, i) => `<div class="abs-row" data-i="${i}">
      <select data-k="kind">${Object.entries(A.ABSENCE_KINDS).map(([k, l]) => `<option value="${k}"${a.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input type="date" data-k="from" value="${esc(a.from || '')}" aria-label="С"><span>—</span><input type="date" data-k="to" value="${esc(a.to || '')}" aria-label="По">
      <input data-k="note" value="${esc(a.note || '')}" placeholder="Комментарий" maxlength="100">
      <button class="btn ghostbtn sm" type="button" data-m="del" data-i="${i}" title="Удалить">✕</button></div>`).join('') : '<div class="hint">Отсутствий не отмечено.</div>';
  };
  root.innerHTML = `<form class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
    <h2 id="mtitle">Отсутствия: ${esc(u.name)}</h2>
    <p class="hint">Отпуска и больничные. Программа предупредит, если срок карточки сотрудника попадает на эти дни, и покажет их на диаграмме Ганта.</p>
    <div id="abs-rows"></div>
    <button class="btn sm" type="button" data-m="add">+ Добавить период</button>
    <div class="err" id="m-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div>
  </form>`;
  document.body.append(root);
  draw();
  const close = () => root.remove();
  root.addEventListener('input', e => { const r = e.target.closest('.abs-row'); if (r) rows[Number(r.dataset.i)][e.target.dataset.k] = e.target.value; });
  root.addEventListener('click', e => {
    const m = e.target.dataset.m;
    if (e.target === root || m === 'cancel') close();
    if (m === 'add') { rows.push({ id: newId(), kind: 'vacation', from: todayStr(), to: addDays(todayStr(), 13), note: '' }); draw(); }
    if (m === 'del') { rows.splice(Number(e.target.dataset.i), 1); draw(); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const bad = rows.find(a => !isDate(a.from) || !isDate(a.to) || a.to < a.from);
    if (bad) { const i = rows.indexOf(bad); return modalErr(root, '#m-err', 'Проверьте даты: «по» не раньше «с».', `.abs-row[data-i="${i}"] [data-k="${isDate(bad.from) ? 'to' : 'from'}"]`); }
    const list = rows.map(a => ({ id: a.id || newId(), kind: a.kind, from: a.from, to: a.to, note: (a.note || '').trim() })).sort((a, b) => a.from.localeCompare(b.from));
    if (await write(op.update('users', uid, { absences: list }), `Отсутствия сохранены: ${u.name}`)) close();
  });
}
const upcomingAbsences = u => A.absencesOf(u).filter(a => a.to >= state.today);

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'absences': ({ id }) => { openAbsences(id); },
});
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
function projectDraft(p) {
  const phases = (Array.isArray(p.phases) && p.phases.length ? p.phases : L.defaultPhases().filter(ph => A.isGip(state.me) || ph.key !== 'contract'))
    .map(ph => ({ key: ph.key, start: ph.start || '', finish: ph.finish || '', done: ph.done || '' }));
  return {
    phases, milestones: clone(p.milestones || []), requests: clone(p.requests || []), docs: clone(p.docs || []),
    protocol: clone(p.protocol || { no: '', date: '', items: [] }), advice: clone(p.advice || { title: '', text: '' }),
    show: { plan: true, sections: true, advice: true, revisions: false, finance: true, ird: true, meetings: true, team: true, soon: true, ...(p.show || {}) }, contactId: p.contactId || (A.isGip(state.me) ? state.me.id : (liveUsers().find(u => u.role === 'gip')?.id || '')),
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
    advice: { title: (d.advice.title || '').trim(), text: (d.advice.text || '').trim() }, show: d.show, contactId: d.contactId, composition: d.composition,
    ird: keep(d.ird, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), kind: IRD_KINDS.some(k => k[0] === x.kind) ? x.kind : irdKindOf(x.title), who: String(x.who || '').trim(), status: IRD_STATUS.some(s => s[0] === x.status) ? x.status : 'plan', due: x.due || '', note: String(x.note || '').trim() })),
    meetings: d.meetings.filter(x => String(x.title || '').trim() || isDate(x.date)).map(x => ({ id: x.id || newId(), date: x.date || '', from: tm(x.from), to: tm(x.to), title: String(x.title || '').trim(), place: String(x.place || '').trim(), protocolNo: String(x.protocolNo || '').trim() })),
    // The customer's contract and payments: kept only from the GIP (others do not see them, so they never overwrite).
    ...(A.isGip(state.me) ? {
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
const CUST_SECS = [['cab', 'Кабинет'], ['plan', 'Этапы и вехи'], ['req', 'Нужно от заказчика'], ['ird', 'Исходные данные'], ['meet', 'Договорённости и встречи'], ['docs', 'Сроки документов'], ['money', 'Договор и финансы'], ['show', 'Что показывать']];
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
  const secs = CUST_SECS.filter(([k]) => k !== 'money' || A.isGip(state.me));
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
    <div class="sub" data-cs="plan"><h3>Этапы проекта</h3>${A.isGip(state.me) ? '' : '<p class="hint">Этап «Договор» ведёт ГИП.</p>'}
      ${phaseTableHtml(d.phases, (i, f) => `data-pd="phases.${i}.${f}"`)}${phaseGanttHtml(d.phases, d.milestones)}</div>
    <div class="sub" data-cs="plan"><h3>Вехи</h3>${list('milestones', (x, i) => `<td class="grow">${pdIn(`milestones.${i}.title`, x.title, 'placeholder="Заключение экспертизы" maxlength="120"')}</td><td>${pdDate(`milestones.${i}.date`, x.date)}</td><td>${pdChk(`milestones.${i}.done`, x.done, ' пройдена')}</td>`, ['Веха', 'Дата', ''], 'Ключевые даты для заказчика: договор, ПД на экспертизу, заключение, выдача РД.')}</div>
    <div class="sub" data-cs="req"><h3>Нужно от заказчика</h3>${list('requests', (x, i) => `<td class="grow">${pdIn(`requests.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}
        <div class="req-files">${(x.files || []).map((f, k) => `<span class="aq-file"><button class="linkbtn" type="button" data-act="att-open" data-fid="${esc(f.id)}" title="Открыть">${icon('file')}${esc(f.name)}</button><button class="linkbtn" type="button" data-act="req-unattach" data-i="${i}" data-k="${k}" aria-label="Убрать файл">✕</button></span>`).join('')}<button class="linkbtn" type="button" data-act="req-attach" data-i="${i}">+ файл для согласования</button></div></td><td>${pdDate(`requests.${i}.due`, x.due)}</td><td class="grow">${pdIn(`requests.${i}.why`, x.why, 'placeholder="Зачем: без них экспертиза не примет ИОС1" maxlength="200"')}</td><td>${pdChk(`requests.${i}.done`, x.done, ' получено')}</td>`, ['Что', 'Срок', 'Зачем', ''], 'Исходные данные, решения и ответы, которые ждём от заказчика. «Получено» убирает строку со страницы.')}</div>
    <div class="sub" data-cs="ird"><h3>Исходные данные</h3><p class="hint">Что нужно для проектирования и в каком оно состоянии — вкладка «Исходные данные» у заказчика. «Запросить» ставит строку в «Нужно от вас»: заказчик отвечает прямо со страницы, ответ приходит сюда — его можно принять или вернуть с замечанием.</p>${list('ird', (x, i) => { const rq = irdRequest(x);
        return `<td>${pdSel(`ird.${i}.kind`, IRD_KINDS, x.kind || irdKindOf(x.title))}</td><td class="grow">${pdIn(`ird.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}</td><td>${pdIn(`ird.${i}.who`, x.who, 'placeholder="Заказчик" maxlength="60" list="ird-who"')}</td>
        <td>${pdSel(`ird.${i}.status`, IRD_STATUS, x.status)}</td><td>${pdDate(`ird.${i}.due`, x.due)}</td><td class="grow">${pdIn(`ird.${i}.note`, x.note, 'placeholder="Примечание для заказчика" maxlength="200"')}</td>
        <td class="nowrap">${rq ? `<span class="chip tone-work" title="${esc(rq.title)}">запрошено${rq.due ? ' до ' + fmtDate(rq.due).slice(0, 5) : ''}</span>` : ['accepted', 'done'].includes(x.status) ? '' : `<button class="btn sm" type="button" data-act="ird-request" data-i="${i}">Запросить</button>`}</td>`; }, ['Тип', 'Что нужно', 'Кто готовит', 'Статус', 'Срок', 'Примечание', ''], 'Задание на проектирование, ГПЗУ, ТУ, письма, согласования…')}
      <div class="row-in">${irdAskable().length ? `<button class="btn sm" type="button" data-act="ird-request-all">Запросить у заказчика всё недостающее (${irdAskable().length})</button>` : ''}${(d.requests || []).some(r => !r.done && r.title) ? '<button class="btn ghostbtn sm" type="button" data-act="ird-letter">Текст письма-запроса</button>' : ''}</div>
      <datalist id="ird-who"><option value="Заказчик"><option value="«Тандем»"><option value="Изыскатели"><option value="«Тандем» по доверенности"><option value="Заказчик и «Тандем»"></datalist>
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
    <div class="sub" data-cs="docs"><h3>Сроки документов</h3>${list('docs', (x, i) => { const kind = x.kind || L.docKindOf(x.title), rule = L.docRule(kind), auto = L.docUntil(kind, x.issued), left = isDate(x.until) ? dayNum(x.until) - dayNum(state.today) : null;
        return `<td>${pdSel(`docs.${i}.kind`, L.DOC_KINDS.map(([k, l]) => [k, l]), kind)}</td><td class="grow">${pdIn(`docs.${i}.title`, x.title, 'placeholder="ТУ на водоснабжение и водоотведение" maxlength="160"')}</td>
          <td>${pdIn(`docs.${i}.no`, x.no, 'class="sm-in" placeholder="№" maxlength="40"')}</td><td>${pdDate(`docs.${i}.issued`, x.issued)}</td>
          <td>${pdDate(`docs.${i}.until`, x.until)}<div class="hint doc-rule">${rule ? (x.until && x.until !== auto && auto ? `вручную · по правилу: ${fmtDate(auto)}` : esc(rule.basis)) : 'по тексту документа'}${left !== null ? ` · ${left < 0 ? `<span class="neg">истёк</span>` : left <= (x.remind ?? 60) ? `<span class="warnv">истекает через ${left} дн.</span>` : `ещё ${left} дн.`}` : ''}</div></td>
          <td>за ${pdIn(`docs.${i}.remind`, x.remind ?? 60, 'class="sm-in" inputmode="numeric"')} дн.</td>`; }, ['Тип', 'Документ', '№', 'Дата выпуска', 'Действует до', 'Напомнить в сводке'], 'ГПЗУ, изыскания, ТУ — когда истекают. Для ГПЗУ и топосъёмки срок считается от даты выпуска сам; ТУ, СТУ и прочее — по тексту документа. Напоминание появится в сводке.')}</div>
    ${A.isGip(state.me) ? `<div class="sub" data-cs="money"><h3>Договор и финансы <span class="chip tone-idle">только ГИП</span></h3><p class="hint">Договор заказчика с «Тандемом» — не путать с бюджетами подрядчиков. Пока номер договора пуст, вкладки «Договор и финансы» у заказчика нет.</p>
      <div class="fgrid"><div class="f"><label>Номер договора</label>${pdIn('contract.no', d.contract.no, 'placeholder="26/07-12" maxlength="40"')}</div><div class="f"><label>Дата</label>${pdDate('contract.date', d.contract.date)}</div>
        <div class="f wide"><label>Предмет</label>${pdIn('contract.subject', d.contract.subject, 'placeholder="Инженерные изыскания и проектная документация, стадия П" maxlength="200"')}</div>
        <div class="f"><label>Стоимость, ₽</label>${pdIn('contract.sum', d.contract.sum, 'inputmode="decimal" placeholder="4 860 000" maxlength="20"')}</div><div class="f"><label>Статус</label>${pdSel('contract.status', CONTRACT_STATUS, d.contract.status)}</div></div>
      <h4>График оплат</h4>${list('payments', (x, i) => `<td class="grow">${pdIn(`payments.${i}.title`, x.title, 'placeholder="Аванс" maxlength="120"')}</td><td>${pdIn(`payments.${i}.sum`, x.sum, 'inputmode="decimal" placeholder="1 458 000" maxlength="20"')}</td><td class="grow">${pdIn(`payments.${i}.cond`, x.cond, 'placeholder="при подписании" maxlength="120"')}</td><td>${pdSel(`payments.${i}.status`, PAY_STATUS, x.status)}</td><td>${pdDate(`payments.${i}.date`, x.date)}</td>`, ['Этап', 'Сумма', 'Условие', 'Статус', 'Дата'], 'Аванс, оплата за этапы, окончательный расчёт.')}
      <h4>Счета и акты</h4>${list('bills', (x, i) => `<td class="grow">${pdIn(`bills.${i}.title`, x.title, 'placeholder="Акт № 2 по проектной документации" maxlength="160"')}</td><td>${pdDate(`bills.${i}.date`, x.date)}</td><td>${pdSel(`bills.${i}.status`, BILL_STATUS, x.status)}</td><td>${pdDate(`bills.${i}.due`, x.due)}</td>`, ['Документ', 'Дата', 'Статус', 'Оплатить до'], 'Счета и акты по договору — без файлов, только статус.')}</div>` : ''}
    <div class="sub" data-cs="show"><h3>Рекомендация ГИПа и контакт</h3>
      <div class="fgrid"><div class="f wide"><label>Заголовок</label>${pdIn('advice.title', d.advice.title, 'placeholder="Рабочая документация на сети" maxlength="120"')}</div>
        <div class="f wide"><label>Текст</label><textarea data-pd="advice.text" maxlength="600" placeholder="Что посоветовать заказчику на этом этапе">${esc(d.advice.text)}</textarea></div>
        <div class="f"><label>Контакт на странице</label><select data-pd="contactId"><option value="">— не показывать —</option>${staff.map(u => `<option value="${esc(u.id)}"${u.id === d.contactId ? ' selected' : ''}>${esc(u.name)}${u.phone ? '' : ' (нет телефона)'}</option>`).join('')}</select><span class="hint">Телефон и почта — из карточки сотрудника.</span></div></div></div>
    <div class="sub" data-cs="show"><h3>Что показывать заказчику</h3><div class="pd-show">${pdChk('show.plan', d.show.plan, ' план и вехи')}${pdChk('show.sections', d.show.sections, ' разделы проекта')}${pdChk('show.advice', d.show.advice, ' рекомендация ГИПа')}${pdChk('show.revisions', d.show.revisions, ' номера изменений')}${pdChk('show.ird', d.show.ird, ' исходные данные')}${pdChk('show.meetings', d.show.meetings, ' встречи и протокол')}${pdChk('show.team', d.show.team, ' команда проекта (участники)')}${A.isGip(state.me) ? pdChk('show.finance', d.show.finance, ' договор и финансы') : ''}${pdChk('show.soon', d.show.soon, ' «Навигатор» и «3D-модель» с пометкой «скоро»')}</div>
      <p class="hint">Подрядчики, бюджеты подрядчиков и внутренние замечания на странице не показываются никогда; договор заказчика — только если ГИП его заполнил и включил.</p></div>`;
}
// Source data and requests: a row is «asked» when an open request points to it.
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
  'ird-techcard': ({ id }) => { state.draft.ird.push(...Techcard.SOURCE_DATA.filter(([t]) => !state.draft.ird.some(x => x.title.trim().toLowerCase() === t.toLowerCase())).map(([title, who]) => ({ id: newId(), title, kind: irdKindOf(title), who: who === 'Изыскатели' ? '«Тандем»' : who.replace('Заказчик / технолог', 'Заказчик'), status: 'plan', due: '', note: '' }))); renderCustomer(); },
  'pd-add': ({ el }) => { draftList(el.dataset.list).push(PD_NEW[el.dataset.list]()); renderCustomer(); },
  'pd-del': ({ el }) => { draftList(el.dataset.list).splice(Number(el.dataset.i), 1); renderCustomer(); },
  'cust-page': ({ el }) => { customerPage(el.dataset.format); },
  'req-attach': ({ el }) => { const x = state.draft?.requests?.[Number(el.dataset.i)], pid = state.drawer?.id; if (x && pid) api.attachAdd(pid).then(r => { if (r?.ok) { x.files = [...(x.files || []), r.file]; renderCustomer(); toast('Файл приложен — сохраните проект, и заказчик увидит его в кабинете.'); } else if (r && !r.canceled) toast(r.message, true); }); },
  'req-unattach': ({ el }) => { const x = state.draft?.requests?.[Number(el.dataset.i)]; if (x) { x.files = (x.files || []).filter((_, k) => k !== Number(el.dataset.k)); renderCustomer(); } },
  'att-open': ({ el }) => { const pid = state.drawer?.id; if (pid) api.attachOpen(pid, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть', true); }); },
  'cust-sec': ({ el }) => { custSec = el.dataset.v; saveLocal('custSec', custSec); custNav(); },
  'ask-customer': ({ id }) => { const pr = state.projects.get(id); if (pr) askCustomer(pr); },
});
// «Состав по ПП № 87»: a tree of sections → subsections → books → parts; leaves become cards.
function renderComposition() {
  const box = $('#comp-box'), d = state.draft;
  if (!box || !d) return;
  const p = state.projects.get(state.drawer.id) || {};
  const code = (val('code') || p.code || '').trim();
  if (!d.composition) {
    box.innerHTML = `<div class="comp-empty"><h3>Генератор состава проекта</h3><p>Проектная документация — по Постановлению Правительства РФ № 87 (ред. от 21.10.2025). К её разделам программа предложит разделы рабочей документации (основные комплекты по ГОСТ Р 21.101-2026 и принятые на практике). Всё можно выключить, переименовать, добавить своё.</p>
      <p><b>Вид объекта:</b></p><div class="comp-bases">${Object.entries(Composition.BASES).map(([k, b]) => `<button class="btn" type="button" data-act="comp-base" data-v="${k}"><b>${esc(b.label)}</b><small>${b.sections.length} разделов${k === 'nonprod' ? ', ТХ — по заданию' : ''}</small></button>`).join('')}</div></div>`;
    return;
  }
  const comp = d.composition;
  const rows = Composition.rowsFor(comp, code);
  const vols = new Set(Composition.volumes(comp, code).map(v => v.id));
  const owners = A.assignableOwners(state.me, liveUsers()).filter(u => u.role !== 'gip' || A.isGip(state.me)).sort(byName);
  const ownerSel = (attr, cur) => `<select ${attr} data-k="ownerId"><option value="">— вы —</option>${owners.map(u => `<option value="${esc(u.id)}"${u.id === cur ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
  const contrSel = (attr, cur) => `<select ${attr} data-k="contractorId"><option value="">—</option>${contractorsArr().map(c => `<option value="${esc(c.id)}"${c.id === cur ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const cardCell = (taskId, isVol) => { const t = taskId ? state.tasks.get(taskId) : null; return t ? `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(t.id)}">${statusChip(t)}</button>` : isVol ? '<span class="hint">нет</span>' : ''; };
  const pdPending = rows.filter(r => vols.has(r.node.id) && !(r.node.taskId && state.tasks.has(r.node.taskId))).length;
  const rdList = comp.rd || [];
  const rdRows = new Map(Composition.rdRows(comp, code).map(r => [r.id, r]));
  const rdPending = [...rdRows.values()].filter(r => !(r.item.taskId && state.tasks.has(r.item.taskId))).length;
  const groups = Composition.rdGroups(comp);
  const pdOptions = cur => {
    const own = cur && !groups.some(g => g.node.id === cur) ? comp.nodes.find(n => n.id === cur) : null; // e.g. a switched-off section
    return `<option value="">— вне разделов ПД —</option>${own ? `<option value="${esc(own.id)}" selected>${esc(own.abbr || own.title)} (выключен)</option>` : ''}${groups.map(g => `<option value="${esc(g.node.id)}"${g.node.id === cur ? ' selected' : ''}>${esc(g.node.abbr)}</option>`).join('')}`;
  };
  const srcTag = src => src === 'gost' ? '<span class="src gost" title="Обозначение есть в таблице В.1 ГОСТ Р 21.101-2026">ГОСТ</span>' : '<span class="src" title="Принято на практике, в таблице ГОСТ Р 21.101-2026 не найдено">практика</span>';

  box.innerHTML = `<div class="cust-top"><span class="hint">База ПД: ${esc(Composition.BASES[comp.base]?.label || '')}. Обозначения — от шифра проекта${code ? ` «${esc(code)}»` : ' (шифр не задан — впишите на вкладке «Основное»)'}.</span><span class="spacer"></span>
      <button class="btn" type="button" data-act="comp-export" data-format="sp">Состав ПД → Word</button><button class="btn" type="button" data-act="comp-export" data-format="vok"${rdRows.size ? '' : ' disabled title="В составе РД пока нет разделов — добавьте их ниже"'}>ВОК → Word</button><button class="btn ghostbtn" type="button" data-act="comp-export" data-format="xlsx">Excel</button></div>
    <div class="comp-opts">
      <label>Нумерация томов ПД <select data-copt="numbering.pd">${Object.entries(Composition.NUMBERING.pd).map(([k, l]) => `<option value="${k}"${Composition.numberingOf(comp).pd === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label>РД <select data-copt="numbering.rd">${Object.entries(Composition.NUMBERING.rd).map(([k, l]) => `<option value="${k}"${Composition.numberingOf(comp).rd === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="chk" title="Задания смежникам по техкарте станут подзадачами разделов; прямые задания задают старт получателя"><input type="checkbox" data-copt="links.pd"${comp.links?.pd !== false ? ' checked' : ''}> Задания по техкарте в ПД</label>
      <label class="chk"><input type="checkbox" data-copt="links.rd"${comp.links?.rd !== false ? ' checked' : ''}> в РД</label>
      <button class="btn ghostbtn sm" type="button" data-act="techcard" data-sec="assign">? техкарта</button></div>

    <section class="comp-part"><div class="comp-h"><h3>1. Проектная документация · ПП РФ № 87</h3><span class="hint">Томов: ${vols.size}</span><span class="spacer"></span>${pdPending ? `<span class="hint">При сохранении будет создано задач: ${pdPending}</span>` : ''}</div>
    <div class="tablewrap"><table class="comp-t"><thead><tr><th>Раздел · подраздел · книга · часть</th><th>Обозначение</th><th>Том</th><th>Ответственный</th><th>Подрядчик</th><th>Задача</th><th>Вкл.</th><th></th></tr></thead><tbody>
    ${rows.map(r => {
      const n = r.node, child = Composition.CHILD[n.kind], v = vols.has(n.id);
      return `<tr class="ck-${n.kind}${r.disabled ? ' off' : ''}${v ? ' vol' : ''}">
        <td><div class="comp-name" style="--d:${r.depth}"><span class="comp-k">${Composition.KINDS[n.kind]}${n.kind === 'section' ? ' ' + (n.num ?? '') : ''}</span>${n.std ? `<span class="comp-title">${esc(n.title)}</span>` : `<input data-cn="${n.id}" data-k="title" value="${esc(n.title)}" placeholder="Название" maxlength="300">`}</div></td>
        <td><input class="code-in" data-cn="${n.id}" data-k="code" value="${esc(n.code || '')}" placeholder="${esc(r.code)}" maxlength="80"></td>
        <td><input class="sm-in" data-cn="${n.id}" data-k="tom" value="${esc(n.tom || '')}" placeholder="${esc(r.tom)}" maxlength="20"></td>
        <td>${v ? ownerSel(`data-cn="${n.id}"`, n.ownerId) : ''}</td><td>${v ? contrSel(`data-cn="${n.id}"`, n.contractorId) : ''}</td><td>${cardCell(n.taskId, v)}</td>
        <td><input type="checkbox" data-cn="${n.id}" data-k="on"${n.on !== false ? ' checked' : ''} aria-label="Включить"></td>
        <td class="nowrap">${child ? `<button class="btn ghostbtn sm" type="button" data-act="comp-add" data-id="${n.id}" title="Добавить: ${Composition.KINDS[child].toLowerCase()}">+ ${Composition.KINDS[child].toLowerCase()}</button>` : ''}${n.std ? '' : `<button class="btn ghostbtn sm" type="button" data-act="comp-del" data-id="${n.id}" aria-label="Удалить">✕</button>`}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="comp-foot"><button class="btn sm" type="button" data-act="comp-add" data-id="">+ свой раздел</button><span class="hint">Разделы постановления не удаляются — их можно выключить. Обозначение и том считаются сами; впишите своё, чтобы переопределить.</span></div></section>

    <section class="comp-part"><div class="comp-h"><h3>2. Рабочая документация · основные комплекты</h3><span class="hint">Разделов: ${rdRows.size}</span><span class="spacer"></span>${rdPending ? `<span class="hint">При сохранении будет создано задач: ${rdPending}</span>` : ''}</div>
    ${comp.rd ? '' : '<p class="hint">Состав рабочей документации ещё не сформирован. <button class="btn sm" type="button" data-act="comp-rd-suggest">Предложить по разделам ПД</button></p>'}
    <div class="rd-groups">${groups.map(g => `<div class="rd-group"><span class="rd-pd"><b>${esc(g.node.abbr)}</b> ${esc(g.node.title)}</span><span class="rd-chips">${g.items.map(it => {
      const here = rdList.some(x => x.pdId === g.node.id && Composition.markBase(x.mark) === it.mark);
      const other = !here && rdList.some(x => Composition.markBase(x.mark) === it.mark);
      return `<button class="rd-chip${here ? ' on' : ''}${other ? ' else' : ''}" type="button" data-act="rd-chip" data-pd="${esc(g.node.id)}" data-mark="${esc(it.mark)}" title="${esc(it.title)}${other ? ' — уже есть в другом разделе' : ''}">${here ? '✓ ' : '+ '}${esc(it.mark)}</button>`;
    }).join('')}<button class="rd-chip own" type="button" data-act="rd-add" data-pd="${esc(g.node.id)}" title="Свой раздел РД к этому разделу ПД">+ своя</button></span></div>`).join('')}</div>
    <div class="tablewrap"><table class="comp-t rd-t"><thead><tr><th></th><th>Том</th><th>Раздел РД</th><th>Наименование</th><th>К разделу ПД</th><th>Обозначение</th><th>Примечание</th><th>Ответственный</th><th>Подрядчик</th><th>Задача</th><th>Вкл.</th><th></th></tr></thead><tbody>
    ${rdList.map((x, i) => { const r = rdRows.get(x.id), base = Composition.RD_MARKS[Composition.markBase(x.mark)];
      const pdOff = x.pdId && !r && x.on !== false && x.mark;
      return `<tr class="${x.on === false || pdOff ? 'off' : 'vol'}"${pdOff ? ' title="Раздел ПД, к которому относится этот раздел, выключен — в ВОК не попадёт"' : ''}><td class="nowrap"><button class="btn ghostbtn sm" type="button" data-act="rd-move" data-id="${x.id}" data-dir="-1"${i ? '' : ' disabled'} aria-label="Выше">↑</button><button class="btn ghostbtn sm" type="button" data-act="rd-move" data-id="${x.id}" data-dir="1"${i < rdList.length - 1 ? '' : ' disabled'} aria-label="Ниже">↓</button></td>
        <td><input class="sm-in" data-rd="${x.id}" data-k="tom" value="${esc(x.tom || '')}" placeholder="${esc(r?.tom || '')}" maxlength="20"></td>
        <td class="nowrap"><input class="mark-in" data-rd="${x.id}" data-k="mark" value="${esc(x.mark)}" placeholder="ЭОМ" maxlength="20">${base ? srcTag(base[1]) : ''}</td>
        <td><input data-rd="${x.id}" data-k="title" value="${esc(x.title || '')}" placeholder="${esc(base?.[0] || 'Наименование')}" maxlength="300"></td>
        <td><select data-rd="${x.id}" data-k="pdId">${pdOptions(x.pdId)}</select></td>
        <td><input class="code-in" data-rd="${x.id}" data-k="code" value="${esc(x.code || '')}" placeholder="${esc(r?.code || '')}" maxlength="80"></td>
        <td><input class="note-in" data-rd="${x.id}" data-k="note" value="${esc(x.note || '')}" placeholder="Выдано, дата…" maxlength="60"></td>
        <td>${ownerSel(`data-rd="${x.id}"`, x.ownerId)}</td><td>${contrSel(`data-rd="${x.id}"`, x.contractorId)}</td><td>${cardCell(x.taskId, true)}</td>
        <td><input type="checkbox" data-rd="${x.id}" data-k="on"${x.on !== false ? ' checked' : ''} aria-label="Включить"></td>
        <td><button class="btn ghostbtn sm" type="button" data-act="rd-del" data-id="${x.id}" aria-label="Удалить">✕</button></td></tr>`; }).join('') || '<tr><td colspan="12" class="hint">Отметьте разделы выше или добавьте свой раздел.</td></tr>'}</tbody></table></div>
    <div class="comp-foot"><button class="btn sm" type="button" data-act="rd-add" data-pd="">+ свой раздел РД</button><span class="hint">Том — по порядку строк, обозначение — «шифр-раздел»; впишите своё, чтобы переопределить (например КЖ1.1). Примечание попадает в ВОК («Выдано», дата выдачи).</span></div></section>`;
}
function rdInsert(item) {
  const comp = state.draft.composition, list = comp.rd || (comp.rd = []);
  const order = new Map(Composition.walk(comp.nodes).map((r, i) => [r.node.id, i]));
  const pos = id => (order.has(id) ? order.get(id) : Infinity);
  let at = list.length;
  if (item.pdId) { at = 0; list.forEach((x, i) => { if (pos(x.pdId) <= pos(item.pdId)) at = i + 1; }); }
  list.splice(at, 0, item);
}
function rdChip(pdId, mark) {
  const comp = state.draft.composition, list = comp.rd || (comp.rd = []);
  const mine = list.filter(x => x.pdId === pdId && Composition.markBase(x.mark) === mark);
  if (mine.length) {
    if (mine.some(x => x.taskId && state.tasks.has(x.taskId))) return toast(`У раздела ${mark} есть карточка — уберите строку крестиком в таблице (карточка останется).`);
    comp.rd = list.filter(x => !mine.includes(x));
  } else rdInsert(rdNew(pdId, mark, Composition.RD_MARKS[mark]?.[0] || ''));
  renderComposition();
}
function rdAdd(pdId) {
  const item = rdNew(pdId);
  rdInsert(item);
  renderComposition();
  document.querySelector(`[data-rd="${item.id}"][data-k="mark"]`)?.focus();
}
function rdDel(id) {
  const x = rdItem(id);
  if (!x) return;
  if (x.taskId && state.tasks.has(x.taskId) && confirmCompDel !== id) { confirmCompDel = id; return toast('У раздела есть карточка — карточка останется. Нажмите ✕ ещё раз, чтобы убрать раздел из состава.'); }
  confirmCompDel = null;
  state.draft.composition.rd = state.draft.composition.rd.filter(y => y.id !== id);
  renderComposition();
}
function rdMove(id, dir) {
  const list = state.draft.composition.rd, i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  renderComposition();
}
function compNode(id) { return state.draft.composition.nodes.find(n => n.id === id); }
function compAdd(parentId) {
  const nodes = state.draft.composition.nodes, parent = parentId ? compNode(parentId) : null;
  const kind = parent ? Composition.CHILD[parent.kind] : 'section';
  if (!kind) return;
  const num = kind === 'section' ? Math.max(0, ...nodes.filter(n => n.kind === 'section').map(n => n.num || 0)) + 1 : undefined;
  const node = { id: Composition.newId(), parentId: parentId || '', kind, num, abbr: kind === 'section' ? 'ИД' + num : '', title: '', on: true, marks: [], ownerId: '', contractorId: '' };
  // Insert after the parent's last descendant so the flat list keeps the tree order.
  const desc = new Set([parentId]);
  let at = parentId ? nodes.findIndex(n => n.id === parentId) : nodes.length - 1;
  for (let i = at + 1; i < nodes.length && parentId; i++) { if (desc.has(nodes[i].parentId)) { desc.add(nodes[i].id); at = i; } else if (!desc.has(nodes[i].id)) break; }
  nodes.splice(at + 1, 0, node);
  renderComposition();
  document.querySelector(`[data-cn="${node.id}"][data-k="title"]`)?.focus();
}
function compDel(id) {
  const nodes = state.draft.composition.nodes, drop = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const n of nodes) if (!drop.has(n.id) && drop.has(n.parentId)) { drop.add(n.id); grew = true; } }
  if ([...drop].some(x => compNode(x)?.taskId && state.tasks.has(compNode(x).taskId)) && !confirmCompDel) { confirmCompDel = id; return toast('У строки есть карточка — карточка останется. Нажмите ✕ ещё раз, чтобы убрать строку из состава.'); }
  confirmCompDel = null;
  state.draft.composition.nodes = nodes.filter(n => !drop.has(n.id));
  renderComposition();
}
// Word lists need the names for the title page and the stamp; asked on each export, remembered on this computer.
async function compExport(format) {
  const id = state.drawer.id;
  if (!(await submitSimple(true))) return;
  let opts = {};
  if (format !== 'xlsx') {
    opts = await askDocNames(format);
    if (!opts) return;
  }
  const res = await api.exportComposition(id, format, opts);
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
}
// Timeline questionnaire («анкета сроков»): stages П, экспертиза, Р (after or parallel to expertise), надзор and
// other contract dates. Shown when a project is created and from the project page («Сроки»). Resolves true when saved.
function askTimeline(p) {
  const ms = (p.milestones || []).map(m => ({ ...m }));
  // All phases, as on «Для заказчика» (one list); «Договор» only for GIPs.
  const gip = A.isGip(state.me);
  // A new plan: expertise follows П and Р follows expertise (as before 4.1) until the user unticks it.
  let phases = L.defaultPhases().map(d => { const was = (p.phases || []).find(x => x.key === d.key); return { ...d, ...(was || {}), ...(!was?.start && was?.chain === undefined && ['expertise', 'r'].includes(d.key) ? { chain: true } : {}) }; });
  const shown = () => phases.map((ph, i) => ({ ph, i })).filter(x => gip || x.ph.key !== 'contract');
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const msRow = (m, i) => `<div class="tq-ms" data-i="${i}"><input class="tq-ms-t" value="${esc(m.title || '')}" placeholder="Например: выдача ТУ, оплата аванса, сдача сметы" maxlength="120"><input class="tq-ms-d" type="date" value="${esc(m.date || '')}"><button class="btn ghostbtn sm" type="button" data-m="ms-del" aria-label="Убрать">✕</button></div>`;
    root.innerHTML = `<form class="modal tq-modal" role="dialog" aria-modal="true" aria-labelledby="tltitle" novalidate><h2 id="tltitle">Сроки по договору · ${esc(p.name || '')}</h2>
      <p class="hint">По этим срокам программа расставит предварительные даты разделов по волнам техкарты и сроки заданий смежникам. Можно заполнить потом: кнопка «Сроки» на странице проекта.</p>
      <div id="tq-phases"></div>
      <div class="tq-mode"><span class="lbl">Рабочая документация</span>
        <label class="chk"><input type="radio" name="tq-mode" value="after"${p.rdMode !== 'parallel' ? ' checked' : ''}> после экспертизы</label>
        <label class="chk"><input type="radio" name="tq-mode" value="parallel"${p.rdMode === 'parallel' ? ' checked' : ''}> параллельно с экспертизой</label>
        <span class="hint" id="tq-hint"></span></div>
      <div class="tq-ms-box"><span class="lbl">Иные сроки по договору</span><div id="tq-ms">${ms.map(msRow).join('')}</div><button class="btn sm" type="button" data-m="ms-add">+ срок</button></div>
      <div class="err" id="tq-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить сроки</button><button class="btn" type="button" data-m="cancel">Заполню потом</button></div></form>`;
    document.body.append(root);
    const q = sel => root.querySelector(sel);
    const draw = () => {
      const list = shown();
      q('#tq-phases').innerHTML = phaseTableHtml(list.map(x => x.ph), (k, f) => `data-ph="${list[k].i}.${f}"`) + phaseGanttHtml(phases.filter(x => gip || x.key !== 'contract'), ms);
    };
    // «Р после экспертизы / параллельно»: sets the chain of Р and, for «параллельно», puts Р right after П.
    const mode = () => {
      const m = q('input[name="tq-mode"]:checked').value, r = phases.find(x => x.key === 'r'), pp = phases.find(x => x.key === 'p');
      if (m === 'parallel' && r) {
        const was = r.chain; r.chain = false;
        if (isDate(pp?.finish) && (was || !isDate(r.start) || r.auto)) { const d = L.phaseDays(r); r.start = addDays(pp.finish, 1); if (d > 0) r.finish = addDays(r.start, d - 1); r.auto = true; }
      }
      if (m === 'after' && r) { r.chain = true; delete r.auto; }
      phases = L.planPhases(phases);
      q('#tq-hint').textContent = m === 'parallel' ? 'Р стартует сразу после П; замечания экспертизы правятся в обоих.' : 'Р стартует после положительного заключения.';
    };
    const close = r => { root.remove(); resolve(r); };
    root.addEventListener('input', e => { const k = e.target.dataset.ph?.split('.'); if (k) { const x = phases[Number(k[0])]; x[k[1]] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; } });
    root.addEventListener('change', e => {
      const k = e.target.dataset.ph?.split('.');
      if (k) { const x = phases[Number(k[0])]; x[k[1]] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; phases = L.planPhases(phases, Number(k[0]), k[1]); draw(); q(`[data-ph="${k[0]}.${k[1]}"]`)?.focus(); return; }
      if (e.target.name === 'tq-mode') { mode(); draw(); }
    });
    root.addEventListener('click', e => {
      const m = e.target.dataset.m;
      if (e.target === root || m === 'cancel') close(false);
      if (m === 'ms-add') { q('#tq-ms').insertAdjacentHTML('beforeend', msRow({}, Date.now())); q('#tq-ms .tq-ms:last-child .tq-ms-t').focus(); }
      if (m === 'ms-del') e.target.closest('.tq-ms').remove();
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } });
    mode(); draw();
    q('[data-ph$=".start"]')?.focus();
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const err = (t, f) => modalErr(root, '#tq-err', t, f);
      for (const x of phases) delete x.auto;
      for (const [i, x] of phases.entries()) if (isDate(x.start) && isDate(x.finish) && x.finish < x.start) return err(`${L.phaseLabel(x.key)}: окончание раньше начала.`, `[data-ph="${i}.finish"]`);
      // A non-GIP never sees «Договор»: it is kept as stored.
      if (!gip) { const c = (p.phases || []).find(x => x.key === 'contract'); const i = phases.findIndex(x => x.key === 'contract'); if (i >= 0) phases[i] = c ? { ...c } : phases[i]; }
      const old = new Map(ms.map(m => [m.id, m]));
      const milestones = [...root.querySelectorAll('.tq-ms')].map(r => ({ title: r.querySelector('.tq-ms-t').value.trim(), date: r.querySelector('.tq-ms-d').value }))
        .filter(m => m.title).map((m, i) => { const was = ms[i] && old.get(ms[i].id); return { id: was?.title === m.title ? was.id : newId(), title: m.title, date: m.date, done: !!(was?.title === m.title && was.done) }; });
      const rdMode = q('input[name="tq-mode"]:checked').value;
      const ok = await write(op.update('projects', p.id, { phases, milestones, rdMode }), 'Сроки проекта сохранены');
      if (ok) { syncPhasesDraft(p.id, phases, milestones); close(true); }
    });
  });
}
function techcardBody(sec) {
  const T = Techcard, lbl = k => k.replace(/^ИОС(\d)$/, 'ИОС $1');
  // Sections are [num, abbr, title, …]; ИОС subsections are [abbr, title, marks].
  const flat = Object.values(Composition.BASES).flatMap(b => b.sections.flatMap(x => [[x[1], x[2]], ...(x[4] || []).map(y => [y[0], y[1]])]));
  const sectionTitle = k => flat.find(x => x[0] === k)?.[1] || '';
  const tbl = (head, rows) => `<div class="tablewrap"><table class="tc-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (sec === 'stages') return `<ol class="tc-stages">${T.STAGES.map(([t, d]) => `<li><b>${esc(t)}</b><span class="hint">${esc(d)}</span></li>`).join('')}</ol>
    <p class="hint">Стадия Р идёт после экспертизы или параллельно с ней — это выбирается в «Сроках» проекта.</p>`;
  if (sec === 'source') return tbl(['Документ', 'Кто даёт', 'Кому нужен'], T.SOURCE_DATA.map(r => r.map(esc)));
  if (sec === 'waves') {
    const by = {};
    for (const [k, w] of Object.entries(T.WAVES)) (by[w] ||= []).push(k);
    return `<div class="tc-waves">${Object.keys(by).map(w => { const [a, b] = T.WAVE_WINDOW[w];
      return `<div class="tc-wave"><div class="tc-wave-h"><b>Волна ${w}</b> <span class="hint">${esc(T.WAVE_NAMES[w])} · ${Math.round(a * 100)}–${Math.round(b * 100)} % срока стадии</span></div>
      <div class="tc-bar"><i style="left:${a * 100}%;width:${(b - a) * 100}%"></i></div>
      <div class="tc-keys">${by[w].map(k => `<span class="chip ${T.CRITICAL.includes(k) ? 'tone-work' : 'tone-idle'}" title="${esc(sectionTitle(k))}">${esc(lbl(k))}</span>`).join('')}</div></div>`; }).join('')}</div>
      <p class="hint">Выделены разделы критического пути: ${T.CRITICAL.map(lbl).join(' → ')}. По этим окнам генератор ставит предварительные даты задач, если заданы сроки стадий П и Р.</p>`;
  }
  if (sec === 'assign') return `<p class="hint">При генерации состава каждое задание становится подзадачей раздела-источника и видно получателю как входящее. Задание «вперёд» (в раздел следующей волны) задаёт старт получателя: «начать после».</p>`
    + tbl(['От', 'Кому', 'Что передаётся'], T.ASSIGN.map(([f, to, w]) => [esc(f === 'ИОС*' ? 'каждый ИОС' : lbl(f)), esc(to.map(x => (x === 'ИОС*' ? 'все ИОС' : lbl(x))).join(', ')), esc(w)]));
  if (sec === 'rd') return `<p class="hint">Что генератор предлагает в рабочую документацию к разделу ПД (✓ — включено по умолчанию). Обозначения разделов РД — по ГОСТ Р 21.101-2026 и принятые на практике.</p>`
    + tbl(['Раздел ПД', 'Разделы РД'], Object.entries(Composition.RD_SUGGEST).map(([k, list]) => [`<b>${esc(lbl(k))}</b>`, list.map(([m, on]) => `<span class="chip ${on ? 'tone-work' : 'tone-idle'}" title="${esc(Composition.RD_MARKS[m]?.[0] || '')}">${on ? '✓ ' : ''}${esc(m)}</span>`).join(' ')]));
  if (sec === 'summary') return tbl(['Раздел', 'Что получает', 'Что отдаёт', 'Когда'], T.SUMMARY.map(r => r.map(esc)));
  // 4.6 (item 10): for each section, briefly — what it gets from whom and what it gives to whom.
  if (sec === 'bysec') {
    const ALIAS = { ИОС1: 'ЭОМ', ИОС2: 'ВК · вода', ИОС3: 'ВК · канализация', ИОС4: 'ОВ, ТС, ИТП', ИОС5: 'СС', ИОС6: 'ГС' };
    const name = k => `${lbl(k)}${ALIAS[k] ? ` <span class="hint">(${ALIAS[k]})</span>` : ''}`;
    const short = k => esc(ALIAS[k] ? ALIAS[k].split(/[ ,·]/)[0] : lbl(k));
    const keys = Object.keys(T.WAVES).filter(k => !['ИД', 'СМ', 'ПЗ'].includes(k));
    const all = T.pairs(keys);
    const one = k => {
      const inc = all.filter(x => x.to === k), out = all.filter(x => x.from === k);
      if (!inc.length && !out.length) return '';
      const rows = (list, side) => list.map(x => `<li><b>${side === 'in' ? 'от ' : ''}${short(side === 'in' ? x.from : x.to)}</b> — ${esc(x.what)}</li>`).join('');
      return `<div class="tc-sec" data-key="${esc(k)}"><h4>${name(k)} <span class="hint">· волна ${T.waveOf(k)}</span></h4>
        ${inc.length ? `<div class="tc-io"><span class="tc-io-h">Получает</span><ul>${rows(inc, 'in')}</ul></div>` : ''}
        ${out.length ? `<div class="tc-io"><span class="tc-io-h out">Выдаёт</span><ul>${rows(out, 'out')}</ul></div>` : ''}</div>`;
    };
    return `<p class="hint">Например: ОВ получает планировки от АР и сетку колонн от КР, выдаёт КР и АР отверстия и нагрузки, ЭОМ — электрические нагрузки. Из этих пар генератор делает задания-подзадачи.</p>
      <div class="tc-secs">${keys.map(one).join('')}</div>`;
  }
  return '';
}
function openTechcard(sec = 'stages') {
  $('.tc-back')?.remove();
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'modal-back tc-back';
  const draw = s => {
    root.innerHTML = `<div class="modal tc-modal" role="dialog" aria-modal="true" aria-labelledby="tctitle"><div class="tc-head"><h2 id="tctitle">Техкарта процесса проектирования</h2><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-m="close" aria-label="Закрыть">✕</button></div>
      <nav class="tc-nav">${TC_SECS.map(([k, l]) => `<button class="btn sm${k === s ? ' primary' : ''}" type="button" data-m="sec" data-sec="${k}">${l}</button>`).join('')}</nav>
      <div class="tc-body">${techcardBody(s)}</div>
      <p class="hint tc-foot">Порядок волн и состав заданий — рабочая версия, будет уточняться.</p></div>`;
  };
  draw(TC_SECS.some(x => x[0] === sec) ? sec : 'stages');
  document.body.append(root);
  root.addEventListener('click', e => { const m = e.target.closest('[data-m]')?.dataset.m; if (e.target === root || m === 'close') root.remove(); if (m === 'sec') draw(e.target.closest('[data-m]').dataset.sec); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  root.tabIndex = -1; root.focus();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'project-timeline': ({ id }) => { const pr = state.projects.get(id); if (pr) askTimeline(pr).then(ok => ok && refresh()); },
  'techcard': ({ el }) => { openTechcard(el.dataset.sec || 'stages'); },
  'comp-base': ({ el }) => { state.draft.composition = Composition.fromBase(el.dataset.v); renderComposition(); },
  'comp-add': ({ id }) => { compAdd(id); },
  'comp-del': ({ id }) => { compDel(id); },
  'comp-rd-suggest': () => { state.draft.composition.rd = Composition.rdDefaults(state.draft.composition); renderComposition(); },
  'rd-chip': ({ el }) => { rdChip(el.dataset.pd, el.dataset.mark); },
  'rd-add': ({ el }) => { rdAdd(el.dataset.pd); },
  'rd-del': ({ id }) => { rdDel(id); },
  'rd-move': ({ el, id }) => { rdMove(id, Number(el.dataset.dir)); },
  'comp-export': ({ el }) => { compExport(el.dataset.format); },
});
/* ---------- customer cabinet (server): publication, access, messages ---------- */
let cab = null;          // view from the main process: { allowed, configured, url, published, messages, lastSync, lastError }
let cabCustomers = null; // customer accounts on the server, loaded when the «Для заказчика» tab is shown
let cabPw = null;        // { name, login, password } — shown once after creating or resetting
let cabLoadErr = '';
const CAB_KINDS = { answer: 'Ответ на запрос', call: 'Просьба перезвонить', urgent: 'Горящий вопрос', question: 'Вопрос', meeting: 'Перенос встречи', reopen: 'Просьба открыть проект снова' };
// The customer's verdict on files sent for approval.
const decisionChip = m => (m?.decision === 'approve' ? ' <span class="chip tone-ok">Согласовано</span>' : m?.decision === 'remarks' ? ' <span class="chip tone-warn">Есть замечания</span>' : '');
const cabTime = ts => { const d = new Date(ts); return Number.isNaN(+d) ? '' : `${fmtDate(ts.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function setCab(v) {
  const unreadBefore = cab?.messages?.filter(m => !m.read).length || 0, countBefore = cab?.messages?.length || 0;
  cab = v;
  if (document.querySelector('.settings-modal')) renderSettings();
  if ($('#org-cab')) renderOrgCabinet();
  if ($('#cab-box')) { renderCabinetBox(); custNav(); if ((cab?.messages?.length || 0) !== countBefore) loadCabCustomers(true); } // «последний вход» moves with new messages
  const unread = cab?.messages?.filter(m => !m.read).length || 0;
  if (state.loaded && (state.tab === 'overview' || unread !== unreadBefore)) render();
}
async function loadCabCustomers(force = false) {
  if (!cab?.configured || (cabCustomers && !force)) return;
  const r = await api.cabinetCustomers();
  cabLoadErr = r.ok ? '' : r.message;
  cabCustomers = r.ok ? r.customers : cabCustomers;
  renderCabinetBox();
  renderOrgCabinet();
}
// Overview: unread messages from customers, urgent ones first.
function cabinetInbox() {
  if (!cab?.allowed) return '';
  const list = cab.messages.filter(m => !m.read).sort((a, b) => (b.kind === 'urgent') - (a.kind === 'urgent') || b.ts.localeCompare(a.ts));
  if (!list.length) return '';
  return `<section class="panel cab-inbox"><div class="panel-h"><h3>От заказчиков</h3><span class="meta">${list.length}</span><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="cab-read-all">Прочитано всё</button></div>
    ${list.slice(0, 20).map(m => `<button class="att cust-alert${m.kind === 'urgent' ? ' urgent' : ''}" type="button" data-act="cab-open-msg" data-id="${esc(m.id)}"><span><b>${esc(CAB_KINDS[m.kind] || 'Сообщение')}${m.requestTitle ? `: ${esc(m.requestTitle)}` : ''}${m.meetingTitle ? `: ${esc(m.meetingTitle)}` : ''}${m.to ? ` → ${esc(m.to)}` : ''}</b><br>${esc(m.text.slice(0, 160))}<br><span class="hint">${esc(m.customerName)} · ${esc(state.projects.get(m.projectId)?.name || m.projectName)}</span></span><span class="r hint">${cabTime(m.ts)}</span></button>`).join('')}</section>`;
}
function renderCabinetBox() {
  const box = $('#cab-box'), id = state.drawer?.id;
  if (!box || !id) return;
  if (!cab?.allowed) { box.innerHTML = ''; return; }
  if (!cab.configured) {
    box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Заказчик открывает свой проект в браузере или на телефоне по логину и паролю, отвечает на запросы, просит перезвонить.</p>
      <div class="cab-row"><button class="btn primary" type="button" data-act="cab-local-start">Запустить кабинет на этом компьютере</button><button class="linkbtn" type="button" data-act="cab-settings">или подключить к отдельному серверу…</button></div></div>`;
    return;
  }
  if (!cabCustomers && !cabLoadErr) loadCabCustomers();
  const pub = cab.published[id];
  const msgs = cab.messages.filter(m => m.projectId === id).slice(0, 10);
  const linked = (cabCustomers || []).filter(c => c.projectIds.includes(id));
  const others = (cabCustomers || []).filter(c => !c.projectIds.includes(id));
  box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3>
    <div class="cab-row">${pub ? `<span class="chip tone-ok">опубликовано</span><span class="hint">с ${cabTime(pub.at)} · после сохранения проекта страница обновляется сама в течение 2 минут</span>` : '<span class="chip tone-idle">не опубликовано</span><span class="hint">Заказчик не видит проект, пока вы его не опубликуете.</span>'}
      <span class="spacer"></span>${pub ? `<button class="btn ghostbtn sm" type="button" data-act="cab-open">Открыть в браузере</button><button class="btn sm" type="button" data-act="cab-unpublish">Снять с публикации</button>` : ''}
      <button class="btn primary sm" type="button" data-act="cab-publish">${pub ? 'Сохранить и обновить сейчас' : 'Сохранить и опубликовать'}</button></div>
    ${cab.local ? `<p class="hint">Кабинет работает на этом компьютере, пока открыт «Пульт». Адрес для заказчиков в офисной сети: ${cab.local.lan.length ? cab.local.lan.map(u => `<code>${esc(u)}</code>`).join(' ') : '<code>нет сети</code>'}. Из интернета этот адрес не откроется — для этого нужен отдельный сервер (см. «Подключить к отдельному серверу»).</p>` : ''}
    ${cab.lastError ? `<p class="neg">${esc(cab.lastError)}</p>` : ''}
    ${cab.insecure ? '<p class="warnv">Сервер открыт по http без шифрования — пароли заказчиков идут открытым текстом. Подключите https (см. инструкцию).</p>' : ''}
    ${cabPw ? `<div class="cab-pw"><b>Доступ для ${esc(cabPw.name)}</b><div>Адрес: <code>${esc(cab.publicUrl || cab.url)}</code></div><div>Логин: <code>${esc(cabPw.login)}</code> · Пароль: <code>${esc(cabPw.password)}</code></div>
      <span class="hint">Пароль показывается один раз — передайте его заказчику. Забудет — нажмите «Новый пароль».</span><div><button class="btn sm" type="button" data-act="cab-pw-copy">Скопировать для заказчика</button><button class="btn ghostbtn sm" type="button" data-act="cab-pw-hide">Скрыть</button></div></div>` : ''}
    <h4>Кто видит проект</h4>
    ${state.orgs?.get(state.projects.get(id)?.customerId) ? `<p class="hint">Заказчик из каталога — ${esc(state.orgs.get(state.projects.get(id).customerId).name)}: входы его контактных лиц и все его проекты — в <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(state.projects.get(id).customerId)}">карточке организации</button>.</p>` : ''}
    ${cabLoadErr ? `<p class="neg">${esc(cabLoadErr)} <button class="linkbtn" type="button" data-act="cab-reload">Повторить</button></p>` : !cabCustomers ? '<p class="hint">Загружаем…</p>' : ''}
    ${linked.length ? `<div class="cab-people">${linked.map(c => `<div class="cab-person"><div class="grow"><b>${esc(c.name)}</b> <span class="hint">${esc(c.login)}</span>${c.disabled ? ' <span class="chip tone-bad">вход закрыт</span>' : ''}<br><span class="hint">${c.lastLoginAt ? 'последний вход ' + cabTime(c.lastLoginAt) : 'ещё не входил'}</span></div>
      <div class="acts"><button class="btn ghostbtn sm" type="button" data-act="cab-reset" data-id="${esc(c.id)}">Новый пароль</button><button class="btn ghostbtn sm" type="button" data-act="cab-toggle" data-id="${esc(c.id)}">${c.disabled ? 'Открыть вход' : 'Закрыть вход'}</button><button class="btn ghostbtn sm" type="button" data-act="cab-unlink" data-id="${esc(c.id)}">Убрать из проекта</button></div></div>`).join('')}</div>`
      : cabCustomers ? '<p class="hint">Пока никто. Добавьте представителя заказчика — программа создаст логин и пароль.</p>' : ''}
    ${cabCustomers ? `<div class="row-in cab-add"><input id="cab-name" placeholder="Имя: Иванов Иван, ООО «Заказчик»" maxlength="120"><input id="cab-login" placeholder="Логин: ivanov" maxlength="80"><button class="btn sm" type="button" data-act="cab-add">Открыть доступ</button></div>
      ${others.length ? `<div class="row-in cab-add"><select id="cab-other"><option value="">— уже есть в кабинете —</option>${others.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.login)})</option>`).join('')}</select><button class="btn sm" type="button" data-act="cab-link">Добавить к проекту</button></div>` : ''}` : ''}
    ${msgs.length ? `<h4>Сообщения от заказчика</h4>${msgs.map(m => { const req = m.requestId && state.draft?.requests.find(r => r.id === m.requestId);
      return `<div class="cab-msg${m.read ? ' read' : ''}${m.kind === 'urgent' ? ' urgent' : ''}"><div><b>${esc(CAB_KINDS[m.kind] || 'Сообщение')}${m.requestTitle ? `: ${esc(m.requestTitle)}` : ''}${m.meetingTitle ? `: ${esc(m.meetingTitle)}` : ''}${m.to ? ` → ${esc(m.to)}` : ''}</b>${decisionChip(m)} <span class="hint">${esc(m.customerName)} · ${cabTime(m.ts)}</span></div><div class="cab-text">${esc(m.text)}</div>
        <div>${m.kind === 'reopen' && projectClosed(state.projects.get(m.projectId)) && A.canManageCatalog(state.me) ? `<button class="btn sm" type="button" data-act="cab-reopen" data-id="${esc(m.id)}">Открыть проект снова</button>` : ''}${m.read ? '' : `<button class="btn ghostbtn sm" type="button" data-act="cab-read" data-id="${esc(m.id)}">Прочитано</button>`}${req && !req.done ? (req.irdId ? `<button class="btn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Принять</button><button class="btn ghostbtn sm" type="button" data-act="cab-remark" data-id="${esc(m.id)}">Вернуть с замечанием</button>` : `<button class="btn ghostbtn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Отметить запрос «получено»</button>`) : ''}</div></div>`; }).join('')}` : ''}
  </div>`;
}
// 4.11: a finished project (status «Завершён» or in the archive) is read-only for the customer; «Открыть проект снова»
// puts it back to work as «На доработке», out of the archive, and republishes the page.
const projectClosed = p => !!p && (p.status === 'done' || !!p.archived);
async function cabReopen(msgId) {
  const m = (cab?.messages || []).find(x => x.id === msgId), p = m && state.projects.get(m.projectId);
  if (!p || !projectClosed(p)) return toast('Проект уже открыт.', true);
  if (!(await write(op.update('projects', p.id, { status: 'revision', archived: false }), `«${p.name}» снова в работе — «На доработке»`))) return;
  await api.cabinetRead([msgId]).catch(() => {});
  if (cab?.published?.[p.id]) await api.cabinetPublish(p.id).catch(() => {});
  renderCabinetBox();
}
async function cabAction(promise, okText) {
  const r = await promise;
  if (!r.ok) { toast(r.message, true); return null; }
  if (okText) toast(okText);
  return r;
}
async function cabPublish() {
  const id = state.drawer?.id;
  if (!id || !(await submitSimple(true))) return;
  await cabAction(api.cabinetPublish(id), 'Опубликовано в кабинете заказчика');
}
async function cabAdd() {
  const id = state.drawer?.id, name = $('#cab-name').value.trim(), login = $('#cab-login').value.trim();
  if (!name || !login) return toast('Укажите имя и логин заказчика.', true);
  if (!/^[a-zA-Z0-9._@-]{3,80}$/.test(login)) return toast('Логин — латиница, цифры, точка, дефис; от 3 знаков.', true);
  const r = await cabAction(api.cabinetCustomerCreate({ name, login, projectIds: [id] }));
  if (!r) return;
  cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  if (!cab.published[id]) toast('Доступ открыт. Не забудьте опубликовать проект — пока заказчик увидит пустой список.');
  await loadCabCustomers(true);
}
async function cabPatch(cid, patch, okText) {
  const r = await cabAction(api.cabinetCustomerUpdate(cid, patch), okText);
  if (r?.password) cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  if (r) await loadCabCustomers(true);
}
const cabCustomer = cid => (cabCustomers || []).find(c => c.id === cid);
async function cabMarkGot(mid) {
  const m = cab.messages.find(x => x.id === mid), r = m && state.draft?.requests.find(x => x.id === m.requestId);
  if (!r) return;
  r.done = true;
  const row = r.irdId && state.draft.ird.find(x => x.id === r.irdId);
  if (row) row.status = 'accepted';
  renderCustomer();
  await api.cabinetRead([mid]);
  toast(row ? `«${row.title}» — принято. Сохраните проект, и заказчик увидит «Принято».` : 'Запрос отмечен «получено» — сохраните проект, и он уйдёт со страницы заказчика.');
}
// The answer does not do: the row gets «Замечание» with the GIP's note, the request stays open for a new answer.
async function cabRemark(mid) {
  const m = cab.messages.find(x => x.id === mid), r = m && state.draft?.requests.find(x => x.id === m.requestId);
  const row = r && state.draft.ird.find(x => x.id === r.irdId);
  if (!row) return;
  const note = await askNote('Вернуть с замечанием', 'Что не так с документом? Заказчик увидит это в исходных данных и в запросе.', row.note || '');
  if (note === null) return;
  row.status = 'remark'; row.note = note; r.why = note || r.why;
  renderCustomer();
  await api.cabinetRead([mid]);
  toast('Замечание записано — сохраните проект, и заказчик увидит его.');
}
// Connection: a separate small dialog (the settings window re-renders on every click and would lose typed text).
function openCabinetSettings() {
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ctitle" novalidate><h2 id="ctitle">Кабинет заказчика</h2>
    <p class="hint">Адрес и ключ команды показывает сервер кабинета при запуске. Ключ хранится на этом компьютере в зашифрованном виде.</p>
    <div class="f"><label for="c-url">Адрес сервера</label><input id="c-url" value="${esc(cab?.url || '')}" placeholder="https://cabinet.example.ru или http://192.168.1.10:8080" maxlength="300"></div>
    <div class="f"><label for="c-key">Ключ команды</label><input id="c-key" type="password" autocomplete="off" placeholder="${cab?.hasKey ? 'сохранён — оставьте пустым, чтобы не менять' : 'длинная строка из окна сервера'}" maxlength="200"></div>
    ${cab?.lastSync ? `<p class="hint">Последняя связь: ${cabTime(cab.lastSync)}</p>` : ''}<p class="neg" id="c-err">${cab?.keyLost ? 'Ключ команды, сохранённый прошлой версией Пульта, не читается — введите его заново.' : ''}</p>
    <div class="modal-f"><button class="btn primary" type="submit">Проверить и сохранить</button>${cab?.configured ? '<button class="btn" type="button" data-m="off">Отключить</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelector('#c-url').focus();
  const save = async (url, key) => {
    const btn = root.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Проверяем…';
    const r = await api.cabinetConfigure({ url, key });
    btn.disabled = false; btn.textContent = 'Проверить и сохранить';
    if (!r.ok) { root.querySelector('#c-err').textContent = r.message; return; }
    close();
    cabCustomers = null; cabLoadErr = '';
    toast(r.off ? 'Кабинет заказчика отключён' : `Кабинет подключён: проектов ${r.projects}, заказчиков ${r.customers}`);
    renderCabinetBox();
  };
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'off') save('', '');
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); save(root.querySelector('#c-url').value.trim(), root.querySelector('#c-key').value.trim()); });
}

// Working documentation rows: chips toggle a suggested mark for a section; own rows; order.
const rdItem = id => (state.draft.composition.rd || []).find(x => x.id === id);
const rdNew = (pdId, mark = '', title = '') => ({ id: Composition.newId(), pdId, mark, title, on: true, code: '', tom: '', note: '', ownerId: '', contractorId: '', taskId: '' });
let confirmCompDel = null;
// Tech card as an in-app reference: the same model (techcard.js) the generator uses for assignments and waves.
const TC_SECS = [['stages', 'Этапы'], ['source', 'Исходные данные'], ['waves', 'Волны ПД'], ['bysec', 'Кто кому что'], ['assign', 'Задания смежникам'], ['rd', 'ПД → РД'], ['summary', 'Сводные разделы']];

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'cab-remark': ({ id }) => { cabRemark(id); },
  'cab-settings': () => { openCabinetSettings(); },
  'cab-local-start': ({ el }) => { el.disabled = true; el.textContent = 'Запускаем…'; api.cabinetLocalStart().then(r => { if (!r.ok) { toast(r.message, true); el.disabled = false; el.textContent = 'Запустить кабинет на этом компьютере'; return; } cabCustomers = null; cabLoadErr = ''; toast(`Кабинет запущен${r.lan[0] ? ` · адрес для заказчиков: ${r.lan[0]}` : ''}`); }); },
  'cab-local-stop': () => { api.cabinetLocalStop().then(r => { if (r.ok) { cabCustomers = null; toast('Кабинет на этом компьютере остановлен. Данные сохранены — при новом запуске всё вернётся.'); } }); },
  'cab-publish': () => { cabPublish(); },
  'cab-unpublish': () => { cabAction(api.cabinetUnpublish(state.drawer?.id), 'Снято с публикации: заказчик больше не видит проект'); },
  'cab-open': () => { api.cabinetOpen(state.drawer?.id); },
  'cab-add': () => { cabAdd(); },
  'cab-link': () => { const cid = $('#cab-other').value, c = cabCustomer(cid); if (c) cabPatch(cid, { projectIds: [...c.projectIds, state.drawer.id] }, `${c.name}: проект добавлен`); },
  'cab-unlink': ({ id }) => { const c = cabCustomer(id); if (c) cabPatch(id, { projectIds: c.projectIds.filter(x => x !== state.drawer.id) }, `${c.name} больше не видит проект`); },
  'cab-reset': ({ id }) => { cabPatch(id, { resetPassword: true }, 'Новый пароль создан, старый больше не действует'); },
  'cab-toggle': ({ id }) => { const c = cabCustomer(id); if (c) cabPatch(id, { disabled: !c.disabled }, c.disabled ? 'Вход открыт' : 'Вход закрыт'); },
  'cab-reload': () => { cabLoadErr = ''; cabCustomers = null; loadCabCustomers(true); },
  'cab-pw-hide': () => { cabPw = null; renderCabinetBox(); renderOrgCabinet(); },
  'cab-pw-copy': () => { if (cabPw) copyText(`Кабинет заказчика: ${cab.publicUrl || cab.url}\nЛогин: ${cabPw.login}\nПароль: ${cabPw.password}`).then(ok => toast(ok ? 'Скопировано — вставьте в письмо или мессенджер' : 'Не удалось скопировать', !ok)); },
  'cab-read': ({ id }) => { api.cabinetRead([id]); },
  'cab-reopen': ({ el, id }) => { el.disabled = true; cabReopen(id).finally(() => { el.disabled = false; }); },
  'cab-got': ({ id }) => { cabMarkGot(id); },
  'cab-read-all': () => { api.cabinetRead(cab.messages.filter(m => !m.read).map(m => m.id)); },
  'cab-open-msg': ({ id }) => { const m = cab.messages.find(x => x.id === id); if (m) { api.cabinetRead([id]); if (state.projects.has(m.projectId)) openProject(m.projectId, 'cust'); } },
});
/* ---------- project & contractor ---------- */
// The project's GIP: any GIP of the team; a project made before 4.1 may name someone else — kept in the list.
function gipOptions(sel) {
  const list = liveUsers().filter(u => u.role === 'gip' || u.id === sel).sort(byName);
  return `<option value="">— не назначен —</option>${list.map(u => `<option value="${esc(u.id)}"${u.id === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}`;
}
const projectGip = p => (p?.gipId && state.users.get(p.gipId)) || null;
function openProject(id, tab = 'main') {
  const p = id ? state.projects.get(id) : {};
  if (!p) return toast('Проект не найден.', true);
  state.drawer = { kind: 'project', id, tab: id ? tab : 'main' };
  state.draft = id ? projectDraft(p) : null;
  const n = id ? [...state.tasks.values()].filter(t => t.projectId === id).length : 0;
  const more = !!(p.folder || p.note);
  const ptab = state.drawer.tab;
  drawerShell({
    title: id ? `Проект · ${esc(p.name)}` : 'Новый проект',
    wide: !!id,
    body: `${id ? `<div class="dtabs" role="tablist">${[['main', 'Основное'], ['comp', 'Состав проекта: ПД и РД'], ['cust', 'Для заказчика']].map(([k, l]) => `<button class="dtab" role="tab" type="button" data-act="dtab" data-id="${k}" aria-selected="${k === ptab}">${l}</button>`).join('')}</div>` : ''}
    <div class="dpanel" data-panel="main"${ptab === 'main' ? '' : ' hidden'}><div class="fgrid">
      <div class="f wide"><label class="req" for="pr-name">Название объекта</label><input id="pr-name" name="name" value="${esc(p.name || '')}" placeholder="ЖК «Северный», корпус 2" maxlength="160"></div>
      <div class="f"><label for="pr-code">Шифр</label><input id="pr-code" name="code" value="${esc(p.code || '')}" placeholder="0425-24" maxlength="40"></div>
      ${customerField(p)}
      <div class="f"><label for="pr-gip">ГИП</label><select id="pr-gip" name="gipId">${gipOptions(id ? p.gipId : (A.isGip(state.me) ? state.me.id : ''))}</select></div>
      <div class="f wide"><span class="lbl-t">Инженерные изыскания</span><div class="seg sv-choice">
        <label class="chk"><input type="radio" name="surveys" value="customer"${p.surveys === 'ours' ? '' : ' checked'}> даёт заказчик — отчёты в «Сборе ИРД»</label>
        <label class="chk"><input type="radio" name="surveys" value="ours"${p.surveys === 'ours' ? ' checked' : ''}> делаем мы — отдельный блок «Инженерные изыскания»</label></div></div>
      <div class="f"><span class="lbl-t">Значок проекта</span><div class="icon-pick"><span id="pr-icon-box">${projIcon(p) ? imgIcon(p.icon, 'proj-ic big') : '<span class="hint">нет</span>'}</span>
        <input type="hidden" name="icon" value="${esc(ICON_OK(p.icon) ? p.icon : '')}"><button class="btn sm" type="button" data-act="proj-icon">Выбрать картинку…</button><button class="btn ghostbtn sm" type="button" data-act="proj-icon-clear"${ICON_OK(p.icon) ? '' : ' hidden'}>Убрать</button></div>
        <span class="hint">Видна на вкладке проекта, в списке и в чате проекта.</span></div>
      <div class="f"><label for="pr-status">Стадия проекта</label><select id="pr-status" name="status"><option value="">— не задана —</option>${Object.entries(L.PROJECT_STATUSES).map(([k, s]) => `<option value="${k}"${p.status === k ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
      ${id ? '' : '<label class="chk f wide gen-chk"><input type="checkbox" id="pr-gen" data-transient checked> Сразу открыть генератор состава: проектная документация по ПП РФ № 87 и рабочая документация</label>'}
      <details class="f wide more"${more ? ' open' : ''}><summary>Дополнительно: папка проекта, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="pr-folder">Папка проекта</label>
          <div class="row-in"><input id="pr-folder" name="folder" value="${esc(p.folder || '')}" placeholder="\\\\server\\Проекты\\0425-24 или D:\\Проекты\\…" maxlength="400">
            <button class="btn" data-act="pick-folder" type="button">Выбрать…</button></div>
          <span class="hint">Кнопка «Папка проекта» в списке откроет её в Проводнике; папки разделов предлагаются внутри неё.</span></div>
        <div class="f wide"><label for="pr-note">Примечание</label><textarea id="pr-note" name="note" maxlength="2000">${esc(p.note || '')}</textarea></div>
      </div></details>
    </div>
    ${id ? `<div class="sub"><h3>Состав проекта</h3><p class="hint">${p.composition ? `Проектная документация: томов ${Composition.volumes(p.composition, p.code || '').length} · рабочая документация: разделов ${Composition.rdRows(p.composition, p.code || '').length}.` : 'Ещё не сформирован. Генератор предложит разделы по ПП РФ № 87 и разделы рабочей документации к ним.'}</p>
      <div><button class="btn primary" type="button" data-act="dtab" data-id="comp">Открыть генератор состава (ПД и РД)</button></div></div>` : ''}
    ${id ? `<p class="hint">Карточек в проекте: ${n}.${p.archived ? ' Проект в архиве: его карточки не видны в сводке, загрузке и уведомлениях.' : ''}</p>` : ''}</div>
    ${id ? `<div class="dpanel" data-panel="comp"${ptab === 'comp' ? '' : ' hidden'}><div id="comp-box"></div></div>
    <div class="dpanel" data-panel="cust"${ptab === 'cust' ? '' : ' hidden'}><div id="cab-box"></div><div id="cust-box"></div></div>` : ''}
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id ? `<button class="btn" data-act="${p.archived ? 'unarchive' : 'archive'}" data-id="${esc(id)}" type="button">${p.archived ? 'Вернуть из архива' : 'В архив'}</button>
        <button class="btn danger" data-act="ask-delete" type="button">В корзину</button>` : ''}`,
  });
  if (id) { renderComposition(); renderCustomer(); renderCabinetBox(); if (cab?.configured) loadCabCustomers(true); $('#dform').classList.toggle('full', ptab === 'comp'); }
  customerHint();
  markClean();
  if (!id) $('#pr-name').focus();
}

// New person: the GIP chooses staff (gets a panel) or outside contractor (no panel). A chief adds contractors only.
function kindSwitch(current) {
  if (!A.isGip(state.me)) return '';
  const b = (k, label, sub) => `<button class="btn sm ${current === k ? 'on' : ''}" type="button" data-act="${k === 'staff' ? 'new-user' : 'new-contractor'}" aria-pressed="${current === k}">${label}<small>${sub}</small></button>`;
  return `<div class="seg kind-seg" role="group" aria-label="Кого добавить">${b('staff', 'Сотрудник', 'штатный, свой пульт в программе')}${b('outside', 'Подрядчик', 'внештатный, без доступа к программе')}</div>`;
}

function openContractor(id) {
  const c = id ? state.contractors.get(id) : {};
  if (!c) return toast('Исполнитель не найден.', true);
  noteRecent('contractor', id);
  state.drawer = { kind: 'contractor', id };
  drawerShell({
    title: id ? 'Подрядчик' : 'Новый подрядчик',
    body: `${id ? '' : kindSwitch('outside')}<div class="fgrid">
      <div class="f wide"><label class="req" for="c-name">ФИО или название</label><input id="c-name" name="name" value="${esc(c.name || '')}" placeholder="Петров Алексей Сергеевич" maxlength="160"></div>
      <div class="f wide"><label for="c-spec">Специализация (разделы)</label><input id="c-spec" name="specialty" value="${esc(c.specialty || '')}" placeholder="ЭОМ, ЭС, ЭН" maxlength="160">
        <span class="hint">Перечислите разделы через запятую — по ним подрядчик будет предлагаться в карточках.</span></div>
      <div class="f"><label for="c-phone">Телефон</label><input id="c-phone" name="phone" type="tel" value="${esc(c.phone || '')}" placeholder="+7 900 123-45-67" maxlength="40"></div>
      <div class="f"><label for="c-email">Почта</label><input id="c-email" name="email" type="email" value="${esc(c.email || '')}" maxlength="120"></div>
      <div class="f wide"><label for="c-msg">Мессенджер</label><input id="c-msg" name="messenger" value="${esc(c.messenger || '')}" placeholder="Telegram @petrov_eom" maxlength="120"></div>
      ${contractorOrgField(c)}
      <details class="f wide more"${c.requisites || c.note ? ' open' : ''}><summary>Дополнительно: реквизиты, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="c-req">Реквизиты</label><textarea id="c-req" name="requisites" maxlength="1000" placeholder="ИНН, р/с, банк — попадут в акт сверки">${esc(c.requisites || '')}</textarea></div>
        <div class="f wide"><label for="c-note">Примечание</label><textarea id="c-note" name="note" maxlength="2000" placeholder="Ставка, особенности">${esc(c.note || '')}</textarea></div>
      </div></details>
    </div>
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id ? '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>' : ''}`,
  });
  markClean();
  if (!id) $('#c-name').focus();
}

async function submitSimple(keepOpen = false) {
  const { kind, id } = state.drawer;
  if (kind === 'org') return submitOrg(keepOpen);
  formError('');
  const created = { createdAt: new Date().toISOString() };
  let ok = false;
  if (kind === 'project') {
    const data = { name: val('name'), code: val('code'), ...customerOf(id && state.projects.get(id), val('client')), gipId: state.users.has(val('gipId')) ? val('gipId') : '', status: L.PROJECT_STATUSES[val('status')] ? val('status') : '', folder: val('folder'), note: val('note'), icon: ICON_OK(val('icon')) ? val('icon') : '', surveys: $('#dform [name="surveys"]:checked')?.value === 'ours' ? 'ours' : 'customer' };
    if (!data.name) return formError('Укажите название объекта.', 'main', 'name');
    if (id) {
      if (projectDraftData().error) { const e = projectDraftData(); return formError(e.error, e.tab); }
      // Every section of the composition is a task: missing ones are made (or linked) in the same batch.
      const made = compTaskOps(state.draft.composition, id, data.code);
      const extra = projectDraftData();
      const parts = [made.created ? `задач по разделам: ${made.created}` : '', made.linked ? `привязано карточек: ${made.linked}` : '', made.assigns ? `заданий смежникам: ${made.assigns}` : ''].filter(Boolean);
      const wasCustomer = state.projects.get(id)?.customerId || '';
      ok = await write([...made.ops, op.update('projects', id, { ...data, ...extra.data })], parts.length ? `Проект сохранён: ${parts.join(', ')}` : 'Проект сохранён');
      // A project moved to another customer: the logins of both customers' contact people follow.
      if (ok && wasCustomer !== data.customerId) for (const oid of [wasCustomer, data.customerId]) if (oid) syncOrgCabinet(oid);
    }
    else {
      const pid = newId(), gen = !!$('#pr-gen')?.checked;
      ok = await write(op.set('projects', pid, { ...data, ...created }), 'Проект добавлен');
      if (ok && data.customerId) syncOrgCabinet(data.customerId);
      if (ok) {
        // The timeline first: the generator then dates sections and assignments from it.
        closeDrawer();
        await refresh();
        if (state.projects.get(pid)) { await askTimeline(state.projects.get(pid)); await refresh(); }
        if (gen) openProject(pid, 'comp'); // straight to the composition generator
        return ok;
      }
    }
  } else if (kind === 'contractor') {
    const data = { name: val('name'), specialty: val('specialty'), phone: val('phone'), email: val('email'), messenger: val('messenger'), requisites: val('requisites'), note: val('note'), orgId: contractorOrgPicked() };
    if (!data.name) return formError('Укажите ФИО или название исполнителя.', '', 'name');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
    ok = id ? await write(op.update('contractors', id, data), 'Исполнитель сохранён')
      : await write(op.set('contractors', newId(), { ...data, ...created, createdBy: state.me?.id || '' }), 'Исполнитель добавлен');
  }
  if (ok && keepOpen && kind === 'project' && id) { await refresh(); state.draft = projectDraft(state.projects.get(id)); markClean(); return ok; }
  if (ok) closeDrawer();
  return ok;
}

/* ---------- delete → trash ---------- */
function askDelete() {
  const { kind, id } = state.drawer;
  let text, blocked = false;
  if (kind === 'task') text = 'Переместить карточку в корзину? Её можно будет восстановить в течение 30 дней.';
  else if (kind === 'project') {
    const n = [...state.tasks.values()].filter(t => t.projectId === id).length;
    text = n ? `Переместить проект и его карточки (${n}) в корзину? Восстановить можно в течение 30 дней.` : 'Переместить проект в корзину?';
  } else if (kind === 'org') {
    if ((state.orgs.get(id)?.contacts || []).some(k => k.cabinetId && cabCustomer(k.cabinetId) && !cabCustomer(k.cabinetId).disabled)) { blocked = true; text = 'У контактных лиц организации открыт вход в кабинет заказчика. Сначала закройте вход (в карточке, «Кабинет заказчика»).'; }
  } else if (kind === 'user') {
    const n = [...state.tasks.values()].filter(t => hasOwner(t, id)).length;
    const subs = usersByRole('specialist').filter(u => u.chiefId === id).length;
    if (n || subs) { blocked = true; text = n ? `На сотруднике карточек: ${n}. Сначала передайте их другому ответственному.` : `У главспеца специалистов: ${subs}. Сначала переведите их к другому главспецу.`; }
    else text = 'Удалить сотрудника из команды?';
  } else {
    const n = [...state.tasks.values()].filter(t => t.contractorId === id).length;
    if (n) { blocked = true; text = `На подрядчике карточек: ${n}. Сначала переназначьте их или снимите исполнителя.`; }
    else text = 'Переместить исполнителя в корзину?';
  }
  // 46: the trash can be undone (10 s plate, Ctrl+Z, the trash itself) — no «are you sure?» before it.
  // Only a removal that cannot happen yet is explained here.
  if (!blocked) return doDelete();
  $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm">${esc(text)}
    <span class="confirm-acts"><button class="btn sm" data-act="cancel-delete" type="button">Понятно</button></span></div></div>`;
}
async function doDelete() {
  const { kind, id } = state.drawer;
  const at = new Date().toISOString();
  let ops;
  if (kind === 'task') ops = [op.update('tasks', id, { deletedAt: at })];
  else if (kind === 'project') {
    ops = [...state.tasks.values()].filter(t => t.projectId === id).map(t => op.update('tasks', t.id, { deletedAt: at, deletedWith: id }));
    ops.push(op.update('projects', id, { deletedAt: at }));
  } else if (kind === 'user') ops = [op.update('users', id, { deletedAt: at })];
  else if (kind === 'org') ops = [op.update('orgs', id, { deletedAt: at })];
  else ops = [op.update('contractors', id, { deletedAt: at })];
  const what = kind === 'task' ? 'Карточка' : kind === 'project' ? 'Проект' : kind === 'user' ? 'Сотрудник' : kind === 'org' ? 'Контрагент' : 'Исполнитель';
  if (await write(ops, null, { undoLabel: `${what} — в корзину` })) {
    closeDrawer();
    toast(kind === 'user' ? 'Сотрудник удалён из команды' : `${what}${kind === 'project' && ops.length > 1 ? ` и карточки (${ops.length - 1})` : ''} — в корзине`, false, { label: 'Отменить', run: () => restoreItem(kind === 'task' ? 'tasks' : kind + 's', id) });
  }
}

function trashLeft(at) { return Math.max(0, TRASH_DAYS - Math.floor((Date.now() - Date.parse(at)) / 864e5)); }
function openTrash() {
  state.drawer = { kind: 'trash' };
  drawerShell({ title: 'Корзина', body: '<div id="trash-box"></div>', form: false });
  renderTrash();
}
function renderTrash() {
  const box = $('#trash-box');
  if (!box) return;
  const item = (col, x, title, sub) => `<div class="tr-row">
    <div class="tr-main"><b>${title}</b><span class="hint">${sub} · удалено ${fmtDate(String(x.deletedAt).slice(0, 10))} · исчезнет через ${trashLeft(x.deletedAt)} дн.</span></div>
    <button class="btn sm" data-act="restore" data-col="${col}" data-id="${esc(x.id)}" type="button">Восстановить</button>
    <button class="btn ghostbtn sm danger" data-act="purge" data-col="${col}" data-id="${esc(x.id)}" type="button">Удалить навсегда</button>
  </div>`;
  const projs = state.trash.projects.map(p => item('projects', p, esc(p.name), `проект${p.code ? ' ' + esc(p.code) : ''}, карточек: ${state.trash.tasks.filter(t => t.deletedWith === p.id).length}`));
  const people = state.trash.contractors.map(c => item('contractors', c, esc(c.name), 'исполнитель'))
    .concat(state.trash.orgs.map(o => item('orgs', o, esc(o.name), `контрагент${A.orgRoles(o).length ? ' · ' + A.orgRoles(o).map(r => A.ORG_ROLES[r].toLowerCase()).join(', ') : ''}`)));
  const cards = state.trash.tasks.filter(t => !t.deletedWith).map(t => item('tasks', t, esc(marksText(t)), `карточка · ${esc(state.projects.get(t.projectId)?.name || 'проект удалён')}`));
  const all = [...projs, ...people, ...cards];
  box.innerHTML = all.length ? `<p class="hint">Удалённое хранится ${TRASH_DAYS} дней, затем стирается при запуске программы.</p><div class="tr-list">${all.join('')}</div>`
    : '<div class="none">Корзина пуста.</div>';
}
async function restoreItem(col, id) {
  const clear = { deletedAt: null, deletedWith: null };
  const ops = [op.update(col, id, clear)];
  if (col === 'projects') {
    for (const t of state.trash.tasks) if (t.deletedWith === id) ops.push(op.update('tasks', t.id, clear));
  }
  if (col === 'tasks') {
    // A card whose project is also in the trash would stay hidden: bring the project back too.
    const t = state.trash.tasks.find(x => x.id === id) || state.tasks.get(id);
    const p = t && state.trash.projects.find(x => x.id === t.projectId);
    if (p) ops.push(op.update('projects', p.id, clear));
  }
  await write(ops, 'Восстановлено');
}
async function purgeItem(col, id, btn) {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Точно удалить?'; return; }
  const ops = [op.del(col, id)];
  if (col === 'projects') for (const t of state.trash.tasks) if (t.deletedWith === id) ops.push(op.del('tasks', t.id));
  await write(ops, 'Удалено навсегда');
}

/* ---------- payments (saved immediately) ---------- */
async function addPayment() {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  const date = $('#p-date').value, amount = parseMoney($('#p-amount').value), note = $('#p-note').value.trim();
  if (!isDate(date)) return toast('Укажите дату платежа.', true);
  if (Number.isNaN(amount) || amount <= 0) return toast('Сумма платежа должна быть больше нуля.', true);
  const payments = [...(t.payments || []), { id: newId(), date, amount, note }];
  if (await write(op.update('tasks', t.id, { payments }), 'Платёж внесён')) { $('#p-amount').value = ''; $('#p-note').value = ''; }
}
async function delPayment(pid) {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  await write(op.update('tasks', t.id, { payments: (t.payments || []).filter(p => p.id !== pid) }), 'Платёж удалён');
}

/* ---------- archive & folders ---------- */
async function setArchived(id, on) {
  if (await write(op.update('projects', id, { archived: on }), on ? 'Проект перенесён в архив' : 'Проект возвращён из архива')) {
    if (state.drawer?.kind === 'project') closeDrawer();
  }
}
async function openFolder(id) {
  const res = await api.openProjectFolder(id);
  if (!res.ok) toast(res.message, true);
}
async function pickFolder() {
  const res = await api.pickFolder(val('folder'));
  if (res?.path) $('#pr-folder').value = res.path;
}

// «Удалить все проекты» (GIP): every project with its cards goes to the trash in one batch.
async function deleteAllProjects() {
  setFileMenu(false);
  const list = [...state.projects.values()];
  if (!list.length) return toast('Проектов нет');
  const n = [...state.tasks.values()].filter(t => state.projects.has(t.projectId)).length;
  const sure = await confirmBox(`Переместить в корзину все проекты (${list.length}) и их карточки (${n})? 30 дней их можно восстановить из корзины.`, 'Удалить все');
  if (!sure) return;
  const at = new Date().toISOString(), ops = [];
  for (const p of list) {
    for (const t of state.tasks.values()) if (t.projectId === p.id) ops.push(op.update('tasks', t.id, { deletedAt: at, deletedWith: p.id }));
    ops.push(op.update('projects', p.id, { deletedAt: at }));
  }
  state.openProjectId = null;
  await write(ops, `В корзину: проектов ${list.length}, карточек ${n}`);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'delete-all-projects': () => { deleteAllProjects(); },
  'open-project-cust': ({ id }) => { openProject(id, 'cust'); },
  'open-project': ({ id }) => { openProject(id); },
  'open-project-tab': ({ el, id }) => { openProject(id, el.dataset.tab); },
  'new-project': () => { setCreateMenu(false); openProject(null); },
  'open-contractor': ({ id }) => { openContractor(id); },
  'new-contractor': () => { setCreateMenu(false); openContractor(null); },
  'archive': ({ id }) => { setArchived(id, true); },
  'unarchive': ({ id }) => { setArchived(id, false); },
  'open-folder': ({ id }) => { openFolder(id); },
  'pick-folder': () => { pickFolder(); },
  'ask-delete': () => { askDelete(); },
  'do-delete': ({ el }) => { el.disabled = true; doDelete(); },
  'add-payment': () => { addPayment(); },
  'del-payment': ({ el }) => { delPayment(el.dataset.pid); },
  'restore': ({ el, id }) => { restoreItem(el.dataset.col, id); },
  'purge': ({ el, id }) => { purgeItem(el.dataset.col, id, el); },
});
/* ---------- file menu: reports & import ---------- */
function setFileMenu(open) {
  const menu = $('#file-menu');
  if (open) {
    const opt = (v, l) => `<option value="${esc(v)}"${state.reportScope === v ? ' selected' : ''}>${esc(l)}</option>`;
    $('#rep-scope').innerHTML = opt('all', 'Все активные проекты')
      + (liveProjects().length ? `<optgroup label="Проект">${liveProjects().map(p => opt('p:' + p.id, p.name)).join('')}</optgroup>` : '')
      + (contractorsArr().length ? `<optgroup label="Подрядчик">${contractorsArr().map(c => opt('c:' + c.id, c.name)).join('')}</optgroup>` : '')
      + (staffArr().length ? `<optgroup label="Сотрудник (что сдал, в срок ли, замечания)">${staffArr().map(u => opt('u:' + u.id, u.name)).join('')}</optgroup>` : '');
    if (!$('#rep-scope').value) { state.reportScope = 'all'; $('#rep-scope').value = 'all'; }
    updateScopeLabels();
    const trashN = state.trash.projects.length + state.trash.contractors.length + state.trash.tasks.filter(t => !t.deletedWith).length;
    $('#mi-trash').textContent = trashN ? `Корзина (${trashN})` : 'Корзина';
  }
  menu.hidden = !open;
  $('#btn-file').setAttribute('aria-expanded', String(open));
  if (open) $('#rep-scope').focus();
}
function updateScopeLabels() {
  const c = state.reportScope.startsWith('c:'), u = state.reportScope.startsWith('u:'), pr = state.reportScope.startsWith('p:');
  $('#mi-msproject')?.classList.toggle('dim', !pr);
  const mc = $('#mi-customer');
  if (mc) { mc.classList.toggle('dim', !pr); $('#cust-sub').textContent = pr ? `«${state.projects.get(state.reportScope.slice(2))?.name || ''}»: веб-страница — этап, план, «нужно от вас», разделы. Данные — в проекте, вкладка «Для заказчика»` : 'Выберите проект в списке «Отчёт по». Данные для неё — в проекте, вкладка «Для заказчика»'; }
  $('#rep-period-wrap').hidden = !u;
  if (u) {
    $('#word-title').textContent = 'Отчёт по сотруднику (Word)';
    $('#word-sub').textContent = 'Что сдано за период, в срок или нет, сколько было замечаний, что сейчас в работе';
    return;
  }
  $('#word-title').textContent = c ? 'Акт сверки (Word)' : 'Word';
  $('#word-sub').textContent = c ? 'Карточки подрядчика, начисления и платежи, итог взаиморасчётов, места для подписей'
    : 'Отчёт для печати: что требует внимания, таблицы по проектам и исполнителям';
}
function scopeObj() {
  const s = state.reportScope;
  if (s.startsWith('u:')) return { type: 'user', id: s.slice(2), period: $('#rep-period')?.value || 'quarter' };
  return s.startsWith('p:') ? { type: 'project', id: s.slice(2) } : s.startsWith('c:') ? { type: 'contractor', id: s.slice(2) } : { type: 'all' };
}
async function exportReport(format) {
  setFileMenu(false);
  const btn = $('#btn-file');
  btn.disabled = true;
  try {
    const res = await api.exportReport(format, scopeObj());
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) {
    toast('Не удалось выгрузить отчёт: ' + (e?.message || e), true);
  } finally {
    btn.disabled = false;
  }
}

async function msProjectExport() {
  if (!state.reportScope.startsWith('p:')) { toast('Сначала выберите проект в списке «Отчёт по».', true); $('#rep-scope')?.focus(); return; }
  if (!api.exportMsProject) return toast('Выгрузка в MS Project — в Пульте на компьютере.', true);
  setFileMenu(false);
  try {
    const res = await api.exportMsProject(state.reportScope.slice(2));
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name} — откройте в MS Project: «Файл → Открыть», тип файла XML`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) { toast('Не удалось выгрузить: ' + (e?.message || e), true); }
}

async function customerPdf() {
  if (!state.reportScope.startsWith('p:')) { toast('Сначала выберите проект в списке «Отчёт по».', true); $('#rep-scope')?.focus(); return; }
  setFileMenu(false);
  try {
    const res = await api.customerPage(state.reportScope.slice(2), { format: 'html', font: brandFont });
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) { toast('Не удалось сохранить страницу: ' + (e?.message || e), true); }
}
const IMPORT_FIELDS = window.Importer.FIELDS;
async function startImport() {
  setFileMenu(false);
  let res;
  try { res = await api.importPick(); }
  catch (e) { return toast('Не удалось открыть файл: ' + (e?.message || e), true); }
  if (!res || res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  const sheets = res.sheets.filter(s => s.rows.length);
  if (!sheets.length) return toast('В файле нет данных.', true);
  // Prefer the sheet whose header is recognised best (our own export has «Карточки»).
  const scored = sheets.map((s, i) => ({ i, d: window.Importer.detect(s.rows) })).sort((a, b) => b.d.score - a.d.score);
  const best = scored[0];
  state.importData = { name: res.name, sheets, sheet: best.i, headerRow: best.d.headerRow, mapping: best.d.mapping };
  openImport();
}
function importPreview() {
  const d = state.importData;
  const rows = d.sheets[d.sheet].rows;
  return window.Importer.build(rows, d.headerRow, d.mapping, {
    projects: [...state.projects.values()], contractors: [...state.contractors.values()], today: todayStr(),
  });
}
function openImport() {
  const d = state.importData;
  state.drawer = { kind: 'import' };
  const rows = d.sheets[d.sheet].rows;
  const header = rows[d.headerRow] || [];
  const colOpts = sel => `<option value="-1">— нет —</option>` + header.map((h, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(String(h || `Столбец ${i + 1}`))}</option>`).join('');
  drawerShell({
    title: 'Импорт из таблицы',
    wide: true,
    body: `<p class="hint">Файл: <b>${esc(d.name)}</b>. Одна строка таблицы — одна карточка. Проекты и подрядчики с совпадающими названиями будут связаны с уже существующими.</p>
      <div class="fgrid">
        ${d.sheets.length > 1 ? `<div class="f"><label for="im-sheet">Лист</label><select id="im-sheet" data-transient>${d.sheets.map((s, i) => `<option value="${i}"${i === d.sheet ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>` : ''}
        <div class="f"><label for="im-header">Строка с заголовками</label><select id="im-header" data-transient>${rows.slice(0, 15).map((r, i) => `<option value="${i}"${i === d.headerRow ? ' selected' : ''}>${i + 1}: ${esc(r.filter(v => v !== '' && v != null).slice(0, 4).join(' | ').slice(0, 60))}</option>`).join('')}</select></div>
      </div>
      <div class="sub"><h3>Какой столбец что означает</h3>
        <div class="map-grid">${IMPORT_FIELDS.map(f => `<label class="f"><span class="${f.required ? 'req' : ''}">${esc(f.label)}</span><select data-map="${f.key}" data-transient>${colOpts(d.mapping[f.key] ?? -1)}</select></label>`).join('')}</div>
      </div>
      <div class="sub" id="im-preview"></div>`,
    footer: `<button class="btn primary" data-act="do-import" type="button" id="im-go">Импортировать</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>`,
    form: false,
  });
  renderImportPreview();
}
function renderImportPreview() {
  const box = $('#im-preview');
  if (!box) return;
  const r = importPreview();
  const sample = r.tasks.slice(0, 8);
  box.innerHTML = `<h3>Что будет добавлено</h3>
    <div class="kv"><div><span class="k">Карточек</span><span class="v">${r.tasks.length}</span></div>
      <div><span class="k">Новых проектов</span><span class="v">${r.projects.length}</span></div>
      <div><span class="k">Новых подрядчиков</span><span class="v">${r.contractors.length}</span></div>
      <div><span class="k">Пропущено строк</span><span class="v ${r.skipped.length ? 'warnv' : ''}">${r.skipped.length}</span></div></div>
    ${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}
    ${sample.length ? `<div class="tablewrap"><table class="mini"><thead><tr><th>Проект</th><th>Разделы</th><th>Подрядчик</th><th>Старт</th><th>Финиш</th><th>Статус</th><th class="r">Бюджет</th><th class="r">Оплачено</th></tr></thead><tbody>
      ${sample.map(t => `<tr><td>${esc(r.projectName(t.projectId))}</td><td>${esc(t.sections.join(', '))}</td><td>${esc(r.contractorName(t.contractorId) || '—')}</td>
        <td class="num">${fmtDate(t.start)}</td><td class="num">${fmtDate(t.finish)}</td><td>${esc(STATUSES[t.status].label)}</td>
        <td class="r num">${money(t.budget)}</td><td class="r num">${money(paidOf(t))}</td></tr>`).join('')}</tbody></table></div>
      ${r.tasks.length > sample.length ? `<div class="hint">…и ещё ${r.tasks.length - sample.length}</div>` : ''}` : ''}
    ${r.skipped.length ? `<details><summary class="hint">Почему пропущены строки</summary><ul class="hint">${r.skipped.slice(0, 20).map(s => `<li>строка ${s.row}: ${esc(s.reason)}</li>`).join('')}</ul></details>` : ''}`;
  $('#im-go').disabled = !!r.error || !r.tasks.length;
}
async function doImport() {
  const r = importPreview();
  if (r.error || !r.tasks.length) return;
  const now = new Date().toISOString();
  const ops = [
    ...r.projects.map(p => op.set('projects', p.id, { ...p, createdAt: now, imported: true })),
    ...r.contractors.map(c => op.set('contractors', c.id, { ...c, createdAt: now, imported: true })),
    ...r.tasks.map(t => op.set('tasks', t.id, { ...t, createdAt: now, imported: true,
      history: [{ ts: now, date: todayStr(), type: 'status', from: null, to: t.status, note: 'импорт из таблицы' }] })),
  ];
  if (await write(ops, `Импортировано карточек: ${r.tasks.length}`)) { closeDrawer(); state.tab = 'projects'; renderNow(); }
}

/* ---------- «Вид»: theme, interface scale, window position ---------- */
const THEMES = [['system', 'Как в Windows'], ['light', 'Светлая'], ['dark', 'Тёмная'], ['graphite', 'Графит'], ['tandem', 'Тандем']];
// Brand font of the «Тандем» theme and of the customer page: Golos Text or Montserrat.
let brandFont = loadLocal('brandFont', 'golos') === 'montserrat' ? 'montserrat' : 'golos';
function applyBrandFont() { document.documentElement.dataset.font = brandFont; }
applyBrandFont();
const LEVELS = [['top', 'Поверх всех окон', 'Окно всегда видно поверх других программ'],
  ['normal', 'Обычное окно', 'Ведёт себя как любая программа'],
  ['desktop', 'На рабочем столе', 'Окно лежит под всеми программами, как виджет; кнопки на панели задач нет — открывается значком в трее']];
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
function renderViewMenu() {
  $('#view-menu-body').innerHTML = viewSectionsHtml(false) + `<div class="vm-sec"><button class="btn sm" type="button" data-act="settings" data-sec="">Все настройки…</button></div>`;
  if (document.querySelector('.settings-modal')) renderSettings();
}
// 4.10 (69): «Т из Ганта» in the colours the user picked — the same drawing as tools/make-icons.js.
const APP_ICON_VARIANTS = [1, 3, 4, 6, 8];
function appIconSvg(n) {
  const O = '#F26A1F', W = '#FFFFFF', G = '#2F3033';
  const [t, c, s] = { 1: [O, W, W], 3: [O, W, G], 4: [W, O, O], 6: [W, O, G], 8: [G, W, W] }[n] || [O, W, W];
  const tile = t === W ? `<rect x="1" y="1" width="62" height="62" rx="13" fill="${W}" stroke="#E2D6CC" stroke-width="2"/>` : `<rect width="64" height="64" rx="14" fill="${t}"/>`;
  return `<svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">${tile}<rect x="12" y="14" width="40" height="9" rx="2" fill="${c}"/><rect x="25" y="27" width="12" height="7" rx="2" fill="${s}"/><rect x="29" y="38" width="12" height="7" rx="2" fill="${s}" opacity=".85"/><rect x="25" y="49" width="12" height="5" rx="2" fill="${s}" opacity=".7"/></svg>`;
}
// `full`: everything (the «Настройки» window); otherwise only theme and zoom (the quick menu in the title bar).
function viewSectionsHtml(full) {
  const w = state.win, zoom = w.zoom || 1;
  const theme = `
    <div class="vm-sec"><span class="vm-h">Тема</span><div class="seg wrap">${THEMES.map(([k, l]) => `<button class="btn sm ${w.theme === k ? 'on' : ''}" type="button" data-act="set-theme" data-v="${k}">${l}</button>`).join('')}</div></div>
    ${w.theme === 'tandem' ? `<div class="vm-sec"><span class="vm-h">Шрифт темы «Тандем» и страницы заказчика</span><div class="seg"><button class="btn sm ${brandFont === 'golos' ? 'on' : ''}" type="button" data-act="set-font" data-v="golos">Golos</button><button class="btn sm ${brandFont === 'montserrat' ? 'on' : ''}" type="button" data-act="set-font" data-v="montserrat" style="font-family:Montserrat">Montserrat</button></div></div>` : ''}
`;
  const zoomHtml = `
    <div class="vm-sec"><span class="vm-h">Масштаб интерфейса</span>
      <div class="vm-zoom"><button class="btn sm" type="button" data-act="zoom-step" data-dir="-1" title="Ctrl + −" ${zoom <= ZOOM_STEPS[0] ? 'disabled' : ''}>−</button>
        <b class="num">${Math.round(zoom * 100)}%</b>
        <button class="btn sm" type="button" data-act="zoom-step" data-dir="1" title="Ctrl + =" ${zoom >= ZOOM_STEPS.at(-1) ? 'disabled' : ''}>+</button>
        <button class="btn ghostbtn sm" type="button" data-act="zoom-step" data-dir="0" title="Ctrl + 0">Сбросить</button></div></div>
    <div class="vm-sec"><span class="vm-h">Анимации</span><div class="seg"><button class="btn sm ${anim ? 'on' : ''}" type="button" data-act="set-anim" data-v="1">Включены</button><button class="btn sm ${anim ? '' : 'on'}" type="button" data-act="set-anim" data-v="0">Выключены</button></div></div>`;
  const densHtml = `<div class="vm-sec"><span class="vm-h">Плотность интерфейса</span><div class="seg"><button class="btn sm ${dense ? '' : 'on'}" type="button" data-act="set-dense" data-v="0">Удобно</button><button class="btn sm ${dense ? 'on' : ''}" type="button" data-act="set-dense" data-v="1">Компактно</button></div><span class="hint">Компактно — мельче шрифт, плотнее строки, кнопки и отступы: больше помещается на экране.</span></div>`;
  // 32 (Windows): Mica / acrylic behind the window instead of the own translucency. 37: keep a side of the screen.
  const BACKDROP_L = { none: 'Своя прозрачность', mica: 'Mica', acrylic: 'Акрил' };
  const backHtml = (w.backdrops || []).length > 1 ? `<div class="vm-sec"><span class="vm-h">Фон окна</span><div class="seg">${w.backdrops.map(k => `<button class="btn sm ${w.backdrop === k ? 'on' : ''}" type="button" data-act="set-backdrop" data-v="${k}">${BACKDROP_L[k]}</button>`).join('')}</div>
    <span class="hint">${w.backdrop && w.backdrop !== 'none' ? 'Фон Windows под окном: размытые обои, цвет темы Windows. Ползунок прозрачности в этом режиме не нужен.' : (w.win11 ? 'Mica — фон Windows 11, как у Проводника и Параметров; акрил — сильнее размытие.' : 'Акрил — размытый фон Windows под окном.')}</span></div>` : '';
  const dockHtml = w.dock ? `<div class="vm-sec"><span class="vm-h">Край экрана</span><div class="seg">${[['off', 'Нет'], ['left', 'Слева'], ['right', 'Справа']].map(([k, l]) => `<button class="btn sm ${w.dock === k ? 'on' : ''}" type="button" data-act="set-dock" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="chk vm-mini"><input type="checkbox" data-act="set-dock-auto"${w.dockAuto ? ' checked' : ''}> Прятать за край, когда мышь уходит</label>
    <span class="hint">${w.dockAuto ? 'Окно уезжает за край, остаётся тонкая рыжая полоска — коснитесь её мышью, и Пульт выедет. Пока вы печатаете в нём, он не прячется. Место на экране не занимает.' : 'Пульт стоит у края во всю высоту, как панель задач: развёрнутые окна других программ не заходят под него. Ширина — нынешняя ширина окна.'}</span></div>` : '';
  // 4.10 (69): the icon of the window, the taskbar button and the tray. The installer and shortcuts keep №1.
  const iconHtml = w.appIcon ? `<div class="vm-sec"><span class="vm-h">Значок</span><div class="app-icons">${APP_ICON_VARIANTS.map(n => `<button class="app-ic ${w.appIcon === n ? 'on' : ''}" type="button" data-act="set-app-icon" data-v="${n}" title="Значок №${n}${n === 1 ? ' — основной' : ''}" aria-pressed="${w.appIcon === n}">${appIconSvg(n)}</button>`).join('')}</div>
    <span class="hint">Меняет значок окна, кнопки на панели задач и у часов. Ярлык и установщик остаются с основным (первым).</span></div>` : '';
  if (!full) return theme + backHtml + zoomHtml + densHtml;
  return theme + backHtml + zoomHtml + densHtml + dockHtml + iconHtml + `
    <div class="vm-sec"><span class="vm-h">Панель вкладок</span><div class="seg">${NAV_POS.map(([k, l]) => `<button class="btn sm ${nav.pos === k ? 'on' : ''}" type="button" data-act="nav-pos" data-v="${k}">${l}</button>`).join('')}</div>
      ${nav.pos === 'left' ? `<label class="chk vm-mini"><input type="checkbox" data-act="nav-mini-chk"${nav.mini ? ' checked' : ''}> Только значки</label>` : ''}</div>
    <div class="vm-sec"><span class="vm-h">Положение окна</span>
      ${LEVELS.map(([k, l, d]) => `<label class="vm-level ${k === 'desktop' && w.desktopSupported === false ? 'off' : ''}"><input type="radio" name="vm-level" value="${k}" ${w.level === k ? 'checked' : ''} ${k === 'desktop' && w.desktopSupported === false ? 'disabled' : ''}>
        <span><b>${l}</b><small>${k === 'desktop' && w.desktopSupported === false ? 'Недоступно в этой системе' : d}</small></span></label>`).join('')}</div>`;
}
function setViewMenu(open) {
  if (open) renderViewMenu();
  $('#view-menu').hidden = !open;
  $('#btn-view').setAttribute('aria-expanded', String(open));
}
function stepZoom(dir) {
  const cur = state.win.zoom || 1;
  let next = 1;
  if (dir > 0) next = ZOOM_STEPS.find(z => z > cur + 0.001) ?? ZOOM_STEPS.at(-1);
  if (dir < 0) next = [...ZOOM_STEPS].reverse().find(z => z < cur - 0.001) ?? ZOOM_STEPS[0];
  api.setZoom(next);
  toast(`Масштаб ${Math.round(next * 100)}%`);
}

/* ---------- action journal ---------- */
const JOURNAL_PERIODS = [['1', 'Сегодня'], ['7', 'Неделя'], ['31', 'Месяц'], ['all', 'Всё время']];
const JOURNAL_TYPES = [['all', 'Всё'], ['tasks', 'Карточки'], ['payments', 'Оплаты'], ['dates', 'Сроки'], ['projects', 'Проекты'], ['contractors', 'Исполнители']];
const KIND_LABEL = { create: 'создано', update: 'изменено', trash: 'в корзину', restore: 'восстановлено', delete: 'удалено навсегда', 'restore-backup': 'восстановление' };

async function autoBackupMenu() {
  setFileMenu(false);
  const cur = await api.autoBackupGet();
  if (cur.dir) {
    const off = await confirmBox(`Автокопия сохраняется раз в день в «${cur.dir}»${cur.last ? `, последняя — ${fmtDate(cur.last)}` : ''}${cur.error ? `. Последняя попытка не удалась: ${cur.error}` : ''}. Выключить или выбрать другую папку?`, 'Выключить', 'Другая папка…');
    if (off === null) return;
    if (off) { await api.autoBackupSet(true); return toast('Автокопия выключена'); }
  }
  const r = await api.autoBackupSet(false);
  if (r.canceled) return;
  toast(r.ok ? `Автокопия включена: ${r.dir}. Первая копия уже сохранена, дальше — раз в день, хранятся 14 последних.` : r.message, !r.ok);
}
async function backupSave() {
  setFileMenu(false);
  const res = await api.backupSave();
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Копия сохранена: ${res.name} (карточек ${res.counts.tasks}, проектов ${res.counts.projects}, подрядчиков ${res.counts.contractors})`);
}
async function backupRestore() {
  setFileMenu(false);
  const res = await api.backupRestore();
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  undoStack.length = 0; // earlier undo steps refer to the replaced data
  closeDrawer();
  await refresh();
  toast(`Данные восстановлены из копии: записей ${res.count}. Прежние данные сохранены в папке backups.`);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'file-menu': () => { setFileMenu($('#file-menu').hidden); },
  'customer-pdf': () => { customerPdf(); },
  'autobackup': () => { autoBackupMenu(); },
  'set-font': ({ el }) => { brandFont = el.dataset.v === 'montserrat' ? 'montserrat' : 'golos'; saveLocal('brandFont', brandFont); applyBrandFont(); renderViewMenu(); if (document.querySelector('.settings-modal')) renderSettings(); },
  'export': ({ el }) => { exportReport(el.dataset.format); },
  'ms-project': () => { msProjectExport(); },
  'set-dock-auto': ({ el }) => { api.setDockAuto?.(el.checked); },
  'set-app-icon': ({ el }) => { api.setAppIcon?.(Number(el.dataset.v)).then(ok => { if (ok === false) toast('Не удалось сменить значок.', true); }); },
  'import': () => { startImport(); },
  'backup-save': () => { backupSave(); },
  'backup-restore': () => { backupRestore(); },
  'view-menu': () => { setViewMenu($('#view-menu').hidden); },
  'weekly': () => { setFileMenu(false); openWeekly(); },
  'usage': () => { setFileMenu(false); openUsage(); },
  'help': () => { setFileMenu(false); openHelp(); },
  'set-dense': ({ el }) => { dense = el.dataset.v === '1'; saveLocal('dense', dense); applyDense(); renderViewMenu(); },
  'set-anim': ({ el }) => { anim = el.dataset.v === '1'; saveLocal('anim', anim); applyAnim(); renderViewMenu(); },
  'zoom-step': ({ el }) => { stepZoom(Number(el.dataset.dir)); },
  'open-trash': () => { setFileMenu(false); openTrash(); },
  'do-import': ({ el }) => { el.disabled = true; doImport().finally(() => { el.disabled = false; }); },
  'open-data-folder': () => { setFileMenu(false); api.openDataFolder(); },
});
async function openJournal() {
  setFileMenu(false);
  state.drawer = { kind: 'journal' };
  state.journal = state.journal || { period: '7', type: 'all', q: '', entries: [] };
  drawerShell({ title: 'Журнал действий', wide: true, form: false, body: '<div id="jr-box"><div class="hint">Загружаем…</div></div>' });
  await loadJournal();
}
async function loadJournal() {
  const j = state.journal;
  const since = j.period === 'all' ? '' : new Date(new Date().setHours(0, 0, 0, 0) - (Number(j.period) - 1) * 864e5).toISOString();
  try { j.entries = await api.getJournal(since); } catch { j.entries = []; }
  renderJournal();
}
function journalMatches(e, j) {
  if (j.type === 'tasks' && e.col !== 'tasks') return false;
  if (j.type === 'projects' && e.col !== 'projects') return false;
  if (j.type === 'contractors' && e.col !== 'contractors') return false;
  if (j.type === 'payments' && !(e.changes || []).some(c => c.f === 'payment' || c.f === 'plan' || c.f === 'invoiceReceived' || c.f === 'actSigned')) return false;
  if (j.type === 'dates' && !(e.changes || []).some(c => c.f === 'start' || c.f === 'finish' || c.f === 'milestone')) return false;
  if (j.q) {
    const hay = [e.title, e.action, e.user, ...(e.changes || []).flatMap(c => [c.label, c.from, c.to])].join(' ').toLowerCase();
    if (!j.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}
function journalSummary(entries) {
  const today = entries.filter(e => e.ts.slice(0, 10) === new Date().toISOString().slice(0, 10) || new Date(e.ts).toDateString() === new Date().toDateString());
  const count = f => today.filter(f).length;
  const pays = today.flatMap(e => (e.changes || []).filter(c => c.label === 'Платёж внесён'));
  const sum = pays.reduce((a, c) => a + (parseMoney(String(c.to).split(' ₽')[0]) || 0), 0);
  const bits = [
    [count(e => e.kind === 'create' && e.col === 'tasks'), n => plural(n, 'новая карточка', 'новые карточки', 'новых карточек')],
    [count(e => (e.changes || []).some(c => c.f === 'finish')), n => plural(n, 'перенос срока', 'переноса срока', 'переносов срока')],
    [count(e => (e.changes || []).some(c => c.f === 'status' && c.to === 'Принят')), n => plural(n, 'работа принята', 'работы приняты', 'работ принято')],
    [pays.length, n => `${plural(n, 'платёж', 'платежа', 'платежей')} на ${money(sum)}`],
    [count(e => e.kind === 'trash'), () => 'в корзину'],
  ].filter(([n]) => n > 0).map(([n, l]) => `<span><b>${n}</b> ${l(n)}</span>`);
  return bits.length ? `<div class="jr-sum"><span class="vm-h">Сегодня</span>${bits.join('')}</div>` : '<div class="jr-sum hint">Сегодня изменений ещё не было.</div>';
}
function renderJournal() {
  const box = $('#jr-box');
  if (!box) return;
  const j = state.journal;
  const list = j.entries.filter(e => journalMatches(e, j));
  // Group by day, and collapse big batches (an import, a restore) into one line.
  const days = new Map();
  for (const e of list) {
    const d = new Date(e.ts);
    const key = d.toDateString();
    if (!days.has(key)) days.set(key, { d, batches: new Map() });
    const bs = days.get(key).batches;
    if (!bs.has(e.batch)) bs.set(e.batch, []);
    bs.get(e.batch).push(e);
  }
  const time = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const entryHtml = e => {
    const live = e.col === 'tasks' ? state.tasks.has(e.id) : e.col === 'projects' ? state.projects.has(e.id) : e.col === 'contractors' ? state.contractors.has(e.id) : false;
    const act = e.col === 'tasks' ? 'open-task' : e.col === 'projects' ? 'open-project' : e.col === 'contractors' ? 'open-contractor' : '';
    const colLabel = { tasks: 'карточка', projects: 'проект', contractors: 'подрядчик', users: 'сотрудник', all: 'база' }[e.col] || '';
    return `<div class="jr-item">
      <span class="num hint jr-time">${time(e.ts)}</span>
      <div class="jr-main">
        <div class="jr-line"><span class="chip tone-${e.kind === 'trash' || e.kind === 'delete' ? 'bad' : e.kind === 'create' ? 'ok' : e.undo ? 'warn' : 'idle'}">${esc(colLabel)} · ${esc(e.undo ? 'отмена' : KIND_LABEL[e.kind] || e.kind)}</span>
          ${live && act ? `<button class="jr-title" type="button" data-act="${act}" data-id="${esc(e.id)}">${esc(e.title || '—')}</button>` : `<b class="jr-title-static">${esc(e.title || '—')}</b>`}
          ${e.action ? `<span class="hint">· ${esc(e.action)}</span>` : ''}${e.user ? `<span class="hint jr-user">· ${esc(e.user)}</span>` : ''}</div>
        ${(e.changes || []).length ? `<ul class="jr-ch">${e.changes.map(c => `<li><span class="hint">${esc(c.label)}:</span> ${c.from !== undefined ? `${esc(c.from)} → ` : ''}<b>${esc(c.to ?? '')}</b></li>`).join('')}</ul>` : ''}
      </div></div>`;
  };
  const body = [...days.values()].map(({ d, batches }) => `<section class="jr-day"><h3>${d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
    ${[...batches.values()].map(es => es.length > 4
      ? `<details class="jr-batch"><summary><span class="num hint jr-time">${time(es[0].ts)}</span> <b>${esc(es[0].action || 'Групповое изменение')}</b> <span class="hint">— записей: ${es.length}</span></summary>${es.map(entryHtml).join('')}</details>`
      : es.map(entryHtml).join('')).join('')}</section>`).join('');
  box.innerHTML = `${journalSummary(j.entries)}
    <div class="filters jr-filters">
      <div class="seg">${JOURNAL_PERIODS.map(([k, l]) => `<button class="btn sm ${j.period === k ? 'on' : ''}" type="button" data-act="jr-period" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="seg">${JOURNAL_TYPES.map(([k, l]) => `<button class="btn sm ${j.type === k ? 'on' : ''}" type="button" data-act="jr-type" data-v="${k}">${l}</button>`).join('')}</div>
      <input id="jr-q" type="search" placeholder="Поиск в журнале" value="${esc(j.q)}">
    </div>
    ${body || `<div class="none">${j.entries.length ? 'Под фильтр ничего не попало.' : 'За этот период изменений нет. Журнал ведётся с версии 1.6.'}</div>`}`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-journal': () => { openJournal(); },
  'jr-period': ({ el }) => { state.journal.period = el.dataset.v; loadJournal(); },
  'jr-type': ({ el }) => { state.journal.type = el.dataset.v; renderJournal(); },
});
/* ---------- quick search (Ctrl+K) ---------- */
/* ---------- 52: recently opened projects, cards and contractors come first in Ctrl+K ---------- */
const RECENT_MAX = 12;
let recents = loadLocal('recents', []);
function noteRecent(kind, id) {
  if (!id) return;
  recents = [{ kind, id }, ...recents.filter(r => !(r.kind === kind && r.id === id))].slice(0, RECENT_MAX);
  saveLocal('recents', recents);
}
const orgSub = o => `контрагент${A.orgRoles(o).length ? ' · ' + A.orgRoles(o).map(r => A.ORG_ROLES[r].toLowerCase()).join(', ') : ''}${o.inn ? ' · ИНН ' + o.inn : ''}`;
const recentRank = it => { const i = recents.findIndex(r => r.kind === it.kind && r.id === it.id); return i < 0 ? RECENT_MAX : i; };
// With an empty query: the recent items that still exist, newest first.
function recentItems() {
  const out = [];
  for (const r of recents) {
    if (r.kind === 'task') { const t = state.tasks.get(r.id); if (t) out.push({ kind: 'task', id: t.id, title: marksText(t), sub: `${projectOf(t)?.name || '—'} · ${executorOf(t)?.name || 'нет исполнителя'} · ${timing(t).text}` }); }
    else if (r.kind === 'project') { const p = state.projects.get(r.id); if (p) out.push({ kind: 'project', id: p.id, title: p.name, sub: `проект${p.code ? ' · ' + p.code : ''}${p.archived ? ' · в архиве' : ''}` }); }
    else if (r.kind === 'contractor') { const c = state.contractors.get(r.id); if (c) out.push({ kind: 'contractor', id: c.id, title: c.name, sub: `подрядчик${c.specialty ? ' · ' + c.specialty : ''}` }); }
    else if (r.kind === 'org') { const o = state.orgs?.get(r.id); if (o) out.push({ kind: 'org', id: o.id, title: o.name, sub: orgSub(o) }); }
  }
  return out;
}
function searchAll(query) {
  const words = query.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const norm = v => String(v ?? '').toLowerCase().replace(/ё/g, 'е');
  const match = hay => words.every(w => hay.includes(w));
  const out = [];
  for (const t of state.tasks.values()) {
    const p = projectOf(t), c = contractorOf(t);
    const hay = norm([sectionsOf(t).join(' '), t.title, p?.name, p?.code, c?.name, t.contractNo, t.note].join(' '));
    if (match(hay)) out.push({ kind: 'task', id: t.id, rank: 0, title: marksText(t), sub: `${p?.name || '—'} · ${executorOf(t)?.name || 'нет исполнителя'} · ${timing(t).text}`, archived: !!p?.archived });
  }
  for (const p of state.projects.values()) {
    if (match(norm([p.name, p.code, p.client].join(' ')))) out.push({ kind: 'project', id: p.id, rank: 1, title: p.name, sub: `проект${p.code ? ' · ' + p.code : ''}${p.archived ? ' · в архиве' : ''}` });
  }
  for (const c of state.contractors.values()) {
    if (match(norm([c.name, c.specialty, c.phone, c.email, c.messenger].join(' ')))) out.push({ kind: 'contractor', id: c.id, rank: 2, title: c.name, sub: `подрядчик${c.specialty ? ' · ' + c.specialty : ''}` });
  }
  if (A.canSeeOrgs(state.me)) for (const o of state.orgs?.values() || []) {
    if (match(norm([o.name, o.inn, ...(o.contacts || []).map(k => k.name)].join(' ')))) out.push({ kind: 'org', id: o.id, rank: 2, title: o.name, sub: orgSub(o) });
  }
  return out.sort((a, b) => a.archived - b.archived || recentRank(a) - recentRank(b) || a.rank - b.rank).slice(0, 14);
}
// Quick entry: «+ ЭОМ Корпус 3 до 15.12 @Орлов уточнение» in the search box. Marks are known codes, the project is
// matched by name or code, «до дд.мм[.гггг]» is the finish, «@фамилия» the responsible; the rest is the title.
function parseQuick(text) {
  let rest = ' ' + text.replace(/^\s*\+\s*/, '') + ' ';
  const out = { marks: [], projectId: '', finish: '', ownerId: '', title: '', problems: [] };
  const dm = rest.match(/\s(?:до|к)\s+(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s/i);
  if (dm) {
    const y = dm[3] ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) : state.today.slice(0, 4);
    let iso = `${y}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    if (!dm[3] && iso < state.today) iso = `${Number(y) + 1}${iso.slice(4)}`;
    if (isDate(iso)) out.finish = iso; else out.problems.push('дата не распознана');
    rest = rest.replace(dm[0], ' ');
  }
  // 41: «!15.12», «!завтра», «!+3» — the finish; «#шифр» or «#слово» — the project.
  const bang = rest.match(/\s!(\S+)/);
  if (bang) {
    const v = bang[1].toLowerCase(), d = new Date(state.today + 'T00:00:00');
    let iso = '';
    const m = v.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
    if (m) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : state.today.slice(0, 4); iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (!m[3] && iso < state.today) iso = `${Number(y) + 1}${iso.slice(4)}`; }
    else if (v === 'завтра' || v === 'послезавтра' || /^\+\d{1,3}$/.test(v)) { d.setDate(d.getDate() + (v === 'завтра' ? 1 : v === 'послезавтра' ? 2 : Number(v.slice(1)))); iso = todayStr(d); }
    if (isDate(iso)) out.finish = iso; else out.problems.push(`срок «!${bang[1]}» не распознан — например !15.12, !завтра, !+3`);
    rest = rest.replace(bang[0], ' ');
  }
  const hash = rest.match(/\s#(\S+)/);
  let hashProject = null;
  if (hash) {
    const h = hash[1].toLowerCase().replace(/ё/g, 'е');
    hashProject = liveProjects().find(p => String(p.code || '').toLowerCase() === h) || liveProjects().find(p => `${p.name} ${p.code}`.toLowerCase().replace(/ё/g, 'е').includes(h)) || null;
    if (!hashProject) out.problems.push(`проект «#${hash[1]}» не найден`);
    rest = rest.replace(hash[0], ' ');
  }
  const at = rest.match(/\s@(\S+)/);
  if (at) {
    const q = at[1].toLowerCase().replace(/ё/g, 'е');
    const u = A.assignableOwners(state.me, liveUsers()).find(x => x.name.toLowerCase().replace(/ё/g, 'е').replace(/^пример:\s*/, '').includes(q));
    if (u) out.ownerId = u.id; else out.problems.push(`нет сотрудника «${at[1]}» среди тех, кому вы назначаете`);
    rest = rest.replace(at[0], ' ');
  }
  const known = new Set([...MARK_GROUPS.flatMap(g => g.marks.map(m => m[0])), ...Object.keys(Composition.RD_MARKS)].map(m => m.toUpperCase()));
  const words = rest.split(/\s+/).filter(Boolean), left = [];
  for (const w of words) { const m = w.replace(/[,;]$/, '').toUpperCase(); if (known.has(m) || known.has(m.replace(/\d+$/, ''))) out.marks.push(m); else left.push(w); }
  // Project: the one whose name or code shares the most words with what is left.
  const norm = v => String(v || '').toLowerCase().replace(/ё/g, 'е');
  let best = hashProject, bestN = hashProject ? Infinity : 0;
  if (!hashProject) for (const p of liveProjects()) {
    const hay = norm(`${p.name} ${p.code}`), n = left.filter(w => w.length > 1 && hay.includes(norm(w))).length;
    if (n > bestN) { best = p; bestN = n; }
  }
  if (best) { out.projectId = best.id; const hay = norm(`${best.name} ${best.code}`); out.title = hashProject ? left.join(' ') : left.filter(w => !(w.length > 1 && hay.includes(norm(w)))).join(' '); }
  else { out.title = left.join(' '); if (!hash) out.problems.push('проект не найден — напишите часть названия, шифр или #шифр'); }
  if (!out.marks.length && !out.title) out.problems.push('нужен раздел или текст задачи');
  return out;
}
async function quickCreate(q, full) {
  const draft = { sections: q.marks, section: q.marks.join(', '), title: q.title, finish: q.finish, ownerId: q.ownerId || state.me?.id || '' };
  const owner = state.users.get(draft.ownerId);
  const misfit = owner && A.profileGaps(owner, draft).length;
  if (full || q.problems.length || misfit || !A.canCreateTasks(state.me)) return openTask(null, { projectId: q.projectId, draft });
  const now = new Date();
  const ok = await write(op.set('tasks', newId(), { projectId: q.projectId, ...draft, contractorId: '', start: todayStr(), status: 'not_started', budget: 0, note: '', coOwnerIds: [], profileOk: false,
    milestones: [], plan: [], payments: [], dependsOn: [], history: [{ ts: now.toISOString(), date: todayStr(now), type: 'status', from: null, to: 'not_started', note: 'быстрый ввод' }], createdAt: now.toISOString() }),
    `Карточка добавлена: ${marksText(draft)} · ${state.projects.get(q.projectId)?.name || ''}`);
  return ok;
}
// opts.quick: 41 — opened by Ctrl+Alt+N from another program: the line starts with «+ », and if the window was not
// in front before, it goes back to the tray after Enter or Esc, so the person returns to their work.
function openPalette(opts = {}) {
  if (document.querySelector('.palette-back')) { if (opts.quick) { const i = $('#pal-q'); i.value = '+ '; i.dispatchEvent(new Event('input')); i.focus(); } return; }
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'palette-back';
  root.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Поиск">
    <input id="pal-q" placeholder="Поиск: раздел, объект, подрядчик… · «+ ЭОМ #Корпус3 !15.12 @Орлов» — новая карточка" autocomplete="off" spellcheck="false">
    <div class="pal-list" id="pal-list" role="listbox"></div>
    <div class="pal-foot hint">↑↓ — выбор · Enter — открыть · Esc — закрыть · начните с «+», чтобы быстро добавить карточку</div>
  </div>`;
  document.body.append(root);
  const input = root.querySelector('#pal-q'), list = root.querySelector('#pal-list');
  let items = [], sel = 0;
  const kindLabel = { task: 'карточка', project: 'проект', contractor: 'подрядчик' };
  const draw = () => {
    if (/^\s*\+/.test(input.value)) {
      const q = parseQuick(input.value), pr = state.projects.get(q.projectId);
      items = [{ kind: 'quick', q }];
      sel = 0;
      list.innerHTML = `<div class="pal-item sel pal-quick" data-i="0"><span class="pal-kind">новая</span><span class="pal-t">${esc(q.marks.join(', ') || q.title || '…')}${q.marks.length && q.title ? ' · ' + esc(q.title) : ''}</span>
        <span class="pal-s hint">${esc(pr?.name || 'проект?')}${q.finish ? ' · до ' + fmtDate(q.finish) : ''}${q.ownerId ? ' · ' + esc(state.users.get(q.ownerId)?.name || '') : ''}</span></div>
        ${q.problems.length ? `<div class="hint pal-warn">${esc(q.problems.join('; '))} — Enter откроет карточку, чтобы дописать</div>` : '<div class="hint pal-warn">Enter — создать сразу, Shift+Enter — открыть карточку</div>'}`;
      return;
    }
    const empty = !input.value.trim();
    items = empty ? recentItems() : searchAll(input.value);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = (empty && items.length ? '<div class="pal-h hint">Недавние</div>' : '') + (items.length ? items.map((it, i) => `<div class="pal-item ${i === sel ? 'sel' : ''}" role="option" aria-selected="${i === sel}" data-i="${i}">
        <span class="pal-kind">${kindLabel[it.kind]}</span><span class="pal-t">${esc(it.title)}</span><span class="pal-s hint">${esc(it.sub)}${!empty && recentRank(it) < RECENT_MAX ? ' · недавно' : ''}</span></div>`).join('')
      : `<div class="none">${input.value.trim() ? 'Ничего не найдено.' : 'Начните вводить — например «СКУД» или фамилию исполнителя.'}</div>`);
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { root.remove(); if (opts.hideAfter) setTimeout(() => api.hide(), 900); };
  const go = it => {
    if (!it) return;
    close();
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    if (it.kind === 'task') openTask(it.id);
    else if (it.kind === 'contractor') openContractor(it.id);
    else if (it.kind === 'org') openOrg(it.id);
    else {
      const p = state.projects.get(it.id);
      if (p?.archived) state.showArchive = true;
      openProjectPage(it.id); // 3.4+: a project opens as its page
    }
  };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[0]?.kind === 'quick') { close(); quickCreate(items[0].q, e.shiftKey); } else go(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  list.addEventListener('mousedown', e => { const el = e.target.closest('.pal-item'); if (el) { e.preventDefault(); go(items[Number(el.dataset.i)]); } });
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  if (opts.quick) { input.value = '+ '; root.querySelector('.palette').classList.add('pal-quick'); }
  draw();
  input.focus();
}
function quickEntry(o = {}) {
  if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
  if (!A.canCreateTasks(state.me)) { openPalette({ hideAfter: !!o.hideAfter }); return; }
  openPalette({ quick: true, hideAfter: !!o.hideAfter });
}
// 36: «Открыть» in a Windows notification: «task:<id>», «day» (several things), «chat:<id>».
function openTarget(target) {
  const [kind, id] = String(target || '').split(':');
  if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
  if (kind === 'task' && state.tasks.has(id)) return openTask(id);
  if (kind === 'project' && state.projects.has(id)) return openProjectPage(id);
  state.tab = 'day'; saveLocal('tab', 'day'); renderNow();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-search': () => { openPalette(); },
});
/* ---------- demo data (only on explicit click, marked as examples) ---------- */
async function seedDemo() {
  const d = n => addDays(todayStr(), n);
  const now = new Date().toISOString();
  const st = (n, from, to, note = '') => ({ ts: new Date(Date.now() + n * 864e5).toISOString(), date: d(n), type: 'status', from, to, note });
  const sh = (n, from, to, reason, note = '') => ({ ts: new Date(Date.now() + n * 864e5 - 1000).toISOString(), date: d(n), type: 'finish', from, to, reason, note });
  const P = [
    ['demo-p1', { name: 'Пример: ЖК «Северный», корп. 2', code: '0425-24', client: 'ООО «Пример-Девелопмент»', status: 'expertise', contactId: 'u-gip',
      phases: [{ key: 'contract', start: d(-200), finish: d(-185), done: d(-186) }, { key: 'survey', start: d(-185), finish: d(-150), done: d(-152) }, { key: 'ird', start: d(-185), finish: d(-140), done: d(-141) },
        { key: 'p', start: d(-150), finish: d(-50), done: d(-48) }, { key: 'expertise', start: d(-48), finish: d(22), done: '' }, { key: 'r', start: d(25), finish: d(115), done: '' }, { key: 'an', start: d(115), finish: d(300), done: '' }],
      milestones: [{ id: 'dm1', title: 'договор', date: d(-186), done: true }, { id: 'dm2', title: 'ПД на экспертизу', date: d(-48), done: true }, { id: 'dm3', title: 'заключение', date: d(22), done: false }, { id: 'dm4', title: 'РД', date: d(115), done: false }],
      requests: [{ id: 'dr1', title: 'ТУ на электроснабжение 630 кВт', due: d(2), why: 'Без них экспертиза не примет раздел ИОС1.', done: false }, { id: 'dr2', title: 'Кран-балки: 10 т или 16 т', due: d(5), why: '', done: false }],
      protocol: { no: '7', date: d(-8), items: [{ id: 'di1', text: 'Ответы экспертизе по КР', who: 'us', status: 'work', pct: 60 }, { id: 'di2', text: 'ТУ на 630 кВт', who: 'customer', status: 'wait', pct: 0 }, { id: 'di3', text: 'Ворота 6×6 м на торец', who: 'us', status: 'done', pct: 0 }] },
      docs: [{ id: 'dd1', title: 'ТУ на водоснабжение и водоотведение', until: d(45), remind: 60 }, { id: 'dd2', title: 'ГПЗУ', until: d(130), remind: 90 }, { id: 'dd3', title: 'Инженерные изыскания', until: d(600), remind: 180 }],
      advice: { title: 'Рабочая документация на сети', text: 'По договору у вас только стадия П. После заключения экспертизы понадобится РД на наружные сети — начнём сразу, без паузы.' } }],
    ['demo-p2', { name: 'Пример: Склад класса А, Подольск', code: '0611-24', client: 'ГИП Пример П.П.' }],
  ];
  const C = [
    ['demo-c1', { name: 'Пример: Петров А.С.', specialty: 'ЭОМ, ЭС, ЭО, ЭН', phone: '+7 900 000-00-01', email: 'petrov@example.com', messenger: 'Telegram @example_petrov' }],
    ['demo-c2', { name: 'Пример: Сидорова Е.В.', specialty: 'СС, СКС, СКУД, ОС', phone: '+7 900 000-00-02', email: 'sidorova@example.com', messenger: '' }],
    ['demo-c3', { name: 'Пример: ИП Кузнецов', specialty: 'АПС, СОУЭ', phone: '+7 900 000-00-03', email: '', messenger: 'WhatsApp +7 900 000-00-03' }],
  ];
  const plan3070 = [{ id: 'pl1', title: 'Аванс', pct: 30, trigger: 'start' }, { id: 'pl2', title: 'Окончательный расчёт', pct: 70, trigger: 'accepted' }];
  const T = [
    ['demo-t1', { projectId: 'demo-p1', sections: ['ЭОМ', 'ЭО'], title: 'стадия Р', contractorId: 'demo-c1', start: d(-40), finish: d(-5), status: 'in_progress', budget: 180000, contractNo: '12/24-П', contractDate: d(-42), invoiceReceived: true,
      plan: plan3070, payments: [{ id: 'a1', date: d(-40), amount: 54000, note: 'Аванс 30%' }],
      milestones: [{ id: 'm1', title: 'Задание смежникам', date: d(-20), done: true }, { id: 'm2', title: 'Промежуточная сдача', date: d(-10), done: false }],
      history: [st(-40, null, 'in_progress'), sh(-12, d(-15), d(-5), 'contractor', 'не успевает')] }],
    ['demo-t2', { projectId: 'demo-p1', sections: ['СС', 'СКС'], title: '', contractorId: 'demo-c2', start: d(-30), finish: d(6), status: 'in_progress', budget: 95000, plan: plan3070, dependsOn: ['demo-t1'],
      payments: [{ id: 'a2', date: d(-30), amount: 28500, note: 'Аванс' }], history: [st(-30, null, 'in_progress'), sh(-8, d(-2), d(6), 'customer', 'заказчик сменил ТУ')] }],
    ['demo-t3', { projectId: 'demo-p1', sections: ['АПС', 'СОУЭ'], title: '', contractorId: 'demo-c3', start: d(-25), finish: d(-1), status: 'review', budget: 115000,
      plan: [{ id: 'pl3', title: 'Аванс', pct: 30, trigger: 'start' }, { id: 'pl4', title: 'При сдаче', pct: 40, trigger: 'review' }, { id: 'pl5', title: 'После приёмки', pct: 30, trigger: 'accepted' }],
      payments: [{ id: 'a3', date: d(-25), amount: 34500, note: 'Аванс' }],
      history: [st(-25, null, 'in_progress'), st(-9, 'in_progress', 'review'), st(-6, 'review', 'revision', 'нет расчёта АКБ'), st(-2, 'revision', 'review')] }],
    ['demo-t5', { projectId: 'demo-p2', sections: ['ЭС', 'ЭН'], title: 'наружные сети 0,4 кВ', contractorId: 'demo-c1', start: d(-60), finish: d(-20), status: 'done', budget: 120000, invoiceReceived: true,
      plan: plan3070, payments: [{ id: 'a5', date: d(-60), amount: 36000, note: 'Аванс' }, { id: 'a6', date: d(-15), amount: 84000, note: 'Окончательный расчёт' }],
      history: [st(-60, null, 'in_progress'), st(-22, 'in_progress', 'review'), st(-18, 'review', 'done')] }],
    ['demo-t6', { projectId: 'demo-p2', sections: ['СКУД', 'ОС'], title: '', contractorId: 'demo-c2', start: d(-10), finish: d(4), status: 'revision', budget: 60000,
      history: [st(-10, null, 'in_progress'), st(-4, 'in_progress', 'review'), st(-2, 'review', 'revision', 'не учтены турникеты')] }],
    ['demo-t7', { projectId: 'demo-p2', sections: ['СОТ'], title: '', contractorId: '', start: d(-3), finish: d(30), status: 'not_started', budget: 55000, history: [st(-3, null, 'not_started')] }],
  ];
  // Sample team: a specialist under the current chief (or the first chief), a second chief for water and HVAC without budget access.
  const chief = A.isChief(state.me) ? state.me : usersByRole('chief')[0];
  const U = [
    ['demo-u1', { name: 'Пример: Орлов Д.К.', role: 'specialist', directions: ['el', 'ss'], chiefId: chief?.id || '', absences: [{ id: 'ab1', kind: 'vacation', from: d(5), to: d(18), note: '' }] }],
    ['demo-u2', { name: 'Пример: Белова Н.А.', role: 'chief', directions: ['vk', 'ov'], canSeeBudget: false }],
    ['demo-u3', { name: 'Пример: Зайцев И.П.', role: 'specialist', directions: ['vk'], chiefId: 'demo-u2' }],
  ];
  const owners = { 'demo-t1': 'demo-u1', 'demo-t3': 'demo-u1' };
  T.push(['demo-t8', { projectId: 'demo-p2', sections: ['ВК', 'НВК'], title: '', contractorId: '', start: d(-14), finish: d(12), status: 'in_progress', budget: 70000, history: [st(-14, null, 'in_progress')] }]);
  T.push(['demo-t9', { projectId: 'demo-p2', sections: ['ОВ', 'ИТП'], title: '', contractorId: '', start: d(-5), finish: d(25), status: 'not_started', budget: 90000, history: [st(-5, null, 'not_started')] }]);
  owners['demo-t8'] = 'demo-u2'; owners['demo-t9'] = 'demo-u2';
  // Participants of the warehouse — the sample chats (project, personal, group) come from main after the records.
  const gipId = (A.isGip(state.me) ? state.me : liveUsers().find(u => u.role === 'gip'))?.id || '';
  if (gipId) P[1][1].members = [gipId, 'demo-u2', 'demo-u3'];
  // Sample people are created for the GIP and for a chief alike (main lets demo records through).
  const withTeam = !isSpec();
  const ops = [
    ...(withTeam ? U.map(([id, x]) => op.set('users', id, { ...x, demo: true, createdAt: now })) : []),
    ...P.map(([id, x]) => op.set('projects', id, { ...x, note: '', demo: true, createdAt: now })),
    ...C.map(([id, x]) => op.set('contractors', id, { ...x, note: '', demo: true, createdAt: now })),
    ...T.map(([id, x]) => op.set('tasks', id, { ...x, createdAt: x.history?.[0]?.ts || now,
      ...(withTeam && id === 'demo-t3' ? { comments: [{ id: 'cm1', ts: x.history.at(-1).ts, userId: 'demo-u1', user: 'Пример: Орлов Д.К.', kind: 'submit', text: 'Исправил расчёт АКБ, добавил схему СОУЭ 2 этажа.' }] } : {}), ...(withTeam && id === 'demo-t2' ? { coOwnerIds: ['demo-u1'] } : {}), section: x.sections.join(', '), ownerId: (withTeam && owners[id]) || (A.isGip(state.me) ? chief?.id : state.me?.id) || '', note: '', demo: true })),
  ];
  const ok = await write(ops, 'Примеры добавлены');
  if (ok && withTeam) { await api.chatSeedDemo(); await refresh(); }
  return ok;
}
async function clearDemo() {
  // Done in the main process: it also removes sample cards and people outside this user's view.
  const res = await api.clearDemo();
  if (!res?.ok) return toast(res?.message || 'Не удалось удалить примеры.', true);
  toast('Примеры удалены');
}

/* ---------- window chrome ---------- */
function applyWinState(s) {
  const wasCompact = state.win.compact;
  state.win = s;
  const shell = $('#shell');
  shell.classList.toggle('compact', !!s.compact);
  shell.classList.toggle('maxed', !!s.maximized);
  const mb = $('#btn-max');
  if (mb) { mb.title = s.maximized ? 'Вернуть прежний размер (F11)' : 'На весь экран (F11, двойной щелчок по заголовку)'; mb.setAttribute('aria-pressed', String(!!s.maximized)); }
  shell.classList.toggle('ghost', !!s.clickThrough);
  document.documentElement.style.setProperty('--alpha', String(s.opacity));
  document.documentElement.dataset.theme = s.theme || 'system';
  const slider = $('#alpha');
  if (document.activeElement !== slider) slider.value = String(Math.round(s.opacity * 100));
  const backdrop = s.backdrop && s.backdrop !== 'none';
  if (s.backdrop) document.documentElement.dataset.backdrop = s.backdrop;
  slider.disabled = backdrop;
  slider.closest('.alpha').title = backdrop ? 'Сейчас фон окна — Mica или акрил (Окно → Фон окна); прозрачность задаёт Windows' : 'Непрозрачность окна';
  $('#btn-pin').setAttribute('aria-pressed', String(!!s.alwaysOnTop));
  $('#btn-pin').title = s.alwaysOnTop ? 'Закреплено поверх всех окон — нажмите, чтобы открепить' : 'Закрепить поверх всех окон';
  $('#btn-compact').title = s.compact ? 'Развернуть' : 'Компактный виджет';
  if (!$('#view-menu').hidden) renderViewMenu();
  if (s.compact && state.drawer) closeDrawer();
  if (wasCompact !== s.compact) renderNow();
}

let alphaTimer = null;
$('#alpha').addEventListener('input', e => {
  const v = Number(e.target.value) / 100;
  state.win.opacity = v;
  document.documentElement.style.setProperty('--alpha', String(v));
  clearTimeout(alphaTimer);
  alphaTimer = setTimeout(() => api.setOpacity(v), 250);
});

// Click-through: the main process forwards mouse moves, so hovering the unlock pill can take the mouse back.
const unlock = $('#unlock');
unlock.addEventListener('mouseenter', () => { if (state.win.clickThrough) api.hoverUnlock(true); });
unlock.addEventListener('mouseleave', () => { if (state.win.clickThrough) api.hoverUnlock(false); });

// Resize grip (frameless transparent windows have no reliable native resize border on Windows).
const grip = $('#grip');
grip.addEventListener('pointerdown', e => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const start = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight };
  let frame = 0;
  const move = ev => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => api.setSize(start.w + ev.screenX - start.x, start.h + ev.screenY - start.y));
  };
  const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
});

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'seed-demo': ({ el }) => { el.disabled = true; seedDemo(); },
  'clear-demo': ({ el }) => { el.disabled = true; clearDemo(); },
  'toggle-pin': () => { api.setAlwaysOnTop(!state.win.alwaysOnTop); },
  'toggle-compact': () => { api.setCompact(!state.win.compact); },
  'ghost-on': () => { api.setClickThrough(true); toast('Сквозные клики включены. Вернуть управление: Ctrl+Alt+G или кнопка вверху окна.'); },
  'ghost-off': () => { api.setClickThrough(false); },
  'minimize': () => { api.minimize(); },
  'toggle-max': () => { api.setMaximized(!state.win.maximized); },
  'hide': () => { api.hide(); },
});
/* ---------- events ---------- */
async function copy(value, btn) {
  try { await navigator.clipboard.writeText(value); toast('Скопировано'); }
  catch {
    const span = btn.parentElement.querySelector('.val');
    if (span) { const r = document.createRange(); r.selectNodeContents(span); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('Текст выделен — нажмите Ctrl+C');
  }
}

function applyPlanTemplate(kind) {
  const T = {
    '30-70': [{ title: 'Аванс', pct: 30, trigger: 'start' }, { title: 'Окончательный расчёт', pct: 70, trigger: 'accepted' }],
    '50-50': [{ title: 'Аванс', pct: 50, trigger: 'start' }, { title: 'Окончательный расчёт', pct: 50, trigger: 'accepted' }],
    100: [{ title: 'Оплата после приёмки', pct: 100, trigger: 'accepted' }],
  }[kind];
  state.draft.plan = T.map(r => ({ id: newId(), ...r }));
  renderPlanRows(); renderPlanPreview();
}

// Buttons and links that belong to the whole window (not to one part).
onAct({
  'tip-close': ({ el }) => { closeTip(el.dataset.tip); },
  'copy': ({ el }) => { copy(el.dataset.value, el); },
});
document.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  if (e.target.closest('.cell-edit')) return;
  if (!$('#view-menu').hidden && !e.target.closest('.view-wrap')) setViewMenu(false);
  if (!$('#file-menu').hidden && !e.target.closest('.menu-wrap:not(.user-wrap)')) setFileMenu(false);
  if (!$('#user-menu').hidden && !e.target.closest('.user-wrap')) setUserMenu(false);
  if (attOpen && !e.target.closest('#att-wrap')) setAttMenu(false);
  if (!$('#create-menu').hidden && !e.target.closest('.create-wrap')) setCreateMenu(false);
  if (colsOpen && !e.target.closest('.cols-wrap')) { colsOpen = false; $$('.cols-menu').forEach(m => { m.hidden = true; }); }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  track(act === 'tab' ? 'tab:' + id : 'act:' + act);
  ACTIONS.get(act)?.({ e, el, id, act });
});
// Drag a card from one person's list onto another person of the same kind (staff → staff, outside → outside).
let dragMove = null;
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('.ctask[data-move]');
  if (!el) return;
  const [kind, from] = el.dataset.move.split(':');
  dragMove = { id: el.dataset.id, kind, from };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', el.dataset.id);
  el.classList.add('dragging');
});
document.addEventListener('dragend', () => {
  dragMove = null;
  $$('.dragging, .drop-ok').forEach(x => x.classList.remove('dragging', 'drop-ok'));
});
const dropTarget = e => {
  const card = e.target.closest?.('[data-drop]');
  if (!card || !dragMove) return null;
  const [kind, to] = card.dataset.drop.split(':');
  return kind === dragMove.kind && to !== dragMove.from ? { card, to } : null;
};
document.addEventListener('dragover', e => {
  const t = dropTarget(e);
  $$('.drop-ok').forEach(x => { if (x !== t?.card) x.classList.remove('drop-ok'); });
  if (!t) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  t.card.classList.add('drop-ok');
});
document.addEventListener('drop', e => {
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault();
  const m = dragMove;
  t.card.classList.remove('drop-ok');
  track('drop:move');
  reassign(m.id, m.kind, m.from, t.to);
});

// 33 (Windows 11): resting the mouse on «развернуть» shows the Snap Layouts, as on ordinary windows.
{
  const mb = $('#btn-max');
  let snapT = null;
  mb?.addEventListener('mouseenter', () => { if (state.win.compact || !state.win.win11) return; clearTimeout(snapT); snapT = setTimeout(() => api.snapLayouts?.(), 650); });
  mb?.addEventListener('mouseleave', () => clearTimeout(snapT));
  mb?.addEventListener('mousedown', () => clearTimeout(snapT));
}
// 40: holding Alt shows the keys over the interface: Alt+1…9 on the tabs, Ctrl+K, Ctrl+N, F1, F11.
{
  let altT = null;
  const hintsOff = () => { clearTimeout(altT); altT = null; document.body.classList.remove('alt-hints'); document.querySelectorAll('[data-alt-key]').forEach(x => x.removeAttribute('data-alt-key')); };
  const hintsOn = () => {
    if (state.win.compact) return;
    visibleTabs().slice(0, 9).forEach((t, i) => $(`#tabs [data-id="${t.id}"]`)?.setAttribute('data-alt-key', `Alt+${i + 1}`));
    $('[data-act="open-search"]')?.setAttribute('data-alt-key', 'Ctrl+K');
    $('#btn-max')?.setAttribute('data-alt-key', 'F11');
    if (state.drawer?.kind === 'task') $('[data-act="save-stay"]')?.setAttribute('data-alt-key', 'Ctrl+S');
    document.body.classList.add('alt-hints');
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.repeat) { clearTimeout(altT); altT = setTimeout(hintsOn, 450); return; }
    if (e.key !== 'Alt') hintsOff();
  }, true);
  document.addEventListener('keyup', e => { if (e.key === 'Alt') { if (document.body.classList.contains('alt-hints')) e.preventDefault(); hintsOff(); } }, true);
  window.addEventListener('blur', hintsOff);
  document.addEventListener('mousedown', hintsOff, true);
}
// 40: Shift + wheel scrolls the Kanban sideways, as the Gantt.
document.addEventListener('wheel', e => {
  if (!e.shiftKey || e.ctrlKey || !e.deltaY) return;
  const kb = e.target.closest?.('.kb');
  if (!kb || kb.scrollWidth <= kb.clientWidth) return;
  e.preventDefault();
  kb.scrollLeft += e.deltaY;
}, { passive: false });

// Double click on the empty part of the title bar toggles «на весь экран», as in ordinary windows.
document.addEventListener('dblclick', e => {
  if (e.target.closest('#bar') && !e.target.closest('button, input, select, label, .menu, .counters .ccount')) api.setMaximized(!state.win.maximized);
});
document.addEventListener('dblclick', e => {
  const td = e.target.closest('td[data-edit]');
  if (!td || td.querySelector('.cell-edit')) return;
  clearTimeout(openTimer);
  e.preventDefault();
  startCellEdit(td);
});

// Global shortcuts. Inside text fields Ctrl+Z stays the field's own undo.
document.addEventListener('keydown', e => {
  const typing = e.target.matches?.('input, textarea, select, [contenteditable]');
  const ctrl = e.ctrlKey || e.metaKey;
  const code = e.code;
  if (ctrl && !e.altKey && (code === 'KeyK' || code === 'KeyF')) { e.preventDefault(); track('key:search'); openPalette(); return; }
  // 13: the tab strip from the keyboard.
  if (ctrl && !e.altKey && code === 'Tab' && docTabs.length && !state.win.compact && !SOLO) { e.preventDefault(); wsCycle(e.shiftKey ? -1 : 1); return; }
  if (ctrl && !e.altKey && !e.shiftKey && code === 'KeyW' && !state.drawer && !SOLO) { const cur = wsCurrent() || (msg.mode !== 'pill' && msg.chatId && docTabs.includes('chat:' + msg.chatId) ? 'chat:' + msg.chatId : ''); if (cur) { e.preventDefault(); docTabClose(cur); } return; }
  if (e.altKey && !ctrl && (code === 'ArrowUp' || code === 'ArrowDown') && state.drawer?.kind === 'task' && !typing) { e.preventDefault(); stepTask(code === 'ArrowUp' ? -1 : 1); return; }
  if ((code === 'F1' || (e.key === '?' && !typing)) && !ctrl && !e.altKey) { e.preventDefault(); track('key:help'); openHelp(); return; }
  if (code === 'F11' && !ctrl && !e.altKey) { e.preventDefault(); api.setMaximized(!state.win.maximized); return; }
  if (ctrl && !e.altKey && (code === 'Equal' || code === 'NumpadAdd')) { e.preventDefault(); stepZoom(1); return; }
  if (ctrl && !e.altKey && (code === 'Minus' || code === 'NumpadSubtract')) { e.preventDefault(); stepZoom(-1); return; }
  if (ctrl && !e.altKey && (code === 'Digit0' || code === 'Numpad0')) { e.preventDefault(); stepZoom(0); return; }
  if (ctrl && !e.altKey && code === 'KeyJ') { e.preventDefault(); if (!state.win.compact) openJournal(); return; }
  if (ctrl && !e.altKey && code === 'KeyN') { e.preventDefault(); if (!state.drawer && !state.win.compact && !isSpec()) openTask(null); return; }
  if (ctrl && !e.altKey && !e.shiftKey && code === 'KeyZ' && !typing && !document.querySelector('.modal-back, .palette-back')) { e.preventDefault(); track('key:undo'); undoLast(); return; }
  if (e.altKey && !ctrl && /^Digit[1-9]$/.test(code) && !state.win.compact) {
    e.preventDefault();
    const t = visibleTabs()[Number(code.slice(5)) - 1];
    if (t) { state.tab = t.id; saveLocal('tab', t.id); renderNow(); }
    return;
  }
}, true);

document.addEventListener('keydown', e => {
  if (e.target.id === 'talk-edit') {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); talkEditCancel(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); talkEditSave(); return; }
  }
  if (e.target.id === 'mc-edit') {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); mcEditCancel(); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mcEditSave(); return; }
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyS' && state.drawer?.kind === 'task' && $('#dform')) { e.preventDefault(); saveStay(); return; }
  if (e.key === 'Escape' && !$('#view-menu').hidden) { setViewMenu(false); $('#btn-view').focus(); return; }
  if (e.key === 'Escape' && !$('#user-menu').hidden) { setUserMenu(false); $('#btn-user').focus(); return; }
  if (e.key === 'Escape' && !$('#file-menu').hidden) { setFileMenu(false); $('#btn-file').focus(); return; }
  if (e.key === 'Escape' && !$('#create-menu').hidden) { setCreateMenu(false); $('#btn-create').focus(); return; }
  if (e.key === 'Escape' && attOpen) { setAttMenu(false); return; }
  if (e.key === 'Escape' && state.drawer) { requestClose(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && ['p-amount', 'p-note', 'p-date'].includes(e.target.id)) { e.preventDefault(); addPayment(); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'talk-text') { e.preventDefault(); sendComment(); }
  if (e.key === 'Enter' && e.target.closest('#ms-box, #plan-box, #rev-box, .qa-row')) e.preventDefault();
  if (e.key === 'Enter' && e.target.id === 'qa-note') e.preventDefault();
  if (e.target.id === 'msg-text') {
    if (msg.ac && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); msg.ac.sel = (msg.ac.sel + (e.key === 'ArrowDown' ? 1 : msg.ac.list.length - 1)) % msg.ac.list.length; $$('#mc-ac button').forEach((b, i) => b.classList.toggle('sel', i === msg.ac.sel)); return; }
    if (msg.ac && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); msgAcPick(msg.ac.sel); return; }
    if (e.key === 'Escape' && msg.ac) { e.stopPropagation(); $('#mc-ac').hidden = true; msg.ac = null; return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); msgSend(); return; }
  }
});
// «Сохранить» in a card: the same checks as the form submit, but the card stays open.
function saveStay() {
  const f = $('#dform');
  if (!f || state.drawer?.kind !== 'task') return f?.requestSubmit();
  submitTask(null, { stay: true });
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'dform') return;
  e.preventDefault();
  if (state.drawer?.kind === 'task') submitTask(); else if (state.drawer?.kind === 'user') submitUser(); else submitSimple();
});
document.addEventListener('change', e => {
  const t = e.target;
  const map = { 'f-project': 'project', 'f-contractor': 'contractor', 'f-status': 'status', 'f-mark': 'mark', 'f-owner': 'owner' };
  if (map[t.id]) { state.filters[map[t.id]] = t.value; shownLimits.delete('tasks'); render(); return; }
  if (t.id === 'f-preset') { if (t.value) applyPreset(t.value); else { state.filters = { ...EMPTY_FILTERS }; renderNow(); } return; }
  if (t.id === 'u-role') { syncUserForm(); return; }
  if (t.dataset.copt && state.draft?.composition) {
    const [grp, k] = t.dataset.copt.split('.'), comp = state.draft.composition;
    comp[grp] = { ...(comp[grp] || {}), [k]: t.type === 'checkbox' ? t.checked : t.value };
    renderComposition(); return;
  }
  if (t.dataset.cn && (t.dataset.k === 'on' || t.dataset.k === 'marks' || t.dataset.k === 'code' || t.dataset.k === 'tom')) { renderComposition(); return; }
  if (t.dataset.rd) {
    const x = rdItem(t.dataset.rd), k = t.dataset.k;
    if (!x) return;
    if (k === 'mark') {
      const was = Composition.RD_MARKS[Composition.markBase(x.mark)]?.[0] || '';
      x.mark = t.value.trim().toUpperCase();
      const now = Composition.RD_MARKS[Composition.markBase(x.mark)]?.[0];
      if (now && (!x.title || x.title === was)) x.title = now; // a known mark brings its name unless one was typed
    } else x[k] = k === 'on' ? t.checked : t.value;
    if (['mark', 'on', 'tom', 'code', 'pdId'].includes(k)) { const y = $('#dform .drawer-b')?.scrollTop; renderComposition(); if (y != null) $('#dform .drawer-b').scrollTop = y; }
    return;
  }
  if (t.dataset.ird) { irdPatch(t.dataset.pid, t.dataset.fid, { [t.dataset.ird]: t.value }); return; }
  if (t.dataset.sv) { surveyPatch(t.dataset.pid, t.dataset.k, { [t.dataset.sv]: t.dataset.sv === 'on' ? t.checked : t.value.trim() }); return; }
  if (t.dataset.pd && /^docs\.\d+\.(kind|issued)$/.test(t.dataset.pd)) {
    // A fixed-term kind fills «действует до» from the date of issue, unless it was typed by hand (differs from the rule).
    const x = state.draft.docs[Number(t.dataset.pd.split('.')[1])], kind = x.kind || L.docKindOf(x.title), auto = L.docUntil(kind, x.issued);
    if (auto && (!x.until || x.until === x.autoUntil)) x.until = auto;
    x.autoUntil = auto;
    const y = $('#dform .drawer-b')?.scrollTop; renderCustomer(); if (y != null) $('#dform .drawer-b').scrollTop = y; return;
  }
  if (t.dataset.pd && /^docs\.\d+\.until$/.test(t.dataset.pd)) { const y = $('#dform .drawer-b')?.scrollTop; renderCustomer(); if (y != null) $('#dform .drawer-b').scrollTop = y; return; }
  if (t.dataset.pd && /^phases\.|^milestones\./.test(t.dataset.pd)) { const m = t.dataset.pd.match(/^phases\.(\d+)\.(\w+)$/); if (m) state.draft.phases = L.planPhases(state.draft.phases, Number(m[1]), m[2]); const y = $('#dform .drawer-b')?.scrollTop; renderCustomer(); if (y != null) $('#dform .drawer-b').scrollTop = y; return; }
  if (t.dataset.act === 'toggle-budget') { toggleBudget(t.dataset.id, t.checked); return; }
  if (t.dataset.act === 'show-assign') { state.showAssign[t.dataset.v] = t.checked; saveLocal('showAssign', state.showAssign); renderNow(); return; }
  if (t.dataset.act === 'kb-show') { state.kbShow[t.dataset.v] = t.checked; saveLocal('kbShow', state.kbShow); renderKeepMenu('.kb-view'); return; }
  if (t.id === 'kb-project') { state.kanban.project = t.value; render(); return; }
  if (t.id === 'kb-contractor') { state.kanban.contractor = t.value; render(); return; }
  if (t.id === 'rep-scope') { state.reportScope = t.value; updateScopeLabels(); return; }
  if (t.name === 'vm-level') { api.setLevel(t.value); return; }
  if (t.id === 'dep-add' && t.value) { state.draft.dependsOn.push(t.value); renderDeps(); return; }
  if (t.id === 't-project') {
    // Another project: its composition; a hand-typed section stays typed.
    const box = $('#t-doc-box');
    if (box) { const typed = $('#t-doc')?.value === 'free' || !$('#t-doc') ? splitMarks($('#t-marks-extra')?.value || '') : $('#t-doc')?.value ? selectedMarks() : [];
      box.innerHTML = docFieldHtml(t.value, state.tasks.get(state.drawer?.id) || {}, normalizeMarks(typed)); }
    renderDeps(); onMarksChanged(); return;
  }
  if (t.id === 't-doc') { const free = $('#dform .doc-free'); if (free) free.hidden = t.value !== 'free'; onMarksChanged(); return; }
  if (t.id === 'msg-sign') { saveLocal('signature', t.value.trim()); renderMessage(state.msgKind); return; }
  if (t.dataset.ms !== undefined && t.dataset.k === 'done') {
    const m = state.draft.milestones[Number(t.dataset.ms)];
    m.done = t.checked; m.doneAt = t.checked ? todayStr() : undefined;
    renderMilestones(); return;
  }
  if (t.dataset.pl !== undefined && t.dataset.k === 'trigger') {
    state.draft.plan[Number(t.dataset.pl)].trigger = t.value;
    renderPlanRows(); renderPlanPreview(); return;
  }
  if (t.id === 'im-sheet') {
    const d = state.importData; d.sheet = Number(t.value);
    const det = window.Importer.detect(d.sheets[d.sheet].rows);
    d.headerRow = det.headerRow; d.mapping = det.mapping; openImport(); return;
  }
  if (t.id === 'im-header') {
    const d = state.importData; d.headerRow = Number(t.value);
    d.mapping = window.Importer.detect(d.sheets[d.sheet].rows, d.headerRow).mapping; openImport(); return;
  }
  if (t.dataset.map) { state.importData.mapping[t.dataset.map] = Number(t.value); renderImportPreview(); return; }
  if (t.id === 't-status') syncReady();
  if (t.id === 't-status' || t.id === 't-start') renderPlanPreview();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'f-q') {
    // Wait for a pause in typing: redrawing the list on every key is wasted work.
    state.filters.q = t.value; shownLimits.delete('tasks');
    clearTimeout(searchTimer); searchTimer = setTimeout(render, 180); return;
  }
  if (t.id === 'org-q') { orgQ = t.value; clearTimeout(orgQTimer); orgQTimer = setTimeout(render, 180); return; }
  if (t.dataset.oc !== undefined && state.draft?.contacts) { state.draft.contacts[Number(t.dataset.oc)][t.dataset.k] = t.value; return; }
  if (t.dataset.ok !== undefined && state.draft?.contracts) { state.draft.contracts[Number(t.dataset.ok)][t.dataset.k] = t.value; if (t.dataset.k === 'sum') renderOrgContractsTotal(); return; }
  if (t.id === 'o-inn') { orgInnHint(); partyAuto(); return; }
  if (t.dataset.ocPick && orgCheck) { const [n, k] = t.dataset.ocPick.split(':'); const d = orgCheck.items[Number(n)]?.diffs.find(x => x.k === k); if (d) { d.on = t.checked; renderOrgCheck(); } return; }
  if (t.id === 'pr-client') { customerHint(); return; }
  if (t.dataset.orgRole !== undefined) { const sub = $('#org-contracts-sub'); if (sub) sub.hidden = !orgContractsOn(orgRolesPicked(state.orgs?.get(state.drawer?.id))); return; }
  if (t.id === 'jr-q') { state.journal.q = t.value; const pos = t.selectionStart; renderJournal(); const n = $('#jr-q'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.id === 'msg-text') { msg.drafts[msg.chatId] = t.value; msgAutocomplete(t); return; }
  if (t.id === 'mc-title') { msg.newTitle = t.value; return; }
  if (t.name === 'mark' || t.id === 't-marks-extra') { onMarksChanged(); return; }
  if (t.id === 't-owner') { execPickersRefresh(); applyMarksFilter(); return; }
  if (t.id === 'exec-fit') { saveLocal('execFit', t.checked); for (const box of $$('#dform .exec-pick')) if (!box.querySelector('.ep-list').hidden) epRender(box, true); return; }
  if (t.id === 'mk-search') { applyMarksFilter(); return; }
  if (t.id === 't-ready-r') { $('#t-ready').value = t.value; return; }
  if (t.id === 't-ready') { $('#t-ready-r').value = t.value; return; }
  if (t.id === 'gq-project' || t.id === 'gq-mark') { state.ganttFilter[t.id === 'gq-project' ? 'project' : 'mark'] = t.value; renderNow(); return; }
  if (t.name === 'coOwner') { updateOwnerWarn(); return; }
  if (t.id === 't-finish') { updateShiftBox(); updateAbsenceWarn(); return; }
  if (t.id === 't-start') { updateAbsenceWarn(); return; }
  if (t.dataset.act === 'ov-toggle') { const h = new Set(ovPrefs.hidden); if (t.checked) h.delete(t.dataset.id); else h.add(t.dataset.id); setOvPrefs({ hidden: [...h] }); return; }
  if (t.dataset.act === 'col-toggle') { const h = new Set(colPrefs.hidden); if (t.checked) h.delete(t.dataset.id); else h.add(t.dataset.id); setColPrefs({ hidden: [...h] }); return; }
  if (t.id === 'quiet-days') { quietDays = Number(t.value) || 7; saveLocal('quietDays', quietDays); renderNow(); return; }
  if (t.id === 't-budget') { renderPlanPreview(); return; }
  if (t.dataset.ms !== undefined && t.dataset.k !== 'done') { state.draft.milestones[Number(t.dataset.ms)][t.dataset.k] = t.value; return; }
  if (t.dataset.rev !== undefined) { state.draft.revisions[Number(t.dataset.rev)][t.dataset.k] = t.value; return; }
  if (t.dataset.pd) { setDraftPath(t.dataset.pd, t.type === 'checkbox' ? t.checked : t.value); return; }
  if (t.dataset.cn) {
    const n = compNode(t.dataset.cn), k = t.dataset.k;
    if (!n) return;
    n[k] = k === 'on' ? t.checked : k === 'marks' ? t.value.split(/[,;]+/).map(x => x.trim()).filter(Boolean) : t.value;
    return;
  }
  if (t.dataset.pl !== undefined) {
    const r = state.draft.plan[Number(t.dataset.pl)];
    if (t.dataset.k === 'value') {
      const s = t.value.trim();
      if (s.endsWith('%')) { const n = Number(s.slice(0, -1).replace(',', '.').trim()); r.pct = Number.isFinite(n) ? n : ''; delete r.amount; }
      else { const n = parseMoney(s); r.amount = Number.isNaN(n) ? 0 : n; delete r.pct; }
    } else r[t.dataset.k] = t.value;
    renderPlanPreview();
  }
});

// "Overdue" depends on the calendar day: re-render when the date changes while the widget stays open.
setInterval(() => { if (todayStr() !== state.today) render(); }, 60 * 1000);

/* ---------- boot ---------- */
// What the testing aid (feedback-ui.js) may use; remove together with that file.
window.AppBridge = { state, toast, esc, TABS, setFileMenu: open => setFileMenu(open), quickEntry, openTarget };
try { const m = sessionStorage.getItem('glavspec.toast'); if (m) { sessionStorage.removeItem('glavspec.toast'); setTimeout(() => toast(m), 600); } } catch { /* optional */ }
applyNav();
applyDense();
applyAnim();
state.kanban.lanes = loadLocal('kbLanes', '') || '';
state.gantt.crit = !!loadLocal('ganttCrit', false);
state.showAssign = { ...state.showAssign, ...loadLocal('showAssign', {}) };
state.kbShow = { ...state.kbShow, ...loadLocal('kbShow', {}) };
$('#app').addEventListener('scroll', rememberScroll, { passive: true });
if (SOLO) {
  document.body.classList.add('solo', 'solo-' + SOLO.kind);
  if (SOLO.kind === 'project') { state.tab = 'projects'; state.openProjectId = SOLO.id; }
  else if (SOLO.kind === 'chat') { msg.mode = 'solo'; msg.chatId = SOLO.id; }
}
// A separate window hands a project or a chat back (or asks to open another one here).
api.onWindowMain?.(spec => {
  if (spec?.kind === 'project' && state.projects.has(spec.id)) { if (state.tab !== 'projects') { state.tab = 'projects'; saveLocal('tab', 'projects'); } openProjectPage(spec.id); }
  else if (spec?.kind === 'chat' && spec.id) { if (msg.mode === 'pill') { msg.mode = 'full'; msg.enter = true; } msgOpen(spec.id); }
  else if (spec?.kind === 'task' && state.tasks.has(spec.id)) openTask(spec.id); // from the tray panel
  else if (spec?.kind === 'main' && spec.id === 'day') { state.tab = 'day'; saveLocal('tab', 'day'); renderNow(); }
});
api.onData(view => { setData(view); remoteStatus(); });
api.onCabinet?.(setCab);
api.onWindowState(applyWinState);
api.onOpenTask?.(id => { if (state.tasks.has(id)) openTask(id); });
(async () => {
  try {
    applyWinState(await api.getWindowState());
    const { data, warning, remote } = await api.getData();
    state.remote = remote || null;
    setData(data);
    renderRemote();
    if (warning) toast(warning, true);
    api.cabinetGet?.().then(setCab).catch(() => {});
  } catch (e) {
    $('#app').innerHTML = `<section class="empty"><h2>Не удалось загрузить данные</h2><p class="hint">${esc(e?.message || e)}</p></section>`;
  }
})();
})();

(() => {
'use strict';

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
  el: { label: 'Электрика', color: '#E8820C', svg: '<path d="M9.2 1.5 3.6 9h3.6l-1 5.5L12.4 7H8.7z" fill="currentColor"/>' },
  ss: { label: 'Слаботочка', color: '#2E8B57', svg: '<rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor"/><rect x="6.2" y="6.2" width="3.6" height="3.6" rx=".5" fill="#fff" opacity=".85"/><path d="M6 1.8v2M10 1.8v2M6 12.2v2M10 12.2v2M1.8 6h2M1.8 10h2M12.2 6h2M12.2 10h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' },
  water: { label: 'Водоснабжение', color: '#1D6FD1', svg: '<path d="M2 5h6.5a2.5 2.5 0 0 1 2.5 2.5V9H9.2V7.6a.9.9 0 0 0-.9-.9H2z" fill="currentColor"/><rect x="4.2" y="2.4" width="1.6" height="2.8" rx=".5" fill="currentColor"/><path d="M3 2.4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.1 10.6c.9 1.2 1.4 2 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.6z" fill="currentColor"/>' },
  sewer: { label: 'Водоотведение', color: '#8B5A2B', svg: '<path d="M5.2 2.2c1.5 2 2.3 3.3 2.3 4.3a2.3 2.3 0 0 1-4.6 0c0-1 .8-2.3 2.3-4.3zM11 6.4c1.2 1.6 1.9 2.7 1.9 3.5a1.9 1.9 0 0 1-3.8 0c0-.8.7-1.9 1.9-3.5zM6.4 10.2c.9 1.2 1.4 2 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.6z" fill="currentColor"/>' },
  ov: { label: 'Отопление и вентиляция', color: '#D23C2C', svg: '<path d="M1.8 5.6h7.4a1.9 1.9 0 1 0-1.9-1.9M1.8 8.4h10.3a1.9 1.9 0 1 1-1.9 1.9M1.8 11.2h5.2a1.6 1.6 0 1 1-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
};
const kindIcon = (k, cls = '') => (KIND[k] ? `<svg class="kico ${cls}" viewBox="0 0 16 16" style="color:${KIND[k].color}" aria-label="${KIND[k].label}" role="img"><title>${KIND[k].label}</title>${KIND[k].svg}</svg>` : '');
const userKinds = u => (u?.directions || []).map(d => (d === 'vk' ? 'water' : d)).filter(k => KIND[k]);
const userIcons = u => userKinds(u).map(k => kindIcon(k)).join('');
const icon = id => `<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${ICON[id] || ''}</svg>`;
const fileSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
const TABS = [
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
const visibleTabs = () => orderedTabs().filter(t => !(A.isSpecialist(state.me) && t.id === 'people'));

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
  el.className = 'toast' + (bad ? ' bad' : ''); el.hidden = false;
  // Short for plain notes; longer when there is an «Отменить» button or an error. Hovering keeps it open.
  const ms = bad ? 7000 : action ? 5000 : 1800;
  clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms);
  el.onmouseenter = () => clearTimeout(toast._t);
  el.onmouseleave = () => { toast._t = setTimeout(() => { el.hidden = true; }, 1500); };
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
async function refresh() { try { setData((await api.getData()).data); } catch { /* the change event will follow */ } }

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
  contractor: t => contractorOf(t)?.name || '',
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
function askShiftReason(t, from, to) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const d = dayNum(to) - dayNum(from);
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
      <h2 id="mtitle">Перенос срока</h2>
      <p><b>${esc(marksText(t))}</b> · ${esc(projectOf(t)?.name || '')}</p>
      <p class="shift-h">${fmtDate(from)} → ${fmtDate(to)} <b>(${d >= 0 ? '+' : ''}${d} дн.)</b></p>
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
      if (!reason) { root.querySelector('#m-err').hidden = false; return; }
      close({ reason, note: root.querySelector('#m-note').value.trim() });
    });
  });
}

// Saves new start/finish; a moved finish is logged with its reason like in the card form.
async function commitDates(id, patch) {
  const t = state.tasks.get(id);
  if (!t) return false;
  const next = { start: patch.start !== undefined ? patch.start : t.start || '', finish: patch.finish !== undefined ? patch.finish : t.finish || '' };
  if ((next.start || '') === (t.start || '') && (next.finish || '') === (t.finish || '')) { renderNow(); return false; }
  if (isDate(next.start) && isDate(next.finish) && next.finish < next.start) { toast('Финиш не может быть раньше старта.', true); renderNow(); return false; }
  const history = Array.isArray(t.history) ? [...t.history] : [];
  if (isDate(t.finish) && isDate(next.finish) && t.finish !== next.finish) {
    const r = await askShiftReason(t, t.finish, next.finish);
    if (!r) { renderNow(); return false; }
    const now = new Date();
    history.push({ ts: now.toISOString(), date: todayStr(now), type: 'finish', from: t.finish, to: next.finish, reason: r.reason, note: r.note });
  }
  return write(op.update('tasks', id, { ...next, history }), `${marksText(t)}: ${fmtDate(next.start)} → ${fmtDate(next.finish)}`);
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
    return write(op.update('tasks', id, { contractorId: value }), `${marksText(t)}: ${c ? c.name : 'подрядчик снят'}`);
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
  { id: 'contractor', label: 'Подрядчик' }, { id: 'start', label: 'Старт' }, { id: 'finish', label: 'Финиш' }, { id: 'status', label: 'Статус' }, { id: 'ready', label: 'Готовность' },
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
  const tabs = orderedTabs();
  body.innerHTML = `<section class="set-sec" data-sec-id="view"><h3>Вид и окно</h3>${viewSectionsHtml(true)}<p class="hint">Прозрачность, «поверх окон» и сквозные клики — в меню «Окно» в заголовке.</p></section>
    <section class="set-sec" data-sec-id="tabs"><h3>Порядок вкладок</h3><p class="hint">Вкладки можно и просто перетащить мышью на панели.</p>${tabs.map((x, i) => `<div class="cols-row"><span>${icon(x.id)} ${esc(x.label)}</span><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="-1"${i ? '' : ' disabled'}>↑</button><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="1"${i < tabs.length - 1 ? '' : ' disabled'}>↓</button></div>`).join('')}
      <button class="btn ghostbtn sm" type="button" data-act="tabs-reset">Как было</button></section>
    <section class="set-sec" data-sec-id="game"><h3>Поощрения</h3><p class="hint">«Принято с первого раза», общая цель проекта и «Спасибо» в обсуждении. Считаются качество и общий результат, а не количество карточек.</p>
      <div class="seg"><button class="btn sm ${game ? 'on' : ''}" type="button" data-act="set-game" data-v="1">Показывать</button><button class="btn sm ${game ? '' : 'on'}" type="button" data-act="set-game" data-v="0">Выключить</button></div></section>
    <section class="set-sec" data-sec-id="ov"><h3>Панели сводки</h3>${ovRowsHtml()}</section>
    ${cab?.allowed ? `<section class="set-sec" data-sec-id="cab"><h3>Кабинет заказчика</h3><p class="hint">${cab.local ? '' : cab.configured ? `Подключён: ${esc(cab.url)}${cab.lastSync ? ` · связь ${cabTime(cab.lastSync)}` : ''}${cab.lastError ? ` · <span class="neg">${esc(cab.lastError)}</span>` : ''}` : 'Не подключён. Заказчик сможет смотреть свой проект в браузере или на телефоне.'}</p>
      ${cab.local ? `<p class="hint">Работает на этом компьютере · для заказчиков в офисе: ${esc(cab.publicUrl)}</p><button class="btn sm" type="button" data-act="cab-local-stop">Остановить</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>`
        : cab.configured ? '<button class="btn sm" type="button" data-act="cab-settings">Изменить подключение…</button>'
        : '<button class="btn primary sm" type="button" data-act="cab-local-start">Запустить на этом компьютере</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>'}</section>` : ''}
    ${isSpec() ? '' : `<section class="set-sec" data-sec-id="cols"><h3>Столбцы в таблицах карточек</h3>${colRowsHtml()}</section>`}
    ${tipsClosed.size ? `<section class="set-sec"><h3>Подсказки</h3><p class="hint">Скрыто подсказок: ${tipsClosed.size}.</p><button class="btn ghostbtn sm" type="button" data-act="tips-reset">Показать снова</button></section>` : ''}`;
  body.scrollTop = top;
}
// «⚙ Столбцы» opens right next to the table; headers can also be dragged to a new place.
let colsOpen = false;
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
function moveCol(id, dir) {
  const order = colOrder().map(c => c.id), i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setColPrefs({ order });
}

function taskTable(list, { showProject = true, showContractor = true, empty = 'Карточек пока нет.', tall = false, limitKey = 'table', select = false } = {}) {
  list = sortTasks(list.slice());
  const showMoney = canMoney(), edit = canEditFields(), showOwner = !isSpec();
  const cols = colOrder().filter(c => !colPrefs.hidden.includes(c.id) || c.fixed)
    .filter(c => (c.id !== 'project' || showProject) && (c.id !== 'contractor' || showContractor) && (c.id !== 'owner' || showOwner) && (!c.money || showMoney));
  const cell = (field, cls, inner) => `<td class="${cls}"${edit || field === 'status' ? ` data-edit="${field}" title="${EDIT_HINT}"` : ''}>${inner}</td>`;
  const HEAD = { project: () => sortTh('project', 'Проект'), marks: () => sortTh('marks', 'Разделы'), owner: () => sortTh('owner', 'Ответственный'),
    contractor: () => sortTh('contractor', 'Подрядчик'), start: () => sortTh('start', 'Старт'), finish: () => sortTh('finish', 'Финиш'),
    status: () => sortTh('status', 'Статус'), ready: () => sortTh('ready', 'Готовность'), budget: () => sortTh('budget', 'Бюджет', 'r'), paid: () => sortTh('paid', 'Оплачено', 'r'), rest: () => sortTh('rest', 'Остаток', 'r') };
  const CELL = {
    project: t => `<td>${esc(projectOf(t)?.name || '— проект удалён —')}</td>`,
    marks: t => `<td><div class="sec">${unread(t) ? '<span class="new-dot" title="Новое для вас"></span>' : ''}${marksHtml(t)}${t.title ? `<span class="t">${esc(t.title)}</span>` : ''}</div></td>`,
    owner: t => { const o = ownerOf(t); return cell('owner', '', o ? `${esc(o.name)}${coOwnersOf(t).length ? ` <span class="chip tone-idle" title="Соисполнители: ${esc(coOwnersOf(t).map(u => u.name).join(', '))}">+${coOwnersOf(t).length}</span>` : ''}<div class="hint role-hint">${esc(A.ROLES[o.role]?.label || '')}</div>${absHits(t).length ? `<div class="due warn" title="${esc(absHits(t).map(A.absenceText).join('; '))}">отпуск/больничный</div>` : ''}${gapsOf(t).length ? `<div class="due ${t.profileOk ? 'warn' : 'bad'}" title="${esc(gapsOf(t).map(x => x.text).join(' '))}">${t.profileOk ? 'не по профилю (подтверждено)' : 'не по профилю'}</div>` : ''}` : '<span class="hint">не назначен</span>'); },
    contractor: t => { const c = contractorOf(t); return cell('contractor', '', c ? esc(c.name) : '<span class="hint">не назначен</span>'); },
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
    : `<tr class="empty-row"><td colspan="${cols.length + (pick ? 1 : 0)}">${esc(empty)}</td></tr>`;
  const more = moreBtn(limitKey, list.length, shown.length, tall ? 300 : 100);
  return `<div class="tablewrap${tall ? ' tall' : ''}"><table><thead>${head}</thead><tbody>${rows}</tbody></table>${more ? `<div class="more-row">${more}</div>` : ''}</div>`;
}

// One row in an attention list; `side` overrides the default deadline text on the right.
function attItem(t, side) {
  const p = projectOf(t), c = contractorOf(t), tm = timing(t);
  const right = side ? side(t) : `<div class="due ${tm.cls}">${esc(tm.text)}</div><div class="num hint">${fmtDate(t.finish)}</div>`;
  return `<div class="att-item" data-act="open-task" data-id="${esc(t.id)}" role="button" tabindex="0">
    ${marksHtml(t)}
    <span class="main">${unread(t) ? '<span class="new-dot" title="Новое для вас"></span>' : ''}${esc(p?.name || '—')}${t.title ? ' · ' + esc(t.title) : ''}</span>
    <span class="side">${right}</span>
    <span class="who">${ownerOf(t) ? `<span class="who-o" title="Ответственный в команде">${esc(ownerOf(t).name)}${coOwnersOf(t).length ? ' +' + coOwnersOf(t).length : ''}</span> · ` : ''}${c ? esc(c.name) + (c.phone ? ' · ' + esc(c.phone) : '') : 'подрядчик не назначен'}</span>
  </div>`;
}
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

/* ---------- views ---------- */
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
  const dirs = [...A.DIRECTIONS.map(d => ({ id: d.id, label: d.label })), { id: '', label: 'Прочие разделы' }]
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
      <button class="pcard-open" type="button" data-act="project-page" data-id="${esc(p.id)}"><h3>${esc(p.name)}</h3></button>
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
  if (SOLO) { if (id !== SOLO.id) api.windowMain?.({ kind: 'project', id }); return; } // other projects open in the main window
  docTabAdd(id);
  state.openProjectId = id;
  if (state.tab !== 'projects') state.tab = 'projects';
  render();
  const app = $('#app'); if (app) app.scrollTop = 0;
}
/* ---------- bookmarks and separate windows (4.0) ---------- */
// A separate window shows one project or one chat: «?w=project:<id>» / «?w=chat:<key>». It runs this same
// interface over the main window's data (the bridge forwards every call there) and shows only that page.
const SOLO = (() => {
  try {
    const v = new URLSearchParams(location.search).get('w') || '', i = v.indexOf(':');
    return i > 0 && ['project', 'chat'].includes(v.slice(0, i)) && v.length > i + 1 ? { kind: v.slice(0, i), id: v.slice(i + 1) } : null;
  } catch { return null; }
})();
// Only where the app can open windows (the Tauri version); the Electron preload has no windowOpen.
const canDetach = () => !SOLO && typeof api.windowOpen === 'function';
// Projects opened in the main window stay as tabs above the page, like in a browser: × closes, the middle mouse
// button too, dragging a tab out of the window (or ⧉) moves the project into its own window.
const DOC_TABS_MAX = 12;
let docTabs = (v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-DOC_TABS_MAX) : []))(loadLocal('docTabs', []));
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
  if (state.openProjectId === id) state.openProjectId = docTabs[Math.min(i, docTabs.length - 1)] || null;
  render();
}
function docTabsHtml() {
  if (SOLO) return '';
  const tabs = docTabs.map(id => state.projects.get(id)).filter(p => p && !p.deletedAt);
  if (!tabs.length) return '';
  const dt = canDetach();
  return `<div class="doc-tabs" role="tablist" aria-label="Открытые проекты"><button class="dtab home${state.openProjectId ? '' : ' on'}" type="button" role="tab" aria-selected="${!state.openProjectId}" data-act="project-back">${icon('projects')}<span>Все проекты</span></button>${tabs.map(p => {
    const on = state.openProjectId === p.id;
    return `<div class="dtab${on ? ' on' : ''}" role="tab" aria-selected="${on}" draggable="true" data-doc="project" data-doc-id="${esc(p.id)}" title="${esc(p.name)}${dt ? ' — перетащите за пределы окна, чтобы открыть отдельно' : ''}"><button class="dt-open" type="button" data-act="project-page" data-id="${esc(p.id)}">${p.code ? `<span class="mono">${esc(p.code)}</span>` : ''}<span class="dt-name">${esc(p.name)}</span></button>${dt ? `<button class="dt-btn" type="button" data-act="win-detach" data-kind="project" data-id="${esc(p.id)}" title="Открыть в отдельном окне" aria-label="Открыть в отдельном окне">${icon('detach')}</button>` : ''}<button class="dt-btn" type="button" data-act="dtab-close" data-id="${esc(p.id)}" title="Закрыть вкладку (средняя кнопка мыши)" aria-label="Закрыть вкладку">×</button></div>`;
  }).join('')}</div>`;
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
  if (docDrag?.kind !== 'project') return;
  const t = e.target.closest?.('.dtab[data-doc]');
  if (t && t.dataset.docId !== docDrag.id) e.preventDefault();
});
document.addEventListener('drop', e => {
  const d = docDrag, t = e.target.closest?.('.dtab[data-doc]');
  if (d?.kind !== 'project' || !t || t.dataset.docId === d.id) return;
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
  if (outside && e.dataTransfer?.dropEffect === 'none') detachDoc(d.kind, d.id, { x: e.screenX, y: e.screenY });
});
document.addEventListener('auxclick', e => {
  const t = e.button === 1 && e.target.closest?.('.dtab[data-doc]');
  if (!t) return;
  e.preventDefault();
  docTabClose(t.dataset.docId);
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
      <div class="modal-f">${bad.length ? `<label class="chk ab-ok"><input type="checkbox" id="ab-force"> Назначить не по профилю (${bad.length})</label>` : ''}<button class="btn primary" type="button" data-m="save"${changed ? '' : ' disabled'}>Сохранить${changed ? ` (${changed})` : ''}</button><button class="btn" type="button" data-m="close">Отмена</button></div></div>`;
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

/* ---------- messenger (3.8): a dock at the bottom right, a side panel and a window with every chat ----------
   Project chats (GIP and participants, made with the first message), personal chats and group chats without a
   project. «@Фамилия» marks a colleague: their mention counter lights up separately. Written only by main. */
const msg = { mode: 'pill', chatId: '', filter: 'all', drafts: {}, newKind: '', newPick: new Set(), newTitle: '', ac: null, info: false };
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
const chatIcon = c => (c.kind === 'project' ? '<span class="mc-ic proj">#</span>' : c.kind === 'direct' ? `<span class="mc-ic ava">${esc(initials(chatTitle(c)))}</span>` : '<span class="mc-ic grp">⁂</span>');
// Text with @mentions highlighted (mine stronger).
function msgText(t, c) {
  const people = chatPeople(c), meSur = surnameOf(state.me?.name).toLowerCase();
  return esc(t).replace(/@([\p{L}-]+)/gu, (all, w) => { const lw = w.toLowerCase(); const hit = lw === 'все' || people.some(u => surnameOf(u.name).toLowerCase() === lw);
    return hit ? `<b class="mention${lw === meSur || lw === 'все' ? ' me' : ''}">${all}</b>` : all; });
}
function msgListHtml() {
  const all = msgThreads(), pins = msgPins();
  const sections = MSG_SECTIONS.filter(([k]) => k !== 'cust' || all.some(t => t.sec === 'cust'));
  if (!sections.some(([k]) => k === msg.filter)) msg.filter = 'all';
  const count = k => (k === 'at' ? all.reduce((a, t) => a + t.at, 0) : all.filter(t => k === 'all' || t.sec === k).reduce((a, t) => a + t.unread, 0));
  const tabs = `<div class="mc-tabs" role="tablist">${sections.map(([k, l]) => { const n = count(k); return `<button class="mc-tab${msg.filter === k ? ' on' : ''}" type="button" role="tab" aria-selected="${msg.filter === k}" data-act="msg-filter" data-v="${k}">${l}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>`;
  if (msg.filter === 'at') {
    const hits = chatsAll().flatMap(c => (c.messages || []).filter(m => (m.mentions || []).includes(state.me?.id)).map(m => ({ c, m }))).sort((a, b) => b.m.ts.localeCompare(a.m.ts)).slice(0, 60);
    return tabs + `<div class="mc-list">${hits.map(({ c, m }) => `<button class="mc-item${m.ts > (c.seen?.[state.me.id] || '') ? ' unread' : ''}" type="button" data-act="msg-chat" data-id="${esc(c.id)}">${chatIcon(c)}<span class="mc-body"><span class="mc-top"><b>${esc(chatTitle(c))}</b><span class="hint">${timeOf(localTs(m.ts))}</span></span><span class="mc-prev">${esc(surnameOf(m.user))}: ${msgText(m.text.slice(0, 120), c)}</span></span></button>`).join('') || '<p class="hint mc-empty">Вас пока не упоминали.</p>'}</div>`;
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
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${tome ? ' tome' : ''}${fresh ? ' fresh' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(m.user)}</b> <span class="hint">${lt.slice(11, 16)}${m.editedAt ? ' · изменено' : ''}</span>${tome ? ' <span class="chip tone-work">вас упомянули</span>' : ''}${out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(m.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${msgText(m.text, c)}</div>`}</div>`;
  }).join('');
  const sub = c.kind === 'project' ? `чат проекта · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}` : c.kind === 'direct' ? 'личный чат' : `группа · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}`;
  const canEdit = c.kind === 'group' && (c.createdBy === me || A.isGip(state.me));
  const info = msg.info ? `<div class="mc-info">${people.map(u => `<span class="chip tone-idle">${esc(u.name)}${u.id === c.createdBy ? ' · автор' : ''}</span>`).join(' ')}
      ${canEdit ? `<div class="row-in"><select id="mc-add"><option value="">— добавить участника —</option>${liveUsers().filter(u => !people.includes(u)).sort(byName).map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="msg-add-member">Добавить</button></div>` : ''}
      ${c.kind === 'group' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-leave">Выйти из чата</button>' : ''}${c.kind === 'project' ? `<button class="btn ghostbtn sm" type="button" data-act="project-page" data-id="${esc(c.projectId)}">Открыть проект</button><span class="hint">Участники проекта меняются на его странице.</span>` : ''}</div>` : '';
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку чатов">←</button>' : ''}${chatIcon(c)}<span class="mc-ht"><b>${esc(chatTitle(c))}</b><span class="hint">${sub}</span></span>
      ${msgPinBtn(c.id)}${winBtn('chat', c.id)}<button class="btn ghostbtn sm" type="button" data-act="msg-info" aria-pressed="${msg.info}">Участники</button></div>${info}
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
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${c.kind === 'submit' ? ' submit' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(c.user || '—')}</b> <span class="hint">${lt.slice(11, 16)}${c.editedAt ? ' · изменено' : ''}</span>${c.kind === 'submit' ? ' <span class="chip tone-review">сдал на проверку</span>' : ''}${out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${esc(c.text)}</div>`}${thankBtn(t, c)}</div>`;
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
  if (mentionSeenTs !== null && top > mentionSeenTs && !(msg.mode !== 'pill' && msg.chatId === hits[0].c.id)) toast(`@ ${hits[0].m.user} — «${chatTitle(hits[0].c)}»: ${hits[0].m.text.slice(0, 90)}`);
  mentionSeenTs = top > (mentionSeenTs || '') ? top : (mentionSeenTs ?? top);
}

const memberIds = p => (Array.isArray(p.members) ? p.members : []).filter(id => state.users.has(id) && !state.users.get(id).deletedAt);
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
const ptTable = rows => `<div class="tablewrap"><table class="pt-t"><thead><tr><th>Раздел</th><th>Обозначение</th><th>Ответственный</th><th>Срок</th><th>Готовность</th><th>Статус</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
function ptBlock(key, title, count, body, extra = '') {
  const fold = isFolded(key);
  return `<section class="panel pt-block${fold ? ' folded' : ''}"><div class="panel-h">${foldBtn(key, fold)}<h3>${esc(title)}</h3>${count}<span class="spacer"></span>${extra}</div>${fold ? '' : body}</section>`;
}

// «В работе» — started and not handed in (in progress, on revision); «не начато» — not started or paused.
const taskCounts = list => ({ work: list.filter(t => ['in_progress', 'revision'].includes(t.status)).length, idle: list.filter(t => ['not_started', 'paused'].includes(t.status)).length });
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
    <h2>${esc(p.name)}</h2>${p.archived ? '<span class="chip tone-idle">в архиве</span>' : projectStageChip(p)}${code ? `<span class="pcode mono">${esc(code)}</span>` : ''}${p.client ? `<span class="meta">${esc(p.client)}</span>` : ''}
    <span class="spacer"></span>${winBtn('project', p.id)}
    ${p.folder ? `<button class="btn ghostbtn sm" data-act="open-folder" data-id="${esc(p.id)}" type="button" title="${esc(p.folder)}">Папка проекта</button>` : ''}
    <button class="btn ghostbtn sm" type="button" data-act="techcard" title="Этапы, волны, задания смежникам">Техкарта</button>
    ${canEdit ? `<button class="btn sm" type="button" data-act="project-timeline" data-id="${esc(p.id)}">Сроки</button><button class="btn sm" type="button" data-act="assign-board" data-id="${esc(p.id)}">Назначить исполнителей</button><button class="btn sm" type="button" data-act="ask-customer" data-id="${esc(p.id)}" title="ТУ, письма, согласования, решения — заказчик увидит в «Нужно от вас»">Запросить у заказчика</button>${A.canChat(state.me, p) ? (() => { const c = chatById(projectChatId(p.id)), n = c ? msgUnread(c).length : 0; return `<button class="btn sm" type="button" data-act="msg-project" data-id="${esc(p.id)}">Чат проекта${n ? ` <span class="cnt bad">${n}</span>` : ''}</button>`; })() : ''}<button class="btn sm" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="comp">Состав проекта</button><button class="btn sm" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="cust">Для заказчика</button><button class="btn sm" type="button" data-act="open-project" data-id="${esc(p.id)}">Изменить</button>` : ''}</div>`;
  const noComp = !comp ? `<section class="panel"><div class="empty-in"><p>Состав проекта ещё не сформирован. Генератор предложит разделы по ПП РФ № 87 и рабочую документацию к ним; каждый раздел станет задачей.</p>${canEdit ? `<button class="btn primary" type="button" data-act="open-project-tab" data-id="${esc(p.id)}" data-tab="comp">Открыть генератор состава</button>` : ''}</div></section>` : '';
  return `<div class="pt-page">${head}${summary}${people}${noComp}${pdHtml}${rdHtml}${otherHtml}</div>`;
}
const initials = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

function viewProjects() {
  if (isEmpty()) return emptyState();
  if (state.openProjectId) {
    const op = state.projects.get(state.openProjectId);
    if (op && !op.deletedAt) return docTabsHtml() + viewProjectPage(op);
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
  const live = shownProjects.length ? shownProjects.map(p => projectPanel(p, all)).join('')
    : `<section class="empty"><h2>Активных проектов нет</h2><p class="hint">Заведите проект, затем добавьте в него карточки работ.</p><div class="acts"><button class="btn primary" data-act="new-project" type="button">Добавить проект</button></div></section>`;
  return docTabsHtml() + (projects.length && projects.some(p => p.status) ? `<div class="proj-top">${stageBar}</div>` : '') + live
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
// Staff have their own panel in the program; outside contractors do not and are tracked by the chief.
function staffArr() {
  const all = liveUsers().filter(u => u.role !== 'gip');
  const mine = A.isGip(state.me) ? all : all.filter(u => u.id === state.me?.id || (u.role === 'specialist' && u.chiefId === state.me?.id));
  return mine.sort((a, b) => (a.role === b.role ? byName(a, b) : a.role === 'chief' ? -1 : 1));
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
      if (!sel.value) { err.textContent = 'Выберите, кому передать.'; err.hidden = false; return; }
      const bad = misfitText(t, kind, sel.value);
      if (bad && !root.querySelector('#m-force').checked) { err.textContent = 'Отметьте «Всё равно назначить» или выберите другого.'; err.hidden = false; return; }
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
    const co = kind === 'staff' && t.ownerId !== holderId ? '<span class="chip tone-idle co-chip">соисполнитель</span>' : '';
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
const CONTRACTOR_GROUPS = [['el', 'Электрика'], ['ss', 'Слаботочка'], ['water', 'Водоснабжение'], ['sewer', 'Водоотведение'], ['ov', 'Отопление и вентиляция'], ['', 'Прочие и без специализации']];
function contractorRow(c, list) {
  const ct = list.filter(t => t.contractorId === c.id), x = totals(ct);
  const dueNow = ct.reduce((a, t) => a + L.cents(L.paymentPlan(t, state.today).dueNow), 0) / 100;
  const open = coOpen.has(c.id), r = L.reliability([...state.tasks.values()].filter(t => t.contractorId === c.id), state.today);
  const rel = r.grade === 'none' ? '<span class="hint">мало данных</span>' : `<span class="chip tone-${{ ok: 'ok', warn: 'warn', bad: 'bad' }[r.grade]}">${r.pct}% в срок</span>`;
  return `<div class="co-row${open ? ' open' : ''}" data-drop="contractor:${esc(c.id)}">
    <button class="co-line" type="button" data-act="co-toggle" data-id="${esc(c.id)}" aria-expanded="${open}">
      <span class="tree-tg">${open ? '▾' : '▸'}</span><span class="kicons">${A.contractorKinds(c).map(k => kindIcon(k)).join('')}</span>
      <b class="co-name">${esc(c.name)}</b><span class="hint co-spec">${esc(c.specialty || '')}</span>
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
function viewPeople() {
  if (isEmpty()) return emptyState();
  const list = tasksArr(), staff = staffArr(), people = contractorsArr();
  const gip = A.isGip(state.me);
  const head = (title, hint, btn) => `<div class="people-h"><h2>${title}</h2>${hint}<span class="spacer"></span>${btn}</div>`;
  const mode = ['cards', 'list', 'tree'].includes(peopleMode) ? peopleMode : 'cards';
  const modeSeg = `<span class="seg"><button class="btn sm ${mode === 'cards' ? 'on' : ''}" type="button" data-act="people-mode" data-v="cards" title="Карточки с контактами и задачами">Карточки</button><button class="btn sm ${mode === 'list' ? 'on' : ''}" type="button" data-act="people-mode" data-v="list" title="Одна строка на человека">Список</button><button class="btn sm ${mode === 'tree' ? 'on' : ''}" type="button" data-act="people-mode" data-v="tree" title="Структура: ГИП → главспецы → специалисты, цифры по группам, доступ к бюджету">Структура</button></span>`;
  return head(`Штатные <span class="cnt">${staff.length}</span>`, tip('people-staff', 'У каждого штатного свой пульт — войти можно, выбрав имя в заголовке.', 'inline'),
      modeSeg + (gip && mode !== 'tree' ? '<button class="btn sm" data-act="new-user" data-role="specialist" type="button">+ Сотрудник</button>' : ''))
    + (mode === 'tree' ? viewTeam()
      : !staff.length ? `<p class="hint people-empty">${gip ? 'Штатных сотрудников пока нет.' : 'Специалистов в вашей команде пока нет — их добавляет ГИП.'}</p>`
      : mode === 'list' ? staffList(staff, list)
      : foldAllBar(staff.map(u => 'u:' + u.id)) + `<div class="cards">${staff.map(u => staffCard(u, list)).join('')}</div>`)
    + head(`Подрядчики <span class="cnt">${people.length}</span>`, tip('people-outside', 'Внештатные, без доступа к программе — сроки и оплату по ним ведёт главспец. Сгруппированы по направлениям из специализации.', 'inline'),
      `${people.length ? `<button class="btn ghostbtn sm" type="button" data-act="cg-all" data-on="1">▾ Раскрыть группы</button><button class="btn ghostbtn sm" type="button" data-act="cg-all" data-on="0">▸ Свернуть</button>` : ''}<button class="btn sm" data-act="new-contractor" type="button">+ Подрядчик</button>`)
    + (people.length ? contractorsGrouped(people, list)
      : '<p class="hint people-empty">Добавьте подрядчиков с контактами — затем их можно будет назначать на карточки.</p>');
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
  const active = tasksArr().filter(t => t.status !== 'done' && (!gq.project || t.projectId === gq.project) && (!gq.mark || sectionsOf(t).includes(gq.mark)));
  const byProject = g.group === 'project', byOwner = g.group === 'owner' && !isSpec();
  const groups = byProject
    ? liveProjects().map(p => ({ key: 'p' + p.id, name: p.name, sub: p.code, tasks: active.filter(t => t.projectId === p.id) }))
    : byOwner ? liveUsers().sort(byName).map(u => ({ key: 'u' + u.id, name: u.name, user: u, sub: A.ROLES[u.role]?.label, tasks: active.filter(t => hasOwner(t, u.id)) }))
    : contractorsArr().map(c => ({ key: 'c' + c.id, name: c.name, tasks: active.filter(t => t.contractorId === c.id) }));
  // With a filter on, rows without matching cards only add noise.
  if (gq.project || gq.mark) for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].tasks.length) groups.splice(i, 1);
  if (byOwner) {
    const none = active.filter(t => !ownerOf(t));
    if (none.length) groups.push({ key: 'u-none', name: 'Без ответственного', tasks: none, unassigned: true });
  } else if (byProject) {
    const orphans = active.filter(t => !state.projects.has(t.projectId));
    if (orphans.length) groups.push({ key: 'p-none', name: 'Без проекта', tasks: orphans });
  } else {
    const none = active.filter(t => !contractorOf(t));
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

  const head = `<div class="tl-row tl-head"><div class="tl-name">${byProject ? 'Проект' : byOwner ? 'Ответственный' : 'Подрядчик'}<span class="tl-resize" data-gantt-resize title="Потяните, чтобы изменить ширину"></span></div>
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
      const who = byProject ? contractorOf(t)?.name || 'нет подрядчика' : projectOf(t)?.name || '';
      const label = `${marksText(t)} · ${who}`;
      const ext = tm.overdue && isDate(t.finish)
        ? (() => { const l = clamp(pos(t.finish) + dayW), r = clamp(pos(state.today) + dayW); return r > l ? `<span class="tl-late" style="left:${l}%;width:${r - l}%;top:${lane * 26 + 6}px" title="Просрочка ${tm.late} дн."></span>` : ''; })() : '';
      const ms = L.milestonesOf(t, state.today).list.filter(m => isDate(m.date) && inRange(m.date))
        .map(m => `<span class="tq-ms ${m.done ? 'done' : m.date < state.today ? 'bad' : ''}" style="left:${pos(m.date) + dayW / 2}%;top:${lane * 26 + 8}px" title="КТ «${esc(m.title)}» ${fmtDate(m.date)}${m.done ? ' — выполнена' : ''}"></span>`).join('');
      const blocked = L.dependencyIssues(t, state.tasks, state.today).length > 0;
      const noexec = !contractorOf(t);
      const awayHit = absHits(t).some(h => h.onFinish);
      const bar = right > left ? `<button class="tl-bar tone-${tone} ${pos(s) < 0 ? 'cut-l' : ''} ${pos(planEnd) + dayW > 100 ? 'cut-r' : ''} ${blocked ? 'blocked' : ''} ${noexec ? 'noexec' : ''} ${awayHit ? 'away' : ''}" type="button"
        data-act="open-task" data-id="${esc(t.id)}" data-bar="${esc(t.id)}"
        style="left:${left}%;width:${Math.max(0.5, right - left)}%;top:${lane * 26 + 3}px"
        title="${esc(label)}\n${fmtDate(t.start)} → ${fmtDate(t.finish)} · ${esc(tm.text)}${awayHit ? '\nФиниш приходится на отсутствие: ' + esc(absHits(t).filter(h => h.onFinish).map(A.absenceText).join('; ')) : ''}\nТяните — сдвинуть работу, края — изменить старт или финиш">${esc(label)}</button>` : '';
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
      <div class="tl-name">${foldBtn(gkey, false)}<b title="${esc(grp.name)}">${esc(grp.name)}</b><span class="hint">${grp.sub ? `${esc(grp.sub)} · ` : ''}${grp.tasks.length ? `в работе ${grp.tasks.length}` : byProject ? 'нет незавершённых' : 'свободен'}${!byProject && busy > 1 ? ` · одновременно до <span class="${busy >= 3 ? 'neg' : ''}">${busy}</span>` : ''}${outside ? ` · вне экрана: ${outside}` : ''}</span></div>
      <div class="tl-track" data-gantt-track style="height:${Math.max(1, lanes.length) * 26 + 6}px">${shade}${away}${grid}${today}${bars}</div>
    </div>`;
  }).join('');

  const preset = GANTT_PRESETS.map(([d, l]) => `<button class="btn sm ${g.days === d ? 'on' : ''}" type="button" data-act="g-scale" data-days="${d}">${l}</button>`).join('');
  return `<section class="panel">
    <div class="panel-h"><h3>Диаграмма Ганта</h3>${ganttModeSeg()}<span class="meta">${fmtDate(from)} — ${fmtDate(to)} · ${span} дн. · незавершённые карточки</span></div>
    <div class="gantt-bar one-row">
      <select id="gq-project" aria-label="Проект" class="sm-sel"><option value="">Все проекты</option>${liveProjects().map(p => `<option value="${esc(p.id)}"${gq.project === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select id="gq-mark" aria-label="Раздел" class="sm-sel"><option value="">Все разделы</option>${normalizeMarks(tasksArr().filter(t => t.status !== 'done').flatMap(sectionsOf)).map(m => `<option value="${esc(m)}"${gq.mark === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="1" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Свернуть все строки">▸ все</button><button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="0" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Развернуть все строки">▾ все</button>
      <div class="seg" role="group" aria-label="Группировка"><button class="btn sm ${byProject || byOwner ? '' : 'on'}" type="button" data-act="g-group" data-group="contractor">По подрядчикам</button>${isSpec() ? '' : `<button class="btn sm ${byOwner ? 'on' : ''}" type="button" data-act="g-group" data-group="owner">По ответственным</button>`}<button class="btn sm ${byProject ? 'on' : ''}" type="button" data-act="g-group" data-group="project">По проектам</button></div>
      <div class="seg" role="group" aria-label="Масштаб">${preset}</div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-zoom" data-dir="in" title="Крупнее (Ctrl + колесо вверх)">+</button><button class="btn sm" type="button" data-act="g-zoom" data-dir="out" title="Мельче (Ctrl + колесо вниз)">−</button></div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-shift" data-dir="-1" title="Назад">←</button><button class="btn sm" type="button" data-act="g-today">Сегодня</button><button class="btn sm" type="button" data-act="g-shift" data-dir="1" title="Вперёд">→</button></div>
      <span class="help-dot" tabindex="0" title="Фон диаграммы тяните мышью — прокрутка по датам; полоску — сдвиг работы; край полоски — старт или финиш. Ctrl + колесо — масштаб.">?</span>
    </div>
    <div class="tablewrap"><div class="tl" id="gantt" style="--tl-name:${g.nameW}px">${head}${rows || `<div class="none">${gq.project || gq.mark ? 'Под выбранный проект и раздел незавершённых карточек нет — сбросьте фильтр над диаграммой.' : 'Нет незавершённых карточек. Когда у карточек появятся старт и финиш, здесь будет видно, кто чем занят и где пересекаются сроки.'}</div>`}</div></div>
    <div class="tl-legend hint"><span class="tl-key tone-work"></span>в работе <span class="tl-key tone-idle"></span>не начат <span class="tl-key tone-review"></span>на проверке
      <span class="tl-key tone-warn"></span>на доработке <span class="tl-key tone-bad"></span>срок сорван <span class="tq-ms"></span>контрольная точка
      <span class="tl-arrow"></span>зависимость <span class="tl-key tl-key-hol"></span>выходные и праздники
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
  showDragHint(e, d);
});
function showDragHint(e, d) {
  const t = state.tasks.get(d.id);
  const { start, finish } = draggedDates(t, d);
  let hint = document.getElementById('drag-hint');
  if (!hint) { hint = document.createElement('div'); hint.id = 'drag-hint'; document.body.append(hint); }
  const sign = d.delta > 0 ? '+' : '';
  hint.textContent = `${fmtDate(start)} → ${fmtDate(finish)}${d.delta ? ` (${sign}${d.delta} дн.)` : ''}`;
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
  if (d.mode === 'resize') saveLocal('gantt', { days: state.gantt.days, nameW: state.gantt.nameW, group: state.gantt.group });
  // The click that ends a drag must not open a card. Chromium may skip that click when the bar under the
  // pointer was re-rendered, so the guard is cleared on the next task and can never swallow a later click.
  if (d.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  if (d.mode === 'bar' && d.moved) {
    const t = state.tasks.get(d.id);
    if (!t || !d.delta) { renderNow(); return; }
    commitDates(d.id, draggedDates(t, d));
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

/* ---------- Kanban ---------- */
const KANBAN_COLS = ['not_started', 'in_progress', 'revision', 'review', 'paused', 'done'];
const KANBAN_DONE_LIMIT = 15;
function kanbanCard(t) {
  const p = projectOf(t), c = contractorOf(t), tm = timing(t);
  const due = L.paymentPlan(t, state.today).dueNow;
  const msLate = L.milestonesOf(t, state.today).overdue.length;
  return `<article class="kb-card ${c ? '' : 'noexec'} ${tm.overdue ? 'late' : ''}" draggable="true" data-kb-id="${esc(t.id)}" data-act="open-task" data-id="${esc(t.id)}" role="button" tabindex="0"
      title="${c ? '' : 'Исполнитель не назначен. '}Перетащите карточку в другую колонку, чтобы сменить статус">
    <div class="kb-top">${marksHtml(t)}${tm.overdue ? '<span class="chip tone-bad">срок сорван</span>' : ''}</div>
    <div class="kb-proj">${esc(p?.name || '—')}${t.title ? ` · ${esc(t.title)}` : ''}</div>
    <div class="kb-who">${c ? esc(c.name) : '<b class="kb-noexec">нет подрядчика</b>'}</div>
    <div class="kb-foot"><span class="due ${tm.cls}">${esc(tm.text)}</span><span class="num hint">${fmtDate(t.finish)}</span></div>
    ${(due > 0 && canMoney()) || msLate ? `<div class="kb-flags">${msLate ? `<span class="tag bad">КТ сорвана</span>` : ''}${due > 0 && canMoney() ? `<span class="tag warn">пора платить ${money(due)}</span>` : ''}</div>` : ''}
  </article>`;
}
function viewKanban() {
  if (isEmpty()) return emptyState();
  const f = state.kanban;
  const list = tasksArr().filter(t => (!f.project || t.projectId === f.project) && (!f.contractor || (f.contractor === '__none' ? !contractorOf(t) : t.contractorId === f.contractor)));
  const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
  const noExec = list.filter(t => !contractorOf(t) && t.status !== 'done').length;
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
  const body = !lanes ? `<div class="kb">${colsOf(list)}</div>` : [...liveUsers().sort(byName), null].map(u => {
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
      <select id="kb-contractor" aria-label="Подрядчик">${opt('', 'Все подрядчики', f.contractor)}${opt('__none', 'Без подрядчика', f.contractor)}${contractorsArr().map(c => opt(c.id, c.name, f.contractor)).join('')}</select>
      ${isSpec() ? '' : `<span class="seg"><button class="btn sm ${lanes ? '' : 'on'}" type="button" data-act="kb-lanes" data-v="">Одной доской</button><button class="btn sm ${lanes ? 'on' : ''}" type="button" data-act="kb-lanes" data-v="owner">По ответственным</button></span>`}
      ${noExec ? `<span class="kb-warn">Без подрядчика: <b>${noExec}</b></span>` : ''}
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
      if (!title) { q('#aq-err').textContent = 'Напишите, что нужно.'; return; }
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
function askText(title, label, placeholder = '') {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate><h2 id="mtitle">${esc(title)}</h2>
      <div class="f"><label class="req" for="m-text">${esc(label)}</label><input id="m-text" maxlength="40" placeholder="${esc(placeholder)}"></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
    document.body.append(root);
    const close = v => { root.remove(); resolve(v); };
    root.querySelector('#m-text').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const v = root.querySelector('#m-text').value.trim(); if (v) close(v); });
  });
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
    ['Alt+1…9', 'вкладки по порядку'], ['F11 или двойной щелчок по заголовку', 'окно на весь экран / обратно'], ['Ctrl+Alt+G', 'сквозные клики вкл/выкл (работает и из других программ)'],
    ['Ctrl + = / − / 0', 'масштаб интерфейса'], ['F1 или ?', 'эта подсказка']]],
  ['Таблицы и списки', [['Двойной щелчок по ячейке', 'правка прямо в таблице: статус, подрядчик, даты, бюджет'], ['Щелчок по заголовку столбца', 'сортировка'],
    ['Счётчик в заголовке («сорвано 2»…)', 'открыть эти карточки списком']]],
  ['Открытая карточка', [['Alt+↑ / Alt+↓', 'предыдущая / следующая карточка списка'], ['Ctrl+Enter в обсуждении', 'отправить сообщение'], ['Esc', 'закрыть (спросит про несохранённое)']]],
  ['Диаграмма Ганта', [['Тянуть фон', 'прокрутка по датам'], ['Ctrl + колесо', 'масштаб'], ['Тянуть полоску / её край', 'сдвинуть работу / изменить старт или финиш']]],
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

/* ---------- bulk actions over picked cards (3.6) ---------- */
function bulkBar() {
  const ids = [...state.bulk].filter(id => state.tasks.has(id)), n = ids.length;
  const owners = A.assignableOwners(state.me, liveUsers()).sort(byName);
  const dis = n ? '' : ' disabled';
  return `<div class="bulk-bar"><b>Выбрано: ${n}</b>
    <span class="bulk-g"><select id="bulk-owner"${dis}><option value="">— ответственный —</option>${owners.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="bulk-owner"${dis}>Назначить</button></span>
    <span class="bulk-g"><select id="bulk-contr"${dis}><option value="">— подрядчик —</option><option value="__none">снять подрядчика</option>${contractorsArr().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="bulk-contr"${dis}>Назначить</button></span>
    <span class="bulk-g">Сдвинуть сроки на <input id="bulk-days" type="number" value="7" step="1" min="-365" max="365"${dis}> дн. <button class="btn sm" type="button" data-act="bulk-shift"${dis}>Сдвинуть</button></span>
    <span class="bulk-g"><button class="btn sm" type="button" data-act="bulk-start"${dis} title="Только не начатые и приостановленные">В работу</button><button class="btn danger sm" type="button" data-act="bulk-trash"${dis}>В корзину</button></span>
    ${n ? '<button class="btn ghostbtn sm" type="button" data-act="bulk-clear">Снять выбор</button>' : '<span class="hint">Отметьте карточки галочками в таблице.</span>'}</div>`;
}
async function bulkDo(kind) {
  const list = [...state.bulk].map(id => state.tasks.get(id)).filter(Boolean);
  if (!list.length) return;
  const now = new Date(), stamp = { ts: now.toISOString(), date: todayStr(now) };
  let ops = [], msg = '';
  if (kind === 'owner') {
    const uid = $('#bulk-owner').value, u = state.users.get(uid);
    if (!u) return toast('Выберите ответственного.');
    const misfit = list.filter(t => A.profileGaps(u, t).length);
    if (misfit.length && !(await confirmBox(`${u.name} не по профилю для: ${misfit.map(marksText).join(', ')}. Всё равно назначить?`, 'Назначить'))) return;
    ops = list.map(t => op.update('tasks', t.id, { ownerId: uid, coOwnerIds: (t.coOwnerIds || []).filter(x => x !== uid), profileOk: misfit.includes(t) }));
    msg = `${u.name}: назначено карточек ${list.length}`;
  } else if (kind === 'contr') {
    const cid = $('#bulk-contr').value;
    if (!cid) return toast('Выберите подрядчика.');
    ops = list.map(t => op.update('tasks', t.id, { contractorId: cid === '__none' ? '' : cid }));
    msg = cid === '__none' ? `Подрядчик снят: ${list.length}` : `${state.contractors.get(cid)?.name}: карточек ${list.length}`;
  } else if (kind === 'shift') {
    const d = Math.round(Number($('#bulk-days').value));
    if (!d || Math.abs(d) > 365) return toast('Укажите сдвиг в днях, например 7 или −3.');
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
    if (!(await confirmBox(`Переместить в корзину карточки (${list.length})? 30 дней их можно восстановить.`, 'В корзину'))) return;
    ops = list.map(t => op.update('tasks', t.id, { deletedAt: now.toISOString() }));
    msg = `В корзину: ${list.length}`;
  }
  if (await write(ops, msg)) { state.bulk = new Set(); renderNow(); }
}
function viewTasks() {
  if (isEmpty()) return emptyState();
  const f = state.filters, q = f.q.trim().toLowerCase();
  // «att:…» statuses come from the header counters: the same lists the overview shows.
  const attIds = f.status.startsWith('att:') ? new Set((attention()[f.status.slice(4)] || []).map(t => t.id)) : null;
  const list = tasksArr().filter(t => {
    if (f.project && t.projectId !== f.project) return false;
    if (f.contractor === '__none' ? t.contractorId : (f.contractor && t.contractorId !== f.contractor)) return false;
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
      <select id="f-contractor" aria-label="Подрядчик">${opt('', 'Все подрядчики', f.contractor)}${opt('__none', 'Без подрядчика', f.contractor)}${contractorsArr().map(c => opt(c.id, c.name, f.contractor)).join('')}</select>
      <select id="f-status" aria-label="Статус">${opt('', 'Любой статус', f.status)}${opt('overdue', 'Срок сорван', f.status)}${opt('new', 'Новое для меня', f.status)}${opt('att:week', 'Сдача ≤ 7 дней', f.status)}${opt('att:milestones', 'Сорваны КТ', f.status)}${opt('att:pay', 'Пора платить', f.status)}${opt('quiet', 'Тишина', f.status)}${Object.entries(STATUSES).map(([k, s]) => opt(k, s.label, f.status)).join('')}</select>
      <select id="f-mark" aria-label="Раздел">${opt('', 'Любой раздел', f.mark)}${normalizeMarks(tasksArr().flatMap(sectionsOf)).map(m => opt(m, m, f.mark)).join('')}</select>
      <input id="f-q" type="search" placeholder="Поиск: раздел, проект, подрядчик, договор" value="${esc(f.q)}">
    </div>
    <section class="panel"><div class="panel-h"><h3>Карточки</h3><span class="meta">${tt.count}${canMoney() ? ` · бюджет ${money(tt.budget)} · оплачено ${money(tt.paid)} · остаток ${money(tt.rest)}` : ''}</span><span class="spacer"></span>${canEditFields() ? `<button class="btn ghostbtn sm${state.bulk ? ' on' : ''}" type="button" data-act="bulk-toggle" title="Отметить несколько карточек и изменить их разом">${state.bulk ? 'Готово' : 'Выбрать несколько'}</button>` : ''}${colsMenu()}</div>
    ${state.bulk ? bulkBar() : ''}
    ${taskTable(list, { empty: 'Под фильтр ничего не попало.', tall: true, limitKey: 'tasks', select: canEditFields() })}</section>`;
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
let attOpen = false;
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

let renderQueued = false;
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
  if (state.win.compact) { app.innerHTML = viewCompact(); renderMsg(); return; }
  if (state.tab === 'team') { state.tab = 'people'; peopleMode = 'tree'; } // «Команда» merged into «Исполнители» in 2.5
  const view = { overview: viewOverview, projects: viewProjects, people: viewPeople, office: viewOffice, gantt: viewGantt, kanban: viewKanban, tasks: viewTasks }[state.tab] || viewOverview;
  app.innerHTML = view() + footer();
  renderMsg(); msgNotify();
  if (active === 'f-q') { const el = $('#f-q'); el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* not a text input any more */ } }
  if (state.tab === 'gantt') drawGanttLinks();
  if (state.drawer?.kind === 'task' && state.drawer.id) { renderPayments(); renderPlanPreview(); renderTalk(); if (state.drawer.tab === 'log') loadTaskLog(state.drawer.id); }
}

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
    .map(i => [i.name, i.type === 'checkbox' ? i.checked : i.value]);
  return JSON.stringify([fields, state.draft]);
}
function markClean() { state.dirtyBase = formSnapshot(); }
// ✕, Esc and the backdrop ask before dropping unsaved edits; «Отмена» discards on purpose.
function requestClose() {
  if (state.dirtyBase && formSnapshot() !== state.dirtyBase) {
    $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm warnc">Есть несохранённые изменения.
      <span class="confirm-acts"><button class="btn primary sm" data-act="save-close" type="button">Сохранить</button>
      <button class="btn sm" data-act="discard" type="button">Не сохранять</button>
      <button class="btn ghostbtn sm" data-act="cancel-delete" type="button">Остаться</button></span></div></div>`;
    return;
  }
  closeDrawer();
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
    menu.innerHTML = [['gip', 'ГИП'], ['chief', 'Главспецы'], ['specialist', 'Специалисты']]
      .map(([r, l]) => usersByRole(r).length ? `<div class="menu-h">${l}</div>${usersByRole(r).map(item).join('')}` : '').join('')
      + '<p class="role-hint">Локальная версия: вход без пароля, роли разделяют интерфейс, но не защищают файл данных.</p>';
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
  if (!data.name) return formError('Укажите имя сотрудника.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.');
  if (!A.ROLES[role]) return formError('Выберите роль.');
  data.chiefId = role === 'specialist' ? val('chiefId') : '';
  data.canSeeBudget = role === 'chief' && checked('canSeeBudget');
  if (role === 'gip') data.directions = [];
  if (id && role !== 'chief' && state.users.get(id)?.role === 'chief' && usersByRole('specialist').some(s => s.chiefId === id))
    return formError('У этого главспеца есть специалисты — сначала переведите их к другому главспецу.');
  const left = id ? [...state.tasks.values()].filter(t => hasOwner(t, id) && t.status !== 'done' && A.profileGaps({ ...state.users.get(id), ...data }, t).length).length : 0;
  const ok = id ? await write(op.update('users', id, data), left ? `Сохранено. Внимание: карточек не по профилю — ${left}, они в сводке` : 'Сотрудник сохранён')
    : await write(op.set('users', newId(), { ...data, createdAt: new Date().toISOString() }), `${data.name}: штатный сотрудник добавлен, пульт создан`);
  if (ok) closeDrawer();
  return ok;
}

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
  const groups = MARK_GROUPS.map((g, i) => `<fieldset class="mk-group" data-dir="${esc(A.DIRECTIONS[i]?.id || '')}"><legend>${esc(g.title)}</legend><div class="mk-grid">${g.marks.map(([code, name]) =>
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
  const sel = $('#t-contractor');
  if (sel) { const v = sel.value; sel.innerHTML = contractorOptions(list, v); sel.value = v; }
  const own = $('#t-owner');
  if (own && !own.disabled) { const v = own.value; own.innerHTML = ownerOptions(v, list); own.value = v; }
  renderCoOwners();
  updateOwnerWarn();
  applyMarksFilter();
}
// Warns in the card when the chosen person has no direction for some of the marks.
// Co-owners: other staff on the same job. Rebuilt when the main owner changes; keeps ticked boxes.
function renderCoOwners() {
  const box = $('#co-box');
  if (!box) return;
  const owner = $('#t-owner')?.value;
  const ticked = new Set(box.dataset.init !== undefined ? $$('input[name="coOwner"]:checked', box).map(i => i.value) : (state.drawer?.coInit || []));
  box.dataset.init = '1';
  const marks = selectedMarks();
  const can = new Set(A.assignableOwners(state.me, liveUsers()).map(u => u.id));
  // Co-owners set by someone higher up stay listed (read-only) so saving never drops them.
  const list = liveUsers().filter(u => u.id !== owner && u.role !== 'gip' && (can.has(u.id) || (state.drawer?.coInit || []).includes(u.id)));
  const lockedAll = $('#t-owner')?.disabled;
  box.innerHTML = list.length ? `<span class="lbl">Соисполнители (штатные)</span><div class="chk-row">${list.sort(byName).map(u => {
    const misfit = A.profileGaps(u, { sections: marks }).length;
    return `<label class="chk${misfit ? ' misfit' : ''}" title="${esc(A.profileText(u))}"><input type="checkbox" name="coOwner" value="${esc(u.id)}"${ticked.has(u.id) ? ' checked' : ''}${lockedAll || !can.has(u.id) ? ' disabled' : ''}> ${esc(u.name)}</label>`;
  }).join('')}</div>` : '';
}
function formOwners() {
  const owner = $('#t-owner')?.value || '';
  // Disabled boxes (outside the user's team) keep their value: checked ones are included as is.
  return [owner, ...$$('#co-box input[name="coOwner"]').filter(i => i.checked).map(i => i.value)].filter((v, i, a) => v && a.indexOf(v) === i);
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
    if (bad) { const er = root.querySelector('#m-err'); er.textContent = 'Проверьте даты: «по» не раньше «с».'; er.hidden = false; return; }
    const list = rows.map(a => ({ id: a.id || newId(), kind: a.kind, from: a.from, to: a.to, note: (a.note || '').trim() })).sort((a, b) => a.from.localeCompare(b.from));
    if (await write(op.update('users', uid, { absences: list }), `Отсутствия сохранены: ${u.name}`)) close();
  });
}
const upcomingAbsences = u => A.absencesOf(u).filter(a => a.to >= state.today);

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
  box.innerHTML = `<div class="talk">${list.length ? list.map(c => `<div class="msg-item${c.userId === state.me?.id ? ' mine' : ''}${c.kind === 'submit' ? ' submit' : ''}">
      <div class="msg-h"><b>${esc(c.user || '—')}</b>${c.kind === 'submit' ? '<span class="chip tone-review">сдал на проверку</span>' : ''}<span class="hint">${when(c.ts)}${c.editedAt ? ' · изменено' : ''}</span>${c.userId === state.me?.id && talkEdit?.cid !== c.id ? `<button class="edit-msg" type="button" data-act="talk-edit" data-cid="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>
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
          <div class="f"><label for="t-contractor" title="${contractorsArr().length ? 'Сверху — те, у кого этот раздел есть в специализации.' : 'Подрядчиков пока нет — добавьте их через «Создать → Подрядчик».'}">Подрядчик (внештатный)</label><select id="t-contractor" name="contractorId">${contractorOptions(marks, t.contractorId || '')}</select></div>
        </div>
        <div class="co-owners" id="co-box"></div>
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
    </div>`;
}

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
  const label = x => `${marksText(x)} · ${contractorOf(x)?.name || 'нет подрядчика'} · до ${fmtDate(x.finish)}`;
  const options = [...state.tasks.values()]
    .filter(x => x.id !== selfId && x.projectId === projectId && !chosen.includes(x.id) && !(state.drawer.id && L.wouldCycle(state.drawer.id, x.id, byId)))
    .sort(sortByDeadline);
  box.innerHTML = `${chosen.length ? `<div class="dep-list">${chosen.map(id => {
      const x = state.tasks.get(id), tm = timing(x);
      return `<div class="dep-row">${marksHtml(x)}<span class="dep-who">${esc(contractorOf(x)?.name || 'нет подрядчика')}</span>
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

/* ---------- message to the contractor ---------- */
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
      ${cell('Подрядчик', c ? esc(c.name) : '<span class="hint">—</span>', 'st-contr')}
      ${cell('Финиш', `${isDate(t.finish) ? `<span class="num">${fmtDate(t.finish)}</span><br>` : ''}<span class="due ${tm.cls}">${esc(tm.text)}</span>`)}
      ${cell('Статус', `${statusChip(t)} <span class="num hint" title="Готовность">${L.readiness(t)}%</span>`, 'st-status')}
      ${cell('Изм.', rev ? `<b class="num" title="от ${fmtDate(rev.date)}${rev.note ? ': ' + esc(rev.note) : ''}">${esc(rev.no)}</b><br><span class="hint num">${fmtDate(rev.date).slice(0, 5)}</span>` : '<span class="hint">—</span>', 'st-rev')}
    </div>
    <div class="st-acts" data-transient>
      ${keys.map(k => `<button class="btn sm ${k === 'accept' ? 'okbtn' : k === 'remarks' ? 'warnbtn' : k === 'submit' || k === 'start' ? 'primary' : ''}" data-act="quick" data-q="${k}" type="button">${QUICK[k].label}</button>`).join('')}
      ${keys.length ? `<input id="qa-note" class="qa-in" placeholder="${note}" maxlength="500" aria-label="Комментарий к действию">` : ''}
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

function formError(msg, tab) {
  const el = $('#form-err');
  if (el) { el.textContent = msg; el.hidden = !msg; }
  if (msg && tab) setDrawerTab(tab);
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
    contractorId: val('contractorId'), start: val('start'), finish: val('finish'),
    status: STATUSES[status] ? status : 'not_started', budget: parseMoney(val('budget')), note: val('note'),
    contractNo: val('contractNo'), contractDate: val('contractDate'),
    invoiceReceived: checked('invoiceReceived'), actSigned: checked('actSigned'), folder: val('folder'),
  };
  if (!data.projectId) return formError('Выберите проект.', 'main');
  if (!sections.length && !data.title) return formError('Выберите раздел или, для задачи без раздела, напишите уточнение в «Дополнительно».', 'main');
  if (old?.kind === 'assign' || $('#dform input[name="official"]')) Object.assign(data, { official: checked('official'), officialNo: val('officialNo'), officialBy: val('officialBy') });
  if (Number.isNaN(data.budget)) return formError('Бюджет — неотрицательное число, например 150000 или 150 000,50.', 'main');
  if (data.start && data.finish && data.finish < data.start) return formError('Финиш не может быть раньше старта.', 'main');
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
    if (!data.ownerId) return formError('Выберите ответственного в команде.', 'main');
    data.coOwnerIds = formOwners().filter(x => x !== data.ownerId);
    if (L.readinessManual(data.status)) {
      const r = Math.round(Number(val('readiness') || L.READY_MIN));
      if (!Number.isFinite(r) || r < L.READY_MIN || r > L.READY_MAX) return formError(`Готовность в работе — от ${L.READY_MIN} до ${L.READY_MAX} %: 90 % ставится сдачей на проверку, 100 % — приёмкой.`, 'main');
      data.readiness = r;
    }
    const misfit = formGaps();
    data.profileOk = misfit.length ? checked('profileOk') : false;
    if (misfit.length && !data.profileOk) return formError(`${misfit.join(' ')} Отметьте «Всё равно назначить», если это осознанно.`, 'main');
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
  if (quick === 'accept' && old) celebrateAccept(id);
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
  const bad = [...d.phases.flatMap(x => [x.start, x.finish, x.done]), ...d.milestones.map(x => x.date), ...d.requests.map(x => x.due), ...d.docs.map(x => x.until), d.protocol.date,
    ...d.ird.map(x => x.due), ...d.meetings.map(x => x.date), ...d.protocol.items.map(x => x.due), d.contract.date, ...d.payments.map(x => x.date), ...d.bills.flatMap(x => [x.date, x.due])].some(v => v && !isDate(v));
  if (bad) return { error: 'Проверьте даты на вкладке «Для заказчика».', tab: 'cust' };
  for (const ph of d.phases) if (isDate(ph.start) && isDate(ph.finish) && ph.finish < ph.start) return { error: `Этап «${L.phaseLabel(ph.key)}»: окончание раньше начала.`, tab: 'cust' };
  const keep = (list, f) => list.filter(x => String(x[f] || '').trim());
  return { data: {
    phases: d.phases, milestones: keep(d.milestones, 'title').map(m => ({ id: m.id || newId(), title: m.title.trim(), date: m.date || '', done: !!m.done })),
    // A request tied to a row of source data is closed when that row is accepted.
    requests: keep(d.requests, 'title').map(r => { const row = r.irdId && d.ird.find(x => x.id === r.irdId); return { id: r.id || newId(), title: r.title.trim(), due: r.due || '', why: (r.why || '').trim(), done: !!r.done || !!(row && ['accepted', 'done'].includes(row.status)), irdId: row ? row.id : '' }; }),
    docs: keep(d.docs, 'title').map(x => ({ id: x.id || newId(), title: x.title.trim(), until: x.until || '', remind: Math.max(0, Math.min(730, parseInt(x.remind, 10) || 60)) })),
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
const pdIn = (path, value, attrs = '') => `<input data-pd="${path}" value="${esc(value ?? '')}" ${attrs}>`;
const pdDate = (path, value) => `<input type="date" data-pd="${path}" value="${esc(value || '')}">`;
const pdSel = (path, opts, cur) => `<select data-pd="${path}">${opts.map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const pdChk = (path, on, label = '') => `<label class="chk"><input type="checkbox" data-pd="${path}"${on ? ' checked' : ''}>${label}</label>`;
function renderCustomer() {
  const box = $('#cust-box'), d = state.draft;
  if (!box || !d) return;
  const now = L.projectNow({ phases: d.phases, milestones: d.milestones }, state.today);
  const staff = liveUsers().filter(u => u.role !== 'specialist').sort(byName);
  const list = (key, cols, head, empty) => `<table class="pd-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}<th></th></tr></thead><tbody>
    ${d[key].map((x, i) => `<tr>${cols(x, i)}<td><button class="btn ghostbtn sm" type="button" data-act="pd-del" data-list="${key}" data-i="${i}" aria-label="Удалить">✕</button></td></tr>`).join('') || `<tr><td colspan="${head.length + 1}" class="hint">${empty}</td></tr>`}</tbody></table>
    <button class="btn sm" type="button" data-act="pd-add" data-list="${key}">+ Добавить</button>`;
  box.innerHTML = `<div class="cust-top"><span class="hint">${now.planned ? `Сейчас: <b>${esc(now.current?.label || '—')}</b> · ${now.behind ? `<span class="neg">отставание ${now.behind} дн.</span>` : 'по графику'}${now.next ? ` · до «${esc(now.next.title)}» ${now.daysToNext} дн.` : ''}` : 'Задайте даты этапов — по ним строится план и «N дней до…» на странице заказчика.'}</span><span class="spacer"></span>
      <button class="btn" type="button" data-act="cust-page" data-format="pdf">PDF</button><button class="btn primary" type="button" data-act="cust-page" data-format="html">Сохранить и создать страницу</button></div>
    <div class="sub"><h3>Этапы проекта</h3>${A.isGip(state.me) ? '' : '<p class="hint">Этап «Договор» ведёт ГИП.</p>'}
      <table class="pd-t"><thead><tr><th>Этап</th><th>Начало</th><th>Окончание</th><th>Завершён (факт)</th><th>Состояние</th></tr></thead><tbody>
      ${d.phases.map((ph, i) => { const st = L.phaseState(ph, state.today), has = isDate(ph.start) || isDate(ph.finish);
        return `<tr${ph.key === 'contract' ? ' class="gip-only" title="Видят только ГИПы"' : ''}><td><b>${esc(L.phaseLabel(ph.key))}</b>${ph.key === 'contract' ? ' <span class="chip tone-idle">только ГИП</span>' : ''}</td><td>${pdDate(`phases.${i}.start`, ph.start)}</td><td>${pdDate(`phases.${i}.finish`, ph.finish)}</td><td>${pdDate(`phases.${i}.done`, ph.done)}</td>
          <td>${has ? `<span class="chip tone-${{ done: 'ok', late: 'bad', now: 'work', next: 'idle' }[st]}">${{ done: 'завершён', late: 'просрочен', now: 'идёт', next: 'впереди' }[st]}</span>` : '<span class="hint">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="sub"><h3>Вехи</h3>${list('milestones', (x, i) => `<td class="grow">${pdIn(`milestones.${i}.title`, x.title, 'placeholder="Заключение экспертизы" maxlength="120"')}</td><td>${pdDate(`milestones.${i}.date`, x.date)}</td><td>${pdChk(`milestones.${i}.done`, x.done, ' пройдена')}</td>`, ['Веха', 'Дата', ''], 'Ключевые даты для заказчика: договор, ПД на экспертизу, заключение, выдача РД.')}</div>
    <div class="sub"><h3>Нужно от заказчика</h3>${list('requests', (x, i) => `<td class="grow">${pdIn(`requests.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}
        <div class="req-files">${(x.files || []).map((f, k) => `<span class="aq-file"><button class="linkbtn" type="button" data-act="att-open" data-fid="${esc(f.id)}" title="Открыть">${icon('file')}${esc(f.name)}</button><button class="linkbtn" type="button" data-act="req-unattach" data-i="${i}" data-k="${k}" aria-label="Убрать файл">✕</button></span>`).join('')}<button class="linkbtn" type="button" data-act="req-attach" data-i="${i}">+ файл для согласования</button></div></td><td>${pdDate(`requests.${i}.due`, x.due)}</td><td class="grow">${pdIn(`requests.${i}.why`, x.why, 'placeholder="Зачем: без них экспертиза не примет ИОС1" maxlength="200"')}</td><td>${pdChk(`requests.${i}.done`, x.done, ' получено')}</td>`, ['Что', 'Срок', 'Зачем', ''], 'Исходные данные, решения и ответы, которые ждём от заказчика. «Получено» убирает строку со страницы.')}</div>
    <div class="sub"><h3>Исходные данные</h3><p class="hint">Что нужно для проектирования и в каком оно состоянии — вкладка «Исходные данные» у заказчика. «Запросить» ставит строку в «Нужно от вас»: заказчик отвечает прямо со страницы, ответ приходит сюда — его можно принять или вернуть с замечанием.</p>${list('ird', (x, i) => { const rq = irdRequest(x);
        return `<td>${pdSel(`ird.${i}.kind`, IRD_KINDS, x.kind || irdKindOf(x.title))}</td><td class="grow">${pdIn(`ird.${i}.title`, x.title, 'placeholder="ТУ на электроснабжение 630 кВт" maxlength="160"')}</td><td>${pdIn(`ird.${i}.who`, x.who, 'placeholder="Заказчик" maxlength="60" list="ird-who"')}</td>
        <td>${pdSel(`ird.${i}.status`, IRD_STATUS, x.status)}</td><td>${pdDate(`ird.${i}.due`, x.due)}</td><td class="grow">${pdIn(`ird.${i}.note`, x.note, 'placeholder="Примечание для заказчика" maxlength="200"')}</td>
        <td class="nowrap">${rq ? `<span class="chip tone-work" title="${esc(rq.title)}">запрошено${rq.due ? ' до ' + fmtDate(rq.due).slice(0, 5) : ''}</span>` : ['accepted', 'done'].includes(x.status) ? '' : `<button class="btn sm" type="button" data-act="ird-request" data-i="${i}">Запросить</button>`}</td>`; }, ['Тип', 'Что нужно', 'Кто готовит', 'Статус', 'Срок', 'Примечание', ''], 'Задание на проектирование, ГПЗУ, ТУ, письма, согласования…')}
      <div class="row-in">${irdAskable().length ? `<button class="btn sm" type="button" data-act="ird-request-all">Запросить у заказчика всё недостающее (${irdAskable().length})</button>` : ''}${(d.requests || []).some(r => !r.done && r.title) ? '<button class="btn ghostbtn sm" type="button" data-act="ird-letter">Текст письма-запроса</button>' : ''}</div>
      <datalist id="ird-who"><option value="Заказчик"><option value="«Тандем»"><option value="Изыскатели"><option value="«Тандем» по доверенности"><option value="Заказчик и «Тандем»"></datalist>
      ${Techcard.SOURCE_DATA.some(([t]) => !d.ird.some(x => x.title.trim().toLowerCase() === t.toLowerCase())) ? `<button class="btn sm" type="button" data-act="ird-techcard">${d.ird.length ? 'Дополнить по техкарте' : 'Заполнить по техкарте'}</button>` : ''}</div>
    <div class="sub"><h3>Последняя договорённость</h3><div class="row-in">Протокол № ${pdIn('protocol.no', d.protocol.no, 'class="sm-in" maxlength="20"')} от ${pdDate('protocol.date', d.protocol.date)}</div>
      <table class="pd-t"><thead><tr><th>Пункт</th><th>Кто</th><th>Срок</th><th>Статус</th><th>%</th><th></th></tr></thead><tbody>
      ${d.protocol.items.map((x, i) => `<tr><td class="grow">${pdIn(`protocol.items.${i}.text`, x.text, 'placeholder="Ответы экспертизе по КР" maxlength="200"')}</td>
        <td><select data-pd="protocol.items.${i}.who"><option value="us"${x.who !== 'customer' ? ' selected' : ''}>мы</option><option value="customer"${x.who === 'customer' ? ' selected' : ''}>заказчик</option></select></td>
        <td>${pdDate(`protocol.items.${i}.due`, x.due)}</td>
        <td><select data-pd="protocol.items.${i}.status">${PROTO_STATUS.map(([k, l]) => `<option value="${k}"${x.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${pdIn(`protocol.items.${i}.pct`, x.pct || '', 'class="sm-in" inputmode="numeric" placeholder="—"')}</td>
        <td><button class="btn ghostbtn sm" type="button" data-act="pd-del" data-list="protocol.items" data-i="${i}" aria-label="Удалить">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="hint">Пункты протокола последней встречи — заказчик увидит их со статусом.</td></tr>'}</tbody></table>
      <button class="btn sm" type="button" data-act="pd-add" data-list="protocol.items">+ Пункт</button></div>
    <div class="sub"><h3>Встречи</h3><p class="hint">Ближайшая встреча — на главной и во «Встречах» у заказчика, с кнопками «В календарь» и «Перенести»; прошедшие — с номером протокола.</p>${list('meetings', (x, i) => `<td>${pdDate(`meetings.${i}.date`, x.date)}</td><td>${pdIn(`meetings.${i}.from`, x.from, 'class="sm-in" placeholder="11:00" maxlength="5"')}–${pdIn(`meetings.${i}.to`, x.to, 'class="sm-in" placeholder="12:00" maxlength="5"')}</td>
        <td class="grow">${pdIn(`meetings.${i}.title`, x.title, 'placeholder="Совещание по замечаниям экспертизы" maxlength="160"')}</td><td class="grow">${pdIn(`meetings.${i}.place`, x.place, 'placeholder="онлайн или адрес" maxlength="160"')}</td><td>${pdIn(`meetings.${i}.protocolNo`, x.protocolNo, 'class="sm-in" placeholder="№" maxlength="20"')}</td>`, ['Дата', 'Время', 'Тема', 'Где', 'Протокол'], 'Встречи с заказчиком: прошедшие и ближайшая.')}</div>
    <div class="sub"><h3>Сроки документов</h3>${list('docs', (x, i) => `<td class="grow">${pdIn(`docs.${i}.title`, x.title, 'placeholder="ТУ на водоснабжение и водоотведение" maxlength="160"')}</td><td>${pdDate(`docs.${i}.until`, x.until)}</td><td>за ${pdIn(`docs.${i}.remind`, x.remind ?? 60, 'class="sm-in" inputmode="numeric"')} дн.</td>`, ['Документ', 'Действует до', 'Напомнить в сводке'], 'ТУ, ГПЗУ, изыскания — когда истекают. Напоминание появится в сводке.')}</div>
    ${A.isGip(state.me) ? `<div class="sub"><h3>Договор и финансы <span class="chip tone-idle">только ГИП</span></h3><p class="hint">Договор заказчика с «Тандемом» — не путать с бюджетами подрядчиков. Пока номер договора пуст, вкладки «Договор и финансы» у заказчика нет.</p>
      <div class="fgrid"><div class="f"><label>Номер договора</label>${pdIn('contract.no', d.contract.no, 'placeholder="26/07-12" maxlength="40"')}</div><div class="f"><label>Дата</label>${pdDate('contract.date', d.contract.date)}</div>
        <div class="f wide"><label>Предмет</label>${pdIn('contract.subject', d.contract.subject, 'placeholder="Инженерные изыскания и проектная документация, стадия П" maxlength="200"')}</div>
        <div class="f"><label>Стоимость, ₽</label>${pdIn('contract.sum', d.contract.sum, 'inputmode="decimal" placeholder="4 860 000" maxlength="20"')}</div><div class="f"><label>Статус</label>${pdSel('contract.status', CONTRACT_STATUS, d.contract.status)}</div></div>
      <h4>График оплат</h4>${list('payments', (x, i) => `<td class="grow">${pdIn(`payments.${i}.title`, x.title, 'placeholder="Аванс" maxlength="120"')}</td><td>${pdIn(`payments.${i}.sum`, x.sum, 'inputmode="decimal" placeholder="1 458 000" maxlength="20"')}</td><td class="grow">${pdIn(`payments.${i}.cond`, x.cond, 'placeholder="при подписании" maxlength="120"')}</td><td>${pdSel(`payments.${i}.status`, PAY_STATUS, x.status)}</td><td>${pdDate(`payments.${i}.date`, x.date)}</td>`, ['Этап', 'Сумма', 'Условие', 'Статус', 'Дата'], 'Аванс, оплата за этапы, окончательный расчёт.')}
      <h4>Счета и акты</h4>${list('bills', (x, i) => `<td class="grow">${pdIn(`bills.${i}.title`, x.title, 'placeholder="Акт № 2 по проектной документации" maxlength="160"')}</td><td>${pdDate(`bills.${i}.date`, x.date)}</td><td>${pdSel(`bills.${i}.status`, BILL_STATUS, x.status)}</td><td>${pdDate(`bills.${i}.due`, x.due)}</td>`, ['Документ', 'Дата', 'Статус', 'Оплатить до'], 'Счета и акты по договору — без файлов, только статус.')}</div>` : ''}
    <div class="sub"><h3>Рекомендация ГИПа и контакт</h3>
      <div class="fgrid"><div class="f wide"><label>Заголовок</label>${pdIn('advice.title', d.advice.title, 'placeholder="Рабочая документация на сети" maxlength="120"')}</div>
        <div class="f wide"><label>Текст</label><textarea data-pd="advice.text" maxlength="600" placeholder="Что посоветовать заказчику на этом этапе">${esc(d.advice.text)}</textarea></div>
        <div class="f"><label>Контакт на странице</label><select data-pd="contactId"><option value="">— не показывать —</option>${staff.map(u => `<option value="${esc(u.id)}"${u.id === d.contactId ? ' selected' : ''}>${esc(u.name)}${u.phone ? '' : ' (нет телефона)'}</option>`).join('')}</select><span class="hint">Телефон и почта — из карточки сотрудника.</span></div></div></div>
    <div class="sub"><h3>Что показывать заказчику</h3><div class="pd-show">${pdChk('show.plan', d.show.plan, ' план и вехи')}${pdChk('show.sections', d.show.sections, ' разделы проекта')}${pdChk('show.advice', d.show.advice, ' рекомендация ГИПа')}${pdChk('show.revisions', d.show.revisions, ' номера изменений')}${pdChk('show.ird', d.show.ird, ' исходные данные')}${pdChk('show.meetings', d.show.meetings, ' встречи и протокол')}${pdChk('show.team', d.show.team, ' команда проекта (участники)')}${A.isGip(state.me) ? pdChk('show.finance', d.show.finance, ' договор и финансы') : ''}${pdChk('show.soon', d.show.soon, ' «Навигатор» и «3D-модель» с пометкой «скоро»')}</div>
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
  docs: () => ({ id: newId(), title: '', until: '', remind: 60 }), 'protocol.items': () => ({ id: newId(), text: '', who: 'us', status: 'work', pct: '', due: '' }),
  ird: () => ({ id: newId(), title: '', kind: 'doc', who: 'Заказчик', status: 'plan', due: '', note: '' }), meetings: () => ({ id: newId(), date: '', from: '', to: '', title: '', place: '', protocolNo: '' }),
  payments: () => ({ id: newId(), title: '', sum: '', cond: '', status: 'upcoming', date: '' }), bills: () => ({ id: newId(), title: '', date: '', status: 'to_pay', due: '' }) };
const draftList = key => key.split('.').reduce((o, k) => o[k], state.draft);

/* ---------- customer cabinet (server): publication, access, messages ---------- */
let cab = null;          // view from the main process: { allowed, configured, url, published, messages, lastSync, lastError }
let cabCustomers = null; // customer accounts on the server, loaded when the «Для заказчика» tab is shown
let cabPw = null;        // { name, login, password } — shown once after creating or resetting
let cabLoadErr = '';
const CAB_KINDS = { answer: 'Ответ на запрос', call: 'Просьба перезвонить', urgent: 'Горящий вопрос', question: 'Вопрос', meeting: 'Перенос встречи' };
// The customer's verdict on files sent for approval.
const decisionChip = m => (m?.decision === 'approve' ? ' <span class="chip tone-ok">Согласовано</span>' : m?.decision === 'remarks' ? ' <span class="chip tone-warn">Есть замечания</span>' : '');
const cabTime = ts => { const d = new Date(ts); return Number.isNaN(+d) ? '' : `${fmtDate(ts.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function setCab(v) {
  const unreadBefore = cab?.messages?.filter(m => !m.read).length || 0, countBefore = cab?.messages?.length || 0;
  cab = v;
  if (document.querySelector('.settings-modal')) renderSettings();
  if ($('#cab-box')) { renderCabinetBox(); if ((cab?.messages?.length || 0) !== countBefore) loadCabCustomers(true); } // «последний вход» moves with new messages
  const unread = cab?.messages?.filter(m => !m.read).length || 0;
  if (state.loaded && (state.tab === 'overview' || unread !== unreadBefore)) render();
}
async function loadCabCustomers(force = false) {
  if (!cab?.configured || (cabCustomers && !force)) return;
  const r = await api.cabinetCustomers();
  cabLoadErr = r.ok ? '' : r.message;
  cabCustomers = r.ok ? r.customers : cabCustomers;
  renderCabinetBox();
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
    ${cabLoadErr ? `<p class="neg">${esc(cabLoadErr)} <button class="linkbtn" type="button" data-act="cab-reload">Повторить</button></p>` : !cabCustomers ? '<p class="hint">Загружаем…</p>' : ''}
    ${linked.length ? `<div class="cab-people">${linked.map(c => `<div class="cab-person"><div class="grow"><b>${esc(c.name)}</b> <span class="hint">${esc(c.login)}</span>${c.disabled ? ' <span class="chip tone-bad">вход закрыт</span>' : ''}<br><span class="hint">${c.lastLoginAt ? 'последний вход ' + cabTime(c.lastLoginAt) : 'ещё не входил'}</span></div>
      <div class="acts"><button class="btn ghostbtn sm" type="button" data-act="cab-reset" data-id="${esc(c.id)}">Новый пароль</button><button class="btn ghostbtn sm" type="button" data-act="cab-toggle" data-id="${esc(c.id)}">${c.disabled ? 'Открыть вход' : 'Закрыть вход'}</button><button class="btn ghostbtn sm" type="button" data-act="cab-unlink" data-id="${esc(c.id)}">Убрать из проекта</button></div></div>`).join('')}</div>`
      : cabCustomers ? '<p class="hint">Пока никто. Добавьте представителя заказчика — программа создаст логин и пароль.</p>' : ''}
    ${cabCustomers ? `<div class="row-in cab-add"><input id="cab-name" placeholder="Имя: Иванов Иван, ООО «Заказчик»" maxlength="120"><input id="cab-login" placeholder="Логин: ivanov" maxlength="80"><button class="btn sm" type="button" data-act="cab-add">Открыть доступ</button></div>
      ${others.length ? `<div class="row-in cab-add"><select id="cab-other"><option value="">— уже есть в кабинете —</option>${others.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.login)})</option>`).join('')}</select><button class="btn sm" type="button" data-act="cab-link">Добавить к проекту</button></div>` : ''}` : ''}
    ${msgs.length ? `<h4>Сообщения от заказчика</h4>${msgs.map(m => { const req = m.requestId && state.draft?.requests.find(r => r.id === m.requestId);
      return `<div class="cab-msg${m.read ? ' read' : ''}${m.kind === 'urgent' ? ' urgent' : ''}"><div><b>${esc(CAB_KINDS[m.kind] || 'Сообщение')}${m.requestTitle ? `: ${esc(m.requestTitle)}` : ''}${m.meetingTitle ? `: ${esc(m.meetingTitle)}` : ''}${m.to ? ` → ${esc(m.to)}` : ''}</b>${decisionChip(m)} <span class="hint">${esc(m.customerName)} · ${cabTime(m.ts)}</span></div><div class="cab-text">${esc(m.text)}</div>
        <div>${m.read ? '' : `<button class="btn ghostbtn sm" type="button" data-act="cab-read" data-id="${esc(m.id)}">Прочитано</button>`}${req && !req.done ? (req.irdId ? `<button class="btn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Принять</button><button class="btn ghostbtn sm" type="button" data-act="cab-remark" data-id="${esc(m.id)}">Вернуть с замечанием</button>` : `<button class="btn ghostbtn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Отметить запрос «получено»</button>`) : ''}</div></div>`; }).join('')}` : ''}
  </div>`;
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
    ${cab?.lastSync ? `<p class="hint">Последняя связь: ${cabTime(cab.lastSync)}</p>` : ''}<p class="neg" id="c-err"></p>
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
      <button class="btn" type="button" data-act="comp-export" data-format="sp">Состав ПД → Word</button><button class="btn" type="button" data-act="comp-export" data-format="vok"${rdRows.size ? '' : ' disabled'}>ВОК → Word</button><button class="btn ghostbtn" type="button" data-act="comp-export" data-format="xlsx">Excel</button></div>
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
// Working documentation rows: chips toggle a suggested mark for a section; own rows; order.
const rdItem = id => (state.draft.composition.rd || []).find(x => x.id === id);
function rdInsert(item) {
  const comp = state.draft.composition, list = comp.rd || (comp.rd = []);
  const order = new Map(Composition.walk(comp.nodes).map((r, i) => [r.node.id, i]));
  const pos = id => (order.has(id) ? order.get(id) : Infinity);
  let at = list.length;
  if (item.pdId) { at = 0; list.forEach((x, i) => { if (pos(x.pdId) <= pos(item.pdId)) at = i + 1; }); }
  list.splice(at, 0, item);
}
const rdNew = (pdId, mark = '', title = '') => ({ id: Composition.newId(), pdId, mark, title, on: true, code: '', tom: '', note: '', ownerId: '', contractorId: '', taskId: '' });
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
let confirmCompDel = null;
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
  const ph = k => (p.phases || []).find(x => x.key === k) || {};
  const ms = (p.milestones || []).map(m => ({ ...m }));
  const rows = [['p', 'Стадия П', true], ['expertise', 'Экспертиза', false], ['r', 'Стадия Р', true], ['an', 'Авторский надзор', false]];
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const msRow = (m, i) => `<div class="tq-ms" data-i="${i}"><input class="tq-ms-t" value="${esc(m.title || '')}" placeholder="Например: выдача ТУ, оплата аванса, сдача сметы" maxlength="120"><input class="tq-ms-d" type="date" value="${esc(m.date || '')}"><button class="btn ghostbtn sm" type="button" data-m="ms-del" aria-label="Убрать">✕</button></div>`;
    root.innerHTML = `<form class="modal tq-modal" role="dialog" aria-modal="true" aria-labelledby="tltitle" novalidate><h2 id="tltitle">Сроки по договору · ${esc(p.name || '')}</h2>
      <p class="hint">По этим срокам программа расставит предварительные даты разделов по волнам техкарты и сроки заданий смежникам. Можно заполнить потом: кнопка «Сроки» на странице проекта.</p>
      <div class="tq-grid"><span></span><b>Начало</b><b>Окончание</b>
        ${rows.map(([k, l, main]) => `<span class="${main ? 'req' : ''}">${l}</span><input type="date" id="tq-${k}-s" value="${esc(ph(k).start || '')}"><input type="date" id="tq-${k}-f" value="${esc(ph(k).finish || '')}">`).join('')}</div>
      <div class="tq-mode"><span class="lbl">Рабочая документация</span>
        <label class="chk"><input type="radio" name="tq-mode" value="after"${p.rdMode !== 'parallel' ? ' checked' : ''}> после экспертизы</label>
        <label class="chk"><input type="radio" name="tq-mode" value="parallel"${p.rdMode === 'parallel' ? ' checked' : ''}> параллельно с экспертизой</label>
        <span class="hint" id="tq-hint"></span></div>
      <div class="tq-ms-box"><span class="lbl">Иные сроки по договору</span><div id="tq-ms">${ms.map(msRow).join('')}</div><button class="btn sm" type="button" data-m="ms-add">+ срок</button></div>
      <div class="err" id="tq-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить сроки</button><button class="btn" type="button" data-m="cancel">Заполню потом</button></div></form>`;
    document.body.append(root);
    const q = sel => root.querySelector(sel), v = id => q('#' + id).value;
    const next = d => (isDate(d) ? addDays(d, 1) : '');
    // Р starts the day after expertise (or after П when parallel) unless already set by hand.
    const suggest = () => {
      const mode = q('input[name="tq-mode"]:checked').value, rs = q('#tq-r-s');
      const from = mode === 'parallel' ? v('tq-p-f') : v('tq-expertise-f') || v('tq-p-f');
      if (!rs.value || rs.dataset.auto) { rs.value = next(from); rs.dataset.auto = rs.value ? '1' : ''; }
      if (!q('#tq-expertise-s').value && v('tq-p-f')) q('#tq-expertise-s').value = next(v('tq-p-f'));
      q('#tq-hint').textContent = mode === 'parallel' ? 'Р стартует сразу после П; замечания экспертизы правятся в обоих.' : 'Р стартует после положительного заключения.';
    };
    const close = r => { root.remove(); resolve(r); };
    root.addEventListener('change', e => { if (e.target.id === 'tq-r-s') e.target.dataset.auto = ''; suggest(); });
    root.addEventListener('click', e => {
      const m = e.target.dataset.m;
      if (e.target === root || m === 'cancel') close(false);
      if (m === 'ms-add') { q('#tq-ms').insertAdjacentHTML('beforeend', msRow({}, Date.now())); q('#tq-ms .tq-ms:last-child .tq-ms-t').focus(); }
      if (m === 'ms-del') e.target.closest('.tq-ms').remove();
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } });
    suggest();
    q('#tq-p-s').focus();
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const err = t => { q('#tq-err').textContent = t; q('#tq-err').hidden = !t; };
      const phases = (p.phases?.length ? p.phases : L.defaultPhases()).map(x => ({ ...x }));
      for (const [k, l] of rows) {
        const st = v(`tq-${k}-s`), fi = v(`tq-${k}-f`);
        if (st && fi && fi < st) return err(`${l}: окончание раньше начала.`);
        let x = phases.find(y => y.key === k);
        if (!x) phases.push(x = { key: k, start: '', finish: '', done: '' });
        x.start = st; x.finish = fi;
      }
      const old = new Map(ms.map(m => [m.id, m]));
      const milestones = [...root.querySelectorAll('.tq-ms')].map(r => ({ title: r.querySelector('.tq-ms-t').value.trim(), date: r.querySelector('.tq-ms-d').value }))
        .filter(m => m.title).map((m, i) => { const was = ms[i] && old.get(ms[i].id); return { id: was?.title === m.title ? was.id : newId(), title: m.title, date: m.date, done: !!(was?.title === m.title && was.done) }; });
      const rdMode = q('input[name="tq-mode"]:checked').value;
      const ok = await write(op.update('projects', p.id, { phases, milestones, rdMode }), 'Сроки проекта сохранены');
      if (ok) close(true);
    });
  });
}
// Tech card as an in-app reference: the same model (techcard.js) the generator uses for assignments and waves.
const TC_SECS = [['stages', 'Этапы'], ['source', 'Исходные данные'], ['waves', 'Волны ПД'], ['assign', 'Задания смежникам'], ['rd', 'ПД → РД'], ['summary', 'Сводные разделы']];
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

/* ---------- project & contractor ---------- */
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
      <div class="f"><label for="pr-client">Заказчик / ГИП</label><input id="pr-client" name="client" value="${esc(p.client || '')}" maxlength="160"></div>
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
  formError('');
  const created = { createdAt: new Date().toISOString() };
  let ok = false;
  if (kind === 'project') {
    const data = { name: val('name'), code: val('code'), client: val('client'), status: L.PROJECT_STATUSES[val('status')] ? val('status') : '', folder: val('folder'), note: val('note') };
    if (!data.name) return formError('Укажите название объекта.');
    if (id) {
      if (projectDraftData().error) { const e = projectDraftData(); return formError(e.error, e.tab); }
      // Every section of the composition is a task: missing ones are made (or linked) in the same batch.
      const made = compTaskOps(state.draft.composition, id, data.code);
      const extra = projectDraftData();
      const parts = [made.created ? `задач по разделам: ${made.created}` : '', made.linked ? `привязано карточек: ${made.linked}` : '', made.assigns ? `заданий смежникам: ${made.assigns}` : ''].filter(Boolean);
      ok = await write([...made.ops, op.update('projects', id, { ...data, ...extra.data })], parts.length ? `Проект сохранён: ${parts.join(', ')}` : 'Проект сохранён');
    }
    else {
      const pid = newId(), gen = !!$('#pr-gen')?.checked;
      ok = await write(op.set('projects', pid, { ...data, ...created }), 'Проект добавлен');
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
    const data = { name: val('name'), specialty: val('specialty'), phone: val('phone'), email: val('email'), messenger: val('messenger'), requisites: val('requisites'), note: val('note') };
    if (!data.name) return formError('Укажите ФИО или название исполнителя.');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.');
    ok = id ? await write(op.update('contractors', id, data), 'Исполнитель сохранён')
      : await write(op.set('contractors', newId(), { ...data, ...created }), 'Исполнитель добавлен');
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
  $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm">${esc(text)}
    <span class="confirm-acts">${blocked ? '' : '<button class="btn danger solid sm" data-act="do-delete" type="button">В корзину</button>'}
    <button class="btn sm" data-act="cancel-delete" type="button">${blocked ? 'Понятно' : 'Отмена'}</button></span></div></div>`;
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
  else ops = [op.update('contractors', id, { deletedAt: at })];
  if (await write(ops)) {
    closeDrawer();
    toast('Перемещено в корзину', false, { label: 'Отменить', run: () => restoreItem(kind === 'task' ? 'tasks' : kind + 's', id) });
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
  const people = state.trash.contractors.map(c => item('contractors', c, esc(c.name), 'исполнитель'));
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
  if (!full) return theme + zoomHtml;
  return theme + zoomHtml + `
    <div class="vm-sec"><span class="vm-h">Панель вкладок</span><div class="seg">${NAV_POS.map(([k, l]) => `<button class="btn sm ${nav.pos === k ? 'on' : ''}" type="button" data-act="nav-pos" data-v="${k}">${l}</button>`).join('')}</div>
      ${nav.pos === 'left' ? `<label class="chk vm-mini"><input type="checkbox" data-act="nav-mini-chk"${nav.mini ? ' checked' : ''}> Только значки</label>` : ''}</div>
    <div class="vm-sec"><span class="vm-h">Строки в таблицах и списках</span><div class="seg"><button class="btn sm ${dense ? '' : 'on'}" type="button" data-act="set-dense" data-v="0">Просторно</button><button class="btn sm ${dense ? 'on' : ''}" type="button" data-act="set-dense" data-v="1">Компактно</button></div></div>
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

/* ---------- quick search (Ctrl+K) ---------- */
function searchAll(query) {
  const words = query.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const norm = v => String(v ?? '').toLowerCase().replace(/ё/g, 'е');
  const match = hay => words.every(w => hay.includes(w));
  const out = [];
  for (const t of state.tasks.values()) {
    const p = projectOf(t), c = contractorOf(t);
    const hay = norm([sectionsOf(t).join(' '), t.title, p?.name, p?.code, c?.name, t.contractNo, t.note].join(' '));
    if (match(hay)) out.push({ kind: 'task', id: t.id, rank: 0, title: marksText(t), sub: `${p?.name || '—'} · ${c?.name || 'нет подрядчика'} · ${timing(t).text}`, archived: !!p?.archived });
  }
  for (const p of state.projects.values()) {
    if (match(norm([p.name, p.code, p.client].join(' ')))) out.push({ kind: 'project', id: p.id, rank: 1, title: p.name, sub: `проект${p.code ? ' · ' + p.code : ''}${p.archived ? ' · в архиве' : ''}` });
  }
  for (const c of state.contractors.values()) {
    if (match(norm([c.name, c.specialty, c.phone, c.email, c.messenger].join(' ')))) out.push({ kind: 'contractor', id: c.id, rank: 2, title: c.name, sub: `подрядчик${c.specialty ? ' · ' + c.specialty : ''}` });
  }
  return out.sort((a, b) => a.archived - b.archived || a.rank - b.rank).slice(0, 14);
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
  let best = null, bestN = 0;
  for (const p of liveProjects()) {
    const hay = norm(`${p.name} ${p.code}`), n = left.filter(w => w.length > 1 && hay.includes(norm(w))).length;
    if (n > bestN) { best = p; bestN = n; }
  }
  if (best) { out.projectId = best.id; const hay = norm(`${best.name} ${best.code}`); out.title = left.filter(w => !(w.length > 1 && hay.includes(norm(w)))).join(' '); }
  else { out.title = left.join(' '); out.problems.push('проект не найден — напишите часть названия или шифр'); }
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
function openPalette() {
  if (document.querySelector('.palette-back')) return;
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'palette-back';
  root.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Поиск">
    <input id="pal-q" placeholder="Поиск: раздел, объект, подрядчик… · «+ ЭОМ Корпус 3 до 15.12 @Орлов» — новая карточка" autocomplete="off" spellcheck="false">
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
    items = searchAll(input.value);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.length ? items.map((it, i) => `<div class="pal-item ${i === sel ? 'sel' : ''}" role="option" aria-selected="${i === sel}" data-i="${i}">
        <span class="pal-kind">${kindLabel[it.kind]}</span><span class="pal-t">${esc(it.title)}</span><span class="pal-s hint">${esc(it.sub)}</span></div>`).join('')
      : `<div class="none">${input.value.trim() ? 'Ничего не найдено.' : 'Начните вводить — например «СКУД» или фамилию исполнителя.'}</div>`;
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => root.remove();
  const go = it => {
    if (!it) return;
    close();
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    if (it.kind === 'task') openTask(it.id);
    else if (it.kind === 'contractor') openContractor(it.id);
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
  draw();
  input.focus();
}

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
  switch (act) {
    case 'file-menu': setFileMenu($('#file-menu').hidden); break;
    case 'att-menu': setAttMenu(!attOpen); break;
    case 'create-menu': setCreateMenu($('#create-menu').hidden); break;
    case 'customer-pdf': customerPdf(); break;
    case 'tip-close': closeTip(el.dataset.tip); break;
    case 'tips-reset': tipsClosed.clear(); saveLocal('tipsClosed', []); renderNow(); break;
    case 'cols-pop': colsOpen = !colsOpen; el.closest('.cols-wrap').querySelector('.cols-menu').hidden = !colsOpen; break;
    case 'tab-move': moveTab(id, Number(el.dataset.dir)); break;
    case 'tabs-reset': setTabOrder([]); break;
    case 'thank': thank(el.dataset.task, el.dataset.cid); break;
    case 'open-task-folder': e.stopPropagation(); openTaskFolder(id); break;
    case 'pick-task-folder': pickTaskFolder(); break;
    case 'suggest-task-folder': suggestTaskFolder(); break;
    case 'rev-add': addRevision(); break;
    case 'rev-del': state.draft.revisions.splice(Number(el.dataset.i), 1); renderRevisions(); break;
    case 'project-timeline': { const pr = state.projects.get(id); if (pr) askTimeline(pr).then(ok => ok && refresh()); break; }
    case 'techcard': openTechcard(el.dataset.sec || 'stages'); break;
    case 'delete-all-projects': deleteAllProjects(); break;
    case 'autobackup': autoBackupMenu(); break;
    case 'comp-base': state.draft.composition = Composition.fromBase(el.dataset.v); renderComposition(); break;
    case 'comp-add': compAdd(id); break;
    case 'comp-del': compDel(id); break;
    case 'comp-rd-suggest': state.draft.composition.rd = Composition.rdDefaults(state.draft.composition); renderComposition(); break;
    case 'rd-chip': rdChip(el.dataset.pd, el.dataset.mark); break;
    case 'rd-add': rdAdd(el.dataset.pd); break;
    case 'rd-del': rdDel(id); break;
    case 'rd-move': rdMove(id, Number(el.dataset.dir)); break;
    case 'comp-export': compExport(el.dataset.format); break;
    case 'cab-remark': cabRemark(id); break;
    case 'ird-request': { const x = state.draft.ird[Number(el.dataset.i)]; if (x?.title) { irdAsk(x); renderCustomer(); toast('Запрос добавлен в «Нужно от заказчика». Сохраните проект — заказчик увидит его на странице.'); } break; }
    case 'ird-request-all': { const list = irdAskable(); list.forEach(irdAsk); renderCustomer(); toast(`Запрошено: ${list.length}. Сохраните проект — заказчик увидит запросы на странице.`); break; }
    case 'ird-letter': navigator.clipboard.writeText(irdLetterText()).then(() => toast('Текст письма-запроса скопирован — вставьте в письмо или на бланк.'), () => toast('Не удалось скопировать.', true)); break;
    case 'ird-techcard': state.draft.ird.push(...Techcard.SOURCE_DATA.filter(([t]) => !state.draft.ird.some(x => x.title.trim().toLowerCase() === t.toLowerCase())).map(([title, who]) => ({ id: newId(), title, kind: irdKindOf(title), who: who === 'Изыскатели' ? '«Тандем»' : who.replace('Заказчик / технолог', 'Заказчик'), status: 'plan', due: '', note: '' }))); renderCustomer(); break;
    case 'pd-add': draftList(el.dataset.list).push(PD_NEW[el.dataset.list]()); renderCustomer(); break;
    case 'pd-del': draftList(el.dataset.list).splice(Number(el.dataset.i), 1); renderCustomer(); break;
    case 'cust-page': customerPage(el.dataset.format); break;
    case 'cab-settings': openCabinetSettings(); break;
    case 'cab-local-start': el.disabled = true; el.textContent = 'Запускаем…'; api.cabinetLocalStart().then(r => { if (!r.ok) { toast(r.message, true); el.disabled = false; el.textContent = 'Запустить кабинет на этом компьютере'; return; } cabCustomers = null; cabLoadErr = ''; toast(`Кабинет запущен${r.lan[0] ? ` · адрес для заказчиков: ${r.lan[0]}` : ''}`); }); break;
    case 'cab-local-stop': api.cabinetLocalStop().then(r => { if (r.ok) { cabCustomers = null; toast('Кабинет на этом компьютере остановлен. Данные сохранены — при новом запуске всё вернётся.'); } }); break;
    case 'cab-publish': cabPublish(); break;
    case 'cab-unpublish': cabAction(api.cabinetUnpublish(state.drawer?.id), 'Снято с публикации: заказчик больше не видит проект'); break;
    case 'cab-open': api.cabinetOpen(state.drawer?.id); break;
    case 'cab-add': cabAdd(); break;
    case 'cab-link': { const cid = $('#cab-other').value, c = cabCustomer(cid); if (c) cabPatch(cid, { projectIds: [...c.projectIds, state.drawer.id] }, `${c.name}: проект добавлен`); break; }
    case 'cab-unlink': { const c = cabCustomer(id); if (c) cabPatch(id, { projectIds: c.projectIds.filter(x => x !== state.drawer.id) }, `${c.name} больше не видит проект`); break; }
    case 'cab-reset': cabPatch(id, { resetPassword: true }, 'Новый пароль создан, старый больше не действует'); break;
    case 'cab-toggle': { const c = cabCustomer(id); if (c) cabPatch(id, { disabled: !c.disabled }, c.disabled ? 'Вход открыт' : 'Вход закрыт'); break; }
    case 'cab-reload': cabLoadErr = ''; cabCustomers = null; loadCabCustomers(true); break;
    case 'cab-pw-hide': cabPw = null; renderCabinetBox(); break;
    case 'cab-pw-copy': if (cabPw) copyText(`Кабинет заказчика: ${cab.publicUrl || cab.url}\nЛогин: ${cabPw.login}\nПароль: ${cabPw.password}`).then(ok => toast(ok ? 'Скопировано — вставьте в письмо или мессенджер' : 'Не удалось скопировать', !ok)); break;
    case 'cab-read': api.cabinetRead([id]); break;
    case 'cab-got': cabMarkGot(id); break;
    case 'req-attach': { const x = state.draft?.requests?.[Number(el.dataset.i)], pid = state.drawer?.id; if (x && pid) api.attachAdd(pid).then(r => { if (r?.ok) { x.files = [...(x.files || []), r.file]; renderCustomer(); toast('Файл приложен — сохраните проект, и заказчик увидит его в кабинете.'); } else if (r && !r.canceled) toast(r.message, true); }); break; }
    case 'req-unattach': { const x = state.draft?.requests?.[Number(el.dataset.i)]; if (x) { x.files = (x.files || []).filter((_, k) => k !== Number(el.dataset.k)); renderCustomer(); } break; }
    case 'att-open': { const pid = state.drawer?.id; if (pid) api.attachOpen(pid, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть', true); }); break; }
    case 'cab-read-all': api.cabinetRead(cab.messages.filter(m => !m.read).map(m => m.id)); break;
    case 'cab-open-msg': { const m = cab.messages.find(x => x.id === id); if (m) { api.cabinetRead([id]); if (state.projects.has(m.projectId)) openProject(m.projectId, 'cust'); } break; }
    case 'open-project-cust': openProject(id, 'cust'); break;
    case 'g-mode': setGantt({ mode: el.dataset.v }); break;
    case 'set-font': brandFont = el.dataset.v === 'montserrat' ? 'montserrat' : 'golos'; saveLocal('brandFont', brandFont); applyBrandFont(); renderViewMenu(); if (document.querySelector('.settings-modal')) renderSettings(); break;
    case 'set-game': game = el.dataset.v === '1'; saveLocal('game', game); renderNow(); break;
    case 'office-person': officePerson(id); break;
    case 'office-zoom': setOffice({ zoom: Math.min(2, Math.max(0.5, (officePrefs.zoom || 1) * (el.dataset.dir === 'in' ? 1.2 : 1 / 1.2))) }); break;
    case 'office-fit': setOffice({ zoom: 1 }); break;
    case 'bulk-toggle': state.bulk = state.bulk ? null : new Set(); renderNow(); break;
    case 'bulk-pick': e.stopPropagation(); if (el.checked) state.bulk.add(id); else state.bulk.delete(id); renderNow(); break;
    case 'bulk-all': { e.stopPropagation(); const ids = el.dataset.ids.split(' ').filter(Boolean); for (const x of ids) { if (el.checked) state.bulk.add(x); else state.bulk.delete(x); } renderNow(); break; }
    case 'bulk-clear': state.bulk = new Set(); renderNow(); break;
    case 'bulk-owner': case 'bulk-contr': case 'bulk-shift': case 'bulk-start': case 'bulk-trash': bulkDo(act.slice(5)); break;
    case 'office-anim': setOffice({ anim: officePrefs.anim === false }); break;
    case 'office-labels': setOffice({ labels: !officePrefs.labels }); break;
    case 'pstage': state.projectStage = el.dataset.v; renderNow(); break;
    case 'export': exportReport(el.dataset.format); break;
    case 'import': startImport(); break;
    case 'tab': if (id === 'projects' && state.tab === 'projects') state.openProjectId = null; scrollPos[state.tab] = $('#app').scrollTop; state.tab = id; saveLocal('tab', id); renderNow(); restoreScroll(); break;
    case 'sort': toggleSort(el.dataset.key); break;
    case 'g-scale': zoomGantt(Number(el.dataset.days) / state.gantt.days, dayNum(state.today) >= dayNum(state.gantt.from) && dayNum(state.today) <= dayNum(state.gantt.from) + state.gantt.days ? (dayNum(state.today) - dayNum(state.gantt.from)) / state.gantt.days : 0.5); break;
    case 'g-zoom': zoomGantt(el.dataset.dir === 'in' ? 0.7 : 1 / 0.7); break;
    case 'g-shift': setGantt({ from: addDays(state.gantt.from, Math.round(state.gantt.days / 3) * Number(el.dataset.dir)) }); break;
    case 'g-group': setGantt({ group: el.dataset.group }); break;
    case 'g-today': setGantt({ from: addDays(state.today, -Math.round(state.gantt.days / 9)) }); break;
    case 'open-task':
      // On an editable table cell wait a moment: a second click turns this into inline editing.
      if (el.matches('tr.row') && e.target.closest('td[data-edit]')) {
        clearTimeout(openTimer);
        openTimer = setTimeout(() => openTask(id), 260);
        break;
      }
      if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
      openTask(id); break;
    case 'dep-del': state.draft.dependsOn = state.draft.dependsOn.filter(x => x !== id); renderDeps(); break;
    case 'msg-kind': renderMessage(el.dataset.kind); break;
    case 'msg-copy': copyText($('#msg-text').value).then(ok => toast(ok ? 'Текст скопирован' : 'Текст выделен — нажмите Ctrl+C')); break;
    case 'msg-send': el.disabled = true; sendMessage(el.dataset.via).finally(() => { el.disabled = false; }); break;
    case 'backup-save': backupSave(); break;
    case 'backup-restore': backupRestore(); break;
    case 'open-search': openPalette(); break;
    case 'view-menu': setViewMenu($('#view-menu').hidden); break;
    case 'user-menu': setUserMenu($('#user-menu').hidden); break;
    case 'switch-user': switchUser(id); break;
    case 'open-user': openUser(id); break;
    case 'new-user': setCreateMenu(false); openUser(null, el.dataset.role, el.dataset.chief); break;
    case 'team-toggle': toggleTeamNode(id); break;
    case 'talk-send': sendComment(); break;
    case 'talk-edit': talkEditStart(el.dataset.cid); break;
    case 'talk-edit-save': talkEditSave(); break;
    case 'talk-edit-cancel': talkEditCancel(); break;
    case 'weekly': setFileMenu(false); openWeekly(); break;
    case 'usage': setFileMenu(false); openUsage(); break;
    case 'help': setFileMenu(false); openHelp(); break;
    case 'people-mode': peopleMode = el.dataset.v; saveLocal('peopleMode', peopleMode); renderNow(); break;
    case 'cg-toggle': toggleSet(cgOpen, id, 'cgOpen'); break;
    case 'co-toggle': toggleSet(coOpen, id, 'coOpen'); break;
    case 'cg-all': if (el.dataset.on === '1') CONTRACTOR_GROUPS.forEach(([k]) => cgOpen.add(k || '-')); else cgOpen.clear(); saveLocal('cgOpen', [...cgOpen]); renderNow(); break;
    case 'person-tasks': if (!e.target.closest('button')) { state.filters = { ...EMPTY_FILTERS, owner: id }; state.tab = 'tasks'; saveLocal('tab', 'tasks'); renderNow(); } break;
    case 'prog-weight': progWeight = el.dataset.v; saveLocal('progWeight', progWeight); renderNow(); break;
    case 'show-more': shownLimits.set(el.dataset.key, Number(el.dataset.shown) + Number(el.dataset.step)); renderNow(); break;
    case 'settings': openSettings(el.dataset.sec); break;
    case 'ov-move': moveOv(el.dataset.id, Number(el.dataset.dir)); break;
    case 'ov-show': setOvPrefs({ hidden: ovPrefs.hidden.filter(k => k !== el.dataset.id) }); break;
    case 'ov-show-all': setOvPrefs({ hidden: ovPrefs.hidden.filter(k => k === 'projects' && ovPrefs.hidden.includes('projects')) }); break;
    case 'ov-reset': setOvPrefs({ order: [], hidden: [...OV_DEFAULT_HIDDEN] }); break;
    case 'counter': attOpen = false; openCounter(el.dataset.f); break;
    case 'mk-all': state.drawer.allMarks = !state.drawer.allMarks; applyMarksFilter(); break;
    case 'drawer-wide': setDrawerFull(!drawerPrefs.full); break;
    case 'task-step': stepTask(Number(el.dataset.dir)); break;
    case 'col-move': moveCol(el.dataset.id, Number(el.dataset.dir)); break;
    case 'cols-reset': setColPrefs({ order: COLS.map(c => c.id), hidden: [] }); break;
    case 'preset': applyPreset(id); break;
    case 'preset-del': deletePreset(id); break;
    case 'preset-save': savePreset(); break;
    case 'preset-reset': state.filters = { ...EMPTY_FILTERS }; renderNow(); break;
    case 'absences': openAbsences(id); break;
    case 'fold': setFold([el.dataset.key], !isFolded(el.dataset.key)); break;
    case 'fold-all': setFold(el.dataset.keys.split(' ').filter(Boolean), el.dataset.on === '1'); break;
    case 'move-task': e.stopPropagation(); reassign(id, el.dataset.kind, el.dataset.from); break;
    case 'set-dense': dense = el.dataset.v === '1'; saveLocal('dense', dense); applyDense(); renderViewMenu(); break;
    case 'set-anim': anim = el.dataset.v === '1'; saveLocal('anim', anim); applyAnim(); renderViewMenu(); break;
    case 'kb-lanes': state.kanban.lanes = el.dataset.v; saveLocal('kbLanes', el.dataset.v); renderNow(); break;
    case 'nav-pos': setNav({ pos: el.dataset.v }); break;
    case 'nav-mini': setNav({ mini: !nav.mini }); break;
    case 'nav-mini-chk': setNav({ mini: el.checked }); break;
    case 'set-theme': api.setTheme(el.dataset.v); break;
    case 'zoom-step': stepZoom(Number(el.dataset.dir)); break;
    case 'open-journal': openJournal(); break;
    case 'jr-period': state.journal.period = el.dataset.v; loadJournal(); break;
    case 'jr-type': state.journal.type = el.dataset.v; renderJournal(); break;
    case 'new-task': setCreateMenu(false); openTask(null, { projectId: el.dataset.project }); break;
    case 'open-project': openProject(id); break;
    case 'project-page': openProjectPage(id); break;
    case 'dtab-close': docTabClose(id); break;
    case 'win-detach': detachDoc(el.dataset.kind, id); break;
    case 'win-dock': api.windowDock?.(SOLO); break;
    case 'project-back': state.openProjectId = null; render(); break;
    case 'open-project-tab': openProject(id, el.dataset.tab); break;
    case 'msg-open': msgOpen(); break;
    case 'msg-close': msgClose(); break;
    case 'msg-size': msg.mode = msg.mode === 'full' ? 'side' : 'full'; renderMsg(); break;
    case 'msg-chat': msgOpen(id); break;
    case 'msg-back': msg.chatId = ''; renderMsg(); break;
    case 'msg-filter': msg.filter = el.dataset.v; renderMsg(); break;
    case 'msg-pin': msgTogglePin(id); break;
    case 'msg-cust-project': msgClose(); openProject(id, 'cust'); break;
    case 'mc-send': msgSend(); break;
    case 'mc-edit': mcEditStart(id); break;
    case 'mc-edit-save': mcEditSave(); break;
    case 'mc-edit-cancel': mcEditCancel(); break;
    case 'msg-info': msg.info = !msg.info; renderMsg(); break;
    case 'msg-project': msgOpen(projectChatId(id)); break;
    case 'msg-new': msg.chatId = 'new'; msg.newKind = 'direct'; if (msg.mode === 'pill') { msg.mode = 'side'; msg.enter = true; } renderMsg(); break;
    case 'msg-newkind': msg.newKind = el.dataset.v; renderMsg(); break;
    case 'msg-pick': if (el.checked) msg.newPick.add(el.value); else msg.newPick.delete(el.value); msg.newTitle = $('#mc-title')?.value || msg.newTitle; renderMsg(); break;
    case 'msg-ac': msgAcPick(Number(el.dataset.i)); break;
    case 'msg-direct': api.chatDirect(id).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); await refresh(); msgOpen(r.id); }); break;
    case 'msg-create': { const title = ($('#mc-title')?.value || '').trim(); api.chatCreate({ title, members: [...msg.newPick] }).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); msg.newPick = new Set(); msg.newTitle = ''; await refresh(); msgOpen(r.id); toast(`Чат «${title}» создан`); }); break; }
    case 'msg-add-member': { const c = chatById(msg.chatId), uid = $('#mc-add')?.value; if (c && uid) api.chatUpdate(c.id, { members: [...(c.members || []), uid] }).then(r => (r?.ok ? refresh() : toast(r?.message || 'Ошибка', true))); break; }
    case 'msg-leave': { const c = chatById(msg.chatId); if (c) confirmBox(`Выйти из чата «${chatTitle(c)}»? Вернуть может автор чата.`, 'Выйти').then(ok => ok && api.chatLeave(c.id).then(() => { msg.chatId = ''; refresh(); })); break; }
    case 'assign-board': openAssignBoard(id); break;
    case 'ask-customer': { const pr = state.projects.get(id); if (pr) askCustomer(pr); break; }
    case 'member-add': { const p = state.projects.get(state.openProjectId), uid = $('#pt-member')?.value; if (p && uid) setMembers(p, [...memberIds(p), uid], `${state.users.get(uid)?.name} — в участниках проекта`); break; }
    case 'member-del': { const p = state.projects.get(state.openProjectId); if (p) setMembers(p, memberIds(p).filter(x => x !== id), 'Убран из участников'); break; }
    case 'member-add-tasks': { const p = state.projects.get(state.openProjectId); if (p) { const tasks = [...state.tasks.values()].filter(t => t.projectId === p.id); setMembers(p, [...memberIds(p), ...tasks.flatMap(t => [t.ownerId, ...(t.coOwnerIds || [])]).filter(x => x && state.users.has(x))], 'Участники добавлены'); } break; }
    case 'new-project': setCreateMenu(false); openProject(null); break;
    case 'open-contractor': openContractor(id); break;
    case 'new-contractor': setCreateMenu(false); openContractor(null); break;
    case 'goto-project':
      if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
      state.tab = 'projects'; renderNow();
      document.getElementById('p-' + id)?.scrollIntoView({ block: 'start' }); break;
    case 'toggle-archive': state.showArchive = !state.showArchive; renderNow(); break;
    case 'archive': setArchived(id, true); break;
    case 'unarchive': setArchived(id, false); break;
    case 'open-folder': openFolder(id); break;
    case 'pick-folder': pickFolder(); break;
    case 'dtab': setDrawerTab(id); break;
    case 'request-close': requestClose(); break;
    case 'discard': closeDrawer(); break;
    case 'save-close': $('#dform').requestSubmit(); break;
    case 'save-stay': saveStay(); break;
    case 'ask-delete': askDelete(); break;
    case 'cancel-delete': $('#confirm-slot').innerHTML = ''; break;
    case 'do-delete': el.disabled = true; doDelete(); break;
    case 'quick': el.disabled = true; submitTask(el.dataset.q).finally(() => { el.disabled = false; }); break;
    case 'ms-add': state.draft.milestones.push({ id: newId(), title: '', date: '', done: false }); renderMilestones(); $$('#ms-box [data-k="title"]').at(-1)?.focus(); break;
    case 'ms-del': state.draft.milestones.splice(Number(el.dataset.i), 1); renderMilestones(); break;
    case 'plan-add': state.draft.plan.push({ id: newId(), title: '', amount: 0, trigger: 'accepted' }); renderPlanRows(); renderPlanPreview(); break;
    case 'plan-del': state.draft.plan.splice(Number(el.dataset.i), 1); renderPlanRows(); renderPlanPreview(); break;
    case 'plan-tpl': applyPlanTemplate(el.dataset.tpl); break;
    case 'add-payment': addPayment(); break;
    case 'del-payment': delPayment(el.dataset.pid); break;
    case 'open-trash': setFileMenu(false); openTrash(); break;
    case 'restore': restoreItem(el.dataset.col, id); break;
    case 'purge': purgeItem(el.dataset.col, id, el); break;
    case 'do-import': el.disabled = true; doImport().finally(() => { el.disabled = false; }); break;
    case 'seed-demo': el.disabled = true; seedDemo(); break;
    case 'clear-demo': el.disabled = true; clearDemo(); break;
    case 'copy': copy(el.dataset.value, el); break;
    case 'open-data-folder': setFileMenu(false); api.openDataFolder(); break;
    case 'toggle-pin': api.setAlwaysOnTop(!state.win.alwaysOnTop); break;
    case 'toggle-compact': api.setCompact(!state.win.compact); break;
    case 'ghost-on': api.setClickThrough(true); toast('Сквозные клики включены. Вернуть управление: Ctrl+Alt+G или кнопка вверху окна.'); break;
    case 'ghost-off': api.setClickThrough(false); break;
    case 'minimize': api.minimize(); break;
    case 'toggle-max': api.setMaximized(!state.win.maximized); break;
    case 'hide': api.hide(); break;
  }
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
  if (t.dataset.pd && /^phases\.|^milestones\./.test(t.dataset.pd)) { const y = $('#dform .drawer-b')?.scrollTop; renderCustomer(); if (y != null) $('#dform .drawer-b').scrollTop = y; return; }
  if (t.dataset.act === 'toggle-budget') { toggleBudget(t.dataset.id, t.checked); return; }
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
  if (t.id === 'jr-q') { state.journal.q = t.value; const pos = t.selectionStart; renderJournal(); const n = $('#jr-q'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.id === 'msg-text') { msg.drafts[msg.chatId] = t.value; msgAutocomplete(t); return; }
  if (t.id === 'mc-title') { msg.newTitle = t.value; return; }
  if (t.name === 'mark' || t.id === 't-marks-extra') { onMarksChanged(); return; }
  if (t.id === 't-owner') { renderCoOwners(); updateOwnerWarn(); applyMarksFilter(); return; }
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
window.AppBridge = { state, toast, esc, TABS, setFileMenu: open => setFileMenu(open) };
try { const m = sessionStorage.getItem('glavspec.toast'); if (m) { sessionStorage.removeItem('glavspec.toast'); setTimeout(() => toast(m), 600); } } catch { /* optional */ }
applyNav();
applyDense();
applyAnim();
state.kanban.lanes = loadLocal('kbLanes', '') || '';
$('#app').addEventListener('scroll', rememberScroll, { passive: true });
if (SOLO) {
  document.body.classList.add('solo', 'solo-' + SOLO.kind);
  if (SOLO.kind === 'project') { state.tab = 'projects'; state.openProjectId = SOLO.id; }
  else { msg.mode = 'solo'; msg.chatId = SOLO.id; }
}
// A separate window hands a project or a chat back (or asks to open another one here).
api.onWindowMain?.(spec => {
  if (spec?.kind === 'project' && state.projects.has(spec.id)) { if (state.tab !== 'projects') { state.tab = 'projects'; saveLocal('tab', 'projects'); } openProjectPage(spec.id); }
  else if (spec?.kind === 'chat' && spec.id) { if (msg.mode === 'pill') { msg.mode = 'full'; msg.enter = true; } msgOpen(spec.id); }
});
api.onData(setData);
api.onCabinet?.(setCab);
api.onWindowState(applyWinState);
api.onOpenTask?.(id => { if (state.tasks.has(id)) openTask(id); });
(async () => {
  try {
    applyWinState(await api.getWindowState());
    const { data, warning } = await api.getData();
    setData(data);
    if (warning) toast(warning, true);
    api.cabinetGet?.().then(setCab).catch(() => {});
  } catch (e) {
    $('#app').innerHTML = `<section class="empty"><h2>Не удалось загрузить данные</h2><p class="hint">${esc(e?.message || e)}</p></section>`;
  }
})();
})();

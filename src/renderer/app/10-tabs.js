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
  const s = e.target.closest?.('#tabs .tab[data-id]:not(.tab-act)');
  if (s) { e.preventDefault(); wsAddSection(s.dataset.id); }
});
document.addEventListener('mousedown', e => { if (e.button === 1 && e.target.closest?.('#tabs .tab[data-id], .dtab[data-doc]')) e.preventDefault(); }); // no autoscroll
function orderedTabs() {
  const all = [...TABS, ...MENU_EXTRA];
  const known = all.map(x => x.id), order = tabOrder.filter(id => known.includes(id));
  all.forEach((x, i) => { if (!order.includes(x.id)) order.splice(Math.min(i, order.length), 0, x.id); });
  return order.map(id => all.find(x => x.id === id));
}
// 4.12: hide or show a menu item; at least one section stays in the menu.
function setTabHidden(id, hide) {
  const next = hide ? [...new Set([...hiddenTabs, id])] : hiddenTabs.filter(x => x !== id);
  if (hide && !visibleTabs().some(t => !next.includes(t.id))) return toast('Хотя бы один раздел должен остаться в меню.', true);
  hiddenTabs = next; saveLocal('hiddenTabs', next);
  renderNow(); if (document.querySelector('.settings-modal')) renderSettings();
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
  'tabs-reset': () => { hiddenTabs = []; saveLocal('hiddenTabs', []); setTabOrder([]); },
  'tab-hide': ({ el, id }) => { setTabHidden(id, !el.checked); },
  'tab': ({ e, id }) => { if (e.ctrlKey) { wsAddSection(id); return; } wsRemember(); wsActive = ''; saveWs(); if (id === 'projects' && state.tab === 'projects') state.openProjectId = null; scrollPos[state.tab] = $('#app').scrollTop; state.tab = id; saveLocal('tab', id); renderNow(); restoreScroll(); },
  'dtab-close': ({ id }) => { docTabClose(id); },
  'ws-open': ({ el }) => { wsOpen(el.dataset.key); },
  'ws-plus': () => { if (state.tab === 'projects' && state.openProjectId) toast('Проект уже во вкладке — откройте другой раздел и нажмите «＋», или щёлкните по разделу средней кнопкой мыши.'); else wsAddSection(state.tab); },
  'ws-chat': ({ id }) => { wsAddChat(id); },
  'win-detach': ({ el, id }) => { detachDoc(el.dataset.kind, id); },
  'win-dock': () => { api.windowDock?.(SOLO); },
});

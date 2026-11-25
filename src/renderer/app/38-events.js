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
    menuItems().slice(0, 9).forEach((t, i) => $(`#tabs [data-id="${t.id}"]`)?.setAttribute('data-alt-key', `Alt+${i + 1}`));
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
    const t = menuItems()[Number(code.slice(5)) - 1];
    if (t?.act === 'msg-full') { msgFull(); return; }
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
  if (t.dataset.exOrg !== undefined) { const p = state.projects.get(t.dataset.exOrg); if (p) exSave(p, x => { x.org = t.value.trim().slice(0, 160); }, 'Экспертиза: организация сохранена'); return; }
  if (t.dataset.rviFilter !== undefined) { rviFilter[t.dataset.rviFilter] = t.value; renderNow(); return; }
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


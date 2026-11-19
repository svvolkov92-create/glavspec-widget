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

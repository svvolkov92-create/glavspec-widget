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
  const s = String(target || ''), i = s.indexOf(':'), kind = i < 0 ? s : s.slice(0, i), id = i < 0 ? '' : s.slice(i + 1);
  if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
  // 4.12.2: a chat, a customer's messages, the messenger.
  if (kind === 'chat') return msgOpen(chatById(id) ? id : '');
  if (kind === 'cust') return msgOpen(custMsgs(id).length ? 'c:' + id : '');
  if (kind === 'msgs') return msgOpen('');
  if (kind === 'task' && state.tasks.has(id)) return openTask(id);
  if (kind === 'project' && state.projects.has(id)) return openProjectPage(id);
  state.tab = 'day'; saveLocal('tab', 'day'); renderNow();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-search': () => { openPalette(); },
});

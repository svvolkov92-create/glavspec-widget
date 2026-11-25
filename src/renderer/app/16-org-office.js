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
    const gips = staff.filter(A.isGip).sort((a, b) => A.isDirector(b) - A.isDirector(a)), chiefs = staff.filter(u => u.role === 'chief').sort(byName);
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
  const gip = liveUsers().find(A.isDirector) || liveUsers().find(A.isGip), chiefs = liveUsers().filter(u => u.role === 'chief');
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

/* ---------- a person's work: what they are doing now (the «Офис» view itself was removed in 4.18) ---------- */
// What the person is doing, from the state of their cards (the most urgent wins).
function personState(u) {
  const away = A.absencesOf(u).find(a => a.from <= state.today && a.to >= state.today);
  if (away) return { state: 'away', awayText: `${A.ABSENCE_KINDS[away.kind] || 'нет'} до ${fmtDate(away.to).slice(0, 5)}`, cards: [] };
  const cards = tasksArr().filter(t => hasOwner(t, u.id) && t.status !== 'done').sort(sortByDeadline);
  const toCheck = u.role === 'specialist' ? 0 : tasksArr().filter(t => t.status === 'review' && A.reviewersOf(t, liveUsers(), state.projects).includes(u.id)).length;
  if (cards.some(t => timing(t).overdue)) return { state: 'late', cards };
  if (toCheck) return { state: 'checking', bubble: [`проверяет ${toCheck}`, '#EDE8F7', '#5A3FA0'], cards };
  if (cards.some(t => t.status === 'review')) return { state: 'carry', cards };
  if (cards.some(t => t.status === 'revision')) return { state: 'revision', cards };
  if (cards.some(t => t.status === 'in_progress')) return { state: 'work', cards };
  if (cards.length) return { state: 'idle', cards };
  return { state: 'free', cards };
}
const PERSON_STATE_TEXT = { late: 'срок сорван', checking: 'проверяет работы', carry: 'сдал на проверку', revision: 'на доработке', work: 'в работе', idle: 'работы не начаты', free: 'свободен — можно дать работу', away: 'отсутствует' };
// Click on a person: their open cards, with «передать» and a link to all their cards.
function personPopup(uid) {
  const u = state.users.get(uid);
  if (!u) return;
  const st = personState(u);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="optitle"><h2 id="optitle"><span class="kicons">${userIcons(u)}</span>${esc(u.name)}</h2>
    <p class="hint">${esc(A.ROLES[u.role]?.label || '')}${A.directionLabels(u).length ? ' · ' + esc(A.directionLabels(u).join(', ')) : ''} · ${esc(st.awayText || PERSON_STATE_TEXT[st.state])}</p>
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
/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'person-open': ({ id }) => { personPopup(id); },
  'org-fold': ({ el }) => { const id = el.dataset.id; if (el.dataset.open === 'true') { orgOpen.delete(id); orgOpen.add('x:' + id); } else { orgOpen.add(id); orgOpen.delete('x:' + id); } saveLocal('orgOpen', [...orgOpen]); renderNow(); },
  'org-people': ({ el }) => { orgToggle('p:' + el.dataset.id); },
  'org-add': ({ el }) => { askDept(null, el.dataset.parent || ''); },
  'org-edit': ({ el }) => { const d = state.depts.get(el.dataset.id); if (d) askDept(d); },
  'org-from-groups': () => { orgFromGroups(); },
});

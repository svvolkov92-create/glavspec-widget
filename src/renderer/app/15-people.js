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

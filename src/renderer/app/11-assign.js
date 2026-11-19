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

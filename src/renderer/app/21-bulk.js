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

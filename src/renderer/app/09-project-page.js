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
  return `<div class="pt-page">${head}${summary}${people}${noComp}${pdHtml}${rdHtml}${otherHtml}${irdBlock(p)}${surveysBlock(p)}${expertiseBlock(p)}${rviBlock(p)}${lettersBlock(p)}</div>`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'project-page': ({ id }) => { openProjectPage(id); },
  'project-back': () => { state.openProjectId = null; render(); },
  'member-add': () => { const p = state.projects.get(state.openProjectId), uid = $('#pt-member')?.value; if (p && uid) setMembers(p, [...memberIds(p), uid], `${state.users.get(uid)?.name} — в участниках проекта`); },
  'member-del': ({ id }) => { const p = state.projects.get(state.openProjectId); if (p) setMembers(p, memberIds(p).filter(x => x !== id), 'Убран из участников'); },
  'member-add-tasks': () => { const p = state.projects.get(state.openProjectId); if (p) { const tasks = [...state.tasks.values()].filter(t => t.projectId === p.id); setMembers(p, [...memberIds(p), ...tasks.flatMap(t => [t.ownerId, ...(t.coOwnerIds || [])]).filter(x => x && state.users.has(x))], 'Участники добавлены'); } },
});

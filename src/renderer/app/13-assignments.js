/* ---------- 4.16: «Задания смежникам» — one list per project: выдал → получил → принял / вернул ---------- */
// The assignments are cards (kind 'assign', from the composition by the tech card). Their statuses read here as the
// cycle of an assignment: not started / in progress = не выдано; review = выдано, ждёт приёма; done = принято;
// revision = вернули с замечанием.
const ASG_STATE = { not_started: ['idle', 'не выдано'], in_progress: ['idle', 'готовится'], paused: ['idle', 'не выдано'], review: ['review', 'выдано, ждёт приёма'], revision: ['bad', 'вернули'], done: ['ok', 'принято'] };
const asgOf = pid => [...state.tasks.values()].filter(t => t.kind === 'assign' && !t.deletedAt && t.projectId === pid)
  .sort((a, b) => String(a.finish || '9').localeCompare(String(b.finish || '9')) || String(a.title).localeCompare(String(b.title), 'ru'));
const asgFrom = t => state.tasks.get(t.parentId), asgTo = t => (t.toTaskIds || []).map(id => state.tasks.get(id)).filter(Boolean);
const asgLate = t => ['not_started', 'in_progress', 'paused', 'revision'].includes(t.status) && isDate(t.finish) && t.finish < state.today;
// «Кто кого держит»: overdue assignments by the section that must issue them.
function asgHolding(list) {
  const m = new Map();
  for (const t of list.filter(asgLate)) {
    const from = asgFrom(t), k = from ? marksText(from) : '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
let asgFilter = {};
function assignmentsBlock(p) {
  const all = asgOf(p.id);
  if (!all.length) return '';
  const f = asgFilter[p.id] || 'open', edit = A.canEditTaskFields(state.me) && !p.archived;
  const list = f === 'all' ? all : f === 'late' ? all.filter(asgLate) : all.filter(t => t.status !== 'done');
  const hold = asgHolding(all);
  const seg = [['open', 'Не приняты'], ['late', 'Сорваны'], ['all', 'Все']].map(([k, l]) => `<button class="btn sm ${f === k ? 'on' : ''}" type="button" data-act="asg-filter" data-id="${esc(p.id)}" data-v="${k}">${l}</button>`).join('');
  const acts = t => !edit ? '' : t.status === 'review'
    ? `<button class="btn okbtn sm" type="button" data-act="asg-accept" data-id="${esc(t.id)}">Принял</button><button class="btn warnbtn sm" type="button" data-act="asg-return" data-id="${esc(t.id)}">Вернуть</button>`
    : t.status === 'done' ? '' : `<button class="btn sm" type="button" data-act="asg-issue" data-id="${esc(t.id)}">Выдал</button>`;
  const late = t => (asgLate(t) ? ` <span class="neg">сорвано ${dayNum(state.today) - dayNum(t.finish)} дн.</span>` : '');
  const body = `<div class="let asg">
    <div class="let-bar"><span class="seg">${seg}</span><span class="spacer"></span><span class="hint">Выдал → получатель проверяет → «Принял» или «Вернуть» с замечанием</span></div>
    ${hold.length ? `<div class="asg-hold"><b>Кто кого держит:</b> ${hold.map(([k, ts]) => `<span class="chip tone-bad" title="${esc(ts.map(t => t.title).join('\n'))}">${esc(k)} — ${ts.length} ${plural(ts.length, 'задание', 'задания', 'заданий')}</span>`).join(' ')}</div>` : ''}
    ${list.length ? `<table class="let-t asg-t"><thead><tr><th>От → кому</th><th>Что</th><th>Срок</th><th>Состояние</th><th></th></tr></thead><tbody>${list.map(t => { const [tone, l] = ASG_STATE[t.status] || ['idle', '']; const from = asgFrom(t), to = asgTo(t);
      return `<tr><td class="nowrap">${from ? marksHtml(from) : '—'} → ${to.map(x => marksHtml(x)).join(' ') || '—'}</td>
        <td><button class="linkbtn" type="button" data-act="open-task" data-id="${esc(t.id)}">${esc(t.note || t.title)}</button>${t.official && t.officialNo ? ` <span class="hint">${esc(t.officialNo)}</span>` : ''}</td>
        <td class="num nowrap">${isDate(t.finish) ? fmtDate(t.finish) : '—'}${late(t)}</td><td><span class="chip tone-${tone}">${l}</span></td><td class="let-acts">${acts(t)}</td></tr>`; }).join('')}</tbody></table>`
      : '<p class="hint let-empty">Здесь пусто — все задания приняты.</p>'}</div>`;
  const open = all.filter(t => t.status !== 'done').length, lateN = all.filter(asgLate).length;
  return auxBlock('as:' + p.id, 'Задания смежникам', `<span class="meta">принято ${all.length - open} из ${all.length}${lateN ? ` · <span class="neg">сорвано ${lateN}</span>` : ''}</span>`, body);
}
// The cycle sets the status directly (the GIP or a chief presses it), with a line in the card's history.
async function asgSet(t, to, note, msg) {
  const now = new Date();
  const history = [...(Array.isArray(t.history) ? t.history : []), { ts: now.toISOString(), date: todayStr(now), type: 'status', from: t.status, to, note }];
  return write(op.update('tasks', t.id, { status: to, history }), msg);
}
// Issued: the assignment goes «на проверку» to its recipients; their cards get a word in the discussion (notification).
async function asgIssue(id) {
  const t = state.tasks.get(id);
  if (!t) return;
  if (!(await asgSet(t, 'review', 'задание выдано', `Выдано: ${t.title}`))) return;
  for (const x of asgTo(t)) await api.addComment(x.id, `Выдано задание: ${t.note || t.title}. Проверьте и примите — или верните с замечанием (страница проекта → «Задания смежникам»).`).catch(() => {});
}
function asgReturn(id) {
  const t = state.tasks.get(id);
  if (!t) return;
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="asr-t" novalidate><h2 id="asr-t">Вернуть задание</h2><p class="hint">${esc(t.title)}</p>
    <div class="f wide"><label class="req" for="asr-note">Замечание</label><textarea id="asr-note" rows="3" maxlength="500" placeholder="Нет отметок низа отверстий"></textarea></div><div class="err" id="asr-err" hidden></div>
    <div class="modal-f"><button class="btn warnbtn" type="submit">Вернуть</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const q = s => root.querySelector(s), close = () => root.remove();
  q('#asr-note').focus();
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(); });
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const note = q('#asr-note').value.trim();
    if (!note) { q('#asr-err').textContent = 'Напишите, что не так.'; q('#asr-err').hidden = false; return q('#asr-note').focus(); }
    if (await asgSet(t, 'revision', note, `Задание вернули: ${t.title}`)) { await api.addComment(id, `Задание вернули: ${note}`).catch(() => {}); close(); }
  });
}

/* ---------- 4.16: an outside contractor's statement — accrued, paid, left — in the contractor's card ---------- */
function contractorMoneyHtml(c) {
  if (!c?.id || !canMoney()) return '';
  const ts = tasksArr().filter(t => t.contractorId === c.id && !t.deletedAt && !t.moneyHidden);
  if (!ts.length) return '';
  const acc = ts.reduce((a, t) => a + budgetOf(t), 0), paid = ts.reduce((a, t) => a + paidOf(t), 0), left = acc - paid;
  const pays = ts.flatMap(t => (t.payments || []).map(x => ({ t, x }))).sort((a, b) => String(b.x.date).localeCompare(String(a.x.date)));
  const kpi = (l, v, cls = '') => `<div class="cm-kpi"><span class="hint">${l}</span><b class="num ${cls}">${money(v)}</b></div>`;
  return `<div class="sub cm-sub"><h3>Взаиморасчёты</h3><div class="cm-kpis">${kpi('Начислено', acc)}${kpi('Оплачено', paid, 'pos')}${kpi('Остаток к оплате', left, left > 0 ? 'warnv' : left < 0 ? 'neg' : '')}</div>
    <div class="cm-rows"><div class="cm-row cm-hd"><span>Работа</span><span>Статус</span><span class="r">Начислено</span><span class="r">Оплачено</span><span class="r">Остаток</span></div>
    ${ts.map(t => `<div class="cm-row"><span><button class="linkbtn" type="button" data-act="open-task" data-id="${esc(t.id)}">${esc(marksText(t))}</button><br><span class="hint">${esc(projectOf(t)?.name || '')}</span></span><span>${statusChip(t)}</span>
      <span class="r num">${money(budgetOf(t))}</span><span class="r num">${money(paidOf(t))}</span><span class="r num"><b>${money(budgetOf(t) - paidOf(t))}</b></span></div>`).join('')}</div>
    ${pays.length ? `<div class="cm-pays"><span class="lbl">Оплаты</span>${pays.slice(0, 12).map(({ t, x }) => `<span class="chip tone-idle">${isDate(x.date) ? fmtDate(x.date) : '—'} · ${money(Number(x.amount) || 0)} · ${esc(marksText(t))}</span>`).join(' ')}</div>` : ''}
    <div class="row-in"><button class="btn sm" type="button" data-act="cm-act" data-id="${esc(c.id)}" data-v="docx">Акт сверки (Word)</button><button class="btn ghostbtn sm" type="button" data-act="cm-act" data-id="${esc(c.id)}" data-v="xlsx">Excel</button>
      <span class="hint">Оплаты вносятся в карточках работ («Оплата и документы»).</span></div></div>`;
}
async function contractorStatement(id, format) {
  const res = await api.exportReport(format, { type: 'contractor', id });
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'asg-filter': ({ el, id }) => { asgFilter[id] = el.dataset.v; renderNow(); },
  'asg-issue': ({ id }) => { asgIssue(id); },
  'asg-accept': ({ id }) => { const t = state.tasks.get(id); if (t) asgSet(t, 'done', 'задание принято', `Принято: ${t.title}`); },
  'asg-return': ({ id }) => { asgReturn(id); },
  'cm-act': ({ el, id }) => { contractorStatement(id, el.dataset.v); },
});

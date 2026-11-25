/* ---------- small renderers ---------- */
// Mark chips: a colour stripe and the direction icon, in the italic «drawing» face.
const markChip = m => { const k = A.markKind(m); return `<span class="code${k ? ' k-' + k : ''}">${k ? kindIcon(k) : ''}${esc(m)}</span>`; };
function marksHtml(t) {
  // A card of the composition shows its section (ИОС1.1 · ПД, ЭОМ · РД); the codes behind it only colour the chip.
  const place = t?.id && placeIndex().get(t.id);
  if (place) { const k = A.markKind(sectionsOf(t)[0] || ''); return `<span class="marks" title="${esc(`${place.stage} · ${place.code} · ${place.title}`)}"><span class="code${k ? ' k-' + k : ''}">${k ? kindIcon(k) : ''}${esc(place.short)}</span><span class="st-stage">${place.stage === 'ПД' ? 'П' : 'Р'}</span></span>`; }
  const list = sectionsOf(t);
  return `<span class="marks">${list.length ? list.map(markChip).join('') : '<span class="code">—</span>'}</span>`;
}
// A card is a section of the project's documentation: a volume of ПД (ИОС1.1, АР…) or a section of РД (ЭОМ…)
// from the project composition. Index card id → its place, rebuilt when the data changes.
let placeIdx = null, placeIdxFor = null;
function placeIndex() {
  if (placeIdxFor === state.projects) return placeIdx;
  const m = new Map();
  for (const p of state.projects.values()) {
    const comp = p.composition;
    if (!comp) continue;
    try {
      for (const v of Composition.volumes(comp, p.code || '')) {
        const n = comp.nodes.find(x => x.id === v.id);
        if (n?.taskId) m.set(n.taskId, { stage: 'ПД', ref: 'pd:' + v.id, short: v.abbr || v.code, code: v.code, title: v.title, tom: v.tom });
      }
      for (const r of Composition.rdRows(comp, p.code || '')) if (r.item.taskId) m.set(r.item.taskId, { stage: 'РД', ref: 'rd:' + r.id, short: r.mark, code: r.code, title: r.title, tom: r.tom });
    } catch (e) { console.error('Состав проекта', p.id, e); }
  }
  placeIdx = m; placeIdxFor = state.projects;
  return m;
}
// Short name of a card's section: ИОС1.1, ЭОМ… (cards outside the composition: their codes or the task text).
const marksText = t => (t?.id && placeIndex().get(t.id)?.short) || sectionsOf(t).join(', ') || t.title || '—';
function statusChip(t) {
  if (timing(t).overdue) return `<span class="chip tone-bad" title="Статус: ${esc(STATUSES[t.status]?.label)}">Срок сорван</span>`;
  const s = STATUSES[t.status] || STATUSES.not_started;
  return `<span class="chip tone-${s.tone}">${esc(s.label)}</span>`;
}
// Readiness as a thin bar with the number; «✎» when the chief can set it by hand.
function readyHtml(t) {
  const r = L.readiness(t), manual = L.readinessManual(t.status);
  return `<div class="rd${r === 100 ? ' full' : ''}" title="${manual ? 'В работе: готовность ставит главспец (1–90 %)' : 'Задано статусом'}"><span class="rd-bar"><i style="width:${r}%"></i></span><b class="num">${r}%</b>${manual && !t.readiness ? '<span class="hint">не задано</span>' : ''}</div>`;
}
function payBar(t) {
  const b = budgetOf(t), p = paidOf(t), over = p > b;
  const pct = over ? 100 : b > 0 ? (p / b) * 100 : 0;
  return `<div class="pay"><div class="bar-p ${over ? 'over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
}
// Extra lines under the finish date: shifts and the next/overdue milestone.
function finishExtras(t) {
  const out = [];
  const sh = L.shiftsOf(t);
  if (sh.count) out.push(`<span class="tag" title="Срок переносился ${sh.count} раз(а), всего ${sh.days >= 0 ? '+' : ''}${sh.days} дн.">↻ ${sh.count} · ${sh.days >= 0 ? '+' : ''}${sh.days} дн.</span>`);
  const ms = L.milestonesOf(t, state.today);
  if (ms.overdue.length) out.push(`<span class="tag bad" title="Сорвана контрольная точка">КТ «${esc(ms.overdue[0].title || 'без названия')}» ${fmtDate(ms.overdue[0].date)}</span>`);
  else if (ms.next) out.push(`<span class="tag" title="Ближайшая контрольная точка">КТ «${esc(ms.next.title || 'без названия')}» ${fmtDate(ms.next.date)}</span>`);
  const issues = L.dependencyIssues(t, state.tasks, state.today);
  if (issues.length) out.push(`<span class="tag bad" title="${esc(issues.map(i => i.text).join('; '))}">⛓ ждёт ${esc(sectionsOf(issues[0].pred).join(', '))}</span>`);
  return out.length ? `<div class="tags">${out.join('')}</div>` : '';
}

/* ---------- sortable card tables (shared by «Проекты» and «Все карточки») ---------- */
// Status order follows the workflow; an overdue card sorts first, as the table shows it as «Срок сорван».
const STATUS_RANK = { not_started: 1, in_progress: 2, revision: 3, review: 4, paused: 5, done: 6 };
const SORT_KEYS = {
  project: t => projectOf(t)?.name || '',
  marks: t => sectionsOf(t).join(', '),
  contractor: t => executorOf(t)?.name || '',
  owner: t => ownerOf(t)?.name || '',
  start: t => t.start || '',
  finish: t => t.finish || '',
  status: t => (timing(t).overdue ? 0 : STATUS_RANK[t.status] ?? 9),
  ready: t => L.readiness(t),
  budget: t => budgetOf(t),
  paid: t => paidOf(t),
  rest: t => restOf(t),
};
function sortTasks(list) {
  const { key, dir } = state.sort;
  const get = SORT_KEYS[key];
  if (!get) return list.sort(sortByDeadline);
  const sign = dir === 'desc' ? -1 : 1;
  return list.sort((a, b) => {
    const va = get(a), vb = get(b);
    const ea = va === '' || va == null, eb = vb === '' || vb == null;
    if (ea !== eb) return ea ? 1 : -1; // empty values stay at the bottom in both directions
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru', { numeric: true, sensitivity: 'base' });
    return c * sign || sortByDeadline(a, b);
  });
}
// Header click cycles: ascending → descending → default order (by deadline).
function toggleSort(key) {
  const s = state.sort;
  state.sort = s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: '', dir: '' };
  saveLocal('sort', state.sort);
  renderNow();
}
function sortTh(key, label, cls = '') {
  const s = state.sort, on = s.key === key;
  const aria = on ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<th class="sortable ${cls} ${on ? 'sorted' : ''}" aria-sort="${aria}"><button type="button" data-act="sort" data-key="${key}" title="Сортировать">${label}<span class="sort-ind" aria-hidden="true">${on ? (s.dir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>`;
}

const EDIT_HINT = 'Двойной щелчок — изменить прямо в таблице';

/* ---------- editing a card's dates and fields outside the card form ---------- */
// Asks why the deadline moves; resolves to {reason, note} or null when cancelled.
function askShiftReason(t, from, to, followers = null) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const d = dayNum(to) - dayNum(from);
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
      <h2 id="mtitle">Перенос срока</h2>
      <p><b>${esc(marksText(t))}</b> · ${esc(projectOf(t)?.name || '')}</p>
      <p class="shift-h">${fmtDate(from)} → ${fmtDate(to)} <b>(${d >= 0 ? '+' : ''}${d} дн.)</b></p>
      ${followers?.size ? `<div class="hint2 shift-follow"><label class="chk"><input type="checkbox" id="m-follow" checked> Сдвинуть и зависимые карточки (${followers.size}): ${[...followers.keys()].map(fid => esc(marksText(state.tasks.get(fid) || {}))).join(', ')}</label></div>` : ''}
      <div class="f"><label class="req" for="m-reason">Причина переноса</label>
        <select id="m-reason"><option value="">— выберите —</option>${Object.entries(SHIFT_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
      <div class="f"><label for="m-note">Комментарий</label><input id="m-note" maxlength="200" placeholder="Например: заказчик сменил ТУ"></div>
      <div class="err" id="m-err" hidden>Выберите причину переноса.</div>
      <div class="modal-f"><button class="btn primary" type="submit">Перенести</button><button class="btn" type="button" data-m="cancel">Отмена</button></div>
    </form>`;
    document.body.append(root);
    const close = v => { root.remove(); resolve(v); };
    root.querySelector('#m-reason').focus();
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(null); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
    root.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      e.stopPropagation();
      const reason = root.querySelector('#m-reason').value;
      if (!reason) return modalErr(root, '#m-err', 'Выберите причину переноса.', '#m-reason');
      close({ reason, note: root.querySelector('#m-note').value.trim(), follow: !!root.querySelector('#m-follow')?.checked });
    });
  });
}

// Saves new start/finish; a moved finish is logged with its reason like in the card form.
async function commitDates(id, patch, followers = null) {
  const t = state.tasks.get(id);
  if (!t) return false;
  const next = { start: patch.start !== undefined ? patch.start : t.start || '', finish: patch.finish !== undefined ? patch.finish : t.finish || '' };
  if ((next.start || '') === (t.start || '') && (next.finish || '') === (t.finish || '')) { renderNow(); return false; }
  if (isDate(next.start) && isDate(next.finish) && next.finish < next.start) { toast('Финиш не может быть раньше старта.', true); renderNow(); return false; }
  const history = Array.isArray(t.history) ? [...t.history] : [];
  if (isDate(t.finish) && isDate(next.finish) && t.finish !== next.finish) {
    const r = await askShiftReason(t, t.finish, next.finish, followers);
    if (!r) { renderNow(); return false; }
    const now = new Date();
    history.push({ ts: now.toISOString(), date: todayStr(now), type: 'finish', from: t.finish, to: next.finish, reason: r.reason, note: r.note });
    // 4.1.1 (57): the cards waiting for this one move with it, each with the same reason in its history.
    if (followers?.size && r.follow) {
      const ops = [op.update('tasks', id, { ...next, history })];
      for (const [fid, x] of followers) {
        const f = state.tasks.get(fid);
        if (!f) continue;
        ops.push(op.update('tasks', fid, { start: x.start, finish: x.finish, history: [...(f.history || []), { ts: now.toISOString(), date: todayStr(now), type: 'finish', from: f.finish, to: x.finish, reason: r.reason, note: `вслед за «${marksText(t)}»${r.note ? ' · ' + r.note : ''}` }] }));
      }
      return write(ops, `${marksText(t)} и ещё ${followers.size}: сроки перенесены`);
    }
  }
  return write(op.update('tasks', id, { ...next, history }), `${marksText(t)}: ${fmtDate(next.start)} → ${fmtDate(next.finish)}`);
}

// 4.13: the source data a card's sections still wait for (project.ird with «нужно для разделов»).
const irdWaitOf = t => L.irdWaiting(projectOf(t), sectionsOf(t), t.status);
const irdWaitText = list => list.map(r => r.title).join(', ');
/* ---------- 4.1: right click on a card (Kanban, Gantt, lists): the usual actions without opening it ---------- */
const nextWorkDay = iso => { let d = addDays(iso, 1); for (let i = 0; i < 20 && L.Cal.dayInfo(d).off; i++) d = addDays(d, 1); return d; };
function cardMenuHtml(t) {
  const item = (act, label, extra = '') => `<button role="menuitem" type="button" data-act="${act}" data-id="${esc(t.id)}"${extra}>${label}</button>`;
  const quick = quickKeys(t.status).map(k => item('cm-quick', QUICK[k].label, ` data-q="${k}"`)).join('');
  const editor = A.canEditTaskFields(state.me);
  const p = projectOf(t), chat = p && A.canChat?.(state.me, p);
  return `<div class="cm-h"><b>${esc(marksText(t))}</b><span class="hint">${esc(p?.name || '')}</span></div>
    ${item('open-task', 'Открыть карточку')}${quick}
    ${['in_progress', 'revision'].includes(t.status) ? item(focus?.taskId === t.id ? 'focus-stop' : 'focus-start', focus?.taskId === t.id ? 'Остановить фокус' : '▶ Фокус — таймер работы') : ''}
    ${editor && isDate(t.finish) ? item('cm-plus1', `Срок +1 рабочий день <span class="hint">→ ${fmtDate(nextWorkDay(t.finish))}</span>`) : ''}
    ${editor ? item('cm-assign', 'Назначить исполнителя…') : ''}
    ${chat ? item('cm-chat', 'Обсудить в чате проекта') : ''}
    ${item('cm-copy', 'Копировать название')}
    ${p && canDetach() ? item('cm-window', 'Проект в отдельном окне') : ''}`;
}
function openCardMenu(t, x, y) {
  closeCardMenu();
  const m = document.createElement('div');
  m.className = 'menu card-menu'; m.id = 'card-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = cardMenuHtml(t);
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 6))}px`;
  m.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 6))}px`;
  m.querySelector('button')?.focus();
}
function closeCardMenu() { document.getElementById('card-menu')?.remove(); }
document.addEventListener('contextmenu', e => {
  const el = e.target.closest?.('[data-act="open-task"][data-id], tr[data-id]');
  const t = el && state.tasks.get(el.dataset.id);
  if (!t || e.target.closest('input, textarea, select, .drawer')) return;
  e.preventDefault(); track('act:card-menu');
  openCardMenu(t, e.clientX, e.clientY);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#card-menu')) closeCardMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('card-menu')) { e.stopPropagation(); closeCardMenu(); } }, true);
window.addEventListener('blur', closeCardMenu);
async function cardMenuAct(act, t, el) {
  closeCardMenu();
  if (act === 'cm-quick') {
    if (el.dataset.q === 'submit' && isSpec()) { openTask(t.id); return; } // a specialist describes what was done
    await changeStatus(t.id, QUICK[el.dataset.q].to, 'из меню карточки');
    focusAfterQuick(t.id, el.dataset.q);
  } else if (act === 'cm-plus1') await commitDates(t.id, { finish: nextWorkDay(t.finish) });
  else if (act === 'cm-assign') openTask(t.id, {}, 'main');
  else if (act === 'cm-chat') { const id = projectChatId(t.projectId); msg.drafts[id] = `${msg.drafts[id] ? msg.drafts[id] + '\n' : ''}По карточке «${marksText(t)}» (${projectOf(t)?.name || ''}): `; msgOpen(id); }
  else if (act === 'cm-copy') { try { await navigator.clipboard.writeText(`${marksText(t)} · ${projectOf(t)?.name || ''}${projectOf(t)?.code ? ' (' + projectOf(t).code + ')' : ''}`); toast('Название скопировано'); } catch { toast('Не удалось скопировать.', true); } }
  else if (act === 'cm-window') detachDoc('project', t.projectId);
}

let openTimer = null; // a single click on an editable cell waits briefly in case it becomes a double click
function startCellEdit(td) {
  track('edit:cell');
  const id = td.closest('tr')?.dataset.id, field = td.dataset.edit, t = state.tasks.get(id);
  if (!t) return;
  const inputs = {
    // Only the actions this status allows (as the buttons in the card): «В работе» → «Сдал на проверку»…
    status: () => `<select class="cell-in"><option value="${t.status}" selected>${esc(STATUSES[t.status]?.label || '')}</option>${quickKeys(t.status).map(k => `<option value="${QUICK[k].to}">→ ${esc(QUICK[k].label)}</option>`).join('')}</select>`,
    contractor: () => `<select class="cell-in">${contractorOptions(sectionsOf(t), t.contractorId || '')}</select>`,
    start: () => `<input class="cell-in" type="date" value="${esc(t.start || '')}">`,
    finish: () => `<input class="cell-in" type="date" value="${esc(t.finish || '')}">`,
    ready: () => `<input class="cell-in" type="number" min="${L.READY_MIN}" max="${L.READY_MAX}" step="5" value="${L.readiness(t)}">`,
    owner: () => `<select class="cell-in">${ownerOptions(t.ownerId || '', sectionsOf(t))}</select>`,
    budget: () => `<input class="cell-in" inputmode="decimal" value="${t.budget ? esc(String(t.budget).replace('.', ',')) : ''}">`,
  };
  if (!inputs[field]) return;
  td.innerHTML = `<div class="cell-edit">${inputs[field]()}</div>`;
  const el = td.querySelector('.cell-in');
  el.focus();
  if (el.select && field === 'budget') el.select();
  let done = false;
  const finish = commit => { if (done) return; done = true; if (commit) commitCell(id, field, el.value); else renderNow(); };
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
  });
  if (el.tagName === 'SELECT') el.addEventListener('change', () => finish(true));
  el.addEventListener('blur', () => finish(true));
}
async function commitCell(id, field, value) {
  const t = state.tasks.get(id);
  if (!t) return;
  if (field === 'status') return value !== t.status ? changeStatus(id, value, 'изменено в таблице') : renderNow();
  if (field === 'contractor') {
    if ((t.contractorId || '') === value) return renderNow();
    if (value && misfitText(t, 'contractor', value)) { renderNow(); return reassign(id, 'contractor', t.contractorId || '', value); }
    const c = state.contractors.get(value);
    return write(op.update('tasks', id, { contractorId: value, ...(value ? { execUserId: '' } : {}) }), `${marksText(t)}: ${c ? c.name : 'подрядчик снят'}`);
  }
  if (field === 'ready') {
    const n = Math.round(Number(String(value).replace(',', '.')));
    if (!Number.isFinite(n) || n < L.READY_MIN || n > L.READY_MAX) { toast(`Готовность в работе — от ${L.READY_MIN} до ${L.READY_MAX} %. 90 % ставится сдачей на проверку, 100 % — приёмкой.`, true); return renderNow(); }
    if (n === L.readiness(t) && t.readiness) return renderNow();
    return write(op.update('tasks', id, { readiness: n }), `${marksText(t)}: готовность ${n} %`);
  }
  if (field === 'owner') {
    if ((t.ownerId || '') === value || !value) return renderNow();
    if (misfitText(t, 'staff', value)) { renderNow(); return reassign(id, 'staff', t.ownerId || '', value); }
    const u = state.users.get(value);
    return write(op.update('tasks', id, { ownerId: value }), `${marksText(t)}: ответственный ${u ? u.name : ''}`);
  }
  if (field === 'start' || field === 'finish') return commitDates(id, { [field]: value });
  if (field === 'budget') {
    const n = parseMoney(value);
    if (Number.isNaN(n)) { toast('Бюджет — неотрицательное число, например 150000 или 150 000,50.', true); return renderNow(); }
    if (n === budgetOf(t)) return renderNow();
    return write(op.update('tasks', id, { budget: n }), `${marksText(t)}: бюджет ${money(n)}`);
  }
}

/* ---------- card tables: columns can be hidden and reordered («⚙ Столбцы») ---------- */
const COLS = [
  { id: 'project', label: 'Проект' }, { id: 'marks', label: 'Разделы', fixed: true }, { id: 'owner', label: 'Ответственный' },
  { id: 'contractor', label: 'Исполнитель' }, { id: 'start', label: 'Старт' }, { id: 'finish', label: 'Финиш' }, { id: 'status', label: 'Статус' }, { id: 'ready', label: 'Готовность' },
  { id: 'budget', label: 'Бюджет', money: true }, { id: 'paid', label: 'Оплачено', money: true }, { id: 'rest', label: 'Остаток', money: true },
];
let colPrefs = { order: COLS.map(c => c.id), hidden: [], ...loadLocal('cols', {}) };
function colOrder() {
  const known = new Set(COLS.map(c => c.id));
  const order = colPrefs.order.filter(id => known.has(id));
  for (const c of COLS) if (!order.includes(c.id)) order.push(c.id);
  return order.map(id => COLS.find(c => c.id === id));
}
function setColPrefs(patch) { colPrefs = { ...colPrefs, ...patch }; saveLocal('cols', colPrefs); renderNow(); }

function colsMenu() {
  return `<div class="menu-wrap cols-wrap"><button class="btn ghostbtn sm" type="button" data-act="cols-pop" title="Какие столбцы показывать и в каком порядке. Порядок можно менять и перетаскиванием заголовков">⚙ Столбцы</button>
    <div class="menu cols-menu"${colsOpen ? '' : ' hidden'}><p class="hint">Галка — показывать. Стрелки или перетаскивание заголовка таблицы — порядок.</p>${colRowsHtml()}</div></div>`;
}
function colRowsHtml() {
  return `${colOrder().filter(c => (!c.money || canMoney()) && (c.id !== 'owner' || !isSpec())).map((c, i, all) => `<div class="cols-row">
      <label class="chk"><input type="checkbox" data-act="col-toggle" data-id="${c.id}"${colPrefs.hidden.includes(c.id) ? '' : ' checked'}${c.fixed ? ' disabled' : ''}> ${c.label}${c.money ? ' <span class="hint">₽</span>' : ''}</label>
      <span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="col-move" data-id="${c.id}" data-dir="-1"${i ? '' : ' disabled'} title="Выше">↑</button><button class="btn ghostbtn sm" type="button" data-act="col-move" data-id="${c.id}" data-dir="1"${i < all.length - 1 ? '' : ' disabled'} title="Ниже">↓</button></div>`).join('')}
      <button class="btn ghostbtn sm" type="button" data-act="cols-reset">Как было</button>`;
}
function moveCol(id, dir) {
  const order = colOrder().map(c => c.id), i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setColPrefs({ order });
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'sort': ({ el }) => { toggleSort(el.dataset.key); },
  'open-task': ({ e, el, id }) => {
    closeCardMenu();
    // On an editable table cell wait a moment: a second click turns this into inline editing.
    if (el.matches('tr.row') && e.target.closest('td[data-edit]')) {
      clearTimeout(openTimer);
      openTimer = setTimeout(() => openTask(id), 260);
      return;
    }
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    openTask(id);
  },
  'col-move': ({ el }) => { moveCol(el.dataset.id, Number(el.dataset.dir)); },
  'cols-reset': () => { setColPrefs({ order: COLS.map(c => c.id), hidden: [] }); },
  'cm-quick': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-plus1': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-assign': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-chat': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-copy': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
  'cm-window': ({ el, act }) => { const t = state.tasks.get(el.dataset.id); if (t) cardMenuAct(act, t, el); },
});

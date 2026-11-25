/* ---------- 4.1.1 (item 39): files of a card — dropped from Explorer, a screenshot pasted with Ctrl+V ---------- */
const canFiles = () => typeof api.attachBytes === 'function';
function taskFilesHtml(t) {
  if (!canFiles()) return '';
  const files = Array.isArray(t.files) ? t.files : [];
  return `<div class="f wide tf" id="tf-box"><span class="lbl">Файлы${files.length ? ` <span class="hint">${files.length}</span>` : ''}</span>
    <div class="tf-list">${files.map(f => `<span class="aq-file tf-file">${icon('file')}<button class="linkbtn" type="button" data-act="tf-open" data-fid="${esc(f.id)}" title="Открыть">${esc(f.name)}</button> <span class="hint">${fileSize(f.size)}</span><button class="btn ghostbtn sm" type="button" data-act="tf-del" data-fid="${esc(f.id)}" title="Убрать из карточки" aria-label="Убрать">×</button></span>`).join('')}</div>
    <div class="tf-drop">${t.id ? 'Перетащите сюда файлы из Проводника или нажмите <b>Ctrl+V</b>, чтобы вставить скриншот' : 'Сохраните карточку — потом сюда можно будет перетаскивать файлы'}</div></div>`;
}
async function attachToTask(taskId, fileList) {
  const t = state.tasks.get(taskId);
  if (!t || !canFiles()) return;
  const added = [];
  for (const f of [...fileList].slice(0, 20)) {
    if (!f || !f.size) continue;
    const name = f.name && f.name !== 'image.png' ? f.name : `Скриншот ${new Date().toLocaleString('ru-RU').replace(/[:.,]/g, '-').replace(/\s+/g, ' ')}.png`;
    const r = await api.attachBytes(t.projectId, name, new Uint8Array(await f.arrayBuffer()));
    if (r?.ok) added.push(r.file); else toast(r?.message || `Не удалось приложить «${name}».`, true);
  }
  if (!added.length) return;
  const cur = state.tasks.get(taskId);
  await write(op.update('tasks', taskId, { files: [...(Array.isArray(cur.files) ? cur.files : []), ...added] }), `${marksText(t)}: ${added.length === 1 ? `приложен «${added[0].name}»` : `приложено файлов: ${added.length}`}`);
  refreshTaskFiles();
}
// The open card shows its file list without losing what is typed in the form.
function refreshTaskFiles() { const box = $('#tf-box'), t = state.drawer?.kind === 'task' && state.tasks.get(state.drawer.id); if (box && t) box.outerHTML = taskFilesHtml(t); }
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
const fileTarget = e => {
  if (e.target.closest?.('#dform') && state.drawer?.kind === 'task' && state.drawer.id) return state.drawer.id;
  return e.target.closest?.('[data-kb-id]')?.dataset.kbId || e.target.closest?.('.tl-bar[data-bar]')?.dataset.bar || '';
};
document.addEventListener('dragover', e => {
  if (!hasFiles(e) || !canFiles()) return;
  const id = fileTarget(e);
  $$('.file-over').forEach(x => x.classList.remove('file-over'));
  if (!id) return;
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  (e.target.closest('#tf-box, #dform, [data-kb-id], .tl-bar') || e.target).classList.add('file-over');
}, true);
document.addEventListener('dragleave', e => { if (hasFiles(e) && !e.relatedTarget) $$('.file-over').forEach(x => x.classList.remove('file-over')); }, true);
document.addEventListener('drop', e => {
  if (!hasFiles(e) || !canFiles()) return;
  $$('.file-over').forEach(x => x.classList.remove('file-over'));
  const id = fileTarget(e);
  if (!id) return;
  e.preventDefault(); e.stopPropagation();
  attachToTask(id, e.dataTransfer.files);
}, true);
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length || !canFiles() || state.drawer?.kind !== 'task' || !state.drawer.id) return;
  e.preventDefault();
  attachToTask(state.drawer.id, files);
});

function historyLine(h) {
  if (h.type === 'finish') {
    const d = dayNum(h.to) - dayNum(h.from);
    return `<b>Срок перенесён</b> ${fmtDate(h.from)} → ${fmtDate(h.to)} (${d >= 0 ? '+' : ''}${d} дн.) · ${esc(SHIFT_REASONS[h.reason] || SHIFT_REASONS.other)}${h.note ? ` · «${esc(h.note)}»` : ''}`;
  }
  const lbl = s => (s ? STATUSES[s]?.label || s : 'создана');
  return h.from ? `<b>${esc(lbl(h.to))}</b> <span class="hint">(было: ${esc(lbl(h.from))})</span>${h.note ? ` · «${esc(h.note)}»` : ''}` : `<b>Карточка создана</b> · ${esc(lbl(h.to))}`;
}
function taskTimePanel(t, isNew) {
  const summary = isNew ? '' : (() => {
    const sh = L.shiftsOf(t), rs = L.reviewStats(t, state.today);
    const lt = L.lateness(t, state.today);
    const cells = [
      ['Переносов срока', sh.count ? `${sh.count} · ${sh.days >= 0 ? '+' : ''}${sh.days} дн.` : 'не было'],
      ['Первоначальный срок', fmtDate(sh.original)],
      ['Контрольный срок исполнителя', fmtDate(sh.contractorDeadline)],
      ['Кругов замечаний', String(rs.rounds)],
      ['На проверке у вас', days(rs.chiefDays)],
      ['На доработке у исполнителя', days(rs.contractorDays)],
    ];
    return `<div class="sub0"><div class="kv">${cells.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
      ${lt && lt.late ? `<div class="err">${lt.final ? `Сдано на ${days(lt.late)} позже контрольного срока.` : `Просрочка от контрольного срока: ${days(lt.late)}.`}</div>` : ''}</div>`;
  })();
  const hist = isNew ? '' : (() => {
    const list = L.historyOf(t).slice().reverse();
    return `<div class="sub"><h3>История</h3>${list.length ? `<ol class="hist">${list.map(h => `<li><span class="num hint">${fmtDate(h.date)}</span><span>${historyLine(h)}</span></li>`).join('')}</ol>`
      : '<div class="hint">История пишется с момента обновления программы: переносы сроков и смены статусов.</div>'}</div>`;
  })();
  const issues = isNew ? [] : L.dependencyIssues(t, state.tasks, state.today);
  return `${summary}
    <div class="sub"><h3>Зависит от (смежные разделы)</h3>
      ${issues.length ? `<div class="err">${issues.map(i => esc(i.text)).join('<br>')}</div>` : ''}
      <div id="dep-box"></div>
      <span class="hint">Например: СС ждёт задание от ЭОМ. На диаграмме Ганта связь показана стрелкой; если смежник срывает срок, карточка попадёт в «Под угрозой».</span></div>
    <div class="sub"><h3>Контрольные точки</h3><div id="ms-box"></div>
      <button class="btn sm" data-act="ms-add" type="button">+ Контрольная точка</button>
      <span class="hint">Например: выдача заданий смежникам, промежуточная сдача, согласование с заказчиком.</span></div>
    <div class="sub"><h3>Изменения (ревизии)</h3><div id="rev-box"></div>
      <button class="btn sm" data-act="rev-add" type="button">+ Изменение</button>
      <span class="hint">Учёт выпусков: «Изм. 1 — по замечаниям экспертизы». Последнее изменение видно в штампе карточки и на странице для заказчика.</span></div>
    ${hist}`;
}
// Candidates: other cards of the same project that would not create a loop.
function renderDeps() {
  const box = $('#dep-box');
  if (!box || !state.draft) return;
  const selfId = state.drawer.id || '__new';
  const projectId = val('projectId');
  const byId = new Map(state.tasks);
  const chosen = state.draft.dependsOn.filter(id => state.tasks.has(id));
  const label = x => `${marksText(x)} · ${executorOf(x)?.name || 'нет исполнителя'} · до ${fmtDate(x.finish)}`;
  const options = [...state.tasks.values()]
    .filter(x => x.id !== selfId && x.projectId === projectId && !chosen.includes(x.id) && !(state.drawer.id && L.wouldCycle(state.drawer.id, x.id, byId)))
    .sort(sortByDeadline);
  box.innerHTML = `${chosen.length ? `<div class="dep-list">${chosen.map(id => {
      const x = state.tasks.get(id), tm = timing(x);
      return `<div class="dep-row">${marksHtml(x)}<span class="dep-who">${esc(executorOf(x)?.name || 'нет исполнителя')}</span>
        <span class="due ${tm.cls}">${x.status === 'done' ? 'принят' : esc(tm.text)}</span>
        <button class="btn ghostbtn sm" data-act="dep-del" data-id="${esc(id)}" type="button" aria-label="Убрать зависимость">✕</button></div>`;
    }).join('')}</div>` : '<div class="hint">Зависимостей нет.</div>'}
    ${options.length ? `<select id="dep-add" data-transient aria-label="Добавить зависимость"><option value="">+ Добавить: эта карточка ждёт…</option>${options.map(x => `<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('')}</select>`
      : `<div class="hint">${projectId ? 'В проекте нет других карточек, от которых можно зависеть.' : 'Сначала выберите проект.'}</div>`}`;
}

function renderMilestones() {
  const box = $('#ms-box');
  if (!box) return;
  const list = state.draft.milestones;
  box.innerHTML = list.length ? `<div class="ms-list">${list.map((m, i) => {
    const late = !m.done && isDate(m.date) && m.date < state.today;
    return `<div class="ms-row ${m.done ? 'done' : ''} ${late ? 'late' : ''}">
      <input type="checkbox" data-ms="${i}" data-k="done" ${m.done ? 'checked' : ''} aria-label="Выполнена">
      <input data-ms="${i}" data-k="title" value="${esc(m.title || '')}" placeholder="Название" maxlength="120" aria-label="Название контрольной точки">
      <input type="date" data-ms="${i}" data-k="date" value="${esc(m.date || '')}" aria-label="Дата">
      <button class="btn ghostbtn sm" data-act="ms-del" data-i="${i}" type="button" aria-label="Удалить">✕</button>
    </div>`;
  }).join('')}</div>` : '<div class="hint">Контрольных точек нет.</div>';
  if (isSpec()) $$('#ms-box input:not([data-k="done"])').forEach(el => { el.disabled = true; });
}

// 4.14: РВИ — every change of a section (a revision of its card) gets a through number in the project.
function nextRvi(pid, extra = []) {
  let max = 0;
  for (const t of state.tasks.values()) if (t.projectId === pid && !t.deletedAt) for (const r of t.revisions || []) max = Math.max(max, Number(r.rvi) || 0);
  for (const r of extra) max = Math.max(max, Number(r.rvi) || 0);
  return max + 1;
}
const rviNo = n => `РВИ-${String(n).padStart(2, '0')}`;
function renderRevisions() {
  const box = $('#rev-box');
  if (!box || !state.draft) return;
  const list = state.draft.revisions;
  box.innerHTML = list.length ? `<div class="rev-list">${list.map((r, i) => `<div class="rev-row">
      <span class="rev-no">Изм.&nbsp;<input data-rev="${i}" data-k="no" value="${esc(r.no)}" maxlength="6" aria-label="Номер изменения" inputmode="numeric"></span>
      <span class="chip ${r.rvi ? 'tone-work' : 'tone-idle'} rev-rvi" title="Номер РВИ — сквозной по проекту, выдаётся сам">${r.rvi ? `РВИ-${String(r.rvi).padStart(2, '0')}` : 'без РВИ'}</span>
      <input type="date" data-rev="${i}" data-k="date" value="${esc(r.date || '')}" aria-label="Дата изменения">
      <input class="rev-sheets" data-rev="${i}" data-k="sheets" value="${esc(r.sheets || '')}" placeholder="листы" maxlength="60" aria-label="Листы">
      <input data-rev="${i}" data-k="note" value="${esc(r.note || '')}" placeholder="Что изменено и почему (основание)" maxlength="200" aria-label="Содержание изменения">
      <button class="btn ghostbtn sm" data-act="rev-del" data-i="${i}" type="button" aria-label="Удалить">✕</button></div>`).join('')}</div>`
    : '<div class="hint">Изменений не было — выпуск первоначальный.</div>';
}
function addRevision() {
  const list = state.draft.revisions;
  const next = list.reduce((m, r) => Math.max(m, parseInt(r.no, 10) || 0), 0) + 1;
  const t = state.tasks.get(state.drawer?.id), pid = $('#dform [name="projectId"]')?.value || t?.projectId || '';
  list.push({ id: newId(), no: String(next), rvi: nextRvi(pid, list), date: todayStr(), note: '', by: state.me?.id || '' });
  renderRevisions();
  $$('#rev-box [data-k="note"]').at(-1)?.focus();
}
function cleanRevisions() {
  const out = [];
  for (const r of state.draft.revisions || []) {
    const no = String(r.no || '').trim(), note = String(r.note || '').trim();
    if (!no && !note) continue;
    if (!no) return { error: 'Укажите номер изменения.' };
    if (r.date && !isDate(r.date)) return { error: 'Проверьте даты изменений.' };
    out.push({ id: r.id || newId(), no, date: r.date || todayStr(), note, ...(r.rvi ? { rvi: Number(r.rvi) } : {}), ...(String(r.sheets || '').trim() ? { sheets: String(r.sheets).trim().slice(0, 60) } : {}), ...(r.by ? { by: r.by } : {}) });
  }
  return { list: out };
}
async function openTaskFolder(id) {
  const res = await api.openTaskFolder(id);
  if (!res.ok) toast(res.message, true);
}
async function pickTaskFolder() {
  const res = await api.pickFolder(val('folder') || projectOf({ projectId: val('projectId') })?.folder || '');
  if (res?.path) $('#t-folder').value = res.path;
}
function suggestTaskFolder() {
  const p = projectOf({ projectId: val('projectId') });
  if (!p?.folder) return toast('У проекта не указана папка.', true);
  const m = selectedMarks()[0] || '';
  $('#t-folder').value = p.folder.replace(/[\\/]+$/, '') + (p.folder.includes('/') && !p.folder.includes('\\') ? '/' : '\\') + m;
}

function taskMoneyPanel(t, isNew) {
  return `
    <div class="sub0"><h3 class="h3">Договор и документы</h3>
      <div class="fgrid">
        <div class="f"><label for="t-contract">Договор №</label><input id="t-contract" name="contractNo" value="${esc(t.contractNo || '')}" maxlength="60" placeholder="15/24-П"></div>
        <div class="f"><label for="t-contract-date">от</label><input id="t-contract-date" name="contractDate" type="date" value="${esc(t.contractDate || '')}"></div>
        <label class="chk"><input type="checkbox" name="invoiceReceived" ${t.invoiceReceived ? 'checked' : ''}> Счёт получен${t.invoiceDate ? ` <span class="hint">${fmtDate(t.invoiceDate)}</span>` : ''}</label>
        <label class="chk"><input type="checkbox" name="actSigned" ${t.actSigned ? 'checked' : ''}> Акт подписан${t.actDate ? ` <span class="hint">${fmtDate(t.actDate)}</span>` : ''}</label>
      </div>
    </div>
    <div class="sub"><h3>График платежей по договору</h3>
      <div class="tpl-row"><span class="hint">Шаблон:</span>
        <button class="btn sm" data-act="plan-tpl" data-tpl="30-70" type="button">Аванс 30% + 70% после приёмки</button>
        <button class="btn sm" data-act="plan-tpl" data-tpl="50-50" type="button">50% + 50%</button>
        <button class="btn sm" data-act="plan-tpl" data-tpl="100" type="button">100% после приёмки</button>
      </div>
      <div id="plan-box"></div>
      <button class="btn sm" data-act="plan-add" type="button">+ Платёж в график</button>
      <div id="plan-preview"></div>
    </div>
    ${isNew ? '<p class="hint">Фактические платежи можно будет вносить после сохранения карточки.</p>' : '<div class="sub" id="payments"></div>'}`;
}
const planValue = r => (r.pct !== null && r.pct !== undefined && r.pct !== '' ? `${String(r.pct).replace('.', ',')}%` : r.amount ? String(r.amount).replace('.', ',') : '');
function renderPlanRows() {
  const box = $('#plan-box');
  if (!box) return;
  const list = state.draft.plan;
  box.innerHTML = list.length ? `<div class="plan-list">${list.map((r, i) => `<div class="plan-row">
      <input data-pl="${i}" data-k="title" value="${esc(r.title || '')}" placeholder="Аванс" maxlength="80" aria-label="Назначение платежа">
      <input data-pl="${i}" data-k="value" value="${esc(planValue(r))}" placeholder="30% или 50 000" inputmode="decimal" aria-label="Сумма или процент">
      <select data-pl="${i}" data-k="trigger" aria-label="Когда платить">${Object.entries(PAY_TRIGGERS).map(([k, l]) => `<option value="${k}"${(r.trigger || 'accepted') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <input type="date" data-pl="${i}" data-k="date" value="${esc(r.date || '')}" ${r.trigger === 'date' ? '' : 'hidden'} aria-label="Дата платежа">
      <button class="btn ghostbtn sm" data-act="plan-del" data-i="${i}" type="button" aria-label="Удалить">✕</button>
    </div>`).join('')}</div>` : '<div class="hint">Графика нет — весь остаток считается к оплате после приёмки.</div>';
}
// Live preview from the form: budget, status and start may be edited but not saved yet.
function renderPlanPreview() {
  const box = $('#plan-preview');
  if (!box || !state.draft) return;
  const saved = state.drawer.id ? state.tasks.get(state.drawer.id) : {};
  const budget = parseMoney(val('budget'));
  const t = { ...saved, budget: Number.isNaN(budget) ? 0 : budget, status: val('status') || saved?.status, start: val('start'), plan: state.draft.plan, payments: saved?.payments || [] };
  const pp = L.paymentPlan(t, state.today);
  const stateChip = r => ({ paid: '<span class="chip tone-ok">оплачено</span>', due: '<span class="chip tone-warn">пора платить</span>', upcoming: '<span class="chip tone-idle">позже</span>' }[r.state]);
  box.innerHTML = `<div class="plan-prev">
    ${pp.rows.map(r => `<div class="pp-row ${r.virtual ? 'virtual' : ''}"><span>${esc(r.title || 'Платёж')}<span class="hint"> · ${esc(PAY_TRIGGERS[r.trigger] || '')}${r.dueDate ? ` ${fmtDate(r.dueDate)}` : ''}</span></span>
      <span class="num">${r.paid > 0 && r.paid < r.amount ? `<span class="hint">оплачено ${money(r.paid)} из </span>` : ''}${money(r.amount)}</span>${stateChip(r)}</div>`).join('')}
    <div class="pp-sum"><span>Пора платить: <b class="num">${money(pp.dueNow)}</b></span><span>Позже по договору: <b class="num">${money(pp.later)}</b></span></div>
    ${pp.hasPlan && pp.mismatch > 0 ? `<div class="err">График больше бюджета на ${money(pp.mismatch)}.</div>` : ''}
    ${pp.hasPlan && pp.mismatch < 0 ? `<div class="hint">В графике не распределено ${money(-pp.mismatch)} — они считаются к оплате после приёмки.</div>` : ''}
  </div>`;
}

function renderPayments() {
  const box = $('#payments');
  const t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const pays = [...(t.payments || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rest = restOf(t);
  const keep = { d: $('#p-date')?.value, a: $('#p-amount')?.value, n: $('#p-note')?.value };
  box.innerHTML = `<h3>Фактические платежи</h3>
    <div class="money3">
      <div><span class="k">Бюджет</span><span class="v">${money(budgetOf(t))}</span></div>
      <div><span class="k">Оплачено</span><span class="v">${money(paidOf(t))}</span></div>
      <div><span class="k">Остаток</span><span class="v ${rest < 0 ? 'neg' : ''}">${money(rest)}</span></div>
    </div>
    ${rest < 0 ? `<div class="err">Оплачено больше бюджета на ${money(-rest)}.</div>` : ''}
    ${pays.length ? `<div class="plist">${pays.map(p => `<div class="prow"><span class="num">${fmtDate(p.date)}</span><span class="n">${esc(p.note || 'платёж')}</span><span class="num">${money(p.amount)}</span>
      <button class="btn ghostbtn sm" data-act="del-payment" data-pid="${esc(p.id)}" type="button" aria-label="Удалить платёж">✕</button></div>`).join('')}</div>` : '<div class="hint">Платежей ещё не было.</div>'}
    <div class="padd" data-transient>
      <div class="f"><label for="p-date">Дата</label><input id="p-date" type="date" value="${esc(keep.d || todayStr())}"></div>
      <div class="f"><label for="p-amount">Сумма, ₽</label><input id="p-amount" inputmode="decimal" placeholder="50 000" value="${esc(keep.a || '')}"></div>
      <div class="f"><label for="p-note">Комментарий</label><input id="p-note" placeholder="Аванс 30%" maxlength="120" value="${esc(keep.n || '')}"></div>
      <button class="btn" data-act="add-payment" type="button">Внести</button>
    </div>
    <span class="hint">Платёж сохраняется сразу.</span>`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-task-folder': ({ e, id }) => { e.stopPropagation(); openTaskFolder(id); },
  'pick-task-folder': () => { pickTaskFolder(); },
  'suggest-task-folder': () => { suggestTaskFolder(); },
  'rev-add': () => { addRevision(); },
  'rev-del': ({ el }) => { state.draft.revisions.splice(Number(el.dataset.i), 1); renderRevisions(); },
  'dep-del': ({ id }) => { state.draft.dependsOn = state.draft.dependsOn.filter(x => x !== id); renderDeps(); },
  'tf-open': ({ el }) => { const t = state.tasks.get(state.drawer?.id); if (t) api.attachOpen(t.projectId, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); }); },
  'tf-del': ({ el }) => { const t = state.tasks.get(state.drawer?.id); if (t) write(op.update('tasks', t.id, { files: (t.files || []).filter(f => f.id !== el.dataset.fid) }), 'Файл убран из карточки').then(refreshTaskFiles); },
  'ms-add': ({ id }) => { state.draft.milestones.push({ id: newId(), title: '', date: '', done: false }); renderMilestones(); $$('#ms-box [data-k="title"]').at(-1)?.focus(); },
  'ms-del': ({ el }) => { state.draft.milestones.splice(Number(el.dataset.i), 1); renderMilestones(); },
  'plan-add': ({ id }) => { state.draft.plan.push({ id: newId(), title: '', amount: 0, trigger: 'accepted' }); renderPlanRows(); renderPlanPreview(); },
  'plan-del': ({ el }) => { state.draft.plan.splice(Number(el.dataset.i), 1); renderPlanRows(); renderPlanPreview(); },
  'plan-tpl': ({ el }) => { applyPlanTemplate(el.dataset.tpl); },
});

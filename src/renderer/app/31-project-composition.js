// «Состав по ПП № 87»: a tree of sections → subsections → books → parts; leaves become cards.
function renderComposition() {
  const box = $('#comp-box'), d = state.draft;
  if (!box || !d) return;
  const p = state.projects.get(state.drawer.id) || {};
  const code = (val('code') || p.code || '').trim();
  if (!d.composition) {
    box.innerHTML = `<div class="comp-empty"><h3>Генератор состава проекта</h3><p>Проектная документация — по Постановлению Правительства РФ № 87 (ред. от 21.10.2025). К её разделам программа предложит разделы рабочей документации (основные комплекты по ГОСТ Р 21.101-2026 и принятые на практике). Всё можно выключить, переименовать, добавить своё.</p>
      <p><b>Вид объекта:</b></p><div class="comp-bases">${Object.entries(Composition.BASES).map(([k, b]) => `<button class="btn" type="button" data-act="comp-base" data-v="${k}"><b>${esc(b.label)}</b><small>${b.sections.length} разделов${k === 'nonprod' ? ', ТХ — по заданию' : ''}</small></button>`).join('')}</div></div>`;
    return;
  }
  const comp = d.composition;
  const rows = Composition.rowsFor(comp, code);
  const vols = new Set(Composition.volumes(comp, code).map(v => v.id));
  const owners = A.assignableOwners(state.me, liveUsers()).filter(u => u.role !== 'gip' || A.isGip(state.me)).sort(byName);
  const ownerSel = (attr, cur) => `<select ${attr} data-k="ownerId"><option value="">— вы —</option>${owners.map(u => `<option value="${esc(u.id)}"${u.id === cur ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
  const contrSel = (attr, cur) => `<select ${attr} data-k="contractorId"><option value="">—</option>${contractorsArr().map(c => `<option value="${esc(c.id)}"${c.id === cur ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const cardCell = (taskId, isVol) => { const t = taskId ? state.tasks.get(taskId) : null; return t ? `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(t.id)}">${statusChip(t)}</button>` : isVol ? '<span class="hint">нет</span>' : ''; };
  const pdPending = rows.filter(r => vols.has(r.node.id) && !(r.node.taskId && state.tasks.has(r.node.taskId))).length;
  const rdList = comp.rd || [];
  const rdRows = new Map(Composition.rdRows(comp, code).map(r => [r.id, r]));
  const rdPending = [...rdRows.values()].filter(r => !(r.item.taskId && state.tasks.has(r.item.taskId))).length;
  const groups = Composition.rdGroups(comp);
  const pdOptions = cur => {
    const own = cur && !groups.some(g => g.node.id === cur) ? comp.nodes.find(n => n.id === cur) : null; // e.g. a switched-off section
    return `<option value="">— вне разделов ПД —</option>${own ? `<option value="${esc(own.id)}" selected>${esc(own.abbr || own.title)} (выключен)</option>` : ''}${groups.map(g => `<option value="${esc(g.node.id)}"${g.node.id === cur ? ' selected' : ''}>${esc(g.node.abbr)}</option>`).join('')}`;
  };
  const srcTag = src => src === 'gost' ? '<span class="src gost" title="Обозначение есть в таблице В.1 ГОСТ Р 21.101-2026">ГОСТ</span>' : '<span class="src" title="Принято на практике, в таблице ГОСТ Р 21.101-2026 не найдено">практика</span>';

  box.innerHTML = `<div class="cust-top"><span class="hint">База ПД: ${esc(Composition.BASES[comp.base]?.label || '')}. Обозначения — от шифра проекта${code ? ` «${esc(code)}»` : ' (шифр не задан — впишите на вкладке «Основное»)'}.</span><span class="spacer"></span>
      <button class="btn" type="button" data-act="comp-export" data-format="sp">Состав ПД → Word</button><button class="btn" type="button" data-act="comp-export" data-format="vok"${rdRows.size ? '' : ' disabled title="В составе РД пока нет разделов — добавьте их ниже"'}>ВОК → Word</button><button class="btn ghostbtn" type="button" data-act="comp-export" data-format="xlsx">Excel</button></div>
    <div class="comp-opts">
      <label>Нумерация томов ПД <select data-copt="numbering.pd">${Object.entries(Composition.NUMBERING.pd).map(([k, l]) => `<option value="${k}"${Composition.numberingOf(comp).pd === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label>РД <select data-copt="numbering.rd">${Object.entries(Composition.NUMBERING.rd).map(([k, l]) => `<option value="${k}"${Composition.numberingOf(comp).rd === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="chk" title="Задания смежникам по техкарте станут подзадачами разделов; прямые задания задают старт получателя"><input type="checkbox" data-copt="links.pd"${comp.links?.pd !== false ? ' checked' : ''}> Задания по техкарте в ПД</label>
      <label class="chk"><input type="checkbox" data-copt="links.rd"${comp.links?.rd !== false ? ' checked' : ''}> в РД</label>
      <button class="btn ghostbtn sm" type="button" data-act="techcard" data-sec="assign">? техкарта</button></div>

    <section class="comp-part"><div class="comp-h"><h3>1. Проектная документация · ПП РФ № 87</h3><span class="hint">Томов: ${vols.size}</span><span class="spacer"></span>${pdPending ? `<span class="hint">При сохранении будет создано задач: ${pdPending}</span>` : ''}</div>
    <div class="tablewrap"><table class="comp-t"><thead><tr><th>Раздел · подраздел · книга · часть</th><th>Обозначение</th><th>Том</th><th>Ответственный</th><th>Подрядчик</th><th>Задача</th><th>Вкл.</th><th></th></tr></thead><tbody>
    ${rows.map(r => {
      const n = r.node, child = Composition.CHILD[n.kind], v = vols.has(n.id);
      return `<tr class="ck-${n.kind}${r.disabled ? ' off' : ''}${v ? ' vol' : ''}">
        <td><div class="comp-name" style="--d:${r.depth}"><span class="comp-k">${Composition.KINDS[n.kind]}${n.kind === 'section' ? ' ' + (n.num ?? '') : ''}</span>${n.std ? `<span class="comp-title">${esc(n.title)}</span>` : `<input data-cn="${n.id}" data-k="title" value="${esc(n.title)}" placeholder="Название" maxlength="300">`}</div></td>
        <td><input class="code-in" data-cn="${n.id}" data-k="code" value="${esc(n.code || '')}" placeholder="${esc(r.code)}" maxlength="80"></td>
        <td><input class="sm-in" data-cn="${n.id}" data-k="tom" value="${esc(n.tom || '')}" placeholder="${esc(r.tom)}" maxlength="20"></td>
        <td>${v ? ownerSel(`data-cn="${n.id}"`, n.ownerId) : ''}</td><td>${v ? contrSel(`data-cn="${n.id}"`, n.contractorId) : ''}</td><td>${cardCell(n.taskId, v)}</td>
        <td><input type="checkbox" data-cn="${n.id}" data-k="on"${n.on !== false ? ' checked' : ''} aria-label="Включить"></td>
        <td class="nowrap">${child ? `<button class="btn ghostbtn sm" type="button" data-act="comp-add" data-id="${n.id}" title="Добавить: ${Composition.KINDS[child].toLowerCase()}">+ ${Composition.KINDS[child].toLowerCase()}</button>` : ''}${n.std ? '' : `<button class="btn ghostbtn sm" type="button" data-act="comp-del" data-id="${n.id}" aria-label="Удалить">✕</button>`}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="comp-foot"><button class="btn sm" type="button" data-act="comp-add" data-id="">+ свой раздел</button><span class="hint">Разделы постановления не удаляются — их можно выключить. Обозначение и том считаются сами; впишите своё, чтобы переопределить.</span></div></section>

    <section class="comp-part"><div class="comp-h"><h3>2. Рабочая документация · основные комплекты</h3><span class="hint">Разделов: ${rdRows.size}</span><span class="spacer"></span>${rdPending ? `<span class="hint">При сохранении будет создано задач: ${rdPending}</span>` : ''}</div>
    ${comp.rd ? '' : '<p class="hint">Состав рабочей документации ещё не сформирован. <button class="btn sm" type="button" data-act="comp-rd-suggest">Предложить по разделам ПД</button></p>'}
    <div class="rd-groups">${groups.map(g => `<div class="rd-group"><span class="rd-pd"><b>${esc(g.node.abbr)}</b> ${esc(g.node.title)}</span><span class="rd-chips">${g.items.map(it => {
      const here = rdList.some(x => x.pdId === g.node.id && Composition.markBase(x.mark) === it.mark);
      const other = !here && rdList.some(x => Composition.markBase(x.mark) === it.mark);
      return `<button class="rd-chip${here ? ' on' : ''}${other ? ' else' : ''}" type="button" data-act="rd-chip" data-pd="${esc(g.node.id)}" data-mark="${esc(it.mark)}" title="${esc(it.title)}${other ? ' — уже есть в другом разделе' : ''}">${here ? '✓ ' : '+ '}${esc(it.mark)}</button>`;
    }).join('')}<button class="rd-chip own" type="button" data-act="rd-add" data-pd="${esc(g.node.id)}" title="Свой раздел РД к этому разделу ПД">+ своя</button></span></div>`).join('')}</div>
    <div class="tablewrap"><table class="comp-t rd-t"><thead><tr><th></th><th>Том</th><th>Раздел РД</th><th>Наименование</th><th>К разделу ПД</th><th>Обозначение</th><th>Примечание</th><th>Ответственный</th><th>Подрядчик</th><th>Задача</th><th>Вкл.</th><th></th></tr></thead><tbody>
    ${rdList.map((x, i) => { const r = rdRows.get(x.id), base = Composition.RD_MARKS[Composition.markBase(x.mark)];
      const pdOff = x.pdId && !r && x.on !== false && x.mark;
      return `<tr class="${x.on === false || pdOff ? 'off' : 'vol'}"${pdOff ? ' title="Раздел ПД, к которому относится этот раздел, выключен — в ВОК не попадёт"' : ''}><td class="nowrap"><button class="btn ghostbtn sm" type="button" data-act="rd-move" data-id="${x.id}" data-dir="-1"${i ? '' : ' disabled'} aria-label="Выше">↑</button><button class="btn ghostbtn sm" type="button" data-act="rd-move" data-id="${x.id}" data-dir="1"${i < rdList.length - 1 ? '' : ' disabled'} aria-label="Ниже">↓</button></td>
        <td><input class="sm-in" data-rd="${x.id}" data-k="tom" value="${esc(x.tom || '')}" placeholder="${esc(r?.tom || '')}" maxlength="20"></td>
        <td class="nowrap"><input class="mark-in" data-rd="${x.id}" data-k="mark" value="${esc(x.mark)}" placeholder="ЭОМ" maxlength="20">${base ? srcTag(base[1]) : ''}</td>
        <td><input data-rd="${x.id}" data-k="title" value="${esc(x.title || '')}" placeholder="${esc(base?.[0] || 'Наименование')}" maxlength="300"></td>
        <td><select data-rd="${x.id}" data-k="pdId">${pdOptions(x.pdId)}</select></td>
        <td><input class="code-in" data-rd="${x.id}" data-k="code" value="${esc(x.code || '')}" placeholder="${esc(r?.code || '')}" maxlength="80"></td>
        <td><input class="note-in" data-rd="${x.id}" data-k="note" value="${esc(x.note || '')}" placeholder="Выдано, дата…" maxlength="60"></td>
        <td>${ownerSel(`data-rd="${x.id}"`, x.ownerId)}</td><td>${contrSel(`data-rd="${x.id}"`, x.contractorId)}</td><td>${cardCell(x.taskId, true)}</td>
        <td><input type="checkbox" data-rd="${x.id}" data-k="on"${x.on !== false ? ' checked' : ''} aria-label="Включить"></td>
        <td><button class="btn ghostbtn sm" type="button" data-act="rd-del" data-id="${x.id}" aria-label="Удалить">✕</button></td></tr>`; }).join('') || '<tr><td colspan="12" class="hint">Отметьте разделы выше или добавьте свой раздел.</td></tr>'}</tbody></table></div>
    <div class="comp-foot"><button class="btn sm" type="button" data-act="rd-add" data-pd="">+ свой раздел РД</button><span class="hint">Том — по порядку строк, обозначение — «шифр-раздел»; впишите своё, чтобы переопределить (например КЖ1.1). Примечание попадает в ВОК («Выдано», дата выдачи).</span></div></section>`;
}
function rdInsert(item) {
  const comp = state.draft.composition, list = comp.rd || (comp.rd = []);
  const order = new Map(Composition.walk(comp.nodes).map((r, i) => [r.node.id, i]));
  const pos = id => (order.has(id) ? order.get(id) : Infinity);
  let at = list.length;
  if (item.pdId) { at = 0; list.forEach((x, i) => { if (pos(x.pdId) <= pos(item.pdId)) at = i + 1; }); }
  list.splice(at, 0, item);
}
function rdChip(pdId, mark) {
  const comp = state.draft.composition, list = comp.rd || (comp.rd = []);
  const mine = list.filter(x => x.pdId === pdId && Composition.markBase(x.mark) === mark);
  if (mine.length) {
    if (mine.some(x => x.taskId && state.tasks.has(x.taskId))) return toast(`У раздела ${mark} есть карточка — уберите строку крестиком в таблице (карточка останется).`);
    comp.rd = list.filter(x => !mine.includes(x));
  } else rdInsert(rdNew(pdId, mark, Composition.RD_MARKS[mark]?.[0] || ''));
  renderComposition();
}
function rdAdd(pdId) {
  const item = rdNew(pdId);
  rdInsert(item);
  renderComposition();
  document.querySelector(`[data-rd="${item.id}"][data-k="mark"]`)?.focus();
}
function rdDel(id) {
  const x = rdItem(id);
  if (!x) return;
  if (x.taskId && state.tasks.has(x.taskId) && confirmCompDel !== id) { confirmCompDel = id; return toast('У раздела есть карточка — карточка останется. Нажмите ✕ ещё раз, чтобы убрать раздел из состава.'); }
  confirmCompDel = null;
  state.draft.composition.rd = state.draft.composition.rd.filter(y => y.id !== id);
  renderComposition();
}
function rdMove(id, dir) {
  const list = state.draft.composition.rd, i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  renderComposition();
}
function compNode(id) { return state.draft.composition.nodes.find(n => n.id === id); }
function compAdd(parentId) {
  const nodes = state.draft.composition.nodes, parent = parentId ? compNode(parentId) : null;
  const kind = parent ? Composition.CHILD[parent.kind] : 'section';
  if (!kind) return;
  const num = kind === 'section' ? Math.max(0, ...nodes.filter(n => n.kind === 'section').map(n => n.num || 0)) + 1 : undefined;
  const node = { id: Composition.newId(), parentId: parentId || '', kind, num, abbr: kind === 'section' ? 'ИД' + num : '', title: '', on: true, marks: [], ownerId: '', contractorId: '' };
  // Insert after the parent's last descendant so the flat list keeps the tree order.
  const desc = new Set([parentId]);
  let at = parentId ? nodes.findIndex(n => n.id === parentId) : nodes.length - 1;
  for (let i = at + 1; i < nodes.length && parentId; i++) { if (desc.has(nodes[i].parentId)) { desc.add(nodes[i].id); at = i; } else if (!desc.has(nodes[i].id)) break; }
  nodes.splice(at + 1, 0, node);
  renderComposition();
  document.querySelector(`[data-cn="${node.id}"][data-k="title"]`)?.focus();
}
function compDel(id) {
  const nodes = state.draft.composition.nodes, drop = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const n of nodes) if (!drop.has(n.id) && drop.has(n.parentId)) { drop.add(n.id); grew = true; } }
  if ([...drop].some(x => compNode(x)?.taskId && state.tasks.has(compNode(x).taskId)) && !confirmCompDel) { confirmCompDel = id; return toast('У строки есть карточка — карточка останется. Нажмите ✕ ещё раз, чтобы убрать строку из состава.'); }
  confirmCompDel = null;
  state.draft.composition.nodes = nodes.filter(n => !drop.has(n.id));
  renderComposition();
}
// Word lists need the names for the title page and the stamp; asked on each export, remembered on this computer.
async function compExport(format) {
  const id = state.drawer.id;
  if (!(await submitSimple(true))) return;
  let opts = {};
  if (format !== 'xlsx') {
    opts = await askDocNames(format);
    if (!opts) return;
  }
  const res = await api.exportComposition(id, format, opts);
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
}
// Timeline questionnaire («анкета сроков»): stages П, экспертиза, Р (after or parallel to expertise), надзор and
// other contract dates. Shown when a project is created and from the project page («Сроки»). Resolves true when saved.
function askTimeline(p) {
  const ms = (p.milestones || []).map(m => ({ ...m }));
  // All phases, as on «Для заказчика» (one list); «Договор» only for GIPs.
  const gip = A.isGip(state.me);
  // A new plan: expertise follows П and Р follows expertise (as before 4.1) until the user unticks it.
  let phases = L.defaultPhases().map(d => { const was = (p.phases || []).find(x => x.key === d.key); return { ...d, ...(was || {}), ...(!was?.start && was?.chain === undefined && ['expertise', 'r'].includes(d.key) ? { chain: true } : {}) }; });
  const shown = () => phases.map((ph, i) => ({ ph, i })).filter(x => gip || x.ph.key !== 'contract');
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    const msRow = (m, i) => `<div class="tq-ms" data-i="${i}"><input class="tq-ms-t" value="${esc(m.title || '')}" placeholder="Например: выдача ТУ, оплата аванса, сдача сметы" maxlength="120"><input class="tq-ms-d" type="date" value="${esc(m.date || '')}"><button class="btn ghostbtn sm" type="button" data-m="ms-del" aria-label="Убрать">✕</button></div>`;
    root.innerHTML = `<form class="modal tq-modal" role="dialog" aria-modal="true" aria-labelledby="tltitle" novalidate><h2 id="tltitle">Сроки по договору · ${esc(p.name || '')}</h2>
      <p class="hint">По этим срокам программа расставит предварительные даты разделов по волнам техкарты и сроки заданий смежникам. Можно заполнить потом: кнопка «Сроки» на странице проекта.</p>
      <div id="tq-phases"></div>
      <div class="tq-mode"><span class="lbl">Рабочая документация</span>
        <label class="chk"><input type="radio" name="tq-mode" value="after"${p.rdMode !== 'parallel' ? ' checked' : ''}> после экспертизы</label>
        <label class="chk"><input type="radio" name="tq-mode" value="parallel"${p.rdMode === 'parallel' ? ' checked' : ''}> параллельно с экспертизой</label>
        <span class="hint" id="tq-hint"></span></div>
      <div class="tq-ms-box"><span class="lbl">Иные сроки по договору</span><div id="tq-ms">${ms.map(msRow).join('')}</div><button class="btn sm" type="button" data-m="ms-add">+ срок</button></div>
      <div class="err" id="tq-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить сроки</button><button class="btn" type="button" data-m="cancel">Заполню потом</button></div></form>`;
    document.body.append(root);
    const q = sel => root.querySelector(sel);
    const draw = () => {
      const list = shown();
      q('#tq-phases').innerHTML = phaseTableHtml(list.map(x => x.ph), (k, f) => `data-ph="${list[k].i}.${f}"`) + phaseGanttHtml(phases.filter(x => gip || x.key !== 'contract'), ms);
    };
    // «Р после экспертизы / параллельно»: sets the chain of Р and, for «параллельно», puts Р right after П.
    const mode = () => {
      const m = q('input[name="tq-mode"]:checked').value, r = phases.find(x => x.key === 'r'), pp = phases.find(x => x.key === 'p');
      if (m === 'parallel' && r) {
        const was = r.chain; r.chain = false;
        if (isDate(pp?.finish) && (was || !isDate(r.start) || r.auto)) { const d = L.phaseDays(r); r.start = addDays(pp.finish, 1); if (d > 0) r.finish = addDays(r.start, d - 1); r.auto = true; }
      }
      if (m === 'after' && r) { r.chain = true; delete r.auto; }
      phases = L.planPhases(phases);
      q('#tq-hint').textContent = m === 'parallel' ? 'Р стартует сразу после П; замечания экспертизы правятся в обоих.' : 'Р стартует после положительного заключения.';
    };
    const close = r => { root.remove(); resolve(r); };
    root.addEventListener('input', e => { const k = e.target.dataset.ph?.split('.'); if (k) { const x = phases[Number(k[0])]; x[k[1]] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; } });
    root.addEventListener('change', e => {
      const k = e.target.dataset.ph?.split('.');
      if (k) { const x = phases[Number(k[0])]; x[k[1]] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; phases = L.planPhases(phases, Number(k[0]), k[1]); draw(); q(`[data-ph="${k[0]}.${k[1]}"]`)?.focus(); return; }
      if (e.target.name === 'tq-mode') { mode(); draw(); }
    });
    root.addEventListener('click', e => {
      const m = e.target.dataset.m;
      if (e.target === root || m === 'cancel') close(false);
      if (m === 'ms-add') { q('#tq-ms').insertAdjacentHTML('beforeend', msRow({}, Date.now())); q('#tq-ms .tq-ms:last-child .tq-ms-t').focus(); }
      if (m === 'ms-del') e.target.closest('.tq-ms').remove();
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } });
    mode(); draw();
    q('[data-ph$=".start"]')?.focus();
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const err = (t, f) => modalErr(root, '#tq-err', t, f);
      for (const x of phases) delete x.auto;
      for (const [i, x] of phases.entries()) if (isDate(x.start) && isDate(x.finish) && x.finish < x.start) return err(`${L.phaseLabel(x.key)}: окончание раньше начала.`, `[data-ph="${i}.finish"]`);
      // A non-GIP never sees «Договор»: it is kept as stored.
      if (!gip) { const c = (p.phases || []).find(x => x.key === 'contract'); const i = phases.findIndex(x => x.key === 'contract'); if (i >= 0) phases[i] = c ? { ...c } : phases[i]; }
      const old = new Map(ms.map(m => [m.id, m]));
      const milestones = [...root.querySelectorAll('.tq-ms')].map(r => ({ title: r.querySelector('.tq-ms-t').value.trim(), date: r.querySelector('.tq-ms-d').value }))
        .filter(m => m.title).map((m, i) => { const was = ms[i] && old.get(ms[i].id); return { id: was?.title === m.title ? was.id : newId(), title: m.title, date: m.date, done: !!(was?.title === m.title && was.done) }; });
      const rdMode = q('input[name="tq-mode"]:checked').value;
      const ok = await write(op.update('projects', p.id, { phases, milestones, rdMode }), 'Сроки проекта сохранены');
      if (ok) { syncPhasesDraft(p.id, phases, milestones); close(true); }
    });
  });
}
function techcardBody(sec) {
  const T = Techcard, lbl = k => k.replace(/^ИОС(\d)$/, 'ИОС $1');
  // Sections are [num, abbr, title, …]; ИОС subsections are [abbr, title, marks].
  const flat = Object.values(Composition.BASES).flatMap(b => b.sections.flatMap(x => [[x[1], x[2]], ...(x[4] || []).map(y => [y[0], y[1]])]));
  const sectionTitle = k => flat.find(x => x[0] === k)?.[1] || '';
  const tbl = (head, rows) => `<div class="tablewrap"><table class="tc-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (sec === 'stages') return `<ol class="tc-stages">${T.STAGES.map(([t, d]) => `<li><b>${esc(t)}</b><span class="hint">${esc(d)}</span></li>`).join('')}</ol>
    <p class="hint">Стадия Р идёт после экспертизы или параллельно с ней — это выбирается в «Сроках» проекта.</p>`;
  if (sec === 'source') return tbl(['Документ', 'Кто даёт', 'Кому нужен'], T.SOURCE_DATA.map(r => r.map(esc)));
  if (sec === 'waves') {
    const by = {};
    for (const [k, w] of Object.entries(T.WAVES)) (by[w] ||= []).push(k);
    return `<div class="tc-waves">${Object.keys(by).map(w => { const [a, b] = T.WAVE_WINDOW[w];
      return `<div class="tc-wave"><div class="tc-wave-h"><b>Волна ${w}</b> <span class="hint">${esc(T.WAVE_NAMES[w])} · ${Math.round(a * 100)}–${Math.round(b * 100)} % срока стадии</span></div>
      <div class="tc-bar"><i style="left:${a * 100}%;width:${(b - a) * 100}%"></i></div>
      <div class="tc-keys">${by[w].map(k => `<span class="chip ${T.CRITICAL.includes(k) ? 'tone-work' : 'tone-idle'}" title="${esc(sectionTitle(k))}">${esc(lbl(k))}</span>`).join('')}</div></div>`; }).join('')}</div>
      <p class="hint">Выделены разделы критического пути: ${T.CRITICAL.map(lbl).join(' → ')}. По этим окнам генератор ставит предварительные даты задач, если заданы сроки стадий П и Р.</p>`;
  }
  if (sec === 'assign') return `<p class="hint">При генерации состава каждое задание становится подзадачей раздела-источника и видно получателю как входящее. Задание «вперёд» (в раздел следующей волны) задаёт старт получателя: «начать после».</p>`
    + tbl(['От', 'Кому', 'Что передаётся'], T.ASSIGN.map(([f, to, w]) => [esc(f === 'ИОС*' ? 'каждый ИОС' : lbl(f)), esc(to.map(x => (x === 'ИОС*' ? 'все ИОС' : lbl(x))).join(', ')), esc(w)]));
  if (sec === 'rd') return `<p class="hint">Что генератор предлагает в рабочую документацию к разделу ПД (✓ — включено по умолчанию). Обозначения разделов РД — по ГОСТ Р 21.101-2026 и принятые на практике.</p>`
    + tbl(['Раздел ПД', 'Разделы РД'], Object.entries(Composition.RD_SUGGEST).map(([k, list]) => [`<b>${esc(lbl(k))}</b>`, list.map(([m, on]) => `<span class="chip ${on ? 'tone-work' : 'tone-idle'}" title="${esc(Composition.RD_MARKS[m]?.[0] || '')}">${on ? '✓ ' : ''}${esc(m)}</span>`).join(' ')]));
  if (sec === 'summary') return tbl(['Раздел', 'Что получает', 'Что отдаёт', 'Когда'], T.SUMMARY.map(r => r.map(esc)));
  // 4.6 (item 10): for each section, briefly — what it gets from whom and what it gives to whom.
  if (sec === 'bysec') {
    const ALIAS = { ИОС1: 'ЭОМ', ИОС2: 'ВК · вода', ИОС3: 'ВК · канализация', ИОС4: 'ОВ, ТС, ИТП', ИОС5: 'СС', ИОС6: 'ГС' };
    const name = k => `${lbl(k)}${ALIAS[k] ? ` <span class="hint">(${ALIAS[k]})</span>` : ''}`;
    const short = k => esc(ALIAS[k] ? ALIAS[k].split(/[ ,·]/)[0] : lbl(k));
    const keys = Object.keys(T.WAVES).filter(k => !['ИД', 'СМ', 'ПЗ'].includes(k));
    const all = T.pairs(keys);
    const one = k => {
      const inc = all.filter(x => x.to === k), out = all.filter(x => x.from === k);
      if (!inc.length && !out.length) return '';
      const rows = (list, side) => list.map(x => `<li><b>${side === 'in' ? 'от ' : ''}${short(side === 'in' ? x.from : x.to)}</b> — ${esc(x.what)}</li>`).join('');
      return `<div class="tc-sec" data-key="${esc(k)}"><h4>${name(k)} <span class="hint">· волна ${T.waveOf(k)}</span></h4>
        ${inc.length ? `<div class="tc-io"><span class="tc-io-h">Получает</span><ul>${rows(inc, 'in')}</ul></div>` : ''}
        ${out.length ? `<div class="tc-io"><span class="tc-io-h out">Выдаёт</span><ul>${rows(out, 'out')}</ul></div>` : ''}</div>`;
    };
    return `<p class="hint">Например: ОВ получает планировки от АР и сетку колонн от КР, выдаёт КР и АР отверстия и нагрузки, ЭОМ — электрические нагрузки. Из этих пар генератор делает задания-подзадачи.</p>
      <div class="tc-secs">${keys.map(one).join('')}</div>`;
  }
  return '';
}
function openTechcard(sec = 'stages') {
  $('.tc-back')?.remove();
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'modal-back tc-back';
  const draw = s => {
    root.innerHTML = `<div class="modal tc-modal" role="dialog" aria-modal="true" aria-labelledby="tctitle"><div class="tc-head"><h2 id="tctitle">Техкарта процесса проектирования</h2><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-m="close" aria-label="Закрыть">✕</button></div>
      <nav class="tc-nav">${TC_SECS.map(([k, l]) => `<button class="btn sm${k === s ? ' primary' : ''}" type="button" data-m="sec" data-sec="${k}">${l}</button>`).join('')}</nav>
      <div class="tc-body">${techcardBody(s)}</div>
      <p class="hint tc-foot">Порядок волн и состав заданий — рабочая версия, будет уточняться.</p></div>`;
  };
  draw(TC_SECS.some(x => x[0] === sec) ? sec : 'stages');
  document.body.append(root);
  root.addEventListener('click', e => { const m = e.target.closest('[data-m]')?.dataset.m; if (e.target === root || m === 'close') root.remove(); if (m === 'sec') draw(e.target.closest('[data-m]').dataset.sec); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  root.tabIndex = -1; root.focus();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'project-timeline': ({ id }) => { const pr = state.projects.get(id); if (pr) askTimeline(pr).then(ok => ok && refresh()); },
  'techcard': ({ el }) => { openTechcard(el.dataset.sec || 'stages'); },
  'comp-base': ({ el }) => { state.draft.composition = Composition.fromBase(el.dataset.v); renderComposition(); },
  'comp-add': ({ id }) => { compAdd(id); },
  'comp-del': ({ id }) => { compDel(id); },
  'comp-rd-suggest': () => { state.draft.composition.rd = Composition.rdDefaults(state.draft.composition); renderComposition(); },
  'rd-chip': ({ el }) => { rdChip(el.dataset.pd, el.dataset.mark); },
  'rd-add': ({ el }) => { rdAdd(el.dataset.pd); },
  'rd-del': ({ id }) => { rdDel(id); },
  'rd-move': ({ el, id }) => { rdMove(id, Number(el.dataset.dir)); },
  'comp-export': ({ el }) => { compExport(el.dataset.format); },
});

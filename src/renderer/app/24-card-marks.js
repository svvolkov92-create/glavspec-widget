// The task's place in the composition: a section/volume of ПД or a set of РД.
function compPlaceOf(t) {
  return t?.id ? placeIndex().get(t.id) || null : null;
}
// «Марка» in the task card: no checkbox grid any more. A section of the composition shows where it sits;
// an assignment shows from whom to whom; any other task gets one text field (marks are optional there).
function marksField(t) {
  const marks = sectionsOf(t), hidden = `<input type="hidden" name="marksExtra" value="${esc(marks.join(', '))}">`;
  if (t.kind === 'assign') {
    const from = state.tasks.get(t.parentId), to = (t.toTaskIds || []).map(id => state.tasks.get(id)).filter(Boolean);
    return `<div class="f wide asg-box">${hidden}<div class="asg-h"><b>Задание смежнику</b> <button class="btn ghostbtn sm" type="button" data-act="techcard" data-sec="assign" title="Откуда берутся задания — техкарта">? техкарта</button></div>
      <div class="asg-route"><span>от</span> ${from ? `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(from.id)}">${esc(marksText(from))}${from.title ? ' · ' + esc(from.title) : ''}</button>` : '<span class="hint">раздел удалён</span>'}
        <span>→</span> ${to.map(x => `<button class="linkbtn" type="button" data-act="open-task" data-id="${esc(x.id)}">${esc(marksText(x))}${x.title ? ' · ' + esc(x.title) : ''}</button>`).join(', ') || '<span class="hint">получатель удалён</span>'}</div>
      <div class="fgrid asg-off"><label class="chk"><input type="checkbox" name="official"${t.official ? ' checked' : ''}> Оформляется официально</label>
        <div class="f"><label for="t-off-no">Номер задания</label><input id="t-off-no" name="officialNo" value="${esc(t.officialNo || '')}" maxlength="40" placeholder="ЗД-ОВ-03"></div>
        <div class="f"><label for="t-off-by">Подписывает</label><input id="t-off-by" name="officialBy" value="${esc(t.officialBy || '')}" maxlength="80" placeholder="ГИП, главспец ОВ"></div></div>
      <span class="hint">Получатель видит это задание у себя как входящее. Пока задание не выдано, смежник ждёт его${state.tasks.get(t.toTaskIds?.[0])?.dependsOn?.includes(t.id) ? ' — срок его старта связан с этим заданием' : ''}.</span></div>`;
  }
  return taskAssignsBlock(t) + `<div class="f wide" id="t-doc-box">${docFieldHtml(t.projectId, t)}</div>`;
}
// «Раздел» of a card: chosen from the project composition (ПД volumes and РД sections not yet taken by another
// card). Without a composition — a code typed by hand. Without a section — a task with an explanation
// (согласование, сбор ИРД). The composition itself is edited on the project's «Состав» tab.
function docFieldHtml(projectId, t, typed = null) {
  const p = state.projects.get(projectId), comp = p?.composition;
  const place = t.projectId === projectId ? compPlaceOf(t) : null;
  const marks = typed ?? sectionsOf(t);
  // Suggestions: ПД sections (ПП РФ № 87) and РД sections (ГОСТ Р 21.101 and practice).
  const known = [...new Map([...Composition.BASES.nonprod.sections.flatMap(([, abbr, title, , subs]) => [[abbr, title], ...(subs || []).map(([a, tl]) => [a, tl])]),
    ...MARK_GROUPS.flatMap(g => g.marks), ...Object.entries(Composition.RD_MARKS).map(([m, [tl]]) => [m, tl])]).entries()];
  const freeInput = (show, value) => `<div class="doc-free"${show ? '' : ' hidden'}><input id="t-marks-extra" name="marksExtra" value="${esc(value)}" placeholder="Шифр раздела: ЭОМ, ИОС1, АР…" maxlength="200" autocomplete="off" aria-label="Шифр раздела" list="marks-dl">
    <datalist id="marks-dl">${known.map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join('')}</datalist>
    <span class="hint">Несколько — через запятую.</span></div>`;
  if (!comp) {
    return `<label for="t-marks-extra">Раздел</label>${freeInput(true, marks.join(', '))}
      <span class="hint">${p ? 'У проекта нет состава документации — разделы можно выбрать из списка, если сформировать состав на вкладке проекта «Состав».' : 'Сначала выберите проект.'} Без раздела — задача с уточнением (согласование, сбор ИРД).</span>`;
  }
  const taken = id => id && id !== t.id && state.tasks.has(id);
  const vols = Composition.volumes(comp, p.code || ''), rds = Composition.rdRows(comp, p.code || '');
  const cur = place?.ref || (marks.length ? 'free' : '');
  const opt = (v, l, dis = false) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`;
  const pdOpts = vols.map(v => { const n = comp.nodes.find(x => x.id === v.id); return opt('pd:' + v.id, `${v.abbr || v.code} · ${v.title}${taken(n?.taskId) ? ' — уже есть карточка' : ''}`, taken(n?.taskId)); }).join('');
  const rdOpts = rds.map(r => opt('rd:' + r.id, `${r.mark} · ${r.title}${taken(r.item.taskId) ? ' — уже есть карточка' : ''}`, taken(r.item.taskId))).join('');
  return `<label for="t-doc">Раздел</label>
    <select id="t-doc" name="docRef">${opt('', '— без раздела: задача (согласование, сбор ИРД…)')}
      ${pdOpts ? `<optgroup label="Проектная документация · стадия П">${pdOpts}</optgroup>` : ''}${rdOpts ? `<optgroup label="Рабочая документация · стадия Р">${rdOpts}</optgroup>` : ''}
      <optgroup label="Другое">${opt('free', 'Свой раздел — вписать шифр…')}</optgroup></select>
    ${freeInput(cur === 'free', place ? '' : marks.join(', '))}
    <span class="hint">${place ? `Том ${esc(String(place.tom))} · ${esc(place.code)}. ` : ''}Разделы берутся из состава проекта (вкладка «Состав»).</span>`;
}
// Codes of the chosen composition section, for directions and contractor suggestions (ИОС1 → ЭС, ЭН, ЭОМ, ЭО).
function docRefSections(projectId, ref) {
  const p = state.projects.get(projectId), comp = p?.composition;
  if (!comp || !ref) return [];
  const [kind, id] = ref.split(':');
  if (kind === 'pd') { const v = Composition.volumes(comp, p.code || '').find(x => x.id === id); return v ? normalizeMarks(v.node.marks?.length ? v.node.marks : [v.abbr]) : []; }
  if (kind === 'rd') { const r = Composition.rdRows(comp, p.code || '').find(x => x.id === id); return r ? normalizeMarks([r.mark]) : []; }
  return [];
}
// The composition with this card linked to `ref` (and unlinked from where it was). null — nothing to change.
function compWithLink(projectId, taskId, ref) {
  const p = state.projects.get(projectId), comp = p?.composition;
  if (!comp) return null;
  const next = JSON.parse(JSON.stringify(comp));
  let changed = false;
  for (const n of next.nodes || []) if (n.taskId === taskId && 'pd:' + n.id !== ref) { n.taskId = ''; changed = true; }
  for (const x of next.rd || []) if (x.taskId === taskId && 'rd:' + x.id !== ref) { x.taskId = ''; changed = true; }
  const [kind, id] = (ref || '').split(':');
  const target = kind === 'pd' ? (next.nodes || []).find(n => n.id === id) : kind === 'rd' ? (next.rd || []).find(x => x.id === id) : null;
  if (target && target.taskId !== taskId) { target.taskId = taskId; changed = true; }
  return changed ? next : null;
}
// In a section's card: its outgoing assignments (subtasks) and the incoming ones it waits for.
function taskAssignsBlock(t) {
  const { out, inc } = assignsOf(t);
  if (!out.length && !inc.length) return '';
  const line = (x, dir) => { const other = dir === 'out' ? (x.toTaskIds || []).map(id => state.tasks.get(id)).filter(Boolean).map(marksText).join(', ') : marksText(state.tasks.get(x.parentId) || {});
    return `<li><button class="linkbtn" type="button" data-act="open-task" data-id="${esc(x.id)}">${dir === 'out' ? '→' : '←'} ${esc(other || x.title)}</button> ${statusChip(x)} <span class="hint">${x.finish ? 'до ' + fmtDate(x.finish) : ''} · ${esc((x.note || '').slice(0, 90))}${(x.note || '').length > 90 ? '…' : ''}</span></li>`; };
  return `<div class="f wide asg-list">${out.length ? `<span class="lbl">Исходящие задания (${out.length})</span><ul>${out.map(x => line(x, 'out')).join('')}</ul>` : ''}
    ${inc.length ? `<span class="lbl">Входящие задания (${inc.length})</span><ul>${inc.map(x => line(x, 'in')).join('')}</ul>` : ''}</div>`;
}
function selectedMarks() {
  const doc = $('#t-doc');
  if (doc && doc.value && doc.value !== 'free') return docRefSections(val('projectId'), doc.value);
  if (doc && !doc.value) return [];
  return normalizeMarks(splitMarks(val('marksExtra')));
}
function onMarksChanged() {
  const list = selectedMarks();
  const own = $('#t-owner');
  if (own && !own.disabled) { const v = own.value; own.innerHTML = ownerOptions(v, list); own.value = v; }
  execPickersRefresh();
  updateOwnerWarn();
  smartDefaults();
}

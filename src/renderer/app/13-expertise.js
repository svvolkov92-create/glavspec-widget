/* ---------- 4.15: «Экспертиза» — remarks of the expertise by cycles, who answers, by when, the answer ---------- */
// project.expertise = { org, cycles: [{ id, no, date, due }] }; the remarks (4.22) are records of their own in state.remarks:
// { projectId, cycleId, pos, n, mark, text, ownerId, due, status, answer, rvi }. exOf() puts them back into the cycles, so
// this part reads the expertise as one object; exSave() writes back only what changed (a project, remarks one by one).
// Before 4.22 the remarks lived in cycles[].remarks — that copy stays in the project untouched (a way back).
const EX_STATUS = [['work', 'в работе', 'work'], ['ready', 'ответ готов', 'review'], ['returned', 'вернули', 'warn'], ['closed', 'закрыто', 'ok']];
const exStatus = k => EX_STATUS.find(s => s[0] === k) || EX_STATUS[0];
const exOpen = r => r.status !== 'closed';
const exLate = r => ['work', 'returned'].includes(r.status || 'work') && isDate(r.due) && r.due < state.today;
const exByPos = (a, b) => (Number(a.pos) || 0) - (Number(b.pos) || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
function exOf(p) {
  const ex = { org: '', cycles: [], ...(p?.expertise || {}) };
  const rs = [...state.remarks.values()].filter(r => r.projectId === p?.id).sort(exByPos);
  return { ...ex, cycles: ex.cycles.map(c => ({ ...c, remarks: rs.filter(r => r.cycleId === c.id) })) };
}
let exCycle = {}; // project id → cycle id shown
function exCycleOf(p) {
  const ex = exOf(p);
  return ex.cycles.find(c => c.id === exCycle[p.id]) || ex.cycles.at(-1) || null;
}
// Marks of the project's sections: the remarks are tied to them.
const projectMarks = pid => [...new Set([...state.tasks.values()].filter(t => t.projectId === pid && !t.deletedAt).flatMap(t => sectionsOf(t)))].sort((a, b) => a.localeCompare(b, 'ru'));
// Who answers a remark of a mark by default: the owner of the card of that section.
function exOwnerFor(pid, mark) {
  const k = L.markSet([mark]);
  const t = [...state.tasks.values()].find(x => x.projectId === pid && !x.deletedAt && sectionsOf(x).some(m => [...L.markSet([m])].some(y => k.has(y))));
  return t?.ownerId || '';
}
// Open remarks of the expertise for a card (its sections) — shown in the card's title block.
function exRemarksOf(t) {
  const p = projectOf(t), c = p && exCycleOf(p);
  if (!c) return [];
  const mine = L.markSet(sectionsOf(t));
  return c.remarks.filter(r => exOpen(r) && [...L.markSet([r.mark])].some(k => mine.has(k)));
}
// Remarks waiting for this user (all projects, the last cycle of each).
function myRemarks() {
  const me = state.me?.id, out = [];
  for (const p of liveProjects()) { const c = exCycleOf(p); if (c) for (const r of c.remarks) if (r.ownerId === me && ['work', 'returned'].includes(r.status || 'work')) out.push({ p, c, r }); }
  return out.sort((a, b) => String(a.r.due || '9').localeCompare(String(b.r.due || '9')));
}
const canEx = p => A.canManageCatalog(state.me) && !p.archived;
const REMARK_KEYS = ['n', 'mark', 'text', 'ownerId', 'due', 'status', 'answer', 'rvi'];
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
async function exSave(p, mutate, msg) {
  const cur = state.projects.get(p.id), before = exOf(cur), ex = clone(before);
  mutate(ex);
  const ops = [], strip = e => ({ ...e, cycles: e.cycles.map(({ remarks, ...c }) => c) });
  if (!sameJson(strip(before), strip(ex))) {
    const old = new Map((cur?.expertise?.cycles || []).map(c => [c.id, c.remarks])), e = strip(ex);
    ops.push(op.update('projects', p.id, { expertise: { ...e, moved: true, cycles: e.cycles.map(c => (old.get(c.id) ? { ...c, remarks: old.get(c.id) } : c)) } }));
  }
  const was = new Map(before.cycles.flatMap(c => c.remarks.map(r => [r.id, r]))), kept = new Set();
  let pos = Math.max(0, ...[...state.remarks.values()].filter(r => r.projectId === p.id).map(r => Number(r.pos) || 0));
  for (const c of ex.cycles) for (const r of c.remarks) {
    kept.add(r.id);
    const w = was.get(r.id);
    if (!w) ops.push(op.set('remarks', r.id, { ...Object.fromEntries(REMARK_KEYS.filter(k => r[k] !== undefined).map(k => [k, r[k]])), projectId: p.id, cycleId: c.id, pos: ++pos, createdAt: new Date().toISOString() }));
    else {
      const ch = Object.fromEntries(REMARK_KEYS.filter(k => !sameJson(w[k], r[k])).map(k => [k, r[k] ?? null]));
      if (Object.keys(ch).length) ops.push(op.update('remarks', r.id, ch));
    }
  }
  for (const id of was.keys()) if (!kept.has(id)) ops.push(op.del('remarks', id));
  return ops.length ? write(ops, msg) : true;
}

function expertiseBlock(p) {
  const ex = exOf(p), edit = canEx(p);
  if (!ex.cycles.length && !edit) return '';
  const c = exCycleOf(p), list = c ? c.remarks : [];
  const n = { all: list.length, closed: list.filter(r => r.status === 'closed').length, work: list.filter(r => ['work', 'returned', 'ready'].includes(r.status || 'work')).length, late: list.filter(exLate).length };
  const kpi = (l, v, tone) => `<div class="ex-kpi"><span class="hint">${l}</span> <b class="num kv-${v ? tone : 'idle'}">${v}</b></div>`;
  const cyc = ex.cycles.map(x => `<button class="btn sm ${x.id === c?.id ? 'on' : ''}" type="button" data-act="ex-cycle" data-id="${esc(p.id)}" data-v="${esc(x.id)}">Цикл ${esc(x.no)}${isDate(x.date) ? ' · ' + fmtDate(x.date).slice(0, 5) : ''} · ${x.remarks.length}</button>`).join('');
  const who = id => state.users.get(id)?.name || '';
  const body = `<div class="let ex">
    <div class="let-bar">${edit ? `<input class="ex-org" data-ex-org="${esc(p.id)}" value="${esc(ex.org || '')}" placeholder="Экспертиза: ООО «Эксперт», ГАУ…" maxlength="160" aria-label="Организация экспертизы">` : `<b>${esc(ex.org || 'Экспертиза')}</b>`}
      <span class="seg">${cyc}</span>${edit ? `<button class="btn ghostbtn sm" type="button" data-act="ex-cycle-new" data-id="${esc(p.id)}">＋ Цикл</button>` : ''}<span class="spacer"></span>
      ${c && list.length && typeof api.exportExpertise === 'function' ? `<button class="btn ghostbtn sm" type="button" data-act="ex-word" data-id="${esc(p.id)}">Ответы в Word</button>` : ''}
      ${c && edit ? `<button class="btn sm" type="button" data-act="ex-paste" data-id="${esc(p.id)}">Вставить списком</button><button class="btn primary sm" type="button" data-act="ex-new" data-id="${esc(p.id)}">＋ Замечание</button>` : ''}</div>
    ${c ? `<div class="ex-kpis">${kpi('Всего', n.all, 'work')}${kpi('Закрыто', n.closed, 'ok')}${kpi('В работе', n.work, 'review')}${kpi('Просрочено', n.late, 'bad')}${isDate(c.due) ? `<span class="hint">ответ экспертизе до ${fmtDate(c.due)}</span>` : ''}</div>
      ${list.length ? `<table class="let-t ex-t"><thead><tr><th>№</th><th>Раздел</th><th>Замечание</th><th>Отвечает</th><th>Срок</th><th>Статус</th></tr></thead><tbody>${list.map(r => { const [, l, tone] = exStatus(r.status);
        return `<tr class="ex-row" data-act="ex-open" data-id="${esc(p.id)}" data-v="${esc(r.id)}" tabindex="0" role="button"><td class="num"><b>${esc(r.n || '')}</b></td><td>${r.mark ? `<b class="ex-mark">${esc(r.mark)}</b>` : ''}</td>
          <td class="ex-text">${esc(r.text)}${r.answer ? `<div class="hint ex-ans">Ответ: ${esc(r.answer)}</div>` : ''}</td><td>${esc(who(r.ownerId))}</td><td class="num">${isDate(r.due) ? fmtDate(r.due) : '—'}</td>
          <td><span class="chip tone-${exLate(r) ? 'bad' : tone}">${exLate(r) ? `просрочено ${dayNum(state.today) - dayNum(r.due)} дн.` : l}</span>${r.rvi ? ` <span class="chip tone-work">${rviNo(r.rvi)}</span>` : ''}</td></tr>`; }).join('')}</tbody></table>`
        : '<p class="hint let-empty">Замечаний в этом цикле пока нет. «Вставить списком» — скопируйте замечания из письма экспертизы, по строке на замечание.</p>'}`
      : `<p class="hint let-empty">Когда придут замечания экспертизы, заведите «Цикл» — дальше замечания по разделам, ответственные и сроки.</p>`}</div>`;
  return auxBlock('ex:' + p.id, 'Экспертиза', `<span class="meta">${c ? `${n.closed} из ${n.all} закрыто${n.late ? ` · <span class="neg">просрочено ${n.late}</span>` : ''}` : ''}</span>`, body);
}

function askCycle(p) {
  const ex = exOf(p), no = ex.cycles.length + 1;
  const { root, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="exc-t" novalidate><h2 id="exc-t">Цикл экспертизы ${no}</h2>
    <div class="fgrid"><div class="f"><label for="exc-date">Замечания получены</label><input id="exc-date" type="date" value="${esc(state.today)}"></div>
      <div class="f"><label for="exc-due">Ответить экспертизе до</label><input id="exc-due" type="date" value="${esc(addDays(state.today, 10))}"></div></div>
    <p class="hint">Срок ответа станет сроком новых замечаний — у каждого его можно поменять.</p>
    <div class="modal-f"><button class="btn primary" type="submit">Завести цикл</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
  const q = s => root.querySelector(s);
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const id = newId();
    const ok = await exSave(p, x => { x.cycles.push({ id, no: String(no), date: isDate(q('#exc-date').value) ? q('#exc-date').value : state.today, due: isDate(q('#exc-due').value) ? q('#exc-due').value : '', remarks: [] }); }, `Экспертиза: цикл ${no}`);
    if (ok) { exCycle[p.id] = id; close(); renderNow(); }
  });
}

// One remark: add or edit. Saving writes the whole expertise of the project.
function askRemark(p, rid = '') {
  const c = exCycleOf(p);
  if (!c) return;
  const was = rid ? c.remarks.find(r => r.id === rid) : null, edit = canEx(p);
  // 4.22: the person answering the remark writes the answer, the РВИ and «ответ готов» (the rest stays with the GIP and chiefs).
  const own = !edit && !!was && was.ownerId === state.me?.id && !p.archived && was.status !== 'closed';
  const nextN = String(c.remarks.reduce((m, r) => Math.max(m, parseInt(r.n, 10) || 0), 0) + 1);
  const r = was ? clone(was) : { id: newId(), n: nextN, mark: '', text: '', ownerId: '', due: c.due || '', status: 'work', answer: '' };
  const marks = projectMarks(p.id);
  const rvis = rviRows(p).filter(x => x.r.rvi);
  const people = liveUsers().slice().sort(byName);
  const dis = edit ? '' : ' disabled', disOwn = edit || own ? '' : ' disabled';
  const statuses = EX_STATUS.filter(([k]) => edit || ['work', 'ready', r.status || 'work'].includes(k));
  const { root, close } = openModal(`<form class="modal ex-modal" role="dialog" aria-modal="true" aria-labelledby="exr-t" novalidate><h2 id="exr-t">${was ? `Замечание ${esc(r.n)}` : 'Новое замечание'} <span class="hint">цикл ${esc(c.no)}</span></h2>
    ${own ? '<p class="hint">Вы отвечаете на это замечание: впишите ответ, укажите изменение (РВИ) и поставьте «ответ готов». Само замечание, срок и ответственного меняют ГИП и главспецы.</p>' : ''}
    <div class="fgrid"><div class="f"><label for="exr-n">№ у экспертизы</label><input id="exr-n" value="${esc(r.n)}" maxlength="12"${dis}></div>
      <div class="f"><label for="exr-mark">Раздел</label><input id="exr-mark" value="${esc(r.mark)}" list="exr-marks" maxlength="20" placeholder="КЖ"${dis}><datalist id="exr-marks">${marks.map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
      <div class="f wide"><label class="req" for="exr-text">Замечание</label><textarea id="exr-text" rows="3" maxlength="4000"${dis}>${esc(r.text)}</textarea></div>
      <div class="f"><label for="exr-owner">Отвечает</label><select id="exr-owner"${dis}><option value="">— не назначен —</option>${people.map(u => `<option value="${esc(u.id)}"${u.id === r.ownerId ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="f"><label for="exr-due">Срок</label><input id="exr-due" type="date" value="${esc(r.due || '')}"${dis}></div>
      <div class="f"><label for="exr-st">Статус</label><select id="exr-st"${disOwn}>${statuses.map(([k, l]) => `<option value="${k}"${(r.status || 'work') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="f"><label for="exr-rvi">Изменение (РВИ)</label><select id="exr-rvi"${disOwn}><option value="">—</option>${rvis.map(({ t, r: x }) => `<option value="${x.rvi}"${Number(r.rvi) === x.rvi ? ' selected' : ''}>${rviNo(x.rvi)} · ${esc(marksText(t))}</option>`).join('')}</select></div>
      <div class="f wide"><label for="exr-ans">Ответ</label><textarea id="exr-ans" rows="3" maxlength="4000" placeholder="Что исправлено и где: том, листы"${disOwn}>${esc(r.answer || '')}</textarea></div></div>
    <div class="err" id="exr-err" hidden></div>
    <div class="modal-f">${edit || own ? `<button class="btn primary" type="submit">Сохранить</button>` : ''}<button class="btn" type="button" data-m="cancel">${edit || own ? 'Отмена' : 'Закрыть'}</button>${was && edit ? '<span class="spacer"></span><button class="btn ghostbtn" type="button" data-m="del">Удалить</button>' : ''}</div></form>`);
  const q = s => root.querySelector(s);
  // A mark typed: the owner of that section's card answers by default.
  q('#exr-mark').addEventListener('change', () => { if (!q('#exr-owner').value) { const o = exOwnerFor(p.id, q('#exr-mark').value); if (o) q('#exr-owner').value = o; } });
  (was ? q('#exr-ans') : q('#exr-text')).focus();
  root.addEventListener('click', async e => {
    const m = e.target.dataset.m;
    if (m === 'del' && await exSave(p, x => { const cc = x.cycles.find(y => y.id === c.id); cc.remarks = cc.remarks.filter(y => y.id !== r.id); }, `Замечание ${r.n} удалено`)) close();
  });
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    if (own) {
      const rv = Number(q('#exr-rvi').value) || 0;
      Object.assign(r, { status: q('#exr-st').value, answer: q('#exr-ans').value.trim(), rvi: rv || undefined });
      if (await exSave(p, x => { const cc = x.cycles.find(y => y.id === c.id); const i = cc.remarks.findIndex(y => y.id === r.id); if (i >= 0) cc.remarks[i] = r; }, `Замечание ${r.n} — ответ сохранён`)) close();
      return;
    }
    const text = q('#exr-text').value.trim();
    if (!text) { q('#exr-err').textContent = 'Впишите текст замечания.'; q('#exr-err').hidden = false; q('#exr-text').classList.add('field-bad'); return q('#exr-text').focus(); }
    const mark = q('#exr-mark').value.trim().toUpperCase();
    Object.assign(r, { n: q('#exr-n').value.trim() || nextN, mark, text, ownerId: q('#exr-owner').value || exOwnerFor(p.id, mark), due: isDate(q('#exr-due').value) ? q('#exr-due').value : '', status: q('#exr-st').value, answer: q('#exr-ans').value.trim(), rvi: Number(q('#exr-rvi').value) || 0 });
    if (!r.rvi) delete r.rvi;
    if (await exSave(p, x => { const cc = x.cycles.find(y => y.id === c.id); const i = cc.remarks.findIndex(y => y.id === r.id); if (i >= 0) cc.remarks[i] = r; else cc.remarks.push(r); }, `Замечание ${r.n}${r.mark ? ' · ' + r.mark : ''} — ${was ? 'сохранено' : 'добавлено'}`)) close();
  });
}

// Remarks pasted from the expertise's letter: one per line; «14. КЖ: текст» / «КЖ — текст» / «текст».
function parseRemarks(text, marks, startN) {
  const known = new Set(marks.map(m => m.toUpperCase()));
  let n = startN;
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3).map(line => {
    let num = '', mark = '', rest = line;
    const mNum = rest.match(/^(\d{1,4})[.)]\s*/);
    if (mNum) { num = mNum[1]; rest = rest.slice(mNum[0].length); }
    const mMark = rest.match(/^([А-ЯЁA-Z]{1,6}[\d.]*)\s*[:—–-]\s*/i);
    if (mMark && (known.has(mMark[1].toUpperCase()) || /^(ИОС\d|[А-ЯЁ]{2,4})$/.test(mMark[1].toUpperCase()))) { mark = mMark[1].toUpperCase(); rest = rest.slice(mMark[0].length); }
    if (!num) num = String(n);
    n = (parseInt(num, 10) || n) + 1;
    return { n: num, mark, text: rest.slice(0, 4000) };
  });
}
function askPaste(p) {
  const c = exCycleOf(p);
  if (!c) return;
  const marks = projectMarks(p.id), startN = c.remarks.reduce((m, r) => Math.max(m, parseInt(r.n, 10) || 0), 0) + 1;
  const { root, close } = openModal(`<form class="modal ex-modal" role="dialog" aria-modal="true" aria-labelledby="exp-t" novalidate><h2 id="exp-t">Замечания списком · цикл ${esc(c.no)}</h2>
    <p class="hint">По строке на замечание. В начале строки можно номер и раздел: «14. КЖ: Не представлен расчёт…». Отвечает — ответственный карточки раздела, срок — срок цикла.</p>
    <textarea id="exp-text" rows="10" maxlength="60000" placeholder="1. АР: Уточнить отметку входа\n2. КЖ: Не представлен расчёт плиты на продавливание"></textarea>
    <p class="hint" id="exp-sum"></p>
    <div class="modal-f"><button class="btn primary" type="submit">Добавить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
  const q = s => root.querySelector(s);
  const rows = () => parseRemarks(q('#exp-text').value, marks, startN);
  q('#exp-text').addEventListener('input', () => { const r = rows(); q('#exp-sum').textContent = r.length ? `Замечаний: ${r.length}${r.some(x => x.mark) ? `, с разделом: ${r.filter(x => x.mark).length}` : ''}` : ''; });
  q('#exp-text').focus();
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const list = rows();
    if (!list.length) return close();
    const add = list.map(x => ({ id: newId(), ...x, ownerId: exOwnerFor(p.id, x.mark), due: c.due || '', status: 'work', answer: '' }));
    if (await exSave(p, x => { x.cycles.find(y => y.id === c.id).remarks.push(...add); }, `Экспертиза: добавлено замечаний ${add.length}`)) close();
  });
}

async function exWord(p) {
  const c = exCycleOf(p);
  if (!c) return;
  const res = await api.exportExpertise(p.id, c.id);
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'ex-cycle': ({ el, id }) => { exCycle[id] = el.dataset.v; renderNow(); },
  'ex-cycle-new': ({ id }) => { const p = state.projects.get(id); if (p) askCycle(p); },
  'ex-new': ({ id }) => { const p = state.projects.get(id); if (p) askRemark(p); },
  'ex-open': ({ el, id }) => { const p = state.projects.get(id); if (p) askRemark(p, el.dataset.v); },
  'ex-paste': ({ id }) => { const p = state.projects.get(id); if (p) askPaste(p); },
  'ex-word': ({ id }) => { const p = state.projects.get(id); if (p) exWord(p); },
});

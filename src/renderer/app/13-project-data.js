/* ---------- 4.1.1 (item 60): source data in folders, with files, dates of issue and validity ---------- */
const IRD_FOLDERS = [['rights', 'Правоустанавливающие документы'], ['gpzu', 'ГПЗУ'], ['tz', 'Техническое задание'], ['tu', 'Технические условия'],
  ['geology', 'Инженерная геология'], ['geodesy', 'Инженерная геодезия'], ['ecology', 'Инженерная экология'], ['survey', 'Обмеры / обследование'],
  ['sketch', 'Согласование эскиза'], ['other', 'Прочее']];
const SURVEY_FOLDERS = ['geodesy', 'geology', 'ecology', 'hydromet', 'survey'];
// When the surveys are «ours» (item 11), their folders live in the «Инженерные изыскания» block, unless files are already there.
const irdFolderList = p => [...IRD_FOLDERS, ...(p.irdFolders || []).map(f => [f.id, f.name])]
  .filter(([id]) => p.surveys !== 'ours' || !SURVEY_FOLDERS.includes(id) || (p.irdFiles || []).some(x => x.folder === id));
const irdKind = folder => ({ gpzu: 'gpzu', geodesy: 'geodesy', geology: 'geology', ecology: 'ecology', tu: 'tu' }[folder] || 'other');
let irdOpen = {}; // project id → folder id
function irdStatus(f) {
  if (!isDate(f.until)) return ['idle', isDate(f.issued) ? 'срок не указан' : ''];
  const left = dayNum(f.until) - dayNum(state.today);
  return left < 0 ? ['bad', 'истёк'] : left <= 60 ? ['warn', `истекает через ${left} дн.`] : ['ok', `действует до ${fmtDate(f.until)}`];
}
function irdBlock(p) {
  if (!canFiles() && !(p.irdFiles || []).length) return '';
  const files = p.irdFiles || [], folders = irdFolderList(p), edit = A.canManageCatalog(state.me) && !p.archived;
  const cur = irdOpen[p.id] && folders.some(f => f[0] === irdOpen[p.id]) ? irdOpen[p.id] : (folders.find(f => files.some(x => x.folder === f[0]))?.[0] || folders[0][0]);
  const inF = files.filter(x => x.folder === cur);
  const bad = files.filter(x => irdStatus(x)[0] === 'bad').length, warn = files.filter(x => irdStatus(x)[0] === 'warn').length;
  const ext = n => (String(n).split('.').pop() || '').slice(0, 4).toUpperCase();
  const body = `<div class="ird" data-ird-project="${esc(p.id)}"><nav class="ird-folders">${folders.map(([id, name]) => { const n = files.filter(x => x.folder === id).length, w = files.some(x => x.folder === id && ['bad', 'warn'].includes(irdStatus(x)[0])); return `<button type="button" class="ird-f${id === cur ? ' on' : ''}" data-act="ird-folder" data-id="${esc(p.id)}" data-v="${esc(id)}">📁 <span>${esc(name)}</span>${w ? '<i class="ird-dot"></i>' : ''}<b class="hint">${n || ''}</b></button>`; }).join('')}
      ${edit ? `<button type="button" class="ird-f ird-add" data-act="ird-newfolder" data-id="${esc(p.id)}">＋ Папка</button>` : ''}</nav>
    <div class="ird-files" data-ird-folder="${esc(cur)}"><div class="ird-h"><b>${esc(folders.find(f => f[0] === cur)?.[1] || '')}</b><span class="spacer"></span>${edit ? `<button class="btn primary sm" type="button" data-act="ird-upload" data-id="${esc(p.id)}">＋ Загрузить</button>` : ''}</div>
      ${inF.map(f => { const [tone, st] = irdStatus(f); return `<div class="ird-row"><span class="ird-ext e-${esc(ext(f.name).toLowerCase())}">${esc(ext(f.name))}</span><span class="ird-n"><button class="linkbtn" type="button" data-act="ird-open" data-id="${esc(p.id)}" data-fid="${esc(f.id)}"><b>${esc(f.name)}</b></button><span class="hint">${fileSize(f.size)}${f.at ? ' · загружен ' + fmtDate(f.at.slice(0, 10)) : ''}</span></span>
        ${edit ? `<label class="ird-d">выдан <input type="date" data-ird="issued" data-pid="${esc(p.id)}" data-fid="${esc(f.id)}" value="${esc(f.issued || '')}"></label><label class="ird-d">до <input type="date" data-ird="until" data-pid="${esc(p.id)}" data-fid="${esc(f.id)}" value="${esc(f.until || '')}"></label>` : `<span class="hint">${f.issued ? 'выдан ' + fmtDate(f.issued) : ''}</span>`}
        ${st ? `<span class="chip tone-${tone}">${st}</span>` : ''}${edit ? `<button class="btn ghostbtn sm" type="button" data-act="ird-del" data-id="${esc(p.id)}" data-fid="${esc(f.id)}" title="Убрать" aria-label="Убрать">×</button>` : ''}</div>`; }).join('') || `<p class="hint ird-empty">${edit ? 'Перетащите сюда файлы из Проводника или нажмите «Загрузить».' : 'В этой папке пока ничего нет.'}</p>`}
      ${edit && inF.length ? '<p class="hint ird-tip">Для ГПЗУ и топосъёмки срок действия считается от даты выдачи сам; для ТУ и остального — впишите по тексту документа.</p>' : ''}</div></div>`;
  return auxBlock('pi:' + p.id, 'Сбор ИРД', `<span class="meta">${files.length}${bad ? ` · <span class="neg">истёк ${bad}</span>` : ''}${warn ? ` · истекает ${warn}` : ''}</span>`, body);
}
/* ---------- 4.6 (item 11): engineering surveys as their own block when «Тандем» does them ---------- */
const SURVEY_KINDS = [['geodesy', 'Инженерно-геодезические'], ['geology', 'Инженерно-геологические'], ['ecology', 'Инженерно-экологические'],
  ['hydromet', 'Инженерно-гидрометеорологические'], ['survey', 'Обследование конструкций']];
const SURVEY_STATUS = [['plan', 'Не начаты'], ['work', 'В работе'], ['report', 'Отчёт получен'], ['passed', 'Прошли экспертизу']];
const surveyRows = p => SURVEY_KINDS.map(([k, title], i) => ({ k, title, ...(i < 3 ? { on: true } : { on: false }), ...(p.surveyRows || {})[k] }));
function surveysBlock(p) {
  if (p.surveys !== 'ours') return '';
  const edit = A.canManageCatalog(state.me) && !p.archived, files = p.irdFiles || [];
  const rows = surveyRows(p).filter(r => edit || r.on);
  const late = rows.filter(r => r.on && isDate(r.finish) && r.finish < state.today && !['report', 'passed'].includes(r.status)).length;
  const body = `<table class="pd-t sv-t"><thead><tr>${edit ? '<th></th>' : ''}<th>Вид изысканий</th><th>Кто делает</th><th>Срок отчёта</th><th>Состояние</th><th>Отчёт</th></tr></thead><tbody>
    ${rows.map(r => { const n = files.filter(f => f.folder === r.k).length, overdue = r.on && isDate(r.finish) && r.finish < state.today && !['report', 'passed'].includes(r.status);
      return `<tr class="${r.on ? '' : 'off'}">${edit ? `<td><input type="checkbox" data-sv="on" data-pid="${esc(p.id)}" data-k="${r.k}"${r.on ? ' checked' : ''} aria-label="Нужны"></td>` : ''}
        <td><b>${esc(r.title)}</b></td>
        <td>${edit ? `<input data-sv="who" data-pid="${esc(p.id)}" data-k="${r.k}" value="${esc(r.who || '')}" list="sv-who" placeholder="ООО «Геоплан» или сотрудник" maxlength="120"${r.on ? '' : ' disabled'}>` : esc(r.who || '—')}</td>
        <td>${edit ? `<input type="date" data-sv="finish" data-pid="${esc(p.id)}" data-k="${r.k}" value="${esc(r.finish || '')}"${r.on ? '' : ' disabled'}>` : (isDate(r.finish) ? fmtDate(r.finish) : '—')}${overdue ? ' <span class="chip tone-bad">просрочен</span>' : ''}</td>
        <td>${edit ? `<select data-sv="status" data-pid="${esc(p.id)}" data-k="${r.k}"${r.on ? '' : ' disabled'}>${SURVEY_STATUS.map(([k, l]) => `<option value="${k}"${(r.status || 'plan') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` : esc(SURVEY_STATUS.find(x => x[0] === (r.status || 'plan'))[1])}</td>
        <td>${n ? `<button class="linkbtn" type="button" data-act="sv-files" data-id="${esc(p.id)}" data-folder="${r.k}">файлы (${n})</button>` : ''}${edit && r.on && canFiles() ? ` <button class="btn ghostbtn sm" type="button" data-act="sv-upload" data-id="${esc(p.id)}" data-folder="${r.k}">Загрузить</button>` : ''}</td></tr>`; }).join('')}</tbody></table>
    <datalist id="sv-who">${[...state.contractors.values()].filter(c => !c.deletedAt).map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
    <p class="hint">Изыскания делает «Тандем» — поэтому они отдельным блоком. Если их даёт заказчик, переключите в карточке проекта: тогда отчёты — в «Сборе ИРД».</p>`;
  return auxBlock('sv:' + p.id, 'Инженерные изыскания', `<span class="meta">${rows.filter(r => r.on && ['report', 'passed'].includes(r.status)).length} из ${rows.filter(r => r.on).length} готово${late ? ` · <span class="neg">просрочено ${late}</span>` : ''}</span>`, body);
}
function surveyPatch(pid, k, patch) {
  const p = state.projects.get(pid);
  if (!p) return;
  const cur = { ...(p.surveyRows || {}) };
  cur[k] = { ...(cur[k] || {}), ...patch };
  write(op.update('projects', pid, { surveyRows: cur }), 'Изыскания обновлены');
}
async function irdAdd(pid, fileObjs, folder) {
  const p = state.projects.get(pid);
  if (!p) return;
  const added = [];
  for (const f of fileObjs) {
    const r = f instanceof File ? await api.attachBytes(pid, f.name, new Uint8Array(await f.arrayBuffer())) : f;
    if (r?.ok) added.push({ ...r.file, folder }); else if (r && !r.canceled) toast(r?.message || 'Не удалось загрузить файл.', true);
  }
  if (!added.length) return;
  const cur = state.projects.get(pid);
  await write(op.update('projects', pid, { irdFiles: [...(cur.irdFiles || []), ...added] }), added.length === 1 ? `Загружен «${added[0].name}»` : `Загружено файлов: ${added.length}`);
}
function irdPatch(pid, fid, patch) {
  const p = state.projects.get(pid);
  if (!p) return;
  const list = (p.irdFiles || []).map(f => {
    if (f.id !== fid) return f;
    const next = { ...f, ...patch };
    // Fixed-term kinds (ГПЗУ, топосъёмка) fill «до» from the date of issue unless it was typed by hand.
    if ('issued' in patch) { const auto = L.docUntil(irdKind(f.folder), next.issued); if (auto && (!f.until || f.until === f.autoUntil)) next.until = auto; next.autoUntil = auto; }
    return next;
  });
  return write(op.update('projects', pid, { irdFiles: list }), 'Сохранено');
}
document.addEventListener('drop', e => {
  const box = e.target.closest?.('.ird'), files = [...(e.dataTransfer?.files || [])];
  if (!box || !files.length || !canFiles()) return;
  e.preventDefault(); e.stopPropagation();
  irdAdd(box.dataset.irdProject, files, box.querySelector('[data-ird-folder]')?.dataset.irdFolder || 'other');
}, true);
document.addEventListener('dragover', e => { if (e.target.closest?.('.ird') && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }, true);

/* ---------- 4.1.1 (item 61): letters of a project — incoming and outgoing with through numbering, templates ---------- */
const LETTER_TPL = {
  free: { label: 'Без шаблона', subject: '', body: '' },
  cover: { label: 'Сопроводительное к выдаче документации', subject: 'О направлении документации по объекту «{project}»', body: 'Направляем Вам документацию по объекту «{project}» (шифр {code}) в составе:\n1. \n\nПросим подтвердить получение.' },
  tu: { label: 'Запрос технических условий', subject: 'Запрос технических условий — «{project}»', body: 'Просим выдать технические условия на подключение объекта «{project}» ({address}) к сетям инженерно-технического обеспечения.\nНагрузки: \n\nПриложение: ' },
  ird: { label: 'Запрос исходных данных', subject: 'Запрос исходных данных — «{project}»', body: 'Для выполнения проектных работ по объекту «{project}» просим предоставить:\n1. \n\nСрок предоставления: ' },
  // 4.13: a document runs out — ask its issuer to extend it (from «Сроки документов»).
  renew: { label: 'Продление / актуализация документа', subject: 'О продлении срока действия: {doc}', body: 'ООО ПМ «Тандем» выполняет проектирование объекта «{project}» (шифр {code}). Срок действия документа «{doc}»{docno} истекает {until}.\n\nПросим продлить срок его действия либо выдать актуализированный документ. Без действующего документа проектная документация не может быть передана в экспертизу.' },
  remarks: { label: 'Ответ на замечания', subject: 'Ответ на замечания по объекту «{project}»', body: 'На Ваше письмо № ___ от ___ сообщаем:\n1. Замечание: \n   Ответ: \n\nИсправленная документация прилагается.' },
};
const LETTER_STATUS = { in: { new: ['work', 'зарегистрировано'], answer: ['warn', 'нужен ответ'], done: ['ok', 'отработано'] }, out: { draft: ['idle', 'черновик'], sent: ['ok', 'отправлено'] } };
// Through numbering per year over all projects: «Исх. 320», «Вх. 246».
function nextLetterNo(dir, year = state.today.slice(0, 4)) {
  let max = 0;
  for (const p of state.projects.values()) for (const l of p.letters || []) if (l.dir === dir && String(l.date || '').slice(0, 4) === year) max = Math.max(max, Number(l.seq) || 0);
  return max + 1;
}
const letterNo = l => `${l.dir === 'in' ? 'Вх.' : 'Исх.'} ${l.seq}`;
let letterView = {};
function lettersBlock(p) {
  const all = [...(p.letters || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.seq || 0) - (a.seq || 0));
  const edit = A.canManageCatalog(state.me) && !p.archived;
  if (!all.length && !edit) return '';
  const v = letterView[p.id] || 'all', list = v === 'all' ? all : all.filter(l => l.dir === v);
  const waiting = all.filter(l => l.dir === 'in' && l.status === 'answer').length;
  const seg = ['all', 'in', 'out'].map(k => `<button class="btn sm ${v === k ? 'on' : ''}" type="button" data-act="let-view" data-id="${esc(p.id)}" data-v="${k}">${{ all: 'Все', in: 'Входящие', out: 'Исходящие' }[k]}</button>`).join('');
  const body = `<div class="let"><div class="let-bar"><span class="seg">${seg}</span><span class="spacer"></span>${edit ? `<button class="btn primary sm" type="button" data-act="let-new" data-id="${esc(p.id)}" data-v="out">✉ Новое исходящее</button><button class="btn sm" type="button" data-act="let-new" data-id="${esc(p.id)}" data-v="in">＋ Входящее</button>` : ''}</div>
    ${list.length ? `<table class="let-t"><thead><tr><th>№</th><th>Дата</th><th>Корреспондент</th><th>Тема</th><th>Состояние</th><th></th></tr></thead><tbody>${list.map(l => { const [tone, st] = (LETTER_STATUS[l.dir] || {})[l.status] || ['idle', '']; const late = l.dir === 'in' && l.status === 'answer' && isDate(l.due) && l.due < state.today;
      return `<tr><td class="num"><b>${esc(letterNo(l))}</b></td><td class="num">${fmtDate(l.date)}</td><td>${esc(l.corr || '')}</td><td>${esc(l.subject || '')}${(l.files || []).length ? ` <span class="hint">📎${l.files.length}</span>` : ''}</td>
        <td><span class="chip tone-${late ? 'bad' : tone}">${late ? 'ответ просрочен' : esc(st)}</span>${l.dir === 'in' && l.status === 'answer' && isDate(l.due) && !late ? ` <span class="hint">до ${fmtDate(l.due)}</span>` : ''}</td>
        <td class="let-acts">${l.dir === 'out' ? `<button class="btn ghostbtn sm" type="button" data-act="let-mail" data-id="${esc(p.id)}" data-lid="${esc(l.id)}" title="Открыть в почтовой программе">✉</button>` : ''}${edit ? `<button class="btn ghostbtn sm" type="button" data-act="let-edit" data-id="${esc(p.id)}" data-lid="${esc(l.id)}" title="Открыть">✎</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`
      : `<p class="hint let-empty">${v === 'in' ? 'Входящих пока нет.' : v === 'out' ? 'Исходящих пока нет.' : 'Писем по проекту пока нет. Номера присваиваются сами, сквозные за год.'}</p>`}</div>`;
  return auxBlock('pl:' + p.id, 'Письма', `<span class="meta">${all.length}${waiting ? ` · <span class="neg">ждут ответа ${waiting}</span>` : ''}</span>`, body);
}
function fillTpl(text, p, x = {}) {
  return String(text || '').replace(/\{project\}/g, p.name || '').replace(/\{code\}/g, p.code || '—').replace(/\{address\}/g, p.address || p.client || '')
    .replace(/\{doc\}/g, x.doc || '').replace(/\{docno\}/g, x.docno || '').replace(/\{until\}/g, x.until || '');
}
// `preset` (4.13): { tpl, corr, docId, vars } — a new letter filled from a template (e.g. «Запросить актуализацию»).
function askLetter(p, letter = null, dir = 'out', preset = null) {
  const isNew = !letter;
  const l = letter ? clone(letter) : { id: newId(), dir, seq: nextLetterNo(dir), date: state.today, corr: dir === 'out' ? (p.client || '') : '', email: '', subject: '', body: '', status: dir === 'in' ? 'answer' : 'draft', due: dir === 'in' ? addDays(state.today, 10) : '', files: [], tpl: 'free' };
  const sig = `\n\n${A.isGip(state.me) ? 'Главный инженер проекта' : A.ROLES[state.me?.role]?.label || ''}\n${(state.me?.name || '').replace(/^Пример:\s*/, '')}`;
  if (isNew && preset?.tpl && LETTER_TPL[preset.tpl]) {
    const t = LETTER_TPL[preset.tpl];
    Object.assign(l, { tpl: preset.tpl, subject: fillTpl(t.subject, p, preset.vars), body: fillTpl(t.body, p, preset.vars) + sig, ...(preset.corr !== undefined ? { corr: preset.corr } : {}), ...(preset.docId ? { docId: preset.docId } : {}) });
  }
  const st = LETTER_STATUS[l.dir];
  const { root, close } = openModal(`<form class="modal let-modal" role="dialog" aria-modal="true" aria-labelledby="let-t" novalidate>
    <h2 id="let-t">${l.dir === 'in' ? 'Входящее' : 'Исходящее'} письмо <span class="num">№ ${l.seq}</span> <span class="hint">${isNew ? '(номер присвоен сам)' : ''}</span></h2>
    <div class="fgrid"><div class="f"><label for="let-date">Дата</label><input type="date" id="let-date" value="${esc(l.date)}"></div>
      <div class="f"><label for="let-corr">${l.dir === 'in' ? 'От кого' : 'Кому'}</label><input id="let-corr" maxlength="160" value="${esc(l.corr || '')}" placeholder="${l.dir === 'in' ? 'Минстрой края' : 'Заказчик, организация'}"></div>
      ${l.dir === 'out' ? `<div class="f"><label for="let-email">Почта получателя</label><input id="let-email" type="email" maxlength="200" value="${esc(l.email || '')}" placeholder="name@example.ru"></div>
      <div class="f"><label for="let-tpl">Шаблон</label><select id="let-tpl">${Object.entries(LETTER_TPL).map(([k, x]) => `<option value="${k}"${k === l.tpl ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>` : `<div class="f"><label for="let-no2">Их номер</label><input id="let-no2" maxlength="60" value="${esc(l.theirNo || '')}" placeholder="№ 12-04/345"></div>
      <div class="f"><label for="let-due">Ответить до</label><input type="date" id="let-due" value="${esc(l.due || '')}"></div>`}
      <div class="f wide"><label class="req" for="let-subj">Тема</label><input id="let-subj" maxlength="300" value="${esc(l.subject || '')}"></div>
      <div class="f wide"><label for="let-body">${l.dir === 'in' ? 'Кратко о чём' : 'Текст'}</label><textarea id="let-body" rows="${l.dir === 'in' ? 3 : 8}" maxlength="6000">${esc(l.body || '')}</textarea></div>
      <div class="f"><label for="let-st">Состояние</label><select id="let-st">${Object.entries(st).map(([k, [, t]]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      ${canFiles() ? `<div class="f wide let-files"><span class="lbl">Вложения</span><div id="let-flist"></div><div class="tf-drop" id="let-drop">Перетащите файлы сюда</div></div>` : ''}</div>
    <div class="err" id="let-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">${isNew ? 'Зарегистрировать' : 'Сохранить'}</button>${l.dir === 'out' ? '<button class="btn" type="button" data-m="mail">Сохранить и открыть в почте</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button><span class="spacer"></span>${isNew ? '' : '<button class="btn danger" type="button" data-m="del">Удалить</button>'}</div></form>`);
  const q = sel => root.querySelector(sel);
  const drawFiles = () => { const el = q('#let-flist'); if (el) el.innerHTML = (l.files || []).map((f, i) => `<span class="aq-file">${icon('file')}${esc(f.name)} <span class="hint">${fileSize(f.size)}</span><button class="btn ghostbtn sm" type="button" data-m="unf" data-i="${i}">×</button></span>`).join(''); };
  drawFiles();
  q('#let-subj').focus();
  q('#let-tpl')?.addEventListener('change', e => { const t = LETTER_TPL[e.target.value]; l.tpl = e.target.value; if (!t) return; if (t.subject) q('#let-subj').value = fillTpl(t.subject, p, preset?.vars); if (t.body) q('#let-body').value = fillTpl(t.body, p, preset?.vars) + sig; });
  root.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.stopPropagation(); } }, true);
  root.addEventListener('drop', async e => {
    const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
    e.preventDefault(); e.stopPropagation();
    for (const f of files) { const r = await api.attachBytes(p.id, f.name, new Uint8Array(await f.arrayBuffer())); if (r?.ok) l.files.push(r.file); else toast(r?.message || 'Не удалось приложить файл.', true); }
    drawFiles();
  }, true);
  const collect = () => Object.assign(l, { date: q('#let-date').value || state.today, corr: q('#let-corr').value.trim(), email: q('#let-email')?.value.trim() || l.email || '', subject: q('#let-subj').value.trim(), body: q('#let-body').value, status: q('#let-st').value, due: q('#let-due')?.value || l.due || '', theirNo: q('#let-no2')?.value.trim() || l.theirNo || '' });
  const save = async () => {
    collect();
    if (!l.subject) { q('#let-err').textContent = 'Укажите тему письма.'; q('#let-err').hidden = false; q('#let-subj').classList.add('field-bad'); q('#let-subj').focus(); return false; }
    // The number belongs to the year of the date; a letter moved to another year gets that year's next number.
    if (isNew || String(letter.date).slice(0, 4) !== l.date.slice(0, 4)) l.seq = nextLetterNo(l.dir, l.date.slice(0, 4));
    const cur = state.projects.get(p.id), list = [...(cur.letters || []).filter(x => x.id !== l.id), l];
    return write(op.update('projects', p.id, { letters: list }), `${letterNo(l)} от ${fmtDate(l.date)} — ${isNew ? 'зарегистрировано' : 'сохранено'}`);
  };
  root.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (m === 'unf') { l.files.splice(Number(e.target.closest('[data-m]').dataset.i), 1); drawFiles(); }
    if (m === 'del') { const cur = state.projects.get(p.id); if (await write(op.update('projects', p.id, { letters: (cur.letters || []).filter(x => x.id !== l.id) }), `${letterNo(l)} удалено`)) close(); }
    if (m === 'mail') { if (await save()) { close(); mailLetter(l); } }
  });
  q('form').addEventListener('submit', async e => { e.preventDefault(); e.stopPropagation(); if (await save()) close(); });
}
async function mailLetter(l) {
  if (typeof api.mailOpen !== 'function') return toast('Открыть в почте можно в версии для Windows.', true);
  const r = await api.mailOpen({ to: l.email, subject: `${letterNo(l)} от ${fmtDate(l.date)} — ${l.subject}`, text: l.body });
  if (!r?.ok) toast(r?.message || 'Не удалось открыть почтовую программу.', true);
  else if ((l.files || []).length) toast('Вложения добавьте в письме вручную: почтовая ссылка не умеет прикладывать файлы.');
}

/* ---------- 4.14: РВИ — the project's changes in one list; numbers are given by the program ---------- */
const rviRows = p => [...state.tasks.values()].filter(t => t.projectId === p.id && !t.deletedAt)
  .flatMap(t => (t.revisions || []).map(r => ({ t, r }))).sort((a, b) => (Number(b.r.rvi) || 0) - (Number(a.r.rvi) || 0) || String(b.r.date).localeCompare(String(a.r.date)));
let rviFilter = {};
function rviBlock(p) {
  const all = rviRows(p), edit = A.canEditTaskFields(state.me) && !p.archived;
  if (!all.length && !edit) return '';
  const marks = [...new Set(all.flatMap(x => sectionsOf(x.t)))].sort();
  const f = rviFilter[p.id] || '', list = f ? all.filter(x => sectionsOf(x.t).includes(f)) : all;
  const by = r => state.users.get(r.by)?.name || '';
  const body = `<div class="let"><div class="let-bar">${marks.length > 1 ? `<select class="rvi-f" data-rvi-filter="${esc(p.id)}" aria-label="Раздел"><option value="">Все разделы</option>${marks.map(m => `<option value="${esc(m)}"${m === f ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>` : ''}<span class="spacer"></span>
      ${all.length ? `<button class="btn ghostbtn sm" type="button" data-act="rvi-copy" data-id="${esc(p.id)}" title="Скопировать таблицу — вставьте в Excel">Скопировать для Excel</button>` : ''}${edit ? `<button class="btn primary sm" type="button" data-act="rvi-new" data-id="${esc(p.id)}">＋ Новое изменение</button>` : ''}</div>
    ${list.length ? `<table class="let-t rvi-t"><thead><tr><th>№ РВИ</th><th>Раздел</th><th>Изм.</th><th>Листы</th><th>Что изменено и почему</th><th>Кто</th><th>Дата</th></tr></thead><tbody>${list.map(({ t, r }) => `<tr>
      <td class="num"><b>${r.rvi ? rviNo(r.rvi) : '<span class="hint">без №</span>'}</b></td><td>${marksHtml(t)}</td><td class="num">${esc(r.no)}</td><td class="num">${esc(r.sheets || '—')}</td>
      <td>${esc(r.note || '')}</td><td>${esc(by(r))}</td><td class="num">${fmtDate(r.date)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="hint let-empty">Изменений пока нет. «Новое изменение» выдаст номер РВИ и запишет изменение в карточку раздела (поле «Изм.»).</p>'}</div>`;
  return auxBlock('rv:' + p.id, 'Изменения (РВИ)', `<span class="meta">${all.length}</span>`, body);
}
function rviTsv(p) {
  const rows = rviRows(p).map(({ t, r }) => [r.rvi ? rviNo(r.rvi) : '', marksText(t), r.no, r.sheets || '', r.note || '', state.users.get(r.by)?.name || '', fmtDate(r.date)]);
  return [['№ РВИ', 'Раздел', 'Изм.', 'Листы', 'Что изменено и почему', 'Кто', 'Дата'], ...rows].map(r => r.map(c => String(c).replace(/[\t\n]+/g, ' ')).join('\t')).join('\n');
}
// «Новое изменение»: pick the section's card, the sheets and the reason — the number of the change in the card and the
// through РВИ number are given here.
function askRvi(p) {
  const cards = [...state.tasks.values()].filter(t => t.projectId === p.id && !t.deletedAt && sectionsOf(t).length).sort((a, b) => marksText(a).localeCompare(marksText(b), 'ru'));
  if (!cards.length) return toast('В проекте нет карточек разделов — изменение не к чему привязать.', true);
  const n = nextRvi(p.id);
  const { root, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="rvi-t" novalidate><h2 id="rvi-t">Новое изменение <span class="rvi-big">${rviNo(n)}</span></h2>
    <div class="fgrid"><div class="f wide"><label for="rvi-card">Раздел</label><select id="rvi-card">${cards.map(t => `<option value="${esc(t.id)}">${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</option>`).join('')}</select></div>
      <div class="f"><label for="rvi-sheets">Листы</label><input id="rvi-sheets" maxlength="60" placeholder="3, 5, 12"></div>
      <div class="f"><label for="rvi-date">Дата</label><input id="rvi-date" type="date" value="${esc(state.today)}"></div>
      <div class="f wide"><label class="req" for="rvi-note">Что изменено и почему</label><input id="rvi-note" maxlength="200" placeholder="Замечание экспертизы № 14: армирование плиты"></div></div>
    <p class="hint" id="rvi-hint"></p><div class="err" id="rvi-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Выдать номер</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
  const q = s => root.querySelector(s);
  const hint = () => { const t = state.tasks.get(q('#rvi-card').value), next = (t.revisions || []).reduce((m, r) => Math.max(m, parseInt(r.no, 10) || 0), 0) + 1; q('#rvi-hint').textContent = `В карточке «${marksText(t)}» будет «Изм. ${next}».`; return next; };
  hint();
  q('#rvi-card').addEventListener('change', hint);
  q('#rvi-note').focus();
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const note = q('#rvi-note').value.trim(), date = isDate(q('#rvi-date').value) ? q('#rvi-date').value : state.today;
    if (!note) { q('#rvi-err').textContent = 'Напишите, что изменено и почему.'; q('#rvi-err').hidden = false; q('#rvi-note').classList.add('field-bad'); return q('#rvi-note').focus(); }
    const t = state.tasks.get(q('#rvi-card').value), no = hint(), rvi = nextRvi(p.id);
    const rev = { id: newId(), no: String(no), rvi, date, note, by: state.me?.id || '', ...(q('#rvi-sheets').value.trim() ? { sheets: q('#rvi-sheets').value.trim() } : {}) };
    if (await write(op.update('tasks', t.id, { revisions: [...(t.revisions || []), rev] }), `${rviNo(rvi)}: ${marksText(t)}, изм. ${no}`)) close();
  });
}

const initials = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'rvi-new': ({ id }) => { const p = state.projects.get(id); if (p) askRvi(p); },
  'rvi-copy': ({ id }) => { const p = state.projects.get(id); if (p) navigator.clipboard.writeText(rviTsv(p)).then(() => toast('Таблица изменений скопирована — вставьте в Excel (Ctrl+V).'), () => toast('Не удалось скопировать.', true)); },
  'ird-folder': ({ el }) => { irdOpen[el.dataset.id] = el.dataset.v; renderNow(); },
  'ird-upload': ({ el }) => { const pid = el.dataset.id, folder = el.closest('.ird')?.querySelector('[data-ird-folder]')?.dataset.irdFolder || 'other'; api.attachAdd(pid).then(r => irdAdd(pid, [r], folder)); },
  'sv-upload': ({ el }) => { const pid = el.dataset.id, folder = el.dataset.folder; api.attachAdd(pid).then(r => irdAdd(pid, [r], folder)); },
  'sv-files': ({ el }) => {
    const p = state.projects.get(el.dataset.id), list = (p?.irdFiles || []).filter(f => f.folder === el.dataset.folder);
    // The newest report opens; with several, the plate names the others.
    const last = list.at(-1);
    if (last) api.attachOpen(p.id, last.id).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); else if (list.length > 1) toast(`Открыт последний: ${last.name}. Ещё: ${list.slice(0, -1).map(f => f.name).join(', ')}`); });
  },
  'ird-open': ({ el }) => { api.attachOpen(el.dataset.id, el.dataset.fid).then(r => { if (!r?.ok) toast(r?.message || 'Не удалось открыть файл.', true); }); },
  'ird-del': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) write(op.update('projects', p.id, { irdFiles: (p.irdFiles || []).filter(f => f.id !== el.dataset.fid) }), 'Файл убран'); },
  'ird-newfolder': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) askText('Новая папка', 'Название папки', 'Например: Согласования с сетевыми').then(name => { if (!name?.trim()) return; const id = newId(); irdOpen[p.id] = id; write(op.update('projects', p.id, { irdFolders: [...(p.irdFolders || []), { id, name: name.trim().slice(0, 80) }] }), 'Папка добавлена'); }); },
  'let-view': ({ el }) => { letterView[el.dataset.id] = el.dataset.v; renderNow(); },
  'let-new': ({ el }) => { const p = state.projects.get(el.dataset.id); if (p) askLetter(p, null, el.dataset.v); },
  'let-edit': ({ el }) => { const p = state.projects.get(el.dataset.id), l = p?.letters?.find(x => x.id === el.dataset.lid); if (l) askLetter(p, l); },
  'let-mail': ({ el }) => { const p = state.projects.get(el.dataset.id), l = p?.letters?.find(x => x.id === el.dataset.lid); if (l) mailLetter(l); },
});

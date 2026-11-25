/* ---------- 4.1.1: portfolio chart (item 59) — every project on one time scale, phases inside, studio load below ---------- */
let projMode = loadLocal('projMode', 'list');
function viewPortfolio(projects) {
  const rows = projects.map(p => ({ p, ph: (p.phases || []).filter(x => isDate(x.start) && isDate(x.finish) && x.key !== 'contract' && x.key !== 'an') })).filter(r => r.ph.length);
  const noPlan = projects.filter(p => !rows.some(r => r.p === p));
  if (!rows.length) return `<section class="empty"><h2>Нет сроков этапов</h2><p class="hint">График портфеля строится из сроков этапов проектов. Задайте их в проекте: кнопка «Сроки».</p></section>`;
  const all = rows.flatMap(r => r.ph.flatMap(x => [x.start, x.finish]));
  const from = addDays(all.reduce((a, b) => (a < b ? a : b)).slice(0, 8) + '01', 0), to = all.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(30, dayNum(to) - dayNum(from) + 1), x = d => ((dayNum(d) - dayNum(from)) / span) * 100;
  const months = []; for (let d = from; d <= to; d = addDays(d, 32).slice(0, 8) + '01') months.push(d);
  const every = Math.ceil(months.length / 14);
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const ticks = months.map((m, i) => `<span class="pf-tick${i % every ? ' minor' : ''}" style="left:${x(m)}%">${i % every ? '' : MON[Number(m.slice(5, 7)) - 1] + (m.slice(5, 7) === '01' || i === 0 ? ' ' + m.slice(2, 4) : '')}</span>`).join('');
  const now = state.today >= from && state.today <= to ? `<span class="pf-now" style="left:${x(state.today)}%" title="Сегодня"></span>` : '';
  // Overlapping phases (изыскания, ИРД and П often run together) go on separate lanes of the project row.
  const laned = ph => { const ends = []; return [...ph].sort((a, b) => a.start.localeCompare(b.start)).map(f => { let l = ends.findIndex(e => e < f.start); if (l < 0) { l = ends.length; ends.push(''); } ends[l] = f.finish; return { f, l }; }); };
  const body = rows.map(({ p, ph }) => { const ls = laned(ph), n = Math.max(1, ...ls.map(y => y.l + 1)); return `<div class="pf-row"><button class="pf-name linkbtn" type="button" data-act="goto-project" data-id="${esc(p.id)}" title="${esc(p.name)}">${esc(p.name)}</button><div class="pf-track" style="height:${n * 21 + 4}px">${now}
    ${ls.map(({ f, l }) => { const st = L.phaseState(f, state.today); return `<span class="pf-bar pf-${f.key} st-${st}" style="top:${l * 21 + 3}px;left:${x(f.start)}%;width:${Math.max(0.6, x(addDays(f.finish, 1)) - x(f.start))}%" title="${esc(p.name)} · ${esc(L.phaseLabel(f.key))}: ${fmtDate(f.start)} – ${fmtDate(f.finish)}">${esc(L.phaseLabel(f.key).replace('Стадия ', ''))}</span>`; }).join('')}</div></div>`; }).join('');
  // Studio load: cards in work per week across the shown projects.
  const ids = new Set(rows.map(r => r.p.id)), cards = tasksArr().filter(t => ids.has(t.projectId) && t.status !== 'done' && isDate(t.start) && isDate(t.finish));
  const weeks = []; for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
  const load = weeks.map(w => cards.filter(t => t.start <= addDays(w, 6) && t.finish >= w).length), max = Math.max(1, ...load);
  const hi = Math.max(3, Math.round(max * 0.75));
  const bars = weeks.map((w, i) => `<span class="pf-load${load[i] >= hi ? ' hi' : ''}" style="left:${x(w)}%;width:${Math.max(0.4, (7 / span) * 100 - 0.25)}%;height:${Math.round((load[i] / max) * 100)}%" title="Неделя с ${fmtDate(w)}: карточек в работе ${load[i]}"></span>`).join('');
  return `<section class="panel pf"><div class="panel-h"><h3>График портфеля</h3><span class="meta">${rows.length} ${plural(rows.length, 'проект', 'проекта', 'проектов')} · ${fmtDate(from)} — ${fmtDate(to)}</span><span class="spacer"></span>
      <span class="pf-legend">${L.PHASES.filter(([k]) => !['contract', 'an'].includes(k)).map(([k]) => `<span class="pf-key pf-${k}"></span>${esc(L.phaseLabel(k).replace('Стадия ', 'стадия '))}`).join(' ')}</span></div>
    <div class="pf-body"><div class="pf-row pf-head"><span class="pf-name"></span><div class="pf-track">${ticks}</div></div>${body}
      <div class="pf-row pf-loadrow"><span class="pf-name hint">Загрузка<br>карточек в неделю</span><div class="pf-track">${bars}${now}</div></div></div>
    ${noPlan.length ? `<p class="hint pf-noplan">Без сроков этапов (не на графике): ${noPlan.map(p => esc(p.name)).join(', ')}.</p>` : ''}</section>`;
}
function viewProjects() {
  if (isEmpty()) return emptyState();
  if (state.openProjectId) {
    const op = state.projects.get(state.openProjectId);
    if (op && !op.deletedAt) return viewProjectPage(op);
    if (SOLO) return '<section class="empty"><h2>Проект недоступен</h2><p class="hint">Его удалили или у вас больше нет к нему доступа. Это окно можно закрыть.</p></section>';
    state.openProjectId = null;
  }
  const projects = liveProjects(), archived = archivedProjects();
  const all = [...state.tasks.values()];
  const orphans = all.filter(t => !state.projects.has(t.projectId));
  const archToggle = archived.length ? `<div class="filters"><button class="btn ghostbtn sm" data-act="toggle-archive" type="button">${state.showArchive ? 'Скрыть архив' : `Показать архив (${archived.length})`}</button></div>` : '';
  // Filter by project stage (кнопки над списком); counts show how many projects are at each stage.
  const stage = state.projectStage || '';
  const stageCount = k => projects.filter(p => (p.status || '') === k).length;
  const stageBar = `<div class="filters one-row stage-bar"><span class="hint">Стадия:</span><span class="seg"><button class="btn sm ${stage ? '' : 'on'}" type="button" data-act="pstage" data-v="">Все ${projects.length}</button>${Object.entries(L.PROJECT_STATUSES).filter(([k]) => stageCount(k)).map(([k, s]) => `<button class="btn sm ${stage === k ? 'on' : ''}" type="button" data-act="pstage" data-v="${k}">${esc(s.label)} ${stageCount(k)}</button>`).join('')}${stageCount('') && stageCount('') < projects.length ? `<button class="btn sm ${stage === '-' ? 'on' : ''}" type="button" data-act="pstage" data-v="-">Без стадии ${stageCount('')}</button>` : ''}</span></div>`;
  const shownProjects = stage ? projects.filter(p => (p.status || '') === (stage === '-' ? '' : stage)) : projects;
  const modeSeg = `<span class="seg proj-mode"><button class="btn sm ${projMode === 'list' ? 'on' : ''}" type="button" data-act="proj-mode" data-v="list">Список</button><button class="btn sm ${projMode === 'portfolio' ? 'on' : ''}" type="button" data-act="proj-mode" data-v="portfolio" title="Все проекты на одной шкале: этапы и загрузка мастерской">График портфеля</button></span>`;
  if (projMode === 'portfolio') return `<div class="proj-top">${modeSeg}${projects.some(p => p.status) ? stageBar : ''}</div>` + viewPortfolio(shownProjects);
  const live = shownProjects.length ? shownProjects.map(p => projectPanel(p, all)).join('')
    : `<section class="empty"><h2>Активных проектов нет</h2><p class="hint">Заведите проект, затем добавьте в него карточки работ.</p><div class="acts"><button class="btn primary" data-act="new-project" type="button">Добавить проект</button></div></section>`;
  return `<div class="proj-top">${modeSeg}${projects.length && projects.some(p => p.status) ? stageBar : ''}</div>` + live
    + (orphans.length ? `<section class="panel"><div class="panel-h"><h3>Без проекта</h3></div>${taskTable(orphans, { showProject: false })}</section>` : '')
    + archToggle
    + (state.showArchive ? archived.map(p => projectPanel(p, all)).join('') : '');
}

function contactLine(label, value) {
  if (!value) return '';
  return `<div class="contact"><span class="lbl">${label}</span><span class="val" title="${esc(value)}">${esc(value)}</span>
    <button class="btn ghostbtn sm" data-act="copy" data-value="${esc(value)}" type="button">Копировать</button></div>`;
}
function reliabilityHtml(c) {
  // Reliability uses archived projects too: history matters after a project is closed.
  const r = L.reliability([...state.tasks.values()].filter(t => t.contractorId === c.id), state.today);
  if (r.grade === 'none') {
    return `<div class="rel"><span class="chip tone-idle">мало данных</span><span class="hint">Оценка появится после двух сданных работ${r.rated ? ` (сейчас ${r.rated})` : ''}.</span></div>`;
  }
  const tone = { ok: 'ok', warn: 'warn', bad: 'bad' }[r.grade];
  const bits = [
    `${r.onTime} из ${r.rated} в срок`,
    r.avgLate ? `ср. просрочка ${r.avgLate} дн.` : '',
    r.avgRounds != null ? `замечаний ${String(r.avgRounds).replace('.', ',')} на работу` : '',
    r.contractorShifts ? `переносов по его вине: ${r.contractorShifts}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="rel"><span class="chip tone-${tone}" title="Доля работ, сданных к контрольному сроку исполнителя">${r.pct}% в срок</span><span class="hint">${esc(bits)}</span></div>`;
}
/* ---------- folding (people and projects) ---------- */
const folded = new Set(loadLocal('folded', []));
const isFolded = key => folded.has(key);
const foldBtn = (key, on) => `<button class="tree-tg fold" type="button" data-act="fold" data-key="${esc(key)}" aria-expanded="${!on}" title="${on ? 'Развернуть' : 'Свернуть'}">${on ? '▸' : '▾'}</button>`;
function setFold(keys, on) {
  for (const k of keys) { if (on) folded.add(k); else folded.delete(k); }
  saveLocal('folded', [...folded]);
  renderNow();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'pstage': ({ el }) => { state.projectStage = el.dataset.v; renderNow(); },
  'fold': ({ el }) => { setFold([el.dataset.key], !isFolded(el.dataset.key)); },
  'fold-all': ({ el }) => { setFold(el.dataset.keys.split(' ').filter(Boolean), el.dataset.on === '1'); },
  'proj-mode': ({ el }) => { projMode = el.dataset.v === 'portfolio' ? 'portfolio' : 'list'; saveLocal('projMode', projMode); renderNow(); },
  'goto-project': ({ id }) => {
    if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
    state.tab = 'projects'; renderNow();
    document.getElementById('p-' + id)?.scrollIntoView({ block: 'start' });
  },
  'toggle-archive': () => { state.showArchive = !state.showArchive; renderNow(); },
});

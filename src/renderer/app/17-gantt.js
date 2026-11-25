/* ---------- Gantt chart: drag to pan, Ctrl+wheel or buttons to zoom ---------- */
const GANTT_MIN_DAYS = 7, GANTT_MAX_DAYS = 730;
const GANTT_PRESETS = [[14, '2 нед'], [31, 'Месяц'], [63, '2 мес'], [92, 'Квартал'], [183, 'Полгода'], [365, 'Год']];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const isoOf = n => new Date(n * 864e5).toISOString().slice(0, 10); // n = dayNum (UTC days)

// Tick marks adapt to the zoom: days → weeks → months → quarters.
function ganttTicks(from, span) {
  const start = dayNum(from), end = start + span, out = [];
  if (span <= 31) {
    for (let n = start; n <= end; n++) {
      const iso = isoOf(n), [, m, d] = iso.split('-');
      out.push({ iso, label: d === '01' || n === start ? `${+d} ${MONTHS[+m - 1]}` : String(+d), major: d === '01' });
    }
  } else if (span <= 120) {
    for (let n = start; n <= end; n++) {
      const iso = isoOf(n);
      if (new Date(n * 864e5).getUTCDay() === 1) out.push({ iso, label: fmtDate(iso).slice(0, 5), major: false });
    }
  } else {
    const step = span <= 400 ? 1 : 3;
    let [y, m] = from.split('-').map(Number);
    for (;;) {
      const iso = `${y}-${String(m).padStart(2, '0')}-01`;
      if (dayNum(iso) > end) break;
      if (dayNum(iso) >= start) out.push({ iso, label: m === 1 ? `${MONTHS[0]} ${y}` : MONTHS[m - 1], major: m === 1 });
      m += step; if (m > 12) { m -= 12; y++; }
    }
  }
  return out;
}

const ganttModeSeg = () => `<span class="seg g-mode"><button class="btn sm ${state.gantt.mode === 'vac' ? '' : 'on'}" type="button" data-act="g-mode" data-v="work">Работы</button><button class="btn sm ${state.gantt.mode === 'vac' ? 'on' : ''}" type="button" data-act="g-mode" data-v="vac">График отпусков</button></span>`;
// 4.1: a card without an executor — a red person with a question mark (Gantt bars and the legend).
const NOEXEC_ICON = '<svg class="noexec-ic" viewBox="0 0 16 16" aria-label="нет исполнителя" role="img"><circle cx="6" cy="4.6" r="2.6" fill="currentColor"/><path d="M1.2 14.5c.3-3.3 2.2-5.2 4.8-5.2s4.5 1.9 4.8 5.2z" fill="currentColor"/><text x="12.6" y="8.6" font-size="8.5" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Arial,sans-serif">?</text></svg>';
// «Межраздельные задания» — shown or hidden in one view; remembered per view.
const assignChk = view => `<label class="chk sm-chk" title="Задания смежным разделам (кто кому что выдаёт)"><input type="checkbox" data-act="show-assign" data-v="${view}"${state.showAssign[view] ? ' checked' : ''}> Межраздельные задания</label>`;
/* ---------- 4.1.1: critical path (58) and the effect of a move (57) ---------- */
let cpCache = null;
function cpOf(pid) {
  if (!cpCache || cpCache.tasks !== state.tasks) cpCache = { tasks: state.tasks, m: new Map() };
  if (!cpCache.m.has(pid)) cpCache.m.set(pid, L.criticalPath(tasksArr().filter(t => t.projectId === pid)));
  return cpCache.m.get(pid);
}
// The contract date the project must meet: the end of «Стадия Р», else of «Стадия П».
const projDeadline = p => { const ph = k => (p?.phases || []).find(x => x.key === k); return (isDate(ph('r')?.finish) && ph('r').finish) || (isDate(ph('p')?.finish) && ph('p').finish) || ''; };
function cpSummary(p, end = cpOf(p.id).end) {
  if (!end) return '';
  const dl = projDeadline(p), diff = dl ? dayNum(dl) - dayNum(end) : null;
  return `<span class="cp-sum ${diff !== null && diff < 0 ? 'bad' : ''}" title="Расчётная сдача — окончание последней работы с учётом зависимостей">сдача ${fmtDate(end)}${dl ? ` · договор ${fmtDate(dl)} · ${diff >= 0 ? `запас ${diff} дн.` : `опоздание ${-diff} дн.`}` : ''}</span>`;
}
function viewGantt() {
  if (isEmpty()) return emptyState();
  if (state.gantt.mode === 'vac') return viewVacations();
  const g = state.gantt;
  const from = g.from, span = g.days, to = addDays(from, span);
  const pos = d => ((dayNum(d) - dayNum(from)) / span) * 100;
  const clamp = v => Math.min(100, Math.max(0, v));
  const inRange = d => d >= from && d <= to;
  const dayW = 100 / span;
  const gq = state.ganttFilter || (state.ganttFilter = { project: '', mark: '' });
  const active = tasksArr().filter(t => t.status !== 'done' && (state.showAssign.gantt || t.kind !== 'assign') && (!gq.project || t.projectId === gq.project) && (!gq.mark || sectionsOf(t).includes(gq.mark)));
  const byProject = g.group === 'project', byOwner = g.group === 'owner' && !isSpec();
  const crit = !!g.crit;
  const groups = byProject
    ? liveProjects().map(p => ({ key: 'p' + p.id, name: p.name, sub: p.code, tasks: active.filter(t => t.projectId === p.id) }))
    : byOwner ? liveUsers().sort(byName).map(u => ({ key: 'u' + u.id, name: u.name, user: u, sub: A.ROLES[u.role]?.label, tasks: active.filter(t => hasOwner(t, u.id)) }))
    : [...execStaff().map(u => ({ key: 'x' + u.id, name: u.name, sub: 'штатный', tasks: active.filter(t => executorOf(t)?.u?.id === u.id) })), ...contractorsArr().map(c => ({ key: 'c' + c.id, name: c.name, tasks: active.filter(t => t.contractorId === c.id) }))];
  // With a filter on, rows without matching cards only add noise.
  if (gq.project || gq.mark) for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].tasks.length) groups.splice(i, 1);
  if (byOwner) {
    const none = active.filter(t => !ownerOf(t));
    if (none.length) groups.push({ key: 'u-none', name: 'Без ответственного', tasks: none, unassigned: true });
  } else if (byProject) {
    const orphans = active.filter(t => !state.projects.has(t.projectId));
    if (orphans.length) groups.push({ key: 'p-none', name: 'Без проекта', tasks: orphans });
  } else {
    const none = active.filter(t => !executorOf(t));
    if (none.length) groups.push({ key: 'c-none', name: 'Не назначен', tasks: none, unassigned: true });
  }

  const ticks = ganttTicks(from, span);
  // Non-working days from the production calendar (weekends, holidays, transfers); working Saturdays stay clear.
  const offDays = span <= 120 ? Array.from({ length: span + 1 }, (_, i) => addDays(from, i)).map(d => ({ d, info: L.Cal.dayInfo(d) })).filter(x => x.info.off) : [];
  const shade = offDays.map(({ d, info }) => `<span class="tl-we ${info.holiday || info.transfer ? 'hol' : ''}" style="left:${pos(d)}%;width:${dayW}%"${info.holiday || info.transfer ? ` title="${esc(info.holiday || L.Cal.transferLabel)} · ${fmtDate(d)}"` : ''}></span>`).join('');
  const today = inRange(state.today) ? `<span class="tl-now" style="left:${pos(state.today) + dayW / 2}%"></span>` : '';
  const grid = ticks.map(t => `<span class="tq-grid ${t.major ? 'major' : ''}" style="left:${pos(t.iso)}%"></span>`).join('');
  const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
  const unofficial = years.filter(y => !L.Cal.isOfficialYear(y));

  const head = `<div class="tl-row tl-head"><div class="tl-name">${byProject ? 'Проект' : byOwner ? 'Ответственный' : 'Исполнитель'}<span class="tl-resize" data-gantt-resize title="Потяните, чтобы изменить ширину"></span></div>
    <div class="tl-track" data-gantt-track>${ticks.map(t => `<span class="tl-tick ${t.major ? 'major' : ''}" style="left:${pos(t.iso)}%">${esc(t.label)}</span>`).join('')}
    ${inRange(state.today) ? `<span class="tl-today" style="left:${pos(state.today) + dayW / 2}%"><b>сегодня</b></span>` : ''}</div></div>`;

  const rows = groups.map(grp => {
    const gkey = 'g:' + grp.key;
    if (isFolded(gkey)) {
      const late = grp.tasks.filter(t => timing(t).overdue).length;
      return `<div class="tl-row tl-folded ${grp.unassigned ? 'tl-unassigned' : ''}"><div class="tl-name">${foldBtn(gkey, true)}<b title="${esc(grp.name)}">${esc(grp.name)}</b><span class="hint">в работе ${grp.tasks.length}${late ? ` · <span class="neg">сорвано ${late}</span>` : ''}</span></div><div class="tl-track" data-gantt-track style="height:22px">${shade}${grid}${today}</div></div>`;
    }
    let before = 0, after = 0;
    const items = [];
    for (const t of grp.tasks) {
      const tm = timing(t);
      const s = isDate(t.start) ? t.start : state.today;
      const e = tm.overdue ? state.today : isDate(t.finish) ? t.finish : addDays(s, 30);
      if (s > to) { after++; continue; }
      if (e < from) { before++; continue; }
      items.push({ t, s, e, tm });
    }
    items.sort((a, b) => a.s.localeCompare(b.s));
    const lanes = [];
    for (const it of items) {
      let lane = lanes.findIndex(end => end < it.s);
      if (lane < 0) { lane = lanes.length; lanes.push(''); }
      lanes[lane] = it.e;
      it.lane = lane;
    }
    const bars = items.map(({ t, s, e, tm, lane }) => {
      const tone = tm.overdue ? 'bad' : (STATUSES[t.status] || STATUSES.not_started).tone;
      const planEnd = tm.overdue && isDate(t.finish) ? t.finish : e;
      const left = clamp(pos(s)), right = clamp(pos(planEnd) + dayW); // the finish day itself is included
      const who = byProject ? executorOf(t)?.name || 'нет исполнителя' : projectOf(t)?.name || '';
      const label = `${marksText(t)} · ${who}`;
      const ext = tm.overdue && isDate(t.finish)
        ? (() => { const l = clamp(pos(t.finish) + dayW), r = clamp(pos(state.today) + dayW); return r > l ? `<span class="tl-late" style="left:${l}%;width:${r - l}%;top:${lane * 26 + 6}px" title="Просрочка ${tm.late} дн."></span>` : ''; })() : '';
      const ms = L.milestonesOf(t, state.today).list.filter(m => isDate(m.date) && inRange(m.date))
        .map(m => `<span class="tq-ms ${m.done ? 'done' : m.date < state.today ? 'bad' : ''}" style="left:${pos(m.date) + dayW / 2}%;top:${lane * 26 + 8}px" title="КТ «${esc(m.title)}» ${fmtDate(m.date)}${m.done ? ' — выполнена' : ''}"></span>`).join('');
      const blocked = L.dependencyIssues(t, state.tasks, state.today).length > 0;
      const noexec = !executorOf(t), wait = irdWaitOf(t);
      const awayHit = absHits(t).some(h => h.onFinish);
      const cp = crit ? cpOf(t.projectId) : null, isCrit = cp?.critical.has(t.id), fl = cp?.float.get(t.id);
      const bar = right > left ? `<button class="tl-bar tone-${tone} ${isCrit ? 'crit' : ''} ${pos(s) < 0 ? 'cut-l' : ''} ${pos(planEnd) + dayW > 100 ? 'cut-r' : ''} ${blocked ? 'blocked' : ''} ${noexec ? 'noexec' : ''} ${wait.length ? 'waitid' : ''} ${awayHit ? 'away' : ''}" type="button"
        data-act="open-task" data-id="${esc(t.id)}" data-bar="${esc(t.id)}"
        style="left:${left}%;width:${Math.max(0.5, right - left)}%;top:${lane * 26 + 3}px"
        title="${esc(label)}\n${fmtDate(t.start)} → ${fmtDate(t.finish)} · ${esc(tm.text)}${wait.length ? '\nЖдёт исходные данные: ' + esc(irdWaitText(wait)) : ''}${awayHit ? '\nФиниш приходится на отсутствие: ' + esc(absHits(t).filter(h => h.onFinish).map(A.absenceText).join('; ')) : ''}\nТяните — сдвинуть работу, края — изменить старт или финиш">${isCrit ? '<span class="tl-cp" title="Критический путь: задержка сдвинет сдачу проекта">КП</span>' : ''}${noexec ? NOEXEC_ICON : ''}${esc(label)}${crit && !isCrit && fl > 0 ? `<span class="tl-float">запас ${fl} дн.</span>` : ''}</button>` : '';
      return bar + ext + ms;
    }).join('');
    // Staff rows: vacation / sick leave as a hatched band over the row.
    const away = grp.user ? A.absencesOf(grp.user).filter(a => a.to >= from && a.from <= to).map(a => {
      const l = clamp(pos(a.from)), r = clamp(pos(a.to) + dayW);
      return `<span class="tl-away" style="left:${l}%;width:${Math.max(0.5, r - l)}%" title="${esc(grp.user.name)}: ${esc(A.ABSENCE_KINDS[a.kind] || 'отсутствует')} ${fmtDate(a.from)}–${fmtDate(a.to)}${a.note ? ' · ' + esc(a.note) : ''}"></span>`;
    }).join('') : '';
    const busy = lanes.length;
    const outside = [before ? `${before} раньше` : '', after ? `${after} позже` : ''].filter(Boolean).join(', ');
    return `<div class="tl-row ${grp.unassigned ? 'tl-unassigned' : ''}">
      <div class="tl-name">${foldBtn(gkey, false)}<b title="${esc(grp.name)}">${esc(grp.name)}</b>${crit && byProject && state.projects.get(grp.key.slice(1)) ? cpSummary(state.projects.get(grp.key.slice(1))) : ''}<span class="hint">${grp.sub ? `${esc(grp.sub)} · ` : ''}${grp.tasks.length ? `в работе ${grp.tasks.length}` : byProject ? 'нет незавершённых' : 'свободен'}${!byProject && busy > 1 ? ` · одновременно до <span class="${busy >= 3 ? 'neg' : ''}">${busy}</span>` : ''}${outside ? ` · вне экрана: ${outside}` : ''}</span></div>
      <div class="tl-track" data-gantt-track style="height:${Math.max(1, lanes.length) * 26 + 6}px">${shade}${away}${grid}${today}${bars}</div>
    </div>`;
  }).join('');

  const preset = GANTT_PRESETS.map(([d, l]) => `<button class="btn sm ${g.days === d ? 'on' : ''}" type="button" data-act="g-scale" data-days="${d}">${l}</button>`).join('');
  return `<section class="panel">
    <div class="panel-h"><h3>Диаграмма Ганта</h3>${ganttModeSeg()}<span class="meta">${fmtDate(from)} — ${fmtDate(to)} · ${span} дн. · незавершённые карточки</span></div>
    <div class="gantt-bar one-row">
      <select id="gq-project" aria-label="Проект" class="sm-sel"><option value="">Все проекты</option>${liveProjects().map(p => `<option value="${esc(p.id)}"${gq.project === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select id="gq-mark" aria-label="Раздел" class="sm-sel"><option value="">Все разделы</option>${normalizeMarks(tasksArr().filter(t => t.status !== 'done').flatMap(sectionsOf)).map(m => `<option value="${esc(m)}"${gq.mark === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
      ${assignChk('gantt')}
      <button class="btn sm ${crit ? 'on' : ''}" type="button" data-act="g-crit" title="Подсветить работы, от которых зависит дата сдачи; у остальных — запас дней">Критический путь</button>${crit && gq.project && state.projects.get(gq.project) ? cpSummary(state.projects.get(gq.project)) : ''}
      <button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="1" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Свернуть все строки">▸ все</button><button class="btn ghostbtn sm" type="button" data-act="fold-all" data-on="0" data-keys="${esc(groups.map(g => 'g:' + g.key).join(' '))}" title="Развернуть все строки">▾ все</button>
      <div class="seg" role="group" aria-label="Группировка"><button class="btn sm ${byProject || byOwner ? '' : 'on'}" type="button" data-act="g-group" data-group="contractor">По исполнителям</button>${isSpec() ? '' : `<button class="btn sm ${byOwner ? 'on' : ''}" type="button" data-act="g-group" data-group="owner">По ответственным</button>`}<button class="btn sm ${byProject ? 'on' : ''}" type="button" data-act="g-group" data-group="project">По проектам</button></div>
      <div class="seg" role="group" aria-label="Масштаб">${preset}</div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-zoom" data-dir="in" title="Крупнее (Ctrl + колесо вверх)">+</button><button class="btn sm" type="button" data-act="g-zoom" data-dir="out" title="Мельче (Ctrl + колесо вниз)">−</button></div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-shift" data-dir="-1" title="Назад">←</button><button class="btn sm" type="button" data-act="g-today">Сегодня</button><button class="btn sm" type="button" data-act="g-shift" data-dir="1" title="Вперёд">→</button></div>
      <span class="help-dot" tabindex="0" title="Фон диаграммы тяните мышью — прокрутка по датам; полоску — сдвиг работы; край полоски — старт или финиш. Ctrl + колесо — масштаб.">?</span>
    </div>
    <div class="tablewrap"><div class="tl" id="gantt" style="--tl-name:${g.nameW}px">${head}${rows || `<div class="none">${gq.project || gq.mark ? 'Под выбранный проект и раздел незавершённых карточек нет — сбросьте фильтр над диаграммой.' : 'Нет незавершённых карточек. Когда у карточек появятся старт и финиш, здесь будет видно, кто чем занят и где пересекаются сроки.'}</div>`}</div></div>
    <div class="tl-legend hint"><span class="tl-key tone-work"></span>в работе <span class="tl-key tone-idle"></span>не начат <span class="tl-key tone-review"></span>на проверке
      <span class="tl-key tone-warn"></span>на доработке <span class="tl-key tone-bad"></span>срок сорван <span class="tq-ms"></span>контрольная точка
      <span class="tl-arrow"></span>зависимость <span class="tl-key tl-key-hol"></span>выходные и праздники ${NOEXEC_ICON}нет исполнителя
      ${unofficial.length ? `<span class="cal-note">Календарь на ${unofficial.join(', ')} г. — по общему правилу (постановления о переносах нет в программе).</span>` : ''}</div>
  </section>`;
}

// «График отпусков»: staff rows with vacations and sick leaves on the same time scale, and how many are away each day.
function viewVacations() {
  const g = state.gantt, from = g.from, span = g.days, to = addDays(from, span);
  const pos = d => ((dayNum(d) - dayNum(from)) / span) * 100, dayW = 100 / span;
  const clamp = v => Math.min(100, Math.max(0, v));
  const staff = staffArr();
  const ticks = ganttTicks(from, span);
  const grid = ticks.map(tk => `<span class="tq-grid ${tk.major ? 'major' : ''}" style="left:${pos(tk.iso)}%"></span>`).join('');
  const nowIn = state.today >= from && state.today <= to;
  const today = nowIn ? `<span class="tl-now" style="left:${pos(state.today) + dayW / 2}%"></span>` : '';
  const offDays = span <= 120 ? Array.from({ length: span + 1 }, (_, i) => addDays(from, i)).filter(d => L.Cal.dayInfo(d).off) : [];
  const shade = offDays.map(d => `<span class="tl-we" style="left:${pos(d)}%;width:${dayW}%"></span>`).join('');
  // Away per day → a strip of cells; deeper colour = more people away at once.
  const awayOn = d => staff.filter(u => A.absencesOf(u).some(a => a.from <= d && a.to >= d));
  const step = span <= 120 ? 1 : 7;
  const cells = [];
  for (let i = 0; i <= span; i += step) {
    const d = addDays(from, i), n = Math.max(...Array.from({ length: step }, (_, k) => awayOn(addDays(d, k)).length));
    if (n) cells.push(`<span class="vac-cell v${Math.min(4, n)}" style="left:${pos(d)}%;width:${dayW * step}%" title="${fmtDate(d)}${step > 1 ? ' (неделя)' : ''}: отсутствуют ${n} — ${esc(awayOn(d).map(u => u.name).join(', '))}">${span <= 63 ? n : ''}</span>`);
  }
  const rows = staff.map(u => {
    const list = A.absencesOf(u).filter(a => a.to >= from && a.from <= to);
    const bars = list.map(a => {
      const l = clamp(pos(a.from)), r = clamp(pos(a.to) + dayW);
      return `<span class="vac-bar k-${a.kind}" style="left:${l}%;width:${Math.max(0.6, r - l)}%" title="${esc(u.name)}: ${esc(A.ABSENCE_KINDS[a.kind] || 'отсутствует')} ${fmtDate(a.from)}–${fmtDate(a.to)}${a.note ? ' · ' + esc(a.note) : ''}">${esc(A.ABSENCE_KINDS[a.kind] || '')} ${fmtDate(a.from).slice(0, 5)}–${fmtDate(a.to).slice(0, 5)}</span>`;
    }).join('');
    // Deadlines of the person's cards that fall into an absence: the reason this chart exists.
    const hits = tasksArr().filter(t => hasOwner(t, u.id) && absHits(t).some(h => h.user.id === u.id && h.onFinish) && t.finish >= from && t.finish <= to)
      .map(t => `<span class="vac-hit" style="left:${pos(t.finish) + dayW / 2}%" title="Финиш ${marksText(t)} (${esc(projectOf(t)?.name || '')}) ${fmtDate(t.finish)} — во время отсутствия"></span>`).join('');
    return `<div class="tl-row"><div class="tl-name"><span class="kicons">${userIcons(u)}</span><b title="${esc(u.name)}">${esc(u.name)}</b>${A.canEditAbsences(state.me, u) ? `<button class="btn ghostbtn sm" type="button" data-act="absences" data-id="${esc(u.id)}" title="Отпуска и больничные">＋</button>` : ''}</div>
      <div class="tl-track" style="height:28px">${shade}${grid}${today}${bars}${hits}</div></div>`;
  }).join('');
  const preset = GANTT_PRESETS.map(([d, l]) => `<button class="btn sm ${g.days === d ? 'on' : ''}" type="button" data-act="g-scale" data-days="${d}">${l}</button>`).join('');
  return `<section class="panel">
    <div class="panel-h"><h3>Диаграмма Ганта</h3>${ganttModeSeg()}<span class="meta">${fmtDate(from)} — ${fmtDate(to)} · штатные: ${staff.length}</span></div>
    <div class="gantt-bar one-row"><div class="seg" role="group" aria-label="Масштаб">${preset}</div>
      <div class="seg"><button class="btn sm" type="button" data-act="g-shift" data-dir="-1" title="Назад">←</button><button class="btn sm" type="button" data-act="g-today">Сегодня</button><button class="btn sm" type="button" data-act="g-shift" data-dir="1" title="Вперёд">→</button></div>
      <span class="help-dot" tabindex="0" title="Отпуска и больничные штатных. Красная риска — финиш карточки во время отсутствия. Строка «Отсутствуют» — сколько человек нет одновременно. «＋» у имени — добавить отпуск.">?</span></div>
    <div class="tablewrap"><div class="tl vac" style="--tl-name:${g.nameW}px">
      <div class="tl-row tl-head"><div class="tl-name">Сотрудник</div><div class="tl-track">${ticks.map(tk => `<span class="tl-tick ${tk.major ? 'major' : ''}" style="left:${pos(tk.iso)}%">${esc(tk.label)}</span>`).join('')}${nowIn ? `<span class="tl-today" style="left:${pos(state.today) + dayW / 2}%"><b>сегодня</b></span>` : ''}</div></div>
      <div class="tl-row vac-sum"><div class="tl-name" title="Сколько штатных отсутствует одновременно"><b>Отсутствуют</b></div><div class="tl-track" style="height:24px">${grid}${cells.join('')}</div></div>
      ${rows || '<div class="none">Штатных сотрудников пока нет.</div>'}</div></div>
    <div class="tl-legend hint"><span class="vac-key k-vacation"></span>отпуск <span class="vac-key k-sick"></span>больничный <span class="vac-key k-other"></span>другое <span class="vac-hit legend"></span>финиш карточки на отсутствие</div>
  </section>`;
}

// Dependency arrows: drawn after layout, from the end of a predecessor bar to the start of the dependent one.
function drawGanttLinks() {
  const root = document.getElementById('gantt');
  if (!root) return;
  root.querySelector('.tl-links')?.remove();
  const box = root.getBoundingClientRect();
  const paths = [];
  for (const t of tasksArr()) {
    const deps = L.depsOf(t);
    if (!deps.length) continue;
    const b = root.querySelector(`.tl-bar[data-bar="${CSS.escape(t.id)}"]`);
    if (!b) continue;
    const rb = b.getBoundingClientRect();
    const issues = new Set(L.dependencyIssues(t, state.tasks, state.today).map(i => i.pred.id));
    for (const pid of deps) {
      const a = root.querySelector(`.tl-bar[data-bar="${CSS.escape(pid)}"]`);
      if (!a) continue;
      const ra = a.getBoundingClientRect();
      const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top;
      const d = x2 - x1 >= 14
        ? `M${x1} ${y1} H${x1 + 7} V${y2} H${x2 - 2}`
        : `M${x1} ${y1} h7 V${(y1 + y2) / 2} H${x2 - 9} V${y2} H${x2 - 2}`; // the dependent starts before: route around
      paths.push(`<path d="${d}" class="${issues.has(pid) ? 'bad' : ''}" marker-end="url(#${issues.has(pid) ? 'arr-bad' : 'arr'})"/>`);
    }
  }
  if (!paths.length) return;
  const svg = `<svg class="tl-links" width="${root.scrollWidth}" height="${root.scrollHeight}" aria-hidden="true">
    <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="arr-head"/></marker>
    <marker id="arr-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="arr-head bad"/></marker></defs>
    ${paths.join('')}</svg>`;
  root.insertAdjacentHTML('beforeend', svg);
}

function setGantt(patch) {
  const g = state.gantt;
  Object.assign(g, patch);
  g.days = Math.round(Math.min(GANTT_MAX_DAYS, Math.max(GANTT_MIN_DAYS, g.days)));
  saveLocal('gantt', { days: g.days, nameW: g.nameW, group: g.group, mode: g.mode || 'work' });
  renderNow();
}
// Zoom keeping the day under `anchor` (0..1 across the track) in place.
function zoomGantt(factor, anchor = 0.5) {
  const g = state.gantt;
  const days = Math.round(Math.min(GANTT_MAX_DAYS, Math.max(GANTT_MIN_DAYS, g.days * factor)));
  if (days === g.days) return;
  const pivot = dayNum(g.from) + g.days * anchor;
  setGantt({ days, from: isoOf(Math.round(pivot - days * anchor)) });
}
const trackRect = () => document.querySelector('#gantt [data-gantt-track]')?.getBoundingClientRect();

// Mouse on the chart: the background pans; a bar moves the work; its edges change start or finish.
// A press that moves less than 4 px is a click (opens the card).
let ganttDrag = null, suppressClick = false;
const EDGE_PX = 7;
document.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  suppressClick = false;
  const handle = e.target.closest('[data-gantt-resize]');
  if (handle) {
    e.preventDefault();
    ganttDrag = { mode: 'resize', x: e.clientX, w: state.gantt.nameW };
    document.body.classList.add('col-resizing');
    return;
  }
  if (!e.target.closest('#gantt [data-gantt-track]')) return;
  const r = trackRect();
  if (!r) return;
  const bar = canEditFields() ? e.target.closest('.tl-bar[data-bar]') : null; // specialists only pan the chart
  if (bar) {
    const t = state.tasks.get(bar.dataset.bar);
    if (!t) return;
    const br = bar.getBoundingClientRect();
    const x = e.clientX - br.left;
    const edit = x <= EDGE_PX && !bar.classList.contains('cut-l') ? 'start' : br.width - x <= EDGE_PX && !bar.classList.contains('cut-r') ? 'finish' : 'move';
    track('drag:gantt');
    ganttDrag = { mode: 'bar', edit, id: t.id, x: e.clientX, width: r.width, el: bar, left: parseFloat(bar.style.left), w: parseFloat(bar.style.width), moved: false, delta: 0 };
    return;
  }
  ganttDrag = { mode: 'pan', x: e.clientX, from: state.gantt.from, width: r.width, moved: false };
});
document.addEventListener('pointermove', e => {
  const d = ganttDrag;
  if (!d) {
    // Hint the edges with a resize cursor.
    const bar = e.target.closest?.('#gantt .tl-bar[data-bar]');
    if (bar) {
      const br = bar.getBoundingClientRect(), x = e.clientX - br.left;
      bar.style.cursor = (x <= EDGE_PX && !bar.classList.contains('cut-l')) || (br.width - x <= EDGE_PX && !bar.classList.contains('cut-r')) ? 'ew-resize' : 'grab';
    }
    return;
  }
  const dx = e.clientX - d.x;
  if (d.mode === 'resize') {
    state.gantt.nameW = Math.round(Math.min(420, Math.max(110, d.w + dx)));
    document.getElementById('gantt')?.style.setProperty('--tl-name', state.gantt.nameW + 'px');
    drawGanttLinks();
    return;
  }
  if (!d.moved && Math.abs(dx) < 4) return;
  if (!d.moved) { d.moved = true; document.body.classList.add(d.mode === 'bar' ? 'bar-dragging' : 'panning'); }
  const days = Math.round((dx / d.width) * state.gantt.days);
  if (d.mode === 'pan') {
    const from = addDays(d.from, -days);
    if (from !== state.gantt.from) { state.gantt.from = from; renderNow(); }
    return;
  }
  // Bar: preview only; saved on release.
  d.delta = days;
  const step = 100 / state.gantt.days;
  let left = d.left, w = d.w;
  if (d.edit === 'move') left = d.left + days * step;
  if (d.edit === 'start') { left = d.left + days * step; w = d.w - days * step; }
  if (d.edit === 'finish') w = d.w + days * step;
  if (w < step) { w = step; if (d.edit === 'start') left = d.left + d.w - step; }
  d.el.style.left = left + '%';
  d.el.style.width = w + '%';
  d.el.classList.add('editing');
  previewFollowers(d);
  showDragHint(e, d);
});
// While a bar is dragged: where the cards waiting for it would go (hatched ghosts) and the new end of the project.
function previewFollowers(d) {
  const t = state.tasks.get(d.id);
  $$('#gantt .tl-ghost').forEach(x => x.remove());
  d.follow = null;
  if (!t || !d.delta || d.edit === 'start') return;
  const next = draggedDates(t, d), moved = L.shiftFollowers(tasksArr(), t.id, next);
  moved.delete(t.id);
  if (!moved.size) return;
  const g = state.gantt, pct = x => ((dayNum(x) - dayNum(g.from)) / g.days) * 100, dayW = 100 / g.days;
  for (const [id, x] of moved) {
    const bar = $(`#gantt .tl-bar[data-bar="${CSS.escape(id)}"]`);
    if (!bar || !isDate(x.start) || !isDate(x.finish)) continue;
    const gh = document.createElement('span');
    gh.className = 'tl-ghost';
    gh.style.cssText = `left:${pct(x.start)}%;width:${Math.max(0.5, pct(x.finish) + dayW - pct(x.start))}%;top:${bar.style.top}`;
    bar.parentElement.append(gh);
    bar.classList.add('will-move');
  }
  const p = projectOf(t), all = tasksArr().filter(y => y.projectId === t.projectId).map(y => moved.has(y.id) || y.id === t.id ? { ...y, ...(y.id === t.id ? next : moved.get(y.id)) } : y);
  d.follow = { moved, end0: cpOf(t.projectId).end, end1: L.criticalPath(all).end, p };
}
function showDragHint(e, d) {
  const t = state.tasks.get(d.id);
  const { start, finish } = draggedDates(t, d);
  let hint = document.getElementById('drag-hint');
  if (!hint) { hint = document.createElement('div'); hint.id = 'drag-hint'; document.body.append(hint); }
  const sign = d.delta > 0 ? '+' : '';
  hint.textContent = `${fmtDate(start)} → ${fmtDate(finish)}${d.delta ? ` (${sign}${d.delta} дн.)` : ''}`;
  const f = d.follow;
  if (f) {
    const dl = projDeadline(f.p), late = dl && f.end1 > dl ? dayNum(f.end1) - dayNum(dl) : 0;
    const more = document.createElement('div');
    more.className = 'dh-more';
    more.innerHTML = `сдвинутся ещё ${f.moved.size} ${plural(f.moved.size, 'карточка', 'карточки', 'карточек')}${f.end1 !== f.end0 ? `<br>сдача проекта ${fmtDate(f.end0)} → <b>${fmtDate(f.end1)}</b>` : ''}${late ? `<br><b class="neg">позже договора на ${late} дн.</b>` : ''}`;
    hint.append(more);
  }
  hint.style.left = e.clientX + 14 + 'px';
  hint.style.top = e.clientY + 16 + 'px';
}
function draggedDates(t, d) {
  const s0 = isDate(t.start) ? t.start : state.today;
  const f0 = isDate(t.finish) ? t.finish : addDays(s0, 30);
  if (d.edit === 'move') return { start: addDays(s0, d.delta), finish: isDate(t.finish) ? addDays(f0, d.delta) : t.finish || '' };
  if (d.edit === 'start') { const st = addDays(s0, d.delta); return { start: st > f0 ? f0 : st, finish: t.finish || '' }; }
  const fn = addDays(f0, d.delta);
  return { start: t.start || '', finish: fn < s0 ? s0 : fn };
}
document.addEventListener('pointerup', () => {
  const d = ganttDrag;
  if (!d) return;
  ganttDrag = null;
  document.body.classList.remove('panning', 'col-resizing', 'bar-dragging');
  document.getElementById('drag-hint')?.remove();
  $$('#gantt .tl-ghost').forEach(x => x.remove()); $$('#gantt .will-move').forEach(x => x.classList.remove('will-move'));
  if (d.mode === 'resize') saveLocal('gantt', { days: state.gantt.days, nameW: state.gantt.nameW, group: state.gantt.group });
  // The click that ends a drag must not open a card. Chromium may skip that click when the bar under the
  // pointer was re-rendered, so the guard is cleared on the next task and can never swallow a later click.
  if (d.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  if (d.mode === 'bar' && d.moved) {
    const t = state.tasks.get(d.id);
    if (!t || !d.delta) { renderNow(); return; }
    commitDates(d.id, draggedDates(t, d), d.follow?.moved);
  }
});
document.addEventListener('wheel', e => {
  if (!e.target.closest('#gantt')) return;
  const r = trackRect();
  if (!r) return;
  if (e.ctrlKey) {
    e.preventDefault();
    const anchor = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    zoomGantt(e.deltaY < 0 ? 0.8 : 1.25, anchor);
  } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
    const delta = e.shiftKey ? e.deltaY : e.deltaX;
    const shift = Math.round((delta / r.width) * state.gantt.days) || Math.sign(delta);
    setGantt({ from: addDays(state.gantt.from, shift) });
  }
}, { passive: false });

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'g-mode': ({ el }) => { setGantt({ mode: el.dataset.v }); },
  'g-scale': ({ el }) => { zoomGantt(Number(el.dataset.days) / state.gantt.days, dayNum(state.today) >= dayNum(state.gantt.from) && dayNum(state.today) <= dayNum(state.gantt.from) + state.gantt.days ? (dayNum(state.today) - dayNum(state.gantt.from)) / state.gantt.days : 0.5); },
  'g-zoom': ({ el }) => { zoomGantt(el.dataset.dir === 'in' ? 0.7 : 1 / 0.7); },
  'g-shift': ({ el }) => { setGantt({ from: addDays(state.gantt.from, Math.round(state.gantt.days / 3) * Number(el.dataset.dir)) }); },
  'g-group': ({ el }) => { setGantt({ group: el.dataset.group }); },
  'g-today': () => { setGantt({ from: addDays(state.today, -Math.round(state.gantt.days / 9)) }); },
  'g-crit': () => { state.gantt.crit = !state.gantt.crit; saveLocal('ganttCrit', state.gantt.crit); renderNow(); },
});

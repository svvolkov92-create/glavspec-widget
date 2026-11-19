function taskTable(list, { showProject = true, showContractor = true, empty = 'Карточек пока нет.', emptyActs = '', tall = false, limitKey = 'table', select = false } = {}) {
  list = sortTasks(list.slice());
  const showMoney = canMoney(), edit = canEditFields(), showOwner = !isSpec();
  const cols = colOrder().filter(c => !colPrefs.hidden.includes(c.id) || c.fixed)
    .filter(c => (c.id !== 'project' || showProject) && (c.id !== 'contractor' || showContractor) && (c.id !== 'owner' || showOwner) && (!c.money || showMoney));
  const cell = (field, cls, inner) => `<td class="${cls}"${edit || field === 'status' ? ` data-edit="${field}" title="${EDIT_HINT}"` : ''}>${inner}</td>`;
  const HEAD = { project: () => sortTh('project', 'Проект'), marks: () => sortTh('marks', 'Разделы'), owner: () => sortTh('owner', 'Ответственный'),
    contractor: () => sortTh('contractor', 'Исполнитель'), start: () => sortTh('start', 'Старт'), finish: () => sortTh('finish', 'Финиш'),
    status: () => sortTh('status', 'Статус'), ready: () => sortTh('ready', 'Готовность'), budget: () => sortTh('budget', 'Бюджет', 'r'), paid: () => sortTh('paid', 'Оплачено', 'r'), rest: () => sortTh('rest', 'Остаток', 'r') };
  const CELL = {
    project: t => `<td>${esc(projectOf(t)?.name || '— проект удалён —')}</td>`,
    marks: t => `<td><div class="sec">${unread(t) ? '<span class="new-dot" title="Новое для вас"></span>' : ''}${marksHtml(t)}${t.title ? `<span class="t">${esc(t.title)}</span>` : ''}</div></td>`,
    owner: t => { const o = ownerOf(t); return cell('owner', '', o ? `${esc(o.name)}${coOwnersOf(t).length ? ` <span class="chip tone-idle" title="Соисполнители: ${esc(coOwnersOf(t).map(u => u.name).join(', '))}">+${coOwnersOf(t).length}</span>` : ''}<div class="hint role-hint">${esc(A.ROLES[o.role]?.label || '')}</div>${absHits(t).length ? `<div class="due warn" title="${esc(absHits(t).map(A.absenceText).join('; '))}">отпуск/больничный</div>` : ''}${gapsOf(t).length ? `<div class="due ${t.profileOk ? 'warn' : 'bad'}" title="${esc(gapsOf(t).map(x => x.text).join(' '))}">${t.profileOk ? 'не по профилю (подтверждено)' : 'не по профилю'}</div>` : ''}` : '<span class="hint">не назначен</span>'); },
    contractor: t => { const e = executorOf(t); return cell('contractor', '', e ? execLine(t) : '<span class="hint">не назначен</span>'); },
    start: t => cell('start', 'num', fmtDate(t.start)),
    finish: t => { const tm = timing(t); return cell('finish', '', `<div class="num">${fmtDate(t.finish)}</div><div class="due ${tm.cls}">${esc(tm.text)}</div>${finishExtras(t)}`); },
    status: t => cell('status', '', statusChip(t)),
    ready: t => (canEditFields() && L.readinessManual(t.status) ? cell('ready', '', readyHtml(t)) : `<td>${readyHtml(t)}</td>`),
    budget: t => cell('budget', 'r num', money(budgetOf(t))),
    paid: t => `<td class="r"><div class="num">${money(paidOf(t))}</div>${payBar(t)}</td>`,
    rest: t => { const rest = restOf(t), due = L.paymentPlan(t, state.today).dueNow; return `<td class="r"><div class="num ${rest < 0 ? 'neg' : ''}">${money(rest)}</div>${due > 0 ? `<div class="due warn">пора платить ${money(due)}</div>` : ''}</td>`; },
  };
  const lim = limitOf(limitKey, tall ? 150 : 15), shown = list.slice(0, lim);
  const pick = select && state.bulk;
  const allOn = pick && shown.length && shown.every(t => state.bulk.has(t.id));
  const head = `<tr>${pick ? `<th class="bulk-c"><input type="checkbox" data-act="bulk-all" aria-label="Выбрать все показанные"${allOn ? ' checked' : ''} data-ids="${esc(shown.map(t => t.id).join(' '))}"></th>` : ''}${cols.map(c => HEAD[c.id]().replace('<th', `<th draggable="true" data-col="${c.id}"`)).join('')}</tr>`;
  const rows = list.length ? shown.map(t => `<tr class="row${pick && state.bulk.has(t.id) ? ' picked' : ''}" data-act="open-task" data-id="${esc(t.id)}">${pick ? `<td class="bulk-c"><input type="checkbox" data-act="bulk-pick" data-id="${esc(t.id)}"${state.bulk.has(t.id) ? ' checked' : ''} aria-label="Выбрать"></td>` : ''}${cols.map(c => CELL[c.id](t)).join('')}</tr>`).join('')
    : `<tr class="empty-row"><td colspan="${cols.length + (pick ? 1 : 0)}">${esc(empty)}${emptyActs ? ` <span class="empty-acts">${emptyActs}</span>` : ''}</td></tr>`;
  const more = moreBtn(limitKey, list.length, shown.length, tall ? 300 : 100);
  return `<div class="tablewrap${tall ? ' tall' : ''}"><table><thead>${head}</thead><tbody>${rows}</tbody></table>${more ? `<div class="more-row">${more}</div>` : ''}</div>`;
}
function viewTasks() {
  if (isEmpty()) return emptyState();
  const f = state.filters, q = f.q.trim().toLowerCase();
  // «att:…» statuses come from the header counters: the same lists the overview shows.
  const attIds = f.status.startsWith('att:') ? new Set((attention()[f.status.slice(4)] || []).map(t => t.id)) : null;
  const list = tasksArr().filter(t => {
    if (f.project && t.projectId !== f.project) return false;
    if (!execMatch(t, f.contractor)) return false;
    if (attIds && !attIds.has(t.id)) return false;
    if (f.status.startsWith('att:') ? false : f.status === 'overdue' ? !timing(t).overdue : f.status === 'new' ? !unread(t) : f.status === 'quiet' ? !quietList([t]).length : (f.status && t.status !== f.status)) return false;
    if (f.owner && !hasOwner(t, f.owner === 'me' ? state.me?.id : f.owner)) return false;
    if (f.mark && !sectionsOf(t).includes(f.mark)) return false;
    if (q) {
      const hay = [sectionsOf(t).join(' '), t.title, t.note, t.contractNo, projectOf(t)?.name, contractorOf(t)?.name].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort(sortByDeadline);
  const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
  const tt = totals(list);
  return `<div class="filters one-row">${presetBar()}
      ${isSpec() ? '' : `<select id="f-owner" aria-label="Ответственный">${opt('', 'Все ответственные', f.owner)}${opt('me', 'Мои карточки', f.owner)}${liveUsers().sort(byName).map(u => opt(u.id, u.name, f.owner)).join('')}</select>`}
      <select id="f-project" aria-label="Проект">${opt('', 'Все проекты', f.project)}${liveProjects().map(p => opt(p.id, p.name, f.project)).join('')}</select>
      <select id="f-contractor" aria-label="Исполнитель">${execFilterOpts(opt, f.contractor)}</select>
      <select id="f-status" aria-label="Статус">${opt('', 'Любой статус', f.status)}${opt('overdue', 'Срок сорван', f.status)}${opt('new', 'Новое для меня', f.status)}${opt('att:week', 'Сдача ≤ 7 дней', f.status)}${opt('att:milestones', 'Сорваны КТ', f.status)}${opt('att:pay', 'Пора платить', f.status)}${opt('quiet', 'Тишина', f.status)}${Object.entries(STATUSES).map(([k, s]) => opt(k, s.label, f.status)).join('')}</select>
      <select id="f-mark" aria-label="Раздел">${opt('', 'Любой раздел', f.mark)}${normalizeMarks(tasksArr().flatMap(sectionsOf)).map(m => opt(m, m, f.mark)).join('')}</select>
      <input id="f-q" type="search" placeholder="Поиск: раздел, проект, подрядчик, договор" value="${esc(f.q)}">
    </div>
    <section class="panel"><div class="panel-h"><h3>Карточки</h3><span class="meta">${tt.count}${canMoney() ? ` · бюджет ${money(tt.budget)} · оплачено ${money(tt.paid)} · остаток ${money(tt.rest)}` : ''}</span><span class="spacer"></span>${canEditFields() ? `<button class="btn ghostbtn sm${state.bulk ? ' on' : ''}" type="button" data-act="bulk-toggle" title="Отметить несколько карточек и изменить их разом">${state.bulk ? 'Готово' : 'Выбрать несколько'}</button>` : ''}${colsMenu()}</div>
    ${state.bulk ? bulkBar() : ''}
    ${taskTable(list, list.length ? { tall: true, limitKey: 'tasks', select: canEditFields() } : tasksEmpty())}</section>`;
}
// Compact widget: one line per card, grouped by what to do; the header says how many wait for you.
function compactRow(t, side = '') {
  const tm = timing(t), p = projectOf(t);
  return `<button class="cw-row" type="button" data-act="open-task" data-id="${esc(t.id)}">${marksHtml(t)}<span class="cw-p">${esc(p?.name || '—')}</span><span class="cw-d due ${tm.cls}">${side || esc(tm.text)}</span></button>`;
}
function viewCompact() {
  if (isEmpty()) return `<div class="none">Данных пока нет. Разверните окно, чтобы добавить проекты и карточки.</div>`;
  const a = attention(), fresh = tasksArr().filter(unread);
  const mine = [...new Map([...a.review, ...fresh].map(t => [t.id, t])).values()];
  const group = (title, items, tone, side) => items.length ? `<section class="cw-g"><h4 class="tone-${tone}">${title} <b class="num">${items.length}</b></h4>${items.slice(0, 6).map(t => compactRow(t, side?.(t))).join('')}${items.length > 6 ? `<div class="hint cw-more">и ещё ${items.length - 6}</div>` : ''}</section>` : '';
  const waits = mine.length + a.overdue.length;
  const goals = liveProjects().map(p => ({ p, g: L.projectGoal(tasksArr().filter(t => t.projectId === p.id)) })).filter(x => x.g.total).slice(0, 4);
  const html = `<div class="cw-head"><b>${waits ? `Ждут вас: <span class="num">${waits}</span>` : 'Всё по плану'}</b><span class="hint">${fmtDate(state.today)}</span></div>`
    + group('Проверить и прочитать', mine, 'review', t => (t.status === 'review' ? 'на проверке' : 'новое'))
    + group('Срок сорван', a.overdue, 'bad')
    + group('Сдача за 7 дней', a.week, 'warn')
    + group('Сорваны КТ', a.milestones, 'bad', t => esc(L.milestonesOf(t, state.today).overdue[0]?.title || 'КТ'))
    + (canMoney() ? group('Пора платить', a.pay, 'work', t => money(L.paymentPlan(t, state.today).dueNow)) : '')
    + (goals.length ? `<section class="cw-g"><h4>Проекты</h4>${goals.map(({ p, g }) => `<button class="cw-row cw-goal" type="button" data-act="goto-project" data-id="${esc(p.id)}"><span class="cw-p"><b>${esc(p.name)}</b></span>${goalHtml(tasksArr().filter(t => t.projectId === p.id), true)}</button>`).join('')}</section>` : '');
  return `<div class="cw">${html}</div>`;
}

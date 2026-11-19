/* ---------- weekly summary for management ---------- */
function weeklyText(list = tasksArr()) {
  const today = state.today, from = addDays(today, -6), next = addDays(today, 7);
  const line = t => `• ${projectOf(t)?.name || '—'} — ${marksText(t)}${t.title ? ' (' + t.title + ')' : ''}${ownerOf(t) ? ', ' + ownerOf(t).name : ''}${contractorOf(t) ? ', ' + contractorOf(t).name : ''}`;
  const inWeek = d => d && d >= from && d <= today;
  const accepted = list.filter(t => t.status === 'done' && inWeek(L.reviewStats(t, today).accepted));
  const submitted = list.filter(t => (t.history || []).some(h => h.type === 'status' && h.to === 'review' && inWeek(h.date)) && !accepted.includes(t));
  const shifted = list.flatMap(t => (t.history || []).filter(h => h.type === 'finish' && inWeek(h.date)).map(h => ({ t, h })));
  const overdue = list.filter(t => timing(t).overdue);
  const coming = list.filter(t => L.ACTIVE.has(t.status) && !timing(t).overdue && isDate(t.finish) && t.finish >= today && t.finish <= next).sort(sortByDeadline);
  const review = list.filter(t => t.status === 'review');
  const sec = (title, items, fmt = line) => items.length ? `\n${title} (${items.length}):\n${items.map(fmt).join('\n')}\n` : '';
  const head = `Сводка за неделю ${fmtDate(from)}–${fmtDate(today)}${state.me ? ' · ' + state.me.name : ''}\n`
    + `В работе ${list.filter(t => L.ACTIVE.has(t.status)).length}, сорвано ${overdue.length}, на проверке ${review.length}.\n`;
  return head
    + sec('Принято', accepted)
    + sec('Сдано на проверку', submitted)
    + sec('Перенесены сроки', shifted, ({ t, h }) => `${line(t)}: ${fmtDate(h.from)} → ${fmtDate(h.to)}${h.reason ? ' — ' + (SHIFT_REASONS[h.reason] || h.reason).toLowerCase() : ''}${h.note ? ' (' + h.note + ')' : ''}`)
    + sec('Срок сорван', overdue, t => `${line(t)} — ${timing(t).text}`)
    + sec('Сдача на следующей неделе', coming, t => `${line(t)} — до ${fmtDate(t.finish)}`)
    + sec('Ждут проверки', review);
}
function openWeekly() {
  setFileMenu(false);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <h2 id="mtitle">Сводка за неделю</h2>
    <p class="hint">Текст можно поправить перед отправкой. Деньги в сводку не попадают.</p>
    <textarea id="wk-text" class="wk-text" rows="16">${esc(weeklyText())}</textarea>
    <div class="modal-f"><button class="btn primary" type="button" data-m="copy">Копировать</button><button class="btn" type="button" data-m="cancel">Закрыть</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'copy') copyText($('#wk-text').value).then(ok => toast(ok ? 'Сводка скопирована — вставьте в мессенджер или почту' : 'Текст выделен — нажмите Ctrl+C'));
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $('#wk-text').focus();
}

/* ---------- absences of staff (vacation, sick leave) ---------- */
function openAbsences(uid) {
  const u = state.users.get(uid);
  if (!u || !A.canEditAbsences(state.me, u)) return toast('Отсутствия этого сотрудника ведут ГИП или его главспец.', true);
  let rows = clone(A.absencesOf(u).length ? u.absences : []);
  const root = document.createElement('div');
  root.className = 'modal-back';
  const draw = () => {
    root.querySelector('#abs-rows').innerHTML = rows.length ? rows.map((a, i) => `<div class="abs-row" data-i="${i}">
      <select data-k="kind">${Object.entries(A.ABSENCE_KINDS).map(([k, l]) => `<option value="${k}"${a.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input type="date" data-k="from" value="${esc(a.from || '')}" aria-label="С"><span>—</span><input type="date" data-k="to" value="${esc(a.to || '')}" aria-label="По">
      <input data-k="note" value="${esc(a.note || '')}" placeholder="Комментарий" maxlength="100">
      <button class="btn ghostbtn sm" type="button" data-m="del" data-i="${i}" title="Удалить">✕</button></div>`).join('') : '<div class="hint">Отсутствий не отмечено.</div>';
  };
  root.innerHTML = `<form class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
    <h2 id="mtitle">Отсутствия: ${esc(u.name)}</h2>
    <p class="hint">Отпуска и больничные. Программа предупредит, если срок карточки сотрудника попадает на эти дни, и покажет их на диаграмме Ганта.</p>
    <div id="abs-rows"></div>
    <button class="btn sm" type="button" data-m="add">+ Добавить период</button>
    <div class="err" id="m-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div>
  </form>`;
  document.body.append(root);
  draw();
  const close = () => root.remove();
  root.addEventListener('input', e => { const r = e.target.closest('.abs-row'); if (r) rows[Number(r.dataset.i)][e.target.dataset.k] = e.target.value; });
  root.addEventListener('click', e => {
    const m = e.target.dataset.m;
    if (e.target === root || m === 'cancel') close();
    if (m === 'add') { rows.push({ id: newId(), kind: 'vacation', from: todayStr(), to: addDays(todayStr(), 13), note: '' }); draw(); }
    if (m === 'del') { rows.splice(Number(e.target.dataset.i), 1); draw(); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const bad = rows.find(a => !isDate(a.from) || !isDate(a.to) || a.to < a.from);
    if (bad) { const i = rows.indexOf(bad); return modalErr(root, '#m-err', 'Проверьте даты: «по» не раньше «с».', `.abs-row[data-i="${i}"] [data-k="${isDate(bad.from) ? 'to' : 'from'}"]`); }
    const list = rows.map(a => ({ id: a.id || newId(), kind: a.kind, from: a.from, to: a.to, note: (a.note || '').trim() })).sort((a, b) => a.from.localeCompare(b.from));
    if (await write(op.update('users', uid, { absences: list }), `Отсутствия сохранены: ${u.name}`)) close();
  });
}
const upcomingAbsences = u => A.absencesOf(u).filter(a => a.to >= state.today);

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'absences': ({ id }) => { openAbsences(id); },
});

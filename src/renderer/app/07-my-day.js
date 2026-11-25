/* ---------- 4.1.1: «Мой день» (item 48) — what is mine today, per role; every row is a button ---------- */
function myCards() { const me = state.me?.id; return tasksArr().filter(t => ACTIVE.has(t.status) && (t.ownerId === me || executorOf(t)?.u?.id === me || hasOwner(t, me))); }
function dayDocs() {
  const out = [];
  for (const p of liveProjects()) for (const d of p.docs || []) {
    if (!isDate(d.until)) continue;
    const left = dayNum(d.until) - dayNum(state.today);
    if (left <= (d.remind ?? 60)) out.push({ p, d, left });
  }
  return out.sort((a, b) => a.left - b.left);
}
function idlePeople() {
  if (isSpec()) return [];
  const busy = new Set(tasksArr().filter(t => ACTIVE.has(t.status)).flatMap(t => [t.ownerId, ...(t.coOwnerIds || []), executorOf(t)?.u?.id]).filter(Boolean));
  const scope = A.isGip(state.me) ? liveUsers().filter(u => !A.isGip(u)) : liveUsers().filter(u => u.chiefId === state.me?.id);
  return scope.filter(u => !busy.has(u.id) && !A.absencesOf(u).some(x => x.from <= state.today && x.to >= state.today)).sort(byName);
}
function viewDay() {
  if (isEmpty()) return emptyState();
  const a = attention(), me = state.me, spec = isSpec();
  const hour = new Date().getHours(), hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const mine = myCards(), notStarted = mine.filter(t => t.status === 'not_started'), working = mine.filter(t => ['in_progress', 'revision'].includes(t.status));
  const review = spec ? [] : a.review, overdue = spec ? mine.filter(t => timing(t).overdue) : a.overdue;
  const week = (spec ? mine : a.week).filter(t => !timing(t).overdue && isDate(t.finish) && dayNum(t.finish) - dayNum(state.today) <= 7);
  const unread = [...state.chats.values()].reduce((n, c) => n + msgUnread(c).length, 0);
  const idle = idlePeople(), docs = spec ? [] : dayDocs();
  const kpi = (label, n, tone, act, extra = '') => `<button class="kpi day-kpi" type="button"${act}><span class="hint">${label}</span><b class="num kv-${n ? tone : 'idle'}">${n}</b>${extra}</button>`;
  const kpis = spec
    ? kpi('Мои карточки', mine.length, 'work', ' data-act="tab" data-id="kanban"') + kpi('Срок на неделе', week.length, 'warn', ' data-act="att-go" data-v="att:week"') + kpi('Срок сорван', overdue.length, 'bad', ' data-act="att-go" data-v="overdue"') + kpi('Новые сообщения', unread, 'work', ' data-act="msg-open-any"')
    : kpi('Ждёт моей проверки', review.length, 'review', review.length ? ' data-act="review-queue"' : '') + kpi('Срок сорван', overdue.length, 'bad', ' data-act="att-go" data-v="overdue"') + kpi('Новые сообщения', unread, 'work', ' data-act="msg-open-any"') + kpi('Без работы', idle.length, 'warn', ' data-act="tab" data-id="people"', idle.length ? `<span class="hint">${esc(idle.slice(0, 2).map(u => u.name).join(', '))}${idle.length > 2 ? '…' : ''}</span>` : '');
  const row = (tag, tone, t, btn = '') => `<div class="day-row"><span class="chip tone-${tone}">${tag}</span><button class="linkbtn day-t" type="button" data-act="open-task" data-id="${esc(t.id)}">${marksHtml(t)} ${esc(projectOf(t)?.name || '')}<span class="hint"> — ${esc(executorOf(t)?.name || 'нет исполнителя')}</span></button><span class="spacer"></span>${btn}</div>`;
  const first = [
    ...overdue.slice(0, 6).map(t => row(isDate(t.finish) ? `сорван ${dayNum(state.today) - dayNum(t.finish)} дн.` : 'срок сорван', 'bad', t)),
    ...(review.length ? [`<div class="day-row"><span class="chip tone-review">на проверке</span><span>${review.length} ${plural(review.length, 'карточка ждёт', 'карточки ждут', 'карточек ждут')} вашего решения</span><span class="spacer"></span><button class="btn primary sm" type="button" data-act="review-queue">Проверить ${review.length > 1 ? 'все ' + review.length : ''}</button></div>`] : []),
    ...week.slice(0, 6).map(t => row(`срок ${fmtDate(t.finish).slice(0, 5)}`, 'warn', t)),
    ...docs.slice(0, 4).map(({ p, d, left }) => `<div class="day-row"><span class="chip tone-${left < 0 ? 'bad' : 'warn'}">${left < 0 ? 'документ истёк' : `истекает через ${left} дн.`}</span><button class="linkbtn day-t" type="button" data-act="goto-project" data-id="${esc(p.id)}">${esc(d.title)}<span class="hint"> — ${esc(p.name)}</span></button>${A.canManageCatalog(state.me) && d.id ? (docLetter(p, d.id) ? `<span class="chip tone-work">${esc(letterNo(docLetter(p, d.id)))}</span>` : `<button class="btn ghostbtn sm" type="button" data-act="doc-renew-day" data-id="${esc(p.id)}" data-doc="${esc(d.id)}" title="Письмо на продление по шаблону">✉ Запросить</button>`) : ''}</div>`),
  ];
  // 4.15: remarks of the expertise this user answers.
  const rems = myRemarks().slice(0, 6).map(({ p, r }) => `<div class="day-row"><span class="chip tone-${exLate(r) ? 'bad' : 'warn'}">${exLate(r) ? 'замечание просрочено' : `замечание${isDate(r.due) ? ' до ' + fmtDate(r.due).slice(0, 5) : ''}`}</span><button class="linkbtn day-t" type="button" data-act="ex-open" data-id="${esc(p.id)}" data-v="${esc(r.id)}">№ ${esc(r.n)}${r.mark ? ' · ' + esc(r.mark) : ''} · ${esc(String(r.text).slice(0, 70))}<span class="hint"> — ${esc(p.name)}</span></button></div>`);
  first.push(...rems);
  // 4.16: assignments issued to my sections — accept or return them.
  const asgIn = tasksArr().filter(t => t.kind === 'assign' && t.status === 'review' && asgTo(t).some(x => hasOwner(x, me?.id)));
  first.push(...asgIn.slice(0, 6).map(t => `<div class="day-row"><span class="chip tone-review">вам выдано задание</span><button class="linkbtn day-t" type="button" data-act="project-page" data-id="${esc(t.projectId)}">${esc(t.note || t.title)}<span class="hint"> — ${esc(projectOf(t)?.name || '')}</span></button>${A.canEditTaskFields(state.me) ? `<button class="btn okbtn sm" type="button" data-act="asg-accept" data-id="${esc(t.id)}">Принял</button>` : ''}</div>`));
  const todo = [
    ...working.map(t => row(STATUSES[t.status].label.toLowerCase(), 'work', t, `<button class="btn sm${focus?.taskId === t.id ? ' on' : ''}" type="button" data-act="${focus?.taskId === t.id ? 'focus-stop' : 'focus-start'}" data-id="${esc(t.id)}">${focus?.taskId === t.id ? 'Пауза' : '▶ Фокус'}</button>`)),
    ...notStarted.map(t => row('не начат', 'idle', t, `<button class="btn primary sm" type="button" data-act="cm-quick" data-q="start" data-id="${esc(t.id)}">▶ Начать</button>`)),
  ];
  return `<section class="day"><div class="day-h"><h2>${hello}${me?.name ? ', ' + esc(me.name.split(' ').slice(1).join(' ') || me.name) : ''}</h2><span class="hint">${esc(new Date(state.today + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
    <div class="day-kpis">${kpis}</div>
    <div class="day-cols"><section class="panel"><div class="panel-h"><h3>Сначала это</h3></div><div class="day-list">${first.join('') || '<p class="hint day-empty">Ничего срочного — всё по плану.</p>'}</div></section>
      <section class="panel"><div class="panel-h"><h3>Мои карточки</h3><span class="meta">${mine.length}</span></div><div class="day-list">${todo.join('') || `<p class="hint day-empty">${spec ? 'Карточек пока нет — их выдаёт главспец или ГИП.' : 'Лично на вас карточек нет.'}</p>`}</div></section></div></section>`;
}

// What waits for the user right now: to check, overdue of mine (or all, for GIP/chief), unread mentions.
function badgeCount() {
  const a = attention(), spec = isSpec();
  const overdue = spec ? myCards().filter(t => timing(t).overdue).length : a.overdue.length;
  const mentions = [...state.chats.values()].reduce((n, c) => n + msgMentions(c).length, 0);
  return (spec ? 0 : a.review.length) + overdue + mentions;
}
/* ---------- 4.1.1: the «Сегодня» panel from the tray (item 35): what is urgent, without opening the whole Пульт ---------- */
function viewTrayPanel() {
  if (!state.me) return '<div class="hint tp-empty">Откройте Пульт и выберите пользователя.</div>';
  const a = attention(), mine = myCards(), spec = isSpec();
  const review = spec ? [] : a.review, overdue = spec ? mine.filter(t => timing(t).overdue) : a.overdue;
  const soon = (spec ? mine : a.week).filter(t => !timing(t).overdue && isDate(t.finish) && dayNum(t.finish) - dayNum(state.today) <= 3);
  const unread = [...state.chats.values()].reduce((n, c) => n + msgUnread(c).length, 0);
  const row = (t, tone, side) => `<button class="tp-row" type="button" data-act="tp-task" data-id="${esc(t.id)}"><span class="chip tone-${tone}">${side}</span><span class="tp-t">${marksHtml(t)} ${esc(projectOf(t)?.name || '')}</span></button>`;
  const notStarted = mine.filter(t => t.status === 'not_started').slice(0, 3);
  const sec = (title, html) => (html ? `<section class="tp-sec"><h4>${title}</h4>${html}</section>` : '');
  const body = sec('Срок сорван', overdue.slice(0, 5).map(t => row(t, 'bad', isDate(t.finish) ? `−${dayNum(state.today) - dayNum(t.finish)} дн.` : 'сорван')).join(''))
    + sec('Ждут проверки', review.slice(0, 5).map(t => row(t, 'review', 'проверить')).join(''))
    + sec('Срок в ближайшие 3 дня', soon.slice(0, 5).map(t => row(t, 'warn', fmtDate(t.finish).slice(0, 5))).join(''))
    + sec('Можно начать', notStarted.map(t => `<div class="tp-row tp-start">${marksHtml(t)} <span class="tp-t">${esc(projectOf(t)?.name || '')}</span><button class="btn primary sm" type="button" data-act="cm-quick" data-q="start" data-id="${esc(t.id)}">▶ Начать</button></div>`).join(''));
  return `<div class="tp"><div class="tp-h drag"><b>Сегодня</b><span class="hint">${esc(new Date(state.today + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }))}</span><span class="spacer"></span>
      ${unread ? `<button class="chip tone-work" type="button" data-act="tp-main" data-v="msg">сообщения ${unread}</button>` : ''}</div>
    <div class="tp-body">${body || '<p class="hint tp-empty">Ничего срочного — всё по плану.</p>'}</div>
    <div class="tp-f"><button class="btn primary" type="button" data-act="tp-main" data-v="open">Открыть Пульт</button><button class="btn" type="button" data-act="tp-main" data-v="day">Мой день</button></div></div>`;
}

/* ---------- 4.1.1: review queue (item 49) — the cards waiting for my decision, one after another ---------- */
let rq = null; // { ids, i }
function openReviewQueue() {
  const ids = attention().review.map(t => t.id);
  if (!ids.length) return toast('На проверке ничего нет.');
  rq = { ids, i: 0 };
  renderReviewQueue();
}
function closeReviewQueue() { rq = null; $('#rq-root')?.remove(); renderNow(); }
function renderReviewQueue() {
  let root = $('#rq-root');
  rq.ids = rq.ids.filter(id => state.tasks.get(id)?.status === 'review');
  if (!rq.ids.length) { root?.remove(); rq = null; toast('Очередь проверки пуста — всё разобрано.'); renderNow(); return; }
  rq.i = Math.max(0, Math.min(rq.i, rq.ids.length - 1));
  const t = state.tasks.get(rq.ids[rq.i]), p = projectOf(t);
  const sub = [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'review');
  const files = [...(t.history || [])].reverse().flatMap(h => h.files || []).slice(0, 6);
  if (!root) { root = document.createElement('div'); root.id = 'rq-root'; root.className = 'modal-back'; document.body.append(root); }
  root.innerHTML = `<div class="modal rq" role="dialog" aria-modal="true" aria-labelledby="rq-t">
    <div class="rq-h"><h2 id="rq-t">Проверка <b class="num">${rq.i + 1} из ${rq.ids.length}</b></h2><span class="spacer"></span><span class="hint">← → листать · A принять · R вернуть · Esc закрыть</span><button class="btn ghostbtn sm" type="button" data-rq="close" aria-label="Закрыть">✕</button></div>
    <div class="rq-bar"><i style="width:${Math.round(((rq.i + 1) / rq.ids.length) * 100)}%"></i></div>
    <div class="rq-body"><div><div class="rq-title">${marksHtml(t)} <b>${esc(p?.name || '')}</b>${t.title ? ` · ${esc(t.title)}` : ''}</div>
      <div class="hint">${esc(executorOf(t)?.name || 'нет исполнителя')} · сдано ${sub ? fmtDate(sub.date || sub.ts.slice(0, 10)) : '—'} · срок ${fmtDate(t.finish)}${timing(t).overdue ? ' · <span class="neg">срок сорван</span>' : ''}</div>
      <div class="lbl">Что сделано</div><div class="rq-note">${sub?.note ? esc(sub.note) : '<span class="hint">Без описания.</span>'}</div>
      ${files.length ? `<div class="lbl">Файлы</div><div class="hint">${files.map(f => esc(f.name || f)).join(' · ')}</div>` : ''}
      <button class="linkbtn" type="button" data-rq="open">Открыть карточку целиком</button></div>
      <div><label class="lbl" for="rq-note">Замечания (обязательно, если вернуть)</label><textarea id="rq-note" rows="7" maxlength="1500" placeholder="Что исправить…"></textarea></div></div>
    <div class="modal-f"><button class="btn primary rq-ok" type="button" data-rq="accept">✓ Принять <span class="kbd">A</span></button><button class="btn" type="button" data-rq="remarks">↩ Вернуть с замечаниями <span class="kbd">R</span></button><span class="spacer"></span>
      <button class="btn ghostbtn" type="button" data-rq="prev"${rq.i ? '' : ' disabled'}>←</button><button class="btn" type="button" data-rq="next">${rq.i < rq.ids.length - 1 ? 'Пропустить →' : 'Готово'}</button></div></div>`;
  root.querySelector('[data-rq="accept"]').focus();
}
async function rqAct(a) {
  if (!rq) return;
  const t = state.tasks.get(rq.ids[rq.i]);
  if (a === 'close') return closeReviewQueue();
  if (a === 'open') { const id = t.id; closeReviewQueue(); return openTask(id); }
  if (a === 'prev') { rq.i--; return renderReviewQueue(); }
  if (a === 'next') { if (rq.i >= rq.ids.length - 1) return closeReviewQueue(); rq.i++; return renderReviewQueue(); }
  if (a === 'accept') { await changeStatus(t.id, QUICK.accept.to, 'принято в очереди проверки'); return renderReviewQueue(); }
  if (a === 'remarks') {
    const note = $('#rq-note').value.trim();
    if (!note) { const n = $('#rq-note'); n.classList.add('field-bad'); n.focus(); toast('Напишите, что исправить, — без замечаний вернуть нельзя.', true); return; }
    await changeStatus(t.id, QUICK.remarks.to, note);
    return renderReviewQueue();
  }
}
document.addEventListener('click', e => { const b = e.target.closest?.('#rq-root [data-rq]'); if (b && !b.disabled) rqAct(b.dataset.rq); else if (e.target.id === 'rq-root') closeReviewQueue(); });
document.addEventListener('keydown', e => {
  if (!rq || !$('#rq-root')) return;
  const typing = e.target.matches?.('textarea, input');
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeReviewQueue(); }
  else if (typing) return;
  else if (e.key === 'ArrowRight') { e.preventDefault(); rqAct('next'); }
  else if (e.key === 'ArrowLeft' && rq.i) { e.preventDefault(); rqAct('prev'); }
  else if (e.key === 'a' || e.key === 'ф' || e.key === 'A' || e.key === 'Ф') { e.preventDefault(); rqAct('accept'); }
  else if (e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К') { e.preventDefault(); $('#rq-note')?.focus(); }
}, true);

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'doc-renew-day': ({ el, id }) => { const p = state.projects.get(id); docRenew(p, (p?.docs || []).find(x => x.id === el.dataset.doc)); },
  'review-queue': () => { openReviewQueue(); },
  'tp-task': ({ el, id }) => { api.windowMain?.({ kind: 'task', id: el.dataset.id }); api.hide?.(); },
  'tp-main': ({ el, id }) => { const c = [...state.chats.values()].find(x => msgUnread(x).length); api.windowMain?.(el.dataset.v === 'msg' && c ? { kind: 'chat', id: c.id } : { kind: 'main', id: el.dataset.v === 'day' ? 'day' : 'open' }); api.hide?.(); },
});

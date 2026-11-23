/* ---------- «Настройки»: one window for everything about the look ---------- */
function openSettings(sec = '') {
  setViewMenu(false);
  let root = document.querySelector('.settings-modal');
  if (!root) {
    root = document.createElement('div');
    root.className = 'modal-back settings-modal';
    root.innerHTML = `<div class="modal wide-modal settings" role="dialog" aria-modal="true" aria-labelledby="stitle"><h2 id="stitle">Настройки</h2><div id="set-body"></div>
      <div class="modal-f"><button class="btn primary" type="button" data-m="close">Готово</button><span class="hint">Настройки вида хранятся на этом компьютере.</span></div></div>`;
    document.body.append(root);
    root.addEventListener('click', e => {
      if (e.target === root || e.target.dataset.m === 'close') { root.remove(); return; }
      setTimeout(renderSettings, 30); // after the global handler applied the change
    });
    root.addEventListener('change', () => setTimeout(renderSettings, 30));
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  }
  renderSettings();
  if (sec) root.querySelector(`[data-sec-id="${sec}"]`)?.scrollIntoView({ block: 'start' });
}
function renderSettings() {
  const body = $('#set-body');
  if (!body) return;
  const top = body.scrollTop;
  const tabs = visibleTabs();
  body.innerHTML = `<section class="set-sec" data-sec-id="view"><h3>Вид и окно</h3>${viewSectionsHtml(true)}<p class="hint">Прозрачность, «поверх окон» и сквозные клики — в меню «Окно» в заголовке.</p></section>
    <section class="set-sec" data-sec-id="tabs"><h3>Порядок вкладок</h3><p class="hint">Вкладки можно и просто перетащить мышью на панели.</p>${tabs.map((x, i) => `<div class="cols-row"><span>${icon(x.id)} ${esc(x.label)}</span><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="-1"${i ? '' : ' disabled'}>↑</button><button class="btn ghostbtn sm" type="button" data-act="tab-move" data-id="${x.id}" data-dir="1"${i < tabs.length - 1 ? '' : ' disabled'}>↓</button></div>`).join('')}
      <button class="btn ghostbtn sm" type="button" data-act="tabs-reset">Как было</button></section>
    <section class="set-sec" data-sec-id="game"><h3>Поощрения</h3><p class="hint">«Принято с первого раза», общая цель проекта и «Спасибо» в обсуждении. Считаются качество и общий результат, а не количество карточек.</p>
      <div class="seg"><button class="btn sm ${game ? 'on' : ''}" type="button" data-act="set-game" data-v="1">Показывать</button><button class="btn sm ${game ? '' : 'on'}" type="button" data-act="set-game" data-v="0">Выключить</button></div></section>
    <section class="set-sec" data-sec-id="ov"><h3>Панели сводки</h3>${ovRowsHtml()}</section>
    ${api.partyKey && A.canSeeOrgs(state.me) ? `<section class="set-sec" data-sec-id="party"><h3>Реквизиты по ИНН</h3><p class="hint">${partyKeyHas === null ? (partyKeyLoad().then(() => { if (document.querySelector('.settings-modal')) renderSettings(); }), 'Проверяем ключ…') : partyKeyHas ? 'Ключ DaData сохранён: в карточке контрагента название, КПП, ОГРН, адрес и руководитель заполняются по ИНН из ЕГРЮЛ.' : 'Введите бесплатный ключ DaData — и в карточке контрагента реквизиты будут заполняться по ИНН из ЕГРЮЛ.'}</p>
      <button class="btn sm" type="button" data-act="party-key">${partyKeyHas ? 'Изменить ключ…' : 'Ввести ключ DaData…'}</button></section>` : ''}
    ${cab?.allowed ? `<section class="set-sec" data-sec-id="cab"><h3>Кабинет заказчика</h3><p class="hint">${cab.local ? '' : cab.configured ? `Подключён: ${esc(cab.url)}${cab.lastSync ? ` · связь ${cabTime(cab.lastSync)}` : ''}${cab.lastError ? ` · <span class="neg">${esc(cab.lastError)}</span>` : ''}` : cab.keyLost ? `<span class="neg">Адрес сервера ${esc(cab.url)} сохранён, а ключ команды из прошлой версии не переносится — откройте настройку кабинета и введите ключ заново.</span>` : 'Не подключён. Заказчик сможет смотреть свой проект в браузере или на телефоне.'}</p>
      ${cab.local ? `<p class="hint">Работает на этом компьютере · для заказчиков в офисе: ${esc(cab.publicUrl)}</p><button class="btn sm" type="button" data-act="cab-local-stop">Остановить</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>`
        : cab.configured ? '<button class="btn sm" type="button" data-act="cab-settings">Изменить подключение…</button>'
        : '<button class="btn primary sm" type="button" data-act="cab-local-start">Запустить на этом компьютере</button><button class="btn ghostbtn sm" type="button" data-act="cab-settings">Подключить к отдельному серверу…</button>'}</section>` : ''}
    ${isSpec() ? '' : `<section class="set-sec" data-sec-id="cols"><h3>Столбцы в таблицах карточек</h3>${colRowsHtml()}</section>`}
    ${tipsClosed.size ? `<section class="set-sec"><h3>Подсказки</h3><p class="hint">Скрыто подсказок: ${tipsClosed.size}.</p><button class="btn ghostbtn sm" type="button" data-act="tips-reset">Показать снова</button></section>` : ''}`;
  body.scrollTop = top;
}
// «⚙ Столбцы» opens right next to the table; headers can also be dragged to a new place.
let colsOpen = false;
// Header drag: drop a column onto another header to put it there.
let colDrag = null;
document.addEventListener('dragstart', e => {
  const th = e.target.closest?.('th[data-col]');
  if (!th) return;
  colDrag = th.dataset.col;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'col:' + colDrag);
  th.classList.add('dragging');
});
document.addEventListener('dragover', e => {
  if (!colDrag) return;
  const th = e.target.closest?.('th[data-col]');
  $$('th.drop-ok').forEach(x => { if (x !== th) x.classList.remove('drop-ok'); });
  if (!th || th.dataset.col === colDrag) return;
  e.preventDefault();
  th.classList.add('drop-ok');
});
document.addEventListener('drop', e => {
  if (!colDrag) return;
  const th = e.target.closest?.('th[data-col]'), from = colDrag;
  colDrag = null;
  if (!th || th.dataset.col === from) return;
  e.preventDefault();
  const all = colOrder().map(c => c.id), fi = all.indexOf(from), ti = all.indexOf(th.dataset.col);
  all.splice(fi, 1);
  all.splice(all.indexOf(th.dataset.col) + (fi < ti ? 1 : 0), 0, from);
  setColPrefs({ order: all });
});
document.addEventListener('dragend', () => { colDrag = null; $$('th.dragging, th.drop-ok').forEach(x => x.classList.remove('dragging', 'drop-ok')); });


// Cards whose responsible person has no direction for some of the marks (e.g. directions were changed later).
// Per responsible person whose directions don't cover the card's marks: [{ user, gaps, text }].
const gapsOf = t => A.ownersOf(t).map(id => state.users?.get(id)).filter(Boolean)
  .map(user => ({ user, gaps: A.profileGaps(user, t) })).filter(x => x.gaps.length)
  .map(x => ({ ...x, text: A.profileMessage(x.user, x.gaps) }));
// Confirmed («всё равно назначить») cards are not repeated as warnings in the overview.
const offProfile = list => list.filter(t => t.status !== 'done' && !t.profileOk && gapsOf(t).length);
const sideProfile = t => {
  const g = gapsOf(t)[0];
  return `<div class="due bad">${esc(g.gaps.map(x => x.mark).join(', '))} — не по профилю</div><div class="hint">${esc(g.user.name)}: нет «${esc([...new Set(g.gaps.map(x => x.direction.label))].join(', '))}»</div>`;
};
const sideMilestone = t => {
  const m = L.milestonesOf(t, state.today).overdue[0];
  return `<div class="due bad">КТ «${esc(m.title || 'без названия')}»</div><div class="num hint">сорвана на ${dayNum(state.today) - dayNum(m.date)} дн.</div>`;
};
const sidePay = t => {
  const pp = L.paymentPlan(t, state.today);
  const docs = [!t.invoiceReceived ? 'счёт не получен' : '', t.status === 'done' && !t.actSigned ? 'акт не подписан' : ''].filter(Boolean).join(' · ');
  return `<div class="due warn num">${money(pp.dueNow)}</div><div class="hint">${esc(docs || 'документы в порядке')}</div>`;
};
const sideNoAct = t => `<div class="due warn">акт не подписан</div><div class="num hint">принято ${fmtDate(L.reviewStats(t, state.today).accepted)}</div>`;
const lastSubmit = t => [...(t.comments || [])].reverse().find(c => c.kind === 'submit');
const sideReview = t => {
  const rs = L.reviewStats(t, state.today), rep = lastSubmit(t);
  return `<div class="due">на проверке${rs.stageSince ? ` ${dayNum(state.today) - dayNum(rs.stageSince)} дн.` : ''}</div><div class="num hint">${rs.rounds ? `круг замечаний ${rs.rounds + 1}` : 'первая сдача'}</div>`
    + (rep ? `<div class="hint rep-line" title="${esc(rep.text)}">${esc(rep.user)}: ${esc(rep.text)}</div>` : '');
};
const sideNew = t => {
  const c = (t.comments || []).at(-1);
  const fresh = c && c.ts > (t.seen?.[state.me?.id] || '') && c.userId !== state.me?.id;
  return fresh ? `<div class="due work">${c.kind === 'submit' ? 'сдано на проверку' : 'комментарий'}</div><div class="hint rep-line">${esc(c.user)}: ${esc(c.text)}</div>`
    : '<div class="due work">поручено вам</div><div class="hint">откройте карточку</div>';
};
const sideAbsence = t => {
  const h = absHits(t)[0];
  return `<div class="due ${h.onFinish ? 'bad' : 'warn'}">${h.onFinish ? 'финиш во время отсутствия' : 'отсутствие в период работы'}</div><div class="hint">${esc(A.absenceText(h))}</div>`;
};
const sideQuiet = t => {
  const d = dayNum(state.today) - dayNum(A.lastActivity(t).slice(0, 10));
  return `<div class="due warn">тишина ${days(d)}</div><div class="hint">последнее: ${fmtDate(A.lastActivity(t).slice(0, 10))}</div>`;
};
function quietSelect() {
  const opt = n => `<option value="${n}"${n === quietDays ? ' selected' : ''}>${n} дн.</option>`;
  return `<label class="hint quiet-sel">без изменений от <select id="quiet-days">${[3, 5, 7, 10, 14, 21].map(opt).join('')}</select></label>`;
}

const sideBlocked = t => {
  const i = L.dependencyIssues(t, state.tasks, state.today)[0];
  return `<div class="due bad">ждёт ${esc(sectionsOf(i.pred).join(', '))}</div><div class="hint">${i.kind === 'overdue' ? 'смежник сорвал срок' : `смежник до ${fmtDate(i.pred.finish)}`}</div>`;
};
// The attention lists feed the header counters, the overview and filters — compute once per data/date change.
let attCache = null;
const attention = () => {
  if (attCache && attCache.tasks === state.tasks && attCache.projects === state.projects && attCache.today === state.today) return attCache.v;
  attCache = { tasks: state.tasks, projects: state.projects, today: state.today, v: L.attention(tasksArr(), state.today) };
  return attCache.v;
};

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'tips-reset': () => { tipsClosed.clear(); saveLocal('tipsClosed', []); renderNow(); },
  'cols-pop': ({ el }) => { colsOpen = !colsOpen; el.closest('.cols-wrap').querySelector('.cols-menu').hidden = !colsOpen; },
  'settings': ({ el }) => { openSettings(el.dataset.sec); },
  'set-backdrop': ({ el }) => { api.setBackdrop?.(el.dataset.v).then(ok => { if (ok === false) toast('Этот фон Windows здесь недоступен — осталась своя прозрачность.', true); }); },
  'set-dock': ({ el }) => { api.setDock?.(el.dataset.v); },
  'nav-pos': ({ el }) => { setNav({ pos: el.dataset.v }); },
  'nav-mini': () => { setNav({ mini: !nav.mini }); },
  'nav-mini-chk': ({ el }) => { setNav({ mini: el.checked }); },
  'set-theme': ({ el }) => { api.setTheme(el.dataset.v); },
});

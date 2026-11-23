/* ---------- customer cabinet (server): publication, access, messages ---------- */
let cab = null;          // view from the main process: { allowed, configured, url, published, messages, lastSync, lastError }
let cabCustomers = null; // customer accounts on the server, loaded when the «Для заказчика» tab is shown
let cabPw = null;        // { name, login, password } — shown once after creating or resetting
let cabLoadErr = '';
const CAB_KINDS = { answer: 'Ответ на запрос', call: 'Просьба перезвонить', urgent: 'Горящий вопрос', question: 'Вопрос', meeting: 'Перенос встречи' };
// The customer's verdict on files sent for approval.
const decisionChip = m => (m?.decision === 'approve' ? ' <span class="chip tone-ok">Согласовано</span>' : m?.decision === 'remarks' ? ' <span class="chip tone-warn">Есть замечания</span>' : '');
const cabTime = ts => { const d = new Date(ts); return Number.isNaN(+d) ? '' : `${fmtDate(ts.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function setCab(v) {
  const unreadBefore = cab?.messages?.filter(m => !m.read).length || 0, countBefore = cab?.messages?.length || 0;
  cab = v;
  if (document.querySelector('.settings-modal')) renderSettings();
  if ($('#org-cab')) renderOrgCabinet();
  if ($('#cab-box')) { renderCabinetBox(); custNav(); if ((cab?.messages?.length || 0) !== countBefore) loadCabCustomers(true); } // «последний вход» moves with new messages
  const unread = cab?.messages?.filter(m => !m.read).length || 0;
  if (state.loaded && (state.tab === 'overview' || unread !== unreadBefore)) render();
}
async function loadCabCustomers(force = false) {
  if (!cab?.configured || (cabCustomers && !force)) return;
  const r = await api.cabinetCustomers();
  cabLoadErr = r.ok ? '' : r.message;
  cabCustomers = r.ok ? r.customers : cabCustomers;
  renderCabinetBox();
  renderOrgCabinet();
}
// Overview: unread messages from customers, urgent ones first.
function cabinetInbox() {
  if (!cab?.allowed) return '';
  const list = cab.messages.filter(m => !m.read).sort((a, b) => (b.kind === 'urgent') - (a.kind === 'urgent') || b.ts.localeCompare(a.ts));
  if (!list.length) return '';
  return `<section class="panel cab-inbox"><div class="panel-h"><h3>От заказчиков</h3><span class="meta">${list.length}</span><span class="spacer"></span><button class="btn ghostbtn sm" type="button" data-act="cab-read-all">Прочитано всё</button></div>
    ${list.slice(0, 20).map(m => `<button class="att cust-alert${m.kind === 'urgent' ? ' urgent' : ''}" type="button" data-act="cab-open-msg" data-id="${esc(m.id)}"><span><b>${esc(CAB_KINDS[m.kind] || 'Сообщение')}${m.requestTitle ? `: ${esc(m.requestTitle)}` : ''}${m.meetingTitle ? `: ${esc(m.meetingTitle)}` : ''}${m.to ? ` → ${esc(m.to)}` : ''}</b><br>${esc(m.text.slice(0, 160))}<br><span class="hint">${esc(m.customerName)} · ${esc(state.projects.get(m.projectId)?.name || m.projectName)}</span></span><span class="r hint">${cabTime(m.ts)}</span></button>`).join('')}</section>`;
}
function renderCabinetBox() {
  const box = $('#cab-box'), id = state.drawer?.id;
  if (!box || !id) return;
  if (!cab?.allowed) { box.innerHTML = ''; return; }
  if (!cab.configured) {
    box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Заказчик открывает свой проект в браузере или на телефоне по логину и паролю, отвечает на запросы, просит перезвонить.</p>
      <div class="cab-row"><button class="btn primary" type="button" data-act="cab-local-start">Запустить кабинет на этом компьютере</button><button class="linkbtn" type="button" data-act="cab-settings">или подключить к отдельному серверу…</button></div></div>`;
    return;
  }
  if (!cabCustomers && !cabLoadErr) loadCabCustomers();
  const pub = cab.published[id];
  const msgs = cab.messages.filter(m => m.projectId === id).slice(0, 10);
  const linked = (cabCustomers || []).filter(c => c.projectIds.includes(id));
  const others = (cabCustomers || []).filter(c => !c.projectIds.includes(id));
  box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3>
    <div class="cab-row">${pub ? `<span class="chip tone-ok">опубликовано</span><span class="hint">с ${cabTime(pub.at)} · после сохранения проекта страница обновляется сама в течение 2 минут</span>` : '<span class="chip tone-idle">не опубликовано</span><span class="hint">Заказчик не видит проект, пока вы его не опубликуете.</span>'}
      <span class="spacer"></span>${pub ? `<button class="btn ghostbtn sm" type="button" data-act="cab-open">Открыть в браузере</button><button class="btn sm" type="button" data-act="cab-unpublish">Снять с публикации</button>` : ''}
      <button class="btn primary sm" type="button" data-act="cab-publish">${pub ? 'Сохранить и обновить сейчас' : 'Сохранить и опубликовать'}</button></div>
    ${cab.local ? `<p class="hint">Кабинет работает на этом компьютере, пока открыт «Пульт». Адрес для заказчиков в офисной сети: ${cab.local.lan.length ? cab.local.lan.map(u => `<code>${esc(u)}</code>`).join(' ') : '<code>нет сети</code>'}. Из интернета этот адрес не откроется — для этого нужен отдельный сервер (см. «Подключить к отдельному серверу»).</p>` : ''}
    ${cab.lastError ? `<p class="neg">${esc(cab.lastError)}</p>` : ''}
    ${cab.insecure ? '<p class="warnv">Сервер открыт по http без шифрования — пароли заказчиков идут открытым текстом. Подключите https (см. инструкцию).</p>' : ''}
    ${cabPw ? `<div class="cab-pw"><b>Доступ для ${esc(cabPw.name)}</b><div>Адрес: <code>${esc(cab.publicUrl || cab.url)}</code></div><div>Логин: <code>${esc(cabPw.login)}</code> · Пароль: <code>${esc(cabPw.password)}</code></div>
      <span class="hint">Пароль показывается один раз — передайте его заказчику. Забудет — нажмите «Новый пароль».</span><div><button class="btn sm" type="button" data-act="cab-pw-copy">Скопировать для заказчика</button><button class="btn ghostbtn sm" type="button" data-act="cab-pw-hide">Скрыть</button></div></div>` : ''}
    <h4>Кто видит проект</h4>
    ${state.orgs?.get(state.projects.get(id)?.customerId) ? `<p class="hint">Заказчик из каталога — ${esc(state.orgs.get(state.projects.get(id).customerId).name)}: входы его контактных лиц и все его проекты — в <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(state.projects.get(id).customerId)}">карточке организации</button>.</p>` : ''}
    ${cabLoadErr ? `<p class="neg">${esc(cabLoadErr)} <button class="linkbtn" type="button" data-act="cab-reload">Повторить</button></p>` : !cabCustomers ? '<p class="hint">Загружаем…</p>' : ''}
    ${linked.length ? `<div class="cab-people">${linked.map(c => `<div class="cab-person"><div class="grow"><b>${esc(c.name)}</b> <span class="hint">${esc(c.login)}</span>${c.disabled ? ' <span class="chip tone-bad">вход закрыт</span>' : ''}<br><span class="hint">${c.lastLoginAt ? 'последний вход ' + cabTime(c.lastLoginAt) : 'ещё не входил'}</span></div>
      <div class="acts"><button class="btn ghostbtn sm" type="button" data-act="cab-reset" data-id="${esc(c.id)}">Новый пароль</button><button class="btn ghostbtn sm" type="button" data-act="cab-toggle" data-id="${esc(c.id)}">${c.disabled ? 'Открыть вход' : 'Закрыть вход'}</button><button class="btn ghostbtn sm" type="button" data-act="cab-unlink" data-id="${esc(c.id)}">Убрать из проекта</button></div></div>`).join('')}</div>`
      : cabCustomers ? '<p class="hint">Пока никто. Добавьте представителя заказчика — программа создаст логин и пароль.</p>' : ''}
    ${cabCustomers ? `<div class="row-in cab-add"><input id="cab-name" placeholder="Имя: Иванов Иван, ООО «Заказчик»" maxlength="120"><input id="cab-login" placeholder="Логин: ivanov" maxlength="80"><button class="btn sm" type="button" data-act="cab-add">Открыть доступ</button></div>
      ${others.length ? `<div class="row-in cab-add"><select id="cab-other"><option value="">— уже есть в кабинете —</option>${others.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.login)})</option>`).join('')}</select><button class="btn sm" type="button" data-act="cab-link">Добавить к проекту</button></div>` : ''}` : ''}
    ${msgs.length ? `<h4>Сообщения от заказчика</h4>${msgs.map(m => { const req = m.requestId && state.draft?.requests.find(r => r.id === m.requestId);
      return `<div class="cab-msg${m.read ? ' read' : ''}${m.kind === 'urgent' ? ' urgent' : ''}"><div><b>${esc(CAB_KINDS[m.kind] || 'Сообщение')}${m.requestTitle ? `: ${esc(m.requestTitle)}` : ''}${m.meetingTitle ? `: ${esc(m.meetingTitle)}` : ''}${m.to ? ` → ${esc(m.to)}` : ''}</b>${decisionChip(m)} <span class="hint">${esc(m.customerName)} · ${cabTime(m.ts)}</span></div><div class="cab-text">${esc(m.text)}</div>
        <div>${m.read ? '' : `<button class="btn ghostbtn sm" type="button" data-act="cab-read" data-id="${esc(m.id)}">Прочитано</button>`}${req && !req.done ? (req.irdId ? `<button class="btn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Принять</button><button class="btn ghostbtn sm" type="button" data-act="cab-remark" data-id="${esc(m.id)}">Вернуть с замечанием</button>` : `<button class="btn ghostbtn sm" type="button" data-act="cab-got" data-id="${esc(m.id)}">Отметить запрос «получено»</button>`) : ''}</div></div>`; }).join('')}` : ''}
  </div>`;
}
async function cabAction(promise, okText) {
  const r = await promise;
  if (!r.ok) { toast(r.message, true); return null; }
  if (okText) toast(okText);
  return r;
}
async function cabPublish() {
  const id = state.drawer?.id;
  if (!id || !(await submitSimple(true))) return;
  await cabAction(api.cabinetPublish(id), 'Опубликовано в кабинете заказчика');
}
async function cabAdd() {
  const id = state.drawer?.id, name = $('#cab-name').value.trim(), login = $('#cab-login').value.trim();
  if (!name || !login) return toast('Укажите имя и логин заказчика.', true);
  if (!/^[a-zA-Z0-9._@-]{3,80}$/.test(login)) return toast('Логин — латиница, цифры, точка, дефис; от 3 знаков.', true);
  const r = await cabAction(api.cabinetCustomerCreate({ name, login, projectIds: [id] }));
  if (!r) return;
  cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  if (!cab.published[id]) toast('Доступ открыт. Не забудьте опубликовать проект — пока заказчик увидит пустой список.');
  await loadCabCustomers(true);
}
async function cabPatch(cid, patch, okText) {
  const r = await cabAction(api.cabinetCustomerUpdate(cid, patch), okText);
  if (r?.password) cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  if (r) await loadCabCustomers(true);
}
const cabCustomer = cid => (cabCustomers || []).find(c => c.id === cid);
async function cabMarkGot(mid) {
  const m = cab.messages.find(x => x.id === mid), r = m && state.draft?.requests.find(x => x.id === m.requestId);
  if (!r) return;
  r.done = true;
  const row = r.irdId && state.draft.ird.find(x => x.id === r.irdId);
  if (row) row.status = 'accepted';
  renderCustomer();
  await api.cabinetRead([mid]);
  toast(row ? `«${row.title}» — принято. Сохраните проект, и заказчик увидит «Принято».` : 'Запрос отмечен «получено» — сохраните проект, и он уйдёт со страницы заказчика.');
}
// The answer does not do: the row gets «Замечание» with the GIP's note, the request stays open for a new answer.
async function cabRemark(mid) {
  const m = cab.messages.find(x => x.id === mid), r = m && state.draft?.requests.find(x => x.id === m.requestId);
  const row = r && state.draft.ird.find(x => x.id === r.irdId);
  if (!row) return;
  const note = await askNote('Вернуть с замечанием', 'Что не так с документом? Заказчик увидит это в исходных данных и в запросе.', row.note || '');
  if (note === null) return;
  row.status = 'remark'; row.note = note; r.why = note || r.why;
  renderCustomer();
  await api.cabinetRead([mid]);
  toast('Замечание записано — сохраните проект, и заказчик увидит его.');
}
// Connection: a separate small dialog (the settings window re-renders on every click and would lose typed text).
function openCabinetSettings() {
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ctitle" novalidate><h2 id="ctitle">Кабинет заказчика</h2>
    <p class="hint">Адрес и ключ команды показывает сервер кабинета при запуске. Ключ хранится на этом компьютере в зашифрованном виде.</p>
    <div class="f"><label for="c-url">Адрес сервера</label><input id="c-url" value="${esc(cab?.url || '')}" placeholder="https://cabinet.example.ru или http://192.168.1.10:8080" maxlength="300"></div>
    <div class="f"><label for="c-key">Ключ команды</label><input id="c-key" type="password" autocomplete="off" placeholder="${cab?.hasKey ? 'сохранён — оставьте пустым, чтобы не менять' : 'длинная строка из окна сервера'}" maxlength="200"></div>
    ${cab?.lastSync ? `<p class="hint">Последняя связь: ${cabTime(cab.lastSync)}</p>` : ''}<p class="neg" id="c-err">${cab?.keyLost ? 'Ключ команды, сохранённый прошлой версией Пульта, не читается — введите его заново.' : ''}</p>
    <div class="modal-f"><button class="btn primary" type="submit">Проверить и сохранить</button>${cab?.configured ? '<button class="btn" type="button" data-m="off">Отключить</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelector('#c-url').focus();
  const save = async (url, key) => {
    const btn = root.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Проверяем…';
    const r = await api.cabinetConfigure({ url, key });
    btn.disabled = false; btn.textContent = 'Проверить и сохранить';
    if (!r.ok) { root.querySelector('#c-err').textContent = r.message; return; }
    close();
    cabCustomers = null; cabLoadErr = '';
    toast(r.off ? 'Кабинет заказчика отключён' : `Кабинет подключён: проектов ${r.projects}, заказчиков ${r.customers}`);
    renderCabinetBox();
  };
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'off') save('', '');
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); save(root.querySelector('#c-url').value.trim(), root.querySelector('#c-key').value.trim()); });
}

// Working documentation rows: chips toggle a suggested mark for a section; own rows; order.
const rdItem = id => (state.draft.composition.rd || []).find(x => x.id === id);
const rdNew = (pdId, mark = '', title = '') => ({ id: Composition.newId(), pdId, mark, title, on: true, code: '', tom: '', note: '', ownerId: '', contractorId: '', taskId: '' });
let confirmCompDel = null;
// Tech card as an in-app reference: the same model (techcard.js) the generator uses for assignments and waves.
const TC_SECS = [['stages', 'Этапы'], ['source', 'Исходные данные'], ['waves', 'Волны ПД'], ['bysec', 'Кто кому что'], ['assign', 'Задания смежникам'], ['rd', 'ПД → РД'], ['summary', 'Сводные разделы']];

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'cab-remark': ({ id }) => { cabRemark(id); },
  'cab-settings': () => { openCabinetSettings(); },
  'cab-local-start': ({ el }) => { el.disabled = true; el.textContent = 'Запускаем…'; api.cabinetLocalStart().then(r => { if (!r.ok) { toast(r.message, true); el.disabled = false; el.textContent = 'Запустить кабинет на этом компьютере'; return; } cabCustomers = null; cabLoadErr = ''; toast(`Кабинет запущен${r.lan[0] ? ` · адрес для заказчиков: ${r.lan[0]}` : ''}`); }); },
  'cab-local-stop': () => { api.cabinetLocalStop().then(r => { if (r.ok) { cabCustomers = null; toast('Кабинет на этом компьютере остановлен. Данные сохранены — при новом запуске всё вернётся.'); } }); },
  'cab-publish': () => { cabPublish(); },
  'cab-unpublish': () => { cabAction(api.cabinetUnpublish(state.drawer?.id), 'Снято с публикации: заказчик больше не видит проект'); },
  'cab-open': () => { api.cabinetOpen(state.drawer?.id); },
  'cab-add': () => { cabAdd(); },
  'cab-link': () => { const cid = $('#cab-other').value, c = cabCustomer(cid); if (c) cabPatch(cid, { projectIds: [...c.projectIds, state.drawer.id] }, `${c.name}: проект добавлен`); },
  'cab-unlink': ({ id }) => { const c = cabCustomer(id); if (c) cabPatch(id, { projectIds: c.projectIds.filter(x => x !== state.drawer.id) }, `${c.name} больше не видит проект`); },
  'cab-reset': ({ id }) => { cabPatch(id, { resetPassword: true }, 'Новый пароль создан, старый больше не действует'); },
  'cab-toggle': ({ id }) => { const c = cabCustomer(id); if (c) cabPatch(id, { disabled: !c.disabled }, c.disabled ? 'Вход открыт' : 'Вход закрыт'); },
  'cab-reload': () => { cabLoadErr = ''; cabCustomers = null; loadCabCustomers(true); },
  'cab-pw-hide': () => { cabPw = null; renderCabinetBox(); renderOrgCabinet(); },
  'cab-pw-copy': () => { if (cabPw) copyText(`Кабинет заказчика: ${cab.publicUrl || cab.url}\nЛогин: ${cabPw.login}\nПароль: ${cabPw.password}`).then(ok => toast(ok ? 'Скопировано — вставьте в письмо или мессенджер' : 'Не удалось скопировать', !ok)); },
  'cab-read': ({ id }) => { api.cabinetRead([id]); },
  'cab-got': ({ id }) => { cabMarkGot(id); },
  'cab-read-all': () => { api.cabinetRead(cab.messages.filter(m => !m.read).map(m => m.id)); },
  'cab-open-msg': ({ id }) => { const m = cab.messages.find(x => x.id === id); if (m) { api.cabinetRead([id]); if (state.projects.has(m.projectId)) openProject(m.projectId, 'cust'); } },
});

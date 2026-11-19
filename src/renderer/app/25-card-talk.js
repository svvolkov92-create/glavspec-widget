/* ---------- card discussion ---------- */
function renderTalk() {
  const box = $('#talk-box'), t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const draft = $('#talk-text')?.value || '', typing = document.activeElement?.id === 'talk-text';
  if (talkEdit && $('#talk-edit')) talkEdit.text = $('#talk-edit').value; // keep the edit through a re-render
  if (talkEdit && !(t.comments || []).some(c => c.id === talkEdit.cid)) talkEdit = null;
  const editingNow = document.activeElement?.id === 'talk-edit';
  const list = t.comments || [];
  const when = ts => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `<div class="talk">${list.length ? list.map(c => `<div class="msg-item${c.userId === state.me?.id ? ' mine' : ''}${c.kind === 'submit' ? ' submit' : ''}">
      <div class="msg-h"><b>${esc(c.user || '—')}</b>${c.kind === 'submit' ? '<span class="chip tone-review">сдал на проверку</span>' : ''}<span class="hint">${when(c.ts)}${c.editedAt ? ' · изменено' : ''}</span>${c.userId === state.me?.id && talkEdit?.cid !== c.id ? `<button class="edit-msg" type="button" data-act="talk-edit" data-cid="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>
      ${talkEdit?.cid === c.id ? `<div class="msg-edit"><textarea id="talk-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(talkEdit.text)}</textarea>
        <div class="row-in"><button class="btn primary sm" type="button" data-act="talk-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="talk-edit-cancel">Отмена</button><span class="hint">Ctrl+Enter — сохранить, Esc — отмена</span></div></div>`
        : `<div class="msg-t">${esc(c.text)}</div>`}${thankBtn(t, c)}</div>`).join('') : '<div class="hint">Обсуждения пока нет. Здесь видят друг друга ответственные по карточке и их руководители.</div>'}</div>
    <div class="talk-new"><textarea id="talk-text" rows="2" maxlength="2000" placeholder="Написать… (Ctrl+Enter — отправить)">${esc(draft)}</textarea>
      <button class="btn primary" type="button" data-act="talk-send">Отправить</button></div>`;
  const tl = box.querySelector('.talk'); tl.scrollTop = tl.scrollHeight;
  if (typing) { const ta = $('#talk-text'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  if (editingNow) { const ta = $('#talk-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
}
// «Спасибо» under a colleague's message: one per person; the author sees the count and it adds up on their card.
function thankBtn(t, c) {
  if (!game) return '';
  const n = (c.thanks || []).length, mine = (c.thanks || []).includes(state.me?.id), own = c.userId === state.me?.id;
  if (own) return n ? `<div class="thanks-row"><span class="thanks-n" title="Вас поблагодарили">♥ спасибо: ${n}</span></div>` : '';
  if (!c.userId) return '';
  return `<div class="thanks-row"><button class="thanks-btn${mine ? ' on' : ''}" type="button" data-act="thank" data-task="${esc(t.id)}" data-cid="${esc(c.id)}" aria-pressed="${mine}" title="${mine ? 'Убрать спасибо' : 'Поблагодарить — например, за помощь или быструю проверку'}">♥ Спасибо${n ? ` · ${n}` : ''}</button></div>`;
}
async function thank(taskId, cid) {
  const res = await api.thankComment(taskId, cid);
  if (!res?.ok) return toast(res?.message || 'Не удалось.', true);
  await refresh();
  renderTalk();
  if (res.on) toast('Спасибо отправлено');
}
// The field is emptied before sending: the card re-renders while the message is saved, and it must not
// come back with the old text. On failure the text is put back.
async function sendComment() {
  const el = $('#talk-text'), id = state.drawer?.id;
  if (!el || !id || !el.value.trim()) return;
  const text = el.value;
  el.value = '';
  const res = await api.addComment(id, text);
  if (!res?.ok) { const cur = $('#talk-text'); if (cur && !cur.value) cur.value = text; return toast(res?.message || 'Не удалось отправить.', true); }
  await refresh();
  renderTalk();
}
// Editing one's own message in a card discussion: inline, Ctrl+Enter saves, Esc cancels.
let talkEdit = null; // { cid, text }
function talkEditStart(cid) {
  const c = (state.tasks.get(state.drawer?.id)?.comments || []).find(x => x.id === cid);
  if (!c || c.userId !== state.me?.id) return;
  talkEdit = { cid, text: c.text };
  renderTalk();
  const ta = $('#talk-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
async function talkEditSave() {
  const ta = $('#talk-edit'), id = state.drawer?.id;
  if (!talkEdit || !ta || !id) return;
  const text = ta.value.trim();
  if (!text) return toast('Сообщение не может быть пустым.', true);
  const res = await api.editComment(id, talkEdit.cid, text);
  if (!res?.ok) return toast(res?.message || 'Не удалось сохранить.', true);
  talkEdit = null;
  await refresh();
  renderTalk();
}
function talkEditCancel() { talkEdit = null; renderTalk(); }

// Status changes are actions (buttons in the card header, the status cell, the kanban), not a free list.
const QUICK = {
  start: { to: 'in_progress', label: 'Начать работу', okMsg: 'Карточка в работе' },
  submit: { to: 'review', label: 'Сдал на проверку', okMsg: 'Отмечено: сдано на проверку' },
  remarks: { to: 'revision', label: 'Выдать замечания', okMsg: 'Замечания выданы — карточка на доработке' },
  accept: { to: 'done', label: 'Принять работу', okMsg: 'Работа принята' },
  pause: { to: 'paused', label: 'Приостановить', okMsg: 'Карточка приостановлена' },
  resume: { to: 'in_progress', label: 'Возобновить', okMsg: 'Работа возобновлена' },
  reopen: { to: 'in_progress', label: 'Вернуть в работу', okMsg: 'Карточка снова в работе' },
};
// Which actions a status offers. A specialist only submits own work.
function quickKeys(status) {
  const map = { not_started: ['start', 'pause'], in_progress: ['submit', 'pause'], revision: ['submit', 'pause'], review: ['accept', 'remarks'], paused: ['resume'], done: ['reopen'] };
  const keys = map[status] || ['start'];
  return isSpec() ? keys.filter(k => k === 'submit' || (k === 'start' && status === 'not_started')) : keys;
}
const quickFor = (from, to) => Object.keys(QUICK).find(k => QUICK[k].to === to && quickKeys(from).includes(k));

function taskMainPanel(t, isNew) {
  const projects = [...state.projects.values()].filter(p => !p.archived || p.id === t.projectId).sort(byName);
  const marks = sectionsOf(t);
  return `
    ${!projects.length ? '<div class="note-box">Сначала добавьте проект — карточка всегда относится к проекту.</div>' : ''}
    <div class="fgrid">
      <div class="f wide"><label class="req" for="t-project">Проект</label><select id="t-project" name="projectId">${selOpts(projects, t.projectId, '— выберите —')}</select></div>
      ${marksField(t)}
      <fieldset class="f wide who-box"><legend>Кто делает</legend>
        <div class="who-grid">
          <div class="f"><label class="req" for="t-owner" title="${A.isGip(state.me) ? 'ГИП может спустить карточку любому главспецу или специалисту.' : A.isChief(state.me) ? 'Главспец спускает карточки только своим специалистам.' : 'Карточку спустил вам руководитель.'}">Ответственный в команде</label><select id="t-owner" name="ownerId">${ownerOptions(t.ownerId || state.me?.id, marks)}</select></div>
          ${execPickerHtml('exec', 'Исполнитель', 'штатный или внештатный', execRefOf(t))}
          ${execPickerHtml('coexec', 'Соисполнитель', 'необязательно', coExecRefOf(t))}
        </div>
        <label class="chk sm-chk exec-fit"><input type="checkbox" id="exec-fit"${loadLocal('execFit', true) ? ' checked' : ''}> Только подходящие по специальности</label>
        ${legacyCoHtml(t)}
        <div class="warnline soft" id="abs-warn" hidden></div>
        <div class="warnline" id="owner-warn" hidden><span id="owner-warn-text"></span>
          <label class="chk"><input type="checkbox" id="t-profile-ok" name="profileOk"${t.profileOk ? ' checked' : ''}> Всё равно назначить</label></div>
      </fieldset>
      <div class="f"><label for="t-start">Старт работ</label><input id="t-start" name="start" type="date" value="${esc(t.start || '')}"></div>
      <div class="f"><label for="t-finish">Плановый финиш</label><input id="t-finish" name="finish" type="date" value="${esc(t.finish || '')}" data-orig="${esc(isNew ? '' : t.finish || '')}"></div>
      <div class="f wide shift" id="shift-box" hidden>
        <div class="shift-h">Срок переносится: <b id="shift-text"></b></div>
        <div class="fgrid">
          <div class="f"><label class="req" for="t-shift-reason">Причина переноса</label><select id="t-shift-reason" name="shiftReason"><option value="">— выберите —</option>${Object.entries(SHIFT_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          <div class="f"><label for="t-shift-note">Комментарий</label><input id="t-shift-note" name="shiftNote" maxlength="200" placeholder="Например: заказчик сменил ТУ"></div>
        </div>
        <span class="hint">Переносы по вине исполнителя не сдвигают его контрольный срок и учитываются в надёжности.</span>
      </div>
      <div class="f"><span class="lbl">Статус</span>${isNew ? `<label class="chk"><input type="checkbox" id="t-start-now" name="startNow"> Сразу в работу</label><input type="hidden" id="t-status" name="status" value="not_started">`
        : `<div class="status-ro">${statusChip(t)}<input type="hidden" id="t-status" name="status" value="${esc(t.status)}"></div><span class="hint">Меняется кнопками в шапке карточки. «Срок сорван» ставится сам.</span>`}</div>
      <div class="f"><label for="t-ready">Готовность, %</label>
        <div class="ready-in"><input type="range" id="t-ready-r" min="${L.READY_MIN}" max="${L.READY_MAX}" step="5" value="${L.readinessManual(t.status) ? L.readiness(t) : L.READY_MIN}" data-transient aria-label="Готовность, ползунок">
          <input id="t-ready" name="readiness" type="number" min="${L.READY_MIN}" max="${L.READY_MAX}" step="1" value="${L.readinessManual(t.status) ? L.readiness(t) : ''}"></div>
        <span class="hint" id="ready-hint"></span></div>
      ${canMoney() ? `<div class="f"><label for="t-budget">Бюджет, ₽</label><input id="t-budget" name="budget" inputmode="decimal" value="${t.budget ? esc(String(t.budget).replace('.', ',')) : ''}" placeholder="150 000"></div>` : ''}
      <details class="f wide more"${t.title || t.note || t.folder ? ' open' : ''}><summary>Дополнительно: уточнение, папка раздела, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="t-title">Уточнение</label><input id="t-title" name="title" value="${esc(t.title || '')}" placeholder="Корпус 2, стадия Р" maxlength="120"></div>
        <div class="f wide"><label for="t-folder">Папка раздела</label>
          <div class="row-in"><input id="t-folder" name="folder" value="${esc(t.folder || '')}" placeholder="\\\\server\\Проекты\\0425-24\\ЭОМ" maxlength="400">
            <button class="btn" data-act="pick-task-folder" type="button">Выбрать…</button>${projectOf(t)?.folder ? '<button class="btn ghostbtn" data-act="suggest-task-folder" type="button" title="Папка проекта + раздел">Из папки проекта</button>' : ''}</div>
          <span class="hint">Чертежи и файлы раздела. Кнопка «📁 Папка» в шапке карточки откроет её в Проводнике.</span></div>
        <div class="f wide"><label for="t-note">Примечание</label><textarea id="t-note" name="note" maxlength="2000">${esc(t.note || '')}</textarea></div>
      </div></details>
      ${taskFilesHtml(t)}
    </div>`;
}
function renderMessage(kind) {
  const box = $('#msg-box');
  const t = state.tasks.get(state.drawer?.id);
  if (!box || !t) return;
  const c = contractorOf(t);
  const M = window.Messages;
  kind = kind || state.msgKind || M.suggest(t, state.today);
  state.msgKind = kind;
  const signature = loadLocal('signature', '');
  const msg = M.build(kind, { task: t, project: projectOf(t), contractor: c, signature, today: state.today });
  const can = { mail: !!c?.email, whatsapp: !!(c?.phone || /whatsapp/i.test(c?.messenger || '')), telegram: !!(c?.phone || /@|t\.me/.test(c?.messenger || '')) };
  box.innerHTML = `${c ? '' : '<div class="note-box">У карточки нет подрядчика — текст можно скопировать, но отправить некому.</div>'}
    <div class="tpl-row">${M.TEMPLATES.map(x => `<button class="btn sm ${x.id === kind ? 'on' : ''}" type="button" data-act="msg-kind" data-kind="${x.id}">${esc(x.label)}</button>`).join('')}</div>
    <div class="f"><label for="msg-subject">Тема (для почты)</label><input id="msg-subject" value="${esc(msg.subject)}" maxlength="200"></div>
    <div class="f"><label for="msg-text">Текст — можно поправить перед отправкой</label><textarea id="msg-text" rows="11">${esc(msg.text)}</textarea></div>
    <div class="f"><label for="msg-sign">Подпись (запоминается)</label><input id="msg-sign" value="${esc(signature)}" maxlength="200" placeholder="С уважением, Иванов И.И., ГС ЭОМ/СС, +7 …"></div>
    <div class="msg-acts">
      <button class="btn primary" data-act="msg-copy" type="button">Копировать текст</button>
      <button class="btn" data-act="msg-send" data-via="mail" type="button" ${can.mail ? '' : 'disabled title="У подрядчика не указана почта"'}>Открыть в почте</button>
      <button class="btn" data-act="msg-send" data-via="whatsapp" type="button" ${can.whatsapp ? '' : 'disabled title="У подрядчика не указан телефон"'}>WhatsApp</button>
      <button class="btn" data-act="msg-send" data-via="telegram" type="button" ${can.telegram ? '' : 'disabled title="Не указан ник Telegram или телефон"'}>Telegram</button>
    </div>
    <span class="hint">В WhatsApp текст подставится сам. В Telegram откроется чат с подрядчиком, а текст будет скопирован — вставьте его Ctrl+V.</span>`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = $('#msg-text');
    if (ta) { ta.focus(); ta.select(); }
    return false;
  }
}
async function sendMessage(via) {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  const text = $('#msg-text').value, subject = $('#msg-subject').value;
  if (via === 'telegram') await copyText(text);
  const res = await api.openContact({ contractorId: t.contractorId, kind: via, subject, text });
  if (!res.ok) return toast(res.message, true);
  toast(via === 'telegram' ? 'Текст скопирован — вставьте его в чат (Ctrl+V)' : via === 'mail' ? 'Письмо открыто в почтовой программе' : 'Открыт WhatsApp');
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'thank': ({ el }) => { thank(el.dataset.task, el.dataset.cid); },
  'msg-kind': ({ el }) => { renderMessage(el.dataset.kind); },
  'msg-copy': () => { copyText($('#msg-text').value).then(ok => toast(ok ? 'Текст скопирован' : 'Текст выделен — нажмите Ctrl+C')); },
  'msg-send': ({ el }) => { el.disabled = true; sendMessage(el.dataset.via).finally(() => { el.disabled = false; }); },
  'talk-send': () => { sendComment(); },
  'talk-edit': ({ el }) => { talkEditStart(el.dataset.cid); },
  'talk-edit-save': () => { talkEditSave(); },
  'talk-edit-cancel': () => { talkEditCancel(); },
});

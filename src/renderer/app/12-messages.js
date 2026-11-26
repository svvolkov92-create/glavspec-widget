/* ---------- messenger (3.8): a dock at the bottom right, a side panel and a window with every chat ----------
   Project chats (GIP and participants, made with the first message), personal chats and group chats without a
   project. «@Фамилия» marks a colleague: their mention counter lights up separately. Written only by main. */
const msg = { mode: 'pill', chatId: '', filter: 'all', drafts: {}, newKind: '', newPick: new Set(), newTitle: '', ac: null, info: false, stick: !!loadLocal('msgStick', false) };
const projectChatId = pid => ('p_' + pid).slice(0, 64);
const surnameOf = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/)[0] || '';
// Chats this user sees: every project chat they may write in (even without messages yet) and their own chats.
function chatsAll() {
  const out = new Map();
  for (const c of state.chats?.values() || []) out.set(c.id, c);
  for (const p of state.projects.values()) {
    if (p.archived || !A.canChat(state.me, p)) continue;
    const id = projectChatId(p.id);
    if (!out.has(id)) out.set(id, { id, kind: 'project', projectId: p.id, messages: [], seen: {}, virtual: true });
  }
  return [...out.values()].filter(c => c.kind !== 'project' || state.projects.has(c.projectId));
}
const chatById = id => chatsAll().find(c => c.id === id);
function chatTitle(c) {
  if (c.kind === 'project') return state.projects.get(c.projectId)?.name || 'Проект';
  if (c.kind === 'direct') return state.users.get((c.members || []).find(id => id !== state.me?.id))?.name || 'Сотрудник';
  return c.title || 'Чат';
}
function chatPeople(c) {
  if (c.kind === 'project') { const p = state.projects.get(c.projectId) || {}; return liveUsers().filter(u => A.canChat(u, { ...p, id: c.projectId })); }
  return liveUsers().filter(u => (c.members || []).includes(u.id));
}
const msgUnread = c => { const me = state.me?.id, seen = c.seen?.[me] || ''; return (c.messages || []).filter(m => m.userId !== me && m.ts > seen); };
const msgMentions = c => msgUnread(c).filter(m => (m.mentions || []).includes(state.me?.id));
function msgTotals() {
  let n = 0, at = 0;
  for (const th of msgThreads()) { n += th.unread; at += th.at; }
  return { n, at };
}
/* Messenger threads. One list for everything that is written to the user: chats (project, personal, group),
   card discussions and messages from customers. Key: a chat id, «t:<task id>» or «c:<project id>». */
const MSG_SECTIONS = [['all', 'Все'], ['cust', 'От заказчиков'], ['proj', 'Проекты'], ['task', 'Задачи'], ['other', 'Прочие'], ['at', '@']];
const taskUnreadN = t => { if (!unread(t)) return 0; const me = state.me?.id, seen = t.seen?.[me] || ''; return Math.max(1, (t.comments || []).filter(c => c.userId !== me && c.ts > seen).length); };
const custMsgs = pid => (cab?.allowed ? cab.messages.filter(m => m.projectId === pid) : []);
function msgThread(key) {
  if (!key || key === 'new') return null;
  if (key.startsWith('t:')) { const t = state.tasks.get(key.slice(2)); return t ? { key, type: 'task', t } : null; }
  if (key.startsWith('c:')) { const pid = key.slice(2), list = custMsgs(pid); return list.length ? { key, type: 'cust', pid, list } : null; }
  const c = chatById(key); return c ? { key, type: 'chat', c } : null;
}
function msgThreads() {
  const me = state.me?.id, out = [];
  for (const c of chatsAll()) {
    const last = (c.messages || []).at(-1);
    out.push({ key: c.id, sec: c.kind === 'project' ? 'proj' : 'other', title: chatTitle(c), icon: chatIcon(c), last: last?.ts || '', unread: msgUnread(c).length, at: msgMentions(c).length,
      prev: last ? `${last.userId === me ? 'Вы' : esc(surnameOf(last.user))}: ${esc(last.text.slice(0, 80))}` : `<span class="hint">${c.kind === 'project' ? 'чат проекта · сообщений нет' : 'сообщений нет'}</span>` });
  }
  for (const t of state.tasks.values()) {
    const last = (t.comments || []).at(-1);
    if (!last) continue;
    out.push({ key: 't:' + t.id, sec: 'task', title: `${marksText(t) || t.title || 'Карточка'} · ${projectOf(t)?.name || ''}`, icon: '<span class="mc-ic task">✎</span>', last: last.ts, unread: taskUnreadN(t), at: 0,
      prev: `${last.userId === me ? 'Вы' : esc(surnameOf(last.user))}: ${esc(String(last.text).slice(0, 80))}` });
  }
  if (cab?.allowed) {
    const byProject = new Map();
    for (const m of cab.messages) { if (!byProject.has(m.projectId)) byProject.set(m.projectId, []); byProject.get(m.projectId).push(m); }
    for (const [pid, list] of byProject) {
      const last = list.reduce((a, b) => (b.ts > a.ts ? b : a));
      const urgent = list.some(m => !m.read && m.kind === 'urgent');
      out.push({ key: 'c:' + pid, sec: 'cust', title: state.projects.get(pid)?.name || last.projectName || 'Проект', icon: `<span class="mc-ic cust${urgent ? ' urgent' : ''}">З</span>`, last: last.ts,
        unread: list.filter(m => !m.read).length, at: 0, urgent, prev: `${esc(last.customerName || 'Заказчик')}: ${esc(CAB_KINDS[last.kind] || '')}${last.text ? ' — ' + esc(last.text.slice(0, 60)) : ''}` });
    }
  }
  return out;
}
// Pinned threads: per user on this computer, shown first in every section.
const msgPins = () => new Set(loadLocal('msgPins:' + (state.me?.id || ''), []));
function msgTogglePin(key) {
  const pins = msgPins();
  if (pins.has(key)) pins.delete(key); else pins.add(key);
  saveLocal('msgPins:' + (state.me?.id || ''), [...pins]);
  renderMsg();
}
const timeOf = ts => (ts.slice(0, 10) === state.today ? ts.slice(11, 16) : fmtDate(ts.slice(0, 10)).slice(0, 5));
// Local time of an ISO stamp (messages are stored in UTC).
const localTs = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
/* ---------- 14: own pictures for projects and chats ---------- */
// Any picture becomes a 64×64 square (cropped to the middle) PNG kept with the project or the chat, so everyone
// sees the same one. A project chat shows its project's picture.
const ICON_OK = v => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length <= 60000;
const imgIcon = (src, cls = '') => `<img class="own-ic ${cls}" src="${esc(src)}" alt="">`;
function pickIcon() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 15 * 1024 * 1024) { toast('Картинка больше 15 МБ — выберите поменьше.', true); return resolve(null); }
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const s = Math.min(img.naturalWidth, img.naturalHeight) || 1;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 64, 64);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/png');
        if (out.length > 60000) out = c.toDataURL('image/jpeg', 0.85);
        resolve(ICON_OK(out) ? out : null);
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Это не картинка, которую можно прочитать.', true); resolve(null); };
      img.src = url;
    };
    inp.click();
  });
}
const projIcon = p => (ICON_OK(p?.icon) ? imgIcon(p.icon, 'proj-ic') : '');
async function setChatIcon(id, pick) {
  const icon = pick ? await pickIcon() : '';
  if (icon === null) return;
  const r = await api.chatUpdate(id, { icon });
  if (!r?.ok) return toast(r?.message || 'Не удалось сохранить значок.', true);
  toast(icon ? 'Значок чата обновлён' : 'Значок чата убран');
  await refresh();
}
// In the project card: the picture goes into the form, saved with «Сохранить» like the other fields.
async function setProjectIconField(pick) {
  const icon = pick ? await pickIcon() : '';
  if (icon === null) return;
  const inp = $('#dform [name="icon"]');
  if (!inp) return;
  inp.value = icon; inp.dispatchEvent(new Event('input', { bubbles: true }));
  const box = $('#pr-icon-box'); if (box) box.innerHTML = icon ? imgIcon(icon, 'proj-ic big') : '<span class="hint">нет</span>';
  $('[data-act="proj-icon-clear"]')?.toggleAttribute('hidden', !icon);
}
const chatIcon = c => {
  const own = c.kind === 'project' ? state.projects.get(c.projectId)?.icon : c.icon;
  if (ICON_OK(own)) return `<span class="mc-ic pic">${imgIcon(own)}</span>`;
  return c.kind === 'project' ? '<span class="mc-ic proj">#</span>' : c.kind === 'direct' ? `<span class="mc-ic ava">${esc(initials(chatTitle(c)))}</span>` : '<span class="mc-ic grp">⁂</span>';
};
// Text with @mentions highlighted (mine stronger).
function msgText(t, c, preview = false) {
  const people = chatPeople(c), meSur = surnameOf(state.me?.name).toLowerCase();
  return cardLinks(esc(t).replace(/@([\p{L}-]+)/gu, (all, w) => { const lw = w.toLowerCase(); const hit = lw === 'все' || people.some(u => surnameOf(u.name).toLowerCase() === lw);
    return hit ? `<b class="mention${lw === meSur || lw === 'все' ? ' me' : ''}">${all}</b>` : all; }), preview);
}
// 12: a card dropped into a chat travels as «[[task:<id>]]»; the reader sees the card and opens it with a click.
// Someone who may not see that card gets «карточка недоступна».
const CARD_TOKEN = /\[\[task:([\w-]{1,64})\]\]/g;
function cardLinks(html, preview = false) {
  return html.replace(CARD_TOKEN, (all, id) => {
    const t = state.tasks.get(id);
    if (!t) return '<span class="msg-card off">карточка недоступна</span>';
    const label = `${marksText(t)} · ${projectOf(t)?.name || ''}`;
    return preview ? `<span class="msg-card">${esc(label)}</span>`
      : `<button class="msg-card" type="button" data-act="open-task" data-id="${esc(id)}" title="Открыть карточку">${icon('tasks')}<span>${esc(label)}</span><span class="hint">${esc(STATUSES[t.status]?.label || '')}</span></button>`;
  });
}
function msgListHtml() {
  const all = msgThreads(), pins = msgPins();
  const sections = MSG_SECTIONS.filter(([k]) => k !== 'cust' || all.some(t => t.sec === 'cust'));
  if (!sections.some(([k]) => k === msg.filter)) msg.filter = 'all';
  const count = k => (k === 'at' ? all.reduce((a, t) => a + t.at, 0) : all.filter(t => k === 'all' || t.sec === k).reduce((a, t) => a + t.unread, 0));
  const tabs = `<div class="mc-tabs" role="tablist">${sections.map(([k, l]) => { const n = count(k); return `<button class="mc-tab${msg.filter === k ? ' on' : ''}" type="button" role="tab" aria-selected="${msg.filter === k}" data-act="msg-filter" data-v="${k}">${l}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>`;
  if (msg.filter === 'at') {
    const hits = chatsAll().flatMap(c => (c.messages || []).filter(m => (m.mentions || []).includes(state.me?.id)).map(m => ({ c, m }))).sort((a, b) => b.m.ts.localeCompare(a.m.ts)).slice(0, 60);
    return tabs + `<div class="mc-list">${hits.map(({ c, m }) => `<button class="mc-item${m.ts > (c.seen?.[state.me.id] || '') ? ' unread' : ''}" type="button" data-act="msg-chat" data-id="${esc(c.id)}">${chatIcon(c)}<span class="mc-body"><span class="mc-top"><b>${esc(chatTitle(c))}</b><span class="hint">${timeOf(localTs(m.ts))}</span></span><span class="mc-prev">${esc(surnameOf(m.user))}: ${msgText(m.text.slice(0, 120), c, true)}</span></span></button>`).join('') || '<p class="hint mc-empty">Вас пока не упоминали.</p>'}</div>`;
  }
  const list = all.filter(t => msg.filter === 'all' || t.sec === msg.filter)
    .sort((a, b) => (b.urgent && b.unread ? 1 : 0) - (a.urgent && a.unread ? 1 : 0) || b.last.localeCompare(a.last) || a.title.localeCompare(b.title, 'ru'));
  const drag = canDetach() ? ' draggable="true" data-doc="chat"' : '';
  const item = t => `<div class="mc-row"><button class="mc-item${t.unread ? ' unread' : ''}${msg.chatId === t.key ? ' sel' : ''}" type="button" data-act="msg-chat" data-id="${esc(t.key)}"${drag}${drag ? ` data-doc-id="${esc(t.key)}" title="${esc(t.title)} — перетащите за пределы окна, чтобы открыть отдельно"` : ''}>${t.icon}<span class="mc-body"><span class="mc-top"><b>${esc(t.title)}</b><span class="hint">${t.last ? timeOf(localTs(t.last)) : ''}</span></span>
      <span class="mc-prev">${t.prev}</span></span>${t.at ? '<i class="mc-at">@</i>' : ''}${t.unread ? `<i class="mc-n${t.urgent ? ' urgent' : ''}">${t.unread}</i>` : ''}</button>
    <button class="mc-pin${pins.has(t.key) ? ' on' : ''}" type="button" data-act="msg-pin" data-id="${esc(t.key)}" aria-pressed="${pins.has(t.key)}" title="${pins.has(t.key) ? 'Открепить' : 'Закрепить сверху'}">${icon('pin')}</button></div>`;
  const pinned = list.filter(t => pins.has(t.key)), rest = list.filter(t => !pins.has(t.key));
  const withMsg = rest.filter(t => t.last), empty = rest.filter(t => !t.last);
  const emptyText = { all: 'Сообщений пока нет.', cust: 'От заказчиков сообщений нет.', proj: 'Чатов проектов нет.', task: 'Обсуждений в карточках пока нет. Они появляются, когда в карточке пишут во вкладке «Обсуждение».', other: 'Личных и групповых чатов нет. «+ Новый чат» — создать.' }[msg.filter];
  return tabs + `<div class="mc-list">${pinned.length ? `<div class="mc-sep">Закреплённые</div>${pinned.map(item).join('')}${withMsg.length || empty.length ? '<div class="mc-sep">Остальные</div>' : ''}` : ''}${withMsg.map(item).join('')}${empty.length ? `<div class="mc-sep">Без сообщений</div>${empty.map(item).join('')}` : ''}${list.length ? '' : `<p class="hint mc-empty">${emptyText}</p>`}</div>`;
}
function msgChatHtml(c) {
  const me = state.me?.id, seen = msg.mark?.id === c.id ? msg.mark.since : (c.seen?.[me] || '');
  const people = chatPeople(c);
  let day = '';
  const rows = (c.messages || []).map(m => {
    const lt = localTs(m.ts), d = lt.slice(0, 10), sep = d !== day ? `<div class="mc-day">${d === state.today ? 'Сегодня' : fmtDate(d)}</div>` : '';
    day = d;
    const out = m.userId === me, tome = (m.mentions || []).includes(me), fresh = !out && m.ts > seen;
    const editing = out && msg.edit?.mid === m.id;
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${tome ? ' tome' : ''}${fresh ? ' fresh' : ''}${m.pending ? ' pending' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(m.user)}</b> <span class="hint">${lt.slice(11, 16)}${m.editedAt ? ' · изменено' : ''}</span>${tome ? ' <span class="chip tone-work">вас упомянули</span>' : ''}${m.pending ? ' <span class="hint pending-t">ждёт отправки</span>' : out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(m.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${msgText(m.text, c)}</div>`}</div>`;
  }).join('');
  const sub = c.kind === 'project' ? `чат проекта · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}` : c.kind === 'direct' ? 'личный чат' : `группа · ${people.length} ${plural(people.length, 'участник', 'участника', 'участников')}`;
  const canEdit = c.kind === 'group' && (c.createdBy === me || A.isGip(state.me));
  const info = msg.info ? `<div class="mc-info">${people.map(u => `<span class="chip tone-idle">${esc(u.name)}${u.id === c.createdBy ? ' · автор' : ''}</span>`).join(' ')}
      ${canEdit ? `<div class="row-in"><select id="mc-add"><option value="">— добавить участника —</option>${liveUsers().filter(u => !people.includes(u)).sort(byName).map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn sm" type="button" data-act="msg-add-member">Добавить</button></div>` : ''}
      ${canEdit ? `<div class="row-in"><span class="hint">Значок чата:</span><button class="btn sm" type="button" data-act="chat-icon" data-id="${esc(c.id)}">Выбрать картинку…</button>${ICON_OK(c.icon) ? `<button class="btn ghostbtn sm" type="button" data-act="chat-icon-clear" data-id="${esc(c.id)}">Убрать</button>` : ''}</div>` : ''}
      ${c.kind === 'group' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-leave">Выйти из чата</button>' : ''}${c.kind === 'project' ? `<button class="btn ghostbtn sm" type="button" data-act="project-page" data-id="${esc(c.projectId)}">Открыть проект</button><span class="hint">Участники проекта меняются на его странице.</span>` : ''}</div>` : '';
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку чатов">←</button>' : ''}${chatIcon(c)}<span class="mc-ht"><b>${esc(chatTitle(c))}</b><span class="hint">${sub}</span></span>
      ${msgPinBtn(c.id)}${winBtn('chat', c.id)}${SOLO || docTabs.includes('chat:' + c.id) ? '' : `<button class="btn ghostbtn sm" type="button" data-act="ws-chat" data-id="${esc(c.id)}" title="Положить чат во вкладки сверху — рядом с проектами и разделами">Во вкладку</button>`}<button class="btn ghostbtn sm" type="button" data-act="msg-info" aria-pressed="${msg.info}">Участники</button></div>${info}
    <div class="mc-msgs" id="mc-msgs">${rows || `<p class="hint mc-empty">Напишите первое сообщение. «@» и фамилия — упомянуть коллегу${c.kind !== 'direct' ? ', «@все» — всех' : ''}.</p>`}</div>
    <div class="mc-compose"><div class="mc-ac" id="mc-ac" hidden></div><textarea id="msg-text" rows="2" maxlength="2000" placeholder="Сообщение… Enter — отправить, Shift+Enter — новая строка, @ — упомянуть">${esc(msg.drafts[c.id] || '')}</textarea><button class="btn primary sm" type="button" data-act="mc-send">Отправить</button></div></div>`;
}
// A card discussion inside the messenger: the same messages as the card's «Обсуждение».
function msgTaskHtml(t) {
  const me = state.me?.id, list = t.comments || [];
  let day = '';
  const rows = list.map(c => {
    const lt = localTs(c.ts), d = lt.slice(0, 10), sep = d !== day ? `<div class="mc-day">${d === state.today ? 'Сегодня' : fmtDate(d)}</div>` : '';
    day = d;
    const out = c.userId === me, editing = out && msg.edit?.mid === c.id;
    return `${sep}<div class="chat-msg ${out ? 'out' : 'in'}${c.kind === 'submit' ? ' submit' : ''}${c.pending ? ' pending' : ''}"><div class="chat-meta"><b>${out ? 'Вы' : esc(c.user || '—')}</b> <span class="hint">${lt.slice(11, 16)}${c.editedAt ? ' · изменено' : ''}</span>${c.kind === 'submit' ? ' <span class="chip tone-review">сдал на проверку</span>' : ''}${c.pending ? ' <span class="hint pending-t">ждёт отправки</span>' : out && !editing ? `<button class="edit-msg" type="button" data-act="mc-edit" data-id="${esc(c.id)}" title="Исправить сообщение">✎</button>` : ''}</div>${editing
      ? `<div class="msg-edit"><textarea id="mc-edit" rows="2" maxlength="2000" aria-label="Исправить сообщение">${esc(msg.edit.text)}</textarea><div class="row-in"><button class="btn primary sm" type="button" data-act="mc-edit-save">Сохранить</button><button class="btn sm" type="button" data-act="mc-edit-cancel">Отмена</button></div></div>`
      : `<div class="chat-text">${cardLinks(esc(c.text))}</div>`}${thankBtn(t, c)}</div>`;
  }).join('');
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку">←</button>' : ''}<span class="mc-ic task">✎</span><span class="mc-ht"><b>${esc(marksText(t) || t.title || 'Карточка')}</b><span class="hint">обсуждение карточки · ${esc(projectOf(t)?.name || '')}</span></span>
      ${msgPinBtn('t:' + t.id)}${winBtn('chat', 't:' + t.id)}<button class="btn ghostbtn sm" type="button" data-act="open-task" data-id="${esc(t.id)}">Открыть карточку</button></div>
    <div class="mc-msgs" id="mc-msgs">${rows || '<p class="hint mc-empty">Сообщений нет.</p>'}</div>
    <div class="mc-compose"><textarea id="msg-text" rows="2" maxlength="2000" placeholder="Сообщение в обсуждение карточки… Enter — отправить, Shift+Enter — новая строка">${esc(msg.drafts['t:' + t.id] || '')}</textarea><button class="btn primary sm" type="button" data-act="mc-send">Отправить</button></div></div>`;
}
// Messages from a project's customer (cabinet): read here, answered by the actions in the project.
// 4.24: the customer chat — the customer writes from the cabinet, the team replies here: the reply goes to the
// project's `custChat` and on to the cabinet right away. Every customer message can be sent on: to the internal
// project chat, into a card's discussion or as a new card «на контроль».
const custReplies = pid => (Array.isArray(state.projects.get(pid)?.custChat) ? state.projects.get(pid).custChat : []);
const canCustReply = pid => !!cab?.allowed && !isSpec() && state.projects.has(pid);
function msgCustHtml(pid, list) {
  const items = [...list.map(m => ({ ts: m.ts, m })), ...custReplies(pid).map(r => ({ ts: r.ts, r }))].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const when = ts => `${fmtDate(localTs(ts).slice(0, 10))} ${localTs(ts).slice(11, 16)}`;
  const can = canCustReply(pid);
  const rows = items.map(({ m, r }) => r
    ? `<div class="chat-msg out cust-reply"><div class="chat-meta"><b>${esc(r.user || 'Команда')}</b> <span class="hint">${when(r.ts)} · ответ в кабинет</span></div><div class="chat-text">${esc(r.text)}</div></div>`
    : `<div class="chat-msg in cust${m.kind === 'urgent' ? ' urgent' : ''}${m.read ? '' : ' fresh'}"><div class="chat-meta"><b>${esc(m.customerName || 'Заказчик')}</b> <span class="hint">${when(m.ts)}</span>
      ${m.kind === 'chat' ? '' : `<span class="chip ${m.kind === 'urgent' ? 'tone-bad' : 'tone-idle'}">${esc(m.viaChat ? 'Вопрос на контроле' : CAB_KINDS[m.kind] || 'Сообщение')}</span>`}${decisionChip(m)}</div>
    ${m.requestTitle || m.meetingTitle || m.to ? `<div class="hint">${esc(m.requestTitle || m.meetingTitle || '')}${m.to ? ` → ${esc(m.to)}` : ''}</div>` : ''}<div class="chat-text">${esc(m.text || '')}</div>
    ${m.kind === 'extend' && m.until && canCustReply(pid) ? `<div class="cust-acts"><button class="btn primary xs" type="button" data-act="cust-extend" data-id="${esc(m.id)}" title="Перенести срок запроса и ответить заказчику в чат">Продлить до ${fmtDate(m.until)}</button></div>` : ''}
    ${m.kind === 'invite' && m.invite ? `<div class="hint">Что увидит: ${esc(CUST_SEE.filter(([k]) => m.invite.see.includes(k)).map(x => x[1]).join(', ') || 'только главную')}</div>${canCustReply(pid) ? `<div class="cust-acts"><button class="btn primary xs" type="button" data-act="cust-invite" data-id="${esc(m.id)}" title="Создать вход в кабинет — логин и пароль покажем здесь">Открыть вход</button></div>` : ''}` : ''}
    ${state.projects.has(pid) ? `<div class="cust-acts"><button class="btn ghostbtn xs" type="button" data-act="cust-fwd" data-id="${esc(m.id)}" title="Переслать в чат проекта — для команды, заказчик его не видит">Во внутренний</button><button class="btn ghostbtn xs" type="button" data-act="cust-card" data-id="${esc(m.id)}" title="Добавить в обсуждение карточки">В карточку</button><button class="btn ghostbtn xs" type="button" data-act="cust-ctl" data-id="${esc(m.id)}" title="Новая карточка с ответственным и сроком">На контроль</button></div>` : ''}</div>`).join('');
  const name = state.projects.get(pid)?.name || list.at(-1)?.projectName || 'Проект';
  return `<div class="mc-chat"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back" aria-label="К списку">←</button>' : ''}<span class="mc-ic cust">З</span><span class="mc-ht"><b>${esc(name)}</b><span class="hint">чат с заказчиком · через кабинет</span></span>
      ${msgPinBtn('c:' + pid)}${winBtn('chat', 'c:' + pid)}${state.projects.has(pid) ? `<button class="btn ghostbtn sm" type="button" data-act="msg-cust-project" data-id="${esc(pid)}" title="Открыть проект: принять исходные данные, ответить, перенести встречу">В проект</button>` : ''}</div>
    <div class="mc-msgs" id="mc-msgs">${rows}</div>
    ${can ? `<div class="mc-compose"><textarea id="msg-text" rows="2" maxlength="2000" placeholder="Ответ заказчику — увидит в чате кабинета. Enter — отправить, Shift+Enter — новая строка">${esc(msg.drafts['c:' + pid] || '')}</textarea><button class="btn primary sm" type="button" data-act="mc-send">Ответить</button></div>`
    : '<p class="hint mc-note">Отвечают заказчику ГИП и главспецы.</p>'}</div>`;
}
async function msgCustSend() {
  const key = msg.chatId, pid = key.slice(2), p = state.projects.get(pid), ta = document.getElementById('msg-text');
  if (!p || !ta || !canCustReply(pid)) return;
  const text = ta.value.trim().slice(0, 2000);
  if (!text) return ta.focus();
  msg.drafts[key] = ''; ta.value = '';
  const entry = { id: newId(), ts: new Date().toISOString(), user: state.me.name, role: A.ROLES[state.me.role]?.label || '', text };
  if (!await write(op.update('projects', pid, { custChat: [...custReplies(pid), entry].slice(-300) }), null, { undo: false })) {
    if (!msg.drafts[key]) { msg.drafts[key] = text; const cur = document.getElementById('msg-text'); if (cur && !cur.value) cur.value = text; }
    return;
  }
  // Published: the cabinet gets it now; otherwise it waits for the project to be published.
  if (!cab?.published?.[pid]) return toast('Ответ сохранён. Проект ещё не опубликован в кабинете — заказчик увидит ответ после публикации («Для заказчика» → «Опубликовать»).');
  const r = await api.cabinetPublish(pid).catch(e => ({ ok: false, message: e?.message }));
  toast(r?.ok ? 'Ответ отправлен в кабинет заказчика' : `Ответ сохранён, в кабинет уйдёт при следующей синхронизации${r?.message ? ': ' + r.message : ''}`, !r?.ok);
}
// 4.25: what a customer's colleague may see — the same keys as the cabinet's «hide».
const CUST_SEE = [['docs', 'документация'], ['q', 'вопросы и решения'], ['chat', 'чат'], ['finance', 'договор и финансы']];
const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
const loginFrom = name => String(name || '').toLowerCase().split(/\s+/)[0].split('').map(c => TRANSLIT[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('').slice(0, 30);
const custQuote = m => `${m.customerName || 'Заказчик'} (${fmtDate(localTs(m.ts).slice(0, 10))}): «${m.text}»`;
const msgPinBtn = key => { const on = msgPins().has(key); return `<button class="btn ghostbtn sm mc-pinbtn${on ? ' on' : ''}" type="button" data-act="msg-pin" data-id="${esc(key)}" aria-pressed="${on}" title="${on ? 'Открепить' : 'Закрепить сверху списка'}">${icon('pin')}</button>`; };
function msgNewHtml() {
  const others = liveUsers().filter(u => u.id !== state.me?.id).sort(byName);
  return `<div class="mc-chat mc-new"><div class="mc-head">${msg.mode === 'side' ? '<button class="btn ghostbtn sm" type="button" data-act="msg-back">←</button>' : ''}<span class="mc-ht"><b>Новый чат</b><span class="hint">личный — с одним человеком, группа — без привязки к проекту</span></span></div>
    <div class="mc-newbody"><div class="seg"><button class="btn sm${msg.newKind !== 'group' ? ' on' : ''}" type="button" data-act="msg-newkind" data-v="direct">Личный</button><button class="btn sm${msg.newKind === 'group' ? ' on' : ''}" type="button" data-act="msg-newkind" data-v="group">Группа</button></div>
    ${msg.newKind === 'group' ? `<div class="f"><label for="mc-title">Название</label><input id="mc-title" maxlength="80" placeholder="Планёрка ГИПов, Котельная — рабочая группа…" value="${esc(msg.newTitle)}"></div><span class="lbl">Участники</span>
      <div class="mc-pick">${others.map(u => `<label class="chk"><input type="checkbox" data-act="msg-pick" value="${esc(u.id)}"${msg.newPick.has(u.id) ? ' checked' : ''}> ${esc(u.name)} <span class="hint">${esc(A.ROLES[u.role]?.label || '')}</span></label>`).join('')}</div>
      <button class="btn primary" type="button" data-act="msg-create">Создать чат${msg.newPick.size ? ` (${msg.newPick.size + 1})` : ''}</button>`
    : `<div class="mc-list">${others.map(u => `<button class="mc-item" type="button" data-act="msg-direct" data-id="${esc(u.id)}"><span class="mc-ic ava">${esc(initials(u.name))}</span><span class="mc-body"><b>${esc(u.name)}</b><span class="hint">${esc(A.ROLES[u.role]?.label || '')}</span></span></button>`).join('')}</div>`}</div></div>`;
}
function renderMsg() {
  let root = document.getElementById('msg-root');
  if (!root) { root = document.createElement('div'); root.id = 'msg-root'; document.body.append(root); }
  if (!state.loaded || !state.me || state.win.compact || SOLO?.kind === 'project') { root.innerHTML = ''; return; }
  const focus = document.activeElement?.id === 'msg-text', caret = focus ? document.activeElement.selectionStart : 0;
  const editFocus = document.activeElement?.id === 'mc-edit';
  if (msg.edit && document.getElementById('mc-edit')) msg.edit.text = document.getElementById('mc-edit').value; // keep the edit through a re-render
  const t = msgTotals(), th = msgThread(msg.chatId), c = th?.type === 'chat' ? th.c : null;
  if (msg.chatId && msg.chatId !== 'new' && !th && msg.mode !== 'solo') msg.chatId = ''; // a chat window keeps waiting for its chat
  const pill = `<button class="msg-fab${t.n ? ' has' : ''}" type="button" data-act="msg-open" title="Сообщения: чаты проектов, личные и групповые">${icon('chat')}<span>Сообщения</span>${t.n ? `<i class="mc-n">${t.n}</i>` : ''}${t.at ? `<i class="mc-at" title="Вас упомянули">@${t.at}</i>` : ''}</button>`;
  if (msg.mode === 'pill') { root.innerHTML = pill; return; } // the floating button opens the side panel; «Сообщения» in the menu — the big window
  const head = `<div class="mp-head"><b>Сообщения</b><span class="spacer"></span><button class="btn sm" type="button" data-act="msg-new">+ Новый чат</button>
    <button class="btn ghostbtn sm msg-stick${msg.stick ? ' on' : ''}" type="button" data-act="msg-stick" aria-pressed="${!!msg.stick}" title="${msg.stick ? 'Окно закреплено: остаётся, пока не закроете. В чат можно перетащить карточку. Нажмите, чтобы открепить' : 'Закрепить окно: не будет сворачиваться при щелчке мимо, в чат можно перетащить карточку'}">${icon('pin')}</button>
    <button class="btn ghostbtn sm" type="button" data-act="msg-size" title="${msg.mode === 'full' ? 'Свернуть в боковую панель' : 'Открыть окно со всеми чатами'}">${msg.mode === 'full' ? '⇲' : '⤢'}</button><button class="btn ghostbtn sm" type="button" data-act="msg-close" aria-label="Свернуть">✕</button></div>`;
  const right = msg.chatId === 'new' ? msgNewHtml() : c ? msgChatHtml(c) : th?.type === 'task' ? msgTaskHtml(th.t) : th?.type === 'cust' ? msgCustHtml(th.pid, th.list) : msg.mode === 'solo' ? '<div class="mc-chat"><p class="hint mc-empty">Разговор недоступен: его удалили или вы больше в нём не участвуете. Это окно можно закрыть.</p></div>' : '<div class="mc-chat"><p class="hint mc-empty">Выберите разговор слева или создайте новый чат.</p></div>';
  const body = msg.mode === 'full' ? `<div class="mp-full"><div class="mp-left">${msgListHtml()}</div><div class="mp-right">${right}</div></div>` : (msg.chatId ? right : msgListHtml());
  const enter = msg.enter ? ' enter' : ''; msg.enter = false; // slide in only when the panel opens, not on every refresh
  if (msg.mode === 'solo') document.documentElement.style.setProperty('--bar-h', `${document.getElementById('bar')?.offsetHeight || 48}px`);
  if (msg.mode === 'solo') root.innerHTML = `<section class="msg-panel solo" aria-label="${esc(threadTitle(msg.chatId))}">${right}</section>`;
  else root.innerHTML = `${msg.mode === 'full' ? `<div class="mp-back${enter}" data-act="msg-close"></div>` : ''}<section class="msg-panel ${msg.mode}${msg.mode === 'full' && msg.max ? ' max' : ''}${enter}" role="dialog" aria-label="Сообщения">${head}${body}</section>`;
  const box = document.getElementById('mc-msgs');
  if (box) box.scrollTop = box.scrollHeight;
  if (focus) { const ta = document.getElementById('msg-text'); if (ta) { ta.focus(); try { ta.setSelectionRange(caret, caret); } catch { /* fine */ } } }
  if (editFocus) { const ta = document.getElementById('mc-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  if (c) msgSeenLater(c);
  if (th?.type === 'task' && unread(th.t)) api.taskSeen(th.t.id);
  if (th?.type === 'cust') { const ids = th.list.filter(m => !m.read).map(m => m.id); if (ids.length) api.cabinetRead?.(ids); }
}
/* ---------- 12: two modes of the messages window ---------- */
// Not pinned: a click anywhere outside folds it to the right (back to the «Сообщения» button).
// Pinned: it stays until closed, and a card dragged from the Kanban, a table or «Люди» into the chat is attached.
document.addEventListener('mousedown', e => {
  if (msg.stick || msg.mode !== 'side' || SOLO) return;
  if (e.target.closest?.('#msg-root, .modal-back, .palette-back, .menu, #toast, .tour, .drawer, #drawer-root')) return;
  msgClose();
}, true);
let msgDragTask = '';
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('[data-kb-id], .ctask[data-move][data-id], tr.row[data-act="open-task"][data-id]');
  msgDragTask = el ? (el.dataset.kbId || el.dataset.id || '') : '';
  if (msgDragTask && el.matches('tr.row')) { e.dataTransfer.setData('text/plain', msgDragTask); e.dataTransfer.effectAllowed = 'copyMove'; }
});
document.addEventListener('dragend', () => { msgDragTask = ''; document.querySelector('.msg-panel.drop-card')?.classList.remove('drop-card'); });
// Table rows become draggable while the messages window is open (otherwise text in them stays selectable).
document.addEventListener('mousedown', e => {
  const row = e.target.closest?.('tr.row[data-act="open-task"][data-id]');
  if (row) row.draggable = msg.mode !== 'pill' && !!msg.chatId && msg.chatId !== 'new';
}, true);
const msgCanTakeCard = () => msgDragTask && msg.mode !== 'pill' && msg.chatId && msg.chatId !== 'new' && !!document.getElementById('msg-text');
document.addEventListener('dragover', e => {
  if (!msgCanTakeCard() || !e.target.closest?.('.msg-panel')) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  e.target.closest('.msg-panel').classList.add('drop-card');
});
document.addEventListener('dragleave', e => { if (e.target.classList?.contains('msg-panel')) e.target.classList.remove('drop-card'); });
document.addEventListener('drop', e => {
  if (!msgCanTakeCard() || !e.target.closest?.('.msg-panel')) return;
  e.preventDefault(); e.stopPropagation();
  e.target.closest('.msg-panel').classList.remove('drop-card');
  msgAttachCard(msgDragTask);
  msgDragTask = '';
}, true);
function msgAttachCard(id) {
  const ta = document.getElementById('msg-text');
  if (!ta || !state.tasks.has(id)) return;
  const tok = `[[task:${id}]]`, at = ta.selectionStart ?? ta.value.length;
  const before = ta.value.slice(0, at), after = ta.value.slice(at);
  ta.value = `${before}${before && !/\s$/.test(before) ? ' ' : ''}${tok} ${after}`.slice(0, 2000);
  msg.drafts[msg.chatId] = ta.value;
  ta.focus();
  toast(`Карточка «${marksText(state.tasks.get(id))}» в сообщении — нажмите «Отправить»`);
}
function msgSeenLater(c) {
  if (msg.mark?.id !== c.id) msg.mark = { id: c.id, since: c.seen?.[state.me?.id] || '' };
  if (!msgUnread(c).length || c.virtual) return;
  clearTimeout(msgSeenLater.t);
  msgSeenLater.t = setTimeout(() => { if (msg.chatId === c.id && msg.mode !== 'pill') api.chatSeen(c.id); }, 900);
}
function msgOpen(chatId = msg.chatId) {
  if (SOLO && !(SOLO.kind === 'chat' && chatId === SOLO.id)) { if (chatId && chatId !== 'new') api.windowMain?.({ kind: 'chat', id: chatId }); return; }
  if (msg.mode === 'pill') { msg.mode = 'side'; msg.enter = true; }
  msg.chatId = chatId; msg.info = false; msg.mark = null; msg.edit = null;
  renderMsg();
  setTimeout(() => document.getElementById('msg-text')?.focus(), 30);
}
async function msgSend() {
  if (msg.chatId.startsWith('t:')) return msgTaskSend();
  if (msg.chatId.startsWith('c:')) return msgCustSend();
  const c = chatById(msg.chatId), ta = document.getElementById('msg-text');
  if (!c || !ta) return;
  const text = ta.value.trim();
  if (!text) return ta.focus();
  // Emptied before sending: the panel re-renders from the draft while the message is saved.
  msg.drafts[c.id] = '';
  ta.value = '';
  const r = await api.chatSend(c.id, text, c.kind === 'project' ? c.projectId : undefined);
  if (!r?.ok) {
    if (!msg.drafts[c.id]) { msg.drafts[c.id] = text; const cur = document.getElementById('msg-text'); if (cur && !cur.value) cur.value = text; }
    return toast(r?.message || 'Не отправлено', true);
  }
  await refresh();
}
async function msgTaskSend() {
  const key = msg.chatId, id = key.slice(2), ta = document.getElementById('msg-text');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) return ta.focus();
  msg.drafts[key] = ''; ta.value = '';
  const r = await api.addComment(id, text);
  if (!r?.ok) {
    if (!msg.drafts[key]) { msg.drafts[key] = text; const cur = document.getElementById('msg-text'); if (cur && !cur.value) cur.value = text; }
    return toast(r?.message || 'Не отправлено', true);
  }
  await refresh();
}
const threadMessages = () => { const th = msgThread(msg.chatId); return th?.type === 'chat' ? th.c.messages || [] : th?.type === 'task' ? th.t.comments || [] : []; };
// Editing one's own message: inline, Enter saves, Esc cancels; mentions are re-read from the new text.
function mcEditStart(mid) {
  const m = threadMessages().find(x => x.id === mid);
  if (!m || m.userId !== state.me?.id) return;
  msg.edit = { mid, text: m.text };
  renderMsg();
  const ta = document.getElementById('mc-edit'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
async function mcEditSave() {
  const th = msgThread(msg.chatId), ta = document.getElementById('mc-edit');
  if (!th || !msg.edit || !ta) return;
  const text = ta.value.trim();
  if (!text) return toast('Сообщение не может быть пустым.', true);
  const r = th.type === 'task' ? await api.editComment(th.t.id, msg.edit.mid, text) : await api.chatEdit(th.c.id, msg.edit.mid, text);
  if (!r?.ok) return toast(r?.message || 'Не удалось сохранить.', true);
  msg.edit = null;
  await refresh();
}
function mcEditCancel() { msg.edit = null; renderMsg(); }
// Closing slides the panel out to the right (when animations are on).
function msgClose() {
  if (msg.mode === 'pill' || msg.mode === 'solo') return; // a chat window closes with its own ✕
  leaveAnimated(document.querySelector('#msg-root .mp-back'), document.querySelector('#msg-root .msg-panel'));
  msg.mode = 'pill'; msg.max = false;
  renderMsg();
}
// 4.12: «Сообщения» in the menu — the messenger over the whole window, list of chats on the left.
function msgFull() {
  if (SOLO) return;
  document.documentElement.style.setProperty('--bar-h', `${document.getElementById('bar')?.offsetHeight || 48}px`);
  if (msg.mode === 'full' && msg.max) return msgClose();
  msg.mode = 'full'; msg.max = true; msg.enter = true;
  renderMsg();
}
// «@» autocomplete: the chat's people by surname; Enter/Tab or a click inserts «@Фамилия ».
function msgAutocomplete(ta) {
  const box = document.getElementById('mc-ac'), c = chatById(msg.chatId);
  const m = ta.value.slice(0, ta.selectionStart).match(/(^|\s)@([\p{L}-]*)$/u);
  if (!box || !c || !m) { if (box) box.hidden = true; msg.ac = null; return; }
  const q = m[2].toLowerCase();
  const list = [...(c.kind !== 'direct' ? [{ id: '*', name: 'все', label: 'Все участники чата' }] : []), ...chatPeople(c).filter(u => u.id !== state.me?.id).map(u => ({ id: u.id, name: surnameOf(u.name), label: u.name }))]
    .filter(u => u.name.toLowerCase().startsWith(q) || u.label.toLowerCase().includes(q)).slice(0, 8);
  if (!list.length) { box.hidden = true; msg.ac = null; return; }
  msg.ac = { list, sel: 0, from: ta.selectionStart - m[2].length - 1 };
  box.innerHTML = list.map((u, i) => `<button type="button" class="${i ? '' : 'sel'}" data-act="msg-ac" data-i="${i}">@${esc(u.name)} <span class="hint">${esc(u.label)}</span></button>`).join('');
  box.hidden = false;
}
function msgAcPick(i) {
  const ta = document.getElementById('msg-text'), a = msg.ac;
  if (!ta || !a || !a.list[i]) return;
  const ins = '@' + a.list[i].name + ' ';
  ta.value = ta.value.slice(0, a.from) + ins + ta.value.slice(ta.selectionStart);
  const pos = a.from + ins.length;
  ta.focus(); ta.setSelectionRange(pos, pos);
  msg.drafts[msg.chatId] = ta.value;
  document.getElementById('mc-ac').hidden = true; msg.ac = null;
}
// A fresh mention of me since the last data: a toast that opens that chat.
let mentionSeenTs = null;
// 4.12.2: personal messages and those where I was tagged (@) go to Windows notifications too — when the window is
// not in front (notifyMe decides), with «Открыть» leading to the chat. The first run only takes the mark.
function chatToastNotify() {
  const me = state.me?.id;
  if (!me || SOLO) return;
  const key = 'chatToast.' + me, mark = loadLocal(key, '');
  const hits = chatsAll().flatMap(c => msgUnread(c).filter(m => m.ts > mark && (c.kind === 'direct' || (m.mentions || []).includes(me))).map(m => ({ c, m })))
    .sort((a, b) => a.m.ts.localeCompare(b.m.ts));
  const top = hits.at(-1)?.m.ts || '';
  if (!mark) { saveLocal(key, top || new Date().toISOString()); return; }
  if (!hits.length) return;
  saveLocal(key, top);
  const one = ({ c, m }) => (c.kind === 'direct' ? `${m.user || chatTitle(c)}: ${m.text}` : `@ ${m.user || ''} в «${chatTitle(c)}»: ${m.text}`).replace(/\s+/g, ' ').slice(0, 160);
  const chats = [...new Set(hits.map(h => h.c.id))];
  api.notifyMe?.(hits.length === 1 ? one(hits[0]) : `Сообщения (${hits.length}): ${hits.slice(-3).map(one).join('; ')}`.slice(0, 240), chats.length === 1 ? `chat:${chats[0]}` : 'msgs');
}
function msgNotify() {
  const me = state.me?.id;
  if (!me) return;
  const hits = chatsAll().flatMap(c => msgMentions(c).map(m => ({ c, m }))).sort((a, b) => b.m.ts.localeCompare(a.m.ts));
  const top = hits[0]?.m.ts || '';
  if (mentionSeenTs !== null && top > mentionSeenTs && !focus && !(msg.mode !== 'pill' && msg.chatId === hits[0].c.id)) toast(`@ ${hits[0].m.user} — «${chatTitle(hits[0].c)}»: ${hits[0].m.text.slice(0, 90)}`);
  mentionSeenTs = top > (mentionSeenTs || '') ? top : (mentionSeenTs ?? top);
}

const memberIds = p => (Array.isArray(p.members) ? p.members : []).filter(id => state.users.has(id) && !state.users.get(id).deletedAt);

const ptTable = rows => `<div class="tablewrap"><table class="pt-t"><thead><tr><th>Раздел</th><th>Обозначение</th><th>Ответственный</th><th>Срок</th><th>Готовность</th><th>Статус</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

// «В работе» — started and not handed in (in progress, on revision); «не начато» — not started or paused.
const taskCounts = list => ({ work: list.filter(t => ['in_progress', 'revision'].includes(t.status)).length, idle: list.filter(t => ['not_started', 'paused'].includes(t.status)).length });
// Blocks of the project page that are not its documentation (source data, letters).
const auxBlock = (...a) => ptBlock(...a).replace('class="panel pt-block', 'class="panel pt-block pt-aux');

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'msg-open-any': () => { msgOpen(); },
  'msg-open': () => { msgOpen(); },
  'msg-close': () => { msgClose(); },
  'msg-size': () => { msg.mode = msg.mode === 'full' ? 'side' : 'full'; msg.max = false; renderMsg(); },
  'msg-full': () => { msgFull(); },
  'msg-stick': () => { msg.stick = !msg.stick; saveLocal('msgStick', msg.stick); renderMsg(); toast(msg.stick ? 'Окно сообщений закреплено — перетащите карточку в чат, чтобы отправить её' : 'Окно сообщений свернётся при щелчке мимо'); },
  'msg-chat': ({ id }) => { msgOpen(id); },
  'msg-back': () => { msg.chatId = ''; renderMsg(); },
  'msg-filter': ({ el }) => { msg.filter = el.dataset.v; renderMsg(); },
  'msg-pin': ({ id }) => { msgTogglePin(id); },
  'msg-cust-project': ({ id }) => { msgClose(); openProject(id, 'cust'); },
  'mc-send': () => { msgSend(); },
  // 4.24: a customer message sent on.
  'cust-fwd': async ({ id }) => {
    const m = cab?.messages.find(x => x.id === id), p = m && state.projects.get(m.projectId);
    if (!p) return;
    if (!A.canChat(state.me, p)) return toast('Чат этого проекта вам не открыт.', true);
    const chatId = projectChatId(p.id), r = await api.chatSend(chatId, `Пишет заказчик — ${custQuote(m)}`.slice(0, 2000), p.id);
    if (!r?.ok) return toast(r?.message || 'Не отправлено', true);
    await refresh(); msg.chatId = chatId; renderMsg(); toast('Переслано в чат проекта');
  },
  'cust-card': ({ id }) => {
    const m = cab?.messages.find(x => x.id === id);
    const list = m ? tasksArr().filter(t => t.projectId === m.projectId && t.kind !== 'assign' && t.status !== 'done').sort(sortByDeadline) : [];
    if (!list.length) return toast('В проекте нет открытых карточек — поставьте сообщение «На контроль».');
    const { q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="cc-t" novalidate><h2 id="cc-t">В обсуждение карточки</h2>
      <p class="hint">${esc(custQuote(m).slice(0, 200))}</p><div class="f"><label for="cc-task">Карточка</label><select id="cc-task">${list.map(t => `<option value="${esc(t.id)}">${esc(marksText(t))}${t.title ? ' · ' + esc(t.title) : ''}</option>`).join('')}</select></div>
      <div class="modal-f"><button class="btn primary" type="submit">Добавить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const tid = q('#cc-task').value; close();
      const r = await api.addComment(tid, `Пишет заказчик — ${custQuote(m)}`.slice(0, 2000));
      if (!r?.ok) return toast(r?.message || 'Не добавлено', true);
      await refresh(); toast('Добавлено в обсуждение карточки');
    });
  },
  // 4.25: «Нужно время» — move the request's deadline and say so in the chat.
  'cust-extend': async ({ id }) => {
    const m = cab?.messages.find(x => x.id === id), p = m && state.projects.get(m.projectId);
    if (!p || !canCustReply(p.id)) return;
    const r = (p.requests || []).find(x => x.id === m.requestId);
    if (!r) return toast('Этого запроса больше нет в проекте.', true);
    const note = { id: newId(), ts: new Date().toISOString(), user: state.me.name, role: A.ROLES[state.me.role]?.label || '', text: `Срок «${r.title}» продлён до ${fmtDate(m.until)}.` };
    if (!await write(op.update('projects', p.id, { requests: p.requests.map(x => x.id === r.id ? { ...x, due: m.until } : x), custChat: [...custReplies(p.id), note].slice(-300) }), `Срок «${r.title}» → ${fmtDate(m.until)}`)) return;
    if (cab?.published?.[p.id]) await api.cabinetPublish(p.id).catch(() => null);
    toast(`Срок продлён до ${fmtDate(m.until)}, заказчику ответили в чат`);
  },
  // 4.25: «Пригласить коллегу» — the GIP opens the login; the password is shown once, to pass on.
  'cust-invite': async ({ id }) => {
    const m = cab?.messages.find(x => x.id === id), inv = m?.invite;
    if (!inv || !canCustReply(m.projectId)) return;
    await loadCabCustomers();
    const from = (cabCustomers || []).find(c => c.id === m.customerId);
    const projectIds = from?.projectIds?.length ? from.projectIds : [m.projectId];
    const { root, q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ci-t" novalidate><h2 id="ci-t">Вход в кабинет для коллеги заказчика</h2>
      <p class="hint">Просит ${esc(m.customerName || 'заказчик')}${inv.contact ? ` · связь: ${esc(inv.contact)}` : ''}. Проекты — как у него: ${projectIds.length}.</p>
      <div class="f"><label for="ci-name">Имя</label><input id="ci-name" maxlength="120" value="${esc(inv.name)}"></div>
      <div class="f"><label for="ci-login">Логин</label><input id="ci-login" maxlength="80" value="${esc(loginFrom(inv.name))}"></div>
      <div class="f"><label for="ci-role">Роль</label><input id="ci-role" maxlength="60" value="${esc(inv.role)}"></div>
      <fieldset class="f"><legend>Что увидит</legend>${CUST_SEE.map(([k, l]) => `<label class="chk"><input type="checkbox" data-see="${k}"${inv.see.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
      <div class="err" id="ci-err" hidden></div><div class="modal-f"><button class="btn primary" type="submit">Открыть вход</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`);
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const name = q('#ci-name').value.trim(), login = q('#ci-login').value.trim().toLowerCase();
      if (!name) return modalErr(root, '#ci-err', 'Укажите имя.', '#ci-name');
      if (!/^[a-z0-9._@-]{3,80}$/.test(login)) return modalErr(root, '#ci-err', 'Логин — латиница, цифры, точка, дефис; от 3 знаков.', '#ci-login');
      const hide = CUST_SEE.map(x => x[0]).filter(k => !q(`[data-see="${k}"]`).checked);
      const r = await api.cabinetCustomerCreate({ name, login, projectIds, role: q('#ci-role').value.trim(), hide });
      if (!r?.ok) return modalErr(root, '#ci-err', r?.message || 'Не получилось.', '#ci-login');
      cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
      cabCustomers = null; close();
      const text = `Кабинет заказчика: ${cab.publicUrl || cab.url}\nЛогин: ${cabPw.login}\nПароль: ${cabPw.password}`;
      const done = openModal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cd-t"><h2 id="cd-t">Вход открыт: ${esc(name)}</h2>
        <p class="hint">Передайте ${inv.contact ? esc(inv.contact) : 'коллеге заказчика'} — пароль больше не покажем (можно сбросить в «Для заказчика»).</p><pre class="cab-pw-text">${esc(text)}</pre>
        <div class="modal-f"><button class="btn primary" type="button" data-copy>Скопировать</button><button class="btn" type="button" data-m="close">Готово</button></div></div>`);
      done.q('[data-copy]').addEventListener('click', async () => toast(await copyText(text) ? 'Скопировано' : 'Не скопировалось — выделите текст', false));
    });
  },
  'cust-ctl': ({ id }) => {
    const m = cab?.messages.find(x => x.id === id);
    if (!m || !state.projects.has(m.projectId)) return;
    msgClose();
    openTask(null, { projectId: m.projectId, draft: { title: `Заказчик: ${m.text.replace(/\s+/g, ' ').slice(0, 100)}`, note: custQuote(m).slice(0, 2000), finish: addDays(todayStr(), 1) } });
  },
  'mc-edit': ({ id }) => { mcEditStart(id); },
  'mc-edit-save': () => { mcEditSave(); },
  'mc-edit-cancel': () => { mcEditCancel(); },
  'msg-info': () => { msg.info = !msg.info; renderMsg(); },
  'chat-icon': ({ id, act }) => { setChatIcon(id, act === 'chat-icon'); },
  'chat-icon-clear': ({ id, act }) => { setChatIcon(id, act === 'chat-icon'); },
  'proj-icon': ({ act }) => { setProjectIconField(act === 'proj-icon'); },
  'proj-icon-clear': ({ act }) => { setProjectIconField(act === 'proj-icon'); },
  'msg-project': ({ id }) => { msgOpen(projectChatId(id)); },
  'msg-new': () => { msg.chatId = 'new'; msg.newKind = 'direct'; if (msg.mode === 'pill') { msg.mode = 'side'; msg.enter = true; } renderMsg(); },
  'msg-newkind': ({ el }) => { msg.newKind = el.dataset.v; renderMsg(); },
  'msg-pick': ({ el }) => { if (el.checked) msg.newPick.add(el.value); else msg.newPick.delete(el.value); msg.newTitle = $('#mc-title')?.value || msg.newTitle; renderMsg(); },
  'msg-ac': ({ el }) => { msgAcPick(Number(el.dataset.i)); },
  'msg-direct': ({ id }) => { api.chatDirect(id).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); await refresh(); msgOpen(r.id); }); },
  'msg-create': () => { const title = ($('#mc-title')?.value || '').trim(); api.chatCreate({ title, members: [...msg.newPick] }).then(async r => { if (!r?.ok) return toast(r?.message || 'Ошибка', true); msg.newPick = new Set(); msg.newTitle = ''; await refresh(); msgOpen(r.id); toast(`Чат «${title}» создан`); }); },
  'msg-add-member': () => { const c = chatById(msg.chatId), uid = $('#mc-add')?.value; if (c && uid) api.chatUpdate(c.id, { members: [...(c.members || []), uid] }).then(r => (r?.ok ? refresh() : toast(r?.message || 'Ошибка', true))); },
  'msg-leave': () => { const c = chatById(msg.chatId); if (c) confirmBox(`Выйти из чата «${chatTitle(c)}»? Вернуть может автор чата.`, 'Выйти').then(ok => ok && api.chatLeave(c.id).then(() => { msg.chatId = ''; refresh(); })); },
});

'use strict';
// Messenger rules shared by the Electron main process and the Tauri window: project, personal and group chats,
// @mentions, sending and correcting messages, membership, sample chats. Only these functions write the chats
// collection (generic writes to it are refused by the access rules).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createChats = factory;
})(typeof self !== 'undefined' ? self : this, function createChats(deps) {
  const { store, A } = deps;
  const currentUser = () => deps.currentUser();
  const changed = deps.changed || (() => {});

  const projectChatId = pid => ('p_' + pid).slice(0, 64);
  const surname = name => String(name || '').replace(/^Пример:\s*/, '').split(/\s+/)[0] || '';
  // Who is in a chat: a project's participants and every GIP; personal and group chats — their member list.
  function chatMembers(chat) {
    const users = Object.entries(store.data.users).filter(([, u]) => !u.deletedAt);
    if (chat.kind === 'project') {
      const p = store.data.projects[chat.projectId] || {};
      return users.filter(([id, u]) => u.role === 'gip' || (p.members || []).includes(id)).map(([id, u]) => ({ id, name: u.name }));
    }
    return users.filter(([id]) => (chat.members || []).includes(id)).map(([id, u]) => ({ id, name: u.name }));
  }
  // «@Белова» (surname, any case) marks that member; «@все» — everyone in the chat.
  function mentionsIn(text, members) {
    const words = new Set([...String(text).matchAll(/@([\p{L}-]+)/gu)].map(x => x[1].toLowerCase().replace(/ё/g, 'е')));
    if (words.has('все')) return members.map(m => m.id);
    return members.filter(m => words.has(surname(m.name).toLowerCase().replace(/ё/g, 'е'))).map(m => m.id);
  }
  const liveMemberIds = (list, meId) => [...new Set([meId, ...(Array.isArray(list) ? list : [])])].filter(id => typeof id === 'string' && store.data.users[id] && !store.data.users[id].deletedAt).slice(0, 100);
  // 3.6 kept the project chat inside the project; since 3.8 it is a record of the chats collection.
  function migrateProjectChats() {
    for (const [id, p] of Object.entries(store.data.projects)) {
      if (!Array.isArray(p.chat) && !p.chatSeen) continue;
      const cid = projectChatId(id), { chat, chatSeen, ...rest } = p;
      if (Array.isArray(chat) && chat.length && !store.data.chats[cid]) {
        const messages = chat.map(m => ({ id: m.id, ts: m.ts, userId: m.userId, user: m.user, text: m.text, mentions: Array.isArray(m.to) ? m.to : [] }));
        store.apply({ type: 'set', col: 'chats', id: cid, data: { kind: 'project', projectId: id, messages, seen: chatSeen || {}, lastTs: messages.at(-1)?.ts || '', createdAt: messages[0]?.ts || '', ...(p.demo ? { demo: true } : {}) } });
      }
      store.apply({ type: 'set', col: 'projects', id, data: rest });
    }
  }

  // Messenger (3.8): project chats (GIP and participants), personal chats and group chats without a project.
  // Written only here; the renderer cannot write the chats collection directly.
  function send(chatId, text, projectId) {
    const me = currentUser();
    const body = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
    if (!me) return { ok: false, message: 'Не выбран пользователь.' };
    if (!body) return { ok: false, message: 'Напишите сообщение.' };
    let chat = store.data.chats[chatId];
    if (!chat && typeof projectId === 'string' && chatId === projectChatId(projectId)) chat = { kind: 'project', projectId, messages: [], seen: {}, createdAt: new Date().toISOString() };
    if (!chat || !A.canSeeChat(me, chat, store.snapshot().projects)) return { ok: false, message: 'Этот чат вам недоступен.' };
    const now = new Date().toISOString();
    const msg = { id: now.replace(/\D/g, '') + Math.random().toString(36).slice(2, 6), ts: now, userId: me.id, user: me.name, text: body, mentions: mentionsIn(body, chatMembers(chat)).filter(id => id !== me.id) };
    let messages = [...(chat.messages || []), msg];
    while (messages.length > 20 && JSON.stringify(messages).length > 200 * 1024) messages = messages.slice(1); // the store keeps a record under 256 KB
    store.apply({ type: 'set', col: 'chats', id: chatId, data: { ...chat, messages, seen: { ...(chat.seen || {}), [me.id]: now }, lastTs: now } });
    changed();
    return { ok: true, mentions: msg.mentions.length };
  }

  // Only the author edits their message; mentions are read again from the new text.
  function edit(chatId, msgId, text) {
    const me = currentUser(), chat = typeof chatId === 'string' ? store.data.chats[chatId] : null;
    const body = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
    if (!me || !chat || !A.canSeeChat(me, chat, store.snapshot().projects)) return { ok: false, message: 'Этот чат вам недоступен.' };
    if (!body) return { ok: false, message: 'Сообщение не может быть пустым.' };
    const messages = (chat.messages || []).map(m => ({ ...m }));
    const m = messages.find(x => x.id === msgId);
    if (!m) return { ok: false, message: 'Сообщение не найдено.' };
    if (m.userId !== me.id) return { ok: false, message: 'Исправить можно только своё сообщение.' };
    if (m.text === body) return { ok: true };
    Object.assign(m, { text: body, editedAt: new Date().toISOString(), mentions: mentionsIn(body, chatMembers(chat)).filter(id => id !== me.id) });
    store.apply({ type: 'update', col: 'chats', id: chatId, data: { messages } });
    changed();
    return { ok: true };
  }

  function seen(chatId) {
    const me = currentUser(), chat = store.data.chats[chatId];
    if (!me || !chat || !A.canSeeChat(me, chat, store.snapshot().projects)) return { ok: true };
    const last = (chat.messages || []).at(-1);
    if (!last || (chat.seen?.[me.id] || '') >= last.ts) return { ok: true };
    store.apply({ type: 'update', col: 'chats', id: chatId, data: { seen: { ...(chat.seen || {}), [me.id]: new Date().toISOString() } } });
    changed();
    return { ok: true };
  }

  // Personal chat with one colleague: one per pair, made on first open.
  function direct(uid) {
    const me = currentUser(), other = store.data.users[uid];
    if (!me || !other || other.deletedAt || uid === me.id) return { ok: false, message: 'Сотрудник не найден.' };
    const id = 'd_' + [me.id, uid].sort().join('_');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, message: 'Не удалось создать чат.' };
    if (!store.data.chats[id]) { store.apply({ type: 'set', col: 'chats', id, data: { kind: 'direct', members: [me.id, uid].sort(), messages: [], seen: {}, createdBy: me.id, createdAt: new Date().toISOString() } }); changed(); }
    return { ok: true, id };
  }

  // Group chat with no project: a title and members; its author changes them.
  function create(input) {
    const me = currentUser();
    if (!me) return { ok: false, message: 'Не выбран пользователь.' };
    const title = String(input?.title || '').trim().slice(0, 80);
    const members = liveMemberIds(input?.members, me.id);
    if (!title) return { ok: false, message: 'Назовите чат.' };
    if (members.length < 2) return { ok: false, message: 'Добавьте хотя бы одного участника.' };
    const id = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    store.apply({ type: 'set', col: 'chats', id, data: { kind: 'group', title, members, messages: [], seen: {}, createdBy: me.id, createdAt: new Date().toISOString() } });
    changed();
    return { ok: true, id };
  }

  function update(chatId, input) {
    const me = currentUser(), chat = store.data.chats[chatId];
    if (!me || !chat || chat.kind !== 'group' || !chat.members.includes(me.id)) return { ok: false, message: 'Чат не найден.' };
    if (chat.createdBy !== me.id && !A.isGip(me)) return { ok: false, message: 'Название и участников меняет автор чата.' };
    const title = String(input?.title ?? chat.title).trim().slice(0, 80) || chat.title;
    const members = input?.members ? liveMemberIds(input.members, me.id) : chat.members;
    store.apply({ type: 'update', col: 'chats', id: chatId, data: { title, members } });
    changed();
    return { ok: true };
  }

  function leave(chatId) {
    const me = currentUser(), chat = store.data.chats[chatId];
    if (!me || !chat || chat.kind !== 'group' || !chat.members.includes(me.id)) return { ok: false, message: 'Чат не найден.' };
    store.apply({ type: 'update', col: 'chats', id: chatId, data: { members: chat.members.filter(id => id !== me.id) } });
    changed();
    return { ok: true };
  }

  // Sample chats for the examples (marked demo, removed with them).
  function seedDemo() {
    const me = currentUser(), users = store.data.users;
    const gip = A.isGip(me) ? me.id : Object.entries(users).find(([, u]) => u.role === 'gip' && !u.deletedAt)?.[0];
    if (!gip || !users['demo-u2'] || !store.data.projects['demo-p2']) return { ok: false };
    const ago = h => new Date(Date.now() - h * 36e5).toISOString();
    const nm = id => users[id]?.name || '';
    const m = (h, uid, text, mentions = []) => ({ id: 'dm' + h + uid.slice(-2), ts: ago(h), userId: uid, user: nm(uid), text, mentions });
    const chats = {
      [projectChatId('demo-p2')]: { kind: 'project', projectId: 'demo-p2', messages: [
        m(50, gip, 'Коллеги, заказчик подтвердил кран-балки 10 т. Задания на КР — до пятницы.'),
        m(30, 'demo-u2', '@Зайцев, по ИТП нужны расходы на подпитку от ВК. Посмотришь?', ['demo-u3']),
        m(26, 'demo-u3', '@Белова, да, сегодня скину в папку раздела.', ['demo-u2']),
        m(5, 'demo-u2', `@${surname(nm(gip))}, нужна схема ввода тепловой сети от ГП — когда будет?`, [gip]) ] },
      ['d_' + [gip, 'demo-u2'].sort().join('_')]: { kind: 'direct', members: [gip, 'demo-u2'].sort(), messages: [
        m(20, 'demo-u2', 'Можно я в пятницу уйду пораньше? ОВ по складу сдам в четверг.'),
        m(3, 'demo-u2', 'И ещё: кто проверит ИТП, пока Зайцев в отпуске?') ] },
      g_demoplan: { kind: 'group', title: 'Планёрка по понедельникам', members: [gip, 'demo-u1', 'demo-u2', 'demo-u3'].filter(id => users[id]), createdBy: gip, messages: [
        m(70, gip, 'В понедельник в 9:30 — сроки по складу и ЖК. Прошу обновить готовность в карточках.'),
        m(8, 'demo-u1', `@${surname(nm(gip))}, по ЖК ЭОМ сдвигается на 3 дня — ждём ТУ.`, [gip]) ] },
    };
    for (const [id, c] of Object.entries(chats)) {
      const last = c.messages.at(-1)?.ts || '';
      store.apply({ type: 'set', col: 'chats', id, data: { seen: {}, createdAt: ago(80), ...c, lastTs: last, demo: true } });
    }
    changed();
    return { ok: true };
  }

  return { projectChatId, surname, chatMembers, mentionsIn, migrateProjectChats, send, edit, seen, direct, create, update, leave, seedDemo };
});

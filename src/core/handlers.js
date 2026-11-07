'use strict';
// Business rules of the main process that do not depend on Electron: who the current user is, what they see,
// checked writes with bookkeeping and the journal, comments, the trash. Shared by src/main.js (Electron) and
// the Tauri window. `store`, `journal` and `settings` are the same small interfaces in both:
//   store.data / snapshot() / apply(op) / applyAll(ops)   journal.append(entries, meta) / read({ since })
//   settings.get(key) / set(patch)                        changed({ user }) — data (or the user) changed, refresh views
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createCore = factory;
})(typeof self !== 'undefined' ? self : this, function createCore(deps) {
  const { store, journal, settings, A, Composition, diffBatch, StoreError, TRASH_DAYS = 30 } = deps;
  const L = deps.L;
  const changed = deps.changed || (() => {});

  function currentUser() {
    const users = store.snapshot().users.filter(u => !u.deletedAt);
    return users.find(u => u.id === settings.get('userId')) || users.find(u => u.role === 'gip') || users[0] || null;
  }
  // What the current user may see: hidden cards are not sent to the window at all, money is stripped.
  function userView() {
    const me = currentUser();
    const view = A.viewFor(me, store.snapshot());
    return { ...view, me };
  }
  // First start of 1.7: the existing single user becomes a chief with full budget access; the GIP is added.
  function migrateUsers() {
    if (Object.keys(store.data.users).length) return;
    const now = new Date().toISOString();
    const ops = [
      { type: 'set', col: 'users', id: 'u-gip', data: { name: 'ГИП', role: 'gip', directions: [], createdAt: now } },
      { type: 'set', col: 'users', id: 'u-chief', data: { name: 'Главспец', role: 'chief', directions: ['el', 'ss'], canSeeBudget: true, createdAt: now } },
    ];
    for (const id of Object.keys(store.data.tasks)) if (!store.data.tasks[id].ownerId) ops.push({ type: 'update', col: 'tasks', id, data: { ownerId: 'u-chief' } });
    store.applyAll(ops);
    settings.set({ userId: 'u-chief' });
  }

  function purgeTrash() {
    const cutoff = Date.now() - TRASH_DAYS * 864e5;
    const snap = store.snapshot();
    const ops = [];
    for (const col of ['tasks', 'projects', 'contractors', 'users']) {
      for (const d of snap[col]) {
        const at = Date.parse(d.deletedAt);
        if (d.deletedAt && Number.isFinite(at) && at < cutoff) ops.push({ type: 'delete', col, id: d.id });
      }
    }
    if (ops.length) {
      const titles = ops.map(o => { const d = store.data[o.col][o.id]; return o.col === 'tasks' ? L.sectionsOf(d).join(', ') : d.name; });
      store.applyAll(ops);
      journal.append(ops.map((o, i) => ({ col: o.col, id: o.id, kind: 'delete', title: titles[i] || '' })), { action: 'Корзина: удалено через 30 дней' });
      console.log(`Корзина: окончательно удалено записей — ${ops.length}.`);
    }
  }

  // Local profiles: switching is for trying the roles out on one computer, not a security boundary.
  function switchUser(id) {
    const u = store.data.users[id];
    if (!u || u.deletedAt) return { ok: false, message: 'Пользователь не найден.' };
    settings.set({ userId: id });
    changed({ user: true });
    return { ok: true };
  }

  function write(ops, meta = {}) {
    const list = Array.isArray(ops) ? ops : [ops];
    const valid = list.filter(o => o && store.data[o.col] && typeof o.id === 'string');
    // Permission check for the whole batch before anything is written.
    const me = currentUser();
    const usersNow = store.snapshot().users;
    // Sample data (demo: true) may be added by the GIP or a chief whatever the cards' owners are.
    // Only creation is exempt: later edits of sample records are checked like any other.
    const isDemo = o => o.type === 'set' && o.data?.demo === true && !store.data[o.col][o.id];
    const demoBatch = valid.length > 0 && valid.length === list.length && valid.every(isDemo) && A.canCreateTasks(me);
    for (const o of valid) if (o.col === 'projects' && o.data) o.data = A.keepHiddenPhases(me, store.data.projects[o.id], o.data);
    for (const o of valid) if (o.col === 'projects' && o.data && 'composition' in o.data) {
      const c = Composition.clean(o.data.composition);
      if (!c.ok) return { ok: false, message: c.message };
      o.data = { ...o.data, composition: c.value };
    }
    for (const o of demoBatch ? [] : valid) {
      const prev = store.data[o.col][o.id] || null;
      const next = o.type === 'delete' ? null : o.type === 'update' ? { ...(prev || {}), ...(o.data || {}) } : o.data;
      const err = A.checkWrite(me, o.col, prev, next, usersNow, o.id);
      if (err) return { ok: false, message: err };
    }
    // Bookkeeping added after the check: activity time, «new» marks for people a card was handed to,
    // and the specialist's submission report turned into a comment for the reviewer.
    const now = new Date().toISOString();
    for (const o of valid) {
      if (o.col !== 'tasks' || o.type === 'delete' || !o.data) continue;
      const prev = store.data.tasks[o.id] || null;
      const next = o.type === 'update' ? { ...(prev || {}), ...o.data } : o.data;
      if (next.deletedAt) continue;
      const notify = { ...(prev?.notify || {}), ...(o.data.notify || {}) };
      const was = new Set(prev ? A.ownersOf(prev) : []);
      for (const id of A.ownersOf(next)) if (!was.has(id) && id !== me?.id) notify[id] = now;
      if (prev && prev.status !== 'review' && next.status === 'review') {
        const last = (next.history || []).at(-1);
        const text = last?.type === 'status' && last.to === 'review' ? String(last.note || '').trim() : '';
        const comments = [...(next.comments || []), { id: now.replace(/\D/g, '') + Math.random().toString(36).slice(2, 6), ts: now, userId: me?.id || '', user: me?.name || '', kind: 'submit', text: text || 'Сдано на проверку.' }];
        o.data.comments = comments;
        for (const id of A.reviewersOf(next, usersNow)) if (id !== me?.id) notify[id] = now;
      }
      o.data.notify = notify;
      if (o.type === 'update') o.data.updatedAt = now;
      else if (!o.data.updatedAt) o.data.updatedAt = o.data.createdAt || now;
    }
    const before = new Map(valid.map(o => [o.col + '/' + o.id, store.data[o.col][o.id] ? JSON.parse(JSON.stringify(store.data[o.col][o.id])) : null]));
    const ctxBefore = { projects: { ...store.data.projects }, contractors: { ...store.data.contractors } };
    try {
      store.applyAll(list);
      return { ok: true };
    } catch (e) {
      if (!(e instanceof StoreError)) console.error(e);
      return { ok: false, message: e instanceof StoreError ? e.message : `Ошибка записи файла: ${e.code || e.message}` };
    } finally {
      // Journal whatever actually changed (also after a partial failure), then sync the UI.
      try {
        const ctx = { projects: { ...ctxBefore.projects, ...store.data.projects }, contractors: { ...ctxBefore.contractors, ...store.data.contractors }, users: store.data.users };
        const entries = diffBatch(valid, (c, id) => before.get(c + '/' + id) ?? null, (c, id) => store.data[c][id] || null, ctx);
        journal.append(entries, { action: typeof meta?.action === 'string' ? meta.action.slice(0, 120) : '', undo: !!meta?.undo, user: me?.name || '' });
      } catch (e) { console.error('Журнал:', e); }
      changed();
    }
  }

  // Opening a card clears its «new» mark for the current user. Not journaled, not undoable.
  function taskSeen(id) {
    const me = currentUser(), t = store.data.tasks[id];
    if (!me || !t || !A.isUnread(t, me.id)) return { ok: true };
    store.apply({ type: 'update', col: 'tasks', id, data: { seen: { ...(t.seen || {}), [me.id]: new Date().toISOString() } } });
    changed();
    return { ok: true };
  }

  // Card discussion: anyone who sees the card may write; its people and their chiefs get a «new» mark.
  function taskComment(id, text) {
    const me = currentUser(), t = store.data.tasks[id];
    const body = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
    if (!me || !t) return { ok: false, message: 'Карточка не найдена.' };
    if (!A.canSeeTask(me, t, store.snapshot().users)) return { ok: false, message: 'Эта карточка вне вашей зоны доступа.' };
    if (!body) return { ok: false, message: 'Напишите текст комментария.' };
    const now = new Date().toISOString();
    const users = store.snapshot().users;
    const notify = { ...(t.notify || {}) };
    const to = new Set([...A.ownersOf(t), ...A.reviewersOf(t, users), ...(t.comments || []).map(c => c.userId)]);
    for (const uid of to) if (uid && uid !== me.id) notify[uid] = now;
    const comment = { id: now.replace(/\D/g, '') + Math.random().toString(36).slice(2, 6), ts: now, userId: me.id, user: me.name, text: body };
    store.apply({ type: 'update', col: 'tasks', id, data: { comments: [...(t.comments || []), comment], notify, seen: { ...(t.seen || {}), [me.id]: now }, updatedAt: now } });
    journal.append([{ col: 'tasks', id, kind: 'update', title: L.sectionsOf(t).join(', '), changes: [{ f: 'comment', label: 'Комментарий', to: body.slice(0, 200) }] }], { action: 'Комментарий', user: me.name });
    changed();
    return { ok: true };
  }

  function taskThank(id, commentId) {
    const me = currentUser(), t = typeof id === 'string' ? store.data.tasks[id] : null;
    if (!me || !t || !A.canSeeTask(me, t, store.snapshot().users)) return { ok: false, message: 'Карточка не найдена.' };
    const comments = (t.comments || []).map(c => ({ ...c }));
    const c = comments.find(x => x.id === commentId);
    if (!c) return { ok: false, message: 'Комментарий не найден.' };
    if (c.userId === me.id) return { ok: false, message: 'Себя поблагодарить нельзя.' };
    const set = new Set(Array.isArray(c.thanks) ? c.thanks : []);
    const on = !set.has(me.id);
    if (on) set.add(me.id); else set.delete(me.id);
    c.thanks = [...set];
    const now = new Date().toISOString();
    const notify = { ...(t.notify || {}) };
    if (on && c.userId) notify[c.userId] = now;
    store.apply({ type: 'update', col: 'tasks', id, data: { comments, notify } });
    if (on) journal.append([{ col: 'tasks', id, kind: 'update', title: L.sectionsOf(t).join(', '), changes: [{ f: 'thanks', label: 'Спасибо', to: c.user || '' }] }], { action: 'Спасибо', user: me.name });
    changed();
    return { ok: true, on };
  }

  function demoClear() {
    if (!A.canCreateTasks(currentUser())) return { ok: false, message: 'Примеры удаляют ГИП или главспец.' };
    const ops = [];
    for (const col of COLLECTIONS) for (const [id, d] of Object.entries(store.data[col])) if (d.demo === true) ops.push({ type: 'delete', col, id });
    if (!ops.length) return { ok: true };
    if (ops.some(o => o.col === 'users' && o.id === settings.get('userId'))) settings.set({ userId: null });
    store.applyAll(ops);
    journal.append(ops.map(o => ({ col: o.col, id: o.id, kind: 'delete', title: 'пример' })), { action: 'Примеры удалены', user: currentUser()?.name || '' });
    changed();
    return { ok: true };
  }

  // The journal is filtered like the data: only cards the user sees, without money for those without access.
  async function journalGet({ since } = {}) {
    const me = currentUser();
    const all = await journal.read({ since: typeof since === 'string' ? since : '' });
    if (A.isGip(me)) return all;
    const users = store.snapshot().users;
    const money = A.canSeeMoney(me);
    const moneyLabels = new Set(['Бюджет', 'Платёж внесён', 'Платёж удалён', 'График платежей', 'Договор', 'Счёт получен', 'Акт подписан']);
    return all.filter(e => {
      if (e.col !== 'tasks') return A.isChief(me) && e.col !== 'users';
      const t = store.data.tasks[e.id];
      return t && A.canSeeTask(me, t, users);
    }).map(e => (money || !e.changes ? e : { ...e, changes: e.changes.filter(c => !moneyLabels.has(c.label)) }))
      .filter(e => !e.changes || e.changes.length || e.kind !== 'update');
  }

  return { currentUser, userView, migrateUsers, purgeTrash, switchUser, write, taskSeen, taskComment, taskThank, demoClear, journalGet };
});

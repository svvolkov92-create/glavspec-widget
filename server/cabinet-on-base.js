'use strict';
// The customer cabinet on the shared base (stage 5). The cabinet's own web server (cabinet-server.js) runs in the
// same process on an inner port; Caddy gives it its own address for customers. What a Пульт did on its computer —
// publishing projects, taking the customers' messages from the inbox every two minutes, files of requests — the
// server does here, from the shared base, with the same rules (src/core/cabinet-rules.js). The people of the team
// manage it from their Пульт through /api/rpc { fn: 'cabinet', args: [name, ...] }.
const fs = require('node:fs');
const path = require('node:path');

module.exports = function cabinetOnBase({ cfg, store, core, asUser, inTurnAs, A, L, LIB, acc }) {
  const { createServer } = require('./cabinet-server.js');
  const { Cabinet, normalizeUrl, isLocalHost, KINDS } = require(path.join(LIB, 'cabinet.js'));
  const { pageModel } = require(path.join(LIB, 'report', 'customer.js'));
  const createCabinetRules = require(path.join(LIB, 'core', 'cabinet-rules.js'));
  const createFiles = require(path.join(LIB, 'core', 'files.js'));

  const cabDir = path.join(cfg.dataDir, 'cabinet');
  const inner = createServer({ dataDir: cabDir, port: cfg.cabinetPort, host: '127.0.0.1', trustProxy: true, title: cfg.cabinetTitle || 'Мой Тандем', configFile: path.join(cabDir, 'config.json') });
  inner.server.listen(cfg.cabinetPort, '127.0.0.1');
  const innerUrl = `http://127.0.0.1:${cfg.cabinetPort}`;
  const client = new Cabinet(path.join(cfg.dataDir, 'cabinet-client'), { url: () => innerUrl, key: () => inner.teamKey() });
  fs.mkdirSync(path.join(cfg.dataDir, 'cabinet-client'), { recursive: true });

  // Only what the cabinet rules need from the file rules: the GIP contact and the team shown to the customer,
  // the bytes of request files (kept in <data>/attachments like a Пульт keeps them).
  const io = {
    join: (...p) => path.join(...p), dirname: p => path.dirname(p), basename: p => path.basename(p), extname: p => path.extname(p),
    dirs: () => ({ userData: cfg.dataDir, documents: cfg.dataDir }),
    exists: async p => fs.existsSync(p), readFile: async p => fs.readFileSync(p),
  };
  const files = createFiles({ store, journal: { append() {} }, settings: { get: () => undefined, set() {} }, A, L, Composition: null, R: {}, io, Buffer,
    currentUser: () => core.currentUser(), userView: () => core.userView() });

  let changedAt = 0;
  const rules = createCabinetRules({
    store, A, L, cabinet: client, files,
    settings: { get: k => (k === 'cabinetUrl' ? cfg.cabinetUrl || innerUrl : undefined), set() {} },
    keyStore: { get: () => inner.teamKey(), set: async () => {} },
    local: { running: () => null, supported: false, start: async () => { throw new Error('Кабинет работает на сервере.'); }, stop: async () => {} },
    R: { pageModel, normalizeUrl, isLocalHost, KINDS },
    currentUser: () => core.currentUser(), userView: () => core.userView(),
    notify: () => {}, openExternal: () => {}, changed: () => { changedAt = Date.now(); },
  });

  // Contacts of customers (their logins, phones) — the GIP, or a chief the GIP gave «видит контакты заказчика».
  const contacts = u => A.isGip(u) || !!u?.canSeeContacts;
  // The customer's page is the same whoever presses the button: it is built as the GIP sees the project. Built as a
  // chief (who sees no money, not every card) it would differ — and the next sync would send it again, back and forth.
  const gipId = () => Object.keys(acc.byUser).find(id => A.isGip(store.data.users[id]) && !store.data.users[id]?.deletedAt && !acc.byUser[id].disabled);
  const asGip = fn => { const g = gipId(); return g && inTurnAs ? inTurnAs(g, fn) : fn(); };
  const seesProject = id => core.userView().projects.some(p => p.id === String(id));
  const visibleOnly = ids => { const seen = new Set(core.userView().projects.map(p => p.id)); return (Array.isArray(ids) ? ids : []).map(String).filter(id => seen.has(id)); };
  const ALLOWED = {
    view: () => {
      const v = rules.view();
      return v.allowed ? { ...v, onServer: true, publicUrl: cfg.cabinetUrl || v.publicUrl } : v;
    },
    sync: () => asGip(() => rules.sync({ quiet: true })),
    publish: id => (seesProject(id) ? asGip(() => rules.publish(String(id))) : { ok: false, message: 'Проект не найден.' }),
    unpublish: id => (seesProject(id) ? asGip(() => rules.unpublish(String(id))) : { ok: false, message: 'Проект не найден.' }),
    customers: () => rules.customers(),
    // 4.9.3: a login opens only projects the person who gives it sees; projects of an existing login that the person
    // does not see stay as they were (a chief with contacts cannot hand out — or take away — other groups' projects).
    customerCreate: c => rules.customerCreate({ ...c, projectIds: visibleOnly(c?.projectIds) }),
    customerUpdate: async (id, patch) => {
      if (!patch || !('projectIds' in patch)) return rules.customerUpdate(id, patch);
      const had = (await rules.customers()).customers?.find(x => x.id === id)?.projectIds || [];
      const seen = new Set(core.userView().projects.map(p => p.id));
      return rules.customerUpdate(id, { ...patch, projectIds: [...new Set([...had.filter(p => !seen.has(p)), ...visibleOnly(patch.projectIds)])] });
    },
    customerDelete: id => rules.customerDelete(id),
    read: (ids, isRead) => rules.read(ids, isRead),
  };
  const CONTACTS = new Set(['customers', 'customerCreate', 'customerUpdate', 'customerDelete']);
  function call(me, fn, args) {
    const f = Object.prototype.hasOwnProperty.call(ALLOWED, fn) ? ALLOWED[fn] : null; // not «constructor», «toString»…
    if (!f) return { ok: false, message: 'Эта настройка кабинета на сервере не нужна.' };
    if (['sync', 'publish', 'unpublish'].includes(fn) && (!me.user || A.isSpecialist(me.user))) return { ok: false, message: 'Кабинетом заказчика управляют ГИП и главспецы.' };
    if (CONTACTS.has(fn) && !contacts(me.user)) return { ok: false, message: 'Заказчиков и их контакты видит ГИП (или тот, кому он открыл контакты).' };
    return f(...(args || []));
  }

  // Every two minutes, as the first GIP with a login: re-send changed projects, take new messages.
  const tick = () => { const g = gipId(); if (g) asUser(g, () => rules.sync({ quiet: true })).catch(e => console.error('Кабинет:', e.message)); };
  const timers = [setInterval(tick, 2 * 60e3), setTimeout(tick, 10e3)];
  for (const t of timers) t.unref?.();

  return { call, rules, inner, client, changedAt: () => changedAt, stop: () => { for (const t of timers) clearInterval(t); inner.store.flush?.(); inner.server.close(); } };
};

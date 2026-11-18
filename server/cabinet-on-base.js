'use strict';
// The customer cabinet on the shared base (stage 5). The cabinet's own web server (cabinet-server.js) runs in the
// same process on an inner port; Caddy gives it its own address for customers. What a Пульт did on its computer —
// publishing projects, taking the customers' messages from the inbox every two minutes, files of requests — the
// server does here, from the shared base, with the same rules (src/core/cabinet-rules.js). The people of the team
// manage it from their Пульт through /api/rpc { fn: 'cabinet', args: [name, ...] }.
const fs = require('node:fs');
const path = require('node:path');

module.exports = function cabinetOnBase({ cfg, store, core, asUser, A, L, LIB, acc }) {
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
  const ALLOWED = {
    view: () => {
      const v = rules.view();
      return v.allowed ? { ...v, onServer: true, publicUrl: cfg.cabinetUrl || v.publicUrl } : v;
    },
    sync: () => rules.sync({ quiet: true }),
    publish: id => rules.publish(String(id)),
    unpublish: id => rules.unpublish(String(id)),
    customers: () => rules.customers(),
    customerCreate: c => rules.customerCreate(c),
    customerUpdate: (id, patch) => rules.customerUpdate(id, patch),
    customerDelete: id => rules.customerDelete(id),
    read: (ids, isRead) => rules.read(ids, isRead),
  };
  const CONTACTS = new Set(['customers', 'customerCreate', 'customerUpdate', 'customerDelete']);
  function call(me, fn, args) {
    const f = ALLOWED[fn];
    if (!f) return { ok: false, message: 'Эта настройка кабинета на сервере не нужна.' };
    if (CONTACTS.has(fn) && !contacts(me.user)) return { ok: false, message: 'Заказчиков и их контакты видит ГИП (или тот, кому он открыл контакты).' };
    return f(...(args || []));
  }

  // Every two minutes, as the first GIP with a login: re-send changed projects, take new messages.
  const gipId = () => Object.keys(acc.byUser).find(id => store.data.users[id]?.role === 'gip' && !store.data.users[id]?.deletedAt && !acc.byUser[id].disabled);
  const tick = () => { const g = gipId(); if (g) asUser(g, () => rules.sync({ quiet: true })).catch(e => console.error('Кабинет:', e.message)); };
  const timers = [setInterval(tick, 2 * 60e3), setTimeout(tick, 10e3)];
  for (const t of timers) t.unref?.();

  return { call, rules, inner, client, changedAt: () => changedAt, stop: () => { for (const t of timers) clearInterval(t); inner.store.flush?.(); inner.server.close(); } };
};

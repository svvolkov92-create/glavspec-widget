'use strict';
// The customer cabinet from the team's side, shared by the Electron main process and the Tauri window: what the
// window sees, publishing projects, customers, the inbox (every two minutes), files attached to requests.
// The HTTP client is src/cabinet.js; what differs between the two apps comes in `deps`:
//   cabinet — the client;  keyStore.get() / set(key) — the team key, kept encrypted;
//   local.running() → { port, lan } | null, local.start() → { port, lan, teamKey }, local.stop() — «кабинет на этом компьютере»;
//   notify(text), openExternal(url), changed() — the window must refresh the cabinet view.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createCabinetRules = factory;
})(typeof self !== 'undefined' ? self : this, function createCabinetRules(deps) {
  const { store, settings, A, L, cabinet, keyStore, local, files } = deps;
  const { pageModel, normalizeUrl, isLocalHost, KINDS } = deps.R;
  const currentUser = () => deps.currentUser();
  const userView = () => deps.userView();
  const changed = () => (deps.changed || (() => {}))();
  const canUse = me => !!me && !A.isSpecialist(me);

  // What the cabinet gets for a project: the same customer-safe model as the HTML page, built from the full
  // project record and the cards the current user sees. null when the user may not publish it.
  function model(projectId) {
    const me = currentUser();
    if (!canUse(me)) return null;
    const view = userView();
    const p = store.data.projects[projectId];
    if (!p || p.deletedAt || !view.projects.some(x => x.id === projectId)) return null;
    return pageModel({ project: { ...p, id: projectId }, tasks: view.tasks, contact: files.customerContact(p), team: files.customerTeam(p), today: L.todayStr() });
  }

  // The window's view of the cabinet: messages only for projects the user sees.
  function view() {
    const me = currentUser();
    if (!canUse(me)) return { allowed: false };
    const visible = new Set(userView().projects.map(p => p.id));
    const url = normalizeUrl(settings.get('cabinetUrl')) || '';
    const st = cabinet.state, loc = local.running();
    return {
      allowed: true, url, hasKey: !!keyStore.get(), local: loc ? { port: loc.port, lan: loc.lan } : null, localSupported: local.supported !== false,
      // The address to give customers: for the built-in server the office-network address, not «localhost».
      publicUrl: loc ? (loc.lan[0] || url) : url, configured: cabinet.configured(), insecure: !!url && url.startsWith('http:') && !isLocalHost(url),
      lastSync: st.lastSync, lastError: st.lastError, published: st.published,
      messages: st.messages.filter(m => visible.has(m.projectId)).slice(-300).reverse(),
    };
  }

  // Files attached to the project's requests that the cabinet does not have yet go up after the project.
  async function uploadFiles(projectId) {
    const p = store.data.projects[projectId];
    const want = new Map((p?.requests || []).flatMap(r => (Array.isArray(r.files) ? r.files : [])).map(f => [f.id, f]));
    const have = new Set(cabinet.state.files?.[projectId] || []);
    for (const [fid, f] of want) {
      if (have.has(fid)) continue;
      const bytes = await files.attachmentBytes(projectId, fid);
      if (!bytes) continue; // the file was removed from this computer: the customer sees its name only
      await cabinet.uploadFile(projectId, fid, { name: f.name, type: f.type || '', bytes });
    }
    for (const fid of have) if (!want.has(fid)) await cabinet.deleteFile(projectId, fid);
  }
  async function publishProject(projectId, m) {
    const r = await cabinet.publish(projectId, m);
    await uploadFiles(projectId);
    return r;
  }

  let busy = false;
  // Every two minutes: re-send changed published projects, take new messages, notify about them.
  async function sync({ quiet = false } = {}) {
    if (!cabinet.configured() || busy) return { ok: false, message: 'Кабинет не настроен.' };
    busy = true;
    try {
      const me = currentUser();
      if (canUse(me)) {
        await cabinet.refreshPublished(model, publishProject);
        for (const id of Object.keys(cabinet.state.published)) if (model(id)) await uploadFiles(id);
      }
      const fresh = await cabinet.poll();
      const visible = new Set(userView().projects.map(p => p.id));
      const mine = canUse(me) ? fresh.filter(m => visible.has(m.projectId)) : [];
      if (mine.length && !quiet) {
        const urgent = mine.find(m => m.kind === 'urgent');
        const m = urgent || mine[0];
        deps.notify(mine.length === 1 ? `${KINDS[m.kind]} — ${m.projectName}: ${m.text.slice(0, 120)}` : `От заказчиков: ${mine.length} новых сообщения${urgent ? ', есть горящий вопрос' : ''}.`);
      }
      return { ok: true, fresh: mine.length };
    } catch (e) {
      return { ok: false, message: e.message };
    } finally {
      busy = false;
      changed();
    }
  }
  // Runs a team-API call on behalf of the window with the same guard and error shape everywhere.
  async function call(fn) {
    if (!canUse(currentUser())) return { ok: false, message: 'Кабинетом заказчика управляют ГИП и главспецы.' };
    try { return { ok: true, ...(await fn()) }; }
    catch (e) { return { ok: false, message: e.message }; }
    finally { changed(); }
  }

  async function localStart() {
    if (!canUse(currentUser())) return { ok: false, message: 'Кабинет запускают ГИП и главспецы.' };
    try {
      const prevUrl = normalizeUrl(settings.get('cabinetUrl'));
      const s = await local.start();
      settings.set({ cabinetLocal: true, cabinetLocalPort: s.port, cabinetUrl: `http://localhost:${s.port}` });
      await keyStore.set(s.teamKey);
      if (prevUrl && prevUrl !== `http://localhost:${s.port}`) cabinet.forgetPublished();
      sync({ quiet: true });
      return { ok: true, port: s.port, lan: s.lan };
    } catch (e) { return { ok: false, message: e.message }; } finally { changed(); }
  }
  async function localStop() {
    if (!canUse(currentUser())) return { ok: false, message: 'Кабинет останавливают ГИП и главспецы.' };
    await local.stop();
    settings.set({ cabinetLocal: false, cabinetUrl: '' });
    await keyStore.set('');
    changed();
    return { ok: true };
  }
  async function configure({ url, key } = {}) {
    if (!canUse(currentUser())) return { ok: false, message: 'Кабинет настраивают ГИП и главспецы.' };
    const norm = normalizeUrl(url);
    if (url && !norm) return { ok: false, message: 'Адрес сервера не похож на адрес сайта.' };
    const prevUrl = settings.get('cabinetUrl'), prevKey = settings.get('cabinetKey');
    const loc = local.running();
    if (loc && norm !== `http://localhost:${loc.port}`) { await local.stop(); settings.set({ cabinetLocal: false }); }
    settings.set({ cabinetUrl: norm || '' });
    if (key !== undefined && key !== null && String(key).trim() !== '') await keyStore.set(String(key).trim());
    if (!norm) { await keyStore.set(''); changed(); return { ok: true, off: true }; }
    try {
      const r = await cabinet.ping();
      if (prevUrl && normalizeUrl(prevUrl) !== norm) cabinet.forgetPublished(); // another server: start over
      changed();
      sync({ quiet: true });
      return { ok: true, version: r.version, projects: r.projects, customers: r.customers };
    } catch (e) {
      settings.set({ cabinetUrl: prevUrl, cabinetKey: prevKey }); // keep the working settings
      changed();
      return { ok: false, message: e.message };
    }
  }
  const publish = projectId => call(async () => {
    const m = model(projectId);
    if (!m) throw new Error('Проект не найден или недоступен.');
    return { published: await publishProject(projectId, m) };
  });
  const unpublish = projectId => call(async () => { await cabinet.unpublish(projectId); return {}; });
  const customers = () => call(async () => ({ customers: await cabinet.customers() }));
  const customerCreate = (c = {}) => call(() => cabinet.createCustomer({ name: String(c.name || '').slice(0, 120), login: String(c.login || '').slice(0, 80), projectIds: (c.projectIds || []).map(String) }));
  const customerUpdate = (id, patch = {}) => call(() => {
    const allowed = {};
    if (Array.isArray(patch.projectIds)) allowed.projectIds = patch.projectIds.map(String);
    if (patch.name !== undefined) allowed.name = String(patch.name).slice(0, 120);
    if (patch.disabled !== undefined) allowed.disabled = !!patch.disabled;
    if (patch.resetPassword) allowed.resetPassword = true;
    return cabinet.updateCustomer(String(id), allowed);
  });
  const customerDelete = id => call(() => cabinet.deleteCustomer(String(id)));
  function read(ids, isRead = true) {
    if (!canUse(currentUser())) return { ok: false };
    cabinet.markRead((Array.isArray(ids) ? ids : []).map(String), isRead !== false);
    changed();
    return { ok: true };
  }
  function open(projectId) {
    const url = normalizeUrl(settings.get('cabinetUrl'));
    if (!url) return { ok: false, message: 'Кабинет не настроен.' };
    deps.openExternal(projectId ? `${url}/p/${encodeURIComponent(projectId)}` : url);
    return { ok: true };
  }

  return { model, view, sync, call, localStart, localStop, configure, publish, unpublish, customers, customerCreate, customerUpdate, customerDelete, read, open, canUse };
});

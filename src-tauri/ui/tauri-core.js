'use strict';
// The Tauri side of the shared core: the same rules as the Electron main process (src/core/handlers.js)
// over a store, a journal and settings whose files are kept by the Rust core (src-tauri/src/files.rs).
// Loaded after logic.js, access.js and composition.js; started by tauri-api.js on the first call.
(function () {
  const { invoke } = window.__TAURI__.core;
  const SC = window.StoreCore, L = window.Logic;

  // Same defaults as `new Settings(…)` in src/main.js.
  const SETTINGS_DEFAULTS = {
    alwaysOnTop: true, compact: false, opacity: 0.82, fullBounds: null, compactBounds: null,
    notify: true, notifyHour: 9, lastDigest: null,
    windowLevel: null, theme: 'system', zoom: 1, cabinetUrl: '', cabinetKey: '', cabinetLocal: false, cabinetLocalPort: 8080,
  };
  const CONFLICT_MESSAGE = 'Данные изменились в другом окне Пульта — показаны свежие. Повторите последнее действие.';

  let onCabinet = null;
  async function init({ onChanged, cabinetChanged }) {
    onCabinet = cabinetChanged;
    const loaded = await invoke('store_load');
    const savedSettings = await invoke('settings_load');

    // Writes go out one at a time; several changes in a row are saved once with the latest state.
    let dirty = false, saving = null, lastError = null;
    async function saveLoop() {
      while (dirty) {
        dirty = false;
        try { await invoke('store_save', { data: store.data, day: L.todayStr() }); }
        catch (e) {
          const msg = String(e?.message || e);
          if (msg === 'conflict') {
            const fresh = await invoke('store_load');
            store.data = fresh.data ? SC.fromParsed(fresh.data) : SC.emptyData();
            lastError = CONFLICT_MESSAGE;
            onChanged();
          } else lastError = `Ошибка записи файла: ${msg}`;
          dirty = false;
        }
      }
    }
    const kick = () => { if (!saving) saving = saveLoop().finally(() => { saving = null; }); return saving; };
    // Waits for the pending saves and hands over their error once (to the call that asked).
    function flush() {
      return kick().then(() => {
        const message = lastError; lastError = null;
        return message ? { ok: false, message } : { ok: true };
      });
    }

    const store = {
      data: loaded.data ? SC.fromParsed(loaded.data) : SC.emptyData(),
      warning: loaded.warning || null,
      snapshot() { return SC.snapshot(this.data); },
      apply(op, { save = true } = {}) { SC.applyOp(this.data, op); if (save) this.save(); },
      // Operations before a failing one stay applied and are saved, as in src/store.js.
      applyAll(ops) {
        let applied = 0;
        try { for (const op of ops) { SC.applyOp(this.data, op); applied++; } }
        finally { if (applied) this.save(); }
      },
      save() { dirty = true; kick(); },
      // Restore from a backup: the whole data set at once (records with invalid ids are skipped).
      replaceAll(raw) {
        const { data, count } = SC.fromBackup(raw);
        this.data = data;
        this.save();
        return count;
      },
    };

    const journal = {
      append(entries, meta) {
        if (!entries.length) return;
        invoke('journal_append', { lines: window.JournalDiff.batchLines(entries, meta) })
          .catch(e => console.error('Не удалось записать журнал:', e)); // the journal must never block saving data
      },
      read({ since = '' } = {}) { return invoke('journal_read', { since, limit: 3000 }); },
    };

    const values = { ...SETTINGS_DEFAULTS, ...savedSettings };
    const settings = {
      get: key => values[key],
      set(patch) {
        Object.assign(values, patch);
        invoke('settings_save', { values }).catch(e => console.error('Не удалось сохранить настройки окна:', e));
      },
    };

    const core = window.createCore({
      store, journal, settings, A: window.Access, L, Composition: window.Composition,
      diffBatch: window.JournalDiff.diffBatch, StoreError: SC.StoreError, changed: () => onChanged(),
    });
    const chats = window.createChats({ store, A: window.Access, currentUser: () => core.currentUser(), changed: () => onChanged() });
    // Files: the shared rules (src/core/files.js) with the report and import code of the Electron version
    // (node-modules.js); Windows access through the Rust commands (src-tauri/src/io.rs).
    const dirs = await invoke('known_dirs');
    const files = window.createFiles({
      store, journal, settings, A: window.Access, L, Composition: window.Composition, StoreError: SC.StoreError, Buffer: window.Buffer,
      io: tauriIo(dirs), appVersion: 'Tauri', R: reportCode(),
      currentUser: () => core.currentUser(), userView: () => core.userView(), changed: () => onChanged(),
    });
    const cabinetRules = await cabinetOf({ store, settings, files, core, dirs, onCabinet: () => onCabinet?.() });
    core.migrateUsers();
    try { chats.migrateProjectChats(); } catch (e) { console.error('Не удалось перенести чаты проектов:', e); }
    try { core.purgeTrash(); } catch (e) { console.error('Не удалось очистить корзину:', e); }
    await flush();

    const copied = loaded.copiedFrom
      ? `Проба Tauri работает на своей копии данных (${loaded.dir}), взятой из обычного Пульта. Обычный Пульт она не меняет.`
      : '';
    return { core, chats, files, cabinet: cabinetRules, store, settings, flush, warning: store.warning || copied || null };
  }

  // The customer cabinet: the client of the Electron version (src/cabinet.js) and the shared rules
  // (src/core/cabinet-rules.js). HTTP, the team key and the built-in server go through Rust (src-tauri/src/cabinet.rs).
  async function cabinetOf({ store, settings, files, core, dirs, onCabinet }) {
    const { Cabinet, normalizeUrl, isLocalHost, KINDS } = window.NodeModules.load('cabinet.js');
    const { pageModel } = window.NodeModules.load('report/customer.js');
    const stateFile = dirs.userData + '\\cabinet.json';
    let saved = null;
    try { if (await invoke('fs_exists', { path: stateFile })) saved = JSON.parse(window.Buffer.from(await invoke('fs_read', { path: stateFile }), 'base64').toString('utf8')); } catch { /* start over */ }
    // The team key: 'dpapi:' — encrypted for this Windows user; an Electron key ('enc:') cannot be read here.
    let key = '';
    const stored = settings.get('cabinetKey') || '';
    if (stored.startsWith('dpapi:')) { try { key = await invoke('secret_unprotect', { data: stored.slice(6) }); } catch { key = ''; } }
    else if (stored.startsWith('plain:')) key = stored.slice(6);
    const keyStore = {
      get: () => key,
      async set(k) {
        key = k || '';
        if (!key) return settings.set({ cabinetKey: '' });
        try { settings.set({ cabinetKey: 'dpapi:' + await invoke('secret_protect', { text: key }) }); }
        catch { settings.set({ cabinetKey: 'plain:' + key }); }
      },
    };
    const fetchImpl = async (url, o = {}) => {
      const r = await invoke('http_request', { method: o.method || 'GET', url, headers: o.headers || {}, body: o.body ?? null, timeoutMs: o.timeoutMs || 15000 });
      return { status: r.status, json: async () => JSON.parse(r.body) };
    };
    let saving = Promise.resolve();
    const cabinet = new Cabinet('', {
      url: () => settings.get('cabinetUrl'), key: () => key, fetchImpl,
      storage: { load: () => saved, save: state => { const text = JSON.stringify(state); saving = saving.then(() => invoke('fs_write', { path: stateFile, text, base64: null })).catch(e => console.error('cabinet.json:', e)); } },
    });
    let running = null;
    const local = {
      running: () => running,
      async start() { const r = await invoke('cabinet_local_start', { port: Number(settings.get('cabinetLocalPort')) || 8080 }); running = { port: r.port, lan: r.lan }; return r; },
      async stop() { await invoke('cabinet_local_stop'); running = null; },
    };
    const rules = window.createCabinetRules({
      store, settings, A: window.Access, L: window.Logic, cabinet, files, keyStore, local,
      R: { pageModel, normalizeUrl, isLocalHost, KINDS },
      currentUser: () => core.currentUser(), userView: () => core.userView(),
      notify: text => invoke('notify', { body: text }).catch(() => {}), openExternal: url => invoke('open_url', { url }).catch(e => console.error(e)),
      changed: () => onCabinet(),
    });
    // The built-in server comes back with the app when it was on (as in Electron).
    if (settings.get('cabinetLocal')) local.start().then(() => onCabinet()).catch(e => console.error('Кабинет на этом компьютере:', e));
    return rules;
  }

  // The report, template and import code written for Node, loaded in the window (see prepare-ui.js).
  function reportCode() {
    const m = id => window.NodeModules.load(id);
    const { buildXlsx, buildCompositionXlsx } = m('report/xlsx.js'), { buildDocx } = m('report/docx.js');
    const { fillTemplate, TEMPLATES, TemplateError } = m('report/doc-template.js'), { readTableBytes, ImportError } = m('import/read.js');
    return { buildReport: m('report/model.js').buildReport, buildXlsx, buildDocx, buildCompositionXlsx, customerHtml: m('report/customer.js').customerHtml,
      fillTemplate, TEMPLATES, TemplateError, readTableBytes, ImportError, contactUrl: m('contact.js').contactUrl };
  }
  // `io` of src/core/files.js on top of the Rust commands; bytes travel as base64.
  function tauriIo(dirs) {
    const B = window.Buffer, P = window.NodeModules.load('node:path');
    const io = {
      saveDialog: ({ title, defaultPath, filters }) => invoke('dialog_save', { title, defaultPath: defaultPath || null, filters: filters || [] }),
      openDialog: ({ title, defaultPath, filters, directory }) => invoke('dialog_open', { title, defaultPath: defaultPath || null, filters: filters || [], directory: !!directory }),
      confirm: ({ title, message, detail, ok }) => invoke('dialog_confirm', { title: title || '', message, detail: detail || '', ok: ok || 'Да' }),
      writeFile: (path, data) => invoke('fs_write', typeof data === 'string' ? { path, text: data, base64: null } : { path, text: null, base64: B.from(data).toString('base64') }),
      readFile: async path => B.from(await invoke('fs_read', { path }), 'base64'),
      exists: path => invoke('fs_exists', { path: String(path || '') }),
      mkdir: path => invoke('fs_mkdir', { path }),
      copyFile: async (from, to) => io.writeFile(to, await io.readFile(from)),
      listDir: path => invoke('fs_list', { path }),
      remove: path => invoke('fs_remove', { path }),
      openPath: path => invoke('open_path', { path }),
      openExternal: url => invoke('open_url', { url }),
      // No print engine of our own: the page opens in the browser with its print dialog («Сохранить как PDF»).
      pdfViaBrowser: true,
      pdf: async html => { await invoke('print_html', { html }); return { ok: true, viaBrowser: true }; },
      asset: async rel => { const r = await fetch(rel); if (!r.ok) throw new Error('нет файла ' + rel); return B.from(await r.arrayBuffer()); },
      dirs: () => dirs,
      join: (...p) => P.join(...p), dirname: p => P.dirname(p), basename: p => P.basename(p), extname: p => P.extname(p),
    };
    return io;
  }

  window.TauriCore = { init };
})();

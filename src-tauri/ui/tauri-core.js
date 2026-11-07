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

  async function init({ onChanged }) {
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
    core.migrateUsers();
    try { chats.migrateProjectChats(); } catch (e) { console.error('Не удалось перенести чаты проектов:', e); }
    try { core.purgeTrash(); } catch (e) { console.error('Не удалось очистить корзину:', e); }
    await flush();

    const copied = loaded.copiedFrom
      ? `Проба Tauri работает на своей копии данных (${loaded.dir}), взятой из обычного Пульта. Обычный Пульт она не меняет.`
      : '';
    return { core, chats, files, store, settings, flush, warning: store.warning || copied || null };
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
      pdf: async html => { await invoke('print_html', { html }); return { ok: true, viaBrowser: true }; },
      asset: async rel => { const r = await fetch(rel); if (!r.ok) throw new Error('нет файла ' + rel); return B.from(await r.arrayBuffer()); },
      dirs: () => dirs,
      join: (...p) => P.join(...p), dirname: p => P.dirname(p), basename: p => P.basename(p), extname: p => P.extname(p),
    };
    return io;
  }

  window.TauriCore = { init };
})();

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
    core.migrateUsers();
    try { chats.migrateProjectChats(); } catch (e) { console.error('Не удалось перенести чаты проектов:', e); }
    try { core.purgeTrash(); } catch (e) { console.error('Не удалось очистить корзину:', e); }
    await flush();

    const copied = loaded.copiedFrom
      ? `Проба Tauri работает на своей копии данных (${loaded.dir}), взятой из обычного Пульта. Обычный Пульт она не меняет.`
      : '';
    return { core, chats, store, settings, flush, warning: store.warning || copied || null };
  }

  window.TauriCore = { init };
})();

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { COLLECTIONS, StoreError, isPlainObject, emptyData, fromParsed, snapshot, fromBackup, applyOp } = require('./core/store-core');
const BACKUPS_TO_KEEP = 30;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Antivirus or the indexer can briefly lock the target file on Windows; retry a few times.
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(from, to); return; }
    catch (e) {
      if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      sleepSync(50 * (attempt + 1));
    }
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1), 'utf8');
  renameWithRetry(tmp, file);
}

function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * All records live in one JSON file. The data set is small (hundreds of records),
 * so whole-file synchronous writes keep things simple and never interleave.
 */
class Store {
  constructor(dir, { now = () => new Date() } = {}) {
    this.dir = dir;
    this.file = path.join(dir, 'data.json');
    this.backupDir = path.join(dir, 'backups');
    this.now = now;
    this.warning = null;
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.data = this.load();
  }

  load() {
    let raw;
    try { raw = fs.readFileSync(this.file, 'utf8'); }
    catch (e) {
      if (e.code === 'ENOENT') return emptyData();
      throw e;
    }
    try {
      return fromParsed(JSON.parse(raw));
    } catch (e) {
      // Keep the broken file for manual recovery instead of overwriting it.
      const aside = path.join(this.dir, `data.corrupt-${this.now().getTime()}.json`);
      fs.renameSync(this.file, aside);
      this.warning = `Файл данных был повреждён и отложен как ${path.basename(aside)}. Последние копии лежат в папке backups.`;
      return emptyData();
    }
  }

  snapshot() {
    return snapshot(this.data);
  }

  // Replaces everything (restore from a backup). Records with invalid ids are skipped.
  replaceAll(raw) {
    const { data, count } = fromBackup(raw);
    this.backupOncePerDay();
    this.data = data;
    writeJsonAtomic(this.file, this.data);
    return count;
  }

  // Applies a batch with a single file write (an import can be hundreds of records).
  // Operations before a failing one stay applied and are saved, matching what the UI is sent.
  applyAll(ops) {
    let applied = 0;
    try {
      for (const op of ops) { this.apply(op, { save: false }); applied++; }
    } finally {
      if (applied) this.save();
    }
  }

  apply(op, { save = true } = {}) {
    applyOp(this.data, op);
    if (save) this.save();
  }

  save() {
    this.backupOncePerDay();
    writeJsonAtomic(this.file, this.data);
  }

  // Before the first change of the day, keep yesterday's state; protects against mistaken deletes.
  backupOncePerDay() {
    if (!fs.existsSync(this.file)) return;
    const target = path.join(this.backupDir, `data-${localDate(this.now())}.json`);
    if (fs.existsSync(target)) return;
    fs.copyFileSync(this.file, target);
    const old = fs.readdirSync(this.backupDir).filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - BACKUPS_TO_KEEP))) fs.unlinkSync(path.join(this.backupDir, f));
  }
}

class Settings {
  constructor(dir, defaults) {
    this.file = path.join(dir, 'settings.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* first run or unreadable: use defaults */ }
    this.values = { ...defaults, ...(isPlainObject(saved) ? saved : {}) };
  }
  get(key) { return this.values[key]; }
  set(patch) {
    Object.assign(this.values, patch);
    try { writeJsonAtomic(this.file, this.values); }
    catch (e) { console.error('Не удалось сохранить настройки окна:', e); }
  }
}

module.exports = { Store, Settings, StoreError, COLLECTIONS };

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const COLLECTIONS = ['projects', 'contractors', 'tasks', 'users', 'chats'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DOC_BYTES = 256 * 1024;
const BACKUPS_TO_KEEP = 30;

class StoreError extends Error {}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

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

function emptyData() {
  return { version: 1, projects: {}, contractors: {}, tasks: {}, users: {}, chats: {} };
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
      const parsed = JSON.parse(raw);
      if (!isPlainObject(parsed)) throw new Error('root is not an object');
      const data = emptyData();
      for (const col of COLLECTIONS) data[col] = isPlainObject(parsed[col]) ? parsed[col] : {};
      return data;
    } catch (e) {
      // Keep the broken file for manual recovery instead of overwriting it.
      const aside = path.join(this.dir, `data.corrupt-${this.now().getTime()}.json`);
      fs.renameSync(this.file, aside);
      this.warning = `Файл данных был повреждён и отложен как ${path.basename(aside)}. Последние копии лежат в папке backups.`;
      return emptyData();
    }
  }

  snapshot() {
    const out = {};
    for (const col of COLLECTIONS) {
      out[col] = Object.entries(this.data[col]).map(([id, doc]) => ({ ...doc, id }));
    }
    return out;
  }

  // Replaces everything (restore from a backup). Records with invalid ids are skipped.
  replaceAll(raw) {
    if (!isPlainObject(raw)) throw new StoreError('В файле нет данных программы.');
    const data = emptyData();
    let count = 0;
    for (const col of COLLECTIONS) {
      if (raw[col] !== undefined && !isPlainObject(raw[col])) throw new StoreError('Файл повреждён: неверная структура данных.');
      for (const [id, doc] of Object.entries(raw[col] || {})) {
        if (!ID_RE.test(id) || !isPlainObject(doc)) continue;
        const clean = JSON.parse(JSON.stringify(doc));
        delete clean.id;
        data[col][id] = clean;
        count++;
      }
    }
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
    if (!isPlainObject(op)) throw new StoreError('Некорректная операция.');
    const { type, col, id, data } = op;
    if (!COLLECTIONS.includes(col)) throw new StoreError(`Неизвестная коллекция: ${col}`);
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new StoreError('Некорректный идентификатор записи.');
    const docs = this.data[col];

    if (type === 'delete') {
      delete docs[id];
    } else if (type === 'set' || type === 'update') {
      if (!isPlainObject(data)) throw new StoreError('Данные записи должны быть объектом.');
      const clean = JSON.parse(JSON.stringify(data)); // drops functions/undefined, detaches from caller
      delete clean.id;
      if (type === 'update') {
        if (!docs[id]) throw new StoreError('Запись не найдена — возможно, её уже удалили.');
        Object.assign(clean, { ...docs[id], ...clean });
      }
      if (Buffer.byteLength(JSON.stringify(clean)) > MAX_DOC_BYTES) throw new StoreError('Запись слишком большая.');
      docs[id] = clean;
    } else {
      throw new StoreError(`Неизвестный тип операции: ${type}`);
    }
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

// The data set in memory: collections of records and the operations on them (set / update / delete).
// Pure, shared by the Electron store (src/store.js, which also writes the file) and the Tauri window
// (which asks the Rust core to write the file).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoreCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const COLLECTIONS = ['projects', 'contractors', 'tasks', 'users', 'chats', 'depts']; // depts — org structure (4.1)
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DOC_BYTES = 256 * 1024;

class StoreError extends Error {}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

const byteLength = s => new TextEncoder().encode(s).length;

function emptyData() {
  return { version: 1, projects: {}, contractors: {}, tasks: {}, users: {}, chats: {}, depts: {} };
}

// Parsed data.json → the data set; unknown or broken collections become empty. Throws if the root is not an object.
function fromParsed(parsed) {
  if (!isPlainObject(parsed)) throw new Error('root is not an object');
  const data = emptyData();
  for (const col of COLLECTIONS) data[col] = isPlainObject(parsed[col]) ? parsed[col] : {};
  return data;
}

function snapshot(data) {
  const out = {};
  for (const col of COLLECTIONS) out[col] = Object.entries(data[col]).map(([id, doc]) => ({ ...doc, id }));
  return out;
}

// A whole data set from a backup file; records with invalid ids are skipped. Returns { data, count }.
function fromBackup(raw) {
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
  return { data, count };
}

// Applies one operation to the data set in place.
function applyOp(data, op) {
  if (!isPlainObject(op)) throw new StoreError('Некорректная операция.');
  const { type, col, id } = op;
  if (!COLLECTIONS.includes(col)) throw new StoreError(`Неизвестная коллекция: ${col}`);
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new StoreError('Некорректный идентификатор записи.');
  const docs = data[col];

  if (type === 'delete') {
    delete docs[id];
  } else if (type === 'set' || type === 'update') {
    if (!isPlainObject(op.data)) throw new StoreError('Данные записи должны быть объектом.');
    const clean = JSON.parse(JSON.stringify(op.data)); // drops functions/undefined, detaches from caller
    delete clean.id;
    if (type === 'update') {
      if (!docs[id]) throw new StoreError('Запись не найдена — возможно, её уже удалили.');
      Object.assign(clean, { ...docs[id], ...clean });
    }
    if (byteLength(JSON.stringify(clean)) > MAX_DOC_BYTES) throw new StoreError('Запись слишком большая.');
    docs[id] = clean;
  } else {
    throw new StoreError(`Неизвестный тип операции: ${type}`);
  }
}

return { COLLECTIONS, ID_RE, MAX_DOC_BYTES, StoreError, isPlainObject, emptyData, fromParsed, snapshot, fromBackup, applyOp };
});

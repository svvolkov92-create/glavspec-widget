'use strict';

// Reads .xlsx and .csv into plain rows: [[cell, ...], ...]. Dates in date-formatted cells become 'YYYY-MM-DD'.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MAX_ROWS = 5000;
const MAX_COLS = 60;
const MAX_FILE = 30 * 1024 * 1024;

class ImportError extends Error {}

/* ---------- zip ---------- */
function readZip(buf) {
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const end = buf.lastIndexOf(sig);
  if (end < 0) throw new ImportError('Файл повреждён или это не книга Excel (.xlsx).');
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new ImportError('Файл повреждён: неверная структура архива.');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, csize, off });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return name => {
    const e = entries.get(name);
    if (!e) return null;
    const lnameLen = buf.readUInt16LE(e.off + 26), lextraLen = buf.readUInt16LE(e.off + 28);
    const data = buf.subarray(e.off + 30 + lnameLen + lextraLen, e.off + 30 + lnameLen + lextraLen + e.csize);
    if (e.method === 0) return data.toString('utf8');
    if (e.method === 8) return zlib.inflateRawSync(data).toString('utf8');
    throw new ImportError('Файл сжат неподдерживаемым способом. Пересохраните его в Excel.');
  };
}

/* ---------- tiny XML helpers (SpreadsheetML is regular enough) ---------- */
const decode = s => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'amp') return '&'; if (k === 'quot') return '"'; if (k === 'apos') return "'";
  return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
});
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };
// Text of an <si>/<is> element: concatenates all <t> runs, skipping phonetic <rPh> blocks.
const richText = xml => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map(m => decode(m[1] || '')).join('');

function colIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
function dateStyles(stylesXml) {
  const custom = new Map();
  for (const m of (stylesXml || '').matchAll(/<numFmt\b[^>]*>/g)) custom.set(Number(attr(m[0], 'numFmtId')), attr(m[0], 'formatCode') || '');
  const isDateFmt = id => BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && /[dmy]/i.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]/g, '')) && !/^[#0.,\s]+$/.test(custom.get(id)));
  const xfs = (stylesXml || '').match(/<cellXfs\b[\s\S]*?<\/cellXfs>/);
  const out = [];
  if (xfs) for (const m of xfs[0].matchAll(/<xf\b[^>]*\/?>/g)) out.push(isDateFmt(Number(attr(m[0], 'numFmtId') || 0)));
  return out;
}

function serialToIso(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5);
  return d.toISOString().slice(0, 10);
}

function readXlsx(buf) {
  const get = readZip(buf);
  const wb = get('xl/workbook.xml');
  if (!wb) throw new ImportError('В файле нет книги Excel. Это точно .xlsx?');
  const rels = get('xl/_rels/workbook.xml.rels') || '';
  const relTarget = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const shared = [...(get('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => richText(m[1]));
  const dates = dateStyles(get('xl/styles.xml'));

  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') || `Лист ${sheets.length + 1}`;
    const rid = attr(m[0], 'r:id');
    let target = relTarget.get(rid) || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = get(target);
    if (!xml) continue;
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const rNum = Number(attr('<row' + (rm[1] || ''), 'r')) || rows.length + 1;
      const row = [];
      for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = '<c' + cm[1];
        const ref = attr(tag, 'r');
        const ci = ref ? colIndex(ref) : row.length;
        if (ci >= MAX_COLS) continue;
        const t = attr(tag, 't'), s = Number(attr(tag, 's') || 0), inner = cm[2] || '';
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let value = '';
        if (t === 's') value = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') value = richText((inner.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
        else if (t === 'str') value = v !== undefined ? decode(v) : '';
        else if (t === 'b') value = v === '1';
        else if (t === 'e') value = '';
        else if (v !== undefined) {
          const n = Number(v);
          value = Number.isFinite(n) ? (dates[s] && n > 0 && n < 2958466 ? serialToIso(n) : n) : decode(v);
        }
        row[ci] = value;
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      while (rows.length < rNum - 1 && rows.length < MAX_ROWS) rows.push([]); // keep row positions
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/* ---------- csv ---------- */
function decodeText(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1251').decode(buf); } // Excel in Russian Windows saves CSV in cp1251
}

function readCsv(buf) {
  const text = decodeText(buf);
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = [';', '\t', ','].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row.slice(0, MAX_COLS)); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row.slice(0, MAX_COLS)); }
  return [{ name: 'CSV', rows }];
}

// The file's contents by its name (.xlsx / .csv); shared with the Tauri version, which reads the bytes itself.
function readTableBytes(name, buf) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.xls') throw new ImportError('Старый формат .xls не поддерживается. Откройте файл в Excel и сохраните как «Книга Excel (.xlsx)» или CSV.');
  if (buf.length > MAX_FILE) throw new ImportError('Файл слишком большой (больше 30 МБ).');
  if (ext === '.csv' || ext === '.txt') return readCsv(buf);
  if (ext === '.xlsx' || ext === '.xlsm') return readXlsx(buf);
  throw new ImportError('Поддерживаются файлы .xlsx и .csv.');
}

function readTable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xls') throw new ImportError('Старый формат .xls не поддерживается. Откройте файл в Excel и сохраните как «Книга Excel (.xlsx)» или CSV.');
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE) throw new ImportError('Файл слишком большой (больше 30 МБ).');
  return readTableBytes(filePath, fs.readFileSync(filePath));
}

module.exports = { readTable, readTableBytes, readXlsx, readCsv, ImportError };

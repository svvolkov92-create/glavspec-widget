'use strict';
// Fills the office's Word templates («Состав проектной документации», «Ведомость основных комплектов»):
// cover, title page and stamps stay exactly as drawn in the template; we change the document properties the
// template's fields are bound to (object, customer, cipher, title, year), the names in the stamps and the
// rows of the main table. Page numbers and «Листов» are Word fields — Word counts them when it opens the file.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createZip, xmlEsc } = require('./zip');

class TemplateError extends Error {}

// Built-in templates (the office's own, 2025–2026) and the texts in them that we replace.
// A template of the same name in <userData>/templates replaces the built-in one.
const TEMPLATES = {
  sp: { file: 'sp.docx', names: { gip: 'Сериков С.А.', gipShort: 'Сериков', director: 'Ковалев А.Л.', developer: 'Волков' }, stage: 'П' },
  vok: { file: 'vok.docx', names: { gip: 'Сериков С.А.', gipShort: 'Сериков', director: 'Ковалев А.Л.', developer: 'Волков' }, stage: 'П' },
};

function readZipRaw(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new TemplateError('Шаблон повреждён: это не файл Word (.docx).');
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new TemplateError('Шаблон повреждён: неверная структура архива.');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lname = buf.readUInt16LE(off + 26), lextra = buf.readUInt16LE(off + 28);
    const raw = buf.subarray(off + 30 + lname + lextra, off + 30 + lname + lextra + csize);
    if (method !== 0 && method !== 8) throw new TemplateError('Шаблон сжат неподдерживаемым способом — пересохраните его в Word.');
    if (!name.endsWith('/')) out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const esc = s => xmlEsc(String(s ?? ''));
const run = (text, rPr = '') => text ? `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>` : '';
const noIds = x => x.replace(/ w14:(paraId|textId)="[^"]*"/g, '').replace(/<w:highlight [^>]*\/>/g, '');

// Bound content controls: the cached text is set to the property value, so the file reads right even
// where Word does not refresh bindings (and in other programs).
function setBound(xml, values) {
  return xml.replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, sdt => {
    const m = sdt.match(/w:xpath="[^"]*?(\w+)\[1\]"/);
    if (!m || !(m[1] in values)) return sdt;
    let first = true;
    return sdt.replace(/(<w:sdtContent>)([\s\S]*?)(<\/w:sdtContent>)/, (_a, open, body, close) =>
      open + body.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, () => { const v = first ? values[m[1]] : ''; first = false; return `<w:t xml:space="preserve">${esc(v)}</w:t>`; }) + close);
  });
}
function setCore(xml, props) {
  for (const [tag, v] of Object.entries(props)) {
    const re = new RegExp(`<(${tag})(\\s[^>]*)?>[\\s\\S]*?</${tag}>|<${tag}(\\s[^>]*)?/>`);
    if (re.test(xml)) xml = xml.replace(re, `<${tag}>${esc(v)}</${tag}>`);
    else xml = xml.replace('</cp:coreProperties>', `<${tag}>${esc(v)}</${tag}></cp:coreProperties>`);
  }
  return xml;
}
const replaceAllText = (xml, from, to) => (from && to && from !== to ? xml.split(`>${esc(from)}<`).join(`>${esc(to)}<`) : xml);

/**
 * Builds the table rows from the template's own first data row.
 * rows: { tom, code, label?, title, note, heading? } — label is printed bold before «title» in quotes
 * («Раздел 5 «…»»); without label the title is plain. A code starting with the cipher prefix keeps the
 * bound «Ключевые слова» field for the prefix, so changing the cipher in Word changes every row.
 */
function buildRows(tableXml, rows, prefix) {
  const trs = tableXml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
  const headerCount = trs.findIndex(r => !/<w:tblHeader\/>/.test(r));
  if (headerCount < 1 || trs.length < headerCount + 2) throw new TemplateError('В шаблоне не найдена таблица со строкой заголовка и строками данных.');
  const keep = trs.slice(0, headerCount + 1); // header row(s) and the document's own line («…-СП», «…-ВОК»)
  const tpl = noIds(trs[headerCount + 1]);
  const cells = tpl.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
  if (cells.length < 4) throw new TemplateError('В таблице шаблона должно быть 4 столбца: номер тома, обозначение, наименование, примечание.');
  const trPr = (tpl.match(/<w:trPr>[\s\S]*?<\/w:trPr>/) || [''])[0];
  const parts = cells.map(c => ({ tcPr: (c.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0], pPr: (c.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0] }));
  const sdt = (cells[1].match(/<w:sdt>[\s\S]*?keywords[\s\S]*?<\/w:sdt>/) || [''])[0];
  const cell = (i, inner, heading) => `<w:tc>${heading ? parts[i].tcPr.replace(/<w:bottom [^>]*\/>/, '') : parts[i].tcPr}<w:p>${parts[i].pPr}${inner}</w:p></w:tc>`;
  const codeRuns = code => {
    if (!code) return '';
    if (sdt && prefix && code.startsWith(prefix)) return setBound(sdt, { keywords: prefix }) + run(code.slice(prefix.length));
    return run(code);
  };
  const made = rows.map(r => {
    const name = r.label ? run(r.label, '<w:rPr><w:b/></w:rPr>') + run(` «${r.title}»`) : run(r.title);
    return `<w:tr>${trPr}${cell(0, run(r.tom), r.heading)}${cell(1, codeRuns(r.code), r.heading)}${cell(2, name, r.heading)}${cell(3, run(r.note), r.heading)}</w:tr>`;
  });
  const start = tableXml.indexOf(trs[0]);
  const endIdx = tableXml.lastIndexOf(trs.at(-1)) + trs.at(-1).length;
  return tableXml.slice(0, start) + keep.join('') + made.join('') + tableXml.slice(endIdx);
}

/**
 * @param {Buffer} buf  template .docx
 * @param {object} o
 * @param {string} o.prefix    cipher with the trailing dash: «04-12-23-2-»
 * @param {string} o.object    object name (with «»)
 * @param {string} o.customer  customer (full name of the organisation)
 * @param {string} o.year      «2026»
 * @param {object} o.names     { gip, gipShort, director, developer } — new values; o.from — template values
 * @param {string} o.stage     «П» / «Р»; o.fromStage — the letter in the template's stamp
 * @param {object[]} o.rows    table rows, see buildRows
 */
function fillTemplate(buf, o) {
  const entries = readZipRaw(buf);
  const get = n => entries.find(e => e.name === n);
  const doc = get('word/document.xml');
  if (!doc) throw new TemplateError('Шаблон повреждён: нет word/document.xml.');
  const bound = { keywords: o.prefix, title: o.object, description: o.customer, CompanyFax: `${o.year}г.` };
  for (const e of entries) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)) continue;
    let x = e.data.toString('utf8');
    x = setBound(x, bound);
    if (e.name === 'word/document.xml') {
      const tables = x.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
      const main = tables.find(t => /<w:tblHeader\/>/.test(t) && /Обозначение/.test(t));
      if (!main) throw new TemplateError('В шаблоне не найдена таблица «Номер тома / Обозначение / Наименование / Примечание».');
      x = x.replace(main, buildRows(main, o.rows, o.prefix));
    }
    // Names: the full form first, then the surname alone (stamps). Only whole text runs are replaced.
    const from = o.from || {}, to = o.names || {};
    for (const k of ['gip', 'director', 'developer', 'gipShort']) x = replaceAllText(x, from[k], to[k]);
    if (/^word\/footer\d*\.xml$/.test(e.name) && o.stage && o.fromStage && o.stage !== o.fromStage) {
      x = x.replace(new RegExp(`(<w:t(?: [^>]*)?>)${o.fromStage}(</w:t>)`, 'g'), `$1${esc(o.stage)}$2`);
    }
    e.data = Buffer.from(x, 'utf8');
  }
  const core = get('docProps/core.xml');
  if (core) {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    core.data = Buffer.from(setCore(core.data.toString('utf8'), { 'dc:title': o.object, 'cp:keywords': o.prefix, 'dc:description': o.customer })
      .replace(/<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`), 'utf8');
  }
  for (const e of entries) if (/^customXml\/item\d+\.xml$/.test(e.name)) {
    const x = e.data.toString('utf8');
    if (x.includes('<CompanyFax>')) e.data = Buffer.from(x.replace(/<CompanyFax>[^<]*<\/CompanyFax>/, `<CompanyFax>${esc(o.year)}г.</CompanyFax>`), 'utf8');
  }
  return createZip(entries);
}

// The template file: the user's own in <userData>/templates/<kind>.docx, else the built-in one.
function templateFile(kind, userDir) {
  const t = TEMPLATES[kind];
  if (!t) throw new TemplateError('Неизвестный шаблон.');
  const own = userDir && path.join(userDir, t.file);
  return own && fs.existsSync(own) ? { ...t, file: own, own: true } : { ...t, file: path.join(__dirname, 'templates', t.file), own: false };
}

module.exports = { fillTemplate, templateFile, readZipRaw, TemplateError, TEMPLATES };

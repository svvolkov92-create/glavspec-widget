'use strict';

// Testing aid: notes on interface elements for the developer, with a screenshot of each element.
// Kept apart from the data (feedback/ next to data.json) so it can be removed without touching the database.
const fs = require('node:fs');
const path = require('node:path');
const { createZip } = require('./report/zip');

const ID_RE = /^[a-z0-9]{6,40}$/;

class Feedback {
  constructor(dir) {
    this.dir = path.join(dir, 'feedback');
    this.file = path.join(this.dir, 'notes.json');
    fs.mkdirSync(path.join(this.dir, 'img'), { recursive: true });
  }

  list() {
    try {
      const v = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  save(list) {
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(list, null, 1), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
  }

  // `png` — Buffer of the element screenshot (optional).
  add(note, png) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const entry = { ...clean(note), id, ts: new Date().toISOString() };
    if (png && png.length) {
      entry.image = `img/${id}.png`;
      fs.writeFileSync(path.join(this.dir, entry.image), png);
    }
    const list = this.list();
    list.push(entry);
    this.save(list);
    return entry;
  }

  update(id, text) {
    const list = this.list();
    const e = list.find(x => x.id === id);
    if (!e) return false;
    e.comment = String(text || '').slice(0, 4000);
    e.edited = new Date().toISOString();
    this.save(list);
    return true;
  }

  remove(id) {
    if (!ID_RE.test(id)) return false;
    const list = this.list();
    const e = list.find(x => x.id === id);
    if (!e) return false;
    if (e.image) fs.rmSync(path.join(this.dir, e.image), { force: true });
    this.save(list.filter(x => x.id !== id));
    return true;
  }

  clear() {
    for (const e of this.list()) if (e.image) fs.rmSync(path.join(this.dir, e.image), { force: true });
    this.save([]);
  }

  // One archive for the developer: readable notes.md, machine-readable notes.json and the screenshots.
  exportZip(meta = {}) {
    const list = this.list();
    const md = [`# Пометки по интерфейсу «Пульт главспеца»`, '',
      `Версия программы: ${meta.version || '—'} · выгружено ${new Date().toLocaleString('ru-RU')} · пометок: ${list.length}`, ''];
    list.forEach((e, i) => {
      md.push(`## ${i + 1}. ${e.label || e.kind || 'Элемент'}`, '',
        `- Когда: ${new Date(e.ts).toLocaleString('ru-RU')}${e.user ? ` · пользователь: ${e.user} (${e.role || ''})` : ''}`,
        `- Где: ${e.where || '—'}`,
        `- Элемент: \`${e.selector || '—'}\``,
        ...(e.text ? [`- Текст элемента: «${e.text}»`] : []),
        ...(e.image ? [`- Скриншот: ${e.image}`, '', `![](${e.image})`] : []),
        '', '**Комментарий:**', '', e.comment || '_(пусто)_', '');
    });
    const files = [
      { name: 'notes.md', data: md.join('\n') },
      { name: 'notes.json', data: JSON.stringify({ app: 'glavspec-widget', version: meta.version, exportedAt: new Date().toISOString(), notes: list }, null, 1) },
    ];
    for (const e of list) {
      if (!e.image) continue;
      try { files.push({ name: e.image, data: fs.readFileSync(path.join(this.dir, e.image)) }); } catch { /* screenshot missing: the note still goes */ }
    }
    return { zip: createZip(files), count: list.length };
  }
}

function clean(n) {
  const s = (v, max) => String(v ?? '').slice(0, max);
  const r = n && n.rect ? n.rect : null;
  return {
    comment: s(n?.comment, 4000), label: s(n?.label, 200), text: s(n?.text, 300), selector: s(n?.selector, 500),
    where: s(n?.where, 300), kind: s(n?.kind, 40), user: s(n?.user, 120), role: s(n?.role, 40),
    rect: r ? { x: Math.round(+r.x || 0), y: Math.round(+r.y || 0), width: Math.round(+r.width || 0), height: Math.round(+r.height || 0) } : null,
  };
}

module.exports = { Feedback };

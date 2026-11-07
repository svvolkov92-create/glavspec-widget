'use strict';

// Action journal: one JSON line per changed record, appended after every write.
// Kept apart from data.json, so undo, restore from a backup or a broken data file never touch it.
const fs = require('node:fs');
const path = require('node:path');
const { describe, diffBatch, batchLines } = require('./core/journal-diff');

const MAX_BYTES = 8 * 1024 * 1024;   // when exceeded, the older half is dropped

class Journal {
  constructor(dir) {
    this.file = path.join(dir, 'journal.jsonl');
  }

  append(entries, meta = {}) {
    if (!entries.length) return;
    const lines = batchLines(entries, meta).map(l => JSON.stringify(l)).join('\n') + '\n';
    try {
      fs.appendFileSync(this.file, lines, 'utf8');
      if (fs.statSync(this.file).size > MAX_BYTES) this.trim();
    } catch (e) {
      console.error('Не удалось записать журнал:', e.message); // the journal must never block saving data
    }
  }

  trim() {
    const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
    fs.writeFileSync(this.file + '.tmp', lines.slice(Math.floor(lines.length / 2)).join('\n') + '\n', 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
  }

  // Newest first; `since` is an ISO timestamp.
  read({ since = '', limit = 3000 } = {}) {
    let text;
    try { text = fs.readFileSync(this.file, 'utf8'); } catch { return []; }
    const out = [];
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      if (!lines[i]) continue;
      try {
        const e = JSON.parse(lines[i]);
        if (since && e.ts < since) break;
        out.push(e);
      } catch { /* a torn last line after a crash: skip it */ }
    }
    return out;
  }
}

module.exports = { Journal, describe, diffBatch };

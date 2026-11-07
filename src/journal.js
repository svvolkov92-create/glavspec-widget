'use strict';

// Action journal: one JSON line per changed record, appended after every write.
// Kept apart from data.json, so undo, restore from a backup or a broken data file never touch it.
const fs = require('node:fs');
const path = require('node:path');
const L = require('./renderer/logic');

const MAX_BYTES = 8 * 1024 * 1024;   // when exceeded, the older half is dropped
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const money = n => nf.format(Number(n) || 0) + ' ₽';
const date = v => (L.isDate(v) ? L.fmtDate(v) : '—');
const yesNo = v => (v ? 'да' : 'нет');
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function titleOf(col, doc, ctx) {
  if (!doc) return '';
  if (col === 'tasks') {
    const p = ctx.projects[doc.projectId];
    return `${L.sectionsOf(doc).join(', ') || '—'}${p ? ' · ' + p.name : ''}`;
  }
  return doc.name || '';
}

// Field → how to label and show it. Fields not listed (history, createdAt…) are not journaled.
const FIELDS = {
  tasks: {
    status: ['Статус', v => L.STATUSES[v]?.label || '—'],
    readiness: ['Готовность', v => (v == null ? '—' : `${v} %`)],
    start: ['Старт', date],
    finish: ['Финиш', date],
    contractorId: ['Исполнитель', (v, ctx) => ctx.contractors[v]?.name || 'не назначен'],
    ownerId: ['Ответственный', (v, ctx) => ctx.users?.[v]?.name || 'не назначен'],
    coOwnerIds: ['Соисполнители', (v, ctx) => (Array.isArray(v) && v.length ? v.map(id => ctx.users?.[id]?.name || '?').join(', ') : 'нет')],
    profileOk: ['Назначено не по специальности', yesNo],
    projectId: ['Проект', (v, ctx) => ctx.projects[v]?.name || '—'],
    sections: ['Марки', v => (Array.isArray(v) ? v.join(', ') : '—')],
    title: ['Уточнение', v => v || '—'],
    budget: ['Бюджет', money],
    contractNo: ['Договор', v => v || '—'],
    invoiceReceived: ['Счёт получен', yesNo],
    actSigned: ['Акт подписан', yesNo],
    note: ['Примечание', () => 'изменено'],
    plan: ['График платежей', v => (Array.isArray(v) && v.length ? `${v.length} платеж(а/ей)` : 'нет')],
    dependsOn: ['Зависимости', v => (Array.isArray(v) && v.length ? `${v.length}` : 'нет')],
  },
  projects: {
    name: ['Название', v => v || '—'], code: ['Шифр', v => v || '—'], client: ['Заказчик', v => v || '—'],
    folder: ['Папка', v => v || '—'], archived: ['В архиве', yesNo], note: ['Примечание', () => 'изменено'],
  },
  users: {
    name: ['Имя', v => v || '—'],
    role: ['Роль', v => ({ gip: 'ГИП', chief: 'Главспец', specialist: 'Специалист' }[v] || '—')],
    directions: ['Направления', v => (Array.isArray(v) && v.length ? v.join(', ') : '—')],
    chiefId: ['Руководитель', (v, ctx) => ctx.users?.[v]?.name || '—'],
    canSeeBudget: ['Доступ к бюджету', yesNo],
    absences: ['Отсутствия', v => (Array.isArray(v) && v.length ? v.map(a => `${date(a.from)}–${date(a.to)}`).join(', ') : 'нет')],
    phone: ['Телефон', v => v || '—'], email: ['Почта', v => v || '—'], messenger: ['Мессенджер', v => v || '—'],
  },
  contractors: {
    name: ['ФИО', v => v || '—'], specialty: ['Специализация', v => v || '—'], phone: ['Телефон', v => v || '—'],
    email: ['Почта', v => v || '—'], messenger: ['Мессенджер', v => v || '—'], requisites: ['Реквизиты', () => 'изменено'],
    note: ['Примечание', () => 'изменено'],
  },
};

function paymentChanges(before = [], after = []) {
  const ids = new Set(before.map(p => p.id));
  const kept = new Set(after.map(p => p.id));
  const out = [];
  for (const p of after) if (!ids.has(p.id)) out.push({ f: 'payment', label: 'Платёж внесён', to: `${money(p.amount)}${p.note ? ` (${p.note})` : ''} от ${date(p.date)}` });
  for (const p of before) if (!kept.has(p.id)) out.push({ f: 'payment', label: 'Платёж удалён', from: `${money(p.amount)}${p.note ? ` (${p.note})` : ''} от ${date(p.date)}` });
  return out;
}
function milestoneChanges(before = [], after = []) {
  const prev = new Map(before.map(m => [m.id, m]));
  const out = [];
  for (const m of after) {
    const p = prev.get(m.id);
    if (!p) out.push({ f: 'milestone', label: 'Контрольная точка добавлена', to: `${m.title} — ${date(m.date)}` });
    else if (!p.done && m.done) out.push({ f: 'milestone', label: 'Контрольная точка выполнена', to: m.title });
    else if (p.date !== m.date) out.push({ f: 'milestone', label: `КТ «${m.title}»`, from: date(p.date), to: date(m.date) });
  }
  const now = new Set(after.map(m => m.id));
  for (const m of before) if (!now.has(m.id)) out.push({ f: 'milestone', label: 'Контрольная точка удалена', from: m.title });
  return out;
}

// One journal entry for a record that changed between `before` and `after` (either may be null).
function describe(col, id, before, after, ctx) {
  if (same(before, after)) return null;
  let kind;
  if (!before && after) kind = 'create';
  else if (before && !after) kind = 'delete';
  else if (!before.deletedAt && after.deletedAt) kind = 'trash';
  else if (before.deletedAt && !after.deletedAt) kind = 'restore';
  else kind = 'update';
  const entry = { col, id, kind, title: titleOf(col, after || before, ctx) };
  if (kind === 'update') {
    const changes = [];
    for (const [f, [label, show]] of Object.entries(FIELDS[col] || {})) {
      if (!same(before[f], after[f])) changes.push({ f, label, from: show(before[f], ctx), to: show(after[f], ctx) });
    }
    if (col === 'tasks') changes.push(...paymentChanges(before.payments, after.payments), ...milestoneChanges(before.milestones, after.milestones));
    if (!changes.length) return null; // only bookkeeping fields changed
    entry.changes = changes;
  }
  if (kind === 'create' && col === 'tasks') {
    const c = ctx.contractors[after.contractorId];
    entry.changes = [{ f: 'summary', label: 'Карточка', to: `${c ? c.name : 'без подрядчика'} · ${date(after.start)} → ${date(after.finish)} · ${money(after.budget)}` }];
  }
  return entry;
}

class Journal {
  constructor(dir) {
    this.file = path.join(dir, 'journal.jsonl');
  }

  append(entries, { action = '', undo = false, user = '' } = {}) {
    if (!entries.length) return;
    const ts = new Date().toISOString();
    const batch = ts + '-' + Math.random().toString(36).slice(2, 7);
    const lines = entries.map(e => JSON.stringify({ ts, batch, action, user: user || undefined, undo: undo || undefined, ...e })).join('\n') + '\n';
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

// Builds entries for a batch of ops given record states before and after.
function diffBatch(ops, beforeOf, afterOf, ctx) {
  const seen = new Set(), out = [];
  for (const o of ops) {
    const key = o.col + '/' + o.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = describe(o.col, o.id, beforeOf(o.col, o.id), afterOf(o.col, o.id), ctx);
    if (e) out.push(e);
  }
  return out;
}

module.exports = { Journal, describe, diffBatch };

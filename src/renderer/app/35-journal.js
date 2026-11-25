async function openJournal() {
  setFileMenu(false);
  state.drawer = { kind: 'journal' };
  state.journal = state.journal || { period: '7', type: 'all', q: '', entries: [] };
  drawerShell({ title: 'Журнал действий', wide: true, form: false, body: '<div id="jr-box"><div class="hint">Загружаем…</div></div>' });
  await loadJournal();
}
async function loadJournal() {
  const j = state.journal;
  const since = j.period === 'all' ? '' : new Date(new Date().setHours(0, 0, 0, 0) - (Number(j.period) - 1) * 864e5).toISOString();
  try { j.entries = await api.getJournal(since); } catch { j.entries = []; }
  renderJournal();
}
function journalMatches(e, j) {
  if (j.type === 'tasks' && e.col !== 'tasks') return false;
  if (j.type === 'projects' && !['projects', 'remarks', 'letters'].includes(e.col)) return false;
  if (j.type === 'contractors' && e.col !== 'contractors') return false;
  if (j.type === 'payments' && !(e.changes || []).some(c => c.f === 'payment' || c.f === 'plan' || c.f === 'invoiceReceived' || c.f === 'actSigned')) return false;
  if (j.type === 'dates' && !(e.changes || []).some(c => c.f === 'start' || c.f === 'finish' || c.f === 'milestone')) return false;
  if (j.q) {
    const hay = [e.title, e.action, e.user, ...(e.changes || []).flatMap(c => [c.label, c.from, c.to])].join(' ').toLowerCase();
    if (!j.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}
function journalSummary(entries) {
  const today = entries.filter(e => e.ts.slice(0, 10) === new Date().toISOString().slice(0, 10) || new Date(e.ts).toDateString() === new Date().toDateString());
  const count = f => today.filter(f).length;
  const pays = today.flatMap(e => (e.changes || []).filter(c => c.label === 'Платёж внесён'));
  const sum = pays.reduce((a, c) => a + (parseMoney(String(c.to).split(' ₽')[0]) || 0), 0);
  const bits = [
    [count(e => e.kind === 'create' && e.col === 'tasks'), n => plural(n, 'новая карточка', 'новые карточки', 'новых карточек')],
    [count(e => (e.changes || []).some(c => c.f === 'finish')), n => plural(n, 'перенос срока', 'переноса срока', 'переносов срока')],
    [count(e => (e.changes || []).some(c => c.f === 'status' && c.to === 'Принят')), n => plural(n, 'работа принята', 'работы приняты', 'работ принято')],
    [pays.length, n => `${plural(n, 'платёж', 'платежа', 'платежей')} на ${money(sum)}`],
    [count(e => e.kind === 'trash'), () => 'в корзину'],
  ].filter(([n]) => n > 0).map(([n, l]) => `<span><b>${n}</b> ${l(n)}</span>`);
  return bits.length ? `<div class="jr-sum"><span class="vm-h">Сегодня</span>${bits.join('')}</div>` : '<div class="jr-sum hint">Сегодня изменений ещё не было.</div>';
}
function renderJournal() {
  const box = $('#jr-box');
  if (!box) return;
  const j = state.journal;
  const list = j.entries.filter(e => journalMatches(e, j));
  // Group by day, and collapse big batches (an import, a restore) into one line.
  const days = new Map();
  for (const e of list) {
    const d = new Date(e.ts);
    const key = d.toDateString();
    if (!days.has(key)) days.set(key, { d, batches: new Map() });
    const bs = days.get(key).batches;
    if (!bs.has(e.batch)) bs.set(e.batch, []);
    bs.get(e.batch).push(e);
  }
  const time = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const entryHtml = e => {
    const live = e.col === 'tasks' ? state.tasks.has(e.id) : e.col === 'projects' ? state.projects.has(e.id) : e.col === 'contractors' ? state.contractors.has(e.id) : false;
    const act = e.col === 'tasks' ? 'open-task' : e.col === 'projects' ? 'open-project' : e.col === 'contractors' ? 'open-contractor' : '';
    const colLabel = { tasks: 'карточка', projects: 'проект', contractors: 'подрядчик', users: 'сотрудник', orgs: 'контрагент', remarks: 'экспертиза', letters: 'письмо', all: 'база' }[e.col] || '';
    return `<div class="jr-item">
      <span class="num hint jr-time">${time(e.ts)}</span>
      <div class="jr-main">
        <div class="jr-line"><span class="chip tone-${e.kind === 'trash' || e.kind === 'delete' ? 'bad' : e.kind === 'create' ? 'ok' : e.undo ? 'warn' : 'idle'}">${esc(colLabel)} · ${esc(e.undo ? 'отмена' : KIND_LABEL[e.kind] || e.kind)}</span>
          ${live && act ? `<button class="jr-title" type="button" data-act="${act}" data-id="${esc(e.id)}">${esc(e.title || '—')}</button>` : `<b class="jr-title-static">${esc(e.title || '—')}</b>`}
          ${e.action ? `<span class="hint">· ${esc(e.action)}</span>` : ''}${e.user ? `<span class="hint jr-user">· ${esc(e.user)}</span>` : ''}</div>
        ${(e.changes || []).length ? `<ul class="jr-ch">${e.changes.map(c => `<li><span class="hint">${esc(c.label)}:</span> ${c.from !== undefined ? `${esc(c.from)} → ` : ''}<b>${esc(c.to ?? '')}</b></li>`).join('')}</ul>` : ''}
      </div></div>`;
  };
  const body = [...days.values()].map(({ d, batches }) => `<section class="jr-day"><h3>${d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
    ${[...batches.values()].map(es => es.length > 4
      ? `<details class="jr-batch"><summary><span class="num hint jr-time">${time(es[0].ts)}</span> <b>${esc(es[0].action || 'Групповое изменение')}</b> <span class="hint">— записей: ${es.length}</span></summary>${es.map(entryHtml).join('')}</details>`
      : es.map(entryHtml).join('')).join('')}</section>`).join('');
  box.innerHTML = `${journalSummary(j.entries)}
    <div class="filters jr-filters">
      <div class="seg">${JOURNAL_PERIODS.map(([k, l]) => `<button class="btn sm ${j.period === k ? 'on' : ''}" type="button" data-act="jr-period" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="seg">${JOURNAL_TYPES.map(([k, l]) => `<button class="btn sm ${j.type === k ? 'on' : ''}" type="button" data-act="jr-type" data-v="${k}">${l}</button>`).join('')}</div>
      <input id="jr-q" type="search" placeholder="Поиск в журнале" value="${esc(j.q)}">
    </div>
    ${body || `<div class="none">${j.entries.length ? 'Под фильтр ничего не попало.' : 'За этот период изменений нет. Журнал ведётся с версии 1.6.'}</div>`}`;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'open-journal': () => { openJournal(); },
  'jr-period': ({ el }) => { state.journal.period = el.dataset.v; loadJournal(); },
  'jr-type': ({ el }) => { state.journal.type = el.dataset.v; renderJournal(); },
});

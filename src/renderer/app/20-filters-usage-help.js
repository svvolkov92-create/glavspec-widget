/* ---------- saved filters ---------- */
const EMPTY_FILTERS = { project: '', contractor: '', status: '', mark: '', q: '', owner: '' };
const BUILTIN_PRESETS = [
  { id: 'b-mine', name: 'Мои', f: { owner: 'me' } },
  { id: 'b-overdue', name: 'Сорванные', f: { status: 'overdue' } },
  { id: 'b-new', name: 'Новое для меня', f: { status: 'new' } },
  { id: 'b-review', name: 'На проверке', f: { status: 'review' } },
];
let presets = loadLocal('presets', []);
const sameFilters = (a, b) => Object.keys(EMPTY_FILTERS).every(k => (a[k] || '') === (b[k] || ''));
// Saved filters as one compact list at the start of the filter row.
function presetBar() {
  const cur = state.filters, all = [...BUILTIN_PRESETS, ...presets];
  const isEmptyF = sameFilters(cur, EMPTY_FILTERS);
  const on = all.find(p => sameFilters(cur, { ...EMPTY_FILTERS, ...p.f }));
  return `<select id="f-preset" class="preset-sel" aria-label="Подборка" title="Готовые и сохранённые подборки фильтров"><option value="">${on ? '' : isEmptyF ? 'Подборки…' : 'Свой фильтр'}</option>
      <optgroup label="Готовые">${BUILTIN_PRESETS.map(p => `<option value="${esc(p.id)}"${on?.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
      ${presets.length ? `<optgroup label="Сохранённые">${presets.map(p => `<option value="${esc(p.id)}"${on?.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''}</select>
    ${on && !on.id.startsWith('b-') ? `<button class="btn ghostbtn sm" type="button" data-act="preset-del" data-id="${esc(on.id)}" title="Удалить сохранённую подборку">✕</button>` : ''}
    ${isEmptyF || on ? '' : '<button class="btn ghostbtn sm" type="button" data-act="preset-save" title="Сохранить текущие фильтры как подборку">＋</button>'}
    ${isEmptyF ? '' : '<button class="btn ghostbtn sm" type="button" data-act="preset-reset" title="Сбросить фильтры">Сбросить</button>'}`;
}
function applyPreset(id) {
  const p = [...BUILTIN_PRESETS, ...presets].find(x => x.id === id);
  if (!p) return;
  state.filters = sameFilters(state.filters, { ...EMPTY_FILTERS, ...p.f }) ? { ...EMPTY_FILTERS } : { ...EMPTY_FILTERS, ...p.f };
  renderNow();
}
async function savePreset() {
  const name = await askText('Сохранить фильтр', 'Название', 'Например: ВК по складу');
  if (!name) return;
  presets = [...presets, { id: newId(), name: name.slice(0, 40), f: { ...state.filters } }];
  saveLocal('presets', presets);
  renderNow();
}
function deletePreset(id) {
  presets = presets.filter(p => p.id !== id);
  saveLocal('presets', presets);
  renderNow();
}

/* ---------- usage statistics: what is actually used (kept only on this computer) ---------- */
const usage = { since: new Date().toISOString(), n: {}, ...loadLocal('usage', {}) };
let usageTimer = null;
function track(key) {
  usage.n[key] = (usage.n[key] || 0) + 1;
  clearTimeout(usageTimer);
  usageTimer = setTimeout(() => saveLocal('usage', usage), 1000);
}
// Features worth judging; anything else counted is listed under «Прочее».
const FEATURES = [
  ['tab:overview', 'Вкладка «Сводка»'], ['tab:projects', 'Вкладка «Проекты»'], ['tab:people', 'Вкладка «Люди»'], ['tab:gantt', 'Вкладка «Диаграмма Ганта»'],
  ['tab:kanban', 'Вкладка «Канбан»'], ['tab:tasks', 'Вкладка «Все карточки»'], ['act:people-mode', 'Люди: «Структура / Карточки»'],
  ['act:open-task', 'Открыть карточку'], ['act:new-task', 'Новая карточка'], ['act:quick', 'Быстрые действия (сдал / принять / замечания)'], ['edit:cell', 'Правка прямо в таблице'],
  ['act:task-step', 'Соседняя карточка ‹ ›'], ['act:drawer-wide', 'Карточка на всё окно'], ['act:talk-send', 'Сообщение в обсуждении'], ['act:msg-copy', 'Текст для исполнителя (копировать)'],
  ['act:msg-send', 'Текст для подрядчика (отправить)'], ['act:move-task', 'Передать карточку (кнопка)'], ['drop:move', 'Передать карточку (перетаскиванием)'],
  ['act:absences', 'Отпуска и больничные'], ['act:counter', 'Счётчики в заголовке'], ['act:preset', 'Готовые и свои фильтры'], ['act:preset-save', 'Сохранить свой фильтр'],
  ['act:weekly', 'Сводка за неделю'], ['act:export', 'Отчёт Excel / Word'], ['act:import', 'Импорт из Excel / CSV'], ['act:open-journal', 'Журнал действий'],
  ['act:open-search', 'Поиск (кнопка)'], ['key:search', 'Поиск (Ctrl+K)'], ['key:undo', 'Отменить (Ctrl+Z)'], ['act:open-trash', 'Корзина'],
  ['act:g-group', 'Ганта: группировка'], ['act:g-scale', 'Ганта: масштаб'], ['drag:gantt', 'Ганта: перетаскивание полосок'], ['act:kb-lanes', 'Канбан: дорожки по ответственным'],
  ['drop:kanban', 'Канбан: перетаскивание'], ['act:fold', 'Свернуть / развернуть блок'], ['act:fold-all', 'Свернуть / развернуть все'], ['act:prog-weight', 'Дашборд: по карточкам / по бюджету'],
  ['act:toggle-compact', 'Компактный режим'], ['act:ghost-on', 'Сквозные клики'], ['act:toggle-max', 'На весь экран'], ['act:settings', 'Окно «Настройки»'], ['key:help', 'Справка F1'],
];
function openUsage() {
  setFileMenu(false);
  const days = Math.max(1, Math.round((Date.now() - Date.parse(usage.since)) / 864e5));
  const known = new Map(FEATURES);
  const used = FEATURES.filter(([k]) => usage.n[k]).sort((a, b) => usage.n[b[0]] - usage.n[a[0]]);
  const unused = FEATURES.filter(([k]) => !usage.n[k]);
  const max = Math.max(1, ...used.map(([k]) => usage.n[k]));
  const root = document.createElement('div');
  root.className = 'modal-back usage-modal';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">Статистика использования</h2>
    <p class="hint">С ${fmtDate(usage.since.slice(0, 10))} (${days} дн.). Считается только на этом компьютере и никуда не отправляется — чтобы понять, что в программе нужно, а что можно убрать.</p>
    <h3 class="help-h">Пользуетесь</h3>${used.length ? `<table class="help-t">${used.map(([k, l]) => `<tr><td>${esc(l)}</td><td class="us-bar"><i style="width:${Math.round((usage.n[k] / max) * 100)}%"></i></td><td class="r num">${usage.n[k]}</td></tr>`).join('')}</table>` : '<p class="hint">Пока ничего не набралось.</p>'}
    <h3 class="help-h">Ни разу за этот период</h3><p class="us-unused">${unused.map(([, l]) => `<span class="chip tone-idle">${esc(l)}</span>`).join(' ') || '—'}</p>
    <div class="modal-f"><button class="btn primary" type="button" data-m="cancel">Закрыть</button><button class="btn ghostbtn" type="button" data-m="reset">Начать счёт заново</button></div></div>`;
  document.body.append(root);
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') root.remove();
    if (e.target.dataset.m === 'reset') { usage.since = new Date().toISOString(); usage.n = {}; saveLocal('usage', usage); root.remove(); toast('Счёт начат заново'); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  void known;
}

/* ---------- keyboard help (F1) ---------- */
const HOTKEYS = [
  ['Общие', [['Ctrl+K или Ctrl+F', 'поиск по карточкам, проектам, людям'], ['Ctrl+N', 'новая карточка'], ['Ctrl+Z', 'отменить последнее действие'], ['Ctrl+J', 'журнал действий'],
    ['Alt+1…9', 'вкладки по порядку (зажмите Alt — подсказки на экране)'], ['F11 или двойной щелчок по заголовку', 'окно на весь экран / обратно'], ['Ctrl+Alt+G', 'сквозные клики вкл/выкл (работает и из других программ)'],
    ['Ctrl+щелчок или средняя кнопка по разделу', 'открыть раздел вкладкой — со своими фильтрами'], ['Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+W', 'следующая / предыдущая вкладка, закрыть вкладку'],
    ['Ctrl+Alt+N', 'быстрая карточка из любой программы: «+ ЭОМ #шифр !15.12 @Орлов», Enter — и Пульт снова в трее'],
    ['Ctrl + = / − / 0', 'масштаб интерфейса'], ['F1 или ?', 'эта подсказка']]],
  ['Таблицы и списки', [['Двойной щелчок по ячейке', 'правка прямо в таблице: статус, подрядчик, даты, бюджет'], ['Щелчок по заголовку столбца', 'сортировка'],
    ['Счётчик в заголовке («сорвано 2»…)', 'открыть эти карточки списком']]],
  ['Открытая карточка', [['Alt+↑ / Alt+↓', 'предыдущая / следующая карточка списка'], ['Ctrl+Enter в обсуждении', 'отправить сообщение'], ['Esc', 'закрыть (спросит про несохранённое)']]],
  ['Диаграмма Ганта и Канбан', [['Shift + колесо', 'прокрутка вбок'], ['Тянуть фон', 'прокрутка по датам (Гант)'], ['Ctrl + колесо', 'масштаб (Гант)'], ['Тянуть полоску / её край', 'сдвинуть работу / изменить старт или финиш']]],
];
function openHelp() {
  if (document.querySelector('.help-modal')) return;
  const root = document.createElement('div');
  root.className = 'modal-back help-modal';
  root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">Горячие клавиши</h2>
    ${HOTKEYS.map(([h, rows]) => `<h3 class="help-h">${h}</h3><table class="help-t">${rows.map(([k, d]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>`).join('')}
    <div class="modal-f"><button class="btn primary" type="button" data-m="cancel">Понятно</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'F1') { e.preventDefault(); e.stopPropagation(); close(); } });
  root.querySelector('button').focus();
}

function openCounter(f) {
  if (state.win.compact) { api.setCompact(false); state.win.compact = false; }
  state.filters = { ...EMPTY_FILTERS, status: f };
  state.tab = 'tasks'; saveLocal('tab', 'tasks');
  renderNow();
  $('#app').scrollTop = 0;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'preset': ({ id }) => { applyPreset(id); },
  'preset-del': ({ id }) => { deletePreset(id); },
  'preset-save': () => { savePreset(); },
  'preset-reset': () => { state.filters = { ...EMPTY_FILTERS }; renderNow(); },
});

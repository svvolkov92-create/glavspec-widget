/* ---------- file menu: reports & import ---------- */
function setFileMenu(open) {
  const menu = $('#file-menu');
  if (open) {
    const opt = (v, l) => `<option value="${esc(v)}"${state.reportScope === v ? ' selected' : ''}>${esc(l)}</option>`;
    $('#rep-scope').innerHTML = opt('all', 'Все активные проекты')
      + (liveProjects().length ? `<optgroup label="Проект">${liveProjects().map(p => opt('p:' + p.id, p.name)).join('')}</optgroup>` : '')
      + (contractorsArr().length ? `<optgroup label="Подрядчик">${contractorsArr().map(c => opt('c:' + c.id, c.name)).join('')}</optgroup>` : '')
      + (staffArr().length ? `<optgroup label="Сотрудник (что сдал, в срок ли, замечания)">${staffArr().map(u => opt('u:' + u.id, u.name)).join('')}</optgroup>` : '');
    if (!$('#rep-scope').value) { state.reportScope = 'all'; $('#rep-scope').value = 'all'; }
    updateScopeLabels();
    const trashN = state.trash.projects.length + state.trash.contractors.length + state.trash.tasks.filter(t => !t.deletedWith).length;
    $('#mi-trash').textContent = trashN ? `Корзина (${trashN})` : 'Корзина';
  }
  menu.hidden = !open;
  $('#btn-file').setAttribute('aria-expanded', String(open));
  if (open) $('#rep-scope').focus();
}
function updateScopeLabels() {
  const c = state.reportScope.startsWith('c:'), u = state.reportScope.startsWith('u:'), pr = state.reportScope.startsWith('p:');
  $('#mi-msproject')?.classList.toggle('dim', !pr);
  const mc = $('#mi-customer');
  if (mc) { mc.classList.toggle('dim', !pr); $('#cust-sub').textContent = pr ? `«${state.projects.get(state.reportScope.slice(2))?.name || ''}»: веб-страница — этап, план, «нужно от вас», разделы. Данные — в проекте, вкладка «Для заказчика»` : 'Выберите проект в списке «Отчёт по». Данные для неё — в проекте, вкладка «Для заказчика»'; }
  $('#rep-period-wrap').hidden = !u;
  if (u) {
    $('#word-title').textContent = 'Отчёт по сотруднику (Word)';
    $('#word-sub').textContent = 'Что сдано за период, в срок или нет, сколько было замечаний, что сейчас в работе';
    return;
  }
  $('#word-title').textContent = c ? 'Акт сверки (Word)' : 'Word';
  $('#word-sub').textContent = c ? 'Карточки подрядчика, начисления и платежи, итог взаиморасчётов, места для подписей'
    : 'Отчёт для печати: что требует внимания, таблицы по проектам и исполнителям';
}
function scopeObj() {
  const s = state.reportScope;
  if (s.startsWith('u:')) return { type: 'user', id: s.slice(2), period: $('#rep-period')?.value || 'quarter' };
  return s.startsWith('p:') ? { type: 'project', id: s.slice(2) } : s.startsWith('c:') ? { type: 'contractor', id: s.slice(2) } : { type: 'all' };
}
async function exportReport(format) {
  setFileMenu(false);
  const btn = $('#btn-file');
  btn.disabled = true;
  try {
    const res = await api.exportReport(format, scopeObj());
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) {
    toast('Не удалось выгрузить отчёт: ' + (e?.message || e), true);
  } finally {
    btn.disabled = false;
  }
}

async function msProjectExport() {
  if (!state.reportScope.startsWith('p:')) { toast('Сначала выберите проект в списке «Отчёт по».', true); $('#rep-scope')?.focus(); return; }
  if (!api.exportMsProject) return toast('Выгрузка в MS Project — в Пульте на компьютере.', true);
  setFileMenu(false);
  try {
    const res = await api.exportMsProject(state.reportScope.slice(2));
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name} — откройте в MS Project: «Файл → Открыть», тип файла XML`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) { toast('Не удалось выгрузить: ' + (e?.message || e), true); }
}

async function customerPdf() {
  if (!state.reportScope.startsWith('p:')) { toast('Сначала выберите проект в списке «Отчёт по».', true); $('#rep-scope')?.focus(); return; }
  setFileMenu(false);
  try {
    const res = await api.customerPage(state.reportScope.slice(2), { format: 'html', font: brandFont });
    if (res.canceled) return;
    if (!res.ok) return toast(res.message, true);
    toast(`Сохранено: ${res.name}`, false, { label: 'Открыть', run: api.openLastReport });
  } catch (e) { toast('Не удалось сохранить страницу: ' + (e?.message || e), true); }
}
const IMPORT_FIELDS = window.Importer.FIELDS;
async function startImport() {
  setFileMenu(false);
  let res;
  try { res = await api.importPick(); }
  catch (e) { return toast('Не удалось открыть файл: ' + (e?.message || e), true); }
  if (!res || res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  const sheets = res.sheets.filter(s => s.rows.length);
  if (!sheets.length) return toast('В файле нет данных.', true);
  // Prefer the sheet whose header is recognised best (our own export has «Карточки»).
  const scored = sheets.map((s, i) => ({ i, d: window.Importer.detect(s.rows) })).sort((a, b) => b.d.score - a.d.score);
  const best = scored[0];
  state.importData = { name: res.name, sheets, sheet: best.i, headerRow: best.d.headerRow, mapping: best.d.mapping };
  openImport();
}
function importPreview() {
  const d = state.importData;
  const rows = d.sheets[d.sheet].rows;
  return window.Importer.build(rows, d.headerRow, d.mapping, {
    projects: [...state.projects.values()], contractors: [...state.contractors.values()], today: todayStr(),
  });
}
function openImport() {
  const d = state.importData;
  state.drawer = { kind: 'import' };
  const rows = d.sheets[d.sheet].rows;
  const header = rows[d.headerRow] || [];
  const colOpts = sel => `<option value="-1">— нет —</option>` + header.map((h, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(String(h || `Столбец ${i + 1}`))}</option>`).join('');
  drawerShell({
    title: 'Импорт из таблицы',
    wide: true,
    body: `<p class="hint">Файл: <b>${esc(d.name)}</b>. Одна строка таблицы — одна карточка. Проекты и подрядчики с совпадающими названиями будут связаны с уже существующими.</p>
      <div class="fgrid">
        ${d.sheets.length > 1 ? `<div class="f"><label for="im-sheet">Лист</label><select id="im-sheet" data-transient>${d.sheets.map((s, i) => `<option value="${i}"${i === d.sheet ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>` : ''}
        <div class="f"><label for="im-header">Строка с заголовками</label><select id="im-header" data-transient>${rows.slice(0, 15).map((r, i) => `<option value="${i}"${i === d.headerRow ? ' selected' : ''}>${i + 1}: ${esc(r.filter(v => v !== '' && v != null).slice(0, 4).join(' | ').slice(0, 60))}</option>`).join('')}</select></div>
      </div>
      <div class="sub"><h3>Какой столбец что означает</h3>
        <div class="map-grid">${IMPORT_FIELDS.map(f => `<label class="f"><span class="${f.required ? 'req' : ''}">${esc(f.label)}</span><select data-map="${f.key}" data-transient>${colOpts(d.mapping[f.key] ?? -1)}</select></label>`).join('')}</div>
      </div>
      <div class="sub" id="im-preview"></div>`,
    footer: `<button class="btn primary" data-act="do-import" type="button" id="im-go">Импортировать</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>`,
    form: false,
  });
  renderImportPreview();
}
function renderImportPreview() {
  const box = $('#im-preview');
  if (!box) return;
  const r = importPreview();
  const sample = r.tasks.slice(0, 8);
  box.innerHTML = `<h3>Что будет добавлено</h3>
    <div class="kv"><div><span class="k">Карточек</span><span class="v">${r.tasks.length}</span></div>
      <div><span class="k">Новых проектов</span><span class="v">${r.projects.length}</span></div>
      <div><span class="k">Новых подрядчиков</span><span class="v">${r.contractors.length}</span></div>
      <div><span class="k">Пропущено строк</span><span class="v ${r.skipped.length ? 'warnv' : ''}">${r.skipped.length}</span></div></div>
    ${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}
    ${sample.length ? `<div class="tablewrap"><table class="mini"><thead><tr><th>Проект</th><th>Разделы</th><th>Подрядчик</th><th>Старт</th><th>Финиш</th><th>Статус</th><th class="r">Бюджет</th><th class="r">Оплачено</th></tr></thead><tbody>
      ${sample.map(t => `<tr><td>${esc(r.projectName(t.projectId))}</td><td>${esc(t.sections.join(', '))}</td><td>${esc(r.contractorName(t.contractorId) || '—')}</td>
        <td class="num">${fmtDate(t.start)}</td><td class="num">${fmtDate(t.finish)}</td><td>${esc(STATUSES[t.status].label)}</td>
        <td class="r num">${money(t.budget)}</td><td class="r num">${money(paidOf(t))}</td></tr>`).join('')}</tbody></table></div>
      ${r.tasks.length > sample.length ? `<div class="hint">…и ещё ${r.tasks.length - sample.length}</div>` : ''}` : ''}
    ${r.skipped.length ? `<details><summary class="hint">Почему пропущены строки</summary><ul class="hint">${r.skipped.slice(0, 20).map(s => `<li>строка ${s.row}: ${esc(s.reason)}</li>`).join('')}</ul></details>` : ''}`;
  $('#im-go').disabled = !!r.error || !r.tasks.length;
}
async function doImport() {
  const r = importPreview();
  if (r.error || !r.tasks.length) return;
  const now = new Date().toISOString();
  const ops = [
    ...r.projects.map(p => op.set('projects', p.id, { ...p, createdAt: now, imported: true })),
    ...r.contractors.map(c => op.set('contractors', c.id, { ...c, createdAt: now, imported: true })),
    ...r.tasks.map(t => op.set('tasks', t.id, { ...t, createdAt: now, imported: true,
      history: [{ ts: now, date: todayStr(), type: 'status', from: null, to: t.status, note: 'импорт из таблицы' }] })),
  ];
  if (await write(ops, `Импортировано карточек: ${r.tasks.length}`)) { closeDrawer(); state.tab = 'projects'; renderNow(); }
}

/* ---------- «Вид»: theme, interface scale, window position ---------- */
const THEMES = [['system', 'Как в Windows'], ['light', 'Светлая'], ['dark', 'Тёмная'], ['graphite', 'Графит'], ['tandem', 'Тандем']];
// Brand font of the «Тандем» theme and of the customer page: Golos Text or Montserrat.
let brandFont = loadLocal('brandFont', 'golos') === 'montserrat' ? 'montserrat' : 'golos';
function applyBrandFont() { document.documentElement.dataset.font = brandFont; }
applyBrandFont();
const LEVELS = [['top', 'Поверх всех окон', 'Окно всегда видно поверх других программ'],
  ['normal', 'Обычное окно', 'Ведёт себя как любая программа'],
  ['desktop', 'На рабочем столе', 'Окно лежит под всеми программами, как виджет; кнопки на панели задач нет — открывается значком в трее']];
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
function renderViewMenu() {
  $('#view-menu-body').innerHTML = viewSectionsHtml(false) + `<div class="vm-sec"><button class="btn sm" type="button" data-act="settings" data-sec="">Все настройки…</button></div>`;
  if (document.querySelector('.settings-modal')) renderSettings();
}
// 4.10 (69): «Т из Ганта» in the colours the user picked — the same drawing as tools/make-icons.js.
const APP_ICON_VARIANTS = [1, 3, 4, 6, 8];
function appIconSvg(n) {
  const O = '#F26A1F', W = '#FFFFFF', G = '#2F3033';
  const [t, c, s] = { 1: [O, W, W], 3: [O, W, G], 4: [W, O, O], 6: [W, O, G], 8: [G, W, W] }[n] || [O, W, W];
  const tile = t === W ? `<rect x="1" y="1" width="62" height="62" rx="13" fill="${W}" stroke="#E2D6CC" stroke-width="2"/>` : `<rect width="64" height="64" rx="14" fill="${t}"/>`;
  return `<svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">${tile}<rect x="12" y="14" width="40" height="9" rx="2" fill="${c}"/><rect x="25" y="27" width="12" height="7" rx="2" fill="${s}"/><rect x="29" y="38" width="12" height="7" rx="2" fill="${s}" opacity=".85"/><rect x="25" y="49" width="12" height="5" rx="2" fill="${s}" opacity=".7"/></svg>`;
}
// `full`: everything (the «Настройки» window); otherwise only theme and zoom (the quick menu in the title bar).
function viewSectionsHtml(full) {
  const w = state.win, zoom = w.zoom || 1;
  const theme = `
    <div class="vm-sec"><span class="vm-h">Тема</span><div class="seg wrap">${THEMES.map(([k, l]) => `<button class="btn sm ${w.theme === k ? 'on' : ''}" type="button" data-act="set-theme" data-v="${k}">${l}</button>`).join('')}</div></div>
    ${w.theme === 'tandem' ? `<div class="vm-sec"><span class="vm-h">Шрифт темы «Тандем» и страницы заказчика</span><div class="seg"><button class="btn sm ${brandFont === 'golos' ? 'on' : ''}" type="button" data-act="set-font" data-v="golos">Golos</button><button class="btn sm ${brandFont === 'montserrat' ? 'on' : ''}" type="button" data-act="set-font" data-v="montserrat" style="font-family:Montserrat">Montserrat</button></div></div>` : ''}
`;
  const zoomHtml = `
    <div class="vm-sec"><span class="vm-h">Масштаб интерфейса</span>
      <div class="vm-zoom"><button class="btn sm" type="button" data-act="zoom-step" data-dir="-1" title="Ctrl + −" ${zoom <= ZOOM_STEPS[0] ? 'disabled' : ''}>−</button>
        <b class="num">${Math.round(zoom * 100)}%</b>
        <button class="btn sm" type="button" data-act="zoom-step" data-dir="1" title="Ctrl + =" ${zoom >= ZOOM_STEPS.at(-1) ? 'disabled' : ''}>+</button>
        <button class="btn ghostbtn sm" type="button" data-act="zoom-step" data-dir="0" title="Ctrl + 0">Сбросить</button></div></div>
    <div class="vm-sec"><span class="vm-h">Анимации</span><div class="seg"><button class="btn sm ${anim ? 'on' : ''}" type="button" data-act="set-anim" data-v="1">Включены</button><button class="btn sm ${anim ? '' : 'on'}" type="button" data-act="set-anim" data-v="0">Выключены</button></div></div>`;
  const densHtml = `<div class="vm-sec"><span class="vm-h">Плотность интерфейса</span><div class="seg"><button class="btn sm ${dense ? '' : 'on'}" type="button" data-act="set-dense" data-v="0">Удобно</button><button class="btn sm ${dense ? 'on' : ''}" type="button" data-act="set-dense" data-v="1">Компактно</button></div><span class="hint">Компактно — мельче шрифт, плотнее строки, кнопки и отступы: больше помещается на экране.</span></div>`;
  // 32 (Windows): Mica / acrylic behind the window instead of the own translucency. 37: keep a side of the screen.
  const BACKDROP_L = { none: 'Своя прозрачность', mica: 'Mica', acrylic: 'Акрил' };
  const backHtml = (w.backdrops || []).length > 1 ? `<div class="vm-sec"><span class="vm-h">Фон окна</span><div class="seg">${w.backdrops.map(k => `<button class="btn sm ${w.backdrop === k ? 'on' : ''}" type="button" data-act="set-backdrop" data-v="${k}">${BACKDROP_L[k]}</button>`).join('')}</div>
    <span class="hint">${w.backdrop && w.backdrop !== 'none' ? 'Фон Windows под окном: размытые обои, цвет темы Windows. Ползунок прозрачности в этом режиме не нужен.' : (w.win11 ? 'Mica — фон Windows 11, как у Проводника и Параметров; акрил — сильнее размытие.' : 'Акрил — размытый фон Windows под окном.')}</span></div>` : '';
  const dockHtml = w.dock ? `<div class="vm-sec"><span class="vm-h">Край экрана</span><div class="seg">${[['off', 'Нет'], ['left', 'Слева'], ['right', 'Справа']].map(([k, l]) => `<button class="btn sm ${w.dock === k ? 'on' : ''}" type="button" data-act="set-dock" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="chk vm-mini"><input type="checkbox" data-act="set-dock-auto"${w.dockAuto ? ' checked' : ''}> Прятать за край, когда мышь уходит</label>
    <span class="hint">${w.dockAuto ? 'Окно уезжает за край, остаётся тонкая рыжая полоска — коснитесь её мышью, и Пульт выедет. Пока вы печатаете в нём, он не прячется. Место на экране не занимает.' : 'Пульт стоит у края во всю высоту, как панель задач: развёрнутые окна других программ не заходят под него. Ширина — нынешняя ширина окна.'}</span></div>` : '';
  // 4.10 (69): the icon of the window, the taskbar button and the tray. The installer and shortcuts keep №1.
  const iconHtml = w.appIcon ? `<div class="vm-sec"><span class="vm-h">Значок</span><div class="app-icons">${APP_ICON_VARIANTS.map(n => `<button class="app-ic ${w.appIcon === n ? 'on' : ''}" type="button" data-act="set-app-icon" data-v="${n}" title="Значок №${n}${n === 1 ? ' — основной' : ''}" aria-pressed="${w.appIcon === n}">${appIconSvg(n)}</button>`).join('')}</div>
    <span class="hint">Меняет значок окна, кнопки на панели задач и у часов. Ярлык и установщик остаются с основным (первым).</span></div>` : '';
  if (!full) return theme + backHtml + zoomHtml + densHtml;
  return theme + backHtml + zoomHtml + densHtml + dockHtml + iconHtml + `
    <div class="vm-sec"><span class="vm-h">Панель вкладок</span><div class="seg">${NAV_POS.map(([k, l]) => `<button class="btn sm ${nav.pos === k ? 'on' : ''}" type="button" data-act="nav-pos" data-v="${k}">${l}</button>`).join('')}</div>
      ${nav.pos === 'left' ? `<label class="chk vm-mini"><input type="checkbox" data-act="nav-mini-chk"${nav.mini ? ' checked' : ''}> Только значки</label>` : ''}</div>
    <div class="vm-sec"><span class="vm-h">Положение окна</span>
      ${LEVELS.map(([k, l, d]) => `<label class="vm-level ${k === 'desktop' && w.desktopSupported === false ? 'off' : ''}"><input type="radio" name="vm-level" value="${k}" ${w.level === k ? 'checked' : ''} ${k === 'desktop' && w.desktopSupported === false ? 'disabled' : ''}>
        <span><b>${l}</b><small>${k === 'desktop' && w.desktopSupported === false ? 'Недоступно в этой системе' : d}</small></span></label>`).join('')}</div>`;
}
function setViewMenu(open) {
  if (open) renderViewMenu();
  $('#view-menu').hidden = !open;
  $('#btn-view').setAttribute('aria-expanded', String(open));
}
function stepZoom(dir) {
  const cur = state.win.zoom || 1;
  let next = 1;
  if (dir > 0) next = ZOOM_STEPS.find(z => z > cur + 0.001) ?? ZOOM_STEPS.at(-1);
  if (dir < 0) next = [...ZOOM_STEPS].reverse().find(z => z < cur - 0.001) ?? ZOOM_STEPS[0];
  api.setZoom(next);
  toast(`Масштаб ${Math.round(next * 100)}%`);
}

/* ---------- action journal ---------- */
const JOURNAL_PERIODS = [['1', 'Сегодня'], ['7', 'Неделя'], ['31', 'Месяц'], ['all', 'Всё время']];
const JOURNAL_TYPES = [['all', 'Всё'], ['tasks', 'Карточки'], ['payments', 'Оплаты'], ['dates', 'Сроки'], ['projects', 'Проекты'], ['contractors', 'Исполнители']];
const KIND_LABEL = { create: 'создано', update: 'изменено', trash: 'в корзину', restore: 'восстановлено', delete: 'удалено навсегда', 'restore-backup': 'восстановление' };

async function autoBackupMenu() {
  setFileMenu(false);
  const cur = await api.autoBackupGet();
  if (cur.dir) {
    const off = await confirmBox(`Автокопия сохраняется раз в день в «${cur.dir}»${cur.last ? `, последняя — ${fmtDate(cur.last)}` : ''}${cur.error ? `. Последняя попытка не удалась: ${cur.error}` : ''}. Выключить или выбрать другую папку?`, 'Выключить', 'Другая папка…');
    if (off === null) return;
    if (off) { await api.autoBackupSet(true); return toast('Автокопия выключена'); }
  }
  const r = await api.autoBackupSet(false);
  if (r.canceled) return;
  toast(r.ok ? `Автокопия включена: ${r.dir}. Первая копия уже сохранена, дальше — раз в день, хранятся 14 последних.` : r.message, !r.ok);
}
async function backupSave() {
  setFileMenu(false);
  const res = await api.backupSave();
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  toast(`Копия сохранена: ${res.name} (карточек ${res.counts.tasks}, проектов ${res.counts.projects}, подрядчиков ${res.counts.contractors})`);
}
async function backupRestore() {
  setFileMenu(false);
  const res = await api.backupRestore();
  if (res.canceled) return;
  if (!res.ok) return toast(res.message, true);
  undoStack.length = 0; // earlier undo steps refer to the replaced data
  closeDrawer();
  await refresh();
  toast(`Данные восстановлены из копии: записей ${res.count}. Прежние данные сохранены в папке backups.`);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'file-menu': () => { setFileMenu($('#file-menu').hidden); },
  'customer-pdf': () => { customerPdf(); },
  'autobackup': () => { autoBackupMenu(); },
  'set-font': ({ el }) => { brandFont = el.dataset.v === 'montserrat' ? 'montserrat' : 'golos'; saveLocal('brandFont', brandFont); applyBrandFont(); renderViewMenu(); if (document.querySelector('.settings-modal')) renderSettings(); },
  'export': ({ el }) => { exportReport(el.dataset.format); },
  'ms-project': () => { msProjectExport(); },
  'set-dock-auto': ({ el }) => { api.setDockAuto?.(el.checked); },
  'set-app-icon': ({ el }) => { api.setAppIcon?.(Number(el.dataset.v)).then(ok => { if (ok === false) toast('Не удалось сменить значок.', true); }); },
  'import': () => { startImport(); },
  'backup-save': () => { backupSave(); },
  'backup-restore': () => { backupRestore(); },
  'view-menu': () => { setViewMenu($('#view-menu').hidden); },
  'weekly': () => { setFileMenu(false); openWeekly(); },
  'usage': () => { setFileMenu(false); openUsage(); },
  'help': () => { setFileMenu(false); openHelp(); },
  'set-dense': ({ el }) => { dense = el.dataset.v === '1'; saveLocal('dense', dense); applyDense(); renderViewMenu(); },
  'set-anim': ({ el }) => { anim = el.dataset.v === '1'; saveLocal('anim', anim); applyAnim(); renderViewMenu(); },
  'zoom-step': ({ el }) => { stepZoom(Number(el.dataset.dir)); },
  'open-trash': () => { setFileMenu(false); openTrash(); },
  'do-import': ({ el }) => { el.disabled = true; doImport().finally(() => { el.disabled = false; }); },
  'open-data-folder': () => { setFileMenu(false); api.openDataFolder(); },
});

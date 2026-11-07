'use strict';
// Work with files that the rules decide on, shared by the Electron main process and the Tauri window:
// reports (Excel / Word), the customer page (HTML / PDF), the composition of the project documentation,
// backups and their restore, the automatic copy, import from a table, opening folders, contacting a contractor.
// Everything that touches Windows goes through `io` (Electron: fs/dialog/shell; Tauri: Rust commands):
//   io.saveDialog({ title, defaultPath, filters }) → path | null      io.openDialog({ title, defaultPath, filters, directory }) → path | null
//   io.confirm({ title, message, detail, ok }) → bool                 io.writeFile(path, bytes | string)   io.readFile(path) → bytes
//   io.exists(path) io.mkdir(path) io.copyFile(from, to) io.listDir(dir) → names  io.remove(path)
//   io.openPath(path) → '' | error   io.openExternal(url)   io.pdf(html, path) → { ok, viaBrowser? }
//   io.asset(rel) → bytes (logo, fonts, built-in templates)   io.dirs() → { documents, userData }
//   io.join(...parts) io.dirname(p) io.basename(p) io.extname(p)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createFiles = factory;
})(typeof self !== 'undefined' ? self : this, function createFiles(deps) {
  const { store, journal, settings, A, L, Composition, R, io, Buffer } = deps;
  const currentUser = () => deps.currentUser();
  const userView = () => deps.userView();
  const changed = deps.changed || (() => {});
  const appVersion = deps.appVersion || '';

  const REPORT_FORMATS = {
    xlsx: { name: 'Книга Excel', extensions: ['xlsx'], build: R.buildXlsx },
    docx: { name: 'Документ Word', extensions: ['docx'], build: R.buildDocx },
  };
  const safeName = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const busy = e => ['EBUSY', 'EPERM', 'EACCES'].includes(e?.code) || /used by another process|being used|занят|Access is denied|Отказано в доступе|os error (5|32)\b/i.test(String(e?.message || e));
  const msgOf = e => String(e?.message || e);
  let lastExport = null;

  function cleanScope(scope) {
    if (scope && (scope.type === 'project' || scope.type === 'contractor') && typeof scope.id === 'string') return { type: scope.type, id: scope.id };
    if (scope && scope.type === 'user' && typeof scope.id === 'string') return { type: 'user', id: scope.id, period: ['month', 'quarter', 'year', 'all'].includes(scope.period) ? scope.period : 'quarter' };
    return { type: 'all' };
  }
  // The folder last used for this kind of file, if it still exists; else «Документы».
  async function startDir(key) {
    const last = settings.get(key);
    return last && (await io.exists(last)) ? last : io.dirs().documents;
  }
  const withExt = (file, ext) => (io.extname(file).toLowerCase() === '.' + ext ? file : `${file}.${ext}`);
  async function saveAs({ title, name, ext, filter, dirKey = 'reportDir' }) {
    const file = await io.saveDialog({ title, defaultPath: io.join(await startDir(dirKey), name), filters: [filter] });
    return file ? withExt(file, ext) : null;
  }
  function saved(target, dirKey = 'reportDir') {
    lastExport = target;
    settings.set({ [dirKey]: io.dirname(target) });
    return { ok: true, name: io.basename(target) };
  }
  const writeError = (e, what) => (busy(e)
    ? { ok: false, message: 'Файл занят или защищён от записи — возможно, он открыт в Excel или Word. Закройте его или сохраните под другим именем.' }
    : { ok: false, message: `Не удалось сохранить ${what}: ${msgOf(e)}` });

  // Project team for the customer page: participants with a customer-readable role («ГИП», «главный специалист,
  // электрика», «инженер, слаботочка»). The contact person is shown separately and skipped here.
  function customerTeam(p) {
    const dirs = u => (u.directions || []).map(id => A.DIRECTIONS.find(d => d.id === id)?.label.toLowerCase()).filter(Boolean).join(', ');
    const role = u => (u.role === 'gip' ? 'ГИП' : `${u.role === 'chief' ? 'главный специалист' : 'инженер'}${dirs(u) ? ', ' + dirs(u) : ''}`);
    return (Array.isArray(p.members) ? p.members : []).filter(id => id !== p.contactId).map(id => store.data.users[id]).filter(u => u && !u.deletedAt).map(u => ({ name: u.name, role: role(u) }));
  }
  // The GIP contact shown to the customer: the project's «контакт для заказчика».
  function customerContact(p) {
    const u = p.contactId ? store.data.users[p.contactId] : null;
    return u && !u.deletedAt ? { name: u.name, role: A.ROLES[u.role]?.label || '', phone: u.phone || '', email: u.email || '' } : null;
  }

  /* ---------- reports ---------- */
  async function exportReport(format, rawScope) {
    const fmt = REPORT_FORMATS[format];
    if (!fmt) return { ok: false, message: 'Неизвестный формат отчёта.' };
    const scope = cleanScope(rawScope);
    const now = new Date(), stamp = L.todayStr(now), me = currentUser();
    if (A.isSpecialist(me)) return { ok: false, message: 'Отчёты доступны ГИПу и главспецам.' };
    const report = R.buildReport(userView(), stamp, scope);
    report.money = A.canSeeMoney(me);
    if (!report.money && scope.type === 'contractor' && format === 'docx') return { ok: false, message: 'Акт сверки содержит суммы — нужен доступ к бюджету.' };
    if (scope.type !== 'all' && !report.scope.title) return { ok: false, message: 'Проект, подрядчик или сотрудник не найден.' };
    if (scope.type === 'user' && !A.isGip(me) && !A.teamIds(me, store.snapshot().users).has(scope.id)) return { ok: false, message: 'Отчёт можно сделать только по своей команде.' };
    const base = scope.type === 'user' ? `Отчёт по сотруднику — ${safeName(report.scope.title)}`
      : scope.type === 'contractor' && format === 'docx' ? `Акт сверки — ${safeName(report.scope.title)}`
      : scope.type === 'all' ? 'Отчёт главспеца' : `Отчёт — ${safeName(report.scope.title)}`;
    const target = await saveAs({ title: 'Сохранить отчёт', name: `${base} ${stamp}.${format}`, ext: format, filter: fmt });
    if (!target) return { ok: false, canceled: true };
    try { await io.writeFile(target, fmt.build(report, now)); return saved(target); }
    catch (e) { return writeError(e, 'отчёт'); }
  }

  // The customer's page of one project: one HTML file (logo and font inside) or the same page as PDF.
  // Built from the full project record (the plan incl. «Договор»), cards as the user sees them; no money, no contractors.
  async function customerPage(projectId, opts = {}) {
    const me = currentUser();
    if (!me || A.isSpecialist(me)) return { ok: false, message: 'Страницу для заказчика делают ГИП и главспецы.' };
    const view = userView();
    if (!view.projects.some(x => x.id === projectId)) return { ok: false, message: 'Выберите проект.' };
    const p = store.data.projects[projectId];
    const format = opts.format === 'pdf' ? 'pdf' : 'html', stamp = L.todayStr();
    // Where PDF is made by the browser's print dialog (Tauri), that dialog asks where to save it.
    const target = format === 'pdf' && io.pdfViaBrowser ? null : await saveAs({ title: 'Сохранить страницу для заказчика', name: `Статус проекта — ${safeName(p.name)} ${stamp}.${format}`, ext: format,
      filter: format === 'pdf' ? { name: 'PDF', extensions: ['pdf'] } : { name: 'Веб-страница', extensions: ['html'] } });
    if (!target && !(format === 'pdf' && io.pdfViaBrowser)) return { ok: false, canceled: true };
    const montserrat = opts.font === 'montserrat';
    const text = bytes => (typeof bytes === 'string' ? bytes : Buffer.from(bytes).toString('utf8'));
    const html = R.customerHtml({
      project: { ...p, id: projectId }, tasks: view.tasks, contact: customerContact(p), team: customerTeam(p), today: stamp,
      logoSvg: text(await io.asset('brand/tandem-logo.svg')),
      fontName: montserrat ? 'Montserrat' : 'Golos Text',
      fontBase64: Buffer.from(await io.asset(montserrat ? 'fonts/Montserrat.ttf' : 'fonts/GolosText.ttf')).toString('base64'),
    });
    try {
      if (format === 'html') { await io.writeFile(target, html); return saved(target); }
      const r = await io.pdf(html, target);
      if (r?.viaBrowser) return { ok: true, viaBrowser: true };
      return saved(target);
    } catch (e) { return writeError(e, 'страницу'); }
  }

  // The template file: the user's own in <userData>/templates/<kind>.docx, else the built-in one.
  async function templateOf(kind) {
    const t = R.TEMPLATES[kind];
    if (!t) throw new R.TemplateError('Неизвестный шаблон.');
    const own = io.join(io.dirs().userData, 'templates', t.file);
    return (await io.exists(own)) ? { ...t, bytes: await io.readFile(own), own: true } : { ...t, bytes: await io.asset('templates/' + t.file), own: false };
  }

  // «Состав проектной документации» and «Ведомость основных комплектов рабочих чертежей»:
  // Word from the office's templates (sp / vok), or both lists in one Excel workbook.
  async function composition(projectId, format, opts = {}) {
    const me = currentUser();
    if (!me || A.isSpecialist(me)) return { ok: false, message: 'Состав проекта выгружают ГИП и главспецы.' };
    const p = userView().projects.find(x => x.id === projectId);
    if (!p?.composition) return { ok: false, message: 'У проекта ещё нет состава.' };
    const kind = format === 'vok' ? 'vok' : format === 'xlsx' ? 'xlsx' : 'sp';
    const ext = kind === 'xlsx' ? 'xlsx' : 'docx';
    const code = String(p.code || '').trim();
    const sp = Composition.spRows(p.composition, code), rd = Composition.rdRows(p.composition, code);
    if (kind === 'vok' && !rd.length) return { ok: false, message: 'В составе рабочей документации нет разделов.' };
    const stamp = L.todayStr(), label = { sp: 'Состав ПД', vok: 'ВОК', xlsx: 'Состав ПД и ВОК' }[kind];
    const target = await saveAs({ title: `Сохранить: ${label}`, name: `${code ? safeName(code) + ' ' : ''}${label} — ${safeName(p.name)}.${ext}`, ext, filter: REPORT_FORMATS[ext] });
    if (!target) return { ok: false, canceled: true };
    try {
      let out;
      if (kind === 'xlsx') {
        out = R.buildCompositionXlsx(sp.map(r => ({ tom: r.tom, code: r.code, name: `${r.label} «${r.title}»`, note: '' })),
          { title: 'Состав проектной документации', project: p.name, code, rdRows: rd.map(r => ({ tom: r.tom, code: r.code, name: r.title, note: r.note })) });
      } else {
        const t = await templateOf(kind);
        const str = (v, max) => String(v ?? '').trim().slice(0, max);
        const gip = str(opts.gip, 60), names = { gip, gipShort: gip.split(/\s+/)[0] || '', director: str(opts.director, 60), developer: str(opts.developer, 60).split(/\s+/)[0] || '' };
        const name = str(p.name, 300);
        out = R.fillTemplate(Buffer.from(t.bytes), {
          prefix: code ? code + '-' : '', object: /^«.*»$/.test(name) ? name : `«${name}»`, customer: str(opts.customer ?? p.client, 300),
          year: str(opts.year, 4) || stamp.slice(0, 4), names: Object.fromEntries(Object.entries(names).filter(([, v]) => v)), from: t.names,
          stage: kind === 'vok' ? 'Р' : 'П', fromStage: t.stage,
          rows: kind === 'vok' ? rd.map(r => ({ tom: r.tom, code: r.code, title: r.title, note: r.note }))
            : sp.map(r => ({ tom: r.tom, code: r.code, label: r.label, title: r.title, note: '', heading: !r.vol })),
        });
        settings.set({ docNames: { director: names.director || settings.get('docNames')?.director || '' } });
      }
      await io.writeFile(target, out);
      return saved(target);
    } catch (e) {
      if (e instanceof R.TemplateError) return { ok: false, message: e.message };
      return writeError(e, 'файл');
    }
  }
  // Defaults for the export dialog: the director last typed, the folder with the user's own templates.
  async function docDefaults() {
    const dir = io.join(io.dirs().userData, 'templates');
    const own = [];
    for (const k of ['sp', 'vok']) if (await io.exists(io.join(dir, R.TEMPLATES[k].file))) own.push(k);
    return { director: settings.get('docNames')?.director || R.TEMPLATES.sp.names.director, templatesDir: dir, own };
  }
  async function openTemplates() {
    const dir = io.join(io.dirs().userData, 'templates');
    await io.mkdir(dir);
    for (const k of ['sp', 'vok']) {
      const f = io.join(dir, 'образец-' + R.TEMPLATES[k].file);
      if (!(await io.exists(f))) await io.writeFile(f, await io.asset('templates/' + R.TEMPLATES[k].file));
    }
    await io.openPath(dir);
    return { ok: true };
  }
  // Opens only the file this app just saved, never an arbitrary path from the page.
  const openLast = () => { if (lastExport) io.openPath(lastExport); };

  /* ---------- folders and contacts ---------- */
  async function openFolder(folder, what) {
    if (!folder) return { ok: false, message: `У ${what} не указана папка.` };
    if (!(await io.exists(folder))) return { ok: false, message: `Папка не найдена: ${folder}. Проверьте путь или доступ к сетевому диску.` };
    const err = await io.openPath(folder);
    return err ? { ok: false, message: `Не удалось открыть папку: ${err}` } : { ok: true };
  }
  // The page passes an id; the folder path is taken from the stored record.
  function openProjectFolder(id) {
    const p = typeof id === 'string' ? store.data.projects[id] : null;
    return openFolder(p && typeof p.folder === 'string' ? p.folder.trim() : '', 'проекта');
  }
  function openTaskFolder(id) {
    const me = currentUser(), t = typeof id === 'string' ? store.data.tasks[id] : null;
    if (!t || !A.canSeeTask(me, t, store.snapshot().users)) return { ok: false, message: 'Карточка не найдена.' };
    return openFolder(typeof t.folder === 'string' ? t.folder.trim() : '', 'раздела');
  }
  async function pickFolder(current) {
    const start = typeof current === 'string' && current && (await io.exists(current)) ? current : undefined;
    const dir = await io.openDialog({ title: 'Папка проекта', defaultPath: start, directory: true });
    return dir ? { path: dir } : { canceled: true };
  }
  // Mail / WhatsApp / Telegram for a stored contractor; the URL is built here, never taken from the page.
  async function contactOpen({ contractorId, kind, subject, text } = {}) {
    const c = typeof contractorId === 'string' ? store.data.contractors[contractorId] : null;
    if (!c) return { ok: false, message: 'Подрядчик не найден.' };
    const url = R.contactUrl(c, kind, { subject: String(subject || '').slice(0, 300), text: String(text || '').slice(0, 6000) });
    if (!url) {
      const need = { mail: 'адрес почты', whatsapp: 'номер телефона', telegram: 'ник Telegram (@имя) или телефон' }[kind] || 'контакт';
      return { ok: false, message: `В карточке подрядчика не указан ${need}.` };
    }
    try { await io.openExternal(url); return { ok: true }; }
    catch (e) { return { ok: false, message: `Не удалось открыть приложение: ${msgOf(e)}` }; }
  }

  /* ---------- backups ---------- */
  const noTools = () => !A.canUseDataTools(currentUser());
  async function backupSave() {
    if (noTools()) return { ok: false, message: 'Импорт и резервные копии доступны только ГИПу.' };
    const stamp = L.todayStr();
    const file = await io.saveDialog({ title: 'Сохранить резервную копию', defaultPath: io.join(await startDir('backupDir'), `Пульт главспеца — копия ${stamp}.json`),
      filters: [{ name: 'Резервная копия', extensions: ['json'] }] });
    if (!file) return { canceled: true };
    try {
      const payload = { format: 'glavspec-backup', version: 1, app: appVersion, createdAt: new Date().toISOString(), data: store.data };
      await io.writeFile(file, JSON.stringify(payload, null, 1));
      settings.set({ backupDir: io.dirname(file) });
      const s = store.snapshot();
      return { ok: true, name: io.basename(file), counts: { projects: s.projects.length, contractors: s.contractors.length, tasks: s.tasks.length } };
    } catch (e) { return { ok: false, message: `Не удалось сохранить копию: ${msgOf(e)}` }; }
  }
  async function backupRestore() {
    if (noTools()) return { ok: false, message: 'Импорт и резервные копии доступны только ГИПу.' };
    const file = await io.openDialog({ title: 'Восстановить из резервной копии', defaultPath: await startDir('backupDir'), filters: [{ name: 'Резервная копия', extensions: ['json'] }] });
    if (!file) return { canceled: true };
    let parsed;
    try { parsed = JSON.parse(Buffer.from(await io.readFile(file)).toString('utf8')); }
    catch { return { ok: false, message: 'Файл не читается как резервная копия (повреждён или это другой файл).' }; }
    // Accepts our backup file, data.json itself, or a daily copy from the backups folder.
    const data = parsed && parsed.format === 'glavspec-backup' ? parsed.data : parsed;
    const count = col => (data && typeof data[col] === 'object' && data[col] ? Object.keys(data[col]).length : 0);
    if (!data || !['projects', 'contractors', 'tasks'].some(col => data[col] && typeof data[col] === 'object')) return { ok: false, message: 'В файле нет данных Пульта главспеца.' };
    const when = parsed.createdAt ? ` от ${new Date(parsed.createdAt).toLocaleString('ru-RU')}` : '';
    const now = store.snapshot();
    const yes = await io.confirm({ title: 'Восстановление', message: `Заменить текущие данные копией${when}?`, ok: 'Восстановить',
      detail: `В копии: проектов ${count('projects')}, исполнителей ${count('contractors')}, карточек ${count('tasks')}.\n`
        + `Сейчас: проектов ${now.projects.length}, исполнителей ${now.contractors.length}, карточек ${now.tasks.length}.\n\n`
        + 'Текущие данные будут сохранены в папку backups, так что их можно будет вернуть.' });
    if (!yes) return { canceled: true };
    try {
      const keep = io.join(io.dirs().userData, 'backups', `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await io.mkdir(io.dirname(keep));
      await io.writeFile(keep, JSON.stringify(store.data, null, 1));
      const n = await store.replaceAll(data);
      journal.append([{ col: 'all', id: '-', kind: 'restore-backup', title: `Восстановлено из резервной копии${when}`, changes: [{ f: 'summary', label: 'Записей', to: String(n) }] }], { action: 'Восстановление из копии' });
      changed();
      return { ok: true, count: n };
    } catch (e) {
      return { ok: false, message: deps.StoreError && e instanceof deps.StoreError ? e.message : `Не удалось восстановить: ${msgOf(e)}` };
    }
  }

  // Automatic copy (3.6): once a day into a folder the GIP chose (flash drive, network share), the last 14 kept.
  let autoBackupError = '';
  async function autoBackup(force = false) {
    const dir = settings.get('autoBackupDir');
    if (!dir) return { ok: true };
    const day = L.todayStr();
    if (!force && settings.get('autoBackupLast') === day) return { ok: true };
    try {
      if (!(await io.exists(dir))) throw new Error('папка недоступна (флешка не вставлена или сеть отключена)');
      const payload = { format: 'glavspec-backup', version: 1, app: appVersion, createdAt: new Date().toISOString(), auto: true, data: store.data };
      await io.writeFile(io.join(dir, `Пульт главспеца — автокопия ${day}.json`), JSON.stringify(payload));
      const old = (await io.listDir(dir)).filter(f => /^Пульт главспеца — автокопия \d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      for (const f of old.slice(0, Math.max(0, old.length - 14))) await io.remove(io.join(dir, f));
      settings.set({ autoBackupLast: day });
      autoBackupError = '';
      return { ok: true };
    } catch (e) {
      autoBackupError = msgOf(e);
      return { ok: false, message: `Автокопия не сохранена: ${msgOf(e)}` };
    }
  }
  const autoBackupGet = () => ({ dir: settings.get('autoBackupDir') || '', last: settings.get('autoBackupLast') || '', error: autoBackupError });
  async function autoBackupSet(off) {
    if (noTools()) return { ok: false, message: 'Автокопию настраивает ГИП.' };
    if (off) { settings.set({ autoBackupDir: '' }); return { ok: true, dir: '' }; }
    const dir = await io.openDialog({ title: 'Папка для автокопии (флешка, сетевая папка)', directory: true });
    if (!dir) return { canceled: true };
    settings.set({ autoBackupDir: dir, autoBackupLast: '' });
    const r = await autoBackup(true);
    return { ok: r.ok, dir, message: r.message };
  }

  /* ---------- files attached to requests to the customer (for approval) ---------- */
  // Kept on this computer in <data folder>/attachments/<project>/<file id>; the request stores { id, name, size, type }.
  const ATTACH_MAX = 30 * 1024 * 1024;
  const attachDir = projectId => io.join(io.dirs().userData, 'attachments', safeId(projectId));
  const safeId = id => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dwg: 'image/vnd.dwg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', zip: 'application/zip', txt: 'text/plain' };
  async function attachAdd(projectId) {
    const me = currentUser();
    if (!me || A.isSpecialist(me)) return { ok: false, message: 'Файлы к запросам прикладывают ГИП и главспецы.' };
    if (!store.data.projects[projectId]) return { ok: false, message: 'Проект не найден.' };
    const file = await io.openDialog({ title: 'Файл для согласования заказчиком', defaultPath: await startDir('attachDir'),
      filters: [{ name: 'Документы и чертежи', extensions: ['pdf', 'docx', 'xlsx', 'dwg', 'jpg', 'jpeg', 'png', 'zip'] }, { name: 'Все файлы', extensions: ['*'] }] });
    if (!file) return { canceled: true };
    settings.set({ attachDir: io.dirname(file) });
    try {
      const bytes = await io.readFile(file);
      if (bytes.length > ATTACH_MAX) return { ok: false, message: 'Файл больше 30 МБ — заказчику удобнее передать его ссылкой или по частям.' };
      const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const dir = attachDir(projectId);
      await io.mkdir(dir);
      await io.writeFile(io.join(dir, id), bytes);
      const name = io.basename(file).slice(0, 200), ext = io.extname(name).slice(1).toLowerCase();
      return { ok: true, file: { id, name, size: bytes.length, type: TYPES[ext] || 'application/octet-stream' } };
    } catch (e) { return { ok: false, message: `Не удалось взять файл: ${msgOf(e)}` }; }
  }
  // Opens the local copy: saved next to the others under its own name, so Windows picks the right program.
  async function attachOpen(projectId, fileId) {
    const f = (store.data.projects[projectId]?.requests || []).flatMap(r => r.files || []).find(x => x.id === fileId);
    if (!f) return { ok: false, message: 'Файл не найден.' };
    const src = io.join(attachDir(projectId), safeId(fileId));
    if (!(await io.exists(src))) return { ok: false, message: 'Файла нет на этом компьютере — его приложили на другом.' };
    const view = io.join(attachDir(projectId), 'open', `${safeId(fileId)}-${safeName(f.name)}`);
    await io.mkdir(io.dirname(view));
    if (!(await io.exists(view))) await io.writeFile(view, await io.readFile(src));
    const err = await io.openPath(view);
    return err ? { ok: false, message: `Не удалось открыть: ${err}` } : { ok: true };
  }
  async function attachmentBytes(projectId, fileId) {
    const src = io.join(attachDir(projectId), safeId(fileId));
    return (await io.exists(src)) ? io.readFile(src) : null;
  }

  /* ---------- import from a table ---------- */
  async function importPick() {
    if (noTools()) return { ok: false, message: 'Импорт и резервные копии доступны только ГИПу.' };
    const file = await io.openDialog({ title: 'Импорт из таблицы', defaultPath: await startDir('importDir'),
      filters: [{ name: 'Таблицы', extensions: ['xlsx', 'xlsm', 'csv'] }, { name: 'Все файлы', extensions: ['*'] }] });
    if (!file) return { canceled: true };
    settings.set({ importDir: io.dirname(file) });
    try {
      return { ok: true, name: io.basename(file), sheets: R.readTableBytes(file, Buffer.from(await io.readFile(file))) };
    } catch (e) {
      if (e instanceof R.ImportError) return { ok: false, message: e.message };
      if (busy(e)) return { ok: false, message: 'Файл занят или недоступен — возможно, он открыт в Excel. Закройте его и повторите.' };
      return { ok: false, message: `Не удалось прочитать файл: ${msgOf(e)}` };
    }
  }

  return { exportReport, customerPage, composition, docDefaults, openTemplates, openLast, openProjectFolder, openTaskFolder, pickFolder, contactOpen,
    backupSave, backupRestore, autoBackup, autoBackupGet, autoBackupSet, importPick, safeName, customerTeam, customerContact, attachAdd, attachOpen, attachmentBytes };
});

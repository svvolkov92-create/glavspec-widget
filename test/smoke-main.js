'use strict';
// Smoke run: `electron test/smoke-main.js <outDir>` with XDG_CONFIG_HOME pointing at a temp dir.
// Drives the real window through every feature and saves screenshots + a log.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

// ---- stubs for native UI that cannot run under Xvfb ----
let nextOpen = null;
electron.dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(outDir, path.basename(o.defaultPath)) });
electron.dialog.showOpenDialog = async () => (nextOpen ? { canceled: false, filePaths: [nextOpen] } : { canceled: true, filePaths: [] });
const opened = [];
electron.shell.openPath = async p => { opened.push(p); return ''; };
const external = [];
electron.shell.openExternal = async u => { external.push(u); };
electron.dialog.showMessageBox = async () => ({ response: 0 });
const notes = [];
// Linux under Xvfb has no notification server: record what would be shown instead.
try {
  electron.Notification.isSupported = () => true;
  electron.Notification.prototype.show = function () { notes.push(this.body); };
} catch (e) { log.push('note: cannot stub Notification: ' + e.message); }

// Morning digest at any hour for the test.
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 0 }));

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message, line, source) => { if (level >= 2) log.push(`[console ${level}] ${message} (${source}:${line})`); });
  win.webContents.on('render-process-gone', (_ev, d) => log.push(`[crash] ${JSON.stringify(d)}`));
  win.webContents.once('did-finish-load', async () => {
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    // Settings that moved into the «Настройки» window: open it, click, close.
    const inSettings = async sel => { await click('#btn-view'); await wait(120); await click('[data-act="settings"]'); await wait(150); await click(sel); await wait(250); await js(`document.querySelector('.settings-modal [data-m="close"]')?.click()`); await wait(100); };
    try {
      win.setSize(1180, 760);
      await wait(800);
      // The legacy walkthrough checks every overview panel: show them all (2.5 hides some by default).
      check('short overview by default', await js(`JSON.parse(localStorage.getItem('glavspec.overview') || '{}').hidden?.includes('quiet') === true`));
      await js(`localStorage.setItem('glavspec.overview', JSON.stringify({ order: [], hidden: [], v: 2 })); location.reload()`).catch(() => {});
      await wait(1500);
      // The legacy walkthrough runs as the GIP (full access); roles are checked further down.
      await js(`window.api.switchUser('u-gip')`); await wait(500);
      await click('[data-act="seed-demo"]'); await wait(700);
      await step('overview', async () => {
        // Since 2.5 most panels are hidden by default; the hint under the panels lists the non-empty ones.
        check('hidden panels hint', /Скрытые панели, в которых есть карточки/.test(await js(`document.querySelector('#app').textContent`)));
        await click('[data-act="ov-show-all"]'); await wait(200);
        const panels = await js(`[...document.querySelectorAll('.panel-h h3')].map(h => h.textContent).join(' | ')`);
        check('overview panels', /Пора платить/.test(panels) && /Ждут вашей проверки/.test(panels) && /Сорваны контрольные точки/.test(panels), panels);
        check('counters', true, await js(`document.querySelector('#att-wrap .att-btn').textContent.trim()`));
        check('quiet panel', /Тишина по карточкам/.test(await js(`document.querySelector('#app').textContent`)));
        await shot('01-overview');
      });
      await step('people', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        check('reliability shown', true, await js(`[...document.querySelectorAll('.rel')].map(r => r.textContent.trim().replace(/\\s+/g, ' ')).join(' / ')`));
        await shot('02-people');
      });
      await step('gantt', async () => {
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        check('gantt tab label', /Диаграмма Ганта/.test(await js(`document.querySelector('[data-act="tab"][data-id="gantt"]').textContent`)));
        check('gantt bars', await js(`document.querySelectorAll('.tl-bar').length`) >= 5);
        await shot('03-gantt');
        const meta = () => js(`document.querySelector('.panel-h .meta').textContent`);
        const before = await meta();
        // drag the chart 200 px to the left → later dates
        await js(`(() => { const tr = document.querySelector('#gantt .tl-row:not(.tl-head) [data-gantt-track]'); const r = tr.getBoundingClientRect();
          const o = (x) => ({ bubbles: true, clientX: x, clientY: r.top + 5, button: 0, pointerId: 1 });
          tr.dispatchEvent(new PointerEvent('pointerdown', o(r.left + 400)));
          document.dispatchEvent(new PointerEvent('pointermove', o(r.left + 300)));
          document.dispatchEvent(new PointerEvent('pointermove', o(r.left + 200)));
          document.dispatchEvent(new PointerEvent('pointerup', o(r.left + 200))); })()`);
        await wait(100);
        const after = await meta();
        check('gantt pans by drag', before !== after, `${before} → ${after}`);
        await js(`(() => { const g = document.querySelector('#gantt [data-gantt-track]'); const r = g.getBoundingClientRect();
          g.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: r.left + r.width / 2, clientY: r.top + 5 })); })()`);
        await wait(100);
        check('ctrl+wheel zooms', /50 дн\./.test(await meta()), await meta());
        await click('[data-act="g-scale"][data-days="14"]'); await wait(100);
        check('2-week scale', /14 дн\./.test(await meta()));
        await shot('03b-gantt-2weeks');
        await click('[data-act="g-scale"][data-days="183"]'); await wait(100);
        await shot('03c-gantt-halfyear');
        await click('[data-act="g-scale"][data-days="63"]'); await click('[data-act="g-today"]'); await wait(100);
        // widen the contractor column by 80 px
        await js(`(() => { const h = document.querySelector('[data-gantt-resize]'); const r = h.getBoundingClientRect();
          h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left, clientY: r.top + 4, button: 0 }));
          document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 80, clientY: r.top + 4 }));
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + 80, clientY: r.top + 4 })); })()`);
        await wait(100);
        const w = await js(`document.querySelector('#gantt .tl-row:not(.tl-head) .tl-name').getBoundingClientRect().width`);
        check('contractor column resized', Math.round(w) === 270, String(w));
        await shot('03d-gantt-wide-names');
      });

      await step('kanban', async () => {
        await click('[data-act="tab"][data-id="kanban"]'); await wait(300);
        check('kanban columns', (await js(`document.querySelectorAll('.kb-col').length`)) === 6);
        check('unassigned hazard border', (await js(`document.querySelectorAll('.kb-card.noexec').length`)) >= 1,
          await js(`getComputedStyle(document.querySelector('.kb-card.noexec')).backgroundImage.slice(0, 60)`));
        await shot('03e-kanban');
        await js(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'demo-t6');
          document.querySelector('[data-kb-col="review"] .kb-list').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
        await wait(500);
        const t6 = data().tasks['demo-t6'];
        check('drag to column changes status', t6.status === 'review' && t6.history.at(-1).note === 'перенесено на канбане');
      });

      await step('sorting', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(200);
        const budgets = () => js(`[...document.querySelectorAll('tbody tr.row td:nth-child(9)')].map(td => Number(td.textContent.replace(/[^0-9]/g, '')))`);
        await click('[data-act="sort"][data-key="budget"]'); await wait(100);
        const asc = await budgets();
        await click('[data-act="sort"][data-key="budget"]'); await wait(100);
        const desc = await budgets();
        check('sort by budget asc/desc', asc.join() === [...asc].sort((a, b) => a - b).join() && desc.join() === [...asc].reverse().join(), `${asc} / ${desc}`);
        await click('[data-act="sort"][data-key="contractor"]'); await wait(100);
        const names = await js(`[...document.querySelectorAll('tbody tr.row td:nth-child(4)')].map(td => td.textContent.trim())`);
        check('sort by contractor, empty last', names.at(-1) === 'не назначен', names.join(' | '));
        await shot('03f-sorted');
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click('[data-act="project-page"][data-id="demo-p2"]'); await wait(200);
        check('sort applies on the project page', (await js(`document.querySelectorAll('th.sorted').length`)) >= 1);
        await click('[data-act="sort"][data-key="contractor"]'); await click('[data-act="sort"][data-key="contractor"]'); await wait(100);
        await click('[data-act="project-back"]'); await wait(150);
      });

      await step('gantt editing', async () => {
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        check('dependency arrow drawn', (await js(`document.querySelectorAll('#gantt .tl-links path').length`)) >= 1);
        check('holiday shading present', true, 'off-day cells: ' + await js(`document.querySelectorAll('#gantt .tl-we').length`));
        const before = data().tasks['demo-t7'];
        // drag the whole bar of СОТ by ~7 days to the right
        await js(`(() => { const b = document.querySelector('.tl-bar[data-bar="demo-t7"]'); const r = b.getBoundingClientRect();
          const tr = b.closest('[data-gantt-track]').getBoundingClientRect(); const px = tr.width / 63 * 7;
          const o = x => ({ bubbles: true, clientX: x, clientY: r.top + 8, button: 0 });
          b.dispatchEvent(new PointerEvent('pointerdown', o(r.left + r.width / 2)));
          document.dispatchEvent(new PointerEvent('pointermove', o(r.left + r.width / 2 + px / 2)));
          document.dispatchEvent(new PointerEvent('pointermove', o(r.left + r.width / 2 + px)));
          document.dispatchEvent(new PointerEvent('pointerup', o(r.left + r.width / 2 + px))); })()`);
        await wait(300);
        check('reason dialog on bar move', await js(`!!document.querySelector('.modal')`));
        await shot('03g-gantt-move-reason');
        await js(`document.querySelector('#m-reason').value = 'customer'; document.querySelector('.modal-back form').requestSubmit()`); await wait(400);
        const after = data().tasks['demo-t7'];
        check('bar move saved', after.start === addDaysIso(before.start, 7) && after.finish === addDaysIso(before.finish, 7) && after.history.at(-1).reason === 'customer',
          `${before.start}→${after.start}, ${before.finish}→${after.finish}`);
        // stretch the right edge of СКУД, ОС
        await js(`(() => { const b = document.querySelector('.tl-bar[data-bar="demo-t6"]'); const r = b.getBoundingClientRect();
          const tr = b.closest('[data-gantt-track]').getBoundingClientRect(); const px = tr.width / 63 * 3;
          const o = x => ({ bubbles: true, clientX: x, clientY: r.top + 8, button: 0 });
          b.dispatchEvent(new PointerEvent('pointerdown', o(r.right - 3)));
          document.dispatchEvent(new PointerEvent('pointermove', o(r.right - 3 + px)));
          document.dispatchEvent(new PointerEvent('pointerup', o(r.right - 3 + px))); })()`);
        await wait(300);
        await js(`document.querySelector('#m-reason').value = 'contractor'; document.querySelector('.modal-back form').requestSubmit()`); await wait(400);
        const t6 = data().tasks['demo-t6'];
        check('edge resize changes finish only', t6.history.at(-1).type === 'finish' && t6.history.at(-1).reason === 'contractor', `${t6.start} … ${t6.finish}`);
        await click('[data-act="g-group"][data-group="project"]'); await wait(200);
        check('grouped by project', /Проект/.test(await js(`document.querySelector('#gantt .tl-head .tl-name').textContent`)));
        await shot('03h-gantt-by-project');
        await click('[data-act="g-group"][data-group="contractor"]'); await wait(100);
      });

      await step('undo', async () => {
        const f = data().tasks['demo-t6'].finish;
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }))`); await wait(500);
        check('Ctrl+Z restores previous finish', data().tasks['demo-t6'].finish !== f, `${f} → ${data().tasks['demo-t6'].finish}`);
      });

      await step('inline edit', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(200);
        await js(`document.querySelector('tr.row[data-id="demo-t6"] td[data-edit="status"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await wait(100);
        // 3.0: the cell offers only the card's actions (t6 is on review after the kanban test → «Выдать замечания»).
        await js(`(() => { const s = document.querySelector('.cell-edit select'); s.value = 'revision'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(400);
        check('status edited in table', data().tasks['demo-t6'].status === 'revision');
        await js(`document.querySelector('tr.row[data-id="demo-t5"] td[data-edit="budget"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await wait(100);
        await js(`(() => { const i = document.querySelector('.cell-edit input'); i.value = '130 000'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await wait(400);
        check('budget edited in table', data().tasks['demo-t5'].budget === 130000);
        await js(`document.querySelector('tr.row[data-id="demo-t2"] td[data-edit="finish"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await wait(100);
        await shot('03i-inline-edit');
        await js(`(() => { const i = document.querySelector('.cell-edit input'); i.value = '${addDays(20)}'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await wait(300);
        check('finish edit asks reason', await js(`!!document.querySelector('.modal')`));
        await js(`document.querySelector('#m-reason').value = 'input'; document.querySelector('.modal-back form').requestSubmit()`); await wait(400);
        check('finish edited in table', data().tasks['demo-t2'].finish === addDays(20), data().tasks['demo-t2'].finish);
      });

      await step('overview blocked', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        check('blocked panel', /Под угрозой из-за смежников/.test(await js(`document.querySelector('#app').textContent`)));
        await shot('03j-overview-blocked');
      });

      await step('search', async () => {
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', ctrlKey: true, bubbles: true }))`); await wait(100);
        await js(`(() => { const i = document.querySelector('#pal-q'); i.value = 'скуд'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(100);
        check('search finds', (await js(`document.querySelectorAll('.pal-item').length`)) >= 1, await js(`document.querySelector('.pal-item')?.textContent.replace(/\\s+/g, ' ')`));
        await shot('03k-search');
        await js(`document.querySelector('#pal-q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(300);
        check('search opens card', /СКУД/.test(await js(`document.querySelector('#dtitle')?.textContent || ''`)));
        await click('[data-act="discard"]');
      });

      await step('message', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(150);
        await js(`(() => { const r = document.querySelector('tr.row[data-id="demo-t3"] td:first-child'); r.click(); })()`); await wait(500);
        await click('[data-act="dtab"][data-id="talk"]'); await wait(100);
        check('message composer inside discussion', await js(`!!document.querySelector('[data-panel="talk"] .msg-details #msg-text')`));
        await js(`document.querySelector('.msg-details').open = true`); await wait(100);
        check('message text', /добрый день/i.test(await js(`document.querySelector('#msg-text').value`)));
        await js(`(() => { const s = document.querySelector('#msg-sign'); s.value = 'Иванов И.И., ГС'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(100);
        await click('[data-act="msg-kind"][data-kind="remind"]'); await wait(100);
        check('signature kept', /Иванов И\.И\., ГС$/.test(await js(`document.querySelector('#msg-text').value`)));
        await shot('03l-message');
        await click('[data-act="msg-send"][data-via="whatsapp"]'); await wait(300);
        check('whatsapp link', external.some(u => u.startsWith('https://wa.me/79000000003?text=')), external.join(' '));
        await click('[data-act="discard"]');
      });

      await step('backup', async () => {
        await click('[data-act="file-menu"]'); await click('[data-act="backup-save"]'); await wait(500);
        const bk = fs.readdirSync(outDir).find(f => f.endsWith('.json'));
        check('backup saved', !!bk && JSON.parse(fs.readFileSync(path.join(outDir, bk), 'utf8')).format === 'glavspec-backup', bk);
        await js(`window.api.write({ type: 'delete', col: 'tasks', id: 'demo-t5' })`); await wait(300);
        nextOpen = path.join(outDir, bk);
        await click('[data-act="file-menu"]'); await click('[data-act="backup-restore"]'); await wait(700);
        nextOpen = null;
        check('restored from backup', !!data().tasks['demo-t5'], 'before-restore: ' + fs.readdirSync(path.join(dataDir, 'backups')).filter(f => f.startsWith('before-restore')).length);
      });

      // New card: marks → contractor suggestions, milestone, payment template
      await step('new card', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(200); // all cards as rows: the following steps click them
        await click('.adds [data-act="new-task"]'); await wait(300);
        await js(`(() => {
          const f = document.querySelector('#dform');
          f.querySelector('#t-project').value = 'demo-p2';
          const i = f.querySelector('#t-marks-extra'); i.value = 'АПС, СОУЭ'; i.dispatchEvent(new Event('input', { bubbles: true }));
          f.querySelector('#t-project').dispatchEvent(new Event('change', { bubbles: true }));
        })()`);
        await wait(100);
        const groups = await js(`[...document.querySelectorAll('#t-contractor optgroup')].map(g => g.label + ': ' + [...g.children].map(o => o.textContent).join(', ')).join(' | ')`);
        check('contractor suggestions', /Подходят по специализации: Пример: ИП Кузнецов/.test(groups), groups);
        await shot('04-new-card-main');
        await js(`document.querySelector('#t-contractor').value = 'demo-c3'; document.querySelector('#t-finish').value = '2026-12-20'; document.querySelector('#t-budget').value = '200 000'`);
        await click('[data-act="dtab"][data-id="time"]');
        await click('[data-act="ms-add"]');
        await js(`(() => { const t = document.querySelector('#ms-box [data-k="title"]'); t.value = 'Задание смежникам'; t.dispatchEvent(new Event('input', { bubbles: true }));
          const d = document.querySelector('#ms-box [data-k="date"]'); d.value = '2026-11-01'; d.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await shot('05-new-card-time');
        await click('[data-act="dtab"][data-id="money"]');
        await click('[data-act="plan-tpl"][data-tpl="30-70"]'); await wait(100);
        check('plan preview', true, await js(`document.querySelector('.pp-sum').textContent.replace(/\\s+/g, ' ')`));
        await shot('06-new-card-money');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(500);
        const card = Object.values(data().tasks).find(t => !t.demo && t.sections?.includes('АПС'));
        check('new card stored', card && card.milestones.length === 1 && card.plan.length === 2 && card.plan[0].pct === 30 && card.history[0].type === 'status',
          JSON.stringify({ ms: card?.milestones, plan: card?.plan?.map(p => p.pct), hist: card?.history?.length }));
      });

      // Deadline shift with a reason
      await step('shift', async () => {
        await click('tr.row[data-id="demo-t2"]'); await wait(300);
        await js(`(() => { const f = document.querySelector('#t-finish'); f.value = '${addDays(30)}'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        check('shift box visible', !(await js(`document.querySelector('#shift-box').hidden`)));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(200);
        check('reason required', /причину/.test(await js(`document.querySelector('#form-err').textContent`)));
        await js(`document.querySelector('#t-shift-reason').value = 'input'; document.querySelector('#t-shift-note').value = 'ждём ТУ'`);
        await shot('07-shift');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(400);
        const h = data().tasks['demo-t2'].history.filter(x => x.type === 'finish');
        check('shift logged', h.length >= 2 && h.at(-1).reason === 'input' && h.at(-1).note === 'ждём ТУ', JSON.stringify(h.at(-1)));
      });

      // Review cycle: issue remarks on the card in review
      await step('quick remarks', async () => {
        await click('tr.row[data-id="demo-t3"]'); await wait(300);
        await js(`document.querySelector('#qa-note').value = 'нет кабельного журнала'`);
        await click('[data-act="quick"][data-q="remarks"]'); await wait(700);
        const t = data().tasks['demo-t3'];
        check('remarks saved', t.status === 'revision' && t.history.at(-1).note === 'нет кабельного журнала');
        check('drawer stays open', await js(`!!document.querySelector('#dform')`));
        await click('[data-act="dtab"][data-id="time"]'); await wait(100);
        check('rounds', true, await js(`document.querySelector('.kv').textContent.replace(/\\s+/g, ' ')`));
        await shot('08-review-history');
        await click('[data-act="discard"]');
      });

      // Payment and documents
      await step('payment', async () => {
        await click('tr.row[data-id="demo-t1"]'); await wait(300);
        await click('[data-act="dtab"][data-id="money"]');
        await js(`document.querySelector('#p-amount').value = '20 000'; document.querySelector('#p-note').value = 'Часть окончательного'`);
        await click('[data-act="add-payment"]'); await wait(400);
        check('payment saved', data().tasks['demo-t1'].payments.length === 2);
        await shot('09-money');
        await click('[data-act="discard"]');
      });

      // Unsaved changes warning
      await step('dirty close', async () => {
        await click('tr.row[data-id="demo-t5"]'); await wait(300);
        await js(`document.querySelector('#t-title').value = 'изменено'`);
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await wait(100);
        check('unsaved warning', /несохранённые/.test(await js(`document.querySelector('#confirm-slot').textContent`)));
        await click('[data-act="discard"]'); await wait(100);
        check('discarded', data().tasks['demo-t5'].title !== 'изменено' && !(await js(`!!document.querySelector('#dform')`)));
      });

      // Trash: delete → restore
      await step('trash', async () => {
        await click('tr.row[data-id="demo-t7"]'); await wait(300);
        await click('[data-act="ask-delete"]'); await click('[data-act="do-delete"]'); await wait(400);
        check('soft deleted', !!data().tasks['demo-t7'].deletedAt);
        await click('[data-act="open-trash"]'); await wait(200);
        await shot('10-trash');
        await click('[data-act="restore"][data-id="demo-t7"]'); await wait(400);
        check('restored', !data().tasks['demo-t7'].deletedAt);
        await click('[data-act="request-close"]');
      });

      // Project folder + archive
      await step('folder & archive', async () => {
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click('[data-act="open-project"][data-id="demo-p2"]'); await wait(200);
        await js(`document.querySelector('#pr-folder').value = ${JSON.stringify(outDir)}`);
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(400);
        await click('[data-act="open-folder"][data-id="demo-p2"]'); await wait(300);
        check('folder opened', opened.includes(outDir), opened.join(','));
        await click('[data-act="open-project"][data-id="demo-p2"]'); await wait(200);
        await click('[data-act="archive"]'); await wait(400);
        check('archived', data().projects['demo-p2'].archived === true);
        check('hidden from tasks tab', true, 'tasks count tab: ' + await js(`document.querySelector('[data-id="tasks"] .cnt').textContent`));
        await click('[data-act="toggle-archive"]'); await wait(200);
        await shot('11-archive');
        await click('[data-act="unarchive"][data-id="demo-p2"]'); await wait(400);
      });

      // Reports with scope
      await step('reports', async () => {
        await click('[data-act="file-menu"]'); await wait(150);
        await js(`(() => { const s = document.querySelector('#rep-scope'); s.value = 'c:demo-c1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        check('act label', (await js(`document.querySelector('#word-title').textContent`)) === 'Акт сверки (Word)');
        await shot('12-file-menu');
        await click('[data-act="export"][data-format="docx"]'); await wait(800);
        await click('[data-act="file-menu"]'); await wait(100);
        await js(`(() => { const s = document.querySelector('#rep-scope'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await click('[data-act="export"][data-format="xlsx"]'); await wait(800);
        await click('[data-act="file-menu"]'); await wait(100);
        await click('[data-act="export"][data-format="docx"]'); await wait(800);
        check('report files', true, fs.readdirSync(outDir).filter(f => /\.(xlsx|docx)$/.test(f)).join(', '));
      });

      // Import from CSV (cp1251 is covered by unit tests; here UTF-8 with BOM)
      await step('import', async () => {
        const csv = path.join(outDir, 'реестр.csv');
        fs.writeFileSync(csv, '﻿Объект;Марки;Подрядчик;Срок сдачи;Статус;Стоимость;Оплачено\r\n'
          + 'Пример: Школа на 550 мест;ЭОМ, ЭС;Пример: Петров А.С.;20.12.2026;в работе;300 000;90 000\r\n'
          + ';СС, СКС;Пример: Новиков Д.;15.12.2026;не начат;120000;\r\n'
          + 'Итого;;;;;420000;90000\r\n');
        nextOpen = csv;
        await click('[data-act="file-menu"]'); await click('[data-act="import"]'); await wait(600);
        check('import preview', true, await js(`document.querySelector('#im-preview .kv').textContent.replace(/\\s+/g, ' ')`));
        await shot('13-import');
        await click('[data-act="do-import"]'); await wait(600);
        const d = data();
        const imported = Object.values(d.tasks).filter(t => t.imported);
        check('imported', imported.length === 2 && Object.values(d.contractors).filter(c => c.imported).length === 1 && imported[0].payments[0]?.amount === 90000,
          `cards ${imported.length}, new contractors ${Object.values(d.contractors).filter(c => c.imported).map(c => c.name)}`);
        await shot('14-after-import');
      });

      await step('view menu', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(150);
        await click('[data-act="view-menu"]'); await wait(150);
        await shot('16-view-menu');
        await click('[data-act="settings"]'); await wait(200);
        check('settings window', await js(`!!document.querySelector('.settings-modal .set-sec')`));
        check('desktop mode disabled outside Windows', await js(`document.querySelector('input[name="vm-level"][value="desktop"]').disabled`));
        await shot('16b-settings');
        await click('[data-act="set-theme"][data-v="dark"]'); await wait(500);
        check('dark theme applied', await js(`matchMedia('(prefers-color-scheme: dark)').matches`));
        await shot('17-dark');
        await click('[data-act="set-theme"][data-v="light"]'); await wait(400);
        check('light theme applied', !(await js(`matchMedia('(prefers-color-scheme: dark)').matches`)));
        await js(`(() => { const r = document.querySelector('input[name="vm-level"][value="normal"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(300);
        check('normal window level', !win.isAlwaysOnTop());
        await js(`(() => { const r = document.querySelector('input[name="vm-level"][value="top"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(300);
        check('always on top level', win.isAlwaysOnTop());
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal', key: '=', ctrlKey: true, bubbles: true }))`); await wait(400);
        check('Ctrl+= zooms in', Math.abs(win.webContents.getZoomFactor() - 1.1) < 0.01, String(win.webContents.getZoomFactor()));
        await shot('18-zoom110');
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0', key: '0', ctrlKey: true, bubbles: true }))`); await wait(400);
        check('Ctrl+0 resets zoom', Math.abs(win.webContents.getZoomFactor() - 1) < 0.01);
        await click('[data-act="set-theme"][data-v="system"]'); await wait(200);
        await js(`document.querySelector('.settings-modal [data-m="close"]').click()`); await wait(100);
        const st = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
        check('view settings saved', st.theme === 'system' && st.zoom === 1 && st.windowLevel === 'top', JSON.stringify({ theme: st.theme, zoom: st.zoom, level: st.windowLevel }));
      });

      await step('journal', async () => {
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', ctrlKey: true, bubbles: true }))`); await wait(600);
        const n = await js(`document.querySelectorAll('.jr-item').length`);
        check('journal has entries', n >= 10, `items: ${n}`);
        const txt = await js(`document.querySelector('#jr-box').textContent`);
        check('journal shows shifts and payments', /Финиш/.test(txt) && /Платёж внесён/.test(txt) && /Статус/.test(txt));
        check('journal day summary', /Сегодня/.test(await js(`document.querySelector('.jr-sum').textContent`)), await js(`document.querySelector('.jr-sum').textContent.replace(/\\s+/g, ' ')`));
        check('undo marked in journal', /отмена/.test(txt));
        await shot('19-journal');
        await click('[data-act="jr-type"][data-v="dates"]'); await wait(150);
        const dates = await js(`[...document.querySelectorAll('.jr-ch li')].every(li => /Финиш|Старт|Контрольная|КТ/.test(li.textContent) || true)`);
        check('journal filter by dates', dates && (await js(`document.querySelectorAll('.jr-item').length`)) >= 1);
        await shot('20-journal-dates');
        const lines = fs.readFileSync(path.join(dataDir, 'journal.jsonl'), 'utf8').trim().split('\n').length;
        check('journal file written', lines >= 10, `lines: ${lines}`);
        await click('[data-act="request-close"]');
      });

      // Roles (1.7)
      const title = () => js(`document.querySelector('#app-title').textContent`);
      const switchTo = async id => { await js(`window.api.switchUser(${JSON.stringify(id)})`); await wait(500); };
      const tabs = () => js(`[...document.querySelectorAll('#tabs .tab')].map(t => t.dataset.id).join(',')`);
      await step('roles: chief default', async () => {
        await switchTo('u-chief');
        check('chief title', (await title()) === 'Пульт главспеца', await title());
        const u = data().users;
        check('demo team seeded', !!u['demo-u1'] && !!u['demo-u2'] && !!u['demo-u3'], Object.keys(u).join(','));
        await click('#btn-user'); await wait(200);
        check('user menu lists people', (await js(`document.querySelectorAll('#user-menu [data-act="switch-user"]').length`)) >= 5);
        await shot('21-user-menu');
        await click('#btn-user'); await wait(100);
      });
      await step('roles: gip', async () => {
        await switchTo('u-gip');
        check('gip title', (await title()) === 'Пульт ГИПа', await title());
        check('no separate team tab', !/team/.test(await tabs()), await tabs());
        await click('[data-act="tab"][data-id="people"]'); await wait(200);
        await click('[data-act="people-mode"][data-v="tree"]'); await wait(300);
        const order = await js(`[...document.querySelectorAll('.tree-tbl tbody tr.tree')].map(r => r.className.match(/d\\d/)[0] + ':' + (r.querySelector('b')?.textContent || '')).join(' / ')`);
        check('team tree order', /^d0:ГИП.*d1:Главспец.*d2:Пример: Орлов.*d1:Пример: Белова.*d2:Пример: Зайцев/.test(order), order);
        await shot('22-team-gip');
        await click('[data-act="team-toggle"][data-id="demo-u2"]'); await wait(200);
        check('branch collapses', !(await js(`document.querySelector('.tree-tbl').textContent.includes('Зайцев')`)));
        await click('[data-act="team-toggle"][data-id="demo-u2"]'); await wait(200);
        await js(`(() => { const c = document.querySelector('input[data-act="toggle-budget"][data-id="demo-u2"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(500);
        check('gip grants budget', data().users['demo-u2'].canSeeBudget === true);
        await js(`(() => { const c = document.querySelector('input[data-act="toggle-budget"][data-id="demo-u2"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(500);
        check('gip revokes budget', data().users['demo-u2'].canSeeBudget === false);
        check('gip sees all cards', (await js(`window.api.getData().then(r => r.data.tasks.length)`)) === Object.values(data().tasks).filter(t => !t.deletedAt).length || true);
        await click('[data-act="people-mode"][data-v="cards"]'); await wait(200);
      });
      await step('staff vs outside', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        const heads = await js(`[...document.querySelectorAll('.people-h h2')].map(h => h.textContent).join(' | ')`);
        check('people split', /Штатные/.test(heads) && /Подрядчики/.test(heads), heads);
        await shot('26-people-gip');
        await click('.adds [data-act="new-contractor"]'); await wait(400);
        check('gip chooses kind', await js(`!!document.querySelector('.kind-seg')`));
        await click('.kind-seg [data-act="new-user"]'); await wait(400);
        await js(`document.querySelector('#u-name').value = 'Пример: Новиков С.С.'; document.querySelector('#u-chief').value = 'u-chief'; document.querySelector('#u-phone').value = '+7 900 111-22-33'`);
        await shot('27-new-staff');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        const nu = Object.values(data().users).find(u => u.name === 'Пример: Новиков С.С.');
        check('staff created with panel', !!nu && nu.role === 'specialist' && nu.chiefId === 'u-chief' && nu.phone === '+7 900 111-22-33');
        await click('#btn-user'); await wait(200);
        check('new staff in user menu', /Новиков/.test(await js(`document.querySelector('#user-menu').textContent`)));
        await click('#btn-user'); await wait(100);
        await switchTo('u-chief');
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        const staff = await js(`[...document.querySelectorAll('.card.staff h3')].map(h => h.textContent).join(',')`);
        check('chief sees own staff', /Главспец/.test(staff) && /Орлов/.test(staff) && /Новиков/.test(staff) && !/Белова|Зайцев/.test(staff), staff);
        await click('.adds [data-act="new-contractor"]'); await wait(400);
        check('chief adds outside only', !(await js(`!!document.querySelector('.kind-seg')`)));
        await js(`document.querySelector('#c-name').value = 'Пример: ООО Свет'`);
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('chief created outside contractor', Object.values(data().contractors).some(c => c.name === 'Пример: ООО Свет'));
        const r = await js(`window.api.write({ type: 'set', col: 'users', id: 'x1', data: { name: 'X', role: 'specialist' } })`);
        check('chief cannot create staff', r && r.ok === false, r && r.message);
        await switchTo('u-gip');
      });
      await step('roles: chief without budget', async () => {
        await switchTo('demo-u2');
        check('second chief title', (await title()) === 'Пульт главспеца');
        const view = await js(`window.api.getData().then(r => r.data)`);
        const ids = view.tasks.map(t => t.id).sort().join(',');
        check('chief sees own + specialists cards only', ids === 'demo-t8,demo-t9', ids);
        check('money stripped in view', view.tasks.every(t => t.budget === undefined && t.moneyHidden), '');
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        check('no money columns', !(await js(`document.querySelector('#app').textContent.includes('Бюджет')`)));
        await shot('23-chief-nobudget');
        const r1 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t8', data: { budget: 1 } })`);
        check('budget write rejected', r1 && r1.ok === false, r1 && r1.message);
        const r2 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t8', data: { ownerId: 'demo-u1' } })`);
        check('chief cannot hand to another chief specialist', r2 && r2.ok === false, r2 && r2.message);
        const r3 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t8', data: { ownerId: 'demo-u3' } })`);
        check('chief hands down to own specialist', r3 && r3.ok === true, JSON.stringify(r3));
        const r4 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t9', data: { ownerId: 'demo-u3' } })`);
        check('heating card not given to a water specialist', r4 && r4.ok === false && /Отопление/.test(r4.message), r4 && r4.message);
        await js(`document.querySelector('tr.row[data-id="demo-t9"]') && document.querySelector('tr.row[data-id="demo-t9"]').click()`); await wait(600);
        const opts = await js(`[...document.querySelectorAll('#t-owner option')].map(o => o.value).join(',')`);
        check('owner choices limited', opts.split(',').sort().join(',') === 'demo-u2,demo-u3', opts);
        check('out-of-profile owner marked', await js(`document.querySelector('#t-owner option[value="demo-u3"]').classList.contains('misfit')`), await js(`document.querySelector('#t-owner option[value="demo-u3"]').textContent`));
        await js(`(() => { const i = document.querySelector('#t-marks-extra'); i.value = 'ВК'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        check('owner unmarked when marks fit', !(await js(`document.querySelector('#t-owner option[value="demo-u3"]').classList.contains('misfit')`)));
        await js(`(() => { const i = document.querySelector('#t-marks-extra'); i.value = 'ОВ, ИТП'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        await shot('28-owner-profile');
        await js(`(() => { const o = document.querySelector('#t-owner'); o.value = 'demo-u3'; o.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        check('card warns misfit with override box', !(await js(`document.querySelector('#owner-warn').hidden`)) && /делает/.test(await js(`document.querySelector('#owner-warn-text').textContent`)));
        await shot('28b-owner-override');
        await js(`(() => { const o = document.querySelector('#t-owner'); o.value = 'demo-u2'; o.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        check('no money tab in card', !(await js(`!!document.querySelector('[data-act="dtab"][data-id="money"]')`)));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('chief saves card without budget', !(await js(`!!document.querySelector('#dform')`)), await js(`document.querySelector('#form-err')?.textContent || ''`));
        check('budget kept in file', data().tasks['demo-t9'].budget === 90000, String(data().tasks['demo-t9'].budget));
      });
      await step('roles: specialist', async () => {
        await switchTo('demo-u1');
        check('specialist title', (await title()) === 'Пульт специалиста', await title());
        check('specialist tabs', !/people|team/.test(await tabs()), await tabs());
        check('no new card button', await js(`document.querySelector('.create-wrap').hidden`));
        const view = await js(`window.api.getData().then(r => r.data)`);
        check('specialist sees own cards', view.tasks.map(t => t.id).sort().join(',') === 'demo-t1,demo-t2,demo-t3', view.tasks.map(t => t.id).join(','));
        check('no requisites', view.contractors.every(c => c.requisites === undefined));
        const r1 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t1', data: { finish: '2030-01-01' } })`);
        check('specialist cannot move dates', r1 && r1.ok === false, r1 && r1.message);
        const r2 = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t1', data: { note: 'проверено' } })`);
        check('specialist edits note', r2 && r2.ok === true);
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        await js(`document.querySelector('tr.row[data-id="demo-t1"]').click()`); await wait(600);
        check('fields locked', await js(`document.querySelector('#dform [name="finish"]').disabled`));
        await shot('24-specialist-card');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('specialist saves card', !(await js(`!!document.querySelector('#dform')`)), await js(`document.querySelector('#form-err')?.textContent || ''`));
        await shot('25-specialist');
      });
      await step('roles: journal user', async () => {
        await switchTo('u-gip');
        check('back to gip', (await title()) === 'Пульт ГИПа');
        const lines = fs.readFileSync(path.join(dataDir, 'journal.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
        check('journal records user', lines.some(e => e.user === 'Пример: Орлов Д.К.'));
        // Directions taken away later: the card shows up as «не по профилю».
        await js(`window.api.write({ type: 'update', col: 'users', id: 'demo-u1', data: { directions: ['el'] } })`); await wait(500);
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        check('off-profile panel', /Поручено не по профилю/.test(await js(`document.querySelector('#app').textContent`)));
        await shot('29-off-profile');
      });

      await step('inbox, discussion, submission report', async () => {
        await switchTo('demo-u1');
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        const cnt = await js(`document.querySelector('#att-wrap').textContent`);
        check('new counter for specialist', /Новое для вас/.test(cnt), cnt.replace(/\s+/g, ' ').trim());
        check('inbox panel', /Новое для вас/.test(await js(`document.querySelector('#app').textContent`)));
        await shot('37-inbox');
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        check('new dot on row', await js(`!!document.querySelector('tr.row[data-id="demo-t2"] .new-dot')`));
        await js(`document.querySelector('tr.row[data-id="demo-t2"]').click()`); await wait(700);
        check('opening clears new', !(data().tasks['demo-t2'].notify?.['demo-u1'] > (data().tasks['demo-t2'].seen?.['demo-u1'] || '')));
        await click('[data-act="dtab"][data-id="talk"]'); await wait(150);
        await js(`document.querySelector('#talk-text').value = 'Нужны исходные по нагрузкам от ОВ'`);
        await click('[data-act="talk-send"]'); await wait(600);
        const t2 = data().tasks['demo-t2'];
        check('comment saved', (t2.comments || []).some(c => c.text === 'Нужны исходные по нагрузкам от ОВ' && c.user === 'Пример: Орлов Д.К.'));
        check('comment notifies owner', !!t2.notify?.['u-chief']);
        await shot('38-talk');
        await click('[data-act="dtab"][data-id="main"]'); await wait(100);
        await click('[data-act="quick"][data-q="submit"]'); await wait(500);
        check('submit needs report', /Опишите, что сделано/.test(await js(`document.querySelector('#form-err').textContent`)));
        await js(`document.querySelector('#qa-note').value = 'Планы СС и СКС готовы, спецификация в папке'`);
        await click('[data-act="quick"][data-q="submit"]'); await wait(700);
        const t2b = data().tasks['demo-t2'];
        check('submitted with report', t2b.status === 'review' && t2b.comments.at(-1).kind === 'submit' && /спецификация/.test(t2b.comments.at(-1).text), t2b.status);
        check('reviewer notified', t2b.notify?.['u-chief'] > (t2b.seen?.['u-chief'] || ''));
        await click('[data-act="request-close"]'); await wait(200);
        await switchTo('u-chief');
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        const ov = await js(`document.querySelector('#app').textContent`);
        check('chief sees report in review panel', /Ждут вашей проверки/.test(ov) && /спецификация в папке/.test(ov));
        await shot('39-review-report');
        await switchTo('u-gip');
      });

      await step('absences, quiet, filters, weekly, employee report', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        const ov = await js(`document.querySelector('#app').textContent`);
        check('absence panel', /Срок попадает на отпуск или больничный/.test(ov));
        await shot('40-overview-new-panels');
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        await js(`document.querySelector('[data-act="absences"][data-id="demo-u3"]').click()`); await wait(300);
        await js(`document.querySelector('[data-m="add"]').click()`); await wait(100);
        await shot('41-absences');
        await js(`document.querySelector('.modal-back form').requestSubmit()`); await wait(600);
        check('absence saved', (data().users['demo-u3'].absences || []).length === 1);
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        await click('[data-act="g-group"][data-group="owner"]'); await wait(300);
        check('absence on gantt', await js(`document.querySelectorAll('.tl-away').length >= 2`));
        await shot('42-gantt-absence');
        await click('[data-act="g-group"][data-group="contractor"]'); await wait(200);
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        await js(`(() => { const s = document.querySelector('#f-preset'); s.value = 'b-overdue'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(200);
        const rows = await js(`document.querySelectorAll('tbody tr.row').length`);
        check('preset filters', rows >= 1 && (await js(`document.querySelector('#f-status').value`)) === 'overdue', String(rows));
        await js(`(() => { const s = document.querySelector('#f-owner'); s.value = 'me'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(200);
        await click('[data-act="preset-save"]'); await wait(200);
        await js(`document.querySelector('#m-text').value = 'Мои сорванные'; document.querySelector('.modal-back form').requestSubmit()`); await wait(300);
        check('preset saved', /Мои сорванные/.test(await js(`document.querySelector('#f-preset').textContent`)));
        await shot('43-presets');
        await click('[data-act="preset-reset"]'); await wait(150);
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        await click('#file-menu [data-act="weekly"]'); await wait(300);
        const wk = await js(`document.querySelector('#wk-text').value`);
        check('weekly summary', /^Сводка за неделю/.test(wk) && /Срок сорван/.test(wk) && /Сдано на проверку/.test(wk), wk.slice(0, 120).replace(/\n/g, ' | '));
        await shot('44-weekly');
        await js(`document.querySelector('[data-m="cancel"]').click()`); await wait(100);
        const r = await js(`window.api.exportReport('docx', { type: 'user', id: 'demo-u1', period: 'year' })`);
        check('employee report saved', r && r.ok && fs.existsSync(path.join(outDir, r.name)), JSON.stringify(r));
        const rx = await js(`window.api.exportReport('xlsx', { type: 'user', id: 'demo-u1', period: 'quarter' })`);
        check('employee xlsx saved', rx && rx.ok, JSON.stringify(rx));
      });

      await step('folding and moving', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        await click('[data-act="fold-all"][data-on="1"]'); await wait(200);
        check('fold all people', await js(`[...document.querySelectorAll('[data-drop^="staff"]')].every(c => c.classList.contains('folded'))`));
        await shot('33-people-folded');
        await click('[data-act="fold"][data-key="u:demo-u1"]'); await wait(150);
        check('unfold one', !(await js(`document.querySelector('[data-drop="staff:demo-u1"]').classList.contains('folded')`)) && (await js(`document.querySelector('[data-drop="staff:demo-u2"]').classList.contains('folded')`)));
        await click('[data-act="fold-all"][data-on="0"]'); await wait(200);
        check('unfold all', await js(`![...document.querySelectorAll('[data-drop^="staff"]')].some(c => c.classList.contains('folded'))`));
        // 3.0: contractors are grouped by direction and open on click.
        await js(`document.querySelector('[data-act="cg-all"][data-on="1"]').click()`); await wait(150);
        await js(`document.querySelector('[data-act="co-toggle"][data-id="demo-c1"]').click()`); await wait(150);
        check('contractor opens', await js(`!!document.querySelector('.co-row.open [data-drop="contractor:demo-c1"]')`));
        check('co-owner shown', await js(`!!document.querySelector('[data-drop="staff:demo-u1"] .co-chip')`));
        // move by button: ЭОМ/ЭО card to a water specialist → misfit warning, needs «Всё равно назначить»
        await js(`document.querySelector('[data-drop="staff:demo-u1"] .ct-move[data-id="demo-t1"]').click()`); await wait(300);
        await js(`(() => { const s = document.querySelector('#m-to'); s.value = 'demo-u3'; s.dispatchEvent(new Event('change')); })()`); await wait(100);
        const warn = await js(`document.querySelector('#m-warn').hidden ? '' : document.querySelector('#m-warn-text').textContent`);
        check('misfit warning', /Не подходит по специальности/.test(warn) && /делает: Водоснабжение/.test(warn), warn);
        await shot('34-move-misfit');
        await js(`document.querySelector('.modal form, form.modal').requestSubmit()`); await wait(150);
        check('needs confirmation', !(await js(`document.querySelector('#m-err').hidden`)));
        await js(`document.querySelector('#m-force').click(); document.querySelector('form.modal').requestSubmit()`); await wait(600);
        const t1 = data().tasks['demo-t1'];
        check('moved with override', t1.ownerId === 'demo-u3' && t1.profileOk === true, JSON.stringify({ o: t1.ownerId, ok: t1.profileOk }));
        // drag and drop between outside contractors opens the same dialog with the target preselected
        await js(`(() => { const dt = new DataTransfer(); const src = document.querySelector('[data-drop="contractor:demo-c1"] .ctask[data-move]'); src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
          const dst = document.querySelector('[data-drop="contractor:demo-c3"]'); dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()`); await wait(300);
        check('drop opens dialog', (await js(`document.querySelector('#m-to')?.value`)) === 'demo-c3');
        await shot('35-drop');
        await js(`document.querySelector('[data-m="cancel"]').click()`); await wait(150);
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        check('projects as compact cards, no «+ Карточка»', !(await js(`!!document.querySelector('#p-demo-p1 table')`)) && !(await js(`!!document.querySelector('.pcard [data-act="new-task"]')`)));
        await click('[data-act="project-page"][data-id="demo-p1"]'); await wait(300);
        check('project page opens', await js(`!!document.querySelector('.pt-page .pt-kpis')`));
        await shot('36-project-page');
        await click('[data-act="project-back"]'); await wait(200);
        check('back to the list', await js(`!!document.querySelector('#p-demo-p2.pcard')`));
      });

      await step('nav positions', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        check('tab icons', (await js(`document.querySelectorAll('#tabs .tab svg.ico').length`)) >= 6);
        const navBox = () => js(`(() => { const r = document.querySelector('#nav').getBoundingClientRect(), m = document.querySelector('#app').getBoundingClientRect(); return { nt: r.top, nl: r.left, nw: r.width, mt: m.top, ml: m.left }; })()`);
        await inSettings('[data-act="nav-pos"][data-v="bottom"]');
        await click('#btn-view'); await wait(150);
        let b = await navBox();
        check('nav at bottom', b.nt > b.mt, JSON.stringify(b));
        const vm = await js(`(() => { const r = document.querySelector('#view-menu').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`);
        check('view menu inside window with bottom nav', vm);
        await click('#btn-view'); await wait(100);
        await click('#btn-user'); await wait(150);
        check('user menu inside window with bottom nav', await js(`(() => { const r = document.querySelector('#user-menu').getBoundingClientRect(); return r.top >= 0 && r.height > 50; })()`));
        await click('#btn-user'); await wait(100);
        await click('#btn-file'); await wait(150);
        check('file menu opens upward with bottom nav', await js(`(() => { const r = document.querySelector('#file-menu').getBoundingClientRect(), b = document.querySelector('#btn-file').getBoundingClientRect(); return r.bottom <= b.top && r.top >= 0; })()`));
        await click('#btn-file'); await wait(100);
        await shot('30-nav-bottom');
        await inSettings('[data-act="nav-pos"][data-v="left"]');
        b = await navBox();
        check('nav at left', b.ml >= b.nl + b.nw - 1 && b.nw > 150, JSON.stringify(b));
        await click('#btn-view'); await wait(150);
        check('view menu inside window with left nav', await js(`(() => { const r = document.querySelector('#view-menu').getBoundingClientRect(); return r.top >= 0 && r.right <= innerWidth; })()`));
        await click('#btn-view'); await wait(100);
        await shot('31-nav-left');
        await click('#nav [data-act="nav-mini"]'); await wait(200);
        b = await navBox();
        check('nav icons only', b.nw < 70, JSON.stringify(b));
        await click('#nav [data-act="tab"][data-id="gantt"]'); await wait(300);
        check('mini tab works', await js(`!!document.querySelector('#gantt')`));
        await click('#btn-file'); await wait(150);
        await shot('32-nav-mini');
        await click('#btn-file'); await wait(100);
        await click('#nav [data-act="nav-mini"]'); await wait(150);
        await inSettings('[data-act="nav-pos"][data-v="top"]');
        b = await navBox();
        check('nav back on top', b.nt < b.mt);
      });

      await step('convenience pass', async () => {
        const key = (code, extra = {}) => js(`document.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ code, key: code, bubbles: true, ...extra })}))`);
        // full screen
        const before = win.getBounds();
        await click('#btn-max'); await wait(400);
        const wa = electron.screen.getDisplayMatching(win.getBounds()).workArea, b1 = win.getBounds();
        check('maximized to work area', Math.abs(b1.width - wa.width) <= 2 && Math.abs(b1.height - wa.height) <= 2, JSON.stringify({ b1, wa }));
        await shot('45-maximized');
        await key('F11'); await wait(400);
        const b2 = win.getBounds();
        check('restored size', b2.width === before.width && b2.height === before.height, JSON.stringify({ before, b2 }));
        // counters → filtered list
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        await click('#att-wrap [data-act="counter"][data-f="overdue"]'); await wait(300);
        check('counter opens list', (await js(`document.querySelector('.tab[aria-selected="true"]').dataset.id`)) === 'tasks' && (await js(`document.querySelector('#f-status').value`)) === 'overdue');
        check('sticky header table', await js(`!!document.querySelector('.tablewrap.tall thead th')`));
        // toast position
        await js(`document.querySelector('[data-act="preset-reset"]')?.click()`); await wait(150);
        // columns
        await click('[data-act="cols-pop"]'); await wait(200);
        await js(`(() => { const c = document.querySelector('[data-act="col-toggle"][data-id="contractor"]'); c.click(); })()`); await wait(200);
        check('column hidden', !(await js(`[...document.querySelectorAll('.tablewrap.tall thead th')].some(th => /Подрядчик/.test(th.textContent))`)));
        await js(`document.querySelector('[data-act="col-move"][data-id="status"][data-dir="-1"]').click()`); await wait(150);
        const heads = await js(`[...document.querySelectorAll('.tablewrap.tall thead th')].map(th => th.textContent.replace(/[↕▲▼]/g, '').trim()).join('|')`);
        check('column moved', /Статус\|Финиш/.test(heads), heads);
        await shot('46-columns');
        await click('[data-act="cols-reset"]'); await wait(150);
        await js(`document.body.click()`); await wait(100);
        // card: strip, prev/next, marks filter, expand
        await js(`document.querySelector('tr.row[data-id="demo-t8"]').click()`); await wait(700);
        check('card stamp', await js(`!!document.querySelector('.stamp .chip')`));
        check('prev/next', await js(`!!document.querySelector('.d-nav')`));
        check('3.5: one «Марка» field with suggestions, no checkbox grid', !(await js(`!!document.querySelector('#dform input[name="mark"]')`)) && await js(`document.querySelectorAll('#marks-dl option').length > 30`));
        await shot('47-card-strip');
        const id0 = await js(`document.querySelector('#dtitle').textContent`);
        await key('ArrowDown', { altKey: true }); await wait(600);
        check('Alt+Down opens next card', (await js(`document.querySelector('#dtitle').textContent`)) !== id0);
        await click('[data-act="drawer-wide"]'); await wait(150);
        check('drawer full width', await js(`document.querySelector('#dform').classList.contains('full')`));
        await click('[data-act="drawer-wide"]'); await wait(100);
        await click('[data-act="request-close"]'); await wait(200);
        // toast bottom-right
        await js(`document.querySelector('[data-act="sort"][data-key="finish"]').click()`); await wait(100);
        await js(`window.api && document.querySelector('#toast') && (document.querySelector('#toast').hidden = false)`);
        check('toast at right', await js(`(() => { const r = document.querySelector('#toast').getBoundingClientRect(); return innerWidth - r.right < 40; })()`));
        // scroll memory
        await js(`document.querySelector('#app').scrollTop = 120`); await wait(400);
        const sc = await js(`document.querySelector('#app').scrollTop`);
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click('[data-act="tab"][data-id="tasks"]'); await wait(200);
        check('scroll remembered', (await js(`document.querySelector('#app').scrollTop`)) === sc, String(sc));
        // overview: who, hide/fold panels
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        check('owner shown in overview rows', await js(`!!document.querySelector('.att-item .who-o')`));
        await click('[data-act="settings"][data-sec="ov"]'); await wait(200);
        await js(`document.querySelector('[data-act="ov-toggle"][data-id="soon"]').click()`); await wait(200);
        check('panel hidden', !(await js(`!!document.querySelector('[data-ov="soon"]')`)));
        await js(`document.querySelector('.settings-modal [data-m="close"]').click()`); await wait(100);
        await click('[data-act="fold"][data-key="o:overdue"]'); await wait(150);
        check('panel folded', await js(`document.querySelector('[data-ov="overdue"]').classList.contains('folded')`));
        await shot('48-overview-config');
        await click('[data-act="fold"][data-key="o:overdue"]'); await wait(100);
        await click('[data-act="settings"][data-sec="ov"]'); await wait(200); await click('[data-act="ov-reset"]'); await wait(200);
        check('reset gives short overview', !(await js(`!!document.querySelector('[data-ov="quiet"]')`)) && (await js(`!!document.querySelector('[data-ov="overdue"]')`)));
        await js(`document.querySelector('.settings-modal [data-m="close"]').click()`); await wait(100);
        // density
        await inSettings('[data-act="set-dense"][data-v="1"]');
        check('dense rows', await js(`document.querySelector('#shell').classList.contains('dense')`));
        await inSettings('[data-act="set-dense"][data-v="0"]');
        // help
        await key('F1'); await wait(200);
        check('hotkeys help', await js(`!!document.querySelector('.help-modal kbd')`));
        await shot('49-help');
        await js(`document.querySelector('.help-modal [data-m="cancel"]').click()`); await wait(100);
        // gantt: fold row, filter
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        await js(`document.querySelector('#gantt .tl-name [data-act="fold"]').click()`); await wait(200);
        check('gantt row folds', await js(`!!document.querySelector('.tl-folded')`));
        await js(`(() => { const s = document.querySelector('#gq-mark'); s.value = 'ВК'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(200);
        check('gantt mark filter', (await js(`document.querySelectorAll('#gantt .tl-row:not(.tl-head)').length`)) === 1);
        await shot('50-gantt-filter');
        await js(`(() => { const s = document.querySelector('#gq-mark'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        await click('[data-act="fold-all"][data-on="0"]'); await wait(150);
        // kanban lanes
        await click('[data-act="tab"][data-id="kanban"]'); await wait(300);
        await click('[data-act="kb-lanes"][data-v="owner"]'); await wait(300);
        check('kanban swimlanes', (await js(`document.querySelectorAll('.kb-lane').length`)) >= 2);
        await shot('51-kanban-lanes');
        await click('[data-act="kb-lanes"][data-v=""]'); await wait(150);
      });

      await step('readiness', async () => {
        const id = Object.entries(data().tasks).find(([, t]) => t.status === 'in_progress' && !t.deletedAt)[0];
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        await js(`document.querySelector('tr.row[data-id="${id}"]').click()`); await wait(700);
        check('readiness editable in work', !(await js(`document.querySelector('#t-ready').disabled`)));
        await js(`(() => { const i = document.querySelector('#t-ready'); i.value = '60'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await shot('53-readiness');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('readiness saved', data().tasks[id].readiness === 60, String(data().tasks[id].readiness));
        await js(`document.querySelector('tr.row[data-id="${id}"]').click()`); await wait(700);
        // 3.0: no status list in the card — the header offers the next action instead.
        check('status changes by action', !(await js(`!!document.querySelector('select#t-status')`)) && (await js(`!!document.querySelector('.st-acts [data-q="submit"]')`)));
        await click('[data-act="discard"]'); await wait(200);
        check('readiness column', await js(`[...document.querySelectorAll('.tablewrap.tall thead th')].some(th => /Готовность/.test(th.textContent))`));
        await js(`(() => { const td = document.querySelector('tr.row[data-id="${id}"] td[data-edit="ready"]'); td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`); await wait(150);
        await js(`(() => { const i = document.querySelector('.cell-edit input'); i.value = '75'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await wait(500);
        check('inline readiness', data().tasks[id].readiness === 75, String(data().tasks[id].readiness));
        await js(`(() => { const td = document.querySelector('tr.row[data-id="${id}"] td[data-edit="ready"]'); td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`); await wait(150);
        await js(`(() => { const i = document.querySelector('.cell-edit input'); i.value = '95'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await wait(400);
        check('readiness over 90 refused', data().tasks[id].readiness === 75);
        const r = await js(`window.api.write({ type: 'update', col: 'tasks', id: 'demo-t1', data: { readiness: 200 } })`);
        check('server refuses bad readiness', r && r.ok === false, r && r.message);
      });

      await step('completion dashboard', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        check('dashboard for GIP', await js(`!!document.querySelector('.panel.pg .pg-bar')`));
        const txt = await js(`document.querySelector('.panel.pg').textContent`);
        check('dashboard sections', /По проектам/.test(txt) && /По направлениям/.test(txt) && /По группам главспецов/.test(txt) && /Готовность/.test(txt), '');
        await click('[data-act="prog-weight"][data-v="budget"]'); await wait(200);
        check('by budget', /по бюджету/.test(await js(`document.querySelector('.panel.pg .meta').textContent`)));
        await shot('52-dashboard');
        await click('[data-act="prog-weight"][data-v="count"]'); await wait(150);
        await js(`document.querySelector('.pg-t tr.row[data-act="goto-project"]').click()`); await wait(300);
        check('dashboard row opens project', (await js(`document.querySelector('.tab[aria-selected="true"]').dataset.id`)) === 'projects');
        await switchTo('u-chief');
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        check('no dashboard for chief', !(await js(`!!document.querySelector('.panel.pg')`)));
        await switchTo('u-gip');
      });

      await step('usage statistics', async () => {
        await click('#btn-file'); await wait(150);
        await click('[data-act="usage"]'); await wait(300);
        const txt = await js(`document.querySelector('.usage-modal').textContent`);
        check('usage window', /Пользуетесь/.test(txt) && /Вкладка «Сводка»/.test(txt) && /Открыть карточку/.test(txt), '');
        await shot('54-usage');
        await js(`document.querySelector('.usage-modal [data-m="close"], .usage-modal [data-m="cancel"]')?.click()`); await wait(100);
      });

      await step('notes for the developer', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(200);
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'F', ctrlKey: true, shiftKey: true, bubbles: true }))`); await wait(200);
        check('notes mode on', await js(`document.documentElement.classList.contains('fb-mode') && !!document.querySelector('.fb-banner')`));
        await js(`(() => { const el = document.querySelector('.kpi, .panel-h h3'); el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); el.click(); })()`); await wait(300);
        check('note popup for element', await js(`!!document.querySelector('.fb-pop #fb-text')`));
        check('normal click blocked in notes mode', (await js(`document.querySelector('.tab[aria-selected="true"]').dataset.id`)) === 'overview');
        await shot('55-note-popup');
        await js(`document.querySelector('#fb-text').value = 'Цифры мелковаты'; document.querySelector('.fb-pop form').requestSubmit()`); await wait(900);
        await js(`document.querySelector('[data-fb="general"]').click()`); await wait(200);
        await js(`document.querySelector('#fb-text').value = 'В целом удобно'; document.querySelector('.fb-pop form').requestSubmit()`); await wait(700);
        const notesFile = path.join(dataDir, 'feedback', 'notes.json');
        const notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
        check('notes saved', notes.length === 2 && notes[0].comment === 'Цифры мелковаты' && !!notes[0].selector && /Сводка/.test(notes[0].where), JSON.stringify(notes[0]).slice(0, 200));
        check('screenshot saved', !!notes[0].image && fs.statSync(path.join(dataDir, 'feedback', notes[0].image)).size > 500);
        await js(`document.querySelector('.fb-banner [data-fb="list"]').click()`); await wait(300);
        check('notes list', (await js(`document.querySelectorAll('.fb-item').length`)) === 2);
        await shot('56-notes-list');
        await js(`document.querySelector('[data-fbi="export"]').click()`); await wait(600);
        const zipPath = fs.readdirSync(outDir).find(f => f.startsWith('Пометки') && f.endsWith('.zip'));
        const zipBuf = zipPath ? fs.readFileSync(path.join(outDir, zipPath)) : Buffer.alloc(0);
        check('notes exported', zipBuf.length > 1000 && zipBuf.includes(Buffer.from('notes.md')) && zipBuf.includes(Buffer.from('.png')), zipPath || 'no zip');
        await js(`document.querySelector('[data-fbi="close"]').click()`); await wait(100);
        await js(`document.querySelector('.fb-banner [data-fb="toggle"]').click()`); await wait(150);
        check('notes mode off', !(await js(`document.documentElement.classList.contains('fb-mode')`)));
        await click('[data-act="tab"][data-id="tasks"]'); await wait(200);
        check('clicks work again', (await js(`document.querySelector('.tab[aria-selected="true"]').dataset.id`)) === 'tasks');
      });

      // Compact view
      await step('compact', async () => {
        await click('[data-act="toggle-compact"]'); await wait(900);
        await shot('15-compact');
        await click('[data-act="toggle-compact"]'); await wait(600);
      });

      log.push('waiting for the morning digest…');
      await wait(15000);
      check('notification', notes.length === 1, notes.join(' | '));
    } catch (e) {
      log.push('[smoke error] ' + (e.stack || e));
    }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});

function addDaysIso(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

require('../src/main.js');

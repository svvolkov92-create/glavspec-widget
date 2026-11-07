'use strict';
// 3.0 walkthrough: `electron test/smoke-v3.js <outDir>` with XDG_CONFIG_HOME pointing at a temp dir.
// Checks the new header, card stamp, status actions, templates, folders, revisions, customer PDF,
// direction icons, people lists, vacation chart, encouragement, the office and the «Графит» theme.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

electron.dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(outDir, path.basename(o.defaultPath)) });
let nextOpen = null;
electron.dialog.showOpenDialog = async () => (nextOpen ? { canceled: false, filePaths: [nextOpen] } : { canceled: true, filePaths: [] });
const opened = [];
electron.shell.openPath = async p => { opened.push(p); return ''; };
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () {}; } catch { /* no notifications under Xvfb */ }

const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));

app.on('browser-window-created', (_e, win) => {
  if (win.getTitle && win.isVisible && !win.isVisible() && win.webContents.getURL().startsWith('data:')) return;
  win.webContents.on('console-message', (_ev, level, message, line, source) => { if (level >= 2) log.push(`[console ${level}] ${message} (${source}:${line})`); });
  win.webContents.once('did-finish-load', async () => {
    if (win.webContents.getURL().startsWith('data:')) return; // the hidden PDF window
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    try {
      win.setSize(1280, 820);
      await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);
      // A folder for the demo project, so section folders can be suggested.
      const projDir = path.join(outDir, 'proj'); fs.mkdirSync(path.join(projDir, 'ЭОМ'), { recursive: true });
      await js(`window.api.write([{ type: 'update', col: 'projects', id: 'demo-p1', data: { folder: ${JSON.stringify(projDir)}, status: 'r_work' } }, { type: 'update', col: 'projects', id: 'demo-p2', data: { status: 'expertise' } }], { action: 'test' })`);
      await wait(400);

      await step('header', async () => {
        check('fonts loaded', await js(`document.fonts.check('14px "Golos Text"') && document.fonts.check('italic 14px "Roboto Condensed"')`));
        check('one attention button', await js(`!!document.querySelector('#att-wrap .att-btn') && !document.querySelector('#counters')`), await text('#att-wrap .att-btn'));
        await click('[data-act="att-menu"]'); await wait(150);
        check('attention list', await js(`document.querySelectorAll('.att-menu [data-act="counter"]').length`) >= 3, await text('.att-menu'));
        await shot('v3-01-attention');
        await click('[data-act="att-menu"]'); await wait(100);
        await click('#btn-view'); await wait(150);
        check('window menu has opacity, pin, ghost, theme', await js(`!!document.querySelector('#view-menu #alpha') && !!document.querySelector('#view-menu #btn-pin') && !!document.querySelector('#view-menu #btn-ghost') && document.querySelectorAll('#view-menu [data-act="set-theme"]').length === 5`));
        await shot('v3-02-window-menu');
        await click('#btn-view'); await wait(100);
        await click('#btn-create'); await wait(120);
        check('create menu', await js(`[...document.querySelectorAll('#create-menu button:not([hidden])')].map(b => b.dataset.act).join()`) === 'new-task,new-project,new-contractor,new-user');
        await shot('v3-03-create-menu');
        await click('#btn-create'); await wait(100);
        await click('#btn-file'); await wait(150);
        check('reports menu grouped', /Отчёты[\s\S]*Данные[\s\S]*Сервис/.test(await text('#file-menu')) && /Отчёты и данные/.test(await text('#btn-file')));
        await shot('v3-04-reports-menu');
        await click('#btn-file'); await wait(100);
        check('tab «Люди» and «Офис»', /Люди/.test(await text('#tabs')) && /Офис/.test(await text('#tabs')));
      });

      await step('overview', async () => {
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        check('no KPI strip for GIP with dashboard', !(await js(`!!document.querySelector('#app .kpis')`)));
        check('no weekly button on overview', !(await js(`!!document.querySelector('#app .ov-bar [data-act="weekly"]')`)));
        check('project stage + goal in table', /Экспертиза|В работе, стадия Р/.test(await text('#app')) && await js(`document.querySelectorAll('#app .goal').length`) >= 2);
        await shot('v3-05-overview');
      });

      await step('tab order by drag', async () => {
        await js(`(() => { const a = document.querySelector('#tabs [data-id="tasks"]'), b = document.querySelector('#tabs [data-id="projects"]'); const dt = new DataTransfer();
          a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
          b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          a.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); })()`);
        await wait(200);
        const order = await js(`[...document.querySelectorAll('#tabs .tab')].map(t => t.dataset.id).join()`);
        check('tab moved', order.startsWith('overview,tasks,projects'), order);
        check('order remembered', /tasks/.test(await js(`localStorage.getItem('glavspec.tabOrder')`)));
        await js(`localStorage.removeItem('glavspec.tabOrder')`);
      });

      await step('marks and columns', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        check('mark chips with direction', await js(`document.querySelectorAll('#app .code.k-el .kico').length`) >= 1 && await js(`document.querySelectorAll('#app .code.k-ss').length`) >= 1 && await js(`document.querySelectorAll('#app .code.k-water').length`) >= 1);
        check('filters in one row', await js(`getComputedStyle(document.querySelector('.filters.one-row')).flexWrap`) === 'nowrap' && (await js(`!!document.querySelector('#f-preset')`)));
        await click('[data-act="cols-pop"]'); await wait(150);
        check('columns popover', await js(`!document.querySelector('.cols-menu').hidden`));
        await js(`document.querySelector('.cols-menu [data-act="col-toggle"][data-id="start"]').click()`); await wait(250);
        check('column hidden from popover, popover stays', !(await js(`!!document.querySelector('th[data-col="start"]')`)) && await js(`!document.querySelector('.cols-menu').hidden`));
        await shot('v3-06-columns');
        await js(`(() => { const a = document.querySelector('th[data-col="status"]'), b = document.querySelector('th[data-col="project"]'); const dt = new DataTransfer();
          a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
          b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          a.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); })()`);
        await wait(250);
        check('column moved by header drag', (await js(`[...document.querySelectorAll('th[data-col]')].map(t => t.dataset.col).join()`)).startsWith('status,project'));
        await click('[data-act="cols-reset"]'); await wait(200);
        await js(`document.body.click()`); await wait(100);
      });

      await step('card stamp and actions', async () => {
        await js(`document.querySelector('#app [data-act="open-task"][data-id="demo-t1"]').click()`); await wait(500);
        check('stamp', await js(`document.querySelectorAll('.stamp .st-c').length`) === 8 && /Объект/.test(await text('.stamp')));
        check('no status list in card', !(await js(`!!document.querySelector('select#t-status')`)));
        check('actions for «в работе»', (await js(`[...document.querySelectorAll('.st-acts [data-act="quick"]')].map(b => b.dataset.q).join()`)) === 'submit,pause');
        check('rare fields folded', await js(`!!document.querySelector('details.more #t-note')`));
        await js(`document.querySelector('details.more').open = true`);
        await click('[data-act="suggest-task-folder"]'); await wait(100);
        const fold = await js(`document.querySelector('#t-folder').value`);
        check('section folder suggested from project', fold.endsWith(path.sep === '\\' ? '\\ЭОМ' : '/ЭОМ') || fold.endsWith('ЭОМ'), fold);
        await js(`document.querySelector('#t-folder').value = ${JSON.stringify(path.join(projDir, 'ЭОМ'))}`);
        await click('[data-act="dtab"][data-id="time"]'); await wait(100);
        await click('[data-act="rev-add"]'); await wait(100);
        await js(`(() => { const i = document.querySelector('#rev-box [data-k="note"]'); i.value = 'по замечаниям экспертизы'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await shot('v3-07-revisions');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(500);
        const t1 = data().tasks['demo-t1'];
        check('folder and revision saved', t1.folder.endsWith('ЭОМ') && t1.revisions?.[0]?.no === '1' && t1.revisions[0].note === 'по замечаниям экспертизы');
        await js(`document.querySelector('#app [data-act="open-task"][data-id="demo-t1"]').click()`); await wait(400);
        check('stamp shows revision', /Изм\.\s*1/.test(await text('.stamp')));
        await click('[data-act="open-task-folder"]'); await wait(200);
        check('section folder opened', opened.some(p => p.endsWith('ЭОМ')), opened.join());
        await shot('v3-08-stamp');
        await js(`document.querySelector('#qa-note').value = 'Готово, проверьте'`);
        await click('[data-act="quick"][data-q="submit"]'); await wait(600);
        check('submit by button', data().tasks['demo-t1'].status === 'review');
        check('actions follow status', (await js(`[...document.querySelectorAll('.st-acts [data-act="quick"]')].map(b => b.dataset.q).join()`)) === 'accept,remarks');
        await click('[data-act="quick"][data-q="accept"]'); await wait(900);
        check('accept by button', data().tasks['demo-t1'].status === 'done');
        check('first-time toast', /с первого раза|комплект/.test(await text('#toast')), await text('#toast'));
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
      });

      await step('status rules', async () => {
        await click('[data-act="tab"][data-id="kanban"]'); await wait(300);
        await js(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'demo-t7');
          document.querySelector('[data-kb-col="done"] .kb-list').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
        await wait(400);
        check('kanban refuses «не начат» → «принят»', data().tasks['demo-t7'].status === 'not_started' && /нельзя/.test(await text('#toast')), await text('#toast'));
        await js(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'demo-t7');
          document.querySelector('[data-kb-col="in_progress"] .kb-list').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
        await wait(400);
        check('kanban allows «не начат» → «в работе»', data().tasks['demo-t7'].status === 'in_progress');
      });

      await step('new card: no status list', async () => {
        await js(`document.querySelector('#create-menu [data-act="new-task"]').click()`); await wait(300);
        check('«сразу в работу» instead of status', await js(`!!document.querySelector('#t-start-now')`) && !(await js(`!!document.querySelector('select#t-status')`)));
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(150);
      });

      await step('new project opens the generator; stage filter', async () => {
        await js(`document.querySelector('#create-menu [data-act="new-project"]').click()`); await wait(300);
        check('no «состав по шаблону», generator checkbox instead', !(await js(`!!document.querySelector('#pr-tpl')`)) && await js(`document.querySelector('#pr-gen').checked`));
        await js(`document.querySelector('#pr-name').value = 'Школа на 550 мест'`);
        await js(`document.querySelector('#pr-status').value = 'p_work'`);
        await shot('v3-09-project-new');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(800);
        check('3.5: timeline questionnaire after create', await js(`!!document.querySelector('.tq-modal')`));
        await js(`document.querySelector('.tq-modal [data-m="cancel"]').click()`); await wait(600);
        const d = data(), p = Object.entries(d.projects).find(([, x]) => x.name === 'Школа на 550 мест');
        check('project created, generator open', p && p[1].status === 'p_work' && await js(`!!document.querySelector('[data-act="comp-base"]')`) && await js(`document.querySelector('.dtab[aria-selected="true"]').dataset.id === 'comp'`));
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(200);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(150);
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        check('stage filter', await js(`document.querySelectorAll('.stage-bar [data-act="pstage"]').length`) >= 3);
        await js(`document.querySelector('.stage-bar [data-act="pstage"][data-v="expertise"]').click()`); await wait(200);
        check('stage filter shows one project', await js(`document.querySelectorAll('#app section.panel[id^="p-"]').length`) === 1);
        await shot('v3-10-projects-stage');
        await js(`document.querySelector('.stage-bar [data-act="pstage"][data-v=""]').click()`); await wait(200);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p2"]').click()`); await wait(300);
        check('main tab: generator button instead of templates', !(await js(`!!document.querySelector('[data-act="tpl-save"]')`)) && /Открыть генератор состава/.test(await text('#dform')));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(150);
      });

      await step('customer pdf', async () => {
        await click('#btn-file'); await wait(150);
        await js(`(() => { const s = document.querySelector('#rep-scope'); s.value = 'p:demo-p1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(100);
        await click('[data-act="customer-pdf"]'); await wait(2500);
        const page = fs.readdirSync(outDir).find(f => f.endsWith('.html'));
        check('customer page saved from the menu (3.1: HTML)', !!page && /Статус проекта/.test(page), page || 'нет файла');
      });

      await step('people', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        check('staff direction icons', await js(`document.querySelectorAll('.card.staff .kicons .kico').length`) >= 3);
        check('contractors grouped by direction', /Электрика/.test(await text('.co-groups')) && /Слаботочка/.test(await text('.co-groups')));
        await click('[data-act="cg-all"][data-on="1"]'); await wait(200);
        await js(`document.querySelector('[data-act="co-toggle"]').click()`); await wait(200);
        check('contractor opens to a card', await js(`!!document.querySelector('.co-row.open .card')`));
        check('encouragement stats', /с первого раза/i.test(await text('#app')));
        await shot('v3-11-people');
        await click('[data-act="people-mode"][data-v="list"]'); await wait(200);
        check('staff list mode', await js(`document.querySelectorAll('.staff-t tbody tr').length`) >= 3);
        await shot('v3-12-people-list');
        await click('[data-act="people-mode"][data-v="cards"]'); await wait(150);
      });

      await step('thanks', async () => {
        await js(`window.api.switchUser('demo-u2')`); await wait(500); // chief Белова thanks Орлов (demo-u1) on demo-t3? her own team only — switch back to GIP instead
        await js(`window.api.switchUser('u-gip')`); await wait(400);
        await js(`document.querySelector('[data-act="tab"][data-id="tasks"]').click()`); await wait(200);
        await js(`document.querySelector('#app [data-act="open-task"][data-id="demo-t3"]')?.click()`); await wait(400);
        await click('[data-act="dtab"][data-id="talk"]'); await wait(200);
        await click('[data-act="thank"]'); await wait(500);
        const c = data().tasks['demo-t3'].comments.find(x => x.userId === 'demo-u1');
        check('thanks saved', (c?.thanks || []).includes('u-gip'));
        await shot('v3-13-thanks');
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
      });

      await step('vacations', async () => {
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        await click('[data-act="g-mode"][data-v="vac"]'); await wait(300);
        check('vacation chart', await js(`document.querySelectorAll('.vac-bar').length`) >= 1 && /Отсутствуют/.test(await text('#app')));
        await shot('v3-14-vacations');
        await click('[data-act="g-mode"][data-v="work"]'); await wait(200);
      });

      await step('office', async () => {
        await click('[data-act="tab"][data-id="office"]'); await wait(500);
        check('office people', await js(`document.querySelectorAll('#office .o-person').length`) >= 3);
        check('office buildings and floors', await js(`document.querySelectorAll('#office .o-building').length`) >= 2 && await js(`document.querySelectorAll('#office .o-floor').length`) >= 6);
        check('no contractors in office', !(await js(`[...document.querySelectorAll('#office .o-person title')].some(t => /Петров|Сидорова|Кузнецов/.test(t.textContent))`)));
        await shot('v3-15-office');
        await js(`document.querySelector('#office .o-person').dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await wait(300);
        check('person card list', await js(`!!document.querySelector('.modal .op-list, .modal .none')`));
        await shot('v3-16-office-person');
        await js(`document.querySelector('.modal [data-m="close"]').click()`); await wait(150);
        await js(`document.querySelector('#office .o-floor').dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await wait(400);
        check('floor opens the card', await js(`!!document.querySelector('#dform .stamp')`));
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
        // drag a person onto a colleague → choose card → confirm
        const ids = await js(`[...document.querySelectorAll('#office .o-person')].map(g => g.dataset.person)`);
        await js(`(() => { const a = document.querySelector('#office .o-person[data-person="demo-u1"]'), b = document.querySelector('#office .o-person[data-person="u-chief"]');
          a.scrollIntoView({ block: 'center' });
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: ra.x + ra.width / 2, clientY: ra.y + ra.height / 2 }));
          document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: ra.x + 40, clientY: ra.y + 40 }));
          document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rb.x + rb.width / 2, clientY: rb.y + rb.height / 2 }));
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rb.x + rb.width / 2, clientY: rb.y + rb.height / 2 })); })()`);
        await wait(300);
        check('drag person → hand over dialog', await js(`!!document.querySelector('.modal')`), ids.join());
        await shot('v3-17-office-drag');
        await js(`document.querySelectorAll('.modal-back').forEach(m => m.remove())`);
        await click('[data-act="office-labels"]'); await wait(200);
        await click('[data-act="office-labels"]'); await wait(200);
      });

      await step('compact widget', async () => {
        await click('[data-act="toggle-compact"]'); await wait(900);
        check('compact widget head', /Ждут вас|Всё по плану/.test(await text('.cw-head')));
        await shot('v3-18-compact');
        await click('[data-act="toggle-compact"]'); await wait(700);
      });

      await step('graphite theme', async () => {
        await js(`window.api.setTheme('graphite')`); await wait(500);
        check('graphite applied', await js(`document.documentElement.dataset.theme`) === 'graphite' && await js(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`) === '#1b1f22');
        await click('[data-act="tab"][data-id="overview"]'); await wait(300);
        await shot('v3-19-graphite');
        await js(`document.querySelector('#app [data-act="open-task"]').click()`); await wait(400);
        await shot('v3-20-graphite-card');
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
        await click('[data-act="tab"][data-id="office"]'); await wait(400);
        await shot('v3-21-graphite-office');
        await js(`window.api.setTheme('system')`); await wait(300);
      });

      await step('tips close', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(200);
        const n = await js(`document.querySelectorAll('.tip').length`);
        await js(`document.querySelector('.tip [data-act="tip-close"]').click()`); await wait(100);
        check('hint closes', (await js(`document.querySelectorAll('.tip').length`)) === n - 1);
      });

      await step('specialist', async () => {
        await js(`window.api.switchUser('demo-u1')`); await wait(600);
        check('specialist has no create menu', await js(`document.querySelector('.create-wrap').hidden`));
        await click('[data-act="tab"][data-id="office"]'); await wait(400);
        check('specialist office: only self', (await js(`document.querySelectorAll('#office .o-person').length`)) === 1);
        await shot('v3-22-specialist-office');
        await js(`window.api.switchUser('u-gip')`); await wait(400);
      });
    } catch (e) {
      log.push('[smoke error] ' + (e.stack || e));
    }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});

require('../src/main.js');

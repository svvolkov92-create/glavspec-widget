'use strict';
// 3.6: assignment board (drag and drop), project chat demo (incoming / outgoing per user), office animation,
// birthday cap and crown, bulk actions, quick entry, completion forecast, own view per user, automatic copy.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () {}; } catch { /* Xvfb */ }
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message, line, source) => { if (level >= 2) log.push(`[console ${level}] ${message} (${source}:${line})`); });
  win.webContents.once('did-finish-load', async () => {
    if (win.webContents.getURL().startsWith('data:')) return;
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const page = async pid => { await click('[data-act="tab"][data-id="projects"]'); await wait(200); await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150); await click(`[data-act="project-page"][data-id="${pid}"]`); await wait(400); };
    const drag = (fromSel, toSel) => js(`(() => { const dt = new DataTransfer(); const a = document.querySelector(${JSON.stringify(fromSel)}), b = document.querySelector(${JSON.stringify(toSel)});
      a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(900);

      // The project chat moved to the messenger in 3.8 — see smoke-v38.js.

      await step('assignment board', async () => {
        await page('demo-p2');
        await click('[data-act="assign-board"]'); await wait(400);
        check('board opens with people and tasks', (await js(`document.querySelectorAll('.ab-person').length`)) >= 2 && (await js(`document.querySelectorAll('.ab-task').length`)) >= 4);
        await drag('.ab-person[data-drag="u:demo-u3"]', '.ab-task[data-drop="t:demo-t8"]'); await wait(200);
        check('drop marks the change', await js(`document.querySelector('.ab-task[data-drop="t:demo-t8"]').classList.contains('changed') && /Зайцев/.test(document.querySelector('.ab-task[data-drop="t:demo-t8"]').textContent)`));
        await drag('.ab-person[data-drag="u:demo-u3"]', '.ab-task[data-drop="t:demo-t9"]'); await wait(200);
        check('misfit flagged (ОВ to a water specialist)', await js(`document.querySelector('.ab-task[data-drop="t:demo-t9"]').classList.contains('misfit')`));
        await shot('36-03-board');
        await click('.ab-modal [data-m="save"]'); await wait(400);
        check('misfit needs confirmation', await js(`!!document.querySelector('.ab-modal')`) && data().tasks['demo-t8'].ownerId !== 'demo-u3');
        await click('.ab-task[data-drop="t:demo-t9"] [data-m="undo"]'); await wait(150);
        await click('.ab-modal [data-m="save"]'); await wait(700);
        check('saved: ВК to Зайцев', data().tasks['demo-t8'].ownerId === 'demo-u3' && !(await js(`!!document.querySelector('.ab-modal')`)));
        await click('[data-act="assign-board"]'); await wait(300);
        await drag('.ab-person[data-drag="u:demo-u2"]', '.ab-gh[data-drop="g:0"]'); await wait(200);
        const n = await js(`document.querySelectorAll('.ab-task.changed').length`);
        check('drop on a group heading gives the whole group', n >= 2, String(n));
        await click('.ab-modal [data-m="close"]'); await wait(200);
      });

      await step('office: crown, birthday cap, animation', async () => {
        const today = await js(`window.AppBridge.state.today`);
        await js(`window.api.write({ type: 'update', col: 'users', id: 'demo-u3', data: { birthday: '1990-' + ${JSON.stringify(today)}.slice(5) } })`); await wait(500);
        await click('[data-act="tab"][data-id="office"]'); await wait(600);
        check('birthday cap and greeting', await js(`!!document.querySelector('.o-person.bday .o-cap')`) && /день рождения/.test(await text('.office-bday')));
        check('crown for the most accepted', await js(`!!document.querySelector('.o-crown')`));
        check('animation on by default', await js(`document.querySelector('#office').classList.contains('anim')`));
        await shot('36-04-office');
        await click('[data-act="office-anim"]'); await wait(300);
        check('animation can be switched off', !(await js(`document.querySelector('#office').classList.contains('anim')`)));
        await click('[data-act="office-anim"]'); await wait(200);
      });

      await step('bulk actions', async () => {
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        await click('[data-act="bulk-toggle"]'); await wait(200);
        check('checkbox column', (await js(`document.querySelectorAll('[data-act="bulk-pick"]').length`)) >= 5);
        await click('[data-act="bulk-pick"][data-id="demo-t7"]'); await wait(100);
        await click('[data-act="bulk-pick"][data-id="demo-t6"]'); await wait(100);
        check('two picked, card not opened', (await text('.bulk-bar')).includes('Выбрано: 2') && !(await js(`!!document.querySelector('#dform')`)));
        await shot('36-05-bulk');
        const before = data().tasks;
        await setVal('#bulk-days', '5');
        await click('[data-act="bulk-shift"]'); await wait(300);
        await js(`(() => { const s = document.querySelector('#m-reason'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.modal form, form.modal').requestSubmit(); })()`); await wait(700);
        const after = data().tasks;
        const plus = (a, n) => { const d = new Date(a + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
        check('dates shifted with history', after['demo-t7'].finish === plus(before['demo-t7'].finish, 5) && after['demo-t6'].finish === plus(before['demo-t6'].finish, 5) && after['demo-t7'].history.at(-1).type === 'finish', `${before['demo-t7'].finish} → ${after['demo-t7'].finish}`);
        await click('[data-act="bulk-pick"][data-id="demo-t7"]'); await wait(100);
        await click('[data-act="bulk-start"]'); await wait(600);
        check('«в работу» only for not started', data().tasks['demo-t7'].status === 'in_progress' && data().tasks['demo-t6'].status === 'revision');
        await click('[data-act="bulk-toggle"]'); await wait(150);
      });

      await step('quick entry', async () => {
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))`); await wait(300);
        await setVal('#pal-q', '+ ЭОМ Склад до 20.12 @Зайцев корпус Б');
        await wait(150);
        const prev = await text('.pal-quick');
        check('preview of the new card', /ЭОМ/.test(prev) && /Склад/.test(prev) && /20\.12/.test(prev), prev);
        await setVal('#pal-q', '+ ВК Склад до 20.12 @Зайцев корпус Б'); await wait(150);
        await js(`document.querySelector('#pal-q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(800);
        const t = Object.values(data().tasks).find(x => x.title === 'корпус Б');
        check('created directly', t && t.sections.join() === 'ВК' && t.projectId === 'demo-p2' && t.ownerId === 'demo-u3' && /-12-20$/.test(t.finish), JSON.stringify(t && { s: t.sections, p: t.projectId, o: t.ownerId, f: t.finish }));
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))`); await wait(300);
        await setVal('#pal-q', '+ ЭОМ Склад @Зайцев'); await wait(150);
        await js(`document.querySelector('#pal-q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(700);
        check('misfit → opens the card prefilled', await js(`document.querySelector('#t-marks-extra')?.value === 'ЭОМ' && document.querySelector('#t-project').value === 'demo-p2'`));
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(200);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(150);
      });

      await step('forecast', async () => {
        await page('demo-p2');
        check('forecast tile', /прогноз сдачи/.test(await text('.pt-kpis')), await text('.pt-kpis'));
      });

      await step('automatic copy: state', async () => {
        const r = await js(`window.api.autoBackupGet()`);
        check('autobackup off by default', r && r.dir === '', JSON.stringify(r));
        check('menu item for GIP', await js(`!!document.querySelector('[data-act="autobackup"]')`));
      });

      await step('own view per user', async () => {
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        await click('#btn-user'); await wait(150);
        await click('#user-menu [data-act="switch-user"][data-id="demo-u2"]'); await wait(1200);
        await click('[data-act="tab"][data-id="kanban"]'); await wait(300);
        await click('#btn-user'); await wait(150);
        await click('#user-menu [data-act="switch-user"][data-id="u-gip"]'); await wait(2500);
        check('GIP gets the Gantt tab back after reload', (await js(`window.AppBridge.state.tab`)) === 'gantt', await js(`window.AppBridge.state.tab + ' ' + localStorage.getItem('glavspec.tab') + ' ' + localStorage.getItem('glavspec.view:u-gip') + ' me=' + window.AppBridge.state.me?.id`));
        await click('#btn-user'); await wait(150);
        await click('#user-menu [data-act="switch-user"][data-id="demo-u2"]'); await wait(2500);
        check('Белова gets her Kanban', (await js(`window.AppBridge.state.tab`)) === 'kanban', await js(`window.AppBridge.state.tab`));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

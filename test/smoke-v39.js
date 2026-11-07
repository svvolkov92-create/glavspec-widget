'use strict';
// 3.9: no budget field in the card for those without money access; «Журнал» tab of a card.
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

let started = false;
app.on('browser-window-created', (_e, win) => {
  if (started) return;
  started = true;
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
      const openTask = async id => { await click('[data-act="tab"][data-id="tasks"]'); await wait(300); await click(`[data-act="open-task"][data-id="${id}"]`); await wait(500); };

      await step('budget field only with money access', async () => {
        await openTask('demo-t3');
        check('GIP sees the budget field', await js(`!!document.querySelector('#t-budget')`));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.switchUser('demo-u1')`); await wait(800);
        const own = await js(`[...window.AppBridge.state.tasks.values()].find(t => t.ownerId === 'demo-u1')?.id`);
        await openTask(own);
        check('specialist: card open, no budget field', await js(`!!document.querySelector('#dform')`) && !(await js(`!!document.querySelector('#t-budget')`)));
        check('specialist: no «Оплата» tab', !(await js(`!!document.querySelector('.dtab[data-id="money"]')`)));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.switchUser('u-gip')`); await wait(800);
      });

      await step('card journal', async () => {
        const r = await js(`window.api.write([{ type: 'update', col: 'tasks', id: 'demo-t3', data: { note: 'Проверка журнала карточки' } }], { action: 'Примечание' })`);
        check('edit saved', r && r.ok);
        await openTask('demo-t3');
        await click('.dtab[data-id="log"]'); await wait(600);
        const t = await text('#tlog-box');
        check('«Журнал» shows the card entries', /Примечание/.test(t) && /ГИП/.test(t) && /создано/.test(t), t.slice(0, 200));
        await shot('39-01-card-journal');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

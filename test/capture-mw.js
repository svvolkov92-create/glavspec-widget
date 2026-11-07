'use strict';
// Screenshots for the multi-window mockup (not a test).
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');
const outDir = process.argv.at(-1);
const wait = ms => new Promise(r => setTimeout(r, ms));
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () {}; } catch { /* Xvfb */ }
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23, theme: 'tandem' }));
let started = false;
app.on('browser-window-created', (_e, win) => {
  if (started) return; started = true;
  win.webContents.once('did-finish-load', async () => {
    const js = c => win.webContents.executeJavaScript(c);
    const click = sel => js(`document.querySelector(${JSON.stringify(sel)}).click()`);
    const shot = async (name, rect) => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage(rect)).toPNG());
    const rectOf = sel => js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    try {
      win.setSize(1440, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await js(`window.api.setTheme('tandem')`); await wait(300);
      await click('[data-act="seed-demo"]'); await wait(1500);
      // main window: overview, gantt
      await click('[data-act="tab"][data-id="overview"]'); await wait(500); await shot('main-overview');
      await click('[data-act="tab"][data-id="gantt"]'); await wait(700); await shot('main-gantt');
      await click('[data-act="tab"][data-id="tasks"]'); await wait(500); await shot('main-tasks');
      await click('[data-act="tab"][data-id="kanban"]'); await wait(500); await shot('main-kanban');
      // project pages
      await click('[data-act="tab"][data-id="projects"]'); await wait(300);
      await click('[data-act="project-page"][data-id="demo-p2"]'); await wait(600); await shot('project-p2');
      await click('[data-act="project-back"]'); await wait(200);
      await click('[data-act="project-page"][data-id="demo-p1"]'); await wait(600); await shot('project-p1');
      // messenger in a window-sized frame
      await click('[data-act="tab"][data-id="overview"]'); await wait(300);
      await click('.msg-fab'); await wait(300);
      await click('[data-act="msg-size"]'); await wait(300);
      await js(`[...document.querySelectorAll('.mc-item')].find(b => /Склад/.test(b.textContent)).click()`); await wait(500);
      await shot('messenger', await rectOf('.msg-panel'));
      await click('[data-act="msg-close"]'); await wait(200);
      // task card (drawer)
      await js(`document.querySelector('[data-act="tab"][data-id="tasks"]').click()`); await wait(400);
      await js(`document.querySelector('tr.row[data-act="open-task"]').click()`); await wait(700);
      await shot('task-card', await rectOf('#drawer-root .drawer'));
      await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(300);
      await js(`[...document.querySelectorAll('tr.row[data-act="open-task"]')][3].click()`); await wait(700);
      await shot('task-card2', await rectOf('#drawer-root .drawer'));
    } catch (e) { fs.writeFileSync(path.join(outDir, 'err.txt'), String(e.stack || e)); }
    app.exit(0);
  });
});
require('../src/main.js');

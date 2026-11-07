'use strict';
// 4.0 quick fixes: in-page surfaces follow the transparency in every theme; animations with an on/off switch
// (panels slide out); card footer «Сохранить» / «Сохранить и выйти» / «Выйти без сохранения», Ctrl+S.
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
      const alphaOf = sel => js(`(() => { const c = getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor; if (c === 'transparent') return 0; const m = c.match(/[0-9.]+/g) || []; return m.length > 3 ? Number(m[3]) : m.length ? 1 : c; })()`);

      await step('transparency of in-page surfaces', async () => {
        await js(`window.api.setTheme('tandem')`); await wait(300);
        await click('#btn-view'); await wait(150); await setVal('#alpha', '50'); await wait(200); await click('#btn-view'); await wait(150);
        await click('[data-act="tab"][data-id="kanban"]'); await wait(400);
        const kb = await alphaOf('.kb-card:not(.noexec)');
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        const sel = await alphaOf('#f-project');
        check('«Тандем», 50%: kanban cards and filters translucent', kb < 0.6 && sel < 0.6, `kb=${kb} select=${sel}`);
        await click('#btn-view'); await wait(150); await setVal('#alpha', '82'); await wait(150); await click('#btn-view'); await wait(150);
        await js(`window.api.setTheme('light')`); await wait(300);
      });

      await step('animations: switch and slide-out', async () => {
        check('on by default', await js(`document.documentElement.classList.contains('anim')`));
        await click('[data-act="msg-open"]'); await wait(300);
        check('messenger slides in', await js(`document.querySelector('.msg-panel').classList.contains('enter')`));
        await click('[data-act="msg-close"]'); await wait(40);
        check('closing: a copy slides out, the panel is gone at once', await js(`!!document.querySelector('body > .msg-panel.leaving') && !document.querySelector('#msg-root .msg-panel')`));
        await wait(300);
        check('copy removed after the animation', !(await js(`!!document.querySelector('.leaving')`)));
        await click('#btn-view'); await wait(200);
        await click('[data-act="set-anim"][data-v="0"]'); await wait(200);
        check('switched off: no class, remembered', !(await js(`document.documentElement.classList.contains('anim')`)) && (await js(`localStorage.getItem('glavspec.anim')`)) === 'false');
        await click('[data-act="msg-open"]'); await wait(200); await click('[data-act="msg-close"]'); await wait(30);
        check('off: no slide-out copy', !(await js(`!!document.querySelector('.leaving')`)));
        await click('#btn-view').catch(() => {}); await wait(100);
        await js(`document.querySelector('#view-menu').hidden || document.querySelector('#btn-view').click()`); await wait(100);
        await js(`document.querySelector('[data-act="set-anim"][data-v="1"]')?.click()`); await wait(100);
        await js(`if (!document.querySelector('#view-menu').hidden) document.querySelector('#btn-view').click()`); await wait(100);
      });

      await step('card: save, save and exit, exit without saving', async () => {
        await openTask('demo-t3');
        const btns = await js(`[...document.querySelectorAll('.drawer-f .btn, #dform > .drawer-f .btn, #dform footer .btn, #dform .btn')].map(b => b.textContent.trim()).filter(t => /Сохранить|Выйти/.test(t)).join('|')`);
        check('three buttons', /Сохранить\|Сохранить и выйти\|Выйти без сохранения/.test(btns), btns);
        await setVal('#t-note', 'Сохранено без выхода');
        await click('[data-act="save-stay"]'); await wait(800);
        check('«Сохранить»: saved, card still open and clean', data().tasks['demo-t3'].note === 'Сохранено без выхода' && (await js(`!!document.querySelector('#dform')`)) && (await js(`window.AppBridge.state.drawer?.id`)) === 'demo-t3');
        await setVal('#t-note', 'По Ctrl+S');
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }))`); await wait(800);
        check('Ctrl+S saves and stays', data().tasks['demo-t3'].note === 'По Ctrl+S' && (await js(`!!document.querySelector('#dform')`)));
        await setVal('#t-note', 'Не сохранять');
        await click('[data-act="discard"]'); await wait(400);
        check('«Выйти без сохранения»: closed, not saved', !(await js(`!!document.querySelector('#dform')`)) && data().tasks['demo-t3'].note === 'По Ctrl+S');
        await openTask('demo-t3');
        await setVal('#t-note', 'И выйти');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(800);
        check('«Сохранить и выйти»: saved and closed', data().tasks['demo-t3'].note === 'И выйти' && !(await js(`!!document.querySelector('#dform')`)));
        await shot('40-01-card');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

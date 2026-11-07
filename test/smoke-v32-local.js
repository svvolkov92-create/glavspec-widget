'use strict';
// 3.2: «Запустить кабинет на этом компьютере» — one button, no separate server, keys or addresses.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () {}; } catch { /* Xvfb */ }
const opened = [];
electron.shell.openExternal = async url => { opened.push(url); };
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
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    try {
      win.setSize(1400, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);
      await step('one button', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
        await shot('32l-00-before');
        await click('[data-act="cab-local-start"]'); await wait(1500);
        const v = await js(`window.api.cabinetGet()`);
        check('local server running', !!v.local && v.configured, JSON.stringify(v.local));
        const port = v.local.port;
        const r = await fetch(`http://127.0.0.1:${port}/health`).then(x => x.json());
        check('server answers', r.ok === true);
        check('public address is not localhost', !/localhost/.test(v.publicUrl) || !v.local.lan.length, v.publicUrl);
        await click('[data-act="cab-publish"]'); await wait(1000);
        await setVal('#cab-name', 'Заказчик'); await setVal('#cab-login', 'zak');
        await click('[data-act="cab-add"]'); await wait(1200);
        const pw = await js(`[...document.querySelectorAll('.cab-pw code')][2]?.textContent || ''`);
        let cookie = '';
        const lr = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ login: 'zak', password: pw }) });
        cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
        const page = await fetch(`http://127.0.0.1:${port}/p/demo-p1`, { headers: { Cookie: cookie } }).then(x => x.text());
        check('customer sees the project', /Нужно от вас/.test(page));
        await click('[data-act="cab-open"]'); await wait(200);
        check('open in browser', opened.some(u => u.includes(`:${port}/p/demo-p1`)), opened.join(','));
        await shot('32l-01-running');
      });
      await step('stop', async () => {
        await js(`window.api.cabinetLocalStop()`); await wait(800);
        const v = await js(`window.api.cabinetGet()`);
        check('stopped and disconnected', !v.local && !v.configured);
        check('start button back', /Запустить кабинет на этом компьютере/.test(await text('#cab-box')));
        await click('[data-act="cab-local-start"]'); await wait(1500);
        const v2 = await js(`window.api.cabinetGet()`);
        const cs = await js(`window.api.cabinetCustomers()`);
        check('restart keeps customers', !!v2.local && cs.ok && cs.customers.some(c => c.login === 'zak'));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

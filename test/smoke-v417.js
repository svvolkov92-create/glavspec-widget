'use strict';
// 4.17 — «Паспорт объекта»: filled in «Для заказчика», shown to the customer in the cabinet as its own tab.
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
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) throw new Error('no ${sel.replace(/'/g, '')}'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const setChk = (sel, on) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (i.checked !== ${on}) i.click(); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const tab = async id => { await click(`[data-act="tab"][data-id="${id}"]`); await wait(300); };
    const hasTab = id => js(`!!document.querySelector('#tabs [data-act="tab"][data-id="${id}"]')`);
    const orgByName = n => Object.entries(data().orgs || {}).find(([, o]) => o.name === n);
    const save = async () => { await js(`document.querySelector('#dform').requestSubmit()`); await wait(700); };
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(900);

      await step('the passport filled in the project window', async () => {
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p1"]'); await wait(500);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
        await click('[data-act="cust-sec"][data-v="pass"]'); await wait(300);
        await setVal('[data-pd="passport.address"]', 'г. Хабаровск, ул. Северная, 14');
        await setVal('[data-pd="passport.purpose"]', 'Многоквартирный жилой дом');
        await setVal('[data-pd="passport.total"]', '18 450 м²'); await setVal('[data-pd="passport.floors"]', '17 эт.');
        await click('[data-act="pd-add"][data-list="tep"]'); await wait(200);
        await setVal('[data-pd="tep.0.k"]', 'Площадь квартир'); await setVal('[data-pd="tep.0.v"]', '11 200 м²');
        await shot('417-01-drawer');
        await save(); await wait(700);
        const pp = data().projects['demo-p1'].passport;
        check('saved', pp?.address === 'г. Хабаровск, ул. Северная, 14' && pp.floors === '17 эт.' && pp.tep?.[0]?.k === 'Площадь квартир' && pp.level === '', JSON.stringify(pp));
      });

      await step('the customer sees «Паспорт объекта»', async () => {
        await js(`window.api.cabinetLocalStart()`); await wait(1800);
        const v = await js(`window.api.cabinetGet()`), port = v.local?.port;
        const r = await js(`window.api.cabinetCustomerCreate({ name: 'Заказчик', login: 'zak417', projectIds: ['demo-p1'] })`);
        await js(`window.api.cabinetPublish('demo-p1')`); await wait(600);
        const lr = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ login: 'zak417', password: r.password }) });
        const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
        const page = await fetch(`http://127.0.0.1:${port}/p/demo-p1`, { headers: { Cookie: cookie } }).then(x => x.text());
        check('a tab and a page «Паспорт объекта»', page.includes('href="#pass"') && page.includes('id="pass"'));
        check('the object, ТЭП and the custom row', page.includes('ул. Северная, 14') && page.includes('18 450 м²') && page.includes('Площадь квартир'));
        check('empty fields are not shown', !page.includes('Уровень ответственности'));
        fs.writeFileSync(path.join(outDir, 'cabinet.html'), page);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.write([{ type: 'update', col: 'projects', id: 'demo-p1', data: { show: { ...(window.AppBridge.state.projects.get('demo-p1').show || {}), passport: false } } }], { action: 'test' })`); await wait(300);
        await js(`window.api.cabinetPublish('demo-p1')`); await wait(600);
        const page2 = await fetch(`http://127.0.0.1:${port}/p/demo-p1`, { headers: { Cookie: cookie } }).then(x => x.text());
        check('«показывать паспорт» off — no tab', !page2.includes('href="#pass"'));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

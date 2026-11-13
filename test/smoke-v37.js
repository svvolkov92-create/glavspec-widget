'use strict';
// 3.7: the customer page «Мой Тандем» (sidebar blocks) filled from the program, and the «Тандем» theme controls.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
electron.dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(outDir, path.basename(o.defaultPath)) });
electron.shell.openPath = async () => '';
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () {}; } catch { /* Xvfb */ }
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));

let started = false; // windows opened by the test itself (page preview) must not start it again
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
    const openCust = async () => {
      await click('[data-act="tab"][data-id="projects"]'); await wait(200);
      await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
      await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
      await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
    };
    try {
      win.setSize(1400, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);

      await step('«Для заказчика»: new blocks', async () => {
        await openCust();
        check('editors: ИРД, встречи, договор', /Исходные данные/.test(await text('#cust-box')) && /Встречи/.test(await text('#cust-box')) && /Договор и финансы/.test(await text('#cust-box')));
        await click('[data-act="ird-techcard"]'); await wait(150);
        check('ИРД filled from the tech card', (await js(`document.querySelectorAll('[data-pd^="ird."][data-pd$=".title"]').length`)) === 12);
        await setVal('[data-pd="ird.1.status"]', 'accepted');
        await click('[data-act="pd-add"][data-list="meetings"]'); await wait(100);
        await setVal('[data-pd="meetings.0.date"]', '2030-01-15'); await setVal('[data-pd="meetings.0.from"]', '11:00'); await setVal('[data-pd="meetings.0.title"]', 'Совещание по замечаниям');
        await setVal('[data-pd="contract.no"]', '26/07-12'); await setVal('[data-pd="contract.date"]', '2026-04-14'); await setVal('[data-pd="contract.sum"]', '4 860 000');
        await click('[data-act="pd-add"][data-list="payments"]'); await wait(100);
        await setVal('[data-pd="payments.0.title"]', 'Аванс'); await setVal('[data-pd="payments.0.sum"]', '1 458 000'); await setVal('[data-pd="payments.0.status"]', 'paid');
        await click('[data-act="pd-add"][data-list="bills"]'); await wait(100);
        await setVal('[data-pd="bills.0.title"]', 'Счёт № 412'); await setVal('[data-pd="bills.0.date"]', '2026-10-21');
        await shot('37-01-customer-tab');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(700);
        const p = data().projects['demo-p1'];
        check('saved: ИРД, meeting, contract, payments, bills', p.ird.length === 12 && p.ird[1].status === 'accepted' && p.meetings[0].from === '11:00' && p.contract.sum === 4860000 && p.payments[0].sum === 1458000 && p.bills[0].title === 'Счёт № 412',
          JSON.stringify({ ird: p.ird?.length, c: p.contract, pay: p.payments }));
      });

      await step('customer page file', async () => {
        await openCust();
        await click('[data-act="cust-page"][data-format="html"]'); await wait(1500);
        const f = fs.readdirSync(outDir).find(x => x.endsWith('.html'));
        const html = f ? fs.readFileSync(path.join(outDir, f), 'utf8') : '';
        for (const s of ['Главная', 'План работ', 'Договор и финансы', 'Исходные данные', 'Вопросы', 'Встречи и протоколы', 'Документация', '4 860 000 ₽', 'Совещание по замечаниям', 'ГПЗУ']) check('page: ' + s, html.includes(s));
        check('no contractors, no internal budgets', !/Петров|Сидорова|Кузнецов|180\s?000/.test(html));
        fs.copyFileSync(path.join(outDir, f), path.join(outDir, 'page.html'));
        const pw = new electron.BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { javascript: false } });
        for (const t of ['home', 'finance', 'ird', 'meet']) {
          await pw.loadFile(path.join(outDir, 'page.html'), { hash: t }); await wait(400);
          fs.writeFileSync(path.join(outDir, `37-page-${t}.png`), (await pw.webContents.capturePage()).toPNG());
        }
        pw.destroy();
      });

      await step('finance hidden from a chief', async () => {
        await js(`window.api.switchUser('u-chief')`); await wait(600);
        const has = await js(`(() => { const p = window.AppBridge.state.projects.get('demo-p1'); return p ? ['contract', 'payments', 'bills'].filter(k => k in p).join() : 'нет'; })()`);
        check('chief does not get the contract', has === '', has);
        await openCust();
        check('no finance editor for a chief', !/Договор и финансы/.test(await text('#cust-box')));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('chief saving keeps the contract', data().projects['demo-p1'].contract?.sum === 4860000);
        await js(`window.api.switchUser('u-gip')`); await wait(500);
      });

      await step('«Тандем» theme controls', async () => {
        await js(`window.api.setTheme('tandem')`); await wait(500);
        check('theme on', (await js(`document.documentElement.dataset.theme`)) === 'tandem');
        const glass = await js(`getComputedStyle(document.querySelector('#shell')).backgroundColor + '|' + getComputedStyle(document.querySelector('.btn:not(.primary):not(.ghostbtn)')).backgroundColor`);
        // 4.1 (backlog item 18): the window stays translucent, buttons are solid.
        check('«Тандем» keeps the window translucent, buttons solid', /^(rgba|color)\(.*0\.8\d*\)\|/.test(glass) && /^rgb\(/.test(glass.split('|')[1]), glass);
        const st = await js(`(() => { const b = document.querySelector('#btn-create'); const c = getComputedStyle(b); return c.borderRadius + '|' + c.fontWeight + '|' + c.backgroundColor; })()`);
        check('square orange primary button, weight 600', /^0px\|600\|rgb\(242, 106, 31\)/.test(st), st);
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        await shot('37-02-tandem-tasks');
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click('[data-act="project-page"][data-id="demo-p1"]'); await wait(400);
        await shot('37-03-tandem-project');
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]')?.click() || document.querySelector('[data-act="open-project"]')?.click()`); await wait(400);
        await shot('37-04-tandem-drawer');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

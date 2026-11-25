'use strict';
// 4.14 — РВИ: a through number for every change of a section, the registry on the project page, «Новое изменение».
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

      await step('«Новое изменение» on the project page: a number, the change in the card', async () => {
        await js(`window.AppBridge.openTarget('project:demo-p1')`); await wait(700);
        check('the block «Изменения (РВИ)» is there', (await js(`document.querySelector('#app')?.textContent || ''`)).includes('Изменения (РВИ)'));
        await js(`(() => { const b = [...document.querySelectorAll('.pt-block')].find(x => x.textContent.includes('Изменения (РВИ)')); if (b && b.classList.contains('folded')) b.querySelector('[data-act]')?.click(); })()`); await wait(300);
        await click('[data-act="rvi-new"][data-id="demo-p1"]'); await wait(400);
        check('the dialog shows the next number', (await text('#rvi-t')).includes('РВИ-01'), await text('#rvi-t'));
        await js(`(() => { const s = document.querySelector('#rvi-card'); s.value = 'demo-t1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(100);
        await setVal('#rvi-sheets', '3, 5'); await setVal('#rvi-note', 'Замечание экспертизы № 14');
        await shot('414-01-new');
        await js(`document.querySelector('#rvi-t').closest('form').requestSubmit()`); await wait(800);
        const r = (data().tasks['demo-t1'].revisions || []).at(-1);
        check('the card got «Изм.» with РВИ 1, sheets, who', r && r.rvi === 1 && r.sheets === '3, 5' && r.by === 'u-gip' && r.note.includes('№ 14'), JSON.stringify(r));
        await click('[data-act="rvi-new"][data-id="demo-p1"]'); await wait(300);
        await js(`(() => { const s = document.querySelector('#rvi-card'); s.value = 'demo-t2'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await setVal('#rvi-note', 'Новые ТУ'); await js(`document.querySelector('#rvi-t').closest('form').requestSubmit()`); await wait(800);
        check('the next change of another section — РВИ 2', (data().tasks['demo-t2'].revisions || []).at(-1)?.rvi === 2);
        const rows = await js(`[...document.querySelectorAll('.rvi-t tbody tr')].map(r => r.cells[0].textContent.trim())`);
        check('the registry lists both, newest first', rows.join() === 'РВИ-02,РВИ-01', rows.join());
        await shot('414-02-registry');
      });

      await step('the card: «Изм.» adds the next РВИ number; filter by section', async () => {
        await js(`window.AppBridge.openTarget('task:demo-t3')`); await wait(600);
        await click('[data-act="dtab"][data-id="time"]').catch(() => {}); await wait(200);
        await click('[data-act="rev-add"]'); await wait(200);
        check('a new change in the card shows РВИ-03', (await text('#rev-box')).includes('РВИ-03'), await text('#rev-box'));
        await js(`(() => { const i = [...document.querySelectorAll('#rev-box [data-k="note"]')].at(-1); i.value = 'Изменение нагрузок'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await save();
        check('saved with РВИ 3', (data().tasks['demo-t3'].revisions || []).at(-1)?.rvi === 3, JSON.stringify(data().tasks['demo-t3'].revisions));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.AppBridge.openTarget('project:demo-p1')`); await wait(700);
        await js(`(() => { const s = document.querySelector('[data-rvi-filter="demo-p1"]'); s.value = 'ЭОМ'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(400);
        const rows = await js(`[...document.querySelectorAll('.rvi-t tbody tr')].map(r => r.cells[0].textContent.trim())`);
        check('filter by ЭОМ — only its change', rows.join() === 'РВИ-01', rows.join());
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

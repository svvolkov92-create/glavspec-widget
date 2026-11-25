'use strict';
// 4.13 — source data for sections («ждёт ИД» on the card, Kanban, Gantt; a word to the cards when received) and
// «Запросить актуализацию» for a document that runs out (a letter by the template, tied to the document).
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
      await js(`window.api.write([{ type: 'update', col: 'projects', id: 'demo-p1', data: { ird: [{ id: 'i1', title: 'ТУ на электроснабжение', kind: 'tu', who: 'Заказчик', status: 'wait', due: '', note: '', for: ['ЭОМ'] }, { id: 'i2', title: 'ТУ на теплоснабжение', kind: 'tu', who: 'Заказчик', status: 'wait', due: '', note: '' }] } }], { action: 'test' })`); await wait(500);

      await step('a card of a section that waits: Kanban, Gantt, the card', async () => {
        await tab('kanban');
        check('Kanban: «ждёт ИД» on the ЭОМ card', await js(`!!document.querySelector('[data-kb-id="demo-t1"] .kb-wait')`));
        check('Kanban: not on the СС card', !(await js(`!!document.querySelector('[data-kb-id="demo-t2"] .kb-wait')`)));
        await shot('413-01-kanban');
        await tab('gantt');
        check('Gantt: the bar is marked', await js(`!!document.querySelector('[data-bar="demo-t1"].waitid')`) && /Ждёт исходные данные: ТУ на электроснабжение/.test(await js(`document.querySelector('[data-bar="demo-t1"]').title`)));
        await js(`document.querySelector('[data-bar="demo-t1"]').click()`); await wait(600);
        check('the card says what it waits for', (await text('.st-wait')).includes('ТУ на электроснабжение'));
        await shot('413-02-card');
        await click('.st-wait [data-act="goto-ird"]'); await wait(700);
        check('«к списку ИД» opens the project on its source data', await js(`!!document.querySelector('[data-pd="ird.0.for"]')`) && (await js(`document.querySelector('[data-pd="ird.0.for"]').value`)) === 'ЭОМ');
      });

      await step('«Подставить разделы» and the reception: a word to the waiting card', async () => {
        check('the heat ТУ suggests ОВ, ТС, ИТП', (await js(`document.querySelector('[data-pd="ird.1.for"]').placeholder`)) === 'ОВ, ТС, ИТП');
        await click('[data-act="ird-for-fill"]'); await wait(300);
        check('filled where empty', (await js(`document.querySelector('[data-pd="ird.1.for"]').value`)) === 'ОВ, ТС, ИТП');
        await shot('413-03-ird');
        await js(`(() => { const s = document.querySelector('[data-pd="ird.0.status"]'); s.value = 'accepted'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(200);
        await save(); await wait(800);
        const p = data().projects['demo-p1'];
        check('saved with «для разделов»', JSON.stringify(p.ird.map(r => r.for)) === '[["ЭОМ"],["ОВ","ТС","ИТП"]]' && p.ird[0].status === 'accepted', JSON.stringify(p.ird));
        const c = (data().tasks['demo-t1'].comments || []).at(-1);
        check('the ЭОМ card got «Исходные данные получены»', !!c && c.text.includes('ТУ на электроснабжение'), JSON.stringify(c));
        check('the СС card got nothing', !(data().tasks['demo-t2'].comments || []).some(x => /Исходные данные получены/.test(x.text)));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await tab('kanban');
        check('Kanban: the mark is gone', !(await js(`!!document.querySelector('[data-kb-id="demo-t1"] .kb-wait')`)));
      });

      await step('a document runs out: «Запросить актуализацию» → a letter by the template, tied to it', async () => {
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p1"]'); await wait(500);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
        await click('[data-act="cust-sec"][data-v="docs"]'); await wait(300);
        check('the button by the water ТУ (45 days, remind 60)', await js(`!!document.querySelector('[data-act="doc-renew"][data-i="0"]')`) && !(await js(`!!document.querySelector('[data-act="doc-renew"][data-i="1"]')`)));
        await click('[data-act="doc-renew"][data-i="0"]'); await wait(400);
        const subj = await js(`document.querySelector('#let-subj')?.value || ''`), body = await js(`document.querySelector('#let-body')?.value || ''`);
        check('the letter is filled from the template', subj.includes('ТУ на водоснабжение') && body.includes('истекает') && body.includes('0425-24'), subj + ' | ' + body.slice(0, 120));
        await shot('413-04-letter');
        await js(`document.querySelector('.let-modal').requestSubmit()`); await wait(800);
        const l = (data().projects['demo-p1'].letters || []).find(x => x.docId === 'dd1');
        check('registered with a number and tied to the document', !!l && l.tpl === 'renew' && l.dir === 'out' && l.seq >= 1, JSON.stringify(l));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await tab('day');
        check('«Мой день»: the document shows the letter instead of the button', /Исх\./.test(await js(`[...document.querySelectorAll('.day-row')].find(r => r.textContent.includes('ТУ на водоснабжение'))?.textContent || ''`)));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

'use strict';
// 4.15 — «Экспертиза»: cycles, remarks pasted as a list (number, section, owner by the section's card), a remark
// edited and answered with a РВИ, counters, the card and «Мой день» show the remarks, the answers in Word.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
electron.dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(outDir, path.basename(o.defaultPath)) });
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
      const ex = () => data().projects['demo-p1'].expertise || {};

      await step('a cycle and remarks pasted as a list', async () => {
        await js(`window.AppBridge.openTarget('project:demo-p1')`); await wait(700);
        check('the block «Экспертиза» is there', (await js(`document.querySelector('#app')?.textContent || ''`)).includes('Экспертиза'));
        await click('[data-act="ex-cycle-new"][data-id="demo-p1"]'); await wait(300);
        await setVal('#exc-due', '2026-11-20');
        await js(`document.querySelector('#exc-t').closest('form').requestSubmit()`); await wait(700);
        check('cycle 1 made', ex().cycles?.length === 1 && ex().cycles[0].due === '2026-11-20', JSON.stringify(ex()));
        await setVal('[data-ex-org="demo-p1"]', 'ООО «Эксперт-Восток»'); await wait(500);
        check('the organisation saved', ex().org === 'ООО «Эксперт-Восток»');
        await click('[data-act="ex-paste"][data-id="demo-p1"]'); await wait(300);
        await setVal('#exp-text', '14. ЭОМ: Категория надёжности электроснабжения лифтов\nСС — Нет схемы сети связи\nУточнить отметку входа');
        check('the dialog counts them', (await text('#exp-sum')).includes('Замечаний: 3'), await text('#exp-sum'));
        await js(`document.querySelector('#exp-t').closest('form').requestSubmit()`); await wait(700);
        const r = ex().cycles[0].remarks;
        check('three remarks: numbers, sections, owners by the cards', r.length === 3 && r[0].n === '14' && r[0].mark === 'ЭОМ' && r[0].ownerId === data().tasks['demo-t1'].ownerId && r[1].n === '15' && r[1].mark === 'СС' && r[2].mark === '' && r[2].due === '2026-11-20', JSON.stringify(r.map(x => [x.n, x.mark, x.ownerId, x.due])));
        check('counters: 3 in all, 3 overdue (the cycle term is past)', /Всего\s*3/.test(await js(`document.querySelector('.ex-kpis')?.textContent || ''`)) && /Просрочено\s*3/.test(await js(`document.querySelector('.ex-kpis')?.textContent || ''`)), await js(`document.querySelector('.ex-kpis')?.textContent || ''`));
        await js(`document.querySelector('.ex')?.scrollIntoView({ block: 'start' })`); await wait(200);
        await shot('415-01-list');
      });

      await step('a remark answered with a РВИ; the card and «Мой день»', async () => {
        await js(`window.api.write([{ type: 'update', col: 'tasks', id: 'demo-t1', data: { revisions: [{ id: 'rv1', no: '1', rvi: 1, date: '2026-11-24', note: 'по замечанию 14' }] } }], { action: 'test' })`); await wait(400);
        await js(`window.AppBridge.openTarget('task:demo-t1')`); await wait(600);
        check('the ЭОМ card shows its remark', (await text('.stamp')).includes('замечания экспертизы: 1'));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.switchUser('${''}' + window.AppBridge.state.tasks.get('demo-t1').ownerId)`); await wait(700);
        await tab('day');
        check('«Мой день» of the section owner lists the remark', (await js(`document.querySelector('.day')?.textContent || ''`)).includes('№ 14'));
        await js(`window.api.switchUser('u-gip')`); await wait(700);
        await js(`window.AppBridge.openTarget('project:demo-p1')`); await wait(700);
        const id = ex().cycles[0].remarks[0].id;
        await click(`[data-act="ex-open"][data-v="${id}"]`); await wait(300);
        await setVal('#exr-ans', 'Категория I, см. т. 5.1, лист 3'); await js(`(() => { const s = document.querySelector('#exr-st'); s.value = 'closed'; const v = document.querySelector('#exr-rvi'); v.value = '1'; })()`);
        await shot('415-02-remark');
        await js(`document.querySelector('#exr-t').closest('form').requestSubmit()`); await wait(700);
        const r = ex().cycles[0].remarks[0];
        check('answered, closed, tied to РВИ-01', r.status === 'closed' && r.answer.includes('лист 3') && r.rvi === 1, JSON.stringify(r));
        check('counters: 1 closed', /Закрыто\s*1/.test(await js(`document.querySelector('.ex-kpis')?.textContent || ''`)));
        await js(`document.querySelector('.ex')?.scrollIntoView({ block: 'start' })`); await wait(200);
        await shot('415-03-after');
      });

      await step('the answers in Word', async () => {
        await click('[data-act="ex-word"][data-id="demo-p1"]'); await wait(1500);
        const f = fs.readdirSync(outDir).find(n => /Ответы на замечания.*\.docx$/.test(n));
        const xml = f ? require('node:zlib') && fs.readFileSync(path.join(outDir, f)) : null;
        check('a .docx saved', !!f && xml.length > 1000, f || fs.readdirSync(outDir).join(','));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

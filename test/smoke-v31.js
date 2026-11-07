'use strict';
// 3.1 walkthrough: composition by Decree 87, customer data, customer page, «Тандем» theme.
// `electron test/smoke-v31.js <outDir>` with XDG_CONFIG_HOME pointing at a temp dir.
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
    try {
      win.setSize(1400, 880); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);

      await step('customer tab', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        check('project drawer has tabs', /Состав проекта: ПД и РД/.test(await text('.dtabs')) && /Для заказчика/.test(await text('.dtabs')));
        await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
        check('7 phases for GIP incl. contract', (await js(`document.querySelectorAll('#cust-box .pd-t')[0].querySelectorAll('tbody tr').length`)) === 7 && /Договор/.test(await text('#cust-box')));
        check('now: expertise, on schedule', /Сейчас: Экспертиза/.test(await text('#cust-box .cust-top')) && /по графику/.test(await text('#cust-box .cust-top')), await text('#cust-box .cust-top'));
        await shot('31-01-customer-tab');
        await click('[data-act="pd-add"][data-list="requests"]'); await wait(100);
        await setVal('[data-pd="requests.2.title"]', 'Задание на технологию цеха');
        await setVal('[data-pd="requests.2.due"]', '2030-01-10');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(500);
        check('request saved', (data().projects['demo-p1'].requests || []).some(r => r.title === 'Задание на технологию цеха' && r.due === '2030-01-10'));
      });

      await step('customer page html', async () => {
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(150);
        await click('[data-act="cust-page"][data-format="html"]'); await wait(1500);
        const f = fs.readdirSync(outDir).find(x => x.endsWith('.html'));
        const html = f ? fs.readFileSync(path.join(outDir, f), 'utf8') : '';
        check('html saved', !!f && html.length > 50000, f || 'нет');
        check('page content', /Экспертиза/.test(html) && /Нужно от вас/.test(html) && /Протокол № 7/.test(html) && /ГПЗУ/.test(html) && /Задание на технологию цеха/.test(html));
        check('no contractors, no money on page', !/Петров|Сидорова|Кузнецов|180\s?000|₽/.test(html));
        check('logo and font embedded', /<svg[^>]*viewBox="0 0 233 51"/.test(html) && /font\/ttf;base64/.test(html));
        fs.copyFileSync(path.join(outDir, f), path.join(outDir, 'page.html'));
        await click('[data-act="cust-page"][data-format="pdf"]'); await wait(2500);
        const pdf = fs.readdirSync(outDir).find(x => x.endsWith('.pdf'));
        check('pdf saved', !!pdf && fs.readFileSync(path.join(outDir, pdf)).slice(0, 4).toString() === '%PDF');
      });

      await step('composition', async () => {
        await click('[data-act="dtab"][data-id="comp"]'); await wait(150);
        await click('[data-act="comp-base"][data-v="prod"]'); await wait(200);
        check('base sections', (await js(`document.querySelectorAll('.comp-t tr.ck-section').length`)) === 13 && (await js(`document.querySelectorAll('.comp-t tr.ck-sub').length`)) === 6);
        // two books under ИОС1
        const sub = await js(`[...document.querySelectorAll('.comp-t tr.ck-sub')].find(r => /электроснабжения/.test(r.textContent)).querySelector('[data-act="comp-add"]').dataset.id`);
        await click(`[data-act="comp-add"][data-id="${sub}"]`); await wait(100);
        await js(`(() => { const i = document.querySelector('.comp-t tr.ck-book [data-k="title"]'); i.value = 'Электроснабжение 10/0,4 кВ'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await click(`[data-act="comp-add"][data-id="${sub}"]`); await wait(100);
        await js(`(() => { const r = [...document.querySelectorAll('.comp-t tr.ck-book')].at(-1); const i = r.querySelector('[data-k="title"]'); i.value = 'Силовое электрооборудование и освещение'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(150);
        // switch off section 12 already off; switch off ТХ
        await js(`(() => { const r = [...document.querySelectorAll('.comp-t tr.ck-section')].find(x => /Технологические/.test(x.textContent)); const c = r.querySelector('[data-k="on"]'); c.checked = false; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(150);
        const codes = await js(`[...document.querySelectorAll('.comp-t:not(.rd-t) tr.vol [data-k="code"]')].map(i => i.placeholder).join('|')`);
        check('codes from project code', /0425-24-ИОС1\.1/.test(codes) && /0425-24-ИОС1\.2/.test(codes) && !/ИОС1\|/.test(codes + '|') && !/-ТХ/.test(codes), codes);
        await shot('31-02-composition');
        // working documentation: suggested marks, a chip on/off, an own section
        const rdMarks = () => js(`[...document.querySelectorAll('.rd-t [data-k="mark"]')].map(i => i.value).join(',')`);
        check('РД suggested from ПД', /ЭОМ,ЭС,ЭН/.test(await rdMarks()) && /ВК,НВ,ВПВ/.test(await rdMarks()), await rdMarks());
        check('РД of a switched-off ПД section greyed', await js(`[...document.querySelectorAll('.rd-t tbody tr')].find(r => r.querySelector('[data-k="mark"]').value === 'ТХ').classList.contains('off')`));
        const ios2 = await js(`[...document.querySelectorAll('.rd-group')].find(g => /ИОС2/.test(g.textContent)).querySelector('[data-mark="АУПТ"]').dataset.pd`);
        await click(`[data-act="rd-chip"][data-pd="${ios2}"][data-mark="АУПТ"]`); await wait(150);
        check('chip adds АУПТ after ВПВ', /ВПВ,АУПТ/.test(await rdMarks()), await rdMarks());
        await click(`[data-act="rd-chip"][data-pd="${ios2}"][data-mark="ВПВ"]`); await wait(150);
        check('chip removes ВПВ', !/ВПВ/.test(await rdMarks()));
        await click('[data-act="rd-add"][data-pd=""]'); await wait(150);
        await js(`(() => { const i = [...document.querySelectorAll('.rd-t [data-k="mark"]')].at(-1); i.value = 'кж1.1'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(150);
        check('own mark: upper case, name from the dictionary', await js(`(() => { const r = [...document.querySelectorAll('.rd-t tbody tr')].at(-1); return r.querySelector('[data-k="mark"]').value === 'КЖ1.1' && r.querySelector('[data-k="title"]').value === 'Конструкции железобетонные'; })()`));
        await shot('31-02b-rd');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(900); // saving makes a task of every section
        let d = data(), comp = d.projects['demo-p1'].composition;
        const pdVols = comp.nodes.filter(n => n.taskId).length;
        check('ПД volumes became tasks', pdVols >= 14 && comp.nodes.filter(n => n.taskId).every(n => d.tasks[n.taskId]), String(pdVols));
        check('composition saved with РД', Array.isArray(comp.rd) && comp.rd.some(x => x.mark === 'КЖ1.1'));
        const fromRd = comp.rd.filter(x => x.taskId).map(x => d.tasks[x.taskId]).filter(Boolean);
        check('РД sections became tasks', fromRd.some(t => (t.sections || []).includes('ЭОМ')) && fromRd.some(t => t.sections.join() === 'КЖ1.1') && !comp.rd.find(x => x.mark === 'ТХ').taskId, String(fromRd.length));
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(200);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="comp"]'); await wait(200);
        check('nothing left to create', !/будет создано задач/.test(await text('#comp-box')));
        await shot('31-03-composition-cards');
        for (const f of ['sp', 'vok']) {
          await click(`[data-act="comp-export"][data-format="${f}"]`); await wait(300);
          check(`${f}: names dialog`, await js(`!!document.querySelector('#dn-gip')`));
          await js(`document.querySelector('#dn-gip').value = 'Сидоров С.С.'`);
          await js(`document.querySelector('form.modal').requestSubmit()`); await wait(1200);
        }
        await click('[data-act="comp-export"][data-format="xlsx"]'); await wait(800);
        const files = fs.readdirSync(outDir);
        const sp = files.find(x => /Состав ПД — .*\.docx$/.test(x)), vok = files.find(x => /ВОК — .*\.docx$/.test(x)), xlsx = files.find(x => /Состав ПД и ВОК — .*\.xlsx$/.test(x));
        check('exported: Состав ПД, ВОК, Excel', !!sp && !!vok && !!xlsx, files.join(' | '));
        if (vok) {
          const { readZipRaw } = require('../src/report/doc-template.js');
          const doc = readZipRaw(fs.readFileSync(path.join(outDir, vok))).find(e => e.name === 'word/document.xml').data.toString();
          check('ВОК: cipher, marks, GIP from the dialog', /0425-24-/.test(doc) && /КЖ1\.1/.test(doc) && /АУПТ/.test(doc) && /Сидоров С\.С\./.test(doc) && !/04-12-23-2-/.test(doc) && !/Технология производства/.test(doc));
        }
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
      });

      await step('customer page with composition', async () => {
        const r = await js(`window.api.customerPage('demo-p1', { format: 'html', font: 'montserrat' })`);
        const html = fs.readFileSync(path.join(outDir, r.name), 'utf8');
        check('sections by Decree 87 on page', /по ПП РФ № 87/.test(html) && /ИОС1\.2/.test(html) && /Montserrat/.test(html));
        fs.copyFileSync(path.join(outDir, r.name), path.join(outDir, 'page-comp.html'));
      });

      await step('contract only for GIP', async () => {
        await js(`window.api.switchUser('u-chief')`); await wait(500);
        const v = await js(`window.api.getData().then(r => r.data.projects.find(p => p.id === 'demo-p1'))`);
        check('chief does not get contract phase', v.phases.length === 6 && !v.phases.some(p => p.key === 'contract'));
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(150);
        await setVal('[data-pd="phases.0.finish"]', '2026-06-30'); // survey
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(500);
        const ph = data().projects['demo-p1'].phases;
        check('contract phase kept after chief saves', ph.some(p => p.key === 'contract' && p.done) && ph.find(p => p.key === 'survey').finish === '2026-06-30');
        const bad = await js(`window.api.write({ type: 'update', col: 'projects', id: 'demo-p1', data: { phases: [{ key: 'p', start: 'вчера' }] } })`);
        check('bad dates refused', bad && bad.ok === false, bad && bad.message);
        await js(`window.api.switchUser('u-gip')`); await wait(400);
      });

      await step('overview reminder', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="overview"]').click()`); await wait(300);
        check('customer alerts panel', /Заказчик: сроки документов и запросы/.test(await text('#app')) && /ТУ на водоснабжение/.test(await text('#app')));
      });

      await step('tandem theme', async () => {
        await js(`window.api.setTheme('tandem')`); await wait(500);
        check('tandem applied', (await js(`document.documentElement.dataset.theme`)) === 'tandem' && (await js(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`)) === '#F26A1F');
        check('logo visible', await js(`getComputedStyle(document.querySelector('.brand-logo')).display !== 'none'`));
        await click('#btn-view'); await wait(150);
        await click('[data-act="set-font"][data-v="montserrat"]'); await wait(300);
        check('montserrat font', /Montserrat/.test(await js(`getComputedStyle(document.body).fontFamily`)) && await js(`document.fonts.check('14px Montserrat')`));
        await shot('31-04-tandem-menu');
        await click('#btn-view'); await wait(100);
        await shot('31-05-tandem-overview');
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="comp"]'); await wait(200);
        await shot('31-06-tandem-composition');
        await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
        await shot('31-07-tandem-customer');
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

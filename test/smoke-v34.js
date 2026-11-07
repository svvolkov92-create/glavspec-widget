'use strict';
// 3.4: the project page — summary, participants, tasks grouped by the composition; every section is a task.
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

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message, line, source) => { if (level >= 2) log.push(`[console ${level}] ${message} (${source}:${line})`); });
  win.webContents.once('did-finish-load', async () => {
    if (win.webContents.getURL().startsWith('data:')) return;
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);
      await click('[data-act="tab"][data-id="projects"]'); await wait(300);

      await step('list', async () => {
        check('no «+ Карточка» on project cards', !(await js(`!!document.querySelector('.pcard [data-act="new-task"]')`)));
        await shot('34-00-list');
      });

      await step('page without composition', async () => {
        await click('[data-act="project-page"][data-id="demo-p1"]'); await wait(300);
        check('summary tiles', (await js(`document.querySelectorAll('.pt-kpi').length`)) >= 4);
        check('generator invitation', /Состав проекта ещё не сформирован/.test(await text('.pt-page')));
        const before = Object.values(data().tasks).filter(t => t.projectId === 'demo-p1').length;
        check('existing cards under «Прочие задачи»', (await js(`document.querySelectorAll('.pt-block:last-of-type tr.row').length`)) === before, String(before));
      });

      let tasksBefore = [];
      await step('composition → tasks on save', async () => {
        tasksBefore = Object.entries(data().tasks).map(([id, t]) => ({ ...t, id })).filter(t => t.projectId === 'demo-p1');
        await click('[data-act="open-project-tab"][data-tab="comp"]'); await wait(300);
        await click('[data-act="comp-base"][data-v="prod"]'); await wait(200);
        // a book under ИОС1 so the tree has three levels
        const sub = await js(`[...document.querySelectorAll('.comp-t tr.ck-sub')].find(r => /электроснабжения/.test(r.textContent)).querySelector('[data-act="comp-add"]').dataset.id`);
        await click(`[data-act="comp-add"][data-id="${sub}"]`); await wait(100);
        await js(`(() => { const i = document.querySelector('.comp-t tr.ck-book [data-k="title"]'); i.value = 'Наружные сети 10 кВ'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await click(`[data-act="comp-add"][data-id="${sub}"]`); await wait(100);
        await js(`(() => { const i = [...document.querySelectorAll('.comp-t tr.ck-book [data-k="title"]')].at(-1); i.value = 'Внутреннее электрооборудование'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`); await wait(100);
        check('no «Карточки по …» buttons any more', !(await js(`!!document.querySelector('[data-act="comp-cards"]')`)));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(900);
        const d = data(), comp = d.projects['demo-p1'].composition;
        const after = Object.values(d.tasks).filter(t => t.projectId === 'demo-p1' && t.kind !== 'assign'); // 3.5: assignments are counted separately
        const vols = comp.nodes.filter(n => n.taskId).length, rd = comp.rd.filter(x => x.taskId).length;
        check('every section is a task', vols >= 15 && rd >= 15 && comp.nodes.filter(n => n.taskId).every(n => d.tasks[n.taskId]) && comp.rd.filter(x => x.on).every(x => x.taskId && d.tasks[x.taskId]), `${vols} ПД, ${rd} РД`);
        const reused = tasksBefore.filter(t => comp.rd.some(x => x.taskId === t.id));
        check('existing cards with the same mark linked, not duplicated', reused.length >= 1 && after.length === tasksBefore.length + vols + rd - reused.length, `linked ${reused.map(t => t.sections.join()).join(',')}; ${tasksBefore.length} → ${after.length}; where: ${tasksBefore.map(t => t.id + '→' + (comp.nodes.find(n => n.taskId === t.id)?.abbr || comp.nodes.find(n => n.taskId === t.id)?.title || comp.rd.find(x => x.taskId === t.id)?.mark || '-')).join(' ')}`);
      });

      await step('page with groups', async () => {
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(300);
        check('still on the project page', await js(`!!document.querySelector('.pt-page')`));
        const blocks = await js(`[...document.querySelectorAll('.pt-block h3')].map(h => h.textContent).join('|')`);
        check('blocks ПД, РД, прочие', blocks === 'Проектная документация|Рабочая документация|Прочие задачи', blocks);
        const pdTree = await js(`[...[...document.querySelectorAll('.pt-block')][0].querySelectorAll('tr')].map(r => r.textContent.replace(/\\s+/g, ' ')).join('\\n')`);
        check('nesting: Раздел 5 → Подраздел 1 → Книга 1/2', /Раздел 5[\s\S]*Подраздел 1[\s\S]*Книга 1[\s\S]*Книга 2[\s\S]*Подраздел 2/.test(pdTree));
        check('Раздел 5 is a heading, books are tasks', await js(`(() => { const rows = [...[...document.querySelectorAll('.pt-block')][0].querySelectorAll('tr')]; const r5 = rows.find(r => /Раздел 5/.test(r.textContent)); const b1 = rows.find(r => /Книга 1/.test(r.textContent)); return r5.classList.contains('pt-head') && b1.classList.contains('pt-task'); })()`));
        const rdTree = await js(`[...[...document.querySelectorAll('.pt-block')][1].querySelectorAll('tr')].map(r => r.textContent.replace(/\\s+/g, ' ')).join('\\n')`);
        check('РД grouped by ПД: ИОС1 → ЭОМ, ЭС, ЭН', /ИОС1[^\n]*\n[\s\S]*ЭОМ[\s\S]*ЭС[\s\S]*ЭН[\s\S]*ИОС2/.test(rdTree));
        await shot('34-01-page');
        await click('.pt-block tr.pt-task'); await wait(300);
        check('task opens from the tree', await js(`document.querySelector('#dform')?.dataset.kind === 'task' || !!document.querySelector('#dform [name="title"]')`));
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(200);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(150);
        await click('.pt-block:last-of-type [data-act="new-task"]'); await wait(300);
        check('«+ задача» in «Прочие задачи» opens a new task in this project', await js(`document.querySelector('#dform [name="projectId"]')?.value === 'demo-p1'`));
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(200);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(150);
      });

      await step('participants', async () => {
        const spec = Object.entries(data().users).find(([, u]) => u.role === 'specialist' && !u.deletedAt);
        await js(`document.querySelector('#pt-member').value = ${JSON.stringify(spec[0])}`);
        await click('[data-act="member-add"]'); await wait(500);
        check('member saved', (data().projects['demo-p1'].members || []).includes(spec[0]));
        check('member shown', (await text('.pt-members')).includes(spec[1].name.replace(/^Пример:\s*/, '').split(' ')[0]));
        await click('[data-act="member-add-tasks"]'); await wait(500);
        const m = data().projects['demo-p1'].members;
        check('add everyone working in tasks', m.length >= 3, String(m.length));
        await shot('34-02-participants');
        await click(`[data-act="member-del"][data-id="${spec[0]}"]`); await wait(500);
        check('member removed', !data().projects['demo-p1'].members.includes(spec[0]));
      });

      await step('tab click returns to the list', async () => {
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        check('list shown', await js(`!!document.querySelector('.pcard') && !document.querySelector('.pt-page')`));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

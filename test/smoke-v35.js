'use strict';
// 3.5: timeline questionnaire, assignments by the tech card (subtasks, links, wave dates), task card without the
// mark grid, volume numbering, the tech card window, «Удалить все проекты».
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
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const tasksOf = pid => Object.entries(data().tasks).map(([id, t]) => ({ ...t, id })).filter(t => t.projectId === pid && !t.deletedAt);
    let pid = '';
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);

      await step('questionnaire on create', async () => {
        await click('#btn-create'); await wait(100);
        await click('#create-menu [data-act="new-project"]'); await wait(300);
        await setVal('#pr-name', 'Корпус 3'); await setVal('#pr-code', '0526-25');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(900);
        check('questionnaire opens', await js(`!!document.querySelector('.tq-modal')`));
        await setVal('#tq-p-s', '2026-01-12'); await setVal('#tq-p-f', '2026-04-30');
        await setVal('#tq-expertise-f', '2026-06-30');
        check('expertise start suggested after П', (await js(`document.querySelector('#tq-expertise-s').value`)) === '2026-05-01');
        check('Р start suggested after expertise', (await js(`document.querySelector('#tq-r-s').value`)) === '2026-07-01');
        await js(`document.querySelector('.tq-modal input[name="tq-mode"][value="parallel"]').click()`); await wait(100);
        check('parallel: Р right after П', (await js(`document.querySelector('#tq-r-s').value`)) === '2026-05-01');
        await setVal('#tq-r-f', '2026-08-31');
        await click('.tq-modal [data-m="ms-add"]'); await wait(100);
        await setVal('.tq-ms:last-child .tq-ms-t', 'Выдача ТУ на электроснабжение'); await setVal('.tq-ms:last-child .tq-ms-d', '2026-02-15');
        await shot('35-01-questionnaire');
        await js(`document.querySelector('.tq-modal form, form.tq-modal').requestSubmit()`); await wait(900);
        const p = Object.entries(data().projects).find(([, x]) => x.name === 'Корпус 3');
        pid = p[0];
        const ph = k => p[1].phases.find(x => x.key === k) || {};
        check('phases saved', ph('p').start === '2026-01-12' && ph('p').finish === '2026-04-30' && ph('r').start === '2026-05-01' && ph('r').finish === '2026-08-31', JSON.stringify(p[1].phases));
        check('rdMode and contract dates saved', p[1].rdMode === 'parallel' && p[1].milestones.some(m => m.title === 'Выдача ТУ на электроснабжение' && m.date === '2026-02-15'));
        check('then the generator', await js(`!!document.querySelector('[data-act="comp-base"]')`));
      });

      await step('generator: numbering and links', async () => {
        await click('[data-act="comp-base"][data-v="prod"]'); await wait(300);
        check('numbering selects and link toggles', await js(`!!document.querySelector('[data-copt="numbering.pd"]') && !!document.querySelector('[data-copt="links.rd"]')`));
        await setVal('[data-copt="numbering.pd"]', 'flat'); await wait(200);
        const toms = await js(`[...document.querySelectorAll('.comp-t:not(.rd-t) tr.vol [data-k="tom"]')].slice(0, 6).map(i => i.placeholder).join(',')`);
        check('flat ПД numbering 1,2,3…', toms.startsWith('1,2,3,4,5,6'), toms);
        await setVal('[data-copt="numbering.pd"]', 'section'); await wait(200);
        await shot('35-02-generator');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(1200);
      });

      await step('assignments, links and dates', async () => {
        const all = tasksOf(pid), asg = all.filter(t => t.kind === 'assign'), sec = all.filter(t => t.kind !== 'assign');
        const byMark = m => sec.find(t => (t.sections || []).includes(m) && /Конструктивные|Архитектурные|ИОС|Технолог|Отопление|Электро/i.test(t.title + t.note) && /том/.test(t.note) && !/РД/.test(t.note));
        check('assignments made', asg.length >= 30, String(asg.length));
        check('every assignment is a subtask of a section and has recipients', asg.every(a => sec.some(t => t.id === a.parentId) && a.toTaskIds.length && a.toTaskIds.every(id => sec.some(t => t.id === id))));
        check('assignment titles «Задание X → Y» with what to pass', asg.every(a => /^Задание .+ → .+/.test(a.title) && a.note.length > 5), asg[0] && asg[0].title);
        const key = asg.map(a => a.assignKey);
        check('one assignment per pair and stage', new Set(key).size === key.length);
        const ar = asg.find(a => a.assignKey === 'pd:АР>КР'), tx = asg.find(a => a.assignKey === 'pd:ТХ>АР');
        check('АР → КР and ТХ → АР present', !!ar && !!tx);
        const kr = ar && sec.find(t => t.id === ar.toTaskIds[0]);
        check('forward assignment holds the recipient (dependsOn)', kr && (kr.dependsOn || []).includes(ar.id), kr && JSON.stringify(kr.dependsOn));
        const back = asg.find(a => a.assignKey === 'pd:КР>АР'), arTask = back && sec.find(t => t.id === back.toTaskIds[0]);
        check('back assignment does not', arTask && !(arTask.dependsOn || []).includes(back.id));
        const arSec = sec.find(t => t.id === ar.parentId), krSec = kr;
        check('wave dates: АР (wave 1) starts at П start, КР (wave 2) later', arSec.start === '2026-01-12' && krSec.start > arSec.start && krSec.finish <= '2026-04-30', `${arSec.start}–${arSec.finish} / ${krSec.start}–${krSec.finish}`);
        check('forward assignment due before the recipient wave', ar.finish < krSec.start, `${ar.finish} < ${krSec.start}`);
        const rdA = asg.filter(a => a.assignKey.startsWith('rd:'));
        const rdSec = sec.filter(t => / \(РД\)$/.test(t.note || ''));
        check('РД assignments too, dated inside stage Р', rdA.length >= 10 && rdSec.every(t => t.start >= '2026-05-01' && t.finish <= '2026-08-31'), `${rdA.length}; ${rdSec.slice(0, 2).map(t => t.start + '–' + t.finish)}`);
        const ios = asg.filter(a => /^pd:ИОС\d>ПЗУ$/.test(a.assignKey));
        check('every ИОС → ПЗУ (сводный план сетей)', ios.length >= 5 && ios.some(a => /сводный план/.test(a.note)), String(ios.length));
        // idempotent: saving again makes nothing new
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click(`[data-act="project-page"][data-id="${pid}"]`); await wait(300);
        await click('[data-act="open-project-tab"][data-tab="comp"]'); await wait(300);
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(900);
        check('second save adds nothing', tasksOf(pid).length === all.length, `${all.length} → ${tasksOf(pid).length}`);
      });

      await step('project page: assignments under both sides', async () => {
        await click('[data-act="tab"][data-id="projects"]'); await wait(200);
        await click(`[data-act="project-page"][data-id="${pid}"]`); await wait(400);
        check('folded summary line under sections', (await js(`document.querySelectorAll('.pt-asg-sum').length`)) >= 10);
        check('«Прочие задачи» without assignments', (await js(`document.querySelectorAll('.pt-block:last-of-type tr.row').length`)) === 0);
        const ar = tasksOf(pid).find(t => t.assignKey === 'pd:АР>КР');
        await click(`[data-act="fold"][data-key="pao:${ar.parentId}"]`); await wait(300);
        check('opened: outgoing under the source', await js(`!!document.querySelector('tr.pt-asg[data-id="${ar.id}"]') && /исх\\./.test(document.querySelector('tr.pt-asg[data-id="${ar.id}"]').textContent)`));
        await click(`[data-act="fold"][data-key="pao:${ar.toTaskIds[0]}"]`); await wait(300);
        check('and incoming under the recipient', await js(`[...document.querySelectorAll('tr.pt-asg[data-id="${ar.id}"]')].some(r => /вх\\./.test(r.textContent))`));
        await shot('35-03-page-assignments');
        await js(`document.querySelector('tr.pt-asg[data-id="${ar.id}"]').click()`); await wait(600);
        check('assignment card: route, official fields, no mark grid', await js(`!!document.querySelector('.asg-box .asg-route') && !!document.querySelector('[name="officialNo"]') && !document.querySelector('#dform input[name="mark"]')`));
        await js(`document.querySelector('[name="official"]').click()`); await setVal('[name="officialNo"]', 'ЗД-АР-01');
        await shot('35-04-assignment-card');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(700);
        const a2 = data().tasks[ar.id];
        check('official assignment saved', a2.official === true && a2.officialNo === 'ЗД-АР-01' && a2.kind === 'assign' && a2.parentId === ar.parentId, JSON.stringify({ o: a2.official, n: a2.officialNo }));
        await js(`document.querySelector('tr.pt-task[data-id="${ar.toTaskIds[0]}"]').click()`); await wait(600);
        check('section card: composition place + incoming list', await js(`!!document.querySelector('.comp-place') && /Входящие задания/.test(document.querySelector('.asg-list')?.textContent || '')`));
        await shot('35-05-section-card');
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(200);
      });

      await step('task without a mark', async () => {
        await click('.pt-block:last-of-type [data-act="new-task"]'); await wait(300);
        check('single «Марка» field', await js(`!!document.querySelector('#t-marks-extra[list="marks-dl"]') && !document.querySelector('.mk-groups')`));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(400);
        check('no mark and no title → asks for one', /марку|уточнение/.test(await text('#form-err')), await text('#form-err'));
        await js(`document.querySelector('details.more').open = true`);
        await setVal('#t-title', 'Сбор исходных данных');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(700);
        check('saved with the title only', tasksOf(pid).some(t => t.title === 'Сбор исходных данных' && !(t.sections || []).length));
      });

      await step('tech card window', async () => {
        await click('[data-act="techcard"]'); await wait(300);
        check('opens with sections', (await js(`document.querySelectorAll('.tc-nav button').length`)) === 6);
        for (const sec of ['source', 'waves', 'assign', 'rd', 'summary']) {
          await click(`.tc-nav [data-sec="${sec}"]`); await wait(100);
          check('tech card: ' + sec, (await js(`document.querySelector('.tc-body').textContent.length`)) > 100);
          if (sec === 'waves') await shot('35-06-techcard-waves');
        }
        await js(`document.querySelector('.tc-back').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await wait(150);
        check('closes by Esc', !(await js(`!!document.querySelector('.tc-back')`)));
      });

      await step('«Сроки» on the project page', async () => {
        await click('[data-act="project-timeline"]'); await wait(300);
        check('questionnaire prefilled', (await js(`document.querySelector('#tq-p-s').value`)) === '2026-01-12');
        await js(`document.querySelector('.tq-modal [data-m="cancel"]').click()`); await wait(200);
      });

      await step('delete all projects', async () => {
        const n = Object.values(data().projects).filter(p => !p.deletedAt).length;
        await click('#btn-file'); await wait(150);
        await click('[data-act="delete-all-projects"]'); await wait(300);
        check('confirm asked', /все проекты/.test(await text('.modal')));
        await click('.modal [data-m="yes"]'); await wait(900);
        const d = data();
        check('all projects and tasks in the trash', Object.values(d.projects).every(p => p.deletedAt) && Object.values(d.tasks).every(t => t.deletedAt), `${n} projects`);
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        await shot('35-07-after-delete-all');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

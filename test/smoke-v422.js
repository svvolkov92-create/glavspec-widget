'use strict';
// 4.22 — remarks of the expertise and letters move out of the project into their own collections (a copy, the old
// fields stay); the person answering a remark writes the answer; «Удалить примеры» works again.
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
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23, userId: 'u-gip' }));
const now = new Date().toISOString(), today = now.slice(0, 10);
// A base of 4.21: remarks inside the cycles, letters inside the project.
fs.writeFileSync(path.join(dataDir, 'data.json'), JSON.stringify({
  version: 1, contractors: {}, chats: {}, depts: {}, orgs: {},
  users: { 'u-gip': { name: 'Волков С.В.', role: 'gip', directions: [], createdAt: now }, 'u-spec': { name: 'Смирнова О.', role: 'specialist', directions: ['ar'], createdAt: now } },
  projects: { p1: { name: 'ЖК «Тест»', code: '01-26', gipId: 'u-gip', members: ['u-spec'], createdAt: now,
    expertise: { org: 'ГАУ «Экспертиза»', cycles: [{ id: 'c1', no: '1', date: today, due: today, remarks: [
      { id: 'r1', n: '1', mark: 'АР', text: 'Нет плана кровли', ownerId: 'u-spec', due: today, status: 'work' },
      { id: 'r2', n: '2', mark: 'КР', text: 'Нет узла опирания', ownerId: 'u-gip', due: today, status: 'work' }] }] },
    letters: [{ id: 'l1', dir: 'in', seq: 1, date: today, corr: 'ГАУ', subject: 'Замечания экспертизы', status: 'answer', files: [] },
      { id: 'l2', dir: 'out', seq: 1, date: today, corr: 'Заказчик', subject: 'График выдачи', status: 'sent', files: [] }] } },
  tasks: { t1: { projectId: 'p1', sections: ['АР'], section: 'АР', title: '', ownerId: 'u-spec', coOwnerIds: [], status: 'in_progress', start: today, finish: today, budget: 0, history: [], createdAt: now } },
}));

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
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    try {
      win.setSize(1400, 950); await wait(1200);

      await step('the move at start', async () => {
        const d = data();
        check('remarks and letters are records of their own', d.remarks?.r1?.projectId === 'p1' && d.remarks.r1.cycleId === 'c1' && d.remarks.r2?.pos === 2 && d.letters?.l1?.projectId === 'p1' && d.letters.l2?.subject === 'График выдачи', JSON.stringify({ r: d.remarks, l: Object.keys(d.letters || {}) }));
        check('the project keeps the old copies, marked moved', d.projects.p1.expertise.moved === true && d.projects.p1.expertise.cycles[0].remarks.length === 2 && d.projects.p1.lettersMoved === true && d.projects.p1.letters.length === 2);
        await js(`window.AppBridge.openTarget('project:p1')`); await wait(800);
        const page = await text('#app');
        check('the project page shows both remarks and both letters', page.includes('Нет плана кровли') && page.includes('Нет узла опирания') && page.includes('Замечания экспертизы') && page.includes('График выдачи'));
        await shot('422-01-page');
      });

      await step('a new remark and a new letter go to the collections', async () => {
        await click('[data-act="ex-new"][data-id="p1"]'); await wait(300);
        await setVal('#exr-mark', 'АР'); await setVal('#exr-text', 'Нет разреза 2-2');
        await js(`document.querySelector('#exr-t').closest('form').requestSubmit()`); await wait(700);
        const d = data(), r = Object.entries(d.remarks).find(([, x]) => x.text === 'Нет разреза 2-2');
        check('a remark record with the next position; the project copy untouched', !!r && r[1].pos === 3 && r[1].cycleId === 'c1' && d.projects.p1.expertise.cycles[0].remarks.length === 2, JSON.stringify(r));
        await click('[data-act="let-new"][data-v="out"]'); await wait(300);
        await setVal('#let-subj', 'Ответ на замечания'); await js(`document.querySelector('.let-modal').requestSubmit()`); await wait(700);
        const l = Object.values(data().letters).find(x => x.subject === 'Ответ на замечания');
        check('a letter record, Исх. 2 (numbering over the records)', !!l && l.seq === 2 && l.projectId === 'p1', JSON.stringify(l));
      });

      await step('the person answering a remark', async () => {
        await js(`window.api.switchUser('u-spec')`); await wait(800);
        await js(`window.AppBridge.openTarget('project:p1')`); await wait(800);
        await click('[data-act="ex-open"][data-v="r1"]'); await wait(300);
        const st = await js(`({ text: document.querySelector('#exr-text').disabled, ans: document.querySelector('#exr-ans').disabled, opts: [...document.querySelectorAll('#exr-st option')].map(o => o.value).join(), save: !!document.querySelector('#exr-t').closest('form').querySelector('[type=submit]') })`);
        check('only the answer, РВИ and «ответ готов» are open to him', st.text && !st.ans && st.opts === 'work,ready' && st.save, JSON.stringify(st));
        await setVal('#exr-ans', 'План кровли — лист 7'); await js(`(() => { const s = document.querySelector('#exr-st'); s.value = 'ready'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await shot('422-02-answer');
        await js(`document.querySelector('#exr-t').closest('form').requestSubmit()`); await wait(700);
        const r = data().remarks.r1;
        check('the answer saved, «ответ готов»', r.answer === 'План кровли — лист 7' && r.status === 'ready', JSON.stringify(r));
        await click('[data-act="ex-open"][data-v="r2"]'); await wait(300);
        check('someone else\'s remark is read-only for him', await js(`!document.querySelector('#exr-t').closest('form').querySelector('[type=submit]') && document.querySelector('#exr-ans').disabled`));
        await js(`document.querySelector('.modal-back [data-m="cancel"]').click()`); await wait(200);
      });

      await step('a letter deleted; samples removed', async () => {
        await js(`window.api.switchUser('u-gip')`); await wait(800);
        await js(`window.AppBridge.openTarget('project:p1')`); await wait(800);
        await click('[data-act="let-edit"][data-lid="l2"]'); await wait(300);
        await click('.let-modal [data-m="del"]'); await wait(700);
        const d = data();
        check('the letter record is gone, the old copy in the project stays', !d.letters.l2 && d.projects.p1.letters.length === 2);
        // The «Показать на примере» button is on the empty screen only: the same action from a stand-in button.
        await js(`(() => { const b = document.createElement('button'); b.dataset.act = 'seed-demo'; b.type = 'button'; document.getElementById('app').append(b); b.click(); })()`); await wait(1200);
        check('samples are there', Object.values(data().projects).some(p => p.demo));
        await click('[data-act="clear-demo"]'); await wait(1000);
        check('«Удалить примеры» works (it failed before 4.22)', !Object.values(data().projects).some(p => p.demo) && !!data().projects.p1, JSON.stringify(Object.keys(data().projects)));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

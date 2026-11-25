'use strict';
// 4.16 — «Задания смежникам» on the project page (выдал → принял / вернул, «кто кого держит») and the outside
// contractor's statement in his card (начислено / оплачено / остаток, акт сверки).
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
      const past = new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10), now = new Date().toISOString();
      await js(`window.api.write([{ type: 'set', col: 'tasks', id: 'as1', data: { projectId: 'demo-p1', kind: 'assign', parentId: 'demo-t1', toTaskIds: ['demo-t2'], assignKey: 'rd:x>y', sections: ['ЭОМ'], section: 'ЭОМ', title: 'Задание ЭОМ → СС', note: 'Нагрузки и трассы для сетей связи', start: '${past}', finish: '${past}', status: 'not_started', budget: 0, ownerId: 'u-gip', coOwnerIds: [], milestones: [], plan: [], payments: [], dependsOn: [], history: [], createdAt: '${now}' } }], { action: 'test' })`); await wait(500);

      await step('the list of assignments: late, «кто кого держит», выдал → вернуть → выдал → принял', async () => {
        await js(`window.AppBridge.openTarget('project:demo-p1')`); await wait(700);
        await js(`document.querySelector('.asg')?.scrollIntoView({ block: 'start' })`); await wait(200);
        check('the block and the row', (await js(`document.querySelector('.asg-t')?.textContent || ''`)).includes('Нагрузки и трассы'));
        check('late and «ЭОМ … держит»', (await text('.asg-t')).includes('сорвано 4') && (await text('.asg-hold')).includes('ЭОМ'), await text('.asg-hold'));
        await shot('416-01-assign');
        await click('[data-act="asg-issue"][data-id="as1"]'); await wait(800);
        check('issued: on review, the recipient card got a word', data().tasks.as1.status === 'review' && (data().tasks['demo-t2'].comments || []).some(c => c.text.includes('Выдано задание')));
        check('the row says «выдано, ждёт приёма»', (await text('.asg-t')).includes('выдано, ждёт приёма'));
        await click('[data-act="asg-return"][data-id="as1"]'); await wait(300);
        await setVal('#asr-note', 'Нет отметок трасс'); await js(`document.querySelector('#asr-t').closest('form').requestSubmit()`); await wait(800);
        check('returned with the remark', data().tasks.as1.status === 'revision' && (data().tasks.as1.comments || []).some(c => c.text.includes('Нет отметок трасс')));
        await click('[data-act="asg-issue"][data-id="as1"]'); await wait(800);
        await click('[data-act="asg-accept"][data-id="as1"]'); await wait(800);
        check('accepted', data().tasks.as1.status === 'done');
        check('«Не приняты» is empty now', (await text('.asg')).includes('все задания приняты'));
      });

      await step('the outside contractor: accrued, paid, left; акт сверки', async () => {
        const cid = data().tasks['demo-t1'].contractorId;
        await js(`(() => { const b = document.createElement('button'); b.dataset.act = 'open-contractor'; b.dataset.id = '${cid}'; document.body.append(b); b.click(); b.remove(); })()`); await wait(600);
        const box = await text('.cm-sub');
        const ts = Object.values(data().tasks).filter(t => t.contractorId === cid && !t.deletedAt);
        const acc = ts.reduce((a, t) => a + (Number(t.budget) || 0), 0);
        check('the statement is in the card', box.includes('Начислено') && box.replace(/\s/g, '').includes(String(acc)), box.replace(/\s+/g, ' ').slice(0, 200));
        await js(`document.querySelector('.cm-sub')?.scrollIntoView()`); await wait(200);
        await shot('416-02-contractor');
        await click('[data-act="cm-act"][data-v="docx"]'); await wait(1500);
        check('акт сверки saved', fs.readdirSync(outDir).some(n => /Акт сверки.*\.docx$/.test(n)), fs.readdirSync(outDir).join(', '));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

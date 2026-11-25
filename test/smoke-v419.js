'use strict';
// 4.19 — short people cards with «ждут заданий», the person window, «Моя анкета» and its rules.
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
      const today = new Date().toISOString().slice(0, 10);
      await js(`window.api.write([{ type: 'set', col: 'tasks', id: 'v419-as', data: { projectId: 'demo-p1', kind: 'assign', parentId: 'demo-t8', toTaskIds: ['demo-t1'], sections: ['ВК'], title: 'Задание ВК → ЭОМ', note: 'Нагрузки насосов', status: 'not_started', start: '${today}', finish: '${today}', ownerId: 'demo-u2', coOwnerIds: [], profileOk: true, createdAt: new Date().toISOString() } }], { action: 'test' })`); await wait(500);

      await step('short cards', async () => {
        await tab('people');
        await click('[data-act="people-mode"][data-v="cards"]'); await wait(300);
        const n = await js(`document.querySelectorAll('.pplcard').length`);
        check('people as short cards, no task rows', n >= 3 && !(await js(`!!document.querySelector('.pplcard .ctask')`)), `cards ${n}`);
        check('five numbers, «Ждут заданий» among them', await js(`[...document.querySelectorAll('.pplcard[data-id="demo-u1"] .stat .k')].map(x => x.textContent).join('|')`) === 'Карточек|В работе|Сорвано|На проверке|Ждут заданий');
        check('«ждут заданий: 1» on the recipient', (await text('.pplcard[data-id="demo-u1"] .stat.waitv .v')) === '1');
        check('«выдать заданий: 1» on the issuer, not counted as a card', (await text('.pplcard[data-id="demo-u2"] .pc-state')).includes('выдать заданий: 1')
          && (await text('.pplcard[data-id="demo-u2"] .stat .v')) === String(await js(`[...window.AppBridge.state.tasks.values()].filter(t => !t.deletedAt && t.kind !== 'assign' && (t.ownerId === 'demo-u2' || (t.coOwnerIds || []).includes('demo-u2'))).length`)));
        await shot('419-01-cards');
        await click('.pplcard[data-id="demo-u1"]'); await wait(400);
        check('click opens the person: what they do and the assignments they wait for', await js(`!!document.querySelector('.person-modal')`) && (await text('.person-modal')).includes('Ждёт заданий') && (await text('.person-modal')).includes('Нагрузки насосов'));
        await shot('419-02-person');
        await click('.person-modal [data-m="close"]'); await wait(200);
        await click('[data-act="people-mode"][data-v="list"]'); await wait(300);
        check('the list has «Ждут заданий» too', (await text('.staff-t thead')).includes('Ждут заданий'));
        await click('[data-act="people-mode"][data-v="cards"]'); await wait(200);
      });

      await step('«Моя анкета»', async () => {
        await js(`window.api.switchUser('demo-u3')`); await wait(700);
        await click('[data-act="user-menu"]'); await wait(200);
        await click('#user-menu [data-act="my-profile"]'); await wait(300);
        await setVal('#pf-about', 'Водоснабжение и канализация, 8 лет.');
        await setVal('#pf-progs', 'AutoCAD, Revit; nanoCAD');
        await setVal('#pf-phone', '+7 900 000-00-00');
        await setVal('#pf-bday', '1990-03-12');
        await js(`document.querySelector('.modal-back form').requestSubmit()`); await wait(300);
        await click('.modal-back [data-m="yes"]'); await wait(700);
        const u = data().users['demo-u3'];
        check('saved: about, programs, phone, birthday', u.about === 'Водоснабжение и канализация, 8 лет.' && JSON.stringify(u.programs) === '["AutoCAD","Revit","nanoCAD"]' && u.phone === '+7 900 000-00-00' && u.birthday === '1990-03-12', JSON.stringify(u));
        await click('[data-act="user-menu"]'); await wait(200);
        await click('#user-menu [data-act="my-profile"]'); await wait(300);
        check('the birthday is locked after the first fill', await js(`document.querySelector('#pf-bday').disabled`));
        await shot('419-03-profile');
        await js(`document.querySelector('.modal-back [data-m="cancel"]').click()`); await wait(200);
        const w = ops => js(`window.api.write(${JSON.stringify(ops)}, { action: 'test' })`);
        const r1 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { birthday: '1991-01-01' } }]);
        const r2 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { position: 'Главный инженер' } }]);
        const r3 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { directions: ['el'] } }]);
        const r4 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { photo: 'javascript:alert(1)' } }]);
        const r5 = await w([{ type: 'update', col: 'users', id: 'demo-u2', data: { about: 'чужая анкета' } }]);
        const r6 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' } }]);
        check('the person cannot change the birthday again, the position, the directions, a bad photo, another profile', ![r1, r2, r3, r4, r5].some(r => r?.ok), JSON.stringify([r1, r2, r3, r4, r5].map(r => r?.message)));
        check('a proper photo is saved', r6?.ok && data().users['demo-u3'].photo.startsWith('data:image/png'), JSON.stringify(r6));
        await js(`window.api.switchUser('u-gip')`); await wait(700);
        const r7 = await w([{ type: 'update', col: 'users', id: 'demo-u3', data: { position: 'Ведущий инженер', hireDate: '2021-09-01', birthday: '1990-03-13' } }]);
        check('the GIP sets the position, the hire date and fixes the birthday', r7?.ok && data().users['demo-u3'].position === 'Ведущий инженер', JSON.stringify(r7));
        await tab('people'); await wait(200);
        check('the card shows the photo and the position', await js(`!!document.querySelector('.pplcard[data-id="demo-u3"] img.ava')`) && (await text('.pplcard[data-id="demo-u3"] .pc-name')).includes('Ведущий инженер'));
        await click('.pplcard[data-id="demo-u3"]'); await wait(400);
        const pm = await text('.person-modal');
        check('the person window shows the profile (birthday without the year)', pm.includes('nanoCAD') && pm.includes('13.03') && !pm.includes('1990') && pm.includes('01.09.21'), pm.replace(/\s+/g, ' ').slice(0, 300));
        await shot('419-04-person-profile');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

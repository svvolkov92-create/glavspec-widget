'use strict';
// 4.21 — how fast the window is on a big office: 60 projects, 3 000 cards, 40 people, 200 contractors, 2 000 messages.
// Not a smoke (it does not run with the others): GLAVSPEC_TEST_APPDATA=<empty dir> node test/smoke-host.js test/perf-big.js <outDir>
// Prints, per tab, how long a full redraw takes (median of 5) and writes the numbers to <outDir>/perf.json.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23, userId: 'u-gip' }));

// A deterministic big data set.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rnd() * a.length)];
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const DIRS = ['el', 'ss', 'vk', 'ov', 'ar', 'kr'], MARKS = { el: 'ЭОМ', ss: 'СС', vk: 'ВК', ov: 'ОВ', ar: 'АР', kr: 'КР' };
const STATUSES = ['not_started', 'in_progress', 'in_progress', 'review', 'revision', 'done', 'done', 'paused'];
const data = { version: 1, projects: {}, contractors: {}, tasks: {}, users: {}, chats: {}, depts: {}, orgs: {} };
data.users['u-gip'] = { name: 'ГИП Волков', role: 'gip', directions: [], createdAt: day(-400) };
for (let i = 0; i < 6; i++) data.users['u-c' + i] = { name: `Главспец ${i}`, role: 'chief', directions: [DIRS[i]], canSeeBudget: true, createdAt: day(-400) };
for (let i = 0; i < 33; i++) data.users['u-s' + i] = { name: `Специалист ${i}`, role: 'specialist', directions: [DIRS[i % 6]], chiefId: 'u-c' + (i % 6), createdAt: day(-300) };
for (let i = 0; i < 200; i++) data.contractors['c' + i] = { name: `Подрядчик ${i}`, specialty: MARKS[DIRS[i % 6]], phone: '', createdAt: day(-200) };
for (let i = 0; i < 60; i++) data.projects['p' + i] = { name: `Объект ${i}`, code: `${100 + i}-24`, client: `Заказчик ${i % 17}`, stage: pick(['П', 'Р', 'ПР']), start: day(-200 + i), finish: day(100 + i * 3), gipId: 'u-gip', members: [], createdAt: day(-200) };
for (let i = 0; i < 3000; i++) {
  const d = DIRS[i % 6], status = pick(STATUSES), start = Math.floor(rnd() * 200) - 150, owner = rnd() < 0.7 ? 'u-s' + (Math.floor(rnd() * 33)) : 'u-c' + (i % 6);
  data.tasks['t' + i] = {
    projectId: 'p' + (i % 60), sections: [MARKS[d]], section: MARKS[d], title: `Работа ${i}`, ownerId: owner, coOwnerIds: [], contractorId: rnd() < 0.3 ? 'c' + Math.floor(rnd() * 200) : '',
    status, start: day(start), finish: day(start + 10 + Math.floor(rnd() * 60)), budget: Math.floor(rnd() * 500) * 1000, payments: [], milestones: [], plan: [], dependsOn: i > 10 && rnd() < 0.2 ? ['t' + (i - 7)] : [],
    profileOk: true, history: Array.from({ length: 5 }, (_, k) => ({ ts: new Date(Date.now() - (5 - k) * 864e5 * 9).toISOString(), date: day(-(5 - k) * 9), type: 'status', from: 'not_started', to: status })),
    comments: Array.from({ length: 3 }, (_, k) => ({ id: `cm${i}-${k}`, ts: new Date(Date.now() - k * 36e5).toISOString(), userId: owner, user: 'x', text: 'Комментарий к работе' })), createdAt: day(-200),
  };
}
for (let i = 0; i < 40; i++) {
  const members = ['u-gip', 'u-c' + (i % 6), 'u-s' + i % 33];
  data.chats['g' + i] = { kind: 'group', title: `Чат ${i}`, members, messages: Array.from({ length: 50 }, (_, k) => ({ id: `m${i}-${k}`, ts: new Date(Date.now() - (50 - k) * 36e5).toISOString(), userId: pick(members), user: 'x', text: `Сообщение ${k} @Волков по объекту` })) };
}
fs.writeFileSync(path.join(dataDir, 'data.json'), JSON.stringify(data));
log.push(`data.json: ${(fs.statSync(path.join(dataDir, 'data.json')).size / 1e6).toFixed(1)} MB`);

let started = false;
app.on('browser-window-created', (_e, win) => {
  if (started) return;
  started = true;
  win.webContents.on('console-message', (_ev, level, message) => { if (level >= 2) log.push(`[console ${level}] ${message}`); });
  win.webContents.once('did-finish-load', async () => {
    const js = code => win.webContents.executeJavaScript(code);
    const res = {};
    try {
      win.setSize(1600, 1000); await wait(2500);
      const tabs = ['day', 'overview', 'projects', 'people', 'orgs', 'gantt', 'kanban', 'tasks'];
      for (const id of tabs) {
        const ms = await js(`(async () => {
          const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
          const out = [];
          for (let k = 0; k < 6; k++) {
            const t0 = performance.now();
            document.querySelector('[data-act="tab"][data-id="${id}"]').click();
            await frame();
            out.push(performance.now() - t0);
            document.querySelector('[data-act="tab"][data-id="${id === 'day' ? 'overview' : 'day'}"]')?.click(); await frame();
          }
          out.shift(); out.sort((a, b) => a - b); return Math.round(out[2]);
        })()`);
        res[id] = ms;
        log.push(`${id.padEnd(9)} ${String(ms).padStart(5)} ms`);
      }
      // A write — how long until the window shows it (the save to disk goes on in the background).
      res.visible = await js(`(async () => {
        document.querySelector('[data-act="tab"][data-id="tasks"]').click(); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
        const app = document.getElementById('app'), id = document.querySelector('#app tr.row[data-id]')?.dataset.id;
        if (!id) return -1;
        const seen = new Promise(r => { const mo = new MutationObserver(() => { if (app.textContent.includes('(видно)')) { mo.disconnect(); r(); } }); mo.observe(app, { childList: true, subtree: true, characterData: true }); setTimeout(() => { mo.disconnect(); r(); }, 10000); });
        const t0 = performance.now();
        window.api.write([{ type: 'update', col: 'tasks', id, data: { title: 'Работа (видно)' } }], { action: 'perf' });
        await seen; return Math.round(performance.now() - t0); })()`);
      log.push(`visible   ${String(res.visible).padStart(5)} ms`);
      // A write — until the save finishes.
      res.write = await js(`(async () => { const t0 = performance.now(); await window.api.write([{ type: 'update', col: 'tasks', id: 't5', data: { title: 'Работа 5 (изм.)' } }], { action: 'perf' }); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); return Math.round(performance.now() - t0); })()`);
      log.push(`write     ${String(res.write).padStart(5)} ms`);
      // Where a write's time goes: the save itself, then reading the data back (each window does it on a change).
      res.getData = await js(`(async () => { const t0 = performance.now(); await window.api.getData(); return Math.round(performance.now() - t0); })()`);
      res.writeOnly = await js(`(async () => { const t0 = performance.now(); await window.api.write([{ type: 'update', col: 'tasks', id: 't6', data: { title: 'Работа 6 (изм.)' } }], { action: 'perf' }); return Math.round(performance.now() - t0); })()`);
      log.push(`getData   ${String(res.getData).padStart(5)} ms`, `writeOnly ${String(res.writeOnly).padStart(5)} ms`);
      // Where the time goes on the slowest tabs (own time of functions, 5 redraws each).
      for (const id of (process.env.PERF_PROFILE || '').split(',').filter(Boolean)) {
        const top = await win.webContents.profile(`(async () => { for (let k = 0; k < 5; k++) { document.querySelector('[data-act="tab"][data-id="${id === 'day' ? 'overview' : 'day'}"]').click(); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); document.querySelector('[data-act="tab"][data-id="${id}"]').click(); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); } })()`);
        log.push(`--- profile: ${id}`, ...top);
      }
      fs.writeFileSync(path.join(outDir, 'perf.json'), JSON.stringify(res, null, 2));
      fs.writeFileSync(path.join(outDir, 'perf.png'), (await win.webContents.capturePage()).toPNG());
    } catch (e) { log.push('[perf error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    console.log(log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

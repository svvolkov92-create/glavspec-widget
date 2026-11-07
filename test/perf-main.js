'use strict';
// Speed check on a large database: `electron test/perf-main.js <outDir> [tasks]` with XDG_CONFIG_HOME set to a temp dir.
// Generates projects, people and cards, then times every tab render, a card opening and a save.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-2);
const N = Number(process.argv.at(-1)) || 1500;
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });

// ---- deterministic data
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const marks = ['ЭОМ', 'ЭС', 'ЭО', 'ЭН', 'СС', 'СКС', 'АПС', 'СОУЭ', 'СОТ', 'СКУД', 'ВК', 'НВК', 'ОВ', 'ИТП'];
const data = { version: 1, projects: {}, contractors: {}, tasks: {}, users: {} };
data.users['u-gip'] = { name: 'ГИП', role: 'gip', directions: [] };
for (let i = 0; i < 6; i++) data.users['ch' + i] = { name: 'Главспец ' + i, role: 'chief', directions: [['el', 'ss'], ['vk', 'ov']][i % 2], canSeeBudget: i % 2 === 0 };
for (let i = 0; i < 30; i++) data.users['sp' + i] = { name: 'Специалист ' + i, role: 'specialist', directions: [['el', 'ss'], ['vk', 'ov']][i % 2], chiefId: 'ch' + (i % 6),
  absences: i % 5 ? [] : [{ id: 'a' + i, kind: 'vacation', from: day(5), to: day(18) }] };
for (let i = 0; i < 60; i++) data.projects['p' + i] = { name: `Объект ${i}`, code: `0${i}-26` };
for (let i = 0; i < 120; i++) data.contractors['c' + i] = { name: `Подрядчик ${i}`, specialty: pick(marks) + ', ' + pick(marks), phone: '+7 900 000-00-00' };
const statuses = ['not_started', 'in_progress', 'in_progress', 'review', 'revision', 'done', 'done', 'paused'];
for (let i = 0; i < N; i++) {
  const s = Math.floor(rnd() * 200) - 150, len = 10 + Math.floor(rnd() * 60);
  const st = pick(statuses), owner = 'sp' + (i % 30);
  data.tasks['t' + i] = {
    projectId: 'p' + (i % 60), sections: [pick(marks)], section: '', title: i % 3 ? '' : 'стадия Р', contractorId: i % 4 ? 'c' + (i % 120) : '',
    ownerId: owner, coOwnerIds: i % 10 ? [] : ['sp' + ((i + 1) % 30)], start: day(s), finish: day(s + len), status: st, budget: 50000 + (i % 20) * 10000,
    payments: i % 2 ? [{ id: 'x', date: day(s), amount: 15000 }] : [], plan: [{ id: 'pl', title: 'Аванс', pct: 30, trigger: 'start' }, { id: 'pl2', title: 'Расчёт', pct: 70, trigger: 'accepted' }],
    milestones: i % 3 ? [] : [{ id: 'm', title: 'КТ', date: day(s + 5), done: false }], dependsOn: i % 7 || i < 2 ? [] : ['t' + (i - 1)],
    history: [{ ts: new Date(Date.now() + s * 864e5).toISOString(), date: day(s), type: 'status', from: null, to: 'in_progress' },
      ...(st === 'review' || st === 'done' ? [{ ts: new Date(Date.now() + (s + len - 2) * 864e5).toISOString(), date: day(s + len - 2), type: 'status', from: 'in_progress', to: 'review', note: 'готово' }] : []),
      ...(st === 'done' ? [{ ts: new Date(Date.now() + (s + len) * 864e5).toISOString(), date: day(s + len), type: 'status', from: 'review', to: 'done' }] : [])],
    comments: i % 5 ? [] : [{ id: 'k', ts: new Date().toISOString(), userId: owner, user: 'Специалист', text: 'Вопрос по исходным' }],
    createdAt: new Date(Date.now() - 200 * 864e5).toISOString(),
  };
}
fs.writeFileSync(path.join(dataDir, 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ userId: 'u-gip', notify: false }));

const log = [];
app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message) => { if (level >= 2) log.push('[console] ' + message); });
  win.webContents.once('did-finish-load', async () => {
    const js = code => win.webContents.executeJavaScript(code);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    try {
      win.setSize(1400, 900);
      await wait(1500);
      log.push(`cards: ${N}, projects 60, people 37, contractors 120, file ${(fs.statSync(path.join(dataDir, 'data.json')).size / 1024).toFixed(0)} KB`);
      // time a tab: renderNow + layout (forced by reading offsetHeight), median of 3
      const timeTab = id => js(`(async () => {
        const runs = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          document.querySelector('[data-act="tab"][data-id="${id}"]').click();
          document.body.offsetHeight;
          runs.push(performance.now() - t0);
          await new Promise(r => setTimeout(r, 30));
        }
        runs.sort((a, b) => a - b);
        return Math.round(runs[1]);
      })()`);
      if (process.env.PROFILE) {
        const dbg = win.webContents.debugger; dbg.attach('1.3');
        await dbg.sendCommand('Profiler.enable'); await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 200 });
        await dbg.sendCommand('Profiler.start');
        for (const id of process.env.PROFILE.split(',')) { await timeTab(id); }
        if (process.env.PROFILE_SAVE) await js(`window.api.write({ type: 'update', col: 'tasks', id: 't5', data: { note: 'p' } })`), await wait(3000);
        const { profile } = await dbg.sendCommand('Profiler.stop');
        const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
        const dt = profile.timeDeltas; const counts = new Map();
        profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
        for (const [id, us] of counts) { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + us); }
        log.push('--- self time, ms ---', ...[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(6)}  ${k}`));
        fs.writeFileSync(path.join(outDir, 'perf.txt'), log.join('\n')); app.exit(0); return;
      }
      for (const id of ['overview', 'projects', 'people', 'team', 'gantt', 'kanban', 'tasks']) log.push(`tab ${id}: ${await timeTab(id)} ms`);
      const open = await js(`(() => { const t0 = performance.now(); document.querySelector('tr.row[data-id]').click(); return new Promise(r => setTimeout(() => { document.body.offsetHeight; r(Math.round(performance.now() - t0 - 260)); }, 300)); })()`);
      log.push(`open card (minus 260 ms double-click wait): ${open} ms`);
      await js(`document.querySelector('[data-act="request-close"]')?.click()`);
      const save = await js(`(async () => { const t0 = performance.now(); await window.api.write({ type: 'update', col: 'tasks', id: 't5', data: { note: 'x' + Date.now() } }); return Math.round(performance.now() - t0); })()`);
      log.push(`save one card (round trip to disk): ${save} ms`);
      const fullUpdate = await js(`(async () => { const t0 = performance.now(); await window.api.write({ type: 'update', col: 'tasks', id: 't6', data: { note: 'y' } }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t0); })()`);
      log.push(`save + screen refresh on «Все карточки»: ${fullUpdate} ms`);
      const typing = await js(`(async () => { const i = document.querySelector('#f-q'); const t0 = performance.now(); for (const ch of 'объект 1') { i.value += ch; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => requestAnimationFrame(r)); } return Math.round((performance.now() - t0) / 8); })()`);
      log.push(`search typing, per key: ${typing} ms`);
      const mem = await js(`Math.round(performance.memory.usedJSHeapSize / 1048576)`);
      log.push(`renderer heap: ${mem} MB`);
    } catch (e) { log.push('[error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'perf.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

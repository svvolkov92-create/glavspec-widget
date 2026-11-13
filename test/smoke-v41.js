'use strict';
// 4.1 (waves 1–2 of the backlog): delete button in «Тандем», project «Заказчик» and «ГИП», inter-section assignments
// switch in the Gantt and the Kanban, no-executor icon, Kanban sticky heads / drop anywhere / card view, and more.
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
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const page = async pid => { await click('[data-act="tab"][data-id="projects"]'); await wait(200); await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150); await click(`[data-act="project-page"][data-id="${pid}"]`); await wait(400); };
    const drag = (fromSel, toSel) => js(`(() => { const dt = new DataTransfer(); const a = document.querySelector(${JSON.stringify(fromSel)}), b = document.querySelector(${JSON.stringify(toSel)});
      a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(900);
      const openTask = async id => { await click('[data-act="tab"][data-id="tasks"]'); await wait(300); await click(`[data-act="open-task"][data-id="${id}"]`); await wait(500); };
      const alphaOf = sel => js(`(() => { const c = getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor; if (c === 'transparent') return 0; const m = c.match(/[0-9.]+/g) || []; return m.length > 3 ? Number(m[3]) : m.length ? 1 : c; })()`);


      await js(`window.api.write([{ type: 'set', col: 'tasks', id: 'v41-as', data: { projectId: 'demo-p1', kind: 'assign', parentId: 'demo-t1', sections: ['ЭОМ'], title: 'Нагрузки для ОВ', status: 'in_progress', start: '${new Date().toISOString().slice(0, 10)}', finish: '${new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10)}', contractorId: 'demo-c1', createdAt: new Date().toISOString() } }], { action: 'test' })`); await wait(500);

      await step('23: delete button readable in «Тандем»', async () => {
        await js(`window.api.setTheme('tandem')`); await wait(300);
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p2"]'); await wait(400);
        await click('[data-act="ask-delete"]'); await wait(200);
        const c = await js(`(() => { const b = document.querySelector('[data-act="do-delete"]'); const s = getComputedStyle(b); return s.backgroundColor + '|' + s.color + '|' + b.textContent; })()`);
        const [bg, fg, txt] = c.split('|');
        check('confirm button: red background, white text, «В корзину»', bg !== fg && /179, 38, 30/.test(bg) && txt.includes('В корзину'), c);
        await shot('41-01-delete');
        await click('[data-act="cancel-delete"]'); await wait(150);
      });

      await step('16: project «Заказчик» and «ГИП»', async () => {
        const has = await js(`!!document.querySelector('#pr-client') && !!document.querySelector('#pr-gip')`);
        check('two fields in the project card', has);
        const label = await js(`document.querySelector('label[for="pr-client"]').textContent`);
        check('label is «Заказчик»', label === 'Заказчик', label);
        await js(`(() => { const s = document.querySelector('#pr-gip'); s.value = 'u-gip'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await js(`document.querySelector('#dform button[type="submit"]').click()`); await wait(600);
        check('saved gipId', data().projects['demo-p2']?.gipId === 'u-gip', JSON.stringify(data().projects['demo-p2']?.gipId));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
      });

      await step('7, 8: Gantt — assignments hidden by default, no-executor icon', async () => {
        await click('[data-act="tab"][data-id="gantt"]'); await wait(400);
        check('assignment hidden', !(await js(`!!document.querySelector('[data-bar="v41-as"]')`)));
        await click('[data-act="show-assign"][data-v="gantt"]'); await wait(300);
        check('checkbox shows it', await js(`!!document.querySelector('[data-bar="v41-as"]')`));
        check('no-executor icon on a bar and in the legend', await js(`!!document.querySelector('.tl-bar.noexec .noexec-ic') && !!document.querySelector('.tl-legend .noexec-ic')`));
        await shot('41-02-gantt');
        await click('[data-act="show-assign"][data-v="gantt"]'); await wait(200);
      });

      await step('24–27: Kanban', async () => {
        await click('[data-act="tab"][data-id="kanban"]'); await wait(400);
        check('24: assignment hidden by default', !(await js(`!!document.querySelector('[data-kb-id="v41-as"]')`)));
        await click('[data-act="show-assign"][data-v="kanban"]'); await wait(300);
        check('24: checkbox shows it', await js(`!!document.querySelector('[data-kb-id="v41-as"]')`));
        check('24: remembered', JSON.parse(await js(`localStorage.getItem('glavspec.showAssign')`)).kanban === true);
        const sticky = await js(`getComputedStyle(document.querySelector('#kb-board .kb-col-h')).position`);
        check('25: column heads sticky', sticky === 'sticky', sticky);
        const full = await js(`(() => { const b = document.querySelector('#kb-board'); return [...b.querySelectorAll('.kb-col')].every(c => Math.abs(c.offsetHeight - b.clientHeight) < 4 || c.offsetHeight > b.clientHeight); })()`);
        check('26: every column is full height', full);
        // drop on the empty bottom part of «На проверке»
        const moved = await js(`(() => { const col = document.querySelector('#kb-board [data-kb-col="review"]'); const r = col.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.bottom - 12); return !!el && el.closest('[data-kb-col]') === col; })()`);
        check('26: the empty bottom of a column is a drop target', moved);
        await js(`document.querySelector('.kb-view').open = true`); await wait(100);
        await click('[data-act="kb-show-all"][data-v="0"]'); await wait(300);
        check('27: compact — no project, executor, dates', !(await js(`!!document.querySelector('#kb-board .kb-proj, #kb-board .kb-who, #kb-board .kb-foot')`)));
        check('27: menu stays open', await js(`document.querySelector('.kb-view').open`));
        await shot('41-03-kanban-compact');
        await click('[data-act="kb-show-all"][data-v="1"]'); await wait(300);
        check('27: full again', await js(`!!document.querySelector('#kb-board .kb-proj')`));
        await shot('41-04-kanban');
      });

      await step('18: solid controls at 45 % transparency', async () => {
        await js(`window.api.setTheme('tandem')`); await wait(200);
        await click('#btn-view'); await wait(150); await setVal('#alpha', '45'); await wait(200); await click('#btn-view'); await wait(150);
        await click('[data-act="tab"][data-id="people"]'); await wait(400);
        const a = {};
        for (const [k, sel] of [['user', '#btn-user'], ['att', '.att-btn'], ['create', '#btn-create'], ['fab', '.msg-fab'], ['btn', 'main .btn:not(.ghostbtn):not(.primary):not(.on)']]) a[k] = await alphaOf(sel);
        check('user chip, «Требует внимания», buttons, «Сообщения» solid', Object.values(a).every(v => v > 0.95), JSON.stringify(a));
        check('active tab solid', (await alphaOf('.tab[aria-selected="true"]')) > 0.95);
        await shot('41-05-transparency');
        await click('#btn-view'); await wait(150); await setVal('#alpha', '82'); await wait(150); await click('#btn-view'); await wait(150);
      });

      await step('40: right-click menu on a card', async () => {
        await click('[data-act="tab"][data-id="kanban"]'); await wait(400);
        const ctx = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 10 })); })()`);
        await ctx('[data-kb-id="demo-t9"]'); await wait(200);
        const items = await js(`[...document.querySelectorAll('#card-menu button')].map(b => b.dataset.act + (b.dataset.q ? ':' + b.dataset.q : '')).join()`);
        check('menu with open, start, +1 day, executor, chat, copy', ['open-task', 'cm-quick:start', 'cm-plus1', 'cm-assign', 'cm-copy'].every(a => items.includes(a)), items);
        await shot('41-06-card-menu');
        await click('#card-menu [data-act="cm-quick"][data-q="start"]'); await wait(600);
        check('«Начать работу» from the menu: in progress', data().tasks['demo-t9'].status === 'in_progress', data().tasks['demo-t9'].status);
        check('… and the focus timer runs', await js(`!!document.querySelector('#focus-bar') && /demo-t9/.test(localStorage.getItem('glavspec.focus') || '')`));
        await shot('41-07-focus');
        await js(`location.reload()`); await wait(2500);
        check('focus survives a restart', await js(`!!document.querySelector('#focus-bar')`));
        await wait(59000); // a stretch shorter than a minute is not written
        await click('#focus-bar [data-act="focus-stop"]'); await wait(600);
        const tl = data().tasks['demo-t9'].timeLog || [];
        const min = tl.length ? Math.round((Date.parse(tl[0].to) - Date.parse(tl[0].from)) / 60000) : 0;
        check('the minute is written to the card', tl.length === 1 && min >= 1 && min <= 2 && tl[0].userId === 'u-gip', JSON.stringify(tl));
        check('bar gone', !(await js(`!!document.querySelector('#focus-bar')`)));
        await ctx('[data-kb-id="demo-t9"]'); await wait(200);
        await js(`document.addEventListener('keydown', () => {}, { once: true })`);
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await wait(100);
        check('Esc closes the menu', !(await js(`!!document.querySelector('#card-menu')`)));
      });

      await step('43: density «Компактно»', async () => {
        const before = await js(`parseFloat(getComputedStyle(document.querySelector('#shell')).fontSize)`);
        await click('#btn-view'); await wait(150); await click('[data-act="set-dense"][data-v="1"]'); await wait(200);
        const after = await js(`parseFloat(getComputedStyle(document.querySelector('#shell')).fontSize)`);
        const label = await js(`[...document.querySelectorAll('[data-act="set-dense"]')].map(b => b.textContent).join('/')`);
        check('«Удобно / Компактно», smaller type', label === 'Удобно/Компактно' && after < before, `${label} ${before}→${after}`);
        await js(`if (!document.querySelector('#view-menu').hidden) document.querySelector('#btn-view').click()`); await wait(150);
        await shot('41-08-compact');
        await click('#btn-view'); await wait(150); await click('[data-act="set-dense"][data-v="0"]'); await wait(150);
        await js(`if (!document.querySelector('#view-menu').hidden) document.querySelector('#btn-view').click()`);
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

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


      await step('4.1.1: «Начать» in the card, «Вид карточек» visible, endless columns', async () => {
        // 4.1-3: the start button in an opened card (readiness 0 % of a not-started card used to stop the save)
        const ns = Object.entries(data().tasks).find(([, t]) => t.status === 'not_started' && !t.deletedAt)?.[0];
        await openTask(ns); await wait(300);
        await click('[data-act="quick"][data-q="start"]'); await wait(700);
        check('4.1-3: «Начать работу» in the card → in progress, readiness 1 %', data().tasks[ns].status === 'in_progress' && data().tasks[ns].readiness === 1, JSON.stringify({ s: data().tasks[ns].status, r: data().tasks[ns].readiness }));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        // 45: a stopped save speaks — toast, field highlighted
        await openTask(ns); await wait(300);
        await js(`(() => { const a = document.querySelector('#dform [name="start"]'), b = document.querySelector('#dform [name="finish"]'); a.value = '2027-01-10'; b.value = '2027-01-01'; })()`);
        await js(`document.querySelector('#dform button[type="submit"]').click()`); await wait(400);
        const said = await js(`({ toast: document.querySelector('#toast')?.textContent || '', bad: !!document.querySelector('#dform .field-bad') })`);
        check('45: stopped save — toast and the field highlighted', /Финиш не может быть раньше/.test(said.toast) && said.bad, JSON.stringify(said));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        // 4.1-1: the menu is really on screen, not clipped by the filter row
        await click('[data-act="tab"][data-id="kanban"]'); await wait(400);
        await click('.kb-view > summary'); await wait(250);
        const seen = await js(`(() => { const m = document.querySelector('.kb-view-m'); const r = m.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 20, r.top + 15); return r.height > 60 && m.contains(e); })()`);
        check('4.1-1: «Вид карточек» list is visible on screen', seen);
        await shot('41-14-view-menu');
        await js(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`); await wait(100);
        check('4.1-1: a click outside closes it', !(await js(`document.querySelector('.kb-view').open`)));
        // 4.1-2: many cards — the board does not scroll by itself, the page does, heads stay on top
        const ops = Array.from({ length: 30 }, (_, i) => ({ type: 'set', col: 'tasks', id: 'v411-' + i, data: { projectId: 'demo-p1', sections: ['ОВ'], status: 'not_started', start: '2026-12-01', finish: '2026-12-20', ownerId: 'u-gip', createdAt: new Date().toISOString() } }));
        await js(`window.api.write(${JSON.stringify(ops)}, { action: 'test' })`); await wait(700);
        const geo = await js(`(() => { const kb = document.querySelector('#kb-board'), m = document.querySelector('main'); m.scrollTop = 900; const h = kb.querySelector('[data-kb-col="not_started"] .kb-col-h').getBoundingClientRect(); return { own: kb.scrollHeight - kb.clientHeight, page: m.scrollTop, headTop: Math.round(h.top), mainTop: Math.round(m.getBoundingClientRect().top) }; })()`);
        check('4.1-2: the board has no own scroll, the page scrolls', geo.own <= 2 && geo.page > 300, JSON.stringify(geo));
        check('4.1-2: column heads stay at the top of the window', Math.abs(geo.headTop - geo.mainTop) <= 4, JSON.stringify(geo));
        await shot('41-15-kanban-scrolled');
        await js(`window.api.write(${JSON.stringify(ops.map(o => ({ type: 'delete', col: 'tasks', id: o.id })))}, { action: 'test' })`); await wait(400);
        await js(`document.querySelector('main').scrollTop = 0`);
      });


      await step('48, 49: «Мой день» and the review queue', async () => {
        await click('[data-act="tab"][data-id="day"]'); await wait(400);
        check('48: «Мой день» first tab, KPIs and lists', (await js(`document.querySelector('.tabs [data-act="tab"]')?.dataset.id`)) === 'day' && await js(`document.querySelectorAll('.day-kpi').length === 4 && !!document.querySelector('.day-list')`));
        await shot('41-16-my-day');
        const before = await js(`(() => { const a = []; for (const t of window.AppBridge.state.tasks.values()) if (t.status === 'review') a.push(t); return a.map(t => t.id); })()`);
        if (!before.length) { log.push('info: no review cards in demo'); return; }
        await click('.day [data-act="review-queue"]'); await wait(300);
        check('49: queue opens with «1 из N»', /1 из/.test(await text('#rq-root')));
        await shot('41-17-review-queue');
        const st = () => before.map(id => data().tasks[id]?.status);
        await click('#rq-root [data-rq="remarks"]'); await wait(200);
        check('49: return without remarks is refused with a message', st().every(x => x === 'review') && /без замечаний/.test(await text('#toast')), st().join());
        await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))`); await wait(700);
        check('49: A accepts one and moves on', st().filter(x => x === 'done').length === 1, st().join());
        if (before.length > 1) {
          await setVal('#rq-note', 'Нет розеток в кабинете 214'); await click('#rq-root [data-rq="remarks"]'); await wait(700);
          const back = before.map(id => data().tasks[id]).find(t => t.status === 'revision');
          check('49: the next one returned with the remark', !!back && (back.history || []).some(h => h.note === 'Нет розеток в кабинете 214'), st().join());
        }
        await js(`document.querySelector('#rq-root [data-rq="close"]')?.click()`); await wait(200);
      });


      await step('58, 57: critical path and the effect of a move', async () => {
        const D = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
        const proj = { type: 'set', col: 'projects', id: 'cp-p', data: { name: 'Котельная КП', code: 'КП-1', status: 'p_work', phases: [{ key: 'r', start: D(0), finish: D(27) }], createdAt: new Date().toISOString() } };
        const mk = (id, sec, a, b, deps) => ({ type: 'set', col: 'tasks', id, data: { projectId: 'cp-p', sections: [sec], status: 'in_progress', readiness: 10, start: D(a), finish: D(b), dependsOn: deps, ownerId: 'u-gip', contractorId: 'demo-c1', createdAt: new Date().toISOString() } });
        await js(`window.api.write(${JSON.stringify([proj, mk('cp-kr', 'КР', 0, 10, []), mk('cp-ov', 'ОВ', 11, 14, ['cp-kr']), mk('cp-eom', 'ЭОМ', 11, 20, ['cp-kr']), mk('cp-pos', 'ПОС', 21, 25, ['cp-eom'])])}, { action: 'test' })`); await wait(500);
        await click('[data-act="tab"][data-id="gantt"]'); await wait(300);
        await js(`(() => { const s = document.querySelector('#gq-project'); s.value = 'cp-p'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(300);
        await click('[data-act="g-crit"]'); await wait(300);
        const crit = await js(`['cp-kr', 'cp-eom', 'cp-pos', 'cp-ov'].map(id => document.querySelector('.tl-bar[data-bar="' + id + '"]')?.classList.contains('crit')).join()`);
        check('58: КР → ЭОМ → ПОС critical, ОВ not', crit === 'true,true,true,false', crit);
        check('58: ОВ shows its float', /запас 11 дн/.test(await text('.tl-bar[data-bar="cp-ov"]')), await text('.tl-bar[data-bar="cp-ov"]'));
        const sum = await js(`document.querySelector('.cp-sum')?.textContent || ''`);
        check('58: «сдача … · договор … · запас 2 дн.»', /сдача .* договор .* запас 2 дн/.test(sum), sum);
        await shot('41-18-critical-path');
        // drag КР by +4 days: the pointer moves ~4 day widths
        const geo = await js(`(() => { const b = document.querySelector('.tl-bar[data-bar="cp-kr"]').getBoundingClientRect(); const tr = document.querySelector('#gantt [data-gantt-track]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, day: tr.width / window.AppBridge.state.gantt.days }; })()`);
        const ev = (type, x) => js(`document.querySelector('.tl-bar[data-bar="cp-kr"]').dispatchEvent(new PointerEvent('${type}', { bubbles: true, clientX: ${x}, clientY: ${geo.y}, button: 0 }))`);
        await ev('pointerdown', geo.x); await ev('pointermove', geo.x + 10); await ev('pointermove', geo.x + geo.day * 4.2); await wait(150);
        const prev = await js(`({ ghosts: document.querySelectorAll('#gantt .tl-ghost').length, hint: document.querySelector('#drag-hint')?.textContent || '' })`);
        check('57: ghosts of the cards that move and the hint', prev.ghosts >= 3 && /сдвинутся ещё 3/.test(prev.hint) && /сдача проекта/.test(prev.hint) && /позже договора на 2 дн/.test(prev.hint), JSON.stringify(prev));
        await shot('41-19-move-preview');
        await js(`document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))`); await wait(300);
        check('57: the reason window offers to move the waiting cards', await js(`!!document.querySelector('#m-follow')?.checked`));
        await js(`(() => { const s = document.querySelector('#m-reason'); s.value = s.options[1].value; document.querySelector('#m-reason').closest('form').requestSubmit(); })()`); await wait(700);
        const t = data().tasks;
        check('57: КР +4, ЭОМ, ОВ and ПОС moved after it', t['cp-kr'].finish === D(14) && t['cp-eom'].start === D(15) && t['cp-eom'].finish === D(24) && t['cp-pos'].start === D(25) && t['cp-ov'].start === D(15), JSON.stringify(['cp-kr', 'cp-ov', 'cp-eom', 'cp-pos'].map(id => t[id].start + '…' + t[id].finish)));
        check('57: the reason is in the followers’ history', (t['cp-pos'].history || []).some(h => h.type === 'finish' && /вслед за/.test(h.note || '')));
        await click('[data-act="g-crit"]'); await wait(200);
        await js(`(() => { const s = document.querySelector('#gq-project'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(200);
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
        const moved = await js(`(() => { const col = document.querySelector('#kb-board [data-kb-col="review"]'); const r = col.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.bottom, innerHeight - 140) - 12); return !!el && el.closest('[data-kb-col]') === col; })()`);
        check('26: the empty bottom of a column is a drop target', moved);
        await click('.kb-view > summary'); await wait(150);
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

      await step('28: «Кто делает» — executor by surname, co-executor, old co-owners carried over', async () => {
        // demo-t2 had a staff co-owner before 4.1 — it must show up as the co-executor next to the contractor
        const before = data().tasks['demo-t2'];
        await openTask('demo-t2');
        check('three fields, no co-owner grid', await js(`!!document.querySelector('#t-owner') && !!document.querySelector('#t-exec-q') && !!document.querySelector('#t-coexec-q') && !document.querySelector('#co-box')`));
        const exec = await js(`document.querySelector('#t-exec-q').value`), co = await js(`document.querySelector('#t-coexec-q').value`);
        check('executor = the contractor', exec === data().contractors[before.contractorId]?.name, exec);
        log.push(`info: co-owners before ${JSON.stringify(before.coOwnerIds || [])}, co-executor field «${co}»`);
        if ((before.coOwnerIds || []).filter(id => id !== before.ownerId).length) check('old co-owner → co-executor', co === data().users[(before.coOwnerIds || []).filter(id => id !== before.ownerId)[0]].name, co);
        // type a surname: staff and contractors are both offered; uncheck «only fitting»
        await js(`(() => { const c = document.querySelector('#exec-fit'); if (c.checked) c.click(); })()`); await wait(100);
        await js(`(() => { const q = document.querySelector('#t-coexec-q'); q.focus(); q.value = 'Белов'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        const opts = await js(`[...document.querySelectorAll('#t-coexec-list .ep-opt')].map(o => o.dataset.ref).join()`);
        check('typing «Белов» finds the staff member', /u:demo-u2/.test(opts) && !/c:/.test(opts), opts);
        await js(`document.querySelector('#t-coexec-q').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(150);
        await shot('41-09-who');
        check('misfit co-executor needs «Всё равно назначить»', await js(`!document.querySelector('#owner-warn').hidden`));
        await js(`document.querySelector('#t-profile-ok').click()`);
        await js(`document.querySelector('#dform button[type="submit"]').click()`); await wait(700);
        const after = data().tasks['demo-t2'];
        check('saved: contractor stays, co-executor u:demo-u2, in coOwnerIds', after.contractorId === before.contractorId && after.coExecRef === 'u:demo-u2' && after.coOwnerIds.includes('demo-u2') && after.execUserId === '', JSON.stringify({ c: after.contractorId, co: after.coExecRef, ids: after.coOwnerIds, x: after.execUserId }));
        // a staff executor instead of a contractor
        await openTask('demo-t9');
        await js(`(() => { const q = document.querySelector('#t-exec-q'); q.focus(); q.value = 'Зайцев'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(150);
        await js(`document.querySelector('#t-exec-list .ep-opt')?.click()`); await wait(150);
        await js(`(() => { const c = document.querySelector('#t-profile-ok'); if (c && !c.checked && !document.querySelector('#owner-warn').hidden) c.click(); })()`);
        await js(`document.querySelector('#dform button[type="submit"]').click()`); await wait(700);
        const t9 = data().tasks['demo-t9'];
        check('staff executor saved', t9.execUserId === 'demo-u3' && !t9.contractorId && t9.coOwnerIds.includes('demo-u3'), JSON.stringify({ x: t9.execUserId, c: t9.contractorId, ids: t9.coOwnerIds, err: '' }));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await click('[data-act="tab"][data-id="kanban"]'); await wait(300);
        check('Kanban: no «нет исполнителя» on the card with a staff executor', !(await js(`document.querySelector('[data-kb-id="demo-t9"]').classList.contains('noexec')`)));
        check('filter «Исполнитель» lists staff', await js(`!!document.querySelector('#kb-contractor option[value="u:demo-u3"]')`));
      });

      await step('2, 9, 19: phases and documents', async () => {
        await click('[data-act="tab"][data-id="projects"]'); await wait(300);
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p1"]'); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(400);
        const setPd = (path, v) => js(`(() => { const i = document.querySelector('[data-pd="${path}"]'); if (i.type === 'checkbox') i.checked = ${JSON.stringify(v)}; else i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        const pv = path => js(`document.querySelector('[data-pd="${path}"]').value`);
        const idx = k => js(`window.AppBridge.state.draft.phases.findIndex(x => x.key === '${k}')`);
        const iP = await idx('p'), iE = await idx('expertise');
        await setPd(`phases.${iP}.start`, '2027-01-11'); await wait(150);
        await setPd(`phases.${iP}.days`, '60'); await wait(200);
        check('2: 60 days → finish', (await pv(`phases.${iP}.finish`)) === '2027-03-11', await pv(`phases.${iP}.finish`));
        await setPd(`phases.${iE}.chain`, true); await wait(200);
        await setPd(`phases.${iE}.days`, '45'); await wait(200);
        check('2: «сразу после предыдущего» → expertise starts the next day', (await pv(`phases.${iE}.start`)) === '2027-03-12' && (await pv(`phases.${iE}.finish`)) === '2027-04-25', `${await pv(`phases.${iE}.start`)} ${await pv(`phases.${iE}.finish`)}`);
        check('2: mini-Gantt of phases', await js(`document.querySelectorAll('#cust-box .ph-g .ph-bar').length >= 2`));
        // 19: documents — ГПЗУ from the date of issue
        await click('[data-act="pd-add"][data-list="docs"]'); await wait(200);
        const n = await js(`window.AppBridge.state.draft.docs.length - 1`);
        await setPd(`docs.${n}.title`, 'ГПЗУ № RU27303000-0042'); await setPd(`docs.${n}.kind`, 'gpzu'); await setPd(`docs.${n}.no`, 'RU27303000-0042'); await setPd(`docs.${n}.issued`, '2026-02-10'); await wait(250);
        check('19: ГПЗУ valid 3 years', (await pv(`docs.${n}.until`)) === '2029-02-09', await pv(`docs.${n}.until`));
        await shot('41-10-phases-docs');
        await js(`document.querySelector('#dform button[type="submit"]').click()`); await wait(800);
        const p1 = data().projects['demo-p1'];
        const doc = p1.docs.find(x => x.no === 'RU27303000-0042');
        check('saved: phases with chain, document with kind, №, date of issue', p1.phases.find(x => x.key === 'expertise').chain === true && doc?.kind === 'gpzu' && doc.issued === '2026-02-10' && doc.until === '2029-02-09', JSON.stringify(doc));
        // 9: «Сроки» shows the same phases
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await page('demo-p1'); await wait(300);
        await click('[data-act="project-timeline"]'); await wait(400);
        const tq = await js(`(() => { const i = window.AppBridge.state.projects.get('demo-p1').phases.findIndex(x => x.key === 'p'); return document.querySelector('[data-ph="' + i + '.finish"]')?.value; })()`);
        check('9: «Сроки» shows the same dates', tq === '2027-03-11', tq);
        await shot('41-11-timeline');
        await js(`document.querySelector('.tq-modal [data-m="cancel"]').click()`); await wait(200);
      });

      await step('30: org structure; 17: who sees whom in «Люди»', async () => {
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        await click('[data-act="people-mode"][data-v="org"]'); await wait(300);
        check('virtual tree by roles', await js(`document.querySelectorAll('.org-card').length >= 3 && /ПМ «Тандем»/.test(document.querySelector('.org-tree').textContent)`));
        await click('[data-act="org-from-groups"]'); await wait(600);
        const depts = Object.values(data().depts || {});
        check('«Создать отделы из групп»: departments stored, people placed', depts.length >= 3 && data().users['demo-u3'].deptId && depts.some(d => d.headId === 'demo-u2'), JSON.stringify(depts.map(d => d.name)));
        await js(`document.querySelectorAll('[data-act="org-people"]')[1]?.click()`); await wait(200);
        await shot('41-12-org');
        // add a sub-department under the first department
        await js(`document.querySelectorAll('.org-card [data-act="org-add"]')[1].click()`); await wait(200);
        await setVal('#org-name', 'Сектор ВК'); await js(`(() => { const s = document.querySelector('#org-head'); s.value = 'demo-u3'; })()`);
        await js(`document.querySelector('.org-modal').requestSubmit()`); await wait(600);
        const sec = Object.values(data().depts).find(d => d.name === 'Сектор ВК');
        check('sub-department with a head', !!sec && sec.parentId && sec.headId === 'demo-u3' && data().users['demo-u3'].deptId === Object.keys(data().depts).find(k => data().depts[k] === sec || data().depts[k].name === 'Сектор ВК'), JSON.stringify(sec));
        // the specialist: «Люди» visible, staff only, the org structure with «Ваш отдел»
        await js(`window.api.switchUser('demo-u3')`); await wait(700);
        check('specialist sees «Люди»', await js(`!!document.querySelector('[data-act="tab"][data-id="people"]')`));
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        await click('[data-act="people-mode"][data-v="org"]'); await wait(300);
        check('… «Ваш отдел» marked, no editing', await js(`!!document.querySelector('.org-card.mine') && !document.querySelector('[data-act="org-add"], [data-act="org-edit"]')`));
        await click('[data-act="people-mode"][data-v="cards"]'); await wait(300);
        check('… staff, no outside people', !(await js(`/Подрядчики/.test(document.querySelector('main').textContent)`)) && (await js(`document.querySelectorAll('.cards .card').length`)) >= 3);
        await shot('41-13-specialist-people');
        await js(`window.api.switchUser('demo-u2')`); await wait(700);
        await click('[data-act="tab"][data-id="people"]'); await wait(300);
        const chiefSees = await js(`[...document.querySelectorAll('[data-drop^="contractor:"]')].map(e => e.dataset.drop.slice(11)).join()`);
        const mineC = new Set(Object.values(data().tasks).filter(t => ['demo-u2', 'demo-u3'].some(u => t.ownerId === u || (t.coOwnerIds || []).includes(u))).map(t => t.contractorId).filter(Boolean));
        check('chief: all staff, own outside people only', (await js(`document.querySelectorAll('.cards .card').length`)) >= 3 && chiefSees.split(',').filter(Boolean).every(id => mineC.has(id)), `${chiefSees} / ${[...mineC]}`);
        await js(`window.api.switchUser('u-gip')`); await wait(700);
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

// 4.23 — Пульт on a phone (item 64): the web version at 390 px has its own screens. Against a real server:
// Мой день, the review queue (accept, return only with a remark), the board, a project with its critical path and a
// moved deadline, «Ещё», the switch to the full version and back. Screenshots go to <tmp>/phone-*.png.
// Run: node test/phone-check.js (Playwright Chromium).
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const root = path.resolve(__dirname, '..');
const { createServer } = require(path.join(root, 'server/pult-server.js'));
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pult-phone-'));
  const app = createServer({ dataDir: dir, host: '127.0.0.1', configFile: dir + '/none.json', publicUrl: 'http://127.0.0.1:8794' });
  await new Promise(r => app.server.listen(8794, '127.0.0.1', r));
  const B = 'http://127.0.0.1:8794';
  const post = async (p, b, t) => (await fetch(B + p, { method: 'POST', headers: { 'X-Pult-Protocol': '2', 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) })).json();
  const now = new Date().toISOString(), day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const H = (to, d = -1, note = '') => [{ ts: now, date: day(d), type: 'status', from: 'in_progress', to, note }];
  const data = {
    users: { g: { name: 'Волков Сергей Вадимович', role: 'gip', createdAt: now }, c: { name: 'Орлов Дмитрий', role: 'chief', directions: ['kr'], position: 'Гл. конструктор', createdAt: now },
      s1: { name: 'Смирнова Ольга', role: 'specialist', directions: ['ar'], chiefId: 'c', createdAt: now }, s2: { name: 'Кузнецова Наталья', role: 'specialist', directions: ['ov'], chiefId: 'c', createdAt: now } },
    projects: { p1: { name: 'Цех металлоконструкций', code: '25-047', gipId: 'g', members: ['c', 's1'],
      phases: [{ key: 'p', start: day(-60), finish: day(-10) }, { key: 'expertise', start: day(-9), finish: day(9) }, { key: 'r', start: day(10), finish: day(60) }],
      ird: [{ id: 'i1', title: 'ТУ на водоснабжение', who: 'заказчик', due: day(2), status: 'need' }, { id: 'i2', title: 'ГПЗУ', status: 'accepted' }],
      expertise: { org: 'ГАУ «Экспертиза»', cycles: [{ id: 'c1', no: '1', date: day(-5), remarks: [{ id: 'r1', n: '14.3', mark: 'КР', text: 'Не учтена снеговая нагрузка', ownerId: 'g', due: day(1), status: 'work' }] }] },
      letters: [{ id: 'l1', dir: 'in', seq: 12, date: day(-2), corr: 'Водоканал', subject: 'О технических условиях', status: 'answer', due: day(3), files: [] }] },
      p2: { name: 'Склад готовой продукции', code: '25-051', gipId: 'g', members: [] } },
    tasks: {
      t1: { projectId: 'p1', sections: ['КР'], section: 'КР', title: 'Расчёт рам Р-1…Р-6', ownerId: 'c', status: 'review', start: day(-20), finish: day(-1), history: H('review', -1, 'Все рамы посчитаны, лист 5 изм. 1') },
      t2: { projectId: 'p1', sections: ['КР'], section: 'КР', title: 'Ответ на замечания экспертизы', ownerId: 'c', status: 'in_progress', start: day(-5), finish: day(-1), dependsOn: ['t1'] },
      t3: { projectId: 'p1', sections: ['АР'], section: 'АР', title: 'Планы этажей АБК', ownerId: 's1', status: 'review', start: day(-10), finish: day(2), history: H('review', 0) },
      t4: { projectId: 'p1', sections: ['ПОС'], section: 'ПОС', title: 'Стройгенплан', ownerId: 'g', status: 'not_started', start: day(0), finish: day(4), dependsOn: ['t2'] },
      t5: { projectId: 'p2', sections: ['ОВ'], section: 'ОВ', title: 'Воздушно-тепловые завесы', status: 'not_started', start: day(1), finish: day(14) },
      t6: { projectId: 'p2', sections: ['АР'], section: 'АР', title: 'Фасады, изм. 2', ownerId: 's1', status: 'done', start: day(-30), finish: day(-12) },
    },
    contractors: {}, chats: {}, depts: {} };
  const gip = (await post('/api/setup', { code: app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'g', data })).token;
  const b = await chromium.launch();
  const out = [];
  const check = (n, ok, x = '') => out.push(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = n => p.screenshot({ path: path.join(os.tmpdir(), `phone-${n}.png`) });
  const tap = async sel => { await p.click(sel); await p.waitForTimeout(450); };
  const text = sel => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
  try {
    await p.goto(B + '/app/'); await p.waitForTimeout(1000);
    await p.evaluate(() => localStorage.setItem('glavspec.tourOff', '1'));
    await p.fill('#web-login input[name="login"]', 'volkov'); await p.fill('#web-login input[name="password"]', 'secret123');
    await p.click('#web-login button[type="submit"]'); await p.waitForTimeout(2500);

    check('phone screens instead of the desktop', await p.evaluate(() => document.documentElement.classList.contains('phone') && !!document.querySelector('#phone .ph-nav') && getComputedStyle(document.getElementById('shell')).display === 'none'));
    const dayTxt = await text('#phone .ph-body');
    check('Мой день: greeting, 2 on review, overdue, «Сначала это» with the remark and the source data', dayTxt.includes('Сергей Вадимович') && /2\s*на проверке/i.test(dayTxt) && dayTxt.includes('Замечание экспертизы 14.3') && dayTxt.includes('Ответ на замечания экспертизы'), dayTxt.replace(/\s+/g, ' ').slice(0, 300));
    check('free people to give work to', dayTxt.includes('Кузнецова'));
    await shot('day');

    await tap('.ph-kpi.o');
    check('review queue: one card, 1 of 2', (await text('.ph-hdr .tt')).includes('1 из 2') && (await text('.ph-body')).includes('Все рамы посчитаны'));
    await shot('review');
    await tap('[data-act="ph-rq"][data-v="back"]');
    check('returning without a remark is refused', app.store.data.tasks.t1.status === 'review' && await p.evaluate(() => document.querySelector('#ph-rq-note').classList.contains('field-bad')));
    await p.fill('#ph-rq-note', 'Р-4: не учтена снеговая нагрузка'); await tap('[data-act="ph-rq"][data-v="back"]'); await p.waitForTimeout(900);
    check('returned with the remark', app.store.data.tasks.t1.status === 'revision' && app.store.data.tasks.t1.history.at(-1).note === 'Р-4: не учтена снеговая нагрузка');
    await tap('[data-act="ph-rq"][data-v="ok"]'); await p.waitForTimeout(900);
    check('accepted; the queue is empty', app.store.data.tasks.t3.status === 'done' && (await text('.ph-body')).includes('Очередь пуста'));

    await tap('.ph-nav [data-v="cards"]');
    const cols = await p.evaluate(() => [...document.querySelectorAll('.ph-col .ch span:first-child')].map(e => e.textContent).join('|'));
    check('board: four columns, cards in them', cols === 'Очередь|В работе|На проверке|Готово' && await p.evaluate(() => document.querySelectorAll('.ph-kc').length) >= 5, cols);
    check('a critical card is marked', await p.evaluate(() => !!document.querySelector('.ph-kc.cp')));
    await shot('cards');
    await tap('.ph-chips [data-id="p2"]');
    check('filter by project', !(await text('#ph-kb')).includes('Цех металлоконструкций') && (await text('#ph-kb')).includes('Склад'));
    await tap('.ph-kc');
    check('a card opens the card form', await p.evaluate(() => !!document.querySelector('.drawer')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('[data-act="discard"]')?.click()); await p.waitForTimeout(300);

    await tap('.ph-nav [data-v="projs"]');
    check('portfolio: both projects, a phase bar', (await text('.ph-body')).includes('Склад готовой продукции') && await p.evaluate(() => !!document.querySelector('.ph-tl i.cur')));
    await shot('projs');
    await tap('.ph-lane[data-id="p1"]');
    const pj = await text('.ph-body');
    check('project: critical path, source data, the letter waiting for an answer', pj.includes('Критический путь') && pj.includes('ТУ на водоснабжение') && pj.includes('Вх. 12') && pj.includes('ИРД получено'), pj.replace(/\s+/g, ' ').slice(0, 300));
    await shot('proj');
    await tap('[data-act="ph-shift"]');
    await p.selectOption('#phs-task', 't2'); await p.fill('#phs-date', new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)); await p.dispatchEvent('#phs-date', 'input'); await p.waitForTimeout(200);
    check('moving a deadline shows what moves with it', (await text('#phs-eff')).includes('сдвинутся ещё 1'), await text('#phs-eff'));
    await shot('shift');
    await tap('.ph-sheet button[type="submit"]');
    await p.selectOption('#m-reason', { index: 1 }); await tap('.modal button[type="submit"]'); await p.waitForTimeout(900);
    check('the deadline and the follower moved', app.store.data.tasks.t2.finish === day(2) && app.store.data.tasks.t4.start > day(2), JSON.stringify({ t2: app.store.data.tasks.t2.finish, t4: app.store.data.tasks.t4.start }));

    await tap('.ph-nav [data-v="more"]');
    check('«Ещё»: letters with one waiting', (await text('.ph-body')).includes('1 ждут ответа'));
    await tap('[data-act="ph-go"][data-v="people"]');
    check('people with their state', (await text('.ph-body')).includes('Кузнецова Наталья'));
    await tap('.ph-nav [data-v="msgs"]');
    check('«Сообщения» opens the messenger over the whole screen', await p.evaluate(() => !!document.querySelector('#msg-root .msg-panel.full')));
    await shot('msgs');
    await p.evaluate(() => document.querySelector('#msg-root [data-act="msg-close"], #msg-root .mp-x')?.click()); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'ph-full'; document.body.append(b); b.click(); b.remove(); }); await p.waitForTimeout(500);
    check('«Полная версия» shows the desktop screens', await p.evaluate(() => !document.documentElement.classList.contains('phone') && !document.getElementById('phone') && getComputedStyle(document.getElementById('shell')).display !== 'none'));
    await p.reload(); await p.waitForTimeout(2000);
    check('the choice is remembered', await p.evaluate(() => !document.documentElement.classList.contains('phone')));
    await p.evaluate(() => document.querySelector('[data-act="user-menu"]').click()); await p.waitForTimeout(300);
    await tap('#user-menu [data-act="ph-phone"]');
    check('«Версия для телефона» brings the phone screens back', await p.evaluate(() => document.documentElement.classList.contains('phone')));
    check('no page errors', errs.length === 0, errs.join(' | ').slice(0, 400));
  } catch (e) { check('phone check ran', false, e.stack); }
  console.log(out.join('\n')); process.exitCode = out.some(l => l.startsWith('FAIL')) ? 1 : 0;
  await b.close(); app.close(); app.server.closeAllConnections?.(); app.server.close();
})();

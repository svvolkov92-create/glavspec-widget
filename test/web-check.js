// The web version against a real server: sign in by invitation link, the data, a change, a phone screen.
// Run: node test/web-check.js (Playwright Chromium).
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const root = path.resolve(__dirname, '..');
const { createServer } = require(path.join(root, 'server/pult-server.js'));
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pult-web-'));
  const app = createServer({ dataDir: dir, host: '127.0.0.1', configFile: dir + '/none.json', publicUrl: 'http://127.0.0.1:8792' });
  await new Promise(r => app.server.listen(8792, '127.0.0.1', r));
  const B = 'http://127.0.0.1:8792';
  const post = async (p, b, t) => (await fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) })).json();
  const now = new Date().toISOString();
  const data = { users: { g: { name: 'Волков С.В.', role: 'gip', createdAt: now }, c: { name: 'Орлов Д.', role: 'chief', directions: ['kr'], createdAt: now } },
    projects: { p1: { name: 'Цех металлоконструкций', code: '25-047', gipId: 'g', members: ['c'] } },
    tasks: { t1: { projectId: 'p1', marks: ['КР'], title: 'КР', ownerId: 'c', status: 'work', start: '2026-11-01', finish: '2026-12-01', budget: 5 }, t2: { projectId: 'p1', marks: ['АР'], title: 'АР', ownerId: 'g', status: 'todo', start: '2026-11-01', finish: '2026-12-10' } },
    contractors: {}, chats: {}, depts: {} };
  const gip = (await post('/api/setup', { code: app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'g', data })).token;
  const inv = await post('/api/rpc', { fn: 'inviteCreate', args: ['c'] }, gip);
  const b = await chromium.launch();
  const out = [];
  const check = (n, ok, x = '') => out.push(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
  for (const [name, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(inv.link); await p.waitForTimeout(1200);
    check(`${name}: invitation link opens the sign-in with the code`, await p.evaluate(() => !!document.querySelector('#web-login input[name="code"]')?.value));
    await p.screenshot({ path: path.join(os.tmpdir(), 'web-join.png') });
    await p.fill('#web-login input[name="login"]', 'orlov'); await p.fill('#web-login input[name="password"]', 'orlov-pass-1');
    await p.click('#web-login button[type="submit"]'); await p.waitForTimeout(2500);
    const st = await p.evaluate(() => ({ hidden: document.querySelector('#web-login')?.hidden, me: window.AppBridge?.state.me?.name, tasks: window.AppBridge?.state.tasks.size, budget: window.AppBridge?.state.tasks.get('t1')?.budget }));
    check(`${name}: signed in, sees own part (no money)`, st.hidden && st.me === 'Орлов Д.' && st.tasks === 1 && st.budget === undefined, JSON.stringify(st));
    const w = await p.evaluate(() => window.api.write([{ type: 'update', col: 'tasks', id: 't1', data: { note: 'с телефона' } }], {}));
    check(`${name}: a change goes to the server`, w.ok && app.store.data.tasks.t1.note === 'с телефона');
    await post('/api/rpc', { fn: 'write', args: [[{ type: 'update', col: 'tasks', id: 't1', data: { status: 'review' } }], {}] }, gip);
    await p.waitForTimeout(1500);
    check(`${name}: someone else's change arrives`, await p.evaluate(() => window.AppBridge.state.tasks.get('t1').status) === 'review');
    await p.screenshot({ path: path.join(os.tmpdir(), 'web-phone.png') });
    await p.reload(); await p.waitForTimeout(1500);
    check(`${name}: stays signed in after reload`, await p.evaluate(() => document.querySelector('#web-login')?.hidden !== false && window.AppBridge.state.tasks.size === 1));
    check(`${name}: no page errors`, errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  console.log(out.join("\n")); process.exitCode = out.some(l => l.startsWith("FAIL")) ? 1 : 0;
  await b.close(); app.close(); app.server.closeAllConnections?.(); app.server.close();
})();

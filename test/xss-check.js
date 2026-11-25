'use strict';
// Stored XSS in the Пульт interface (4.9.3; web version against a live server): markup with data-xss in every field people
// type and others see; then every tab, window and drawer is opened. Any [data-xss] element in the page = not escaped.
const REPO = process.argv[2] || require('path').resolve(__dirname, '..');
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const { createServer } = require(path.join(REPO, 'server/pult-server.js'));
const X = n => `«${n}<b data-xss="${n}">B</b><img data-xss="${n}i" src="x"><svg data-xss="${n}s"></svg>»`;
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pult-xss-'));
  const app = createServer({ dataDir: dir, host: '127.0.0.1', configFile: dir + '/none.json', publicUrl: 'http://127.0.0.1:8793' });
  await new Promise(r => app.server.listen(8793, '127.0.0.1', r));
  const B = 'http://127.0.0.1:8793';
  const post = async (p, b, t) => (await fetch(B + p, { method: 'POST', headers: { 'X-Pult-Protocol': '2', 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) })).json();
  const now = new Date().toISOString();
  const data = {
    users: { g: { name: 'Волков С.В.', role: 'gip', createdAt: now }, c: { name: 'Орлов ' + X('user'), role: 'chief', directions: ['kr'], position: X('pos'), createdAt: now } },
    projects: { p1: { name: 'Цех ' + X('pname'), code: X('pcode'), client: X('client'), address: X('paddr'), gipId: 'g', members: ['c'], customerId: 'o1',
      requests: [{ id: 'r1', title: X('req'), why: X('why'), due: '2026-12-01' }], ird: [{ id: 'i1', title: X('ird'), who: X('who'), note: X('irdnote'), status: 'need' }],
      // 4.22: in the old place — the server moves them into their own records on setup.
      expertise: { org: X('exorg'), cycles: [{ id: 'c1', no: '1', remarks: [{ id: 'rx', n: '1', mark: X('rmark'), text: X('rtext'), answer: X('rans'), ownerId: 'c', status: 'work' }] }] },
      letters: [{ id: 'lx', dir: 'in', seq: 1, date: '2026-11-01', corr: X('lcorr'), subject: X('lsubj'), body: X('lbody'), status: 'answer', files: [] }] } },
    tasks: {
      t1: { projectId: 'p1', marks: ['КР'], title: X('ttitle'), note: X('tnote'), ownerId: 'c', status: 'work', start: '2026-11-01', finish: '2026-12-01', budget: 5,
        comments: [{ id: 'c1', ts: now, userId: 'c', user: 'Орлов', text: X('comment') }], history: [{ ts: now, text: X('hist'), user: 'x' }] },
      t2: { projectId: 'p1', marks: ['АР'], title: 'АР', ownerId: 'g', status: 'review', start: '2026-11-01', finish: '2026-12-10', dependsOn: ['t1'] },
    },
    contractors: { k1: { name: X('contractor'), specialty: X('spec'), phone: X('kphone') } },
    chats: { 'g_x': { kind: 'group', title: X('chattitle'), members: ['g', 'c'], messages: [{ id: 'm1', ts: now, userId: 'c', user: 'Орлов', text: X('msg') + ' [[task:t1]]' }], lastTs: now } },
    depts: { d1: { name: X('dept'), headId: 'c', members: ['c'] } },
    orgs: { o1: { name: X('org'), roles: ['customer', 'supplier'], inn: '7707083893', address: X('oaddr'), director: X('dir'), fullName: X('ofull'), note: X('onote'),
      contacts: [{ id: 'k1', name: X('contact'), position: X('kpos') }], contracts: [{ id: 'd1', no: X('cno'), date: '2026-11-01', sum: 5, subject: X('csubj') }] } },
  };
  const gip = (await post('/api/setup', { code: app.acc.setupCode, login: 'volkov', password: 'secret123', userId: 'g', data })).token;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  const found = new Map(), errs = [];
  p.on('pageerror', e => errs.push(e.stack));
  p.on('dialog', d => { found.set('DIALOG', d.message()); d.dismiss(); });
  const scan = async where => {
    const hits = await p.evaluate(() => [...document.querySelectorAll('[data-xss]')].map(e => e.getAttribute('data-xss')));
    for (const h of hits) if (!found.has(h)) found.set(h, where);
  };
  await p.goto(B + '/app/'); await p.waitForTimeout(1200);
  await p.fill('#web-login input[name="login"]', 'volkov'); await p.fill('#web-login input[name="password"]', 'secret123');
  await p.click('#web-login button[type="submit"]'); await p.waitForTimeout(2500);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs [data-act="tab"]')].map(e => e.dataset.id));
  const acts = async (sel, where) => { const n = await p.evaluate(s => document.querySelectorAll(s).length, sel); for (let i = 0; i < Math.min(n, 6); i++) { await p.evaluate(([s, i]) => document.querySelectorAll(s)[i]?.dispatchEvent(new MouseEvent("click", { bubbles: true })), [sel, i]); await p.waitForTimeout(350); await scan(where + ' → ' + sel); await p.keyboard.press('Escape'); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('[data-act="discard"]')?.click()); } };
  for (const t of tabs) {
    await p.evaluate(id => document.querySelector(`#tabs [data-act="tab"][data-id="${id}"]`).click(), t); await p.waitForTimeout(700);
    await scan('tab ' + t);
    // Sub-views of tabs (Гант, канбан, список, структура…), then the drawers.
    const views = await p.evaluate(() => [...document.querySelectorAll('[data-act="view"],[data-act="people-view"],[data-act="org-filter"],[data-act="dtab"]')].map(e => [e.dataset.act, e.dataset.v || e.dataset.id]));
    for (const [a, v] of views.slice(0, 8)) { await p.evaluate(([a, v]) => document.querySelector(`[data-act="${a}"][data-v="${v}"],[data-act="${a}"][data-id="${v}"]`)?.click(), [a, v]); await p.waitForTimeout(400); await scan(`tab ${t} / ${a}=${v}`); }
    await acts('[data-act="open-task"]', 'tab ' + t);
    await acts('[data-act="open-org"]', 'tab ' + t);
    await acts('[data-act="open-contractor"]', 'tab ' + t);
  }
  // The project window with all its tabs.
  await p.evaluate(() => window.AppBridge && document.querySelector('[data-act="tab"][data-id="projects"]')?.click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-act="open-project"][data-id="p1"]')?.click()); await p.waitForTimeout(800);
  await scan('project');
  const ptabs = await p.evaluate(() => [...document.querySelectorAll('[data-act="ptab"],[data-act="ctab"],[data-act="dtab"]')].map(e => [e.dataset.act, e.dataset.id || e.dataset.v]));
  for (const [a, v] of ptabs) { await p.evaluate(([a, v]) => document.querySelector(`[data-act="${a}"][data-id="${v}"],[data-act="${a}"][data-v="${v}"]`)?.click(), [a, v]); await p.waitForTimeout(500); await scan(`project / ${a}=${v}`); }
  await p.evaluate(() => document.querySelector('[data-act="discard"]')?.click()); await p.waitForTimeout(300);
  // 4.22: the project page — the expertise and the letters, a remark and a letter opened.
  await p.evaluate(() => window.AppBridge.openTarget('project:p1')); await p.waitForTimeout(900); await scan('project page');
  await p.evaluate(() => document.querySelector('[data-act="ex-open"]')?.click()); await p.waitForTimeout(400); await scan('remark'); await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelector('[data-act="let-edit"]')?.click()); await p.waitForTimeout(400); await scan('letter'); await p.keyboard.press('Escape');
  // Messages, search, the journal.
  await p.evaluate(() => document.querySelector('[data-act="msgs"],[data-act="messages"],#btn-msgs')?.click()); await p.waitForTimeout(700); await scan('messages');
  await p.evaluate(() => document.querySelector('[data-act="chat-open"],[data-act="open-chat"]')?.click()); await p.waitForTimeout(700); await scan('chat');
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  for (const q of ['«', 'Цех', 'Орлов', 'org']) { await p.keyboard.type(q); await p.waitForTimeout(400); await scan('search ' + q); for (let i = 0; i < q.length; i++) await p.keyboard.press('Backspace'); }
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelector('[data-act="journal"]')?.click()); await p.waitForTimeout(800); await scan('journal');
  // Toasts and confirm strips with names in them: delete the org (its name goes into a toast / undo strip).
  await p.evaluate(() => document.querySelector('[data-act="tab"][data-id="orgs"]')?.click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-act="open-org"]')?.click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-act="ask-delete"]')?.click()); await p.waitForTimeout(800); await scan('org to trash (toast)');
  await p.evaluate(() => document.querySelector('[data-act="trash"]')?.click()); await p.waitForTimeout(600); await scan('trash');
  await p.screenshot({ path: path.join(os.tmpdir(), 'xss-last.png') });
  console.log(found.size ? [...found].map(([k, w]) => `VULN not escaped: ${k} — at ${w}`).join('\n') : 'HOLD no [data-xss] element appeared anywhere');
  process.exitCode = found.size ? 1 : 0;
  console.log('tabs visited:', tabs.join(', '));
  if (errs.length) console.log('page errors (not security):', errs.slice(0, 3).map(e => e.split('\n')[0]).join(' | '));
  await b.close(); app.close(); app.server.closeAllConnections?.(); app.server.close();
  process.exit(process.exitCode || 0);
})();

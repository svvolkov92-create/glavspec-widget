'use strict';
// 3.2 walkthrough: the desktop app connects to a real cabinet server, publishes a project, opens access
// for a customer; the customer logs in, answers and asks; messages come back into the app.
// `electron test/smoke-v32.js <outDir>` with XDG_CONFIG_HOME pointing at a temp dir.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../server/cabinet-server.js');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const notes = [];
try { electron.Notification.isSupported = () => true; electron.Notification.prototype.show = function () { notes.push(this.body); }; } catch { /* Xvfb */ }
electron.shell.openExternal = async url => { notes.push('open:' + url); };
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));

const srvDir = path.join(outDir, 'server-data');
const srv = createServer({ dataDir: srvDir, configFile: path.join(srvDir, 'none.json') });
let base = '';

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, level, message, line, source) => { if (level >= 2) log.push(`[console ${level}] ${message} (${source}:${line})`); });
  win.webContents.once('did-finish-load', async () => {
    if (win.webContents.getURL().startsWith('data:')) return;
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const openCust = async () => {
      await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
      await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
      await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
    };
    let password = '';
    try {
      await new Promise(r => srv.server.listen(0, '127.0.0.1', r));
      base = `http://127.0.0.1:${srv.server.address().port}`;
      win.setSize(1400, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);

      await step('connect', async () => {
        await openCust();
        check('not connected: invitation shown', /Запустить кабинет на этом компьютере/.test(await text('#cab-box')));
        await click('[data-act="cab-settings"]'); await wait(200);
        await setVal('#c-url', base);
        await setVal('#c-key', 'wrong-key');
        await js(`document.querySelector('.modal form, form.modal').requestSubmit()`); await wait(800);
        check('wrong key reported', /Неверный ключ/.test(await text('#c-err')), await text('#c-err'));
        await setVal('#c-key', srv.teamKey());
        await js(`document.querySelector('form.modal').requestSubmit()`); await wait(1000);
        check('dialog closed after success', !(await js(`!!document.querySelector('#c-url')`)));
        const st = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
        check('settings saved, key not in plain JSON when encryption exists', st.cabinetUrl === base && !!st.cabinetKey && (st.cabinetKey.startsWith('enc:') || st.cabinetKey.startsWith('plain:')), st.cabinetKey.slice(0, 6));
        check('window never gets the key', !(await js(`JSON.stringify(window.api.cabinetGet ? 1 : 0)`)).includes(srv.teamKey()) && !JSON.stringify(await js(`window.api.cabinetGet()`)).includes(srv.teamKey()));
        check('connected: publish button', /Сохранить и опубликовать/.test(await text('#cab-box')));
      });

      await step('publish and access', async () => {
        await click('[data-act="cab-publish"]'); await wait(1200);
        const m = srv.store.data.projects['demo-p1'];
        check('model on server', !!m && m.project.name === data().projects['demo-p1'].name);
        const raw = JSON.stringify(m || {});
        check('no money, contractors, owners in the published model', !/budget|contractor|ownerId|Петров|Сидорова|Кузнецов|"amount"/.test(raw));
        check('published chip', /опубликовано/.test(await text('#cab-box')));
        await wait(300);
        await setVal('#cab-name', 'Иванов Иван, ООО «Заказчик»');
        await setVal('#cab-login', 'ivanov');
        await click('[data-act="cab-add"]'); await wait(1200);
        password = await js(`[...document.querySelectorAll('.cab-pw code')][2]?.textContent || ''`);
        check('password shown once', /^[a-zA-Z2-9]{10}$/.test(password), password);
        check('customer listed', /ivanov/.test(await text('#cab-box')) && /ещё не входил/.test(await text('#cab-box')));
        await shot('32-01-cabinet-box');
        const ov = await js(`(() => { const b = document.querySelector('#dform .drawer-b'); const W = b.clientWidth; const wide = [...b.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > b.getBoundingClientRect().right + 2).slice(0, 6).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().width)); return { W, sw: b.scrollWidth, wide }; })()`);
        check('customer tab fits the drawer width', ov.sw <= ov.W + 2, JSON.stringify(ov));
      });

      await step('customer side', async () => {
        let cookie = '';
        const web = async (method, p, form) => {
          const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined });
          const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
          return { status: r.status, location: r.headers.get('location'), text: await r.text() };
        };
        check('login', (await web('POST', '/login', { login: 'ivanov', password })).status === 303);
        const page = await web('GET', '/p/demo-p1');
        check('project page with answer forms', page.status === 200 && /Нужно от вас/.test(page.text) && /name="request" value="dr1"/.test(page.text));
        fs.writeFileSync(path.join(outDir, 'cabinet-page.html'), page.text);
        const csrf = page.text.match(/name="csrf" value="([^"]+)"/)[1];
        await web('POST', '/c/answer', { csrf, project: 'demo-p1', request: 'dr1', text: 'ТУ получили, высылаем на почту' });
        await web('POST', '/c/urgent', { csrf, project: 'demo-p1', text: 'Экспертиза просит КР раньше — можем?' });
        await web('POST', '/c/call', { csrf, project: 'demo-p1', text: '' });
      });

      await step('messages back in the app', async () => {
        const r = await js(`window.api.cabinetSync()`); await wait(600);
        check('sync took 3 messages', r.ok && r.fresh === 3, JSON.stringify(r));
        const box = await text('#cab-box');
        check('messages in the project', /Горящий вопрос/.test(box) && /ТУ получили/.test(box) && /Просьба перезвонить/.test(box));
        check('customer login seen', /последний вход/.test(box));
        await shot('32-02-messages');
        await click('[data-act="cab-got"]'); await wait(200);
        check('request ticked in the draft', await js(`document.querySelector('[data-pd="requests.0.done"]').checked`));
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(600);
        check('request saved as received', data().projects['demo-p1'].requests.find(x => x.id === 'dr1').done === true);
        await js(`window.api.cabinetSync()`); await wait(800);
        check('page refreshed automatically: answered request gone', !srv.store.data.projects['demo-p1'].project.requests.some(x => x.id === 'dr1'));
      });

      await step('overview panel and notification', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="overview"]').click()`); await wait(400);
        const panel = await text('.cab-inbox');
        check('overview: «От заказчиков» with unread', /От заказчиков/.test(panel) && /Горящий вопрос/.test(panel), panel.slice(0, 80));
        await shot('32-03-overview');
        // The same messages in the messenger: «От заказчиков», one thread per project.
        await js(`document.querySelector('[data-act="msg-open"]').click()`); await wait(300);
        check('messenger: «От заказчиков» section with unread', await js(`!!document.querySelector('.mc-tab[data-v="cust"] i')`));
        await js(`document.querySelector('.mc-tab[data-v="cust"]').click()`); await wait(200);
        await js(`document.querySelector('[data-act="msg-chat"][data-id="c:demo-p1"]').click()`); await wait(400);
        const th = await text('#mc-msgs');
        check('customer thread shows the messages', /Экспертиза просит КР раньше/.test(th) && /Горящий вопрос/.test(th) && /Просьба перезвонить/.test(th), th.slice(0, 120));
        await shot('32-03b-messenger-customers');
        await js(`document.querySelector('[data-act="msg-close"]').click()`); await wait(200);
        // a new message arrives later → toast notification on the regular sync
        srv.store.data.seq += 1;
        srv.store.data.inbox.push({ seq: srv.store.data.seq, id: 'late1', projectId: 'demo-p1', kind: 'urgent', text: 'Где РД по ОВ?', customerName: 'Иванов', projectName: 'x', ts: new Date().toISOString() });
        notes.length = 0;
        await js(`window.api.cabinetSync()`); await wait(500); // the window call is quiet…
        check('quiet sync from the window', notes.length === 0);
        srv.store.data.seq += 1;
        srv.store.data.inbox.push({ seq: srv.store.data.seq, id: 'late2', projectId: 'demo-p1', kind: 'call', text: '', customerName: 'Иванов', projectName: 'x', ts: new Date().toISOString() });
        await click('[data-act="cab-read-all"]'); await wait(400);
        check('read all clears the panel', !(await js(`!!document.querySelector('.cab-inbox')`)));
      });

      await step('4.0: a file for approval goes to the customer and the verdict comes back', async () => {
        const pdf = path.join(outDir, 'Планировка.pdf');
        fs.writeFileSync(pdf, '%PDF-1.4 test');
        electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pdf] });
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await js(`document.querySelector('[data-act="project-page"][data-id="demo-p1"]').click()`); await wait(400);
        await js(`document.querySelector('[data-act="ask-customer"][data-id="demo-p1"]').click()`); await wait(300);
        await setVal('#aq-title', 'Согласовать планировку 1 этажа');
        await js(`document.querySelector('.modal input[name="aq-kind"][value="decision"]').click()`);
        await js(`document.querySelector('.modal [data-m="attach"]').click()`); await wait(400);
        check('file listed in the request dialog', /Планировка\.pdf/.test(await text('#aq-files')));
        await js(`document.querySelector('.modal form, form.modal').requestSubmit()`); await wait(1500);
        const req = data().projects['demo-p1'].requests.find(r => /планировку/.test(r.title));
        check('request saved with the file', req && req.files?.length === 1 && req.files[0].name === 'Планировка.pdf', JSON.stringify(req));
        const fid = req.files[0].id;
        check('a copy kept in the data folder', fs.existsSync(path.join(dataDir, 'attachments', 'demo-p1', fid)));
        await js(`window.api.cabinetSync()`); await wait(1500);
        check('file uploaded to the cabinet', fs.existsSync(path.join(srvDir, 'files', 'demo-p1', fid)));
        let cookie = '';
        const web = async (method, p, form) => {
          const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined });
          const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
          return { status: r.status, text: await r.text() };
        };
        await web('POST', '/login', { login: 'ivanov', password });
        const page = await web('GET', '/p/demo-p1');
        check('customer sees the file and «Согласовано»', page.text.includes(`/p/demo-p1/f/${fid}`) && /value="approve"/.test(page.text));
        const dl = await web('GET', `/p/demo-p1/f/${fid}`);
        check('customer downloads it', dl.status === 200 && dl.text === '%PDF-1.4 test');
        const csrf = page.text.match(/name="csrf" value="([^"]+)"/)[1];
        await web('POST', '/c/answer', { csrf, project: 'demo-p1', request: req.id, decision: 'approve' });
        await js(`window.api.cabinetSync()`); await wait(1500);
        await js(`document.querySelector('[data-act="msg-open"]').click()`); await wait(300);
        await js(`document.querySelector('.mc-tab[data-v="cust"]')?.click()`); await wait(200);
        await js(`document.querySelector('[data-act="msg-chat"][data-id="c:demo-p1"]')?.click()`); await wait(400);
        check('«Согласовано» in the app', /Согласовано/.test(await text('#mc-msgs')));
        await shot('32-05-approved');
        await js(`document.querySelector('[data-act="msg-close"]').click()`); await wait(300);
      });

      await step('specialist sees nothing of the cabinet', async () => {
        const spec = Object.entries(data().users).find(([, u]) => u.role === 'specialist');
        if (!spec) return check('specialist present in demo', false);
        await js(`window.api.switchUser(${JSON.stringify(spec[0])})`); await wait(500);
        const v = await js(`window.api.cabinetGet()`);
        check('specialist: cabinet not allowed', v.allowed === false);
        const r = await js(`window.api.cabinetPublish('demo-p1')`);
        check('specialist cannot publish', r.ok === false);
        await js(`window.api.switchUser('u-gip')`); await wait(400);
      });

      await step('unpublish', async () => {
        await openCust();
        await click('[data-act="cab-unpublish"]'); await wait(800);
        check('removed from server', !srv.store.data.projects['demo-p1']);
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    srv.server.close();
    app.exit(0);
  });
});
require('../src/main.js');

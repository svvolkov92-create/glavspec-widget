'use strict';
// 4.25 walkthrough: the GIP in «Люди»; the customer asks for more time («Нужно время») and invites a colleague;
// the GIP extends the deadline from «Сообщения» (the customer sees the new date and the reply) and opens the
// colleague's login with only some sections — the colleague signs in and does not see the closed ones.
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../server/cabinet-server.js');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
try { electron.Notification.isSupported = () => false; } catch { /* Xvfb */ }
const dataDir = path.join(app.getPath('appData'), 'GlavspecWidget');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({ notifyHour: 23 }));
const srvDir = path.join(outDir, 'server-data');
const srv = createServer({ dataDir: srvDir, configFile: path.join(srvDir, 'none.json') });

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
    let base = '', cookie = '', csrf = '';
    const web = async (method, p, form) => {
      const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined });
      const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
      return { status: r.status, location: r.headers.get('location'), text: await r.text() };
    };
    const openThread = async () => {
      await js(`document.querySelector('#msg-root [data-act="msg-close"]')?.click()`); await wait(300);
      await js(`document.querySelector('[data-act="msg-open"]').click()`); await wait(300);
      await js(`document.querySelector('#msg-root [data-act="msg-back"]')?.click()`); await wait(200);
      await js(`document.querySelector('.mc-tab[data-v="cust"]')?.click()`); await wait(200);
      await click('[data-act="msg-chat"][data-id="c:demo-p1"]'); await wait(400);
    };
    try {
      await new Promise(r => srv.server.listen(0, '127.0.0.1', r));
      base = `http://127.0.0.1:${srv.server.address().port}`;
      win.setSize(1400, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(800);

      await step('the GIP sees himself in «Люди»', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="people"]').click()`); await wait(300);
        await js(`document.querySelector('[data-act="people-mode"][data-v="list"]').click()`); await wait(300);
        const rows = await js(`[...document.querySelectorAll('.staff-t tr.row')].map(r => r.dataset.id)`);
        check('list: the GIP first, not a drop target', rows[0] === 'u-gip' && await js(`!document.querySelector('.staff-t tr.row[data-id="u-gip"]').dataset.drop`), rows.join(','));
        await js(`document.querySelector('[data-act="people-mode"][data-v="cards"]').click()`); await wait(300);
        check('cards: the GIP too', await js(`!!document.querySelector('.pplcard[data-id="u-gip"]')`));
        await shot('425-01-people');
      });
      await js(`window.api.write([{ type: 'update', col: 'projects', id: 'demo-p1', data: { requests: [{ id: 'rq1', title: 'Опросный лист ОЛ-03', due: '${new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)}', files: [] }] } }], { action: 'smoke' })`); await wait(500);
      await step('connect and publish', async () => {
        await js(`document.querySelector('[data-act="tab"][data-id="projects"]').click()`); await wait(300);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
        await click('[data-act="cab-settings"]'); await wait(200);
        await setVal('#c-url', base); await setVal('#c-key', srv.teamKey());
        await js(`document.querySelector('form.modal').requestSubmit()`); await wait(1000);
        await click('[data-act="cab-publish"]'); await wait(1200);
        check('published', !!srv.store.data.projects['demo-p1']);
        await js(`document.querySelector('[data-act="request-close"]')?.click()`); await wait(300);
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
      });

      const until = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), dm = until.split('-').reverse().join('.').replace(/\.20(\d\d)$/, '.$1');
      await step('customer asks for time and invites a colleague', async () => {
        const r = await fetch(base + '/api/team/customers', { method: 'POST', headers: { Authorization: 'Bearer ' + srv.teamKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Петров Андрей', login: 'petrov', projectIds: ['demo-p1'] }) });
        const { password } = await r.json();
        await web('POST', '/login', { login: 'petrov', password });
        const page = await web('GET', '/p/demo-p1');
        csrf = page.text.match(/name="csrf" value="([^"]+)"/)[1];
        check('cabinet: «Команда» tab', /href="#team"/.test(page.text));
        await web('POST', '/c/question', { csrf, project: 'demo-p1', text: 'x' });
        const e = await web('POST', '/c/extend', { csrf, project: 'demo-p1', request: 'rq1', until, text: 'Ждём директора' });
        const i = await web('POST', '/c/invite', { csrf, project: 'demo-p1', name: 'Козлов Игорь', contact: '+7 900 000-55-10', role: 'Технадзор', see_docs: '1', see_chat: '1' });
        check('both sent', /ok=extend/.test(e.location) && /ok=invite/.test(i.location), e.location + ' ' + i.location);
        const s = await js(`window.api.cabinetSync()`); await wait(600);
        check('came to the Pult', s.ok && s.fresh === 3, JSON.stringify(s));
      });

      await step('the GIP extends the deadline', async () => {
        await openThread();
        await shot('425-02-thread');
        await click('[data-act="cust-extend"]'); await wait(1500);
        const rq = data().projects['demo-p1'].requests[0];
        check('the request has the new date', rq.due === until, rq.due);
        check('the customer was answered in the chat', (data().projects['demo-p1'].custChat || []).at(-1)?.text.includes('продлён до'));
        const page = await web('GET', '/p/demo-p1');
        check('the cabinet shows the new date and the reply', page.text.includes('продлён до') && page.text.includes(dm.slice(0, 5)));
      });

      await step('the GIP opens the colleague\'s login', async () => {
        await openThread();
        await click('[data-act="cust-invite"]'); await wait(500);
        const v = await js(`[document.querySelector('#ci-name').value, document.querySelector('#ci-login').value, document.querySelector('#ci-role').value, [...document.querySelectorAll('[data-see]')].filter(x => x.checked).map(x => x.dataset.see).join(',')]`);
        check('the form is filled from the invitation', v[0] === 'Козлов Игорь' && v[1] === 'kozlov' && v[2] === 'Технадзор' && v[3] === 'docs,chat', v.join(' | '));
        await shot('425-03-invite');
        await js(`document.querySelector('#ci-name').closest('form').requestSubmit()`); await wait(1500);
        const pw = await js(`document.querySelector('.cab-pw-text')?.textContent || ''`);
        check('the login and password are shown', /Логин: kozlov/.test(pw) && /Пароль: \S+/.test(pw), pw);
        await shot('425-04-login');
        const k = Object.values(srv.store.data.customers).find(c => c.login === 'kozlov');
        check('the colleague sees docs and chat only', !!k && JSON.stringify(k.hide) === '["q","finance"]' && k.projectIds.includes('demo-p1'), JSON.stringify(k?.hide));
        cookie = '';
        await web('POST', '/login', { login: 'kozlov', password: pw.match(/Пароль: (\S+)/)[1] });
        const page = await web('GET', '/p/demo-p1');
        check('the colleague signs in; closed sections are not there', page.status === 200 && /href="#chat"/.test(page.text) && !/href="#q"|href="#dec"/.test(page.text));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    srv.server.close();
    app.exit(0);
  });
});
require('../src/main.js');

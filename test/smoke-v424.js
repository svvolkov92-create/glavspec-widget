'use strict';
// 4.24 walkthrough: the customer chat both ways. The customer writes in the cabinet's chat (one message «на контроль»),
// the GIP sees both in «Сообщения», replies — the reply is published to the cabinet at once — and sends the customer's
// message on: to the internal project chat, into a card's discussion, as a new card «на контроль».
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

      await step('customer writes in the chat', async () => {
        const r = await fetch(base + '/api/team/customers', { method: 'POST', headers: { Authorization: 'Bearer ' + srv.teamKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Петров Андрей', login: 'petrov', projectIds: ['demo-p1'] }) });
        const { password } = await r.json();
        await web('POST', '/login', { login: 'petrov', password });
        const page = await web('GET', '/p/demo-p1');
        csrf = page.text.match(/name="csrf" value="([^"]+)"/)[1];
        check('cabinet: «Чат» and «Решения» tabs', /href="#chat"/.test(page.text) && /href="#dec"/.test(page.text));
        await web('POST', '/c/chat', { csrf, project: 'demo-p1', text: 'Фото ворот пришлём завтра' });
        await web('POST', '/c/chat', { csrf, project: 'demo-p1', text: 'Когда будет решение по трубам?', control: '1' });
        const s = await js(`window.api.cabinetSync()`); await wait(600);
        check('both came to the Pult', s.ok && s.fresh === 2, JSON.stringify(s));
      });

      await step('the GIP replies from «Сообщения»', async () => {
        await openThread();
        const th = await text('#mc-msgs');
        check('thread: the chat message and the one on control', th.includes('Фото ворот пришлём завтра') && th.includes('Когда будет решение по трубам?') && th.includes('Вопрос на контроле'), th.slice(0, 200));
        check('reply box and the three actions', await js(`!!document.querySelector('#msg-text') && document.querySelectorAll('.cust-acts button').length === 6`));
        await shot('424-01-thread');
        await setVal('#msg-text', 'Решение по трубам — в «Решениях», до пятницы.');
        await click('[data-act="mc-send"]'); await wait(1500);
        const cc = data().projects['demo-p1'].custChat || [];
        check('reply saved in the project', cc.at(-1)?.text === 'Решение по трубам — в «Решениях», до пятницы.' && !!cc.at(-1).user, JSON.stringify(cc.at(-1)));
        check('published at once', (srv.store.data.projects['demo-p1'].chat || []).some(x => x.text.includes('Решение по трубам')));
        const page = await web('GET', '/p/demo-p1');
        const chat = page.text.slice(page.text.indexOf('id="chat"'), page.text.indexOf('id="dec"'));
        check('the customer sees the reply', chat.includes('Решение по трубам — в «Решениях», до пятницы.') && chat.includes('Фото ворот'));
        check('reply shown in the thread', (await text('#mc-msgs')).includes('ответ в кабинет'));
        await shot('424-02-replied');
      });

      await step('send a customer message on', async () => {
        const ids = await js(`[...document.querySelectorAll('[data-act="cust-fwd"]')].map(b => b.dataset.id)`);
        await click(`[data-act="cust-fwd"][data-id="${ids[0]}"]`); await wait(1200);
        const pc = Object.values(data().chats || {}).find(c => c.kind === 'project' && c.projectId === 'demo-p1');
        check('«Во внутренний»: in the project chat with the quote', !!pc && pc.messages.some(m => m.text.startsWith('Пишет заказчик — Петров Андрей') && m.text.includes('Фото ворот')), JSON.stringify(pc?.messages?.at(-1)));
        check('the project chat opened', (await text('.msg-panel .mc-ht b')).length > 0 && !(await js(`!!document.querySelector('[data-act="cust-fwd"]')`)));
        await openThread();
        await click(`[data-act="cust-card"][data-id="${ids[1]}"]`); await wait(300);
        const tid = await js(`document.querySelector('#cc-task').value`);
        await js(`document.querySelector('#cc-task').closest('form').requestSubmit()`); await wait(1200);
        check('«В карточку»: in the card discussion', (data().tasks[tid]?.comments || []).some(c => c.text.includes('Когда будет решение по трубам?')), tid);
        await openThread();
        await click(`[data-act="cust-ctl"][data-id="${ids[1]}"]`); await wait(600);
        const form = await js(`(() => { const d = document.querySelector('.drawer'); return d ? [...d.querySelectorAll('input,textarea')].map(i => i.value).join(' | ') : ''; })()`);
        check('«На контроль»: a new card with the text', form.includes('Заказчик: Когда будет решение по трубам?'), form.slice(0, 200));
        await shot('424-03-control');
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    srv.server.close();
    app.exit(0);
  });
});
require('../src/main.js');

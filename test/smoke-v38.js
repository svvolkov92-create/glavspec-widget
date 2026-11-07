'use strict';
// 3.8: messenger (dock, side panel, window; project, personal and group chats; @mentions) and asking the customer
// for source data (ТУ, letters, approvals) from the project page and from «Для заказчика».
const electron = require('electron');
const { app } = electron;
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv.at(-1);
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok, extra = '') => log.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
electron.dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(outDir, path.basename(o.defaultPath)) });
electron.shell.openPath = async () => '';
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
    const js = code => win.webContents.executeJavaScript(code);
    const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); })()`);
    const shot = async name => fs.writeFileSync(path.join(outDir, name + '.png'), (await win.webContents.capturePage()).toPNG());
    const data = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    const text = sel => js(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const key = (sel, k, extra = {}) => js(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true, ...${JSON.stringify(extra)} }))`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const type = async (sel, v) => js(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); t.focus(); t.value = ${JSON.stringify(v)}; t.setSelectionRange(t.value.length, t.value.length); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const page = async pid => { await click('[data-act="tab"][data-id="projects"]'); await wait(200); await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150); await click(`[data-act="project-page"][data-id="${pid}"]`); await wait(400); };
    try {
      win.setSize(1400, 900); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(1500);

      await step('dock with counters', async () => {
        check('dock button', await js(`!!document.querySelector('.msg-fab')`));
        const at = await text('.msg-fab .mc-at');
        check('unread and @ counters apart', /\d/.test(await text('.msg-fab .mc-n')) && /^@2$/.test(at), `${await text('.msg-fab')}`);
        check('no chat block on the project page any more', await (async () => { await page('demo-p2'); return !(await js(`!!document.querySelector('.pt-chat')`)) && await js(`!!document.querySelector('[data-act="msg-project"]')`); })());
        await shot('38-01-dock');
      });

      await step('side panel: list and project chat', async () => {
        await click('.msg-fab'); await wait(300);
        const titles = await js(`[...document.querySelectorAll('.msg-panel .mc-item .mc-top b')].map(b => b.textContent).join('|')`);
        check('project, personal and group chats', /Склад/.test(titles) && /Белова/.test(titles) && /Планёрка/.test(titles), titles);
        check('project without messages listed below', /Без сообщений/.test(await text('.msg-panel')) && /Северный/.test(titles));
        await js(`[...document.querySelectorAll('.mc-item')].find(b => /Склад/.test(b.textContent)).click()`); await wait(400);
        check('messages with my mention highlighted', (await js(`document.querySelectorAll('.mc-msgs .chat-msg').length`)) === 4 && await js(`!!document.querySelector('.mc-msgs .chat-msg.tome .mention.me')`));
        await shot('38-02-side-chat');
        await wait(1500);
        check('read after opening', !(data().chats['p_demo-p2'].seen || {})['u-gip'] === false);
        await type('#msg-text', 'Коллеги, @Бел'); await wait(150);
        check('@ suggests by surname', /Белова/.test(await text('#mc-ac')) && !(await js(`document.querySelector('#mc-ac').hidden`)));
        await shot('38-03-autocomplete');
        await key('#msg-text', 'Enter'); await wait(100);
        check('Enter picks the person', (await js(`document.querySelector('#msg-text').value`)) === 'Коллеги, @Белова ');
        await type('#msg-text', 'Коллеги, @Белова по ИТП жду расходы до среды.');
        await js(`document.querySelector('#mc-ac').hidden = true`);
        await key('#msg-text', 'Enter'); await wait(800);
        const last = data().chats['p_demo-p2'].messages.at(-1);
        check('sent with the mention', last.userId === 'u-gip' && last.mentions.join() === 'demo-u2' && /по ИТП/.test(last.text), JSON.stringify(last));
        check('composer cleared, message shown', (await js(`document.querySelector('#msg-text').value`)) === '' && /до среды/.test(await text('.mc-msgs')));
      });

      await step('new group chat without a project', async () => {
        await click('[data-act="msg-new"]'); await wait(200);
        await click('[data-act="msg-newkind"][data-v="group"]'); await wait(150);
        await setVal('#mc-title', 'Котельная — рабочая группа');
        await js(`document.querySelector('input[data-act="msg-pick"][value="demo-u3"]').click()`); await wait(150);
        await click('[data-act="msg-create"]'); await wait(800);
        const g = Object.values(data().chats).find(c => c.title === 'Котельная — рабочая группа');
        check('group created', g && g.kind === 'group' && g.members.includes('u-gip') && g.members.includes('demo-u3') && g.members.length === 2, JSON.stringify(g && g.members));
        await type('#msg-text', '@все, старт в понедельник'); await js(`document.querySelector('#mc-ac').hidden = true`);
        await click('[data-act="mc-send"]'); await wait(700);
        const g2 = Object.values(data().chats).find(c => c.title === 'Котельная — рабочая группа');
        check('@все marks everyone else', g2.messages?.[0]?.mentions.join() === 'demo-u3', JSON.stringify(g2.messages) + ' toast: ' + (await text('#toast')) + ' chat: ' + (await js('JSON.stringify([document.querySelector(".mc-head")?.textContent, document.querySelector("#msg-text")?.value])')));
      });

      await step('window with all chats', async () => {
        await click('[data-act="msg-size"]'); await wait(300);
        check('two columns', await js(`!!document.querySelector('.msg-panel.full .mp-left .mc-list') && !!document.querySelector('.msg-panel.full .mp-right .mc-chat')`));
        await shot('38-04-window');
        await click('[data-act="msg-filter"][data-v="at"]'); await wait(200);
        check('@ tab lists mentions of me', /Планёрка/.test(await text('.mp-left')) && /сдвигается/.test(await text('.mp-left')));
        await click('[data-act="msg-new"]'); await wait(200);
        await click('[data-act="msg-direct"][data-id="demo-u1"]'); await wait(800);
        const d = data().chats['d_' + ['u-gip', 'demo-u1'].sort().join('_')];
        check('personal chat opened', !!d && /Орлов/.test(await text('.mp-right .mc-head')));
        await click('[data-act="msg-close"]'); await wait(200);
      });

      await step('the other side: Белова', async () => {
        await js(`window.api.switchUser('demo-u2')`); await wait(700);
        check('her @ counter', /@\d/.test(await text('.msg-fab .mc-at')));
        await click('.msg-fab'); await wait(200);
        await click('[data-act="msg-filter"][data-v="at"]'); await wait(200);
        check('the GIP mention is in her @ list', /до среды/.test(await text('.msg-panel')));
        const seen = await js(`[...window.AppBridge.state.chats.keys()].join()`);
        check('she does not see the GIP group without her', !/Котельная/.test(await js(`[...window.AppBridge.state.chats.values()].map(c => c.title || '').join()`)) && !seen.includes('demo-u1_u-gip'), seen);
        await click('[data-act="msg-close"]'); await wait(150);
        await js(`window.api.switchUser('u-gip')`); await wait(700);
      });

      await step('ask the customer from the project page', async () => {
        await page('demo-p1');
        await click('[data-act="ask-customer"]'); await wait(300);
        await setVal('#aq-title', 'ТУ на теплоснабжение 1,2 Гкал/ч'); await wait(100);
        check('kind guessed from the title', await js(`document.querySelector('input[name="aq-kind"][value="tu"]').checked`));
        await setVal('#aq-why', 'Без них экспертиза не примет ИОС1');
        await shot('38-05-ask-customer');
        await js(`document.querySelector('.modal form, form.modal').requestSubmit()`); await wait(700);
        const p = data().projects['demo-p1'];
        const r = p.requests.find(x => x.title === 'ТУ на теплоснабжение 1,2 Гкал/ч'), row = r && p.ird.find(x => x.id === r.irdId);
        check('request tied to a row of source data', !!r && !!row && row.kind === 'tu' && row.status === 'wait' && !r.done, JSON.stringify({ r, row }));
        await click('[data-act="ask-customer"]'); await wait(300);
        await js(`document.querySelector('input[name="aq-kind"][value="decision"]').click()`);
        await setVal('#aq-title', 'Кран-балки: 10 т или 16 т');
        await js(`document.querySelector('.modal form, form.modal').requestSubmit()`); await wait(700);
        const p2 = data().projects['demo-p1'];
        check('a decision is a request only', p2.requests.some(x => x.title === 'Кран-балки: 10 т или 16 т' && !x.irdId) && !p2.ird.some(x => /Кран/.test(x.title)));
      });

      await step('«Для заказчика»: ask all missing, letter, accept', async () => {
        await click('[data-act="tab"][data-id="projects"]'); await wait(200); await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
        await click('[data-act="ird-techcard"]'); await wait(150);
        const n = await js(`Number(document.querySelector('[data-act="ird-request-all"]').textContent.match(/\\((\\d+)\\)/)[1])`);
        check('«всё недостающее» counts customer rows', n >= 6, String(n));
        await click('[data-act="ird-request-all"]'); await wait(200);
        check('rows show «запрошено»', (await js(`[...document.querySelectorAll('#cust-box .chip')].filter(c => /запрошено/.test(c.textContent)).length`)) >= n);
        await shot('38-06-ird-asked');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(700);
        const p = data().projects['demo-p1'];
        check('requests saved with links', p.requests.filter(r => r.irdId && !r.done).length >= n + 1);
        // accepting a row closes its request
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
        const i = await js(`[...document.querySelectorAll('[data-pd^="ird."][data-pd$=".title"]')].findIndex(x => x.value === 'ГПЗУ')`);
        await setVal(`[data-pd="ird.${i}.status"]`, 'accepted');
        await js(`document.querySelector('#dform').requestSubmit()`); await wait(700);
        const p3 = data().projects['demo-p1'], row = p3.ird.find(x => x.title === 'ГПЗУ');
        check('accepted row closes its request', p3.requests.filter(r => r.irdId === row.id).every(r => r.done));
        await js(`document.querySelector('#app [data-act="open-project"][data-id="demo-p1"]').click()`); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(200);
        await click('[data-act="cust-page"][data-format="html"]'); await wait(1500);
        const f = fs.readdirSync(outDir).find(x => x.endsWith('.html'));
        const html = f ? fs.readFileSync(path.join(outDir, f), 'utf8') : '';
        check('customer page: kinds and asked rows', /class="kind">ТУ</.test(html) && /<tr class="asked"/.test(html) && /Нужно от вас/.test(html));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

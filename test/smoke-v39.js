'use strict';
// 3.9: no budget field in the card for those without money access; «Журнал» tab of a card;
// the message field empties after sending; one's own messages can be corrected (card discussion and messenger).
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

      await step('budget field only with money access', async () => {
        await openTask('demo-t3');
        check('GIP sees the budget field', await js(`!!document.querySelector('#t-budget')`));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.switchUser('demo-u1')`); await wait(800);
        const own = await js(`[...window.AppBridge.state.tasks.values()].find(t => t.ownerId === 'demo-u1')?.id`);
        await openTask(own);
        check('specialist: card open, no budget field', await js(`!!document.querySelector('#dform')`) && !(await js(`!!document.querySelector('#t-budget')`)));
        check('specialist: no «Оплата» tab', !(await js(`!!document.querySelector('.dtab[data-id="money"]')`)));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await js(`window.api.switchUser('u-gip')`); await wait(800);
      });

      await step('card journal', async () => {
        const r = await js(`window.api.write([{ type: 'update', col: 'tasks', id: 'demo-t3', data: { note: 'Проверка журнала карточки' } }], { action: 'Примечание' })`);
        check('edit saved', r && r.ok);
        await openTask('demo-t3');
        await click('.dtab[data-id="log"]'); await wait(600);
        const t = await text('#tlog-box');
        check('«Журнал» shows the card entries', /Примечание/.test(t) && /ГИП/.test(t) && /создано/.test(t), t.slice(0, 200));
        await shot('39-01-card-journal');
      });

      await step('card discussion: empty after send, edit own', async () => {
        await openTask('demo-t3');
        await click('.dtab[data-id="talk"]'); await wait(200);
        await setVal('#talk-text', 'Првоерка опечатки');
        await click('[data-act="talk-send"]'); await wait(700);
        check('field empty after sending', (await js(`document.querySelector('#talk-text').value`)) === '');
        const c = data().tasks['demo-t3'].comments.at(-1);
        check('message saved', c.text === 'Првоерка опечатки');
        await click(`[data-act="talk-edit"][data-cid="${c.id}"]`); await wait(200);
        check('edit field with the old text', (await js(`document.querySelector('#talk-edit')?.value`)) === 'Првоерка опечатки');
        check('only own messages have ✎', (await js(`document.querySelectorAll('[data-act="talk-edit"]').length`)) === (await js(`[...window.AppBridge.state.tasks.get('demo-t3').comments].filter(x => x.userId === window.AppBridge.state.me.id).length`)) - 1);
        await setVal('#talk-edit', 'Проверка опечатки');
        await js(`document.querySelector('#talk-edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))`); await wait(700);
        const c2 = data().tasks['demo-t3'].comments.at(-1);
        check('corrected and marked', c2.text === 'Проверка опечатки' && !!c2.editedAt && /изменено/.test(await text('#talk-box')) && !(await js(`!!document.querySelector('#talk-edit')`)), JSON.stringify(c2));
        await click(`[data-act="talk-edit"][data-cid="${c.id}"]`); await wait(150);
        await js(`document.querySelector('#talk-edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await wait(200);
        check('Esc cancels the edit, card stays open', !(await js(`!!document.querySelector('#talk-edit')`)) && (await js(`!!document.querySelector('#dform')`)));
        const other = await js(`window.api.editComment('demo-t3', 'cm1', 'чужое')`);
        check('someone else\'s message cannot be changed', !other.ok, JSON.stringify(other));
        await click('.dtab[data-id="log"]'); await wait(600);
        check('correction in the card journal', /Комментарий исправлен/.test(await text('#tlog-box')));
        await shot('39-02-talk-edit');
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
      });

      await step('messenger: empty after send, edit own', async () => {
        await click('[data-act="msg-open"]'); await wait(300);
        const chatId = await js(`[...document.querySelectorAll('[data-act="msg-chat"]')].map(b => b.dataset.id).find(id => !/^[tc]:/.test(id))`);
        await click(`[data-act="msg-chat"][data-id="${chatId}"]`); await wait(300);
        await setVal('#msg-text', 'Привет @все, првоерка');
        await js(`document.querySelector('#msg-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(800);
        check('field empty after sending', (await js(`document.querySelector('#msg-text').value`)) === '');
        const m = data().chats[chatId].messages.at(-1);
        check('message saved', m.text === 'Привет @все, првоерка');
        await click(`[data-act="mc-edit"][data-id="${m.id}"]`); await wait(200);
        await setVal('#mc-edit', 'Привет, проверка');
        await js(`document.querySelector('#mc-edit').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(800);
        const m2 = data().chats[chatId].messages.at(-1);
        check('corrected, mentions re-read', m2.text === 'Привет, проверка' && !!m2.editedAt && m2.mentions.length === 0 && /изменено/.test(await text('#mc-msgs')), JSON.stringify(m2));
        await shot('39-03-chat-edit');
      });

      await step('messenger: sections, card discussions, pins', async () => {
        await click('[data-act="msg-back"]').catch(() => {}); await wait(200);
        if (!(await js(`!!document.querySelector('.mc-tabs')`))) { await click('[data-act="msg-open"]'); await wait(300); }
        const tabs = await js(`[...document.querySelectorAll('.mc-tab')].map(b => b.dataset.v).join()`);
        check('sections: Все, Проекты, Задачи, Прочие, @ (no customers without a cabinet)', tabs === 'all,proj,task,other,at', tabs);
        await click('.mc-tab[data-v="task"]'); await wait(200);
        const keys = await js(`[...document.querySelectorAll('.mc-list [data-act="msg-chat"]')].map(b => b.dataset.id)`);
        check('«Задачи» lists card discussions', keys.length >= 1 && keys.every(k => k.startsWith('t:')) && keys.includes('t:demo-t3'), keys.join());
        await click('[data-act="msg-chat"][data-id="t:demo-t3"]'); await wait(300);
        check('card thread shows the discussion', /Проверка опечатки/.test(await text('#mc-msgs')) && /обсуждение карточки/.test(await text('.mc-head')));
        await setVal('#msg-text', 'Ответ из мессенджера');
        await js(`document.querySelector('#msg-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await wait(800);
        check('message goes to the card discussion, field empty', data().tasks['demo-t3'].comments.at(-1).text === 'Ответ из мессенджера' && (await js(`document.querySelector('#msg-text').value`)) === '');
        await click('[data-act="msg-back"]'); await wait(200);
        await click('.mc-tab[data-v="all"]'); await wait(200);
        const lastKey = await js(`[...document.querySelectorAll('.mc-list [data-act="msg-chat"]')].map(b => b.dataset.id).at(-1)`);
        await click(`.mc-pin[data-id="${lastKey}"]`); await wait(200);
        const first = await js(`document.querySelector('.mc-list [data-act="msg-chat"]').dataset.id`);
        check('pinned goes to the top under «Закреплённые»', first === lastKey && /Закреплённые/.test(await text('.mc-list')), `${first} vs ${lastKey}`);
        await click('[data-act="tab"][data-id="tasks"]'); await wait(300);
        check('pin kept after re-render', (await js(`document.querySelector('.mc-list [data-act="msg-chat"]')?.dataset.id`)) === lastKey);
        await shot('39-04-messenger-sections');
        await click(`.mc-pin[data-id="${lastKey}"]`); await wait(150);
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

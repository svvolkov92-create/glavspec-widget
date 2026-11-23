'use strict';
// 4.9 — «Контрагенты»: customers from the projects' text, a company card (roles, INN, contacts, contracts), the customer
// picked in the project window, rights by «видит заказчиков» / «видит бюджет», the trash, cabinet logins for contacts.
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
    const setVal = (sel, v) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) throw new Error('no ${sel.replace(/'/g, '')}'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const setChk = (sel, on) => js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (i.checked !== ${on}) i.click(); })()`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message); } };
    const tab = async id => { await click(`[data-act="tab"][data-id="${id}"]`); await wait(300); };
    const hasTab = id => js(`!!document.querySelector('#tabs [data-act="tab"][data-id="${id}"]')`);
    const orgByName = n => Object.entries(data().orgs || {}).find(([, o]) => o.name === n);
    const save = async () => { await js(`document.querySelector('#dform').requestSubmit()`); await wait(700); };
    try {
      win.setSize(1400, 950); await wait(900);
      await js(`window.api.switchUser('u-gip')`); await wait(400);
      await click('[data-act="seed-demo"]'); await wait(900);
      await js(`window.api.write([{ type: 'set', col: 'projects', id: 'v49-p3', data: { name: 'Пример: Школа на 550 мест', client: 'Пример-Девелопмент, ООО', createdAt: new Date().toISOString() } }], { action: 'test' })`); await wait(500);

      await step('the GIP sees «Контрагенты»; the projects\' text customers are offered, spellings grouped', async () => {
        check('tab for the GIP', await hasTab('orgs'));
        await tab('orgs');
        const row = await js(`[...document.querySelectorAll('.org-sug')].find(r => r.textContent.includes('Пример-Девелопмент'))?.textContent || ''`);
        check('one group for «ООО «Пример-Девелопмент»» and «Пример-Девелопмент, ООО»', row.includes('(2)') && row.includes('и как'), row.replace(/\s+/g, ' ').slice(0, 200));
        await shot('49-01-migration');
        await js(`[...document.querySelectorAll('.org-sug')].find(r => r.textContent.includes('Пример-Девелопмент')).querySelector('[data-act="org-mig-link"]').click()`); await wait(900);
        const o = orgByName('ООО «Пример-Девелопмент»');
        const ps = Object.entries(data().projects).filter(([, p]) => p.customerId === o?.[0]).map(([id, p]) => id + ':' + p.client);
        check('a customer made, both projects point to it, name unified', !!o && o[1].roles.includes('customer') && ps.length === 2 && ps.every(x => x.endsWith('ООО «Пример-Девелопмент»')), ps.join(' | '));
        check('the group is gone from the suggestions', !(await js(`[...document.querySelectorAll('.org-sug .grow')].some(r => r.textContent.includes('Пример-Девелопмент'))`)));
        check('the table lists the customer with 2 projects', (await js(`[...document.querySelectorAll('.org-t tr.row')].find(r => r.textContent.includes('Пример-Девелопмент'))?.textContent || ''`)).includes('2'));
      });

      await step('the card: INN checked, duplicates refused, contacts saved', async () => {
        const [oid] = orgByName('ООО «Пример-Девелопмент»');
        await click(`.org-t [data-act="open-org"][data-id="${oid}"]`); await wait(500);
        await setVal('#o-inn', '7707083894'); await wait(100);
        check('INN hint on a typo', (await text('#o-inn-hint')).includes('контрольной'));
        await click('[data-act="org-contact-add"]'); await wait(150);
        await setVal('[data-oc="0"][data-k="name"]', 'Иванов Иван Иванович');
        await setVal('[data-oc="0"][data-k="position"]', 'директор');
        await setVal('[data-oc="0"][data-k="phone"]', '+7 900 000-00-00');
        await click('[data-act="org-contact-add"]'); await wait(150);
        await setVal('[data-oc="1"][data-k="name"]', 'Петрова А.С.');
        await setVal('[data-oc="1"][data-k="position"]', 'технадзор');
        await save();
        check('a wrong INN is not saved', (await js(`!!document.querySelector('#dform') && !document.querySelector('#form-err').hidden`)) && !orgByName('ООО «Пример-Девелопмент»')[1].inn);
        await setVal('#o-inn', '7707083893'); await save();
        const o = orgByName('ООО «Пример-Девелопмент»')[1];
        check('INN and two contacts saved', o.inn === '7707083893' && o.contacts.length === 2 && o.contacts[0].position === 'директор', JSON.stringify(o.contacts));
        await click('[data-act="new-org"]'); await wait(400);
        await setVal('#o-name', 'ООО «Двойник»'); await setVal('#o-inn', '7707083893'); await save();
        check('the same INN twice is refused', !orgByName('ООО «Двойник»') && (await text('#form-err')).includes('уже есть'));
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(300);
      });

      await step('a contractor with contracts; the customer\'s card has none', async () => {
        await click('[data-act="new-org"]'); await wait(400);
        check('contracts hidden for a customer', await js(`document.querySelector('#org-contracts-sub').hidden`));
        await setVal('#o-name', 'ООО «СтройПоставка»');
        await setChk('[name="role-customer"]', false); await setChk('[name="role-supplier"]', true); await wait(100);
        check('contracts shown for a supplier', !(await js(`document.querySelector('#org-contracts-sub').hidden`)));
        await click('[data-act="org-contract-add"]'); await wait(150);
        await setVal('[data-ok="0"][data-k="no"]', '15/26');
        await setVal('[data-ok="0"][data-k="date"]', '2026-11-20');
        await setVal('[data-ok="0"][data-k="sum"]', '1 250 000,50');
        await setVal('[data-ok="0"][data-k="projectId"]', 'demo-p1');
        check('the total follows the sum', (await text('#org-ctotal')).replace(/\s/g, '').startsWith('1250000,5'), await text('#org-ctotal'));
        await shot('49-02-supplier');
        await save();
        const o = orgByName('ООО «СтройПоставка»')?.[1];
        check('saved: role supplier, contract 1 250 000,50 on demo-p1', o && o.roles.join() === 'supplier' && o.contracts[0].sum === 1250000.5 && o.contracts[0].projectId === 'demo-p1', JSON.stringify(o));
        check('filter «Поставщики» shows it', await js(`(() => { document.querySelector('[data-act="org-filter"][data-v="supplier"]').click(); return true; })()`) && (await wait(300), (await js(`[...document.querySelectorAll('.org-t tr.row')].map(r => r.textContent).join('|')`)).includes('СтройПоставка')));
        await click('[data-act="org-filter"][data-v="all"]'); await wait(200);
      });

      await step('the project window picks the customer from the catalogue; a rename reaches the projects', async () => {
        const [oid] = orgByName('ООО «Пример-Девелопмент»');
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p2"]'); await wait(500);
        check('a text customer: «нет в каталоге»', (await text('#pr-client-hint')).includes('нет в каталоге'));
        check('the list offers catalogue customers', await js(`[...document.querySelectorAll('#org-customers option')].some(o => o.value === 'ООО «Пример-Девелопмент»')`));
        await setVal('#pr-client', 'пример девелопмент');
        check('typed loosely — found in the catalogue', (await text('#pr-client-hint')).includes('из каталога'));
        await save();
        const p = data().projects['demo-p2'];
        check('saved with customerId and the catalogue name', p.customerId === oid && p.client === 'ООО «Пример-Девелопмент»', JSON.stringify({ c: p.client, id: p.customerId }));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
        await tab('orgs');
        await click(`.org-t [data-act="open-org"][data-id="${oid}"]`); await wait(500);
        await setVal('#o-name', 'АО «Пример-Девелопмент»'); await save();
        const names = Object.values(data().projects).filter(x => x.customerId === oid).map(x => x.client);
        check('renamed: all 3 projects follow', names.length === 3 && names.every(n => n === 'АО «Пример-Девелопмент»'), names.join(' | '));
      });

      await step('a typed new customer goes to the catalogue with one button', async () => {
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="new-project"]'); await wait(400);
        await setVal('#pr-name', 'Пример: Котельная'); await setVal('#pr-client', 'МУП «Теплосеть»');
        await click('[data-act="org-from-project"]'); await wait(700);
        check('the customer is in the catalogue, the hint says so', !!orgByName('МУП «Теплосеть»') && (await text('#pr-client-hint')).includes('из каталога'));
        await js(`document.querySelector('[data-act="discard"]')?.click()`); await wait(200);
      });

      await step('rights: a chief without access sees no tab; «видит заказчиков» opens customers only', async () => {
        await js(`window.api.switchUser('demo-u2')`); await wait(700);
        check('chief without access: no «Контрагенты»', !(await hasTab('orgs')));
        await js(`window.api.switchUser('demo-u1')`); await wait(700);
        check('specialist: no «Контрагенты»', !(await hasTab('orgs')));
        await js(`window.api.switchUser('u-gip')`); await wait(600);
        await js(`window.api.write([{ type: 'update', col: 'users', id: 'demo-u2', data: { canSeeContacts: true } }], { action: 'test' })`); await wait(400);
        await js(`window.api.switchUser('demo-u2')`); await wait(700);
        check('chief with «видит заказчиков»: the tab', await hasTab('orgs'));
        await tab('orgs');
        const [cid] = orgByName('АО «Пример-Девелопмент»'), [sid] = orgByName('ООО «СтройПоставка»');
        await click(`.org-t [data-act="open-org"][data-id="${cid}"]`); await wait(500);
        check('… customer contacts are open', (await js(`document.querySelector('[data-oc="0"][data-k="name"]')?.value`)) === 'Иванов Иван Иванович');
        check('… no contracts column', !(await js(`[...document.querySelectorAll('.org-t th')].some(t => t.textContent === 'Договоры')`)));
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(200);
        await click(`.org-t [data-act="open-org"][data-id="${sid}"]`); await wait(500);
        check('… a supplier\'s card is closed', (await text('#dform')).includes('открыты ГИПу') && !(await js(`!!document.querySelector('#o-inn')`)));
        await shot('49-03-chief-closed');
        await js(`document.querySelector('[data-act="request-close"]').click()`); await wait(200);
        await js(`window.api.switchUser('u-gip')`); await wait(600);
      });

      await step('4.9.1: requisites by INN from the registry (DaData stand-in)', async () => {
        await tab('orgs');
        await click('[data-act="new-org"]'); await wait(700);
        check('no key: the card offers to enter it', (await text('#o-party')).includes('ключ DaData'));
        await click('#o-party [data-act="party-key"]'); await wait(200);
        await setVal('#pk-key', 'не ключ'); await js(`document.querySelector('#pk-title').closest('form').requestSubmit()`); await wait(300);
        check('a wrong key is refused', (await text('#pk-err')).includes('латинские'));
        await setVal('#pk-key', '0123456789abcdef0123456789abcdef01234567'); await js(`document.querySelector('#pk-title').closest('form').requestSubmit()`); await wait(500);
        const st = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
        check('the key is kept encrypted', String(st.dadataKey || '').startsWith('dpapi:') && !String(st.dadataKey).includes('0123456789abcdef'), String(st.dadataKey).slice(0, 12));
        await setVal('#o-inn', '7736050003'); await wait(1200);
        const vals = await js(`Object.fromEntries(['name', 'fullName', 'kpp', 'ogrn', 'address', 'director'].map(k => [k, document.querySelector('#dform [name="' + k + '"]').value]))`);
        check('typed INN → the card fills by itself', vals.name === 'ПАО «ГАЗПРОМ»' && vals.kpp === '772801001' && vals.ogrn === '1027700070518' && vals.fullName.startsWith('ПУБЛИЧНОЕ') && vals.address.startsWith('197229') && vals.director.includes('Миллер'), JSON.stringify(vals));
        check('… and says what it filled', (await text('#o-party')).includes('Заполнено из ЕГРЮЛ'));
        await setVal('#o-name', 'Газпром (наш)'); await setVal('#o-kpp', '000000000');
        await click('[data-act="party-fill"]'); await wait(800);
        check('hand-typed values are not overwritten, differences offered', (await js(`document.querySelector('#o-name').value`)) === 'Газпром (наш)' && (await js(`document.querySelectorAll('.party-row').length`)) === 2);
        await shot('49-05-party');
        await click('[data-act="party-take"][data-k="kpp"]'); await wait(200);
        check('«Заменить» takes the registry value', (await js(`document.querySelector('#o-kpp').value`)) === '772801001' && (await js(`document.querySelector('#o-name').value`)) === 'Газпром (наш)');
        await setChk('[name="role-customer"]', false); await setChk('[name="role-supplier"]', true);
        await save();
        const o = orgByName('Газпром (наш)')?.[1];
        check('saved with the full name and the director', o && o.fullName.includes('ГАЗПРОМ') && o.director.includes('Миллер') && o.ogrn === '1027700070518', JSON.stringify(o));
        await click('[data-act="new-org"]'); await wait(500);
        await setVal('#o-inn', '500100732259'); await wait(1200);
        check('a liquidated ИП is flagged', (await text('#o-party')).includes('ликвидирована') && (await js(`document.querySelector('#o-kpp').value`)) === '');
        await setVal('#o-inn', '2703000150'); await wait(1200);
        check('an INN not in the registry is said so', (await text('#o-party')).includes('не найден'));
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(200);
      });

      await step('trash and back', async () => {
        await tab('orgs');
        const [id] = orgByName('ООО «СтройПоставка»');
        await click(`.org-t [data-act="open-org"][data-id="${id}"]`); await wait(400);
        await click('[data-act="ask-delete"]'); await wait(500);
        check('in the trash', !!data().orgs[id].deletedAt && !(await js(`!!document.querySelector('.org-t [data-id="${id}"]')`)));
        await js(`window.api.write([{ type: 'update', col: 'orgs', id: '${id}', data: { deletedAt: null } }], { action: 'test' })`); await wait(500);
        check('restored', !!(await js(`!!document.querySelector('.org-t [data-id="${id}"]')`)));
      });

      await step('cabinet: a login for a contact person sees all projects of the customer, a new project joins', async () => {
        const [oid] = orgByName('АО «Пример-Девелопмент»');
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="demo-p1"]'); await wait(400);
        await click('[data-act="dtab"][data-id="cust"]'); await wait(300);
        await click('[data-act="cab-local-start"]'); await wait(1800);
        check('project cabinet box points to the company card', (await text('#cab-box')).includes('карточке организации'));
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(200);
        await tab('orgs');
        await click(`.org-t [data-act="open-org"][data-id="${oid}"]`); await wait(1200);
        const kid = data().orgs[oid].contacts[0].id;
        await setVal(`#org-login-${kid}`, 'ivanov'); await click(`[data-act="org-cab-open"][data-id="${kid}"]`); await wait(1500);
        const cs = (await js(`window.api.cabinetCustomers()`)).customers || [];
        const c = cs.find(x => x.login === 'ivanov');
        const want = Object.entries(data().projects).filter(([, p]) => p.customerId === oid).map(([pid]) => pid).sort();
        check('the login sees all 3 projects', c && c.projectIds.slice().sort().join() === want.join(), JSON.stringify(c?.projectIds));
        check('the contact keeps the login', data().orgs[oid].contacts[0].cabinetId === c?.id);
        check('the password is shown once', (await text('#org-cab')).includes('Пароль'));
        check('unpublished projects are named', (await text('#org-cab')).includes('Не опубликованы'));
        await js(`document.querySelector('#org-cab').scrollIntoView()`); await wait(200);
        await shot('49-04-cabinet');
        await js(`document.querySelector('[data-act="discard"]').click()`); await wait(200);
        await js(`window.api.write([{ type: 'update', col: 'projects', id: 'v49-p3', data: { customerId: '', client: 'Другой' } }], { action: 'test' })`); await wait(400);
        await tab('projects');
        await js(`document.querySelector('[data-act="project-back"]')?.click()`); await wait(150);
        await click('[data-act="open-project"][data-id="v49-p3"]'); await wait(500);
        await setVal('#pr-client', 'АО «Пример-Девелопмент»'); await save(); await wait(1200);
        const c2 = ((await js(`window.api.cabinetCustomers()`)).customers || []).find(x => x.login === 'ivanov');
        check('a project given to the customer joins the login', c2?.projectIds.includes('v49-p3'), JSON.stringify(c2?.projectIds));
      });
    } catch (e) { log.push('[smoke error] ' + (e.stack || e)); }
    fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
    app.exit(0);
  });
});
require('../src/main.js');

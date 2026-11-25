/* ---------- «Контрагенты» (4.9): customers, contractors, suppliers — one catalogue of companies ---------- */
// A company has roles (one may be a customer and a supplier at once) and contact people; a project points to its
// customer (customerId; the name stays in `client` for reports and the customer page). Customers with their contacts
// are open to the GIP and to a chief with «видит заказчиков и их контакты», contractors and suppliers with contracts —
// to the budget people; the rest of the team sees names only (src/renderer/access.js).
let orgFilter = (v => (['all', 'customer', 'contractor', 'supplier'].includes(v) ? v : 'all'))(loadLocal('orgFilter', 'all'));
let orgQ = '', orgQTimer = null;
const orgDismissed = new Set(loadLocal('orgDismissed', [])); // «Заказчики из проектов» the user waved away
const ORG_TONE = { customer: 'ok', contractor: 'warn', supplier: 'idle' };
const LOGIN_RE = /^[a-zA-Z0-9._@-]{3,80}$/;
const orgsArr = () => [...(state.orgs?.values() || [])].sort(byName);
const orgProjects = id => [...state.projects.values()].filter(p => p.customerId === id).sort(byName);
const orgChips = o => A.orgRoles(o).map(r => `<span class="chip tone-${ORG_TONE[r]}">${A.ORG_ROLES[r].toLowerCase()}</span>`).join(' ');
const contractSum = o => (o.contracts || []).reduce((s, c) => s + (Number(c.sum) || 0), 0);
// The customer from the catalogue for a typed name: quotes and the legal form do not matter («Альфа строй» = ООО «Альфа-Строй»).
const customerByName = name => { const k = L.orgKey(name); return k ? orgsArr().find(o => A.isCustomerOrg(o) && L.orgKey(o.name) === k) || null : null; };
// Contracts are kept for contractors and suppliers (a customer's contract is the project's «Договор»).
const orgContractsOn = roles => roles.some(r => r !== 'customer') && A.canSeeOrgContracts(state.me, { roles });
const orgRoleLocked = r => (r === 'customer' ? !A.canSeeContacts(state.me) : !A.canSeeMoney(state.me));

function viewOrgs() {
  const all = orgsArr(), showMoney = A.isGip(state.me) || A.canSeeMoney(state.me);
  const count = r => (r === 'all' ? all.length : all.filter(o => A.orgRoles(o).includes(r)).length);
  const norm = v => String(v ?? '').toLowerCase().replace(/ё/g, 'е');
  const words = norm(orgQ).split(/\s+/).filter(Boolean);
  const hay = o => norm([o.name, o.inn, o.address, o.phone, o.email, ...(o.contacts || []).flatMap(c => [c.name, c.position, c.phone, c.email])].join(' '));
  const list = all.filter(o => (orgFilter === 'all' || A.orgRoles(o).includes(orgFilter)) && words.every(w => hay(o).includes(w)));
  const seg = `<span class="seg">${[['all', 'Все'], ['customer', 'Заказчики'], ['contractor', 'Подрядчики'], ['supplier', 'Поставщики']]
    .map(([k, l]) => `<button class="btn sm ${orgFilter === k ? 'on' : ''}" type="button" data-act="org-filter" data-v="${k}" aria-pressed="${orgFilter === k}">${l} <span class="cnt">${count(k)}</span></button>`).join('')}</span>`;
  return `<div class="people-h"><h2>Контрагенты</h2>${tip('orgs', 'Организации, с которыми работаем. Одна фирма может быть и заказчиком, и подрядчиком. У заказчика — контактные лица со своим входом в кабинет: каждый видит все проекты своей организации.', 'inline')}
      <span class="spacer"></span>${seg}<input id="org-q" class="org-q" type="search" placeholder="Название, ИНН, контакт" value="${esc(orgQ)}" aria-label="Поиск контрагента">${partyOn() && all.some(o => o.inn) ? '<button class="btn sm" type="button" data-act="orgcheck" title="Проверить по реестру всех, у кого записан ИНН">Сверить с ЕГРЮЛ</button>' : ''}<button class="btn sm" type="button" data-act="new-org">+ Контрагент</button></div>
    ${orgMigration()}
    ${list.length ? `<div class="tablewrap"><table class="staff-t org-t"><thead><tr><th>Организация</th><th>ИНН</th><th>Контакт</th><th class="r">Проектов</th>${showMoney ? '<th class="r">Договоры</th>' : ''}</tr></thead><tbody>
      ${list.map(o => {
        const n = orgProjects(o.id).length, k = (o.contacts || [])[0];
        return `<tr class="row" data-act="open-org" data-id="${esc(o.id)}" title="Открыть карточку"><td><b>${esc(o.name)}</b> ${orgChips(o)}${o.regStatus ? ` <span class="chip tone-bad" title="По ЕГРЮЛ${o.regCheckedAt ? ' на ' + fmtDate(o.regCheckedAt) : ''}">${esc(o.regStatus)}</span>` : ''}</td><td class="num hint">${esc(o.inn || '')}</td>
          <td class="hint">${k ? `${esc(k.name)}${k.position ? `, ${esc(k.position)}` : ''}${k.phone ? ` · ${esc(k.phone)}` : ''}${o.contacts.length > 1 ? ` <span class="cnt">+${o.contacts.length - 1}</span>` : ''}` : ''}</td>
          <td class="r num">${n || '—'}</td>${showMoney ? `<td class="r num">${o.contracts?.length ? `${o.contracts.length} · ${money(contractSum(o))}${o.contracts.some(c => contractPaid(c)) ? ` <span class="hint">· остаток ${money(o.contracts.reduce((s, c) => s + contractLeft(c), 0))}</span>` : ''}` : '—'}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`
      : `<p class="hint people-empty">${all.length ? 'Ничего не нашлось — смените фильтр или строку поиска.' : 'Каталог пока пуст. Добавьте заказчиков и подрядчиков кнопкой «+ Контрагент».'}</p>`}`;
}

/* ----- moving the old text «Заказчик» of projects into the catalogue (the user confirms each group) ----- */
function orgSuggestions() {
  const groups = new Map();
  for (const p of state.projects.values()) {
    if (p.customerId && state.orgs.has(p.customerId)) continue;
    const k = L.orgKey(p.client);
    if (!k || orgDismissed.has(k)) continue;
    const g = groups.get(k) || { key: k, names: [], projects: [] };
    if (!g.names.includes(p.client.trim())) g.names.push(p.client.trim());
    g.projects.push(p);
    groups.set(k, g);
  }
  const all = orgsArr();
  return [...groups.values()].map(g => ({ ...g, match: all.find(o => A.isCustomerOrg(o) && L.orgKey(o.name) === g.key) || null }));
}
function orgMigration() {
  if (!A.canSeeContacts(state.me) || !A.canManageCatalog(state.me)) return '';
  const list = orgSuggestions();
  if (!list.length) return '';
  const customers = orgsArr().filter(A.isCustomerOrg);
  return `<section class="panel org-mig"><div class="panel-h"><h3>Заказчики из проектов</h3><span class="meta">${list.length}</span></div>
    <p class="hint">В этих проектах заказчик записан просто текстом. Создайте его в каталоге или выберите того, кто уже есть, — проекты привяжутся к нему, и в кабинете заказчик увидит их все. Похожие написания собраны вместе.</p>
    ${list.map(g => `<div class="org-sug" data-key="${esc(g.key)}"><div class="grow"><b>${esc(g.names[0])}</b>${g.names.length > 1 ? ` <span class="hint">и как ${g.names.slice(1).map(n => `«${esc(n)}»`).join(', ')}</span>` : ''}<br><span class="hint">${g.projects.map(p => esc(p.name)).join(' · ')}</span></div>
      <select class="org-sug-to" aria-label="К кому привязать"><option value="">новый заказчик «${esc(g.names[0])}»</option>${customers.map(o => `<option value="${esc(o.id)}"${g.match?.id === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
      <button class="btn sm primary" type="button" data-act="org-mig-link">Привязать проекты (${g.projects.length})</button><button class="btn ghostbtn sm" type="button" data-act="org-mig-skip">Не предлагать</button></div>`).join('')}</section>`;
}
async function orgMigLink(el) {
  const row = el.closest('.org-sug'), g = row && orgSuggestions().find(x => x.key === row.dataset.key);
  if (!g) return;
  let id = row.querySelector('.org-sug-to').value;
  const ops = [];
  if (!state.orgs.has(id)) {
    id = newId();
    ops.push(op.set('orgs', id, { name: g.names[0], roles: ['customer'], contacts: [], createdAt: new Date().toISOString(), createdBy: state.me?.id || '' }));
  }
  const name = state.orgs.get(id)?.name || g.names[0];
  for (const p of g.projects) ops.push(op.update('projects', p.id, { customerId: id, client: name }));
  if (await write(ops, `${name}: привязано проектов — ${g.projects.length}`)) syncOrgCabinet(id);
}

/* ----- the card of a company ----- */
function openOrg(id, preset = {}) {
  const o = id ? state.orgs.get(id) : { roles: [orgFilter !== 'all' && !orgRoleLocked(orgFilter) ? orgFilter : A.canSeeContacts(state.me) ? 'customer' : 'contractor'], ...preset };
  if (!o) return toast('Контрагент не найден.', true);
  if (id) noteRecent('org', id);
  state.drawer = { kind: 'org', id };
  const projectsBox = () => {
    const ps = id ? orgProjects(id) : [];
    return ps.length ? `<div class="org-projs">${ps.map(p => `<button class="linkbtn" type="button" data-act="open-project" data-id="${esc(p.id)}">${esc(p.name)}${p.code ? ` <span class="hint">${esc(p.code)}</span>` : ''}${p.archived ? ' <span class="hint">в архиве</span>' : ''}</button>`).join('')}</div>`
      : '<p class="hint">Проектов пока нет. Заказчик выбирается в окне проекта, в поле «Заказчик».</p>';
  };
  if (id && !A.orgCard(state.me, o)) {
    state.draft = null;
    drawerShell({ title: esc(o.name), form: false,
      body: `<p>${orgChips(o)}</p><p class="hint">Реквизиты и контакты этой организации открыты ГИПу и тем, кому он дал доступ ${A.isCustomerOrg(o) ? 'к заказчикам и их контактам' : 'к бюджету'}.</p>${A.isCustomerOrg(o) ? `<div class="sub"><h3>Проекты заказчика</h3>${projectsBox()}</div>` : ''}` });
    return;
  }
  const roles = A.orgRoles(o);
  state.draft = { contacts: structuredClone(o.contacts || []), contracts: structuredClone(o.contracts || []).map(c => ({ ...c, sum: c.sum ? String(c.sum) : '' })) };
  const f = (name, label, attrs = '', wide = false) => `<div class="f${wide ? ' wide' : ''}"><label for="o-${name}">${label}</label><input id="o-${name}" name="${name}" value="${esc(o[name] || '')}" ${attrs}></div>`;
  drawerShell({
    title: id ? esc(o.name) : 'Новый контрагент',
    wide: !!id,
    body: `<div class="fgrid">
      <div class="f wide"><label class="req" for="o-name">Название</label><input id="o-name" name="name" value="${esc(o.name || '')}" placeholder="ООО «Альфа-Строй»" maxlength="200"></div>
      <div class="f wide"><span class="lbl-t">Роль</span><div class="org-roles">${Object.entries(A.ORG_ROLES).map(([k, l]) => `<label class="chk"><input type="checkbox" name="role-${k}" data-org-role${roles.includes(k) ? ' checked' : ''}${orgRoleLocked(k) ? ' disabled title="Эту роль отмечает ГИП"' : ''}> ${l}</label>`).join('')}</div>
        <span class="hint">Одна организация может быть и заказчиком, и подрядчиком.</span></div>
      <div class="f wide"><label for="o-inn">ИНН</label><div class="row-in"><input id="o-inn" name="inn" value="${esc(o.inn || '')}" inputmode="numeric" maxlength="14" placeholder="10 или 12 цифр — остальное заполнится из ЕГРЮЛ">${partyServer() ? `<button class="btn" type="button" data-act="party-fill"${partyOn() ? '' : ' disabled title="На сервере нет ключа DaData"'}>Заполнить по ИНН</button>` : ''}</div>
        <span class="hint" id="o-inn-hint"></span><div id="o-party" class="o-party" hidden></div></div>
      ${f('fullName', 'Полное наименование', 'maxlength="500" placeholder="Общество с ограниченной ответственностью «…»"', true)}
      ${f('kpp', 'КПП', 'inputmode="numeric" maxlength="9"')}${f('ogrn', 'ОГРН / ОГРНИП', 'inputmode="numeric" maxlength="15"')}
      ${f('director', 'Руководитель', 'maxlength="200" placeholder="Генеральный директор Иванов Иван Иванович"', true)}
      ${f('phone', 'Телефон', 'type="tel" maxlength="40" placeholder="+7 4217 00-00-00"')}${f('email', 'Почта', 'type="email" maxlength="120"')}${f('site', 'Сайт', 'maxlength="120"')}
      ${f('address', 'Адрес', 'maxlength="200" placeholder="681000, г. Комсомольск-на-Амуре, …"', true)}
      <details class="f wide more"${o.requisites || o.note ? ' open' : ''}><summary>Банковские реквизиты, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="o-req">Банковские реквизиты</label><textarea id="o-req" name="requisites" maxlength="1000" placeholder="р/с, банк, БИК, к/с">${esc(o.requisites || '')}</textarea></div>
        <div class="f wide"><label for="o-note">Примечание</label><textarea id="o-note" name="note" maxlength="2000">${esc(o.note || '')}</textarea></div>
      </div></details>
    </div>
    <div class="sub"><h3>Контактные лица</h3><div id="org-contacts"></div></div>
    <div class="sub" id="org-contracts-sub"${orgContractsOn(roles) ? '' : ' hidden'}><h3>Договоры</h3><div id="org-contracts"></div></div>
    ${id ? orgPeopleHtml(id) : ''}
    ${id && A.isCustomerOrg(o) ? `<div class="sub"><h3>Проекты заказчика</h3>${projectsBox()}</div><div id="org-cab"></div>` : ''}
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button><span class="spacer"></span>
      ${id ? '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>' : ''}`,
  });
  renderOrgContacts(); renderOrgContracts(); orgInnHint(); renderOrgCabinet();
  partyLast = String(o.inn || ''); partySeen = null; partyDiff = [];
  partyIntro({ ...o, id });
  markClean();
  if (!id) $('#o-inn').focus();
}
function renderOrgContacts() {
  const box = $('#org-contacts');
  if (!box || !state.draft) return;
  const list = state.draft.contacts;
  box.innerHTML = `${list.length ? `<div class="org-rows">${list.map((c, i) => `<div class="org-row org-contact">
      <input data-oc="${i}" data-k="name" value="${esc(c.name || '')}" placeholder="ФИО" maxlength="160" aria-label="ФИО">
      <input data-oc="${i}" data-k="position" value="${esc(c.position || '')}" placeholder="Должность: директор, технадзор" maxlength="120" aria-label="Должность">
      <input data-oc="${i}" data-k="phone" type="tel" value="${esc(c.phone || '')}" placeholder="Телефон" maxlength="40" aria-label="Телефон">
      <input data-oc="${i}" data-k="email" type="email" value="${esc(c.email || '')}" placeholder="Почта" maxlength="120" aria-label="Почта">
      <button class="icon" type="button" data-act="org-contact-del" data-i="${i}" title="Убрать контактное лицо" aria-label="Убрать">✕</button></div>`).join('')}</div>` : '<p class="hint">Пока никого.</p>'}
    <button class="btn sm" type="button" data-act="org-contact-add">+ Контактное лицо</button>`;
}
function renderOrgContracts() {
  const box = $('#org-contracts');
  if (!box || !state.draft) return;
  const list = state.draft.contracts, projs = [...state.projects.values()].sort(byName);
  const total = list.reduce((s, c) => s + (money0(c.sum) || 0), 0);
  box.innerHTML = `${list.length ? `<div class="org-rows">${list.map((c, i) => `<div class="org-row org-contract">
      <input data-ok="${i}" data-k="no" value="${esc(c.no || '')}" placeholder="№ договора" maxlength="80" aria-label="Номер">
      <input data-ok="${i}" data-k="date" type="date" value="${esc(c.date || '')}" aria-label="Дата">
      <input data-ok="${i}" data-k="sum" value="${esc(c.sum || '')}" inputmode="decimal" placeholder="Сумма, ₽" maxlength="20" aria-label="Сумма">
      <input data-ok="${i}" data-k="subject" value="${esc(c.subject || '')}" placeholder="Предмет: раздел КР, поставка…" maxlength="200" aria-label="Предмет">
      <select data-ok="${i}" data-k="projectId" aria-label="Проект"><option value="">— проект —</option>${projs.map(p => `<option value="${esc(p.id)}"${p.id === c.projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <button class="icon" type="button" data-act="org-contract-del" data-i="${i}" title="Убрать договор" aria-label="Убрать">✕</button></div>
      ${contractPayHtml(c, i)}`).join('')}</div>
      <p class="hint" id="org-ctotal">${contractsTotalText(list)}</p>` : '<p class="hint">Договоров пока нет.</p>'}
    <button class="btn sm" type="button" data-act="org-contract-add">+ Договор</button>`;
}
// 4.11: payments under a contract — paid so far and what is left.
const contractPaid = c => (Array.isArray(c.payments) ? c.payments : []).reduce((s, x) => s + (Number(x.sum) || 0), 0);
const contractLeft = c => (money0(c.sum) || 0) - contractPaid(c);
function contractsTotalText(list) {
  const total = list.reduce((s, c) => s + (money0(c.sum) || 0), 0), paid = list.reduce((s, c) => s + contractPaid(c), 0);
  return `Всего по договорам: ${money(total)} · оплачено ${money(paid)} · остаток ${money(total - paid)}`;
}
function contractPayHtml(c, i) {
  const pays = Array.isArray(c.payments) ? c.payments : [], left = contractLeft(c);
  return `<div class="org-pay" data-pay="${i}"><span class="hint">Оплачено <b>${money(contractPaid(c))}</b> · остаток <b class="${left < 0 ? 'neg' : ''}">${money(left)}</b>${left < 0 ? ' — переплата' : ''}</span>
    ${pays.map((x, j) => `<span class="chip pay-chip">${esc(fmtDate(x.date))} — ${money(x.sum)}${x.note ? ` · ${esc(x.note)}` : ''}<button class="icon" type="button" data-act="org-pay-del" data-i="${i}" data-j="${j}" aria-label="Убрать оплату">✕</button></span>`).join('')}
    <span class="pay-add"><input type="date" id="org-pay-d-${i}" value="${todayStr()}" aria-label="Дата оплаты"><input id="org-pay-s-${i}" inputmode="decimal" placeholder="Сумма, ₽" maxlength="20" aria-label="Сумма оплаты"><input id="org-pay-n-${i}" placeholder="п/п №, за что" maxlength="80" aria-label="Примечание"><button class="btn ghostbtn sm" type="button" data-act="org-pay-add" data-i="${i}">+ оплата</button></span></div>`;
}
// The totals follow the typed sums without redrawing the rows (the caret stays put).
function renderOrgContractsTotal() {
  const el = $('#org-ctotal');
  if (!el || !state.draft) return;
  el.textContent = contractsTotalText(state.draft.contracts);
  state.draft.contracts.forEach((c, i) => { const box = document.querySelector(`#org-contracts [data-pay="${i}"] > .hint`); if (box) { const left = contractLeft(c); box.innerHTML = `Оплачено <b>${money(contractPaid(c))}</b> · остаток <b class="${left < 0 ? 'neg' : ''}">${money(left)}</b>${left < 0 ? ' — переплата' : ''}`; } });
}
function orgInnHint() {
  const el = $('#o-inn-hint'), v = val('inn');
  if (!el) return;
  const bad = L.innError(v), twin = !bad && v && orgsArr().find(x => x.id !== state.drawer?.id && x.inn === v.replace(/\s+/g, ''));
  el.textContent = bad || (twin ? `Уже есть в каталоге: ${twin.name}` : '');
  el.classList.toggle('neg', !!(bad || twin));
}
const orgRolesPicked = before => Object.keys(A.ORG_ROLES).filter(k => { const b = $(`#dform [name="role-${k}"]`); return b?.disabled ? A.orgRoles(before).includes(k) : !!b?.checked; });

async function submitOrg(keepOpen = false) {
  const { id } = state.drawer, before = id ? state.orgs.get(id) : {};
  formError('');
  const roles = orgRolesPicked(before);
  const data = { name: val('name'), fullName: val('fullName'), director: val('director'), roles, inn: val('inn').replace(/\s+/g, ''), kpp: val('kpp'), ogrn: val('ogrn'), phone: val('phone'), email: val('email'), site: val('site'), address: val('address'), requisites: val('requisites'), note: val('note') };
  if (!data.name) return formError('Укажите название организации.', '', 'name');
  if (!roles.length) return formError('Отметьте роль: заказчик, подрядчик или поставщик.');
  const innBad = L.innError(data.inn);
  if (innBad) return formError(innBad, '', 'inn');
  const twin = data.inn && orgsArr().find(x => x.id !== id && x.inn === data.inn);
  if (twin) return formError(`ИНН ${data.inn} уже есть в каталоге: «${twin.name}». Откройте её карточку и отметьте нужную роль там.`, '', 'inn');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
  const contacts = state.draft.contacts.map(c => ({ ...c, name: String(c.name || '').trim(), position: String(c.position || '').trim(), phone: String(c.phone || '').trim(), email: String(c.email || '').trim() }))
    .filter(c => c.name || c.position || c.phone || c.email || c.cabinetId);
  if (contacts.some(c => !c.name)) return formError('У каждого контактного лица укажите ФИО.');
  if (contacts.some(c => c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))) return formError('Проверьте почту контактного лица.');
  data.contacts = contacts;
  if (orgContractsOn(roles)) {
    const list = [];
    for (const c of state.draft.contracts) {
      const no = String(c.no || '').trim(), subject = String(c.subject || '').trim(), s = String(c.sum || '').trim();
      if (!no && !subject && !s && !c.date) continue;
      const sum = s ? parseMoney(s) : 0;
      if (Number.isNaN(sum) || sum < 0) return formError(`Сумма договора ${no ? `№ ${no}` : ''} — число, например 1 250 000.`);
      list.push({ id: c.id, no, date: isDate(c.date) ? c.date : '', sum, subject, projectId: state.projects.has(c.projectId) ? c.projectId : '',
        payments: (Array.isArray(c.payments) ? c.payments : []).filter(x => isDate(x.date) && Number(x.sum) > 0).map(x => ({ id: x.id, date: x.date, sum: Number(x.sum), note: String(x.note || '').slice(0, 80) })) });
    }
    data.contracts = list;
  }
  Object.assign(data, partyStamp(data.inn));
  const oid = id || newId();
  const ops = [id ? op.update('orgs', id, data) : op.set('orgs', oid, { ...data, createdAt: new Date().toISOString(), createdBy: state.me?.id || '' })];
  // Projects keep the customer's name in «client» (reports, the customer page): a renamed customer is renamed there too.
  if (id && A.canManageCatalog(state.me)) for (const p of orgProjects(id)) if (p.client !== data.name) ops.push(op.update('projects', p.id, { client: data.name }));
  if (!(await write(ops, id ? 'Контрагент сохранён' : 'Контрагент добавлен'))) return false;
  if (keepOpen) { await refresh(); openOrg(oid); return true; }
  closeDrawer();
  return true;
}

/* ----- requisites by INN from ЕГРЮЛ / ЕГРИП: the Сервер Пульта asks DaData with the team's key (4.9.2) ----- */
let partyLast = '', partyTimer = null, partyDiff = [], partySeen = null; // partySeen: { inn, status } of the last lookup
const PARTY_FIELDS = [['name', 'Название'], ['fullName', 'Полное наименование'], ['kpp', 'КПП'], ['ogrn', 'ОГРН'], ['address', 'Адрес'], ['director', 'Руководитель']];
const partyOn = () => !!state.remote?.server?.party;            // the server has the key
const partyServer = () => !!state.remote && !!api.partyLookup;   // this Пульт works with the server
// What the card says under the INN before any lookup.
function partyIntro(o) {
  const box = $('#o-party');
  if (!box) return;
  const gip = A.isGip(state.me);
  const msg = !partyServer() ? (o.id ? '' : 'Название, КПП, ОГРН, адрес и руководитель будут подтягиваться по ИНН, когда Пульт подключён к Серверу Пульта.')
    : !partyOn() ? `Заполнение по ИНН ждёт ключа DaData на сервере.${gip ? ' <button class="linkbtn" type="button" data-act="party-key">Ввести ключ…</button>' : ' Его вводит ГИП.'}`
    : o.regCheckedAt ? `Сверено с ЕГРЮЛ ${fmtDate(o.regCheckedAt)}${o.regStatus ? ` — <b class="neg">${esc(o.regStatus)}</b>` : ''}.` : '';
  box.hidden = !msg;
  box.innerHTML = msg ? `<p class="hint">${msg}</p>` : '';
}
// Typing the INN: once it is whole and right, the card asks the registry by itself. Empty fields fill, differing ones
// are offered with «Заменить» — nothing typed by hand is overwritten silently.
function partyAuto() {
  clearTimeout(partyTimer);
  const inn = val('inn').replace(/\s+/g, '');
  if (!partyOn() || !inn || L.innError(inn) || inn === partyLast) return;
  partyTimer = setTimeout(() => partyFill(true), 350);
}
async function partyFill(auto = false) {
  const box = $('#o-party');
  if (!box) return;
  const inn = val('inn').replace(/\s+/g, ''), bad = inn ? L.innError(inn) : 'Введите ИНН — 10 или 12 цифр.';
  if (bad) { if (!auto) formError(bad, '', 'inn'); return; }
  partyLast = inn;
  box.hidden = false;
  box.innerHTML = '<p class="hint">Ищем в ЕГРЮЛ…</p>';
  const r = await api.partyLookup([inn]);
  if (!$('#o-party') || val('inn').replace(/\s+/g, '') !== inn) return; // the card closed or the INN changed meanwhile
  const one = r.ok ? r.results?.[0] : r;
  if (!one?.ok) { box.innerHTML = `<p class="neg">${esc(one?.message || 'Не получилось.')}</p>`; return; }
  const p = one.party, filled = [];
  partySeen = { inn, status: p.status || '' };
  partyDiff = [];
  for (const [k, label] of PARTY_FIELDS) {
    const el = $(`#dform [name="${k}"]`), v = p[k];
    if (!el || !v) continue;
    if (!el.value.trim()) { el.value = v; filled.push(label); } else if (el.value.trim() !== v) partyDiff.push({ k, label, v });
  }
  renderPartyBox(p, filled);
}
const partyStatusLine = p => (p.status ? `<p class="neg"><b>По ЕГРЮЛ организация ${esc(p.status)}${p.liquidated ? ` (${fmtDate(p.liquidated)})` : ''}.</b> Проверьте, прежде чем заключать договор.</p>` : '');
function renderPartyBox(p, filled = []) {
  const box = $('#o-party');
  if (!box) return;
  box.innerHTML = `${partyStatusLine(p)}
    ${filled.length ? `<p class="okv">Заполнено из ЕГРЮЛ: ${filled.join(', ')}.</p>` : ''}
    ${partyDiff.length ? `<div class="party-diff">${partyDiff.map(d => `<div class="party-row"><span class="grow"><b>${esc(d.label)}</b> в реестре: ${esc(d.v)}</span><button class="btn ghostbtn sm" type="button" data-act="party-take" data-k="${d.k}">Заменить</button></div>`).join('')}
      ${partyDiff.length > 1 ? '<button class="btn sm" type="button" data-act="party-take-all">Заменить всё по реестру</button>' : ''}</div>` : filled.length ? '' : '<p class="hint">Сведения совпадают с ЕГРЮЛ.</p>'}`;
}
function partyTake(keys) {
  for (const k of keys) { const d = partyDiff.find(x => x.k === k), el = $(`#dform [name="${k}"]`); if (d && el) el.value = d.v; }
  partyDiff = partyDiff.filter(x => !keys.includes(x.k));
  const box = $('#o-party');
  if (box && !partyDiff.length) box.innerHTML = '<p class="okv">Заменено по реестру — не забудьте сохранить.</p>';
  else renderPartyBox({});
}
// What the save adds after a lookup of this INN: the date of the check and the registry status.
const partyStamp = inn => (partySeen && partySeen.inn === inn ? { regCheckedAt: todayStr(), regStatus: partySeen.status } : {});

// The team's key — the GIP enters it once, it stays on the server.
function openPartyKey() {
  const has = partyOn();
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-title" novalidate><h2 id="pk-title">Реквизиты по ИНН</h2>
    <p class="hint">Название, полное наименование, КПП, ОГРН, адрес и руководитель подтягиваются из ЕГРЮЛ и ЕГРИП через сервис DaData. Зарегистрируйтесь на dadata.ru (бесплатный тариф — до 10 000 запросов в день), в личном кабинете скопируйте «API-ключ» и вставьте сюда.</p>
    <p class="hint">Ключ хранится только на Сервере Пульта — на компьютеры и телефоны сотрудников он не попадает; в DaData уходит только ИНН. Работает у всех, кому открыты контрагенты.</p>
    <div class="f"><label for="pk-key">API-ключ DaData</label><input id="pk-key" type="password" autocomplete="off" maxlength="80" placeholder="${has ? 'сохранён — оставьте пустым, чтобы не менять' : '40 латинских букв и цифр'}"></div>
    <p class="neg" id="pk-err"></p>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button>${api.openDadata ? '<button class="btn ghostbtn" type="button" data-m="site">Открыть dadata.ru</button>' : ''}${has ? '<button class="btn" type="button" data-m="off">Удалить ключ</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelector('#pk-key').focus();
  const save = async k => {
    const r = await api.serverCall('partyKeySet', k);
    if (!r?.ok) { root.querySelector('#pk-err').textContent = r?.message || 'Не получилось.'; root.querySelector('#pk-key').focus(); return; }
    close();
    toast(r.has ? 'Ключ DaData на сервере — реквизиты по ИНН работают у всей команды' : 'Ключ DaData удалён с сервера');
    await refresh(); await remoteStatus();
    if ($('#o-party') && state.drawer?.kind === 'org') { partyLast = ''; if (r.has) partyFill(true); else partyIntro(state.orgs.get(state.drawer.id) || {}); }
    if (state.tab === 'orgs') renderNow();
  };
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'off') save('');
    if (e.target.dataset.m === 'site') api.openDadata();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const k = root.querySelector('#pk-key').value.trim(); if (!k && has) return close(); if (!k) { root.querySelector('#pk-err').textContent = 'Вставьте ключ.'; return; } save(k); });
}

/* ----- «Сверить с ЕГРЮЛ»: every counterparty with an INN at once; differences ticked, «Обновить отмеченное» ----- */
let orgCheck = null; // { running, done, total, noInn, error, items: [{ id, inn, party?, message?, diffs: [{ k, label, cur, v, on }] }] }
async function runOrgCheck() {
  const mine = orgsArr().filter(o => A.orgCard(state.me, o));
  const list = mine.filter(o => o.inn && !L.innError(o.inn));
  orgCheck = { running: true, done: 0, total: list.length, noInn: mine.filter(o => !o.inn).length, error: '', items: [] };
  state.drawer = { kind: 'orgcheck' };
  state.draft = null;
  drawerShell({ title: 'Сверка с ЕГРЮЛ', wide: true, form: false, body: '<div id="orgcheck-box"></div>' });
  renderOrgCheck();
  for (let i = 0; i < list.length; i += 20) {
    if (state.drawer?.kind !== 'orgcheck') return; // closed — stop asking
    const chunk = list.slice(i, i + 20);
    const r = await api.partyLookup(chunk.map(o => o.inn));
    if (!r.ok) { orgCheck.error = r.message; break; }
    const byInn = new Map(r.results.map(x => [x.inn, x]));
    for (const o of chunk) {
      const x = byInn.get(o.inn) || { ok: false, message: 'Нет ответа.' };
      if (!x.ok) { orgCheck.items.push({ id: o.id, inn: o.inn, message: x.message, diffs: [] }); if (x.fatal || /лимит|ключ|Ключ|связи/.test(x.message)) orgCheck.error = x.message; continue; }
      const p = x.party;
      // The short name is often our own («Газпром (наш)») — offered, not ticked; empty fields and real changes are ticked.
      const diffs = PARTY_FIELDS.filter(([k]) => p[k] && String(o[k] || '').trim() !== p[k])
        .map(([k, label]) => ({ k, label, cur: String(o[k] || '').trim(), v: p[k], on: k !== 'name' || !o[k] }));
      orgCheck.items.push({ id: o.id, inn: o.inn, party: p, diffs });
    }
    orgCheck.done = Math.min(list.length, i + chunk.length);
    renderOrgCheck();
    if (orgCheck.error) break;
  }
  orgCheck.running = false;
  renderOrgCheck();
}
function renderOrgCheck() {
  const box = $('#orgcheck-box'), c = orgCheck;
  if (!box || !c) return;
  const changed = c.items.filter(x => x.diffs.length), flagged = c.items.filter(x => x.party?.status), missing = c.items.filter(x => !x.party);
  const ticked = changed.reduce((n, x) => n + x.diffs.filter(d => d.on).length, 0);
  const show = c.items.filter(x => x.diffs.length || x.party?.status || !x.party);
  box.innerHTML = `<p>${c.running ? `Проверяем: ${c.done} из ${c.total}…` : `Проверено: ${c.done} из ${c.total}.`}
      ${changed.length ? ` Расхождения: <b>${changed.length}</b>.` : ''}${flagged.length ? ` <span class="neg">Не действуют: ${flagged.length}.</span>` : ''}${missing.length ? ` Не найдены: ${missing.length}.` : ''}${c.noInn ? ` <span class="hint">Без ИНН (не проверить): ${c.noInn}.</span>` : ''}</p>
    ${c.error ? `<p class="neg">${esc(c.error)}</p>` : ''}
    ${!c.running && !show.length && !c.error ? '<p class="okv">Все сведения совпадают с ЕГРЮЛ.</p>' : ''}
    ${show.map((x, i) => { const o = state.orgs.get(x.id); if (!o) return ''; const n = c.items.indexOf(x);
      return `<div class="oc-item"><div class="oc-h"><button class="linkbtn" type="button" data-act="open-org" data-id="${esc(o.id)}"><b>${esc(o.name)}</b></button> <span class="hint">ИНН ${esc(x.inn)}</span>
        ${x.party?.status ? ` <span class="chip tone-bad">${esc(x.party.status)}${x.party.liquidated ? ' ' + fmtDate(x.party.liquidated) : ''}</span>` : ''}${x.party ? '' : ` <span class="hint">${esc(x.message || '')}</span>`}</div>
        ${x.diffs.map(d => `<label class="chk oc-row"><input type="checkbox" data-oc-pick="${n}:${d.k}"${d.on ? ' checked' : ''}> <span class="oc-f">${esc(d.label)}</span>
          <span class="oc-v">${d.cur ? `<s class="hint">${esc(d.cur)}</s> → ` : '<span class="hint">пусто</span> → '}${esc(d.v)}</span></label>`).join('')}</div>`; }).join('')}
    ${changed.length || flagged.length ? `<div class="oc-acts"><button class="btn primary" type="button" data-act="orgcheck-apply"${c.running ? ' disabled title="Дождитесь окончания проверки"' : ''}>Обновить отмеченное (${ticked})</button>
      <button class="btn ghostbtn sm" type="button" data-act="orgcheck-all" data-on="1">Отметить всё</button><button class="btn ghostbtn sm" type="button" data-act="orgcheck-all" data-on="0">Снять всё</button></div>` : ''}`;
}
async function applyOrgCheck() {
  const c = orgCheck, today = todayStr(), ops = [];
  if (!c || c.running) return;
  let fields = 0;
  for (const x of c.items) {
    const o = state.orgs.get(x.id);
    if (!o || !x.party) continue;
    const patch = { regCheckedAt: today, regStatus: x.party.status || '' };
    for (const d of x.diffs) if (d.on) { patch[d.k] = d.v; fields++; }
    ops.push(op.update('orgs', o.id, patch));
    if (patch.name && patch.name !== o.name && A.canManageCatalog(state.me)) for (const p of orgProjects(o.id)) ops.push(op.update('projects', p.id, { client: patch.name }));
  }
  if (!ops.length) return;
  if (await write(ops, fields ? `Обновлено по ЕГРЮЛ: полей ${fields}` : 'Отмечено: сверено с ЕГРЮЛ')) { closeDrawer(); orgCheck = null; }
}

/* ----- the customer cabinet from the company's card: a login for each contact person, all projects of the customer ----- */
function renderOrgCabinet() {
  const box = $('#org-cab'), id = state.drawer?.kind === 'org' && state.drawer.id, o = id && state.orgs.get(id);
  if (!box || !o) return;
  if (!cab?.allowed || !A.canSeeContacts(state.me)) { box.innerHTML = ''; return; }
  if (!cab.configured) {
    box.innerHTML = '<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Кабинет пока не запущен. Запустите его в любом проекте на вкладке «Для заказчика» (или подключите сервер Пульта) — тогда здесь можно будет открыть вход каждому контактному лицу.</p></div>';
    return;
  }
  if (!cabCustomers && !cabLoadErr) { loadCabCustomers(); box.innerHTML = '<div class="sub cab"><h3>Кабинет заказчика</h3><p class="hint">Загружаем…</p></div>'; return; }
  const ps = orgProjects(id), want = ps.map(p => p.id);
  const linkedIds = new Set(orgsArr().flatMap(x => (x.contacts || []).map(k => k.cabinetId)).filter(Boolean));
  const free = (cabCustomers || []).filter(c => !linkedIds.has(c.id));
  const unpub = ps.filter(p => !cab.published[p.id]);
  const person = k => {
    const c = k.cabinetId && cabCustomer(k.cabinetId);
    if (!c) return `<div class="cab-person"><div class="grow"><b>${esc(k.name)}</b>${k.position ? ` <span class="hint">${esc(k.position)}</span>` : ''}<br><span class="hint">${k.cabinetId ? 'вход удалён в кабинете' : 'входа нет'}</span></div>
      <div class="acts"><input id="org-login-${esc(k.id)}" class="org-login" placeholder="логин: ivanov" maxlength="80" aria-label="Логин для ${esc(k.name)}"><button class="btn sm" type="button" data-act="org-cab-open" data-id="${esc(k.id)}">Открыть вход</button></div></div>`;
    const miss = want.filter(pid => !c.projectIds.includes(pid)).length;
    return `<div class="cab-person"><div class="grow"><b>${esc(k.name)}</b> <span class="hint">${esc(c.login)}</span>${c.disabled ? ' <span class="chip tone-bad">вход закрыт</span>' : ''}${miss ? ` <span class="chip tone-warn">не видит проектов: ${miss}</span>` : ''}<br><span class="hint">${c.lastLoginAt ? 'последний вход ' + cabTime(c.lastLoginAt) : 'ещё не входил'}</span></div>
      <div class="acts"><button class="btn ghostbtn sm" type="button" data-act="cab-reset" data-id="${esc(c.id)}">Новый пароль</button><button class="btn ghostbtn sm" type="button" data-act="cab-toggle" data-id="${esc(c.id)}">${c.disabled ? 'Открыть вход' : 'Закрыть вход'}</button></div></div>`;
  };
  const anyMiss = (o.contacts || []).some(k => { const c = k.cabinetId && cabCustomer(k.cabinetId); return c && want.some(pid => !c.projectIds.includes(pid)); });
  box.innerHTML = `<div class="sub cab"><h3>Кабинет заказчика</h3>
    <p class="hint">Каждое контактное лицо входит под своим логином и видит все проекты организации${ps.length ? ` (сейчас ${ps.length})` : ''}. Новый проект этого заказчика добавится в кабинет сам.</p>
    ${cabLoadErr ? `<p class="neg">${esc(cabLoadErr)} <button class="linkbtn" type="button" data-act="cab-reload">Повторить</button></p>` : ''}
    ${unpub.length ? `<p class="warnv">Не опубликованы: ${unpub.map(p => esc(p.name)).join(', ')} — заказчик их пока не видит. <button class="btn sm" type="button" data-act="org-cab-publish">Опубликовать</button></p>` : ''}
    ${cabPw ? `<div class="cab-pw"><b>Доступ для ${esc(cabPw.name)}</b><div>Адрес: <code>${esc(cab.publicUrl || cab.url)}</code></div><div>Логин: <code>${esc(cabPw.login)}</code> · Пароль: <code>${esc(cabPw.password)}</code></div>
      <span class="hint">Пароль показывается один раз — передайте его заказчику.</span><div><button class="btn sm" type="button" data-act="cab-pw-copy">Скопировать для заказчика</button><button class="btn ghostbtn sm" type="button" data-act="cab-pw-hide">Скрыть</button></div></div>` : ''}
    ${(o.contacts || []).length ? `<div class="cab-people">${o.contacts.map(person).join('')}</div>` : '<p class="hint">Добавьте контактных лиц выше и сохраните карточку — здесь появится кнопка «Открыть вход».</p>'}
    ${anyMiss ? '<div class="cab-row"><button class="btn sm" type="button" data-act="org-cab-sync">Открыть им все проекты заказчика</button></div>' : ''}
    ${free.length ? `<div class="row-in cab-add"><select id="org-cab-free" aria-label="Вход, который уже есть в кабинете"><option value="">— уже есть в кабинете, ни к кому не привязан —</option>${free.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.login)})</option>`).join('')}</select><button class="btn sm" type="button" data-act="org-cab-adopt">Привязать к организации</button></div>` : ''}
  </div>`;
}
// The draft follows what was saved straight away (a login), so «Сохранить» later does not drop it.
async function orgSaveContacts(o, contacts, okText) {
  const clean = formSnapshot() === state.dirtyBase;
  if (!(await write(op.update('orgs', o.id, { contacts }), okText))) return false;
  if (state.draft && state.drawer?.id === o.id) {
    for (const k of contacts) { const d = state.draft.contacts.find(x => x.id === k.id); if (d) d.cabinetId = k.cabinetId; else state.draft.contacts.push({ ...k }); }
    renderOrgContacts();
    if (clean) markClean();
  }
  return true;
}
async function orgCabOpen(kid) {
  const o = state.orgs.get(state.drawer?.id), k = o?.contacts?.find(x => x.id === kid);
  if (!k) return;
  const login = ($(`#org-login-${kid}`)?.value || '').trim();
  if (!LOGIN_RE.test(login)) return toast('Логин — латиница, цифры, точка, дефис; от 3 знаков.', true);
  const r = await cabAction(api.cabinetCustomerCreate({ name: `${k.name}, ${o.name}`.slice(0, 120), login, projectIds: orgProjects(o.id).map(p => p.id) }));
  if (!r) return;
  cabPw = { name: r.customer.name, login: r.customer.login, password: r.password };
  await orgSaveContacts(o, o.contacts.map(x => (x.id === kid ? { ...x, cabinetId: r.customer.id } : x)), null);
  await loadCabCustomers(true);
}
async function orgCabAdopt() {
  const o = state.orgs.get(state.drawer?.id), c = cabCustomer($('#org-cab-free')?.value);
  if (!o || !c) return toast('Выберите вход из списка.', true);
  const name = c.name.replace(new RegExp(`,\\s*${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '').trim() || c.name;
  if (!(await orgSaveContacts(o, [...(o.contacts || []), { id: newId(), name, position: '', phone: '', email: '', cabinetId: c.id }], `${name}: вход привязан к «${o.name}»`))) return;
  await syncOrgCabinet(o.id);
  renderOrgCabinet();
}
// Every login of the customer's contact people sees all projects of the customer. Projects given by hand that belong
// to no customer of the catalogue stay; projects of another customer go.
async function syncOrgCabinet(orgId) {
  const o = state.orgs?.get(orgId);
  if (!o || !cab?.configured || !A.canSeeContacts(state.me)) return 0;
  if (!cabCustomers) await loadCabCustomers(true);
  if (!cabCustomers) return 0;
  const want = orgProjects(orgId).map(p => p.id);
  let n = 0;
  for (const k of o.contacts || []) {
    const c = k.cabinetId && cabCustomer(k.cabinetId);
    if (!c) continue;
    const ids = [...new Set([...c.projectIds.filter(pid => { const p = state.projects.get(pid); return !p || !state.orgs.has(p.customerId); }), ...want])];
    if (ids.length === c.projectIds.length && ids.every(x => c.projectIds.includes(x))) continue;
    const r = await api.cabinetCustomerUpdate(c.id, { projectIds: ids });
    if (r.ok) n++; else toast(r.message, true);
  }
  if (n) await loadCabCustomers(true);
  return n;
}
async function orgCabPublish() {
  const ps = orgProjects(state.drawer?.id).filter(p => !cab.published[p.id]);
  let n = 0;
  for (const p of ps) { const r = await api.cabinetPublish(p.id); if (r.ok) n++; else { toast(`${p.name}: ${r.message}`, true); break; } }
  if (n) toast(`Опубликовано проектов: ${n}`);
}

/* ----- «Заказчик» in the project window: picked from the catalogue (or typed — and added to it with one button) ----- */
function customerField(p) {
  const list = orgsArr().filter(A.isCustomerOrg);
  return `<div class="f"><label for="pr-client">Заказчик</label><input id="pr-client" name="client" value="${esc(p.client || '')}" placeholder="ООО «…»" maxlength="160" list="org-customers" autocomplete="off">
    <datalist id="org-customers">${list.map(o => `<option value="${esc(o.name)}"></option>`).join('')}</datalist><span class="hint" id="pr-client-hint"></span></div>`;
}
function customerHint() {
  const el = $('#pr-client-hint'), v = val('client');
  if (!el) return;
  const o = customerByName(v);
  el.innerHTML = o ? `из каталога контрагентов · <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(o.id)}">карточка</button>`
    : v ? `нет в каталоге${A.canSeeContacts(state.me) ? ' · <button class="linkbtn" type="button" data-act="org-from-project">добавить заказчика</button>' : ''}` : '';
}
// What the project form saves: the catalogue's customer when the name matches, otherwise the text as typed.
function customerOf(p, typed) {
  const o = customerByName(typed);
  if (o) return { customerId: o.id, client: o.name };
  if (p?.customerId && typed === p.client) return { customerId: p.customerId, client: typed }; // its company is in the trash
  return { customerId: '', client: typed };
}
async function orgFromProject() {
  const name = val('client');
  if (!name || customerByName(name)) return;
  const id = newId();
  if (await write(op.set('orgs', id, { name, roles: ['customer'], contacts: [], createdAt: new Date().toISOString(), createdBy: state.me?.id || '' }), `«${name}» — в каталоге заказчиков. Сохраните проект, чтобы привязать его.`)) {
    const dl = $('#org-customers');
    if (dl && !dl.querySelector(`option[value="${CSS.escape(name)}"]`)) dl.insertAdjacentHTML('beforeend', `<option value="${esc(name)}"></option>`);
    customerHint();
  }
}

/* ----- 4.11: a contractor (a person from «Люди → Подрядчики») and his ИП or firm in the catalogue ----- */
// Everyone who sees «Люди» sees the companies' names; picking is for whoever edits the contractor (GIP, chiefs).
const workOrgs = () => orgsArr().filter(o => A.orgRoles(o).some(r => r !== 'customer'));
function contractorOrgField(c) {
  const list = workOrgs(), cur = c.orgId && state.orgs.get(c.orgId);
  if (!list.length && !cur) return '';
  return `<div class="f wide"><label for="c-org">ИП или фирма (каталог контрагентов)</label><select id="c-org" name="orgId"><option value="">— не указана —</option>${(cur && !list.includes(cur) ? [cur, ...list] : list).map(o => `<option value="${esc(o.id)}"${o.id === c.orgId ? ' selected' : ''}>${esc(o.name)}${o.inn ? ` · ИНН ${esc(o.inn)}` : ''}</option>`).join('')}</select>
    <span class="hint">Через неё идут договоры и оплаты. Сама карточка подрядчика — для назначения на разделы.${cur && A.canSeeOrgs(state.me) ? ` <button class="linkbtn" type="button" data-act="open-org" data-id="${esc(cur.id)}">Карточка организации</button>` : ''}</span></div>`;
}
const contractorOrgPicked = () => { const v = $('#dform [name="orgId"]')?.value || ''; return state.orgs?.has(v) ? v : ''; };
// The people of a company: contractors linked to it (shown in its card).
function orgPeopleHtml(id) {
  const ps = [...state.contractors.values()].filter(c => c.orgId === id && !c.deletedAt).sort(byName);
  return ps.length ? `<div class="sub"><h3>Исполнители этой организации</h3><div class="org-projs">${ps.map(c => `<button class="linkbtn" type="button" data-act="open-contractor" data-id="${esc(c.id)}">${esc(c.name)}${c.specialty ? ` <span class="hint">${esc(c.specialty)}</span>` : ''}</button>`).join('')}</div></div>` : '';
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'org-filter': ({ el }) => { orgFilter = el.dataset.v; saveLocal('orgFilter', orgFilter); renderNow(); },
  'new-org': () => { setCreateMenu(false); openOrg(null); },
  'open-org': ({ e, id }) => { e.preventDefault(); openOrg(id); },
  'org-contact-add': () => { state.draft.contacts.push({ id: newId(), name: '', position: '', phone: '', email: '' }); renderOrgContacts(); $(`#org-contacts [data-oc="${state.draft.contacts.length - 1}"][data-k="name"]`)?.focus(); },
  'org-contact-del': ({ el }) => {
    const i = Number(el.dataset.i), k = state.draft.contacts[i];
    if (k?.cabinetId && cabCustomer(k.cabinetId)) return toast('У этого человека есть вход в кабинет — сначала закройте вход (ниже, в «Кабинете заказчика»).', true);
    state.draft.contacts.splice(i, 1); renderOrgContacts();
  },
  'org-contract-add': () => { state.draft.contracts.push({ id: newId(), no: '', date: '', sum: '', subject: '', projectId: '' }); renderOrgContracts(); $(`#org-contracts [data-ok="${state.draft.contracts.length - 1}"][data-k="no"]`)?.focus(); },
  'org-contract-del': ({ el }) => { state.draft.contracts.splice(Number(el.dataset.i), 1); renderOrgContracts(); },
  'org-pay-add': ({ el }) => {
    const i = Number(el.dataset.i), c = state.draft.contracts[i];
    const date = $(`#org-pay-d-${i}`)?.value, sum = parseMoney($(`#org-pay-s-${i}`)?.value || ''), note = ($(`#org-pay-n-${i}`)?.value || '').trim();
    if (!c || !isDate(date)) return toast('Укажите дату оплаты.', true);
    if (!(sum > 0)) { toast('Сумма оплаты — число больше нуля, например 150 000.', true); return $(`#org-pay-s-${i}`)?.focus(); }
    c.payments = [...(c.payments || []), { id: newId(), date, sum, note }].sort((a, b) => a.date.localeCompare(b.date));
    renderOrgContracts();
  },
  'org-pay-del': ({ el }) => { const c = state.draft.contracts[Number(el.dataset.i)]; if (c?.payments) { c.payments.splice(Number(el.dataset.j), 1); renderOrgContracts(); } },
  'org-mig-link': ({ el }) => { el.disabled = true; orgMigLink(el).finally(() => { el.disabled = false; }); },
  'org-mig-skip': ({ el }) => { const k = el.closest('.org-sug')?.dataset.key; if (k) { orgDismissed.add(k); saveLocal('orgDismissed', [...orgDismissed]); renderNow(); } },
  'org-cab-open': ({ id }) => { orgCabOpen(id); },
  'org-cab-adopt': () => { orgCabAdopt(); },
  'org-cab-sync': () => { syncOrgCabinet(state.drawer?.id).then(n => { toast(n ? `Доступ обновлён: входов — ${n}` : 'Все входы уже видят проекты заказчика'); renderOrgCabinet(); }); },
  'org-cab-publish': ({ el }) => { el.disabled = true; orgCabPublish().finally(() => { el.disabled = false; }); },
  'org-from-project': () => { orgFromProject(); },
  'party-fill': ({ el }) => { el.disabled = true; partyFill(false).finally(() => { el.disabled = false; }); },
  'party-take': ({ el }) => { partyTake([el.dataset.k]); },
  'party-take-all': () => { partyTake(partyDiff.map(d => d.k)); },
  'party-key': () => { openPartyKey(); },
  'orgcheck': () => { runOrgCheck(); },
  'orgcheck-apply': ({ el }) => { el.disabled = true; applyOrgCheck().finally(() => { el.disabled = false; }); },
  'orgcheck-all': ({ el }) => { for (const x of orgCheck?.items || []) for (const d of x.diffs) d.on = el.dataset.on === '1'; renderOrgCheck(); },
});

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
      <span class="spacer"></span>${seg}<input id="org-q" class="org-q" type="search" placeholder="Название, ИНН, контакт" value="${esc(orgQ)}" aria-label="Поиск контрагента"><button class="btn sm" type="button" data-act="new-org">+ Контрагент</button></div>
    ${orgMigration()}
    ${list.length ? `<div class="tablewrap"><table class="staff-t org-t"><thead><tr><th>Организация</th><th>ИНН</th><th>Контакт</th><th class="r">Проектов</th>${showMoney ? '<th class="r">Договоры</th>' : ''}</tr></thead><tbody>
      ${list.map(o => {
        const n = orgProjects(o.id).length, k = (o.contacts || [])[0];
        return `<tr class="row" data-act="open-org" data-id="${esc(o.id)}" title="Открыть карточку"><td><b>${esc(o.name)}</b> ${orgChips(o)}</td><td class="num hint">${esc(o.inn || '')}</td>
          <td class="hint">${k ? `${esc(k.name)}${k.position ? `, ${esc(k.position)}` : ''}${k.phone ? ` · ${esc(k.phone)}` : ''}${o.contacts.length > 1 ? ` <span class="cnt">+${o.contacts.length - 1}</span>` : ''}` : ''}</td>
          <td class="r num">${n || '—'}</td>${showMoney ? `<td class="r num">${o.contracts?.length ? `${o.contracts.length} · ${money(contractSum(o))}` : '—'}</td>` : ''}</tr>`;
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
      <div class="f wide"><label for="o-inn">ИНН</label><div class="row-in"><input id="o-inn" name="inn" value="${esc(o.inn || '')}" inputmode="numeric" maxlength="14" placeholder="10 или 12 цифр — остальное заполнится из ЕГРЮЛ">${api.partyByInn ? '<button class="btn" type="button" data-act="party-fill">Заполнить по ИНН</button>' : ''}</div>
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
    ${id && A.isCustomerOrg(o) ? `<div class="sub"><h3>Проекты заказчика</h3>${projectsBox()}</div><div id="org-cab"></div>` : ''}
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button><span class="spacer"></span>
      ${id ? '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>' : ''}`,
  });
  renderOrgContacts(); renderOrgContracts(); orgInnHint(); renderOrgCabinet();
  partyLast = String(o.inn || '');
  partyKeyLoad().then(() => { if (!id && partyKeyHas === false && $('#o-party') && state.drawer?.kind === 'org') { const b = $('#o-party'); b.hidden = false; b.innerHTML = '<p class="hint">Название, КПП, ОГРН, адрес и руководитель могут заполняться сами по ИНН — для этого нужен бесплатный ключ DaData. <button class="linkbtn" type="button" data-act="party-key">Ввести ключ…</button></p>'; } });
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
      <button class="icon" type="button" data-act="org-contract-del" data-i="${i}" title="Убрать договор" aria-label="Убрать">✕</button></div>`).join('')}</div>
      <p class="hint">Всего по договорам: <span id="org-ctotal">${money(total)}</span>. Остаток по оплатам появится вместе с «Финансами: заявками».</p>` : '<p class="hint">Договоров пока нет.</p>'}
    <button class="btn sm" type="button" data-act="org-contract-add">+ Договор</button>`;
}
// The total under the contracts follows the typed sums without redrawing the rows (the caret stays put).
function renderOrgContractsTotal() {
  const el = $('#org-ctotal');
  if (el && state.draft) el.textContent = money(state.draft.contracts.reduce((s, c) => s + (money0(c.sum) || 0), 0));
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
      list.push({ id: c.id, no, date: isDate(c.date) ? c.date : '', sum, subject, projectId: state.projects.has(c.projectId) ? c.projectId : '' });
    }
    data.contracts = list;
  }
  const oid = id || newId();
  const ops = [id ? op.update('orgs', id, data) : op.set('orgs', oid, { ...data, createdAt: new Date().toISOString(), createdBy: state.me?.id || '' })];
  // Projects keep the customer's name in «client» (reports, the customer page): a renamed customer is renamed there too.
  if (id && A.canManageCatalog(state.me)) for (const p of orgProjects(id)) if (p.client !== data.name) ops.push(op.update('projects', p.id, { client: data.name }));
  if (!(await write(ops, id ? 'Контрагент сохранён' : 'Контрагент добавлен'))) return false;
  if (keepOpen) { await refresh(); openOrg(oid); return true; }
  closeDrawer();
  return true;
}

/* ----- requisites by INN from ЕГРЮЛ / ЕГРИП through DaData (src/core/party.js); the key is this computer's ----- */
let partyKeyHas = null, partyLast = '', partyTimer = null, partyDiff = [];
const PARTY_FIELDS = [['name', 'Название'], ['fullName', 'Полное наименование'], ['kpp', 'КПП'], ['ogrn', 'ОГРН'], ['address', 'Адрес'], ['director', 'Руководитель']];
async function partyKeyLoad(force = false) {
  if (!api.partyKey || (partyKeyHas !== null && !force)) return partyKeyHas;
  try { partyKeyHas = !!(await api.partyKey())?.has; } catch { partyKeyHas = false; }
  return partyKeyHas;
}
// Typing the INN: once it is whole and right, the card asks the registry by itself (with a key); empty fields fill,
// differing ones are offered with «Заменить» — nothing typed by hand is overwritten silently.
function partyAuto() {
  clearTimeout(partyTimer);
  const inn = val('inn').replace(/\s+/g, '');
  if (!api.partyByInn || !inn || L.innError(inn) || inn === partyLast) return;
  partyTimer = setTimeout(async () => { if (await partyKeyLoad()) partyFill(true); }, 350);
}
async function partyFill(auto = false) {
  const box = $('#o-party');
  if (!box || !api.partyByInn) return;
  const inn = val('inn').replace(/\s+/g, ''), bad = inn ? L.innError(inn) : 'Введите ИНН — 10 или 12 цифр.';
  if (bad) { if (!auto) formError(bad, '', 'inn'); return; }
  partyLast = inn;
  box.hidden = false;
  box.innerHTML = '<p class="hint">Ищем в ЕГРЮЛ…</p>';
  const r = await api.partyByInn(inn);
  if (!$('#o-party') || val('inn').replace(/\s+/g, '') !== inn) return; // the card closed or the INN changed meanwhile
  if (!r.ok) {
    if (r.needKey) partyKeyHas = false;
    box.innerHTML = `<p class="${r.needKey ? 'hint' : 'neg'}">${esc(r.message)}${r.needKey ? ' <button class="linkbtn" type="button" data-act="party-key">Ввести ключ…</button>' : ''}</p>`;
    return;
  }
  const p = r.party, filled = [];
  partyDiff = [];
  for (const [k, label] of PARTY_FIELDS) {
    const el = $(`#dform [name="${k}"]`), v = p[k];
    if (!el || !v) continue;
    if (!el.value.trim()) { el.value = v; filled.push(label); } else if (el.value.trim() !== v) partyDiff.push({ k, label, v });
  }
  renderPartyBox(p, filled);
}
function renderPartyBox(p, filled = []) {
  const box = $('#o-party');
  if (!box) return;
  box.innerHTML = `${p.status ? `<p class="neg"><b>По ЕГРЮЛ организация ${esc(p.status)}${p.liquidated ? ` (${fmtDate(p.liquidated)})` : ''}.</b> Проверьте, прежде чем заключать договор.</p>` : ''}
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
// The key: a small dialog of its own (the settings window redraws and would lose the typed text).
function openPartyKey() {
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-title" novalidate><h2 id="pk-title">Реквизиты по ИНН</h2>
    <p class="hint">Название, полное наименование, КПП, ОГРН, адрес и руководитель подтягиваются из ЕГРЮЛ и ЕГРИП через сервис DaData. Зарегистрируйтесь на dadata.ru (бесплатный тариф — до 10 000 запросов в день), в личном кабинете скопируйте «API-ключ» и вставьте сюда.</p>
    <p class="hint">Ключ хранится на этом компьютере в зашифрованном виде. Запросы идут из Пульта в DaData: передаётся только ИНН.</p>
    <div class="f"><label for="pk-key">API-ключ DaData</label><input id="pk-key" type="password" autocomplete="off" maxlength="80" placeholder="${partyKeyHas ? 'сохранён — оставьте пустым, чтобы не менять' : '40 латинских букв и цифр'}"></div>
    <p class="neg" id="pk-err"></p>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button>${api.openDadata ? '<button class="btn ghostbtn" type="button" data-m="site">Открыть dadata.ru</button>' : ''}${partyKeyHas ? '<button class="btn" type="button" data-m="off">Удалить ключ</button>' : ''}<button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelector('#pk-key').focus();
  const save = async k => {
    const r = await api.partyKeySet(k);
    if (!r.ok) { root.querySelector('#pk-err').textContent = r.message; root.querySelector('#pk-key').focus(); return; }
    partyKeyHas = r.has; close();
    toast(r.has ? 'Ключ DaData сохранён — теперь реквизиты заполняются по ИНН' : 'Ключ DaData удалён');
    if (document.querySelector('.settings-modal')) renderSettings();
    if (r.has && $('#o-party')) { partyLast = ''; partyFill(true); }
  };
  root.addEventListener('click', e => {
    if (e.target === root || e.target.dataset.m === 'cancel') close();
    if (e.target.dataset.m === 'off') save('');
    if (e.target.dataset.m === 'site') api.openDadata();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const k = root.querySelector('#pk-key').value.trim(); if (!k && partyKeyHas) return close(); if (!k) { root.querySelector('#pk-err').textContent = 'Вставьте ключ.'; return; } save(k); });
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
});

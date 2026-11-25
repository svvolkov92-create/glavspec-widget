/* ---------- project & contractor ---------- */
// The project's GIP: any GIP of the team; a project made before 4.1 may name someone else — kept in the list.
function gipOptions(sel) {
  const list = liveUsers().filter(u => u.role === 'gip' || u.id === sel).sort(byName);
  return `<option value="">— не назначен —</option>${list.map(u => `<option value="${esc(u.id)}"${u.id === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}`;
}
const projectGip = p => (p?.gipId && state.users.get(p.gipId)) || null;
function openProject(id, tab = 'main') {
  const p = id ? state.projects.get(id) : {};
  if (!p) return toast('Проект не найден.', true);
  state.drawer = { kind: 'project', id, tab: id ? tab : 'main' };
  state.draft = id ? projectDraft(p) : null;
  const n = id ? [...state.tasks.values()].filter(t => t.projectId === id).length : 0;
  const more = !!(p.folder || p.note);
  const ptab = state.drawer.tab;
  drawerShell({
    title: id ? `Проект · ${esc(p.name)}` : 'Новый проект',
    wide: !!id,
    body: `${id ? `<div class="dtabs" role="tablist">${[['main', 'Основное'], ['comp', 'Состав проекта: ПД и РД'], ['cust', 'Для заказчика']].map(([k, l]) => `<button class="dtab" role="tab" type="button" data-act="dtab" data-id="${k}" aria-selected="${k === ptab}">${l}</button>`).join('')}</div>` : ''}
    <div class="dpanel" data-panel="main"${ptab === 'main' ? '' : ' hidden'}><div class="fgrid">
      <div class="f wide"><label class="req" for="pr-name">Название объекта</label><input id="pr-name" name="name" value="${esc(p.name || '')}" placeholder="ЖК «Северный», корпус 2" maxlength="160"></div>
      <div class="f"><label for="pr-code">Шифр</label><input id="pr-code" name="code" value="${esc(p.code || '')}" placeholder="0425-24" maxlength="40"></div>
      ${customerField(p)}
      <div class="f"><label for="pr-gip">ГИП</label><select id="pr-gip" name="gipId">${gipOptions(id ? p.gipId : (A.isGip(state.me) ? state.me.id : ''))}</select></div>
      <div class="f wide"><span class="lbl-t">Инженерные изыскания</span><div class="seg sv-choice">
        <label class="chk"><input type="radio" name="surveys" value="customer"${p.surveys === 'ours' ? '' : ' checked'}> даёт заказчик — отчёты в «Сборе ИРД»</label>
        <label class="chk"><input type="radio" name="surveys" value="ours"${p.surveys === 'ours' ? ' checked' : ''}> делаем мы — отдельный блок «Инженерные изыскания»</label></div></div>
      <div class="f"><span class="lbl-t">Значок проекта</span><div class="icon-pick"><span id="pr-icon-box">${projIcon(p) ? imgIcon(p.icon, 'proj-ic big') : '<span class="hint">нет</span>'}</span>
        <input type="hidden" name="icon" value="${esc(ICON_OK(p.icon) ? p.icon : '')}"><button class="btn sm" type="button" data-act="proj-icon">Выбрать картинку…</button><button class="btn ghostbtn sm" type="button" data-act="proj-icon-clear"${ICON_OK(p.icon) ? '' : ' hidden'}>Убрать</button></div>
        <span class="hint">Видна на вкладке проекта, в списке и в чате проекта.</span></div>
      <div class="f"><label for="pr-status">Стадия проекта</label><select id="pr-status" name="status"><option value="">— не задана —</option>${Object.entries(L.PROJECT_STATUSES).map(([k, s]) => `<option value="${k}"${p.status === k ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
      ${id ? '' : '<label class="chk f wide gen-chk"><input type="checkbox" id="pr-gen" data-transient checked> Сразу открыть генератор состава: проектная документация по ПП РФ № 87 и рабочая документация</label>'}
      <details class="f wide more"${more ? ' open' : ''}><summary>Дополнительно: папка проекта, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="pr-folder">Папка проекта</label>
          <div class="row-in"><input id="pr-folder" name="folder" value="${esc(p.folder || '')}" placeholder="\\\\server\\Проекты\\0425-24 или D:\\Проекты\\…" maxlength="400">
            <button class="btn" data-act="pick-folder" type="button">Выбрать…</button></div>
          <span class="hint">Кнопка «Папка проекта» в списке откроет её в Проводнике; папки разделов предлагаются внутри неё.</span></div>
        <div class="f wide"><label for="pr-note">Примечание</label><textarea id="pr-note" name="note" maxlength="2000">${esc(p.note || '')}</textarea></div>
      </div></details>
    </div>
    ${id ? `<div class="sub"><h3>Состав проекта</h3><p class="hint">${p.composition ? `Проектная документация: томов ${Composition.volumes(p.composition, p.code || '').length} · рабочая документация: разделов ${Composition.rdRows(p.composition, p.code || '').length}.` : 'Ещё не сформирован. Генератор предложит разделы по ПП РФ № 87 и разделы рабочей документации к ним.'}</p>
      <div><button class="btn primary" type="button" data-act="dtab" data-id="comp">Открыть генератор состава (ПД и РД)</button></div></div>` : ''}
    ${id ? `<p class="hint">Карточек в проекте: ${n}.${p.archived ? ' Проект в архиве: его карточки не видны в сводке, загрузке и уведомлениях.' : ''}</p>` : ''}</div>
    ${id ? `<div class="dpanel" data-panel="comp"${ptab === 'comp' ? '' : ' hidden'}><div id="comp-box"></div></div>
    <div class="dpanel" data-panel="cust"${ptab === 'cust' ? '' : ' hidden'}><div id="cab-box"></div><div id="cust-box"></div></div>` : ''}
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id ? `<button class="btn" data-act="${p.archived ? 'unarchive' : 'archive'}" data-id="${esc(id)}" type="button">${p.archived ? 'Вернуть из архива' : 'В архив'}</button>
        <button class="btn danger" data-act="ask-delete" type="button">В корзину</button>` : ''}`,
  });
  if (id) { renderComposition(); renderCustomer(); renderCabinetBox(); if (cab?.configured) loadCabCustomers(true); $('#dform').classList.toggle('full', ptab === 'comp'); }
  customerHint();
  markClean();
  if (!id) $('#pr-name').focus();
}

// New person: the GIP chooses staff (gets a panel) or outside contractor (no panel). A chief adds contractors only.
function kindSwitch(current) {
  if (!A.isGip(state.me)) return '';
  const b = (k, label, sub) => `<button class="btn sm ${current === k ? 'on' : ''}" type="button" data-act="${k === 'staff' ? 'new-user' : 'new-contractor'}" aria-pressed="${current === k}">${label}<small>${sub}</small></button>`;
  return `<div class="seg kind-seg" role="group" aria-label="Кого добавить">${b('staff', 'Сотрудник', 'штатный, свой пульт в программе')}${b('outside', 'Подрядчик', 'внештатный, без доступа к программе')}</div>`;
}

function openContractor(id) {
  const c = id ? state.contractors.get(id) : {};
  if (!c) return toast('Исполнитель не найден.', true);
  noteRecent('contractor', id);
  state.drawer = { kind: 'contractor', id };
  drawerShell({
    title: id ? 'Подрядчик' : 'Новый подрядчик',
    body: `${id ? '' : kindSwitch('outside')}<div class="fgrid">
      <div class="f wide"><label class="req" for="c-name">ФИО или название</label><input id="c-name" name="name" value="${esc(c.name || '')}" placeholder="Петров Алексей Сергеевич" maxlength="160"></div>
      <div class="f wide"><label for="c-spec">Специализация (разделы)</label><input id="c-spec" name="specialty" value="${esc(c.specialty || '')}" placeholder="ЭОМ, ЭС, ЭН" maxlength="160">
        <span class="hint">Перечислите разделы через запятую — по ним подрядчик будет предлагаться в карточках.</span></div>
      <div class="f"><label for="c-phone">Телефон</label><input id="c-phone" name="phone" type="tel" value="${esc(c.phone || '')}" placeholder="+7 900 123-45-67" maxlength="40"></div>
      <div class="f"><label for="c-email">Почта</label><input id="c-email" name="email" type="email" value="${esc(c.email || '')}" maxlength="120"></div>
      <div class="f wide"><label for="c-msg">Мессенджер</label><input id="c-msg" name="messenger" value="${esc(c.messenger || '')}" placeholder="Telegram @petrov_eom" maxlength="120"></div>
      ${contractorOrgField(c)}
      <details class="f wide more"${c.requisites || c.note ? ' open' : ''}><summary>Дополнительно: реквизиты, примечание</summary><div class="fgrid">
        <div class="f wide"><label for="c-req">Реквизиты</label><textarea id="c-req" name="requisites" maxlength="1000" placeholder="ИНН, р/с, банк — попадут в акт сверки">${esc(c.requisites || '')}</textarea></div>
        <div class="f wide"><label for="c-note">Примечание</label><textarea id="c-note" name="note" maxlength="2000" placeholder="Ставка, особенности">${esc(c.note || '')}</textarea></div>
      </div></details>
    </div>
    <div class="err" id="form-err" hidden></div>`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id ? '<button class="btn danger" data-act="ask-delete" type="button">В корзину</button>' : ''}`,
  });
  markClean();
  if (!id) $('#c-name').focus();
}

async function submitSimple(keepOpen = false) {
  const { kind, id } = state.drawer;
  if (kind === 'org') return submitOrg(keepOpen);
  formError('');
  const created = { createdAt: new Date().toISOString() };
  let ok = false;
  if (kind === 'project') {
    const data = { name: val('name'), code: val('code'), ...customerOf(id && state.projects.get(id), val('client')), gipId: state.users.has(val('gipId')) ? val('gipId') : '', status: L.PROJECT_STATUSES[val('status')] ? val('status') : '', folder: val('folder'), note: val('note'), icon: ICON_OK(val('icon')) ? val('icon') : '', surveys: $('#dform [name="surveys"]:checked')?.value === 'ours' ? 'ours' : 'customer' };
    if (!data.name) return formError('Укажите название объекта.', 'main', 'name');
    if (id) {
      if (projectDraftData().error) { const e = projectDraftData(); return formError(e.error, e.tab); }
      // Every section of the composition is a task: missing ones are made (or linked) in the same batch.
      const made = compTaskOps(state.draft.composition, id, data.code);
      const extra = projectDraftData();
      const parts = [made.created ? `задач по разделам: ${made.created}` : '', made.linked ? `привязано карточек: ${made.linked}` : '', made.assigns ? `заданий смежникам: ${made.assigns}` : ''].filter(Boolean);
      const wasCustomer = state.projects.get(id)?.customerId || '';
      ok = await write([...made.ops, op.update('projects', id, { ...data, ...extra.data })], parts.length ? `Проект сохранён: ${parts.join(', ')}` : 'Проект сохранён');
      // A project moved to another customer: the logins of both customers' contact people follow.
      if (ok && wasCustomer !== data.customerId) for (const oid of [wasCustomer, data.customerId]) if (oid) syncOrgCabinet(oid);
    }
    else {
      const pid = newId(), gen = !!$('#pr-gen')?.checked;
      ok = await write(op.set('projects', pid, { ...data, ...created }), 'Проект добавлен');
      if (ok && data.customerId) syncOrgCabinet(data.customerId);
      if (ok) {
        // The timeline first: the generator then dates sections and assignments from it.
        closeDrawer();
        await refresh();
        if (state.projects.get(pid)) { await askTimeline(state.projects.get(pid)); await refresh(); }
        if (gen) openProject(pid, 'comp'); // straight to the composition generator
        return ok;
      }
    }
  } else if (kind === 'contractor') {
    const data = { name: val('name'), specialty: val('specialty'), phone: val('phone'), email: val('email'), messenger: val('messenger'), requisites: val('requisites'), note: val('note'), orgId: contractorOrgPicked() };
    if (!data.name) return formError('Укажите ФИО или название исполнителя.', '', 'name');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
    ok = id ? await write(op.update('contractors', id, data), 'Исполнитель сохранён')
      : await write(op.set('contractors', newId(), { ...data, ...created, createdBy: state.me?.id || '' }), 'Исполнитель добавлен');
  }
  if (ok && keepOpen && kind === 'project' && id) { await refresh(); state.draft = projectDraft(state.projects.get(id)); markClean(); return ok; }
  if (ok) closeDrawer();
  return ok;
}

/* ---------- delete → trash ---------- */
function askDelete() {
  const { kind, id } = state.drawer;
  let text, blocked = false;
  if (kind === 'task') text = 'Переместить карточку в корзину? Её можно будет восстановить в течение 30 дней.';
  else if (kind === 'project') {
    const n = [...state.tasks.values()].filter(t => t.projectId === id).length;
    text = n ? `Переместить проект и его карточки (${n}) в корзину? Восстановить можно в течение 30 дней.` : 'Переместить проект в корзину?';
  } else if (kind === 'org') {
    if ((state.orgs.get(id)?.contacts || []).some(k => k.cabinetId && cabCustomer(k.cabinetId) && !cabCustomer(k.cabinetId).disabled)) { blocked = true; text = 'У контактных лиц организации открыт вход в кабинет заказчика. Сначала закройте вход (в карточке, «Кабинет заказчика»).'; }
  } else if (kind === 'user') {
    const n = [...state.tasks.values()].filter(t => hasOwner(t, id)).length;
    const subs = usersByRole('specialist').filter(u => u.chiefId === id).length;
    if (n || subs) { blocked = true; text = n ? `На сотруднике карточек: ${n}. Сначала передайте их другому ответственному.` : `У главспеца специалистов: ${subs}. Сначала переведите их к другому главспецу.`; }
    else text = 'Удалить сотрудника из команды?';
  } else {
    const n = [...state.tasks.values()].filter(t => t.contractorId === id).length;
    if (n) { blocked = true; text = `На подрядчике карточек: ${n}. Сначала переназначьте их или снимите исполнителя.`; }
    else text = 'Переместить исполнителя в корзину?';
  }
  // 46: the trash can be undone (10 s plate, Ctrl+Z, the trash itself) — no «are you sure?» before it.
  // Only a removal that cannot happen yet is explained here.
  if (!blocked) return doDelete();
  $('#confirm-slot').innerHTML = `<div class="drawer-f"><div class="confirm">${esc(text)}
    <span class="confirm-acts"><button class="btn sm" data-act="cancel-delete" type="button">Понятно</button></span></div></div>`;
}
async function doDelete() {
  const { kind, id } = state.drawer;
  const at = new Date().toISOString();
  let ops;
  if (kind === 'task') ops = [op.update('tasks', id, { deletedAt: at })];
  else if (kind === 'project') {
    ops = [...state.tasks.values()].filter(t => t.projectId === id).map(t => op.update('tasks', t.id, { deletedAt: at, deletedWith: id }));
    ops.push(op.update('projects', id, { deletedAt: at }));
  } else if (kind === 'user') ops = [op.update('users', id, { deletedAt: at })];
  else if (kind === 'org') ops = [op.update('orgs', id, { deletedAt: at })];
  else ops = [op.update('contractors', id, { deletedAt: at })];
  const what = kind === 'task' ? 'Карточка' : kind === 'project' ? 'Проект' : kind === 'user' ? 'Сотрудник' : kind === 'org' ? 'Контрагент' : 'Исполнитель';
  if (await write(ops, null, { undoLabel: `${what} — в корзину` })) {
    closeDrawer();
    toast(kind === 'user' ? 'Сотрудник удалён из команды' : `${what}${kind === 'project' && ops.length > 1 ? ` и карточки (${ops.length - 1})` : ''} — в корзине`, false, { label: 'Отменить', run: () => restoreItem(kind === 'task' ? 'tasks' : kind + 's', id) });
  }
}

function trashLeft(at) { return Math.max(0, TRASH_DAYS - Math.floor((Date.now() - Date.parse(at)) / 864e5)); }
function openTrash() {
  state.drawer = { kind: 'trash' };
  drawerShell({ title: 'Корзина', body: '<div id="trash-box"></div>', form: false });
  renderTrash();
}
function renderTrash() {
  const box = $('#trash-box');
  if (!box) return;
  const item = (col, x, title, sub) => `<div class="tr-row">
    <div class="tr-main"><b>${title}</b><span class="hint">${sub} · удалено ${fmtDate(String(x.deletedAt).slice(0, 10))} · исчезнет через ${trashLeft(x.deletedAt)} дн.</span></div>
    <button class="btn sm" data-act="restore" data-col="${col}" data-id="${esc(x.id)}" type="button">Восстановить</button>
    <button class="btn ghostbtn sm danger" data-act="purge" data-col="${col}" data-id="${esc(x.id)}" type="button">Удалить навсегда</button>
  </div>`;
  const projs = state.trash.projects.map(p => item('projects', p, esc(p.name), `проект${p.code ? ' ' + esc(p.code) : ''}, карточек: ${state.trash.tasks.filter(t => t.deletedWith === p.id).length}`));
  const people = state.trash.contractors.map(c => item('contractors', c, esc(c.name), 'исполнитель'))
    .concat(state.trash.orgs.map(o => item('orgs', o, esc(o.name), `контрагент${A.orgRoles(o).length ? ' · ' + A.orgRoles(o).map(r => A.ORG_ROLES[r].toLowerCase()).join(', ') : ''}`)));
  const cards = state.trash.tasks.filter(t => !t.deletedWith).map(t => item('tasks', t, esc(marksText(t)), `карточка · ${esc(state.projects.get(t.projectId)?.name || 'проект удалён')}`));
  const all = [...projs, ...people, ...cards];
  box.innerHTML = all.length ? `<p class="hint">Удалённое хранится ${TRASH_DAYS} дней, затем стирается при запуске программы.</p><div class="tr-list">${all.join('')}</div>`
    : '<div class="none">Корзина пуста.</div>';
}
async function restoreItem(col, id) {
  const clear = { deletedAt: null, deletedWith: null };
  const ops = [op.update(col, id, clear)];
  if (col === 'projects') {
    for (const t of state.trash.tasks) if (t.deletedWith === id) ops.push(op.update('tasks', t.id, clear));
  }
  if (col === 'tasks') {
    // A card whose project is also in the trash would stay hidden: bring the project back too.
    const t = state.trash.tasks.find(x => x.id === id) || state.tasks.get(id);
    const p = t && state.trash.projects.find(x => x.id === t.projectId);
    if (p) ops.push(op.update('projects', p.id, clear));
  }
  await write(ops, 'Восстановлено');
}
async function purgeItem(col, id, btn) {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Точно удалить?'; return; }
  const ops = [op.del(col, id)];
  if (col === 'projects') for (const t of state.trash.tasks) if (t.deletedWith === id) ops.push(op.del('tasks', t.id));
  await write(ops, 'Удалено навсегда');
}

/* ---------- payments (saved immediately) ---------- */
async function addPayment() {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  const date = $('#p-date').value, amount = parseMoney($('#p-amount').value), note = $('#p-note').value.trim();
  if (!isDate(date)) return toast('Укажите дату платежа.', true);
  if (Number.isNaN(amount) || amount <= 0) return toast('Сумма платежа должна быть больше нуля.', true);
  const payments = [...(t.payments || []), { id: newId(), date, amount, note }];
  if (await write(op.update('tasks', t.id, { payments }), 'Платёж внесён')) { $('#p-amount').value = ''; $('#p-note').value = ''; }
}
async function delPayment(pid) {
  const t = state.tasks.get(state.drawer?.id);
  if (!t) return;
  await write(op.update('tasks', t.id, { payments: (t.payments || []).filter(p => p.id !== pid) }), 'Платёж удалён');
}

/* ---------- archive & folders ---------- */
async function setArchived(id, on) {
  if (await write(op.update('projects', id, { archived: on }), on ? 'Проект перенесён в архив' : 'Проект возвращён из архива')) {
    if (state.drawer?.kind === 'project') closeDrawer();
  }
}
async function openFolder(id) {
  const res = await api.openProjectFolder(id);
  if (!res.ok) toast(res.message, true);
}
async function pickFolder() {
  const res = await api.pickFolder(val('folder'));
  if (res?.path) $('#pr-folder').value = res.path;
}

// «Удалить все проекты» (GIP): every project with its cards goes to the trash in one batch.
async function deleteAllProjects() {
  setFileMenu(false);
  const list = [...state.projects.values()];
  if (!list.length) return toast('Проектов нет');
  const n = [...state.tasks.values()].filter(t => state.projects.has(t.projectId)).length;
  const sure = await confirmBox(`Переместить в корзину все проекты (${list.length}) и их карточки (${n})? 30 дней их можно восстановить из корзины.`, 'Удалить все');
  if (!sure) return;
  const at = new Date().toISOString(), ops = [];
  for (const p of list) {
    for (const t of state.tasks.values()) if (t.projectId === p.id) ops.push(op.update('tasks', t.id, { deletedAt: at, deletedWith: p.id }));
    ops.push(op.update('projects', p.id, { deletedAt: at }));
  }
  state.openProjectId = null;
  await write(ops, `В корзину: проектов ${list.length}, карточек ${n}`);
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'delete-all-projects': () => { deleteAllProjects(); },
  'open-project-cust': ({ id }) => { openProject(id, 'cust'); },
  'open-project': ({ id }) => { openProject(id); },
  'open-project-tab': ({ el, id }) => { openProject(id, el.dataset.tab); },
  'new-project': () => { setCreateMenu(false); openProject(null); },
  'open-contractor': ({ id }) => { openContractor(id); },
  'new-contractor': () => { setCreateMenu(false); openContractor(null); },
  'archive': ({ id }) => { setArchived(id, true); },
  'unarchive': ({ id }) => { setArchived(id, false); },
  'open-folder': ({ id }) => { openFolder(id); },
  'pick-folder': () => { pickFolder(); },
  'ask-delete': () => { askDelete(); },
  'do-delete': ({ el }) => { el.disabled = true; doDelete(); },
  'add-payment': () => { addPayment(); },
  'del-payment': ({ el }) => { delPayment(el.dataset.pid); },
  'restore': ({ el, id }) => { restoreItem(el.dataset.col, id); },
  'purge': ({ el, id }) => { purgeItem(el.dataset.col, id, el); },
});

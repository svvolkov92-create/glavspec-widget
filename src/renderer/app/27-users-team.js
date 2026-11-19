/* ---------- roles: header markup, user switch, team ---------- */
// data-role-hide="spec" — hidden from specialists; "gip" — shown to the GIP only.
function roleAllows(spec) {
  if (spec === 'gip') return A.isGip(state.me);
  if (spec === 'spec') return !isSpec();
  return true;
}
const liveUsers = () => [...(state.users?.values() || [])];
const usersByRole = r => liveUsers().filter(u => u.role === r).sort(byName);
const userTag = u => `${A.ROLES[u.role]?.label || ''}${A.directionLabels(u).length ? ' · ' + A.directionLabels(u).join(', ') : ''}`;

function setUserMenu(open) {
  const menu = $('#user-menu');
  if (open) {
    const item = u => `<button role="menuitem" type="button" data-act="switch-user" data-id="${esc(u.id)}"${u.id === state.me?.id ? ' aria-current="true"' : ''}>
      <b>${esc(u.name)}</b><small>${esc(userTag(u))}</small></button>`;
    if (state.remote) {
      menu.innerHTML = `<div class="menu-h">${esc(state.me?.name || '')}</div><p class="role-hint">${esc(userTag(state.me || {}))} · общая база ${esc(state.remote.url || '')}, вход «${esc(state.remote.login || '')}»</p>
        <button role="menuitem" type="button" data-act="server"><b>Сервер Пульта…</b><small>Связь, пароль${A.isGip(state.me) ? ', кто может входить' : ''}</small></button>`;
      menu.hidden = !open; $('#btn-user').setAttribute('aria-expanded', String(open)); return;
    }
    menu.innerHTML = [['gip', 'ГИП'], ['chief', 'Главспецы'], ['specialist', 'Специалисты']]
      .map(([r, l]) => usersByRole(r).length ? `<div class="menu-h">${l}</div>${usersByRole(r).map(item).join('')}` : '').join('')
      + '<p class="role-hint">Локальная версия: вход без пароля, роли разделяют интерфейс, но не защищают файл данных.</p>'
      + (api.serverInfo ? '<button role="menuitem" type="button" data-act="server"><b>Сервер Пульта…</b><small>Общая база команды: подключиться или перенести</small></button>' : '');
  }
  menu.hidden = !open;
  $('#btn-user').setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('[aria-current]')?.focus();
}
// «Свой вид» (3.6): each person on this computer keeps their own tab, columns, sorting, folded blocks, Gantt and
// office settings. Switching the user stores the current set under the old user and brings back the new one's.
const VIEW_KEYS = ['tab', 'cols', 'sort', 'folded', 'gantt', 'kbLanes', 'office', 'overview', 'peopleMode', 'presets', 'dense', 'teamCollapsed', 'progWeight', 'quietDays', 'tabOrder', 'nav', 'scroll'];
function swapView(fromId, toId) {
  try {
    if (fromId) localStorage.setItem('glavspec.view:' + fromId, JSON.stringify(Object.fromEntries(VIEW_KEYS.map(k => [k, localStorage.getItem('glavspec.' + k)]))));
    const saved = JSON.parse(localStorage.getItem('glavspec.view:' + toId) || 'null');
    if (!saved) return false; // first visit: keep the current view as a start
    for (const k of VIEW_KEYS) { if (saved[k] == null) localStorage.removeItem('glavspec.' + k); else localStorage.setItem('glavspec.' + k, saved[k]); }
    return true;
  } catch { return false; }
}
async function switchUser(id) {
  setUserMenu(false);
  if (id === state.me?.id) return;
  if (state.drawer) closeDrawer();
  const from = state.me?.id;
  const res = await api.switchUser(id);
  if (!res?.ok) return toast(res?.message || 'Не удалось сменить пользователя.', true);
  const u = state.users.get(id);
  const msg = `Вы вошли как ${u ? u.name : 'другой пользователь'} — ${A.titleFor(u)}`;
  if (swapView(from, id)) { try { sessionStorage.setItem('glavspec.toast', msg + ' · свой вид восстановлен'); } catch { /* optional */ } api.reloadWindow(); return; }
  toast(msg);
}

function ownerStats(uid) {
  const list = tasksArr().filter(t => hasOwner(t, uid));
  const active = list.filter(t => L.ACTIVE.has(t.status));
  return { total: list.length, active: active.length, overdue: active.filter(t => timing(t).overdue).length, review: list.filter(t => t.status === 'review').length };
}
// Tree: GIP → chiefs → their specialists. Specialists without a chief hang under «Без главспеца».
const teamCollapsed = new Set(loadLocal('teamCollapsed', []));
function toggleTeamNode(id) {
  if (teamCollapsed.has(id)) teamCollapsed.delete(id); else teamCollapsed.add(id);
  saveLocal('teamCollapsed', [...teamCollapsed]);
  renderNow();
}
function viewTeam() {
  const gip = A.isGip(state.me);
  const visible = gip ? liveUsers() : liveUsers().filter(u => u.id === state.me.id || (u.role === 'specialist' && u.chiefId === state.me.id));
  const subsOf = id => visible.filter(u => u.role === 'specialist' && u.chiefId === id).sort(byName);
  const budgetCell = u => u.role === 'chief' ? (gip
    ? `<label class="chk"><input type="checkbox" data-act="toggle-budget" data-id="${esc(u.id)}"${u.canSeeBudget ? ' checked' : ''}> видит бюджет</label>`
    : (u.canSeeBudget ? 'видит бюджет' : 'бюджет скрыт')) : u.role === 'gip' ? 'полный доступ' : 'без бюджета';
  // depth: 0 GIP, 1 chief, 2 specialist; `kids` — ids under this node, for branch totals and collapsing.
  const row = (u, depth, kids = [], last = false, trunk = false) => {
    const own = ownerStats(u.id);
    const branch = kids.reduce((a, id) => { const x = ownerStats(id); return { active: a.active + x.active, overdue: a.overdue + x.overdue, review: a.review + x.review }; }, own);
    const s = kids.length && u.role === 'chief' ? branch : own;
    const open = !teamCollapsed.has(u.id);
    const toggle = kids.length ? `<button class="tree-tg" type="button" data-act="team-toggle" data-id="${esc(u.id)}" aria-expanded="${open}" title="${open ? 'Свернуть' : 'Развернуть'}">${open ? '▾' : '▸'}</button>` : '<span class="tree-tg ph"></span>';
    const addSub = gip && u.role === 'chief' ? `<button class="btn ghostbtn sm" data-act="new-user" data-role="specialist" data-chief="${esc(u.id)}" type="button" title="Добавить специалиста в группу">+ специалист</button>` : '';
    return `<tr class="tree d${depth}${last ? ' last' : ''}${trunk ? ' trunk' : ''}" style="--d:${depth}">
      <td><div class="tree-cell" style="--d:${depth}">${toggle}<span class="tree-dot r-${u.role}"></span><span class="kicons">${userIcons(u)}</span>
        <span><b>${esc(userLabel(u))}</b>${kids.length && u.role === 'chief' ? `<div class="hint">в группе ${kids.length + 1} · цифры по группе</div>` : ''}</span></div></td>
      <td>${esc(userTag(u))}</td>
      <td class="r num">${s.active}</td><td class="r num${s.overdue ? ' neg' : ''}">${s.overdue}</td><td class="r num">${s.review}</td>
      <td>${budgetCell(u)}</td>
      <td class="nowrap">${addSub}${gip ? `<button class="btn ghostbtn sm" data-act="open-user" data-id="${esc(u.id)}" type="button">Изменить</button>` : ''}</td></tr>`;
  };
  // `lastChief`: no sibling below, so the GIP's line stops at this chief.
  const chiefBranch = (c, depth, lastChief = true) => {
    const subs = subsOf(c.id);
    return row(c, depth, subs.map(x => x.id), lastChief) + (teamCollapsed.has(c.id) ? '' : subs.map((x, i) => row(x, depth + 1, [], i === subs.length - 1, !lastChief)).join(''));
  };
  let body;
  if (gip) {
    const chiefs = visible.filter(u => u.role === 'chief').sort(byName);
    const orphans = visible.filter(u => u.role === 'specialist' && !chiefs.some(c => c.id === u.chiefId)).sort(byName);
    const gips = visible.filter(u => u.role === 'gip').sort(byName);
    const top = gips[0];
    const under = chiefs.map((c, i) => chiefBranch(c, 1, i === chiefs.length - 1 && !orphans.length)).join('')
      + (orphans.length ? `<tr class="tree d1 last orphan-h" style="--d:1"><td colspan="7"><div class="tree-cell" style="--d:1"><span class="tree-tg ph"></span><span class="hint">Без главспеца — ${orphans.length}: назначьте руководителя в карточке сотрудника</span></div></td></tr>`
        + orphans.map((x, i) => row(x, 2, [], i === orphans.length - 1)).join('') : '');
    body = (top ? row(top, 0, chiefs.map(c => c.id).concat(orphans.map(o => o.id))) : '')
      + (top && teamCollapsed.has(top.id) ? '' : under)
      + gips.slice(1).map(g => row(g, 0)).join('');
  } else {
    body = chiefBranch(state.me, 0);
  }
  return `<section class="panel team">
    <div class="panel-h"><h3>Структура команды</h3><span class="spacer"></span>${gip ? '<button class="btn primary sm" data-act="new-user" type="button">+ Сотрудник</button>' : ''}</div>
    ${tip('team', gip ? 'Структура: ГИП → главспецы → их специалисты. Цифры у главспеца — по всей его группе. Подрядчики (внештатные) — ниже на этой же вкладке.'
      : 'Вы и ваши специалисты. Состав команды и доступ к бюджету меняет ГИП.', 'team-hint')}
    <div class="tablewrap"><table class="tree-tbl"><thead><tr><th>Сотрудник</th><th>Роль и направления</th><th class="r">В работе</th><th class="r">Сорвано</th><th class="r">На проверке</th><th>Бюджет</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></div>
    ${visible.some(u => u.role === 'specialist') ? '' : `<div class="empty-hint">${gip
      ? '<b>Специалистов пока нет.</b> Нажмите «+ Сотрудник» или «+ специалист» в строке главспеца — каждому сразу создаётся свой пульт. Затем карточки можно спускать им, а здесь будет видна загрузка группы.'
      : '<b>В вашей группе пока нет специалистов.</b> Их добавляет ГИП; после этого вы сможете спускать им карточки и видеть их работу здесь.'}</div>`}</section>`;
}
async function toggleBudget(id, on) {
  const u = state.users.get(id);
  if (!u) return;
  await write(op.update('users', id, { canSeeBudget: on }), on ? `${u.name} теперь видит бюджет` : `${u.name} больше не видит бюджет`);
}

function openUser(id, role = 'specialist', chiefId = '') {
  const chief = chiefId && state.users.get(chiefId);
  const u = id ? state.users.get(id) : { role: A.ROLES[role] ? role : 'specialist', chiefId: chief ? chiefId : '', directions: chief ? [...(chief.directions || [])] : [] };
  if (!u) return toast('Сотрудник не найден.', true);
  state.drawer = { kind: 'user', id };
  const chiefs = usersByRole('chief');
  const owned = id ? [...state.tasks.values()].filter(t => hasOwner(t, id)).length : 0;
  drawerShell({
    title: id ? 'Штатный сотрудник' : 'Новый сотрудник',
    body: `${id ? '' : kindSwitch('staff')}<div class="fgrid">
      <div class="f wide"><label class="req" for="u-name">Имя</label><input id="u-name" name="name" value="${esc(u.name || '')}" maxlength="120" placeholder="Иванов И. И."></div>
      <div class="f"><label for="u-role">Роль</label><select id="u-role" name="role"${id === state.me.id ? ' disabled' : ''}>
        ${Object.entries(A.ROLES).map(([r, x]) => `<option value="${r}"${u.role === r ? ' selected' : ''}>${x.label}</option>`).join('')}</select></div>
      <div class="f" data-for-role="specialist"><label for="u-chief">Главспец</label><select id="u-chief" name="chiefId">
        <option value="">— не назначен —</option>${chiefs.map(c => `<option value="${esc(c.id)}"${u.chiefId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="f wide" data-for-role="chief specialist"><span class="lbl">Направления</span><div class="chk-row">
        ${A.DIRECTIONS.map(d => `<label class="chk"><input type="checkbox" name="dir" value="${d.id}"${(u.directions || []).includes(d.id) ? ' checked' : ''}> ${esc(d.label)}</label>`).join('')}</div></div>
      <div class="f wide" data-for-role="chief"><label class="chk"><input type="checkbox" name="canSeeContacts"${u.canSeeContacts ? ' checked' : ''}> Видит заказчиков и их контакты (кабинет заказчика)</label></div>
      <div class="f wide" data-for-role="chief"><label class="chk"><input type="checkbox" name="canSeeBudget"${u.canSeeBudget ? ' checked' : ''}> Видит бюджет и оплаты своих карточек</label></div>
      <div class="f"><label for="u-phone">Телефон</label><input id="u-phone" name="phone" type="tel" value="${esc(u.phone || '')}" maxlength="40"></div>
      <div class="f"><label for="u-email">Почта</label><input id="u-email" name="email" type="email" value="${esc(u.email || '')}" maxlength="120"></div>
      <div class="f"><label for="u-msg">Мессенджер</label><input id="u-msg" name="messenger" value="${esc(u.messenger || '')}" maxlength="120"></div>
      <div class="f"><label for="u-bday">День рождения</label><input id="u-bday" name="birthday" type="date" value="${esc(u.birthday || '')}"><span class="hint">В «Офисе» в этот день — колпак. Год не показывается.</span></div>
    </div>
    <p class="hint">${id ? 'Пульт сотрудника' : 'Пульт для сотрудника создаётся автоматически'}: войти в него — щелчок по имени в заголовке программы.</p>
    <div class="err" id="form-err" hidden></div>
    ${id ? `<p class="hint">Карточек на сотруднике: ${owned}.</p>` : ''}`,
    footer: `<button class="btn primary" type="submit">${id ? 'Сохранить' : 'Добавить'}</button>
      <button class="btn" data-act="discard" type="button">Отмена</button>
      <span class="spacer"></span>
      ${id && id !== state.me.id ? '<button class="btn danger" data-act="ask-delete" type="button">Удалить</button>' : ''}`,
  });
  syncUserForm();
  markClean();
  if (!id) $('#u-name').focus();
}
function syncUserForm() {
  const role = $('#u-role')?.value;
  $$('[data-for-role]').forEach(el => { el.hidden = !el.dataset.forRole.split(' ').includes(role); });
}
async function submitUser() {
  const { id } = state.drawer;
  const role = id === state.me.id ? state.me.role : val('role');
  const data = { name: val('name'), role, directions: $$('input[name="dir"]:checked').map(i => i.value), phone: val('phone'), email: val('email'), messenger: val('messenger'), birthday: isDate(val('birthday')) ? val('birthday') : '' };
  if (!data.name) return formError('Укажите имя сотрудника.', '', 'name');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return formError('Проверьте адрес почты.', '', 'email');
  if (!A.ROLES[role]) return formError('Выберите роль.', '', 'role');
  data.chiefId = role === 'specialist' ? val('chiefId') : '';
  data.canSeeBudget = role === 'chief' && checked('canSeeBudget');
  data.canSeeContacts = role === 'chief' && checked('canSeeContacts');
  if (role === 'gip') data.directions = [];
  if (id && role !== 'chief' && state.users.get(id)?.role === 'chief' && usersByRole('specialist').some(s => s.chiefId === id))
    return formError('У этого главспеца есть специалисты — сначала переведите их к другому главспецу.');
  const left = id ? [...state.tasks.values()].filter(t => hasOwner(t, id) && t.status !== 'done' && A.profileGaps({ ...state.users.get(id), ...data }, t).length).length : 0;
  const ok = id ? await write(op.update('users', id, data), left ? `Сохранено. Внимание: карточек не по профилю — ${left}, они в сводке` : 'Сотрудник сохранён')
    : await write(op.set('users', newId(), { ...data, createdAt: new Date().toISOString() }), `${data.name}: штатный сотрудник добавлен, пульт создан`);
  if (ok) closeDrawer();
  return ok;
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'user-menu': () => { setUserMenu($('#user-menu').hidden); },
  'switch-user': ({ id }) => { switchUser(id); },
  'server': () => { setUserMenu(false); setFileMenu(false); serverDialog(); },
  'open-user': ({ id }) => { openUser(id); },
  'new-user': ({ el }) => { setCreateMenu(false); openUser(null, el.dataset.role, el.dataset.chief); },
  'team-toggle': ({ id }) => { toggleTeamNode(id); },
});

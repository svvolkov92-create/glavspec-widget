/* ---------- «Сервер Пульта»: the shared base ---------- */
// With every change of the data the window asks where it stands with the server (a cheap local call).
async function remoteStatus() {
  if (!api.serverInfo) return;
  const r = await api.serverInfo().catch(() => null);
  state.remote = r?.mode === 'server' ? r : null;
  renderRemote();
}
// The chip in the title bar: «на связи» / «нет связи · ждут отправки N»; conflicts open their dialog.
// «4.10.0» is newer than «4.9.3»: compared part by part as numbers.
function newerVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}
function renderRemote() {
  let chip = $('#srv-chip');
  const r = state.remote;
  if (!r) { if (chip) chip.hidden = true; return; }
  if (!chip) {
    $('.user-wrap')?.insertAdjacentHTML('afterend', '<button class="srv-chip" id="srv-chip" type="button" data-act="server"></button>');
    chip = $('#srv-chip');
  }
  const off = !r.online, wait = r.pending || 0;
  // The web version is always as new as its server: an «outdated» answer means the page is old — load it again (once).
  if (r.outdated?.who === 'pult' && r.web) {
    let again = false;
    try { again = sessionStorage.getItem('pult.reloaded') === '1'; sessionStorage.setItem('pult.reloaded', '1'); } catch { /* no storage */ }
    if (!again) { location.reload(); return; }
  } else if (r.web && r.online) { try { sessionStorage.removeItem('pult.reloaded'); } catch { /* no storage */ } }
  const old = r.outdated ? (r.outdated.who === 'server' ? 'Сервер устарел' : 'Обновите Пульт') : '';
  // 65: the GIP put a newer Пульт on the server — said once per version, then a word on the chip.
  const upd = r.app && r.server?.pult && newerVersion(r.server.pult.version, r.app) ? r.server.pult.version : '';
  if (upd && loadLocal('updToldFor', '') !== upd) { saveLocal('updToldFor', upd); toast(`Есть новый Пульт ${upd} — «Сервер» вверху → «Обновить»`); }
  chip.hidden = false;
  chip.className = `srv-chip${r.authLost || old ? ' bad' : off ? ' off' : wait ? ' wait' : ''}`;
  chip.innerHTML = `<i></i>${old ? `${old}${wait ? ` · ждут отправки ${wait}` : ''}` : r.authLost ? 'Войдите заново' : off ? `Нет связи${wait ? ` · ждут отправки ${wait}` : ''}` : wait ? `Отправляю ${wait}…` : upd ? 'Сервер · обновление' : 'Сервер'}`;
  chip.title = old ? `${r.outdated.message} Изменения не потеряются: они ждут и уйдут после обновления.` : r.authLost ? r.authLost : off ? `Нет связи с сервером (${r.lastError || 'нет ответа'}). Работайте дальше: изменения отправятся сами, когда связь вернётся.` : `Общая база: ${r.url} · вы ${r.login}`;
  for (const f of r.failed || []) toast(`Не отправлено: ${f.message}`, true);
  const nConf = Array.isArray(r.conflicts) ? r.conflicts.length : r.conflicts;
  if (nConf && !document.querySelector('.conflict-modal')) conflictsDialog();
}
const FIELD_L = { finish: 'Плановый финиш', start: 'Старт', status: 'Статус', title: 'Название', ownerId: 'Ответственный', execRef: 'Исполнитель', readiness: 'Готовность', name: 'Название', note: 'Заметка', budget: 'Бюджет', marks: 'Разделы', projectId: 'Проект' };
const fieldVal = (f, v) => (v == null || v === '' ? '—' : /finish|start|date/i.test(f) && isDate(v) ? fmtDate(v) : f === 'status' ? (STATUSES[v]?.label || v) : f === 'ownerId' ? (state.users.get(v)?.name || v) : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 80));
async function conflictsDialog() {
  const info = await api.serverInfo?.();
  const list = info?.conflicts || [];
  if (!list.length) return;
  const c = list[0];
  const what = x => { const d = x.col === 'tasks' ? state.tasks.get(x.id) : state[x.col]?.get?.(x.id); return x.col === 'tasks' && d ? `Карточка «${marksText(d)}»` : d?.name ? `«${d.name}»` : 'Запись'; };
  const root = document.createElement('div');
  root.className = 'modal-back conflict-modal';
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cf-t"><h2 id="cf-t">Двое поправили одно</h2>
    <p class="hint">Пока вы работали${c.at ? ` (с ${fmtDate(c.at.slice(0, 10))})` : ''}, это же поле изменил другой человек. Что оставить?</p>
    <table class="pd-t"><thead><tr><th>Что</th><th>Было</th><th>У вас</th><th>Сейчас на сервере</th></tr></thead><tbody>
    ${c.list.map(x => `<tr><td>${esc(what(x))}: ${esc(FIELD_L[x.field] || x.field)}</td><td>${esc(fieldVal(x.field, x.was))}</td><td><b>${esc(fieldVal(x.field, x.mine))}</b></td><td><b>${esc(fieldVal(x.field, x.theirs))}</b></td></tr>`).join('')}</tbody></table>
    <div class="modal-f"><button class="btn primary" type="button" data-cf="mine">Оставить моё</button><button class="btn" type="button" data-cf="theirs">Оставить как на сервере</button>${list.length > 1 ? `<span class="hint">ещё ${list.length - 1}</span>` : ''}</div></div>`;
  document.body.append(root);
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-cf]');
    if (!b) return;
    root.remove();
    const r = await api.serverResolve(c.i, b.dataset.cf === 'mine');
    if (r?.ok === false && r.message) toast(r.message, true); else toast(b.dataset.cf === 'mine' ? 'Оставлено ваше' : 'Оставлено как на сервере');
    await refresh();
  });
}
// The «Сервер Пульта» window: connect / move the base (the GIP) / who has a login (the GIP) / password / disconnect.
async function serverDialog(tab = '') {
  const info = await api.serverInfo?.();
  if (!info) return toast('В этой версии Пульта нет работы с сервером.', true);
  const remoteOn = info.mode === 'server', gip = A.isGip(state.me);
  const root = document.createElement('div');
  root.className = 'modal-back srv-modal';
  const field = (id, label, type = 'text', ph = '', extra = '') => `<div class="f"><label for="${id}">${label}</label><input id="${id}" type="${type}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"${extra}></div>`;
  let html;
  if (!remoteOn) {
    const t = tab || 'join';
    html = `<h2 id="srv-t">Сервер Пульта</h2>
      <p class="hint">Общая база команды в интернете: все работают с одними данными, каждый входит своим логином и видит только своё. Без связи Пульт работает дальше и отправит изменения потом.</p>
      <div class="seg srv-tabs"><button class="btn sm${t === 'join' ? ' on' : ''}" type="button" data-st="join">Подключиться</button>${gip ? `<button class="btn sm${t === 'move' ? ' on' : ''}" type="button" data-st="move">Перенести мою базу на сервер</button>` : ''}</div>
      ${t === 'move' ? `<p class="hint">Один раз, ГИПом, на только что установленный сервер. Ваш файл на этом компьютере останется как есть — копией.</p>
        ${field('sv-url', 'Адрес сервера', 'text', 'например 1-2-3-4.sslip.io')}${field('sv-code', 'Код установки', 'text', 'показан в конце установки сервера')}
        ${field('sv-login', 'Ваш логин', 'text', 'volkov')}${field('sv-pass', 'Пароль (не короче 8 знаков)', 'password')}`
      : `<p class="hint">По приглашению ГИПа — введите код и придумайте логин и пароль. Уже есть логин — оставьте код пустым.</p>
        ${field('sv-url', 'Адрес сервера', 'text', 'например 1-2-3-4.sslip.io')}${field('sv-code', 'Код приглашения (если впервые)', 'text', '8 букв и цифр')}
        ${field('sv-login', 'Логин', 'text', '')}${field('sv-pass', 'Пароль', 'password')}`}
      <div class="err" id="sv-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="button" data-sv="${t}">${t === 'move' ? 'Перенести базу' : 'Подключиться'}</button><button class="btn" type="button" data-sv="close">Отмена</button></div>`;
  } else {
    let acc = null;
    if (gip) acc = await api.serverCall('accounts');
    const upd = await api.updateInfo?.(); // 65: only the desktop Пульт updates itself (the web version is always new)
    const devs = n => (n ? `${n} ${plural(n, 'устройство', 'устройства', 'устройств')}` : 'не входил');
    html = `<h2 id="srv-t">Сервер Пульта</h2>
      <p>${info.online ? '<span class="chip tone-ok">на связи</span>' : `<span class="chip tone-warn">нет связи</span> <span class="hint">${esc(info.lastError || '')}</span>`} ${info.pending ? `<span class="chip tone-warn">ждут отправки: ${info.pending}</span>` : ''}</p>
      <p class="hint">Адрес: <b>${esc(info.url)}</b> · вы вошли как <b>${esc(info.login)}</b>${info.server?.version ? ` · сервер ${esc(info.server.version)}` : ''}</p>
      ${gip && acc?.ok ? `<h3>Вход в Пульт</h3><p class="hint">Пригласите человека — он введёт код в Пульте (или откроет ссылку на телефоне) и придумает себе пароль. Права — как в «Людях»: деньги и контакты заказчика видит только ГИП, если не отметить иначе.</p>
        <table class="pd-t srv-acc"><thead><tr><th>Кто</th><th>Логин</th><th>Где входил</th><th></th></tr></thead><tbody>
        ${acc.accounts.map(a => `<tr${a.disabled ? ' class="off"' : ''}><td><b>${esc(a.name)}</b><br><span class="hint">${esc(A.ROLES[a.role]?.label || a.role)}</span></td>
          <td>${a.login ? esc(a.login) : '<span class="hint">нет</span>'}${a.disabled ? ' <span class="chip tone-bad">вход отключён</span>' : ''}</td>
          <td class="hint">${devs(a.devices.length)}${a.devices[0] ? `<br>${esc(a.devices.map(d => d.device || 'устройство').join(', ')).slice(0, 80)}` : ''}</td>
          <td class="srv-acts">${a.invite ? `<span class="hint sv-code">код <b class="mono">${esc(a.invite.code)}</b> до ${fmtDate(a.invite.until.slice(0, 10))}</span> ` : ''}
            ${a.userId === state.me?.id ? '<span class="hint">это вы</span>' : `${!a.login || a.invite ? `<button class="btn sm" type="button" data-sv="invite" data-id="${esc(a.userId)}">${a.invite ? 'Новый код' : 'Пригласить'}</button>` : `<button class="btn sm" type="button" data-sv="reset" data-id="${esc(a.userId)}">Сбросить пароль</button>`}
            ${a.login ? `<button class="btn ghostbtn sm" type="button" data-sv="${a.disabled ? 'enable' : 'disable'}" data-id="${esc(a.userId)}">${a.disabled ? 'Включить вход' : 'Отключить вход'}</button>` : ''}`}</td></tr>`).join('')}</tbody></table>
        <div class="srv-invite" id="sv-inv" hidden></div>` : ''}
      ${upd ? `<h3>Обновление Пульта</h3>
        <p>${upd.newer ? `<span class="chip tone-work">есть новая версия ${esc(upd.server.version)}</span> у вас ${esc(upd.app)} <button class="btn primary sm" type="button" data-sv="upd-run">Обновить</button>`
          : `<span class="hint">У вас Пульт ${esc(upd.app)}${upd.server ? ` · на сервере ${esc(upd.server.version)}` : ''} — обновлять нечего.</span>`}</p>
        <p class="hint">Пульт скачает установщик с сервера, проверит, что файл тот самый, и запустит его — нажмите в нём «Далее». Ваши данные не затрагиваются.</p>
        ${upd.gip ? `<p class="hint">ГИП: скачайте с GitHub новый установщик (PultGlavspeca_…_x64-setup.exe) и положите его сюда — у всех появится «Обновить».</p>
          <div class="row-in"><button class="btn sm" type="button" data-sv="upd-put">Положить новую версию на сервер…</button><span class="hint" id="sv-upd-st"></span></div>` : ''}` : ''}
      ${gip ? `<h3>Реквизиты по ИНН</h3><p class="hint">${info.server?.party ? 'Ключ DaData введён: у всех, кому открыты контрагенты, реквизиты подтягиваются по ИНН, работает «Сверить с ЕГРЮЛ».' : 'Введите ключ DaData один раз — и у всех, кому открыты контрагенты, название, КПП, ОГРН, адрес и руководитель будут подтягиваться по ИНН.'}</p>
        <div class="row-in"><button class="btn sm" type="button" data-sv="party-key">${info.server?.party ? 'Изменить ключ…' : 'Ввести ключ DaData…'}</button></div>` : ''}
      <h3>Мой вход</h3>
      <div class="row-in">${field('sv-old', 'Текущий пароль', 'password')}${field('sv-new', 'Новый пароль', 'password')}<button class="btn sm" type="button" data-sv="pw">Сменить пароль</button></div>
      <div class="err" id="sv-err" hidden></div>
      <div class="modal-f"><button class="btn" type="button" data-sv="others">Выйти на других устройствах</button><button class="btn ghostbtn" type="button" data-sv="disconnect">Отключить этот Пульт от сервера</button><button class="btn primary" type="button" data-sv="close">Готово</button></div>`;
  }
  root.innerHTML = `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="srv-t">${html}</div>`;
  document.body.append(root);
  root.querySelector('input')?.focus();
  const q = s => root.querySelector(s), val = s => (q(s)?.value || '').trim();
  const err = (m, f) => modalErr(root, '#sv-err', m, f);
  const busy = (b, on) => { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? 'Подождите…' : b.dataset.label; };
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); root.remove(); } });
  root.addEventListener('click', async e => {
    if (e.target === root) return root.remove();
    const st = e.target.closest('[data-st]');
    if (st) { root.remove(); return serverDialog(st.dataset.st); }
    const b = e.target.closest('[data-sv]');
    if (!b) return;
    const a = b.dataset.sv, id = b.dataset.id;
    if (a === 'close') return root.remove();
    if (a === 'join' || a === 'move') {
      if (!val('#sv-url')) return err('Укажите адрес сервера.', '#sv-url');
      if (a === 'move' && !val('#sv-code')) return err('Введите код установки — он показан в конце установки сервера.', '#sv-code');
      if (!val('#sv-login')) return err('Укажите логин.', '#sv-login');
      if (!val('#sv-pass')) return err('Укажите пароль.', '#sv-pass');
      busy(b, true);
      const req = { url: val('#sv-url'), code: val('#sv-code').toUpperCase(), login: val('#sv-login'), password: q('#sv-pass').value };
      const r = a === 'move' ? await api.serverMove(req) : await api.serverSignIn(req);
      busy(b, false);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove();
      toast(a === 'move' ? `База на сервере: записей ${r.count}, файлов ${r.files}${r.missing ? `, не найдено на этом компьютере: ${r.missing}` : ''}. Пульт перезапускается…` : 'Вход выполнен. Пульт перезапускается с общей базой…');
      return;
    }
    if (a === 'invite' || a === 'reset') {
      const r = await api.serverCall(a === 'invite' ? 'inviteCreate' : 'accountReset', id);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      const u = state.users.get(id);
      // The row shows the code that works now (the previous one is no longer valid).
      const cell = b.closest('td');
      const codeHtml = `<span class="hint sv-code">код <b class="mono">${esc(r.code)}</b> до ${fmtDate(r.until.slice(0, 10))}</span> `;
      const old = cell.querySelector('.sv-code, .hint');
      if (old && /код/.test(old.textContent)) old.outerHTML = codeHtml; else cell.insertAdjacentHTML('afterbegin', codeHtml);
      if (a === 'invite') b.textContent = 'Новый код';
      const box = q('#sv-inv');
      const text = `${u?.name || ''}, вход в Пульт «Тандема»:\nадрес: ${info.url}\nкод приглашения: ${r.code} (действует до ${fmtDate(r.until.slice(0, 10))})\n${r.link ? `или откройте на телефоне: ${r.link}\n` : ''}В Пульте: меню → «Сервер Пульта» → «Подключиться», введите код и придумайте логин и пароль.`;
      box.hidden = false;
      box.innerHTML = `<p><b>Код для ${esc(u?.name || '')}: <span class="mono big">${esc(r.code)}</span></b></p><textarea readonly rows="5">${esc(text)}</textarea><button class="btn sm" type="button" data-sv="copy">Скопировать текст приглашения</button>`;
      return;
    }
    if (a === 'copy') { const t = q('#sv-inv textarea'); t.select(); try { await navigator.clipboard.writeText(t.value); toast('Текст приглашения скопирован — отправьте его человеку'); } catch { document.execCommand('copy'); } return; }
    if (a === 'disable' || a === 'enable') {
      const r = await api.serverCall('accountDisable', id, a === 'disable');
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove(); toast(a === 'disable' ? 'Вход отключён, сеансы закрыты' : 'Вход включён'); return serverDialog();
    }
    if (a === 'pw') {
      if (q('#sv-new').value.length < 8) return err('Новый пароль — не короче 8 знаков.', '#sv-new');
      const r = await api.serverCall('passwordChange', q('#sv-old').value, q('#sv-new').value);
      if (!r?.ok) return err(r?.message || 'Не получилось.', '#sv-old');
      toast(r.signedOut ? 'Пароль изменён — на других устройствах нужно войти заново' : 'Пароль изменён'); q('#sv-old').value = ''; q('#sv-new').value = ''; return;
    }
    if (a === 'upd-run') {
      if (!(await confirmBox('Обновить Пульт сейчас? Он закроется и запустится установщик новой версии. Несохранённые карточки сохраните заранее.', 'Обновить'))) return;
      busy(b, true);
      const r = await api.updateInstall(m => toast(m));
      busy(b, false);
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      return;
    }
    if (a === 'upd-put') {
      const f = await api.updatePick();
      if (!f) return;
      // The version comes from the file name (PultGlavspeca_4.8.0_x64-setup.exe); asked only if the name has none.
      const version = f.version || (await askText('Номер версии этого установщика', 'Версия', '4.8.0'))?.trim();
      if (!version) return;
      if (f.version && !(await confirmBox(`Положить на сервер Пульт ${version} (${f.name})? У всех, у кого Пульт старее, появится «Обновить».`, 'Положить'))) return;
      if (!/^\d+\.\d+\.\d+$/.test(version)) return err('Номер версии — три числа через точку, например 4.8.0.');
      busy(b, true);
      q('#sv-upd-st').textContent = `Загружаю ${f.name}…`;
      const r = await api.updateUpload(f.path, version);
      busy(b, false);
      q('#sv-upd-st').textContent = '';
      if (!r?.ok) return err(r?.message || 'Не получилось.');
      root.remove(); toast(`Пульт ${version} на сервере — у всех появится «Обновить»`); return serverDialog();
    }
    if (a === 'party-key') { root.remove(); return openPartyKey(); }
    if (a === 'others') { const r = await api.serverCall('signOutOthers'); toast(r?.ok ? 'Другие устройства вышли' : (r?.message || 'Не получилось'), !r?.ok); return; }
    if (a === 'disconnect') {
      if (!(await confirmBox('Отключить этот Пульт от сервера? Он вернётся к своему файлу на этом компьютере — к данным на момент переноса или подключения. Общая база на сервере останется.', 'Отключить'))) return;
      await api.serverDisconnect(); root.remove(); toast('Пульт отключён от сервера и перезапускается…');
    }
  });
}


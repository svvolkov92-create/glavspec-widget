/* ---------- 4.19: a person — the profile («анкета») and what they are doing now ---------- */
// The person keeps the photo, «о себе», contacts and programs; the birthday is fixed after the first fill;
// the position and the hire date are set by the GIP (the rules are in access.js: SELF_FIELDS, userDataError).
function avatarHtml(u, cls = '') {
  const ph = A.photoOf(u);
  return ph ? `<img class="ava ${cls}" src="${ph}" alt="">` : `<span class="ava ${cls}" aria-hidden="true">${esc(initials(u?.name))}</span>`;
}
const dayMonth = d => (isDate(d) ? fmtDate(d).slice(0, 5) : '');
// Assignments (kind 'assign') are not work of their own: on a person they read as «ждут заданий» — not yet issued
// to the person's cards — and «выдать» — not yet issued by the person.
const ASG_OPEN = t => t.kind === 'assign' && !t.deletedAt && !['review', 'done'].includes(t.status);
const asgWaitingFor = (uid, list = tasksArr()) => list.filter(t => ASG_OPEN(t) && asgTo(t).some(x => hasOwner(x, uid)));
const asgToGive = (uid, list = tasksArr()) => list.filter(t => ASG_OPEN(t) && hasOwner(t, uid));

// What the person is doing, from the state of their cards (the most urgent wins).
function personState(u) {
  const away = A.absencesOf(u).find(a => a.from <= state.today && a.to >= state.today);
  if (away) return { state: 'away', awayText: `${A.ABSENCE_KINDS[away.kind] || 'нет'} до ${fmtDate(away.to).slice(0, 5)}`, cards: [] };
  const cards = tasksArr().filter(t => hasOwner(t, u.id) && t.kind !== 'assign' && t.status !== 'done').sort(sortByDeadline);
  const toCheck = u.role === 'specialist' ? 0 : tasksArr().filter(t => t.status === 'review' && A.reviewersOf(t, liveUsers(), state.projects).includes(u.id)).length;
  if (cards.some(t => timing(t).overdue)) return { state: 'late', cards };
  if (toCheck) return { state: 'checking', cards };
  if (cards.some(t => t.status === 'review')) return { state: 'carry', cards };
  if (cards.some(t => t.status === 'revision')) return { state: 'revision', cards };
  if (cards.some(t => t.status === 'in_progress')) return { state: 'work', cards };
  if (cards.length) return { state: 'idle', cards };
  return { state: 'free', cards };
}
const PERSON_STATE_TEXT = { late: 'срок сорван', checking: 'проверяет работы', carry: 'сдал на проверку', revision: 'на доработке', work: 'в работе', idle: 'работы не начаты', free: 'свободен — можно дать работу', away: 'отсутствует' };
const PERSON_STATE_TONE = { late: 'bad', checking: 'review', carry: 'review', revision: 'warn', work: 'work', idle: 'idle', free: 'ok', away: 'warn' };
const personStateChip = st => `<span class="chip tone-${PERSON_STATE_TONE[st.state]}">${esc(st.awayText || PERSON_STATE_TEXT[st.state])}</span>`;

function profileHtml(u) {
  const rows = [
    u.position ? ['Должность', esc(u.position)] : null,
    isDate(u.hireDate) ? ['В команде с', fmtDate(u.hireDate)] : null,
    isDate(u.birthday) ? ['День рождения', dayMonth(u.birthday)] : null,
    u.phone ? ['Телефон', esc(u.phone)] : null, u.email ? ['Почта', esc(u.email)] : null, u.messenger ? ['Мессенджер', esc(u.messenger)] : null,
  ].filter(Boolean);
  const progs = Array.isArray(u.programs) ? u.programs : [];
  return `<div class="pf">${rows.length ? `<div class="pf-kv">${rows.map(([k, v]) => `<span class="hint">${k}</span><span>${v}</span>`).join('')}</div>` : ''}
    ${u.about ? `<p class="pf-about">${esc(u.about)}</p>` : ''}
    ${progs.length ? `<div class="pf-progs"><span class="hint">Программы:</span> ${progs.map(x => `<span class="chip tone-idle">${esc(x)}</span>`).join(' ')}</div>` : ''}
    ${!rows.length && !u.about && !progs.length ? '<p class="hint">Анкета не заполнена.</p>' : ''}</div>`;
}

// Click on a person: the profile, their open cards with «передать», the assignments they wait for or must issue.
function personPopup(uid) {
  const u = state.users.get(uid);
  if (!u) return;
  const st = personState(u), wait = asgWaitingFor(uid), give = asgToGive(uid), me = u.id === state.me?.id;
  const cardRow = t => `<div class="op-row"><button class="linkbtn" type="button" data-op-open="${esc(t.id)}">${marksHtml(t)} <span>${esc(projectOf(t)?.name || '')}</span></button>${statusChip(t)}<span class="due ${timing(t).cls}">${esc(timing(t).text)}</span>
      ${canEditFields() ? `<button class="btn ghostbtn sm" type="button" data-op-move="${esc(t.id)}" title="Передать другому сотруднику">⇄ Передать</button>` : ''}</div>`;
  const asgRow = t => `<div class="op-row"><button class="linkbtn" type="button" data-op-open="${esc(t.id)}">${esc(t.note || t.title)} <span>${esc(projectOf(t)?.name || '')}</span></button><span class="hint">${esc(t.title)}</span>
      <span class="due ${asgLate(t) ? 'bad' : ''}">${isDate(t.finish) ? fmtDate(t.finish) : '—'}</span></div>`;
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal wide-modal person-modal" role="dialog" aria-modal="true" aria-labelledby="optitle">
    <div class="pm-head">${avatarHtml(u, 'big')}<div><h2 id="optitle"><span class="kicons">${userIcons(u)}</span>${esc(u.name)}</h2>
      <p class="hint">${esc(A.ROLES[u.role]?.label || '')}${A.directionLabels(u).length ? ' · ' + esc(A.directionLabels(u).join(', ')) : ''}</p>${personStateChip(st)}</div></div>
    ${profileHtml(u)}
    <h3 class="pm-h">Чем занят</h3>
    ${st.cards.length ? `<div class="op-list">${st.cards.map(cardRow).join('')}</div>`
      : `<div class="none">${st.state === 'away' ? 'Сотрудник отсутствует.' : 'Открытых карточек нет — можно дать работу.'}</div>`}
    ${wait.length ? `<h3 class="pm-h">Ждёт заданий <span class="cnt">${wait.length}</span></h3><div class="op-list">${wait.map(asgRow).join('')}</div>` : ''}
    ${give.length ? `<h3 class="pm-h">Должен выдать задания <span class="cnt">${give.length}</span></h3><div class="op-list">${give.map(asgRow).join('')}</div>` : ''}
    <div class="modal-f"><button class="btn" type="button" data-op-all>Все карточки</button>${A.canEditAbsences(state.me, u) ? '<button class="btn ghostbtn" type="button" data-op-abs>Отпуска</button>' : ''}
      ${me ? '<button class="btn ghostbtn" type="button" data-op-profile>Моя анкета</button>' : ''}${A.isGip(state.me) ? '<button class="btn ghostbtn" type="button" data-op-edit>Изменить</button>' : ''}
      <span class="spacer"></span><button class="btn primary" type="button" data-m="close">Закрыть</button></div></div>`;
  document.body.append(root);
  const close = () => root.remove();
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === root || b?.dataset.m === 'close') return close();
    if (!b) return;
    if (b.dataset.opOpen) { close(); openTask(b.dataset.opOpen); }
    else if (b.dataset.opMove) { close(); reassign(b.dataset.opMove, 'staff', uid); }
    else if (b.hasAttribute('data-op-all')) { close(); state.filters = { ...EMPTY_FILTERS, owner: uid }; state.tab = 'tasks'; saveLocal('tab', 'tasks'); renderNow(); }
    else if (b.hasAttribute('data-op-abs')) { close(); openAbsences(uid); }
    else if (b.hasAttribute('data-op-profile')) { close(); openProfile(); }
    else if (b.hasAttribute('data-op-edit')) { close(); openUser(uid); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.querySelector('[data-m="close"]').focus();
}

// A picture from the disk → a square 192×192 JPEG as a data: URL (the page allows data: images only).
function photoFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Выберите картинку: JPG, PNG или WebP.'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Картинка больше 15 МБ.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось открыть картинку.'));
      img.onload = () => {
        const S = 192, c = document.createElement('canvas'), k = Math.max(S / img.width, S / img.height);
        c.width = c.height = S;
        c.getContext('2d').drawImage(img, (S - img.width * k) / 2, (S - img.height * k) / 2, img.width * k, img.height * k);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const programsFrom = text => [...new Set(String(text || '').split(/[\n,;]+/).map(x => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 40);

// «Моя анкета»: the person fills it in; the GIP-only fields are shown, not edited.
function openProfile() {
  const u = state.me && state.users.get(state.me.id);
  if (!u) return;
  const gip = A.isGip(state.me), bdayLocked = !gip && isDate(u.birthday);
  let photo = A.photoOf(u);
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<form class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="pf-t" novalidate><h2 id="pf-t">Моя анкета</h2>
    <div class="pf-photo"><span id="pf-ava">${avatarHtml({ ...u, photo }, 'big')}</span><div><label class="btn sm" for="pf-file">Выбрать фото</label><input id="pf-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <button class="btn ghostbtn sm" type="button" id="pf-nophoto"${photo ? '' : ' hidden'}>Убрать фото</button><p class="hint">Фото обрежется до квадрата.</p></div></div>
    <div class="fgrid">
      <div class="f wide"><label for="pf-about">О себе</label><textarea id="pf-about" rows="3" maxlength="1500" placeholder="Чем занимаюсь, в чём силён, к кому обращаться">${esc(u.about || '')}</textarea></div>
      <div class="f"><label for="pf-phone">Телефон</label><input id="pf-phone" type="tel" value="${esc(u.phone || '')}" maxlength="40"></div>
      <div class="f"><label for="pf-email">Почта</label><input id="pf-email" type="email" value="${esc(u.email || '')}" maxlength="120"></div>
      <div class="f"><label for="pf-msg">Мессенджер</label><input id="pf-msg" value="${esc(u.messenger || '')}" maxlength="120"></div>
      <div class="f"><label for="pf-bday">День рождения</label><input id="pf-bday" type="date" value="${esc(u.birthday || '')}"${bdayLocked ? ' disabled' : ''}>
        <span class="hint">${bdayLocked ? 'Уже указан — изменить может ГИП.' : 'Указывается один раз, потом меняет только ГИП. Год никому не показывается.'}</span></div>
      <div class="f wide"><label for="pf-progs">Программы, которыми владею</label><textarea id="pf-progs" rows="2" maxlength="2000" placeholder="AutoCAD, Revit, nanoCAD, ГРАНД-Смета — через запятую">${esc((u.programs || []).join(', '))}</textarea></div>
    </div>
    <p class="hint">Должность${u.position ? ` (${esc(u.position)})` : ''}, дату приёма${isDate(u.hireDate) ? ` (${fmtDate(u.hireDate)})` : ''}, роль и направления заполняет ГИП.</p>
    <div class="err" id="pf-err" hidden></div>
    <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
  document.body.append(root);
  const q = s => root.querySelector(s), close = () => root.remove();
  const showPhoto = () => { q('#pf-ava').innerHTML = avatarHtml({ ...u, photo }, 'big'); q('#pf-nophoto').hidden = !photo; };
  q('#pf-file').addEventListener('change', async e => {
    try { photo = await photoFromFile(e.target.files[0]); showPhoto(); q('#pf-err').hidden = true; } catch (err) { modalErr(root, '#pf-err', err.message); }
    e.target.value = '';
  });
  q('#pf-nophoto').addEventListener('click', () => { photo = ''; showPhoto(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(); });
  q('form').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const data = { photo, about: q('#pf-about').value.trim(), phone: q('#pf-phone').value.trim(), email: q('#pf-email').value.trim(), messenger: q('#pf-msg').value.trim(), programs: programsFrom(q('#pf-progs').value) };
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return modalErr(root, '#pf-err', 'Проверьте адрес почты.', '#pf-email');
    const bd = q('#pf-bday').value;
    if (!bdayLocked && isDate(bd) && bd !== u.birthday) {
      if (!gip && !(await confirmBox(`День рождения ${fmtDate(bd)} — после сохранения изменить его сможет только ГИП. Всё верно?`, 'Да, верно'))) return;
      data.birthday = bd;
    }
    if (await write(op.update('users', u.id, data), 'Анкета сохранена')) close();
  });
  q('#pf-about').focus();
}

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'person-open': ({ id }) => { personPopup(id); },
  'my-profile': () => { setUserMenu(false); openProfile(); },
});

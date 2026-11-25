// 4.20: one way to put up a modal. Esc, a click on the backdrop and a [data-m="cancel"] / [data-m="close"] button
// close it; close(v) removes it and hands `v` to `onClose` (a promise dialog resolves with it), dismissing gives
// `dismissed`. Returns { root, q, close }; the dialog's own buttons and submit stay in the dialog.
function openModal(html, { onClose = null, dismissed = null } = {}) {
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = html;
  document.body.append(root);
  let open = true;
  const close = (v = dismissed) => { if (!open) return; open = false; root.remove(); onClose?.(v); };
  root.addEventListener('click', e => { if (e.target === root || ['cancel', 'close'].includes(e.target.dataset?.m)) close(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  return { root, q: s => root.querySelector(s), close };
}
// «Запросить у заказчика» from the project page: one request (and a row of source data unless it is a decision).
function askCustomer(p) {
  const kinds = [...IRD_KINDS, ['decision', 'Решение или ответ']];
  return new Promise(resolve => {
    const { root, q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="aqt" novalidate><h2 id="aqt">Запросить у заказчика · ${esc(p.name)}</h2>
      <p class="hint">Заказчик увидит запрос в «Нужно от вас» и в «Вопросах» и ответит прямо со страницы. ТУ, письма, согласования и документы попадут ещё и в «Исходные данные».</p>
      <div class="f"><span class="lbl">Что запрашиваем</span><div class="aq-kinds" role="radiogroup">${kinds.map(([k, l], i) => `<label><input type="radio" name="aq-kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
      <div class="f"><label for="aq-title" class="req">Что нужно</label><input id="aq-title" maxlength="160" placeholder="ТУ на электроснабжение 630 кВт" list="aq-dl"><datalist id="aq-dl">${Techcard.SOURCE_DATA.map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div class="fgrid"><div class="f"><label for="aq-due">Срок</label><input id="aq-due" type="date" value="${addDays(state.today, 10)}"></div>
        <div class="f"><label for="aq-who">Кто готовит</label><input id="aq-who" value="Заказчик" maxlength="60"></div></div>
      <div class="f"><label for="aq-why">Зачем (увидит заказчик)</label><input id="aq-why" maxlength="200" placeholder="Без них экспертиза не примет раздел ИОС1"></div>
      <div class="f"><span class="lbl">Файлы для согласования</span><div class="aq-files" id="aq-files"></div>
        <div class="row-in"><button class="btn sm" type="button" data-m="attach">Приложить файл…</button><span class="hint">Заказчик скачает их в кабинете и ответит «Согласовано» или «Есть замечания».</span></div></div>
      <p class="neg" id="aq-err"></p>
      <div class="modal-f"><button class="btn primary" type="submit">Запросить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`, { onClose: resolve, dismissed: false });
    const files = [];
    const drawFiles = () => { q('#aq-files').innerHTML = files.map((f, i) => `<span class="aq-file">${icon('file')}${esc(f.name)} <span class="hint">${fileSize(f.size)}</span><button type="button" class="linkbtn" data-m="unattach" data-i="${i}" aria-label="Убрать">✕</button></span>`).join(''); };
    q('#aq-title').focus();
    root.addEventListener('click', async e => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (m === 'attach') { const r = await api.attachAdd(p.id); if (r?.ok) { files.push(r.file); drawFiles(); } else if (r && !r.canceled) q('#aq-err').textContent = r.message; }
      if (m === 'unattach') { files.splice(Number(e.target.closest('[data-m]').dataset.i), 1); drawFiles(); }
    });
    root.addEventListener('change', e => { if (e.target.id === 'aq-title' && !root.querySelector('input[name="aq-kind"]:checked').dataset.touched) { const k = irdKindOf(e.target.value); root.querySelector(`input[name="aq-kind"][value="${k}"]`).checked = true; } if (e.target.name === 'aq-kind') e.target.dataset.touched = '1'; });
    q('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const title = q('#aq-title').value.trim(), kind = root.querySelector('input[name="aq-kind"]:checked').value, due = q('#aq-due').value, why = q('#aq-why').value.trim();
      if (!title) return modalErr(root, '#aq-err', 'Напишите, что нужно.', '#aq-title');
      const lbl = kinds.find(k => k[0] === kind)[1];
      const reqTitle = kind === 'decision' || kind === 'doc' || new RegExp('^' + lbl, 'i').test(title) ? title : `${lbl}: ${title}`;
      const requests = [...(p.requests || [])], ird = [...(p.ird || [])];
      const r = { id: newId(), title: reqTitle, due: isDate(due) ? due : '', why: why || (kind === 'decision' ? '' : IRD_WHY[kind]), done: false, irdId: '', ...(files.length ? { files } : {}) };
      if (kind !== 'decision') {
        const same = ird.find(x => x.title.trim().toLowerCase() === title.toLowerCase());
        const row = same ? { ...same, status: ['accepted', 'done'].includes(same.status) ? same.status : 'wait', due: r.due || same.due } : { id: newId(), title, kind, who: q('#aq-who').value.trim() || 'Заказчик', status: 'wait', due: r.due, note: why };
        if (same) ird[ird.indexOf(same)] = row; else ird.push(row);
        r.irdId = row.id;
      }
      requests.push(r);
      const ok = await write(op.update('projects', p.id, kind === 'decision' ? { requests } : { requests, ird }), `Запрос добавлен: ${reqTitle}${cab?.published?.[p.id] ? ' — отправляем в кабинет заказчика' : ''}`);
      if (ok) { close(true); if (cab?.published?.[p.id]) api.cabinetSync(); } // republish right away, not in 2 minutes
    });
  });
}
// A longer note (up to 200 characters) in a small dialog; null when cancelled.
function askNote(title, label, value = '') {
  return new Promise(resolve => {
    const { q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ntitle" novalidate><h2 id="ntitle">${esc(title)}</h2>
      <div class="f"><label for="n-text">${esc(label)}</label><textarea id="n-text" rows="3" maxlength="200">${esc(value)}</textarea></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`, { onClose: resolve });
    q('#n-text').focus();
    q('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); close(q('#n-text').value.trim()); });
  });
}
// Backlog 45 for dialogs: a stopped submit shows its reason in the dialog, highlights the field it is about,
// scrolls to it and puts the cursor there. `msg` empty clears the error.
function modalErr(root, errSel, msg, fieldSel = '') {
  const err = root.querySelector(errSel);
  if (err) { err.textContent = msg; err.hidden = !msg; err.setAttribute('role', 'alert'); }
  if (!msg) { root.querySelectorAll('.field-bad').forEach(x => x.classList.remove('field-bad')); return false; }
  const f = fieldSel && root.querySelector(fieldSel);
  if (f) {
    f.classList.add('field-bad');
    const off = () => f.classList.remove('field-bad');
    f.addEventListener('input', off, { once: true }); f.addEventListener('change', off, { once: true });
    f.scrollIntoView({ block: 'center' });
    f.focus?.({ preventScroll: true });
  } else err?.scrollIntoView({ block: 'nearest' });
  return false;
}
// The same outside dialogs: an error plate plus the highlighted field.
function pageErr(msg, fieldSel) { toast(msg, true); return modalErr(document, '#page-err-none', msg, fieldSel); }
// Small modal with one text field; resolves to the text or null.
function askText(title, label, placeholder = '') {
  return new Promise(resolve => {
    const { root, q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate><h2 id="mtitle">${esc(title)}</h2>
      <div class="f"><label class="req" for="m-text">${esc(label)}</label><input id="m-text" maxlength="40" placeholder="${esc(placeholder)}"></div>
      <div class="err" id="m-err" hidden></div>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`, { onClose: resolve });
    q('#m-text').focus();
    q('form').addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const v = q('#m-text').value.trim(); if (v) close(v); else modalErr(root, '#m-err', 'Заполните поле «' + label + '».', '#m-text'); });
  });
}
function confirmBox(text, yes = 'Да', no = 'Отмена') {
  return new Promise(resolve => {
    // Yes → true, the second button → false, dismissed (backdrop, Esc) → null.
    const { root, q, close } = openModal(`<div class="modal" role="alertdialog" aria-modal="true"><p>${esc(text)}</p><div class="modal-f"><button class="btn danger solid" type="button" data-m="yes">${esc(yes)}</button><button class="btn" type="button" data-m="no">${esc(no)}</button></div></div>`, { onClose: resolve });
    root.addEventListener('click', e => { if (e.target.dataset.m === 'no') close(false); if (e.target.dataset.m === 'yes') close(true); });
    q('[data-m="no"]').focus();
  });
}
async function askDocNames(format) {
  const p = state.projects.get(state.drawer.id) || {};
  const def = await api.docDefaults();
  const saved = loadLocal('docNames', {});
  const contact = p.contactId && state.users.get(p.contactId);
  const gipUser = contact || (A.isGip(state.me) ? state.me : liveUsers().find(u => u.role === 'gip'));
  const v = { customer: p.client || '', gip: saved.gip || gipUser?.name || '', developer: saved.developer || state.me?.name || '', director: saved.director || def.director || '', year: todayStr().slice(0, 4) };
  return new Promise(resolve => {
    const f = (k, label, hint = '') => `<div class="f"><label for="dn-${k}">${label}</label><input id="dn-${k}" value="${esc(v[k])}" maxlength="${k === 'customer' ? 300 : 60}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    const { root, q, close } = openModal(`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="dntitle" novalidate><h2 id="dntitle">${format === 'vok' ? 'Ведомость основных комплектов (РД)' : 'Состав проектной документации'}</h2>
      <p class="hint">Обложка, титульный лист и штампы — из шаблона офиса. Номера листов и «Листов» Word пересчитает сам при открытии.${def.own.includes(format) ? ' Используется ваш шаблон из папки шаблонов.' : ''}</p>
      ${f('customer', 'Заказчик', 'На обложке: «Заказчик – …»')}${f('gip', 'Главный инженер проекта', 'Титульный лист; в штамп — фамилия')}${f('developer', 'Разработал', 'В штамп — фамилия')}${f('director', 'Генеральный директор')}${f('year', 'Год')}
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить файл…</button><button class="btn" type="button" data-m="cancel">Отмена</button><button class="linkbtn" type="button" data-m="tpl">Свои шаблоны…</button></div></form>`, { onClose: resolve });
    q('#dn-customer').focus();
    root.addEventListener('click', e => { if (e.target.dataset.m === 'tpl') api.openTemplates(); });
    q('form').addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const out = Object.fromEntries(Object.keys(v).map(k => [k, q('#dn-' + k).value.trim()]));
      saveLocal('docNames', { gip: out.gip, developer: out.developer, director: out.director });
      close(out);
    });
  });
}

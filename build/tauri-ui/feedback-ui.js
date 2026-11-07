'use strict';
// Testing aid: «Режим пометок». Click any element to leave a comment for the developer; notes are exported
// as one ZIP (notes.md + screenshots). Lives in its own file so it can be removed without touching app.js.
(function () {
  const B = window.AppBridge, api = window.api;
  const { state, toast, esc } = B;
  const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const fb = { on: false, hoverEl: null, box: null, banner: null, count: 0 };

  const TAB_NAMES = () => Object.fromEntries(B.TABS.map(t => [t.id, t.label]));
  const shortText = el => (el?.innerText || el?.value || '').replace(/\s+/g, ' ').trim().slice(0, 120);

  // A useful element to comment on: tiny inline parts (icons, spans) climb to their control or block.
  function pick(target, bigger) {
    if (bigger) return target.closest('section, article, .panel, .card, .drawer, .modal, header, nav, .kb-col, tr, .menu') || target;
    return target.closest('button, a, input, select, textarea, label, [data-act], th, td, li, .chip, .ccount, h1, h2, h3, h4, legend, .att-item, .ctask, .kpi, .tl-row, .kb-card, .msg-item, .stat, .field, .f')
      || target;
  }
  function selectorOf(el) {
    const parts = [];
    for (let n = el, i = 0; n && n !== document.body && i < 5; n = n.parentElement, i++) {
      let p = n.tagName.toLowerCase();
      if (n.id) { p += '#' + n.id; parts.unshift(p); break; }
      if (n.dataset?.act) p += `[data-act="${n.dataset.act}"]`;
      if (n.dataset?.id) p += `[data-id="${n.dataset.id}"]`;
      else if (n.dataset?.ov) p += `[data-ov="${n.dataset.ov}"]`;
      else if (n.classList.length) p += '.' + [...n.classList].slice(0, 2).join('.');
      parts.unshift(p);
    }
    return parts.join(' > ');
  }
  function labelOf(el) {
    const own = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    const head = el.closest('section, article')?.querySelector('h3, h2')?.textContent?.trim();
    const t = shortText(el);
    return (t && t.length <= 60 ? t : own || (t ? t.slice(0, 60) + '…' : '')) || head || el.tagName.toLowerCase();
  }
  function whereOf(el) {
    const bits = [];
    const tab = TAB_NAMES()[state.tab];
    if (tab) bits.push(`вкладка «${tab}»`);
    const dr = el.closest('.drawer');
    if (dr) {
      bits.push(`панель «${dr.querySelector('#dtitle')?.textContent?.trim() || ''}»`);
      const dt = dr.querySelector('.dtab[aria-selected="true"]')?.textContent?.trim();
      if (dt) bits.push(`вкладка «${dt.replace(/\d+$/, '')}»`);
    }
    const modal = el.closest('.modal');
    if (modal) bits.push(`окно «${modal.querySelector('h2')?.textContent?.trim() || ''}»`);
    if (el.closest('#bar')) bits.push('заголовок окна');
    if (el.closest('#nav')) bits.push('панель вкладок');
    const sec = !dr && !modal ? el.closest('section, article')?.querySelector('h3, h2')?.textContent?.trim() : '';
    if (sec) bits.push(`блок «${sec}»`);
    bits.push(`окно ${innerWidth}×${innerHeight}`);
    return bits.join(', ');
  }

  // ---- highlight
  function ensureBox() {
    if (fb.box) return;
    fb.box = document.createElement('div');
    fb.box.className = 'fb-ui fb-box';
    document.body.append(fb.box);
  }
  function showBox(el) {
    ensureBox();
    const r = el.getBoundingClientRect();
    Object.assign(fb.box.style, { left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px', display: 'block' });
  }
  const hideBox = () => { if (fb.box) fb.box.style.display = 'none'; };

  // ---- mode on/off
  function setMode(on) {
    fb.on = on;
    document.documentElement.classList.toggle('fb-mode', on);
    $('#btn-fb')?.setAttribute('aria-pressed', String(on));
    if (on) {
      fb.banner = document.createElement('div');
      fb.banner.className = 'fb-ui fb-banner';
      fb.banner.innerHTML = `<b>Режим пометок</b><span>Щёлкните по любому элементу и напишите, что не так или что хочется. Alt+щелчок — весь блок. Esc — выход.</span>
        <button class="btn sm" type="button" data-fb="general">Общая пометка</button><button class="btn sm" type="button" data-fb="list">Мои пометки (<span class="fb-n">${fb.count}</span>)</button><button class="btn sm primary" type="button" data-fb="toggle">Готово</button>`;
      document.body.append(fb.banner);
    } else {
      fb.banner?.remove(); fb.banner = null; hideBox();
    }
  }
  const isUi = t => !!t.closest?.('.fb-ui');

  document.addEventListener('mousemove', e => {
    if (!fb.on || isUi(e.target) || document.querySelector('.fb-pop')) return;
    const el = pick(e.target, e.altKey);
    if (el !== fb.hoverEl) { fb.hoverEl = el; showBox(el); }
  }, true);
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick', 'dragstart']) {
    document.addEventListener(type, e => { if (fb.on && !isUi(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-fb]');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      const k = b.dataset.fb;
      if (k === 'toggle') setMode(!fb.on);
      if (k === 'list') openList();
      if (k === 'general') openPop(null);
      return;
    }
    if (!fb.on || isUi(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    if (document.querySelector('.fb-pop')) return;
    openPop(pick(e.target, e.altKey));
  }, true);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); setMode(!fb.on); return; }
    if (fb.on && e.key === 'Escape' && !document.querySelector('.fb-pop, .fb-list')) { e.preventDefault(); e.stopPropagation(); setMode(false); }
  }, true);

  // ---- note popup
  function openPop(el) {
    const meta = el ? { kind: 'element', label: labelOf(el), text: shortText(el), selector: selectorOf(el), where: whereOf(el), rect: el.getBoundingClientRect().toJSON() }
      : { kind: 'general', label: 'Общая пометка', where: whereOf(document.body) };
    if (el) showBox(el);
    const root = document.createElement('div');
    root.className = 'fb-ui modal-back fb-pop';
    root.innerHTML = `<form class="modal" role="dialog" aria-modal="true" novalidate><h2>${el ? 'Пометка к элементу' : 'Общая пометка'}</h2>
      <p class="hint">${esc(meta.where)}${el ? `<br>Элемент: <b>${esc(meta.label)}</b>` : ''}</p>
      <textarea id="fb-text" rows="5" maxlength="4000" placeholder="Что не так, что непонятно, что хочется изменить…"></textarea>
      <p class="hint">${el ? 'К пометке приложится снимок этого места экрана.' : 'Снимок не прикладывается.'} Ctrl+Enter — сохранить.</p>
      <div class="modal-f"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" data-m="cancel">Отмена</button></div></form>`;
    document.body.append(root);
    const ta = root.querySelector('#fb-text');
    ta.focus();
    const close = () => { root.remove(); if (!fb.on) hideBox(); };
    root.addEventListener('click', e => { if (e.target === root || e.target.dataset.m === 'cancel') close(); });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); root.querySelector('form').requestSubmit(); }
    });
    root.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const comment = ta.value.trim();
      if (!comment) { ta.focus(); return; }
      // Take the screenshot without our own popup and frame on it.
      root.style.display = 'none'; hideBox(); fb.banner && (fb.banner.style.visibility = 'hidden');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      try { await api.fbAdd({ ...meta, comment }); } catch (err) { toast('Не удалось сохранить пометку: ' + err.message, true); }
      fb.banner && (fb.banner.style.visibility = '');
      root.remove();
      await refreshCount();
      toast(`Пометка сохранена (всего ${fb.count})`);
    });
  }

  // ---- list, edit, export
  async function refreshCount() {
    fb.count = (await api.fbList()).length;
    const c = $('#fb-count'); if (c) c.textContent = fb.count ? String(fb.count) : '';
    $$('.fb-n').forEach(n => { n.textContent = fb.count; });
  }
  async function openList() {
    B.setFileMenu(false);
    const list = await api.fbList();
    document.querySelector('.fb-list')?.remove();
    const root = document.createElement('div');
    root.className = 'fb-ui modal-back fb-list';
    root.innerHTML = `<div class="modal wide-modal" role="dialog" aria-modal="true"><h2>Пометки для разработчика · ${list.length}</h2>
      <p class="hint">Режим пометок: кнопка 💬 в заголовке или Ctrl+Shift+F. Когда пометок наберётся достаточно — «Выгрузить файл» и отправьте архив разработчику.</p>
      <div class="fb-items">${list.length ? list.map((n, i) => `<div class="fb-item" data-id="${esc(n.id)}">
        <div class="fb-h"><b>${i + 1}. ${esc(n.label || '')}</b><span class="hint">${new Date(n.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${n.image ? ' · есть снимок' : ''}</span>
          <button class="btn ghostbtn sm" type="button" data-fbi="del" title="Удалить пометку">✕</button></div>
        <div class="hint">${esc(n.where || '')}</div>
        <textarea rows="2" data-fbi="text" maxlength="4000">${esc(n.comment || '')}</textarea></div>`).join('') : '<p class="hint">Пометок пока нет.</p>'}</div>
      <div class="modal-f"><button class="btn primary" type="button" data-fbi="export"${list.length ? '' : ' disabled'}>Выгрузить файл…</button>
        <button class="btn" type="button" data-fbi="close">Закрыть</button><span class="spacer"></span>
        <button class="btn danger" type="button" data-fbi="clear"${list.length ? '' : ' disabled'}>Удалить все</button></div></div>`;
    document.body.append(root);
    const close = () => root.remove();
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    root.addEventListener('change', async e => {
      if (e.target.dataset.fbi !== 'text') return;
      await api.fbUpdate(e.target.closest('.fb-item').dataset.id, e.target.value);
      toast('Пометка исправлена');
    });
    root.addEventListener('click', async e => {
      if (e.target === root) return close();
      const k = e.target.dataset?.fbi;
      if (k === 'close') close();
      if (k === 'del') { await api.fbDelete(e.target.closest('.fb-item').dataset.id); await refreshCount(); openList(); }
      if (k === 'clear') {
        if (e.target.dataset.armed !== '1') { e.target.dataset.armed = '1'; e.target.textContent = 'Точно удалить все?'; return; }
        await api.fbClear(); await refreshCount(); openList();
      }
      if (k === 'export') {
        const r = await api.fbExport();
        if (r?.ok) toast(`Выгружено пометок: ${r.count} — файл «${r.name}». Отправьте его разработчику.`);
        else if (!r?.canceled) toast(r?.message || 'Не удалось выгрузить.', true);
      }
    });
  }

  window.Feedback = { setMode, openList, refreshCount, isOn: () => fb.on };
  refreshCount();
})();

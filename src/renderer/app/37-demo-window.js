/* ---------- demo data (only on explicit click, marked as examples) ---------- */
async function seedDemo() {
  const d = n => addDays(todayStr(), n);
  const now = new Date().toISOString();
  const st = (n, from, to, note = '') => ({ ts: new Date(Date.now() + n * 864e5).toISOString(), date: d(n), type: 'status', from, to, note });
  const sh = (n, from, to, reason, note = '') => ({ ts: new Date(Date.now() + n * 864e5 - 1000).toISOString(), date: d(n), type: 'finish', from, to, reason, note });
  const P = [
    ['demo-p1', { name: 'Пример: ЖК «Северный», корп. 2', code: '0425-24', client: 'ООО «Пример-Девелопмент»', status: 'expertise', contactId: 'u-gip',
      phases: [{ key: 'contract', start: d(-200), finish: d(-185), done: d(-186) }, { key: 'survey', start: d(-185), finish: d(-150), done: d(-152) }, { key: 'ird', start: d(-185), finish: d(-140), done: d(-141) },
        { key: 'p', start: d(-150), finish: d(-50), done: d(-48) }, { key: 'expertise', start: d(-48), finish: d(22), done: '' }, { key: 'r', start: d(25), finish: d(115), done: '' }, { key: 'an', start: d(115), finish: d(300), done: '' }],
      milestones: [{ id: 'dm1', title: 'договор', date: d(-186), done: true }, { id: 'dm2', title: 'ПД на экспертизу', date: d(-48), done: true }, { id: 'dm3', title: 'заключение', date: d(22), done: false }, { id: 'dm4', title: 'РД', date: d(115), done: false }],
      requests: [{ id: 'dr1', title: 'ТУ на электроснабжение 630 кВт', due: d(2), why: 'Без них экспертиза не примет раздел ИОС1.', done: false }, { id: 'dr2', title: 'Кран-балки: 10 т или 16 т', due: d(5), why: '', done: false }],
      protocol: { no: '7', date: d(-8), items: [{ id: 'di1', text: 'Ответы экспертизе по КР', who: 'us', status: 'work', pct: 60 }, { id: 'di2', text: 'ТУ на 630 кВт', who: 'customer', status: 'wait', pct: 0 }, { id: 'di3', text: 'Ворота 6×6 м на торец', who: 'us', status: 'done', pct: 0 }] },
      docs: [{ id: 'dd1', title: 'ТУ на водоснабжение и водоотведение', until: d(45), remind: 60 }, { id: 'dd2', title: 'ГПЗУ', until: d(130), remind: 90 }, { id: 'dd3', title: 'Инженерные изыскания', until: d(600), remind: 180 }],
      advice: { title: 'Рабочая документация на сети', text: 'По договору у вас только стадия П. После заключения экспертизы понадобится РД на наружные сети — начнём сразу, без паузы.' } }],
    ['demo-p2', { name: 'Пример: Склад класса А, Подольск', code: '0611-24', client: 'ГИП Пример П.П.' }],
  ];
  const C = [
    ['demo-c1', { name: 'Пример: Петров А.С.', specialty: 'ЭОМ, ЭС, ЭО, ЭН', phone: '+7 900 000-00-01', email: 'petrov@example.com', messenger: 'Telegram @example_petrov' }],
    ['demo-c2', { name: 'Пример: Сидорова Е.В.', specialty: 'СС, СКС, СКУД, ОС', phone: '+7 900 000-00-02', email: 'sidorova@example.com', messenger: '' }],
    ['demo-c3', { name: 'Пример: ИП Кузнецов', specialty: 'АПС, СОУЭ', phone: '+7 900 000-00-03', email: '', messenger: 'WhatsApp +7 900 000-00-03' }],
  ];
  const plan3070 = [{ id: 'pl1', title: 'Аванс', pct: 30, trigger: 'start' }, { id: 'pl2', title: 'Окончательный расчёт', pct: 70, trigger: 'accepted' }];
  const T = [
    ['demo-t1', { projectId: 'demo-p1', sections: ['ЭОМ', 'ЭО'], title: 'стадия Р', contractorId: 'demo-c1', start: d(-40), finish: d(-5), status: 'in_progress', budget: 180000, contractNo: '12/24-П', contractDate: d(-42), invoiceReceived: true,
      plan: plan3070, payments: [{ id: 'a1', date: d(-40), amount: 54000, note: 'Аванс 30%' }],
      milestones: [{ id: 'm1', title: 'Задание смежникам', date: d(-20), done: true }, { id: 'm2', title: 'Промежуточная сдача', date: d(-10), done: false }],
      history: [st(-40, null, 'in_progress'), sh(-12, d(-15), d(-5), 'contractor', 'не успевает')] }],
    ['demo-t2', { projectId: 'demo-p1', sections: ['СС', 'СКС'], title: '', contractorId: 'demo-c2', start: d(-30), finish: d(6), status: 'in_progress', budget: 95000, plan: plan3070, dependsOn: ['demo-t1'],
      payments: [{ id: 'a2', date: d(-30), amount: 28500, note: 'Аванс' }], history: [st(-30, null, 'in_progress'), sh(-8, d(-2), d(6), 'customer', 'заказчик сменил ТУ')] }],
    ['demo-t3', { projectId: 'demo-p1', sections: ['АПС', 'СОУЭ'], title: '', contractorId: 'demo-c3', start: d(-25), finish: d(-1), status: 'review', budget: 115000,
      plan: [{ id: 'pl3', title: 'Аванс', pct: 30, trigger: 'start' }, { id: 'pl4', title: 'При сдаче', pct: 40, trigger: 'review' }, { id: 'pl5', title: 'После приёмки', pct: 30, trigger: 'accepted' }],
      payments: [{ id: 'a3', date: d(-25), amount: 34500, note: 'Аванс' }],
      history: [st(-25, null, 'in_progress'), st(-9, 'in_progress', 'review'), st(-6, 'review', 'revision', 'нет расчёта АКБ'), st(-2, 'revision', 'review')] }],
    ['demo-t5', { projectId: 'demo-p2', sections: ['ЭС', 'ЭН'], title: 'наружные сети 0,4 кВ', contractorId: 'demo-c1', start: d(-60), finish: d(-20), status: 'done', budget: 120000, invoiceReceived: true,
      plan: plan3070, payments: [{ id: 'a5', date: d(-60), amount: 36000, note: 'Аванс' }, { id: 'a6', date: d(-15), amount: 84000, note: 'Окончательный расчёт' }],
      history: [st(-60, null, 'in_progress'), st(-22, 'in_progress', 'review'), st(-18, 'review', 'done')] }],
    ['demo-t6', { projectId: 'demo-p2', sections: ['СКУД', 'ОС'], title: '', contractorId: 'demo-c2', start: d(-10), finish: d(4), status: 'revision', budget: 60000,
      history: [st(-10, null, 'in_progress'), st(-4, 'in_progress', 'review'), st(-2, 'review', 'revision', 'не учтены турникеты')] }],
    ['demo-t7', { projectId: 'demo-p2', sections: ['СОТ'], title: '', contractorId: '', start: d(-3), finish: d(30), status: 'not_started', budget: 55000, history: [st(-3, null, 'not_started')] }],
  ];
  // Sample team: a specialist under the current chief (or the first chief), a second chief for water and HVAC without budget access.
  const chief = A.isChief(state.me) ? state.me : usersByRole('chief')[0];
  const U = [
    ['demo-u1', { name: 'Пример: Орлов Д.К.', role: 'specialist', directions: ['el', 'ss'], chiefId: chief?.id || '', absences: [{ id: 'ab1', kind: 'vacation', from: d(5), to: d(18), note: '' }] }],
    ['demo-u2', { name: 'Пример: Белова Н.А.', role: 'chief', directions: ['vk', 'ov'], canSeeBudget: false }],
    ['demo-u3', { name: 'Пример: Зайцев И.П.', role: 'specialist', directions: ['vk'], chiefId: 'demo-u2' }],
  ];
  const owners = { 'demo-t1': 'demo-u1', 'demo-t3': 'demo-u1' };
  T.push(['demo-t8', { projectId: 'demo-p2', sections: ['ВК', 'НВК'], title: '', contractorId: '', start: d(-14), finish: d(12), status: 'in_progress', budget: 70000, history: [st(-14, null, 'in_progress')] }]);
  T.push(['demo-t9', { projectId: 'demo-p2', sections: ['ОВ', 'ИТП'], title: '', contractorId: '', start: d(-5), finish: d(25), status: 'not_started', budget: 90000, history: [st(-5, null, 'not_started')] }]);
  owners['demo-t8'] = 'demo-u2'; owners['demo-t9'] = 'demo-u2';
  // Participants of the warehouse — the sample chats (project, personal, group) come from main after the records.
  const gipId = (A.isGip(state.me) ? state.me : liveUsers().find(u => u.role === 'gip'))?.id || '';
  if (gipId) P[1][1].members = [gipId, 'demo-u2', 'demo-u3'];
  // Sample people are created for the GIP and for a chief alike (main lets demo records through).
  const withTeam = !isSpec();
  const ops = [
    ...(withTeam ? U.map(([id, x]) => op.set('users', id, { ...x, demo: true, createdAt: now })) : []),
    ...P.map(([id, x]) => op.set('projects', id, { ...x, note: '', demo: true, createdAt: now })),
    ...C.map(([id, x]) => op.set('contractors', id, { ...x, note: '', demo: true, createdAt: now })),
    ...T.map(([id, x]) => op.set('tasks', id, { ...x, createdAt: x.history?.[0]?.ts || now,
      ...(withTeam && id === 'demo-t3' ? { comments: [{ id: 'cm1', ts: x.history.at(-1).ts, userId: 'demo-u1', user: 'Пример: Орлов Д.К.', kind: 'submit', text: 'Исправил расчёт АКБ, добавил схему СОУЭ 2 этажа.' }] } : {}), ...(withTeam && id === 'demo-t2' ? { coOwnerIds: ['demo-u1'] } : {}), section: x.sections.join(', '), ownerId: (withTeam && owners[id]) || (A.isGip(state.me) ? chief?.id : state.me?.id) || '', note: '', demo: true })),
  ];
  const ok = await write(ops, 'Примеры добавлены');
  if (ok && withTeam) { await api.chatSeedDemo(); await refresh(); }
  return ok;
}
async function clearDemo() {
  // Done in the main process: it also removes sample cards and people outside this user's view.
  const res = await api.clearDemo();
  if (!res?.ok) return toast(res?.message || 'Не удалось удалить примеры.', true);
  toast('Примеры удалены');
}

/* ---------- window chrome ---------- */
function applyWinState(s) {
  const wasCompact = state.win.compact;
  state.win = s;
  const shell = $('#shell');
  shell.classList.toggle('compact', !!s.compact);
  shell.classList.toggle('maxed', !!s.maximized);
  const mb = $('#btn-max');
  if (mb) { mb.title = s.maximized ? 'Вернуть прежний размер (F11)' : 'На весь экран (F11, двойной щелчок по заголовку)'; mb.setAttribute('aria-pressed', String(!!s.maximized)); }
  shell.classList.toggle('ghost', !!s.clickThrough);
  document.documentElement.style.setProperty('--alpha', String(s.opacity));
  document.documentElement.dataset.theme = s.theme || 'system';
  const slider = $('#alpha');
  if (document.activeElement !== slider) slider.value = String(Math.round(s.opacity * 100));
  const backdrop = s.backdrop && s.backdrop !== 'none';
  if (s.backdrop) document.documentElement.dataset.backdrop = s.backdrop;
  slider.disabled = backdrop;
  slider.closest('.alpha').title = backdrop ? 'Сейчас фон окна — Mica или акрил (Окно → Фон окна); прозрачность задаёт Windows' : 'Непрозрачность окна';
  $('#btn-pin').setAttribute('aria-pressed', String(!!s.alwaysOnTop));
  $('#btn-pin').title = s.alwaysOnTop ? 'Закреплено поверх всех окон — нажмите, чтобы открепить' : 'Закрепить поверх всех окон';
  $('#btn-compact').title = s.compact ? 'Развернуть' : 'Компактный виджет';
  if (!$('#view-menu').hidden) renderViewMenu();
  if (s.compact && state.drawer) closeDrawer();
  if (wasCompact !== s.compact) renderNow();
}

let alphaTimer = null;
$('#alpha').addEventListener('input', e => {
  const v = Number(e.target.value) / 100;
  state.win.opacity = v;
  document.documentElement.style.setProperty('--alpha', String(v));
  clearTimeout(alphaTimer);
  alphaTimer = setTimeout(() => api.setOpacity(v), 250);
});

// Click-through: the main process forwards mouse moves, so hovering the unlock pill can take the mouse back.
const unlock = $('#unlock');
unlock.addEventListener('mouseenter', () => { if (state.win.clickThrough) api.hoverUnlock(true); });
unlock.addEventListener('mouseleave', () => { if (state.win.clickThrough) api.hoverUnlock(false); });

// Resize grip (frameless transparent windows have no reliable native resize border on Windows).
const grip = $('#grip');
grip.addEventListener('pointerdown', e => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const start = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight };
  let frame = 0;
  const move = ev => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => api.setSize(start.w + ev.screenX - start.x, start.h + ev.screenY - start.y));
  };
  const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
});

/* ---------- buttons and links of this part: data-act → handler (dispatched in 38-events.js) ---------- */
onAct({
  'seed-demo': ({ el }) => { el.disabled = true; seedDemo(); },
  'clear-demo': ({ el }) => { el.disabled = true; clearDemo(); },
  'toggle-pin': () => { api.setAlwaysOnTop(!state.win.alwaysOnTop); },
  'toggle-compact': () => { api.setCompact(!state.win.compact); },
  'ghost-on': () => { api.setClickThrough(true); toast('Сквозные клики включены. Вернуть управление: Ctrl+Alt+G или кнопка вверху окна.'); },
  'ghost-off': () => { api.setClickThrough(false); },
  'minimize': () => { api.minimize(); },
  'toggle-max': () => { api.setMaximized(!state.win.maximized); },
  'hide': () => { api.hide(); },
});

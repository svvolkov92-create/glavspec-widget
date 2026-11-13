// Roles and permissions. Pure functions shared by the window, the main process and (later) a server.
// Locally they shape the interface; they are not a security boundary while all data sits in one file.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Access = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROLES = {
    gip: { label: 'ГИП', title: 'Пульт ГИПа' },
    chief: { label: 'Главспец', title: 'Пульт главспеца' },
    specialist: { label: 'Специалист', title: 'Пульт специалиста' },
  };

  // Directions a chief can lead (any combination). Marks link a direction to the card's sections.
  // 4.1 (the user's list, 11.11): ПОС separate (ПОД is part of it), ПБ and ОДИ with the architects, АСКУЭ with low current,
  // ООС and the rest — «Прочие» (no direction). ЭЭ is not a section.
  const DIRECTIONS = [
    { id: 'ar', label: 'Архитекторы', marks: ['АР', 'АС', 'ГП', 'ПЗУ', 'ПБ', 'ОДИ', 'АИ'] },
    { id: 'kr', label: 'Конструкторы', marks: ['КР', 'КЖ', 'КМ', 'КЖО', 'КМД', 'КД'] },
    { id: 'el', label: 'Электрики', marks: ['ЭОМ', 'ЭС', 'ЭМ', 'ЭО', 'ЭН', 'КЭ'] },
    { id: 'ss', label: 'Слаботочники', marks: ['СС', 'СКС', 'АПС', 'СОУЭ', 'СОТ', 'СКУД', 'ОС', 'ДС', 'АСКУЭ'] },
    { id: 'vk', label: 'Водоснабжение и канализация', marks: ['ВК', 'НВК', 'НВ', 'НК', 'АУПТ'] },
    { id: 'ov', label: 'Отопление и вентиляция', marks: ['ОВ', 'ТС', 'ИТП', 'ТМ'] },
    { id: 'pos', label: 'ПОС', marks: ['ПОС', 'ПОД'] },
  ];

  // Icon and colour of a mark: the direction, with water split into supply (tap) and sewerage (drops).
  const SEWER_MARKS = new Set(['К', 'НК', 'К1', 'К2', 'К3', 'КН']);
  function markKind(m) {
    // ПП 87 codes of the stage «П»: ИОС1 электроснабжение … ИОС5 сети связи.
    const ios = String(m || '').trim().toUpperCase().match(/^ИОС([1-5])/);
    if (ios) return ['el', 'water', 'sewer', 'ov', 'ss'][Number(ios[1]) - 1];
    const b = baseMark(m);
    if (SEWER_MARKS.has(b) || /^Н?К\d*$/.test(String(m || '').trim().toUpperCase())) return 'sewer';
    if (['В', 'НВ', 'В1', 'В2'].includes(b)) return 'water';
    const d = directionOfMark(m);
    return d ? (d.id === 'vk' ? 'water' : d.id) : '';
  }
  // A person's main kind (for the office and people lists): the first direction.
  const userKind = u => ((u?.directions || [])[0] === 'vk' ? 'water' : (u?.directions || [])[0] || '');
  // An outside contractor's directions, from the marks in the specialty text.
  function contractorKinds(c) {
    const kinds = [];
    for (const m of String(c?.specialty || '').split(/[,;\n/]+/).map(x => x.trim()).filter(Boolean)) { const k = markKind(m); if (k && !kinds.includes(k)) kinds.push(k); }
    return kinds;
  }

  // Fields that reveal money. Hidden from users without budget access and never writable by them.
  const MONEY_FIELDS = ['budget', 'payments', 'plan', 'invoiceReceived', 'invoiceDate', 'actSigned', 'actDate', 'contractNo', 'contractDate'];
  // What a specialist may change on own cards.
  const SPECIALIST_FIELDS = ['status', 'history', 'milestones', 'note', 'timeLog'];

  const roleOf = u => (u && ROLES[u.role] ? u.role : null);
  const isGip = u => roleOf(u) === 'gip';
  const isChief = u => roleOf(u) === 'chief';
  const isSpecialist = u => roleOf(u) === 'specialist';
  const titleFor = u => (roleOf(u) ? ROLES[u.role].title : 'Пульт главспеца');
  const directionLabels = u => DIRECTIONS.filter(d => (u?.directions || []).includes(d.id)).map(d => d.label);

  const asList = users => (users instanceof Map ? [...users.values()] : Array.isArray(users) ? users : Object.entries(users || {}).map(([id, u]) => ({ ...u, id })));
  const liveUsers = users => asList(users).filter(u => !u.deletedAt);

  // People whose cards the user sees: everyone for the GIP, self + own specialists for a chief, self otherwise.
  function teamIds(user, users) {
    if (!user) return new Set();
    if (isGip(user)) return new Set(liveUsers(users).map(u => u.id).concat(['']));
    if (isChief(user)) return new Set([user.id, ...liveUsers(users).filter(u => isSpecialist(u) && u.chiefId === user.id).map(u => u.id)]);
    return new Set([user.id]);
  }

  // What a person does, for the «doesn't fit» message.
  const profileText = u => (directionLabels(u).length ? directionLabels(u).join(', ') : 'направления не заданы');
  // Outside contractor: specialty is free text with marks («ЭОМ, ЭС, ЭН»). Empty specialty is not checked.
  function contractorGaps(c, task) {
    const own = new Set(String(c?.specialty || '').split(/[,;\n/]+/).map(baseMark).filter(Boolean));
    if (!own.size) return [];
    return marksOf(task).filter(m => !own.has(baseMark(m)));
  }

  // Card marks a person may take: those of their directions. Marks outside the catalogue (АР, КЖ…) are not limited.
  // Numbered variants («ЭОМ1», «ОВ.2») count as the base mark.
  const baseMark = m => String(m || '').trim().toUpperCase().replace(/[\s.\-]*\d+$/, '');
  const directionOfMark = m => DIRECTIONS.find(d => d.marks.includes(baseMark(m))) || null;
  const marksOf = t => (Array.isArray(t?.sections) && t.sections.length ? t.sections : String(t?.section || '').split(/[,;\n]+/)).map(x => String(x).trim()).filter(Boolean);
  // Marks of `task` outside the directions of `user`: [{ mark, direction }]. The GIP is not limited.
  function profileGaps(user, task) {
    if (!user || isGip(user)) return [];
    const own = new Set(user.directions || []);
    return marksOf(task).map(mark => ({ mark, direction: directionOfMark(mark) })).filter(x => x.direction && !own.has(x.direction.id));
  }
  function profileMessage(user, gaps) {
    const dirs = [...new Set(gaps.map(g => g.direction.label))].join(', ');
    return `${user.name} не подходит по специальности для ${gaps.map(g => g.mark).join(', ')} (нужно направление «${dirs}»). ${user.name} делает: ${profileText(user)}.`;
  }

  const canSeeMoney = u => isGip(u) || (isChief(u) && !!u.canSeeBudget);
  const canCreateTasks = u => isGip(u) || isChief(u);
  const canManageCatalog = u => isGip(u) || isChief(u);   // projects and outside contractors
  const canManageUsers = u => isGip(u);
  const canUseDataTools = u => isGip(u);                   // import, backup, restore
  const canEditTaskFields = u => isGip(u) || isChief(u);   // dates, marks, owner, contractor…

  // Responsible staff of a card: the main one plus co-owners (one job shared by several people).
  const ownersOf = t => [...new Set([t?.ownerId, ...(Array.isArray(t?.coOwnerIds) ? t.coOwnerIds : [])].filter(Boolean))];

  function canSeeTask(user, task, users, team = null) {
    if (!user || !task) return false;
    if (isGip(user)) return true;
    team = team || teamIds(user, users);
    const owners = ownersOf(task);
    return owners.length ? owners.some(id => team.has(id)) : team.has('');
  }

  // Who a card can be handed down to. The GIP: anyone; a chief: self and own specialists.
  function assignableOwners(user, users) {
    if (isGip(user)) return liveUsers(users);
    if (isChief(user)) return liveUsers(users).filter(u => u.id === user.id || (isSpecialist(u) && u.chiefId === user.id));
    return user ? [user] : [];
  }

  function redactTask(task) {
    const out = { ...task };
    for (const f of MONEY_FIELDS) delete out[f];
    out.moneyHidden = true;
    return out;
  }

  // The slice of the database a user may see. `snapshot` has arrays with `id` on each record.
  // Who reads and writes the project chat: the GIP and the participants (project.members).
  const canChat = (user, p) => !!user && !!p && (isGip(user) || (Array.isArray(p.members) && p.members.includes(user.id)));
  // Messenger (3.8): a project chat is the project's (GIP and participants); personal and group chats — their members.
  const canSeeChat = (user, chat, projects) => {
    if (!user || !chat) return false;
    if (chat.kind === 'project') return canChat(user, (projects || []).find(p => p.id === chat.projectId && !p.deletedAt));
    return Array.isArray(chat.members) && chat.members.includes(user.id);
  };
  function viewFor(user, snapshot) {
    const users = snapshot.users || [];
    const money = canSeeMoney(user);
    const team = teamIds(user, users); // once, not per card
    const tasks = (snapshot.tasks || []).filter(t => canSeeTask(user, t, users, team)).map(t => (money ? t : redactTask(t)));
    let projects = snapshot.projects || [];
    let contractors = snapshot.contractors || [];
    if (isSpecialist(user)) {
      const pids = new Set(tasks.map(t => t.projectId)), cids = new Set(tasks.map(t => t.contractorId));
      projects = projects.filter(p => pids.has(p.id) || (Array.isArray(p.members) && p.members.includes(user.id))); // participants see the project
      contractors = contractors.filter(c => cids.has(c.id)).map(c => { const { requisites, ...rest } = c; return rest; });
    }
    const chats = (snapshot.chats || []).filter(c => canSeeChat(user, c, snapshot.projects || []));
    // «Договор» in the project plan and the customer's contract, payments and bills are for GIPs only.
    if (!isGip(user)) projects = projects.map(p => { const { contract, payments, bills, ...rest } = p; return Array.isArray(p.phases) ? { ...rest, phases: p.phases.filter(ph => ph.key !== 'contract') } : rest; });
    return { projects, contractors, tasks, users, chats };
  }
  // A non-GIP saves the plan without the hidden «Договор» row: keep the stored one.
  function keepHiddenPhases(user, before, data) {
    if (isGip(user) || !data || !Array.isArray(data.phases)) return data;
    const hidden = (before?.phases || []).filter(ph => ph.key === 'contract');
    return { ...data, phases: [...hidden, ...data.phases.filter(ph => ph.key !== 'contract')] };
  }
  // Shape of the customer-page data on a project (written from the page, so checked here).
  const isDateStr = v => v === '' || v == null || /^\d{4}-\d{2}-\d{2}$/.test(v);
  function projectDataError(p) {
    if (!p) return null;
    const list = (v, max) => v === undefined || (Array.isArray(v) && v.length <= max);
    if (!list(p.phases, 20) || !list(p.milestones, 50) || !list(p.requests, 50) || !list(p.docs, 50)) return 'Слишком много строк в данных для заказчика.';
    if (!list(p.members, 200) || (p.members || []).some(m => typeof m !== 'string' || m.length > 40)) return 'Список участников проекта повреждён.';
    if (!list(p.ird, 150) || !list(p.meetings, 150) || !list(p.payments, 60) || !list(p.bills, 150)) return 'Слишком много строк в данных для заказчика.';
    for (const x of [...(p.ird || []), ...(p.meetings || []), ...(p.payments || []), ...(p.bills || [])]) if (!x || typeof x !== 'object' || String(x.title ?? '').length > 300 || !isDateStr(x.date ?? x.due ?? '')) return 'Проверьте исходные данные, встречи и финансы проекта.';
    for (const x of p.ird || []) if (!isDateStr(x.due)) return 'Проверьте сроки исходных данных.';
    if (p.contract !== undefined && p.contract !== null && (typeof p.contract !== 'object' || !isDateStr(p.contract.date) || !(Number(p.contract.sum) >= 0))) return 'Проверьте договор проекта.';
    for (const ph of p.phases || []) if (!ph || typeof ph.key !== 'string' || ![ph.start, ph.finish, ph.done].every(isDateStr)) return 'Проверьте даты этапов проекта.';
    for (const m of [...(p.milestones || []), ...(p.requests || [])]) if (!m || typeof m.title !== 'string' || m.title.length > 300 || !isDateStr(m.date ?? m.due)) return 'Проверьте вехи и запросы заказчику.';
    for (const r of p.requests || []) if (r.files !== undefined && (!Array.isArray(r.files) || r.files.length > 20 || r.files.some(f => !f || typeof f.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(f.id) || typeof f.name !== 'string' || f.name.length > 200 || !(Number(f.size) >= 0)))) return 'Файлы запроса повреждены.';
    for (const d of p.docs || []) if (!d || typeof d.title !== 'string' || !isDateStr(d.until)) return 'Проверьте сроки документов.';
    if (p.protocol !== undefined && p.protocol !== null && (typeof p.protocol !== 'object' || !list(p.protocol.items, 60))) return 'Протокол повреждён.';
    return null;
  }

  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const changedKeys = (before, after) => {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return [...keys].filter(k => !same(before?.[k], after?.[k]));
  };

  /**
   * Returns null when `user` may turn `before` into `after` (either may be null), otherwise a message.
   * `col` is the collection; `users` the current users (array or map).
   */
  // Absences (vacation, sick leave) of a person may be kept by the GIP, the person's chief and the person.
  function canEditAbsences(user, target) {
    if (!user || !target) return false;
    return isGip(user) || user.id === target.id || (isChief(user) && isSpecialist(target) && target.chiefId === user.id);
  }
  function checkWrite(user, col, before, after, users, id = '') {
    if (!user) return 'Не выбран пользователь.';
    if (col === 'users') {
      if (canManageUsers(user)) return null;
      const target = before && { ...before, id };
      if (before && after && changedKeys(before, after).every(k => k === 'absences') && canEditAbsences(user, target)) return null;
      return 'Состав команды меняет только ГИП.';
    }
    if (col === 'projects' || col === 'contractors') return !canManageCatalog(user) ? 'Проекты и внештатных исполнителей ведут ГИП и главспецы.' : col === 'projects' ? projectDataError(after) : null;
    if (col !== 'tasks') return 'Неизвестный раздел данных.';
    // A card cannot be handed to someone without its direction unless the assigner confirmed it
    // («всё равно назначить» → profileOk). Checked for everyone, the GIP included.
    if (after && !after.deletedAt && !after.profileOk) {
      const k = changedKeys(before, after);
      if (!before || k.some(x => ['ownerId', 'coOwnerIds', 'sections', 'section', 'profileOk'].includes(x))) {
        for (const id of ownersOf(after)) {
          const owner = liveUsers(users).find(u => u.id === id);
          const gaps = profileGaps(owner, after);
          if (gaps.length) return profileMessage(owner, gaps);
        }
      }
    }
    // Hand-set readiness is 1…90 %: 90 comes with review, 100 with acceptance (checked for everyone).
    if (after && after.readiness !== undefined && after.readiness !== null && changedKeys(before, after).includes('readiness')) {
      const r = Number(after.readiness);
      if (!Number.isInteger(r) || r < 1 || r > 90) return 'Готовность в работе — целое число от 1 до 90 %.';
    }
    if (isGip(user)) return null;
    if (before && !canSeeTask(user, before, users)) return 'Эта карточка вне вашей зоны доступа.';
    if (!before && !canCreateTasks(user)) return 'Специалист не создаёт карточки — их спускает главспец или ГИП.';
    if (!after) return isSpecialist(user) ? 'Специалист не удаляет карточки.' : null;
    const keys = changedKeys(before, after);
    if (!canSeeMoney(user) && keys.some(k => MONEY_FIELDS.includes(k))) return 'Нет доступа к бюджету и оплатам.';

    if (isSpecialist(user)) {
      const extra = keys.filter(k => !SPECIALIST_FIELDS.includes(k));
      return extra.length ? 'Специалист может менять только статус, контрольные точки и примечание своих карточек.' : null;
    }
    // A chief hands cards down only to self or own specialists.
    if (keys.includes('ownerId') || keys.includes('coOwnerIds') || !before) {
      const can = new Set(assignableOwners(user, users).map(u => u.id));
      const was = new Set(before ? ownersOf(before) : []);
      if (!can.has(after.ownerId) && (!before || keys.includes('ownerId'))) return 'Главспец может спускать карточки только своим специалистам.';
      if (ownersOf(after).some(id => !was.has(id) && !can.has(id))) return 'Главспец может спускать карточки только своим специалистам.';
    }
    return null;
  }

  /* ---------- absences, inbox, activity ---------- */
  const ABSENCE_KINDS = { vacation: 'отпуск', sick: 'больничный', other: 'отсутствует' };
  const absencesOf = u => (Array.isArray(u?.absences) ? u.absences : []).filter(a => a && a.from && a.to && a.from <= a.to);
  // Absences of the card's people that overlap its work period (start…finish, or just finish).
  // `onFinish`: the deadline itself falls into the absence.
  function absenceHits(task, users) {
    const end = task?.finish;
    if (!end || task.status === 'done') return [];
    const start = task.start && task.start <= end ? task.start : end;
    const all = liveUsers(users);
    const out = [];
    for (const id of ownersOf(task)) {
      const u = all.find(x => x.id === id);
      for (const a of absencesOf(u)) if (a.from <= end && a.to >= start) out.push({ user: u, absence: a, onFinish: a.from <= end && a.to >= end });
    }
    return out;
  }
  const absenceText = h => `${h.user.name}: ${ABSENCE_KINDS[h.absence.kind] || 'отсутствует'} ${h.absence.from.split('-').reverse().join('.')}–${h.absence.to.split('-').reverse().join('.')}`;
  // A card is «new» for a person while something addressed to them (assignment, comment, submission) is unread.
  const isUnread = (task, uid) => !!(uid && task?.notify?.[uid] && task.notify[uid] > (task.seen?.[uid] || ''));
  // Last time anything happened on a card: an edit, a status change, a comment.
  function lastActivity(task) {
    const ts = [task?.updatedAt, task?.createdAt, ...(task?.history || []).map(h => h.ts), ...(task?.comments || []).map(c => c.ts)].filter(Boolean);
    return ts.sort().at(-1) || '';
  }
  // Who should hear about a card: its people and their chiefs (the GIP for cards led by a chief or nobody).
  function reviewersOf(task, users) {
    const all = liveUsers(users), out = new Set();
    for (const id of ownersOf(task)) {
      const u = all.find(x => x.id === id);
      if (isSpecialist(u) && u.chiefId) out.add(u.chiefId);
      else all.filter(isGip).forEach(g => out.add(g.id));
    }
    if (!ownersOf(task).length) all.filter(isGip).forEach(g => out.add(g.id));
    return [...out];
  }

  return {
    ROLES, ABSENCE_KINDS, absencesOf, absenceHits, absenceText, isUnread, lastActivity, reviewersOf, canEditAbsences, DIRECTIONS, MONEY_FIELDS, SPECIALIST_FIELDS,
    roleOf, isGip, isChief, isSpecialist, titleFor, directionLabels,
    teamIds, canSeeMoney, canCreateTasks, canManageCatalog, canManageUsers, canUseDataTools, canEditTaskFields,
    canSeeTask, assignableOwners, redactTask, viewFor, canChat, canSeeChat, checkWrite, keepHiddenPhases, projectDataError,
    baseMark, directionOfMark, markKind, userKind, contractorKinds, marksOf, profileGaps, profileMessage, profileText, contractorGaps, ownersOf,
  };
});

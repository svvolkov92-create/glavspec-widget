// Composition of project documentation («состав проекта»), based on Government Decree No. 87
// (ПП РФ от 16.02.2008 № 87, ред. от 21.10.2025). Shared by the window, the main process and tests.
// A composition is a flat list of nodes { id, parentId, kind, title, abbr, on, code?, tom?, marks, ownerId, contractorId, taskId }.
// kind: 'section' (раздел) → 'sub' (подраздел) → 'book' (книга) → 'part' (часть).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Composition = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const IOS = [
    ['ИОС1', 'Система электроснабжения', ['ЭС', 'ЭН', 'ЭОМ', 'ЭО']],
    ['ИОС2', 'Система водоснабжения', ['В', 'НВ']],
    ['ИОС3', 'Система водоотведения', ['К', 'НК']],
    ['ИОС4', 'Отопление, вентиляция и кондиционирование воздуха, тепловые сети', ['ОВ', 'ТС', 'ИТП']],
    ['ИОС5', 'Сети связи', ['СС', 'СКС', 'АПС', 'СОУЭ']],
    ['ИОС6', 'Система газоснабжения', ['ГСН', 'ГСВ']],
  ];
  // [number, abbr, title, on by default, subsections, typical working-documentation marks]
  const PROD = [
    [1, 'ПЗ', 'Пояснительная записка', true],
    [2, 'ПЗУ', 'Схема планировочной организации земельного участка', true, null, ['ГП']],
    [3, 'АР', 'Объемно-планировочные и архитектурные решения', true, null, ['АР']],
    [4, 'КР', 'Конструктивные решения', true, null, ['КЖ', 'КМ']],
    [5, 'ИОС', 'Сведения об инженерном оборудовании, о сетях и системах инженерно-технического обеспечения', true, IOS],
    [6, 'ТХ', 'Технологические решения', true, null, ['ТХ']],
    [7, 'ПОС', 'Проект организации строительства', true],
    [8, 'ООС', 'Мероприятия по охране окружающей среды', true],
    [9, 'ПБ', 'Мероприятия по обеспечению пожарной безопасности', true],
    [10, 'ТБЭ', 'Требования к обеспечению безопасной эксплуатации объектов капитального строительства', true],
    [11, 'ОДИ', 'Мероприятия по обеспечению доступа инвалидов к объекту капитального строительства', true],
    [12, 'СМ', 'Смета на строительство, реконструкцию, капитальный ремонт, снос объекта капитального строительства', false],
    [13, 'ИД', 'Иная документация', false],
  ];
  const LINEAR = [
    [1, 'ПЗ', 'Пояснительная записка', true],
    [2, 'ППО', 'Проект полосы отвода', true],
    [3, 'ТКР', 'Технологические и конструктивные решения линейного объекта. Искусственные сооружения', true],
    [4, 'ИЛО', 'Здания, строения и сооружения, входящие в инфраструктуру линейного объекта', true],
    [5, 'ПОС', 'Проект организации строительства', true],
    [6, 'ООС', 'Мероприятия по охране окружающей среды', true],
    [7, 'ПБ', 'Мероприятия по обеспечению пожарной безопасности', true],
    [8, 'ТБЭ', 'Требования к обеспечению безопасной эксплуатации линейного объекта', true],
    [9, 'СМ', 'Смета на строительство, реконструкцию, капитальный ремонт, снос объекта капитального строительства', false],
    [10, 'ИД', 'Иная документация', false],
  ];
  const BASES = {
    prod: { label: 'Объект производственного назначения', sections: PROD },
    nonprod: { label: 'Объект непроизводственного назначения', sections: PROD.map(s => (s[1] === 'ТХ' ? [s[0], s[1], s[2], false, s[4], s[5]] : s)) }, // ТХ — по заданию
    linear: { label: 'Линейный объект', sections: LINEAR },
  };
  const KINDS = { section: 'Раздел', sub: 'Подраздел', book: 'Книга', part: 'Часть' };

  // Working documentation (РД): marks of main sets of working drawings. 'gost' — the mark is in table В.1
  // of ГОСТ Р 21.101-2026 as far as we could read it; 'practice' — common in practice (and in our ВОК), not
  // found in the standard's table. All of them are only suggestions: the composition is edited freely.
  const RD_MARKS = {
    ГП: ['Генеральный план', 'gost'], ГТ: ['Генеральный план и сооружения транспорта', 'gost'], АД: ['Автомобильные дороги', 'gost'],
    ПЖ: ['Железнодорожные пути', 'gost'], ТР: ['Сооружения транспорта', 'gost'],
    АР: ['Архитектурные решения', 'gost'], АС: ['Архитектурно-строительные решения', 'gost'], АИ: ['Интерьеры', 'gost'],
    КЖ: ['Конструкции железобетонные', 'gost'], КМ: ['Конструкции металлические', 'gost'], КМД: ['Конструкции металлические деталировочные', 'gost'],
    КД: ['Конструкции деревянные', 'gost'], ГР: ['Гидротехнические решения', 'gost'], АЗ: ['Антикоррозионная защита конструкций зданий и сооружений', 'gost'],
    ЭОМ: ['Силовое электрооборудование и электрическое освещение (внутреннее)', 'gost'], ЭС: ['Электроснабжение', 'gost'],
    ЭН: ['Наружное электрическое освещение', 'gost'], ЭО: ['Электрическое освещение (внутреннее)', 'gost'], ЭМ: ['Силовое электрооборудование', 'practice'],
    ЭВ: ['Воздушные линии электропередачи', 'gost'], ЭК: ['Кабельные линии электропередачи', 'gost'],
    ВК: ['Внутренние системы водоснабжения и канализации', 'gost'], НВ: ['Наружные сети водоснабжения', 'gost'], НК: ['Наружные сети канализации', 'gost'],
    НВК: ['Наружные сети водоснабжения и канализации', 'gost'], НЛК: ['Наружные сети ливневой канализации', 'practice'],
    ВПВ: ['Внутренний противопожарный водопровод', 'practice'], АУПТ: ['Автоматическая установка пожаротушения', 'practice'], СПО: ['Системы пожаротушения и огнезащита', 'gost'],
    ОВ: ['Отопление, вентиляция и кондиционирование', 'practice'], ТМ: ['Тепломеханические решения теплового пункта', 'gost'],
    ТС: ['Тепломеханические решения тепловых сетей', 'gost'], ХС: ['Холодоснабжение', 'gost'], ВС: ['Воздухоснабжение', 'gost'], ПУ: ['Пылеудаление', 'gost'],
    АОВ: ['Автоматизация систем отопления и вентиляции', 'practice'],
    СС: ['Сети связи', 'practice'], РТ: ['Радиосвязь, радиовещание и телевидение', 'gost'], ПС: ['Пожарная сигнализация', 'gost'],
    СОУЭ: ['Система оповещения и управления эвакуацией', 'practice'], ОС: ['Охранная сигнализация', 'gost'], СОТ: ['Охранное видеонаблюдение', 'practice'],
    СКУД: ['Система контроля и управления доступом', 'practice'], ДФ: ['Домофония', 'practice'], ДС: ['Диспетчеризация', 'practice'],
    ГСН: ['Газоснабжение. Наружные газопроводы', 'gost'], ГСВ: ['Газоснабжение. Внутренние устройства', 'gost'],
    ТХ: ['Технология производства', 'gost'], ТК: ['Технологические коммуникации', 'gost'],
  };
  // Suggestions by the abbreviation of a section or subsection of the project documentation: [mark, on by default].
  const RD_SUGGEST = {
    ПЗУ: [['ГП', 1], ['ГТ', 0], ['АД', 0]],
    ППО: [['ГП', 1], ['АД', 0]],
    АР: [['АР', 1], ['АС', 0], ['АИ', 0]],
    КР: [['КЖ', 1], ['КМ', 1], ['КД', 0], ['АЗ', 0]],
    ТКР: [['КЖ', 1], ['КМ', 0], ['ГР', 0], ['АЗ', 0]],
    ИЛО: [['АР', 1], ['КЖ', 1], ['ЭОМ', 1], ['ОВ', 1], ['ВК', 1]],
    ИОС1: [['ЭОМ', 1], ['ЭС', 1], ['ЭН', 1], ['ЭО', 0], ['ЭМ', 0], ['ЭК', 0], ['ЭВ', 0]],
    ИОС2: [['ВК', 1], ['НВ', 1], ['ВПВ', 1], ['АУПТ', 0], ['СПО', 0], ['НВК', 0]],
    ИОС3: [['НК', 1], ['НЛК', 0], ['ВК', 0]],
    ИОС4: [['ОВ', 1], ['ТМ', 1], ['ТС', 0], ['ХС', 0], ['АОВ', 0]],
    ИОС5: [['СС', 1], ['ПС', 1], ['СОУЭ', 1], ['СОТ', 0], ['ОС', 0], ['СКУД', 0], ['ДФ', 0], ['ДС', 0], ['РТ', 0]],
    ИОС6: [['ГСН', 1], ['ГСВ', 1]],
    ТХ: [['ТХ', 1], ['ТК', 0]],
  };
  const markBase = mark => String(mark || '').replace(/[\d.\s]+$/, ''); // «КЖ1.1» → «КЖ»
  const CHILD = { section: 'sub', sub: 'book', book: 'part', part: null };

  let seq = 0;
  const newId = () => 'n' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

  function fromBase(base) {
    const b = BASES[base] || BASES.prod, nodes = [];
    for (const [num, abbr, title, on, subs, marks] of b.sections) {
      const id = newId();
      nodes.push({ id, parentId: '', kind: 'section', num, abbr, title, on, marks: marks || [], ownerId: '', contractorId: '', std: true });
      for (const [sabbr, stitle, smarks] of subs || []) nodes.push({ id: newId(), parentId: id, kind: 'sub', abbr: sabbr, title: stitle, on: sabbr !== 'ИОС6', marks: smarks, ownerId: '', contractorId: '', std: true });
    }
    const comp = { base: BASES[base] ? base : 'prod', nodes, rd: [], numbering: { pd: 'section', rd: 'flat' }, links: { pd: true, rd: true } };
    comp.rd = rdDefaults(comp);
    return comp;
  }
  // Switched-on sections/subsections that have suggestions, in tree order.
  function rdGroups(comp) {
    return walk(comp?.nodes || []).filter(r => !r.disabled && (r.node.kind === 'section' || r.node.kind === 'sub') && RD_SUGGEST[r.node.abbr])
      .map(r => ({ node: r.node, items: RD_SUGGEST[r.node.abbr].map(([mark, on]) => ({ mark, on: !!on, title: RD_MARKS[mark]?.[0] || mark, src: RD_MARKS[mark]?.[1] || 'practice' })) }));
  }
  // The suggested working-documentation composition: marks switched on by default, each once.
  function rdDefaults(comp) {
    const seen = new Set(), out = [];
    for (const g of rdGroups(comp)) for (const it of g.items) {
      if (!it.on || seen.has(it.mark)) continue;
      seen.add(it.mark);
      out.push({ id: newId(), pdId: g.node.id, mark: it.mark, title: it.title, on: true, code: '', tom: '', note: '', ownerId: '', contractorId: '', taskId: '' });
    }
    return out;
  }
  // ВОК rows: volume numbers 1, 2, 3… (overridable), designation «<шифр>-<марка>».
  // Sections tied to a switched-off part of the project documentation drop out too.
  function rdRows(comp, projectCode = '') {
    const off = new Set(walk(comp?.nodes || []).filter(r => r.disabled).map(r => r.node.id));
    const list = (comp?.rd || []).filter(x => x.on !== false && x.mark && !off.has(x.pdId));
    // 'family': marks of one family (КЖ1.1, КЖ1.2…) share a number with a suffix: 3.1, 3.2.
    const family = numberingOf(comp).rd === 'family';
    const fam = new Map();
    for (const x of list) { const b = markBase(x.mark); if (!fam.has(b)) fam.set(b, []); fam.get(b).push(x.id); }
    const famNo = [...fam.keys()];
    return list.map((x, i) => {
      let auto = String(i + 1);
      if (family) { const b = markBase(x.mark), ids = fam.get(b), no = famNo.indexOf(b) + 1; auto = ids.length > 1 ? `${no}.${ids.indexOf(x.id) + 1}` : String(no); }
      const nodes = comp?.nodes || [], pd = nodes.find(nn => nn.id === x.pdId);
      return { id: x.id, item: x, tom: x.tom || auto, code: x.code || (projectCode ? `${projectCode}-${x.mark}` : x.mark), mark: x.mark, title: x.title || RD_MARKS[markBase(x.mark)]?.[0] || '', note: x.note || '', key: pd ? keyOf(pd, nodes) : '' };
    });
  }
  // «Состав проектной документации» rows: every switched-on line; volumes carry a number and a designation,
  // parents with switched-on children are heading lines («Раздел 5 «…»»).
  function spRows(comp, projectCode = '') {
    const rows = walk(comp?.nodes || []);
    return numbered(comp, rows, () => spRowsOf(rows, projectCode));
  }
  function spRowsOf(rows, projectCode) {
    const out = [];
    for (const r of rows) {
      if (r.disabled) continue;
      const isVol = !rows.some(c => c.node.parentId === r.node.id && !c.disabled);
      const n = r.node, no = n.kind === 'section' ? (n.num ?? r.idx[0]) : r.idx.at(-1);
      out.push({ id: n.id, kind: n.kind, depth: r.depth, label: `${KINDS[n.kind]} ${no}`, title: n.title, vol: isVol,
        tom: isVol ? tomOf(r, rows) : '', code: isVol ? codeOf(r, rows, projectCode) : '' });
    }
    return out;
  }

  const childrenOf = (nodes, id) => nodes.filter(n => n.parentId === id);
  // Depth-first order with depth, index among siblings and whether an ancestor is switched off.
  function walk(nodes) {
    const out = [];
    const rec = (parentId, depth, path, off) => {
      childrenOf(nodes, parentId).forEach((n, i) => {
        const idx = [...path, i + 1];
        const disabled = off || n.on === false;
        out.push({ node: n, depth, idx, disabled });
        rec(n.id, depth + 1, idx, disabled);
      });
    };
    rec('', 0, [], false);
    return out;
  }
  // «ИОС1.2»: the section/subsection abbreviation plus book and part numbers.
  function abbrOf(row, rows) {
    const n = row.node;
    if (n.kind === 'section' || n.kind === 'sub') return n.abbr || '';
    const parent = rows.find(r => r.node.id === n.parentId);
    const base = parent ? abbrOf(parent, rows) : '';
    return `${base}${base && /\d$/.test(base) ? '.' : ''}${row.idx.at(-1)}`;
  }
  // Volume numbering of the project documentation: 'section' — section number, then positions inside it («5.1.2»);
  // 'flat' — 1, 2, 3… in the order of volumes. A number typed on a node always wins.
  const NUMBERING = { pd: { section: 'по разделам: 5.1.2', flat: 'сквозная: 1, 2, 3…' }, rd: { flat: 'сквозная: 1, 2, 3…', family: 'по маркам: КЖ1, КЖ2 → 3.1, 3.2' } };
  const numberingOf = comp => ({ pd: NUMBERING.pd[comp?.numbering?.pd] ? comp.numbering.pd : 'section', rd: NUMBERING.rd[comp?.numbering?.rd] ? comp.numbering.rd : 'flat' });
  let flatToms = null; // id → flat number while one composition is being numbered
  function tomOf(row, rows) {
    if (row.node.tom) return row.node.tom;
    if (flatToms && flatToms.has(row.node.id)) return String(flatToms.get(row.node.id));
    let r = row;
    while (r.node.parentId) r = rows.find(x => x.node.id === r.node.parentId) || { node: { parentId: '' }, idx: r.idx };
    const num = r.node.num ?? row.idx[0];
    return [num, ...row.idx.slice(1)].join('.');
  }
  const codeOf = (row, rows, projectCode) => row.node.code || (projectCode ? `${projectCode}-${abbrOf(row, rows)}` : abbrOf(row, rows));
  // «Раздел 5. Подраздел 1. Система электроснабжения. Книга 2. Силовое…»
  function fullName(row, rows) {
    const chain = [];
    let r = row;
    while (r) { chain.unshift(r); r = rows.find(x => x.node.id === r.node.parentId); }
    return chain.map(x => {
      const n = x.node, k = KINDS[n.kind], no = n.kind === 'section' ? (n.num ?? x.idx[0]) : x.idx.at(-1);
      return `${k} ${no}. ${n.title}`;
    }).join('. ');
  }
  // Volumes of the composition: switched-on nodes without switched-on children (what is actually issued).
  const isVolume = (r, rows) => !r.disabled && !rows.some(c => c.node.parentId === r.node.id && !c.disabled);
  // Runs `fn` with flat numbers prepared when the composition asks for flat numbering.
  function numbered(comp, rows, fn) {
    flatToms = numberingOf(comp).pd === 'flat' ? new Map(rows.filter(r => isVolume(r, rows)).map((r, i) => [r.node.id, i + 1])) : null;
    try { return fn(); } finally { flatToms = null; }
  }
  function volumes(comp, projectCode = '') {
    const rows = walk(comp?.nodes || []);
    return numbered(comp, rows, () => rows.filter(r => isVolume(r, rows))
      .map(r => ({ id: r.node.id, node: r.node, depth: r.depth, tom: tomOf(r, rows), code: codeOf(r, rows, projectCode), abbr: abbrOf(r, rows), name: fullName(r, rows), title: r.node.title, key: keyOf(r.node, comp.nodes) })));
  }
  function rowsFor(comp, projectCode = '') {
    const rows = walk(comp?.nodes || []);
    return numbered(comp, rows, () => rows.map(r => ({ ...r, tom: tomOf(r, rows), code: codeOf(r, rows, projectCode), abbr: abbrOf(r, rows), name: fullName(r, rows) })));
  }
  // Tech-card key of a node: its own abbreviation for a section or subsection, the nearest such ancestor for books
  // and parts («ИОС1» for a book of the power-supply subsection).
  function keyOf(node, nodes) {
    let n = node;
    while (n && (n.kind === 'book' || n.kind === 'part' || !n.abbr)) n = nodes.find(x => x.id === n.parentId);
    return n?.abbr || '';
  }

  // Checks a composition read from the page or a file: shape, kinds, parents, lengths.
  function clean(comp) {
    if (comp == null) return { ok: true, value: null };
    if (typeof comp !== 'object' || !Array.isArray(comp.nodes)) return { ok: false, message: 'Состав проекта повреждён.' };
    if (comp.nodes.length > 400) return { ok: false, message: 'В составе слишком много строк (больше 400).' };
    const ids = new Set(comp.nodes.map(n => n?.id));
    const str = (v, max) => String(v ?? '').slice(0, max);
    const nodes = [];
    for (const n of comp.nodes) {
      if (!n || typeof n.id !== 'string' || !KINDS[n.kind]) return { ok: false, message: 'Строка состава повреждена.' };
      if (n.parentId && !ids.has(n.parentId)) return { ok: false, message: 'Строка состава ссылается на несуществующий раздел.' };
      nodes.push({ id: str(n.id, 40), parentId: str(n.parentId, 40), kind: n.kind, num: Number.isFinite(n.num) ? n.num : undefined, abbr: str(n.abbr, 20), title: str(n.title, 300), on: n.on !== false,
        code: str(n.code, 80), tom: str(n.tom, 20), marks: (Array.isArray(n.marks) ? n.marks : []).map(m => str(m, 20)).filter(Boolean).slice(0, 20),
        ownerId: str(n.ownerId, 40), contractorId: str(n.contractorId, 40), taskId: str(n.taskId, 40), std: n.std === true });
    }
    const rdIn = Array.isArray(comp.rd) ? comp.rd : [];
    if (rdIn.length > 300) return { ok: false, message: 'В составе рабочей документации слишком много строк (больше 300).' };
    const rd = [];
    for (const x of rdIn) {
      if (!x || typeof x.id !== 'string') return { ok: false, message: 'Строка состава рабочей документации повреждена.' };
      rd.push({ id: str(x.id, 40), pdId: ids.has(x.pdId) ? str(x.pdId, 40) : '', mark: str(x.mark, 20).trim(), title: str(x.title, 300), on: x.on !== false,
        code: str(x.code, 80), tom: str(x.tom, 20), note: str(x.note, 60), ownerId: str(x.ownerId, 40), contractorId: str(x.contractorId, 40), taskId: str(x.taskId, 40) });
    }
    const nb = numberingOf(comp);
    const links = { pd: comp.links?.pd !== false, rd: comp.links?.rd !== false };
    return { ok: true, value: { base: BASES[comp.base] ? comp.base : 'prod', nodes, rd, numbering: nb, links } };
  }

  return { BASES, KINDS, CHILD, RD_MARKS, RD_SUGGEST, NUMBERING, numberingOf, keyOf, markBase, fromBase, walk, rowsFor, volumes, rdGroups, rdDefaults, rdRows, spRows, clean, newId, childrenOf };
});

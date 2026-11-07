// Composition of design documentation: the base is Decree of the Government of the RF No. 87 of 16.02.2008
// (as amended from 01.09.2022). The project team builds its own structure on top of it: switches base sections
// on and off, adds subsections, books and own sections. Shared by the window (editor) and main (customer page).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PP87 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [number, code, title, children?] — codes are the usual designations (ГОСТ Р 21.101 practice), not part of the decree.
  const NONLINEAR = [
    ['1', 'ПЗ', 'Пояснительная записка'],
    ['2', 'ПЗУ', 'Схема планировочной организации земельного участка'],
    ['3', 'АР', 'Объемно-планировочные и архитектурные решения'],
    ['4', 'КР', 'Конструктивные решения'],
    ['5', 'ИОС', 'Сведения об инженерном оборудовании, о сетях и системах инженерно-технического обеспечения', [
      ['5.1', 'ИОС1', 'Система электроснабжения'],
      ['5.2', 'ИОС2', 'Система водоснабжения'],
      ['5.3', 'ИОС3', 'Система водоотведения'],
      ['5.4', 'ИОС4', 'Отопление, вентиляция и кондиционирование воздуха, тепловые сети'],
      ['5.5', 'ИОС5', 'Сети связи'],
      ['5.6', 'ИОС6', 'Система газоснабжения'],
    ]],
    ['6', 'ТХ', 'Технологические решения'],
    ['7', 'ПОС', 'Проект организации строительства'],
    ['8', 'ООС', 'Мероприятия по охране окружающей среды'],
    ['9', 'ПБ', 'Мероприятия по обеспечению пожарной безопасности'],
    ['10', 'ТБЭ', 'Требования к обеспечению безопасной эксплуатации объекта капитального строительства'],
    ['11', 'ОДИ', 'Мероприятия по обеспечению доступа инвалидов к объекту капитального строительства'],
    ['12', 'СМ', 'Смета на строительство'],
    ['13', 'ИД', 'Иная документация в случаях, предусмотренных законодательными и иными нормативными правовыми актами РФ'],
  ];
  const LINEAR = [
    ['1', 'ПЗ', 'Пояснительная записка'],
    ['2', 'ППО', 'Проект полосы отвода'],
    ['3', 'ТКР', 'Технологические и конструктивные решения линейного объекта. Искусственные сооружения'],
    ['4', 'ИЛО', 'Здания, строения и сооружения, входящие в инфраструктуру линейного объекта'],
    ['5', 'ПОС', 'Проект организации строительства'],
    ['6', 'ООС', 'Мероприятия по охране окружающей среды'],
    ['7', 'ПБ', 'Мероприятия по обеспечению пожарной безопасности'],
    ['8', 'СМ', 'Смета на строительство'],
    ['9', 'ИД', 'Иная документация в случаях, предусмотренных законодательными и иными нормативными правовыми актами РФ'],
  ];
  const BASES = {
    nonlinear: { label: 'Объект производственного и непроизводственного назначения (п. 10–32)', list: NONLINEAR },
    linear: { label: 'Линейный объект (п. 33–42)', list: LINEAR },
  };
  // Usually off for a commercial building: switched on by hand when needed.
  const OFF_BY_DEFAULT = new Set(['ИОС6', 'ТХ', 'СМ', 'ИД']);

  // Base structure as a flat list: { id, parentId, num, code, title, base: true, on }.
  function baseItems(kind = 'nonlinear') {
    const out = [];
    const walk = (list, parentId) => list.forEach(([num, code, title, kids]) => {
      const id = 'b-' + code;
      out.push({ id, parentId, num, code, title, base: true, on: !OFF_BY_DEFAULT.has(code) });
      if (kids) walk(kids, id);
    });
    walk((BASES[kind] || BASES.nonlinear).list, null);
    return out;
  }

  const childrenOf = (items, id) => items.filter(x => (x.parentId || null) === (id || null));
  // Tree order (parent, then its children) — the order of the volumes list.
  function ordered(items) {
    const out = [];
    const walk = (id, depth) => childrenOf(items, id).forEach(x => { out.push({ ...x, depth }); walk(x.id, depth + 1); });
    walk(null, 0);
    return out;
  }
  const isOn = (items, x) => { for (let n = x; n; n = items.find(y => y.id === n.parentId)) if (n.on === false) return false; return true; };
  // Volumes: switched-on items without switched-on children (a section split into books is not a volume itself).
  function volumes(items) {
    return ordered(items).filter(x => isOn(items, x) && !childrenOf(items, x.id).some(c => c.on !== false));
  }
  // «0425-24-ИОС1.1»: project code + item code.
  const designation = (projectCode, x) => [String(projectCode || '').trim(), x.code].filter(Boolean).join('-');

  // Next number for a new child: 5.1 → 5.1.1, 5.1.2…; for a new top-level section — after the last number.
  function nextNum(items, parentId) {
    const kids = childrenOf(items, parentId);
    if (!parentId) return String(kids.reduce((m, x) => Math.max(m, parseInt(x.num, 10) || 0), 0) + 1);
    const p = items.find(x => x.id === parentId);
    const last = kids.reduce((m, x) => Math.max(m, parseInt(String(x.num).split('.').pop(), 10) || 0), 0);
    return `${p.num}.${last + 1}`;
  }
  // Code for a child: ИОС1 → ИОС1.1 (книга 1), КР → КР1.
  function nextCode(items, parentId) {
    const p = items.find(x => x.id === parentId);
    if (!p) return '';
    const n = childrenOf(items, parentId).length + 1;
    return /\d$/.test(p.code) ? `${p.code}.${n}` : `${p.code}${n}`;
  }

  // Direction of a ПП 87 code, for icons and checks: ИОС1 → электрика and so on.
  const KIND_BY_CODE = { 'ИОС1': 'el', 'ИОС2': 'water', 'ИОС3': 'sewer', 'ИОС4': 'ov', 'ИОС5': 'ss' };
  const kindOfCode = code => { const m = String(code || '').toUpperCase().match(/^ИОС\d/); return m ? KIND_BY_CODE[m[0]] || '' : ''; };

  // Validates and cleans a composition coming from the page.
  function clean(comp) {
    const base = BASES[comp?.base] ? comp.base : 'nonlinear';
    const items = (Array.isArray(comp?.items) ? comp.items : []).filter(x => x && typeof x.id === 'string').slice(0, 400).map(x => ({
      id: x.id.slice(0, 40), parentId: typeof x.parentId === 'string' ? x.parentId.slice(0, 40) : null,
      num: String(x.num ?? '').trim().slice(0, 16), code: String(x.code ?? '').trim().slice(0, 24), title: String(x.title ?? '').trim().slice(0, 300),
      base: !!x.base, on: x.on !== false, taskId: typeof x.taskId === 'string' ? x.taskId.slice(0, 40) : '',
    }));
    const ids = new Set(items.map(x => x.id));
    for (const x of items) if (x.parentId && !ids.has(x.parentId)) x.parentId = null;
    return { base, items };
  }

  return { BASES, baseItems, ordered, volumes, childrenOf, isOn, designation, nextNum, nextCode, kindOfCode, clean };
});

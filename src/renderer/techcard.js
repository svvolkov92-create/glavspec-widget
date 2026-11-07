// Tech card of the design process («техкарта процесса проектирования»): waves of the project documentation,
// assignments between sections, source data, summary sections. One model for the in-app reference and for the
// links made when a project is generated. Keys are abbreviations of sections/subsections by Decree 87
// (ПЗУ, АР, КР, ИОС1…ИОС6, ТХ …). Shared by the window, the main process and tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Techcard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STAGES = [
    ['Договор', 'задание на ПИР, график и сроки'],
    ['Сбор ИРД', 'ГПЗУ, ТУ на сети, задание на ТХ — параллельно с изысканиями'],
    ['Изыскания', 'топосъёмка, геология, экология'],
    ['Стадия П', 'ПД по ПП № 87, четыре волны'],
    ['Экспертиза', 'замечания и ответы; замечания возвращают работу в ПД'],
    ['Стадия Р', 'РД по разделам, ВОК и сметы — после экспертизы или параллельно, по настройке проекта'],
    ['Авторский надзор', 'вопросы стройки, правки'],
  ];

  // Wave of a section of the project documentation. Sections of one wave go in parallel;
  // the next wave starts when the assignments of the previous one have come.
  const WAVES = {
    ТХ: 1, ПЗУ: 1, АР: 1, ПБ: 1, ОДИ: 1, ППО: 1,
    КР: 2, ИОС2: 2, ИОС3: 2, ИОС4: 2, ПОС: 2, ТКР: 2, ИЛО: 2,
    ИОС1: 3, ИОС5: 3, ИОС6: 3, ООС: 3, ТБЭ: 3,
    ПЗ: 4, СМ: 4, ИД: 4,
  };
  const WAVE_NAMES = { 1: 'подоснова для всех', 2: 'каркас и системы', 3: 'энергия и связь', 4: 'сводка и выпуск' };
  // Share of a stage each wave takes (from, to); waves overlap: the next starts on the previous one's assignments.
  const WAVE_WINDOW = { 1: [0, 0.45], 2: [0.25, 0.7], 3: [0.45, 0.9], 4: [0.75, 1] };
  const CRITICAL = ['АР', 'ИОС4', 'ИОС1', 'ПЗ'];

  // Assignments to adjacent sections: [from, [to…], what]. 'ИОС*' — every switched-on ИОС subsection.
  const ASSIGN = [
    ['ТХ', ['АР', 'КР'], 'Состав помещений, технологическая расстановка, нагрузки от оборудования, краны'],
    ['ТХ', ['ИОС*'], 'Потребности: электроэнергия, вода, стоки, тепло, воздух, газ, связь; тепловыделения'],
    ['АР', ['КР'], 'Планы, разрезы, отметки, составы полов и кровли, нагрузки от отделки'],
    ['АР', ['ИОС*', 'ПБ'], 'Подоснова планов с экспликацией, классы и категории помещений, пути эвакуации'],
    ['ПЗУ', ['ИОС*', 'ПОС'], 'Расстановка, вертикальная планировка, коридоры для сетей, проезды'],
    ['КР', ['АР', 'ИОС*'], 'Сетка колонн, сечения несущих элементов, зоны запрета проёмов'],
    ['ИОС4', ['КР', 'АР'], 'Отверстия, шахты, венткамеры, нагрузки от оборудования на перекрытия и кровлю'],
    ['ИОС2', ['КР', 'АР'], 'Отверстия, приямки, насосные, водомерный узел'],
    ['ИОС3', ['КР', 'АР'], 'Отверстия, приямки, выпуски'],
    ['ИОС4', ['ИОС1', 'ИОС5'], 'Электрические нагрузки оборудования, сигналы на отключение вентиляции и дымоудаление, диспетчеризация'],
    ['ИОС2', ['ИОС1', 'ИОС5'], 'Насосы, электрозадвижки, пожарные насосы, сигналы ВПВ и АУПТ'],
    ['ИОС4', ['ИОС2'], 'Подготовка горячей воды, расходы на подпитку'],
    ['ИОС5', ['ИОС1'], 'Нагрузки слаботочных систем, питание по I категории'],
    ['ИОС1', ['АР', 'КР', 'ПЗУ'], 'Электрощитовая, ТП, ниши, кабельные трассы, заземление и молниезащита'],
    ['ИОС*', ['ПЗУ'], 'Наружные сети на сводный план сетей (собирает ГП-ПЗУ)'],
  ];

  const SOURCE_DATA = [
    ['Задание на проектирование', 'Заказчик', 'Все разделы'],
    ['ГПЗУ', 'Заказчик', 'ПЗУ, АР, ПЗ'],
    ['Инженерно-геодезические изыскания', 'Изыскатели', 'ПЗУ, наружные сети'],
    ['Инженерно-геологические изыскания', 'Изыскатели', 'КР — фундаменты, сети'],
    ['Инженерно-экологические и гидрометеорологические изыскания', 'Изыскатели', 'ООС, ИОС 3 — ливнёвка'],
    ['ТУ на электроснабжение', 'Сетевая компания', 'ИОС 1'],
    ['ТУ на водоснабжение и водоотведение', 'Водоканал', 'ИОС 2, ИОС 3'],
    ['ТУ на теплоснабжение', 'Теплоснабжающая организация', 'ИОС 4'],
    ['ТУ на газоснабжение', 'Газораспределительная организация', 'ИОС 6'],
    ['ТУ на связь и диспетчеризацию', 'Операторы связи, УК', 'ИОС 5'],
    ['ТУ на примыкание к дорогам', 'Владелец дороги', 'ПЗУ'],
    ['Задание на технологию', 'Заказчик / технолог', 'ТХ, затем АР и все ИОС'],
  ];

  const SUMMARY = [
    ['ПБ', 'ПЗУ, АР, КР, ВПВ и АУПТ, дымоудаление, ПС и СОУЭ', 'классы и требования → АР, ИОС', 'волна 1, вместе с АР'],
    ['ОДИ', 'ПЗУ — пути, парковки; АР — входы, лифты, санузлы', 'требования → АР, ПЗУ', 'волна 1–2'],
    ['ПОС', 'ПЗУ, АР, КР, наружные сети, изыскания', 'срок стройки, временные сети → СМ', 'волна 2'],
    ['ООС', 'изыскания, ПЗУ, стоки, выбросы ОВ, отходы ТХ, ПОС', 'требования к очистке', 'волна 3'],
    ['ТБЭ', 'КР и ИОС 1–6: осмотры и ремонты', '—', 'волна 3'],
    ['СМ', 'объёмы и спецификации всех разделов, ПОС', '—', 'волна 4'],
    ['ПЗ', 'ИРД и все разделы: ТЭП, потребности', '—', 'старт с ИРД, закрытие в волне 4'],
  ];

  const isIos = k => /^ИОС\d$/.test(k);
  const waveOf = key => WAVES[key] || 3;

  // Pairs [from, to, what] for the keys present in a project; 'ИОС*' expanded, self-pairs and repeats dropped
  // (two rows for one pair are joined into one assignment).
  function pairs(keys) {
    const have = new Set(keys);
    const ios = keys.filter(isIos);
    const exp = list => list.flatMap(k => (k === 'ИОС*' ? ios : [k])).filter(k => have.has(k));
    const out = new Map();
    for (const [from, to, what] of ASSIGN) {
      for (const f of exp([from])) for (const t of exp(to)) {
        if (f === t) continue;
        const k = `${f}>${t}`;
        if (out.has(k)) out.get(k).what += `; ${what}`;
        else out.set(k, { from: f, to: t, what, forward: waveOf(f) < waveOf(t) });
      }
    }
    return [...out.values()];
  }

  // Dates of a wave inside a stage window [start, finish] (ISO dates).
  const DAY = 864e5;
  const toDay = s => Math.round(Date.parse(s + 'T00:00:00Z') / DAY);
  const fromDay = n => new Date(n * DAY).toISOString().slice(0, 10);
  function waveDates(wave, start, finish) {
    if (!start || !finish || finish < start) return null;
    const a = toDay(start), len = toDay(finish) - a;
    const [f, t] = WAVE_WINDOW[wave] || WAVE_WINDOW[3];
    return { start: fromDay(a + Math.round(len * f)), finish: fromDay(a + Math.round(len * t)) };
  }
  // An assignment is due halfway through its source's wave, and not later than the day before its recipient's wave
  // starts (for forward assignments).
  function assignDue(fromWave, toWave, start, finish) {
    const src = waveDates(fromWave, start, finish);
    if (!src) return null;
    const half = fromDay(Math.round((toDay(src.start) + toDay(src.finish)) / 2));
    if (fromWave < toWave) {
      const dst = waveDates(toWave, start, finish);
      const before = fromDay(Math.max(toDay(src.start) + 1, toDay(dst.start) - 1));
      return { start: src.start, finish: before < half ? before : half };
    }
    return { start: src.start, finish: half };
  }

  return { STAGES, WAVES, WAVE_NAMES, WAVE_WINDOW, CRITICAL, ASSIGN, SOURCE_DATA, SUMMARY, waveOf, pairs, waveDates, assignDue, isIos };
});

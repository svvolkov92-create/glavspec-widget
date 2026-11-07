'use strict';

// Word report (.docx, WordprocessingML): landscape A4, headings, tables with repeating header rows, page-numbered footer.
const L = require('../renderer/logic.js');
const { createZip, xmlEsc } = require('./zip');
const { coreProps } = require('./xlsx');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const nf = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = n => nf.format(Number(n) || 0) + ' ₽';
const fullDate = iso => (L.isDate(iso) ? iso.split('-').reverse().join('.') : '—');

const FILL = { header: 'DCE6F2', total: 'F2F2F2', bad: 'FCE4E4', warn: 'FFF2CC', ok: 'E2EFDA', review: 'EDE7F6' };
const RED = 'C00000';

/* ---------- primitives ---------- */
function run(text, o = {}) {
  const rPr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : '');
  const parts = String(text ?? '').split('\n').map(t => `<w:t xml:space="preserve">${xmlEsc(t)}</w:t>`).join('<w:br/>');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${parts}</w:r>`;
}
function para(runs, o = {}) {
  const pPr = (o.style ? `<w:pStyle w:val="${o.style}"/>` : '') + (o.keepNext ? '<w:keepNext/>' : '')
    + (o.tight ? '<w:spacing w:before="0" w:after="0"/>' : '') + (o.align ? `<w:jc w:val="${o.align}"/>` : '');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
}
const text = (t, o) => para(run(t), o);
const h1 = t => para(run(t), { style: 'Heading1' });
const h2 = t => para(run(t), { style: 'Heading2' });

/**
 * @param {{title: string, width: number, align?: string}[]} cols
 * @param {(string|{text: string, fill?: string, color?: string, b?: boolean})[][]} rows
 */
function table(cols, rows, { total } = {}) {
  const width = cols.reduce((a, c) => a + c.width, 0);
  const border = side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
  const cell = (c, col, extra = {}) => {
    const v = typeof c === 'object' && c !== null ? c : { text: c };
    const fill = v.fill || extra.fill;
    const tcPr = `<w:tcW w:w="${col.width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}`;
    return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${para(run(v.text ?? '', { b: v.b || extra.b, color: v.color }), { tight: true, align: col.align })}</w:tc>`;
  };
  const header = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cols.map(c => cell(c.title, { ...c, align: c.align }, { fill: FILL.header, b: true })).join('')}</w:tr>`;
  const body = rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c, cols[i])).join('')}</w:tr>`).join('');
  const foot = total ? `<w:tr><w:trPr><w:cantSplit/></w:trPr>${total.map((c, i) => cell(c, cols[i], { fill: FILL.total, b: true })).join('')}</w:tr>` : '';
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
    + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>`
    + '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>'
    + `<w:tblLook w:val="0420" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>`
    + `<w:tblGrid>${cols.map(c => `<w:gridCol w:w="${c.width}"/>`).join('')}</w:tblGrid>${header}${body}${foot}</w:tbl>`
    + para('', { tight: true }); // Word requires a paragraph between adjacent tables
}

const statusCell = r => ({ text: r.statusLabel, fill: FILL[r.tone], color: r.tone === 'bad' ? RED : undefined, b: r.tone === 'bad' });
const moneyCell = (n, extra = {}) => ({ text: money(n), color: n < 0 ? RED : undefined, ...extra });

/* ---------- sections ---------- */
// Money columns are always the trailing ones; without budget access they are cut off.
const cut = (arr, n, m) => (m ? arr : arr.slice(0, arr.length - n));

function kpiTable(t, dueNow = 0, m = true) {
  const cols = ['В работе', 'Срок сорван', 'На проверке', 'Бюджет', 'Оплачено', 'Пора платить', 'Всего осталось'].map(title => ({ title, width: 2228, align: 'center' }));
  return table(cut(cols, 4, m), [cut([
    String(t.active),
    { text: String(t.overdue), color: t.overdue ? RED : undefined, b: !!t.overdue },
    String(t.review), money(t.budget), money(t.paid), { text: money(dueNow), fill: dueNow > 0 ? FILL.warn : undefined, b: dueNow > 0 }, moneyCell(t.rest),
  ], 4, m)]);
}

function attentionTable(list, lastTitle, lastValue) {
  const cols = [
    { title: 'Проект', width: 3800 }, { title: 'Разделы', width: 1800 }, { title: 'Подрядчик', width: 3000 },
    { title: 'Телефон', width: 2300 }, { title: 'План. финиш', width: 1600, align: 'center' }, { title: lastTitle, width: 2400 },
  ];
  return table(cols, list.map(r => [r.project, r.section + (r.title ? `\n${r.title}` : ''), r.contractor || 'не назначен', r.phone, fullDate(r.finish), lastValue(r)]));
}

function projectBlock(p, m = true) {
  const x = p.totals;
  const title = p.name + (p.code ? ` · шифр ${p.code}` : '');
  const out = [h2(title)];
  const meta = [p.client, `карточек ${x.count}`, `принято ${x.done}`, x.overdue ? `сорвано ${x.overdue}` : null, m ? `остаток ${money(x.rest)}` : null].filter(Boolean).join(' · ');
  out.push(para(run(meta, { color: '595959' }), { keepNext: true }));
  if (!p.rows.length) { out.push(text('В проекте нет карточек.')); return out.join(''); }
  const cols = [
    { title: 'Разделы', width: 1900 }, { title: 'Подрядчик', width: 3000 }, { title: 'Старт', width: 1250, align: 'center' },
    { title: 'Финиш', width: 1250, align: 'center' }, { title: 'Статус', width: 2100 },
    { title: 'Бюджет', width: 1800, align: 'right' }, { title: 'Оплачено', width: 1800, align: 'right' }, { title: 'Остаток', width: 1800, align: 'right' },
  ];
  const rows = p.rows.map(r => cut([
    { text: r.section + (r.title ? `\n${r.title}` : ''), b: true },
    r.contractor + (r.phone ? `\n${r.phone}` : '') || 'не назначен',
    fullDate(r.start), fullDate(r.finish),
    { ...statusCell(r), text: r.statusLabel + (r.overdueDays ? `\n${r.overdueDays} дн.` : '') },
    money(r.budget), money(r.paid), moneyCell(r.rest),
  ], 3, m));
  out.push(table(cut(cols, 3, m), rows, m ? { total: ['Итого', '', '', '', '', money(x.budget), money(x.paid), moneyCell(x.rest)] } : {}));
  return out.join('');
}

function contractorsTable(list, m = true) {
  const cols = [
    { title: 'ФИО / название', width: 3200 }, { title: 'Специализация', width: 2200 }, { title: 'Контакты', width: 3100 },
    { title: 'Карточек', width: 1100, align: 'center' }, { title: 'В работе', width: 1100, align: 'center' },
    { title: 'Сорвано', width: 1100, align: 'center' }, { title: 'В срок', width: 1300, align: 'center' }, { title: 'К оплате', width: 2000, align: 'right' },
  ];
  const relCell = r => (r.grade === 'none' ? { text: '—' } : { text: `${r.pct}%`, fill: FILL[r.grade === 'ok' ? 'ok' : r.grade === 'warn' ? 'warn' : 'bad'], color: r.grade === 'bad' ? RED : undefined });
  return table(cut(cols, 1, m), list.map(c => cut([
    { text: c.name, b: true }, c.specialty, [c.phone, c.email, c.messenger].filter(Boolean).join('\n') || '—',
    String(c.totals.count), String(c.totals.active),
    { text: String(c.totals.overdue), color: c.totals.overdue ? RED : undefined, b: !!c.totals.overdue },
    relCell(c.reliability), moneyCell(c.totals.rest),
  ], 1, m)), { total: cut(['Итого', '', '', String(list.reduce((a, c) => a + c.totals.count, 0)), String(list.reduce((a, c) => a + c.totals.active, 0)),
    String(list.reduce((a, c) => a + c.totals.overdue, 0)), '', moneyCell(list.reduce((a, c) => a + Math.round(c.totals.rest * 100), 0) / 100)], 1, m) });
}

function employeeBody(rep, generatedAt) {
  const e = rep.employee, s = e.summary;
  const kpi = table(['Сдано работ', 'В срок', 'С опозданием', 'Кругов замечаний в среднем', 'Сейчас в работе', 'Сейчас сорвано'].map(title => ({ title, width: 2600, align: 'center' })), [[
    String(s.delivered), { text: s.pct == null ? '—' : `${s.onTime} (${s.pct}%)`, fill: s.pct == null ? undefined : s.pct >= 80 ? FILL.ok : s.pct >= 50 ? FILL.warn : FILL.bad },
    { text: String(s.late), color: s.late ? RED : undefined }, String(s.avgRounds).replace('.', ','), String(s.activeNow),
    { text: String(s.overdueNow), color: s.overdueNow ? RED : undefined, b: !!s.overdueNow },
  ]]);
  const dCols = [
    { title: 'Проект', width: 3300 }, { title: 'Разделы', width: 1900 }, { title: 'Роль', width: 1700 }, { title: 'Срок', width: 1300, align: 'center' },
    { title: 'Сдано', width: 1300, align: 'center' }, { title: 'Принято', width: 1300, align: 'center' }, { title: 'В срок', width: 1500, align: 'center' }, { title: 'Замечаний', width: 1300, align: 'center' },
  ];
  const dRows = e.delivered.map(d => [d.project, d.section + (d.title ? `\n${d.title}` : ''), d.role, fullDate(d.finish), fullDate(d.handed), d.accepted ? fullDate(d.accepted) : '—',
    d.late ? { text: `опоздание ${d.late} дн.`, color: RED, fill: FILL.bad } : { text: 'да', fill: FILL.ok }, String(d.rounds)]);
  const aCols = [{ title: 'Проект', width: 3800 }, { title: 'Разделы', width: 2200 }, { title: 'Статус', width: 2200 }, { title: 'Готовность', width: 1300, align: 'center' }, { title: 'Срок', width: 1500, align: 'center' }, { title: 'Осталось', width: 3100 }];
  const aRows = e.active.map(a => [a.project, a.section, a.statusLabel, `${a.ready} %`, fullDate(a.finish), a.overdue ? { text: a.dueText, color: RED, b: true } : a.dueText]);
  return [
    para(run(`Отчёт по сотруднику: ${e.name}`), { style: 'Title' }),
    para(run(`${e.role}${e.directions ? ' · ' + e.directions : ''} · ${e.periodLabel}${e.from ? ` (${fullDate(e.from)} — ${fullDate(e.to)})` : ''} · сформирован ${generatedAt}`), { style: 'Subtitle' }),
    kpi,
    h1(`Сдано ${e.periodLabel}`),
    dRows.length ? table(dCols, dRows) : text('За период сданных работ нет.'),
    text('«В срок» — сдано на проверку не позже срока, действовавшего на день сдачи.'),
    h1('Сейчас в работе'),
    aRows.length ? table(aCols, aRows) : text('Незавершённых работ нет.'),
  ].join('');
}

function body(rep, generatedAt) {
  if (rep.employee) return employeeBody(rep, generatedAt);
  if (rep.scope?.type === 'contractor') return actBody(rep, generatedAt);
  const a = rep.attention, m = rep.money !== false;
  const title = rep.scope?.type === 'project' ? `Отчёт по проекту: ${rep.scope.title}` : 'Отчёт по проектам';
  const parts = [
    para(run(title), { style: 'Title' }),
    para(run(`По состоянию на ${fullDate(rep.today)} · сформирован ${generatedAt}`), { style: 'Subtitle' }),
    kpiTable(rep.totals, rep.dueNow, m),
    h1('Требует внимания'),
    h2(`Срок сорван (${a.overdue.length})`),
    a.overdue.length ? attentionTable(a.overdue, 'Просрочка', r => ({ text: `${r.overdueDays} дн.`, color: RED, b: true })) : text('Просроченных карточек нет.'),
    h2(`Сдача в течение 7 дней (${a.week.length})`),
    a.week.length ? attentionTable(a.week, 'Срок', r => r.dueText) : text('На ближайшую неделю сдач нет.'),
    a.milestones.length ? h2(`Сорваны контрольные точки (${a.milestones.length})`) + attentionTable(a.milestones, 'Сорвано КТ', r => ({ text: String(r.msOverdue), color: RED, b: true })) : '',
    h2(`Ждут проверки (${a.review.length})`),
    a.review.length ? attentionTable(a.review, 'Кругов замечаний', r => ({ text: String(r.rounds), fill: FILL.review })) : text('Карточек на проверке нет.'),
    m ? h2(`Пора платить (${a.pay.length})`) : '',
    !m ? '' : a.pay.length ? attentionTable(a.pay, 'К оплате / счёт', r => ({ text: `${money(r.dueNow)}\n${r.invoiceReceived ? 'счёт получен' : 'счёт не получен'}`, fill: FILL.warn })) : text('Платежей к оплате сейчас нет.'),
    h1('Проекты'),
    rep.projects.length ? rep.projects.map(p => projectBlock(p, m)).join('') : text('Проектов нет.'),
    h1('Исполнители'),
    rep.contractors.length ? contractorsTable(rep.contractors, m) : text('Исполнителей нет.'),
  ];
  return parts.join('');
}

// Reconciliation statement with one contractor: works, payments, balance, signature lines.
function actBody(rep, generatedAt) {
  const c = rep.scope.contractor || { name: rep.scope.title, totals: {} };
  const s = rep.settlement;
  const workCols = [
    { title: 'Проект', width: 3100 }, { title: 'Разделы', width: 1900 }, { title: 'Договор', width: 2000 },
    { title: 'Статус', width: 1700 }, { title: 'Акт', width: 1500, align: 'center' },
    { title: 'Стоимость', width: 1700, align: 'right' }, { title: 'Оплачено', width: 1700, align: 'right' }, { title: 'Остаток', width: 1500, align: 'right' },
  ];
  const works = rep.rows.map(r => [
    r.project, { text: r.section + (r.title ? `\n${r.title}` : ''), b: true },
    r.contractNo ? `№ ${r.contractNo}${r.contractDate ? `\nот ${fullDate(r.contractDate)}` : ''}` : '—',
    statusCell(r), r.actSigned ? `подписан${r.actDate ? `\n${fullDate(r.actDate)}` : ''}` : r.status === 'done' ? { text: 'не подписан', fill: FILL.warn } : '—',
    money(r.budget), money(r.paid), moneyCell(r.rest),
  ]);
  const payCols = [{ title: 'Дата', width: 1600, align: 'center' }, { title: 'Проект', width: 4700 }, { title: 'Разделы', width: 2400 }, { title: 'Назначение', width: 3600 }, { title: 'Сумма', width: 2800, align: 'right' }];
  const pays = rep.payments.map(p => [fullDate(p.date), p.project, p.section, p.note || 'платёж', money(p.amount)]);
  const balanceText = s.balance > 0 ? `Задолженность перед исполнителем за принятые работы: ${money(s.balance)}.`
    : s.balance < 0 ? `Оплачено сверх стоимости принятых работ (аванс): ${money(-s.balance)}.` : 'Задолженности нет: принятые работы оплачены полностью.';
  const sumCols = ['Стоимость всех работ', 'Принято работ на сумму', 'Оплачено', 'Сальдо по принятым'].map(title => ({ title, width: 3775, align: 'center' }));
  return [
    para(run('Акт сверки взаиморасчётов'), { style: 'Title' }),
    para(run(`с исполнителем: ${c.name} · по состоянию на ${fullDate(rep.today)} · сформирован ${generatedAt}`), { style: 'Subtitle' }),
    c.requisites ? para(run(`Реквизиты исполнителя: ${c.requisites}`, { color: '595959' })) : '',
    table(sumCols, [[money(s.budget), money(s.accepted), money(s.paid), { text: money(s.balance), b: true, fill: s.balance > 0 ? FILL.warn : undefined }]]),
    para(run(balanceText, { b: true })),
    h1('Работы'),
    works.length ? table(workCols, works, { total: ['Итого', '', '', '', '', money(s.budget), money(s.paid), moneyCell(Math.round((s.budget - s.paid) * 100) / 100)] }) : text('Работ нет.'),
    h1('Платежи'),
    pays.length ? table(payCols, pays, { total: ['Итого', '', '', '', money(s.paid)] }) : text('Платежей не было.'),
    para('', { tight: true }),
    table([{ title: 'Заказчик', width: 7550 }, { title: 'Исполнитель', width: 7550 }],
      [['\n\n____________________ / ____________________\n\nДата: «___» ____________ 20___ г.', `${c.name}\n\n____________________ / ____________________\n\nДата: «___» ____________ 20___ г.`]]),
  ].join('');
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="ru-RU" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="15138"/></w:tabs><w:spacing w:after="0"/></w:pPr><w:rPr><w:color w:val="7F7F7F"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
</w:styles>`;

function buildDocx(rep, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const generatedAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
    + '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>';
  return packDocx(body(rep, generatedAt), sectPr, `Отчёт главспеца · ${fullDate(rep.today)}`, 'Отчёт по проектам', now);
}

// «Состав проектной документации», portrait A4: номер тома, обозначение, наименование, примечание.
function buildCompositionDocx(rows, meta, now = new Date()) {
  const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="850" w:right="567" w:bottom="850" w:left="1247" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>';
  const cols = [{ title: 'Номер тома', width: 1300, align: 'center' }, { title: 'Обозначение', width: 2300 }, { title: 'Наименование', width: 4900 }, { title: 'Примечание', width: 1500 }];
  const bodyXml = h1(meta.title) + text(`${meta.project}${meta.code ? ` · шифр ${meta.code}` : ''}`)
    + table(cols, rows.map(r => [r.tom, r.code, r.name, r.note || '']));
  return packDocx(bodyXml, sectPr, `${meta.code ? meta.code + ' · ' : ''}Состав проектной документации`, meta.title, now);
}

function packDocx(bodyXml, sectPr, footerText, title, now) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${bodyXml}${sectPr}</w:body></w:document>`;
  const field = instr => `<w:fldSimple w:instr=" ${instr} "><w:r><w:t>1</w:t></w:r></w:fldSimple>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W}" xmlns:r="${R}"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${run(footerText)}<w:r><w:tab/></w:r>${run('Стр. ')}${field('PAGE')}${run(' из ')}${field('NUMPAGES')}</w:p></w:ftr>`;

  return createZip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: coreProps(title, now) },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/footer1.xml', data: footer },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>` },
  ], now);
}

module.exports = { buildDocx, buildCompositionDocx };

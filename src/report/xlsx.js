'use strict';

// Excel report (.xlsx, SpreadsheetML) built from report rows. Inline strings, real dates and money numbers,
// formulas for remainders and totals (with cached values, recalculated by Excel on open).
const L = require('../renderer/logic.js');
const { createZip, xmlEsc } = require('./zip');

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// cellXfs indexes in STYLES below
const S = {
  header: 1, text: 2, date: 3, money: 4, int: 5, title: 6, subtitle: 7,
  totalLabel: 8, totalMoney: 9, bad: 10, review: 11, ok: 12, warn: 13, totalInt: 14, heading: 15, intBad: 16, moneyWarn: 17,
};
const TONE_STYLE = { bad: S.bad, review: S.review, ok: S.ok, warn: S.warn };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;₽&quot;;[Red]\\-#,##0.00\\ &quot;₽&quot;"/></numFmts>
<fonts count="6">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="16"/><color rgb="FF1F3864"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="FF1F3864"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4E4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="18">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="1" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="1" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="165" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function colName(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const EXCEL_EPOCH = L.dayNum('1899-12-30');
const serial = iso => L.dayNum(iso) - EXCEL_EPOCH;
const round2 = n => Math.round(n * 100) / 100;

// Cell helpers
const txt = (v, s = S.text) => ({ v: v ?? '', s });
const num = (v, s = S.money) => ({ v: round2(Number(v) || 0), s });
const int = (v, s = S.int) => ({ v: Number(v) || 0, s });
const date = iso => (L.isDate(iso) ? { v: serial(iso), s: S.date } : { v: '', s: S.date });
const fml = (f, cached, s = S.money) => ({ f, v: round2(cached), s });

class Sheet {
  constructor(name, widths) {
    this.name = name;
    this.widths = widths;
    this.rows = [];
    this.merges = [];
    this.freezeRow = 0;
    this.filter = null;
  }
  get next() { return this.rows.length + 1; } // 1-based number of the row that add() will write
  add(cells = [], height) { this.rows.push({ cells, height }); return this.rows.length; }
  blank() { return this.add([]); }

  xml(selected) {
    const maxCols = Math.max(this.widths.length, ...this.rows.map(r => r.cells.length));
    const lastRef = `${colName(Math.max(0, maxCols - 1))}${Math.max(1, this.rows.length)}`;
    const view = this.freezeRow
      ? `<pane ySplit="${this.freezeRow}" topLeftCell="A${this.freezeRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${this.freezeRow + 1}" sqref="A${this.freezeRow + 1}"/>`
      : '';
    const cols = this.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const rows = this.rows.map((row, ri) => {
      const r = ri + 1;
      const cells = row.cells.map((c, ci) => cellXml(`${colName(ci)}${r}`, c)).join('');
      const ht = row.height ? ` ht="${row.height}" customHeight="1"` : '';
      return `<row r="${r}"${ht}>${cells}</row>`;
    }).join('');
    const merges = this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastRef}"/>`
      + `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${view}</sheetView></sheetViews>`
      + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>`
      + (this.filter ? `<autoFilter ref="${this.filter}"/>` : '')
      + merges
      + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
      + '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
  }
}

function cellXml(ref, c) {
  if (!c) return '';
  const s = c.s ? ` s="${c.s}"` : '';
  if (c.f) return `<c r="${ref}"${s}><f>${xmlEsc(c.f)}</f><v>${c.v}</v></c>`;
  if (typeof c.v === 'number') return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
  if (c.v === '' || c.v == null) return s ? `<c r="${ref}"${s}/>` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`;
}

const quoted = name => `'${name.replace(/'/g, "''")}'`;

// Report for a user without budget access: drops money columns (by 0-based index) and the totals row.
// Callers pass only columns no remaining formula refers to.
function stripCols(sh, idxs, { dropTotals = false } = {}) {
  const drop = new Set(idxs);
  const keep = (_, i) => !drop.has(i);
  sh.widths = sh.widths.filter(keep);
  if (dropTotals && sh.filter) sh.rows.pop();
  for (const r of sh.rows) r.cells = r.cells.filter(keep);
  if (sh.filter) sh.filter = `A1:${colName(sh.widths.length - 1)}${sh.filter.match(/\d+$/)[0]}`;
  return sh;
}

/* ---------- sheets ---------- */
function tasksSheet(rep) {
  const sh = new Sheet('Карточки', [32, 11, 16, 20, 24, 17, 16, 11, 12, 15, 10, 9, 9, 10, 14, 14, 14, 14, 9, 9, 32]);
  sh.add(['Проект', 'Шифр', 'Разделы (марки)', 'Уточнение', 'Подрядчик', 'Телефон', 'Договор', 'Старт', 'Плановый финиш', 'Статус',
    'Просрочка, дн.', 'Переносов', 'Сдвиг, дн.', 'Кругов замечаний', 'Бюджет', 'Оплачено', 'Остаток', 'Пора платить', 'Счёт', 'Акт', 'Примечание'].map(h => txt(h, S.header)), 32);
  sh.freezeRow = 1;
  if (!rep.rows.length) { sh.add([txt('Карточек нет')]); return sh; }
  const yes = (v, need) => (v ? txt('есть', S.ok) : need ? txt('нет', S.warn) : txt('нет'));
  for (const r of rep.rows) {
    const n = sh.next;
    const contract = r.contractNo ? `№ ${r.contractNo}${r.contractDate ? ' от ' + r.contractDate.split('-').reverse().join('.') : ''}` : '';
    sh.add([
      txt(r.project), txt(r.code), txt(r.section), txt(r.title), txt(r.contractor || 'не назначен'), txt(r.phone), txt(contract),
      date(r.start), date(r.finish), txt(r.statusLabel, TONE_STYLE[r.tone] || S.text),
      r.overdueDays ? int(r.overdueDays, S.intBad) : txt('', S.int),
      r.shifts ? int(r.shifts) : txt('', S.int), r.shifts ? int(r.shiftDays) : txt('', S.int), r.rounds ? int(r.rounds) : txt('', S.int),
      num(r.budget), num(r.paid), fml(`O${n}-P${n}`, r.rest), r.dueNow > 0 ? num(r.dueNow, S.moneyWarn) : num(0),
      yes(r.invoiceReceived, r.dueNow > 0), yes(r.actSigned, r.status === 'done'), txt(r.note),
    ]);
  }
  const last = sh.rows.length;
  sh.filter = `A1:U${last}`;
  const t = rep.totals;
  // SUBTOTAL(9) sums only the rows left visible by the filter.
  sh.add([txt('Итого', S.totalLabel), ...Array(13).fill(txt('', S.totalLabel)),
    fml(`SUBTOTAL(9,O2:O${last})`, t.budget, S.totalMoney), fml(`SUBTOTAL(9,P2:P${last})`, t.paid, S.totalMoney),
    fml(`SUBTOTAL(9,Q2:Q${last})`, t.rest, S.totalMoney), fml(`SUBTOTAL(9,R2:R${last})`, rep.dueNow, S.totalMoney),
    txt('', S.totalLabel), txt('', S.totalLabel), txt('', S.totalLabel)]);
  return sh;
}

function contractorsSheet(rep) {
  const sh = new Sheet('Исполнители', [28, 22, 17, 24, 24, 10, 10, 10, 10, 12, 12, 14, 14, 14, 14]);
  sh.add(['ФИО / название', 'Специализация', 'Телефон', 'Почта', 'Мессенджер', 'Карточек', 'В работе', 'Сорвано',
    'В срок, %', 'Ср. просрочка, дн.', 'Замечаний на работу', 'Бюджет', 'Оплачено', 'К оплате', 'Пора платить'].map(h => txt(h, S.header)), 32);
  sh.freezeRow = 1;
  if (!rep.contractors.length) { sh.add([txt('Подрядчиков нет')]); return sh; }
  for (const c of rep.contractors) {
    const n = sh.next, t = c.totals, r = c.reliability;
    const rated = r.grade !== 'none';
    sh.add([txt(c.name), txt(c.specialty), txt(c.phone), txt(c.email), txt(c.messenger),
      int(t.count), int(t.active), t.overdue ? int(t.overdue, S.intBad) : int(0),
      rated ? int(r.pct, r.grade === 'bad' ? S.intBad : S.int) : txt('мало данных', S.int),
      rated ? { v: r.avgLate, s: S.text } : txt("", S.int), r.avgRounds != null ? { v: r.avgRounds, s: S.text } : txt('', S.int),
      num(t.budget), num(t.paid), fml(`L${n}-M${n}`, t.rest), c.dueNow > 0 ? num(c.dueNow, S.moneyWarn) : num(0)]);
  }
  const last = sh.rows.length;
  sh.filter = `A1:O${last}`;
  const sum = (col, get) => fml(`SUBTOTAL(9,${col}2:${col}${last})`, rep.contractors.reduce((a, c) => a + get(c), 0), S.totalMoney);
  sh.add([txt('Итого', S.totalLabel), ...Array(10).fill(txt('', S.totalLabel)), sum('L', c => c.totals.budget), sum('M', c => c.totals.paid),
    sum('N', c => c.totals.rest), sum('O', c => c.dueNow)]);
  return sh;
}

function paymentsSheet(rep) {
  const sh = new Sheet('Платежи', [12, 34, 9, 26, 15, 40]);
  sh.add(['Дата', 'Проект', 'Разделы', 'Подрядчик', 'Сумма', 'Комментарий'].map(h => txt(h, S.header)), 20);
  sh.freezeRow = 1;
  if (!rep.payments.length) { sh.add([txt('Платежей нет')]); return sh; }
  for (const p of rep.payments) sh.add([date(p.date), txt(p.project), txt(p.section), txt(p.contractor), num(p.amount), txt(p.note)]);
  const last = sh.rows.length;
  sh.filter = `A1:F${last}`;
  sh.add([txt('Итого', S.totalLabel), txt('', S.totalLabel), txt('', S.totalLabel), txt('', S.totalLabel),
    fml(`SUBTOTAL(9,E2:E${last})`, rep.payments.reduce((a, p) => a + p.amount, 0), S.totalMoney), txt('', S.totalLabel)]);
  return sh;
}

function summarySheet(rep, generatedAt) {
  const sh = new Sheet('Сводка', [36, 17, 26, 18, 14, 12, 14, 16, 16, 16]);
  sh.add([txt(rep.scope?.title ? `Отчёт главспеца: ${rep.scope.title}` : 'Отчёт главспеца', S.title)], 24);
  sh.merges.push('A1:F1');
  sh.add([txt(`По состоянию на ${rep.today.split('-').reverse().join('.')} · сформирован ${generatedAt}`, S.subtitle)]);
  sh.blank();

  const t = rep.totals;
  sh.add([txt('Показатели', S.heading)]);
  const kpis = [
    ['Карточек всего', int(t.count)], ['В работе', int(t.active)],
    ['Срок сорван', t.overdue ? int(t.overdue, S.intBad) : int(0)], ['На проверке', int(t.review)], ['Принято', int(t.done)],
    ['Бюджет', num(t.budget)], ['Оплачено', num(t.paid)], ['Пора платить', rep.dueNow > 0 ? num(rep.dueNow, S.moneyWarn) : num(0)], ['Всего осталось оплатить', num(t.rest)],
  ];
  for (const [label, cell] of rep.money === false ? kpis.slice(0, 5) : kpis) sh.add([txt(label), cell]);
  sh.blank();

  sh.add([txt('По проектам', S.heading)]);
  sh.add(['Проект', 'Шифр', 'Заказчик / ГИП', 'Карточек', 'Принято', 'Сорвано', 'На проверке', 'Бюджет', 'Оплачено', 'Остаток'].slice(0, rep.money === false ? 7 : 10).map(h => txt(h, S.header)), 32);
  if (rep.projects.length) {
    const first = sh.next;
    for (const p of rep.projects) {
      const n = sh.next, x = p.totals;
      sh.add([txt(p.name), txt(p.code), txt(p.client), int(x.count), int(x.done), x.overdue ? int(x.overdue, S.intBad) : int(0),
        int(x.review), ...(rep.money === false ? [] : [num(x.budget), num(x.paid), fml(`H${n}-I${n}`, x.rest)])]);
    }
    const last = sh.next - 1;
    const sumInt = (col, k) => fml(`SUM(${col}${first}:${col}${last})`, rep.projects.reduce((a, p) => a + p.totals[k], 0), S.totalInt);
    const sumMoney = (col, k) => fml(`SUM(${col}${first}:${col}${last})`, rep.projects.reduce((a, p) => a + p.totals[k], 0), S.totalMoney);
    if (rep.money === false) sh.add([txt('Итого', S.totalLabel), txt('', S.totalLabel), txt('', S.totalLabel), sumInt('D', 'count'), sumInt('E', 'done'), sumInt('F', 'overdue'), sumInt('G', 'review')]);
    else sh.add([txt('Итого', S.totalLabel), txt('', S.totalLabel), txt('', S.totalLabel), sumInt('D', 'count'), sumInt('E', 'done'),
      sumInt('F', 'overdue'), sumInt('G', 'review'), sumMoney('H', 'budget'), sumMoney('I', 'paid'), sumMoney('J', 'rest')]);
  } else {
    sh.add([txt('Проектов нет')]);
  }
  sh.blank();

  sh.add([txt('Срок сорван', S.heading)]);
  if (rep.attention.overdue.length) {
    sh.add(['Проект', 'Разделы', 'Подрядчик', 'Телефон', 'План. финиш', 'Просрочка, дн.'].map(h => txt(h, S.header)), 20);
    for (const r of rep.attention.overdue) {
      sh.add([txt(r.project), txt(r.section), txt(r.contractor || 'не назначен'), txt(r.phone), date(r.finish), int(r.overdueDays, S.intBad)]);
    }
  } else {
    sh.add([txt('Просроченных карточек нет.')]);
  }
  if (rep.money !== false && rep.attention.pay.length) {
    sh.blank();
    sh.add([txt('Пора платить', S.heading)]);
    sh.add(['Проект', 'Разделы', 'Подрядчик', 'Телефон', 'Счёт', 'К оплате'].map(h => txt(h, S.header)), 20);
    for (const r of rep.attention.pay) {
      sh.add([txt(r.project), txt(r.section), txt(r.contractor || 'не назначен'), txt(r.phone), r.invoiceReceived ? txt('получен', S.ok) : txt('не получен', S.warn), num(r.dueNow, S.moneyWarn)]);
    }
  }
  return sh;
}

function employeeSheet(rep) {
  const e = rep.employee, s = e.summary;
  const sh = new Sheet('Сотрудник', [34, 22, 16, 14, 14, 14, 16, 12]);
  sh.add([txt(`Отчёт по сотруднику: ${e.name}`, S.title)], 24);
  sh.merges.push('A1:F1');
  sh.add([txt(`${e.role}${e.directions ? ' · ' + e.directions : ''} · ${e.periodLabel}`, S.subtitle)]);
  sh.blank();
  for (const [label, cell] of [['Сдано работ', int(s.delivered)], ['Из них в срок', int(s.onTime)], ['С опозданием', s.late ? int(s.late, S.intBad) : int(0)],
    ['Кругов замечаний в среднем', { v: s.avgRounds, s: S.text }], ['Сейчас в работе', int(s.activeNow)], ['Сейчас сорвано', s.overdueNow ? int(s.overdueNow, S.intBad) : int(0)]]) sh.add([txt(label), cell]);
  sh.blank();
  sh.add([txt(`Сдано ${e.periodLabel}`, S.heading)]);
  sh.add(['Проект', 'Разделы', 'Роль', 'Срок', 'Сдано', 'Принято', 'Опоздание, дн.', 'Замечаний'].map(h => txt(h, S.header)), 20);
  if (!e.delivered.length) sh.add([txt('За период сданных работ нет')]);
  for (const d of e.delivered) sh.add([txt(d.project), txt(d.section), txt(d.role), date(d.finish), date(d.handed), date(d.accepted), d.late ? int(d.late, S.intBad) : int(0), int(d.rounds)]);
  return sh;
}

function buildXlsx(rep, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const generatedAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const noMoney = rep.money === false;
  const summary = summarySheet(rep, generatedAt);
  if (noMoney) summary.widths = summary.widths.slice(0, 7);
  const sheets = noMoney
    ? [summary, stripCols(tasksSheet(rep), [6, 14, 15, 16, 17, 18, 19], { dropTotals: true }), stripCols(contractorsSheet(rep), [11, 12, 13, 14], { dropTotals: true })]
    : [summary, tasksSheet(rep), contractorsSheet(rep), paymentsSheet(rep)];
  if (rep.employee) sheets.unshift(employeeSheet(rep));
  return packWorkbook(sheets, 'Отчёт главспеца', now);
}

// «Состав проектной документации» as one sheet (номер тома, обозначение, наименование, примечание).
// One sheet per list: «Состав ПД» and, when given, «ВОК» (meta.rdRows).
function buildCompositionXlsx(rows, meta, now = new Date()) {
  const sheet = (name, title, list) => {
    const sh = new Sheet(name, [12, 26, 90, 22]);
    sh.add([txt(`${title} · ${meta.project}${meta.code ? ' · шифр ' + meta.code : ''}`, S.header)], 24);
    sh.merges.push('A1:D1');
    sh.add(['Номер тома', 'Обозначение', 'Наименование', 'Примечание'].map(h => txt(h, S.header)), 22);
    sh.freezeRow = 2;
    for (const r of list) sh.add([txt(r.tom), txt(r.code), txt(r.name), txt(r.note)]);
    return sh;
  };
  const sheets = [sheet('Состав ПД', meta.title, rows)];
  if (meta.rdRows?.length) sheets.push(sheet('ВОК', 'Ведомость основных комплектов рабочих чертежей', meta.rdRows));
  return packWorkbook(sheets, meta.title, now);
}

function packWorkbook(sheets, title, now) {
  const files = [];
  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` });
  files.push({ name: 'docProps/core.xml', data: coreProps(title, now) });

  const filterNames = sheets.map((sh, i) => sh.filter
    ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xmlEsc(quoted(sh.name))}!${sh.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '').join('');
  files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filterNames ? `<definedNames>${filterNames}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  files.push({ name: 'xl/styles.xml', data: STYLES });
  sheets.forEach((sh, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sh.xml(i === 0) }));
  return createZip(files, now);
}

function coreProps(title, now) {
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title)}</dc:title><dc:creator>Пульт главспеца</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
}

module.exports = { buildXlsx, buildCompositionXlsx, coreProps, colName };

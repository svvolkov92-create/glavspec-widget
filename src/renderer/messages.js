// Ready-made messages to a contractor about one card. Pure: used by the UI and the tests.
(function (root, factory) {
  const logic = typeof module === 'object' && module.exports ? require('./logic.js') : root.Logic;
  const api = factory(logic);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Messages = api;
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  const TEMPLATES = [
    { id: 'assign', label: 'Выдача задания' },
    { id: 'remind', label: 'Напоминание о сроке' },
    { id: 'overdue', label: 'Срок сорван' },
    { id: 'remarks', label: 'Замечания выданы' },
    { id: 'accepted', label: 'Работа принята' },
  ];

  const fullDate = iso => (L.isDate(iso) ? iso.split('-').reverse().join('.') : 'не задан');
  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const money = n => nf.format(Number(n) || 0) + ' ₽';

  // «Петров Алексей Сергеевич» → «Алексей Сергеевич»; initials, companies and «ИП …» get a neutral greeting.
  function greeting(name) {
    const words = String(name || '').replace(/^пример:\s*/i, '').trim().split(/\s+/).filter(Boolean);
    const person = words.length === 3 && words.every(w => /^[А-ЯЁ][а-яё-]{2,}$/.test(w));
    return person ? `${words[1]} ${words[2]}, добрый день!` : 'Добрый день!';
  }
  const lastRemarks = t => {
    const h = L.historyOf(t).filter(x => x.type === 'status' && x.to === 'revision' && x.note).at(-1);
    return h ? h.note : '';
  };

  // A template that does not fit the card's state is still offered; `suggest` picks the likely one.
  function suggest(t, today = L.todayStr()) {
    if (t.status === 'done') return 'accepted';
    if (t.status === 'revision') return 'remarks';
    if (L.timing(t, today).overdue) return 'overdue';
    if (t.status === 'not_started') return 'assign';
    return 'remind';
  }

  function build(kind, { task: t, project: p, contractor: c, signature = '', today = L.todayStr() }) {
    const marks = L.sectionsOf(t).join(', ') || '—';
    const obj = p ? `«${p.name}»${p.code ? ` (шифр ${p.code})` : ''}` : '';
    const what = `разделы ${marks}${t.title ? ` (${t.title})` : ''}${obj ? ` по объекту ${obj}` : ''}`;
    const tm = L.timing(t, today);
    const sign = signature.trim() ? `\n\n${signature.trim()}` : '';
    const hello = greeting(c?.name);
    let subject = '', body = '';
    switch (kind) {
      case 'assign': {
        const contract = t.contractNo ? ` по договору № ${t.contractNo}${t.contractDate ? ` от ${fullDate(t.contractDate)}` : ''}` : '';
        subject = `Задание: ${marks} — ${p?.name || 'проект'}`;
        body = `${hello}\n\nНаправляю задание на ${what}${contract}.\n`
          + `Старт работ: ${fullDate(t.start)}. Плановая сдача: ${fullDate(t.finish)}.`
          + (L.budgetOf(t) ? `\nСтоимость работ: ${money(L.budgetOf(t))}.` : '')
          + (L.milestonesOf(t, today).list.length ? `\nКонтрольные точки:\n${L.milestonesOf(t, today).list.map(m => `— ${m.title}: ${fullDate(m.date)}`).join('\n')}` : '')
          + '\n\nПодтвердите, пожалуйста, что берёте в работу.';
        break;
      }
      case 'remind':
        subject = `Срок сдачи: ${marks} — ${fullDate(t.finish)}`;
        body = `${hello}\n\nНапоминаю: ${what} — плановая сдача ${fullDate(t.finish)}`
          + (tm.workdays != null ? ` (осталось ${tm.workdays} раб. дн.)` : '') + '.'
          + (L.milestonesOf(t, today).next ? `\nБлижайшая контрольная точка: ${L.milestonesOf(t, today).next.title} — ${fullDate(L.milestonesOf(t, today).next.date)}.` : '')
          + '\n\nПодтвердите, пожалуйста, что успеваете, или сообщите, если есть риски.';
        break;
      case 'overdue':
        subject = `Срок сорван: ${marks} — ${p?.name || 'проект'}`;
        body = `${hello}\n\nСрок сдачи (${what}) был ${fullDate(t.finish)}`
          + (tm.overdue ? `, просрочка ${tm.late} дн.` : '') + '.'
          + '\n\nСообщите, пожалуйста, когда сможете сдать работу и что мешает.';
        break;
      case 'remarks': {
        const notes = lastRemarks(t);
        subject = `Замечания: ${marks} — ${p?.name || 'проект'}`;
        body = `${hello}\n\nПо результатам проверки (${what}) есть замечания${notes ? `:\n${notes}` : '.'}`
          + '\n\nПрошу устранить и прислать исправленную документацию до ____.';
        break;
      }
      case 'accepted': {
        const due = L.paymentPlan(t, today).dueNow;
        subject = `Работа принята: ${marks} — ${p?.name || 'проект'}`;
        body = `${hello}\n\n${what[0].toUpperCase() + what.slice(1)} — приняты, спасибо за работу.`
          + (due > 0 ? `\nК оплате: ${money(due)}. ${t.invoiceReceived ? 'Счёт получен, оплата в работе.' : 'Пришлите, пожалуйста, счёт.'}` : '')
          + (t.actSigned ? '' : '\nТакже нужен подписанный акт выполненных работ.');
        break;
      }
      default:
        return null;
    }
    return { subject, text: body + sign };
  }

  return { TEMPLATES, build, suggest, greeting };
});

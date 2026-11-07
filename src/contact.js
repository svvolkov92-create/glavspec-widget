'use strict';

// Builds external links to reach a contractor. Only data from the stored contractor record is used.
function phoneDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1); // 8 900 … → 7 900 …
  if (d.length === 10) d = '7' + d;                                  // 900 … without the country code
  return d.length >= 11 && d.length <= 15 ? d : '';
}

function telegramUser(messenger) {
  const s = String(messenger || '');
  const m = s.match(/t\.me\/([A-Za-z0-9_]{5,32})/) || s.match(/@([A-Za-z0-9_]{5,32})/);
  return m ? m[1] : '';
}

function contactUrl(contractor, kind, { subject = '', text = '' } = {}) {
  if (!contractor) return null;
  const enc = s => encodeURIComponent(s).replace(/%0A/g, '%0D%0A');
  switch (kind) {
    case 'mail': {
      const email = String(contractor.email || '').trim();
      if (!/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(email)) return null;
      return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${enc(text)}`;
    }
    case 'whatsapp': {
      const digits = phoneDigits(/whatsapp/i.test(contractor.messenger || '') ? contractor.messenger : contractor.phone) || phoneDigits(contractor.phone);
      return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
    }
    case 'telegram': {
      const user = telegramUser(contractor.messenger);
      if (user) return `https://t.me/${user}`;
      const digits = phoneDigits(contractor.phone);
      return digits ? `https://t.me/+${digits}` : null;
    }
    default:
      return null;
  }
}

module.exports = { contactUrl, phoneDigits, telegramUser };

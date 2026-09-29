const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
const BAD_TLDS = /\.(png|jpe?g|gif|svg|webp|bmp|ico|css|js|mp4|webm|woff2?|ttf|pdf)$/i;
const BAD_DOMAINS = /(example\.(com|org)|domain\.com|email\.com|yourdomain|sentry\.|wixpress\.com|sentry-next|godaddy\.com|schema\.org|w3\.org|mysite\.com|test\.com|company\.com)$/i;
const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|rediffmail|icloud|live|proton|protonmail|aol|ymail)\./i;

export const ROLE_PREFIXES = {
  hr: ['hr', 'hrd', 'careers', 'career', 'jobs', 'job', 'recruit', 'recruitment', 'recruiting', 'recruiter', 'talent', 'talentacquisition', 'ta', 'hiring', 'people', 'resume', 'resumes', 'cv', 'placement', 'placements', 'humanresource', 'humanresources', 'hrteam', 'hr.team', 'joinus', 'work'],
  sales: ['sales', 'business', 'bd', 'bizdev', 'biz', 'enquiry', 'enquiries', 'inquiry', 'inquiries', 'marketing', 'partner', 'partners', 'partnership', 'orders'],
  support: ['support', 'help', 'helpdesk', 'care', 'customercare', 'service', 'services'],
  generic: ['info', 'contact', 'contactus', 'hello', 'hi', 'admin', 'office', 'mail', 'team', 'connect', 'reach', 'general'],
};

export function extractEmails(text) {
  if (!text) return [];
  const found = new Set();
  for (const m of String(text).matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^[._%+-]+/, '').replace(/\.+$/, '');
    if (BAD_TLDS.test(e) || BAD_DOMAINS.test(e.split('@')[1])) continue;
    if (/^[0-9a-f]{16,}@/.test(e)) continue;
    found.add(e);
  }
  const all = [...found];
  return all.filter((e) => !all.some((o) => o !== e && e.includes(o)));
}

export function decodeCfEmail(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch {
    return '';
  }
}

export function categorizeEmail(email) {
  const local = email.split('@')[0].toLowerCase();
  const normalized = local.replace(/[^a-z.]/g, '');
  for (const [category, prefixes] of Object.entries(ROLE_PREFIXES)) {
    if (prefixes.some((p) => normalized === p || normalized.startsWith(`${p}.`) || (normalized.startsWith(p) && p.length >= 4))) {
      return category;
    }
  }
  if (/^(hr|career|job|recruit|talent|hiring)/.test(normalized) || /(hr|careers|jobs|recruit)$/.test(normalized)) return 'hr';
  if (FREE_MAIL.test(email)) return 'personal';
  return 'other';
}

export function isFreeMail(email) {
  return FREE_MAIL.test(email);
}

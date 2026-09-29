export const EDUCATION_LEVELS = [
  { key: 'any', label: 'No minimum qualification', tier: 0, generic: true, query: '', re: /\b(no (minimum )?(education|qualification)|any qualification|qualification not required|education not required|illiterate|literate|below 10th|8th pass)\b/i },
  { key: '10th', label: '10th pass', tier: 1, generic: true, query: '10th pass', re: /\b(10th|ssc|sslc|matric(ulation)?)\b/i },
  { key: '12th', label: '12th pass', tier: 2, generic: true, query: '12th pass', re: /\b(12th|hsc|higher secondary|intermediate pass|puc)\b/i },
  { key: 'iti', label: 'ITI', tier: 2, query: 'ITI', re: /\biti\b/i },
  { key: 'diploma', label: 'Diploma / Polytechnic', tier: 3, query: 'diploma', re: /\b(diploma|polytechnic)\b/i },
  { key: 'graduate', label: 'Any graduate', tier: 4, generic: true, query: 'graduate', re: /(?<!post[\s-]?)\b(graduat(e|es|ion)|bachelor'?s?( degree)?|any degree|under ?graduate degree)\b/i },
  { key: 'be_btech', label: 'B.E. / B.Tech', tier: 4, query: 'B.Tech', re: /\b(b\.\s?e\b|b\.?\s?tech\b|be\s*\/\s*b\.?\s?tech|bachelor of (engineering|technology))/i },
  { key: 'bcom', label: 'B.Com', tier: 4, query: 'B.Com', re: /\b(b\.?\s?com\b|bachelor of commerce)/i },
  { key: 'bsc', label: 'B.Sc', tier: 4, query: 'B.Sc', re: /\b(b\.?\s?sc\b(?!\.?\s*nursing)|bachelor of science)/i },
  { key: 'bca', label: 'BCA', tier: 4, query: 'BCA', re: /\b(b\.?\s?c\.?\s?a\b|bachelor of computer applications?)/i },
  { key: 'bba', label: 'BBA / BMS', tier: 4, query: 'BBA', re: /\b(b\.?\s?b\.?\s?a\b|bms\b|bachelor of business administration)/i },
  { key: 'ba', label: 'B.A.', tier: 4, query: 'BA', re: /\b(b\.a\b\.?|bachelor of arts)|\bBA\b/i },
  { key: 'nursing', label: 'Nursing (GNM / ANM / B.Sc Nursing)', tier: 4, query: 'nursing', re: /\b(gnm|anm|b\.?\s?sc\.?\s*nursing|nursing degree)\b/i },
  { key: 'pharmacy', label: 'Pharmacy (D.Pharm / B.Pharm)', tier: 4, query: 'B.Pharm', re: /\b([bdm]\.?\s?pharm(a|acy)?)\b/i },
  { key: 'medical', label: 'MBBS / BDS / AYUSH', tier: 5, query: 'MBBS', re: /\b(mbbs|bds|bams|bhms|bums)\b/i },
  { key: 'law', label: 'LLB / LLM', tier: 4, query: 'LLB', re: /\b(ll\.?\s?b|ll\.?\s?m)\b/i },
  { key: 'postgraduate', label: 'Any post graduate', tier: 5, generic: true, query: 'post graduate', re: /\b(post[\s-]?graduat(e|es|ion)|master'?s?( degree)?)\b/i },
  { key: 'mba', label: 'MBA / PGDM', tier: 5, query: 'MBA', re: /\b(mba|pgdm)\b/i },
  { key: 'mca', label: 'MCA', tier: 5, query: 'MCA', re: /\b(m\.?\s?c\.?\s?a\b|master of computer applications?)/i },
  { key: 'me_mtech', label: 'M.E. / M.Tech', tier: 5, query: 'M.Tech', re: /\b(m\.\s?e\b|m\.?\s?tech\b|master of (engineering|technology))/i },
  { key: 'mcom', label: 'M.Com', tier: 5, query: 'M.Com', re: /\b(m\.?\s?com\b|master of commerce)/i },
  { key: 'msc', label: 'M.Sc', tier: 5, query: 'M.Sc', re: /\b(m\.?\s?sc\b|master of science)/i },
  { key: 'ca_cs', label: 'CA / CS / CMA', tier: 5, query: 'CA', re: /\b(chartered accountant|ca[\s-](inter|final|qualified)|company secretary|icwa|cma)\b|\b(CA|CS)\b/ },
  { key: 'phd', label: 'PhD', tier: 6, query: 'PhD', re: /\b(ph\.?\s?d|doctorate)\b/i },
];

export const EDUCATION_KEYS = EDUCATION_LEVELS.map((e) => e.key);
const BY_KEY = new Map(EDUCATION_LEVELS.map((e) => [e.key, e]));

export const educationByKey = (key) => BY_KEY.get(key) || null;

export function detectEducation(...texts) {
  const text = texts.filter(Boolean).join('\n').slice(0, 20000);
  if (!text) return [];
  const found = EDUCATION_LEVELS.filter((e) => e.re.test(text)).map((e) => e.key);
  const specific = found.filter((k) => !BY_KEY.get(k).generic);
  const hasSpecific = (tier) => specific.some((k) => BY_KEY.get(k).tier === tier);
  return found.filter((k) => !(k === 'graduate' && hasSpecific(4) && !/any (graduate|degree)/i.test(text)) && !(k === 'postgraduate' && hasSpecific(5) && !/any post[\s-]?graduate/i.test(text)));
}

function satisfies(seekerKey, requiredKey) {
  if (seekerKey === requiredKey || requiredKey === 'any') return true;
  const s = BY_KEY.get(seekerKey);
  const r = BY_KEY.get(requiredKey);
  if (!s || !r) return false;
  return Boolean(r.generic && s.tier >= r.tier);
}

export function educationMatches(seekerKey, required) {
  if (!seekerKey || !required?.length) return true;
  return required.some((r) => satisfies(seekerKey, r));
}

export function qualifyingKeys(seekerKey) {
  return EDUCATION_KEYS.filter((r) => satisfies(seekerKey, r));
}

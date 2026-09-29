import crypto from 'node:crypto';

const TITLE_NOISE =
  /\b(urgent(ly)?|hiring|required|requirement|wanted|opening|openings|vacanc(y|ies)|job|jobs|immediate(ly)?|joiners?|walk ?-?in|apply now|freshers?|for|the|a|an|position|post)\b/g;
const COMPANY_NOISE = /\b(pvt|private|ltd|limited|llp|inc|co|company|corp|corporation|the|india)\b/g;

const clean = (s, noise) =>
  String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(noise, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normTitle = (t) => clean(t, TITLE_NOISE);
export const normCompany = (c) => clean(c, COMPANY_NOISE);
export const normCity = (job) => clean(String(job.city || job.location || '').split(',')[0], /$^/);

const TRACKING_PARAM = /^(utm_|gclid$|fbclid$|ref$|refid$|src$|source$|trk|si$|_ga$)/i;

export function canonicalUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/^https?:$/.test(u.protocol)) return '';
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.hostname}${path}${u.search}`;
  } catch {
    return '';
  }
}

export function identityKey(job) {
  const title = normTitle(job.title);
  const company = normCompany(job.companyName);
  if (!title) return '';
  if (!company) return '';
  return crypto.createHash('sha1').update(`${title}|${company}|${normCity(job)}`).digest('hex');
}

export function uniqueEmails(list) {
  const out = new Map();
  for (const e of list || []) {
    const v = String(e || '').trim().toLowerCase();
    if (v && !out.has(v)) out.set(v, v);
  }
  return [...out.values()];
}

const phoneCore = (p) => String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');

export function uniquePhones(list) {
  const out = new Map();
  for (const p of list || []) {
    const core = phoneCore(p);
    if (core.length < 6) continue;
    const digits = String(p).replace(/\D/g, '');
    const stdGroup = /^0\d{2,4}\D/.test(String(p).trim());
    const mobile = /^[6-9]/.test(core) && core.length === 10 && (digits.length === 10 || /^\+?\s*91/.test(String(p).trim()) || (digits.length === 11 && !stdGroup));
    const pretty = mobile ? `+91 ${core.slice(0, 5)} ${core.slice(5)}` : String(p).trim();
    if (!out.has(core)) out.set(core, pretty);
  }
  return [...out.values()];
}

export function uniqueLinks(options) {
  const out = new Map();
  for (const o of options || []) {
    const key = canonicalUrl(o?.link);
    if (key && !out.has(key)) out.set(key, o);
  }
  return [...out.values()];
}

const jobUrls = (job) => [job.applyUrl, job.sourceUrl, ...(job.applyOptions || []).map((o) => o.link)].map(canonicalUrl).filter(Boolean);

// Collapses listings that are the same job (same title + company + city, or sharing a posting URL), keeping the best-scored one.
export function dedupeJobs(jobs, score = () => 0) {
  const sorted = [...jobs].sort((a, b) => score(b) - score(a));
  const owner = new Map();
  const kept = [];
  for (const job of sorted) {
    const keys = [identityKey(job), ...jobUrls(job).map((u) => `url:${u}`)].filter(Boolean).map((k) => (k.startsWith('url:') ? k : `id:${k}`));
    const hit = keys.map((k) => owner.get(k)).find(Boolean);
    if (hit) {
      hit.applyOptions = uniqueLinks([...(hit.applyOptions || []), ...(job.applyOptions || []), ...(job.applyUrl ? [{ title: job.via || job.platform || 'Apply', link: job.applyUrl }] : [])]);
      hit.emails = uniqueEmails([...(hit.emails || []), ...(job.emails || [])]);
      hit.phones = uniquePhones([...(hit.phones || []), ...(job.phones || [])]);
      for (const k of keys) if (!owner.has(k)) owner.set(k, hit);
      continue;
    }
    const copy = { ...job, applyOptions: uniqueLinks(job.applyOptions), emails: uniqueEmails(job.emails), phones: uniquePhones(job.phones) };
    kept.push(copy);
    for (const k of keys) owner.set(k, copy);
  }
  return kept;
}

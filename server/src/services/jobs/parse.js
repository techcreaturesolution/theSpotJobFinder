import crypto from 'node:crypto';
import { canonicalUrl, identityKey, normTitle } from './dedupe.js';
import * as cheerio from 'cheerio';
import { extractEmails } from '../emails.js';
import { domainOf } from '../../utils/http.js';
import { detectEducation } from './education.js';

const PLATFORMS = [
  ['linkedin.com', 'LinkedIn'],
  ['indeed.com', 'Indeed'],
  ['apna.co', 'Apna'],
  ['workindia.in', 'WorkIndia'],
  ['naukri.com', 'Naukri'],
  ['x.com', 'X (Twitter)'],
  ['twitter.com', 'X (Twitter)'],
  ['facebook.com', 'Facebook'],
  ['instagram.com', 'Instagram'],
  ['foundit.in', 'foundit'],
  ['monsterindia.com', 'foundit'],
  ['shine.com', 'Shine'],
  ['timesjobs.com', 'TimesJobs'],
  ['glassdoor.co.in', 'Glassdoor'],
  ['glassdoor.com', 'Glassdoor'],
  ['internshala.com', 'Internshala'],
  ['freshersworld.com', 'Freshersworld'],
  ['cutshort.io', 'Cutshort'],
  ['instahyre.com', 'Instahyre'],
  ['hirist.tech', 'Hirist'],
  ['quikr.com', 'Quikr Jobs'],
  ['olx.in', 'OLX Jobs'],
  ['jobhai.com', 'Job Hai'],
  ['ncs.gov.in', 'National Career Service'],
  ['adzuna.in', 'Adzuna'],
  ['adzuna.co.in', 'Adzuna'],
  ['jooble.org', 'Jooble'],
  ['careerjet.co.in', 'Careerjet'],
  ['google.com', 'Google'],
];

export const ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'myworkdayjobs.com',
  'workday.com',
  'smartrecruiters.com',
  'zohorecruit.com',
  'zohorecruit.in',
  'keka.com',
  'darwinbox.in',
  'darwinbox.com',
  'freshteam.com',
  'ashbyhq.com',
  'breezy.hr',
  'workable.com',
  'bamboohr.com',
  'icims.com',
  'taleo.net',
  'successfactors.com',
  'jobvite.com',
  'recruitee.com',
  'teamtailor.com',
];

const matchesDomain = (d, list) => list.some((s) => d === s || d.endsWith(`.${s}`));

export function platformOf(urlOrVia) {
  if (!urlOrVia) return null;
  const s = String(urlOrVia).trim();
  const d = /^https?:\/\//i.test(s) ? domainOf(s) : null;
  if (d) {
    const hit = PLATFORMS.find(([dom]) => d === dom || d.endsWith(`.${dom}`));
    if (hit) return hit[1];
    return matchesDomain(d, ATS_DOMAINS) ? 'Company careers page' : 'Company website';
  }
  const via = s.replace(/^via\s+/i, '');
  const hit = PLATFORMS.find(([dom, label]) => via.toLowerCase().includes(label.toLowerCase().split(' ')[0]) || via.toLowerCase().includes(dom));
  return hit ? hit[1] : via;
}

export function isJobBoardUrl(url) {
  const d = domainOf(url);
  if (!d) return false;
  return PLATFORMS.some(([dom]) => d === dom || d.endsWith(`.${dom}`)) || matchesDomain(d, ATS_DOMAINS);
}

const FRESHER_RE =
  /\b(freshers?|entry[\s-]?level|no (?:prior )?experience|graduate trainee|trainee|internship|interns?|0\s*(?:-|–|to)\s*[12]\s*(?:yrs?|years?)|0\s*(?:yrs?|years?)|zero experience|experience\s*:\s*0\b)/i;
const YEARS_RE = /(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:yrs?|years?)\b(?:\s*(?:of)?\s*(?:experience|exp|work))?/i;
const EXP_CONTEXT_RE = /(experience|exp\b|experienced)/i;

export function detectExperience(...texts) {
  const text = texts.filter(Boolean).join(' \n ');
  if (!text) return { level: null, text: '' };
  for (const line of text.split(/\n|[.;•]/)) {
    if (!EXP_CONTEXT_RE.test(line)) continue;
    const m = line.match(YEARS_RE);
    if (!m) continue;
    const min = Number(m[1]);
    const max = m[2] ? Number(m[2]) : null;
    const label = max !== null ? `${min}-${max} years` : `${min}+ years`;
    if (min === 0) return { level: 'fresher', text: max !== null ? `Fresher (${label})` : 'Fresher' };
    return { level: 'experienced', text: label };
  }
  if (FRESHER_RE.test(text)) return { level: 'fresher', text: 'Fresher' };
  if (/\bexperienced\b/i.test(text)) return { level: 'experienced', text: 'Experienced' };
  return { level: null, text: '' };
}

export function parsePostedAt(value, now = new Date()) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/just (now|posted)|today|few (seconds|minutes)|active/.test(s)) return new Date(now);
  if (/yesterday/.test(s)) return new Date(now.getTime() - 86400_000);
  const m = s.match(/(\d+|an?|one)\+?\s*(minute|min|hour|hr|day|week|month|year)s?\s*ago/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const unit = { minute: 60e3, min: 60e3, hour: 3600e3, hr: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 }[m[2]];
  return new Date(now.getTime() - n * unit);
}

const PHONE_RE = /(?:\+91[\s-]?|\b0)?\b[6-9](?:\d{9}|\d{4}[\s-]\d{5}|\d{2}[\s-]\d{3}[\s-]\d{4})\b|\b0\d{2,4}[\s-]\d{6,8}\b/g;

export function extractPhones(text) {
  if (!text) return [];
  const out = new Map();
  for (const m of String(text).matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '');
    const core = digits.replace(/^(91|0)(?=\d{10}$)/, '');
    if (core.length < 10 || core.length > 11) continue;
    if (/^(\d)\1+$/.test(core)) continue;
    if (!out.has(core)) out.set(core, core.length === 10 && /^[6-9]/.test(core) ? `+91 ${core.slice(0, 5)} ${core.slice(5)}` : m[0].trim());
  }
  return [...out.values()];
}

export function extractContacts(...texts) {
  const text = texts.filter(Boolean).join(' \n ');
  const deobfuscated = text.replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  return { emails: extractEmails(deobfuscated), phones: extractPhones(text) };
}

export function jobKey(job) {
  const base = identityKey(job) || `${normTitle(job.title)}|${canonicalUrl(job.applyUrl || job.sourceUrl)}`;
  return crypto.createHash('sha1').update(base).digest('hex');
}

const PROMPT_STOP =
  /\b(i|im|i'm|am|want|wants|need|needs|looking|look|search|searching|find|show|get|give|me|my|a|an|the|for|of|any|some|job|jobs|vacancy|vacancies|opening|openings|hiring|position|positions|role|roles|post|posts|please|kindly|new|latest|recent|near|around|nearby|fresher|freshers|experienced|experience|with|as|and|or|to|work)\b/gi;

export function parseJobPrompt(prompt) {
  const raw = String(prompt || '').replace(/\s+/g, ' ').trim();
  const { level } = detectExperience(raw.replace(/\bexperience\b/i, 'experienced'));
  let location = '';
  let rest = raw;
  const locMatch = raw.match(/\b(?:in|at|from)\s+([A-Za-z][A-Za-z .-]{1,40})$/i);
  if (locMatch) {
    location = locMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    rest = raw.slice(0, locMatch.index);
  }
  const years = rest.match(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:yrs?|years?)/i)?.[0] || '';
  const role = rest.replace(years, ' ').replace(PROMPT_STOP, ' ').replace(/[^\w+#./ -]/g, ' ').replace(/\s+/g, ' ').trim();
  return { role, location, level, years: years.trim(), education: detectEducation(raw)[0] || '' };
}

export function stripHtml(html) {
  if (!html) return '';
  const withBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  return cheerio
    .load(`<div>${withBreaks}</div>`)
    .root()
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function flattenLd(node, out) {
  for (const n of asArray(node)) {
    if (!n || typeof n !== 'object') continue;
    out.push(n);
    if (n['@graph']) flattenLd(n['@graph'], out);
  }
  return out;
}

function formatAddress(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  const country = typeof a.addressCountry === 'object' ? a.addressCountry?.name : a.addressCountry;
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, country].filter(Boolean).join(', ');
}

function formatSalary(s) {
  if (!s) return '';
  if (typeof s !== 'object') return String(s);
  const v = s.value || {};
  const cur = s.currency === 'INR' || !s.currency ? '₹' : `${s.currency} `;
  const range = v.minValue && v.maxValue ? `${cur}${v.minValue} - ${cur}${v.maxValue}` : v.value || v.minValue || v.maxValue ? `${cur}${v.value || v.minValue || v.maxValue}` : '';
  return range ? `${range}${v.unitText ? ` / ${String(v.unitText).toLowerCase()}` : ''}` : '';
}

export function extractJsonLdJobs(html) {
  const $ = cheerio.load(html || '');
  const jobs = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    let data;
    try {
      data = JSON.parse($(el).contents().text().trim());
    } catch {
      return;
    }
    for (const n of flattenLd(data, [])) {
      const types = asArray(n['@type']).map(String);
      if (!types.includes('JobPosting')) continue;
      const org = typeof n.hiringOrganization === 'object' ? n.hiringOrganization : { name: n.hiringOrganization };
      const locs = asArray(n.jobLocation).map((l) => formatAddress(l?.address || l)).filter(Boolean);
      const exp = n.experienceRequirements;
      const months = typeof exp === 'object' ? exp?.monthsOfExperience : null;
      const edu = asArray(n.educationRequirements).map((e) => (typeof e === 'object' ? e?.credentialCategory || e?.name || '' : String(e || ''))).filter(Boolean);
      jobs.push({
        title: n.title || n.name || '',
        companyName: org?.name || '',
        companyWebsite: asArray(org?.sameAs)[0] || org?.url || '',
        logo: typeof org?.logo === 'object' ? org.logo?.url : org?.logo || '',
        description: stripHtml(n.description || ''),
        address: locs[0] || '',
        postedAt: parsePostedAt(n.datePosted),
        validThrough: parsePostedAt(n.validThrough),
        employmentType: asArray(n.employmentType).join(', '),
        salary: formatSalary(n.baseSalary || n.estimatedSalary),
        experienceText: months !== null && months !== undefined ? `${Math.round(Number(months) / 12)}+ years` : typeof exp === 'string' ? exp : '',
        email: org?.email || n.email || '',
        telephone: org?.telephone || n.telephone || '',
        workFromHome: n.jobLocationType === 'TELECOMMUTE',
        educationText: edu.join(', '),
      });
    }
  });
  return jobs;
}

const SITE_SUFFIX = /\s*[|\-–·]\s*(linkedin|indeed(\.com)?|naukri(\.com)?|apna(\.co)?|workindia|foundit|shine(\.com)?|timesjobs|glassdoor|internshala|freshersworld|x|twitter|facebook|instagram)\b.*$/i;

export function parseResultTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const li = t.match(/^(.*?) hiring (.*?) in (.*?)(?:\s*\|\s*LinkedIn)?$/i);
  if (li) return { companyName: li[1].trim(), title: li[2].trim(), location: li[3].trim() };
  const cleaned = t.replace(SITE_SUFFIX, '').trim();
  const naukri = cleaned.match(/^(.*?) (?:job|jobs|vacancy) (?:in|at) (.*?) (?:at|in) (.*)$/i);
  if (naukri) return { title: naukri[1].trim(), companyName: naukri[2].trim(), location: naukri[3].trim() };
  const parts = cleaned.split(/\s+[-–|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { title: parts[0], companyName: parts[1], location: parts.slice(2).join(', ') };
  if (parts.length === 2) {
    const at = parts[0].match(/^(.*?) at (.*)$/i);
    if (at) return { title: at[1], companyName: at[2], location: parts[1] };
    return { title: parts[0], companyName: parts[1], location: '' };
  }
  const at = cleaned.match(/^(.*?) at (.*)$/i);
  if (at) return { title: at[1], companyName: at[2], location: '' };
  return { title: cleaned, companyName: '', location: '' };
}

export function isListingPage(title, url) {
  if (/\b\d[\d,]*\+?\s+(jobs|vacancies|openings|job openings)\b/i.test(title)) return true;
  if (/^(jobs?|vacancies|latest jobs?)\s+(in|for|near)\b/i.test(title)) return true;
  if (/\b(jobs?|vacancies) in [a-z ]+(, india)?$/i.test(title) && !/ hiring /i.test(title) && !/ at /i.test(title)) return true;
  try {
    const u = new URL(url);
    if (/\/(jobs|q-|search|jobs-in-|k-)/i.test(u.pathname) && /(naukri|indeed|shine|foundit|timesjobs)/.test(u.hostname) && !/(viewjob|job-listings|jobs\/view|jobdetail|job-detail|\d{6,})/i.test(u.pathname + u.search)) return true;
  } catch {
    return true;
  }
  return false;
}

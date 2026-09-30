import { llmEnabled, llmJson } from '../agent/llm.js';
import { extractEmails } from '../emails.js';
import { CATEGORY_KEYS, detectCategory } from './categories.js';
import { dedupeJobs, uniqueEmails, uniquePhones } from './dedupe.js';
import { detectEducation } from './education.js';
import { fetchable, fetchJobPage } from './enrich.js';
import { splitLocation } from './india.js';
import { detectExperience, extractContacts, extractPhones } from './parse.js';
import { CLOSED_RE, grounded } from './verify.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ymd = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : '';
};

export function parseDeadline(value) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const s = String(value).toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ');
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/\b(\d{1,2})\s*[- ]\s*([a-z]{3})[a-z]*\.?\s*[- ]\s*(\d{4})\b/);
  if (m && MONTHS.includes(m[2])) return ymd(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1]);
  m = s.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})\s+(\d{4})\b/);
  if (m && MONTHS.includes(m[1])) return ymd(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2]);
  return '';
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function urlsIn(text) {
  return [...new Set([...String(text || '').matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:!?]+$/, '')))];
}

const groundedUrl = (value, text) => {
  const v = String(value || '').trim();
  return /^https?:\/\//i.test(v) && urlsIn(text).includes(v.replace(/[.,;:!?]+$/, '')) ? v.replace(/[.,;:!?]+$/, '') : '';
};

const line = (text, re) => String(text || '').match(re)?.[1]?.trim().replace(/\s+/g, ' ') || '';

const EXTRACT_PROMPT = `You extract job postings for an Indian job portal from the text of one job advert (company careers page, WhatsApp/X/LinkedIn/Facebook/Instagram post, newspaper ad or email).
Use ONLY facts written in the text. Never guess, infer, translate or invent. Copy every value verbatim from the text. Use null when a value is not written.
If the text advertises several different jobs, return one entry per job. If it is not a job advert, return {"jobs": []}.
Return JSON: {"jobs": [{"title": string, "company": string|null, "location": string|null (city/state as written), "address": string|null,
"education": string|null, "experience": string|null, "salary": string|null, "employment_type": string|null, "last_date": string|null,
"email": string|null, "phone": string|null, "apply_url": string|null, "company_website": string|null,
"description": string|null (verbatim sentences about this job, max 1500 characters), "is_closed": boolean}]}`;

async function aiDrafts(text) {
  const r = await llmJson(EXTRACT_PROMPT, text.slice(0, 14000), { maxTokens: 2500 });
  return (Array.isArray(r?.jobs) ? r.jobs : []).slice(0, 20).map((j) => {
    const g = (k) => grounded(j?.[k], text);
    const phone = g('phone');
    return {
      title: g('title'),
      companyName: g('company'),
      location: g('location'),
      address: g('address'),
      educationText: g('education'),
      experienceText: g('experience'),
      salary: g('salary'),
      employmentType: g('employment_type'),
      lastDate: g('last_date'),
      emails: extractEmails(g('email')),
      phones: phone ? extractPhones(phone) : [],
      applyUrl: groundedUrl(j?.apply_url, text),
      companyWebsite: groundedUrl(j?.company_website, text),
      description: g('description'),
      closed: j?.is_closed === true,
    };
  });
}

function ruleDraft(text) {
  const contacts = extractContacts(text);
  const title =
    line(text, /\b(?:job title|position|post|role|designation|vacancy for|hiring for|requirement for|wanted)\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 /&+.,()-]{2,70}?)(?:\n|$|\s+[-–|]\s)/i) ||
    line(text, /\bwe(?:'re| are) hiring\s*(?:for)?\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 /&+.()-]{2,70}?)(?:\n|$|[!.])/i);
  return {
    title,
    companyName: line(text, /\b(?:company|organi[sz]ation|employer|company name)\s*[:\-–]\s*([^\n]{2,80})/i),
    location: line(text, /\b(?:location|job location|place of work|city)\s*[:\-–]\s*([^\n]{2,80})/i),
    address: line(text, /\b(?:address|office address|venue|walk[- ]?in (?:venue|address))\s*[:\-–]\s*([^\n]{5,200})/i),
    educationText: line(text, /\b(?:qualification|education|eligibility)\s*[:\-–]\s*([^\n]{2,160})/i),
    experienceText: line(text, /\bexperience\s*[:\-–]\s*([^\n]{1,60})/i),
    salary: line(text, /\b(?:salary|ctc|stipend|pay|package)\s*[:\-–]\s*([^\n]{2,80})/i),
    employmentType: line(text, /\b(?:job type|employment type)\s*[:\-–]\s*([^\n]{2,40})/i) || line(text, /\b(full[- ]time|part[- ]time|internship|contract|work from home)\b/i),
    lastDate: line(text, /\b(?:last date(?: to apply)?|apply by|apply before|deadline|closing date)\s*[:\-–]?\s*([^\n]{4,40})/i),
    emails: contacts.emails,
    phones: contacts.phones,
    applyUrl: line(text, /\b(?:apply(?: here| now| link| at)?|link)\s*[:\-–]?\s*(https?:\/\/\S+)/i).replace(/[.,;:!?]+$/, ''),
    companyWebsite: line(text, /\b(?:website|site|web)\s*[:\-–]\s*(https?:\/\/\S+)/i).replace(/[.,;:!?]+$/, ''),
    description: text.trim().slice(0, 4000),
    closed: CLOSED_RE.test(text.slice(0, 4000)),
  };
}

function ldDraft(ld) {
  return {
    title: ld.title,
    companyName: ld.companyName,
    location: ld.address,
    address: ld.address,
    educationText: ld.educationText,
    experienceText: ld.experienceText,
    salary: ld.salary,
    employmentType: ld.employmentType,
    lastDate: ld.validThrough,
    emails: extractEmails(ld.email),
    phones: extractPhones(ld.telephone),
    applyUrl: '',
    companyWebsite: /^https?:\/\//.test(ld.companyWebsite || '') ? ld.companyWebsite : '',
    description: ld.description,
    closed: false,
  };
}

export function toPortalDraft(d, { sourceText = '', sourceUrl = '', single = false } = {}) {
  const loc = splitLocation(d.location || d.address);
  const context = single ? sourceText : d.description;
  const exp = detectExperience(d.experienceText, d.title, context);
  const category = detectCategory(`${d.title} ${String(d.description || '').slice(0, 400)}`);
  return {
    title: String(d.title || '').slice(0, 140),
    companyName: String(d.companyName || '').slice(0, 120),
    category: CATEGORY_KEYS.includes(category) ? category : '',
    level: exp.level || '',
    experienceText: String(d.experienceText || exp.text || '').slice(0, 60),
    education: detectEducation(d.educationText, context).slice(0, 8),
    educationText: String(d.educationText || '').slice(0, 200),
    description: String(d.description || '').slice(0, 8000),
    city: loc.city.slice(0, 60),
    state: loc.state,
    address: String(d.address || '').slice(0, 300),
    email: uniqueEmails(d.emails)[0] || '',
    phone: uniquePhones(d.phones)[0] || '',
    companyWebsite: d.companyWebsite || '',
    applyUrl: d.applyUrl || (single ? sourceUrl : ''),
    sourceUrl,
    salary: String(d.salary || '').slice(0, 80),
    employmentType: String(d.employmentType || '').slice(0, 40),
    validThrough: parseDeadline(d.lastDate),
    closed: Boolean(d.closed) || Boolean(parseDeadline(d.lastDate) && new Date(parseDeadline(d.lastDate)).getTime() < Date.now() - 86400_000),
  };
}

export const REQUIRED_FIELDS = ['title', 'companyName', 'category'];

export async function extractJobDrafts({ text = '', url = '' }) {
  const parts = [text.trim()];
  let ld = null;
  let method = 'rules';
  if (url) {
    if (!fetchable(url)) {
      if (!parts[0]) throw Object.assign(new Error('This site does not allow automatic reading. Copy the post text and paste it here instead.'), { status: 422 });
    } else {
      try {
        const page = await fetchJobPage(url);
        ld = page.ld;
        parts.push([page.title, page.text, ...page.mailto, ...page.tel].filter(Boolean).join('\n'));
      } catch (err) {
        if (!parts[0]) throw Object.assign(new Error(`Could not read that page (${err.response?.status || err.code || 'network error'}). Paste the job text instead.`), { status: 422 });
      }
    }
  }
  const sourceText = parts.filter(Boolean).join('\n\n');
  if (sourceText.length < 30) throw Object.assign(new Error('Paste the full job post text (at least a few lines) or a job page link.'), { status: 422 });

  let raw = [];
  if (ld?.title) {
    raw = [ldDraft(ld)];
    method = 'json_ld';
  } else if (llmEnabled()) {
    try {
      raw = await aiDrafts(sourceText);
      method = 'ai_agent';
    } catch {
      raw = [];
    }
  }
  if (!raw.length) {
    raw = [ruleDraft(sourceText)];
    method = method === 'ai_agent' ? 'ai_agent_empty' : 'rules';
  }

  const single = raw.length === 1;
  const drafts = dedupeJobs(raw.filter((d) => d.title).map((d) => toPortalDraft(d, { sourceText, sourceUrl: url, single }))).map(({ applyOptions: _a, emails: _e, phones: _p, ...d }) => ({
    ...d,
    missing: REQUIRED_FIELDS.filter((k) => !d[k]),
  }));
  if (!drafts.length) drafts.push({ ...toPortalDraft(raw[0] || {}, { sourceText, sourceUrl: url, single: true }), missing: REQUIRED_FIELDS });
  return { method, drafts };
}

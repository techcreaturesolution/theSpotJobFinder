import { llmEnabled, llmJson } from '../agent/llm.js';
import { detectEducation } from './education.js';
import { extractPhones } from './parse.js';

export const CLOSED_RE =
  /\b(no longer accepting applications|(this )?job (has )?(expired|closed)|this (job|position|vacancy) is (closed|no longer (available|active|open))|position (has been )?filled|vacancy (is )?closed|applications? (are |is )?(now )?closed|job not found|page not found)\b/i;

const words = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2);

export function titleMatches(title, text) {
  const want = [...new Set(words(title))];
  if (!want.length) return false;
  const have = new Set(words(text));
  return want.filter((w) => have.has(w)).length / want.length >= 0.6;
}

const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9₹]+/g, '');

export function grounded(value, pageText) {
  if (!value) return '';
  const v = String(value).trim();
  const needle = squash(v);
  return needle.length >= 2 && squash(pageText).includes(needle) ? v : '';
}

const AGENT_PROMPT = `You are a strict job-posting fact checker for Indian job listings.
You receive the visible text of one web page. Use ONLY facts written in that text. Never guess, infer or invent.
Copy values verbatim from the page. Use null for anything that is not explicitly written.
Return JSON:
{"is_job_posting": boolean (true only if the page advertises one specific open job),
 "is_closed": boolean (true if the page says the job is expired, closed, filled or no longer accepting applications),
 "title": string|null, "company": string|null, "location": string|null, "address": string|null,
 "education": string|null (qualification requirement, verbatim), "experience": string|null, "salary": string|null,
 "employment_type": string|null, "last_date": string|null (application deadline, verbatim),
 "email": string|null, "phone": string|null}`;

export async function agentExtract(pageText) {
  if (!llmEnabled() || !pageText || pageText.length < 200) return null;
  const text = pageText.slice(0, 12000);
  const r = await llmJson(AGENT_PROMPT, text, { maxTokens: 500 });
  if (!r) return null;
  const g = (k) => grounded(r[k], text);
  const education = g('education');
  const phone = g('phone');
  return {
    isJobPosting: r.is_job_posting === true,
    isClosed: r.is_closed === true,
    title: g('title'),
    companyName: g('company'),
    location: g('location'),
    address: g('address'),
    educationText: education,
    education: detectEducation(education),
    experienceText: g('experience'),
    salary: g('salary'),
    employmentType: g('employment_type'),
    lastDate: g('last_date'),
    email: g('email'),
    phones: phone ? extractPhones(phone) : [],
  };
}

export function verification(status, method) {
  return { status, method, checkedAt: new Date() };
}

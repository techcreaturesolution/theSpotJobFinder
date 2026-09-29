import pLimit from 'p-limit';
import { env } from '../../config/env.js';
import { JobPosting } from '../../models/JobPosting.js';
import { sleep } from '../../utils/http.js';
import { llmEnabled, llmJson } from '../agent/llm.js';
import { categoryByKey, detectCategory } from './categories.js';
import { detectEducation, educationByKey, educationMatches, qualifyingKeys } from './education.js';
import { enrichJob } from './enrich.js';
import { splitLocation } from './india.js';
import { detectExperience, extractContacts, jobKey, parseJobPrompt, parsePostedAt, platformOf } from './parse.js';
import { jobProviders, searchGoogleJobs, searchWebJobs } from './providers.js';
import { verification } from './verify.js';

const DAY = 86400_000;
const MAX_RESULTS = 60;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function planJobQuery({ prompt = '', level, category, education = '', state = '', city = '' }) {
  const parsed = parseJobPrompt(prompt);
  let userRole = parsed.role;
  let planner = 'rules';
  if (llmEnabled() && prompt.trim()) {
    try {
      const r = await llmJson(
        'You turn an Indian job seeker\'s request into JSON: {"role": "<job title or keywords, max 6 words, English>"}. Do not include locations, experience level, education or filler words.',
        prompt,
        { maxTokens: 60 },
      );
      if (r?.role) {
        userRole = String(r.role).slice(0, 80);
        planner = 'openai';
      }
    } catch {
      /* fall back to rules */
    }
  }
  const cat = categoryByKey(category);
  const role = userRole || cat?.query || '';
  const cityName = city || (!state ? parsed.location : '');
  const place = [cityName, state].filter(Boolean).join(', ') || 'India';
  const levelWord = level === 'fresher' ? 'fresher' : level === 'experienced' ? 'experienced' : '';
  const edu = educationByKey(education || parsed.education);
  const eduWord = edu?.query && !new RegExp(`\\b${escapeRe(edu.query)}\\b`, 'i').test(role) ? edu.query : '';
  return {
    role,
    userRole,
    level,
    levelWord,
    category: cat?.key || '',
    education: edu?.key || '',
    eduWord,
    city: cityName,
    state,
    place,
    planner,
    q: `${role} ${eduWord} ${levelWord} jobs in ${place}`.replace(/\s+/g, ' ').trim(),
  };
}

function normalize(raw, plan) {
  const highlightText = (raw.highlights || []).flatMap((h) => h.items || []).join('\n');
  const exp = detectExperience(raw.title, highlightText, raw.description);
  const loc = splitLocation(raw.location || raw.address);
  const city = loc.city || (plan.city && String(raw.location || '').toLowerCase().includes(plan.city.toLowerCase()) ? plan.city : '');
  const contacts = extractContacts(raw.description, highlightText);
  return {
    ...raw,
    key: jobKey(raw),
    level: raw.level ?? exp.level,
    experienceText: raw.experienceText || exp.text,
    education: raw.education?.length ? raw.education : detectEducation(raw.title, highlightText, raw.description),
    verification: raw.verification || (raw.provider === 'google_jobs' ? verification('verified', 'google_jobs') : verification('unverified', 'search_result')),
    category: plan.category || detectCategory(`${raw.title} ${String(raw.description || '').slice(0, 300)}`) || '',
    postedAt: raw.postedAt || parsePostedAt(raw.postedText),
    city,
    state: loc.state || (city && city === plan.city ? plan.state : ''),
    platform: raw.platform || platformOf(raw.applyUrl),
    emails: [...new Set([...(raw.emails || []), ...contacts.emails])],
    phones: [...new Set([...(raw.phones || []), ...contacts.phones])],
  };
}

function keep(job, plan, postedWithin) {
  if (plan.level && job.level && job.level !== plan.level) return false;
  if (!educationMatches(plan.education, job.education)) return false;
  if (job.validThrough && new Date(job.validThrough).getTime() < Date.now()) return false;
  if (postedWithin && job.postedAt && new Date(job.postedAt).getTime() < Date.now() - postedWithin * DAY) return false;
  return Boolean(job.title);
}

export function dbFilter(plan, postedWithin) {
  const and = [
    { active: true },
    { $or: [{ origin: 'portal' }, { lastSeenAt: { $gte: new Date(Date.now() - 21 * DAY) } }] },
    { $or: [{ validThrough: null }, { validThrough: { $gte: new Date() } }] },
  ];
  if (plan.category) and.push({ category: plan.category });
  if (plan.level) and.push({ level: { $in: [plan.level, null] } });
  if (plan.education) and.push({ $or: [{ education: { $exists: false } }, { education: { $size: 0 } }, { education: { $in: qualifyingKeys(plan.education) } }] });
  const locRe = (v) => new RegExp(`\\b${escapeRe(v)}\\b`, 'i');
  if (plan.city) and.push({ $or: [{ city: locRe(plan.city) }, { location: locRe(plan.city) }, { address: locRe(plan.city) }] });
  else if (plan.state) and.push({ $or: [{ state: locRe(plan.state) }, { location: locRe(plan.state) }, { address: locRe(plan.state) }] });
  if (postedWithin) {
    const since = new Date(Date.now() - postedWithin * DAY);
    and.push({ $or: [{ postedAt: { $gte: since } }, { postedAt: null, createdAt: { $gte: since } }] });
  }
  const filter = { $and: and };
  if (plan.userRole) filter.$text = { $search: plan.userRole };
  return filter;
}

async function searchDb(plan, postedWithin) {
  const filter = dbFilter(plan, postedWithin);
  const q = JobPosting.find(filter).limit(40).lean();
  if (filter.$text) q.sort({ score: { $meta: 'textScore' } });
  else q.sort({ postedAt: -1, createdAt: -1 });
  return q;
}

const withDeadline = (promise, deadline, fallback) => Promise.race([promise, sleep(Math.max(0, deadline - Date.now())).then(() => fallback)]);

const UNSTORED = new Set(['_id', 'key', 'origin', 'createdAt', 'updatedAt', 'applyClicks', 'provider', '__v']);
const ENRICHED_FIELDS = ['education', 'educationText', 'verification', 'emails', 'phones', 'address', 'companyWebsite', 'enrichedAt', 'logo', 'salary', 'employmentType', 'experienceText', 'level', 'validThrough'];

function rank(job, plan) {
  const t = job.postedAt ? new Date(job.postedAt).getTime() : 0;
  const contact = (job.emails?.length ? 1 : 0) + (job.phones?.length ? 1 : 0) + (job.applyUrl ? 1 : 0);
  const verified = job.verification?.status === 'verified' ? 4 : 0;
  const edu = plan.education && job.education?.length ? 3 : 0;
  return t / DAY + contact * 2 + verified + edu + (job.origin === 'portal' ? 3 : 0);
}

export async function searchJobs(input, log = () => {}) {
  const started = Date.now();
  const deadline = started + env.jobSearchBudgetMs;
  const plan = await planJobQuery(input);
  const available = jobProviders();
  const providers = ['portal'];
  if (available.googleJobs) providers.push('google_jobs');
  if (available.webSearch) providers.push(`web:${available.webSearch}`);

  const [google, web, db] = await Promise.allSettled([
    withDeadline(searchGoogleJobs(plan.q, 30), deadline - 15000, []),
    withDeadline(searchWebJobs(plan, 10, log), deadline - 15000, []),
    searchDb(plan, input.postedWithin),
  ]);
  if (google.status === 'rejected') log('warn', `Google Jobs failed: ${google.reason?.message}`);
  if (db.status === 'rejected') log('warn', `DB search failed: ${db.reason?.message}`);

  const byKey = new Map();
  for (const doc of db.status === 'fulfilled' ? db.value : []) byKey.set(doc.key, doc);

  const fresh = new Map();
  const raw = [...(google.status === 'fulfilled' ? google.value : []), ...(web.status === 'fulfilled' ? web.value : [])];
  for (const r of raw) {
    const job = normalize(r, plan);
    if (!keep(job, plan, input.postedWithin)) continue;
    const prev = fresh.get(job.key);
    if (prev) {
      const links = new Set(prev.applyOptions.map((o) => o.link));
      prev.applyOptions.push(...(job.applyOptions || []).filter((o) => !links.has(o.link)));
      continue;
    }
    fresh.set(job.key, { ...job, applyOptions: job.applyOptions || [] });
  }

  const existing = fresh.size ? await JobPosting.find({ key: { $in: [...fresh.keys()] } }).lean() : [];
  const existingByKey = new Map(existing.map((d) => [d.key, d]));
  for (const [key, job] of fresh) {
    const prev = existingByKey.get(key);
    if (prev?.origin === 'portal') {
      fresh.delete(key);
      byKey.set(key, prev);
      continue;
    }
    if (prev?.verification?.status === 'verified' && job.verification?.status !== 'verified') job.verification = prev.verification;
    if (prev?.enrichedAt && Date.now() - new Date(prev.enrichedAt).getTime() < 7 * DAY) {
      for (const f of ENRICHED_FIELDS) if (prev[f] && (!job[f] || (Array.isArray(job[f]) && !job[f].length))) job[f] = prev[f];
    }
    byKey.delete(key);
  }

  const toEnrich = [...fresh.values()]
    .filter((j) => !j.enrichedAt)
    .sort((a, b) => Number(a.verification?.status === 'verified') - Number(b.verification?.status === 'verified'))
    .slice(0, env.jobEnrichLimit);
  const limit = pLimit(4);
  const expired = new Set();
  await Promise.all(
    toEnrich.map((job) =>
      limit(async () => {
        if (Date.now() > deadline - 3000) return;
        const enriched = await withDeadline(enrichJob(job, plan.place).catch(() => job), deadline - 1000, job);
        if (enriched.expired || !educationMatches(plan.education, enriched.education)) expired.add(job.key);
        fresh.set(job.key, { ...enriched, key: job.key });
      }),
    ),
  );

  const now = new Date();
  if (fresh.size) {
    await JobPosting.bulkWrite(
      [...fresh.values()].map((j) => {
        const fields = Object.fromEntries(Object.entries(j).filter(([k]) => !UNSTORED.has(k)));
        return { updateOne: { filter: { key: j.key }, update: { $set: { ...fields, active: !j.expired, lastSeenAt: now }, $setOnInsert: { origin: 'aggregated' } }, upsert: true } };
      }),
      { ordered: false },
    );
  }

  const keys = [...byKey.keys(), ...fresh.keys()].filter((k) => !expired.has(k));
  const filter = { key: { $in: keys }, active: true, ...(input.verifiedOnly ? { 'verification.status': 'verified' } : {}) };
  const docs = keys.length ? await JobPosting.find(filter).select('-key -postedBy -__v').lean() : [];
  docs.sort((a, b) => rank(b, plan) - rank(a, plan));
  const hidden = input.verifiedOnly ? keys.length - docs.length : 0;
  return { plan, providers, items: docs.slice(0, MAX_RESULTS), hiddenUnverified: Math.max(0, hidden), durationMs: Date.now() - started };
}

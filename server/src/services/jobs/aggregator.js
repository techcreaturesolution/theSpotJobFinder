import pLimit from 'p-limit';
import { env } from '../../config/env.js';
import { JobPosting } from '../../models/JobPosting.js';
import { sleep } from '../../utils/http.js';
import { llmEnabled, llmJson } from '../agent/llm.js';
import { categoryByKey, detectCategory } from './categories.js';
import { detectEducation, educationByKey, educationMatches, qualifyingKeys } from './education.js';
import { dedupeJobs, identityKey, uniqueEmails, uniqueLinks, uniquePhones } from './dedupe.js';
import { enrichJob, sourceStillOpen } from './enrich.js';
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
    applyOptions: uniqueLinks(raw.applyOptions),
    emails: uniqueEmails([...(raw.emails || []), ...contacts.emails]),
    phones: uniquePhones([...(raw.phones || []), ...contacts.phones]),
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
  const recheck = new Map();
  for (const doc of db.status === 'fulfilled' ? db.value : []) {
    if (doc.origin === 'portal') byKey.set(doc.key, doc);
    else recheck.set(doc.key, doc);
  }

  const fresh = new Map();
  const raw = [...(google.status === 'fulfilled' ? google.value : []), ...(web.status === 'fulfilled' ? web.value : [])];
  for (const r of raw) {
    const job = normalize(r, plan);
    if (!keep(job, plan, input.postedWithin)) continue;
    const prev = fresh.get(job.key);
    if (prev) {
      prev.applyOptions = uniqueLinks([...prev.applyOptions, ...(job.applyOptions || [])]);
      prev.emails = uniqueEmails([...prev.emails, ...job.emails]);
      prev.phones = uniquePhones([...prev.phones, ...job.phones]);
      continue;
    }
    fresh.set(job.key, { ...job, applyOptions: job.applyOptions || [] });
  }

  const existing = fresh.size ? await JobPosting.find({ key: { $in: [...fresh.keys()] } }).lean() : [];
  const existingByKey = new Map(existing.map((d) => [d.key, d]));
  for (const [key, job] of fresh) {
    const prev = existingByKey.get(key);
    recheck.delete(key);
    if (prev?.origin === 'portal') {
      fresh.delete(key);
      byKey.set(key, prev);
      continue;
    }
    if (prev) for (const f of ENRICHED_FIELDS) if (f !== 'verification' && prev[f] && (!job[f] || (Array.isArray(job[f]) && !job[f].length))) job[f] = prev[f];
  }
  // Stored listings found only in our DB must pass a fresh source check on every search too.
  for (const [key, doc] of recheck) {
    const job = Object.fromEntries(Object.entries(doc).filter(([k]) => !UNSTORED.has(k) || k === 'key'));
    fresh.set(key, { ...job, verification: verification('unverified', 'search_result') });
  }

  const unverifiedFirst = (a, b) => Number(a.verification?.status === 'verified') - Number(b.verification?.status === 'verified');
  const toEnrich = [...fresh.values()].sort(unverifiedFirst).slice(0, env.jobEnrichLimit);
  const limit = pLimit(4);
  const expired = new Set();
  const rechecked = new Set();
  const portalSources = [...byKey.values()].filter((d) => d.importMethod && d.sourceUrl).slice(0, env.jobEnrichLimit);
  const closedPortal = [];
  await Promise.all([
    ...portalSources.map((doc) =>
      limit(async () => {
        if (Date.now() > deadline - 3000) return;
        const open = await withDeadline(sourceStillOpen(doc.sourceUrl), deadline - 1000, null);
        if (open === false) {
          closedPortal.push(doc._id);
          byKey.delete(doc.key);
        }
      }),
    ),
    ...toEnrich.map((job) =>
      limit(async () => {
        if (Date.now() > deadline - 3000) return;
        const enriched = await withDeadline(
          enrichJob(job, plan.place).catch(() => null),
          deadline - 1000,
          null,
        );
        if (!enriched) return;
        rechecked.add(job.key);
        if (enriched.expired || !educationMatches(plan.education, enriched.education)) expired.add(job.key);
        fresh.set(job.key, { ...enriched, key: job.key });
      }),
    ),
  ]);
  if (closedPortal.length) await JobPosting.updateMany({ _id: { $in: closedPortal } }, { $set: { active: false, 'verification.checkedAt': new Date() } });

  const now = new Date();
  if (fresh.size) {
    await JobPosting.bulkWrite(
      [...fresh.values()].map((j) => {
        const fields = Object.fromEntries(Object.entries(j).filter(([k]) => !UNSTORED.has(k)));
        fields.dedupeKey = identityKey(j) || j.key;
        fields.applyOptions = uniqueLinks(fields.applyOptions);
        fields.emails = uniqueEmails(fields.emails);
        fields.phones = uniquePhones(fields.phones);
        const dbOnly = recheck.has(j.key);
        if (dbOnly && !rechecked.has(j.key)) fields.verification = verification('unverified', 'not_rechecked');
        return { updateOne: { filter: { key: j.key }, update: { $set: { ...fields, active: !j.expired, ...(dbOnly ? {} : { lastSeenAt: now }) }, $setOnInsert: { origin: 'aggregated' } }, upsert: true } };
      }),
      { ordered: false },
    );
  }

  // A listing counts as verified in this search only if it was confirmed in this search.
  const confirmed = (d) =>
    d.origin === 'portal' || rechecked.has(d.key) || (fresh.get(d.key)?.verification?.status === 'verified' && !recheck.has(d.key));
  const keys = [...byKey.keys(), ...fresh.keys()].filter((k) => !expired.has(k));
  const docs = keys.length ? await JobPosting.find({ key: { $in: keys }, active: true }).select('-postedBy -__v').lean() : [];
  const portalIds = docs.filter((d) => d.origin === 'portal').map((d) => d._id);
  if (portalIds.length) await JobPosting.updateMany({ _id: { $in: portalIds } }, { $set: { 'verification.checkedAt': now } });
  const current = docs.map((d) => {
    if (!confirmed(d)) return { ...d, verification: verification('unverified', 'not_rechecked') };
    return d.origin === 'portal' ? { ...d, verification: { ...d.verification, checkedAt: now } } : d;
  });
  const unique = dedupeJobs(current, (j) => rank(j, plan));
  const shown = input.verifiedOnly ? unique.filter((d) => d.verification?.status === 'verified') : unique;
  const hidden = unique.length - shown.length;
  const items = shown.slice(0, MAX_RESULTS).map(({ key: _key, ...d }) => d);
  return { plan, providers, items, hiddenUnverified: hidden, durationMs: Date.now() - started };
}

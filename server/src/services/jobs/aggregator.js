import pLimit from 'p-limit';
import { env } from '../../config/env.js';
import { JobPosting } from '../../models/JobPosting.js';
import { sleep } from '../../utils/http.js';
import { llmEnabled, llmJson } from '../agent/llm.js';
import { categoryByKey, detectCategory, matchesCategory } from './categories.js';
import { detectEducation, educationByKey, educationMatches, qualifyingKeys } from './education.js';
import { dedupeJobs, identityKey, uniqueEmails, uniqueLinks, uniquePhones } from './dedupe.js';
import { enrichJob, sourceStillOpen } from './enrich.js';
import { matchesLocation, splitLocation, stateOfCity } from './india.js';
import { detectExperience, extractContacts, jobKey, parseJobPrompt, parsePostedAt, parseResultTitle, platformOf, stripHtml } from './parse.js';
import { googleJobsQueries, jobProviders, searchGoogleJobs, searchWebJobs } from './providers.js';
import { searchApifyLinkedIn } from './apifyLinkedIn.js';
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
  const cleanDesc = stripHtml(raw.description || '');
  const exp = detectExperience(raw.title, highlightText, cleanDesc);
  const loc = splitLocation(raw.location || raw.address);
  const city = loc.city || (plan.city && String(raw.location || '').toLowerCase().includes(plan.city.toLowerCase()) ? plan.city : '');
  const state = loc.state || (city ? stateOfCity(city) : '') || plan.state || '';
  const contacts = extractContacts(cleanDesc, highlightText);
  const parsedTitle = parseResultTitle(raw.title);
  const companyName = raw.companyName || parsedTitle.companyName || '';
  const detectedCat = detectCategory(`${raw.title} ${cleanDesc.slice(0, 500)}`);
  return {
    ...raw,
    description: cleanDesc,
    companyName,
    key: jobKey(raw),
    level: raw.level ?? exp.level,
    experienceText: raw.experienceText || exp.text,
    education: raw.education?.length ? raw.education : detectEducation(raw.title, highlightText, cleanDesc),
    verification: raw.verification || (raw.provider === 'google_jobs' ? verification('verified', 'google_jobs') : verification('unverified', 'search_result')),
    category: raw.category || detectedCat || plan.category || '',
    postedAt: raw.postedAt || parsePostedAt(raw.postedText),
    city,
    state,
    companyLinkedinUrl: raw.companyLinkedinUrl,
    platform: raw.platform || platformOf(raw.applyUrl, companyName),
    applyOptions: uniqueLinks(raw.applyOptions),
    emails: uniqueEmails([...(raw.emails || []), ...contacts.emails]),
    phones: uniquePhones([...(raw.phones || []), ...contacts.phones]),
  };
}

const ROLE_STOP_WORDS = new Set([
  'job', 'jobs', 'vacancy', 'vacancies', 'opening', 'openings', 'hiring',
  'fresher', 'freshers', 'experienced', 'experience', 'entry', 'level',
  'full', 'part', 'time', 'urgent', 'urgently', 'wanted', 'need', 'needed',
  'for', 'in', 'at', 'with', 'and', 'or', 'to', 'a', 'an', 'the',
]);

const GENERIC_DESIGNATION_WORDS = new Set([
  'developer', 'developers', 'engineer', 'engineers', 'programmer', 'programmers',
  'executive', 'executives', 'officer', 'officers', 'specialist', 'specialists',
  'consultant', 'consultants', 'associate', 'associates', 'analyst', 'analysts',
  'manager', 'managers', 'lead', 'leads', 'worker', 'workers', 'staff',
  'assistant', 'assistants', 'expert', 'experts', 'operator', 'operators',
  'intern', 'interns', 'internship', 'trainee', 'trainees',
]);

const TECH_DOMAINS = [
  'backend', 'back-end', 'frontend', 'front-end', 'full stack', 'fullstack',
  'java', 'react', 'python', 'php', 'flutter', 'angular', 'vue', 'node', 'nodejs',
  'android', 'ios', 'swift', 'kotlin', 'c++', 'c#', '.net', 'dotnet', 'golang',
  'ruby', 'rails', 'mern', 'mean', 'nextjs', 'next.js', 'django', 'laravel',
  'wordpress', 'shopify', 'salesforce', 'sap', 'devops', 'aws', 'azure',
  'qa', 'tester', 'selenium', 'telecaller', 'tally', 'graphic', 'ui/ux', 'seo',
  'data entry', 'content writer',
];

const CONFLICTING_TRACKS = [
  {
    target: /\b(?:backend|back-end)\b/i,
    conflicts: [/\b(?:frontend|front-end|ui[\s/-]?ux|graphic|react[\s/-]?js developer|angular developer|vue developer)\b/i],
    allowIfTitleAlsoHas: /\b(?:full[\s-]?stack|mern|mean|backend|back-end)\b/i,
  },
  {
    target: /\b(?:frontend|front-end)\b/i,
    conflicts: [/\b(?:backend|back-end|database admin|devops|system admin)\b/i],
    allowIfTitleAlsoHas: /\b(?:full[\s-]?stack|mern|mean|frontend|front-end)\b/i,
  },
];

export function roleMatches(job, userRole) {
  if (!userRole || !userRole.trim()) return true;

  const target = userRole.toLowerCase().trim();
  const title = String(job.title || '').toLowerCase().trim();
  const desc = String(job.description || '').slice(0, 1500).toLowerCase();

  // Enforce strict mutually exclusive role checks
  for (const track of CONFLICTING_TRACKS) {
    if (track.target.test(target)) {
      if (track.conflicts.some((c) => c.test(title)) && !track.allowIfTitleAlsoHas.test(title)) {
        return false;
      }
    }
  }

  // Find tech/domain tags present in the user search query
  const targetTechs = TECH_DOMAINS.filter((tech) => {
    if (tech === 'java') {
      return /\bjava\b/i.test(target) && !/\bjavascript\b/i.test(target);
    }
    return new RegExp(`\\b${escapeRe(tech)}\\b`, 'i').test(target);
  });

  if (targetTechs.length > 0) {
    // 1. Check if the job title contains the target technology
    const titleHasTargetTech = targetTechs.some((tech) => {
      if (tech === 'java') {
        return /\bjava\b/i.test(title) && !/\bjavascript\b/i.test(title);
      }
      return new RegExp(`\\b${escapeRe(tech)}\\b`, 'i').test(title);
    });

    if (titleHasTargetTech) return true;

    // 2. If title does NOT have target tech, check if it explicitly mentions a conflicting other tech
    const titleHasConflictingTech = TECH_DOMAINS.some((otherTech) => {
      if (targetTechs.includes(otherTech)) return false;
      if (otherTech === 'java') {
        return /\bjava\b/i.test(title) && !/\bjavascript\b/i.test(title);
      }
      return new RegExp(`\\b${escapeRe(otherTech)}\\b`, 'i').test(title);
    });

    // Conflicting tech (e.g. "React Developer" when user searched "Java developer" or "Backend developer") -> REJECT!
    if (titleHasConflictingTech) return false;

    // 3. If title is generic (e.g. "Software Engineer"), check if description mentions the target tech
    const descHasTargetTech = targetTechs.some((tech) => {
      if (tech === 'java') {
        return /\bjava\b/i.test(desc) && !/\bjavascript\b/i.test(desc);
      }
      // Ignore boilerplate mentions like "collaborate with backend team"
      const boilerplate = new RegExp(`(?:collaborate|interface|coordinate|liaise|work|communicate)\\s+with\\s+(?:our\\s+)?(?:the\\s+)?${escapeRe(tech)}`, 'i');
      if (boilerplate.test(desc)) return false;
      return new RegExp(`\\b${escapeRe(tech)}\\b`, 'i').test(desc);
    });

    return descHasTargetTech;
  }

  // Tokenize user query
  const tokens = target
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !ROLE_STOP_WORDS.has(w));

  if (!tokens.length) return true;

  const nonGenericTokens = tokens.filter((w) => !GENERIC_DESIGNATION_WORDS.has(w));

  if (nonGenericTokens.length > 0) {
    const inTitle = nonGenericTokens.some((tok) => new RegExp(`\\b${escapeRe(tok)}\\b`, 'i').test(title));
    if (inTitle) return true;

    // Only allow description fallback if the title is generic (does not contain an opposing role)
    const isGenericTitle = Array.from(GENERIC_DESIGNATION_WORDS).some((g) => new RegExp(`\\b${g}\\b`, 'i').test(title));
    if (!isGenericTitle) return false;

    const allInDesc = nonGenericTokens.every((tok) => {
      const boilerplate = new RegExp(`(?:collaborate|interface|coordinate|liaise|work|communicate)\\s+with\\s+(?:our\\s+)?(?:the\\s+)?${escapeRe(tok)}`, 'i');
      if (boilerplate.test(desc)) return false;
      return new RegExp(`\\b${escapeRe(tok)}\\b`, 'i').test(desc);
    });
    return allInDesc;
  }

  return tokens.some((tok) => new RegExp(`\\b${escapeRe(tok)}\\b`, 'i').test(title));
}

export function getEffectiveJobDate(job) {
  if (job.postedAt) {
    const d = new Date(job.postedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (job.postedText) {
    const d = parsePostedAt(job.postedText);
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  if (job.createdAt) {
    const d = new Date(job.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function keep(job, plan, postedWithin) {
  // Experience level strict check:
  // If user searched for 'fresher', exclude jobs that explicitly require 1+ or more years of experience (allow 0-1, 0-2 yrs or fresher)
  const requiresExperience = (job.experienceText || '').match(/\b([1-9]|\d{2,})\+?\s*years?\b/i);
  const minZero = /\b0\s*(?:-|–|to)\s*[12]\s*years?\b/i.test(job.experienceText || '');
  if (plan.level === 'fresher') {
    if (job.level === 'experienced') return false;
    if (requiresExperience && !minZero) return false;
  }
  if (plan.level && job.level && job.level !== plan.level) return false;

  // Education strict check:
  if (!educationMatches(plan.education, job.education)) return false;
  if (job.validThrough && new Date(job.validThrough).getTime() < Date.now()) return false;

  // Location strict check (City & State):
  if (!matchesLocation(job, plan)) return false;

  // Category strict check:
  if (!matchesCategory(job, plan.category)) return false;

  // Strict Posted Within (date range) check:
  if (postedWithin && postedWithin > 0) {
    const postDate = getEffectiveJobDate(job);
    const textAge = String(job.postedText || '').toLowerCase().trim();

    // 1. Text-based relative age filtering
    if (textAge) {
      if (/years?\s*ago|\b\d+\s*y\s*ago/i.test(textAge)) return false;

      const monthsMatch = textAge.match(/(\d+)\+?\s*(?:months?|mo)\s*ago/i);
      if (monthsMatch) {
        const m = Number(monthsMatch[1]);
        if (m * 30 > postedWithin + (postedWithin >= 30 ? 2 : 0)) return false;
      }

      const weeksMatch = textAge.match(/(\d+)\+?\s*(?:weeks?|w)\s*ago/i);
      if (weeksMatch) {
        const w = Number(weeksMatch[1]);
        if (w * 7 > postedWithin + (postedWithin >= 7 ? 1 : 0)) return false;
      }

      const daysMatch = textAge.match(/(\d+)\+?\s*(?:days?|d)\s*ago/i);
      if (daysMatch) {
        const d = Number(daysMatch[1]);
        if (d > postedWithin + (postedWithin === 1 ? 0.5 : 0)) return false;
      }
    }

    // 2. Parsed Date timestamp check with boundary margin
    if (postDate) {
      const bufferDays = postedWithin === 1 ? 0.5 : postedWithin <= 7 ? 0.5 : 2;
      const cutoff = Date.now() - (postedWithin + bufferDays) * DAY;
      if (postDate.getTime() < cutoff) return false;
    }
  }

  if (plan.userRole && !roleMatches(job, plan.userRole)) return false;
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
  if (postedWithin && postedWithin > 0) {
    const bufferDays = postedWithin === 1 ? 0.5 : postedWithin <= 7 ? 0.5 : 2;
    const since = new Date(Date.now() - (postedWithin + bufferDays) * DAY);
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
const ENRICHED_FIELDS = ['companyName', 'education', 'educationText', 'verification', 'emails', 'phones', 'address', 'companyWebsite', 'companyLinkedinUrl', 'enrichedAt', 'logo', 'salary', 'employmentType', 'experienceText', 'level', 'validThrough'];

function rank(job, plan) {
  const t = job.postedAt ? new Date(job.postedAt).getTime() : 0;
  const contact = (job.emails?.length ? 1 : 0) + (job.phones?.length ? 1 : 0) + (job.applyUrl ? 1 : 0);
  const verified = job.verification?.status === 'verified' ? 4 : 0;
  const edu = plan.education && job.education?.length ? 3 : 0;
  const titleExact = plan.userRole && roleMatches(job, plan.userRole) ? 15 : 0;
  return t / DAY + contact * 2 + verified + edu + titleExact + (job.origin === 'portal' ? 3 : 0);
}

export async function searchJobs(input, log = () => {}) {
  const started = Date.now();
  const deadline = started + env.jobSearchBudgetMs;
  const plan = await planJobQuery(input);
  const available = jobProviders();
  const providers = ['portal'];
  if (available.googleJobs) providers.push('google_jobs');
  if (available.webSearch) providers.push(`web:${available.webSearch}`);
  if (available.linkedin) providers.push('linkedin_apify');

  const [google, web, linkedin, db] = await Promise.allSettled([
    withDeadline(
      searchGoogleJobs(googleJobsQueries(plan), 30, { place: plan.place, postedWithin: input.postedWithin, log }),
      deadline - 15000,
      [],
    ),
    withDeadline(searchWebJobs(plan, 10, log), deadline - 15000, []),
    withDeadline(searchApifyLinkedIn(plan, input, log), deadline - 10000, []),
    searchDb(plan, input.postedWithin),
  ]);
  if (google.status === 'rejected') log('warn', `Google Jobs failed: ${google.reason?.message}`);
  if (web.status === 'rejected') log('warn', `Web search failed: ${web.reason?.message}`);
  if (linkedin.status === 'rejected') log('warn', `LinkedIn Apify failed: ${linkedin.reason?.message}`);
  if (db.status === 'rejected') log('warn', `DB search failed: ${db.reason?.message}`);

  const byKey = new Map();
  const recheck = new Map();
  for (const doc of db.status === 'fulfilled' ? db.value : []) {
    if (!keep(doc, plan, input.postedWithin)) continue;
    if (doc.origin === 'portal') byKey.set(doc.key, doc);
    else recheck.set(doc.key, doc);
  }

  const fresh = new Map();
  const raw = [
    ...(google.status === 'fulfilled' ? google.value : []),
    ...(web.status === 'fulfilled' ? web.value : []),
    ...(linkedin.status === 'fulfilled' ? linkedin.value : []),
  ];
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

  const prioritizeEnrich = (a, b) => {
    const aMissing = !a.companyWebsite ? 1 : 0;
    const bMissing = !b.companyWebsite ? 1 : 0;
    if (aMissing !== bMissing) return bMissing - aMissing;
    return Number(a.verification?.status === 'verified') - Number(b.verification?.status === 'verified');
  };
  const toEnrich = [...fresh.values()].sort(prioritizeEnrich).slice(0, env.jobEnrichLimit);
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
    const cleanJob = { ...d, description: stripHtml(d.description || '') };
    if (!confirmed(d)) return { ...cleanJob, verification: verification('unverified', 'not_rechecked') };
    return d.origin === 'portal' ? { ...cleanJob, verification: { ...cleanJob.verification, checkedAt: now } } : cleanJob;
  });
  const unique = dedupeJobs(current, (j) => rank(j, plan));
  const strictlyMatching = unique.filter((d) => keep(d, plan, input.postedWithin));
  const shown = input.verifiedOnly ? strictlyMatching.filter((d) => d.verification?.status === 'verified') : strictlyMatching;
  const hidden = strictlyMatching.length - shown.length;
  const items = shown.slice(0, MAX_RESULTS).map(({ key: _key, ...d }) => d);
  return { plan, providers, items, hiddenUnverified: hidden, durationMs: Date.now() - started };
}

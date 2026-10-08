import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { JOB_LEVELS, JobPosting } from '../models/JobPosting.js';
import { isAdLocked, publicAdGate } from '../models/adGate.js';
import { JobSearch } from '../models/JobSearch.js';
import { llmEnabled } from '../services/agent/llm.js';
import { searchJobs } from '../services/jobs/aggregator.js';
import { dedupeJobs } from '../services/jobs/dedupe.js';
import { CATEGORY_KEYS, JOB_CATEGORIES } from '../services/jobs/categories.js';
import { EDUCATION_KEYS, EDUCATION_LEVELS } from '../services/jobs/education.js';
import { INDIAN_STATES } from '../services/jobs/india.js';
import { jobProviders } from '../services/jobs/providers.js';
import { AD_EVENTS, adGateInfo, newAdGate, recordAdEvent } from '../services/videoAd.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const searchLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });

export const POSTED_WITHIN = [1, 3, 7, 30, 0];

const searchSchema = z
  .object({
    prompt: z.string().trim().max(200).default(''),
    level: z.enum(JOB_LEVELS),
    category: z.union([z.enum(CATEGORY_KEYS), z.literal('')]).default(''),
    education: z.union([z.enum(EDUCATION_KEYS), z.literal('')]).default(''),
    verifiedOnly: z.boolean().default(true),
    state: z.string().trim().max(60).default(''),
    city: z.string().trim().max(60).default(''),
    postedWithin: z.coerce.number().refine((n) => POSTED_WITHIN.includes(n), 'Invalid posted-within value').default(30),
  })
  .refine((d) => d.prompt.length >= 2 || d.category, { message: 'Describe the job you want or pick a category', path: ['prompt'] });

router.get('/meta', (_req, res) => {
  res.json({
    categories: JOB_CATEGORIES.map(({ key, label }) => ({ key, label })),
    levels: JOB_LEVELS,
    education: EDUCATION_LEVELS.map(({ key, label }) => ({ key, label })),
    states: INDIAN_STATES,
    postedWithin: POSTED_WITHIN,
    providers: jobProviders(),
    ai: llmEnabled() ? 'openai' : 'rules',
    dailyLimit: env.dailyJobSearchLimit,
    videoAdSeconds: env.videoAd.seconds,
  });
});

function serializeSearch(doc) {
  const out = doc.toObject ? doc.toObject() : { ...doc };
  delete out.jobs;
  out.adGate = publicAdGate(doc);
  out.locked = isAdLocked(doc);
  return out;
}

async function runSearch(id, body) {
  try {
    const { plan, providers, items, hiddenUnverified, durationMs } = await searchJobs(body, (level, msg) => console.log(`[jobs] ${level}: ${msg}`));
    await JobSearch.updateOne(
      { _id: id },
      { $set: { status: 'completed', query: plan.q, planner: plan.planner, providers, resultCount: items.length, hiddenUnverified, durationMs, jobs: items.map((j) => j._id) } },
    );
  } catch (err) {
    console.error('[jobs] search failed', err);
    await JobSearch.updateOne({ _id: id }, { $set: { status: 'failed', error: err.message || 'The job search failed. Please try again.' } });
  }
}

async function ownSearch(req) {
  const search = await JobSearch.findOne({ _id: req.params.id, owner: req.user._id });
  if (!search) throw new HttpError(404, 'Search not found');
  return search;
}

router.post('/search', searchLimiter, async (req, res) => {
  const body = searchSchema.parse(req.body);
  if (req.user.role !== 'admin') {
    const today = await JobSearch.countDocuments({ owner: req.user._id, createdAt: { $gte: new Date(Date.now() - 86400_000) } });
    if (today >= env.dailyJobSearchLimit) throw new HttpError(429, `Daily job search limit (${env.dailyJobSearchLimit}) reached`);
  }
  const search = await JobSearch.create({ ...body, owner: req.user._id, query: body.prompt || body.category, adGate: newAdGate(req.user) });
  runSearch(search._id, body);
  res.status(201).json({ search: serializeSearch(search) });
});

router.get('/searches', async (req, res) => {
  const items = await JobSearch.find({ owner: req.user._id }).select('-jobs').sort({ createdAt: -1 }).limit(10);
  res.json({ items: items.map(serializeSearch) });
});

router.get('/searches/:id', async (req, res) => {
  const search = await ownSearch(req);
  let items = [];
  if (search.status === 'completed' && !isAdLocked(search) && search.jobs.length) {
    const docs = await JobPosting.find({ _id: { $in: search.jobs } }).select('-key -postedBy -__v').lean();
    const order = new Map(search.jobs.map((id, i) => [String(id), i]));
    items = dedupeJobs(docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))));
  }
  res.json({ search: serializeSearch(search), items });
});

router.get('/searches/:id/ad', async (req, res) => {
  res.json(await adGateInfo(await ownSearch(req)));
});

router.post('/searches/:id/ad', async (req, res) => {
  const { event } = z.object({ event: z.enum(AD_EVENTS) }).parse(req.body);
  res.json({ adGate: await recordAdEvent(await ownSearch(req), event) });
});

router.get('/:id', async (req, res) => {
  const job = await JobPosting.findOne({ _id: req.params.id, active: true }).select('-key -postedBy').lean();
  if (!job) throw new HttpError(404, 'Job not found');
  res.json({ job });
});

export function resolveJobApplyUrl(job, requestedLink) {
  const allowed = [
    job.applyUrl,
    ...(job.applyOptions || []).map((o) => o.link),
    job.sourceUrl,
    job.companyWebsite,
  ].filter(Boolean);

  if (requestedLink && allowed.includes(requestedLink)) {
    return requestedLink;
  }

  const isLinkedInSource =
    job.platform === 'LinkedIn' ||
    String(job.via || '').toLowerCase().includes('linkedin') ||
    job.provider === 'apify_linkedin' ||
    /linkedin\.com/i.test(job.applyUrl || '') ||
    /linkedin\.com/i.test(job.sourceUrl || '') ||
    job.applyOptions?.some((o) => /linkedin\.com/i.test(o.link));

  if (isLinkedInSource) {
    const linkedInOption = (job.applyOptions || []).find((o) => /linkedin\.com/i.test(o.link));
    if (linkedInOption?.link) return linkedInOption.link;
    if (job.applyUrl && /linkedin\.com/i.test(job.applyUrl)) return job.applyUrl;
    if (job.sourceUrl && /linkedin\.com/i.test(job.sourceUrl)) return job.sourceUrl;
  }

  // Look for direct company career or application link
  const companyOption = (job.applyOptions || []).find((o) =>
    /company|career|apply|official/i.test(o.title) && !/linkedin|naukri|indeed|shine|foundit/i.test(o.title)
  );
  if (companyOption?.link) return companyOption.link;

  if (job.applyUrl) return job.applyUrl;
  if (job.applyOptions?.[0]?.link) return job.applyOptions[0].link;
  if (job.sourceUrl) return job.sourceUrl;
  if (job.companyWebsite) return job.companyWebsite;

  if (job.emails?.[0]) {
    return `mailto:${job.emails[0]}?subject=${encodeURIComponent(`Application for ${job.title}`)}`;
  }

  return null;
}

router.post('/:id/apply', async (req, res) => {
  const job = await JobPosting.findOneAndUpdate({ _id: req.params.id, active: true }, { $inc: { applyClicks: 1 } }, { returnDocument: 'after' });
  if (!job) throw new HttpError(404, 'Job not found');
  const link = z.object({ link: z.string().url().optional() }).parse(req.body || {}).link;
  const url = resolveJobApplyUrl(job, link);
  if (!url) throw new HttpError(404, 'This job has no apply link or email');
  res.json({ url });
});

export default router;

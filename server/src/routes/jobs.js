import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { JOB_LEVELS, JobPosting } from '../models/JobPosting.js';
import { isAdLocked, publicAdGate } from '../models/adGate.js';
import { JobSearch } from '../models/JobSearch.js';
import { llmEnabled } from '../services/agent/llm.js';
import { searchJobs } from '../services/jobs/aggregator.js';
import { dedupeJobs } from '../services/jobs/dedupe.js';
import { findCachedSearch, saveSearchCache } from '../services/jobs/searchCache.js';
import { CATEGORY_KEYS, JOB_CATEGORIES } from '../services/jobs/categories.js';
import { EDUCATION_KEYS, EDUCATION_LEVELS } from '../services/jobs/education.js';
import { INDIAN_STATES } from '../services/jobs/india.js';
import { searchQuota } from '../services/limits.js';
import { needsProfile } from '../services/profile.js';
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

router.get('/meta', async (req, res) => {
  const quota = await searchQuota(req.user);
  res.json({
    categories: JOB_CATEGORIES.map(({ key, label }) => ({ key, label })),
    levels: JOB_LEVELS,
    education: EDUCATION_LEVELS.map(({ key, label }) => ({ key, label })),
    states: INDIAN_STATES,
    postedWithin: POSTED_WITHIN,
    providers: jobProviders(),
    ai: llmEnabled() ? 'openai' : 'rules',
    dailyLimit: quota.limit,
    searchesToday: quota.used,
    searchesLeft: quota.remaining,
  });
});

function serializeSearch(doc) {
  const out = doc.toObject ? doc.toObject() : { ...doc };
  delete out.jobs;
  out.adGate = publicAdGate(doc);
  out.locked = isAdLocked(doc);
  return out;
}

async function runSearch(id, body, client) {
  const started = Date.now();
  try {
    const hit = await findCachedSearch(body).catch((err) => console.error('[jobs] cache lookup failed', err));
    if (hit) {
      await JobSearch.updateOne(
        { _id: id },
        {
          $set: {
            status: 'completed',
            query: hit.plan.q,
            planner: 'saved',
            providers: hit.providers,
            resultCount: hit.jobs.length,
            hiddenUnverified: hit.hiddenUnverified,
            durationMs: Date.now() - started,
            cached: true,
            cachedAt: hit.cachedAt,
            jobs: hit.jobs,
          },
        },
      );
      return;
    }
    const result = await searchJobs({ ...body, client }, (level, msg) => console.log(`[jobs] ${level}: ${msg}`));
    const { plan, providers, items, hiddenUnverified, durationMs } = result;
    await JobSearch.updateOne(
      { _id: id },
      { $set: { status: 'completed', query: plan.q, planner: plan.planner, providers, resultCount: items.length, hiddenUnverified, durationMs, jobs: items.map((j) => j._id) } },
    );
    await saveSearchCache(body, result).catch((err) => console.error('[jobs] cache save failed', err));
  } catch (err) {
    console.error('[jobs] search failed', err);
    await JobSearch.updateOne({ _id: id }, { $set: { status: 'failed', error: 'The job search failed. Please try again.' } });
  }
}

async function ownSearch(req) {
  const search = await JobSearch.findOne({ _id: req.params.id, owner: req.user._id });
  if (!search) throw new HttpError(404, 'Search not found');
  return search;
}

router.post('/search', searchLimiter, async (req, res) => {
  const body = searchSchema.parse(req.body);
  if (needsProfile(req.user)) throw new HttpError(403, 'Please complete your profile (name, mobile number, city, experience and education) before searching');
  const quota = await searchQuota(req.user);
  if (quota.remaining === 0) {
    throw new HttpError(429, quota.limit === 0 ? 'Job search is paused for your account. Please contact support.' : `Daily job search limit (${quota.limit}) reached. Try again tomorrow.`);
  }
  const search = await JobSearch.create({ ...body, owner: req.user._id, query: body.prompt || body.category, adGate: newAdGate(req.user) });
  runSearch(search._id, body, { ip: req.ip, userAgent: req.get('user-agent') || '' });
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
    const docs = await JobPosting.find({ _id: { $in: search.jobs } }).select('-key -postedBy -review -__v').lean();
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
  const job = await JobPosting.findOne({ _id: req.params.id, active: true }).select('-key -postedBy -review').lean();
  if (!job) throw new HttpError(404, 'Job not found');
  res.json({ job });
});

router.post('/:id/apply', async (req, res) => {
  const job = await JobPosting.findOneAndUpdate({ _id: req.params.id, active: true }, { $inc: { applyClicks: 1 } }, { returnDocument: 'after' });
  if (!job) throw new HttpError(404, 'Job not found');
  const link = z.object({ link: z.string().url().optional() }).parse(req.body || {}).link;
  const allowed = [job.applyUrl, ...job.applyOptions.map((o) => o.link), job.sourceUrl].filter(Boolean);
  const url = (link && allowed.includes(link) ? link : allowed[0]) || (job.emails[0] ? `mailto:${job.emails[0]}?subject=${encodeURIComponent(`Application for ${job.title}`)}` : null);
  if (!url) throw new HttpError(404, 'This job has no apply link or email');
  res.json({ url });
});

export default router;

import crypto from 'node:crypto';
import { JobPosting } from '../../models/JobPosting.js';
import { SearchCache } from '../../models/SearchCache.js';
import { getSettings } from '../settings.js';
import { dbFilter } from './aggregator.js';
import { parseJobPrompt } from './parse.js';

const lower = (v) => String(v || '').trim().toLowerCase();

export function searchCacheKey(input) {
  const parsed = parseJobPrompt(input.prompt);
  const role = lower(parsed.role).split(/\s+/).filter(Boolean).sort().join(' ');
  const city = lower(input.city || (!input.state ? parsed.location : ''));
  const parts = [role, input.level || '', input.category || '', input.education || parsed.education || '', city, lower(input.state), input.postedWithin ?? 30, input.verifiedOnly !== false];
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex');
}

async function cacheEnabled() {
  const { cache } = await getSettings();
  return cache?.enabled !== false;
}

const openJob = () => ({ active: true, $or: [{ validThrough: null }, { validThrough: { $gte: new Date() } }] });

export async function findCachedSearch(input) {
  if (!(await cacheEnabled())) return null;
  const key = searchCacheKey(input);
  const doc = await SearchCache.findById(key).lean();
  if (!doc) return null;
  const [open, newPortal] = await Promise.all([
    JobPosting.find({ _id: { $in: doc.jobs }, ...openJob() }).select('_id').lean(),
    (() => {
      const filter = dbFilter(doc.plan, input.postedWithin);
      filter.$and.push({ origin: 'portal' }, { createdAt: { $gt: doc.refreshedAt } });
      return JobPosting.find(filter).select('_id').limit(20).lean();
    })(),
  ]);
  const openIds = new Set(open.map((d) => String(d._id)));
  const cached = doc.jobs.filter((id) => openIds.has(String(id)));
  if (!cached.length && !newPortal.length) return null;
  const seen = new Set();
  const jobs = [...newPortal.map((d) => d._id), ...cached].filter((id) => !seen.has(String(id)) && seen.add(String(id)));
  await SearchCache.updateOne({ _id: key }, { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } });
  return { plan: doc.plan, providers: doc.providers, jobs, hiddenUnverified: doc.hiddenUnverified, cachedAt: doc.refreshedAt };
}

export async function saveSearchCache(input, { plan, providers, items, hiddenUnverified, durationMs }) {
  if (!items?.length || !(await cacheEnabled())) return;
  await SearchCache.updateOne(
    { _id: searchCacheKey(input) },
    { $set: { label: plan.q, plan, providers, jobs: items.map((j) => j._id), hiddenUnverified, durationMs, refreshedAt: new Date() } },
    { upsert: true },
  );
}

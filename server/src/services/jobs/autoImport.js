import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { AutoImportRule } from '../../models/AutoImportRule.js';
import { JobPosting } from '../../models/JobPosting.js';
import { searchJobs } from './aggregator.js';
import { CATEGORY_KEYS, detectCategory } from './categories.js';
import { canonicalUrl, identityKey, uniqueEmails, uniqueLinks, uniquePhones } from './dedupe.js';

const VERIFIED_METHODS = new Set(['json_ld', 'ai_agent', 'source_page', 'google_jobs']);

export function importableJob(item, rule = {}) {
  if (!item || item.origin === 'portal') return { reason: 'already_portal' };
  if (item.expired || item.active === false) return { reason: 'closed' };
  if (item.validThrough && new Date(item.validThrough).getTime() < Date.now()) return { reason: 'closed' };
  if (item.verification?.status !== 'verified' || !VERIFIED_METHODS.has(item.verification?.method)) return { reason: 'unverified' };
  if (!item.title || !item.companyName || item.companyName.length < 2) return { reason: 'missing_fields' };
  const applyOptions = uniqueLinks([...(item.applyUrl ? [{ title: item.via || item.platform || item.companyName, link: item.applyUrl }] : []), ...(item.applyOptions || [])]);
  const emails = uniqueEmails(item.emails);
  if (!applyOptions.length && !emails.length) return { reason: 'no_apply_route' };
  const detected = detectCategory(`${item.title} ${String(item.description || '').slice(0, 300)}`);
  const category = [item.category, rule.category, detected].find((c) => CATEGORY_KEYS.includes(c));
  if (!category) return { reason: 'missing_fields' };
  const sourceUrl = item.sourceUrl || applyOptions[0]?.link || '';
  const job = {
    title: item.title,
    companyName: item.companyName,
    companyWebsite: item.companyWebsite || '',
    logo: item.logo || '',
    category,
    level: item.level || null,
    experienceText: item.experienceText || '',
    education: item.education || [],
    educationText: item.educationText || '',
    description: item.description || '',
    highlights: item.highlights || [],
    location: item.location || [item.city, item.state, 'India'].filter(Boolean).join(', '),
    city: item.city || '',
    state: item.state || '',
    address: item.address || '',
    employmentType: item.employmentType || '',
    salary: item.salary || '',
    workFromHome: Boolean(item.workFromHome),
    postedAt: item.postedAt || new Date(),
    postedText: item.postedText || '',
    validThrough: item.validThrough || null,
    platform: 'This portal',
    via: `AI import · ${item.via || item.platform || 'web'}`,
    applyUrl: applyOptions[0]?.link || '',
    applyOptions,
    sourceUrl,
    sourceKey: canonicalUrl(sourceUrl),
    emails,
    phones: uniquePhones(item.phones),
    verification: { status: 'verified', method: 'ai_import', checkedAt: new Date() },
  };
  job.dedupeKey = identityKey(job);
  return { job };
}

async function isDuplicate(job) {
  const or = [];
  if (job.dedupeKey) or.push({ dedupeKey: job.dedupeKey });
  if (job.sourceKey) or.push({ sourceKey: job.sourceKey });
  return or.length ? Boolean(await JobPosting.exists({ origin: 'portal', $or: or })) : false;
}

export async function runImportRule(rule, { postedBy } = {}) {
  const started = Date.now();
  const stats = { found: 0, posted: 0, duplicates: 0, skipped: 0 };
  const postedIds = [];
  try {
    const { items } = await searchJobs({
      prompt: rule.prompt,
      level: rule.level || undefined,
      category: rule.category,
      education: rule.education,
      state: rule.state,
      city: rule.city,
      postedWithin: 30,
      verifiedOnly: true,
    });
    stats.found = items.length;
    const seen = new Set();
    for (const item of items) {
      if (stats.posted >= rule.maxJobs) break;
      const { job, reason } = importableJob(item, rule);
      if (!job) {
        stats[reason === 'already_portal' ? 'duplicates' : 'skipped'] += 1;
        continue;
      }
      const keys = [job.dedupeKey, job.sourceKey].filter(Boolean);
      if (keys.some((k) => seen.has(k)) || (await isDuplicate(job))) {
        stats.duplicates += 1;
        continue;
      }
      keys.forEach((k) => seen.add(k));
      const doc = await JobPosting.create({
        ...job,
        key: `portal:${new mongoose.Types.ObjectId()}`,
        origin: 'portal',
        importMethod: 'ai_auto',
        importRule: rule._id,
        postedBy: postedBy || rule.createdBy,
        lastSeenAt: new Date(),
      });
      postedIds.push(doc._id);
      stats.posted += 1;
    }
    await AutoImportRule.updateOne(
      { _id: rule._id },
      { $set: { lastRunAt: new Date(), lastRun: { status: 'completed', ...stats, durationMs: Date.now() - started } }, $unset: { runningSince: 1 }, $inc: { totalPosted: stats.posted } },
    );
    return { status: 'completed', ...stats, postedIds };
  } catch (err) {
    console.error('[auto-import] rule failed', rule._id, err);
    await AutoImportRule.updateOne(
      { _id: rule._id },
      { $set: { lastRunAt: new Date(), lastRun: { status: 'failed', ...stats, error: String(err.message || err).slice(0, 300), durationMs: Date.now() - started } }, $unset: { runningSince: 1 } },
    );
    return { status: 'failed', ...stats, postedIds, error: err.message };
  }
}

const STALE_LOCK_MS = 15 * 60_000;

export async function claimRule(filter) {
  return AutoImportRule.findOneAndUpdate(
    { ...filter, $or: [{ runningSince: null }, { runningSince: { $lt: new Date(Date.now() - STALE_LOCK_MS) } }] },
    { $set: { runningSince: new Date() } },
    { returnDocument: 'after' },
  );
}

async function tick() {
  const rules = await AutoImportRule.find({ active: true }).select('_id everyHours lastRunAt').lean();
  const now = Date.now();
  for (const r of rules) {
    if (r.lastRunAt && new Date(r.lastRunAt).getTime() + r.everyHours * 3600_000 > now) continue;
    const rule = await claimRule({ _id: r._id, active: true });
    if (rule) await runImportRule(rule);
  }
}

export function startAutoImport() {
  if (!env.autoImport.enabled) return null;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await tick();
    } catch (err) {
      console.error('[auto-import] tick failed', err);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(run, env.autoImport.tickMs);
  timer.unref();
  setTimeout(run, 30_000).unref();
  return timer;
}

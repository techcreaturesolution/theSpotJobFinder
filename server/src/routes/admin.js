import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { JOB_LEVELS, JobPosting, REVIEW_STATUSES } from '../models/JobPosting.js';
import { AgentRun } from '../models/AgentRun.js';
import { AutoImportRule } from '../models/AutoImportRule.js';
import { JobSearch } from '../models/JobSearch.js';
import { User } from '../models/User.js';
import { CATEGORY_KEYS } from '../services/jobs/categories.js';
import { EDUCATION_KEYS } from '../services/jobs/education.js';
import { claimRule, runImportRule } from '../services/jobs/autoImport.js';
import { identityKey } from '../services/jobs/dedupe.js';
import { extractJobDrafts } from '../services/jobs/importer.js';
import { INDIAN_STATES } from '../services/jobs/india.js';
import { assertNotDuplicate, httpUrl, portalJobSchema, toPortalJob } from '../services/jobs/portalJobs.js';
import { llmEnabled } from '../services/agent/llm.js';
import { autoImportAllowance, extractAllowance } from '../services/limits.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.get('/stats', async (_req, res) => {
  const [users, jobs, portalJobs, jobSearches, videoViews, applyAgg, pendingEmployerJobs] = await Promise.all([
    User.countDocuments(),
    JobPosting.countDocuments(),
    JobPosting.countDocuments({ origin: 'portal' }),
    JobSearch.countDocuments(),
    JobSearch.countDocuments({ 'adGate.required': true, 'adGate.completedAt': { $ne: null } }),
    JobPosting.aggregate([{ $group: { _id: null, clicks: { $sum: '$applyClicks' } } }]),
    JobPosting.countDocuments({ origin: 'portal', 'review.status': 'pending' }),
  ]);
  res.json({ users, jobs, portalJobs, jobSearches, videoViews, applyClicks: applyAgg[0]?.clicks || 0, pendingEmployerJobs });
});

router.get('/jobs', async (_req, res) => {
  res.json({ items: await JobPosting.find({ origin: 'portal' }).select('-key').sort({ createdAt: -1 }).limit(500).lean() });
});

const extractSchema = z
  .object({ text: z.string().max(30000).default(''), url: z.union([httpUrl, z.literal('')]).default('') })
  .refine((d) => d.text.trim().length >= 30 || d.url, { message: 'Paste the job post text or a job page link', path: ['text'] });

router.post('/jobs/extract', async (req, res) => {
  const body = extractSchema.parse(req.body);
  const allowance = await extractAllowance(req.user);
  if (!allowance.allowed) throw new HttpError(allowance.status, allowance.reason);
  const started = Date.now();
  let result;
  try {
    result = await extractJobDrafts(body);
  } catch (err) {
    await AgentRun.create({ agent: 'ai_extract', user: req.user._id, status: 'failed', error: String(err.message || err).slice(0, 300), durationMs: Date.now() - started });
    throw err;
  }
  await AgentRun.create({ agent: 'ai_extract', user: req.user._id, method: result.method, drafts: result.drafts.length, durationMs: Date.now() - started });
  const keys = result.drafts.map((d) => identityKey(d)).filter(Boolean);
  const dups = keys.length ? await JobPosting.find({ origin: 'portal', dedupeKey: { $in: keys } }).select('dedupeKey').lean() : [];
  const dupKeys = new Set(dups.map((d) => d.dedupeKey));
  res.json({
    method: result.method,
    ai: llmEnabled() ? 'openai' : 'rules',
    drafts: result.drafts.map((d) => ({ ...d, importMethod: 'ai_paste', duplicate: dupKeys.has(identityKey(d)) })),
  });
});

router.post('/jobs', async (req, res) => {
  const data = toPortalJob(portalJobSchema.parse(req.body));
  const dedupeKey = await assertNotDuplicate(data);
  const job = await JobPosting.create({ ...data, dedupeKey, key: `portal:${new mongoose.Types.ObjectId()}`, origin: 'portal', postedAt: new Date(), postedBy: req.user._id });
  res.status(201).json({ job });
});

router.put('/jobs/:id', async (req, res) => {
  const data = toPortalJob(portalJobSchema.parse(req.body));
  const dedupeKey = await assertNotDuplicate(data, req.params.id);
  const job = await JobPosting.findOneAndUpdate({ _id: req.params.id, origin: 'portal' }, { ...data, dedupeKey }, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!job) throw new HttpError(404, 'Job not found');
  res.json({ job });
});

router.get('/employer-jobs', async (req, res) => {
  const { status } = z.object({ status: z.union([z.enum(REVIEW_STATUSES), z.literal('')]).default('pending') }).parse(req.query);
  const items = await JobPosting.find({ origin: 'portal', 'review.status': status || { $ne: null } })
    .select('-key')
    .populate('postedBy', 'name email phone company')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
  res.json({ items });
});

router.post('/jobs/:id/review', async (req, res) => {
  const { action, note } = z
    .object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).default('') })
    .refine((d) => d.action === 'approve' || d.note.length >= 3, { message: 'Tell the employer why the job was rejected', path: ['note'] })
    .parse(req.body);
  const job = await JobPosting.findOne({ _id: req.params.id, origin: 'portal', 'review.status': { $ne: null } });
  if (!job) throw new HttpError(404, 'Employer job not found');
  if (action === 'approve') await assertNotDuplicate(job, job._id);
  job.active = action === 'approve';
  job.review = { status: action === 'approve' ? 'approved' : 'rejected', note, reviewedBy: req.user._id, reviewedAt: new Date() };
  if (action === 'approve') job.verification = { status: 'verified', method: 'employer', checkedAt: new Date() };
  await job.save();
  res.json({ job });
});

router.delete('/jobs/:id', async (req, res) => {
  const r = await JobPosting.deleteOne({ _id: req.params.id, origin: 'portal' });
  if (!r.deletedCount) throw new HttpError(404, 'Job not found');
  res.json({ ok: true });
});

const ruleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  prompt: z.string().trim().max(200).default(''),
  category: z.union([z.enum(CATEGORY_KEYS), z.literal('')]).default(''),
  level: z.union([z.enum(JOB_LEVELS), z.literal('')]).default(''),
  education: z.union([z.enum(EDUCATION_KEYS), z.literal('')]).default(''),
  state: z.union([z.enum(INDIAN_STATES), z.literal('')]).default(''),
  city: z.string().trim().max(60).default(''),
  everyHours: z.coerce.number().int().min(1).max(168).default(24),
  maxJobs: z.coerce.number().int().min(1).max(30).default(10),
  active: z.boolean().default(true),
}).refine((d) => d.prompt.length >= 2 || d.category, { message: 'Enter a job keyword or pick a category', path: ['prompt'] });

router.get('/auto-import', async (_req, res) => {
  res.json({ items: await AutoImportRule.find().sort({ createdAt: -1 }).lean() });
});

router.post('/auto-import', async (req, res) => {
  const rule = await AutoImportRule.create({ ...ruleSchema.parse(req.body), createdBy: req.user._id });
  res.status(201).json({ rule });
});

router.put('/auto-import/:id', async (req, res) => {
  const rule = await AutoImportRule.findByIdAndUpdate(req.params.id, ruleSchema.parse(req.body), { returnDocument: 'after', runValidators: true });
  if (!rule) throw new HttpError(404, 'Rule not found');
  res.json({ rule });
});

router.delete('/auto-import/:id', async (req, res) => {
  const r = await AutoImportRule.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw new HttpError(404, 'Rule not found');
  res.json({ ok: true });
});

router.post('/auto-import/:id/run', async (req, res) => {
  if (!(await AutoImportRule.exists({ _id: req.params.id }))) throw new HttpError(404, 'Rule not found');
  const allowance = await autoImportAllowance({ bypassLimits: req.user.role === 'master' });
  if (!allowance.allowed) throw new HttpError(allowance.status, allowance.reason);
  const rule = await claimRule({ _id: req.params.id });
  if (!rule) throw new HttpError(409, 'This rule is already running');
  res.json({ result: await runImportRule(rule, { postedBy: req.user._id, userId: req.user._id, trigger: 'manual', maxPosts: allowance.remainingPosts }) });
});

router.get('/users', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(500).lean();
  const jobCounts = await JobSearch.aggregate([{ $group: { _id: '$owner', jobSearches: { $sum: 1 } } }]);
  const jobsById = new Map(jobCounts.map((c) => [String(c._id), c.jobSearches]));
  res.json({
    items: users.map((u) => ({
      ...u,
      jobSearches: jobsById.get(String(u._id)) || 0,
    })),
  });
});

export default router;

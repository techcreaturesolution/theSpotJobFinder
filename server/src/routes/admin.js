import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { JOB_LEVELS, JobPosting } from '../models/JobPosting.js';
import { JobSearch } from '../models/JobSearch.js';
import { User } from '../models/User.js';
import { CATEGORY_KEYS } from '../services/jobs/categories.js';
import { EDUCATION_KEYS } from '../services/jobs/education.js';
import { identityKey, uniquePhones } from '../services/jobs/dedupe.js';
import { extractPhones } from '../services/jobs/parse.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');

const optionalUrl = z.union([httpUrl, z.literal('')]).default('');

const portalJobSchema = z.object({
  title: z.string().trim().min(2).max(140),
  companyName: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORY_KEYS),
  level: z.union([z.enum(JOB_LEVELS), z.literal('')]).default(''),
  experienceText: z.string().trim().max(60).default(''),
  education: z.array(z.enum(EDUCATION_KEYS)).max(8).default([]),
  educationText: z.string().trim().max(200).default(''),
  validThrough: z.union([z.null(), z.literal(''), z.coerce.date()]).optional(),
  description: z.string().trim().max(8000).default(''),
  city: z.string().trim().max(60).default(''),
  state: z.string().trim().max(60).default(''),
  address: z.string().trim().max(300).default(''),
  email: z.union([z.string().trim().email(), z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  companyWebsite: optionalUrl,
  applyUrl: optionalUrl,
  salary: z.string().trim().max(80).default(''),
  employmentType: z.string().trim().max(40).default(''),
  active: z.boolean().default(true),
});

function toPortalJob(d) {
  const { email, phone, level, ...rest } = d;
  return {
    ...rest,
    level: level || null,
    location: [d.city, d.state, 'India'].filter(Boolean).join(', '),
    emails: email ? [email.toLowerCase()] : [],
    phones: phone ? uniquePhones(extractPhones(phone).length ? extractPhones(phone) : [phone]) : [],
    platform: 'This portal',
    via: 'This portal',
    applyOptions: d.applyUrl ? [{ title: d.companyName, link: d.applyUrl }] : [],
    validThrough: d.validThrough || null,
    verification: { status: 'verified', method: 'portal', checkedAt: new Date() },
  };
}

router.get('/stats', async (_req, res) => {
  const [users, jobs, portalJobs, jobSearches, videoViews, applyAgg] = await Promise.all([
    User.countDocuments(),
    JobPosting.countDocuments(),
    JobPosting.countDocuments({ origin: 'portal' }),
    JobSearch.countDocuments(),
    JobSearch.countDocuments({ 'adGate.required': true, 'adGate.completedAt': { $ne: null } }),
    JobPosting.aggregate([{ $group: { _id: null, clicks: { $sum: '$applyClicks' } } }]),
  ]);
  res.json({ users, jobs, portalJobs, jobSearches, videoViews, applyClicks: applyAgg[0]?.clicks || 0 });
});

router.get('/jobs', async (_req, res) => {
  res.json({ items: await JobPosting.find({ origin: 'portal' }).select('-key').sort({ createdAt: -1 }).limit(500).lean() });
});

async function assertNotDuplicate(data, exceptId) {
  const dedupeKey = identityKey(data);
  const dup = dedupeKey && (await JobPosting.exists({ dedupeKey, origin: 'portal', active: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }));
  if (dup) throw new HttpError(409, 'This job (same title, company and city) is already posted');
  return dedupeKey;
}

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

router.delete('/jobs/:id', async (req, res) => {
  const r = await JobPosting.deleteOne({ _id: req.params.id, origin: 'portal' });
  if (!r.deletedCount) throw new HttpError(404, 'Job not found');
  res.json({ ok: true });
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

router.patch('/users/:id', async (req, res) => {
  const body = z.object({ role: z.enum(['user', 'admin']).optional(), active: z.boolean().optional() }).parse(req.body);
  if (String(req.params.id) === String(req.user._id) && (body.role === 'user' || body.active === false)) {
    throw new HttpError(400, 'You cannot demote or disable yourself');
  }
  const user = await User.findByIdAndUpdate(req.params.id, body, { returnDocument: 'after' });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: user.toPublic() });
});

export default router;

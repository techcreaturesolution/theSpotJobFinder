import { Router } from 'express';
import mongoose from 'mongoose';
import { JobPosting } from '../models/JobPosting.js';
import { startOfDay } from '../services/limits.js';
import { assertNotDuplicate, employerJobSchema, toPortalJob } from '../services/jobs/portalJobs.js';
import { isProfileComplete } from '../services/profile.js';
import { getSettings } from '../services/settings.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const PUBLIC_FIELDS = '-key -dedupeKey -__v';

router.use((req, _res, next) => {
  if (!isProfileComplete(req.user)) throw new HttpError(403, 'Complete your company profile before posting jobs');
  next();
});

function toEmployerJob(body, user) {
  const parsed = employerJobSchema.parse(body);
  return toPortalJob({ ...parsed, companyName: user.company.name, companyWebsite: parsed.companyWebsite || user.company.website || '' }, 'employer');
}

async function reviewState() {
  const { employer } = await getSettings();
  if (!employer.requireApproval) return { active: true, review: { status: 'approved', reviewedAt: new Date() } };
  return { active: false, review: { status: 'pending' } };
}

async function ownJob(req) {
  const job = await JobPosting.findOne({ _id: req.params.id, origin: 'portal', postedBy: req.user._id });
  if (!job) throw new HttpError(404, 'Job not found');
  return job;
}

router.get('/jobs', async (req, res) => {
  const { employer } = await getSettings();
  const [items, postedToday] = await Promise.all([
    JobPosting.find({ origin: 'portal', postedBy: req.user._id }).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).limit(500).lean(),
    JobPosting.countDocuments({ origin: 'portal', postedBy: req.user._id, createdAt: { $gte: startOfDay() } }),
  ]);
  res.json({ items, postedToday, dailyLimit: employer.dailyPosts, requireApproval: employer.requireApproval });
});

router.post('/jobs', async (req, res) => {
  const data = toEmployerJob(req.body, req.user);
  const { employer } = await getSettings();
  const postedToday = await JobPosting.countDocuments({ origin: 'portal', postedBy: req.user._id, createdAt: { $gte: startOfDay() } });
  if (postedToday >= employer.dailyPosts) {
    throw new HttpError(429, employer.dailyPosts === 0 ? 'Job posting is paused for employers. Please contact support.' : `Daily job posting limit (${employer.dailyPosts}) reached. Try again tomorrow.`);
  }
  const dedupeKey = await assertNotDuplicate(data);
  const job = await JobPosting.create({
    ...data,
    ...(await reviewState()),
    dedupeKey,
    key: `portal:${new mongoose.Types.ObjectId()}`,
    origin: 'portal',
    postedAt: new Date(),
    postedBy: req.user._id,
  });
  res.status(201).json({ job });
});

router.put('/jobs/:id', async (req, res) => {
  const job = await ownJob(req);
  const data = toEmployerJob(req.body, req.user);
  const dedupeKey = await assertNotDuplicate(data, job._id);
  job.set({ ...data, ...(await reviewState()), dedupeKey, closedAt: null });
  await job.save();
  res.json({ job });
});

router.post('/jobs/:id/close', async (req, res) => {
  const job = await ownJob(req);
  job.active = false;
  if (job.review?.status === 'pending') job.review.status = null;
  await job.save();
  res.json({ job });
});

router.delete('/jobs/:id', async (req, res) => {
  const job = await ownJob(req);
  await job.deleteOne();
  res.json({ ok: true });
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AGENTS, AgentRun } from '../models/AgentRun.js';
import { AutoImportRule } from '../models/AutoImportRule.js';
import { JobPosting } from '../models/JobPosting.js';
import { JobSearch } from '../models/JobSearch.js';
import { SearchCache } from '../models/SearchCache.js';
import { User } from '../models/User.js';
import { llmConfigured } from '../services/agent/llm.js';
import { runAllActiveRules } from '../services/jobs/autoImport.js';
import { closedJobFilter, removeClosedJobs } from '../services/jobs/cleanup.js';
import { educationByKey } from '../services/jobs/education.js';
import { effectiveSearchLimit, startOfDay } from '../services/limits.js';
import { isProfileComplete } from '../services/profile.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { csvCell } from '../utils/csv.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const countBy = async (Model, match, field) => {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 }, last: { $max: '$createdAt' } } }]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

router.get('/overview', async (_req, res) => {
  const today = startOfDay();
  const settings = await getSettings({ fresh: true });
  const [users, admins, masters, blocked, newUsersToday, searchesToday, searchesTotal, seekersToday, portalJobs, activeRules, runsToday, lastRun, savedSearches, savedHitsToday, storedJobs, closedJobs] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'master' }),
    User.countDocuments({ active: false }),
    User.countDocuments({ createdAt: { $gte: today } }),
    JobSearch.countDocuments({ createdAt: { $gte: today } }),
    JobSearch.countDocuments(),
    JobSearch.distinct('owner', { createdAt: { $gte: today } }),
    JobPosting.countDocuments({ origin: 'portal' }),
    AutoImportRule.countDocuments({ active: true }),
    AgentRun.aggregate([
      { $match: { createdAt: { $gte: today } } },
      {
        $group: {
          _id: '$agent',
          runs: { $sum: 1 },
          posted: { $sum: '$posted' },
          drafts: { $sum: '$drafts' },
          removed: { $sum: '$removed' },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
    ]),
    AgentRun.findOne({ agent: 'auto_import' }).sort({ createdAt: -1 }).lean(),
    SearchCache.countDocuments(),
    JobSearch.countDocuments({ createdAt: { $gte: today }, cached: true }),
    JobPosting.countDocuments(),
    JobPosting.countDocuments(closedJobFilter()),
  ]);
  const agents = Object.fromEntries(AGENTS.map((a) => [a, { runs: 0, posted: 0, drafts: 0, removed: 0, failed: 0 }]));
  for (const r of runsToday) agents[r._id] = { runs: r.runs, posted: r.posted, drafts: r.drafts, removed: r.removed, failed: r.failed };
  res.json({
    today,
    users: { total: users, admins, masters, blocked, newToday: newUsersToday, searchingToday: seekersToday.length },
    searches: { today: searchesToday, total: searchesTotal, savedHitsToday },
    savedSearches,
    portalJobs,
    storedJobs,
    closedJobs,
    activeRules,
    agents,
    lastAutoImport: lastRun,
    settings,
    system: { openaiConfigured: llmConfigured(), schedulerEnabled: env.autoImport.enabled, schedulerTickMinutes: Math.round(env.autoImport.tickMs / 60_000) },
  });
});

router.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings({ fresh: true }) });
});

const limit = (max) => z.coerce.number().int().min(0).max(max);
const settingsSchema = z
  .object({
    dailySearchLimit: limit(10000),
    staffUnlimitedSearch: z.boolean(),
    ai: z
      .object({
        openaiEnabled: z.boolean(),
        extractEnabled: z.boolean(),
        extractDailyLimit: limit(10000),
        autoImportEnabled: z.boolean(),
        autoImportDailyRuns: limit(1000),
        autoImportDailyPosts: limit(10000),
      })
      .partial()
      .strict(),
    cache: z.object({ enabled: z.boolean() }).partial().strict(),
    cleanup: z.object({ enabled: z.boolean() }).partial().strict(),
  })
  .partial()
  .strict();

router.put('/settings', async (req, res) => {
  res.json({ settings: await updateSettings(settingsSchema.parse(req.body), req.user._id) });
});

const clientQuery = z.object({
  q: z.string().trim().max(100).default(''),
  role: z.enum(['', 'user', 'admin', 'master']).default(''),
  status: z.enum(['', 'active', 'blocked']).default(''),
  profile: z.enum(['', 'complete', 'incomplete']).default(''),
});

const PROFILE_DONE = { name: { $nin: [null, ''] }, phone: { $type: 'string' }, state: { $nin: [null, ''] }, city: { $nin: [null, ''] }, level: { $nin: [null, ''] }, education: { $nin: [null, ''] } };

async function listClients(query, max) {
  const q = clientQuery.parse(query);
  const and = [];
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const digits = q.q.replace(/\D/g, '');
    and.push({ $or: [{ email: rx }, { name: rx }, { city: rx }, { state: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])] });
  }
  if (q.role) and.push({ role: q.role });
  if (q.status) and.push({ active: q.status === 'active' });
  if (q.profile === 'complete') and.push(PROFILE_DONE);
  if (q.profile === 'incomplete') and.push({ $nor: [PROFILE_DONE] });
  const [users, settings, today, total, extracts] = await Promise.all([
    User.find(and.length ? { $and: and } : {}).sort({ createdAt: -1 }).limit(max).lean(),
    getSettings(),
    countBy(JobSearch, { createdAt: { $gte: startOfDay() } }, 'owner'),
    countBy(JobSearch, {}, 'owner'),
    countBy(AgentRun, { createdAt: { $gte: startOfDay() }, user: { $ne: null } }, 'user'),
  ]);
  return users.map((u) => ({
    _id: u._id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    phone: u.phone || '',
    state: u.state || '',
    city: u.city || '',
    level: u.level || '',
    education: u.education || '',
    educationLabel: educationByKey(u.education)?.label || u.education || '',
    profileComplete: isProfileComplete(u),
    profileUpdatedAt: u.profileUpdatedAt || null,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    dailySearchLimit: u.dailySearchLimit ?? null,
    effectiveLimit: effectiveSearchLimit(u, settings),
    searchesToday: today.get(String(u._id))?.n || 0,
    searchesTotal: total.get(String(u._id))?.n || 0,
    lastSearchAt: total.get(String(u._id))?.last || null,
    aiRunsToday: extracts.get(String(u._id))?.n || 0,
  }));
}

router.get('/users', async (req, res) => {
  res.json({ items: await listClients(req.query, 1000) });
});

const CSV_COLUMNS = [
  ['Name', (u) => u.name],
  ['Email', (u) => u.email],
  ['Mobile', (u) => u.phone],
  ['City', (u) => u.city],
  ['State', (u) => u.state],
  ['Fresher / experienced', (u) => u.level],
  ['Education', (u) => u.educationLabel],
  ['Profile complete', (u) => (u.profileComplete ? 'yes' : 'no')],
  ['Role', (u) => u.role],
  ['Status', (u) => (u.active ? 'active' : 'blocked')],
  ['Daily search limit', (u) => u.effectiveLimit ?? 'unlimited'],
  ['Searches today', (u) => u.searchesToday],
  ['Searches total', (u) => u.searchesTotal],
  ['Joined', (u) => u.createdAt?.toISOString()],
  ['Last login', (u) => u.lastLoginAt?.toISOString()],
  ['Last search', (u) => u.lastSearchAt?.toISOString()],
];

router.get('/users.csv', async (req, res) => {
  const users = await listClients(req.query, 100000);
  const rows = [CSV_COLUMNS.map(([h]) => h), ...users.map((u) => CSV_COLUMNS.map(([, get]) => get(u)))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="thespot-clients-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\ufeff${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`);
});

router.get('/users/:id/searches', async (req, res) => {
  const items = await JobSearch.find({ owner: req.params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('prompt level category education state city status resultCount durationMs createdAt')
    .lean();
  res.json({ items });
});

router.patch('/users/:id', async (req, res) => {
  const body = z
    .object({
      role: z.enum(['user', 'admin']).optional(),
      active: z.boolean().optional(),
      dailySearchLimit: z.union([z.null(), limit(10000)]).optional(),
    })
    .strict()
    .parse(req.body);
  const target = await User.findById(req.params.id);
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === 'master' && (body.role || body.active === false)) {
    throw new HttpError(400, 'Master admins are set with MASTER_ADMIN_EMAILS and cannot be demoted or blocked here');
  }
  if (body.role) {
    target.role = body.role;
    target.roleManaged = true;
  }
  if (body.active !== undefined) target.active = body.active;
  if (body.dailySearchLimit !== undefined) target.dailySearchLimit = body.dailySearchLimit;
  await target.save();
  res.json({ user: target.toPublic() });
});

router.get('/agent-runs', async (req, res) => {
  const q = z.object({ agent: z.union([z.enum(AGENTS), z.literal('')]).default(''), days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
  const since = startOfDay(Date.now(), q.days - 1);
  const match = { createdAt: { $gte: since }, ...(q.agent ? { agent: q.agent } : {}) };
  const [items, daily] = await Promise.all([
    AgentRun.find(match).sort({ createdAt: -1 }).limit(200).populate('user', 'email name').lean(),
    AgentRun.aggregate([
      { $match: match },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, agent: '$agent' },
          runs: { $sum: 1 },
          posted: { $sum: '$posted' },
          drafts: { $sum: '$drafts' },
          removed: { $sum: '$removed' },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.day': -1 } },
    ]),
  ]);
  res.json({ items, daily: daily.map((d) => ({ day: d._id.day, agent: d._id.agent, runs: d.runs, posted: d.posted, drafts: d.drafts, removed: d.removed, failed: d.failed })), since });
});

let runAllBusy = false;
router.post('/agents/auto-import/run', async (req, res) => {
  const { ai } = await getSettings({ fresh: true });
  if (!ai.autoImportEnabled) throw new HttpError(403, 'Turn on AI auto-import first');
  if (runAllBusy) throw new HttpError(409, 'A full auto-import run is already in progress');
  const rules = await AutoImportRule.countDocuments({ active: true });
  if (!rules) throw new HttpError(400, 'There are no active auto-import rules');
  runAllBusy = true;
  runAllActiveRules({ userId: req.user._id, bypassLimits: true })
    .catch((err) => console.error('[master] run-all failed', err))
    .finally(() => {
      runAllBusy = false;
    });
  res.status(202).json({ started: rules });
});

router.get('/saved-searches', async (_req, res) => {
  const items = await SearchCache.find().sort({ refreshedAt: -1 }).limit(200).select('label refreshedAt hits lastHitAt jobs').lean();
  res.json({ items: items.map(({ jobs, ...d }) => ({ ...d, jobCount: jobs.length })) });
});

router.delete('/saved-searches', async (_req, res) => {
  const r = await SearchCache.deleteMany({});
  res.json({ removed: r.deletedCount });
});

let cleanupBusy = false;
router.post('/agents/cleanup/run', async (req, res) => {
  if (cleanupBusy) throw new HttpError(409, 'Cleanup is already running');
  cleanupBusy = true;
  try {
    res.json(await removeClosedJobs({ trigger: 'manual', userId: req.user._id }));
  } finally {
    cleanupBusy = false;
  }
});

export default router;

import { AgentRun } from '../models/AgentRun.js';
import { JobSearch } from '../models/JobSearch.js';
import { getSettings } from './settings.js';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export const isStaff = (user) => ['admin', 'master'].includes(user?.role);

export function startOfDay(now = Date.now(), daysAgo = 0) {
  return new Date(Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS - daysAgo * DAY_MS);
}

export function effectiveSearchLimit(user, settings) {
  if (isStaff(user) && settings.staffUnlimitedSearch) return null;
  return user.dailySearchLimit ?? settings.dailySearchLimit;
}

export async function searchQuota(user) {
  const settings = await getSettings();
  const limit = effectiveSearchLimit(user, settings);
  const used = await JobSearch.countDocuments({ owner: user._id, createdAt: { $gte: startOfDay() } });
  return { limit, used, remaining: limit == null ? null : Math.max(0, limit - used) };
}

export async function extractAllowance(user) {
  const { ai } = await getSettings();
  if (!ai.extractEnabled) return { allowed: false, status: 403, reason: 'AI job import is turned off by the master admin' };
  if (user.role === 'master') return { allowed: true };
  const used = await AgentRun.countDocuments({ agent: 'ai_extract', user: user._id, createdAt: { $gte: startOfDay() } });
  if (used >= ai.extractDailyLimit) return { allowed: false, status: 429, reason: `Daily AI import limit (${ai.extractDailyLimit}) reached` };
  return { allowed: true };
}

export async function autoImportAllowance({ bypassLimits = false } = {}) {
  const { ai } = await getSettings({ fresh: true });
  if (!ai.autoImportEnabled) return { allowed: false, status: 403, reason: 'AI auto-import is turned off by the master admin' };
  if (bypassLimits) return { allowed: true, remainingPosts: Infinity };
  const since = startOfDay();
  const [runs, postedAgg] = await Promise.all([
    AgentRun.countDocuments({ agent: 'auto_import', createdAt: { $gte: since } }),
    AgentRun.aggregate([{ $match: { agent: 'auto_import', createdAt: { $gte: since } } }, { $group: { _id: null, posted: { $sum: '$posted' } } }]),
  ]);
  if (runs >= ai.autoImportDailyRuns) return { allowed: false, status: 429, reason: `Daily AI auto-import run limit (${ai.autoImportDailyRuns}) reached` };
  const remainingPosts = ai.autoImportDailyPosts - (postedAgg[0]?.posted || 0);
  if (remainingPosts <= 0) return { allowed: false, status: 429, reason: `Daily AI auto-import job limit (${ai.autoImportDailyPosts}) reached` };
  return { allowed: true, remainingPosts };
}

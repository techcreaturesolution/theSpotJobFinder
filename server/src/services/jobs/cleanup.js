import { env } from '../../config/env.js';
import { AgentRun } from '../../models/AgentRun.js';
import { JobPosting } from '../../models/JobPosting.js';
import { JobSearch } from '../../models/JobSearch.js';
import { SearchCache } from '../../models/SearchCache.js';
import { getSettings } from '../settings.js';

const DAY = 86400_000;
const STALE_DAYS = 21;
const BATCH = 1000;

export function closedJobFilter(now = new Date()) {
  return {
    $or: [
      { closedAt: { $ne: null } },
      { validThrough: { $lt: now } },
      { origin: 'aggregated', active: false },
      { origin: 'aggregated', lastSeenAt: { $lt: new Date(now.getTime() - STALE_DAYS * DAY) } },
    ],
  };
}

export async function removeClosedJobs({ trigger = 'schedule', userId } = {}) {
  const started = Date.now();
  let removed = 0;
  try {
    const filter = closedJobFilter();
    for (;;) {
      const ids = (await JobPosting.find(filter).select('_id').limit(BATCH).lean()).map((d) => d._id);
      if (!ids.length) break;
      await Promise.all([
        SearchCache.updateMany({ jobs: { $in: ids } }, { $pull: { jobs: { $in: ids } } }),
        JobSearch.updateMany({ jobs: { $in: ids } }, { $pull: { jobs: { $in: ids } } }),
      ]);
      removed += (await JobPosting.deleteMany({ _id: { $in: ids } })).deletedCount;
      if (ids.length < BATCH) break;
    }
    if (removed || trigger === 'manual') {
      await AgentRun.create({ agent: 'cleanup', trigger, user: userId, status: 'completed', removed, durationMs: Date.now() - started });
    }
    return { status: 'completed', removed };
  } catch (err) {
    console.error('[cleanup] failed', err);
    await AgentRun.create({ agent: 'cleanup', trigger, user: userId, status: 'failed', removed, error: String(err.message || err).slice(0, 300), durationMs: Date.now() - started }).catch(() => {});
    return { status: 'failed', removed, error: err.message };
  }
}

export function startCleanup() {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const { cleanup } = await getSettings({ fresh: true });
      if (cleanup?.enabled !== false) await removeClosedJobs();
    } catch (err) {
      console.error('[cleanup] tick failed', err);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(run, env.cleanupTickMs);
  timer.unref();
  setTimeout(run, 60_000).unref();
  return timer;
}

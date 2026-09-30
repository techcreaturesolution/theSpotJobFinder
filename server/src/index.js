import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { AutoImportRule } from './models/AutoImportRule.js';
import { JobPosting } from './models/JobPosting.js';
import { JobSearch } from './models/JobSearch.js';
import { startAutoImport } from './services/jobs/autoImport.js';
import { identityKey } from './services/jobs/dedupe.js';
import { getSettings } from './services/settings.js';

await connectDb();
await AutoImportRule.updateMany({ runningSince: { $ne: null } }, { $unset: { runningSince: 1 } });
await JobSearch.updateMany({ status: 'running' }, { $set: { status: 'failed', error: 'Search was interrupted by a server restart. Please search again.' } });
const missing = await JobPosting.find({ dedupeKey: { $exists: false } }).select('key title companyName city location').lean();
if (missing.length) {
  await JobPosting.bulkWrite(missing.map((j) => ({ updateOne: { filter: { _id: j._id }, update: { $set: { dedupeKey: identityKey(j) || j.key } } } })));
}
await getSettings({ fresh: true });
createApp().listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port}`));
startAutoImport();

import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { JobPosting } from './models/JobPosting.js';
import { JobSearch } from './models/JobSearch.js';
import { identityKey } from './services/jobs/dedupe.js';

await connectDb();
await JobSearch.updateMany({ status: 'running' }, { $set: { status: 'failed', error: 'Search was interrupted by a server restart. Please search again.' } });
const missing = await JobPosting.find({ dedupeKey: { $exists: false } }).select('key title companyName city location').lean();
if (missing.length) {
  await JobPosting.bulkWrite(missing.map((j) => ({ updateOne: { filter: { _id: j._id }, update: { $set: { dedupeKey: identityKey(j) || j.key } } } })));
}
createApp().listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port}`));

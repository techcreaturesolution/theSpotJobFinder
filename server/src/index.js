import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { JobSearch } from './models/JobSearch.js';

await connectDb();
await JobSearch.updateMany({ status: 'running' }, { $set: { status: 'failed', error: 'Search was interrupted by a server restart. Please search again.' } });
createApp().listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port}`));

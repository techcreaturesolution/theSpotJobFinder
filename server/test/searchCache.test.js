import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closedJobFilter } from '../src/services/jobs/cleanup.js';
import { searchCacheKey } from '../src/services/jobs/searchCache.js';

const base = { level: 'fresher', category: '', education: '', state: '', city: '', postedWithin: 30, verifiedOnly: true };

test('the same search in different words shares one saved result', () => {
  const a = searchCacheKey({ ...base, prompt: 'New jobs in Ahmedabad' });
  assert.equal(a, searchCacheKey({ ...base, prompt: 'latest job openings in ahmedabad' }));
  assert.equal(a, searchCacheKey({ ...base, prompt: 'jobs', city: 'Ahmedabad' }));
  assert.equal(searchCacheKey({ ...base, prompt: 'sales executive' }), searchCacheKey({ ...base, prompt: 'Executive  Sales jobs' }));
});

test('different filters never share a saved result', () => {
  const a = searchCacheKey({ ...base, prompt: 'jobs in Ahmedabad' });
  assert.notEqual(a, searchCacheKey({ ...base, prompt: 'jobs in Surat' }));
  assert.notEqual(a, searchCacheKey({ ...base, level: 'experienced', prompt: 'jobs in Ahmedabad' }));
  assert.notEqual(a, searchCacheKey({ ...base, education: 'iti', prompt: 'jobs in Ahmedabad' }));
  assert.notEqual(a, searchCacheKey({ ...base, postedWithin: 7, prompt: 'jobs in Ahmedabad' }));
  assert.notEqual(a, searchCacheKey({ ...base, prompt: 'accountant jobs in Ahmedabad' }));
});

test('cleanup targets closed, expired and stale listings only', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  const { $or } = closedJobFilter(now);
  assert.deepEqual($or[0], { closedAt: { $ne: null } });
  assert.deepEqual($or[1], { validThrough: { $lt: now } });
  assert.deepEqual($or[2], { origin: 'aggregated', active: false });
  assert.equal($or[3].origin, 'aggregated');
  assert.equal($or[3].lastSeenAt.$lt.toISOString(), '2026-09-09T00:00:00.000Z');
  assert.equal($or.length, 4);
});

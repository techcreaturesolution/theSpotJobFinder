import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importableJob } from '../src/services/jobs/autoImport.js';
import { extractJobDrafts, parseDeadline, urlsIn } from '../src/services/jobs/importer.js';

const POST = `We are hiring!
Position: Accountant
Company: Shree Traders Pvt Ltd
Location: Ahmedabad, Gujarat
Qualification: B.Com / M.Com
Experience: 1-3 years
Salary: ₹18,000 - ₹25,000 per month
Last date: 30/11/2099
Send CV to HR@ShreeTraders.in or call 98250 12345 / +91 98250-12345
Apply here: https://shreetraders.in/careers/accountant.`;

test('parses Indian deadline formats', () => {
  assert.equal(parseDeadline('30/11/2026'), '2026-11-30');
  assert.equal(parseDeadline('5-1-26'), '2026-01-05');
  assert.equal(parseDeadline('15th October, 2026'), '2026-10-15');
  assert.equal(parseDeadline('Oct 15, 2026'), '2026-10-15');
  assert.equal(parseDeadline('2026-10-15T00:00:00Z'), '2026-10-15');
  assert.equal(parseDeadline('31/02/2026'), '');
  assert.equal(parseDeadline('soon'), '');
});

test('finds URLs without trailing punctuation', () => {
  assert.deepEqual(urlsIn('Apply: https://a.in/job/1. Or https://a.in/job/1'), ['https://a.in/job/1']);
});

test('extracts a job draft from pasted text using only written facts', async () => {
  const { drafts } = await extractJobDrafts({ text: POST });
  assert.equal(drafts.length, 1);
  const d = drafts[0];
  assert.equal(d.title, 'Accountant');
  assert.equal(d.companyName, 'Shree Traders Pvt Ltd');
  assert.equal(d.category, 'finance');
  assert.equal(d.city, 'Ahmedabad');
  assert.equal(d.state, 'Gujarat');
  assert.deepEqual(d.education, ['bcom', 'mcom']);
  assert.equal(d.level, 'experienced');
  assert.equal(d.email, 'hr@shreetraders.in');
  assert.equal(d.phone, '+91 98250 12345');
  assert.equal(d.applyUrl, 'https://shreetraders.in/careers/accountant');
  assert.equal(d.validThrough, '2099-11-30');
  assert.equal(d.address, '');
  assert.equal(d.companyWebsite, '');
  assert.deepEqual(d.missing, []);
  assert.equal(d.closed, false);
});

test('flags closed adverts and missing required fields', async () => {
  const { drafts } = await extractJobDrafts({ text: 'Position: Delivery Boy\nThis position has been filled. Thank you for your interest in the role.' });
  assert.equal(drafts[0].closed, true);
  assert.ok(drafts[0].missing.includes('companyName'));
  await assert.rejects(extractJobDrafts({ text: 'hi' }), /Paste the full job post/);
  await assert.rejects(extractJobDrafts({ url: 'https://x.com/acme/status/1' }), /does not allow automatic reading/);
});

const verifiedItem = {
  _id: 'abc',
  origin: 'aggregated',
  title: 'Backend Developer',
  companyName: 'Acme Tech',
  category: 'it_software',
  city: 'Pune',
  state: 'Maharashtra',
  applyUrl: 'https://acme.in/jobs/42?utm_source=x',
  applyOptions: [{ title: 'LinkedIn', link: 'https://www.acme.in/jobs/42/' }],
  emails: ['HR@acme.in', 'hr@acme.in'],
  phones: ['9876543210', '+91 98765 43210'],
  verification: { status: 'verified', method: 'json_ld' },
};

test('auto-import only accepts verified, open, complete jobs', () => {
  const { job } = importableJob(verifiedItem);
  assert.equal(job.verification.method, 'ai_import');
  assert.equal(job.applyOptions.length, 1);
  assert.deepEqual(job.emails, ['hr@acme.in']);
  assert.equal(job.phones.length, 1);
  assert.equal(job.sourceKey, 'acme.in/jobs/42');
  assert.ok(job.dedupeKey);
  assert.equal(importableJob({ ...verifiedItem, verification: { status: 'unverified', method: 'not_rechecked' } }).reason, 'unverified');
  assert.equal(importableJob({ ...verifiedItem, origin: 'portal' }).reason, 'already_portal');
  assert.equal(importableJob({ ...verifiedItem, validThrough: new Date(Date.now() - 86400_000) }).reason, 'closed');
  assert.equal(importableJob({ ...verifiedItem, companyName: '' }).reason, 'missing_fields');
  assert.equal(importableJob({ ...verifiedItem, applyUrl: '', applyOptions: [], emails: [] }).reason, 'no_apply_route');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

const { mergeSourceJobs } = await import('../src/services/jobs/aggregator.js');
const { mapJSearch, mapJooble, mapCareerjet } = await import('../src/services/jobs/apiSources.js');

const plan = { role: 'accountant', level: 'fresher', city: 'Ahmedabad', state: 'Gujarat', place: 'Ahmedabad, Gujarat', category: 'finance', education: '' };
const naukri = 'https://www.naukri.com/job-listings-accountant-123';

const googleJobs = {
  title: 'Accountant',
  companyName: 'Shree Traders Pvt Ltd',
  location: 'Ahmedabad, Gujarat',
  description: 'Freshers welcome. Call 98765 43210.',
  applyOptions: [{ title: 'Naukri', link: `${naukri}?utm_source=google` }],
  applyUrl: `${naukri}?utm_source=google`,
  sourceUrl: 'https://www.google.com/search?ibp=htl;jobs#htidocid=abc',
  provider: 'google_jobs',
};
const jsearch = mapJSearch({
  job_id: 'j1',
  job_title: 'Accountant (Urgent Hiring)',
  employer_name: 'Shree Traders',
  job_apply_link: naukri,
  apply_options: [{ publisher: 'LinkedIn', apply_link: 'https://in.linkedin.com/jobs/view/accountant-456' }],
  job_description: 'Freshers welcome. Email hr@shreetraders.in or call +91 9876543210.',
  job_city: 'Ahmedabad',
  job_state: 'Gujarat',
  job_min_salary: 15000,
  job_max_salary: 22000,
  job_salary_period: 'MONTH',
});
const jooble = mapJooble({ title: 'Accounts Executive', company: '', location: 'Ahmedabad, Gujarat', snippet: 'Fresher accounts role. HR@ShreeTraders.in', link: 'https://naukri.com/job-listings-accountant-123/', source: 'naukri.com', updated: '2026-09-29T00:00:00' });
const careerjet = mapCareerjet({ title: 'Cashier', company: 'Om Mart', locations: 'Ahmedabad, Gujarat', url: 'https://www.careerjet.co.in/jobad/in-cashier-1', description: 'Fresher cashier needed.', date: 'Mon, 29 Sep 2026 10:00:00 GMT' });

test('SerpAPI and job-API results for the same job become one entry with merged, unique contacts and links', () => {
  const fresh = mergeSourceJobs([googleJobs, jsearch, jooble, careerjet], plan);
  const jobs = [...fresh.values()];
  assert.deepEqual(jobs.map((j) => j.title).sort(), ['Accountant', 'Cashier']);
  const acc = jobs.find((j) => j.title === 'Accountant');
  assert.equal(acc.provider, 'google_jobs');
  assert.deepEqual(acc.emails, ['hr@shreetraders.in']);
  assert.deepEqual(acc.phones, ['+91 98765 43210']);
  const links = acc.applyOptions.map((o) => o.link);
  assert.equal(links.length, 2, `one link per page: ${links}`);
  assert.ok(links.some((l) => l.includes('linkedin.com')));
  assert.ok(acc.salary, 'salary filled in from JSearch');
});

test('jobs with no shared identity or link stay separate', () => {
  const other = { ...googleJobs, title: 'Senior Accountant', applyUrl: 'https://example.com/a', applyOptions: [], sourceUrl: 'https://example.com/a', level: 'fresher' };
  assert.equal(mergeSourceJobs([googleJobs, other], plan).size, 2);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.SERPAPI_KEY = 'test-serp';

const { googleJobsQueries, searchGoogleJobs, webJobQueries } = await import('../src/services/jobs/providers.js');
const { http } = await import('../src/utils/http.js');

const plan = { q: 'accountant fresher jobs in Ahmedabad, Gujarat', role: 'accountant', levelWord: 'fresher', place: 'Ahmedabad, Gujarat' };

test('Google Jobs uses several distinct query variants', () => {
  assert.deepEqual(googleJobsQueries(plan), [
    'accountant fresher jobs in Ahmedabad, Gujarat',
    'accountant jobs in Ahmedabad, Gujarat',
    'accountant fresher hiring Ahmedabad, Gujarat',
  ]);
  const plain = googleJobsQueries({ q: 'accountant jobs in India', role: 'accountant', levelWord: '', place: 'India' });
  assert.deepEqual(plain, ['accountant jobs in India', 'accountant vacancy India']);
});

test('web search splits job boards into separate parallel queries', () => {
  const qs = webJobQueries(plan);
  assert.equal(qs.filter((x) => x.kind === 'board').length, 3);
  assert.deepEqual(qs.map((x) => x.kind).slice(3), ['social', 'company']);
  for (const site of ['apna.co', 'workindia.in', 'naukri.com', 'in.indeed.com', 'linkedin.com/jobs/view', 'foundit.in', 'shine.com', 'internshala.com']) {
    assert.ok(qs.some((x) => x.q.includes(`site:${site}`)), site);
  }
});

test('Google Jobs queries run in parallel and one failure does not drop the others', async () => {
  const orig = http.get;
  let running = 0;
  let peak = 0;
  const logs = [];
  http.get = async (_url, { params }) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 20));
    running -= 1;
    if (params.q === 'b') throw new Error('quota');
    return { data: { jobs_results: [{ title: `Job ${params.q}`, company_name: 'Co', share_link: `https://g.co/${params.q}` }] } };
  };
  try {
    const jobs = await searchGoogleJobs(['a', 'b', 'c'], 30, (lvl, msg) => logs.push(msg));
    assert.equal(peak, 3);
    assert.deepEqual(jobs.map((j) => j.title), ['Job a', 'Job c']);
    assert.match(logs.join(), /Google Jobs query failed: quota/);
    assert.ok(!logs.join().includes('test-serp'));
    await assert.rejects(searchGoogleJobs(['b'], 30), /quota/);
  } finally {
    http.get = orig;
  }
});

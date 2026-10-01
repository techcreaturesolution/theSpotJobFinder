import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JSEARCH_API_KEY = 'test-jsearch';
process.env.ADZUNA_APP_ID = 'id';
process.env.ADZUNA_APP_KEY = 'key';
process.env.JOOBLE_API_KEY = 'test-jooble';
process.env.CAREERJET_API_KEY = 'test-careerjet';

const { apiSourcesConfigured, mapAdzuna, mapCareerjet, mapJooble, mapJSearch, searchJobApis } = await import('../src/services/jobs/apiSources.js');
const { http } = await import('../src/utils/http.js');
const { env } = await import('../src/config/env.js');
const { jobKey } = await import('../src/services/jobs/parse.js');

const plan = { q: 'accountant fresher jobs in Ahmedabad, Gujarat', role: 'accountant', levelWord: 'fresher', eduWord: '', city: 'Ahmedabad', state: 'Gujarat' };

const jsearchJob = {
  job_id: 'abc',
  job_title: 'Accountant',
  employer_name: 'Shree Traders',
  employer_website: 'https://shreetraders.in',
  job_publisher: 'Naukri.com',
  job_employment_type: 'FULLTIME',
  job_apply_link: 'https://www.naukri.com/job-listings-accountant-123',
  apply_options: [
    { publisher: 'Naukri.com', apply_link: 'https://www.naukri.com/job-listings-accountant-123' },
    { publisher: 'LinkedIn', apply_link: 'https://in.linkedin.com/jobs/view/accountant-456' },
  ],
  job_description: 'Freshers can apply. B.Com required. Tally knowledge.',
  job_city: 'Ahmedabad',
  job_state: 'Gujarat',
  job_posted_at_datetime_utc: '2026-09-28T10:00:00.000Z',
  job_offer_expiration_datetime_utc: '2026-10-28T10:00:00.000Z',
  job_min_salary: 15000,
  job_max_salary: 22000,
  job_salary_period: 'MONTH',
  job_highlights: { Qualifications: ['B.Com'] },
};

test('JSearch results keep the employer, every apply option and the closing date', () => {
  const j = mapJSearch(jsearchJob);
  assert.equal(j.title, 'Accountant');
  assert.equal(j.companyName, 'Shree Traders');
  assert.equal(j.location, 'Ahmedabad, Gujarat');
  assert.equal(j.platform, 'Naukri');
  assert.equal(j.applyOptions.length, 2);
  assert.equal(j.validThrough.toISOString(), '2026-10-28T10:00:00.000Z');
  assert.equal(j.salary, '₹15,000 - ₹22,000 per month');
  assert.deepEqual(j.highlights, [{ title: 'Qualifications', items: ['B.Com'] }]);
  assert.deepEqual([j.verification.status, j.verification.method], ['unverified', 'api_jsearch'], 'API data is only verified after the source page is checked');
});

test('Adzuna hides predicted salaries and builds the Indian location', () => {
  const r = {
    id: '1',
    title: '<strong>Accountant</strong>',
    description: 'Tally <b>GST</b>',
    company: { display_name: 'ABC Ltd' },
    location: { display_name: 'Ahmedabad, Gujarat', area: ['India', 'Gujarat', 'Ahmedabad'] },
    redirect_url: 'https://www.adzuna.in/land/ad/1',
    created: '2026-09-27T08:00:00Z',
    contract_time: 'full_time',
    salary_min: 300000,
    salary_max: 300000,
    salary_is_predicted: '1',
  };
  const j = mapAdzuna(r);
  assert.equal(j.title, 'Accountant');
  assert.equal(j.description, 'Tally GST');
  assert.equal(j.location, 'Ahmedabad, Gujarat');
  assert.equal(j.salary, '');
  assert.equal(mapAdzuna({ ...r, salary_is_predicted: '0' }).salary, '₹3,00,000 per year');
  assert.equal(j.employmentType, 'full-time');
});

test('Jooble and Careerjet results map to the job model', () => {
  const jo = mapJooble({ title: 'Accountant', location: 'Ahmedabad', snippet: '<b>Tally</b>&nbsp;', salary: '₹20k', source: 'naukri.com', type: 'Full-time', link: 'https://jooble.org/desc/1', company: 'XYZ', updated: '2026-09-29T00:00:00.0000000' });
  assert.equal(jo.via, 'Naukri');
  assert.equal(jo.applyUrl, 'https://jooble.org/desc/1');
  assert.equal(jo.postedAt.getUTCDate(), 29);
  const cj = mapCareerjet({ title: 'Accountant', company: 'PQR', date: 'Sun, 28 Sep 2026 10:00:00 GMT', description: 'Tally', locations: 'Ahmedabad, Gujarat', salary: '₹2.4L', url: 'https://jobviewtrack.com/x' });
  assert.equal(cj.location, 'Ahmedabad, Gujarat');
  assert.equal(cj.postedAt.toISOString(), '2026-09-28T10:00:00.000Z');
  assert.equal(cj.platform, 'Careerjet');
});

test('the same job from two APIs gets the same identity key', () => {
  const a = mapJSearch(jsearchJob);
  const b = mapJooble({ title: 'Accountant', company: 'Shree Traders', location: 'Ahmedabad, Gujarat', link: 'https://jooble.org/desc/9' });
  assert.equal(jobKey({ ...a, city: 'Ahmedabad' }), jobKey({ ...b, city: 'Ahmedabad' }));
});

test('each API runs only with its key, and a failing API does not stop the others', async () => {
  assert.deepEqual(apiSourcesConfigured(), { jsearch: true, adzuna: true, jooble: true, careerjet: true });
  const calls = [];
  const origGet = http.get;
  const origPost = http.post;
  http.get = async (url, opts) => {
    calls.push(url);
    if (url.includes('adzuna')) throw Object.assign(new Error('boom'), { response: { status: 500 } });
    if (url.includes('careerjet')) {
      assert.equal(opts.params.user_ip, '1.2.3.4');
      assert.equal(opts.auth.username, 'test-careerjet');
      assert.ok(opts.headers.Referer);
      return { data: { type: 'JOBS', jobs: [{ title: 'Accountant', company: 'C', url: 'https://jobviewtrack.com/c' }] } };
    }
    assert.equal(opts.headers['x-rapidapi-key'], 'test-jsearch');
    assert.equal(opts.params.date_posted, 'week');
    return { data: { data: [jsearchJob] } };
  };
  http.post = async (url, body) => {
    calls.push(url);
    assert.equal(body.location, 'Ahmedabad, Gujarat');
    return { data: { jobs: [{ title: 'Accountant', company: 'J', link: 'https://jooble.org/desc/2' }, { title: 'No link' }] } };
  };
  const logs = [];
  try {
    const jobs = await searchJobApis(plan, { postedWithin: 7, client: { ip: '1.2.3.4', userAgent: 'test' } }, (l, m) => logs.push(m));
    assert.deepEqual(jobs.map((j) => j.provider).sort(), ['careerjet', 'jooble', 'jsearch']);
    assert.match(logs.join(), /Adzuna failed: 500 boom/);
    assert.ok(!logs.join().includes('test-'), 'API keys must not be logged');

    calls.length = 0;
    const noClient = await searchJobApis(plan, { postedWithin: 7 });
    assert.ok(!noClient.some((j) => j.provider === 'careerjet'), 'Careerjet needs the searcher IP and browser');

    const saved = { ...env.jooble };
    env.jooble.key = '';
    calls.length = 0;
    await searchJobApis(plan, { postedWithin: 7 });
    assert.ok(!calls.some((u) => u.includes('jooble')));
    Object.assign(env.jooble, saved);
  } finally {
    http.get = origGet;
    http.post = origPost;
  }
});

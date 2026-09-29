import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdLocked, publicAdGate } from '../src/models/adGate.js';
import { detectCategory } from '../src/services/jobs/categories.js';
import { detectEducation, educationMatches, qualifyingKeys } from '../src/services/jobs/education.js';
import { splitLocation } from '../src/services/jobs/india.js';
import { grounded, titleMatches } from '../src/services/jobs/verify.js';
import {
  detectExperience,
  extractJsonLdJobs,
  extractPhones,
  isListingPage,
  jobKey,
  parseJobPrompt,
  parsePostedAt,
  parseResultTitle,
  platformOf,
} from '../src/services/jobs/parse.js';

test('detects fresher and experienced jobs', () => {
  assert.equal(detectExperience('Junior Developer', 'Freshers can apply').level, 'fresher');
  assert.deepEqual(detectExperience('Backend Developer', 'Experience: 2-4 years in Node.js'), { level: 'experienced', text: '2-4 years' });
  assert.equal(detectExperience('Telecaller', 'Experience 0-1 years').level, 'fresher');
  assert.equal(detectExperience('Accountant', 'Minimum 3+ years of experience').text, '3+ years');
  assert.equal(detectExperience('Cook', 'Good food').level, null);
});

test('parses relative posted dates', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  assert.equal(parsePostedAt('4 days ago', now).toISOString(), '2026-09-25T12:00:00.000Z');
  assert.equal(parsePostedAt('30+ days ago', now).toISOString(), '2026-08-30T12:00:00.000Z');
  assert.equal(parsePostedAt('an hour ago', now).toISOString(), '2026-09-29T11:00:00.000Z');
  assert.equal(parsePostedAt('2026-09-20', now).toISOString().slice(0, 10), '2026-09-20');
  assert.equal(parsePostedAt('Full-time', now), null);
});

test('maps URLs and "via" labels to platforms', () => {
  assert.equal(platformOf('https://in.linkedin.com/jobs/view/123'), 'LinkedIn');
  assert.equal(platformOf('https://apna.co/job/ahmedabad/telecaller-1'), 'Apna');
  assert.equal(platformOf('https://www.workindia.in/jobs/x'), 'WorkIndia');
  assert.equal(platformOf('https://x.com/acme/status/1'), 'X (Twitter)');
  assert.equal(platformOf('https://boards.greenhouse.io/acme/jobs/1'), 'Company careers page');
  assert.equal(platformOf('https://acme.in/careers'), 'Company website');
  assert.equal(platformOf('via Indeed'), 'Indeed');
});

test('extracts Indian phone numbers', () => {
  assert.deepEqual(extractPhones('Call 98765 43210 or +91-91234-56789, not 12345'), ['+91 98765 43210', '+91 91234 56789']);
});

test('parses job seeker prompts', () => {
  const p = parseJobPrompt('I want python developer job in Ahmedabad');
  assert.equal(p.role, 'python developer');
  assert.equal(p.location, 'Ahmedabad');
  assert.equal(parseJobPrompt('fresher telecaller jobs').level, 'fresher');
});

test('parses search result titles', () => {
  assert.deepEqual(parseResultTitle('Acme Corp hiring Python Developer in Ahmedabad, Gujarat, India | LinkedIn'), {
    companyName: 'Acme Corp',
    title: 'Python Developer',
    location: 'Ahmedabad, Gujarat, India',
  });
  assert.deepEqual(parseResultTitle('Telecaller - Demo Finserv - Surat, Gujarat - Indeed.com'), { title: 'Telecaller', companyName: 'Demo Finserv', location: 'Surat, Gujarat' });
  assert.ok(isListingPage('1,234 Python Jobs in Ahmedabad', 'https://www.naukri.com/python-jobs-in-ahmedabad'));
  assert.ok(!isListingPage('Acme Corp hiring Python Developer in Ahmedabad', 'https://in.linkedin.com/jobs/view/python-developer-123456789'));
});

test('extracts JobPosting JSON-LD', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Accountant',
    description: '<p>Tally &amp; GST</p><ul><li>B.Com</li></ul>',
    datePosted: '2026-09-20',
    hiringOrganization: { '@type': 'Organization', name: 'Demo Traders', sameAs: 'https://demo.in' },
    jobLocation: { '@type': 'Place', address: { streetAddress: 'Alkapuri', addressLocality: 'Vadodara', addressRegion: 'Gujarat', postalCode: '390007', addressCountry: 'IN' } },
    baseSalary: { '@type': 'MonetaryAmount', currency: 'INR', value: { minValue: 15000, maxValue: 20000, unitText: 'MONTH' } },
  })}</script>`;
  const [job] = extractJsonLdJobs(html);
  assert.equal(job.companyName, 'Demo Traders');
  assert.equal(job.address, 'Alkapuri, Vadodara, Gujarat, 390007, IN');
  assert.equal(job.salary, '₹15000 - ₹20000 / month');
  assert.match(job.description, /Tally & GST\n• B.Com/);
});

test('categorises, splits locations and builds stable keys', () => {
  assert.equal(detectCategory('Customer Support Executive - Voice Process'), 'bpo');
  assert.equal(detectCategory('Senior Java Developer'), 'it_software');
  assert.deepEqual(splitLocation('Ahmedabad, Gujarat, India'), { city: 'Ahmedabad', state: 'Gujarat' });
  assert.equal(
    jobKey({ title: 'Python Developer', companyName: 'Acme Pvt Ltd', location: 'Ahmedabad, Gujarat' }),
    jobKey({ title: 'python developer', companyName: 'ACME', location: 'Ahmedabad' }),
  );
});

test('detects education requirements', () => {
  assert.deepEqual(detectEducation('Qualification: 12th pass or any graduate'), ['12th', 'graduate']);
  assert.deepEqual(detectEducation('B.E./B.Tech in Computer Science'), ['be_btech']);
  assert.deepEqual(detectEducation('Eligibility: B.Com / M.Com with Tally'), ['bcom', 'mcom']);
  assert.deepEqual(detectEducation('Post Graduate in HR'), ['postgraduate']);
  assert.deepEqual(detectEducation('GNM or B.Sc Nursing'), ['nursing']);
  assert.deepEqual(detectEducation('Good communication skills'), []);
});

test('matches seeker education to job requirements', () => {
  assert.ok(educationMatches('be_btech', ['graduate']));
  assert.ok(educationMatches('graduate', ['12th']));
  assert.ok(educationMatches('12th', ['any']));
  assert.ok(educationMatches('12th', []));
  assert.ok(!educationMatches('12th', ['graduate']));
  assert.ok(!educationMatches('bcom', ['be_btech']));
  assert.ok(educationMatches('mba', ['postgraduate', 'mba']));
  assert.deepEqual(qualifyingKeys('10th'), ['any', '10th']);
});

test('verification helpers only accept facts present on the page', () => {
  const page = 'Acme Pvt Ltd is hiring a Python Developer in Ahmedabad. Salary ₹4-6 LPA. Qualification: B.Tech';
  assert.ok(titleMatches('Python Developer', page));
  assert.ok(!titleMatches('Java Architect', page));
  assert.equal(grounded('₹4-6 LPA', page), '₹4-6 LPA');
  assert.equal(grounded('₹10 LPA', page), '');
});

test('prompt parser picks up education', () => {
  assert.equal(parseJobPrompt('12th pass data entry job in Surat').education, '12th');
});

test('ad gate locks a search until the video ad is completed', () => {
  assert.equal(isAdLocked({ adGate: { required: true, seconds: 60 } }), true);
  assert.equal(isAdLocked({ adGate: { required: true, seconds: 60, completedAt: new Date() } }), false);
  assert.equal(isAdLocked({}), false);
  assert.deepEqual(publicAdGate({ adGate: { required: true, seconds: 60, watchedMs: 12500 } }), { required: true, seconds: 60, watchedSeconds: 12, completed: false });
});

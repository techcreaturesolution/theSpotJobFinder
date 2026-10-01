import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireAdmin, requireEmployer } from '../src/middleware/auth.js';
import { employerJobSchema, toPortalJob } from '../src/services/jobs/portalJobs.js';
import { employerProfileSchema, isProfileComplete, needsProfile, profileSchema } from '../src/services/profile.js';

const contact = { name: 'Ravi Shah', phone: '9876543210', state: 'Gujarat', city: 'Ahmedabad' };
const job = { title: 'Accountant', category: 'finance', city: 'Ahmedabad', state: 'Gujarat', description: 'Maintain books in Tally, GST filing, B.Com freshers welcome.', email: 'hr@shreetraders.in' };

test('employers need a company profile; seekers need level and education', () => {
  const employer = { role: 'employer', ...employerProfileSchema.parse({ ...contact, company: { name: 'Shree Traders' } }) };
  assert.equal(isProfileComplete(employer), true);
  assert.equal(needsProfile(employer), false);
  assert.equal(needsProfile({ role: 'employer', ...contact }), true);
  assert.throws(() => employerProfileSchema.parse({ ...contact, company: { name: '' } }), /company name/);
  assert.throws(() => employerProfileSchema.parse({ ...contact, company: { name: 'X Co', website: 'javascript:alert(1)' } }));
  assert.throws(() => employerProfileSchema.parse({ ...contact, role: 'admin', company: { name: 'X Co' } }));
  assert.throws(() => profileSchema.parse({ ...contact, company: { name: 'X Co' } }));
});

test('employer jobs need facts: description, location and a way to apply', () => {
  assert.equal(employerJobSchema.parse(job).title, 'Accountant');
  assert.throws(() => employerJobSchema.parse({ ...job, email: '' }), /apply link, HR email or contact number/);
  assert.throws(() => employerJobSchema.parse({ ...job, description: 'short' }), /at least 30/);
  assert.throws(() => employerJobSchema.parse({ ...job, city: '' }));
  assert.throws(() => employerJobSchema.parse({ ...job, validThrough: '2020-01-01' }), /in the past/);
  const parsed = employerJobSchema.parse({ ...job, companyName: 'Someone Else', active: true, importMethod: 'ai_auto' });
  assert.equal(parsed.companyName, undefined, 'company name always comes from the employer profile');
  assert.equal(parsed.active, undefined);
});

test('employer jobs are stored as portal jobs verified by the employer', () => {
  const data = toPortalJob({ ...employerJobSchema.parse(job), companyName: 'Shree Traders' }, 'employer');
  assert.equal(data.verification.method, 'employer');
  assert.deepEqual(data.emails, ['hr@shreetraders.in']);
  assert.equal(data.location, 'Ahmedabad, Gujarat, India');
});

test('employer routes accept only employers, and employers are not admins', () => {
  const pass = (mw, role) => {
    try {
      let ok = false;
      mw({ user: { role } }, {}, () => {
        ok = true;
      });
      return ok;
    } catch (err) {
      if (err.status === 403) return false;
      throw err;
    }
  };
  assert.deepEqual(['user', 'employer', 'admin', 'master'].map((r) => pass(requireEmployer, r)), [false, true, false, false]);
  assert.equal(pass(requireAdmin, 'employer'), false);
});

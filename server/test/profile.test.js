import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isProfileComplete, needsProfile, normalizePhone, profileSchema } from '../src/services/profile.js';
import { csvCell } from '../src/utils/csv.js';

const profile = { name: 'Asha Patel', phone: '+91 98765-43210', state: 'Gujarat', city: 'Ahmedabad', level: 'fresher', education: 'graduate' };

test('Indian mobile numbers are stored as 10 digits', () => {
  for (const v of ['9876543210', '+91 98765 43210', '919876543210', '098765-43210']) assert.equal(normalizePhone(v), '9876543210');
  for (const v of ['12345', '5876543210', '98765432101', '']) assert.equal(normalizePhone(v), null);
});

test('the profile form needs name, mobile, state, city, level and education', () => {
  const parsed = profileSchema.parse(profile);
  assert.equal(parsed.phone, '9876543210');
  assert.equal(isProfileComplete(parsed), true);
  assert.throws(() => profileSchema.parse({ ...profile, phone: '12345' }), /valid 10-digit/);
  assert.throws(() => profileSchema.parse({ ...profile, state: 'Atlantis' }));
  assert.throws(() => profileSchema.parse({ ...profile, education: 'any' }));
  assert.throws(() => profileSchema.parse({ ...profile, role: 'master' }));
});

test('only job seekers must finish their profile before searching', () => {
  assert.equal(needsProfile({ role: 'user', name: 'A' }), true);
  assert.equal(needsProfile({ role: 'user', ...profileSchema.parse(profile) }), false);
  assert.equal(needsProfile({ role: 'admin' }), false);
  assert.equal(needsProfile({ role: 'master' }), false);
});

test('client CSV cells are quoted and cannot run spreadsheet formulas', () => {
  assert.equal(csvCell('Ahmedabad'), 'Ahmedabad');
  assert.equal(csvCell('Patel, Asha'), '"Patel, Asha"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell(null), '');
});

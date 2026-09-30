import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.MASTER_ADMIN_EMAILS = 'boss@example.com';
process.env.ADMIN_EMAILS = 'ops@example.com,boss@example.com';

const { roleFor } = await import('../src/routes/auth.js');
const { effectiveSearchLimit, isStaff, startOfDay } = await import('../src/services/limits.js');
const { requireAdmin, requireMaster } = await import('../src/middleware/auth.js');

const settings = { dailySearchLimit: 20, staffUnlimitedSearch: true };

test('master admins come only from MASTER_ADMIN_EMAILS', () => {
  assert.equal(roleFor({ email: 'boss@example.com', role: 'user' }), 'master');
  assert.equal(roleFor({ email: 'someone@example.com', role: 'master' }), 'admin');
  assert.equal(roleFor({ email: 'someone@example.com', role: 'user' }), 'user');
});

test('ADMIN_EMAILS does not override a role set by the master admin', () => {
  assert.equal(roleFor({ email: 'ops@example.com', role: 'user', roleManaged: false }), 'admin');
  assert.equal(roleFor({ email: 'ops@example.com', role: 'user', roleManaged: true }), 'user');
});

test('per-user limit overrides the global limit; staff can be unlimited', () => {
  assert.equal(effectiveSearchLimit({ role: 'user', dailySearchLimit: null }, settings), 20);
  assert.equal(effectiveSearchLimit({ role: 'user' }, settings), 20);
  assert.equal(effectiveSearchLimit({ role: 'user', dailySearchLimit: 5 }, settings), 5);
  assert.equal(effectiveSearchLimit({ role: 'user', dailySearchLimit: 0 }, settings), 0);
  assert.equal(effectiveSearchLimit({ role: 'admin', dailySearchLimit: 5 }, settings), null);
  assert.equal(effectiveSearchLimit({ role: 'master' }, settings), null);
  assert.equal(effectiveSearchLimit({ role: 'admin', dailySearchLimit: 5 }, { ...settings, staffUnlimitedSearch: false }), 5);
  assert.equal(effectiveSearchLimit({ role: 'master' }, { ...settings, staffUnlimitedSearch: false }), 20);
  assert.ok(isStaff({ role: 'master' }) && isStaff({ role: 'admin' }) && !isStaff({ role: 'user' }));
});

test('days start at midnight India time', () => {
  const at = Date.parse('2026-03-10T20:00:00Z');
  assert.equal(startOfDay(at).toISOString(), '2026-03-10T18:30:00.000Z');
  assert.equal(startOfDay(Date.parse('2026-03-10T17:00:00Z')).toISOString(), '2026-03-09T18:30:00.000Z');
  assert.equal(startOfDay(at, 6).toISOString(), '2026-03-04T18:30:00.000Z');
});

test('admin routes accept admins and masters; master routes accept only masters', () => {
  const pass = (mw, role) => {
    try {
      let ok = false;
      mw({ user: { role } }, {}, () => {
        ok = true;
      });
      return ok;
    } catch (err) {
      return err.status === 403 ? false : Promise.reject(err);
    }
  };
  assert.deepEqual(['user', 'admin', 'master'].map((r) => pass(requireAdmin, r)), [false, true, true]);
  assert.deepEqual(['user', 'admin', 'master'].map((r) => pass(requireMaster, r)), [false, false, true]);
});

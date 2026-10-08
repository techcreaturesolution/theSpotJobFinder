import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const googleClient = new OAuth2Client(env.googleClientId);

function checkDomain(email) {
  if (!env.allowedEmailDomains.length) return;
  const domain = email.split('@')[1];
  if (!env.allowedEmailDomains.includes(domain)) {
    throw new HttpError(403, `Only ${env.allowedEmailDomains.join(', ')} accounts are allowed`);
  }
}

export function roleFor({ email, role, roleManaged } = {}) {
  const normalized = String(email || '').toLowerCase().trim();
  if (env.masterAdminEmails.includes(normalized)) return 'master';
  if (role === 'master') return 'admin';
  if (roleManaged && role) return role;
  if (env.adminEmails.includes(normalized)) return 'admin';
  return role || 'user';
}

async function upsertUser({ email, name, picture, googleId }) {
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  const role = roleFor({
    email: normalized,
    role: existing?.role,
    roleManaged: existing?.roleManaged,
  });

  const user = await User.findOneAndUpdate(
    { email: normalized },
    {
      $set: {
        name,
        picture,
        lastLoginAt: new Date(),
        role,
        ...(googleId ? { googleId } : {}),
      },
      $setOnInsert: { email: normalized },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!user.active) throw new HttpError(403, 'Account disabled');
  return user;
}

router.get('/config', (_req, res) => {
  res.json({
    googleClientId: env.googleClientId || null,
    devLoginEnabled: env.devLoginEnabled,
    allowedEmailDomains: env.allowedEmailDomains,
  });
});

router.post('/google', async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);
  if (!env.googleClientId) throw new HttpError(500, 'GOOGLE_CLIENT_ID is not configured on the server');
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: [env.googleClientId, ...env.googleMobileClientIds] });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified');
  }
  if (!payload?.email || !payload.email_verified) throw new HttpError(401, 'Google account email is not verified');
  checkDomain(payload.email.toLowerCase());
  const user = await upsertUser({
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    googleId: payload.sub,
  });
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.post('/email', async (req, res) => {
  const { email, name } = z.object({
    email: z.string().email('Please enter a valid email address'),
    name: z.string().optional(),
  }).parse(req.body);
  checkDomain(email.toLowerCase());
  const user = await upsertUser({ email, name: name || email.split('@')[0] });
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.post('/dev', async (req, res) => {
  if (!env.devLoginEnabled) throw new HttpError(404, 'Not found');
  const { email, name } = z.object({ email: z.string().email(), name: z.string().optional() }).parse(req.body);
  checkDomain(email.toLowerCase());
  const user = await upsertUser({ email, name: name || email.split('@')[0] });
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;

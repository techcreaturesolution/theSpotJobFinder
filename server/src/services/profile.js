import { z } from 'zod';
import { JOB_LEVELS } from '../models/JobPosting.js';
import { EDUCATION_KEYS } from './jobs/education.js';
import { INDIAN_STATES } from './jobs/india.js';

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export const isProfileComplete = (user) => Boolean(user?.name && user.phone && user.state && user.city && user.level && user.education);

export const needsProfile = (user) => user?.role === 'user' && !isProfileComplete(user);

export const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' }), z.NEVER)),
    state: z.enum(INDIAN_STATES, { message: 'Select your state' }),
    city: z
      .string()
      .trim()
      .min(2, 'Enter your city')
      .max(60)
      .regex(/^[\p{L} .'-]+$/u, 'Enter a valid city name'),
    level: z.enum(JOB_LEVELS, { message: 'Select fresher or experienced' }),
    education: z.enum(EDUCATION_KEYS.filter((k) => k !== 'any'), { message: 'Select your highest education' }),
  })
  .strict();

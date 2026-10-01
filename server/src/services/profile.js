import { z } from 'zod';
import { JOB_LEVELS } from '../models/JobPosting.js';
import { EDUCATION_KEYS } from './jobs/education.js';
import { INDIAN_STATES } from './jobs/india.js';

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

const hasContact = (user) => Boolean(user?.name && user.phone && user.state && user.city);

export const isProfileComplete = (user) =>
  user?.role === 'employer' ? Boolean(hasContact(user) && user.company?.name) : Boolean(hasContact(user) && user.level && user.education);

export const needsProfile = (user) => ['user', 'employer'].includes(user?.role) && !isProfileComplete(user);

const contactFields = {
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
};

export const profileSchema = z
  .object({
    ...contactFields,
    level: z.enum(JOB_LEVELS, { message: 'Select fresher or experienced' }),
    education: z.enum(EDUCATION_KEYS.filter((k) => k !== 'any'), { message: 'Select your highest education' }),
  })
  .strict();

export const employerProfileSchema = z
  .object({
    ...contactFields,
    company: z
      .object({
        name: z.string().trim().min(2, 'Enter your company name').max(120),
        website: z.union([z.string().trim().url('Enter a valid website (https://…)').refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL'), z.literal('')]).default(''),
        address: z.string().trim().max(300).default(''),
      })
      .strict(),
  })
  .strict();

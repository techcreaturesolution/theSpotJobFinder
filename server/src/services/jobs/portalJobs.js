import { z } from 'zod';
import { JOB_LEVELS, JobPosting } from '../../models/JobPosting.js';
import { HttpError } from '../../utils/httpError.js';
import { CATEGORY_KEYS } from './categories.js';
import { canonicalUrl, identityKey, uniquePhones } from './dedupe.js';
import { EDUCATION_KEYS } from './education.js';
import { extractPhones } from './parse.js';

export const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');

export const optionalUrl = z.union([httpUrl, z.literal('')]).default('');

export const portalJobSchema = z.object({
  title: z.string().trim().min(2).max(140),
  companyName: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORY_KEYS),
  level: z.union([z.enum(JOB_LEVELS), z.literal('')]).default(''),
  experienceText: z.string().trim().max(60).default(''),
  education: z.array(z.enum(EDUCATION_KEYS)).max(8).default([]),
  educationText: z.string().trim().max(200).default(''),
  validThrough: z.union([z.null(), z.literal(''), z.coerce.date()]).optional(),
  description: z.string().trim().max(8000).default(''),
  city: z.string().trim().max(60).default(''),
  state: z.string().trim().max(60).default(''),
  address: z.string().trim().max(300).default(''),
  email: z.union([z.string().trim().email(), z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  companyWebsite: optionalUrl,
  applyUrl: optionalUrl,
  sourceUrl: optionalUrl,
  importMethod: z.union([z.enum(['ai_paste', 'ai_auto']), z.literal('')]).default(''),
  salary: z.string().trim().max(80).default(''),
  employmentType: z.string().trim().max(40).default(''),
  active: z.boolean().default(true),
});

export const employerJobSchema = portalJobSchema
  .omit({ companyName: true, sourceUrl: true, importMethod: true, active: true })
  .extend({
    description: z.string().trim().min(30, 'Describe the job in at least 30 characters').max(8000),
    city: z.string().trim().min(2, 'Enter the job city').max(60),
    state: z.string().trim().min(2, 'Select the job state').max(60),
  })
  .refine((d) => d.applyUrl || d.email || d.phone, { message: 'Add an apply link, HR email or contact number', path: ['applyUrl'] })
  .refine((d) => !d.validThrough || new Date(d.validThrough).getTime() >= Date.now() - 86400_000, { message: 'Last date to apply is in the past', path: ['validThrough'] });

export function toPortalJob(d, method = 'portal') {
  const { email, phone, level, importMethod, ...rest } = d;
  return {
    ...rest,
    level: level || null,
    importMethod: importMethod || null,
    sourceKey: canonicalUrl(d.sourceUrl),
    location: [d.city, d.state, 'India'].filter(Boolean).join(', '),
    emails: email ? [email.toLowerCase()] : [],
    phones: phone ? uniquePhones(extractPhones(phone).length ? extractPhones(phone) : [phone]) : [],
    platform: 'This portal',
    via: 'This portal',
    applyOptions: d.applyUrl ? [{ title: d.companyName, link: d.applyUrl }] : [],
    validThrough: d.validThrough || null,
    verification: { status: 'verified', method, checkedAt: new Date() },
  };
}

export async function assertNotDuplicate(data, exceptId) {
  const dedupeKey = identityKey(data);
  const dup =
    dedupeKey &&
    (await JobPosting.exists({
      dedupeKey,
      origin: 'portal',
      $or: [{ active: true }, { 'review.status': 'pending' }],
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    }));
  if (dup) throw new HttpError(409, 'This job (same title, company and city) is already posted');
  return dedupeKey;
}

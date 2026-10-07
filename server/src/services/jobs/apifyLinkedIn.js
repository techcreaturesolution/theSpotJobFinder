import axios from 'axios';
import { env } from '../../config/env.js';
import { extractContacts, parsePostedAt, stripHtml, detectExperience, parseResultTitle } from './parse.js';
import { verification } from './verify.js';
import { detectEducation } from './education.js';
import { INDIAN_STATES, splitLocation } from './india.js';

const text = (v) => stripHtml(String(v || '')).trim();

export function isApifyConfigured() {
  return Boolean(env.apify?.token);
}

export function apifyLinkedInConfigured() {
  return isApifyConfigured();
}

/**
 * Ensures the location query strictly targets India
 * e.g., 'Ahmedabad' -> 'Ahmedabad, India', '' -> 'India'
 */
export function ensureIndiaLocation(location) {
  const s = String(location || '').trim();
  if (!s || /^india$/i.test(s)) return 'India';
  if (/\bindia\b/i.test(s)) return s;
  return `${s}, India`;
}

const FOREIGN_LOCATIONS = [
  'united states', 'usa', 'u.s.a', 'united kingdom', 'uk', 'u.k.', 'canada', 'australia',
  'singapore', 'germany', 'dubai', 'uae', 'u.a.e.', 'philippines', 'pakistan', 'bangladesh',
  'malaysia', 'netherlands', 'france', 'poland', 'ireland', 'london', 'new york', 'california',
];

const MAJOR_INDIAN_CITIES = [
  'ahmedabad', 'bengaluru', 'bangalore', 'mumbai', 'delhi', 'new delhi', 'hyderabad', 'pune',
  'chennai', 'kolkata', 'surat', 'vadodara', 'noida', 'gurugram', 'gurgaon', 'jaipur', 'kochi',
  'coimbatore', 'indore', 'nagpur', 'chandigarh', 'bhopal', 'visakhapatnam', 'rajkot', 'gandhinagar',
  'navi mumbai', 'thane', 'ghaziabad', 'ludhiana', 'nashik', 'faridabad', 'meerut', 'varanasi',
  'lucknow', 'kanpur', 'patna', 'bhubaneswar', 'mysuru', 'mysore', 'trivandrum', 'thiruvananthapuram',
];

/**
 * Checks whether a job listing belongs strictly to India
 */
export function isIndiaJob(job) {
  const loc = String(job.location || '').toLowerCase();
  if (/\bindia\b/i.test(loc)) return true;

  // Check if location contains any explicit foreign location without mentioning India
  if (FOREIGN_LOCATIONS.some((fl) => loc.includes(fl))) {
    return false;
  }

  // Check if location contains any Indian State
  if (INDIAN_STATES.some((st) => loc.includes(st.toLowerCase()))) {
    return true;
  }

  // Check if location contains any major Indian city
  if (MAJOR_INDIAN_CITIES.some((city) => loc.includes(city))) {
    return true;
  }

  // If city/state is detected via splitLocation
  const { city, state } = splitLocation(job.location);
  if (city || state) return true;

  // If location is blank or just says 'Remote', only keep if India context is present
  return false;
}

/**
 * Maps postedWithin in days to Apify LinkedIn scraper datePosted filter
 */
export function mapDatePosted(postedWithin) {
  if (!postedWithin) return undefined;
  if (typeof postedWithin === 'string') return postedWithin;
  const days = Number(postedWithin);
  if (Number.isNaN(days)) return undefined;
  if (days <= 1) return 'past-24h';
  if (days <= 7) return 'past-week';
  return 'past-month';
}

/**
 * Normalizes a single raw item returned by kaix/linkedin-jobs-scraper
 */
export function mapApifyLinkedInJob(raw) {
  const title = text(raw.title || raw.jobTitle || raw.name);
  const parsedTitle = parseResultTitle(title);
  const companyName = text(
    raw.company ||
      raw.companyName ||
      raw.company_name ||
      raw.companyTitle ||
      raw.employer ||
      raw.employerName ||
      raw.hiringCompany ||
      raw.companyDetails?.name ||
      raw.hiringOrganization?.name ||
      parsedTitle.companyName ||
      '',
  );
  let rawLocation = text(raw.location || raw.jobLocation || raw.formattedLocation || raw.address);
  const description = text(raw.descriptionText || raw.description || raw.jobDescription || raw.descriptionHtml);
  const applyUrl = raw.link || raw.jobUrl || raw.applyUrl || raw.url || raw.linkedinUrl || raw.job_url;

  const contacts = extractContacts(description);
  const exp = detectExperience(title, description);

  const isRemote = Boolean(
    raw.workplaceTypes?.some?.((t) => String(t).toLowerCase().includes('remote')) ||
      /\bremote\b/i.test(rawLocation) ||
      /\bwork from home\b/i.test(title),
  );

  const loc = splitLocation(rawLocation);
  const location = rawLocation || (loc.city && loc.state ? `${loc.city}, ${loc.state}, India` : 'India');

  const rawPostedAt = raw.postedAt || raw.postedDate || raw.postedTime || raw.date;
  const postedAt = rawPostedAt ? (new Date(rawPostedAt).getTime() ? new Date(rawPostedAt) : parsePostedAt(rawPostedAt)) : null;

  return {
    title,
    companyName,
    companyWebsite: raw.companyWebsite || raw.companyLinkedinUrl || undefined,
    logo: raw.companyLogo || raw.logo || raw.company_logo || undefined,
    location,
    city: loc.city || '',
    state: loc.state || '',
    via: 'LinkedIn',
    platform: 'LinkedIn',
    description,
    applyUrl,
    applyOptions: applyUrl ? [{ title: 'LinkedIn', link: applyUrl }] : [],
    sourceUrl: applyUrl,
    postedAt,
    postedText: raw.postedTimeAgo || raw.postedText || '',
    employmentType: text(raw.employmentType || raw.jobType || raw.time || ''),
    salary: text(raw.salaryInfo || raw.salary || raw.baseSalary || ''),
    level: exp.level,
    experienceText: exp.text,
    education: detectEducation(title, description),
    workFromHome: isRemote,
    emails: contacts.emails,
    phones: contacts.phones,
    verification: verification('unverified', 'apify_linkedin'),
    provider: 'apify_linkedin',
  };
}

/**
 * Runs the Apify actor kaix/linkedin-jobs-scraper via Apify REST API,
 * strictly filtered for jobs located in India.
 * @param {Object} options
 * @param {string} options.keywords - Job title or keywords
 * @param {string} [options.location='India'] - Location within India (e.g. 'Ahmedabad', 'Bangalore', 'India')
 * @param {number} [options.limit=20] - Max jobs to retrieve
 * @param {string|number} [options.datePosted] - 'past-24h' | 'past-week' | 'past-month' or days
 * @param {Object} [options.extraInput] - Additional raw actor parameters
 * @param {number} [options.timeout=60000] - Request timeout in ms
 * @returns {Promise<Array>} List of normalized Indian jobs
 */
export async function scrapeLinkedInJobs({
  keywords = 'jobs',
  location = 'India',
  limit = 20,
  datePosted,
  extraInput = {},
  timeout = 60000,
} = {}) {
  const token = env.apify?.token;
  if (!token) {
    throw new Error('APIFY_TOKEN is not configured in server .env');
  }

  const actor = (env.apify?.actor || 'kaix/linkedin-jobs-scraper').trim();
  // Apify REST API expects actor name in format username~actor-name
  const actorId = actor.replace('/', '~');

  // Enforce search location to always be within India
  const indiaLocation = ensureIndiaLocation(location);

  const payload = {
    keywords: keywords || 'jobs',
    location: indiaLocation,
    limit: Math.min(100, Math.max(1, Number(limit) || 20)),
    ...(datePosted ? { datePosted: mapDatePosted(datePosted) || datePosted } : {}),
    ...extraInput,
  };

  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`;

  const { data } = await axios.post(url, payload, {
    params: {
      token,
      timeout: Math.round(timeout / 1000),
    },
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: timeout + 5000,
  });

  const items = Array.isArray(data) ? data : [];

  // Map to Job schema and strictly filter to only keep India jobs
  return items
    .map(mapApifyLinkedInJob)
    .filter((j) => Boolean(j.title) && isIndiaJob(j));
}

/**
 * Query search helper that integrates with query planner, strictly targeting India
 * @param {Object} plan - Query plan { role, place, city, state, ... }
 * @param {Object} [options] - Search options
 */
export async function searchApifyLinkedIn(plan, options = {}, log = () => {}) {
  if (!isApifyConfigured()) {
    log('info', 'Apify LinkedIn scraper skipped (APIFY_TOKEN not configured)');
    return [];
  }

  const keywords = [plan.userRole || plan.role, plan.eduWord, plan.levelWord].filter(Boolean).join(' ').trim() || plan.q || 'jobs';
  const targetLocation = ensureIndiaLocation(plan.city || plan.state || plan.place || 'India');
  const datePosted = mapDatePosted(options.postedWithin);

  try {
    log('info', `Running Apify LinkedIn scraper for "${keywords}" in "${targetLocation}"`);
    const jobs = await scrapeLinkedInJobs({
      keywords,
      location: targetLocation,
      limit: options.limit || 25,
      datePosted,
      timeout: options.timeout || 60000,
    });
    log('info', `Apify LinkedIn scraper returned ${jobs.length} verified India jobs`);
    return jobs;
  } catch (err) {
    log('warn', `Apify LinkedIn scraper failed: ${err.message}`);
    return [];
  }
}

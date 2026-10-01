import { env } from '../../config/env.js';
import { http } from '../../utils/http.js';
import { platformOf, stripHtml } from './parse.js';
import { verification } from './verify.js';

const PER_SOURCE = 30;
const POSTED_JSEARCH = { 1: 'today', 3: '3days', 7: 'week', 30: 'month' };

export const API_SOURCES = {
  jsearch: 'JSearch',
  adzuna: 'Adzuna',
  jooble: 'Jooble',
  careerjet: 'Careerjet',
};

export function apiSourcesConfigured() {
  return {
    jsearch: Boolean(env.jsearch.key),
    adzuna: Boolean(env.adzuna.appId && env.adzuna.appKey),
    jooble: Boolean(env.jooble.key),
    careerjet: Boolean(env.careerjet.key),
  };
}

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(typeof v === 'number' && v < 1e12 ? v * 1000 : v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const keywordsOf = (plan) => [plan.role, plan.eduWord, plan.levelWord].filter(Boolean).join(' ').trim() || 'jobs';
const placeOf = (plan) => [plan.city, plan.state].filter(Boolean).join(', ');
const text = (v) => stripHtml(String(v || '')).trim();
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function salaryRange(min, max, period = '') {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  if (!lo && !hi) return '';
  const range = lo && hi && lo !== hi ? `${inr(lo)} - ${inr(hi)}` : inr(lo || hi);
  return period ? `${range} ${period}` : range;
}

const listed = (source) => verification('unverified', `api_${source}`);

export function mapJSearch(r) {
  const options = (r.apply_options || []).filter((o) => o.apply_link).map((o) => ({ title: o.publisher, link: o.apply_link }));
  const applyUrl = r.job_apply_link || options[0]?.link || r.job_google_link;
  const highlights = Object.entries(r.job_highlights || {}).map(([title, items]) => ({ title, items: Array.isArray(items) ? items : [] }));
  const period = { YEAR: 'per year', MONTH: 'per month', HOUR: 'per hour' }[r.job_salary_period] || '';
  return {
    title: r.job_title,
    companyName: r.employer_name || '',
    companyWebsite: r.employer_website || undefined,
    logo: r.employer_logo || undefined,
    location: r.job_location || [r.job_city, r.job_state].filter(Boolean).join(', '),
    via: r.job_publisher || 'JSearch',
    platform: platformOf(applyUrl) || platformOf(r.job_publisher),
    description: r.job_description || '',
    highlights,
    applyUrl,
    applyOptions: options.length ? options : applyUrl ? [{ title: r.job_publisher || 'Apply', link: applyUrl }] : [],
    sourceUrl: r.job_google_link || applyUrl,
    postedAt: toDate(r.job_posted_at_datetime_utc || r.job_posted_at_timestamp),
    validThrough: toDate(r.job_offer_expiration_datetime_utc || r.job_offer_expiration_timestamp),
    employmentType: r.job_employment_type || '',
    salary: salaryRange(r.job_min_salary, r.job_max_salary, period),
    workFromHome: Boolean(r.job_is_remote),
    verification: listed('jsearch'),
    provider: 'jsearch',
  };
}

export function mapAdzuna(r) {
  const area = (r.location?.area || []).filter((a) => a && a !== 'India');
  return {
    title: text(r.title),
    companyName: r.company?.display_name || '',
    location: area.length ? [...area].reverse().join(', ') : r.location?.display_name || '',
    via: 'Adzuna',
    platform: 'Adzuna',
    description: text(r.description),
    applyUrl: r.redirect_url,
    applyOptions: r.redirect_url ? [{ title: 'Adzuna', link: r.redirect_url }] : [],
    sourceUrl: r.redirect_url,
    postedAt: toDate(r.created),
    employmentType: [r.contract_time, r.contract_type].filter(Boolean).join(', ').replace(/_/g, '-'),
    salary: Number(r.salary_is_predicted) ? '' : salaryRange(r.salary_min, r.salary_max, 'per year'),
    verification: listed('adzuna'),
    provider: 'adzuna',
  };
}

export function mapJooble(r) {
  const via = r.source ? platformOf(r.source.includes('.') ? `https://${r.source}` : r.source) || r.source : 'Jooble';
  return {
    title: text(r.title),
    companyName: r.company || '',
    location: r.location || '',
    via: via === 'Company website' ? r.source : via,
    platform: 'Jooble',
    description: text(r.snippet),
    applyUrl: r.link,
    applyOptions: r.link ? [{ title: 'Jooble', link: r.link }] : [],
    sourceUrl: r.link,
    postedAt: toDate(r.updated),
    employmentType: r.type || '',
    salary: r.salary || '',
    verification: listed('jooble'),
    provider: 'jooble',
  };
}

export function mapCareerjet(r) {
  return {
    title: text(r.title),
    companyName: r.company || '',
    location: r.locations || '',
    via: 'Careerjet',
    platform: 'Careerjet',
    description: text(r.description),
    applyUrl: r.url,
    applyOptions: r.url ? [{ title: 'Careerjet', link: r.url }] : [],
    sourceUrl: r.url,
    postedAt: toDate(r.date),
    salary: r.salary || '',
    verification: listed('careerjet'),
    provider: 'careerjet',
  };
}

async function searchJSearch(plan, { postedWithin }) {
  const { data } = await http.get(`https://${env.jsearch.host}/search`, {
    params: { query: plan.q, page: 1, num_pages: 1, country: 'in', ...(POSTED_JSEARCH[postedWithin] ? { date_posted: POSTED_JSEARCH[postedWithin] } : {}) },
    headers: { 'x-rapidapi-key': env.jsearch.key, 'x-rapidapi-host': env.jsearch.host },
    timeout: 25000,
  });
  return (data?.data || []).map(mapJSearch);
}

async function searchAdzuna(plan, { postedWithin }) {
  const where = placeOf(plan);
  const { data } = await http.get('https://api.adzuna.com/v1/api/jobs/in/search/1', {
    params: {
      app_id: env.adzuna.appId,
      app_key: env.adzuna.appKey,
      results_per_page: PER_SOURCE,
      what: keywordsOf(plan),
      ...(where ? { where } : {}),
      ...(postedWithin ? { max_days_old: postedWithin } : {}),
      'content-type': 'application/json',
    },
    timeout: 20000,
  });
  return (data?.results || []).map(mapAdzuna);
}

async function searchJooble(plan) {
  const { data } = await http.post(
    `${env.jooble.url.replace(/\/+$/, '')}/${encodeURIComponent(env.jooble.key)}`,
    { keywords: keywordsOf(plan), location: placeOf(plan) || 'India', page: 1, ResultOnPage: PER_SOURCE },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
  );
  return (data?.jobs || []).map(mapJooble);
}

async function searchCareerjet(plan, { client }) {
  if (!client?.ip || !client?.userAgent) return [];
  const location = placeOf(plan);
  const { data } = await http.get('https://search.api.careerjet.net/v4/query', {
    params: {
      locale_code: 'en_IN',
      keywords: keywordsOf(plan),
      ...(location ? { location } : {}),
      sort: 'date',
      page_size: PER_SOURCE,
      user_ip: client.ip,
      user_agent: client.userAgent,
    },
    auth: { username: env.careerjet.key, password: '' },
    headers: { Referer: env.careerjet.referer },
    timeout: 20000,
  });
  return data?.type === 'JOBS' ? (data.jobs || []).map(mapCareerjet) : [];
}

const SEARCHERS = { jsearch: searchJSearch, adzuna: searchAdzuna, jooble: searchJooble, careerjet: searchCareerjet };

export async function searchJobApis(plan, ctx = {}, log = () => {}) {
  const on = apiSourcesConfigured();
  const names = Object.keys(SEARCHERS).filter((n) => on[n]);
  const settled = await Promise.allSettled(names.map((n) => SEARCHERS[n](plan, ctx)));
  return settled.flatMap((res, i) => {
    if (res.status === 'fulfilled') return res.value.filter((j) => j.title && j.applyUrl);
    log('warn', `${API_SOURCES[names[i]]} failed: ${res.reason?.response?.status || ''} ${res.reason?.message}`.trim());
    return [];
  });
}

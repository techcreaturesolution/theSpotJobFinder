import { env } from '../../config/env.js';
import { http, isCompanyWebsite } from '../../utils/http.js';
import { mapsProvider, searchGoogleMaps } from '../sources/googleMaps.js';
import { webSearch, webSearchProvider } from '../sources/webSearch.js';
import { isListingPage, parseResultTitle, platformOf } from './parse.js';

export function jobProviders() {
  return {
    googleJobs: Boolean(env.serpApiKey),
    webSearch: webSearchProvider(),
    maps: mapsProvider() === 'openstreetmap' ? null : mapsProvider(),
  };
}

export async function searchGoogleJobs(q, num = 20) {
  if (!env.serpApiKey) return [];
  const out = [];
  let token;
  for (let page = 0; page < Math.ceil(Math.min(num, 30) / 10); page += 1) {
    const { data } = await http.get('https://serpapi.com/search.json', {
      params: { engine: 'google_jobs', q, location: 'India', gl: 'in', hl: 'en', api_key: env.serpApiKey, ...(token ? { next_page_token: token } : {}) },
      timeout: 30000,
    });
    for (const r of data.jobs_results || []) {
      const ext = r.detected_extensions || {};
      const via = String(r.via || '').replace(/^via\s+/i, '');
      out.push({
        title: r.title,
        companyName: r.company_name || '',
        location: r.location || '',
        via,
        platform: platformOf(r.apply_options?.[0]?.link) || platformOf(via),
        description: r.description || '',
        highlights: (r.job_highlights || []).map((h) => ({ title: h.title, items: h.items || [] })),
        applyOptions: (r.apply_options || []).filter((o) => o.link).map((o) => ({ title: o.title, link: o.link })),
        applyUrl: r.apply_options?.[0]?.link || r.share_link,
        sourceUrl: r.share_link,
        logo: r.thumbnail,
        postedText: ext.posted_at || '',
        employmentType: ext.schedule_type || '',
        salary: ext.salary || '',
        workFromHome: Boolean(ext.work_from_home),
        provider: 'google_jobs',
      });
    }
    token = data.serpapi_pagination?.next_page_token;
    if (!token || out.length >= num) break;
  }
  return out;
}

const JOB_BOARDS = ['apna.co', 'workindia.in', 'naukri.com', 'in.indeed.com', 'linkedin.com/jobs/view', 'foundit.in', 'shine.com', 'internshala.com'];
const SOCIAL = ['x.com', 'twitter.com', 'linkedin.com/posts', 'facebook.com', 'instagram.com'];

export function webJobQueries({ role, levelWord, place }) {
  const r = role ? `"${role}"` : '';
  const sites = (list) => `(${list.map((s) => `site:${s}`).join(' OR ')})`;
  return [
    { q: `${sites(JOB_BOARDS)} ${r} ${levelWord} job ${place}`.replace(/\s+/g, ' ').trim(), kind: 'board' },
    { q: `${sites(SOCIAL)} "hiring" ${r} ${levelWord} ${place} apply`.replace(/\s+/g, ' ').trim(), kind: 'social' },
    { q: `${r || 'jobs'} ${levelWord} careers "apply now" ${place} -site:naukri.com -site:indeed.com -site:linkedin.com`.replace(/\s+/g, ' ').trim(), kind: 'company' },
  ];
}

export async function searchWebJobs(params, perQuery = 10, log = () => {}) {
  if (!webSearchProvider()) return [];
  const queries = webJobQueries(params);
  const settled = await Promise.allSettled(queries.map((x) => webSearch(x.q, perQuery)));
  const out = [];
  settled.forEach((res, i) => {
    const { kind } = queries[i];
    if (res.status !== 'fulfilled') {
      log('warn', `web search (${kind}) failed: ${res.reason?.message}`);
      return;
    }
    for (const row of res.value) {
      if (!row.link || isListingPage(row.title, row.link)) continue;
      if (kind === 'company' && !isCompanyWebsite(row.link)) continue;
      const parsed = parseResultTitle(row.title);
      if (!parsed.title) continue;
      const platform = platformOf(row.link);
      out.push({
        title: kind === 'social' ? parsed.title.slice(0, 140) : parsed.title,
        companyName: parsed.companyName,
        location: parsed.location,
        via: platform,
        platform,
        description: row.snippet || '',
        applyUrl: row.link,
        applyOptions: [{ title: platform, link: row.link }],
        sourceUrl: row.link,
        provider: `web_${kind}`,
      });
    }
  });
  return out;
}

export async function lookupCompany(name, place) {
  if (!name || mapsProvider() === 'openstreetmap') return null;
  const rows = await searchGoogleMaps({ businessType: name, location: place }, 1, () => {});
  const first = rows[0];
  if (!first) return null;
  const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = n(name).slice(0, 6);
  if (a && !n(first.name).includes(a) && !n(name).includes(n(first.name).slice(0, 6))) return null;
  return { address: first.address, phone: first.phone, website: first.website };
}

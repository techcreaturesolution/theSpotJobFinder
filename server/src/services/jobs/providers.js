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
    linkedin: Boolean(env.apify?.token),
  };
}

export function googleJobsQueries(plan) {
  if (!plan) return [];
  const r = plan.role || plan.userRole || 'jobs';
  const place = plan.place || 'India';
  const levelWord = plan.levelWord || '';
  return [...new Set([
    plan.q,
    `${r} jobs in ${place}`,
    levelWord ? `${r} ${levelWord} hiring ${place}` : `${r} vacancy ${place}`,
  ].map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

export async function searchGoogleJobs(qOrQueries, num = 20, optsOrLog = {}) {
  if (!env.serpApiKey) return [];
  const options = typeof optsOrLog === 'function' ? {} : (optsOrLog || {});
  const log = typeof optsOrLog === 'function' ? optsOrLog : (options.log || (() => {}));
  const list = [].concat(qOrQueries).filter(Boolean);
  if (!list.length) return [];

  const location = options.place && options.place !== 'India' ? `${options.place}, India` : 'India';

  let chips;
  if (options.postedWithin === 1) chips = 'date_posted:today';
  else if (options.postedWithin === 3) chips = 'date_posted:3days';
  else if (options.postedWithin === 7) chips = 'date_posted:week';
  else if (options.postedWithin === 30) chips = 'date_posted:month';

  const out = [];
  const seenUrls = new Set();

  for (const q of list) {
    let currentChips = chips;
    let token;
    for (let page = 0; page < Math.ceil(Math.min(num, 30) / 10); page += 1) {
      try {
        const params = {
          engine: 'google_jobs',
          q,
          location,
          gl: 'in',
          hl: 'en',
          api_key: env.serpApiKey,
          ...(token ? { next_page_token: token } : {}),
          ...(currentChips ? { chips: currentChips } : {}),
        };
        const { data } = await http.get('https://serpapi.com/search.json', {
          params,
          timeout: 30000,
        });
        const results = data.jobs_results || [];
        if (currentChips && page === 0 && results.length === 0) {
          // If query with chips yielded 0 results, retry without chips to ensure jobs are found
          currentChips = undefined;
          continue;
        }
        for (const r of results) {
          const ext = r.detected_extensions || {};
          const extPosted =
            ext.posted_at ||
            (r.extensions || []).find((e) =>
              /\b(\d+|an?|one)\+?\s*(h|d|w|mo|m|min|minute|hour|hr|day|week|month|year)s?\s*(?:ago|earlier|back)?\b/i.test(e) ||
              /\b(today|yesterday|just (?:now|posted)|active)\b/i.test(e),
            ) ||
            '';
          const via = String(r.via || '').replace(/^via\s+/i, '');
          const applyOptions = (r.apply_options || []).filter((o) => o.link).map((o) => ({ title: o.title, link: o.link }));

          // Detect if job is from LinkedIn
          const linkedInOpt = applyOptions.find((o) => /linkedin\.com/i.test(o.link) || /linkedin/i.test(o.title));
          const isLinkedIn = /linkedin/i.test(via) || Boolean(linkedInOpt);

          // Find primary applyUrl
          let applyUrl = applyOptions[0]?.link || r.share_link;
          if (isLinkedIn && linkedInOpt?.link) {
            applyUrl = linkedInOpt.link;
          }

          if (applyUrl && seenUrls.has(applyUrl)) continue;
          if (applyUrl) seenUrls.add(applyUrl);

          const platform = isLinkedIn ? 'LinkedIn' : platformOf(applyUrl) || platformOf(via);

          const relatedCompanyWebsite = (r.related_links || []).find((l) => /website|homepage|official/i.test(l.text || '') && !/linkedin/i.test(l.link || ''))?.link;
          const relatedCompanyLinkedin = (r.related_links || []).find((l) => /linkedin\.com\/company/i.test(l.link || ''))?.link;

          out.push({
            title: r.title,
            companyName: r.company_name || '',
            companyWebsite: relatedCompanyWebsite || undefined,
            companyLinkedinUrl: relatedCompanyLinkedin || undefined,
            location: r.location || '',
            via,
            platform,
            description: r.description || '',
            highlights: (r.job_highlights || []).map((h) => ({ title: h.title, items: h.items || [] })),
            applyOptions,
            applyUrl,
            sourceUrl: r.share_link,
            logo: r.thumbnail,
            postedText: extPosted,
            employmentType: ext.schedule_type || '',
            salary: ext.salary || '',
            workFromHome: Boolean(ext.work_from_home),
            provider: 'google_jobs',
          });
        }
        token = data.serpapi_pagination?.next_page_token;
        if (!token || out.length >= num) break;
      } catch (err) {
        log('warn', `Google Jobs query failed: ${err.message}`);
        if (currentChips && page === 0) {
          currentChips = undefined;
          continue;
        }
        break;
      }
    }
    if (out.length >= num) break;
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
        postedText: row.date || '',
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

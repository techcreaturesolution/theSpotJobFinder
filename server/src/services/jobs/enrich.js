import * as cheerio from 'cheerio';
import { http, isCompanyWebsite, normalizeUrl, domainOf } from '../../utils/http.js';
import { crawlWebsite } from '../crawler.js';
import { categorizeEmail, extractEmails } from '../emails.js';
import { detectEducation } from './education.js';
import { detectExperience, extractContacts, extractJsonLdJobs, extractPhones, isJobBoardUrl, parsePostedAt } from './parse.js';
import { lookupCompany } from './providers.js';
import { uniqueEmails, uniquePhones } from './dedupe.js';
import { agentExtract, CLOSED_RE, titleMatches, verification } from './verify.js';

const NO_FETCH = /(^|\.)(google\.[a-z.]+|x\.com|twitter\.com|facebook\.com|instagram\.com|indeed\.com|glassdoor\.[a-z.]+)$/i;

function fetchable(url) {
  const d = domainOf(url);
  return Boolean(d && !NO_FETCH.test(d));
}

async function fetchJobPage(url) {
  const res = await http.get(url, { responseType: 'text', timeout: 8000, headers: { Accept: 'text/html,application/xhtml+xml' } });
  const html = String(res.data || '');
  const $ = cheerio.load(html);
  const mailto = [];
  $('a[href^="mailto:"]').each((_i, el) => mailto.push(...extractEmails(decodeURIComponent(($(el).attr('href') || '').slice(7).split('?')[0]))));
  const tel = [];
  $('a[href^="tel:"]').each((_i, el) => tel.push(...extractPhones(($(el).attr('href') || '').slice(4))));
  $('script:not([type="application/ld+json"]), style, noscript, svg, header, footer, nav').remove();
  const text = $('main').text() || $('body').text();
  return { ld: extractJsonLdJobs(html)[0] || null, text: text.replace(/\s+/g, ' ').slice(0, 20000), title: $('title').text().trim(), mailto, tel };
}

const rankEmails = (emails) =>
  [...new Set(emails.map((e) => e.toLowerCase()))].sort((a, b) => Number(categorizeEmail(b) === 'hr') - Number(categorizeEmail(a) === 'hr'));

export function companySiteFrom(job) {
  for (const u of [job.companyWebsite, job.applyUrl, job.sourceUrl]) {
    if (u && isCompanyWebsite(u) && !isJobBoardUrl(u)) {
      try {
        return new URL(normalizeUrl(u)).origin;
      } catch {
        /* ignore */
      }
    }
  }
  return '';
}

export async function enrichJob(job, place) {
  const out = { ...job, emails: [...(job.emails || [])], phones: [...(job.phones || [])] };
  const highlightText = (job.highlights || []).flatMap((h) => h.items || []).join('\n');
  const base = extractContacts(job.description, highlightText);
  out.emails.push(...base.emails);
  out.phones.push(...base.phones);

  const pageUrl = [job.sourceUrl, job.applyUrl].find((u) => u && fetchable(u));
  if (pageUrl) {
    try {
      const page = await fetchJobPage(pageUrl);
      const ld = page.ld;
      if (ld) {
        out.title ||= ld.title;
        if (!out.companyName || out.companyName.length < 2) out.companyName = ld.companyName || out.companyName;
        if (ld.description && ld.description.length > (out.description || '').length) out.description = ld.description;
        out.address ||= ld.address;
        out.postedAt ||= ld.postedAt;
        out.validThrough ||= ld.validThrough;
        out.employmentType ||= ld.employmentType;
        out.salary ||= ld.salary;
        out.experienceText ||= ld.experienceText;
        out.logo ||= ld.logo;
        out.workFromHome ||= ld.workFromHome;
        if (ld.companyWebsite && !isJobBoardUrl(ld.companyWebsite)) out.companyWebsite ||= ld.companyWebsite;
        if (ld.email) out.emails.push(...extractEmails(ld.email));
        if (ld.telephone) out.phones.push(...extractPhones(ld.telephone));
        if (ld.educationText) out.educationText ||= ld.educationText;
      }
      const expiredByDate = out.validThrough && new Date(out.validThrough).getTime() < Date.now();
      if (expiredByDate || CLOSED_RE.test(`${page.title} ${page.text.slice(0, 4000)}`)) out.expired = true;

      if (!out.expired && ld && titleMatches(out.title, `${ld.title} ${page.title}`)) {
        out.verification = verification('verified', 'json_ld');
      } else if (!out.expired) {
        const ai = await agentExtract(page.text).catch(() => null);
        if (ai?.isClosed) out.expired = true;
        else if (ai?.isJobPosting && titleMatches(out.title, `${ai.title} ${page.title}`)) {
          out.verification = verification('verified', 'ai_agent');
          if (ai.companyName && (!out.companyName || out.companyName.length < 2)) out.companyName = ai.companyName;
          out.address ||= ai.address;
          out.salary ||= ai.salary;
          out.employmentType ||= ai.employmentType;
          out.experienceText ||= ai.experienceText;
          out.educationText ||= ai.educationText;
          if (ai.education.length) out.education = [...new Set([...(out.education || []), ...ai.education])];
          if (ai.lastDate) out.validThrough ||= parsePostedAt(ai.lastDate);
          if (ai.email) out.emails.push(...extractEmails(ai.email));
          out.phones.push(...ai.phones);
        } else if (!ai && titleMatches(out.title, page.title) && page.text.length > 500) {
          out.verification = verification('verified', 'source_page');
        }
      }

      const c = extractContacts(ld ? ld.description : page.text);
      out.emails.push(...page.mailto, ...c.emails);
      out.phones.push(...page.tel, ...c.phones);
      if (!out.education?.length) out.education = detectEducation(out.educationText, ld?.description || page.text.slice(0, 6000));
      if (!out.experienceText) {
        const exp = detectExperience(out.title, ld?.description || page.text.slice(0, 5000));
        if (exp.level) {
          out.level ||= exp.level;
          out.experienceText = exp.text;
        }
      }
    } catch (err) {
      if ([404, 410].includes(err.response?.status)) out.expired = true;
    }
  }

  out.companyWebsite = companySiteFrom(out) || out.companyWebsite || '';

  if ((!out.address || !out.phones.length || !out.companyWebsite) && out.companyName) {
    try {
      const hit = await lookupCompany(out.companyName, out.city || place);
      if (hit) {
        out.address ||= hit.address || '';
        if (hit.phone) out.phones.push(hit.phone);
        if (!out.companyWebsite && hit.website && isCompanyWebsite(hit.website)) out.companyWebsite = normalizeUrl(hit.website);
      }
    } catch {
      /* maps lookup failed */
    }
  }

  if (!out.emails.length && out.companyWebsite) {
    try {
      const site = await crawlWebsite(out.companyWebsite, { maxPages: 3 });
      out.emails.push(...site.emails.map((e) => e.email));
      if (site.phone) out.phones.push(...(extractPhones(site.phone).length ? extractPhones(site.phone) : [site.phone]));
    } catch {
      /* crawl failed */
    }
  }

  out.emails = rankEmails(uniqueEmails(out.emails)).slice(0, 5);
  out.phones = uniquePhones(out.phones).slice(0, 4);
  out.enrichedAt = new Date();
  return out;
}

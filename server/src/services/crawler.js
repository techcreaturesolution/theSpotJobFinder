import * as cheerio from 'cheerio';
import { http, normalizeUrl, domainOf } from '../utils/http.js';
import { extractEmails, decodeCfEmail } from './emails.js';

const PRIORITY_PATHS = /(career|jobs?|hiring|join|recruit|hr|contact|reach|about|team|people|work-with-us)/i;
const FALLBACK_PATHS = ['/contact', '/contact-us', '/careers', '/career', '/about-us'];
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6}/g;

async function fetchHtml(url) {
  const res = await http.get(url, { responseType: 'text', headers: { Accept: 'text/html,application/xhtml+xml' } });
  const type = String(res.headers['content-type'] || '');
  if (type && !type.includes('html')) return null;
  return { html: String(res.data || ''), finalUrl: res.request?.res?.responseUrl || url };
}

function parsePage(html, baseUrl) {
  const $ = cheerio.load(html);
  const emails = new Set();
  $('a[href^="mailto:"]').each((_i, el) => {
    const addr = decodeURIComponent(($(el).attr('href') || '').replace(/^mailto:/i, '').split('?')[0]);
    extractEmails(addr).forEach((e) => emails.add(e));
  });
  $('[data-cfemail]').each((_i, el) => {
    extractEmails(decodeCfEmail($(el).attr('data-cfemail') || '')).forEach((e) => emails.add(e));
  });
  $('script, style, noscript, svg').remove();
  const text = cheerio
    .load(($('body').html() || '').replace(/<[^>]+>/g, ' '))
    .root()
    .text()
    .replace(/\s+/g, ' ');
  const deobfuscated = text.replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  extractEmails(deobfuscated).forEach((e) => emails.add(e));

  const links = { internal: [], linkedin: null, instagram: null, facebook: null };
  const baseDomain = domainOf(baseUrl);
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    let abs;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const d = domainOf(abs);
    if (!d) return;
    if (d.endsWith('linkedin.com') && /\/company\//.test(abs)) links.linkedin ||= abs.split('?')[0];
    else if (d.endsWith('instagram.com')) links.instagram ||= abs.split('?')[0];
    else if (d.endsWith('facebook.com')) links.facebook ||= abs.split('?')[0];
    else if (d === baseDomain && (PRIORITY_PATHS.test(abs) || PRIORITY_PATHS.test($(el).text()))) {
      links.internal.push(abs.split('#')[0]);
    }
  });

  let phone = null;
  const tel = $('a[href^="tel:"]').first().attr('href');
  if (tel) phone = tel.replace(/^tel:/i, '').trim();
  else {
    const m = text.match(PHONE_RE)?.find((p) => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13);
    if (m) phone = m.trim();
  }

  return { emails: [...emails], links, phone };
}

export async function crawlWebsite(website, { maxPages = 5 } = {}) {
  const start = normalizeUrl(website);
  if (!start) return { emails: [], pages: [] };
  const result = { emails: new Map(), pages: [], linkedinUrl: null, instagramUrl: null, facebookUrl: null, phone: null };
  const queue = [start];
  const seen = new Set();
  let origin;

  while (queue.length && result.pages.length < maxPages) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    let page;
    try {
      page = await fetchHtml(url);
    } catch {
      if (!origin) {
        try {
          origin = new URL(start).origin;
          FALLBACK_PATHS.forEach((p) => queue.push(origin + p));
        } catch {
          /* ignore */
        }
      }
      continue;
    }
    if (!page) continue;
    origin ||= new URL(page.finalUrl).origin;
    result.pages.push(url);
    const parsed = parsePage(page.html, page.finalUrl);
    parsed.emails.forEach((e) => {
      if (!result.emails.has(e)) result.emails.set(e, url);
    });
    result.linkedinUrl ||= parsed.links.linkedin;
    result.instagramUrl ||= parsed.links.instagram;
    result.facebookUrl ||= parsed.links.facebook;
    result.phone ||= parsed.phone;
    const next = [...new Set(parsed.links.internal)]
      .filter((u) => !seen.has(u))
      .sort((a, b) => Number(/career|job|hr|recruit|hiring/i.test(b)) - Number(/career|job|hr|recruit|hiring/i.test(a)));
    queue.push(...next.slice(0, 6));
    if (result.pages.length === 1 && !next.length) FALLBACK_PATHS.forEach((p) => queue.push(origin + p));
  }

  return {
    emails: [...result.emails.entries()].map(([email, foundOn]) => ({ email, foundOn })),
    pages: result.pages,
    linkedinUrl: result.linkedinUrl,
    instagramUrl: result.instagramUrl,
    facebookUrl: result.facebookUrl,
    phone: result.phone,
  };
}

import axios from 'axios';
import { env } from '../config/env.js';

export const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const http = axios.create({
  timeout: env.crawlTimeoutMs,
  maxRedirects: 5,
  maxContentLength: 3 * 1024 * 1024,
  headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
  validateStatus: (s) => s >= 200 && s < 400,
});

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function normalizeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function domainOf(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export const SOCIAL_OR_DIRECTORY_DOMAINS = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'justdial.com',
  'indiamart.com',
  'glassdoor.com',
  'glassdoor.co.in',
  'naukri.com',
  'ambitionbox.com',
  'clutch.co',
  'goodfirms.co',
  'wikipedia.org',
  'google.com',
  'maps.google.com',
  'sulekha.com',
  'tradeindia.com',
  'zaubacorp.com',
  'crunchbase.com',
  'indeed.com',
  'bing.com',
];

export function isCompanyWebsite(url) {
  const d = domainOf(url);
  if (!d) return false;
  return !SOCIAL_OR_DIRECTORY_DOMAINS.some((s) => d === s || d.endsWith(`.${s}`));
}

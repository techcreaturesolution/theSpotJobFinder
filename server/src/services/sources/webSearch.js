import * as cheerio from 'cheerio';
import { env } from '../../config/env.js';
import { http } from '../../utils/http.js';

async function serpApi(query, num) {
  const { data } = await http.get('https://serpapi.com/search.json', {
    params: { engine: 'google', q: query, num: Math.min(num, 100), api_key: env.serpApiKey, hl: 'en' },
    timeout: 30000,
  });
  return (data.organic_results || []).map((r) => ({ title: r.title, link: r.link, snippet: r.snippet || '', date: r.date || '' }));
}

async function googleCse(query, num) {
  const out = [];
  for (let start = 1; start <= Math.min(num, 50) && out.length < num; start += 10) {
    const { data } = await http.get('https://www.googleapis.com/customsearch/v1', {
      params: { key: env.googleCseKey, cx: env.googleCseCx, q: query, num: 10, start },
      timeout: 20000,
    });
    const items = data.items || [];
    out.push(...items.map((r) => ({ title: r.title, link: r.link, snippet: r.snippet || '' })));
    if (items.length < 10) break;
  }
  return out;
}

function decodeBingLink(href) {
  try {
    const u = new URL(href, 'https://www.bing.com');
    const enc = u.searchParams.get('u');
    if (u.hostname.endsWith('bing.com') && enc?.startsWith('a1')) {
      return Buffer.from(enc.slice(2), 'base64url').toString('utf8');
    }
    return u.toString();
  } catch {
    return href;
  }
}

async function bingHtml(query, num) {
  const out = [];
  for (let first = 1; first <= 41 && out.length < num; first += 10) {
    const { data } = await http.get('https://www.bing.com/search', {
      params: { q: query, first, setlang: 'en', count: 10 },
      timeout: 15000,
      responseType: 'text',
    });
    const $ = cheerio.load(data);
    const page = [];
    $('li.b_algo').each((_i, el) => {
      const a = $(el).find('h2 a').first();
      const link = decodeBingLink(a.attr('href') || '');
      const title = a.text().trim();
      const snippet = $(el).find('.b_caption p, .b_lineclamp2, .b_lineclamp3, .b_lineclamp4').first().text().trim();
      if (link && title) page.push({ title, link, snippet });
    });
    out.push(...page);
    if (!page.length) break;
  }
  return out;
}

export function webSearchProvider() {
  if (env.serpApiKey) return 'serpapi';
  if (env.googleCseKey && env.googleCseCx) return 'google_cse';
  if (env.enableFreeSearchFallback) return 'bing_html';
  return null;
}

export async function webSearch(query, num = 20) {
  const provider = webSearchProvider();
  if (provider === 'serpapi') return serpApi(query, num);
  if (provider === 'google_cse') return googleCse(query, num);
  if (provider === 'bing_html') return bingHtml(query, num);
  throw new Error('No web search provider configured (set SERPAPI_KEY or GOOGLE_CSE_KEY + GOOGLE_CSE_CX)');
}

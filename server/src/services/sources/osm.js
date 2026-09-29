import { env } from '../../config/env.js';
import { http } from '../../utils/http.js';

const TAG_RULES = [
  { match: /\b(it|software|tech|technology|saas|web|app|digital|computer)\b/i, filters: ['["office"~"^(it|company|software|telecommunication)$"]', '["shop"="computer"]'] },
  { match: /restaurant|cafe|food|hotel/i, filters: ['["amenity"~"^(restaurant|cafe|fast_food)$"]', '["tourism"="hotel"]'] },
  { match: /hospital|clinic|doctor|health|pharma/i, filters: ['["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]'] },
  { match: /school|college|university|education|institute|coaching/i, filters: ['["amenity"~"^(school|college|university)$"]', '["office"="educational_institution"]'] },
  { match: /real estate|builder|property/i, filters: ['["office"~"^(estate_agent|construction_company)$"]'] },
  { match: /manufactur|factory|industr/i, filters: ['["man_made"="works"]', '["industrial"]', '["office"="company"]'] },
  { match: /bank|finance|insurance|ca\b|account/i, filters: ['["amenity"="bank"]', '["office"~"^(financial|insurance|accountant|tax_advisor)$"]'] },
  { match: /lawyer|legal|advocate/i, filters: ['["office"="lawyer"]'] },
  { match: /gym|fitness/i, filters: ['["leisure"="fitness_centre"]'] },
];

function buildQuery(plan, limit) {
  const loc = (plan.location || '').replace(/"/g, '');
  const rule = TAG_RULES.find((r) => r.match.test(plan.businessType || ''));
  const keyword = (plan.keywords?.[0] || plan.businessType || '').replace(/["\\]/g, '');
  const filters = rule
    ? rule.filters.map((f) => `nwr${f}["name"](area.a);`)
    : [`nwr["name"~"${keyword}",i]["office"](area.a);`, `nwr["name"~"${keyword}",i]["shop"](area.a);`];
  return `[out:json][timeout:60];area["name"="${loc}"]["boundary"="administrative"]->.a;(${filters.join('')});out center tags ${Math.max(limit * 3, 60)};`;
}

export async function searchOsm(plan, limit, log) {
  if (!plan.location) {
    log('warn', 'OpenStreetMap fallback needs a location in the query');
    return [];
  }
  const query = buildQuery(plan, limit);
  let lastErr;
  for (const url of env.overpassUrls) {
    try {
      const { data } = await http.post(url, new URLSearchParams({ data: query }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TheSpotJobFinder/1.0 (+https://github.com/techcreaturesolution)', Accept: 'application/json' },
        timeout: 70000,
        responseType: 'json',
      });
      if (!data || !Array.isArray(data.elements)) throw new Error('Overpass returned no JSON');
      const rows = data.elements
        .filter((e) => e.tags?.name)
        .map((e) => {
          const t = e.tags;
          const address = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'], t['addr:city'] || plan.location, t['addr:postcode']]
            .filter(Boolean)
            .join(', ');
          return {
            name: t.name,
            category: t.office || t.shop || t.amenity || t.tourism || t.industrial || plan.businessType,
            address,
            city: t['addr:city'] || plan.location,
            phone: t.phone || t['contact:phone'],
            website: t.website || t['contact:website'] || t.url,
            email: t.email || t['contact:email'],
            linkedinUrl: t['contact:linkedin'],
            instagramUrl: t['contact:instagram'],
            facebookUrl: t['contact:facebook'],
            lat: e.lat ?? e.center?.lat,
            lng: e.lon ?? e.center?.lon,
            source: 'google_maps',
          };
        });
      rows.sort((a, b) => Number(Boolean(b.website || b.email)) - Number(Boolean(a.website || a.email)));
      log('info', `Maps (OpenStreetMap ${new URL(url).hostname}): ${rows.length} places`);
      return rows.slice(0, limit * 2);
    } catch (err) {
      lastErr = err;
      log('warn', `Overpass mirror ${new URL(url).hostname} failed: ${err.message}`);
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

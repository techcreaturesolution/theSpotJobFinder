import { env } from '../../config/env.js';
import { http, sleep } from '../../utils/http.js';
import { searchOsm } from './osm.js';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.location',
  'places.primaryTypeDisplayName',
  'nextPageToken',
].join(',');

async function placesTextSearch(textQuery, limit) {
  const results = [];
  let pageToken;
  do {
    const { data } = await http.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery, pageSize: 20, ...(pageToken ? { pageToken } : {}) },
      {
        headers: { 'X-Goog-Api-Key': env.googleMapsApiKey, 'X-Goog-FieldMask': FIELD_MASK },
        timeout: 20000,
      },
    );
    for (const p of data.places || []) {
      results.push({
        name: p.displayName?.text,
        category: p.primaryTypeDisplayName?.text,
        address: p.formattedAddress,
        phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
        website: p.websiteUri,
        rating: p.rating,
        reviewsCount: p.userRatingCount,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        source: 'google_maps',
      });
    }
    pageToken = data.nextPageToken;
    if (pageToken) await sleep(1500);
  } while (pageToken && results.length < limit);
  return results;
}

async function serpApiMaps(textQuery, limit) {
  const results = [];
  for (let start = 0; start < Math.min(limit, 120); start += 20) {
    const { data } = await http.get('https://serpapi.com/search.json', {
      params: { engine: 'google_maps', q: textQuery, type: 'search', start, api_key: env.serpApiKey, hl: 'en' },
      timeout: 30000,
    });
    const page = data.local_results || [];
    for (const p of page) {
      results.push({
        name: p.title,
        category: p.type,
        address: p.address,
        phone: p.phone,
        website: p.website,
        rating: p.rating,
        reviewsCount: p.reviews,
        lat: p.gps_coordinates?.latitude,
        lng: p.gps_coordinates?.longitude,
        source: 'google_maps',
      });
    }
    if (page.length < 20) break;
  }
  return results;
}

export function mapsProvider() {
  if (env.googleMapsApiKey) return 'google_places';
  if (env.serpApiKey) return 'serpapi_google_maps';
  return 'openstreetmap';
}

export async function searchGoogleMaps(plan, limit, log) {
  const textQuery = [plan.businessType, plan.location && `in ${plan.location}`].filter(Boolean).join(' ');
  const provider = mapsProvider();
  log('info', `Maps: searching "${textQuery}" via ${provider}`);
  if (provider === 'google_places') return placesTextSearch(textQuery, limit);
  if (provider === 'serpapi_google_maps') return serpApiMaps(textQuery, limit);
  return searchOsm(plan, limit, log);
}

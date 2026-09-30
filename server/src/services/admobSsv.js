import crypto from 'node:crypto';
import { http } from '../utils/http.js';

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEYS_TTL_MS = 12 * 3600_000;
let cache = { at: 0, keys: new Map() };

export async function verifierKeys({ refresh = false } = {}) {
  if (!refresh && cache.keys.size && Date.now() - cache.at < KEYS_TTL_MS) return cache.keys;
  const { data } = await http.get(KEYS_URL, { timeout: 8000 });
  cache = { at: Date.now(), keys: new Map((data.keys || []).map((k) => [String(k.keyId), k.pem])) };
  return cache.keys;
}

// AdMob rewarded-ad server-side verification: the signature covers the raw query string up to "&signature=".
export function verifySsv(rawQuery, keys) {
  const cut = rawQuery.indexOf('&signature=');
  if (cut < 0) return null;
  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature');
  const pem = keys.get(String(params.get('key_id')));
  if (!signature || !pem) return null;
  try {
    const ok = crypto.verify('sha256', Buffer.from(rawQuery.slice(0, cut)), pem, Buffer.from(signature, 'base64url'));
    return ok ? Object.fromEntries(params) : null;
  } catch {
    return null;
  }
}

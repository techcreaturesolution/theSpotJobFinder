import { Settings } from '../models/Settings.js';
import { setAiEnabled } from './agent/llm.js';

const TTL_MS = 30_000;
let cache = null;
let loadedAt = 0;

function remember(doc) {
  cache = doc;
  loadedAt = Date.now();
  setAiEnabled(doc.ai?.openaiEnabled !== false);
  return doc;
}

export async function getSettings({ fresh = false } = {}) {
  if (cache && !fresh && Date.now() - loadedAt < TTL_MS) return cache;
  const doc = await Settings.findOneAndUpdate(
    { _id: 'global' },
    { $setOnInsert: { _id: 'global' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  return remember(doc);
}

export async function updateSettings(patch, userId) {
  const $set = { updatedBy: userId };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) $set[`${k}.${sk}`] = sv;
    else $set[k] = v;
  }
  const doc = await Settings.findOneAndUpdate({ _id: 'global' }, { $set }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }).lean();
  return remember(doc);
}

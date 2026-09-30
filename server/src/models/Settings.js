import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { CACHE_MAX_HOURS } from './SearchCache.js';

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    dailySearchLimit: { type: Number, min: 0, max: 10000, default: env.dailyJobSearchLimit },
    staffUnlimitedSearch: { type: Boolean, default: true },
    ai: {
      openaiEnabled: { type: Boolean, default: true },
      extractEnabled: { type: Boolean, default: true },
      extractDailyLimit: { type: Number, min: 0, max: 10000, default: 200 },
      autoImportEnabled: { type: Boolean, default: true },
      autoImportDailyRuns: { type: Number, min: 0, max: 1000, default: 50 },
      autoImportDailyPosts: { type: Number, min: 0, max: 10000, default: 200 },
    },
    cache: {
      enabled: { type: Boolean, default: true },
      ttlHours: { type: Number, min: 1, max: CACHE_MAX_HOURS, default: 12 },
    },
    cleanup: {
      enabled: { type: Boolean, default: true },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Settings = mongoose.model('Settings', settingsSchema);

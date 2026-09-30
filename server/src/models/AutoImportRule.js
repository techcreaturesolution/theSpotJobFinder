import mongoose from 'mongoose';
import { JOB_LEVELS } from './JobPosting.js';

const autoImportRuleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    prompt: { type: String, trim: true, default: '' },
    category: { type: String, default: '' },
    level: { type: String, enum: [...JOB_LEVELS, ''], default: '' },
    education: { type: String, default: '' },
    state: { type: String, default: '' },
    city: { type: String, default: '' },
    everyHours: { type: Number, min: 1, max: 168, default: 24 },
    maxJobs: { type: Number, min: 1, max: 30, default: 10 },
    active: { type: Boolean, default: true },
    runningSince: Date,
    lastRunAt: Date,
    lastRun: {
      status: { type: String, enum: ['completed', 'failed'] },
      found: Number,
      posted: Number,
      duplicates: Number,
      skipped: Number,
      error: String,
      durationMs: Number,
    },
    totalPosted: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const AutoImportRule = mongoose.model('AutoImportRule', autoImportRuleSchema);

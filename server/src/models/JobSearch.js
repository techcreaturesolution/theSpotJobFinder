import mongoose from 'mongoose';
import { adGateDefinition } from './adGate.js';

const jobSearchSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prompt: { type: String, trim: true, default: '' },
    level: String,
    category: String,
    education: String,
    verifiedOnly: Boolean,
    state: String,
    city: String,
    postedWithin: Number,
    query: String,
    planner: String,
    providers: [String],
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running', index: true },
    error: String,
    resultCount: { type: Number, default: 0 },
    hiddenUnverified: { type: Number, default: 0 },
    durationMs: Number,
    adGate: adGateDefinition,
    jobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' }],
  },
  { timestamps: true },
);

jobSearchSchema.index({ 'adGate.transactionId': 1 }, { unique: true, sparse: true });

export const JobSearch = mongoose.model('JobSearch', jobSearchSchema);

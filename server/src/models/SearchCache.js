import mongoose from 'mongoose';

const searchCacheSchema = new mongoose.Schema(
  {
    _id: { type: String },
    label: String,
    plan: mongoose.Schema.Types.Mixed,
    providers: [String],
    jobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' }],
    hiddenUnverified: { type: Number, default: 0 },
    durationMs: Number,
    hits: { type: Number, default: 0 },
    lastHitAt: Date,
    refreshedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

searchCacheSchema.index({ jobs: 1 });

export const SearchCache = mongoose.model('SearchCache', searchCacheSchema);

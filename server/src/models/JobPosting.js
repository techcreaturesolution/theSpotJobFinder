import mongoose from 'mongoose';

export const JOB_LEVELS = ['fresher', 'experienced'];
export const JOB_ORIGINS = ['portal', 'aggregated'];
export const VERIFICATION_STATUSES = ['verified', 'unverified'];

const jobPostingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    dedupeKey: { type: String, index: true },
    origin: { type: String, enum: JOB_ORIGINS, default: 'aggregated', index: true },
    title: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: '' },
    companyWebsite: String,
    companyLinkedinUrl: String,
    logo: String,
    category: { type: String, index: true },
    level: { type: String, enum: [...JOB_LEVELS, null], default: null, index: true },
    experienceText: String,
    education: { type: [String], index: true },
    educationText: String,
    description: String,
    highlights: [{ _id: false, title: String, items: [String] }],
    location: String,
    city: { type: String, index: true },
    state: { type: String, index: true },
    address: String,
    employmentType: String,
    salary: String,
    workFromHome: Boolean,
    postedAt: { type: Date, index: true },
    postedText: String,
    validThrough: Date,
    platform: String,
    via: String,
    applyUrl: String,
    applyOptions: [{ _id: false, title: String, link: String }],
    sourceUrl: String,
    sourceKey: { type: String, index: true },
    importMethod: { type: String, enum: ['ai_paste', 'ai_auto', null], default: null },
    importRule: { type: mongoose.Schema.Types.ObjectId, ref: 'AutoImportRule' },
    emails: [String],
    phones: [String],
    enrichedAt: Date,
    verification: {
      status: { type: String, enum: VERIFICATION_STATUSES, default: 'unverified', index: true },
      method: String,
      checkedAt: Date,
    },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    active: { type: Boolean, default: true },
    applyClicks: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

jobPostingSchema.index({ title: 'text', companyName: 'text', description: 'text', category: 'text' }, { weights: { title: 10, companyName: 4, category: 3, description: 1 } });

export const JobPosting = mongoose.model('JobPosting', jobPostingSchema);

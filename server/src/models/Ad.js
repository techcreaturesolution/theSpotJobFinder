import mongoose from 'mongoose';

export const AD_PLACEMENTS = ['dashboard_banner', 'sidebar', 'inline', 'video'];

const adSchema = new mongoose.Schema(
  {
    advertiser: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    targetUrl: { type: String, required: true, trim: true },
    ctaText: { type: String, default: 'Learn more' },
    placement: { type: String, enum: AD_PLACEMENTS, default: 'dashboard_banner', index: true },
    priority: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    completedViews: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Ad = mongoose.model('Ad', adSchema);

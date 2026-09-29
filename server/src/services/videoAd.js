import { env } from '../config/env.js';
import { Ad } from '../models/Ad.js';
import { isAdLocked, publicAdGate } from '../models/adGate.js';
import { activeFilter } from '../routes/ads.js';
import { HttpError } from '../utils/httpError.js';

export const AD_EVENTS = ['play', 'tick', 'pause', 'complete'];
const BEAT_CREDIT_MS = 3000;

const DEMO_VIDEO_AD = {
  _id: null,
  advertiser: 'TheSpot JobFinder',
  title: 'Your brand here: 60 second video slot',
  description: 'Demo video ad. Add a video ad in Admin to replace it.',
  videoUrl: '/demo-video-ad.mp4',
  targetUrl: null,
  ctaText: 'Advertise with us',
  demo: true,
};

export function newAdGate(user) {
  const { required, seconds, exemptAdmins } = env.videoAd;
  return { required: required && !(exemptAdmins && user.role === 'admin'), seconds };
}

async function pickVideoAd() {
  const pool = await Ad.find({ ...activeFilter('video'), videoUrl: { $nin: [null, ''] } })
    .select('advertiser title description videoUrl targetUrl ctaText priority')
    .lean();
  if (!pool.length) return null;
  const total = pool.reduce((s, a) => s + 1 + Math.max(0, a.priority || 0), 0);
  let r = Math.random() * total;
  return pool.find((a) => (r -= 1 + Math.max(0, a.priority || 0)) < 0) || pool[0];
}

export async function adGateInfo(doc) {
  if (!isAdLocked(doc)) return { adGate: publicAdGate(doc), ad: null };
  let ad = doc.adGate.ad ? await Ad.findById(doc.adGate.ad).select('advertiser title description videoUrl targetUrl ctaText').lean() : null;
  if (!ad && !doc.adGate.startedAt) ad = await pickVideoAd();
  if (ad && !doc.adGate.ad) {
    doc.adGate.ad = ad._id;
    await doc.save();
  }
  return { adGate: publicAdGate(doc), ad: ad || DEMO_VIDEO_AD, vastTag: env.videoAd.vastTag || null };
}

export async function recordAdEvent(doc, event) {
  const g = doc.adGate;
  if (!isAdLocked(doc)) return publicAdGate(doc);
  const now = new Date();
  if (event === 'play') {
    if (!g.startedAt) {
      g.startedAt = now;
      if (g.ad) await Ad.updateOne({ _id: g.ad }, { $inc: { impressions: 1 } });
    }
    g.lastBeatAt = now;
  } else if (event === 'tick' || event === 'pause') {
    if (g.lastBeatAt) g.watchedMs = (g.watchedMs || 0) + Math.min(now - g.lastBeatAt, BEAT_CREDIT_MS);
    g.lastBeatAt = event === 'tick' ? now : null;
  } else {
    if (g.lastBeatAt) g.watchedMs = (g.watchedMs || 0) + Math.min(now - g.lastBeatAt, BEAT_CREDIT_MS);
    g.lastBeatAt = null;
    const remaining = Math.ceil((g.seconds * 1000 - g.watchedMs) / 1000);
    if (remaining > 1) {
      await doc.save();
      throw new HttpError(409, `Keep watching: ${remaining}s of the video ad left`);
    }
    g.completedAt = now;
    if (g.ad) await Ad.updateOne({ _id: g.ad }, { $inc: { completedViews: 1 } });
  }
  await doc.save();
  return publicAdGate(doc);
}

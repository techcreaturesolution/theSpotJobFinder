import { env } from '../config/env.js';
import { isAdLocked, publicAdGate } from '../models/adGate.js';
import { HttpError } from '../utils/httpError.js';

export const AD_EVENTS = ['play', 'tick', 'pause', 'complete'];
const BEAT_CREDIT_MS = 3000;

const DEMO_VIDEO = { title: 'Demo video ad', videoUrl: '/demo-video-ad.mp4', demo: true };

export function newAdGate(user) {
  const { required, seconds, exemptAdmins } = env.videoAd;
  return { required: required && !(exemptAdmins && ['admin', 'master'].includes(user.role)), seconds };
}

export function adGateInfo(doc) {
  if (!isAdLocked(doc)) return { adGate: publicAdGate(doc), vastTag: null, demo: null };
  return { adGate: publicAdGate(doc), vastTag: env.videoAd.vastTag || null, demo: env.videoAd.demo ? DEMO_VIDEO : null };
}

export async function recordAdEvent(doc, event) {
  const g = doc.adGate;
  if (!isAdLocked(doc)) return publicAdGate(doc);
  const now = new Date();
  const credit = () => {
    if (g.lastBeatAt) g.watchedMs = (g.watchedMs || 0) + Math.min(now - g.lastBeatAt, BEAT_CREDIT_MS);
  };
  if (event === 'play') {
    g.startedAt ||= now;
    g.lastBeatAt = now;
  } else if (event === 'tick' || event === 'pause') {
    credit();
    g.lastBeatAt = event === 'tick' ? now : null;
  } else {
    credit();
    g.lastBeatAt = null;
    const remaining = Math.ceil((g.seconds * 1000 - g.watchedMs) / 1000);
    if (remaining > 1) {
      await doc.save();
      throw new HttpError(409, `Keep watching: ${remaining}s of the video ad left`);
    }
    g.completedAt = now;
    g.method = 'watch';
  }
  await doc.save();
  return publicAdGate(doc);
}

export const adGateDefinition = {
  required: { type: Boolean, default: false },
  seconds: Number,
  method: { type: String, enum: ['watch', 'admob'] },
  transactionId: String,
  watchedMs: { type: Number, default: 0 },
  lastBeatAt: Date,
  startedAt: Date,
  completedAt: Date,
};

export const isAdLocked = (doc) => Boolean(doc?.adGate?.required && !doc.adGate.completedAt);

export function publicAdGate(doc) {
  const g = doc.adGate || {};
  return {
    required: Boolean(g.required),
    seconds: g.seconds || 0,
    watchedSeconds: Math.floor((g.watchedMs || 0) / 1000),
    completed: !isAdLocked(doc),
  };
}

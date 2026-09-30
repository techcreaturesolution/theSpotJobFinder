import mongoose from 'mongoose';

export const AGENTS = ['auto_import', 'ai_extract'];

const agentRunSchema = new mongoose.Schema(
  {
    agent: { type: String, enum: AGENTS, required: true },
    trigger: { type: String, enum: ['schedule', 'manual'], default: 'manual' },
    rule: { type: mongoose.Schema.Types.ObjectId, ref: 'AutoImportRule' },
    ruleName: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    method: String,
    found: { type: Number, default: 0 },
    posted: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    drafts: { type: Number, default: 0 },
    error: String,
    durationMs: Number,
  },
  { timestamps: true },
);

agentRunSchema.index({ agent: 1, createdAt: -1 });

export const AgentRun = mongoose.model('AgentRun', agentRunSchema);

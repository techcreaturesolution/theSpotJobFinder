import mongoose from 'mongoose';
import { isProfileComplete } from '../services/profile.js';
import { JOB_LEVELS } from './JobPosting.js';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    picture: String,
    phone: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    level: { type: String, enum: [...JOB_LEVELS, null], default: null },
    education: { type: String, default: null },
    profileUpdatedAt: Date,
    role: { type: String, enum: ['user', 'admin', 'master'], default: 'user' },
    roleManaged: { type: Boolean, default: false },
    dailySearchLimit: { type: Number, min: 0, max: 10000, default: null },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    picture: this.picture,
    phone: this.phone || '',
    state: this.state || '',
    city: this.city || '',
    level: this.level || '',
    education: this.education || '',
    profileComplete: isProfileComplete(this),
    role: this.role,
    dailySearchLimit: this.dailySearchLimit ?? null,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);

import mongoose from 'mongoose';

export const ROLES = ['user', 'admin', 'master'];

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    picture: String,
    role: { type: String, enum: ROLES, default: 'user' },
    roleManaged: { type: Boolean, default: false },
    dailySearchLimit: { type: Number, default: null },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    picture: this.picture,
    role: this.role,
    roleManaged: this.roleManaged,
    dailySearchLimit: this.dailySearchLimit,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);

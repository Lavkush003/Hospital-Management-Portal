const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_STATUS } = require('../constants/enums');
const env = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    phone: { type: String, trim: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ lastName: 1, firstName: 1 });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptSaltRounds);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    role: this.role,
    status: this.status,
    phone: this.phone,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('User', userSchema);

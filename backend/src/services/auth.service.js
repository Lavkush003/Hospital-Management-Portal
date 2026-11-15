const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  const valid = await user.comparePassword(password);
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is not active. Contact an administrator.', 'ACCOUNT_INACTIVE');
  }
  user.lastLoginAt = new Date();
  await user.save();
  return { user: user.toSafeJSON(), token: signToken(user) };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw ApiError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  return true;
}

module.exports = { signToken, login, changePassword };

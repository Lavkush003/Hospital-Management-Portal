const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function extractToken(req) {
  const cookieToken = req.cookies?.[env.cookieName];
  if (cookieToken) return cookieToken;
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token missing', 'AUTH_TOKEN_MISSING');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired authentication token', 'AUTH_TOKEN_INVALID');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'AUTH_USER_MISSING');
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is not active. Contact an administrator.', 'ACCOUNT_INACTIVE');
  }

  req.user = user;
  if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) throw ApiError.forbidden('No doctor profile linked to this account', 'DOCTOR_PROFILE_MISSING');
    req.doctor = doctor;
  }
  next();
});

module.exports = authenticate;
module.exports.extractToken = extractToken;

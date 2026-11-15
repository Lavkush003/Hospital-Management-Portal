const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { extractToken } = require('./authenticate');

module.exports = async function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'ACTIVE') req.user = user;
  } catch {
    // Ignore invalid tokens for optional authentication.
  }
  return next();
};

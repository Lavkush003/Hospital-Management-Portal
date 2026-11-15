const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' },
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isTest ? 100000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down and try again.' },
  },
});

module.exports = { authLimiter, apiLimiter };

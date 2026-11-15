const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    if (isTest) return `test-${name.toLowerCase()}-secret-value-000000000000`;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/hospital_management',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: required('JWT_SECRET', isTest ? 'test-jwt-secret-value-0000000000000000' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieName: process.env.AUTH_COOKIE_NAME || 'hms_token',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  seedPassword: process.env.SEED_DEFAULT_PASSWORD || 'HospitalPass123!',
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = env;

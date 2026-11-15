process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-0000000000000000';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4';
process.env.SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Hospital@12345';
process.env.LOG_LEVEL = 'silent';

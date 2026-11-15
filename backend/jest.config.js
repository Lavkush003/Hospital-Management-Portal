module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 60000,
  collectCoverageFrom: ['src/**/*.js', '!src/docs/**'],
  coverageDirectory: 'coverage',
};

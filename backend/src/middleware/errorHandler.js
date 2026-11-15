const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function normalizeError(error) {
  if (error instanceof ApiError) return error;
  if (error?.name === 'ValidationError') {
    return ApiError.unprocessable(
      'Database validation failed',
      'DATABASE_VALIDATION_ERROR',
      Object.values(error.errors || {}).map((item) => ({ path: item.path, message: item.message }))
    );
  }
  if (error?.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for ${error.path}`, 'INVALID_IDENTIFIER');
  }
  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue || error.keyPattern || {});
    return ApiError.conflict(
      `Duplicate value for ${fields.join(', ') || 'unique field'}`,
      'DUPLICATE_RESOURCE',
      { fields }
    );
  }
  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired authentication token', 'AUTH_TOKEN_INVALID');
  }
  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
}

module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const normalized = normalizeError(error);
  if (normalized.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }
  const body = {
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
    },
  };
  if (normalized.details) body.error.details = normalized.details;
  if (req.id) body.error.requestId = req.id;
  if (!env.isProduction && normalized.statusCode >= 500) body.error.stack = error.stack;
  res.status(normalized.statusCode).json(body);
};

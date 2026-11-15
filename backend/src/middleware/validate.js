const ApiError = require('../utils/ApiError');

module.exports = function validate(schemas) {
  return function validateMiddleware(req, res, next) {
    try {
      for (const key of ['params', 'query', 'body']) {
        if (schemas[key]) {
          req[key] = schemas[key].parse(req[key] || {});
        }
      }
      return next();
    } catch (error) {
      if (error?.issues) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        return next(ApiError.unprocessable('Request validation failed', 'VALIDATION_ERROR', details));
      }
      return next(error);
    }
  };
};

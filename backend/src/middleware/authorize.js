const ApiError = require('../utils/ApiError');

module.exports = function authorize(...roles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role does not permit this action', 'ROLE_FORBIDDEN'));
    }
    return next();
  };
};

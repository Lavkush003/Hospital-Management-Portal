const ApiError = require('../utils/ApiError');

module.exports = function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
};

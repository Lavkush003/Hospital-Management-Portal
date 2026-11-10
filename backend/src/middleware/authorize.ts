import type { RequestHandler } from 'express';
import { hasPermission, type Permission } from '../modules/auth/auth.permissions';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

export function requirePermission(permission: Permission): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(
        new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          'Authentication is required',
          'AUTHENTICATION_REQUIRED',
        ),
      );
      return;
    }

    if (!hasPermission(request.auth.user.role, permission)) {
      next(
        new AppError(
          HTTP_STATUS.FORBIDDEN,
          'Your role does not permit this operation',
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}

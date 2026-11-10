import type { RequestHandler } from 'express';
import { CSRF_TOKEN_COOKIE, parseCookies } from '../utils/auth-cookies';
import { timingSafeTokenEquals } from '../utils/auth-tokens';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

export const requireCsrfToken: RequestHandler = (request, _response, next) => {
  const cookies = parseCookies(request.headers.cookie);
  const cookieToken = cookies[CSRF_TOKEN_COOKIE];
  const headerToken = request.get('x-csrf-token');

  if (!cookieToken || !headerToken || !timingSafeTokenEquals(cookieToken, headerToken)) {
    next(
      new AppError(
        HTTP_STATUS.FORBIDDEN,
        'A valid CSRF token is required for this operation',
        'CSRF_TOKEN_INVALID',
      ),
    );
    return;
  }

  next();
};

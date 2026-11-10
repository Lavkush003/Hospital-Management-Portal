import type { Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { FixedWindowRateLimiter } from '../../utils/rate-limiter';
import { getClientIp } from '../../utils/request-metadata';

const loginAttemptLimiter = new FixedWindowRateLimiter(
  env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  env.AUTH_LOGIN_RATE_LIMIT_MAX,
);

const refreshRequestLimiter = new FixedWindowRateLimiter(
  env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
  env.AUTH_REFRESH_RATE_LIMIT_MAX,
);

export function createLoginRateLimitKey(request: Request, email: string): string {
  return `${getClientIp(request)}:${email.toLowerCase()}`;
}

export function assertLoginAllowed(response: Response, key: string): void {
  const decision = loginAttemptLimiter.check(key);

  if (!decision.allowed) {
    response.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new AppError(
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'Too many authentication attempts. Try again later.',
      'LOGIN_RATE_LIMITED',
    );
  }
}

export function recordFailedLogin(key: string): void {
  loginAttemptLimiter.consume(key);
}

export function resetLoginFailures(key: string): void {
  loginAttemptLimiter.reset(key);
}

export const refreshRateLimit: RequestHandler = (request, response, next) => {
  const decision = refreshRequestLimiter.consume(getClientIp(request));

  if (!decision.allowed) {
    response.setHeader('Retry-After', String(decision.retryAfterSeconds));
    next(
      new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        'Too many token refresh attempts. Try again later.',
        'REFRESH_RATE_LIMITED',
      ),
    );
    return;
  }

  next();
};

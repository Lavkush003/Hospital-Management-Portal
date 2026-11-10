import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const REFRESH_TOKEN_COOKIE = 'hms_refresh_token';
export const CSRF_TOKEN_COOKIE = 'hms_csrf_token';
export const AUTH_COOKIE_PATH = '/api/auth';
export const CSRF_COOKIE_PATH = '/';

function baseCookieOptions(path = AUTH_COOKIE_PATH): CookieOptions {
  return {
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex === -1) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();

    if (!name) {
      return cookies;
    }

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }

    return cookies;
  }, {});
}

export interface AuthCookieValues {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  csrfToken: string;
}

export function setAuthCookies(response: Response, values: AuthCookieValues): void {
  const refreshOptions = baseCookieOptions();
  const csrfOptions = baseCookieOptions(CSRF_COOKIE_PATH);

  response.cookie(REFRESH_TOKEN_COOKIE, values.refreshToken, {
    ...refreshOptions,
    httpOnly: true,
    expires: values.refreshTokenExpiresAt,
  });

  response.cookie(CSRF_TOKEN_COOKIE, values.csrfToken, {
    ...csrfOptions,
    httpOnly: false,
    expires: values.refreshTokenExpiresAt,
  });
}

export function clearAuthCookies(response: Response): void {
  const refreshOptions = baseCookieOptions();
  const csrfOptions = baseCookieOptions(CSRF_COOKIE_PATH);

  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...refreshOptions,
    httpOnly: true,
  });

  response.clearCookie(CSRF_TOKEN_COOKIE, {
    ...csrfOptions,
    httpOnly: false,
  });
}

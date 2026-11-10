import type { RequestHandler, Response } from 'express';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import {
  clearAuthCookies,
  parseCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from '../../utils/auth-cookies';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  assertLoginAllowed,
  createLoginRateLimitKey,
  recordFailedLogin,
  resetLoginFailures,
} from './auth.rate-limit';
import { changePassword, login, logout, refreshSession, type AuthSession } from './auth.service';
import type { ChangePasswordInput, LoginInput } from './auth.validators';

function setNoStoreHeaders(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
}

function sendSession(response: Response, session: AuthSession): void {
  setNoStoreHeaders(response);
  setAuthCookies(response, {
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    csrfToken: session.csrfToken,
  });

  response.status(HTTP_STATUS.OK).json({
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
    user: session.user,
  });
}

export const loginController: RequestHandler = async (request, response) => {
  const body = request.body as LoginInput;
  const rateLimitKey = createLoginRateLimitKey(request, body.email);
  assertLoginAllowed(response, rateLimitKey);

  try {
    const session = await login(body, getRequestMetadata(request, response));
    resetLoginFailures(rateLimitKey);
    sendSession(response, session);
  } catch (error) {
    if (error instanceof AppError && error.code === 'INVALID_CREDENTIALS') {
      recordFailedLogin(rateLimitKey);
    }

    throw error;
  }
};

export const refreshController: RequestHandler = async (request, response) => {
  const cookies = parseCookies(request.headers.cookie);

  try {
    const session = await refreshSession({
      refreshToken: cookies[REFRESH_TOKEN_COOKIE],
      requestMetadata: getRequestMetadata(request, response),
    });
    sendSession(response, session);
  } catch (error) {
    clearAuthCookies(response);
    throw error;
  }
};

export const logoutController: RequestHandler = async (request, response) => {
  const cookies = parseCookies(request.headers.cookie);

  try {
    await logout({
      refreshToken: cookies[REFRESH_TOKEN_COOKIE],
      requestMetadata: getRequestMetadata(request, response),
    });
  } finally {
    clearAuthCookies(response);
    setNoStoreHeaders(response);
  }

  response.status(HTTP_STATUS.NO_CONTENT).send();
};

export const meController: RequestHandler = (request, response) => {
  if (!request.auth) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Authentication is required',
      'AUTHENTICATION_REQUIRED',
    );
  }

  const user = request.auth.user;
  setNoStoreHeaders(response);
  response.status(HTTP_STATUS.OK).json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      ...(user.doctorId ? { doctorId: user.doctorId } : {}),
      ...(user.staffId ? { staffId: user.staffId } : {}),
    },
  });
};

export const changePasswordController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Authentication is required',
      'AUTHENTICATION_REQUIRED',
    );
  }

  const body = request.body as ChangePasswordInput;

  await changePassword({
    ...body,
    actorUserId: request.auth.user.id,
    requestMetadata: getRequestMetadata(request, response),
  });

  clearAuthCookies(response);
  setNoStoreHeaders(response);
  response.status(HTTP_STATUS.NO_CONTENT).send();
};

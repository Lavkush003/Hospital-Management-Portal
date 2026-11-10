import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma';
import { verifyAccessToken } from '../utils/auth-tokens';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

function mapAuthenticationError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error && error.name === 'TokenExpiredError') {
    return new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'The access token has expired',
      'ACCESS_TOKEN_EXPIRED',
    );
  }

  return new AppError(
    HTTP_STATUS.UNAUTHORIZED,
    'The access token is invalid',
    'INVALID_ACCESS_TOKEN',
  );
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const authorizationHeader = request.get('authorization');

    if (!authorizationHeader) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        'Authentication is required',
        'AUTHENTICATION_REQUIRED',
      );
    }

    const [scheme, token, ...extraParts] = authorizationHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token || extraParts.length > 0) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        'The access token is invalid',
        'INVALID_ACCESS_TOKEN',
      );
    }

    const claims = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        authVersion: true,
        doctor: { select: { id: true } },
        staff: { select: { id: true } },
      },
    });

    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        'The access token is invalid',
        'INVALID_ACCESS_TOKEN',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        'This account is not active',
        'ACCOUNT_INACTIVE',
      );
    }

    if (user.authVersion !== claims.ver || user.role !== claims.role) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        'The access token has been revoked',
        'ACCESS_TOKEN_REVOKED',
      );
    }

    request.auth = {
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
        doctorId: user.doctor?.id ?? null,
        staffId: user.staff?.id ?? null,
        authVersion: user.authVersion,
      },
      tokenId: claims.jti,
      tokenExpiresAt: claims.exp,
    };

    next();
  } catch (error) {
    next(mapAuthenticationError(error));
  }
};

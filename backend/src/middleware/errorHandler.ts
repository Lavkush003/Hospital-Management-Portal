import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

interface ErrorDetail {
  path: string;
  message: string;
}

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

function isInvalidJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && 'status' in error && error.status === 400;
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'request',
        message: issue.message,
      })),
    };
  }

  if (isInvalidJsonError(error)) {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HTTP_STATUS.CONFLICT,
          code: 'CONFLICT',
          message: 'A record with the provided values already exists',
        };
      case 'P2003':
        return {
          statusCode: HTTP_STATUS.CONFLICT,
          code: 'RELATION_CONFLICT',
          message: 'The operation conflicts with related data',
        };
      case 'P2025':
        return {
          statusCode: HTTP_STATUS.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        };
      default:
        return {
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
        };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is currently unavailable',
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DATABASE_VALIDATION_ERROR',
      message: 'A database validation error occurred',
    };
  }

  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  };
}

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const normalizedError = normalizeError(error);
  const requestIdHeader = response.getHeader('x-request-id');
  const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;
  const logContext = {
    err: error,
    requestId,
    method: request.method,
    path: request.originalUrl,
    statusCode: normalizedError.statusCode,
  };

  if (normalizedError.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error(logContext, normalizedError.message);
  } else {
    logger.warn(logContext, normalizedError.message);
  }

  response.status(normalizedError.statusCode).json({
    error: {
      message: normalizedError.message,
      code: normalizedError.code,
      ...(requestId ? { requestId } : {}),
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
    },
  });
};

import type { Request, Response } from 'express';
import { AppError } from './errors';
import { HTTP_STATUS } from './http-status';
import { idSchema } from './validation';
import type { AuthenticatedUser } from '../modules/auth/auth.types';

export function requireActor(request: Request): AuthenticatedUser {
  if (!request.auth) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Authentication is required',
      'AUTHENTICATION_REQUIRED',
    );
  }

  return request.auth.user;
}

export function getRouteId(request: Request, name: string): string {
  return idSchema.parse(request.params[name]);
}

export function setNoStore(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
}

export function getIdempotencyKey(request: Request, bodyKey?: string): string {
  const value = request.get('idempotency-key')?.trim() || bodyKey?.trim();

  if (!value) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'An Idempotency-Key header is required for this operation',
      'IDEMPOTENCY_KEY_REQUIRED',
    );
  }

  if (value.length < 8 || value.length > 200) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'Idempotency-Key must be between 8 and 200 characters',
      'IDEMPOTENCY_KEY_INVALID',
    );
  }

  return value;
}

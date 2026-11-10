import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      HTTP_STATUS.NOT_FOUND,
      `Route ${request.method} ${request.originalUrl} was not found`,
      'NOT_FOUND',
    ),
  );
};

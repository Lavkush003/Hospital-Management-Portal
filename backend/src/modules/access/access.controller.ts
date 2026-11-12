import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getClinicalSummary, listAuditLogs, listUsers } from './access.service';
import { auditLogListQuerySchema } from './access.validators';

const routeIdSchema = z.string().min(1);

function getActor(request: Request): AuthenticatedUser {
  if (!request.auth) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Authentication is required',
      'AUTHENTICATION_REQUIRED',
    );
  }

  return request.auth.user;
}

function getRouteId(request: Request, name: string): string {
  return routeIdSchema.parse(request.params[name]);
}

export const listUsersController: RequestHandler = async (request, response) => {
  const users = await listUsers(getActor(request), getRequestMetadata(request, response));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ users });
};

export const listAuditLogsController: RequestHandler = async (request, response) => {
  const result = await listAuditLogs(
    auditLogListQuerySchema.parse(request.query),
    getActor(request),
    getRequestMetadata(request, response),
  );
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({
    logs: result.logs,
    pagination: result.pagination,
  });
};

export const getClinicalSummaryController: RequestHandler = async (request, response) => {
  const summary = await getClinicalSummary(
    getRouteId(request, 'patientId'),
    getActor(request),
    getRequestMetadata(request, response),
  );

  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json(summary);
};

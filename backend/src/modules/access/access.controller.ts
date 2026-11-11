import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getClinicalSummary, getInvoice, listUsers } from './access.service';

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

export const listUsersController: RequestHandler = async (_request, response) => {
  const users = await listUsers();
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ users });
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

export const getInvoiceController: RequestHandler = async (request, response) => {
  const invoice = await getInvoice(getRouteId(request, 'invoiceId'));

  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ invoice });
};

import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  createPatient,
  getClinicalSummary,
  getDoctorSchedule,
  getInvoice,
  getPatient,
  listAppointments,
  listUsers,
} from './access.service';
import type { CreatePatientInput } from './access.validators';

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

export const createPatientController: RequestHandler = async (request, response) => {
  const patient = await createPatient(
    request.body as CreatePatientInput,
    getActor(request),
    getRequestMetadata(request, response),
  );

  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.CREATED).json({ patient });
};

export const getPatientController: RequestHandler = async (request, response) => {
  const patient = await getPatient(getRouteId(request, 'patientId'), getActor(request));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ patient });
};

export const getClinicalSummaryController: RequestHandler = async (request, response) => {
  const summary = await getClinicalSummary(getRouteId(request, 'patientId'), getActor(request));

  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json(summary);
};

export const listAppointmentsController: RequestHandler = async (request, response) => {
  const appointments = await listAppointments(getActor(request));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ appointments });
};

export const getDoctorScheduleController: RequestHandler = async (request, response) => {
  const doctor = await getDoctorSchedule(getRouteId(request, 'doctorId'), getActor(request));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ doctor });
};

export const getInvoiceController: RequestHandler = async (request, response) => {
  const invoice = await getInvoice(getRouteId(request, 'invoiceId'));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json({ invoice });
};

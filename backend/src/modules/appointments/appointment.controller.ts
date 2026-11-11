import type { RequestHandler } from 'express';
import { getIdempotencyKey, getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import { getDoctorAvailability, listAvailableDoctors } from './availability.service';
import {
  bookAppointment,
  cancelAppointment,
  getAppointment,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from './appointment.service';
import {
  appointmentListQuerySchema,
  availableDoctorsQuerySchema,
  availableSlotsQuerySchema,
  type AppointmentStatusBody,
  type BookAppointmentBody,
  type CancelAppointmentBody,
  type RescheduleAppointmentBody,
} from './appointment.validators';

export const listAppointmentsController: RequestHandler = async (request, response) => {
  const query = appointmentListQuerySchema.parse(request.query);
  const result = await listAppointments(query, requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const getAppointmentController: RequestHandler = async (request, response) => {
  const appointment = await getAppointment(
    getRouteId(request, 'appointmentId'),
    requireActor(request),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ appointment });
};

export const bookAppointmentController: RequestHandler = async (request, response) => {
  const body = request.body as BookAppointmentBody;
  const result = await bookAppointment(
    {
      actorUserId: requireActor(request).id,
      patientId: body.patientId,
      doctorId: body.doctorId,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      reason: body.reason,
      notes: body.notes,
      idempotencyKey: getIdempotencyKey(request, body.idempotencyKey),
    },
    getRequestMetadata(request, response),
  );

  if (result.replayed) {
    response.setHeader('Idempotency-Replayed', 'true');
  }

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({
    appointment: result.appointment,
    replayed: result.replayed,
  });
};

export const rescheduleAppointmentController: RequestHandler = async (request, response) => {
  const body = request.body as RescheduleAppointmentBody;
  const result = await rescheduleAppointment(
    {
      actorUserId: requireActor(request).id,
      appointmentId: getRouteId(request, 'appointmentId'),
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      reason: body.reason,
      idempotencyKey: getIdempotencyKey(request, body.idempotencyKey),
    },
    getRequestMetadata(request, response),
  );

  if (result.replayed) {
    response.setHeader('Idempotency-Replayed', 'true');
  }

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({
    appointment: result.appointment,
    replayed: result.replayed,
  });
};

export const cancelAppointmentController: RequestHandler = async (request, response) => {
  const body = request.body as CancelAppointmentBody;
  const result = await cancelAppointment(
    {
      actorUserId: requireActor(request).id,
      appointmentId: getRouteId(request, 'appointmentId'),
      cancellationReason: body.cancellationReason,
      idempotencyKey: getIdempotencyKey(request, body.idempotencyKey),
    },
    getRequestMetadata(request, response),
  );

  if (result.replayed) {
    response.setHeader('Idempotency-Replayed', 'true');
  }

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({
    appointment: result.appointment,
    replayed: result.replayed,
  });
};

export const updateAppointmentStatusController: RequestHandler = async (request, response) => {
  const body = request.body as AppointmentStatusBody;
  const appointment = await updateAppointmentStatus(
    {
      actorUserId: requireActor(request).id,
      appointmentId: getRouteId(request, 'appointmentId'),
      status: body.status,
      reason: body.reason,
    },
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ appointment });
};

export const availableDoctorsController: RequestHandler = async (request, response) => {
  const query = availableDoctorsQuerySchema.parse(request.query);
  const result = await listAvailableDoctors(query);

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const availableSlotsController: RequestHandler = async (request, response) => {
  const query = availableSlotsQuerySchema.parse(request.query);
  const result = await getDoctorAvailability(query.doctorId, {
    start: query.start,
    end: query.end,
  });

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

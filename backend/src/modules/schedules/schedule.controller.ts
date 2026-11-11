import type { RequestHandler } from 'express';
import { getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createLeave,
  createSchedule,
  createUnavailability,
  deleteLeave,
  deleteSchedule,
  deleteUnavailability,
  getDoctorSchedule,
  listDoctorLeaves,
  listDoctorSchedules,
  listDoctorUnavailability,
  updateSchedule,
} from './schedule.service';
import {
  leaveListQuerySchema,
  unavailabilityListQuerySchema,
  type LeaveCreateInput,
  type ScheduleCreateInput,
  type ScheduleUpdateInput,
  type UnavailabilityCreateInput,
} from './schedule.validators';

export const getDoctorScheduleController: RequestHandler = async (request, response) => {
  const doctor = await getDoctorSchedule(getRouteId(request, 'doctorId'), requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ doctor });
};

export const listDoctorSchedulesController: RequestHandler = async (request, response) => {
  const result = await listDoctorSchedules(getRouteId(request, 'doctorId'), requireActor(request));

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createScheduleController: RequestHandler = async (request, response) => {
  const schedule = await createSchedule(
    getRouteId(request, 'doctorId'),
    request.body as ScheduleCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ schedule });
};

export const updateScheduleController: RequestHandler = async (request, response) => {
  const schedule = await updateSchedule(
    getRouteId(request, 'doctorId'),
    getRouteId(request, 'scheduleId'),
    request.body as ScheduleUpdateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ schedule });
};

export const deleteScheduleController: RequestHandler = async (request, response) => {
  await deleteSchedule(
    getRouteId(request, 'doctorId'),
    getRouteId(request, 'scheduleId'),
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  response.status(HTTP_STATUS.NO_CONTENT).send();
};

export const listDoctorLeavesController: RequestHandler = async (request, response) => {
  const query = leaveListQuerySchema.parse(request.query);
  const result = await listDoctorLeaves(
    getRouteId(request, 'doctorId'),
    query,
    requireActor(request),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createLeaveController: RequestHandler = async (request, response) => {
  const leave = await createLeave(
    getRouteId(request, 'doctorId'),
    request.body as LeaveCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ leave });
};

export const deleteLeaveController: RequestHandler = async (request, response) => {
  await deleteLeave(
    getRouteId(request, 'doctorId'),
    getRouteId(request, 'leaveId'),
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  response.status(HTTP_STATUS.NO_CONTENT).send();
};

export const listDoctorUnavailabilityController: RequestHandler = async (request, response) => {
  const query = unavailabilityListQuerySchema.parse(request.query);
  const result = await listDoctorUnavailability(
    getRouteId(request, 'doctorId'),
    query,
    requireActor(request),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.OK).json(result);
};

export const createUnavailabilityController: RequestHandler = async (request, response) => {
  const unavailability = await createUnavailability(
    getRouteId(request, 'doctorId'),
    request.body as UnavailabilityCreateInput,
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ unavailability });
};

export const deleteUnavailabilityController: RequestHandler = async (request, response) => {
  await deleteUnavailability(
    getRouteId(request, 'doctorId'),
    getRouteId(request, 'unavailabilityId'),
    requireActor(request).id,
    getRequestMetadata(request, response),
  );

  response.status(HTTP_STATUS.NO_CONTENT).send();
};

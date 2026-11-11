import { Router } from 'express';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createLeaveController,
  createScheduleController,
  createUnavailabilityController,
  deleteLeaveController,
  deleteScheduleController,
  deleteUnavailabilityController,
  getDoctorScheduleController,
  listDoctorLeavesController,
  listDoctorSchedulesController,
  listDoctorUnavailabilityController,
  updateScheduleController,
} from './schedule.controller';
import {
  leaveCreateSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema,
  unavailabilityCreateSchema,
} from './schedule.validators';

export const doctorScheduleRoutes = Router({ mergeParams: true });

doctorScheduleRoutes.get(
  '/schedule',
  requirePermission(PERMISSIONS.SCHEDULES_READ),
  getDoctorScheduleController,
);

doctorScheduleRoutes.get(
  '/schedules',
  requirePermission(PERMISSIONS.SCHEDULES_READ),
  listDoctorSchedulesController,
);

doctorScheduleRoutes.post(
  '/schedules',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  validateBody(scheduleCreateSchema),
  createScheduleController,
);

doctorScheduleRoutes.patch(
  '/schedules/:scheduleId',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  validateBody(scheduleUpdateSchema),
  updateScheduleController,
);

doctorScheduleRoutes.delete(
  '/schedules/:scheduleId',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  deleteScheduleController,
);

doctorScheduleRoutes.get(
  '/leaves',
  requirePermission(PERMISSIONS.SCHEDULES_READ),
  listDoctorLeavesController,
);

doctorScheduleRoutes.post(
  '/leaves',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  validateBody(leaveCreateSchema),
  createLeaveController,
);

doctorScheduleRoutes.delete(
  '/leaves/:leaveId',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  deleteLeaveController,
);

doctorScheduleRoutes.get(
  '/unavailability',
  requirePermission(PERMISSIONS.SCHEDULES_READ),
  listDoctorUnavailabilityController,
);

doctorScheduleRoutes.post(
  '/unavailability',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  validateBody(unavailabilityCreateSchema),
  createUnavailabilityController,
);

doctorScheduleRoutes.delete(
  '/unavailability/:unavailabilityId',
  requirePermission(PERMISSIONS.SCHEDULES_MANAGE),
  deleteUnavailabilityController,
);

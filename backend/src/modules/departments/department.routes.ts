import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  assignDoctorsController,
  createDepartmentController,
  getDepartmentController,
  listDepartmentsController,
  updateDepartmentController,
} from './department.controller';
import {
  assignDoctorsSchema,
  departmentCreateSchema,
  departmentUpdateSchema,
} from './department.validators';

export const departmentRoutes = Router();

departmentRoutes.use(authenticate);

departmentRoutes.get(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENTS_READ),
  listDepartmentsController,
);

departmentRoutes.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validateBody(departmentCreateSchema),
  createDepartmentController,
);

departmentRoutes.get(
  '/:departmentId',
  requirePermission(PERMISSIONS.DEPARTMENTS_READ),
  getDepartmentController,
);

departmentRoutes.patch(
  '/:departmentId',
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validateBody(departmentUpdateSchema),
  updateDepartmentController,
);

departmentRoutes.post(
  '/:departmentId/doctors',
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validateBody(assignDoctorsSchema),
  assignDoctorsController,
);

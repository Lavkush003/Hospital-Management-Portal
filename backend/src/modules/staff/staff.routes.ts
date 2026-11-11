import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  changeStaffRoleController,
  changeStaffStatusController,
  createStaffController,
  getStaffController,
  listStaffController,
  updateStaffController,
} from './staff.controller';
import {
  staffCreateSchema,
  staffRoleSchemaUpdate,
  staffStatusSchemaUpdate,
  staffUpdateSchema,
} from './staff.validators';

export const staffRoutes = Router();

staffRoutes.use(authenticate);

staffRoutes.get('/', requirePermission(PERMISSIONS.STAFF_READ), listStaffController);

staffRoutes.post(
  '/',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(staffCreateSchema),
  createStaffController,
);

staffRoutes.get('/:staffId', requirePermission(PERMISSIONS.STAFF_READ), getStaffController);

staffRoutes.patch(
  '/:staffId',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(staffUpdateSchema),
  updateStaffController,
);

staffRoutes.patch(
  '/:staffId/status',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(staffStatusSchemaUpdate),
  changeStaffStatusController,
);

staffRoutes.patch(
  '/:staffId/role',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateBody(staffRoleSchemaUpdate),
  changeStaffRoleController,
);

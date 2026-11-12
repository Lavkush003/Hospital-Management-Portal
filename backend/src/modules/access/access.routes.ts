import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  getClinicalSummaryController,
  listAuditLogsController,
  listUsersController,
} from './access.controller';

export const accessRoutes = Router();

accessRoutes.use(authenticate);

accessRoutes.get('/admin/users', requirePermission(PERMISSIONS.USERS_MANAGE), listUsersController);

accessRoutes.get(
  '/admin/audit-logs',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  listAuditLogsController,
);

accessRoutes.get(
  '/patients/:patientId/clinical-summary',
  requirePermission(PERMISSIONS.CLINICAL_READ),
  getClinicalSummaryController,
);

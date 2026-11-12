import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../auth/auth.permissions';
import { adminReportsController, dashboardAnalyticsController } from './analytics.controller';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticate, requirePermission(PERMISSIONS.USERS_MANAGE));
analyticsRoutes.get('/analytics', dashboardAnalyticsController);
analyticsRoutes.get('/reports', adminReportsController);

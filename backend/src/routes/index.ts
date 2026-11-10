import { Router } from 'express';
import { accessRoutes } from '../modules/access/access.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { healthRoutes } from '../modules/health/health.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use(accessRoutes);

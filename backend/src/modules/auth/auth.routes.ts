import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireCsrfToken } from '../../middleware/csrf';
import { validateBody } from '../../middleware/validate';
import {
  changePasswordController,
  loginController,
  logoutController,
  meController,
  refreshController,
} from './auth.controller';
import { refreshRateLimit } from './auth.rate-limit';
import { changePasswordSchema, loginSchema } from './auth.validators';

export const authRoutes = Router();

authRoutes.post('/login', validateBody(loginSchema), loginController);
authRoutes.post('/refresh', refreshRateLimit, requireCsrfToken, refreshController);
authRoutes.post('/logout', refreshRateLimit, requireCsrfToken, logoutController);
authRoutes.get('/me', authenticate, meController);
authRoutes.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  changePasswordController,
);

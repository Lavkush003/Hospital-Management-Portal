import type { RequestHandler } from 'express';
import { healthService } from '../../services/health.service';
import { HTTP_STATUS } from '../../utils/http-status';

export const getHealth: RequestHandler = (_request, response) => {
  response.status(HTTP_STATUS.OK).json(healthService.getHealth());
};

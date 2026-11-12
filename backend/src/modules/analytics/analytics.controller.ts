import type { RequestHandler } from 'express';
import { HTTP_STATUS } from '../../utils/http-status';
import { analyticsQuerySchema, reportsQuerySchema } from './analytics.validators';
import { getAdminReports, getDashboardAnalytics } from './analytics.service';

export const dashboardAnalyticsController: RequestHandler = async (request, response) => {
  const result = await getDashboardAnalytics(analyticsQuerySchema.parse(request.query));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json(result);
};

export const adminReportsController: RequestHandler = async (request, response) => {
  const result = await getAdminReports(reportsQuerySchema.parse(request.query));
  response.setHeader('Cache-Control', 'no-store');
  response.status(HTTP_STATUS.OK).json(result);
};

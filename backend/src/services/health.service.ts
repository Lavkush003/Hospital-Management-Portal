import { env } from '../config/env';
import type { HealthResponse } from '../types/health.types';

const SERVICE_NAME = 'hospital-management-api';

export const healthService = {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: Number(process.uptime().toFixed(2)),
    };
  },
};

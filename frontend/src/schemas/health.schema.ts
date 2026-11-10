import { z } from 'zod';
import type { HealthResponse } from '@/types/health';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1),
  environment: z.enum(['development', 'test', 'production']),
  timestamp: z.iso.datetime(),
  uptime: z.number().nonnegative(),
}) satisfies z.ZodType<HealthResponse>;

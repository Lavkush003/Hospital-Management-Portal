import { z } from 'zod';
import { isoDateTimeSchema, paginationSchema } from '../../utils/validation';

const dateRangeSchema = z
  .object({
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
  })
  .strict()
  .refine((value) => value.to >= value.from, {
    message: 'to must be on or after from',
    path: ['to'],
  })
  .refine((value) => value.to.getTime() - value.from.getTime() <= 366 * 86_400_000, {
    message: 'Date range cannot exceed 366 days',
    path: ['to'],
  });

export const analyticsQuerySchema = dateRangeSchema;

export const reportsQuerySchema = dateRangeSchema
  .extend({
    page: paginationSchema.shape.page,
    pageSize: paginationSchema.shape.pageSize,
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

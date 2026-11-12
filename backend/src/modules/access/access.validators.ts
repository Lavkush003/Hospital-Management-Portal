import { z } from 'zod';
import { idSchema, isoDateTimeSchema, paginationSchema } from '../../utils/validation';

export const auditLogListQuerySchema = paginationSchema
  .extend({
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    actorUserId: idSchema.optional(),
    search: z.string().trim().min(1).max(200).optional(),
    outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine((value) => value.from === undefined || value.to === undefined || value.to > value.from, {
    message: 'to must be after from',
    path: ['to'],
  });

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

import { z } from 'zod';
import { isoDateTimeSchema } from '../../utils/validation';

const diagnosticReportStatusSchema = z.enum([
  'ORDERED',
  'COLLECTED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
]);

const diagnosticReportTypeSchema = z.enum(['LABORATORY', 'IMAGING', 'PATHOLOGY', 'OTHER']);

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const fileMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    mimeType: z.string().trim().min(3).max(200).optional(),
    sizeBytes: z.number().int().min(0).max(10_000_000_000).optional(),
    storageReference: z.string().trim().min(1).max(500).optional(),
    uploadedAt: isoDateTimeSchema.optional(),
  })
  .strict();

export const createReportBodySchema = z
  .object({
    testName: z.string().trim().min(1).max(200),
    type: diagnosticReportTypeSchema,
    orderedAt: isoDateTimeSchema
      .optional()
      .refine((value) => value === undefined || value.getTime() <= Date.now(), {
        message: 'orderedAt must not be in the future',
      }),
    resultSummary: optionalText(10_000),
    resultDetails: optionalText(20_000),
    fileMetadata: fileMetadataSchema.optional(),
  })
  .strict();

export const updateReportBodySchema = z
  .object({
    testName: z.string().trim().min(1).max(200).optional(),
    type: diagnosticReportTypeSchema.optional(),
    resultSummary: z.string().trim().min(1).max(10_000).nullish(),
    resultDetails: z.string().trim().min(1).max(20_000).nullish(),
    fileMetadata: fileMetadataSchema.nullish(),
    status: diagnosticReportStatusSchema.optional(),
    reason: optionalText(2_000),
  })
  .strict();

export type CreateReportBody = z.infer<typeof createReportBodySchema>;
export type UpdateReportBody = z.infer<typeof updateReportBodySchema>;

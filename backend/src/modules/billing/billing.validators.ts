import { z } from 'zod';
import { idSchema, isoDateTimeSchema, paginationSchema } from '../../utils/validation';

const invoiceStatusSchema = z.enum([
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
  'OVERDUE',
]);

const paymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'INSURANCE',
  'OTHER',
]);

const paymentStatusSchema = z.enum(['SUCCESSFUL', 'FAILED']);
const moneyPattern = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const moneySchema = z
  .union([z.string(), z.number().finite()])
  .refine((value) => moneyPattern.test(String(value)), {
    message: 'Amount must be non-negative with at most two decimal places',
  });
const positiveMoneySchema = moneySchema.refine((value) => Number(value) > 0, {
  message: 'Amount must be greater than zero',
});

const optionalText = (maxLength: number) =>
  z.string().trim().min(1, 'Value must not be empty when provided').max(maxLength).optional();

const invoiceItemSchema = z
  .object({
    description: z.string().trim().min(1).max(300),
    quantity: z.number().int().min(1).max(1_000_000),
    unitPrice: moneySchema,
    discountAmount: moneySchema.default('0'),
    taxAmount: moneySchema.default('0'),
  })
  .strict();

const invoiceDateFields = {
  invoiceDate: isoDateTimeSchema
    .optional()
    .refine((value) => value === undefined || value.getTime() <= Date.now(), {
      message: 'invoiceDate must not be in the future',
    }),
  dueAt: isoDateTimeSchema,
};

export const createInvoiceBodySchema = z
  .object({
    patientId: idSchema,
    visitId: idSchema.optional(),
    appointmentId: idSchema.optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).default('USD'),
    ...invoiceDateFields,
    items: z.array(invoiceItemSchema).min(1).max(100),
    notes: optionalText(5_000),
  })
  .strict()
  .refine(
    (value) => value.invoiceDate === undefined || value.dueAt >= value.invoiceDate,
    { message: 'dueAt must be on or after invoiceDate', path: ['dueAt'] },
  );

export const updateInvoiceBodySchema = z
  .object({
    patientId: idSchema.optional(),
    visitId: idSchema.nullish(),
    appointmentId: idSchema.nullish(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional(),
    invoiceDate: isoDateTimeSchema
      .optional()
      .refine((value) => value === undefined || value.getTime() <= Date.now(), {
        message: 'invoiceDate must not be in the future',
      }),
    dueAt: isoDateTimeSchema.optional(),
    items: z.array(invoiceItemSchema).min(1).max(100).optional(),
    notes: z.string().trim().max(5_000).nullish(),
  })
  .strict();

export const invoiceStatusBodySchema = z
  .object({
    status: z.enum(['ISSUED', 'OVERDUE', 'VOID']),
    reason: optionalText(2_000),
  })
  .strict();

export const invoiceListQuerySchema = paginationSchema
  .extend({
    patientId: idSchema.optional(),
    visitId: idSchema.optional(),
    appointmentId: idSchema.optional(),
    status: invoiceStatusSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine((value) => value.from === undefined || value.to === undefined || value.to > value.from, {
    message: 'to must be after from',
    path: ['to'],
  });

export const createPaymentBodySchema = z
  .object({
    amount: positiveMoneySchema,
    method: paymentMethodSchema,
    externalReference: z.string().trim().min(1).max(120).optional(),
    notes: optionalText(2_000),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .strict();

export const paymentStatusBodySchema = z
  .object({
    status: paymentStatusSchema,
    reason: optionalText(2_000),
  })
  .strict();

export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>;
export type UpdateInvoiceBody = z.infer<typeof updateInvoiceBodySchema>;
export type InvoiceStatusBody = z.infer<typeof invoiceStatusBodySchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type PaymentStatusBody = z.infer<typeof paymentStatusBodySchema>;

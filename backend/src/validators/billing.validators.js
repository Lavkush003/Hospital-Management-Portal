const { z, objectId, optionalObjectId, paginationQuery, isoDate, LINE_ITEM_CATEGORIES: _c } = require('./common');
const { PAYMENT_METHODS } = require('../constants/enums');

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  category: z.enum(['CONSULTATION', 'DIAGNOSTIC', 'PROCEDURE', 'MEDICINE', 'OTHER']).optional().default('OTHER'),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce.number().min(0).max(10000000),
});

const createInvoiceSchema = z.object({
  patient: objectId,
  appointment: optionalObjectId,
  encounter: optionalObjectId,
  invoiceDate: isoDate.optional(),
  dueDate: z.union([isoDate, z.literal('')]).optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required').max(100),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discount: z.coerce.number().min(0).max(10000000).optional().default(0),
  notes: z.string().trim().max(2000).optional(),
});

const listInvoiceQuery = z.object({
  ...paginationQuery,
  patient: objectId.optional(),
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'CANCELLED']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'invoiceDate', 'totalAmount', 'balanceDue']).optional(),
});

const createPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01).max(10000000),
  method: z.enum(Object.values(PAYMENT_METHODS)),
  transactionRef: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const listPaymentQuery = z.object({
  ...paginationQuery,
  invoice: objectId.optional(),
  method: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  status: z.enum(['SUCCESS', 'FAILED', 'REFUNDED']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'paidAt', 'amount']).optional(),
});

module.exports = { createInvoiceSchema, listInvoiceQuery, createPaymentSchema, listPaymentQuery };

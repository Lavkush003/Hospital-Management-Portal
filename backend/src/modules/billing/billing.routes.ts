import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { PERMISSIONS } from '../auth/auth.permissions';
import {
  createInvoiceController,
  createPaymentController,
  getInvoiceController,
  getPaymentController,
  invoiceHistoryController,
  invoicePaymentsController,
  listInvoicesController,
  updateInvoiceController,
  updateInvoiceStatusController,
  updatePaymentStatusController,
} from './billing.controller';
import {
  createInvoiceBodySchema,
  createPaymentBodySchema,
  invoiceStatusBodySchema,
  paymentStatusBodySchema,
  updateInvoiceBodySchema,
} from './billing.validators';

export const billingRoutes = Router();

billingRoutes.use(authenticate);

billingRoutes.get(
  '/invoices',
  requirePermission(PERMISSIONS.BILLING_READ),
  listInvoicesController,
);
billingRoutes.post(
  '/invoices',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  validateBody(createInvoiceBodySchema),
  createInvoiceController,
);
billingRoutes.get(
  '/invoices/:invoiceId',
  requirePermission(PERMISSIONS.BILLING_READ),
  getInvoiceController,
);
billingRoutes.patch(
  '/invoices/:invoiceId',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  validateBody(updateInvoiceBodySchema),
  updateInvoiceController,
);
billingRoutes.patch(
  '/invoices/:invoiceId/status',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  validateBody(invoiceStatusBodySchema),
  updateInvoiceStatusController,
);
billingRoutes.get(
  '/invoices/:invoiceId/history',
  requirePermission(PERMISSIONS.BILLING_READ),
  invoiceHistoryController,
);
billingRoutes.get(
  '/invoices/:invoiceId/payments',
  requirePermission(PERMISSIONS.BILLING_READ),
  invoicePaymentsController,
);
billingRoutes.post(
  '/invoices/:invoiceId/payments',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  validateBody(createPaymentBodySchema),
  createPaymentController,
);
billingRoutes.get(
  '/payments/:paymentId',
  requirePermission(PERMISSIONS.BILLING_READ),
  getPaymentController,
);
billingRoutes.patch(
  '/payments/:paymentId/status',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  validateBody(paymentStatusBodySchema),
  updatePaymentStatusController,
);

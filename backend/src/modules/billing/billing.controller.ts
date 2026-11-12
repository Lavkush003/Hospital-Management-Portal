import type { RequestHandler } from 'express';
import { getIdempotencyKey, getRouteId, requireActor, setNoStore } from '../../utils/http';
import { HTTP_STATUS } from '../../utils/http-status';
import { getRequestMetadata } from '../../utils/request-metadata';
import {
  createInvoice,
  createPayment,
  getInvoice,
  getInvoiceHistory,
  getPayment,
  listInvoicePayments,
  listInvoices,
  updateInvoice,
  updateInvoiceStatus,
  updatePaymentStatus,
} from './billing.service';
import { serializeInvoice, serializePayment } from './billing.serializer';
import type {
  CreateInvoiceBody,
  CreatePaymentBody,
  InvoiceStatusBody,
  PaymentStatusBody,
  UpdateInvoiceBody,
} from './billing.validators';
import { invoiceListQuerySchema } from './billing.validators';

export const listInvoicesController: RequestHandler = async (request, response) => {
  const result = await listInvoices(
    invoiceListQuerySchema.parse(request.query),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({
    invoices: result.invoices.map(serializeInvoice),
    pagination: result.pagination,
  });
};

export const createInvoiceController: RequestHandler = async (request, response) => {
  const invoice = await createInvoice(
    request.body as CreateInvoiceBody,
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({ invoice: serializeInvoice(invoice) });
};

export const getInvoiceController: RequestHandler = async (request, response) => {
  const invoice = await getInvoice(
    getRouteId(request, 'invoiceId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ invoice: serializeInvoice(invoice) });
};

export const updateInvoiceController: RequestHandler = async (request, response) => {
  const invoice = await updateInvoice(
    getRouteId(request, 'invoiceId'),
    request.body as UpdateInvoiceBody,
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ invoice: serializeInvoice(invoice) });
};

export const updateInvoiceStatusController: RequestHandler = async (request, response) => {
  const invoice = await updateInvoiceStatus(
    getRouteId(request, 'invoiceId'),
    request.body as InvoiceStatusBody,
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ invoice: serializeInvoice(invoice) });
};

export const invoicePaymentsController: RequestHandler = async (request, response) => {
  const payments = await listInvoicePayments(
    getRouteId(request, 'invoiceId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ payments: payments.map(serializePayment) });
};

export const createPaymentController: RequestHandler = async (request, response) => {
  const body = request.body as CreatePaymentBody;
  const result = await createPayment(
    getRouteId(request, 'invoiceId'),
    body,
    getIdempotencyKey(request, body.idempotencyKey),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
  setNoStore(response);
  response.status(HTTP_STATUS.CREATED).json({
    payment: serializePayment(result.payment),
    replayed: result.replayed,
  });
};

export const getPaymentController: RequestHandler = async (request, response) => {
  const payment = await getPayment(
    getRouteId(request, 'paymentId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ payment: serializePayment(payment) });
};

export const updatePaymentStatusController: RequestHandler = async (request, response) => {
  const payment = await updatePaymentStatus(
    getRouteId(request, 'paymentId'),
    request.body as PaymentStatusBody,
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ payment: serializePayment(payment) });
};

export const invoiceHistoryController: RequestHandler = async (request, response) => {
  const history = await getInvoiceHistory(
    getRouteId(request, 'invoiceId'),
    requireActor(request),
    getRequestMetadata(request, response),
  );
  setNoStore(response);
  response.status(HTTP_STATUS.OK).json({ history });
};

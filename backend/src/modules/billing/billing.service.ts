import { randomBytes } from 'node:crypto';
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { runIdempotentOperation } from '../../services/idempotency.service';
import { writeAuditLog } from '../../utils/audit';
import { isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import {
  calculateInvoice,
  centsToString,
  dbAmountToCents,
  moneyToCents,
  toDecimal,
} from './billing.money';
import type {
  CreateInvoiceBody,
  CreatePaymentBody,
  InvoiceListQuery,
  InvoiceStatusBody,
  PaymentStatusBody,
  UpdateInvoiceBody,
} from './billing.validators';

const invoiceInclude = {
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true },
  },
  visit: {
    select: { id: true, visitNumber: true, appointmentId: true, startedAt: true },
  },
  appointment: {
    select: { id: true, appointmentNumber: true, scheduledStart: true, status: true },
  },
  items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  payments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;
type InvoiceForSnapshot = Invoice & { items: InvoiceItem[] };
type PaymentForSnapshot = Payment;

interface InvoiceListResult {
  invoices: InvoiceWithRelations[];
  pagination: PaginationMeta;
}

function notFoundError(entity: 'Invoice' | 'Payment' | 'Patient' | 'Visit' | 'Appointment'): AppError {
  const codes = {
    Invoice: 'INVOICE_NOT_FOUND',
    Payment: 'PAYMENT_NOT_FOUND',
    Patient: 'PATIENT_NOT_FOUND',
    Visit: 'VISIT_NOT_FOUND',
    Appointment: 'APPOINTMENT_NOT_FOUND',
  } as const;
  return new AppError(HTTP_STATUS.NOT_FOUND, `${entity} not found`, codes[entity]);
}

function createInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function createPaymentNumber(): string {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function invoiceSnapshot(invoice: InvoiceForSnapshot): Prisma.InputJsonObject {
  return {
    invoiceNumber: invoice.invoiceNumber,
    patientId: invoice.patientId,
    visitId: invoice.visitId,
    appointmentId: invoice.appointmentId,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: invoice.subtotal.toFixed(2),
    discountAmount: invoice.discountAmount.toFixed(2),
    taxAmount: invoice.taxAmount.toFixed(2),
    totalAmount: invoice.totalAmount.toFixed(2),
    invoiceDate: invoice.invoiceDate.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      taxAmount: item.taxAmount.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}

function paymentSnapshot(payment: PaymentForSnapshot): Prisma.InputJsonObject {
  return {
    paymentNumber: payment.paymentNumber,
    invoiceId: payment.invoiceId,
    amount: payment.amount.toFixed(2),
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt?.toISOString() ?? null,
    externalReference: payment.externalReference,
    notes: payment.notes,
  };
}

async function validateInvoiceLinks(
  transaction: Prisma.TransactionClient,
  patientId: string,
  visitId: string | null,
  appointmentId: string | null,
): Promise<void> {
  const patient = await transaction.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });
  if (!patient) throw notFoundError('Patient');

  const [visit, appointment] = await Promise.all([
    visitId
      ? transaction.visit.findUnique({
          where: { id: visitId },
          select: { id: true, patientId: true, appointmentId: true },
        })
      : null,
    appointmentId
      ? transaction.appointment.findUnique({
          where: { id: appointmentId },
          select: { id: true, patientId: true },
        })
      : null,
  ]);

  if (visitId && !visit) throw notFoundError('Visit');
  if (appointmentId && !appointment) throw notFoundError('Appointment');
  if (visit && visit.patientId !== patientId) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'The visit does not belong to the invoice patient',
      'INVOICE_PATIENT_LINK_MISMATCH',
    );
  }
  if (appointment && appointment.patientId !== patientId) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'The appointment does not belong to the invoice patient',
      'INVOICE_PATIENT_LINK_MISMATCH',
    );
  }
  if (visit && appointmentId && visit.appointmentId && visit.appointmentId !== appointmentId) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'The appointment does not match the visit',
      'INVOICE_APPOINTMENT_LINK_MISMATCH',
    );
  }
}

async function lockInvoice(
  transaction: Prisma.TransactionClient,
  invoiceId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE
  `;
  if (rows.length === 0) throw notFoundError('Invoice');
}

async function loadInvoice(
  invoiceId: string,
  transaction: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<InvoiceWithRelations> {
  const invoice = await transaction.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceInclude,
  });
  if (!invoice) throw notFoundError('Invoice');
  return invoice;
}

async function paymentTotals(
  transaction: Prisma.TransactionClient,
  invoiceId: string,
): Promise<{ successfulCents: bigint; reservedCents: bigint }> {
  const payments = await transaction.payment.findMany({
    where: { invoiceId, status: { in: ['PENDING', 'SUCCESSFUL'] } },
    select: { amount: true, status: true },
  });
  let successfulCents = 0n;
  let reservedCents = 0n;
  for (const payment of payments) {
    const amount = dbAmountToCents(payment.amount);
    reservedCents += amount;
    if (payment.status === 'SUCCESSFUL') successfulCents += amount;
  }
  return { successfulCents, reservedCents };
}

function invoiceNotEditableError(): AppError {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    'Only draft invoices without payments can be modified',
    'INVOICE_NOT_EDITABLE',
  );
}

export async function createInvoice(
  input: CreateInvoiceBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<InvoiceWithRelations> {
  const amounts = calculateInvoice(input.items);
  const invoiceDate = input.invoiceDate ?? new Date();
  if (input.dueAt < invoiceDate) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'dueAt must be on or after invoiceDate',
      'INVOICE_DUE_DATE_INVALID',
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      await validateInvoiceLinks(
        transaction,
        input.patientId,
        input.visitId ?? null,
        input.appointmentId ?? null,
      );
      const invoice = await transaction.invoice.create({
        data: {
          invoiceNumber: createInvoiceNumber(),
          patientId: input.patientId,
          visitId: input.visitId ?? null,
          appointmentId: input.appointmentId ?? null,
          status: 'DRAFT',
          currency: input.currency,
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxAmount: amounts.taxAmount,
          totalAmount: amounts.totalAmount,
          invoiceDate,
          dueAt: input.dueAt,
          notes: input.notes ?? null,
          items: { create: amounts.items },
        },
        include: invoiceInclude,
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: 'INVOICE_CREATED',
          entityType: 'Invoice',
          entityId: invoice.id,
          after: invoiceSnapshot(invoice),
          request,
        },
        transaction,
      );
      return invoice;
    });
  } catch (error) {
    if (isUniqueConstraintError(error, ['invoiceNumber'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'An invoice identifier collision occurred; retry the request',
        'INVOICE_IDENTIFIER_CONFLICT',
      );
    }
    throw error;
  }
}

export async function listInvoices(
  query: InvoiceListQuery,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<InvoiceListResult> {
  const where: Prisma.InvoiceWhereInput = {
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(query.visitId ? { visitId: query.visitId } : {}),
    ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          invoiceDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };
  const [total, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ invoiceDate: 'desc' }, { id: 'asc' }],
    }),
  ]);

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'INVOICE_LIST_READ',
    entityType: 'InvoiceQuery',
    entityId: actor.id,
    metadata: {
      resultCount: invoices.length,
      invoiceIds: invoices.map((invoice) => invoice.id),
      page: query.page,
      pageSize: query.pageSize,
    },
    request,
  });
  return {
    invoices,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

export async function getInvoice(
  invoiceId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<InvoiceWithRelations> {
  const invoice = await loadInvoice(invoiceId);
  await writeAuditLog({
    actorUserId: actor.id,
    action: 'INVOICE_READ',
    entityType: 'Invoice',
    entityId: invoice.id,
    metadata: { patientId: invoice.patientId, invoiceNumber: invoice.invoiceNumber },
    request,
  });
  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (transaction) => {
    await lockInvoice(transaction, invoiceId);
    const current = await loadInvoice(invoiceId, transaction);
    const paymentCount = await transaction.payment.count({ where: { invoiceId } });
    if (current.status !== 'DRAFT' || paymentCount > 0) throw invoiceNotEditableError();

    const patientId = input.patientId ?? current.patientId;
    const visitId = input.visitId === undefined ? current.visitId : input.visitId;
    const appointmentId =
      input.appointmentId === undefined ? current.appointmentId : input.appointmentId;
    await validateInvoiceLinks(transaction, patientId, visitId, appointmentId);

    const currentItems = current.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      taxAmount: item.taxAmount.toFixed(2),
    }));
    const amounts = calculateInvoice(input.items ?? currentItems);
    const invoiceDate = input.invoiceDate ?? current.invoiceDate;
    const dueAt = input.dueAt ?? current.dueAt;
    if (dueAt && dueAt < invoiceDate) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'dueAt must be on or after invoiceDate',
        'INVOICE_DUE_DATE_INVALID',
      );
    }

    if (input.items) {
      await transaction.invoiceItem.deleteMany({ where: { invoiceId } });
      await transaction.invoiceItem.createMany({
        data: amounts.items.map((item) => ({ ...item, invoiceId })),
      });
    }
    await transaction.invoice.update({
      where: { id: invoiceId },
      data: {
        patientId,
        visitId,
        appointmentId,
        currency: input.currency ?? current.currency,
        invoiceDate,
        dueAt,
        notes: input.notes === undefined ? current.notes : input.notes,
        subtotal: amounts.subtotal,
        discountAmount: amounts.discountAmount,
        taxAmount: amounts.taxAmount,
        totalAmount: amounts.totalAmount,
      },
    });
    const updated = await loadInvoice(invoiceId, transaction);

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'INVOICE_UPDATED',
        entityType: 'Invoice',
        entityId: invoiceId,
        before: invoiceSnapshot(current),
        after: invoiceSnapshot(updated),
        request,
      },
      transaction,
    );
    return updated;
  });
}

const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'VOID'],
  ISSUED: ['OVERDUE', 'VOID'],
  PARTIALLY_PAID: ['OVERDUE', 'VOID'],
  PAID: [],
  VOID: [],
  OVERDUE: ['VOID'],
  REFUNDED: [],
};

export async function updateInvoiceStatus(
  invoiceId: string,
  input: InvoiceStatusBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (transaction) => {
    await lockInvoice(transaction, invoiceId);
    const current = await loadInvoice(invoiceId, transaction);
    if (!INVOICE_STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Invoice status cannot transition from ${current.status} to ${input.status}`,
        'INVOICE_STATUS_TRANSITION_INVALID',
      );
    }

    const totals = await paymentTotals(transaction, invoiceId);
    if (input.status === 'ISSUED') {
      if (current.items.length === 0 || dbAmountToCents(current.totalAmount) <= 0n) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'An invoice must have billable items and a positive total before issue',
          'INVOICE_NOT_BILLABLE',
        );
      }
    } else if (input.status === 'OVERDUE') {
      if (
        !current.dueAt ||
        current.dueAt.getTime() >= Date.now() ||
        totals.successfulCents >= dbAmountToCents(current.totalAmount)
      ) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'Only unpaid invoices past their due date can be marked overdue',
          'INVOICE_NOT_OVERDUE',
        );
      }
    } else if (input.status === 'VOID' && totals.reservedCents > 0n) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'An invoice with pending or successful payments cannot be voided',
        'INVOICE_HAS_PAYMENTS',
      );
    }

    await transaction.invoice.update({
      where: { id: invoiceId },
      data: {
        status: input.status,
        ...(input.status === 'ISSUED' ? { issuedAt: new Date() } : {}),
      },
    });
    const result = await loadInvoice(invoiceId, transaction);
    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'INVOICE_STATUS_CHANGED',
        entityType: 'Invoice',
        entityId: invoiceId,
        before: invoiceSnapshot(current),
        after: invoiceSnapshot(result),
        metadata: { reason: input.reason ?? null },
        request,
      },
      transaction,
    );
    return result;
  });
}

export async function createPayment(
  invoiceId: string,
  input: CreatePaymentBody,
  idempotencyKey: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<{ payment: Payment; replayed: boolean }> {
  const amountCents = moneyToCents(input.amount);
  let idempotentResult: Awaited<ReturnType<typeof runIdempotentOperation>>;
  try {
    idempotentResult = await runIdempotentOperation({
      actorUserId: actor.id,
      scope: 'billing-payment-create',
      key: idempotencyKey,
      payload: {
        invoiceId,
        amount: centsToString(amountCents),
        method: input.method,
        externalReference: input.externalReference ?? null,
        notes: input.notes ?? null,
      },
      resourceType: 'Payment',
      responseStatusCode: HTTP_STATUS.CREATED,
      operation: async (transaction) => {
        await lockInvoice(transaction, invoiceId);
        const invoice = await transaction.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw notFoundError('Invoice');
        if (!['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Payments can only be recorded for issued invoices',
            'INVOICE_NOT_PAYABLE',
          );
        }
        const totals = await paymentTotals(transaction, invoiceId);
        const invoiceTotal = dbAmountToCents(invoice.totalAmount);
        if (totals.reservedCents + amountCents > invoiceTotal) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Payment exceeds the unreserved invoice balance',
            'PAYMENT_EXCEEDS_BALANCE',
          );
        }

        const payment = await transaction.payment.create({
          data: {
            paymentNumber: createPaymentNumber(),
            invoiceId,
            amount: toDecimal(amountCents),
            method: input.method,
            status: 'PENDING',
            receivedById: actor.id,
            externalReference: input.externalReference ?? null,
            notes: input.notes ?? null,
          },
        });
        await writeAuditLog(
          {
            actorUserId: actor.id,
            action: 'PAYMENT_CREATED',
            entityType: 'Payment',
            entityId: payment.id,
            after: paymentSnapshot(payment),
            metadata: { patientId: invoice.patientId, invoiceNumber: invoice.invoiceNumber },
            request,
          },
          transaction,
        );
        return payment.id;
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, ['externalReference'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The payment reference has already been used',
        'PAYMENT_REFERENCE_CONFLICT',
      );
    }
    if (isUniqueConstraintError(error, ['paymentNumber'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'A payment identifier collision occurred; retry the request',
        'PAYMENT_IDENTIFIER_CONFLICT',
      );
    }
    throw error;
  }

  const payment = await prisma.payment.findUnique({ where: { id: idempotentResult.resourceId } });
  if (!payment) throw notFoundError('Payment');
  return { payment, replayed: idempotentResult.replayed };
}

export async function listInvoicePayments(
  invoiceId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<Payment[]> {
  const invoice = await loadInvoice(invoiceId);
  const payments = await prisma.payment.findMany({
    where: { invoiceId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: 'PAYMENT_LIST_READ',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { patientId: invoice.patientId, recordCount: payments.length },
    request,
  });
  return payments;
}

export async function getPayment(
  paymentId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<Payment> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFoundError('Payment');
  await writeAuditLog({
    actorUserId: actor.id,
    action: 'PAYMENT_READ',
    entityType: 'Payment',
    entityId: paymentId,
    metadata: { invoiceId: payment.invoiceId },
    request,
  });
  return payment;
}

const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['SUCCESSFUL', 'FAILED'],
  SUCCESSFUL: [],
  FAILED: [],
  REFUNDED: [],
};

export async function updatePaymentStatus(
  paymentId: string,
  input: PaymentStatusBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<Payment> {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.payment.findUnique({ where: { id: paymentId } });
    if (!existing) throw notFoundError('Payment');
    await lockInvoice(transaction, existing.invoiceId);
    const current = await transaction.payment.findUnique({ where: { id: paymentId } });
    if (!current) throw notFoundError('Payment');

    if (!PAYMENT_STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Payment status cannot transition from ${current.status} to ${input.status}`,
        'PAYMENT_STATUS_TRANSITION_INVALID',
      );
    }

    const invoice = await transaction.invoice.findUnique({ where: { id: current.invoiceId } });
    if (!invoice) throw notFoundError('Invoice');
    if (input.status === 'SUCCESSFUL') {
      if (!['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'A payment can only succeed against an issued invoice',
          'INVOICE_NOT_PAYABLE',
        );
      }
      const totals = await paymentTotals(transaction, current.invoiceId);
      if (totals.reservedCents > dbAmountToCents(invoice.totalAmount)) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'Successful payments would exceed the invoice total',
          'PAYMENT_EXCEEDS_BALANCE',
        );
      }
    }

    const updatedPayment = await transaction.payment.update({
      where: { id: paymentId },
      data: {
        status: input.status,
        paidAt: input.status === 'SUCCESSFUL' ? new Date() : null,
      },
    });

    if (input.status === 'SUCCESSFUL') {
      const newPaidCents = (await paymentTotals(transaction, current.invoiceId)).successfulCents;
      const invoiceTotal = dbAmountToCents(invoice.totalAmount);
      const nextInvoiceStatus =
        newPaidCents === invoiceTotal
          ? 'PAID'
          : invoice.status === 'OVERDUE'
            ? 'OVERDUE'
            : 'PARTIALLY_PAID';
      const updatedInvoice = await transaction.invoice.update({
        where: { id: invoice.id },
        data: { status: nextInvoiceStatus },
        include: invoiceInclude,
      });
      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: 'INVOICE_PAYMENT_RECONCILED',
          entityType: 'Invoice',
          entityId: invoice.id,
          before: invoiceSnapshot({
            ...updatedInvoice,
            status: invoice.status,
          }),
          after: invoiceSnapshot(updatedInvoice),
          metadata: {
            paymentId,
            paidAmount: centsToString(newPaidCents),
            balance: centsToString(invoiceTotal - newPaidCents),
          },
          request,
        },
        transaction,
      );
    }

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'PAYMENT_STATUS_CHANGED',
        entityType: 'Payment',
        entityId: paymentId,
        before: paymentSnapshot(current),
        after: paymentSnapshot(updatedPayment),
        metadata: {
          reason: input.reason ?? null,
          invoiceId: current.invoiceId,
        },
        request,
      },
      transaction,
    );
    return updatedPayment;
  });
}

export async function getInvoiceHistory(
  invoiceId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown[]> {
  const invoice = await loadInvoice(invoiceId);
  const payments = await prisma.payment.findMany({
    where: { invoiceId },
    select: { id: true },
  });
  const events = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Invoice', entityId: invoiceId },
        { entityType: 'Payment', entityId: { in: payments.map((payment) => payment.id) } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      actorUserId: true,
      action: true,
      entityType: true,
      entityId: true,
      before: true,
      after: true,
      metadata: true,
      requestId: true,
      createdAt: true,
    },
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: 'INVOICE_HISTORY_READ',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { patientId: invoice.patientId, eventCount: events.length },
    request,
  });
  return events;
}

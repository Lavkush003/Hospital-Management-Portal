import type { Invoice, InvoiceItem, Payment, Prisma } from '@prisma/client';
import { centsToString, dbAmountToCents } from './billing.money';

type InvoiceRecord = Invoice & {
  items: InvoiceItem[];
  payments?: Payment[];
  patient?: unknown;
  visit?: unknown;
  appointment?: unknown;
};

function formatMoney(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function serializeInvoice(invoice: InvoiceRecord): Record<string, unknown> {
  const payments = invoice.payments ?? [];
  const successfulCents = payments
    .filter((payment) => payment.status === 'SUCCESSFUL')
    .reduce((total, payment) => total + dbAmountToCents(payment.amount), 0n);
  const pendingCents = payments
    .filter((payment) => payment.status === 'PENDING')
    .reduce((total, payment) => total + dbAmountToCents(payment.amount), 0n);
  const totalCents = dbAmountToCents(invoice.totalAmount);

  return {
    ...invoice,
    subtotal: formatMoney(invoice.subtotal),
    discountAmount: formatMoney(invoice.discountAmount),
    taxAmount: formatMoney(invoice.taxAmount),
    totalAmount: formatMoney(invoice.totalAmount),
    amountPaid: centsToString(successfulCents),
    pendingAmount: centsToString(pendingCents),
    balanceDue: centsToString(totalCents - successfulCents),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: formatMoney(item.unitPrice),
      discountAmount: formatMoney(item.discountAmount),
      taxAmount: formatMoney(item.taxAmount),
      lineTotal: formatMoney(item.lineTotal),
    })),
    payments: payments.map(serializePayment),
  };
}

export function serializePayment(payment: Payment): Record<string, unknown> {
  return {
    ...payment,
    amount: formatMoney(payment.amount),
  };
}

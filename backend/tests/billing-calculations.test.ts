import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateInvoice } from '../src/modules/billing/billing.money';
import {
  createInvoiceBodySchema,
  createPaymentBodySchema,
} from '../src/modules/billing/billing.validators';

test('calculates invoice amounts exactly in cents', () => {
  const parsed = createInvoiceBodySchema.parse({
    patientId: 'patient-test',
    dueAt: '2026-12-01T00:00:00.000Z',
    items: [
      {
        description: 'Consultation',
        quantity: 2,
        unitPrice: '50.25',
        discountAmount: '5.50',
        taxAmount: '8.00',
      },
      {
        description: 'Supplies',
        quantity: 1,
        unitPrice: 0.5,
        taxAmount: '0.05',
      },
    ],
  });
  const result = calculateInvoice(parsed.items);

  assert.equal(result.subtotal.toFixed(2), '101.00');
  assert.equal(result.discountAmount.toFixed(2), '5.50');
  assert.equal(result.taxAmount.toFixed(2), '8.05');
  assert.equal(result.totalAmount.toFixed(2), '103.55');
  assert.equal(result.items[0]?.lineTotal.toFixed(2), '103.00');
  assert.equal(result.items[1]?.lineTotal.toFixed(2), '0.55');
});

test('validates payment amounts and item discounts', () => {
  assert.equal(
    createPaymentBodySchema.safeParse({ amount: '0.00', method: 'CASH' }).success,
    false,
  );
  assert.equal(
    createPaymentBodySchema.safeParse({ amount: '1.001', method: 'CASH' }).success,
    false,
  );
  const invoice = createInvoiceBodySchema.parse({
    patientId: 'patient-test',
    dueAt: '2026-12-01T00:00:00.000Z',
    items: [
      {
        description: 'Invalid discount',
        quantity: 1,
        unitPrice: '1.00',
        discountAmount: '2.00',
      },
    ],
  });
  assert.throws(
    () => calculateInvoice(invoice.items),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'INVOICE_ITEM_DISCOUNT_EXCEEDS_SUBTOTAL',
  );
});

const request = require('supertest');
const app = require('../src/app');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase,
} = require('./helpers/db');
const {
  createUser,
  createDoctor,
  createPatient,
  createAppointment,
  futureDateKey,
} = require('./helpers/factories');

const invoicePayload = (patient, overrides = {}) => ({
  patient: patient._id,
  lineItems: [
    { description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 100 },
    { description: 'Laboratory panel', category: 'DIAGNOSTIC', quantity: 2, unitPrice: 50 },
  ],
  taxRate: 5,
  discount: 20,
  ...overrides,
});

describe('Billing and payments', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  async function createBillingInvoice(overrides = {}) {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const patient = await createPatient();
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${reception.token}`)
      .send(invoicePayload(patient, overrides));
    return { reception, patient, res };
  }

  test('calculates invoice totals server-side with discount and tax', async () => {
    const { res } = await createBillingInvoice({ subtotal: 1, totalAmount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{5}$/);
    expect(res.body.data.subtotal).toBe(200);
    expect(res.body.data.discount).toBe(20);
    expect(res.body.data.tax).toBe(9);
    expect(res.body.data.totalAmount).toBe(189);
    expect(res.body.data.amountPaid).toBe(0);
    expect(res.body.data.balanceDue).toBe(189);
    expect(res.body.data.status).toBe('UNPAID');
    expect(res.body.data.lineItems[1].amount).toBe(100);
  });

  test('records partial and final payments and blocks overpayment', async () => {
    const { reception, res } = await createBillingInvoice();
    const invoiceId = res.body.data._id;

    const partial = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 100, method: 'CASH' });
    expect(partial.status).toBe(201);
    expect(partial.body.data.payment.paymentNumber).toMatch(/^PAY-\d{5}$/);
    expect(partial.body.data.invoice.status).toBe('PARTIALLY_PAID');
    expect(partial.body.data.invoice.amountPaid).toBe(100);
    expect(partial.body.data.invoice.balanceDue).toBe(89);

    const overpay = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 90, method: 'CARD' });
    expect(overpay.status).toBe(400);
    expect(overpay.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');

    const final = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 89, method: 'CARD' });
    expect(final.status).toBe(201);
    expect(final.body.data.invoice.status).toBe('PAID');
    expect(final.body.data.invoice.balanceDue).toBe(0);

    const again = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 10, method: 'CARD' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVOICE_ALREADY_PAID');

    const detail = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.payments).toHaveLength(2);
  });

  test('is idempotent when the same idempotency key is replayed', async () => {
    const { reception, res } = await createBillingInvoice();
    const invoiceId = res.body.data._id;
    const key = 'seed-idempotency-key-001';

    const first = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 50, method: 'UPI', idempotencyKey: key });
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 50, method: 'UPI', idempotencyKey: key });
    expect(replay.status).toBe(201);
    expect(replay.body.data.idempotent).toBe(true);
    expect(replay.body.data.payment.paymentNumber).toBe(first.body.data.payment.paymentNumber);

    expect(await Payment.countDocuments({ idempotencyKey: key })).toBe(1);
    const invoice = await Invoice.findById(invoiceId);
    expect(invoice.amountPaid).toBe(50);
    expect(invoice.balanceDue).toBe(139);
  });

  test('prevents two concurrent payments from overdrawing the invoice', async () => {
    const { reception, res } = await createBillingInvoice({
      lineItems: [{ description: 'Procedure', category: 'PROCEDURE', quantity: 1, unitPrice: 200 }],
      taxRate: 0,
      discount: 0,
    });
    const invoiceId = res.body.data._id;

    const pay = () =>
      request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${reception.token}`)
        .send({ amount: 150, method: 'CASH' });

    const [first, second] = await Promise.all([pay(), pay()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const invoice = await Invoice.findById(invoiceId);
    expect(invoice.amountPaid).toBe(150);
    expect(invoice.balanceDue).toBe(50);
    expect(await Payment.countDocuments({ invoice: invoiceId })).toBe(1);
  });

  test('rejects invalid payments and keeps billing restricted to staff', async () => {
    const { reception, res } = await createBillingInvoice();
    const invoiceId = res.body.data._id;
    const doctor = await createDoctor();

    const zero = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 0, method: 'CASH' });
    expect(zero.status).toBe(422);

    const badMethod = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ amount: 10, method: 'BITCOIN' });
    expect(badMethod.status).toBe(422);

    const doctorRead = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(doctorRead.status).toBe(403);

    const doctorPay = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ amount: 10, method: 'CASH' });
    expect(doctorPay.status).toBe(403);
  });

  test('is accessible to administrators and lists invoices and payments', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const patient = await createPatient();
    const created = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(invoicePayload(patient));
    expect(created.status).toBe(201);

    const invoices = await request(app)
      .get(`/api/invoices?patient=${patient._id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(invoices.status).toBe(200);
    expect(invoices.body.meta.total).toBe(1);

    await request(app)
      .post(`/api/invoices/${created.body.data._id}/payments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ amount: 25, method: 'INSURANCE', transactionRef: 'INS-TEST-1' });

    const payments = await request(app)
      .get(`/api/payments?invoice=${created.body.data._id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(payments.status).toBe(200);
    expect(payments.body.meta.total).toBe(1);
    expect(payments.body.data[0].amount).toBe(25);
    expect(payments.body.data[0].method).toBe('INSURANCE');
  });

  test('validates invoice payloads and rejects mismatched patients', async () => {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const doctor = await createDoctor();
    const patient = await createPatient();
    const otherPatient = await createPatient();

    const empty = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ patient: patient._id, lineItems: [] });
    expect(empty.status).toBe(422);

    const appointment = await createAppointment({
      patient: otherPatient,
      doctor: doctor.doctor,
      date: futureDateKey(1),
      startTime: '10:00',
    });
    const mismatch = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ patient: patient._id, appointment: appointment._id, lineItems: [{ description: 'Fee', quantity: 1, unitPrice: 50 }] });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('PATIENT_MISMATCH');
  });

  test('returns 404 for unknown invoices', async () => {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const res = await request(app)
      .get('/api/invoices/64b000000000000000000000')
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVOICE_NOT_FOUND');
  });
});

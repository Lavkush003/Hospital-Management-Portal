import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const TEST_PASSWORD = 'Billing-Test-Password-2026!';
const RUN_ID = Date.now().toString(36).toLowerCase();
const PREFIX = `billtest-${RUN_ID}`;
const EMAIL_MARKER = `${PREFIX}-`;

interface ApiResponse {
  status: number;
  body: unknown;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
}

interface SessionBody {
  accessToken: string;
}

interface ErrorBody {
  error: { code: string };
}

interface InvoiceBody {
  invoice: {
    id: string;
    status: string;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    totalAmount: string;
    items: Array<{
      lineTotal: string;
      discountAmount: string;
      taxAmount: string;
    }>;
    [key: string]: unknown;
  };
}

interface PaymentBody {
  payment: {
    id: string;
    paymentNumber: string;
    status: string;
    amount: string;
    paidAt: string | null;
  };
  replayed?: boolean;
}

let prisma: PrismaClient;
let server: Server;
let baseUrl: string;
let adminToken: string;
let frontDeskToken: string;
let clinicianToken: string;
let adminUserId: string;
let frontDeskUserId: string;
let clinicianUserId: string;
let patientId: string;
let invoiceId = '';

async function api(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

async function login(email: string): Promise<string> {
  const response = await api('/auth/login', {
    method: 'POST',
    body: { email, password: TEST_PASSWORD },
    token: null,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return (response.body as SessionBody).accessToken;
}

function assertError(response: ApiResponse, status: number, code: string): void {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal((response.body as ErrorBody).error.code, code);
}

async function cleanup(): Promise<void> {
  if (!prisma) return;
  const users = await prisma.user.findMany({
    where: { id: { startsWith: PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [{ id: { startsWith: PREFIX } }, { patientId: { startsWith: PREFIX } }],
    },
    select: { id: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { entityId: { in: [...invoiceIds, ...payments.map((payment) => payment.id)] } },
      ],
    },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { OR: [{ actorUserId: { in: userIds } }, { key: { startsWith: PREFIX } }] },
  });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.patient.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run billing integration tests');
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    CORS_ORIGIN: 'http://localhost:5173',
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_SALT_ROUNDS: '10',
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
    AUTH_LOGIN_RATE_LIMIT_MAX: '1000',
    AUTH_REFRESH_RATE_LIMIT_WINDOW_MS: '60000',
    AUTH_REFRESH_RATE_LIMIT_MAX: '1000',
    LOG_LEVEL: 'silent',
  });

  const [{ createApp }, { prisma: prismaClient }] = await Promise.all([
    import('../src/app'),
    import('../src/config/prisma'),
  ]);
  prisma = prismaClient;
  await cleanup();

  const passwordHash = await hash(TEST_PASSWORD, 10);
  adminUserId = `${PREFIX}-admin`;
  frontDeskUserId = `${PREFIX}-frontdesk`;
  clinicianUserId = `${PREFIX}-clinician`;
  await prisma.user.createMany({
    data: [
      {
        id: adminUserId,
        email: `${EMAIL_MARKER}admin@example.test`,
        passwordHash,
        role: 'ADMIN',
        firstName: 'Billing',
        lastName: 'Admin',
      },
      {
        id: frontDeskUserId,
        email: `${EMAIL_MARKER}frontdesk@example.test`,
        passwordHash,
        role: 'FRONT_DESK',
        firstName: 'Billing',
        lastName: 'FrontDesk',
      },
      {
        id: clinicianUserId,
        email: `${EMAIL_MARKER}clinician@example.test`,
        passwordHash,
        role: 'CLINICIAN',
        firstName: 'Billing',
        lastName: 'Clinician',
      },
    ],
  });
  patientId = `${PREFIX}-patient`;
  await prisma.patient.create({
    data: {
      id: patientId,
      patientNumber: `${PREFIX}-PAT`,
      firstName: 'Synthetic',
      lastName: 'Patient',
      dateOfBirth: new Date('1980-01-01T00:00:00.000Z'),
    },
  });

  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  adminToken = await login(`${EMAIL_MARKER}admin@example.test`);
  frontDeskToken = await login(`${EMAIL_MARKER}frontdesk@example.test`);
  clinicianToken = await login(`${EMAIL_MARKER}clinician@example.test`);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (prisma) {
    await cleanup();
    await prisma.$disconnect();
  }
});

test('calculates invoices, reconciles simulated payments, and preserves billing history', async () => {
  const invoiceDate = new Date(Date.now() - 60_000).toISOString();
  const dueAt = new Date(Date.now() + 86_400_000).toISOString();
  const invoiceInput = {
    patientId,
    invoiceDate,
    dueAt,
    notes: 'Synthetic billing test invoice',
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
        discountAmount: '0',
        taxAmount: '0.05',
      },
    ],
  };

  const clinicianCreate = await api('/billing/invoices', {
    method: 'POST',
    body: invoiceInput,
    token: clinicianToken,
  });
  assertError(clinicianCreate, 403, 'FORBIDDEN');

  const created = await api('/billing/invoices', {
    method: 'POST',
    body: invoiceInput,
    token: frontDeskToken,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const invoice = (created.body as InvoiceBody).invoice;
  invoiceId = invoice.id;
  assert.equal(invoice.status, 'DRAFT');
  assert.equal(invoice.subtotal, '101.00');
  assert.equal(invoice.discountAmount, '5.50');
  assert.equal(invoice.taxAmount, '8.05');
  assert.equal(invoice.totalAmount, '103.55');
  assert.equal(invoice.items[0]?.lineTotal, '103.00');

  const invalidDiscount = await api('/billing/invoices', {
    method: 'POST',
    body: {
      ...invoiceInput,
      items: [{ description: 'Invalid', quantity: 1, unitPrice: '1.00', discountAmount: '2.00' }],
    },
    token: adminToken,
  });
  assertError(invalidDiscount, 400, 'INVOICE_ITEM_DISCOUNT_EXCEEDS_SUBTOTAL');

  const invalidTransition = await api(`/billing/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    body: { status: 'OVERDUE' },
    token: adminToken,
  });
  assertError(invalidTransition, 409, 'INVOICE_STATUS_TRANSITION_INVALID');

  const issued = await api(`/billing/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    body: { status: 'ISSUED' },
    token: frontDeskToken,
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal((issued.body as InvoiceBody).invoice.status, 'ISSUED');

  const paymentInput = { amount: '30.00', method: 'CASH' };
  const key = `${PREFIX}-payment-key`;
  const pendingResponse = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: paymentInput,
    token: frontDeskToken,
    idempotencyKey: key,
  });
  assert.equal(pendingResponse.status, 201, JSON.stringify(pendingResponse.body));
  const pending = (pendingResponse.body as PaymentBody).payment;
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.paidAt, null);

  const duplicate = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: paymentInput,
    token: frontDeskToken,
    idempotencyKey: key,
  });
  assert.equal(duplicate.status, 201, JSON.stringify(duplicate.body));
  assert.equal((duplicate.body as PaymentBody).payment.id, pending.id);
  assert.equal((duplicate.body as PaymentBody).replayed, true);

  const reusedKey = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: { amount: '31.00', method: 'CASH' },
    token: frontDeskToken,
    idempotencyKey: key,
  });
  assertError(reusedKey, 409, 'IDEMPOTENCY_KEY_REUSED');

  const attemptMarkPaid = await api(`/billing/payments/${pending.id}/status`, {
    method: 'PATCH',
    body: { status: 'SUCCESSFUL' },
    token: clinicianToken,
  });
  assertError(attemptMarkPaid, 403, 'FORBIDDEN');

  const failed = await api(`/billing/payments/${pending.id}/status`, {
    method: 'PATCH',
    body: { status: 'FAILED', reason: 'Simulated decline' },
    token: frontDeskToken,
  });
  assert.equal(failed.status, 200, JSON.stringify(failed.body));
  assert.equal((failed.body as PaymentBody).payment.status, 'FAILED');
  const invoiceAfterFailure = await api(`/billing/invoices/${invoiceId}`, {
    token: frontDeskToken,
  });
  assert.equal((invoiceAfterFailure.body as InvoiceBody).invoice.status, 'ISSUED');

  const partialPaymentResponse = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: { amount: '30.00', method: 'CARD' },
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-partial-key`,
  });
  assert.equal(partialPaymentResponse.status, 201);
  const partial = (partialPaymentResponse.body as PaymentBody).payment;
  const partialSuccess = await api(`/billing/payments/${partial.id}/status`, {
    method: 'PATCH',
    body: { status: 'SUCCESSFUL' },
    token: adminToken,
  });
  assert.equal(partialSuccess.status, 200, JSON.stringify(partialSuccess.body));
  assert.equal((await api(`/billing/invoices/${invoiceId}`, { token: adminToken })).status, 200);
  const partialInvoice = await api(`/billing/invoices/${invoiceId}`, { token: adminToken });
  assert.equal((partialInvoice.body as InvoiceBody).invoice.status, 'PARTIALLY_PAID');

  const overpayment = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: { amount: '73.56', method: 'CASH' },
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-overpayment-key`,
  });
  assertError(overpayment, 409, 'PAYMENT_EXCEEDS_BALANCE');

  const pendingReservation = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: { amount: '73.55', method: 'CASH' },
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-full-key`,
  });
  assert.equal(pendingReservation.status, 201, JSON.stringify(pendingReservation.body));
  const fullPayment = (pendingReservation.body as PaymentBody).payment;
  const fullSuccess = await api(`/billing/payments/${fullPayment.id}/status`, {
    method: 'PATCH',
    body: { status: 'SUCCESSFUL' },
    token: frontDeskToken,
  });
  assert.equal(fullSuccess.status, 200, JSON.stringify(fullSuccess.body));
  assert.equal((fullSuccess.body as PaymentBody).payment.status, 'SUCCESSFUL');

  const paidInvoiceResponse = await api(`/billing/invoices/${invoiceId}`, { token: adminToken });
  assert.equal((paidInvoiceResponse.body as InvoiceBody).invoice.status, 'PAID');
  const finalStatus = await api(`/billing/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    body: { status: 'VOID' },
    token: adminToken,
  });
  assertError(finalStatus, 409, 'INVOICE_STATUS_TRANSITION_INVALID');

  const updateIssuedInvoice = await api(`/billing/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: { notes: 'Changed after issue' },
    token: adminToken,
  });
  assertError(updateIssuedInvoice, 409, 'INVOICE_NOT_EDITABLE');

  const historyResponse = await api(`/billing/invoices/${invoiceId}/history`, {
    token: frontDeskToken,
  });
  assert.equal(historyResponse.status, 200, JSON.stringify(historyResponse.body));
  const history = (historyResponse.body as { history: Array<{ action: string }> }).history;
  const actions = new Set(history.map((entry) => entry.action));
  assert.ok(actions.has('INVOICE_CREATED'));
  assert.ok(actions.has('INVOICE_STATUS_CHANGED'));
  assert.ok(actions.has('PAYMENT_CREATED'));
  assert.ok(actions.has('PAYMENT_STATUS_CHANGED'));
  assert.ok(actions.has('INVOICE_PAYMENT_RECONCILED'));

  const invoiceAudits = await prisma.auditLog.findMany({
    where: { entityType: 'Invoice', entityId: invoiceId },
    select: { action: true },
  });
  assert.ok(invoiceAudits.some((entry) => entry.action === 'INVOICE_CREATED'));
  assert.ok(invoiceAudits.some((entry) => entry.action === 'INVOICE_PAYMENT_RECONCILED'));
});

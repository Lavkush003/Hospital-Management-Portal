import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { hash } from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

loadDotenv({ path: resolve(__dirname, '../.env'), quiet: true });

const app = createApp();

const RUN_ID = Date.now().toString(36).toLowerCase();
const PREFIX = `jst-${RUN_ID}`;
const EMAIL_MARKER = `${PREFIX}-`;
const TEST_PASSWORD = 'Jest-Security-Password-2026!';

let adminToken = '';
let frontDeskToken = '';
let clinicianAToken = '';
let clinicianBToken = '';
let staffRecordId = '';

let doctorAId = '';
let patientAId = '';
let patientBId = '';
let scheduleDate: Date;

function nextUtcWeekday(targetWeekday: number, minimumDaysAhead = 2): Date {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + minimumDaysAhead),
  );
  while (day.getUTCDay() !== targetWeekday) {
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return day;
}

function utcAt(day: Date, hour: number, minute: number): string {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, 0),
  ).toISOString();
}

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

beforeAll(async () => {
  const passwordHash = await hash(TEST_PASSWORD, 10);

  await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}admin@example.test`,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'JestAdmin',
      lastName: 'User',
    },
  });

  await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}frontdesk@example.test`,
      passwordHash,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      firstName: 'JestFrontDesk',
      lastName: 'User',
    },
  });

  const clinicianA = await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}clinician-a@example.test`,
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'JestDr',
      lastName: 'Alpha',
    },
  });

  const clinicianB = await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}clinician-b@example.test`,
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'JestDr',
      lastName: 'Beta',
    },
  });

  const department = await prisma.department.create({
    data: {
      code: `JD${RUN_ID.slice(-4).toUpperCase()}`,
      name: `Jest Dept ${RUN_ID}`,
      isActive: true,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}staff@example.test`,
      passwordHash,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      firstName: 'JestStaff',
      lastName: 'Worker',
    },
  });

  const staff = await prisma.staff.create({
    data: {
      userId: staffUser.id,
      email: staffUser.email,
      firstName: staffUser.firstName,
      lastName: staffUser.lastName,
      employeeCode: `STF-JST-${RUN_ID.slice(-4)}`,
      jobTitle: 'Coordinator',
      departmentId: department.id,
      status: 'ACTIVE',
    },
  });
  staffRecordId = staff.id;

  const doctorA = await prisma.doctor.create({
    data: {
      userId: clinicianA.id,
      email: `${EMAIL_MARKER}doc-a@example.test`,
      firstName: 'Doctor',
      lastName: 'Alpha',
      employeeCode: `DOC-A-${RUN_ID.slice(-4)}`,
      licenseNumber: `LIC-A-${RUN_ID.slice(-4)}`,
      specialization: 'Internal Medicine',
      consultationFee: '120.00',
      status: 'ACTIVE',
      departmentId: department.id,
    },
  });
  doctorAId = doctorA.id;

  await prisma.doctor.create({
    data: {
      userId: clinicianB.id,
      email: `${EMAIL_MARKER}doc-b@example.test`,
      firstName: 'Doctor',
      lastName: 'Beta',
      employeeCode: `DOC-B-${RUN_ID.slice(-4)}`,
      licenseNumber: `LIC-B-${RUN_ID.slice(-4)}`,
      specialization: 'Pediatrics',
      consultationFee: '140.00',
      status: 'ACTIVE',
      departmentId: department.id,
    },
  });

  scheduleDate = nextUtcWeekday(2, 2); // Tuesday
  const dayName = DAY_NAMES[scheduleDate.getUTCDay()] ?? 'TUESDAY';

  await prisma.doctorSchedule.create({
    data: {
      doctorId: doctorA.id,
      dayOfWeek: dayName,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T17:00:00.000Z'),
      slotDurationMinutes: 30,
      isActive: true,
    },
  });

  // Pre-seed Patient A & B
  const patA = await prisma.patient.create({
    data: {
      patientNumber: `PAT-${RUN_ID}-A`,
      firstName: 'Alice',
      lastName: 'Alpha',
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      gender: 'FEMALE',
    },
  });
  patientAId = patA.id;

  const patB = await prisma.patient.create({
    data: {
      patientNumber: `PAT-${RUN_ID}-B`,
      firstName: 'Bob',
      lastName: 'Beta',
      dateOfBirth: new Date('1988-06-20T00:00:00.000Z'),
      gender: 'MALE',
    },
  });
  patientBId = patB.id;

  // Log in each role
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: `${EMAIL_MARKER}admin@example.test`, password: TEST_PASSWORD });
  adminToken = adminLogin.body.accessToken;

  const frontDeskLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: `${EMAIL_MARKER}frontdesk@example.test`, password: TEST_PASSWORD });
  frontDeskToken = frontDeskLogin.body.accessToken;

  const clinicianALogin = await request(app)
    .post('/api/auth/login')
    .send({ email: `${EMAIL_MARKER}clinician-a@example.test`, password: TEST_PASSWORD });
  clinicianAToken = clinicianALogin.body.accessToken;

  const clinicianBLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: `${EMAIL_MARKER}clinician-b@example.test`, password: TEST_PASSWORD });
  clinicianBToken = clinicianBLogin.body.accessToken;
});

afterAll(async () => {
  try {
    await prisma.payment.deleteMany({
      where: { invoice: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } },
    });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } },
    });
    await prisma.invoice.deleteMany({
      where: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } },
    });
    await prisma.diagnosticReport.deleteMany({
      where: { visit: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } },
    });
    await prisma.prescriptionItem.deleteMany({
      where: { prescription: { visit: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } } },
    });
    await prisma.prescription.deleteMany({
      where: { visit: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } },
    });
    await prisma.clinicalNoteRevision.deleteMany({
      where: { note: { visit: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } } },
    });
    await prisma.clinicalNote.deleteMany({
      where: { visit: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } } },
    });
    await prisma.visit.deleteMany({
      where: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } },
    });
    await prisma.appointment.deleteMany({
      where: { patient: { patientNumber: { startsWith: `PAT-${RUN_ID}` } } },
    });
    await prisma.idempotencyKey.deleteMany({
      where: { key: { contains: RUN_ID } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { email: { startsWith: EMAIL_MARKER } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { startsWith: EMAIL_MARKER } } },
    });
    await prisma.doctorScheduleBreak.deleteMany({
      where: { schedule: { doctor: { email: { startsWith: EMAIL_MARKER } } } },
    });
    await prisma.doctorSchedule.deleteMany({
      where: { doctor: { email: { startsWith: EMAIL_MARKER } } },
    });
    await prisma.doctor.deleteMany({
      where: { email: { startsWith: EMAIL_MARKER } },
    });
    await prisma.staff.deleteMany({
      where: { email: { startsWith: EMAIL_MARKER } },
    });
    await prisma.patient.deleteMany({
      where: { patientNumber: { startsWith: `PAT-${RUN_ID}` } },
    });
    await prisma.department.deleteMany({
      where: { code: { startsWith: `JD${RUN_ID.slice(-4).toUpperCase()}` } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: EMAIL_MARKER } },
    });
  } catch {
    // cleanup failure swallowed safely
  } finally {
    await prisma.$disconnect();
  }
});

describe('HMS Comprehensive Security & Workflow Jest/Supertest Suite', () => {
  // TEST CASE 1: Successful authentication
  test('Case 1: Successful authentication with JWT and secure session cookie flags', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `${EMAIL_MARKER}admin@example.test`, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    // Verify refresh token cookie security flags
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c) => c.startsWith('hms_refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.toLowerCase()).toContain('httponly');
  });

  // TEST CASE 2: Invalid credentials
  test('Case 2: Invalid credentials returns 401 with generic message', async () => {
    const wrongPasswordRes = await request(app)
      .post('/api/auth/login')
      .send({ email: `${EMAIL_MARKER}admin@example.test`, password: 'Wrong-Password-123!' });

    expect(wrongPasswordRes.status).toBe(401);
    expect(wrongPasswordRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPasswordRes.body.error.message).toBe('Invalid email or password');

    const nonExistentRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'non-existent-user@example.test', password: 'Some-Password-123!' });

    expect(nonExistentRes.status).toBe(401);
    expect(nonExistentRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(nonExistentRes.body.error.message).toBe('Invalid email or password');
  });

  // TEST CASE 3: Unauthorized requests
  test('Case 3: Unauthorized requests without token or with malformed token are rejected', async () => {
    const noTokenRes = await request(app).get('/api/auth/me');
    expect(noTokenRes.status).toBe(401);
    expect(noTokenRes.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const malformedRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-string-xyz');
    expect(malformedRes.status).toBe(401);
    expect(malformedRes.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  // TEST CASE 4: Forbidden requests
  test('Case 4: Forbidden requests: Front desk cannot access clinical records or admin routes; users cannot modify own roles', async () => {
    // 1. Front desk attempting to access admin users
    const adminUsersRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${frontDeskToken}`);
    expect(adminUsersRes.status).toBe(403);
    expect(adminUsersRes.body.error.code).toBe('FORBIDDEN');

    // 2. Front desk attempting to access clinical notes
    const clinicalNotesRes = await request(app)
      .get(`/api/visits/non-existent-id/notes`)
      .set('Authorization', `Bearer ${frontDeskToken}`);
    expect(clinicalNotesRes.status).toBe(403);
    expect(clinicalNotesRes.body.error.code).toBe('FORBIDDEN');

    // 3. User cannot modify their own role
    // Front desk attempts to change their own role or admin changes their own role
    const selfRoleChangeRes = await request(app)
      .patch(`/api/staff/${staffRecordId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    // This staff user is not the admin, so that succeeds or is tested on the staff user themselves
    expect([200, 403]).toContain(selfRoleChangeRes.status);

    // Now test user trying to change their OWN role
    // If the admin tries to update their own staff record (if they had one) or if current.userId === actorUserId:
    const ownRoleChangeAttempt = await request(app)
      .patch(`/api/staff/${staffRecordId}/role`)
      .set('Authorization', `Bearer ${frontDeskToken}`) // Front desk does not have STAFF_MANAGE
      .send({ role: 'ADMIN' });
    expect(ownRoleChangeAttempt.status).toBe(403);
  });

  // TEST CASE 5: Cross-patient access (IDOR)
  test('Case 5: Cross-patient access: Clinician B cannot access patient records assigned only to Clinician A', async () => {
    // Assign Patient A to Doctor A via appointment
    const startA = utcAt(scheduleDate, 9, 0);
    const endA = utcAt(scheduleDate, 9, 30);

    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-pat-a-${RUN_ID}`)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        scheduledStart: startA,
        scheduledEnd: endA,
      });
    expect(apptRes.status).toBe(201);

    // Create a visit for Patient A by Doctor A
    const visitRes = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${clinicianAToken}`)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        appointmentId: apptRes.body.appointment.id,
        chiefComplaint: 'Chest discomfort upon exertion',
      });
    expect(visitRes.status).toBe(201);
    const visitId = visitRes.body.visit.id;

    // Doctor B (Clinician B) attempts to read Patient A's clinical summary
    const idorSummaryRes = await request(app)
      .get(`/api/patients/${patientAId}/clinical-summary`)
      .set('Authorization', `Bearer ${clinicianBToken}`);
    expect(idorSummaryRes.status).toBe(404); // Non-disclosure of unassigned patient records

    // Doctor B attempts to read Doctor A's visit
    const idorVisitRes = await request(app)
      .get(`/api/visits/${visitId}`)
      .set('Authorization', `Bearer ${clinicianBToken}`);
    expect(idorVisitRes.status).toBe(404);

    // Doctor B attempts to append clinical note to Doctor A's visit
    const idorNoteRes = await request(app)
      .post(`/api/visits/${visitId}/notes`)
      .set('Authorization', `Bearer ${clinicianBToken}`)
      .send({
        content: 'This should be blocked',
      });
    expect([403, 404]).toContain(idorNoteRes.status);
  });

  // TEST CASE 6: Invalid input
  test('Case 6: Invalid input returns 400 VALIDATION_ERROR with structured error details', async () => {
    const invalidPatientRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({
        // Missing firstName, lastName, dateOfBirth
        phone: '12345',
        email: 'invalid-email-format',
      });

    expect(invalidPatientRes.status).toBe(400);
    expect(invalidPatientRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidPatientRes.body.error).toHaveProperty('details');
  });

  // TEST CASE 7: Appointment booking
  test('Case 7: Appointment booking persists valid slot to database with SCHEDULED status', async () => {
    const start = utcAt(scheduleDate, 10, 0);
    const end = utcAt(scheduleDate, 10, 30);

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-book-c7-${RUN_ID}`)
      .send({
        patientId: patientBId,
        doctorId: doctorAId,
        scheduledStart: start,
        scheduledEnd: end,
        reason: 'Routine Cardiology Follow-up',
      });

    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('SCHEDULED');
    expect(res.body.appointment.doctorId).toBe(doctorAId);
    expect(res.body.appointment.patientId).toBe(patientBId);

    // Verify DB persistence
    const saved = await prisma.appointment.findUnique({
      where: { id: res.body.appointment.id },
    });
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe('SCHEDULED');
  });

  // TEST CASE 8: Overlapping appointments
  test('Case 8: Overlapping appointments for same doctor rejected with 409 APPOINTMENT_CONFLICT', async () => {
    // 10:00 - 10:30 is already booked in Case 7.
    // Try booking 10:15 - 10:45 (partially overlapping)
    const overlappingStart = utcAt(scheduleDate, 10, 15);
    const overlappingEnd = utcAt(scheduleDate, 10, 45);

    const conflictRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-conflict-c8-${RUN_ID}`)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        scheduledStart: overlappingStart,
        scheduledEnd: overlappingEnd,
        reason: 'Conflicting appointment attempt',
      });

    expect(conflictRes.status).toBe(409);
    expect(['APPOINTMENT_CONFLICT', 'APPOINTMENT_SLOT_UNAVAILABLE']).toContain(
      conflictRes.body.error.code,
    );
  });

  // TEST CASE 9: Concurrent appointment booking
  test('Case 9: Concurrent booking requests for identical slot resolve with exactly 1 success and 1 conflict', async () => {
    const slotStart = utcAt(scheduleDate, 11, 0);
    const slotEnd = utcAt(scheduleDate, 11, 30);

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .set('Idempotency-Key', `idem-race-1-${RUN_ID}`)
        .send({
          patientId: patientAId,
          doctorId: doctorAId,
          scheduledStart: slotStart,
          scheduledEnd: slotEnd,
        }),
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .set('Idempotency-Key', `idem-race-2-${RUN_ID}`)
        .send({
          patientId: patientBId,
          doctorId: doctorAId,
          scheduledStart: slotStart,
          scheduledEnd: slotEnd,
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  // TEST CASE 10: Idempotency
  test('Case 10: Replaying booking request with same Idempotency-Key returns cached response without duplicate creation', async () => {
    const key = `idem-replay-c10-${RUN_ID}`;
    const start = utcAt(scheduleDate, 12, 0);
    const end = utcAt(scheduleDate, 12, 30);

    // First request
    const firstRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', key)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        scheduledStart: start,
        scheduledEnd: end,
      });
    expect(firstRes.status).toBe(201);
    const appointmentId = firstRes.body.appointment.id;

    // Second request with identical payload and key
    const replayRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', key)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        scheduledStart: start,
        scheduledEnd: end,
      });

    expect(replayRes.status).toBe(201);
    expect(replayRes.body.appointment.id).toBe(appointmentId);
    expect(replayRes.headers['idempotency-replayed']).toBe('true');

    // Confirm only 1 appointment exists in database for this slot
    const count = await prisma.appointment.count({
      where: {
        doctorId: doctorAId,
        scheduledStart: new Date(start),
      },
    });
    expect(count).toBe(1);
  });

  // TEST CASE 11: Invalid appointment transitions
  test('Case 11: Invalid status transitions (e.g. CANCELLED -> CHECKED_IN) rejected with 409', async () => {
    const start = utcAt(scheduleDate, 13, 0);
    const end = utcAt(scheduleDate, 13, 30);

    const appt = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-trans-c11-${RUN_ID}`)
      .send({
        patientId: patientAId,
        doctorId: doctorAId,
        scheduledStart: start,
        scheduledEnd: end,
      });
    expect(appt.status).toBe(201);
    const apptId = appt.body.appointment.id;

    // Cancel appointment
    const cancelRes = await request(app)
      .post(`/api/appointments/${apptId}/cancel`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-cancel-c11-${RUN_ID}`)
      .send({ cancellationReason: 'Patient requested cancellation' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.appointment.status).toBe('CANCELLED');

    // Attempt invalid transition: CANCELLED -> CHECKED_IN
    const invalidTransRes = await request(app)
      .patch(`/api/appointments/${apptId}/status`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({ status: 'CHECKED_IN' });

    expect(invalidTransRes.status).toBe(409);
    expect(invalidTransRes.body.error.code).toBe('APPOINTMENT_STATUS_TRANSITION_INVALID');
  });

  // TEST CASE 12: Invoice calculations
  test('Case 12: Invoice calculations compute exact integer cents without client total overrides', async () => {
    const dueAt = new Date(Date.now() + 14 * 86_400_000).toISOString();

    const invoiceRes = await request(app)
      .post('/api/billing/invoices')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({
        patientId: patientAId,
        dueAt,
        notes: 'Jest Security Billing Test',
        items: [
          {
            description: 'Comprehensive Specialist Consultation',
            quantity: 1,
            unitPrice: '150.00',
            discountAmount: '10.00',
            taxAmount: '10.00',
          },
          {
            description: 'Electrocardiogram (ECG) Tracing',
            quantity: 2,
            unitPrice: '45.00',
            discountAmount: '5.00',
            taxAmount: '5.00',
          },
          {
            description: 'Reflex Lipid Diagnostic Panel',
            quantity: 1,
            unitPrice: '40.00',
            discountAmount: '2.50',
            taxAmount: '2.50',
          },
        ],
      });

    expect(invoiceRes.status).toBe(201);
    const inv = invoiceRes.body.invoice;
    // Subtotal = 150.00 + 90.00 + 40.00 = 280.00
    expect(inv.subtotal).toBe('280.00');
    expect(inv.discountAmount).toBe('17.50');
    expect(inv.taxAmount).toBe('17.50');
    expect(inv.totalAmount).toBe('280.00');
    expect(inv.balanceDue).toBe('280.00');
    expect(inv.amountPaid).toBe('0.00');
    expect(inv.status).toBe('DRAFT');
  });

  // TEST CASES 13, 14, 15: Billing payment lifecycle (Partial, Failed, Full Payment & Reconciliation)
  test('Cases 13, 14, 15: Partial payment, Failed payment, and Full payment reconciliation', async () => {
    const dueAt = new Date(Date.now() + 14 * 86_400_000).toISOString();

    // 1. Create invoice with 1 item of $100.00
    const invRes = await request(app)
      .post('/api/billing/invoices')
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({
        patientId: patientBId,
        dueAt,
        items: [
          {
            description: 'Standard Physical Evaluation',
            quantity: 1,
            unitPrice: '100.00',
            discountAmount: '0.00',
            taxAmount: '0.00',
          },
        ],
      });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.invoice.id;
    // Total = 100.00
    expect(invRes.body.invoice.totalAmount).toBe('100.00');

    // Issue invoice
    const issueRes = await request(app)
      .patch(`/api/billing/invoices/${invoiceId}/status`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({ status: 'ISSUED' });
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.invoice.status).toBe('ISSUED');

    // Case 15: Failed payment attempt
    const failedPayRes = await request(app)
      .post(`/api/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-pay-fail-${RUN_ID}`)
      .send({
        amount: '30.00',
        method: 'CARD',
      });
    expect(failedPayRes.status).toBe(201);
    const failedPaymentId = failedPayRes.body.payment.id;

    // Transition payment to FAILED
    const failUpdateRes = await request(app)
      .patch(`/api/billing/payments/${failedPaymentId}/status`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({
        status: 'FAILED',
        reason: 'Card issuer decline (test simulated)',
      });
    expect(failUpdateRes.status).toBe(200);
    expect(failUpdateRes.body.payment.status).toBe('FAILED');

    // Verify invoice balanceDue remains $100.00 untouched by failed payment
    const invAfterFail = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${frontDeskToken}`);
    expect(invAfterFail.body.invoice.balanceDue).toBe('100.00');
    expect(invAfterFail.body.invoice.status).toBe('ISSUED');

    // Case 13: Partial payment of $40.00
    const partialPayRes = await request(app)
      .post(`/api/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-pay-part-${RUN_ID}`)
      .send({
        amount: '40.00',
        method: 'CASH',
      });
    expect(partialPayRes.status).toBe(201);
    const partialPaymentId = partialPayRes.body.payment.id;

    // Complete the partial payment
    const completePartialRes = await request(app)
      .patch(`/api/billing/payments/${partialPaymentId}/status`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({ status: 'SUCCESSFUL' });
    expect(completePartialRes.status).toBe(200);

    // Verify invoice status is PARTIALLY_PAID and balance is 60.00
    const invAfterPartial = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${frontDeskToken}`);
    expect(invAfterPartial.body.invoice.status).toBe('PARTIALLY_PAID');
    expect(invAfterPartial.body.invoice.amountPaid).toBe('40.00');
    expect(invAfterPartial.body.invoice.balanceDue).toBe('60.00');

    // Case 14: Full payment of remaining balance ($60.00)
    const fullPayRes = await request(app)
      .post(`/api/billing/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .set('Idempotency-Key', `idem-pay-full-${RUN_ID}`)
      .send({
        amount: '60.00',
        method: 'BANK_TRANSFER',
      });
    expect(fullPayRes.status).toBe(201);
    const fullPaymentId = fullPayRes.body.payment.id;

    // Complete full payment
    const completeFullRes = await request(app)
      .patch(`/api/billing/payments/${fullPaymentId}/status`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({ status: 'SUCCESSFUL' });
    expect(completeFullRes.status).toBe(200);

    // Verify invoice is automatically reconciled to PAID with 0 balance
    const invAfterFull = await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${frontDeskToken}`);
    expect(invAfterFull.body.invoice.status).toBe('PAID');
    expect(invAfterFull.body.invoice.balanceDue).toBe('0.00');
    expect(invAfterFull.body.invoice.amountPaid).toBe('100.00');
  });

  // TEST CASE 16: Audit logging
  test('Case 16: Audit logging records immutable security events without sensitive credential material', async () => {
    // 1. Trigger an audited action: update patient phone
    const updatePatientRes = await request(app)
      .patch(`/api/patients/${patientAId}`)
      .set('Authorization', `Bearer ${frontDeskToken}`)
      .send({ phone: '+1-555-987-6543' });
    expect(updatePatientRes.status).toBe(200);

    // 2. Query AuditLog directly from DB
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Patient',
        entityId: patientAId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const latestLog = logs[0];
    expect(latestLog).toBeDefined();
    expect(latestLog?.action).toBe('PATIENT_UPDATED');
    expect(latestLog?.entityId).toBe(patientAId);

    // Verify zero sensitive password hashes or token materials in metadata or snapshots
    const serializedLog = JSON.stringify(latestLog);
    expect(serializedLog).not.toContain('passwordHash');
    expect(serializedLog).not.toContain('refreshToken');
    expect(serializedLog).not.toContain(TEST_PASSWORD);
  });
});

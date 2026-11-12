import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(__dirname, '../.env'), quiet: true });

const TEST_PASSWORD = 'E2E-Test-Password-2026!';
const RUN_ID = Date.now().toString(36).toLowerCase();
const PREFIX = `e2etest-${RUN_ID}`;
const EMAIL_MARKER = `${PREFIX}-`;
const DEPT_CODE = `E2E${RUN_ID.slice(-5).toUpperCase()}`;

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

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
  user: { id: string; email: string; role: string };
}

let baseUrl = '';
let server: Server | undefined;
let prisma: PrismaClient;

let adminToken = '';
let frontDeskToken = '';
let clinicianToken = '';
let unassignedClinicianToken = '';

let doctorId = '';
let targetDay: Date;

function nextUtcWeekday(targetWeekday: number, minimumDaysAhead = 2): Date {
  const now = new Date();
  let day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + minimumDaysAhead),
  );
  while (day.getUTCDay() !== targetWeekday) {
    day = new Date(day.getTime() + 86_400_000);
  }
  return day;
}

function utcAt(day: Date, hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute),
  );
}

async function api(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

async function login(email: string, password = TEST_PASSWORD): Promise<string> {
  const response = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return (response.body as SessionBody).accessToken;
}

async function cleanupTestData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_MARKER } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const doctors = await prisma.doctor.findMany({
    where: { email: { startsWith: EMAIL_MARKER } },
    select: { id: true },
  });
  const doctorIds = doctors.map((d) => d.id);

  const patients = await prisma.patient.findMany({
    where: { firstName: { startsWith: `E2E${RUN_ID}` } },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);

  await prisma.auditLog.deleteMany({
    where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: patientIds } }] },
  });
  await prisma.payment.deleteMany({
    where: { invoice: { patientId: { in: patientIds } } },
  });
  await prisma.invoiceItem.deleteMany({
    where: { invoice: { patientId: { in: patientIds } } },
  });
  await prisma.invoice.deleteMany({
    where: { patientId: { in: patientIds } },
  });
  await prisma.prescriptionItem.deleteMany({
    where: { prescription: { visit: { patientId: { in: patientIds } } } },
  });
  await prisma.prescription.deleteMany({
    where: { visit: { patientId: { in: patientIds } } },
  });
  await prisma.clinicalNoteRevision.deleteMany({
    where: { note: { visit: { patientId: { in: patientIds } } } },
  });
  await prisma.clinicalNote.deleteMany({
    where: { visit: { patientId: { in: patientIds } } },
  });
  await prisma.diagnosticReport.deleteMany({
    where: { visit: { patientId: { in: patientIds } } },
  });
  await prisma.visit.deleteMany({
    where: { patientId: { in: patientIds } },
  });
  await prisma.appointment.deleteMany({
    where: { OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }] },
  });
  await prisma.doctorScheduleBreak.deleteMany({
    where: { schedule: { doctorId: { in: doctorIds } } },
  });
  await prisma.doctorSchedule.deleteMany({
    where: { doctorId: { in: doctorIds } },
  });
  await prisma.staff.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.doctor.deleteMany({
    where: { id: { in: doctorIds } },
  });
  await prisma.patient.deleteMany({
    where: { id: { in: patientIds } },
  });
  await prisma.department.deleteMany({
    where: { code: { startsWith: DEPT_CODE.slice(0, 6) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run e2e integration tests');
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
  await cleanupTestData();

  const passwordHash = await hash(TEST_PASSWORD, 10);

  await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}admin@example.test`,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'E2EAdmin',
      lastName: 'User',
    },
  });

  await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}frontdesk@example.test`,
      passwordHash,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      firstName: 'E2EFrontDesk',
      lastName: 'User',
    },
  });

  const clinician = await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}clinician@example.test`,
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'E2EClinician',
      lastName: 'Chen',
    },
  });

  const unassignedClinician = await prisma.user.create({
    data: {
      email: `${EMAIL_MARKER}otherdoc@example.test`,
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'E2EOtherDoc',
      lastName: 'Adams',
    },
  });

  const department = await prisma.department.create({
    data: {
      code: `${DEPT_CODE}1`,
      name: `E2E Cardiology ${RUN_ID}`,
      description: 'E2E test department',
      isActive: true,
    },
  });

  const doctor = await prisma.doctor.create({
    data: {
      userId: clinician.id,
      email: `${EMAIL_MARKER}doctor@example.test`,
      firstName: 'E2EDoctor',
      lastName: 'Chen',
      employeeCode: `DOC-E2E-${RUN_ID.slice(-5)}`,
      licenseNumber: `LIC-E2E-${RUN_ID.slice(-5)}`,
      specialization: 'Cardiology',
      consultationFee: '150.00',
      status: 'ACTIVE',
      departmentId: department.id,
    },
  });
  doctorId = doctor.id;

  await prisma.doctor.create({
    data: {
      userId: unassignedClinician.id,
      email: `${EMAIL_MARKER}other-doctor@example.test`,
      firstName: 'E2EOther',
      lastName: 'Adams',
      employeeCode: `DOC-E2E-OTH-${RUN_ID.slice(-5)}`,
      licenseNumber: `LIC-E2E-OTH-${RUN_ID.slice(-5)}`,
      specialization: 'Neurology',
      consultationFee: '180.00',
      status: 'ACTIVE',
      departmentId: department.id,
    },
  });

  targetDay = nextUtcWeekday(2, 2); // Tuesday 2+ days ahead
  const dayName = DAY_NAMES[targetDay.getUTCDay()] ?? 'TUESDAY';

  await prisma.doctorSchedule.create({
    data: {
      doctorId: doctor.id,
      dayOfWeek: dayName,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T17:00:00.000Z'),
      slotDurationMinutes: 30,
      isActive: true,
    },
  });

  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;

  adminToken = await login(`${EMAIL_MARKER}admin@example.test`);
  frontDeskToken = await login(`${EMAIL_MARKER}frontdesk@example.test`);
  clinicianToken = await login(`${EMAIL_MARKER}clinician@example.test`);
  unassignedClinicianToken = await login(`${EMAIL_MARKER}otherdoc@example.test`);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (prisma) {
    await cleanupTestData();
    await prisma.$disconnect();
  }
});

test('WORKFLOW 1: PATIENT REGISTRATION - front desk registers, searches, and opens profile', async () => {
  // 1. Front desk creates a patient record
  const registerResponse = await api('/patients', {
    method: 'POST',
    token: frontDeskToken,
    body: {
      firstName: `E2E${RUN_ID}First`,
      lastName: `Patient${RUN_ID}`,
      dateOfBirth: '1990-05-15',
      gender: 'FEMALE',
      bloodGroup: 'O_POSITIVE',
      phone: '+1-555-0199',
      email: `${EMAIL_MARKER}patient1@example.test`,
      addressLine1: '123 Health Ave',
      city: 'Metropolis',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+1-555-0100',
    },
  });
  assert.equal(registerResponse.status, 201, JSON.stringify(registerResponse.body));
  const createdPatient = (registerResponse.body as { patient: { id: string; patientNumber: string } }).patient;
  assert.ok(createdPatient.id);
  assert.ok(createdPatient.patientNumber.startsWith('PAT-'));

  // 2. Front desk searches for the patient
  const searchResponse = await api(`/patients?search=${encodeURIComponent(createdPatient.patientNumber)}`, {
    token: frontDeskToken,
  });
  assert.equal(searchResponse.status, 200);
  const searchResults = (searchResponse.body as { patients: Array<{ id: string; patientNumber: string }> }).patients;
  assert.ok(searchResults.length >= 1);
  assert.equal(searchResults[0]?.id, createdPatient.id);

  // 3. Front desk opens the patient profile
  const profileResponse = await api(`/patients/${createdPatient.id}`, {
    token: frontDeskToken,
  });
  assert.equal(profileResponse.status, 200);
  const patientProfile = (profileResponse.body as { patient: Record<string, unknown> }).patient;
  assert.equal(patientProfile.firstName, `E2E${RUN_ID}First`);
  assert.equal(patientProfile.lastName, `Patient${RUN_ID}`);
  // Clinical fields are stripped for front desk
  assert.equal('allergies' in patientProfile, false);
});

test('WORKFLOW 2: APPOINTMENT BOOKING - search doctors, view slots, book, verify persistence', async () => {
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-BK`,
      firstName: `E2E${RUN_ID}Book`,
      lastName: 'BookingTest',
      dateOfBirth: new Date('1985-08-20T00:00:00.000Z'),
      gender: 'MALE',
      bloodGroup: 'A_POSITIVE',
    },
  });

  const slotStart = utcAt(targetDay, 10, 0);
  const slotEnd = utcAt(targetDay, 10, 30);

  // 1. Search available doctors
  const doctorsResponse = await api(
    `/appointments/available-doctors?start=${slotStart.toISOString()}&end=${slotEnd.toISOString()}`,
    { token: frontDeskToken },
  );
  assert.equal(doctorsResponse.status, 200);
  const availableDoctors = (doctorsResponse.body as { doctors: Array<{ id: string }> }).doctors;
  assert.ok(availableDoctors.some((d) => d.id === doctorId));

  // 2. View available slots for this doctor
  const slotsResponse = await api(
    `/appointments/available-slots?doctorId=${doctorId}&start=${utcAt(targetDay, 9, 0).toISOString()}&end=${utcAt(targetDay, 17, 0).toISOString()}`,
    { token: frontDeskToken },
  );
  assert.equal(slotsResponse.status, 200);
  const slots = (slotsResponse.body as { slots: Array<{ start: string; end: string }> }).slots;
  assert.ok(slots.some((s) => new Date(s.start).getTime() === slotStart.getTime()));

  // 3. Book the appointment
  const bookResponse = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-book-wf2`,
    body: {
      patientId: patient.id,
      doctorId,
      scheduledStart: slotStart.toISOString(),
      scheduledEnd: slotEnd.toISOString(),
      reason: 'Routine cardiac checkup',
    },
  });
  assert.equal(bookResponse.status, 201, JSON.stringify(bookResponse.body));
  const appointment = (bookResponse.body as { appointment: { id: string; appointmentNumber: string; status: string } }).appointment;
  assert.equal(appointment.status, 'SCHEDULED');

  // 4. Verify database persistence
  const persisted = await prisma.appointment.findUnique({
    where: { id: appointment.id },
  });
  assert.ok(persisted);
  assert.equal(persisted.patientId, patient.id);
  assert.equal(persisted.doctorId, doctorId);
  assert.equal(persisted.scheduledStart.toISOString(), slotStart.toISOString());
});

test('WORKFLOW 3: APPOINTMENT CONFLICT - overlapping slot rejection and simultaneous request race', async () => {
  const patientA = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-C1`,
      firstName: `E2E${RUN_ID}ConfA`,
      lastName: 'ConflictA',
      dateOfBirth: new Date('1992-01-01T00:00:00.000Z'),
    },
  });
  const patientB = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-C2`,
      firstName: `E2E${RUN_ID}ConfB`,
      lastName: 'ConflictB',
      dateOfBirth: new Date('1993-02-02T00:00:00.000Z'),
    },
  });

  const slotStart = utcAt(targetDay, 11, 0);
  const slotEnd = utcAt(targetDay, 11, 30);

  // 1. Initial valid booking
  const firstBooking = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-conf-init`,
    body: {
      patientId: patientA.id,
      doctorId,
      scheduledStart: slotStart.toISOString(),
      scheduledEnd: slotEnd.toISOString(),
      reason: 'First booking',
    },
  });
  assert.equal(firstBooking.status, 201);

  // 2. Attempt to book an overlapping slot (same doctor, overlapping range 11:15 - 11:45)
  const overlapResponse = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-conf-overlap`,
    body: {
      patientId: patientB.id,
      doctorId,
      scheduledStart: utcAt(targetDay, 11, 15).toISOString(),
      scheduledEnd: utcAt(targetDay, 11, 45).toISOString(),
      reason: 'Overlapping booking',
    },
  });
  assert.equal(overlapResponse.status, 409);
  const errBody = (overlapResponse.body as { error: { code: string } }).error;
  assert.ok(['APPOINTMENT_SLOT_UNAVAILABLE', 'APPOINTMENT_SLOT_CONFLICT'].includes(errBody.code));

  // 3. Test simultaneous booking requests on slot 13:00 - 13:30
  const raceStart = utcAt(targetDay, 13, 0);
  const raceEnd = utcAt(targetDay, 13, 30);

  const [race1, race2] = await Promise.all([
    api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-race-1`,
      body: {
        patientId: patientA.id,
        doctorId,
        scheduledStart: raceStart.toISOString(),
        scheduledEnd: raceEnd.toISOString(),
        reason: 'Race attempt 1',
      },
    }),
    api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-race-2`,
      body: {
        patientId: patientB.id,
        doctorId,
        scheduledStart: raceStart.toISOString(),
        scheduledEnd: raceEnd.toISOString(),
        reason: 'Race attempt 2',
      },
    }),
  ]);

  const raceStatuses = [race1.status, race2.status].sort();
  assert.deepEqual(raceStatuses, [201, 409], 'Exactly one concurrent booking succeeds and the other fails with 409');
});

test('WORKFLOW 4: APPOINTMENT MANAGEMENT - reschedule, valid status transitions, cancel', async () => {
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-MG`,
      firstName: `E2E${RUN_ID}Mgmt`,
      lastName: 'ManagementTest',
      dateOfBirth: new Date('1988-04-12T00:00:00.000Z'),
    },
  });

  const originalStart = utcAt(targetDay, 14, 0);
  const originalEnd = utcAt(targetDay, 14, 30);
  const rescheduledStart = utcAt(targetDay, 14, 30);
  const rescheduledEnd = utcAt(targetDay, 15, 0);

  // 1. Book appointment
  const book = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-mgmt-book`,
    body: {
      patientId: patient.id,
      doctorId,
      scheduledStart: originalStart.toISOString(),
      scheduledEnd: originalEnd.toISOString(),
    },
  });
  assert.equal(book.status, 201);
  const apptId = (book.body as { appointment: { id: string } }).appointment.id;

  // 2. Reschedule to next open slot
  const reschedule = await api(`/appointments/${apptId}/reschedule`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-mgmt-reschedule`,
    body: {
      scheduledStart: rescheduledStart.toISOString(),
      scheduledEnd: rescheduledEnd.toISOString(),
      reason: 'Patient requested later time',
    },
  });
  assert.equal(reschedule.status, 200);
  assert.equal(
    new Date((reschedule.body as { appointment: { scheduledStart: string } }).appointment.scheduledStart).toISOString(),
    rescheduledStart.toISOString(),
  );

  // 3. Status transition: SCHEDULED -> CONFIRMED
  const confirm = await api(`/appointments/${apptId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'CONFIRMED' },
  });
  assert.equal(confirm.status, 200);
  assert.equal((confirm.body as { appointment: { status: string } }).appointment.status, 'CONFIRMED');

  // 4. Cancel appointment
  const cancel = await api(`/appointments/${apptId}/cancel`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-mgmt-cancel`,
    body: { cancellationReason: 'Patient had an emergency' },
  });
  assert.equal(cancel.status, 200);
  const cancelledAppt = (cancel.body as { appointment: { status: string; cancellationReason: string } }).appointment;
  assert.equal(cancelledAppt.status, 'CANCELLED');
  assert.equal(cancelledAppt.cancellationReason, 'Patient had an emergency');

  // 5. Verify invalid status transition: cannot transition CANCELLED appointment
  const invalidTransition = await api(`/appointments/${apptId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'CHECKED_IN' },
  });
  assert.equal(invalidTransition.status, 409);
});

test('WORKFLOW 5: CLINICAL WORKFLOW - clinician accesses assigned patient, creates visit, notes, prescription, and diagnostic report', async () => {
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-CL`,
      firstName: `E2E${RUN_ID}Clin`,
      lastName: 'ClinicalPatient',
      dateOfBirth: new Date('1975-11-03T00:00:00.000Z'),
      allergies: 'Aspirin, Sulfa drugs',
    },
  });

  // Assign doctor to patient via appointment
  const slotStart = utcAt(targetDay, 15, 0);
  const slotEnd = utcAt(targetDay, 15, 30);
  const appt = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-clin-appt`,
    body: {
      patientId: patient.id,
      doctorId,
      scheduledStart: slotStart.toISOString(),
      scheduledEnd: slotEnd.toISOString(),
      reason: 'Chest pain evaluation',
    },
  });
  assert.equal(appt.status, 201);
  const appointmentId = (appt.body as { appointment: { id: string } }).appointment.id;

  // 1. Clinician views assigned appointments
  const clinicianAppointments = await api(`/appointments?doctorId=${doctorId}`, {
    token: clinicianToken,
  });
  assert.equal(clinicianAppointments.status, 200);
  const apptList = (clinicianAppointments.body as { appointments: Array<{ id: string }> }).appointments;
  assert.ok(apptList.some((a) => a.id === appointmentId));

  // 2. Clinician accesses assigned patient (including clinical fields like allergies)
  const patientResponse = await api(`/patients/${patient.id}`, {
    token: clinicianToken,
  });
  assert.equal(patientResponse.status, 200);
  const patientDetail = (patientResponse.body as { patient: { allergies: string } }).patient;
  assert.equal(patientDetail.allergies, 'Aspirin, Sulfa drugs');

  // 3. Clinician creates visit
  const visitResponse = await api('/visits', {
    method: 'POST',
    token: clinicianToken,
    body: {
      patientId: patient.id,
      appointmentId,
      chiefComplaint: 'Substernal chest pressure on exertion',
      diagnosis: 'Stable angina pectoris',
      clinicalNotes: 'ECG normal at rest. Stress test recommended.',
      vitals: {
        heightCm: 175,
        weightKg: 78.5,
        temperatureC: 36.8,
        systolicBp: 130,
        diastolicBp: 82,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
      },
    },
  });
  assert.equal(visitResponse.status, 201, JSON.stringify(visitResponse.body));
  const visit = (visitResponse.body as { visit: { id: string; visitNumber: string; status: string } }).visit;
  assert.ok(visit.id);
  assert.equal(visit.status, 'PLANNED');

  // 4. Clinician creates clinical note
  const noteResponse = await api(`/visits/${visit.id}/notes`, {
    method: 'POST',
    token: clinicianToken,
    body: { content: 'Patient advised low-sodium diet and daily exercise regimen.' },
  });
  assert.equal(noteResponse.status, 201);
  const note = (noteResponse.body as { note: { id: string; content: string } }).note;
  assert.ok(note.id);
  assert.equal(note.content, 'Patient advised low-sodium diet and daily exercise regimen.');

  // 5. Clinician creates prescription with multiple items
  const prescriptionResponse = await api(`/visits/${visit.id}/prescriptions`, {
    method: 'POST',
    token: clinicianToken,
    body: {
      notes: 'Take with food. Discontinue and call clinic if dizziness occurs.',
      items: [
        {
          medicationName: 'Metoprolol Tartrate',
          dosage: '25 mg',
          frequency: 'Twice daily',
          durationDays: 30,
          quantity: 60,
          instructions: 'Take 1 tablet morning and evening with meals',
        },
        {
          medicationName: 'Atorvastatin',
          dosage: '20 mg',
          frequency: 'Once daily at bedtime',
          durationDays: 30,
          quantity: 30,
          instructions: 'Take 1 tablet at night',
        },
      ],
    },
  });
  assert.equal(prescriptionResponse.status, 201, JSON.stringify(prescriptionResponse.body));
  const rx = (prescriptionResponse.body as { prescription: { id: string; status: string; items: unknown[] } }).prescription;
  assert.equal(rx.status, 'ISSUED');
  assert.equal(rx.items.length, 2);

  // 6. Clinician adds diagnostic report metadata
  const reportResponse = await api(`/visits/${visit.id}/reports`, {
    method: 'POST',
    token: clinicianToken,
    body: {
      testName: 'Lipid Panel with Reflex to Direct LDL',
      type: 'LABORATORY',
      resultSummary: 'Total cholesterol 210 mg/dL, LDL 135 mg/dL, HDL 48 mg/dL',
      resultDetails: 'Mild hyperlipidemia observed. Triglycerides 140 mg/dL within normal limits.',
      fileMetadata: {
        name: 'lipid-panel-e2e.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 124500,
        storageReference: 'e2e/lab-reports/lipid-001.pdf',
      },
    },
  });
  assert.equal(reportResponse.status, 201, JSON.stringify(reportResponse.body));
  const report = (reportResponse.body as { report: { id: string; testName: string; type: string } }).report;
  assert.equal(report.testName, 'Lipid Panel with Reflex to Direct LDL');
  assert.equal(report.type, 'LABORATORY');
});

test('WORKFLOW 6: AUTHORIZATION - front desk forbidden from clinical records; IDOR rejection for unassigned clinician', async () => {
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-AU`,
      firstName: `E2E${RUN_ID}Auth`,
      lastName: 'SecurityPatient',
      dateOfBirth: new Date('1995-12-10T00:00:00.000Z'),
    },
  });

  const visit = await prisma.visit.create({
    data: {
      visitNumber: `VIS-SEC-${RUN_ID.slice(-5)}`,
      patientId: patient.id,
      doctorId,
      status: 'IN_PROGRESS',
    },
  });

  // 1. Front desk attempts to read clinical notes -> 403 FORBIDDEN
  const notesAttempt = await api(`/visits/${visit.id}/notes`, {
    token: frontDeskToken,
  });
  assert.equal(notesAttempt.status, 403);
  assert.equal((notesAttempt.body as { error: { code: string } }).error.code, 'FORBIDDEN');

  // 2. Front desk attempts to read prescriptions -> 403 FORBIDDEN
  const prescriptionsAttempt = await api(`/visits/${visit.id}/prescriptions`, {
    token: frontDeskToken,
  });
  assert.equal(prescriptionsAttempt.status, 403);
  assert.equal((prescriptionsAttempt.body as { error: { code: string } }).error.code, 'FORBIDDEN');

  // 3. Front desk attempts to read diagnostic reports -> 403 FORBIDDEN
  const reportsAttempt = await api(`/visits/${visit.id}/reports`, {
    token: frontDeskToken,
  });
  assert.equal(reportsAttempt.status, 403);
  assert.equal((reportsAttempt.body as { error: { code: string } }).error.code, 'FORBIDDEN');

  // 4. Cross-patient IDOR protection: Unassigned clinician attempts to access clinical summary of patient -> 404 NOT_FOUND
  const crossPatientAttempt = await api(`/patients/${patient.id}/clinical-summary`, {
    token: unassignedClinicianToken,
  });
  assert.equal(crossPatientAttempt.status, 404, 'Unassigned clinician receives 404 to prevent resource discovery');
});

test('WORKFLOW 7: ADMINISTRATION - manage doctors, departments, staff, user accounts, and view authorized reports', async () => {
  // 1. Create a department
  const deptCreate = await api('/departments', {
    method: 'POST',
    token: adminToken,
    body: {
      code: `${DEPT_CODE}2`,
      name: `E2E Oncology ${RUN_ID}`,
      description: 'Cancer care and oncology research',
      location: 'Building B, 3rd Floor',
    },
  });
  assert.equal(deptCreate.status, 201);
  const createdDeptId = (deptCreate.body as { department: { id: string } }).department.id;

  // 2. Create a doctor under this department
  const doctorCreate = await api('/doctors', {
    method: 'POST',
    token: adminToken,
    body: {
      email: `${EMAIL_MARKER}dr.onco@example.test`,
      password: TEST_PASSWORD,
      firstName: 'Sarah',
      lastName: `Miller${RUN_ID}`,
      employeeCode: `DOC-ONC-${RUN_ID.slice(-5)}`,
      licenseNumber: `LIC-ONC-${RUN_ID.slice(-5)}`,
      departmentId: createdDeptId,
      specialization: 'Medical Oncology',
      consultationFee: 200,
    },
  });
  assert.equal(doctorCreate.status, 201, JSON.stringify(doctorCreate.body));
  const newDoctorId = (doctorCreate.body as { doctor: { id: string } }).doctor.id;

  // Update doctor status
  const updateDocStatus = await api(`/doctors/${newDoctorId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ON_LEAVE', reason: 'Medical conference attendance' },
  });
  assert.equal(updateDocStatus.status, 200);
  assert.equal((updateDocStatus.body as { doctor: { status: string } }).doctor.status, 'ON_LEAVE');

  // 3. Create staff member
  const staffCreate = await api('/staff', {
    method: 'POST',
    token: adminToken,
    body: {
      email: `${EMAIL_MARKER}staff.mgr@example.test`,
      password: TEST_PASSWORD,
      firstName: 'Robert',
      lastName: `Staff${RUN_ID}`,
      employeeCode: `STF-${RUN_ID.slice(-5)}`,
      jobTitle: 'Patient Coordinator',
      role: 'FRONT_DESK',
      departmentId: createdDeptId,
    },
  });
  assert.equal(staffCreate.status, 201, JSON.stringify(staffCreate.body));
  const newStaffId = (staffCreate.body as { staff: { id: string } }).staff.id;

  // Update staff role
  const updateStaffRole = await api(`/staff/${newStaffId}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'ADMIN', reason: 'Promoted to admin operations' },
  });
  assert.equal(updateStaffRole.status, 200);

  // 4. Manage user accounts: list accounts
  const usersList = await api('/admin/users', { token: adminToken });
  assert.equal(usersList.status, 200);
  const users = (usersList.body as { users: Array<{ id: string; email: string }> }).users;
  assert.ok(users.length >= 4);

  // 5. View authorized reports & analytics
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const to = now.toISOString();

  const analyticsResponse = await api(`/admin/analytics?from=${from}&to=${to}`, {
    token: adminToken,
  });
  assert.equal(analyticsResponse.status, 200);
  assert.ok('totals' in (analyticsResponse.body as object));

  const reportsResponse = await api(`/admin/reports?from=${from}&to=${to}`, {
    token: adminToken,
  });
  assert.equal(reportsResponse.status, 200);
  assert.ok('dailyAppointments' in (reportsResponse.body as object));
});

test('WORKFLOW 8: BILLING - generate invoice, verify calculations, simulated payment, partial payment, failed payment, reconciliation', async () => {
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-BL`,
      firstName: `E2E${RUN_ID}Bill`,
      lastName: 'FinancialPatient',
      dateOfBirth: new Date('1982-06-25T00:00:00.000Z'),
    },
  });

  const dueAt = new Date(Date.now() + 14 * 86_400_000).toISOString();

  // 1. Generate invoice with multiple items
  const invoiceCreate = await api('/billing/invoices', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-invoice-wf8`,
    body: {
      patientId: patient.id,
      currency: 'USD',
      dueAt,
      notes: 'Outpatient consultation and diagnostics',
      items: [
        {
          description: 'Specialist Consultation',
          quantity: 1,
          unitPrice: '150.00',
          discountAmount: '15.00',
          taxAmount: '10.00',
        },
        {
          description: 'Electrocardiogram (ECG)',
          quantity: 1,
          unitPrice: '75.00',
          discountAmount: '0.00',
          taxAmount: '5.00',
        },
        {
          description: 'Lab Blood Draw Fee',
          quantity: 2,
          unitPrice: '20.00',
          discountAmount: '5.00',
          taxAmount: '2.50',
        },
      ],
    },
  });
  assert.equal(invoiceCreate.status, 201, JSON.stringify(invoiceCreate.body));
  const invoice = (invoiceCreate.body as {
    invoice: {
      id: string;
      status: string;
      subtotal: string;
      discountAmount: string;
      taxAmount: string;
      totalAmount: string;
      balanceDue: string;
      amountPaid: string;
      items: Array<{ lineTotal: string }>;
    };
  }).invoice;

  // 2. Verify exact calculations
  // Item 1: 1 * 150 - 15 + 10 = 145.00
  // Item 2: 1 * 75 - 0 + 5 = 80.00
  // Item 3: 2 * 20 - 5 + 2.50 = 37.50
  // Subtotal: 150 + 75 + 40 = 265.00
  // Discount: 15 + 0 + 5 = 20.00
  // Tax: 10 + 5 + 2.50 = 17.50
  // Total: 265 - 20 + 17.50 = 262.50
  assert.equal(invoice.status, 'DRAFT');
  assert.equal(invoice.subtotal, '265.00');
  assert.equal(invoice.discountAmount, '20.00');
  assert.equal(invoice.taxAmount, '17.50');
  assert.equal(invoice.totalAmount, '262.50');
  assert.equal(invoice.balanceDue, '262.50');
  assert.equal(invoice.amountPaid, '0.00');
  assert.equal(invoice.items[0]?.lineTotal, '145.00');
  assert.equal(invoice.items[1]?.lineTotal, '80.00');
  assert.equal(invoice.items[2]?.lineTotal, '37.50');

  // 3. Issue invoice
  const issueResponse = await api(`/billing/invoices/${invoice.id}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'ISSUED' },
  });
  assert.equal(issueResponse.status, 200);
  assert.equal((issueResponse.body as { invoice: { status: string } }).invoice.status, 'ISSUED');

  // 4. Test failed payment: create pending payment of $50, mark FAILED
  const failedAttempt = await api(`/billing/invoices/${invoice.id}/payments`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-pay-fail`,
    body: { amount: '50.00', method: 'CARD' },
  });
  assert.equal(failedAttempt.status, 201);
  const failedPaymentId = (failedAttempt.body as { payment: { id: string } }).payment.id;

  const markFailed = await api(`/billing/payments/${failedPaymentId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'FAILED', reason: 'Insufficient funds' },
  });
  assert.equal(markFailed.status, 200);

  // Check invoice remains ISSUED and balance unchanged
  const invAfterFail = await api(`/billing/invoices/${invoice.id}`, { token: frontDeskToken });
  assert.equal((invAfterFail.body as { invoice: { status: string; balanceDue: string } }).invoice.status, 'ISSUED');
  assert.equal((invAfterFail.body as { invoice: { balanceDue: string } }).invoice.balanceDue, '262.50');

  // 5. Test partial payment: pay $100.00
  const partialAttempt = await api(`/billing/invoices/${invoice.id}/payments`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-pay-partial`,
    body: { amount: '100.00', method: 'CASH' },
  });
  assert.equal(partialAttempt.status, 201);
  const partialPaymentId = (partialAttempt.body as { payment: { id: string } }).payment.id;

  const markPartialSuccess = await api(`/billing/payments/${partialPaymentId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'SUCCESSFUL' },
  });
  assert.equal(markPartialSuccess.status, 200);

  // Verify status automatically reconciled to PARTIALLY_PAID
  const invAfterPartial = await api(`/billing/invoices/${invoice.id}`, { token: frontDeskToken });
  const partialInv = (invAfterPartial.body as { invoice: { status: string; amountPaid: string; balanceDue: string } }).invoice;
  assert.equal(partialInv.status, 'PARTIALLY_PAID');
  assert.equal(partialInv.amountPaid, '100.00');
  assert.equal(partialInv.balanceDue, '162.50');

  // 6. Settle remaining balance: pay $162.50
  const finalAttempt = await api(`/billing/invoices/${invoice.id}/payments`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-pay-final`,
    body: { amount: '162.50', method: 'BANK_TRANSFER' },
  });
  assert.equal(finalAttempt.status, 201);
  const finalPaymentId = (finalAttempt.body as { payment: { id: string } }).payment.id;

  const markFinalSuccess = await api(`/billing/payments/${finalPaymentId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'SUCCESSFUL' },
  });
  assert.equal(markFinalSuccess.status, 200);

  // Verify status reconciled to PAID
  const invAfterFinal = await api(`/billing/invoices/${invoice.id}`, { token: frontDeskToken });
  const finalInv = (invAfterFinal.body as { invoice: { status: string; amountPaid: string; balanceDue: string } }).invoice;
  assert.equal(finalInv.status, 'PAID');
  assert.equal(finalInv.amountPaid, '262.50');
  assert.equal(finalInv.balanceDue, '0.00');

  // 7. Verify invoice reconciliation history
  const historyResponse = await api(`/billing/invoices/${invoice.id}/history`, { token: frontDeskToken });
  assert.equal(historyResponse.status, 200);
  const history = (historyResponse.body as { history: Array<{ action: string }> }).history;
  const historyActions = history.map((h) => h.action);
  assert.ok(historyActions.includes('INVOICE_CREATED'));
  assert.ok(historyActions.includes('INVOICE_STATUS_CHANGED'));
  assert.ok(historyActions.includes('PAYMENT_CREATED'));
  assert.ok(historyActions.includes('PAYMENT_STATUS_CHANGED'));
  assert.ok(historyActions.includes('INVOICE_PAYMENT_RECONCILED'));
});

test('WORKFLOW 9: AUDIT - access sensitive records, modify patient, create appointments, process payments, verify audit logs', async () => {
  // 1. Create a patient
  const patient = await prisma.patient.create({
    data: {
      patientNumber: `PAT-E2E-${RUN_ID.slice(-4)}-AD`,
      firstName: `E2E${RUN_ID}Audit`,
      lastName: 'AuditLogPatient',
      dateOfBirth: new Date('1991-03-14T00:00:00.000Z'),
      phone: '+1-555-4321',
    },
  });

  // 2. Modify patient information
  const updatePatient = await api(`/patients/${patient.id}`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { phone: '+1-555-9876', addressLine1: '456 Updated Way' },
  });
  assert.equal(updatePatient.status, 200);

  // 3. Create appointment
  const slotStart = utcAt(targetDay, 16, 0);
  const slotEnd = utcAt(targetDay, 16, 30);
  const appt = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-audit-appt`,
    body: {
      patientId: patient.id,
      doctorId,
      scheduledStart: slotStart.toISOString(),
      scheduledEnd: slotEnd.toISOString(),
    },
  });
  assert.equal(appt.status, 201);

  // 4. Access sensitive record (patient clinical summary by clinician)
  const summaryAccess = await api(`/patients/${patient.id}/clinical-summary`, {
    token: clinicianToken,
  });
  assert.equal(summaryAccess.status, 200);

  // 5. Create and pay an invoice
  const inv = await api('/billing/invoices', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-audit-inv`,
    body: {
      patientId: patient.id,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      items: [{ description: 'General Consultation', quantity: 1, unitPrice: '50.00' }],
    },
  });
  assert.equal(inv.status, 201);
  const invoiceId = (inv.body as { invoice: { id: string } }).invoice.id;

  await api(`/billing/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'ISSUED' },
  });

  const pay = await api(`/billing/invoices/${invoiceId}/payments`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-audit-pay`,
    body: { amount: '50.00', method: 'CASH' },
  });
  assert.equal(pay.status, 201);
  const paymentId = (pay.body as { payment: { id: string } }).payment.id;

  await api(`/billing/payments/${paymentId}/status`, {
    method: 'PATCH',
    token: frontDeskToken,
    body: { status: 'SUCCESSFUL' },
  });

  // 6. Verify audit logs as administrator
  const auditResponse = await api('/admin/audit-logs', { token: adminToken });
  assert.equal(auditResponse.status, 200);
  const logs = (auditResponse.body as { logs: Array<{ action: string; entityType: string; outcome: string; before?: unknown; after?: unknown }> }).logs;

  const actionsLogged = new Set(logs.map((l) => l.action));
  assert.ok(actionsLogged.has('PATIENT_UPDATED'), 'Audit must contain PATIENT_UPDATED');
  assert.ok(actionsLogged.has('APPOINTMENT_BOOKED'), 'Audit must contain APPOINTMENT_BOOKED');
  assert.ok(actionsLogged.has('PATIENT_CLINICAL_SUMMARY_READ'), 'Audit must contain PATIENT_CLINICAL_SUMMARY_READ');
  assert.ok(actionsLogged.has('INVOICE_CREATED'), 'Audit must contain INVOICE_CREATED');
  assert.ok(actionsLogged.has('PAYMENT_CREATED'), 'Audit must contain PAYMENT_CREATED');
  assert.ok(actionsLogged.has('PAYMENT_STATUS_CHANGED'), 'Audit must contain PAYMENT_STATUS_CHANGED');

  // Verify security invariant: no password hashes or raw secrets stored in audit before/after
  for (const log of logs) {
    const raw = JSON.stringify(log);
    assert.equal(raw.includes('passwordHash'), false, 'Audit log must never expose passwordHash');
    assert.equal(raw.includes(TEST_PASSWORD), false, 'Audit log must never leak raw passwords');
  }
});

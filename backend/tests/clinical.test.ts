import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const TEST_PASSWORD = 'Clinical-Test-Password-2026!';
const RUN_ID = Date.now().toString(36).toLowerCase();
const PREFIX = `clintest-${RUN_ID}`;
const EMAIL_MARKER = `${PREFIX}-`;
const DEPARTMENT_CODE_PREFIX = `CT${RUN_ID.slice(-6).toUpperCase()}`;

interface ApiResponse {
  status: number;
  body: unknown;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

interface SessionBody {
  accessToken: string;
  user: { id: string; email: string; role: string; status: string };
}

interface ErrorBody {
  error: { code: string; message: string };
}

interface VisitBody {
  visit: {
    id: string;
    visitNumber: string;
    status: string;
    endedAt: string | null;
    notes: unknown[];
    prescriptions: unknown[];
    diagnosticReports: unknown[];
    [key: string]: unknown;
  };
}

interface NoteBody {
  note: {
    id: string;
    content: string;
    revisionCount: number;
    [key: string]: unknown;
  };
}

interface NoteDetailBody {
  note: {
    id: string;
    content: string;
    revisions: Array<{
      revisionNumber: number;
      previousContent: string;
      newContent: string;
      editReason: string | null;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
}

interface PrescriptionBody {
  prescription: {
    id: string;
    prescriptionNumber: string;
    status: string;
    items: Array<{ medicationName: string; dosage: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
}

interface ReportBody {
  report: {
    id: string;
    reportNumber: string;
    status: string;
    completedAt: string | null;
    fileMetadata: { name: string; [key: string]: unknown } | null;
    [key: string]: unknown;
  };
}

let prisma: PrismaClient;
let server: Server;
let baseUrl: string;
let adminToken: string;
let frontDeskToken: string;
let clinicianToken: string;
let otherClinicianToken: string;
let adminUserId: string;
let clinicianUserId: string;
let fixtureDoctorId: string;
let otherDoctorId: string;
let assignedPatientId: string;
let otherPatientId: string;
let linkedAppointmentId: string;
let otherAppointmentId: string;

function utcTomorrow(hour = 9): Date {
  const now = new Date();
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, hour),
  );
  return day;
}

async function api(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
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

function assertError(response: ApiResponse, status: number, code: string): void {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal((response.body as ErrorBody).error.code, code);
}

async function createFixtureUser(
  id: string,
  email: string,
  role: 'ADMIN' | 'FRONT_DESK' | 'CLINICIAN',
  passwordHash: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash,
      role,
      status: 'ACTIVE',
      firstName,
      lastName,
    },
  });
}

async function cleanupClinicalData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ id: { startsWith: PREFIX } }, { email: { contains: EMAIL_MARKER } }],
    },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  const doctors = await prisma.doctor.findMany({
    where: {
      OR: [
        { id: { startsWith: PREFIX } },
        { userId: { in: userIds } },
        { email: { contains: EMAIL_MARKER } },
      ],
    },
    select: { id: true },
  });
  const doctorIds = doctors.map((doctor) => doctor.id);

  const patients = await prisma.patient.findMany({
    where: {
      OR: [{ id: { startsWith: PREFIX } }, { email: { contains: EMAIL_MARKER } }],
    },
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);

  const visits = await prisma.visit.findMany({
    where: {
      OR: [
        { id: { startsWith: PREFIX } },
        { doctorId: { in: doctorIds } },
        { patientId: { in: patientIds } },
      ],
    },
    select: { id: true },
  });
  const visitIds = visits.map((visit) => visit.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { entityId: { in: [...visitIds, ...patientIds, ...doctorIds] } },
      ],
    },
  });
  await prisma.idempotencyKey.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.clinicalNoteRevision.deleteMany({
    where: { note: { visitId: { in: visitIds } } },
  });
  await prisma.clinicalNote.deleteMany({ where: { visitId: { in: visitIds } } });
  await prisma.prescriptionItem.deleteMany({
    where: { prescription: { visitId: { in: visitIds } } },
  });
  await prisma.prescription.deleteMany({ where: { visitId: { in: visitIds } } });
  await prisma.diagnosticReport.deleteMany({ where: { visitId: { in: visitIds } } });
  await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { doctorId: { in: doctorIds } },
        { patientId: { in: patientIds } },
        { createdById: { in: userIds } },
      ],
    },
  });
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctorLeave.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctorUnavailability.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.department.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run clinical integration tests');
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
  await cleanupClinicalData();

  const passwordHash = await hash(TEST_PASSWORD, 10);

  adminUserId = `${PREFIX}-user-admin`;
  await createFixtureUser(
    adminUserId,
    `${EMAIL_MARKER}admin@example.test`,
    'ADMIN',
    passwordHash,
    'Clinical',
    'Admin',
  );
  await createFixtureUser(
    `${PREFIX}-user-frontdesk`,
    `${EMAIL_MARKER}frontdesk@example.test`,
    'FRONT_DESK',
    passwordHash,
    'Clinical',
    'FrontDesk',
  );
  clinicianUserId = `${PREFIX}-user-clinician`;
  await createFixtureUser(
    clinicianUserId,
    `${EMAIL_MARKER}clinician@example.test`,
    'CLINICIAN',
    passwordHash,
    'Clinical',
    'Clinician',
  );
  await createFixtureUser(
    `${PREFIX}-user-clinician-b`,
    `${EMAIL_MARKER}clinician-b@example.test`,
    'CLINICIAN',
    passwordHash,
    'Clinical',
    'Other',
  );

  const departmentId = `${PREFIX}-department`;
  fixtureDoctorId = `${PREFIX}-doctor-a`;
  otherDoctorId = `${PREFIX}-doctor-b`;
  await prisma.department.create({
    data: {
      id: departmentId,
      code: `${DEPARTMENT_CODE_PREFIX}FIX`,
      name: `Clinical Fixture Department ${RUN_ID}`,
      isActive: true,
    },
  });
  await prisma.doctor.create({
    data: {
      id: fixtureDoctorId,
      userId: clinicianUserId,
      employeeCode: `${DEPARTMENT_CODE_PREFIX}DOCA`,
      departmentId,
      firstName: 'Clinical',
      lastName: 'Clinician',
      email: `${EMAIL_MARKER}clinician@example.test`,
      licenseNumber: `${DEPARTMENT_CODE_PREFIX}LICA`,
      specialization: 'Clinical Fixture Medicine',
      consultationFee: '10.00',
      status: 'ACTIVE',
    },
  });
  await prisma.doctor.create({
    data: {
      id: otherDoctorId,
      userId: `${PREFIX}-user-clinician-b`,
      employeeCode: `${DEPARTMENT_CODE_PREFIX}DOCB`,
      departmentId,
      firstName: 'Clinical',
      lastName: 'Other',
      email: `${EMAIL_MARKER}clinician-b@example.test`,
      licenseNumber: `${DEPARTMENT_CODE_PREFIX}LICB`,
      specialization: 'Clinical Fixture Surgery',
      consultationFee: '12.00',
      status: 'ACTIVE',
    },
  });

  assignedPatientId = `${PREFIX}-patient-a`;
  otherPatientId = `${PREFIX}-patient-b`;
  await prisma.patient.create({
    data: {
      id: assignedPatientId,
      patientNumber: `${PREFIX}-PATA`,
      firstName: 'Assigned',
      lastName: 'Patient',
      dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
      gender: 'FEMALE',
      bloodGroup: 'A_POSITIVE',
      email: `${EMAIL_MARKER}patient-a@example.test`,
      allergies: 'Penicillin',
      status: 'ACTIVE',
    },
  });
  await prisma.patient.create({
    data: {
      id: otherPatientId,
      patientNumber: `${PREFIX}-PATB`,
      firstName: 'Other',
      lastName: 'Patient',
      dateOfBirth: new Date('1985-02-20T00:00:00.000Z'),
      gender: 'MALE',
      bloodGroup: 'O_NEGATIVE',
      email: `${EMAIL_MARKER}patient-b@example.test`,
      status: 'ACTIVE',
    },
  });

  const appointmentStart = utcTomorrow();
  linkedAppointmentId = `${PREFIX}-appointment-a`;
  otherAppointmentId = `${PREFIX}-appointment-b`;
  await prisma.appointment.create({
    data: {
      id: linkedAppointmentId,
      appointmentNumber: `APT-${RUN_ID.toUpperCase()}CA`,
      patientId: assignedPatientId,
      doctorId: fixtureDoctorId,
      scheduledStart: appointmentStart,
      scheduledEnd: new Date(appointmentStart.getTime() + 30 * 60_000),
      status: 'CONFIRMED',
      createdById: adminUserId,
    },
  });
  await prisma.appointment.create({
    data: {
      id: otherAppointmentId,
      appointmentNumber: `APT-${RUN_ID.toUpperCase()}CB`,
      patientId: otherPatientId,
      doctorId: otherDoctorId,
      scheduledStart: appointmentStart,
      scheduledEnd: new Date(appointmentStart.getTime() + 30 * 60_000),
      status: 'CONFIRMED',
      createdById: adminUserId,
    },
  });

  const app = createApp();
  server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  adminToken = await login(`${EMAIL_MARKER}admin@example.test`);
  frontDeskToken = await login(`${EMAIL_MARKER}frontdesk@example.test`);
  clinicianToken = await login(`${EMAIL_MARKER}clinician@example.test`);
  otherClinicianToken = await login(`${EMAIL_MARKER}clinician-b@example.test`);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (prisma) {
    await cleanupClinicalData();
    await prisma.$disconnect();
  }
});

test('creates encounters, links appointments, and manages the visit lifecycle', async () => {
  const createBody = {
    patientId: assignedPatientId,
    appointmentId: linkedAppointmentId,
    chiefComplaint: 'Persistent headache for three days',
    vitals: {
      heightCm: 170,
      weightKg: 65,
      temperatureC: 36.8,
      systolicBp: 120,
      diastolicBp: 80,
      heartRate: 72,
      respiratoryRate: 16,
      oxygenSaturation: 98,
    },
    followUpAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    followUpNotes: 'Return if symptoms worsen',
  };

  const created = await api('/visits', {
    method: 'POST',
    body: createBody,
    token: clinicianToken,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const visit = (created.body as VisitBody).visit;
  assert.ok(visit.id);
  assert.ok(visit.visitNumber.startsWith('VIS-'));
  assert.equal(visit.status, 'PLANNED');
  assert.equal(visit.appointmentId, linkedAppointmentId);

  const invalidVitals = await api('/visits', {
    method: 'POST',
    body: {
      patientId: assignedPatientId,
      vitals: { systolicBp: 80, diastolicBp: 120 },
    },
    token: clinicianToken,
  });
  assertError(invalidVitals, 400, 'VALIDATION_ERROR');

  const duplicateLink = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, appointmentId: linkedAppointmentId },
    token: clinicianToken,
  });
  assertError(duplicateLink, 409, 'VISIT_APPOINTMENT_ALREADY_LINKED');

  const mismatchedLink = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, appointmentId: otherAppointmentId },
    token: clinicianToken,
  });
  assertError(mismatchedLink, 409, 'VISIT_APPOINTMENT_MISMATCH');

  const unassignedPatient = await api('/visits', {
    method: 'POST',
    body: { patientId: otherPatientId },
    token: clinicianToken,
  });
  assertError(unassignedPatient, 404, 'PATIENT_NOT_FOUND');

  const wrongDoctor = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: otherDoctorId },
    token: clinicianToken,
  });
  assertError(wrongDoctor, 403, 'VISIT_DOCTOR_MISMATCH');

  const missingDoctor = await api('/visits', {
    method: 'POST',
    body: { patientId: otherPatientId },
    token: adminToken,
  });
  assertError(missingDoctor, 400, 'VISIT_DOCTOR_REQUIRED');

  const updated = await api(`/visits/${visit.id}`, {
    method: 'PATCH',
    body: {
      diagnosis: 'Tension-type headache',
      clinicalNotes: 'Symptoms began after prolonged screen work.',
      followUpNotes: 'Follow up in one week',
    },
    token: clinicianToken,
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal((updated.body as VisitBody).visit.diagnosis, 'Tension-type headache');

  const unchangedStatus = await api(`/visits/${visit.id}/status`, {
    method: 'PATCH',
    body: { status: 'PLANNED' },
    token: clinicianToken,
  });
  assertError(unchangedStatus, 409, 'VISIT_STATUS_UNCHANGED');

  const inProgress = await api(`/visits/${visit.id}/status`, {
    method: 'PATCH',
    body: { status: 'IN_PROGRESS' },
    token: clinicianToken,
  });
  assert.equal(inProgress.status, 200, JSON.stringify(inProgress.body));
  assert.equal((inProgress.body as VisitBody).visit.status, 'IN_PROGRESS');

  const invalidTransition = await api(`/visits/${visit.id}/status`, {
    method: 'PATCH',
    body: { status: 'PLANNED' },
    token: clinicianToken,
  });
  assertError(invalidTransition, 409, 'VISIT_STATUS_TRANSITION_INVALID');

  const completed = await api(`/visits/${visit.id}/status`, {
    method: 'PATCH',
    body: { status: 'COMPLETED', reason: 'Encounter finished' },
    token: clinicianToken,
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  const completedVisit = (completed.body as VisitBody).visit;
  assert.equal(completedVisit.status, 'COMPLETED');
  assert.ok(completedVisit.endedAt);

  const completedTransition = await api(`/visits/${visit.id}/status`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
    token: clinicianToken,
  });
  assertError(completedTransition, 409, 'VISIT_STATUS_TRANSITION_INVALID');

  const detail = await api(`/visits/${visit.id}`, { token: clinicianToken });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const detailVisit = (detail.body as VisitBody).visit;
  assert.equal(detailVisit.status, 'COMPLETED');
  assert.ok(Array.isArray(detailVisit.notes));
  assert.ok(Array.isArray(detailVisit.prescriptions));
  assert.ok(Array.isArray(detailVisit.diagnosticReports));

  const search = await api(
    `/visits?search=${encodeURIComponent(visit.visitNumber)}`,
    { token: clinicianToken },
  );
  assert.equal(search.status, 200, JSON.stringify(search.body));
  const searchBody = search.body as { visits: VisitBody['visit'][]; pagination: { total: number } };
  assert.equal(searchBody.pagination.total, 1);
  const [matchedVisit] = searchBody.visits;
  assert.ok(matchedVisit);
  assert.equal(matchedVisit.id, visit.id);
});

test('scopes clinical records by role and patient assignment', async () => {
  const frontDeskVisitList = await api('/visits', { token: frontDeskToken });
  assertError(frontDeskVisitList, 403, 'FORBIDDEN');

  const frontDeskSummary = await api(`/patients/${assignedPatientId}/clinical-summary`, {
    token: frontDeskToken,
  });
  assertError(frontDeskSummary, 403, 'FORBIDDEN');

  const adminVisit = await api('/visits', {
    method: 'POST',
    body: { patientId: otherPatientId, doctorId: otherDoctorId },
    token: adminToken,
  });
  assert.equal(adminVisit.status, 201, JSON.stringify(adminVisit.body));
  const otherPatientVisitId = (adminVisit.body as VisitBody).visit.id;

  const frontDeskCreate = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: fixtureDoctorId },
    token: frontDeskToken,
  });
  assertError(frontDeskCreate, 403, 'FORBIDDEN');

  const clinicianDetail = await api(`/visits/${otherPatientVisitId}`, { token: clinicianToken });
  assertError(clinicianDetail, 404, 'VISIT_NOT_FOUND');

  const clinicianNotes = await api(`/visits/${otherPatientVisitId}/notes`, {
    token: clinicianToken,
  });
  assertError(clinicianNotes, 404, 'VISIT_NOT_FOUND');

  const clinicianPrescriptions = await api(`/visits/${otherPatientVisitId}/prescriptions`, {
    token: clinicianToken,
  });
  assertError(clinicianPrescriptions, 404, 'VISIT_NOT_FOUND');

  const clinicianReports = await api(`/visits/${otherPatientVisitId}/reports`, {
    token: clinicianToken,
  });
  assertError(clinicianReports, 404, 'VISIT_NOT_FOUND');

  const crossPatientVisit = await api('/visits', {
    method: 'POST',
    body: {
      patientId: otherPatientId,
      doctorId: otherDoctorId,
      chiefComplaint: 'Cross-patient attempt',
    },
    token: otherClinicianToken,
  });
  assert.equal(crossPatientVisit.status, 201, JSON.stringify(crossPatientVisit.body));

  const otherClinicianList = await api('/visits', { token: clinicianToken });
  assert.equal(otherClinicianList.status, 200, JSON.stringify(otherClinicianList.body));
  const listBody = otherClinicianList.body as { visits: VisitBody['visit'][] };
  assert.ok(listBody.visits.length > 0);
  assert.equal(
    listBody.visits.some((visit) => visit.patientId === otherPatientId),
    false,
    'Clinician must not see visits of unassigned patients',
  );
  assert.equal(
    listBody.visits.some((visit) => visit.patientId === assignedPatientId),
    true,
    'Clinician must see visits of assigned patients',
  );

  const coveredVisit = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: otherDoctorId },
    token: adminToken,
  });
  assert.equal(coveredVisit.status, 201, JSON.stringify(coveredVisit.body));
  const coveredVisitId = (coveredVisit.body as VisitBody).visit.id;

  const readable = await api(`/visits/${coveredVisitId}`, { token: clinicianToken });
  assert.equal(readable.status, 200, JSON.stringify(readable.body));

  const notWritable = await api(`/visits/${coveredVisitId}`, {
    method: 'PATCH',
    body: { diagnosis: 'Should be rejected' },
    token: clinicianToken,
  });
  assertError(notWritable, 403, 'VISIT_WRITE_FORBIDDEN');

  const otherClinicianOwn = await api(`/visits/${coveredVisitId}`, {
    method: 'PATCH',
    body: { diagnosis: 'Covering physician note' },
    token: otherClinicianToken,
  });
  assert.equal(otherClinicianOwn.status, 200, JSON.stringify(otherClinicianOwn.body));

  const adminSummary = await api(`/patients/${assignedPatientId}/clinical-summary`, {
    token: adminToken,
  });
  assert.equal(adminSummary.status, 200, JSON.stringify(adminSummary.body));
  assert.ok(Array.isArray((adminSummary.body as { visits: unknown[] }).visits));

  const clinicianPatient = await api(`/patients/${assignedPatientId}`, {
    token: clinicianToken,
  });
  assert.equal(clinicianPatient.status, 200, JSON.stringify(clinicianPatient.body));
  assert.equal(
    (clinicianPatient.body as { patient: { allergies?: string } }).patient.allergies,
    'Penicillin',
  );

  const clinicianPatientList = await api('/patients', { token: clinicianToken });
  assert.equal(clinicianPatientList.status, 200, JSON.stringify(clinicianPatientList.body));
});

test('manages clinical notes with preserved revision history and author protection', async () => {
  const visit = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: fixtureDoctorId },
    token: clinicianToken,
  });
  assert.equal(visit.status, 201, JSON.stringify(visit.body));
  const visitId = (visit.body as VisitBody).visit.id;

  const created = await api(`/visits/${visitId}/notes`, {
    method: 'POST',
    body: { content: 'Patient reports improved sleep after medication change.' },
    token: clinicianToken,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const note = (created.body as NoteBody).note;
  assert.ok(note.id);
  assert.equal(note.revisionCount, 0);

  const frontDeskNotes = await api(`/visits/${visitId}/notes`, { token: frontDeskToken });
  assertError(frontDeskNotes, 403, 'FORBIDDEN');

  const frontDeskCreate = await api(`/visits/${visitId}/notes`, {
    method: 'POST',
    body: { content: 'Front desk should not write clinical notes.' },
    token: frontDeskToken,
  });
  assertError(frontDeskCreate, 403, 'FORBIDDEN');

  const unchanged = await api(`/visits/${visitId}/notes/${note.id}`, {
    method: 'PATCH',
    body: { content: 'Patient reports improved sleep after medication change.' },
    token: clinicianToken,
  });
  assertError(unchanged, 409, 'CLINICAL_NOTE_CONTENT_UNCHANGED');

  const revised = await api(`/visits/${visitId}/notes/${note.id}`, {
    method: 'PATCH',
    body: {
      content: 'Patient reports improved sleep and reduced headache frequency.',
      editReason: 'Clarified symptom progression',
    },
    token: clinicianToken,
  });
  assert.equal(revised.status, 200, JSON.stringify(revised.body));
  assert.equal((revised.body as NoteBody).note.revisionCount, 1);

  const detail = await api(`/visits/${visitId}/notes/${note.id}`, { token: clinicianToken });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  const detailNote = (detail.body as NoteDetailBody).note;
  assert.equal(detailNote.revisions.length, 1);
  const [firstRevision] = detailNote.revisions;
  assert.ok(firstRevision);
  assert.equal(firstRevision.revisionNumber, 1);
  assert.equal(
    firstRevision.previousContent,
    'Patient reports improved sleep after medication change.',
  );
  assert.equal(
    firstRevision.newContent,
    'Patient reports improved sleep and reduced headache frequency.',
  );
  assert.equal(firstRevision.editReason, 'Clarified symptom progression');

  const adminNote = await api(`/visits/${visitId}/notes`, {
    method: 'POST',
    body: { content: 'Administrative review note recorded by an administrator.' },
    token: adminToken,
  });
  assert.equal(adminNote.status, 201, JSON.stringify(adminNote.body));
  const adminNoteId = (adminNote.body as NoteBody).note.id;

  const nonAuthorEdit = await api(`/visits/${visitId}/notes/${adminNoteId}`, {
    method: 'PATCH',
    body: { content: 'Clinician cannot edit an administrators note.' },
    token: clinicianToken,
  });
  assertError(nonAuthorEdit, 403, 'CLINICAL_NOTE_EDIT_FORBIDDEN');

  const adminEdit = await api(`/visits/${visitId}/notes/${adminNoteId}`, {
    method: 'PATCH',
    body: { content: 'Administrative review note corrected by an administrator.' },
    token: adminToken,
  });
  assert.equal(adminEdit.status, 200, JSON.stringify(adminEdit.body));

  const list = await api(`/visits/${visitId}/notes`, { token: clinicianToken });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const notes = (list.body as { notes: NoteBody['note'][] }).notes;
  assert.equal(notes.length, 2);

  const revisionRows = await prisma.clinicalNoteRevision.findMany({
    where: { noteId: note.id },
    orderBy: { revisionNumber: 'asc' },
  });
  assert.equal(revisionRows.length, 1);
  const [firstRevisionRow] = revisionRows;
  assert.ok(firstRevisionRow);
  assert.equal(firstRevisionRow.editedById, clinicianUserId);
});

test('manages prescriptions with item validation and status transitions', async () => {
  const visit = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: fixtureDoctorId },
    token: clinicianToken,
  });
  assert.equal(visit.status, 201, JSON.stringify(visit.body));
  const visitId = (visit.body as VisitBody).visit.id;

  const items = [
    {
      medicationName: 'Amoxicillin',
      dosage: '500 mg',
      frequency: 'Three times daily',
      durationDays: 7,
      quantity: 21,
      instructions: 'Take with food',
    },
    {
      medicationName: 'Ibuprofen',
      dosage: '200 mg',
      frequency: 'As needed',
      durationDays: 3,
      quantity: 9,
    },
  ];

  const created = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: { items, notes: 'Synthetic prescription for integration testing' },
    token: clinicianToken,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const prescription = (created.body as PrescriptionBody).prescription;
  assert.ok(prescription.prescriptionNumber.startsWith('RX-'));
  assert.equal(prescription.status, 'ISSUED');
  assert.equal(prescription.items.length, 2);
  const [firstItem] = prescription.items;
  assert.ok(firstItem);
  assert.equal(firstItem.medicationName, 'Amoxicillin');

  const emptyItems = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: { items: [] },
    token: clinicianToken,
  });
  assertError(emptyItems, 400, 'VALIDATION_ERROR');

  const invalidDuration = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: {
      items: [{ ...items[0], durationDays: 0 }],
    },
    token: clinicianToken,
  });
  assertError(invalidDuration, 400, 'VALIDATION_ERROR');

  const invalidQuantity = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: {
      items: [{ ...items[0], quantity: 0 }],
    },
    token: clinicianToken,
  });
  assertError(invalidQuantity, 400, 'VALIDATION_ERROR');

  const missingDosage = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: {
      items: [{ ...items[0], dosage: '' }],
    },
    token: clinicianToken,
  });
  assertError(missingDosage, 400, 'VALIDATION_ERROR');

  const futureIssuedAt = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: { items, issuedAt: new Date(Date.now() + 86_400_000).toISOString() },
    token: clinicianToken,
  });
  assertError(futureIssuedAt, 400, 'VALIDATION_ERROR');

  const frontDeskCreate = await api(`/visits/${visitId}/prescriptions`, {
    method: 'POST',
    body: { items },
    token: frontDeskToken,
  });
  assertError(frontDeskCreate, 403, 'FORBIDDEN');

  const frontDeskList = await api(`/visits/${visitId}/prescriptions`, {
    token: frontDeskToken,
  });
  assertError(frontDeskList, 403, 'FORBIDDEN');

  const dispensed = await api(`/visits/${visitId}/prescriptions/${prescription.id}/status`, {
    method: 'PATCH',
    body: { status: 'DISPENSED' },
    token: clinicianToken,
  });
  assert.equal(dispensed.status, 200, JSON.stringify(dispensed.body));
  assert.equal((dispensed.body as PrescriptionBody).prescription.status, 'DISPENSED');

  const sameStatus = await api(`/visits/${visitId}/prescriptions/${prescription.id}/status`, {
    method: 'PATCH',
    body: { status: 'DISPENSED' },
    token: clinicianToken,
  });
  assertError(sameStatus, 409, 'PRESCRIPTION_STATUS_UNCHANGED');

  const invalidTransition = await api(`/visits/${visitId}/prescriptions/${prescription.id}/status`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
    token: clinicianToken,
  });
  assertError(invalidTransition, 409, 'PRESCRIPTION_STATUS_TRANSITION_INVALID');

  const adminVisit = await api('/visits', {
    method: 'POST',
    body: { patientId: otherPatientId, doctorId: otherDoctorId },
    token: adminToken,
  });
  const adminVisitId = (adminVisit.body as VisitBody).visit.id;

  const crossPatient = await api(`/visits/${adminVisitId}/prescriptions`, {
    token: clinicianToken,
  });
  assertError(crossPatient, 404, 'VISIT_NOT_FOUND');

  const detail = await api(`/visits/${visitId}/prescriptions/${prescription.id}`, {
    token: clinicianToken,
  });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal((detail.body as PrescriptionBody).prescription.items.length, 2);

  const list = await api(`/visits/${visitId}/prescriptions`, { token: clinicianToken });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal((list.body as { prescriptions: unknown[] }).prescriptions.length, 1);
});

test('manages diagnostic reports with metadata, files, and status flow', async () => {
  const visit = await api('/visits', {
    method: 'POST',
    body: { patientId: assignedPatientId, doctorId: fixtureDoctorId },
    token: clinicianToken,
  });
  assert.equal(visit.status, 201, JSON.stringify(visit.body));
  const visitId = (visit.body as VisitBody).visit.id;

  const created = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: {
      testName: 'Complete blood count',
      type: 'LABORATORY',
      fileMetadata: {
        name: 'cbc-report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102_400,
        storageReference: 'synthetic://cbc-report.pdf',
      },
    },
    token: clinicianToken,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const report = (created.body as ReportBody).report;
  assert.ok(report.reportNumber.startsWith('RPT-'));
  assert.equal(report.status, 'ORDERED');
  assert.equal(report.fileMetadata?.name, 'cbc-report.pdf');

  const invalidType = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: { testName: 'X-ray chest', type: 'INVALID_TYPE' },
    token: clinicianToken,
  });
  assertError(invalidType, 400, 'VALIDATION_ERROR');

  const invalidFile = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: {
      testName: 'X-ray chest',
      type: 'IMAGING',
      fileMetadata: { name: 'chest.pdf', unexpectedField: true },
    },
    token: clinicianToken,
  });
  assertError(invalidFile, 400, 'VALIDATION_ERROR');

  const futureOrderedAt = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: {
      testName: 'Lipid panel',
      type: 'LABORATORY',
      orderedAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    token: clinicianToken,
  });
  assertError(futureOrderedAt, 400, 'VALIDATION_ERROR');

  const frontDeskCreate = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: { testName: 'Complete blood count', type: 'LABORATORY' },
    token: frontDeskToken,
  });
  assertError(frontDeskCreate, 403, 'FORBIDDEN');

  const collected = await api(`/visits/${visitId}/reports/${report.id}`, {
    method: 'PATCH',
    body: { status: 'COLLECTED' },
    token: clinicianToken,
  });
  assert.equal(collected.status, 200, JSON.stringify(collected.body));

  const processing = await api(`/visits/${visitId}/reports/${report.id}`, {
    method: 'PATCH',
    body: {
      resultSummary: 'Values within reference ranges',
      resultDetails: 'Hemoglobin 14.1 g/dL; white cell count 6.2 x10^9/L',
      status: 'PROCESSING',
    },
    token: clinicianToken,
  });
  assert.equal(processing.status, 200, JSON.stringify(processing.body));
  assert.equal((processing.body as ReportBody).report.resultSummary, 'Values within reference ranges');

  const completed = await api(`/visits/${visitId}/reports/${report.id}`, {
    method: 'PATCH',
    body: { status: 'COMPLETED', reason: 'Results verified' },
    token: clinicianToken,
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  const completedReport = (completed.body as ReportBody).report;
  assert.equal(completedReport.status, 'COMPLETED');
  assert.ok(completedReport.completedAt);

  const finalizedEdit = await api(`/visits/${visitId}/reports/${report.id}`, {
    method: 'PATCH',
    body: { resultSummary: 'Attempt to change completed results' },
    token: clinicianToken,
  });
  assertError(finalizedEdit, 409, 'DIAGNOSTIC_REPORT_FINALIZED');

  const finalizedStatus = await api(`/visits/${visitId}/reports/${report.id}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
    token: clinicianToken,
  });
  assertError(finalizedStatus, 409, 'DIAGNOSTIC_REPORT_STATUS_TRANSITION_INVALID');

  const cancelledReport = await api(`/visits/${visitId}/reports`, {
    method: 'POST',
    body: { testName: 'MRI knee', type: 'IMAGING' },
    token: clinicianToken,
  });
  assert.equal(cancelledReport.status, 201, JSON.stringify(cancelledReport.body));
  const cancelledReportId = (cancelledReport.body as ReportBody).report.id;

  const cancelled = await api(`/visits/${visitId}/reports/${cancelledReportId}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED', reason: 'Duplicate order' },
    token: clinicianToken,
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  const cancelledEdit = await api(`/visits/${visitId}/reports/${cancelledReportId}`, {
    method: 'PATCH',
    body: { resultSummary: 'Attempt to edit a cancelled report' },
    token: clinicianToken,
  });
  assertError(cancelledEdit, 409, 'DIAGNOSTIC_REPORT_FINALIZED');

  const detail = await api(`/visits/${visitId}/reports/${report.id}`, {
    token: clinicianToken,
  });
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal((detail.body as ReportBody).report.id, report.id);

  const list = await api(`/visits/${visitId}/reports`, { token: clinicianToken });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal((list.body as { reports: unknown[] }).reports.length, 2);
});

test('records clinical audit events including sensitive reads', async () => {
  const visits = await prisma.visit.findMany({
    where: { patientId: assignedPatientId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  assert.ok(visits.length > 0, 'Expected clinical fixture visits to exist');

  const visitAudits = await prisma.auditLog.findMany({
    where: { entityType: 'Visit', entityId: { in: visits.map((visit) => visit.id) } },
    select: { action: true, before: true, after: true, metadata: true },
  });
  const visitActions = new Set(visitAudits.map((audit) => audit.action));
  assert.ok(visitActions.has('VISIT_CREATED'));
  assert.ok(visitActions.has('VISIT_UPDATED'));
  assert.ok(visitActions.has('VISIT_STATUS_CHANGED'));
  assert.ok(visitActions.has('VISIT_READ'), 'Sensitive visit reads must be audited');
  assert.ok(visitActions.has('CLINICAL_NOTES_LIST_READ'));
  assert.ok(visitActions.has('PRESCRIPTIONS_LIST_READ'));
  assert.ok(visitActions.has('DIAGNOSTIC_REPORTS_LIST_READ'));

  const visitListAudits = await prisma.auditLog.findMany({
    where: { entityType: 'VisitQuery', action: 'VISIT_LIST_READ' },
    select: { actorUserId: true, metadata: true },
  });
  assert.ok(
    visitListAudits.some((audit) => audit.actorUserId === clinicianUserId),
    'Visit list reads must be audited',
  );

  const notes = await prisma.clinicalNote.findMany({
    where: { patientId: assignedPatientId },
    select: { id: true },
  });
  assert.ok(notes.length > 0, 'Expected clinical fixture notes to exist');

  const noteAudits = await prisma.auditLog.findMany({
    where: { entityType: 'ClinicalNote', entityId: { in: notes.map((note) => note.id) } },
    select: { action: true, before: true, after: true, metadata: true },
  });
  const noteActions = new Set(noteAudits.map((audit) => audit.action));
  assert.ok(noteActions.has('CLINICAL_NOTE_CREATED'));
  assert.ok(noteActions.has('CLINICAL_NOTE_REVISED'));
  assert.ok(noteActions.has('CLINICAL_NOTE_READ'), 'Sensitive note reads must be audited');

  const revisionAudit = noteAudits.find((audit) => audit.action === 'CLINICAL_NOTE_REVISED');
  assert.ok(revisionAudit);
  assert.ok((revisionAudit.before as { content?: string }).content);
  assert.ok((revisionAudit.after as { content?: string }).content);

  const prescriptions = await prisma.prescription.findMany({
    where: { visit: { patientId: assignedPatientId } },
    select: { id: true },
  });
  assert.ok(prescriptions.length > 0, 'Expected clinical fixture prescriptions to exist');

  const prescriptionAudits = await prisma.auditLog.findMany({
    where: {
      entityType: 'Prescription',
      entityId: { in: prescriptions.map((prescription) => prescription.id) },
    },
    select: { action: true, before: true, after: true, metadata: true },
  });
  const prescriptionActions = new Set(prescriptionAudits.map((audit) => audit.action));
  assert.ok(prescriptionActions.has('PRESCRIPTION_CREATED'));
  assert.ok(prescriptionActions.has('PRESCRIPTION_STATUS_CHANGED'));
  assert.ok(prescriptionActions.has('PRESCRIPTION_READ'), 'Sensitive prescription reads must be audited');

  const createdPrescriptionAudit = prescriptionAudits.find(
    (audit) => audit.action === 'PRESCRIPTION_CREATED',
  );
  assert.ok(createdPrescriptionAudit);
  const items = (createdPrescriptionAudit.after as { items?: unknown[] }).items;
  assert.ok(Array.isArray(items) && items.length > 0, 'Prescription audit must record item details');

  const reports = await prisma.diagnosticReport.findMany({
    where: { visit: { patientId: assignedPatientId } },
    select: { id: true },
  });
  assert.ok(reports.length > 0, 'Expected clinical fixture reports to exist');

  const reportAudits = await prisma.auditLog.findMany({
    where: {
      entityType: 'DiagnosticReport',
      entityId: { in: reports.map((report) => report.id) },
    },
    select: { action: true, before: true, after: true, metadata: true },
  });
  const reportActions = new Set(reportAudits.map((audit) => audit.action));
  assert.ok(reportActions.has('DIAGNOSTIC_REPORT_CREATED'));
  assert.ok(reportActions.has('DIAGNOSTIC_REPORT_UPDATED'));
  assert.ok(reportActions.has('DIAGNOSTIC_REPORT_READ'), 'Sensitive report reads must be audited');

  const summaryAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'Patient',
      entityId: assignedPatientId,
      action: 'PATIENT_CLINICAL_SUMMARY_READ',
    },
    select: { metadata: true },
  });
  assert.ok(summaryAudit, 'Clinical summary reads must be audited');

  const patientDetailAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'Patient',
      entityId: assignedPatientId,
      action: 'PATIENT_CLINICAL_FIELDS_READ',
    },
    select: { actorUserId: true },
  });
  assert.equal(patientDetailAudit?.actorUserId, clinicianUserId);

  const patientListAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'PatientQuery',
      entityId: clinicianUserId,
      action: 'PATIENT_CLINICAL_FIELDS_LIST_READ',
    },
    select: { actorUserId: true },
  });
  assert.equal(patientListAudit?.actorUserId, clinicianUserId);

  const statusAudit = reportAudits.find(
    (audit) =>
      (audit.metadata as { statusTransition?: { to: string } | null } | null)?.statusTransition
        ?.to === 'COMPLETED',
  );
  assert.ok(statusAudit, 'A report completion audit must record the status transition');
  const statusTransition = (
    (statusAudit.metadata as { statusTransition?: { from: string; to: string } | null })
      ?.statusTransition
  );
  assert.equal(statusTransition?.to, 'COMPLETED');

  const serialized = JSON.stringify([
    ...visitAudits,
    ...noteAudits,
    ...prescriptionAudits,
    ...reportAudits,
  ]);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('accessToken'), false);
  assert.equal(serialized.includes('refreshToken'), false);
});

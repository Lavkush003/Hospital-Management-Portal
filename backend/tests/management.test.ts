import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const TEST_PASSWORD = 'Management-Test-Password-2026!';
const RUN_ID = Date.now().toString(36).toLowerCase();
const PREFIX = `mgmttest-${RUN_ID}`;
const EMAIL_MARKER = `${PREFIX}-`;
const DEPARTMENT_CODE_PREFIX = `MT${RUN_ID.slice(-6).toUpperCase()}`;
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
  user: { id: string; email: string; role: string; status: string };
}

interface ErrorBody {
  error: { code: string; message: string };
}

let prisma: PrismaClient;
let server: Server;
let baseUrl: string;
let adminToken: string;
let frontDeskToken: string;
let clinicianToken: string;
let fixtureDepartmentId: string;
let fixtureDoctorId: string;
let createdPatientId = '';
let createdDepartmentId = '';
let createdDoctorId = '';
let createdDoctorEmail = '';
let createdStaffId = '';
let createdStaffEmail = '';
let createdScheduleId = '';
let leaveId = '';
let unavailabilityId = '';
let firstAppointmentId = '';
let statusAppointmentId = '';
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

function queryString(values: Record<string, string | number | undefined>): string {
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      parameters.set(key, String(value));
    }
  }

  return parameters.toString();
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

function assertError(response: ApiResponse, status: number, code: string): ErrorBody['error'] {
  assert.equal(response.status, status, JSON.stringify(response.body));
  const body = response.body as ErrorBody;
  assert.equal(body.error.code, code);
  return body.error;
}

function appointmentBody(
  patientId: string,
  doctorId: string,
  start: Date,
  end: Date,
): Record<string, unknown> {
  return {
    patientId,
    doctorId,
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    reason: 'Management integration test',
  };
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

async function cleanupManagementData(): Promise<void> {
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

  const departments = await prisma.department.findMany({
    where: {
      OR: [{ id: { startsWith: PREFIX } }, { code: { startsWith: DEPARTMENT_CODE_PREFIX } }],
    },
    select: { id: true },
  });
  const departmentIds = departments.map((department) => department.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ actorUserId: { in: userIds } }, { entityId: { in: [...doctorIds, ...patientIds] } }],
    },
  });
  await prisma.idempotencyKey.deleteMany({
    where: { actorUserId: { in: userIds } },
  });
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { doctorId: { in: doctorIds } },
        { patientId: { in: patientIds } },
        { createdById: { in: userIds } },
      ],
    },
  });
  await prisma.doctorSchedule.deleteMany({
    where: { doctorId: { in: doctorIds } },
  });
  await prisma.doctorLeave.deleteMany({
    where: { doctorId: { in: doctorIds } },
  });
  await prisma.doctorUnavailability.deleteMany({
    where: { doctorId: { in: doctorIds } },
  });
  await prisma.staff.deleteMany({
    where: { OR: [{ id: { startsWith: PREFIX } }, { userId: { in: userIds } }] },
  });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run management integration tests');
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
  await cleanupManagementData();

  const passwordHash = await hash(TEST_PASSWORD, 10);

  await createFixtureUser(
    `${PREFIX}-user-admin`,
    `${EMAIL_MARKER}admin@example.test`,
    'ADMIN',
    passwordHash,
    'Management',
    'Admin',
  );
  await createFixtureUser(
    `${PREFIX}-user-frontdesk`,
    `${EMAIL_MARKER}frontdesk@example.test`,
    'FRONT_DESK',
    passwordHash,
    'Management',
    'FrontDesk',
  );
  await createFixtureUser(
    `${PREFIX}-user-clinician`,
    `${EMAIL_MARKER}clinician@example.test`,
    'CLINICIAN',
    passwordHash,
    'Management',
    'Clinician',
  );

  fixtureDepartmentId = `${PREFIX}-department`;
  fixtureDoctorId = `${PREFIX}-doctor`;
  await prisma.department.create({
    data: {
      id: fixtureDepartmentId,
      code: `${DEPARTMENT_CODE_PREFIX}FIX`,
      name: `Management Fixture Department ${RUN_ID}`,
      isActive: true,
    },
  });
  await prisma.doctor.create({
    data: {
      id: fixtureDoctorId,
      userId: `${PREFIX}-user-clinician`,
      employeeCode: `${DEPARTMENT_CODE_PREFIX}FIXDOC`,
      departmentId: fixtureDepartmentId,
      firstName: 'Management',
      lastName: 'Clinician',
      email: `${EMAIL_MARKER}clinician@example.test`,
      licenseNumber: `${DEPARTMENT_CODE_PREFIX}LIC`,
      specialization: 'Management Fixture Medicine',
      consultationFee: '10.00',
      status: 'ACTIVE',
    },
  });

  targetDay = nextUtcWeekday(1);
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
    await cleanupManagementData();
    await prisma.$disconnect();
  }
});

test('manages patient records with validation, search, permissions, and clinical field protection', async () => {
  const createResponse = await api('/patients', {
    method: 'POST',
    token: frontDeskToken,
    body: {
      firstName: 'Management',
      lastName: `Patient${RUN_ID}`,
      dateOfBirth: '1990-05-14',
      gender: 'FEMALE',
      bloodGroup: 'O_POSITIVE',
      email: `${EMAIL_MARKER}patient@example.test`,
      phone: '+1-555-0900',
      city: 'Testville',
    },
  });

  assert.equal(createResponse.status, 201, JSON.stringify(createResponse.body));
  const created = createResponse.body as {
    patient: { id: string; patientNumber: string };
  };
  createdPatientId = created.patient.id;
  assert.match(created.patient.patientNumber, /^PAT-/);

  const frontDeskDetail = await api(`/patients/${createdPatientId}`, {
    token: frontDeskToken,
  });
  assert.equal(frontDeskDetail.status, 200);
  const frontDeskPatient = (
    frontDeskDetail.body as {
      patient: Record<string, unknown>;
    }
  ).patient;
  assert.equal('allergies' in frontDeskPatient, false);
  assert.equal('notes' in frontDeskPatient, false);

  assertError(
    await api(`/patients/${createdPatientId}`, {
      method: 'PATCH',
      token: frontDeskToken,
      body: { allergies: 'Penicillin' },
    }),
    403,
    'CLINICAL_FIELDS_FORBIDDEN',
  );

  const adminUpdate = await api(`/patients/${createdPatientId}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      allergies: 'Penicillin',
      notes: 'Management test clinical note',
      emergencyContactName: 'Management Contact',
    },
  });
  assert.equal(adminUpdate.status, 200);
  const updatedPatient = (
    adminUpdate.body as {
      patient: Record<string, unknown>;
    }
  ).patient;
  assert.equal(updatedPatient.allergies, 'Penicillin');

  const clinicalDetail = await api(`/patients/${createdPatientId}`, {
    token: adminToken,
  });
  assert.equal(
    (clinicalDetail.body as { patient: { notes: string } }).patient.notes,
    'Management test clinical note',
  );

  assertError(
    await api(`/patients/${createdPatientId}`, { token: clinicianToken }),
    404,
    'PATIENT_NOT_FOUND',
  );

  const clinicianPatientSearch = await api(
    `/patients?${queryString({ search: `Patient${RUN_ID}`, page: 1, pageSize: 50 })}`,
    { token: clinicianToken },
  );
  assert.equal(clinicianPatientSearch.status, 200);
  assert.equal(
    (
      clinicianPatientSearch.body as { patients: Array<{ id: string }> }
    ).patients.some((patient) => patient.id === createdPatientId),
    false,
  );

  const search = await api(
    `/patients?${queryString({
      search: `Patient${RUN_ID}`,
      gender: 'FEMALE',
      page: 1,
      pageSize: 5,
    })}`,
    { token: frontDeskToken },
  );
  assert.equal(search.status, 200);
  const searchBody = search.body as {
    patients: Array<{ id: string }>;
    pagination: { total: number };
  };
  assert.ok(searchBody.patients.some((patient) => patient.id === createdPatientId));
  assert.ok(searchBody.pagination.total >= 1);

  assert.equal(
    (
      await api(`/patients/${createdPatientId}`, {
        method: 'PATCH',
        token: adminToken,
        body: { dateOfBirth: '2999-01-01' },
      })
    ).status,
    400,
  );

  assertError(
    await api('/patients', {
      method: 'POST',
      token: clinicianToken,
      body: {
        firstName: 'Denied',
        lastName: 'Patient',
        dateOfBirth: '1995-01-01',
      },
    }),
    403,
    'FORBIDDEN',
  );
});

test('manages departments, doctors, assignments, profiles, and doctor status', async () => {
  assertError(
    await api('/departments', {
      method: 'POST',
      token: frontDeskToken,
      body: {
        code: `${DEPARTMENT_CODE_PREFIX}NO`,
        name: `Denied Department ${RUN_ID}`,
      },
    }),
    403,
    'FORBIDDEN',
  );

  const departmentResponse = await api('/departments', {
    method: 'POST',
    token: adminToken,
    body: {
      code: `${DEPARTMENT_CODE_PREFIX}D2`,
      name: `Management Department ${RUN_ID}`,
      description: 'Management integration fixture',
      location: 'Test Building',
      phone: '+1-555-0910',
    },
  });
  assert.equal(departmentResponse.status, 201, JSON.stringify(departmentResponse.body));
  const department = (
    departmentResponse.body as {
      department: { id: string; code: string };
    }
  ).department;
  createdDepartmentId = department.id;
  assert.equal(department.code, `${DEPARTMENT_CODE_PREFIX}D2`);

  assertError(
    await api('/departments', {
      method: 'POST',
      token: adminToken,
      body: {
        code: `${DEPARTMENT_CODE_PREFIX}D2`,
        name: `Duplicate Code Department ${RUN_ID}`,
      },
    }),
    409,
    'DEPARTMENT_CODE_CONFLICT',
  );

  const updateDepartment = await api(`/departments/${createdDepartmentId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { location: 'Updated Test Building' },
  });
  assert.equal(updateDepartment.status, 200);
  assert.equal(
    (updateDepartment.body as { department: { location: string } }).department.location,
    'Updated Test Building',
  );

  createdDoctorEmail = `${EMAIL_MARKER}created-doctor@example.test`;
  const doctorResponse = await api('/doctors', {
    method: 'POST',
    token: adminToken,
    body: {
      email: createdDoctorEmail,
      password: TEST_PASSWORD,
      firstName: 'Created',
      lastName: `Doctor${RUN_ID}`,
      phone: '+1-555-0920',
      employeeCode: `${DEPARTMENT_CODE_PREFIX}DOC`,
      departmentId: createdDepartmentId,
      licenseNumber: `${DEPARTMENT_CODE_PREFIX}DOCLIC`,
      specialization: 'Management Test Medicine',
      qualifications: 'MD, Management Testing',
      consultationFee: 125,
      bio: 'Management doctor fixture',
    },
  });
  assert.equal(doctorResponse.status, 201, JSON.stringify(doctorResponse.body));
  const doctor = (
    doctorResponse.body as {
      doctor: { id: string; department: { id: string } };
    }
  ).doctor;
  createdDoctorId = doctor.id;
  assert.equal(doctor.department.id, createdDepartmentId);

  assertError(
    await api('/doctors', {
      method: 'POST',
      token: adminToken,
      body: {
        email: `${EMAIL_MARKER}duplicate-doctor@example.test`,
        password: TEST_PASSWORD,
        firstName: 'Duplicate',
        lastName: 'Doctor',
        employeeCode: `${DEPARTMENT_CODE_PREFIX}DOC`,
        departmentId: createdDepartmentId,
        licenseNumber: `${DEPARTMENT_CODE_PREFIX}OTHERLIC`,
        specialization: 'Management Test Medicine',
      },
    }),
    409,
    'DOCTOR_EMPLOYEE_CODE_CONFLICT',
  );

  const doctorDetail = await api(`/doctors/${createdDoctorId}`, { token: adminToken });
  assert.equal(doctorDetail.status, 200);
  assert.equal(
    (doctorDetail.body as { doctor: { employeeCode: string } }).doctor.employeeCode,
    `${DEPARTMENT_CODE_PREFIX}DOC`,
  );

  const doctorSearch = await api(
    `/doctors?${queryString({
      search: `${DEPARTMENT_CODE_PREFIX}DOC`,
      page: 1,
      pageSize: 10,
    })}`,
    { token: frontDeskToken },
  );
  assert.equal(doctorSearch.status, 200);
  assert.ok(
    (doctorSearch.body as { doctors: Array<{ id: string }> }).doctors.some(
      (item) => item.id === createdDoctorId,
    ),
  );

  const doctorUpdate = await api(`/doctors/${createdDoctorId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { specialization: 'Management Updated Medicine' },
  });
  assert.equal(doctorUpdate.status, 200);
  assert.equal(
    (doctorUpdate.body as { doctor: { specialization: string } }).doctor.specialization,
    'Management Updated Medicine',
  );

  const assignment = await api(`/departments/${fixtureDepartmentId}/doctors`, {
    method: 'POST',
    token: adminToken,
    body: { doctorIds: [createdDoctorId] },
  });
  assert.equal(assignment.status, 200);
  assert.ok(
    (
      assignment.body as {
        department: { doctors: Array<{ id: string }> };
      }
    ).department.doctors.some((item) => item.id === createdDoctorId),
  );

  assertError(
    await api(`/doctors/${createdDoctorId}`, {
      method: 'PATCH',
      token: frontDeskToken,
      body: { specialization: 'Denied' },
    }),
    403,
    'FORBIDDEN',
  );

  const doctorToken = await login(createdDoctorEmail);
  assert.ok(doctorToken);

  const inactive = await api(`/doctors/${createdDoctorId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'INACTIVE', reason: 'Management test deactivation' },
  });
  assert.equal(inactive.status, 200);
  assertError(
    await api('/auth/login', {
      method: 'POST',
      token: null,
      body: { email: createdDoctorEmail, password: TEST_PASSWORD },
    }),
    401,
    'INVALID_CREDENTIALS',
  );

  const active = await api(`/doctors/${createdDoctorId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE', reason: 'Management test reactivation' },
  });
  assert.equal(active.status, 200);
  assert.ok(await login(createdDoctorEmail));
});

test('manages staff accounts, roles, status, and session revocation', async () => {
  assertError(
    await api('/staff', {
      method: 'POST',
      token: frontDeskToken,
      body: {
        email: `${EMAIL_MARKER}denied-staff@example.test`,
        password: TEST_PASSWORD,
        firstName: 'Denied',
        lastName: 'Staff',
        employeeCode: `${DEPARTMENT_CODE_PREFIX}NO`,
        jobTitle: 'Denied',
      },
    }),
    403,
    'FORBIDDEN',
  );

  createdStaffEmail = `${EMAIL_MARKER}staff@example.test`;
  const staffResponse = await api('/staff', {
    method: 'POST',
    token: adminToken,
    body: {
      email: createdStaffEmail,
      password: TEST_PASSWORD,
      firstName: 'Management',
      lastName: `Staff${RUN_ID}`,
      employeeCode: `${DEPARTMENT_CODE_PREFIX}STF`,
      departmentId: createdDepartmentId,
      jobTitle: 'Management Coordinator',
      role: 'FRONT_DESK',
      hiredAt: '2025-01-15',
    },
  });
  assert.equal(staffResponse.status, 201, JSON.stringify(staffResponse.body));
  const staff = (
    staffResponse.body as {
      staff: { id: string; user: { role: string } };
    }
  ).staff;
  createdStaffId = staff.id;
  assert.equal(staff.user.role, 'FRONT_DESK');

  const staffToken = await login(createdStaffEmail);

  const search = await api(
    `/staff?${queryString({
      search: `${DEPARTMENT_CODE_PREFIX}STF`,
      page: 1,
      pageSize: 10,
    })}`,
    { token: adminToken },
  );
  assert.equal(search.status, 200);
  assert.ok(
    (search.body as { staff: Array<{ id: string }> }).staff.some(
      (item) => item.id === createdStaffId,
    ),
  );

  assertError(await api('/staff', { token: frontDeskToken }), 403, 'FORBIDDEN');

  const update = await api(`/staff/${createdStaffId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { jobTitle: 'Senior Management Coordinator' },
  });
  assert.equal(update.status, 200);
  assert.equal(
    (update.body as { staff: { jobTitle: string } }).staff.jobTitle,
    'Senior Management Coordinator',
  );

  const roleChange = await api(`/staff/${createdStaffId}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'ADMIN', reason: 'Management test role change' },
  });
  assert.equal(roleChange.status, 200);
  assert.equal((roleChange.body as { staff: { user: { role: string } } }).staff.user.role, 'ADMIN');

  assertError(await api('/auth/me', { token: staffToken }), 401, 'ACCESS_TOKEN_REVOKED');
  assert.ok(await login(createdStaffEmail));

  const terminated = await api(`/staff/${createdStaffId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'TERMINATED', reason: 'Management test termination' },
  });
  assert.equal(terminated.status, 200);
  assertError(
    await api('/auth/login', {
      method: 'POST',
      token: null,
      body: { email: createdStaffEmail, password: TEST_PASSWORD },
    }),
    401,
    'INVALID_CREDENTIALS',
  );
});

test('manages schedules, breaks, leave, unavailability, and availability slots', async () => {
  assertError(
    await api(`/doctors/${createdDoctorId}/schedules`, {
      method: 'POST',
      token: frontDeskToken,
      body: {
        dayOfWeek: DAY_NAMES[targetDay.getUTCDay()],
        startTime: '09:00',
        endTime: '12:00',
        slotDurationMinutes: 30,
      },
    }),
    403,
    'FORBIDDEN',
  );

  const scheduleResponse = await api(`/doctors/${createdDoctorId}/schedules`, {
    method: 'POST',
    token: adminToken,
    body: {
      dayOfWeek: DAY_NAMES[targetDay.getUTCDay()],
      startTime: '09:00',
      endTime: '12:00',
      slotDurationMinutes: 30,
      breakTimes: [{ startTime: '10:00', endTime: '10:30' }],
      room: 'MGMT-101',
    },
  });
  assert.equal(scheduleResponse.status, 201, JSON.stringify(scheduleResponse.body));
  const schedule = (
    scheduleResponse.body as {
      schedule: { id: string; startTime: string; breaks: Array<{ startTime: string }> };
    }
  ).schedule;
  createdScheduleId = schedule.id;
  assert.equal(schedule.startTime, '09:00');
  assert.equal(schedule.breaks[0]?.startTime, '10:00');

  assertError(
    await api(`/doctors/${createdDoctorId}/schedules`, {
      method: 'POST',
      token: adminToken,
      body: {
        dayOfWeek: DAY_NAMES[targetDay.getUTCDay()],
        startTime: '09:00',
        endTime: '12:00',
        slotDurationMinutes: 30,
        breakTimes: [{ startTime: '13:00', endTime: '14:00' }],
      },
    }),
    400,
    'SCHEDULE_BREAK_OUT_OF_BOUNDS',
  );

  const schedules = await api(`/doctors/${createdDoctorId}/schedules`, {
    token: frontDeskToken,
  });
  assert.equal(schedules.status, 200);
  assert.ok(
    (schedules.body as { schedules: Array<{ id: string }> }).schedules.some(
      (item) => item.id === createdScheduleId,
    ),
  );

  assertError(
    await api(`/doctors/${createdDoctorId}/schedule`, { token: clinicianToken }),
    404,
    'DOCTOR_NOT_FOUND',
  );

  const leaveResponse = await api(`/doctors/${createdDoctorId}/leaves`, {
    method: 'POST',
    token: adminToken,
    body: {
      startAt: utcAt(targetDay, 11).toISOString(),
      endAt: utcAt(targetDay, 12).toISOString(),
      reason: 'Management test leave',
    },
  });
  assert.equal(leaveResponse.status, 201, JSON.stringify(leaveResponse.body));
  leaveId = (leaveResponse.body as { leave: { id: string } }).leave.id;

  const unavailabilityResponse = await api(`/doctors/${createdDoctorId}/unavailability`, {
    method: 'POST',
    token: adminToken,
    body: {
      startAt: utcAt(targetDay, 9, 30).toISOString(),
      endAt: utcAt(targetDay, 10).toISOString(),
      reason: 'Management test unavailability',
    },
  });
  assert.equal(unavailabilityResponse.status, 201, JSON.stringify(unavailabilityResponse.body));
  unavailabilityId = (
    unavailabilityResponse.body as {
      unavailability: { id: string };
    }
  ).unavailability.id;

  assertError(
    await api(`/doctors/${createdDoctorId}/leaves`, {
      method: 'POST',
      token: adminToken,
      body: {
        startAt: utcAt(targetDay, 11, 30).toISOString(),
        endAt: utcAt(targetDay, 12, 30).toISOString(),
      },
    }),
    409,
    'DOCTOR_LEAVE_OVERLAP',
  );

  const clinicianDoctorDetail = await api(`/doctors/${createdDoctorId}`, {
    token: clinicianToken,
  });
  assert.equal(clinicianDoctorDetail.status, 200);
  const restrictedDoctor = (
    clinicianDoctorDetail.body as { doctor: Record<string, unknown> }
  ).doctor;
  assert.equal('schedules' in restrictedDoctor, false);
  assert.equal('leaves' in restrictedDoctor, false);
  assert.equal('unavailability' in restrictedDoctor, false);

  const fullDoctorDetail = await api(`/doctors/${createdDoctorId}`, { token: adminToken });
  assert.equal(fullDoctorDetail.status, 200);
  const fullDoctor = (fullDoctorDetail.body as { doctor: Record<string, unknown> }).doctor;
  assert.ok(
    (fullDoctor.schedules as Array<{ id: string }>).some(
      (schedule) => schedule.id === createdScheduleId,
    ),
  );
  assert.ok(
    (fullDoctor.leaves as Array<{ id: string }>).some((leave) => leave.id === leaveId),
  );
  assert.ok(
    (fullDoctor.unavailability as Array<{ id: string }>).some(
      (period) => period.id === unavailabilityId,
    ),
  );

  const slots = await api(
    `/appointments/available-slots?${queryString({
      doctorId: createdDoctorId,
      start: utcAt(targetDay, 8).toISOString(),
      end: utcAt(targetDay, 12).toISOString(),
    })}`,
    { token: frontDeskToken },
  );
  assert.equal(slots.status, 200, JSON.stringify(slots.body));
  const slotStarts = (
    slots.body as {
      slots: Array<{ start: string }>;
    }
  ).slots.map((slot) => slot.start);
  assert.deepEqual(slotStarts, [
    utcAt(targetDay, 9).toISOString(),
    utcAt(targetDay, 10, 30).toISOString(),
  ]);

  const availableDoctors = await api(
    `/appointments/available-doctors?${queryString({
      search: `${DEPARTMENT_CODE_PREFIX}DOC`,
      start: utcAt(targetDay, 8).toISOString(),
      end: utcAt(targetDay, 12).toISOString(),
      page: 1,
      pageSize: 10,
    })}`,
    { token: frontDeskToken },
  );
  assert.equal(availableDoctors.status, 200);
  const availableDoctorRows = (
    availableDoctors.body as {
      doctors: Array<{ id: string; availableSlotCount: number; nextAvailableSlot: string }>;
    }
  ).doctors;
  const availableDoctor = availableDoctorRows.find((item) => item.id === createdDoctorId);
  assert.ok(availableDoctor);
  assert.equal(availableDoctor.availableSlotCount, 2);
  assert.equal(availableDoctor.nextAvailableSlot, utcAt(targetDay, 9).toISOString());

  const deleteUnavailability = await api(
    `/doctors/${createdDoctorId}/unavailability/${unavailabilityId}`,
    { method: 'DELETE', token: adminToken },
  );
  assert.equal(deleteUnavailability.status, 204);
  unavailabilityId = '';

  const leaves = await api(`/doctors/${createdDoctorId}/leaves`, {
    token: adminToken,
  });
  assert.equal(leaves.status, 200);
  assert.ok(
    (leaves.body as { leaves: Array<{ id: string }> }).leaves.some((item) => item.id === leaveId),
  );
});

test('books, replays, rejects conflicts, reschedules, cancels, transitions, and filters appointments', async () => {
  const bookingStart = utcAt(targetDay, 9);
  const bookingEnd = utcAt(targetDay, 9, 30);

  const firstBooking = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-book-first`,
    body: appointmentBody(createdPatientId, createdDoctorId, bookingStart, bookingEnd),
  });
  assert.equal(firstBooking.status, 201, JSON.stringify(firstBooking.body));
  const firstAppointment = (
    firstBooking.body as {
      appointment: { id: string; status: string; patient: { id: string } };
      replayed: boolean;
    }
  ).appointment;
  firstAppointmentId = firstAppointment.id;
  assert.equal(firstAppointment.status, 'SCHEDULED');
  assert.equal(firstAppointment.patient.id, createdPatientId);

  const replay = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-book-first`,
    body: appointmentBody(createdPatientId, createdDoctorId, bookingStart, bookingEnd),
  });
  assert.equal(replay.status, 201);
  assert.equal(
    (replay.body as { appointment: { id: string }; replayed: boolean }).appointment.id,
    firstAppointmentId,
  );
  assert.equal((replay.body as { replayed: boolean }).replayed, true);

  assertError(
    await api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-book-conflict`,
      body: appointmentBody(createdPatientId, createdDoctorId, bookingStart, bookingEnd),
    }),
    409,
    'APPOINTMENT_SLOT_UNAVAILABLE',
  );

  assertError(
    await api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-book-outside`,
      body: appointmentBody(
        createdPatientId,
        createdDoctorId,
        utcAt(targetDay, 13),
        utcAt(targetDay, 13, 30),
      ),
    }),
    409,
    'APPOINTMENT_SLOT_UNAVAILABLE',
  );

  assertError(
    await api('/appointments', {
      method: 'POST',
      token: clinicianToken,
      idempotencyKey: `${PREFIX}-book-clinician`,
      body: appointmentBody(
        createdPatientId,
        createdDoctorId,
        utcAt(targetDay, 9, 30),
        utcAt(targetDay, 10),
      ),
    }),
    403,
    'FORBIDDEN',
  );

  const concurrentStart = utcAt(targetDay, 10, 30);
  const concurrentEnd = utcAt(targetDay, 11);
  const concurrentResponses = await Promise.all([
    api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-concurrent-a`,
      body: appointmentBody(createdPatientId, createdDoctorId, concurrentStart, concurrentEnd),
    }),
    api('/appointments', {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-concurrent-b`,
      body: appointmentBody(createdPatientId, createdDoctorId, concurrentStart, concurrentEnd),
    }),
  ]);
  const concurrentStatuses = concurrentResponses.map((response) => response.status).sort();
  assert.deepEqual(concurrentStatuses, [201, 409]);

  const winner = concurrentResponses.find((response) => response.status === 201);
  assert.ok(winner);
  statusAppointmentId = (
    winner.body as {
      appointment: { id: string };
    }
  ).appointment.id;

  const fixtureSchedule = await api(`/doctors/${fixtureDoctorId}/schedules`, {
    method: 'POST',
    token: adminToken,
    body: {
      dayOfWeek: DAY_NAMES[targetDay.getUTCDay()],
      startTime: '14:00',
      endTime: '16:00',
      slotDurationMinutes: 30,
    },
  });
  assert.equal(fixtureSchedule.status, 201, JSON.stringify(fixtureSchedule.body));

  const clinicianPatientBooking = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-book-clinician-patient`,
    body: appointmentBody(
      createdPatientId,
      fixtureDoctorId,
      utcAt(targetDay, 14),
      utcAt(targetDay, 14, 30),
    ),
  });
  assert.equal(clinicianPatientBooking.status, 201, JSON.stringify(clinicianPatientBooking.body));

  const clinicianPatientList = await api(
    `/patients?${queryString({ search: `Patient${RUN_ID}`, page: 1, pageSize: 50 })}`,
    { token: clinicianToken },
  );
  assert.equal(clinicianPatientList.status, 200);
  assert.ok(
    (clinicianPatientList.body as { patients: Array<{ id: string }> }).patients.some(
      (patient) => patient.id === createdPatientId,
    ),
  );

  const clinicianPatientDetail = await api(`/patients/${createdPatientId}`, {
    token: clinicianToken,
  });
  assert.equal(clinicianPatientDetail.status, 200);
  const clinicianPatient = (
    clinicianPatientDetail.body as { patient: Record<string, unknown> }
  ).patient;
  assert.equal('allergies' in clinicianPatient, true);
  assert.equal(clinicianPatient.allergies, 'Penicillin');

  const reschedule = await api(`/appointments/${firstAppointmentId}/reschedule`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-reschedule-first`,
    body: {
      scheduledStart: utcAt(targetDay, 9, 30).toISOString(),
      scheduledEnd: utcAt(targetDay, 10).toISOString(),
      reason: 'Management test reschedule',
    },
  });
  assert.equal(reschedule.status, 200, JSON.stringify(reschedule.body));
  assert.equal(
    new Date(
      (reschedule.body as { appointment: { scheduledStart: string } }).appointment.scheduledStart,
    ).toISOString(),
    utcAt(targetDay, 9, 30).toISOString(),
  );

  const cancel = await api(`/appointments/${firstAppointmentId}/cancel`, {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-cancel-first`,
    body: { cancellationReason: 'Management test cancellation' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(
    (cancel.body as { appointment: { status: string } }).appointment.status,
    'CANCELLED',
  );

  assertError(
    await api(`/appointments/${firstAppointmentId}/reschedule`, {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-reschedule-cancelled`,
      body: {
        scheduledStart: utcAt(targetDay, 9).toISOString(),
        scheduledEnd: utcAt(targetDay, 9, 30).toISOString(),
      },
    }),
    409,
    'APPOINTMENT_NOT_RESCHEDULABLE',
  );

  const rebook = await api('/appointments', {
    method: 'POST',
    token: frontDeskToken,
    idempotencyKey: `${PREFIX}-rebook-freed`,
    body: appointmentBody(createdPatientId, createdDoctorId, bookingStart, bookingEnd),
  });
  assert.equal(rebook.status, 201, JSON.stringify(rebook.body));

  for (const status of ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']) {
    const transition = await api(`/appointments/${statusAppointmentId}/status`, {
      method: 'PATCH',
      token: frontDeskToken,
      body: { status, reason: `Management transition to ${status}` },
    });
    assert.equal(transition.status, 200, JSON.stringify(transition.body));
    assert.equal(
      (transition.body as { appointment: { status: string } }).appointment.status,
      status,
    );
  }

  assertError(
    await api(`/appointments/${statusAppointmentId}/status`, {
      method: 'PATCH',
      token: frontDeskToken,
      body: { status: 'CONFIRMED' },
    }),
    409,
    'APPOINTMENT_STATUS_TRANSITION_INVALID',
  );

  assertError(
    await api(`/appointments/${statusAppointmentId}/cancel`, {
      method: 'POST',
      token: frontDeskToken,
      idempotencyKey: `${PREFIX}-cancel-completed`,
      body: { cancellationReason: 'Cannot cancel completed appointment' },
    }),
    409,
    'APPOINTMENT_NOT_CANCELLABLE',
  );

  const history = await api(
    `/appointments?${queryString({
      doctorId: createdDoctorId,
      patientId: createdPatientId,
      status: 'COMPLETED',
      page: 1,
      pageSize: 1,
    })}`,
    { token: frontDeskToken },
  );
  assert.equal(history.status, 200);
  const historyBody = history.body as {
    appointments: Array<{ id: string; status: string }>;
    pagination: { total: number; pageSize: number };
  };
  assert.equal(historyBody.appointments[0]?.id, statusAppointmentId);
  assert.equal(historyBody.appointments[0]?.status, 'COMPLETED');
  assert.ok(historyBody.pagination.total >= 1);
  assert.equal(historyBody.pagination.pageSize, 1);

  const clinicianAppointments = await api('/appointments', {
    token: clinicianToken,
  });
  assert.equal(clinicianAppointments.status, 200);
  const clinicianAppointmentList = (
    clinicianAppointments.body as {
      appointments: Array<{ id: string; doctor: { id: string } }>;
    }
  ).appointments;
  assert.ok(clinicianAppointmentList.length >= 1);
  assert.ok(
    clinicianAppointmentList.every((appointment) => appointment.doctor.id === fixtureDoctorId),
  );

  assertError(
    await api(`/appointments/${statusAppointmentId}`, { token: clinicianToken }),
    404,
    'APPOINTMENT_NOT_FOUND',
  );
});

test('records patient and appointment audit events without sensitive credential material', async () => {
  const patientAudits = await prisma.auditLog.findMany({
    where: { entityType: 'Patient', entityId: createdPatientId },
    select: { action: true, metadata: true, before: true, after: true },
  });
  assert.ok(patientAudits.some((audit) => audit.action === 'PATIENT_CREATED'));
  assert.ok(patientAudits.some((audit) => audit.action === 'PATIENT_UPDATED'));

  const appointmentAudits = await prisma.auditLog.findMany({
    where: {
      entityType: 'Appointment',
      entityId: { in: [firstAppointmentId, statusAppointmentId] },
    },
    select: { action: true, metadata: true, before: true, after: true },
  });
  const actions = new Set(appointmentAudits.map((audit) => audit.action));
  assert.ok(actions.has('APPOINTMENT_BOOKED'));
  assert.ok(actions.has('APPOINTMENT_RESCHEDULED'));
  assert.ok(actions.has('APPOINTMENT_CANCELLED'));
  assert.ok(actions.has('APPOINTMENT_STATUS_CHANGED'));

  const staffRoleAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Staff', entityId: createdStaffId, action: 'STAFF_ROLE_CHANGED' },
    select: { before: true, after: true },
  });
  assert.ok(staffRoleAudit);
  assert.equal((staffRoleAudit.before as { role?: string }).role, 'FRONT_DESK');
  assert.equal((staffRoleAudit.after as { role?: string }).role, 'ADMIN');

  const serialized = JSON.stringify([...patientAudits, ...appointmentAudits]);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('accessToken'), false);
  assert.equal(serialized.includes('refreshToken'), false);
});

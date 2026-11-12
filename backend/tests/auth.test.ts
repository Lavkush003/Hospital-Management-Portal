import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TEST_PREFIX = 'authtest-';
const TEST_PASSWORD = 'Authtest-Password-2026!';
const NEW_PASSWORD = 'Authtest-New-Password-2026!';
const REFRESH_COOKIE = 'hms_refresh_token';
const CSRF_COOKIE = 'hms_csrf_token';
const JWT_ISSUER = 'hospital-management-api';
const JWT_AUDIENCE = 'hospital-management-client';
const CREATED_PATIENT_EMAIL = 'authtest-created@example.test';
const REGISTERED_PATIENT_EMAIL = 'authtest-signup@example.test';
const EXISTING_PATIENT_EMAIL = 'authtest-existing-patient@example.test';
const testStartedAt = new Date();

const USER_IDS = {
  admin: `${TEST_PREFIX}user-admin`,
  frontDesk: `${TEST_PREFIX}user-frontdesk`,
  clinician: `${TEST_PREFIX}user-clinician`,
  otherClinician: `${TEST_PREFIX}user-other-clinician`,
  password: `${TEST_PREFIX}user-password`,
  status: `${TEST_PREFIX}user-status`,
  inactive: `${TEST_PREFIX}user-inactive`,
} as const;

const DOCTOR_IDS = {
  clinician: `${TEST_PREFIX}doctor-clinician`,
  otherClinician: `${TEST_PREFIX}doctor-other-clinician`,
} as const;

const PATIENT_IDS = {
  assigned: `${TEST_PREFIX}patient-assigned`,
  unassigned: `${TEST_PREFIX}patient-unassigned`,
} as const;

interface SessionBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  csrfToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    patientId?: string;
    passwordHash?: string;
  };
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

interface ApiResponse {
  status: number;
  body: unknown;
  headers: Headers;
  setCookies: string[];
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  csrf?: string;
  accessToken?: string | null;
}

class ApiClient {
  private readonly cookies = new Map<string, string>();
  accessToken: string | null = null;
  csrfToken: string | null = null;
  lastSetCookies: string[] = [];

  async request(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const headers: Record<string, string> = {};
    const method = options.method ?? 'GET';
    const accessToken = options.accessToken === undefined ? this.accessToken : options.accessToken;

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies.entries()]
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join('; ');
    }

    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
    }

    if (options.csrf) {
      headers['x-csrf-token'] = options.csrf;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const contentType = response.headers.get('content-type');
    const body =
      contentType?.includes('application/json') === true
        ? await response.json()
        : await response.text();
    const setCookies =
      (
        response.headers as Headers & {
          getSetCookie?: () => string[];
        }
      ).getSetCookie?.() ?? [];

    this.lastSetCookies = setCookies;

    for (const setCookie of setCookies) {
      this.applySetCookie(setCookie);
    }

    return {
      status: response.status,
      body,
      headers: response.headers,
      setCookies,
    };
  }

  async login(email: string, password = TEST_PASSWORD): Promise<ApiResponse> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (response.status === 200) {
      const session = response.body as SessionBody;
      this.accessToken = session.accessToken;
      this.csrfToken = session.csrfToken;
    }

    return response;
  }

  async refresh(): Promise<ApiResponse> {
    const csrf = this.getCookie(CSRF_COOKIE) ?? this.csrfToken ?? '';
    const response = await this.request('/auth/refresh', {
      method: 'POST',
      csrf,
    });

    if (response.status === 200) {
      const session = response.body as SessionBody;
      this.accessToken = session.accessToken;
      this.csrfToken = session.csrfToken;
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const csrf = this.getCookie(CSRF_COOKIE) ?? this.csrfToken ?? '';
    return this.request('/auth/logout', {
      method: 'POST',
      csrf,
    });
  }

  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  private applySetCookie(cookie: string): void {
    const pair = cookie.split(';')[0];

    if (!pair) {
      return;
    }

    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const name = pair.slice(0, separatorIndex).trim();
    const rawValue = pair.slice(separatorIndex + 1).trim();
    const isExpired = /Max-Age=0/i.test(cookie) || /Expires=Thu, 01 Jan 1970/i.test(cookie);

    if (!name || isExpired || rawValue.length === 0) {
      this.cookies.delete(name);
      return;
    }

    try {
      this.cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      this.cookies.set(name, rawValue);
    }
  }
}

let baseUrl = '';
let server: Server | undefined;
let prisma: PrismaClient;
let accessSecret = '';

function errorBody(response: ApiResponse): ErrorBody['error'] {
  return (response.body as ErrorBody).error;
}

function assertError(response: ApiResponse, status: number, code: string): ErrorBody['error'] {
  assert.equal(response.status, status, JSON.stringify(response.body));
  const error = errorBody(response);
  assert.equal(error.code, code);
  return error;
}

function sessionBody(response: ApiResponse): SessionBody {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body as SessionBody;
}

async function loginAs(email: string, password = TEST_PASSWORD): Promise<ApiClient> {
  const client = new ApiClient();
  sessionBody(await client.login(email, password));
  return client;
}

async function cleanupTestData(): Promise<void> {
  const userRows = await prisma.user.findMany({
    where: {
      OR: [{ id: { startsWith: TEST_PREFIX } }, { email: REGISTERED_PATIENT_EMAIL }],
    },
    select: { id: true },
  });
  const userIds = userRows.map((user) => user.id);
  const patientRows = await prisma.patient.findMany({
    where: {
      OR: [
        { id: { startsWith: TEST_PREFIX } },
        { email: { in: [CREATED_PATIENT_EMAIL, REGISTERED_PATIENT_EMAIL, EXISTING_PATIENT_EMAIL] } },
      ],
    },
    select: { id: true },
  });
  const patientIds = patientRows.map((patient) => patient.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { entityId: { startsWith: TEST_PREFIX } },
        { entityId: { in: patientIds } },
        {
          AND: [{ createdAt: { gte: testStartedAt } }, { action: { startsWith: 'AUTH_' } }],
        },
      ],
    },
  });
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.invoice.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.visit.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.appointment.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.doctorSchedule.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.doctor.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.staff.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [{ id: { startsWith: TEST_PREFIX } }, { email: REGISTERED_PATIENT_EMAIL }],
    },
  });
  await prisma.patient.deleteMany({
    where: {
      OR: [
        { id: { startsWith: TEST_PREFIX } },
        { email: { in: [CREATED_PATIENT_EMAIL, REGISTERED_PATIENT_EMAIL, EXISTING_PATIENT_EMAIL] } },
      ],
    },
  });
  await prisma.department.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  });
}

async function createTestData(): Promise<void> {
  const passwordHash = await hash(TEST_PASSWORD, 10);
  const departmentId = `${TEST_PREFIX}department`;
  const futureStart = new Date('2035-01-01T10:00:00.000Z');
  const futureEnd = new Date('2035-01-01T10:30:00.000Z');

  const users: Prisma.UserCreateManyInput[] = [
    {
      id: USER_IDS.admin,
      email: 'authtest-admin@example.test',
      passwordHash,
      role: 'ADMIN',
      firstName: 'Auth',
      lastName: 'Admin',
    },
    {
      id: USER_IDS.frontDesk,
      email: 'authtest-frontdesk@example.test',
      passwordHash,
      role: 'FRONT_DESK',
      firstName: 'Auth',
      lastName: 'FrontDesk',
    },
    {
      id: USER_IDS.clinician,
      email: 'authtest-clinician@example.test',
      passwordHash,
      role: 'CLINICIAN',
      firstName: 'Auth',
      lastName: 'Clinician',
    },
    {
      id: USER_IDS.otherClinician,
      email: 'authtest-other-clinician@example.test',
      passwordHash,
      role: 'CLINICIAN',
      firstName: 'Auth',
      lastName: 'OtherClinician',
    },
    {
      id: USER_IDS.password,
      email: 'authtest-password@example.test',
      passwordHash,
      role: 'FRONT_DESK',
      firstName: 'Auth',
      lastName: 'Password',
    },
    {
      id: USER_IDS.status,
      email: 'authtest-status@example.test',
      passwordHash,
      role: 'FRONT_DESK',
      firstName: 'Auth',
      lastName: 'Status',
    },
    {
      id: USER_IDS.inactive,
      email: 'authtest-inactive@example.test',
      passwordHash,
      role: 'FRONT_DESK',
      status: 'INACTIVE',
      firstName: 'Auth',
      lastName: 'Inactive',
    },
  ];

  const patients: Prisma.PatientCreateManyInput[] = [
    {
      id: PATIENT_IDS.assigned,
      patientNumber: 'AUTHTEST-PAT-001',
      firstName: 'Authtest',
      lastName: 'Assigned',
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      email: EXISTING_PATIENT_EMAIL,
      status: 'ACTIVE',
    },
    {
      id: PATIENT_IDS.unassigned,
      patientNumber: 'AUTHTEST-PAT-002',
      firstName: 'Authtest',
      lastName: 'Unassigned',
      dateOfBirth: new Date('1995-05-05T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  ];

  const doctors: Prisma.DoctorCreateManyInput[] = [
    {
      id: DOCTOR_IDS.clinician,
      userId: USER_IDS.clinician,
      employeeCode: 'AUTHTEST-DOC-001',
      departmentId,
      firstName: 'Auth',
      lastName: 'Clinician',
      email: 'authtest-clinician@example.test',
      licenseNumber: 'AUTHTEST-LIC-001',
      specialization: 'Internal Medicine',
      status: 'ACTIVE',
    },
    {
      id: DOCTOR_IDS.otherClinician,
      userId: USER_IDS.otherClinician,
      employeeCode: 'AUTHTEST-DOC-002',
      departmentId,
      firstName: 'Auth',
      lastName: 'OtherClinician',
      email: 'authtest-other-clinician@example.test',
      licenseNumber: 'AUTHTEST-LIC-002',
      specialization: 'Cardiology',
      status: 'ACTIVE',
    },
  ];

  await prisma.department.create({
    data: {
      id: departmentId,
      code: 'AUTHTEST',
      name: 'Authentication Test Department',
      isActive: true,
    },
  });
  await prisma.user.createMany({ data: users });
  await prisma.patient.createMany({ data: patients });
  await prisma.doctor.createMany({ data: doctors });

  await prisma.doctorSchedule.create({
    data: {
      id: `${TEST_PREFIX}schedule-clinician`,
      doctorId: DOCTOR_IDS.clinician,
      dayOfWeek: 'MONDAY',
      startTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 12, 0)),
      slotDurationMinutes: 30,
      room: 'AUTHTEST-ROOM',
      isActive: true,
    },
  });

  await prisma.appointment.create({
    data: {
      id: `${TEST_PREFIX}appointment-001`,
      appointmentNumber: 'AUTHTEST-APT-001',
      patientId: PATIENT_IDS.assigned,
      doctorId: DOCTOR_IDS.clinician,
      scheduledStart: futureStart,
      scheduledEnd: futureEnd,
      status: 'SCHEDULED',
      reason: 'Authentication test appointment',
      createdById: USER_IDS.frontDesk,
    },
  });

  await prisma.visit.create({
    data: {
      id: `${TEST_PREFIX}visit-001`,
      visitNumber: 'AUTHTEST-VIS-001',
      patientId: PATIENT_IDS.assigned,
      doctorId: DOCTOR_IDS.clinician,
      status: 'IN_PROGRESS',
      chiefComplaint: 'Authentication test complaint',
      diagnosis: 'Authentication test diagnosis',
      clinicalNotes: 'Authentication test clinical notes',
      startedAt: futureStart,
    },
  });

  await prisma.invoice.create({
    data: {
      id: `${TEST_PREFIX}invoice-001`,
      invoiceNumber: 'AUTHTEST-INV-001',
      patientId: PATIENT_IDS.assigned,
      visitId: `${TEST_PREFIX}visit-001`,
      status: 'ISSUED',
      currency: 'USD',
      subtotal: '100.00',
      discountAmount: '0.00',
      taxAmount: '10.00',
      totalAmount: '110.00',
      issuedAt: new Date(),
    },
  });
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run authentication integration tests');
  }

  accessSecret = randomBytes(48).toString('hex');
  const refreshSecret = randomBytes(48).toString('hex');

  Object.assign(process.env, {
    NODE_ENV: 'test',
    CORS_ORIGIN: 'http://localhost:5173',
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_SALT_ROUNDS: '10',
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
    AUTH_LOGIN_RATE_LIMIT_MAX: '3',
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
  await createTestData();

  const app = createApp();
  server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (prisma) {
    await cleanupTestData();
    await prisma.$disconnect();
  }
});

test('logs in each role with secure session cookies', async () => {
  const accounts = [
    ['authtest-admin@example.test', 'ADMIN', USER_IDS.admin],
    ['authtest-frontdesk@example.test', 'FRONT_DESK', USER_IDS.frontDesk],
    ['authtest-clinician@example.test', 'CLINICIAN', USER_IDS.clinician],
  ] as const;

  for (const [email, role, userId] of accounts) {
    const client = new ApiClient();
    const response = await client.login(email);
    const session = sessionBody(response);

    assert.equal(session.tokenType, 'Bearer');
    assert.equal(session.user.role, role);
    assert.equal(session.user.id, userId);
    assert.equal(session.user.passwordHash, undefined);
    assert.equal('refreshToken' in session, false);
    assert.ok(client.getCookie(REFRESH_COOKIE));
    assert.ok(client.getCookie(CSRF_COOKIE));

    const refreshCookie = client.lastSetCookies.find((cookie) =>
      cookie.startsWith(`${REFRESH_COOKIE}=`),
    );
    const csrfCookie = client.lastSetCookies.find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`));

    assert.ok(refreshCookie);
    assert.ok(csrfCookie);
    assert.match(refreshCookie, /HttpOnly/i);
    assert.match(refreshCookie, /SameSite=Lax/i);
    assert.match(refreshCookie, /Path=\/api\/auth/i);
    assert.match(csrfCookie, /(?:^|;\s*)Path=\/(?:;|$)/i);
    assert.doesNotMatch(csrfCookie, /HttpOnly/i);

    const me = await client.request('/auth/me');
    assert.equal(me.status, 200);
    assert.equal((me.body as { user: { id: string } }).user.id, userId);
  }
});

test('registers patient accounts and restricts access to the linked profile', async () => {
  const anonymous = new ApiClient();
  const registration = await anonymous.request('/auth/register', {
    method: 'POST',
    body: {
      firstName: 'New',
      lastName: 'Patient',
      dateOfBirth: '1990-04-12',
      email: REGISTERED_PATIENT_EMAIL,
      password: 'Authtest-Patient-Password-2026!',
    },
  });
  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  assert.equal(anonymous.lastSetCookies.length, 0);

  const patient = await loginAs(
    REGISTERED_PATIENT_EMAIL,
    'Authtest-Patient-Password-2026!',
  );
  const profileId = (await patient.request('/auth/me')).body as {
    user: { role: string; patientId?: string };
  };
  assert.equal(profileId.user.role, 'PATIENT');
  assert.ok(profileId.user.patientId);

  const ownProfile = await patient.request(`/patients/${profileId.user.patientId}`);
  assert.equal(ownProfile.status, 200);
  const ownPatient = (ownProfile.body as { patient: Record<string, unknown> }).patient;
  assert.equal(ownPatient.email, REGISTERED_PATIENT_EMAIL);
  assert.equal('allergies' in ownPatient, false);
  assert.equal('notes' in ownPatient, false);

  const list = await patient.request('/patients?page=1&pageSize=20');
  assert.equal(list.status, 200);
  const records = (list.body as { patients: Array<{ id: string }> }).patients;
  assert.deepEqual(records.map((record) => record.id), [profileId.user.patientId]);

  assertError(
    await patient.request(`/patients/${PATIENT_IDS.assigned}`),
    404,
    'PATIENT_NOT_FOUND',
  );
  assertError(await patient.request('/appointments?page=1&pageSize=20'), 403, 'FORBIDDEN');

  const duplicate = await anonymous.request('/auth/register', {
    method: 'POST',
    body: {
      firstName: 'Other',
      lastName: 'Person',
      dateOfBirth: '1990-04-12',
      email: REGISTERED_PATIENT_EMAIL,
      password: 'Authtest-Patient-Password-2026!',
    },
  });
  assertError(duplicate, 409, 'REGISTRATION_CONFLICT');

  const existingRecordEmail = await anonymous.request('/auth/register', {
    method: 'POST',
    body: {
      firstName: 'Assigned',
      lastName: 'Patient',
      dateOfBirth: '1990-04-12',
      email: EXISTING_PATIENT_EMAIL,
      password: 'Authtest-Patient-Password-2026!',
    },
  });
  assertError(existingRecordEmail, 409, 'REGISTRATION_CONFLICT');
});

test('rejects invalid credentials and inactive accounts generically', async () => {
  const invalid = new ApiClient();
  const invalidResponse = await invalid.login(
    'authtest-admin@example.test',
    'Definitely-Wrong-Password',
  );
  const invalidError = assertError(invalidResponse, 401, 'INVALID_CREDENTIALS');
  assert.equal(invalidError.message, 'Invalid email or password');

  const unknown = new ApiClient();
  const unknownResponse = await unknown.login(
    'authtest-unknown@example.test',
    'Definitely-Wrong-Password',
  );
  const unknownError = assertError(unknownResponse, 401, 'INVALID_CREDENTIALS');
  assert.equal(unknownError.message, 'Invalid email or password');

  const inactive = new ApiClient();
  const inactiveResponse = await inactive.login('authtest-inactive@example.test');
  const inactiveError = assertError(inactiveResponse, 401, 'INVALID_CREDENTIALS');
  assert.equal(inactiveError.message, 'Invalid email or password');
});

test('rejects missing, malformed, expired, and stale access tokens', async () => {
  const anonymous = new ApiClient();
  assertError(await anonymous.request('/auth/me'), 401, 'AUTHENTICATION_REQUIRED');

  const malformed = new ApiClient();
  malformed.accessToken = 'not-a-jwt';
  assertError(await malformed.request('/auth/me'), 401, 'INVALID_ACCESS_TOKEN');

  const client = await loginAs('authtest-admin@example.test');
  const expiredToken = jwt.sign({ role: 'ADMIN', ver: 0, type: 'access' }, accessSecret, {
    algorithm: 'HS256',
    subject: USER_IDS.admin,
    jwtid: randomUUID(),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: -60,
  });
  client.accessToken = expiredToken;
  assertError(await client.request('/auth/me'), 401, 'ACCESS_TOKEN_EXPIRED');

  const staleRoleToken = jwt.sign({ role: 'FRONT_DESK', ver: 0, type: 'access' }, accessSecret, {
    algorithm: 'HS256',
    subject: USER_IDS.admin,
    jwtid: randomUUID(),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: 300,
  });
  client.accessToken = staleRoleToken;
  assertError(await client.request('/auth/me'), 401, 'ACCESS_TOKEN_REVOKED');
});

test('enforces role-based access control across protected resources', async () => {
  const admin = await loginAs('authtest-admin@example.test');
  const frontDesk = await loginAs('authtest-frontdesk@example.test');
  const clinician = await loginAs('authtest-clinician@example.test');

  assert.equal((await admin.request('/admin/users')).status, 200);
  assertError(await frontDesk.request('/admin/users'), 403, 'FORBIDDEN');
  assertError(await clinician.request('/admin/users'), 403, 'FORBIDDEN');

  const createdPatient = await frontDesk.request('/patients', {
    method: 'POST',
    body: {
      firstName: 'Created',
      lastName: 'ByFrontDesk',
      dateOfBirth: '1991-02-03',
      gender: 'OTHER',
      email: CREATED_PATIENT_EMAIL,
    },
  });
  assert.equal(createdPatient.status, 201, JSON.stringify(createdPatient.body));

  assertError(
    await clinician.request('/patients', {
      method: 'POST',
      body: {
        firstName: 'Denied',
        lastName: 'ByClinician',
        dateOfBirth: '1992-03-04',
      },
    }),
    403,
    'FORBIDDEN',
  );

  assert.equal((await clinician.request(`/patients/${PATIENT_IDS.assigned}`)).status, 200);
  assert.equal(
    (await clinician.request(`/patients/${PATIENT_IDS.assigned}/clinical-summary`)).status,
    200,
  );
  assertError(
    await frontDesk.request(`/patients/${PATIENT_IDS.assigned}/clinical-summary`),
    403,
    'FORBIDDEN',
  );
  assert.equal(
    (await admin.request(`/patients/${PATIENT_IDS.assigned}/clinical-summary`)).status,
    200,
  );

  assertError(
    await clinician.request(`/billing/invoices/${TEST_PREFIX}invoice-001`),
    403,
    'FORBIDDEN',
  );
  assert.equal(
    (await frontDesk.request(`/billing/invoices/${TEST_PREFIX}invoice-001`)).status,
    200,
  );
  assert.equal((await admin.request(`/billing/invoices/${TEST_PREFIX}invoice-001`)).status, 200);
});

test('prevents clinician IDOR access to unrelated patients', async () => {
  const clinician = await loginAs('authtest-clinician@example.test');
  const otherClinician = await loginAs('authtest-other-clinician@example.test');

  assert.equal((await clinician.request(`/patients/${PATIENT_IDS.unassigned}`)).status, 404);
  assertError(
    await clinician.request(`/patients/${PATIENT_IDS.unassigned}`),
    404,
    'PATIENT_NOT_FOUND',
  );
  assertError(
    await clinician.request(`/patients/${PATIENT_IDS.unassigned}/clinical-summary`),
    404,
    'PATIENT_NOT_FOUND',
  );

  assertError(
    await otherClinician.request(`/patients/${PATIENT_IDS.assigned}`),
    404,
    'PATIENT_NOT_FOUND',
  );
  assertError(
    await otherClinician.request(`/patients/${PATIENT_IDS.assigned}/clinical-summary`),
    404,
    'PATIENT_NOT_FOUND',
  );
});

test('scopes appointments and doctor schedules for clinicians', async () => {
  const admin = await loginAs('authtest-admin@example.test');
  const frontDesk = await loginAs('authtest-frontdesk@example.test');
  const clinician = await loginAs('authtest-clinician@example.test');

  const clinicianAppointments = await clinician.request('/appointments');
  assert.equal(clinicianAppointments.status, 200);
  const clinicianAppointmentList = (
    clinicianAppointments.body as {
      appointments: Array<{ id: string; doctor: { id: string } }>;
    }
  ).appointments;

  assert.ok(
    clinicianAppointmentList.some(
      (appointment) => appointment.id === `${TEST_PREFIX}appointment-001`,
    ),
  );
  assert.ok(
    clinicianAppointmentList.every((appointment) => appointment.doctor.id === DOCTOR_IDS.clinician),
  );

  assert.equal((await admin.request('/appointments')).status, 200);
  assert.equal((await frontDesk.request('/appointments')).status, 200);

  assert.equal((await clinician.request(`/doctors/${DOCTOR_IDS.clinician}/schedule`)).status, 200);
  assertError(
    await clinician.request(`/doctors/${DOCTOR_IDS.otherClinician}/schedule`),
    404,
    'DOCTOR_NOT_FOUND',
  );
  assert.equal((await admin.request(`/doctors/${DOCTOR_IDS.otherClinician}/schedule`)).status, 200);
});

test('requires CSRF proof for refresh and logout', async () => {
  const client = await loginAs('authtest-admin@example.test');

  assertError(await client.request('/auth/refresh', { method: 'POST' }), 403, 'CSRF_TOKEN_INVALID');
  assertError(
    await client.request('/auth/refresh', {
      method: 'POST',
      csrf: 'not-the-csrf-token',
    }),
    403,
    'CSRF_TOKEN_INVALID',
  );
  assertError(await client.request('/auth/logout', { method: 'POST' }), 403, 'CSRF_TOKEN_INVALID');
});

test('rotates refresh tokens and revokes the family on reuse', async () => {
  const client = await loginAs('authtest-admin@example.test');
  const originalRefresh = client.getCookie(REFRESH_COOKIE);
  const originalCsrf = client.getCookie(CSRF_COOKIE);

  assert.ok(originalRefresh);
  assert.ok(originalCsrf);

  sessionBody(await client.refresh());
  const rotatedRefresh = client.getCookie(REFRESH_COOKIE);
  const rotatedCsrf = client.getCookie(CSRF_COOKIE);

  assert.ok(rotatedRefresh);
  assert.ok(rotatedCsrf);
  assert.notEqual(rotatedRefresh, originalRefresh);

  client.setCookie(REFRESH_COOKIE, originalRefresh);
  client.setCookie(CSRF_COOKIE, rotatedCsrf);

  const reuseResponse = await client.request('/auth/refresh', {
    method: 'POST',
    csrf: rotatedCsrf,
  });
  assertError(reuseResponse, 401, 'REFRESH_TOKEN_REUSED');

  client.setCookie(REFRESH_COOKIE, rotatedRefresh);
  client.setCookie(CSRF_COOKIE, rotatedCsrf);

  const revokedResponse = await client.request('/auth/refresh', {
    method: 'POST',
    csrf: rotatedCsrf,
  });
  assertError(revokedResponse, 401, 'REFRESH_TOKEN_REUSED');
});

test('logs out and revokes the refresh token family', async () => {
  const client = await loginAs('authtest-admin@example.test');
  const refreshToken = client.getCookie(REFRESH_COOKIE);
  const csrfToken = client.getCookie(CSRF_COOKIE);

  assert.ok(refreshToken);
  assert.ok(csrfToken);

  const logoutResponse = await client.logout();
  assert.equal(logoutResponse.status, 204);
  assert.equal(client.getCookie(REFRESH_COOKIE), undefined);
  assert.equal(client.getCookie(CSRF_COOKIE), undefined);

  client.setCookie(REFRESH_COOKIE, refreshToken);
  client.setCookie(CSRF_COOKIE, csrfToken);

  const refreshResponse = await client.request('/auth/refresh', {
    method: 'POST',
    csrf: csrfToken,
  });
  assertError(refreshResponse, 401, 'REFRESH_TOKEN_REUSED');
});

test('changes passwords and invalidates existing sessions', async () => {
  const client = await loginAs('authtest-password@example.test');
  const oldAccessToken = client.accessToken;
  const oldRefreshToken = client.getCookie(REFRESH_COOKIE);
  const oldCsrfToken = client.getCookie(CSRF_COOKIE);

  assert.ok(oldAccessToken);
  assert.ok(oldRefreshToken);
  assert.ok(oldCsrfToken);

  assertError(
    await client.request('/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: 'Wrong-Current-Password',
        newPassword: NEW_PASSWORD,
      },
    }),
    401,
    'INVALID_CURRENT_PASSWORD',
  );

  const changeResponse = await client.request('/auth/change-password', {
    method: 'POST',
    body: {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    },
  });
  assert.equal(changeResponse.status, 204, JSON.stringify(changeResponse.body));
  assert.equal(client.getCookie(REFRESH_COOKIE), undefined);

  client.accessToken = oldAccessToken;
  assertError(await client.request('/auth/me'), 401, 'ACCESS_TOKEN_REVOKED');

  client.setCookie(REFRESH_COOKIE, oldRefreshToken);
  client.setCookie(CSRF_COOKIE, oldCsrfToken);
  assertError(
    await client.request('/auth/refresh', {
      method: 'POST',
      csrf: oldCsrfToken,
    }),
    401,
    'REFRESH_TOKEN_REUSED',
  );

  const oldPasswordClient = new ApiClient();
  assertError(
    await oldPasswordClient.login('authtest-password@example.test', TEST_PASSWORD),
    401,
    'INVALID_CREDENTIALS',
  );

  const newPasswordClient = new ApiClient();
  sessionBody(await newPasswordClient.login('authtest-password@example.test', NEW_PASSWORD));
});

test('blocks access tokens immediately when an account becomes inactive', async () => {
  const client = await loginAs('authtest-status@example.test');

  await prisma.user.update({
    where: { id: USER_IDS.status },
    data: { status: 'INACTIVE' },
  });

  assertError(await client.request('/auth/me'), 401, 'ACCOUNT_INACTIVE');
});

test('rate limits repeated failed login attempts', async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = new ApiClient();
    assertError(
      await client.login('authtest-rate-limit@example.test', 'Definitely-Wrong-Password'),
      401,
      'INVALID_CREDENTIALS',
    );
  }

  const blockedClient = new ApiClient();
  const blockedResponse = await blockedClient.login(
    'authtest-rate-limit@example.test',
    'Definitely-Wrong-Password',
  );
  assertError(blockedResponse, 429, 'LOGIN_RATE_LIMITED');
  assert.ok(blockedResponse.headers.get('retry-after'));
});

test('records authentication audit events without token material', async () => {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: testStartedAt },
      action: {
        in: [
          'AUTH_LOGIN_SUCCEEDED',
          'AUTH_LOGIN_FAILED',
          'AUTH_REFRESH_ROTATED',
          'AUTH_REFRESH_REUSE_DETECTED',
          'AUTH_LOGOUT',
          'AUTH_PASSWORD_CHANGED',
        ],
      },
    },
    select: {
      action: true,
      metadata: true,
      outcome: true,
    },
  });
  const actions = new Set(auditLogs.map((log) => log.action));

  assert.ok(actions.has('AUTH_LOGIN_SUCCEEDED'));
  assert.ok(actions.has('AUTH_LOGIN_FAILED'));
  assert.ok(actions.has('AUTH_REFRESH_ROTATED'));
  assert.ok(actions.has('AUTH_REFRESH_REUSE_DETECTED'));
  assert.ok(actions.has('AUTH_LOGOUT'));
  assert.ok(actions.has('AUTH_PASSWORD_CHANGED'));

  const serializedMetadata = JSON.stringify(auditLogs.map((log) => log.metadata));
  assert.equal(serializedMetadata.includes(TEST_PASSWORD), false);
  assert.equal(serializedMetadata.includes(NEW_PASSWORD), false);
  assert.ok(auditLogs.some((log) => log.action === 'AUTH_LOGIN_FAILED' && log.outcome === 'FAILURE'));
});

test('serves date-filtered analytics and restricts reports and audit logs to admins', async () => {
  const admin = await loginAs('authtest-admin@example.test');
  const frontDesk = await loginAs('authtest-frontdesk@example.test');
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86_400_000);
  const to = now;
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });

  const analyticsResponse = await admin.request(`/admin/analytics?${query}`);
  assert.equal(analyticsResponse.status, 200, JSON.stringify(analyticsResponse.body));
  const analytics = analyticsResponse.body as {
    totals: { appointments: number; registeredPatients: number; doctors: number };
    dailyAppointments: Array<{ total: number }>;
  };
  assert.equal(analytics.totals.registeredPatients, await prisma.patient.count());
  assert.equal(analytics.totals.doctors, await prisma.doctor.count());
  const expectedAppointments = await prisma.appointment.count({
    where: { scheduledStart: { gte: from, lte: to } },
  });
  assert.equal(analytics.totals.appointments, expectedAppointments);

  const reportsResponse = await admin.request(`/admin/reports?${query}`);
  assert.equal(reportsResponse.status, 200, JSON.stringify(reportsResponse.body));
  const reports = reportsResponse.body as {
    dailyAppointments: Array<{ total: number }>;
    monthlyAppointments: Array<{ total: number }>;
    financialsByCurrency: Array<{
      currency: string;
      invoicedAmount: string;
      outstandingBalance: string;
      successfulPaymentAmount: string;
    }>;
  };
  assert.equal(
    reports.dailyAppointments.reduce((total, row) => total + row.total, 0),
    expectedAppointments,
  );
  assert.ok(Array.isArray(reports.monthlyAppointments));
  assert.equal(
    reports.monthlyAppointments.reduce((total, row) => total + row.total, 0),
    expectedAppointments,
  );

  const financialFrom = new Date(now.getTime() - 365 * 86_400_000);
  const financialQuery = new URLSearchParams({
    from: financialFrom.toISOString(),
    to: to.toISOString(),
  });
  const financialReportResponse = await admin.request(`/admin/reports?${financialQuery}`);
  assert.equal(financialReportResponse.status, 200, JSON.stringify(financialReportResponse.body));
  const financialReport = financialReportResponse.body as typeof reports;
  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceDate: { gte: financialFrom, lte: to },
      status: { notIn: ['DRAFT', 'VOID', 'REFUNDED'] },
    },
    select: {
      currency: true,
      totalAmount: true,
      payments: { where: { status: 'SUCCESSFUL' }, select: { amount: true } },
    },
  });
  const payments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESSFUL',
      OR: [
        { paidAt: { gte: financialFrom, lte: to } },
        { paidAt: null, createdAt: { gte: financialFrom, lte: to } },
      ],
    },
    select: { amount: true, invoice: { select: { currency: true } } },
  });
  const expectedFinancials = new Map<
    string,
    { invoiced: Prisma.Decimal; outstanding: Prisma.Decimal; paid: Prisma.Decimal }
  >();
  const getFinancials = (currency: string) => {
    const current = expectedFinancials.get(currency) ?? {
      invoiced: new Prisma.Decimal(0),
      outstanding: new Prisma.Decimal(0),
      paid: new Prisma.Decimal(0),
    };
    expectedFinancials.set(currency, current);
    return current;
  };
  for (const invoice of invoices) {
    const totals = getFinancials(invoice.currency);
    const successfulPayments = invoice.payments.reduce(
      (amount, payment) => amount.add(payment.amount),
      new Prisma.Decimal(0),
    );
    totals.invoiced = totals.invoiced.add(invoice.totalAmount);
    const balance = invoice.totalAmount.sub(successfulPayments);
    if (balance.gt(0)) totals.outstanding = totals.outstanding.add(balance);
  }
  for (const payment of payments) {
    const totals = getFinancials(payment.invoice.currency);
    totals.paid = totals.paid.add(payment.amount);
  }
  assert.deepEqual(
    financialReport.financialsByCurrency,
    [...expectedFinancials.entries()]
      .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
      .map(([currency, totals]) => ({
        currency,
        invoicedAmount: totals.invoiced.toFixed(2),
        outstandingBalance: totals.outstanding.toFixed(2),
        successfulPaymentAmount: totals.paid.toFixed(2),
      })),
  );

  for (const path of [`/admin/analytics?${query}`, `/admin/reports?${query}`, '/admin/audit-logs']) {
    assertError(await frontDesk.request(path), 403, 'FORBIDDEN');
  }

  const auditQuery = new URLSearchParams({
    from: testStartedAt.toISOString(),
    to: new Date().toISOString(),
    outcome: 'FAILURE',
    search: 'AUTH_LOGIN_FAILED',
    page: '1',
    pageSize: '100',
  });
  const auditResponse = await admin.request(`/admin/audit-logs?${auditQuery}`);
  assert.equal(auditResponse.status, 200, JSON.stringify(auditResponse.body));
  const auditLogs = (auditResponse.body as { logs: Array<Record<string, unknown>> }).logs;
  assert.ok(auditLogs.length > 0);
  assert.ok(auditLogs.every((log) => log.outcome === 'FAILURE'));
  assert.ok(auditLogs.every((log) => !('before' in log) && !('after' in log) && !('metadata' in log)));

  const invalidRange = new URLSearchParams({
    from: to.toISOString(),
    to: from.toISOString(),
  });
  assert.equal((await admin.request(`/admin/reports?${invalidRange}`)).status, 400);
});

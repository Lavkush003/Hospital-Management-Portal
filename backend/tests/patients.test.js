const request = require('supertest');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const Patient = require('../src/models/Patient');
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
  uniqueStartTime,
} = require('./helpers/factories');

const patientPayload = (overrides = {}) => ({
  firstName: 'Alicia',
  lastName: 'Fernandez',
  dateOfBirth: '1991-06-14',
  gender: 'FEMALE',
  phone: '+1-555-7788',
  email: 'alicia.fernandez@example.test',
  bloodGroup: 'A_POSITIVE',
  address: { line1: '12 Elm Street', city: 'Springfield', state: 'IL', postalCode: '62701' },
  emergencyContact: { name: 'Mario Fernandez', phone: '+1-555-7789', relationship: 'Spouse' },
  ...overrides,
});

describe('Patient management', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  test('receptionist registers a patient with a generated patient ID and an audit trail', async () => {
    const { token, user } = await createUser({ role: 'RECEPTIONIST' });

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(patientPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.patientId).toMatch(/^PAT-\d{5}$/);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.email).toBe('alicia.fernandez@example.test');

    const audit = await AuditLog.findOne({ action: 'PATIENT_CREATED' });
    expect(audit).not.toBeNull();
    expect(String(audit.actor)).toBe(String(user._id));
    expect(audit.resourceId).toBe(res.body.data.patientId);
  });

  test('validates required patient fields', async () => {
    const { token } = await createUser({ role: 'RECEPTIONIST' });
    const payload = patientPayload();
    delete payload.gender;

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((detail) => detail.path === 'gender')).toBe(true);
  });

  test('rejects future dates of birth', async () => {
    const { token } = await createUser({ role: 'RECEPTIONIST' });
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(patientPayload({ dateOfBirth: future.toISOString().slice(0, 10) }));

    expect(res.status).toBe(422);
    expect(res.body.error.details.some((detail) => detail.path === 'dateOfBirth')).toBe(true);
  });

  test('prevents doctors from registering or editing patients', async () => {
    const { token } = await createDoctor();
    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(patientPayload());
    expect(created.status).toBe(403);

    const patient = await createPatient();
    const updated = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Nope' });
    expect(updated.status).toBe(403);
  });

  test('supports search, pagination and profile updates', async () => {
    const { token } = await createUser({ role: 'ADMIN' });
    await createPatient({ firstName: 'Searchable', lastName: 'Unique' });
    await createPatient({ firstName: 'Other', lastName: 'Person' });

    const list = await request(app)
      .get('/api/patients?search=Searchable&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });

    const patient = list.body.data[0];
    const update = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated', bloodGroup: 'B_NEGATIVE' });
    expect(update.status).toBe(200);
    expect(update.body.data.firstName).toBe('Updated');
    expect(update.body.data.bloodGroup).toBe('B_NEGATIVE');
  });

  test('limits doctors to patients assigned through their appointments', async () => {
    const doctorA = await createDoctor();
    const doctorB = await createDoctor();
    const assigned = await createPatient({ firstName: 'Assigned' });
    const unassigned = await createPatient({ firstName: 'Unassigned' });

    await createAppointment({
      patient: assigned,
      doctor: doctorA.doctor,
      date: futureDateKey(2),
      startTime: uniqueStartTime(),
    });

    const ok = await request(app)
      .get(`/api/patients/${assigned._id}`)
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(ok.status).toBe(200);

    const forbidden = await request(app)
      .get(`/api/patients/${unassigned._id}`)
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('PATIENT_NOT_ASSIGNED');

    const list = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].patientId).toBe(assigned.patientId);

    const otherDoctor = await request(app)
      .get(`/api/patients/${assigned._id}`)
      .set('Authorization', `Bearer ${doctorB.token}`);
    expect(otherDoctor.status).toBe(403);
  });

  test('returns a consolidated history while hiding clinical records from receptionists', async () => {
    const { token: receptionToken } = await createUser({ role: 'RECEPTIONIST' });
    const patient = await createPatient();

    const res = await request(app)
      .get(`/api/patients/${patient._id}/history`)
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.patient.patientId).toBe(patient.patientId);
    expect(res.body.data.appointments).toEqual([]);
    expect(res.body.data.encounters).toEqual([]);
    expect(res.body.data.prescriptions).toEqual([]);
    expect(res.body.data.reports).toEqual([]);
    expect(res.body.data.invoices).toEqual([]);
  });

  test('only administrators can deactivate patients', async () => {
    const patient = await createPatient();
    const admin = await createUser({ role: 'ADMIN' });
    const reception = await createUser({ role: 'RECEPTIONIST' });

    const denied = await request(app)
      .patch(`/api/patients/${patient._id}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ status: 'INACTIVE' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .patch(`/api/patients/${patient._id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'INACTIVE' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('INACTIVE');
    expect(await Patient.countDocuments({ status: 'INACTIVE' })).toBe(1);
  });

  test('returns 404 for unknown patients and 422 for malformed identifiers', async () => {
    const { token } = await createUser({ role: 'ADMIN' });
    const missing = await request(app)
      .get('/api/patients/64b000000000000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const malformed = await request(app)
      .get('/api/patients/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(malformed.status).toBe(422);
  });
});

const request = require('supertest');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
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
  createInvoiceFor,
  addPayment,
  futureDateKey,
} = require('./helpers/factories');
const { toDateKey } = require('../src/utils/dates');

async function seedReportingData() {
  const admin = await createUser({ role: 'ADMIN' });
  const reception = await createUser({ role: 'RECEPTIONIST' });
  const doctor = await createDoctor();
  const patientA = await createPatient({ firstName: 'Alpha' });
  const patientB = await createPatient({ firstName: 'Beta' });

  await createAppointment({
    patient: patientA,
    doctor: doctor.doctor,
    date: futureDateKey(1),
    startTime: '09:00',
    status: 'COMPLETED',
    createdBy: reception.user._id,
  });
  await createAppointment({
    patient: patientB,
    doctor: doctor.doctor,
    date: futureDateKey(2),
    startTime: '09:30',
    status: 'BOOKED',
    createdBy: reception.user._id,
  });
  await createAppointment({
    patient: patientA,
    doctor: doctor.doctor,
    date: futureDateKey(3),
    startTime: '10:00',
    status: 'CANCELLED',
    createdBy: reception.user._id,
  });

  const invoice = await createInvoiceFor(patientA, {
    lineItems: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200, amount: 200 }],
    subtotal: 200,
    totalAmount: 210,
    taxRate: 5,
    tax: 10,
    amountPaid: 100,
    balanceDue: 110,
    status: 'PARTIALLY_PAID',
    createdBy: reception.user._id,
  });
  await addPayment(invoice, 100, { receivedBy: reception.user._id });

  return { admin, reception, doctor, patientA, patientB, invoice };
}

describe('Dashboards, reports and audit logs', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  test('serves role-specific dashboards with aggregate metrics', async () => {
    const { admin, reception, doctor } = await seedReportingData();

    const adminDash = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminDash.status).toBe(200);
    expect(adminDash.body.data.stats.totalPatients).toBe(2);
    expect(adminDash.body.data.stats.totalDoctors).toBe(1);
    expect(adminDash.body.data.stats.totalRevenue).toBe(100);
    expect(adminDash.body.data.charts.appointmentsByDay).toHaveLength(7);
    expect(adminDash.body.data.recent.appointments.length).toBeGreaterThan(0);

    const receptionDash = await request(app)
      .get('/api/dashboard/receptionist')
      .set('Authorization', `Bearer ${reception.token}`);
    expect(receptionDash.status).toBe(200);
    expect(receptionDash.body.data.stats.pendingPayments).toBe(110);

    const doctorDash = await request(app)
      .get('/api/dashboard/doctor')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(doctorDash.status).toBe(200);
    expect(doctorDash.body.data.stats.upcomingAppointments).toBeGreaterThan(0);
    expect(doctorDash.body.data.todaySchedule).toBeDefined();
  });

  test('enforces dashboard and report role boundaries', async () => {
    const { reception, doctor } = await seedReportingData();

    expect((await request(app).get('/api/dashboard/admin').set('Authorization', `Bearer ${reception.token}`)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/doctor').set('Authorization', `Bearer ${doctor.token}`)).status).toBe(200);
    expect((await request(app).get('/api/dashboard/doctor').set('Authorization', `Bearer ${reception.token}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/revenue').set('Authorization', `Bearer ${reception.token}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/appointments').set('Authorization', `Bearer ${doctor.token}`)).status).toBe(403);
  });

  test('generates appointment, revenue, patient and department reports for administrators', async () => {
    const { admin } = await seedReportingData();
    const today = toDateKey();

    const appointments = await request(app)
      .get(`/api/reports/appointments?dateFrom=${today}&dateTo=${today}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(appointments.status).toBe(200);
    expect(appointments.body.data.range.dateTo).toBe(today);
    expect(appointments.body.data.summary.totalAppointments).toBeGreaterThanOrEqual(0);
    expect(appointments.body.data.charts.byStatus).toBeDefined();

    const revenue = await request(app)
      .get(`/api/reports/revenue?dateFrom=${today}&dateTo=${today}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(revenue.status).toBe(200);
    expect(revenue.body.data.summary.totalBilled).toBe(210);
    expect(revenue.body.data.summary.totalCollected).toBe(100);
    expect(revenue.body.data.summary.outstanding).toBe(110);
    expect(revenue.body.data.charts.byMethod).toHaveLength(1);

    const patients = await request(app)
      .get(`/api/reports/patients?dateFrom=${today}&dateTo=${today}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(patients.status).toBe(200);
    expect(patients.body.data.summary.totalPatients).toBe(2);

    const departments = await request(app)
      .get(`/api/reports/departments?dateFrom=${today}&dateTo=${today}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(departments.status).toBe(200);
    expect(departments.body.data.summary.totalDepartments).toBe(1);
    expect(departments.body.data.rows[0].doctors).toBe(1);
  });

  test('lists audit logs for administrators only and never exposes secrets', async () => {
    const { admin, reception } = await seedReportingData();

    await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        firstName: 'Audit',
        lastName: 'Trail',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        phone: '+1-555-8899',
      });

    const denied = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${reception.token}`);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/audit-logs?limit=50')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.some((entry) => entry.action === 'PATIENT_CREATED')).toBe(true);
    expect(JSON.stringify(ok.body.data)).not.toMatch(/passwordHash|accessToken|hms_token/i);
  });

  test('keeps audit records immutable at the persistence layer', async () => {
    await AuditLog.create({
      action: 'TEST_ACTION',
      resourceType: 'Test',
      resourceId: 'test-1',
    });

    await expect(AuditLog.updateOne({ action: 'TEST_ACTION' }, { $set: { action: 'MUTATED' } })).rejects.toThrow(
      /immutable/i
    );
    await expect(AuditLog.deleteMany({ action: 'TEST_ACTION' })).rejects.toThrow(/immutable/i);
    expect(await AuditLog.countDocuments({ action: 'TEST_ACTION' })).toBe(1);
  });

  test('rejects NoSQL injection payloads and unknown routes include a request id', async () => {
    const injection = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: 'anything' });
    expect([401, 422]).toContain(injection.status);

    const missing = await request(app)
      .get('/api/does-not-exist')
      .set('x-request-id', 'test-request-id-123');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(missing.body.error.requestId).toBe('test-request-id-123');
    expect(missing.headers['x-request-id']).toBe('test-request-id-123');
  });
});

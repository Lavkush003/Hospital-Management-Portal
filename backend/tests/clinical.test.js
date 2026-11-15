const request = require('supertest');
const app = require('../src/app');
const Appointment = require('../src/models/Appointment');
const AuditLog = require('../src/models/AuditLog');
const Encounter = require('../src/models/Encounter');
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

const encounterPayload = (patient, appointmentId, overrides = {}) => ({
  patient: patient._id,
  appointment: appointmentId,
  chiefComplaint: 'Persistent chest discomfort',
  clinicalNotes: 'Vitals stable. ECG normal. Advised lifestyle changes.',
  vitalSigns: { temperatureC: 36.8, bloodPressure: '120/80', heartRate: 72, oxygenSaturation: 98 },
  treatmentNotes: 'Follow up in two weeks.',
  status: 'OPEN',
  ...overrides,
});

describe('Clinical records', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  async function setup() {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const admin = await createUser({ role: 'ADMIN' });
    const doctor = await createDoctor({ consultationFee: 150 });
    const otherDoctor = await createDoctor();
    const patient = await createPatient();
    const appointment = await createAppointment({
      patient,
      doctor: doctor.doctor,
      date: futureDateKey(1),
      startTime: '09:00',
      createdBy: reception.user._id,
    });
    return { reception, admin, doctor, otherDoctor, patient, appointment };
  }

  test('doctors create encounters, move the appointment to in-progress and write an audit log', async () => {
    const { doctor, patient, appointment } = await setup();

    const res = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));

    expect(res.status).toBe(201);
    expect(res.body.data.encounterId).toMatch(/^ENC-\d{5}$/);
    expect(res.body.data.patient.patientId).toBe(patient.patientId);
    expect(res.body.data.vitalSigns.bloodPressure).toBe('120/80');

    const updatedAppointment = await Appointment.findById(appointment._id);
    expect(updatedAppointment.status).toBe('IN_PROGRESS');

    const audit = await AuditLog.findOne({ action: 'ENCOUNTER_CREATED' });
    expect(audit).not.toBeNull();
    expect(audit.resourceId).toBe(res.body.data.encounterId);
  });

  test('prevents duplicate encounters for the same appointment', async () => {
    const { doctor, patient, appointment } = await setup();
    const first = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ENCOUNTER_EXISTS');
  });

  test('restricts encounter creation to the assigned doctor', async () => {
    const { doctor, otherDoctor, patient, appointment } = await setup();

    const unassignedDoctor = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${otherDoctor.token}`)
      .send(encounterPayload(patient, appointment._id));
    expect(unassignedDoctor.status).toBe(403);
    expect(unassignedDoctor.body.error.code).toBe('APPOINTMENT_NOT_ASSIGNED');

    const unrelatedPatient = await createPatient();
    const unassignedPatient = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ patient: unrelatedPatient._id, chiefComplaint: 'Headache' });
    expect(unassignedPatient.status).toBe(403);
    expect(unassignedPatient.body.error.code).toBe('PATIENT_NOT_ASSIGNED');

    const created = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, undefined));
    expect(created.status).toBe(201);
  });

  test('denies receptionists access to clinical modules but allows administrators to read', async () => {
    const { reception, admin, doctor, patient, appointment } = await setup();
    const encounterRes = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));
    const encounterId = encounterRes.body.data._id;

    const deniedList = await request(app)
      .get('/api/encounters')
      .set('Authorization', `Bearer ${reception.token}`);
    expect(deniedList.status).toBe(403);

    const deniedCreate = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${reception.token}`)
      .send(encounterPayload(patient, appointment._id));
    expect(deniedCreate.status).toBe(403);

    const adminView = await request(app)
      .get(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminView.status).toBe(200);
    expect(adminView.body.data.chiefComplaint).toBe('Persistent chest discomfort');
  });

  test('limits doctors to their own encounter reads', async () => {
    const { doctor, otherDoctor, patient, appointment } = await setup();
    const created = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));

    const forbidden = await request(app)
      .get(`/api/encounters/${created.body.data._id}`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('ENCOUNTER_NOT_ASSIGNED');
  });

  test('completes encounters, locks them afterwards and completes the appointment', async () => {
    const { doctor, patient, appointment } = await setup();
    const created = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));
    const encounterId = created.body.data._id;

    const completed = await request(app)
      .put(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'COMPLETED', clinicalNotes: 'Discharged with medication.' });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('COMPLETED');

    const appointmentDoc = await Appointment.findById(appointment._id);
    expect(appointmentDoc.status).toBe('COMPLETED');

    const locked = await request(app)
      .put(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ chiefComplaint: 'Changed after completion' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('ENCOUNTER_LOCKED');
  });

  test('creates prescriptions tied to an encounter and enforces ownership', async () => {
    const { doctor, otherDoctor, patient, appointment } = await setup();
    const encounter = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));

    const invalid = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ patient: patient._id, encounter: encounter.body.data._id, medicines: [] });
    expect(invalid.status).toBe(422);

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        patient: patient._id,
        encounter: encounter.body.data._id,
        medicines: [
          { name: 'Atorvastatin 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '30 days' },
        ],
        notes: 'Review lipid panel in 6 weeks.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.prescriptionId).toMatch(/^RX-\d{5}$/);
    expect(res.body.data.medicines).toHaveLength(1);

    const forbidden = await request(app)
      .get(`/api/prescriptions/${res.body.data._id}`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(forbidden.status).toBe(403);

    const list = await request(app)
      .get(`/api/prescriptions?patient=${patient._id}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  test('creates and updates diagnostic reports', async () => {
    const { reception, doctor, patient, appointment } = await setup();
    const encounter = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));

    const res = await request(app)
      .post('/api/diagnostic-reports')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        patient: patient._id,
        encounter: encounter.body.data._id,
        testName: 'Lipid Panel',
        testCategory: 'Laboratory',
        status: 'ORDERED',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.reportId).toMatch(/^DR-\d{5}$/);

    const updated = await request(app)
      .put(`/api/diagnostic-reports/${res.body.data._id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'COMPLETED', notes: 'LDL slightly elevated.' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('COMPLETED');

    const denied = await request(app)
      .post('/api/diagnostic-reports')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ patient: patient._id, testName: 'X-Ray', testCategory: 'Radiology' });
    expect(denied.status).toBe(403);
  });

  test('includes clinical records in the patient history for doctors and admins', async () => {
    const { admin, doctor, patient, appointment } = await setup();
    await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send(encounterPayload(patient, appointment._id));

    const doctorHistory = await request(app)
      .get(`/api/patients/${patient._id}/history`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(doctorHistory.status).toBe(200);
    expect(doctorHistory.body.data.encounters).toHaveLength(1);
    expect(await Encounter.countDocuments()).toBe(1);

    const adminHistory = await request(app)
      .get(`/api/patients/${patient._id}/history`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminHistory.status).toBe(200);
    expect(adminHistory.body.data.encounters).toHaveLength(1);
  });
});

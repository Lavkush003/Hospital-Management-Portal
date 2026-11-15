const request = require('supertest');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const Appointment = require('../src/models/Appointment');
const AppointmentSlotReservation = require('../src/models/AppointmentSlotReservation');
const Doctor = require('../src/models/Doctor');
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
const { toDateKey } = require('../src/utils/dates');

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

describe('Appointments and scheduling', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  async function setup() {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const doctor = await createDoctor({ consultationFee: 120 });
    const patient = await createPatient();
    return { reception, doctor, patient };
  }

  function book(token, doctor, patient, overrides = {}) {
    return request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patient: patient._id,
        doctor: doctor.doctor._id,
        date: futureDateKey(1),
        startTime: '10:00',
        appointmentType: 'CONSULTATION',
        reason: 'Routine check-up',
        ...overrides,
      });
  }

  test('books a valid future slot, snapshots the fee and reserves the slot', async () => {
    const { reception, doctor, patient } = await setup();
    const res = await book(reception.token, doctor, patient);

    expect(res.status).toBe(201);
    expect(res.body.data.appointmentNumber).toMatch(/^APT-\d{5}$/);
    expect(res.body.data.status).toBe('BOOKED');
    expect(res.body.data.consultationFee).toBe(120);
    expect(res.body.data.endTime).toBe('10:30');
    expect(res.body.data.patient.patientId).toBe(patient.patientId);

    expect(await AppointmentSlotReservation.countDocuments()).toBe(1);
    const audit = await AuditLog.findOne({ action: 'APPOINTMENT_BOOKED' });
    expect(audit).not.toBeNull();
  });

  test('rejects a second booking for the same doctor and slot', async () => {
    const { reception, doctor, patient } = await setup();
    const first = await book(reception.token, doctor, patient, { startTime: '09:00' });
    expect(first.status).toBe(201);

    const second = await book(reception.token, doctor, patient, { startTime: '09:00' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SLOT_TAKEN');
  });

  test('handles concurrent booking attempts for the same slot without duplicates', async () => {
    const { reception, doctor, patient } = await setup();
    const otherPatient = await createPatient();

    const [first, second] = await Promise.all([
      book(reception.token, doctor, patient, { startTime: '11:00' }),
      book(reception.token, doctor, otherPatient, { startTime: '11:00' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await Appointment.countDocuments({ startTime: '11:00' })).toBe(1);
    expect(await AppointmentSlotReservation.countDocuments({ startTime: '11:00' })).toBe(1);
  });

  test('validates slot alignment, working hours, past dates and inactive records', async () => {
    const { reception, doctor, patient } = await setup();

    const misaligned = await book(reception.token, doctor, patient, { startTime: '09:15' });
    expect(misaligned.status).toBe(400);
    expect(misaligned.body.error.code).toBe('SLOT_MISALIGNED');

    const outside = await book(reception.token, doctor, patient, { startTime: '18:00' });
    expect(outside.status).toBe(400);
    expect(outside.body.error.code).toBe('OUTSIDE_WORKING_HOURS');

    const past = await book(reception.token, doctor, patient, { date: yesterdayKey(), startTime: '10:00' });
    expect(past.status).toBe(400);
    expect(past.body.error.code).toBe('APPOINTMENT_IN_PAST');

    await Doctor.updateOne({ _id: doctor.doctor._id }, { status: 'ON_LEAVE' });
    const inactiveDoctor = await book(reception.token, doctor, patient, { startTime: '12:00' });
    expect(inactiveDoctor.status).toBe(400);
    expect(inactiveDoctor.body.error.code).toBe('DOCTOR_INACTIVE');

    await Doctor.updateOne({ _id: doctor.doctor._id }, { status: 'ACTIVE' });
    const inactivePatient = await createPatient({ status: 'INACTIVE' });
    const inactive = await book(reception.token, doctor, inactivePatient, { startTime: '12:00' });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe('PATIENT_INACTIVE');

    const unknownDoctor = await book(reception.token, doctor, patient, {
      doctor: '64b000000000000000000000',
      startTime: '13:00',
    });
    expect(unknownDoctor.status).toBe(400);
    expect(unknownDoctor.body.error.code).toBe('INVALID_DOCTOR');
  });

  test('cancelling an appointment releases the slot for rebooking', async () => {
    const { reception, doctor, patient } = await setup();
    const created = await book(reception.token, doctor, patient, { startTime: '14:00' });
    expect(created.status).toBe(201);

    const cancelled = await request(app)
      .patch(`/api/appointments/${created.body.data._id}/cancel`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ reason: 'Patient rescheduled' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.cancellationReason).toBe('Patient rescheduled');
    expect(await AppointmentSlotReservation.countDocuments()).toBe(0);

    const rebooked = await book(reception.token, doctor, patient, { startTime: '14:00' });
    expect(rebooked.status).toBe(201);
  });

  test('reschedules to a new slot, removes the old reservation and blocks the new one', async () => {
    const { reception, doctor, patient } = await setup();
    const created = await book(reception.token, doctor, patient, { startTime: '10:00' });

    const moved = await request(app)
      .patch(`/api/appointments/${created.body.data._id}/reschedule`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ date: futureDateKey(2), startTime: '11:00', reason: 'Doctor requested change' });
    expect(moved.status).toBe(200);
    expect(moved.body.data.date).toBe(futureDateKey(2));
    expect(moved.body.data.startTime).toBe('11:00');
    expect(moved.body.data.endTime).toBe('11:30');

    const oldSlot = await book(reception.token, doctor, patient, { startTime: '10:00' });
    expect(oldSlot.status).toBe(201);

    const newSlot = await book(reception.token, doctor, patient, {
      date: futureDateKey(2),
      startTime: '11:00',
    });
    expect(newSlot.status).toBe(409);
    expect(newSlot.body.error.code).toBe('SLOT_TAKEN');
  });

  test('enforces clinical status transitions and clinician-only progression', async () => {
    const { reception, doctor, patient } = await setup();
    const created = await book(reception.token, doctor, patient, { startTime: '15:00' });
    const id = created.body.data._id;

    const invalid = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ status: 'COMPLETED' });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const checkedIn = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ status: 'CHECKED_IN' });
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.data.status).toBe('CHECKED_IN');

    const receptionForbidden = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(receptionForbidden.status).toBe(403);
    expect(receptionForbidden.body.error.code).toBe('ROLE_FORBIDDEN');

    const inProgress = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(inProgress.status).toBe(200);

    const completed = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('COMPLETED');
  });

  test('scopes appointment reads and writes to the assigned doctor', async () => {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const doctorA = await createDoctor();
    const doctorB = await createDoctor();
    const patient = await createPatient();
    const appointmentA = await createAppointment({
      patient,
      doctor: doctorA.doctor,
      date: futureDateKey(3),
      startTime: '09:00',
      createdBy: reception.user._id,
    });
    await createAppointment({
      patient,
      doctor: doctorB.doctor,
      date: futureDateKey(3),
      startTime: '09:30',
      createdBy: reception.user._id,
    });

    const forbidden = await request(app)
      .get(`/api/appointments/${appointmentA._id}`)
      .set('Authorization', `Bearer ${doctorB.token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('APPOINTMENT_NOT_ASSIGNED');

    const list = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${doctorB.token}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(String(list.body.data[0].doctor._id)).toBe(String(doctorB.doctor._id));

    const cannotBook = await book(doctorB.token, doctorB, patient, { startTime: '10:00' });
    expect(cannotBook.status).toBe(403);
  });

  test('lists appointments by date and status with populated participants', async () => {
    const reception = await createUser({ role: 'RECEPTIONIST' });
    const doctor = await createDoctor();
    const patient = await createPatient();
    await createAppointment({
      patient,
      doctor: doctor.doctor,
      date: futureDateKey(4),
      startTime: '09:00',
      status: 'CONFIRMED',
      createdBy: reception.user._id,
    });
    await createAppointment({
      patient,
      doctor: doctor.doctor,
      date: futureDateKey(4),
      startTime: '09:30',
      status: 'BOOKED',
      createdBy: reception.user._id,
    });

    const res = await request(app)
      .get(`/api/appointments?date=${futureDateKey(4)}&status=CONFIRMED`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('CONFIRMED');
    expect(res.body.data[0].patient.firstName).toBe(patient.firstName);
    expect(res.body.data[0].doctor.firstName).toBe(doctor.doctor.firstName);
  });

  test('returns 404 for a missing appointment', async () => {
    const { reception } = await setup();
    const res = await request(app)
      .get('/api/appointments/64b000000000000000000000')
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });
});

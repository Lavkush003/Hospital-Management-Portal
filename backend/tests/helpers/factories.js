const { randomUUID } = require('crypto');
const User = require('../../src/models/User');
const Patient = require('../../src/models/Patient');
const Doctor = require('../../src/models/Doctor');
const Department = require('../../src/models/Department');
const DoctorSchedule = require('../../src/models/DoctorSchedule');
const Appointment = require('../../src/models/Appointment');
const AppointmentSlotReservation = require('../../src/models/AppointmentSlotReservation');
const Invoice = require('../../src/models/Invoice');
const Payment = require('../../src/models/Payment');
const { nextId } = require('../../src/utils/ids');
const { addMinutes, toDateKey } = require('../../src/utils/dates');
const authService = require('../../src/services/auth.service');

const DEFAULT_PASSWORD = 'Password123!';

function uniqueSuffix() {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

async function createUser(overrides = {}) {
  const suffix = overrides.suffix || uniqueSuffix();
  const password = overrides.password || DEFAULT_PASSWORD;
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || `User${suffix}`,
    email: overrides.email || `${overrides.role?.toLowerCase() || 'user'}-${suffix}@test.local`,
    passwordHash,
    role: overrides.role || 'ADMIN',
    status: overrides.status || 'ACTIVE',
    phone: overrides.phone || '+1-555-0000',
  });
  return { user, password, token: authService.signToken(user) };
}

async function createDepartment(overrides = {}) {
  const suffix = overrides.suffix || uniqueSuffix();
  return Department.create({
    name: overrides.name || `Department ${suffix}`,
    code: overrides.code || `D${suffix.slice(0, 5)}`.toUpperCase(),
    description: overrides.description || 'Test department',
  });
}

async function createDoctor(options = {}) {
  const suffix = options.suffix || uniqueSuffix();
  const department = options.department || (await createDepartment({ suffix }));
  const account = await createUser({
    role: 'DOCTOR',
    firstName: options.firstName || 'Doctor',
    lastName: options.lastName || `Who${suffix}`,
    email: options.email || `doctor-${suffix}@test.local`,
    password: options.password,
    suffix,
  });
  const workingDays = options.workingDays || [0, 1, 2, 3, 4, 5, 6];
  const startTime = options.startTime || '09:00';
  const endTime = options.endTime || '17:00';
  const slotDuration = options.slotDuration || 30;
  const doctor = await Doctor.create({
    doctorId: await nextId('doctor', 'DOC'),
    userId: account.user._id,
    department: department._id,
    firstName: account.user.firstName,
    lastName: account.user.lastName,
    email: account.user.email,
    phone: account.user.phone,
    specialization: options.specialization || 'General Medicine',
    qualification: options.qualification || 'MD',
    experienceYears: options.experienceYears || 5,
    consultationFee: options.consultationFee ?? 100,
    workingDays,
    workingHours: { start: startTime, end: endTime },
    appointmentDuration: slotDuration,
  });
  for (const day of workingDays) {
    await DoctorSchedule.create({
      doctor: doctor._id,
      dayOfWeek: day,
      startTime,
      endTime,
      slotDuration,
    });
  }
  return { ...account, doctor, department };
}

async function createPatient(overrides = {}) {
  const suffix = overrides.suffix || uniqueSuffix();
  const patient = await Patient.create({
    patientId: await nextId('patient', 'PAT'),
    firstName: overrides.firstName || 'Patient',
    lastName: overrides.lastName || `Person${suffix}`,
    dateOfBirth: overrides.dateOfBirth || new Date(1990, 4, 15),
    gender: overrides.gender || 'FEMALE',
    phone: overrides.phone || `+1-555-${Math.floor(1000 + Math.random() * 8999)}`,
    email: overrides.email || `patient-${suffix}@test.local`,
    bloodGroup: overrides.bloodGroup || 'O_POSITIVE',
    status: overrides.status || 'ACTIVE',
  });
  return patient;
}

function futureDateKey(daysAhead = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toDateKey(date);
}

function uniqueStartTime(offsetMinutes = 0) {
  const base = 9 * 60 + offsetMinutes;
  return `${String(Math.floor(base / 60)).padStart(2, '0')}:${String(base % 60).padStart(2, '0')}`;
}

async function createAppointment(options) {
  const { patient, doctor, date, startTime, status = 'BOOKED' } = options;
  const duration = options.duration || 30;
  const appointment = await Appointment.create({
    appointmentNumber: await nextId('appointment', 'APT'),
    patient: patient._id,
    doctor: doctor._id,
    department: doctor.department,
    date,
    startTime,
    endTime: addMinutes(startTime, duration),
    appointmentType: options.appointmentType || 'CONSULTATION',
    consultationFee: doctor.consultationFee,
    status,
    reason: options.reason || 'Test appointment',
    createdBy: options.createdBy,
  });
  if (status !== 'CANCELLED') {
    await AppointmentSlotReservation.create({
      doctor: doctor._id,
      date,
      startTime,
      endTime: addMinutes(startTime, duration),
      appointment: appointment._id,
    });
  }
  return appointment;
}

async function createInvoiceFor(patient, options = {}) {
  const invoice = await Invoice.create({
    invoiceNumber: await nextId('invoice', 'INV'),
    patient: patient._id,
    invoiceDate: options.invoiceDate || new Date(),
    lineItems: options.lineItems || [
      { description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200, amount: 200 },
    ],
    subtotal: options.subtotal ?? 200,
    taxRate: options.taxRate ?? 0,
    tax: options.tax ?? 0,
    discount: options.discount ?? 0,
    totalAmount: options.totalAmount ?? 200,
    amountPaid: options.amountPaid ?? 0,
    balanceDue: options.balanceDue ?? 200,
    status: options.status || 'UNPAID',
    createdBy: options.createdBy,
  });
  return invoice;
}

async function addPayment(invoice, amount, options = {}) {
  return Payment.create({
    paymentNumber: await nextId('payment', 'PAY'),
    invoice: invoice._id,
    amount,
    method: options.method || 'CASH',
    status: options.status || 'SUCCESS',
    transactionRef: options.transactionRef || `TEST-${randomUUID()}`,
    receivedBy: options.receivedBy,
    paidAt: options.paidAt || new Date(),
    simulated: true,
  });
}

module.exports = {
  DEFAULT_PASSWORD,
  uniqueSuffix,
  createUser,
  createDepartment,
  createDoctor,
  createPatient,
  createAppointment,
  createInvoiceFor,
  addPayment,
  futureDateKey,
  uniqueStartTime,
};

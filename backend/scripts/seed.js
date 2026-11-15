const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { nextId, nextSequence } = require('../src/utils/ids');
const { calculateInvoice, roundMoney } = require('../src/utils/money');
const { toDateKey, addMinutes } = require('../src/utils/dates');

const User = require('../src/models/User');
const Patient = require('../src/models/Patient');
const Doctor = require('../src/models/Doctor');
const Staff = require('../src/models/Staff');
const Department = require('../src/models/Department');
const DoctorSchedule = require('../src/models/DoctorSchedule');
const Appointment = require('../src/models/Appointment');
const AppointmentSlotReservation = require('../src/models/AppointmentSlotReservation');
const Encounter = require('../src/models/Encounter');
const Prescription = require('../src/models/Prescription');
const DiagnosticReport = require('../src/models/DiagnosticReport');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');
const Counter = require('../src/models/Counter');

const MODELS = [
  AuditLog,
  Payment,
  Invoice,
  DiagnosticReport,
  Prescription,
  Encounter,
  AppointmentSlotReservation,
  Appointment,
  DoctorSchedule,
  Staff,
  Doctor,
  Patient,
  Department,
  Counter,
  User,
];

const DEPARTMENTS = [
  { name: 'Cardiology', code: 'CARD', description: 'Heart and cardiovascular care', location: 'Block A, Floor 2', phone: '+1-555-0101' },
  { name: 'General Medicine', code: 'GEN', description: 'Primary and internal medicine', location: 'Block A, Floor 1', phone: '+1-555-0102' },
  { name: 'Pediatrics', code: 'PED', description: 'Healthcare for infants, children and adolescents', location: 'Block B, Floor 1', phone: '+1-555-0103' },
  { name: 'Orthopedics', code: 'ORTH', description: 'Bones, joints and musculoskeletal care', location: 'Block C, Floor 3', phone: '+1-555-0104' },
  { name: 'Dermatology', code: 'DERM', description: 'Skin, hair and nail conditions', location: 'Block B, Floor 2', phone: '+1-555-0105' },
];

const DOCTORS = [
  { firstName: 'Evelyn', lastName: 'Chen', email: 'doctor@hospital.demo', dept: 'CARD', specialization: 'Interventional Cardiology', qualification: 'MD, DM Cardiology', experienceYears: 12, consultationFee: 150, phone: '+1-555-1001', days: [1, 2, 3, 4, 5] },
  { firstName: 'Arjun', lastName: 'Patel', email: 'arjun.patel@hospital.demo', dept: 'PED', specialization: 'Pediatric Medicine', qualification: 'MD Pediatrics', experienceYears: 9, consultationFee: 100, phone: '+1-555-1002', days: [1, 2, 3, 4, 5] },
  { firstName: 'Sofia', lastName: 'Garcia', email: 'sofia.garcia@hospital.demo', dept: 'GEN', specialization: 'Internal Medicine', qualification: 'MD Internal Medicine', experienceYears: 15, consultationFee: 80, phone: '+1-555-1003', days: [1, 2, 3, 4, 5] },
  { firstName: 'Marcus', lastName: 'Johnson', email: 'marcus.johnson@hospital.demo', dept: 'ORTH', specialization: 'Joint Replacement Surgery', qualification: 'MS Orthopedics', experienceYears: 11, consultationFee: 180, phone: '+1-555-1004', days: [1, 3, 5] },
  { firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@hospital.demo', dept: 'DERM', specialization: 'Clinical Dermatology', qualification: 'MD Dermatology', experienceYears: 7, consultationFee: 120, phone: '+1-555-1005', days: [2, 3, 4] },
  { firstName: 'Liam', lastName: "O'Brien", email: 'liam.obrien@hospital.demo', dept: 'CARD', specialization: 'Electrophysiology', qualification: 'MD Cardiology', experienceYears: 8, consultationFee: 160, phone: '+1-555-1006', days: [1, 2, 4, 5] },
  { firstName: 'Hannah', lastName: 'Kim', email: 'hannah.kim@hospital.demo', dept: 'GEN', specialization: 'Family Medicine', qualification: 'MD Family Medicine', experienceYears: 6, consultationFee: 90, phone: '+1-555-1007', days: [1, 2, 3, 4, 5] },
  { firstName: 'David', lastName: 'Mensah', email: 'david.mensah@hospital.demo', dept: 'PED', specialization: 'Pediatric Pulmonology', qualification: 'MD Pediatrics', experienceYears: 10, consultationFee: 110, phone: '+1-555-1008', days: [1, 3, 4, 5] },
  { firstName: 'Isabella', lastName: 'Rossi', email: 'isabella.rossi@hospital.demo', dept: 'ORTH', specialization: 'Sports Medicine', qualification: 'MS Orthopedics', experienceYears: 13, consultationFee: 200, phone: '+1-555-1009', days: [2, 3, 5] },
  { firstName: 'Noah', lastName: 'Williams', email: 'noah.williams@hospital.demo', dept: 'DERM', specialization: 'Cosmetic Dermatology', qualification: 'MD Dermatology', experienceYears: 5, consultationFee: 130, phone: '+1-555-1010', days: [1, 2, 4, 5] },
];

const STAFF = [
  { firstName: 'Rachel', lastName: 'Moore', email: 'reception@hospital.demo', role: 'RECEPTIONIST', title: 'Front Desk Supervisor', dept: 'GEN', phone: '+1-555-2001' },
  { firstName: 'Olivia', lastName: 'Brown', email: 'billing@hospital.demo', role: 'RECEPTIONIST', title: 'Billing Officer', dept: 'GEN', phone: '+1-555-2002' },
  { firstName: 'Ethan', lastName: 'Clark', email: 'records@hospital.demo', role: 'RECEPTIONIST', title: 'Medical Records Clerk', dept: 'CARD', phone: '+1-555-2003' },
  { firstName: 'Ava', lastName: 'Lewis', email: 'ava.lewis@hospital.demo', role: 'RECEPTIONIST', title: 'Patient Coordinator', dept: 'PED', phone: '+1-555-2004' },
  { firstName: 'Mason', lastName: 'Walker', email: 'mason.walker@hospital.demo', role: 'RECEPTIONIST', title: 'Front Desk Officer', dept: 'ORTH', phone: '+1-555-2005' },
  { firstName: 'Emma', lastName: 'Hall', email: 'emma.hall@hospital.demo', role: 'RECEPTIONIST', title: 'Front Desk Officer', dept: 'DERM', phone: '+1-555-2006' },
  { firstName: 'Lucas', lastName: 'Young', email: 'lucas.young@hospital.demo', role: 'RECEPTIONIST', title: 'Insurance Coordinator', dept: 'CARD', phone: '+1-555-2007' },
  { firstName: 'Mia', lastName: 'King', email: 'mia.king@hospital.demo', role: 'RECEPTIONIST', title: 'Patient Services Officer', dept: 'GEN', phone: '+1-555-2008' },
  { firstName: 'James', lastName: 'Wright', email: 'james.wright@hospital.demo', role: 'ADMIN', title: 'Operations Administrator', dept: null, phone: '+1-555-2009' },
  { firstName: 'Amelia', lastName: 'Scott', email: 'amelia.scott@hospital.demo', role: 'RECEPTIONIST', title: 'Front Desk Officer', dept: 'PED', phone: '+1-555-2010' },
];

const PATIENTS = [
  ['Aarav', 'Sharma', 'MALE', 1985, 3, 12, 'O_POSITIVE', '+1-555-3001'],
  ['Beatriz', 'Almeida', 'FEMALE', 1992, 7, 22, 'A_POSITIVE', '+1-555-3002'],
  ['Carlos', 'Mendoza', 'MALE', 1978, 11, 5, 'B_POSITIVE', '+1-555-3003'],
  ['Diana', 'Petrova', 'FEMALE', 1990, 1, 30, 'AB_POSITIVE', '+1-555-3004'],
  ['Ethan', 'Nguyen', 'MALE', 2001, 6, 17, 'O_NEGATIVE', '+1-555-3005'],
  ['Fatima', 'Hassan', 'FEMALE', 1983, 9, 9, 'A_NEGATIVE', '+1-555-3006'],
  ['Gabriel', 'Silva', 'MALE', 1969, 4, 25, 'B_NEGATIVE', '+1-555-3007'],
  ['Hana', 'Sato', 'FEMALE', 1995, 12, 2, 'AB_NEGATIVE', '+1-555-3008'],
  ['Ibrahim', 'Khan', 'MALE', 1987, 8, 14, 'O_POSITIVE', '+1-555-3009'],
  ['Julia', 'Kowalski', 'FEMALE', 1975, 2, 19, 'A_POSITIVE', '+1-555-3010'],
  ['Kofi', 'Mensah', 'MALE', 1998, 5, 8, 'B_POSITIVE', '+1-555-3011'],
  ['Laura', 'Fernandez', 'FEMALE', 1981, 10, 11, 'O_POSITIVE', '+1-555-3012'],
  ['Mateo', 'Ramirez', 'MALE', 2004, 3, 28, 'A_POSITIVE', '+1-555-3013'],
  ['Nadia', 'Ivanova', 'FEMALE', 1993, 7, 7, 'B_NEGATIVE', '+1-555-3014'],
  ['Omar', 'Farouk', 'MALE', 1972, 1, 16, 'AB_POSITIVE', '+1-555-3015'],
  ['Priya', 'Kapoor', 'FEMALE', 1989, 6, 23, 'O_NEGATIVE', '+1-555-3016'],
  ['Quentin', 'Dubois', 'MALE', 1965, 11, 1, 'A_POSITIVE', '+1-555-3017'],
  ['Rosa', 'Martinez', 'FEMALE', 1997, 4, 13, 'B_POSITIVE', '+1-555-3018'],
  ['Samuel', 'Okoro', 'MALE', 1982, 9, 27, 'O_POSITIVE', '+1-555-3019'],
  ['Tina', 'Wong', 'FEMALE', 1991, 12, 6, 'AB_NEGATIVE', '+1-555-3020'],
  ['Umar', 'Abdullah', 'MALE', 1979, 2, 21, 'A_NEGATIVE', '+1-555-3021'],
  ['Valentina', 'Russo', 'FEMALE', 1986, 8, 3, 'B_POSITIVE', '+1-555-3022'],
  ['William', 'Turner', 'MALE', 2000, 5, 18, 'O_POSITIVE', '+1-555-3023'],
  ['Ximena', 'Lopez', 'FEMALE', 1994, 10, 29, 'A_POSITIVE', '+1-555-3024'],
  ['Yusuf', 'Demir', 'MALE', 1970, 3, 15, 'AB_POSITIVE', '+1-555-3025'],
  ['Zara', 'Ahmed', 'FEMALE', 1988, 7, 24, 'O_NEGATIVE', '+1-555-3026'],
  ['Andres', 'Costa', 'MALE', 1984, 1, 12, 'B_NEGATIVE', '+1-555-3027'],
  ['Bianca', 'Moretti', 'FEMALE', 1999, 6, 30, 'A_POSITIVE', '+1-555-3028'],
  ['Caleb', 'Bennett', 'MALE', 1977, 11, 4, 'O_POSITIVE', '+1-555-3029'],
  ['Deepa', 'Iyer', 'FEMALE', 1992, 4, 26, 'B_POSITIVE', '+1-555-3030'],
];

function dateOffset(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function previousWeekday(offset, minWorkingDays = [1, 2, 3, 4, 5]) {
  let cursor = offset;
  for (let i = 0; i < 14; i += 1) {
    const date = dateOffset(cursor);
    if (minWorkingDays.includes(date.getDay())) return date;
    cursor -= 1;
  }
  return dateOffset(offset);
}

function weekdayKey(offset) {
  return toDateKey(previousWeekday(offset));
}

async function clearDatabase() {
  for (const model of MODELS) {
    await model.collection.deleteMany({});
  }
}

async function seed() {
  if (env.isProduction && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=true to override.');
  }

  await connectDatabase();
  console.log('[seed] clearing collections...');
  await clearDatabase();

  const passwordHash = await User.hashPassword(env.seedPassword);
  console.log('[seed] creating demo system accounts...');
  await User.create({
    firstName: 'Grace',
    lastName: 'Morgan',
    email: 'admin@hospital.demo',
    passwordHash,
    role: 'ADMIN',
    phone: '+1-555-9001',
  });

  const departmentMap = {};
  for (const item of DEPARTMENTS) {
    const department = await Department.create(item);
    departmentMap[item.code] = department;
  }
  console.log(`[seed] departments: ${DEPARTMENTS.length}`);

  const doctorDocs = [];
  for (const item of DOCTORS) {
    const user = await User.create({
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      passwordHash,
      role: 'DOCTOR',
      phone: item.phone,
    });
    const doctorId = await nextId('doctor', 'DOC');
    const doctor = await Doctor.create({
      doctorId,
      userId: user._id,
      department: departmentMap[item.dept]._id,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,
      specialization: item.specialization,
      qualification: item.qualification,
      experienceYears: item.experienceYears,
      consultationFee: item.consultationFee,
      workingDays: item.days,
      workingHours: { start: '09:00', end: '17:00' },
      appointmentDuration: 30,
      bio: `${item.specialization} specialist with ${item.experienceYears} years of experience.`,
    });
    for (const day of item.days) {
      await DoctorSchedule.create({
        doctor: doctor._id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
        room: `${item.dept}-${Math.floor(Math.random() * 12) + 1}`,
      });
    }
    doctorDocs.push(doctor);
  }
  console.log(`[seed] doctors + schedules: ${doctorDocs.length}`);

  const departmentHeads = {
    CARD: doctorDocs[0],
    PED: doctorDocs[1],
    GEN: doctorDocs[2],
    ORTH: doctorDocs[3],
    DERM: doctorDocs[4],
  };
  for (const [code, doctor] of Object.entries(departmentHeads)) {
    await Department.updateOne({ _id: departmentMap[code]._id }, { $set: { head: doctor._id } });
  }

  for (const item of STAFF) {
    const user = await User.create({
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      passwordHash,
      role: item.role,
      phone: item.phone,
    });
    const employeeId = await nextId('staff', 'EMP');
    await Staff.create({
      employeeId,
      userId: user._id,
      department: item.dept ? departmentMap[item.dept]._id : undefined,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,
      role: item.role,
      jobTitle: item.title,
      joiningDate: new Date(2023, 0 + (employeeId.charCodeAt(6) % 12), 5),
    });
  }
  console.log(`[seed] staff accounts: ${STAFF.length}`);

  const patientDocs = [];
  for (let index = 0; index < PATIENTS.length; index += 1) {
    const [firstName, lastName, gender, year, month, day, bloodGroup, phone] = PATIENTS[index];
    const patientId = await nextId('patient', 'PAT');
    const patient = await Patient.create({
      patientId,
      firstName,
      lastName,
      dateOfBirth: new Date(year, month - 1, day),
      gender,
      phone,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.test`,
      address: {
        line1: `${100 + index} Wellness Avenue`,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
      },
      emergencyContact: {
        name: `${lastName} Family`,
        phone: `+1-555-4${String(100 + index).padStart(3, '0')}`,
        relationship: 'Family',
      },
      bloodGroup,
      registrationDate: dateOffset(-90 + index * 2),
    });
    patientDocs.push(patient);
  }
  console.log(`[seed] patients: ${patientDocs.length}`);

  const doctorUser = await User.findOne({ email: 'doctor@hospital.demo' });
  const adminUser = await User.findOne({ email: 'admin@hospital.demo' });
  const receptionUser = await User.findOne({ email: 'reception@hospital.demo' });

  const appointmentPlans = [
    { day: -7, status: 'COMPLETED', patient: 0, doctor: 0, type: 'CONSULTATION', reason: 'Chest tightness during exercise' },
    { day: -6, status: 'COMPLETED', patient: 1, doctor: 2, type: 'FOLLOW_UP', reason: 'Persistent cough review' },
    { day: -5, status: 'COMPLETED', patient: 2, doctor: 3, type: 'CONSULTATION', reason: 'Knee pain after fall' },
    { day: -4, status: 'COMPLETED', patient: 3, doctor: 4, type: 'CONSULTATION', reason: 'Recurring skin rash' },
    { day: -3, status: 'COMPLETED', patient: 4, doctor: 1, type: 'FOLLOW_UP', reason: 'Childhood asthma follow-up' },
    { day: -2, status: 'COMPLETED', patient: 5, doctor: 6, type: 'CONSULTATION', reason: 'Annual wellness check' },
    { day: -1, status: 'CANCELLED', patient: 6, doctor: 7, type: 'CONSULTATION', reason: 'Patient rescheduled travel' },
    { day: -1, status: 'NO_SHOW', patient: 7, doctor: 8, type: 'CONSULTATION', reason: 'Missed appointment' },
    { day: 0, status: 'CHECKED_IN', patient: 8, doctor: 0, type: 'CONSULTATION', reason: 'Blood pressure review' },
    { day: 0, status: 'CONFIRMED', patient: 9, doctor: 2, type: 'FOLLOW_UP', reason: 'Diabetes medication review' },
    { day: 0, status: 'BOOKED', patient: 10, doctor: 1, type: 'CONSULTATION', reason: 'Child fever and cough' },
    { day: 1, status: 'BOOKED', patient: 11, doctor: 0, type: 'FOLLOW_UP', reason: 'Post-procedure review' },
    { day: 1, status: 'CONFIRMED', patient: 12, doctor: 4, type: 'CONSULTATION', reason: 'Acne treatment consultation' },
    { day: 2, status: 'BOOKED', patient: 13, doctor: 3, type: 'CONSULTATION', reason: 'Lower back pain' },
    { day: 3, status: 'BOOKED', patient: 14, doctor: 5, type: 'CONSULTATION', reason: 'Heart rhythm irregularity' },
    { day: 3, status: 'CONFIRMED', patient: 15, doctor: 6, type: 'FOLLOW_UP', reason: 'Thyroid test review' },
    { day: 4, status: 'BOOKED', patient: 16, doctor: 8, type: 'CONSULTATION', reason: 'Sports injury assessment' },
    { day: 5, status: 'BOOKED', patient: 17, doctor: 7, type: 'CONSULTATION', reason: 'Recurring wheezing' },
    { day: 6, status: 'BOOKED', patient: 18, doctor: 9, type: 'CONSULTATION', reason: 'Skin pigmentation review' },
    { day: 7, status: 'BOOKED', patient: 19, doctor: 1, type: 'FOLLOW_UP', reason: 'Vaccination schedule review' },
  ];

  const slotCursor = new Map();
  const appointmentDocs = [];

  for (const plan of appointmentPlans) {
    const doctor = doctorDocs[plan.doctor];
    const date = weekdayKey(plan.day);
    if (!doctor.workingDays.includes(new Date(`${date}T00:00:00`).getDay())) {
      const fallback = doctorDocs.find((doc) => doc.workingDays.includes(new Date(`${date}T00:00:00`).getDay()));
      if (fallback) {
        const fallbackIndex = doctorDocs.findIndex((doc) => String(doc._id) === String(fallback._id));
        plan.doctor = fallbackIndex;
      }
    }
    const assignedDoctor = doctorDocs[plan.doctor];
    const key = `${assignedDoctor._id}-${date}`;
    const slotIndex = slotCursor.get(key) || 0;
    slotCursor.set(key, slotIndex + 1);
    const startMinutes = 9 * 60 + slotIndex * 30;
    const startTime = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
    const endTime = addMinutes(startTime, 30);

    const appointmentNumber = await nextId('appointment', 'APT');
    const appointment = await Appointment.create({
      appointmentNumber,
      patient: patientDocs[plan.patient]._id,
      doctor: assignedDoctor._id,
      department: assignedDoctor.department,
      date,
      startTime,
      endTime,
      appointmentType: plan.type,
      consultationFee: assignedDoctor.consultationFee,
      status: plan.status,
      reason: plan.reason,
      createdBy: receptionUser._id,
      ...(plan.status === 'CANCELLED'
        ? { cancelledAt: new Date(), cancelledBy: receptionUser._id, cancellationReason: 'Cancelled by patient' }
        : {}),
    });
    appointmentDocs.push({ appointment, plan, doctor: assignedDoctor, patient: patientDocs[plan.patient] });

    if (plan.status !== 'CANCELLED') {
      await AppointmentSlotReservation.create({
        doctor: assignedDoctor._id,
        date,
        startTime,
        endTime,
        appointment: appointment._id,
      });
    }
  }
  console.log(`[seed] appointments: ${appointmentDocs.length}`);

  let encounterCount = 0;
  let prescriptionCount = 0;
  let reportCount = 0;
  let invoiceCount = 0;
  let paymentCount = 0;

  for (const { appointment, plan, doctor, patient } of appointmentDocs) {
    if (plan.status !== 'COMPLETED') continue;
    const encounterId = await nextId('encounter', 'ENC');
    const encounter = await Encounter.create({
      encounterId,
      patient: patient._id,
      doctor: doctor._id,
      appointment: appointment._id,
      encounterDate: new Date(`${appointment.date}T${appointment.startTime}:00`),
      visitType: plan.type,
      chiefComplaint: plan.reason,
      clinicalNotes: `Patient presented with ${plan.reason.toLowerCase()}. Examination completed, vitals stable. Discussed treatment plan and follow-up care.`,
      vitalSigns: {
        temperatureC: 36.6 + Math.random() * 1.2,
        bloodPressure: `${110 + Math.round(Math.random() * 20)}/${70 + Math.round(Math.random() * 15)}`,
        heartRate: 64 + Math.round(Math.random() * 24),
        weightKg: 55 + Math.round(Math.random() * 35),
        heightCm: 155 + Math.round(Math.random() * 30),
        oxygenSaturation: 96 + Math.round(Math.random() * 3),
      },
      treatmentNotes: 'Conservative management advised. Patient education provided.',
      status: 'COMPLETED',
      createdBy: doctorUser._id,
    });
    encounterCount += 1;

    if (encounterCount % 2 === 1) {
      const prescriptionId = await nextId('prescription', 'RX');
      await Prescription.create({
        prescriptionId,
        patient: patient._id,
        doctor: doctor._id,
        encounter: encounter._id,
        prescriptionDate: encounter.encounterDate,
        medicines: [
          { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '5 days', instructions: 'Take after meals' },
          { name: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '7 days', instructions: 'May cause drowsiness' },
        ],
        notes: 'Return if symptoms worsen or persist beyond one week.',
        createdBy: doctorUser._id,
      });
      prescriptionCount += 1;
    }

    if (encounterCount % 3 === 0) {
      const reportId = await nextId('report', 'DR');
      await DiagnosticReport.create({
        reportId,
        patient: patient._id,
        doctor: doctor._id,
        encounter: encounter._id,
        testName: 'Complete Blood Count',
        testCategory: 'Laboratory',
        reportDate: encounter.encounterDate,
        status: 'COMPLETED',
        notes: 'All values within reference range. Synthetic demo metadata only.',
        createdBy: doctorUser._id,
      });
      reportCount += 1;
    }

    const totals = calculateInvoice({
      lineItems: [
        { description: 'Consultation fee', category: 'CONSULTATION', quantity: 1, unitPrice: appointment.consultationFee },
        ...(encounterCount % 3 === 0 ? [{ description: 'Complete Blood Count', category: 'DIAGNOSTIC', quantity: 1, unitPrice: 60 }] : []),
      ],
      taxRate: 5,
      discount: encounterCount % 4 === 0 ? 10 : 0,
    });
    const invoiceNumber = await nextId('invoice', 'INV');
    const isPaid = encounterCount % 4 !== 0;
    const paidAmount = isPaid ? totals.totalAmount : roundMoney(totals.totalAmount / 2);
    const invoice = await Invoice.create({
      invoiceNumber,
      patient: patient._id,
      appointment: appointment._id,
      encounter: encounter._id,
      invoiceDate: encounter.encounterDate,
      dueDate: new Date(new Date(encounter.encounterDate).getTime() + 14 * 24 * 60 * 60 * 1000),
      lineItems: totals.lineItems,
      subtotal: totals.subtotal,
      taxRate: totals.taxRate,
      tax: totals.tax,
      discount: totals.discount,
      totalAmount: totals.totalAmount,
      amountPaid: paidAmount,
      balanceDue: roundMoney(totals.totalAmount - paidAmount),
      status: paidAmount >= totals.totalAmount ? 'PAID' : 'PARTIALLY_PAID',
      createdBy: receptionUser._id,
    });
    invoiceCount += 1;

    const paymentNumber = await nextId('payment', 'PAY');
    await Payment.create({
      paymentNumber,
      invoice: invoice._id,
      amount: paidAmount,
      method: encounterCount % 3 === 0 ? 'CARD' : 'CASH',
      status: 'SUCCESS',
      transactionRef: `SIM-SEED-${paymentNumber}`,
      receivedBy: receptionUser._id,
      paidAt: encounter.encounterDate,
      simulated: true,
    });
    paymentCount += 1;
  }

  const todayInvoice = await Invoice.findOne({ status: { $ne: 'CANCELLED' } });
  if (todayInvoice) {
    const unpaidTotal = calculateInvoice({
      lineItems: [{ description: 'Consultation fee', category: 'CONSULTATION', quantity: 1, unitPrice: 80 }],
      taxRate: 5,
    });
    const invoiceNumber = await nextId('invoice', 'INV');
    await Invoice.create({
      invoiceNumber,
      patient: patientDocs[8]._id,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lineItems: unpaidTotal.lineItems,
      subtotal: unpaidTotal.subtotal,
      taxRate: unpaidTotal.taxRate,
      tax: unpaidTotal.tax,
      discount: unpaidTotal.discount,
      totalAmount: unpaidTotal.totalAmount,
      amountPaid: 0,
      balanceDue: unpaidTotal.totalAmount,
      status: 'UNPAID',
      createdBy: receptionUser._id,
    });
    invoiceCount += 1;
  }

  console.log(`[seed] encounters: ${encounterCount}, prescriptions: ${prescriptionCount}, reports: ${reportCount}`);
  console.log(`[seed] invoices: ${invoiceCount}, payments: ${paymentCount}`);

  const auditSeeds = [
    { actor: adminUser._id, actorRole: 'ADMIN', action: 'AUTH_LOGIN', resourceType: 'User', resourceId: String(adminUser._id), metadata: { email: adminUser.email } },
    { actor: receptionUser._id, actorRole: 'RECEPTIONIST', action: 'PATIENT_CREATED', resourceType: 'Patient', resourceId: patientDocs[0].patientId, metadata: { patientId: patientDocs[0].patientId } },
    { actor: receptionUser._id, actorRole: 'RECEPTIONIST', action: 'APPOINTMENT_BOOKED', resourceType: 'Appointment', resourceId: appointmentDocs[0].appointment.appointmentNumber, metadata: { date: appointmentDocs[0].appointment.date } },
    { actor: doctorUser._id, actorRole: 'DOCTOR', action: 'ENCOUNTER_CREATED', resourceType: 'Encounter', resourceId: 'ENC-00001', metadata: { note: 'Synthetic seeded activity' } },
    { actor: receptionUser._id, actorRole: 'RECEPTIONIST', action: 'PAYMENT_RECORDED', resourceType: 'Payment', resourceId: 'PAY-00001', metadata: { simulated: true } },
  ];
  for (const entry of auditSeeds) {
    await AuditLog.create(entry);
  }

  // Ensure counters are aligned with the highest generated identifiers.
  const counters = await Counter.find().lean();
  if (!counters.length) {
    await nextSequence('system');
  }

  console.log('\n[seed] complete. Demo credentials:');
  console.log('  ADMIN       admin@hospital.demo');
  console.log('  RECEPTIONIST reception@hospital.demo');
  console.log('  DOCTOR      doctor@hospital.demo');
  console.log(`  PASSWORD    ${env.seedPassword}\n`);
}

if (require.main === module) {
  seed()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[seed] failed:', error);
      await disconnectDatabase();
      process.exit(1);
    });
}

module.exports = { seed, clearDatabase };

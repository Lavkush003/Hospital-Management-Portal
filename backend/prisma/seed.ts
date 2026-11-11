import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(__dirname, '../.env'), quiet: true });

const prisma = new PrismaClient();
const SEED_PREFIX = 'seed-';
const GENERATED_PASSWORD = `Seed-${randomBytes(18).toString('base64url')}`;

function utcDay(daysFromToday: number, hour = 0, minute = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromToday,
      hour,
      minute,
    ),
  );
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function timeOfDay(hour: number, minute: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

function getSeedPassword(): string {
  const environment = process.env.NODE_ENV ?? 'development';
  const configuredPassword = process.env.SEED_DEFAULT_PASSWORD;

  if (environment === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed a production database without SEED_ALLOW_PRODUCTION=true');
  }

  if (environment === 'production' && !configuredPassword) {
    throw new Error('SEED_DEFAULT_PASSWORD is required when seeding production');
  }

  if (configuredPassword && configuredPassword.length < 12) {
    throw new Error('SEED_DEFAULT_PASSWORD must be at least 12 characters');
  }

  return configuredPassword ?? GENERATED_PASSWORD;
}

function getSaltRounds(): number {
  const configuredRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  if (!Number.isInteger(configuredRounds) || configuredRounds < 10 || configuredRounds > 15) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 15');
  }

  return configuredRounds;
}

async function removeExistingSeedData(): Promise<void> {
  const seedFilter = { id: { startsWith: SEED_PREFIX } };

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: seedFilter }),
    prisma.idempotencyKey.deleteMany({ where: seedFilter }),
    prisma.payment.deleteMany({ where: seedFilter }),
    prisma.invoiceItem.deleteMany({ where: seedFilter }),
    prisma.invoice.deleteMany({ where: seedFilter }),
    prisma.diagnosticReport.deleteMany({ where: seedFilter }),
    prisma.prescriptionItem.deleteMany({ where: seedFilter }),
    prisma.prescription.deleteMany({ where: seedFilter }),
    prisma.visit.deleteMany({ where: seedFilter }),
    prisma.appointment.deleteMany({ where: seedFilter }),
    prisma.doctorSchedule.deleteMany({ where: seedFilter }),
    prisma.staff.deleteMany({ where: seedFilter }),
    prisma.doctor.deleteMany({ where: seedFilter }),
    prisma.patient.deleteMany({ where: seedFilter }),
    prisma.department.deleteMany({ where: seedFilter }),
    prisma.user.deleteMany({ where: seedFilter }),
  ]);
}

async function seed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed the database');
  }

  const seedPassword = getSeedPassword();
  const saltRounds = getSaltRounds();
  const passwordHash = await hash(seedPassword, saltRounds);

  await removeExistingSeedData();

  const departments: Prisma.DepartmentCreateManyInput[] = [
    {
      id: 'seed-dept-general',
      code: 'GENMED',
      name: 'General Medicine',
      description: 'Primary care, internal medicine, and preventive consultations.',
      location: 'Building A, Floor 1',
      phone: '+1-555-0100',
      isActive: true,
    },
    {
      id: 'seed-dept-cardiology',
      code: 'CARD',
      name: 'Cardiology',
      description: 'Heart and vascular diagnostics, treatment, and follow-up care.',
      location: 'Building B, Floor 2',
      phone: '+1-555-0101',
      isActive: true,
    },
    {
      id: 'seed-dept-pediatrics',
      code: 'PEDS',
      name: 'Pediatrics',
      description: 'Medical care for infants, children, and adolescents.',
      location: 'Building A, Floor 2',
      phone: '+1-555-0102',
      isActive: true,
    },
    {
      id: 'seed-dept-radiology',
      code: 'RAD',
      name: 'Radiology',
      description: 'Imaging services supporting outpatient and inpatient care.',
      location: 'Building C, Basement 1',
      phone: '+1-555-0103',
      isActive: true,
    },
    {
      id: 'seed-dept-admin',
      code: 'ADMIN',
      name: 'Administration',
      description: 'Registration, scheduling, billing, and operational support.',
      location: 'Building A, Ground Floor',
      phone: '+1-555-0104',
      isActive: true,
    },
  ];

  const users: Prisma.UserCreateManyInput[] = [
    {
      id: 'seed-user-admin',
      email: 'admin@example.test',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Morgan',
      lastName: 'Reed',
      phone: '+1-555-0201',
      lastLoginAt: utcDay(-1, 8, 15),
    },
    {
      id: 'seed-user-frontdesk',
      email: 'frontdesk@example.test',
      passwordHash,
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      firstName: 'Taylor',
      lastName: 'Brooks',
      phone: '+1-555-0202',
      lastLoginAt: utcDay(0, 7, 45),
    },
    {
      id: 'seed-user-doctor-chen',
      email: 'evelyn.chen@example.test',
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'Evelyn',
      lastName: 'Chen',
      phone: '+1-555-0203',
      lastLoginAt: utcDay(0, 8, 5),
    },
    {
      id: 'seed-user-doctor-patel',
      email: 'arjun.patel@example.test',
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'Arjun',
      lastName: 'Patel',
      phone: '+1-555-0204',
      lastLoginAt: utcDay(-2, 9, 30),
    },
    {
      id: 'seed-user-doctor-garcia',
      email: 'sofia.garcia@example.test',
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'Sofia',
      lastName: 'Garcia',
      phone: '+1-555-0205',
      lastLoginAt: utcDay(-3, 13, 20),
    },
    {
      id: 'seed-user-nurse',
      email: 'nurse@example.test',
      passwordHash,
      role: 'CLINICIAN',
      status: 'ACTIVE',
      firstName: 'Jordan',
      lastName: 'Kim',
      phone: '+1-555-0206',
      lastLoginAt: utcDay(-1, 6, 55),
    },
  ];

  const patients: Prisma.PatientCreateManyInput[] = [
    {
      id: 'seed-patient-001',
      patientNumber: 'SEED-PAT-001',
      firstName: 'Avery',
      lastName: 'Johnson',
      dateOfBirth: utcDate(1984, 3, 12),
      gender: 'FEMALE',
      bloodGroup: 'A_POSITIVE',
      phone: '+1-555-0301',
      email: 'avery.johnson@example.test',
      addressLine1: '17 Maple Street',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'United States',
      emergencyContactName: 'Casey Johnson',
      emergencyContactPhone: '+1-555-0391',
      allergies: 'Penicillin',
      status: 'ACTIVE',
    },
    {
      id: 'seed-patient-002',
      patientNumber: 'SEED-PAT-002',
      firstName: 'Noah',
      lastName: 'Williams',
      dateOfBirth: utcDate(1976, 11, 4),
      gender: 'MALE',
      bloodGroup: 'O_POSITIVE',
      phone: '+1-555-0302',
      email: 'noah.williams@example.test',
      addressLine1: '240 Oak Avenue',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62702',
      country: 'United States',
      emergencyContactName: 'Emma Williams',
      emergencyContactPhone: '+1-555-0392',
      allergies: 'None known',
      status: 'ACTIVE',
    },
    {
      id: 'seed-patient-003',
      patientNumber: 'SEED-PAT-003',
      firstName: 'Mia',
      lastName: 'Thompson',
      dateOfBirth: utcDate(2015, 6, 21),
      gender: 'FEMALE',
      bloodGroup: 'B_POSITIVE',
      phone: '+1-555-0303',
      email: 'mia.thompson@example.test',
      addressLine1: '8 Cedar Lane',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62703',
      country: 'United States',
      emergencyContactName: 'Daniel Thompson',
      emergencyContactPhone: '+1-555-0393',
      status: 'ACTIVE',
    },
    {
      id: 'seed-patient-004',
      patientNumber: 'SEED-PAT-004',
      firstName: 'Liam',
      lastName: 'Brown',
      dateOfBirth: utcDate(1992, 9, 8),
      gender: 'MALE',
      bloodGroup: 'AB_POSITIVE',
      phone: '+1-555-0304',
      email: 'liam.brown@example.test',
      addressLine1: '91 Pine Road',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'United States',
      emergencyContactName: 'Olivia Brown',
      emergencyContactPhone: '+1-555-0394',
      status: 'ACTIVE',
    },
    {
      id: 'seed-patient-005',
      patientNumber: 'SEED-PAT-005',
      firstName: 'Isabella',
      lastName: 'Davis',
      dateOfBirth: utcDate(1968, 1, 30),
      gender: 'FEMALE',
      bloodGroup: 'O_NEGATIVE',
      phone: '+1-555-0305',
      email: 'isabella.davis@example.test',
      addressLine1: '315 Birch Boulevard',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62705',
      country: 'United States',
      emergencyContactName: 'Lucas Davis',
      emergencyContactPhone: '+1-555-0395',
      allergies: 'Sulfa drugs',
      status: 'ACTIVE',
    },
    {
      id: 'seed-patient-006',
      patientNumber: 'SEED-PAT-006',
      firstName: 'Ethan',
      lastName: 'Martinez',
      dateOfBirth: utcDate(2001, 7, 17),
      gender: 'MALE',
      bloodGroup: 'A_NEGATIVE',
      phone: '+1-555-0306',
      email: 'ethan.martinez@example.test',
      addressLine1: '42 Willow Court',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62706',
      country: 'United States',
      emergencyContactName: 'Sophia Martinez',
      emergencyContactPhone: '+1-555-0396',
      status: 'ACTIVE',
    },
  ];

  const doctors: Prisma.DoctorCreateManyInput[] = [
    {
      id: 'seed-doctor-chen',
      userId: 'seed-user-doctor-chen',
      employeeCode: 'SEED-DOC-001',
      departmentId: 'seed-dept-cardiology',
      firstName: 'Evelyn',
      lastName: 'Chen',
      email: 'evelyn.chen@example.test',
      phone: '+1-555-0203',
      licenseNumber: 'SEED-LIC-001',
      specialization: 'Cardiology',
      qualifications: 'MD, FACC',
      consultationFee: '150.00',
      status: 'ACTIVE',
      bio: 'Cardiologist focused on preventive cardiology and ischemic heart disease.',
    },
    {
      id: 'seed-doctor-patel',
      userId: 'seed-user-doctor-patel',
      employeeCode: 'SEED-DOC-002',
      departmentId: 'seed-dept-general',
      firstName: 'Arjun',
      lastName: 'Patel',
      email: 'arjun.patel@example.test',
      phone: '+1-555-0204',
      licenseNumber: 'SEED-LIC-002',
      specialization: 'Internal Medicine',
      qualifications: 'MD',
      consultationFee: '120.00',
      status: 'ACTIVE',
      bio: 'Internal medicine physician providing primary and preventive care.',
    },
    {
      id: 'seed-doctor-garcia',
      userId: 'seed-user-doctor-garcia',
      employeeCode: 'SEED-DOC-003',
      departmentId: 'seed-dept-pediatrics',
      firstName: 'Sofia',
      lastName: 'Garcia',
      email: 'sofia.garcia@example.test',
      phone: '+1-555-0205',
      licenseNumber: 'SEED-LIC-003',
      specialization: 'Pediatrics',
      qualifications: 'MD, FAAP',
      consultationFee: '110.00',
      status: 'ACTIVE',
      bio: 'Pediatrician with experience in acute and preventive childhood care.',
    },
  ];

  const staff: Prisma.StaffCreateManyInput[] = [
    {
      id: 'seed-staff-admin',
      userId: 'seed-user-admin',
      employeeCode: 'SEED-EMP-001',
      departmentId: 'seed-dept-admin',
      firstName: 'Morgan',
      lastName: 'Reed',
      email: 'admin@example.test',
      phone: '+1-555-0201',
      jobTitle: 'Hospital Administrator',
      status: 'ACTIVE',
      hiredAt: utcDate(2019, 2, 4),
    },
    {
      id: 'seed-staff-frontdesk',
      userId: 'seed-user-frontdesk',
      employeeCode: 'SEED-EMP-002',
      departmentId: 'seed-dept-admin',
      firstName: 'Taylor',
      lastName: 'Brooks',
      email: 'frontdesk@example.test',
      phone: '+1-555-0202',
      jobTitle: 'Front Desk Coordinator',
      status: 'ACTIVE',
      hiredAt: utcDate(2022, 8, 15),
    },
    {
      id: 'seed-staff-nurse',
      userId: 'seed-user-nurse',
      employeeCode: 'SEED-EMP-003',
      departmentId: 'seed-dept-general',
      firstName: 'Jordan',
      lastName: 'Kim',
      email: 'nurse@example.test',
      phone: '+1-555-0206',
      jobTitle: 'Registered Nurse',
      status: 'ACTIVE',
      hiredAt: utcDate(2021, 5, 10),
    },
  ];

  const schedules: Prisma.DoctorScheduleCreateManyInput[] = [
    {
      id: 'seed-schedule-chen-mon',
      doctorId: 'seed-doctor-chen',
      dayOfWeek: 'MONDAY',
      startTime: timeOfDay(9, 0),
      endTime: timeOfDay(12, 0),
      slotDurationMinutes: 30,
      room: 'CARD-201',
    },
    {
      id: 'seed-schedule-chen-wed',
      doctorId: 'seed-doctor-chen',
      dayOfWeek: 'WEDNESDAY',
      startTime: timeOfDay(9, 0),
      endTime: timeOfDay(12, 0),
      slotDurationMinutes: 30,
      room: 'CARD-201',
    },
    {
      id: 'seed-schedule-chen-fri',
      doctorId: 'seed-doctor-chen',
      dayOfWeek: 'FRIDAY',
      startTime: timeOfDay(9, 0),
      endTime: timeOfDay(12, 0),
      slotDurationMinutes: 30,
      room: 'CARD-201',
    },
    {
      id: 'seed-schedule-patel-tue',
      doctorId: 'seed-doctor-patel',
      dayOfWeek: 'TUESDAY',
      startTime: timeOfDay(10, 0),
      endTime: timeOfDay(13, 0),
      slotDurationMinutes: 30,
      room: 'GEN-105',
    },
    {
      id: 'seed-schedule-patel-thu',
      doctorId: 'seed-doctor-patel',
      dayOfWeek: 'THURSDAY',
      startTime: timeOfDay(10, 0),
      endTime: timeOfDay(13, 0),
      slotDurationMinutes: 30,
      room: 'GEN-105',
    },
    {
      id: 'seed-schedule-garcia-mon',
      doctorId: 'seed-doctor-garcia',
      dayOfWeek: 'MONDAY',
      startTime: timeOfDay(14, 0),
      endTime: timeOfDay(17, 0),
      slotDurationMinutes: 20,
      room: 'PED-202',
    },
    {
      id: 'seed-schedule-garcia-wed',
      doctorId: 'seed-doctor-garcia',
      dayOfWeek: 'WEDNESDAY',
      startTime: timeOfDay(14, 0),
      endTime: timeOfDay(17, 0),
      slotDurationMinutes: 20,
      room: 'PED-202',
    },
  ];

  const scheduleBreaks: Prisma.DoctorScheduleBreakCreateManyInput[] = [
    {
      id: 'seed-break-chen-mon',
      scheduleId: 'seed-schedule-chen-mon',
      startTime: timeOfDay(10, 30),
      endTime: timeOfDay(11, 0),
    },
    {
      id: 'seed-break-garcia-wed',
      scheduleId: 'seed-schedule-garcia-wed',
      startTime: timeOfDay(15, 0),
      endTime: timeOfDay(15, 20),
    },
  ];

  const doctorLeaves: Prisma.DoctorLeaveCreateManyInput[] = [
    {
      id: 'seed-leave-chen',
      doctorId: 'seed-doctor-chen',
      startAt: utcDay(10, 9, 0),
      endAt: utcDay(10, 12, 0),
      reason: 'Scheduled professional development day',
    },
  ];

  const doctorUnavailability: Prisma.DoctorUnavailabilityCreateManyInput[] = [
    {
      id: 'seed-unavailability-patel',
      doctorId: 'seed-doctor-patel',
      startAt: utcDay(12, 10, 0),
      endAt: utcDay(12, 13, 0),
      reason: 'Hospital committee meeting',
    },
  ];

  const appointments: Prisma.AppointmentCreateManyInput[] = [
    {
      id: 'seed-appointment-001',
      appointmentNumber: 'SEED-APT-001',
      patientId: 'seed-patient-001',
      doctorId: 'seed-doctor-chen',
      scheduledStart: utcDay(-14, 9, 0),
      scheduledEnd: utcDay(-14, 9, 30),
      status: 'COMPLETED',
      reason: 'Chest discomfort during exercise',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-002',
      appointmentNumber: 'SEED-APT-002',
      patientId: 'seed-patient-002',
      doctorId: 'seed-doctor-patel',
      scheduledStart: utcDay(-10, 10, 0),
      scheduledEnd: utcDay(-10, 10, 30),
      status: 'COMPLETED',
      reason: 'Routine diabetes follow-up',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-003',
      appointmentNumber: 'SEED-APT-003',
      patientId: 'seed-patient-003',
      doctorId: 'seed-doctor-chen',
      scheduledStart: utcDay(1, 9, 0),
      scheduledEnd: utcDay(1, 9, 30),
      status: 'CONFIRMED',
      reason: 'Follow-up after abnormal ECG',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-004',
      appointmentNumber: 'SEED-APT-004',
      patientId: 'seed-patient-004',
      doctorId: 'seed-doctor-patel',
      scheduledStart: utcDay(1, 9, 0),
      scheduledEnd: utcDay(1, 9, 30),
      status: 'SCHEDULED',
      reason: 'Persistent cough',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-005',
      appointmentNumber: 'SEED-APT-005',
      patientId: 'seed-patient-005',
      doctorId: 'seed-doctor-garcia',
      scheduledStart: utcDay(2, 9, 0),
      scheduledEnd: utcDay(2, 9, 20),
      status: 'SCHEDULED',
      reason: 'Medication review',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-006',
      appointmentNumber: 'SEED-APT-006',
      patientId: 'seed-patient-006',
      doctorId: 'seed-doctor-chen',
      scheduledStart: utcDay(3, 10, 0),
      scheduledEnd: utcDay(3, 10, 30),
      status: 'CANCELLED',
      reason: 'Blood pressure review',
      createdById: 'seed-user-frontdesk',
      cancelledById: 'seed-user-admin',
      cancelledAt: utcDay(-1, 11, 0),
      cancellationReason: 'Patient requested a later appointment',
    },
    {
      id: 'seed-appointment-007',
      appointmentNumber: 'SEED-APT-007',
      patientId: 'seed-patient-001',
      doctorId: 'seed-doctor-patel',
      scheduledStart: utcDay(-5, 11, 0),
      scheduledEnd: utcDay(-5, 11, 30),
      status: 'NO_SHOW',
      reason: 'Annual wellness visit',
      createdById: 'seed-user-frontdesk',
    },
    {
      id: 'seed-appointment-008',
      appointmentNumber: 'SEED-APT-008',
      patientId: 'seed-patient-002',
      doctorId: 'seed-doctor-chen',
      scheduledStart: utcDay(4, 10, 0),
      scheduledEnd: utcDay(4, 10, 30),
      status: 'SCHEDULED',
      reason: 'Medication adjustment',
      createdById: 'seed-user-frontdesk',
      rescheduledById: 'seed-user-frontdesk',
      rescheduledAt: utcDay(-1, 15, 30),
    },
  ];

  const visits: Prisma.VisitCreateManyInput[] = [
    {
      id: 'seed-visit-001',
      visitNumber: 'SEED-VIS-001',
      appointmentId: 'seed-appointment-001',
      patientId: 'seed-patient-001',
      doctorId: 'seed-doctor-chen',
      status: 'COMPLETED',
      chiefComplaint: 'Intermittent chest tightness during exercise',
      diagnosis: 'Stable angina',
      clinicalNotes:
        'ECG showed mild ST depression. Started antiplatelet therapy and scheduled follow-up.',
      heightCm: '165.00',
      weightKg: '68.40',
      temperatureC: '36.8',
      systolicBp: 128,
      diastolicBp: 82,
      heartRate: 76,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      startedAt: utcDay(-14, 9, 0),
      endedAt: utcDay(-14, 9, 30),
    },
    {
      id: 'seed-visit-002',
      visitNumber: 'SEED-VIS-002',
      appointmentId: 'seed-appointment-002',
      patientId: 'seed-patient-002',
      doctorId: 'seed-doctor-patel',
      status: 'COMPLETED',
      chiefComplaint: 'Home glucose readings above target',
      diagnosis: 'Type 2 diabetes mellitus, suboptimal control',
      clinicalNotes:
        'Reviewed diet and medication adherence. Ordered lipid panel and adjusted metformin dose.',
      heightCm: '178.00',
      weightKg: '86.20',
      temperatureC: '36.6',
      systolicBp: 136,
      diastolicBp: 88,
      heartRate: 80,
      respiratoryRate: 18,
      oxygenSaturation: 97,
      startedAt: utcDay(-10, 10, 0),
      endedAt: utcDay(-10, 10, 30),
    },
    {
      id: 'seed-visit-003',
      visitNumber: 'SEED-VIS-003',
      appointmentId: null,
      patientId: 'seed-patient-004',
      doctorId: 'seed-doctor-garcia',
      status: 'COMPLETED',
      chiefComplaint: 'Sore throat and low-grade fever',
      diagnosis: 'Acute pharyngitis',
      clinicalNotes:
        'Rapid strep test negative. Recommended supportive care and return if symptoms worsen.',
      heightCm: '181.00',
      weightKg: '79.50',
      temperatureC: '38.1',
      systolicBp: 122,
      diastolicBp: 78,
      heartRate: 88,
      respiratoryRate: 18,
      oxygenSaturation: 99,
      startedAt: utcDay(-3, 14, 0),
      endedAt: utcDay(-3, 14, 30),
    },
  ];

  const prescriptions: Prisma.PrescriptionCreateManyInput[] = [
    {
      id: 'seed-prescription-001',
      prescriptionNumber: 'SEED-RX-001',
      visitId: 'seed-visit-001',
      status: 'DISPENSED',
      notes: 'Take aspirin with food. Return promptly for worsening chest pain.',
      issuedAt: utcDay(-14, 9, 25),
    },
    {
      id: 'seed-prescription-002',
      prescriptionNumber: 'SEED-RX-002',
      visitId: 'seed-visit-002',
      status: 'ISSUED',
      notes: 'Continue home glucose monitoring twice daily.',
      issuedAt: utcDay(-10, 10, 25),
    },
  ];

  const prescriptionItems: Prisma.PrescriptionItemCreateManyInput[] = [
    {
      id: 'seed-prescription-item-001',
      prescriptionId: 'seed-prescription-001',
      medicationName: 'Aspirin',
      dosage: '81 mg',
      frequency: 'Once daily',
      durationDays: 30,
      quantity: 30,
      instructions: 'Take orally with food.',
    },
    {
      id: 'seed-prescription-item-002',
      prescriptionId: 'seed-prescription-001',
      medicationName: 'Atorvastatin',
      dosage: '20 mg',
      frequency: 'Once nightly',
      durationDays: 30,
      quantity: 30,
      instructions: 'Take at bedtime.',
    },
    {
      id: 'seed-prescription-item-003',
      prescriptionId: 'seed-prescription-002',
      medicationName: 'Metformin',
      dosage: '500 mg',
      frequency: 'Twice daily',
      durationDays: 60,
      quantity: 120,
      instructions: 'Take with breakfast and dinner.',
    },
  ];

  const diagnosticReports: Prisma.DiagnosticReportCreateManyInput[] = [
    {
      id: 'seed-diagnostic-001',
      reportNumber: 'SEED-DIAG-001',
      visitId: 'seed-visit-001',
      type: 'LABORATORY',
      status: 'COMPLETED',
      testName: 'Cardiac troponin panel',
      resultSummary: 'Troponin I within normal limits.',
      resultDetails: 'Troponin I: 0.02 ng/mL (reference: less than 0.04 ng/mL).',
      orderedAt: utcDay(-14, 9, 10),
      completedAt: utcDay(-14, 12, 0),
    },
    {
      id: 'seed-diagnostic-002',
      reportNumber: 'SEED-DIAG-002',
      visitId: 'seed-visit-002',
      type: 'LABORATORY',
      status: 'PROCESSING',
      testName: 'Lipid panel',
      orderedAt: utcDay(-10, 10, 20),
    },
    {
      id: 'seed-diagnostic-003',
      reportNumber: 'SEED-DIAG-003',
      visitId: 'seed-visit-003',
      type: 'OTHER',
      status: 'ORDERED',
      testName: 'Rapid streptococcal antigen test',
      orderedAt: utcDay(-3, 14, 10),
    },
  ];

  const invoices: Prisma.InvoiceCreateManyInput[] = [
    {
      id: 'seed-invoice-001',
      invoiceNumber: 'SEED-INV-001',
      visitId: 'seed-visit-001',
      status: 'PAID',
      currency: 'USD',
      subtotal: '180.00',
      discountAmount: '0.00',
      taxAmount: '18.00',
      totalAmount: '198.00',
      issuedAt: utcDay(-14, 9, 35),
      dueAt: utcDay(-7, 9, 35),
      notes: 'Paid in full at checkout.',
    },
    {
      id: 'seed-invoice-002',
      invoiceNumber: 'SEED-INV-002',
      visitId: 'seed-visit-002',
      status: 'PARTIALLY_PAID',
      currency: 'USD',
      subtotal: '250.00',
      discountAmount: '20.00',
      taxAmount: '23.00',
      totalAmount: '253.00',
      issuedAt: utcDay(-10, 10, 35),
      dueAt: utcDay(-3, 10, 35),
      notes: 'Patient will settle the remaining balance at the next visit.',
    },
    {
      id: 'seed-invoice-003',
      invoiceNumber: 'SEED-INV-003',
      visitId: 'seed-visit-003',
      status: 'ISSUED',
      currency: 'USD',
      subtotal: '90.00',
      discountAmount: '0.00',
      taxAmount: '9.00',
      totalAmount: '99.00',
      issuedAt: utcDay(-3, 14, 35),
      dueAt: utcDay(4, 14, 35),
    },
  ];

  const invoiceItems: Prisma.InvoiceItemCreateManyInput[] = [
    {
      id: 'seed-invoice-item-001',
      invoiceId: 'seed-invoice-001',
      description: 'Cardiology consultation',
      quantity: 1,
      unitPrice: '150.00',
      lineTotal: '150.00',
    },
    {
      id: 'seed-invoice-item-002',
      invoiceId: 'seed-invoice-001',
      description: 'Electrocardiogram',
      quantity: 1,
      unitPrice: '30.00',
      lineTotal: '30.00',
    },
    {
      id: 'seed-invoice-item-003',
      invoiceId: 'seed-invoice-002',
      description: 'Internal medicine consultation',
      quantity: 1,
      unitPrice: '200.00',
      lineTotal: '200.00',
    },
    {
      id: 'seed-invoice-item-004',
      invoiceId: 'seed-invoice-002',
      description: 'Laboratory panel',
      quantity: 1,
      unitPrice: '50.00',
      lineTotal: '50.00',
    },
    {
      id: 'seed-invoice-item-005',
      invoiceId: 'seed-invoice-003',
      description: 'Pediatric consultation',
      quantity: 1,
      unitPrice: '90.00',
      lineTotal: '90.00',
    },
  ];

  const payments: Prisma.PaymentCreateManyInput[] = [
    {
      id: 'seed-payment-001',
      paymentNumber: 'SEED-PAY-001',
      invoiceId: 'seed-invoice-001',
      amount: '198.00',
      method: 'CARD',
      status: 'COMPLETED',
      receivedById: 'seed-user-frontdesk',
      paidAt: utcDay(-14, 9, 40),
      externalReference: 'SEED-CARD-001',
      notes: 'Synthetic card payment for development data.',
    },
    {
      id: 'seed-payment-002',
      paymentNumber: 'SEED-PAY-002',
      invoiceId: 'seed-invoice-002',
      amount: '100.00',
      method: 'CASH',
      status: 'COMPLETED',
      receivedById: 'seed-user-frontdesk',
      paidAt: utcDay(-10, 10, 40),
      notes: 'Partial cash payment for development data.',
    },
  ];

  const auditLogs: Prisma.AuditLogCreateManyInput[] = [
    {
      id: 'seed-audit-001',
      actorUserId: 'seed-user-frontdesk',
      action: 'APPOINTMENT_BOOKED',
      entityType: 'Appointment',
      entityId: 'seed-appointment-001',
      after: {
        appointmentNumber: 'SEED-APT-001',
        patientId: 'seed-patient-001',
        doctorId: 'seed-doctor-chen',
        status: 'SCHEDULED',
      },
      requestId: 'seed-request-001',
    },
    {
      id: 'seed-audit-002',
      actorUserId: 'seed-user-admin',
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'Appointment',
      entityId: 'seed-appointment-006',
      after: {
        status: 'CANCELLED',
        cancellationReason: 'Patient requested a later appointment',
      },
      requestId: 'seed-request-002',
    },
    {
      id: 'seed-audit-003',
      actorUserId: 'seed-user-doctor-chen',
      action: 'VISIT_COMPLETED',
      entityType: 'Visit',
      entityId: 'seed-visit-001',
      after: {
        visitNumber: 'SEED-VIS-001',
        status: 'COMPLETED',
        diagnosis: 'Stable angina',
      },
      requestId: 'seed-request-003',
    },
    {
      id: 'seed-audit-004',
      actorUserId: 'seed-user-doctor-chen',
      action: 'PRESCRIPTION_ISSUED',
      entityType: 'Prescription',
      entityId: 'seed-prescription-001',
      after: {
        prescriptionNumber: 'SEED-RX-001',
        status: 'DISPENSED',
      },
      requestId: 'seed-request-004',
    },
    {
      id: 'seed-audit-005',
      actorUserId: 'seed-user-frontdesk',
      action: 'INVOICE_ISSUED',
      entityType: 'Invoice',
      entityId: 'seed-invoice-001',
      after: {
        invoiceNumber: 'SEED-INV-001',
        totalAmount: '198.00',
        status: 'PAID',
      },
      requestId: 'seed-request-005',
    },
    {
      id: 'seed-audit-006',
      actorUserId: 'seed-user-frontdesk',
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: 'seed-payment-001',
      after: {
        paymentNumber: 'SEED-PAY-001',
        amount: '198.00',
        method: 'CARD',
        status: 'COMPLETED',
      },
      requestId: 'seed-request-006',
    },
  ];

  const idempotencyKeys: Prisma.IdempotencyKeyCreateManyInput[] = [
    {
      id: 'seed-idempotency-001',
      actorUserId: 'seed-user-frontdesk',
      scope: 'appointments.book',
      key: 'seed-demo-booking-key-0001',
      requestHash: createHash('sha256').update('seed-demo-booking-request').digest('hex'),
      status: 'COMPLETED',
      resourceType: 'Appointment',
      resourceId: 'seed-appointment-003',
      responseStatusCode: 201,
      responseBody: { resourceId: 'seed-appointment-003' },
      expiresAt: utcDay(1, 12, 0),
    },
  ];

  await prisma.$transaction([
    prisma.department.createMany({ data: departments }),
    prisma.user.createMany({ data: users }),
    prisma.patient.createMany({ data: patients }),
    prisma.doctor.createMany({ data: doctors }),
    prisma.staff.createMany({ data: staff }),
    prisma.doctorSchedule.createMany({ data: schedules }),
    prisma.doctorScheduleBreak.createMany({ data: scheduleBreaks }),
    prisma.doctorLeave.createMany({ data: doctorLeaves }),
    prisma.doctorUnavailability.createMany({ data: doctorUnavailability }),
    prisma.appointment.createMany({ data: appointments }),
    prisma.visit.createMany({ data: visits }),
    prisma.prescription.createMany({ data: prescriptions }),
    prisma.prescriptionItem.createMany({ data: prescriptionItems }),
    prisma.diagnosticReport.createMany({ data: diagnosticReports }),
    prisma.invoice.createMany({ data: invoices }),
    prisma.invoiceItem.createMany({ data: invoiceItems }),
    prisma.payment.createMany({ data: payments }),
    prisma.auditLog.createMany({ data: auditLogs }),
    prisma.idempotencyKey.createMany({ data: idempotencyKeys }),
  ]);

  process.stdout.write(
    [
      'Database seed completed.',
      `Departments: ${departments.length}`,
      `Users: ${users.length}`,
      `Patients: ${patients.length}`,
      `Doctors: ${doctors.length}`,
      `Staff: ${staff.length}`,
      `Schedules: ${schedules.length}`,
      `Appointments: ${appointments.length}`,
      `Visits: ${visits.length}`,
      `Prescriptions: ${prescriptions.length}`,
      `Diagnostic reports: ${diagnosticReports.length}`,
      `Invoices: ${invoices.length}`,
      `Payments: ${payments.length}`,
      `Audit logs: ${auditLogs.length}`,
      `Idempotency keys: ${idempotencyKeys.length}`,
      process.env.SEED_DEFAULT_PASSWORD
        ? 'Seed users use the password from SEED_DEFAULT_PASSWORD.'
        : `Generated seed password: ${seedPassword}`,
      '',
    ].join('\n'),
  );
}

seed()
  .catch((error: unknown) => {
    process.stderr.write(
      `Database seed failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

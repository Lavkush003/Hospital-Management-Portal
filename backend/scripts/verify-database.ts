import assert from 'node:assert/strict';
import { prisma } from '../src/config/prisma';
import {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from '../src/modules/appointments/appointment.service';
import {
  isCheckConstraintError,
  isExclusionConstraintError,
  isUniqueConstraintError,
} from '../src/utils/database-errors';
import { AppError } from '../src/utils/errors';

const VERIFY_PREFIX = 'verify-';
const SERVICE_NOTE_PREFIX = 'verify-script:';
const OVERLAP_CONSTRAINT = 'Appointment_no_doctor_overlap_active_excl';

const EXPECTED_MODEL_TABLES = [
  'User',
  'Patient',
  'Department',
  'Doctor',
  'Staff',
  'DoctorSchedule',
  'DoctorScheduleBreak',
  'DoctorLeave',
  'DoctorUnavailability',
  'Appointment',
  'Visit',
  'ClinicalNote',
  'ClinicalNoteRevision',
  'Prescription',
  'PrescriptionItem',
  'DiagnosticReport',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'AuditLog',
  'IdempotencyKey',
  'RefreshToken',
];

const EXPECTED_CONSTRAINTS = [
  'Doctor_consultation_fee_nonnegative_check',
  'DoctorSchedule_time_order_check',
  'DoctorSchedule_slot_duration_check',
  'DoctorScheduleBreak_time_order_check',
  'DoctorLeave_time_order_check',
  'DoctorUnavailability_time_order_check',
  'Appointment_time_order_check',
  'Appointment_cancelled_at_check',
  'Appointment_no_doctor_overlap_active_excl',
  'Visit_time_order_check',
  'Visit_completed_requires_end_check',
  'Visit_vitals_nonnegative_check',
  'Visit_oxygen_saturation_check',
  'Visit_blood_pressure_order_check',
  'ClinicalNoteRevision_number_check',
  'PrescriptionItem_quantity_check',
  'PrescriptionItem_duration_check',
  'DiagnosticReport_completion_time_check',
  'DiagnosticReport_completed_requires_date_check',
  'Invoice_subtotal_nonnegative_check',
  'Invoice_discount_range_check',
  'Invoice_tax_nonnegative_check',
  'Invoice_total_calculation_check',
  'Invoice_issued_at_check',
  'InvoiceItem_quantity_check',
  'InvoiceItem_unit_price_check',
  'InvoiceItem_discount_range_check',
  'InvoiceItem_tax_nonnegative_check',
  'InvoiceItem_line_total_check',
  'Payment_amount_check',
  'Payment_successful_requires_date_check',
  'IdempotencyKey_expiry_check',
  'IdempotencyKey_response_status_check',
  'RefreshToken_expiry_check',
  'RefreshToken_revocation_time_check',
  'RefreshToken_no_self_replacement_check',
];

const EXPECTED_LOWER_EMAIL_INDEXES = [
  'User_email_lower_key',
  'Doctor_email_lower_key',
  'Staff_email_lower_key',
];

interface CheckResult {
  name: string;
  details: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the operation to fail, but it succeeded');
}

async function expectDatabaseError(
  action: () => Promise<unknown>,
  predicate: (error: unknown) => boolean,
  description: string,
): Promise<unknown> {
  const error = await captureError(action);
  assert.ok(predicate(error), `${description}: ${errorMessage(error)}`);
  return error;
}

async function cleanupVerificationData(): Promise<void> {
  const verificationAppointments = await prisma.appointment.findMany({
    where: {
      OR: [{ id: { startsWith: VERIFY_PREFIX } }, { notes: { startsWith: SERVICE_NOTE_PREFIX } }],
    },
    select: { id: true },
  });
  const appointmentIds = verificationAppointments.map((appointment) => appointment.id);

  if (appointmentIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityType: 'Appointment', entityId: { in: appointmentIds } },
          { entityId: { startsWith: VERIFY_PREFIX } },
        ],
      },
    });
    await prisma.idempotencyKey.deleteMany({
      where: {
        OR: [
          { key: { startsWith: VERIFY_PREFIX } },
          { resourceType: 'Appointment', resourceId: { in: appointmentIds } },
        ],
      },
    });
    await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  } else {
    await prisma.auditLog.deleteMany({
      where: { entityId: { startsWith: VERIFY_PREFIX } },
    });
    await prisma.idempotencyKey.deleteMany({
      where: { key: { startsWith: VERIFY_PREFIX } },
    });
  }

  await prisma.prescriptionItem.deleteMany({ where: { id: { startsWith: VERIFY_PREFIX } } });
  await prisma.invoiceItem.deleteMany({ where: { id: { startsWith: VERIFY_PREFIX } } });
  await prisma.payment.deleteMany({ where: { id: { startsWith: VERIFY_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: VERIFY_PREFIX } } });
}

async function checkServerAndMigrations(): Promise<CheckResult> {
  const databaseRows = await prisma.$queryRaw<
    Array<{ database_name: string; server_version: string }>
  >`
    SELECT
      current_database() AS database_name,
      version() AS server_version
  `;
  const database = databaseRows[0];

  if (!database) {
    throw new Error('PostgreSQL did not return database metadata');
  }

  assert.match(database.server_version, /PostgreSQL/);

  const migrations = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
  >`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;

  assert.equal(migrations.length, 8, 'Expected exactly eight Prisma migrations');
  assert.ok(
    migrations.every(
      (migration) => migration.finished_at !== null && migration.rolled_back_at === null,
    ),
    'Every migration must be finished and not rolled back',
  );

  return {
    name: 'PostgreSQL connectivity and migration history',
    details: `${database.database_name}; ${database.server_version}; ${migrations
      .map((migration) => migration.migration_name)
      .join(', ')}`,
  };
}

async function checkSchemaObjects(): Promise<CheckResult> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const tableNames = new Set(tables.map((table) => table.table_name));

  for (const table of EXPECTED_MODEL_TABLES) {
    assert.ok(tableNames.has(table), `Missing table: ${table}`);
  }

  const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
    SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
  `;
  assert.equal(extensions.length, 1, 'btree_gist extension is required');

  const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace
  `;
  const constraintNames = new Set(constraints.map((constraint) => constraint.conname));

  for (const constraint of EXPECTED_CONSTRAINTS) {
    assert.ok(constraintNames.has(constraint), `Missing constraint: ${constraint}`);
  }

  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `;
  const indexNames = new Set(indexes.map((index) => index.indexname));

  for (const index of EXPECTED_LOWER_EMAIL_INDEXES) {
    assert.ok(indexNames.has(index), `Missing case-insensitive email index: ${index}`);
  }

  return {
    name: 'Tables, extension, constraints, and indexes',
    details: `${EXPECTED_MODEL_TABLES.length} model tables, ${EXPECTED_CONSTRAINTS.length} custom constraints, ${EXPECTED_LOWER_EMAIL_INDEXES.length} lower-email indexes`,
  };
}

async function checkSeedData(): Promise<CheckResult> {
  const [
    departments,
    users,
    patients,
    doctors,
    staff,
    schedules,
    scheduleBreaks,
    doctorLeaves,
    doctorUnavailability,
    appointments,
    visits,
    prescriptions,
    prescriptionItems,
    diagnosticReports,
    invoices,
    invoiceItems,
    payments,
    auditLogs,
    idempotencyKeys,
  ] = await Promise.all([
    prisma.department.count(),
    prisma.user.count(),
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.staff.count(),
    prisma.doctorSchedule.count(),
    prisma.doctorScheduleBreak.count(),
    prisma.doctorLeave.count(),
    prisma.doctorUnavailability.count(),
    prisma.appointment.count(),
    prisma.visit.count(),
    prisma.prescription.count(),
    prisma.prescriptionItem.count(),
    prisma.diagnosticReport.count(),
    prisma.invoice.count(),
    prisma.invoiceItem.count(),
    prisma.payment.count(),
    prisma.auditLog.count({ where: { entityId: { startsWith: 'seed-' } } }),
    prisma.idempotencyKey.count(),
  ]);

  assert.equal(departments, 5, 'Expected 5 seeded departments');
  assert.equal(users, 6, 'Expected 6 seeded users');
  assert.equal(patients, 6, 'Expected 6 seeded patients');
  assert.equal(doctors, 3, 'Expected 3 seeded doctors');
  assert.equal(staff, 3, 'Expected 3 seeded staff members');
  assert.equal(schedules, 7, 'Expected 7 seeded doctor schedules');
  assert.equal(scheduleBreaks, 2, 'Expected 2 seeded schedule breaks');
  assert.equal(doctorLeaves, 1, 'Expected 1 seeded doctor leave');
  assert.equal(doctorUnavailability, 1, 'Expected 1 seeded unavailability period');
  assert.equal(appointments, 8, 'Expected 8 seeded appointments');
  assert.equal(visits, 3, 'Expected 3 seeded visits');
  assert.equal(prescriptions, 2, 'Expected 2 seeded prescriptions');
  assert.equal(prescriptionItems, 3, 'Expected 3 seeded prescription items');
  assert.equal(diagnosticReports, 3, 'Expected 3 seeded diagnostic reports');
  assert.equal(invoices, 3, 'Expected 3 seeded invoices');
  assert.equal(invoiceItems, 5, 'Expected 5 seeded invoice items');
  assert.equal(payments, 2, 'Expected 2 seeded payments');
  assert.equal(auditLogs, 6, 'Expected 6 seeded audit logs');
  assert.equal(idempotencyKeys, 1, 'Expected 1 seeded idempotency key');

  return {
    name: 'Seed data and all model relationships',
    details: '16 seeded models populated through valid foreign keys; auth sessions are not seeded',
  };
}

async function checkReferentialIntegrity(): Promise<CheckResult> {
  const orphanRows = await prisma.$queryRaw<
    Array<{
      orphan_visits: number;
      orphan_invoices: number;
      orphan_payments: number;
      orphan_prescription_items: number;
    }>
  >`
    SELECT
      (SELECT COUNT(*)::int FROM "Visit" v
        LEFT JOIN "Patient" p ON p."id" = v."patientId"
        LEFT JOIN "Doctor" d ON d."id" = v."doctorId"
        WHERE p."id" IS NULL OR d."id" IS NULL) AS orphan_visits,
      (SELECT COUNT(*)::int FROM "Invoice" i
        LEFT JOIN "Visit" v ON v."id" = i."visitId"
        WHERE v."id" IS NULL) AS orphan_invoices,
      (SELECT COUNT(*)::int FROM "Payment" pay
        LEFT JOIN "Invoice" i ON i."id" = pay."invoiceId"
        WHERE i."id" IS NULL) AS orphan_payments,
      (SELECT COUNT(*)::int FROM "PrescriptionItem" pi
        LEFT JOIN "Prescription" p ON p."id" = pi."prescriptionId"
        WHERE p."id" IS NULL) AS orphan_prescription_items
  `;
  const counts = orphanRows[0];

  if (!counts) {
    throw new Error('Referential integrity query returned no rows');
  }

  assert.equal(counts.orphan_visits, 0, 'Visits must reference existing patients and doctors');
  assert.equal(counts.orphan_invoices, 0, 'Invoices must reference existing visits');
  assert.equal(counts.orphan_payments, 0, 'Payments must reference existing invoices');
  assert.equal(
    counts.orphan_prescription_items,
    0,
    'Prescription items must reference existing prescriptions',
  );

  return {
    name: 'Referential integrity',
    details: 'No orphan visits, invoices, payments, or prescription items',
  };
}

async function checkCaseInsensitiveEmailUniqueness(): Promise<CheckResult> {
  await expectDatabaseError(
    () =>
      prisma.user.create({
        data: {
          id: 'verify-user-email-check',
          email: 'ADMIN@EXAMPLE.TEST',
          passwordHash: 'verification-only',
          role: 'ADMIN',
          status: 'ACTIVE',
          firstName: 'Verification',
          lastName: 'User',
        },
      }),
    (databaseError) => isUniqueConstraintError(databaseError),
    'Case-insensitive email uniqueness must reject ADMIN@EXAMPLE.TEST',
  );

  return {
    name: 'Case-insensitive email uniqueness',
    details: 'ADMIN@EXAMPLE.TEST was rejected by the lower(email) unique index',
  };
}

async function checkExclusionConstraint(): Promise<CheckResult> {
  const anchor = await prisma.appointment.findUniqueOrThrow({
    where: { id: 'seed-appointment-003' },
    select: {
      patientId: true,
      doctorId: true,
      scheduledStart: true,
      scheduledEnd: true,
    },
  });

  await expectDatabaseError(
    () =>
      prisma.appointment.create({
        data: {
          id: 'verify-appointment-overlap',
          appointmentNumber: 'VERIFY-OVERLAP',
          patientId: anchor.patientId,
          doctorId: anchor.doctorId,
          scheduledStart: addMinutes(anchor.scheduledStart, 10),
          scheduledEnd: addMinutes(anchor.scheduledEnd, 10),
          status: 'SCHEDULED',
          createdById: 'seed-user-frontdesk',
        },
      }),
    (databaseError) => isExclusionConstraintError(databaseError, OVERLAP_CONSTRAINT),
    'Overlapping active appointments for one doctor must be rejected',
  );

  const cancelledAppointment = await prisma.appointment.create({
    data: {
      id: 'verify-appointment-cancelled',
      appointmentNumber: 'VERIFY-CANCELLED',
      patientId: anchor.patientId,
      doctorId: anchor.doctorId,
      scheduledStart: addMinutes(anchor.scheduledStart, 10),
      scheduledEnd: addMinutes(anchor.scheduledEnd, 10),
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Verification of exclusion predicate',
      createdById: 'seed-user-frontdesk',
    },
  });
  await prisma.appointment.delete({ where: { id: cancelledAppointment.id } });

  const adjacentAppointment = await prisma.appointment.create({
    data: {
      id: 'verify-appointment-adjacent',
      appointmentNumber: 'VERIFY-ADJACENT',
      patientId: anchor.patientId,
      doctorId: anchor.doctorId,
      scheduledStart: anchor.scheduledEnd,
      scheduledEnd: addMinutes(anchor.scheduledEnd, 30),
      status: 'SCHEDULED',
      createdById: 'seed-user-frontdesk',
    },
  });
  await prisma.appointment.delete({ where: { id: adjacentAppointment.id } });

  return {
    name: 'Appointment overlap exclusion constraint',
    details: 'Overlap rejected; cancelled overlap and adjacent active slot accepted',
  };
}

async function checkCheckConstraints(): Promise<CheckResult> {
  await expectDatabaseError(
    () =>
      prisma.prescriptionItem.create({
        data: {
          id: 'verify-prescription-item',
          prescriptionId: 'seed-prescription-002',
          medicationName: 'Verification item',
          dosage: '1 unit',
          frequency: 'Once',
          durationDays: 1,
          quantity: 0,
        },
      }),
    (databaseError) => isCheckConstraintError(databaseError, 'PrescriptionItem_quantity_check'),
    'Prescription item quantity must be greater than zero',
  );

  await expectDatabaseError(
    () =>
      prisma.invoiceItem.create({
        data: {
          id: 'verify-invoice-item',
          invoiceId: 'seed-invoice-003',
          description: 'Verification item',
          quantity: 2,
          unitPrice: '10.00',
          lineTotal: '10.00',
        },
      }),
    (databaseError) => isCheckConstraintError(databaseError, 'InvoiceItem_line_total_check'),
    'Invoice item line total must equal quantity multiplied by unit price',
  );

  return {
    name: 'CHECK constraint enforcement',
    details: 'Invalid prescription quantity and mismatched invoice line total were rejected',
  };
}

async function checkIdempotencyAndAppointmentServices(): Promise<CheckResult> {
  const runId = Date.now().toString(36);
  const notes = `${SERVICE_NOTE_PREFIX}${runId}`;
  const bookingKey = `${VERIFY_PREFIX}book-${runId}`;
  const doctorId = 'seed-doctor-garcia';
  const patientId = 'seed-patient-006';
  const now = new Date();
  let bookingDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2),
  );

  while (![1, 3].includes(bookingDay.getUTCDay())) {
    bookingDay = new Date(bookingDay.getTime() + 86_400_000);
  }

  const at = (hour: number, minute: number): Date =>
    new Date(
      Date.UTC(
        bookingDay.getUTCFullYear(),
        bookingDay.getUTCMonth(),
        bookingDay.getUTCDate(),
        hour,
        minute,
      ),
    );

  const firstBooking = await bookAppointment({
    actorUserId: 'seed-user-frontdesk',
    patientId,
    doctorId,
    scheduledStart: at(14, 0),
    scheduledEnd: at(14, 20),
    reason: 'Verification appointment',
    notes,
    idempotencyKey: bookingKey,
  });

  assert.equal(firstBooking.replayed, false);
  assert.equal(firstBooking.appointment.status, 'SCHEDULED');

  const replay = await bookAppointment({
    actorUserId: 'seed-user-frontdesk',
    patientId,
    doctorId,
    scheduledStart: at(14, 0),
    scheduledEnd: at(14, 20),
    reason: 'Verification appointment',
    notes,
    idempotencyKey: bookingKey,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.appointment.id, firstBooking.appointment.id);

  const reusedKeyError = await captureError(() =>
    bookAppointment({
      actorUserId: 'seed-user-frontdesk',
      patientId,
      doctorId,
      scheduledStart: at(14, 0),
      scheduledEnd: at(14, 20),
      reason: 'Different payload with the same idempotency key',
      notes,
      idempotencyKey: bookingKey,
    }),
  );
  assert.ok(reusedKeyError instanceof AppError);
  assert.equal(reusedKeyError.code, 'IDEMPOTENCY_KEY_REUSED');

  const blocker = await bookAppointment({
    actorUserId: 'seed-user-frontdesk',
    patientId: 'seed-patient-005',
    doctorId,
    scheduledStart: at(14, 20),
    scheduledEnd: at(14, 40),
    reason: 'Verification blocking appointment',
    notes,
    idempotencyKey: `${VERIFY_PREFIX}block-${runId}`,
  });
  assert.equal(blocker.appointment.status, 'SCHEDULED');

  const conflictKey = `${VERIFY_PREFIX}reschedule-conflict-${runId}`;
  const conflictScope = `appointments.reschedule:${firstBooking.appointment.id}`;
  const conflictError = await captureError(() =>
    rescheduleAppointment({
      actorUserId: 'seed-user-frontdesk',
      appointmentId: firstBooking.appointment.id,
      scheduledStart: at(14, 20),
      scheduledEnd: at(14, 40),
      reason: 'Intentional conflict with another active appointment',
      idempotencyKey: conflictKey,
    }),
  );
  assert.ok(conflictError instanceof AppError);
  assert.equal(conflictError.code, 'APPOINTMENT_SLOT_UNAVAILABLE');

  const failedIdempotencyRecord = await prisma.idempotencyKey.findUnique({
    where: {
      actorUserId_scope_key: {
        actorUserId: 'seed-user-frontdesk',
        scope: conflictScope,
        key: conflictKey,
      },
    },
  });
  assert.equal(
    failedIdempotencyRecord,
    null,
    'A failed mutation must roll back its idempotency key',
  );

  const rescheduled = await rescheduleAppointment({
    actorUserId: 'seed-user-frontdesk',
    appointmentId: firstBooking.appointment.id,
    scheduledStart: at(14, 40),
    scheduledEnd: at(15, 0),
    reason: 'Verification reschedule',
    idempotencyKey: `${VERIFY_PREFIX}reschedule-${runId}`,
  });
  assert.equal(rescheduled.appointment.status, 'SCHEDULED');
  assert.equal(rescheduled.appointment.rescheduledById, 'seed-user-frontdesk');

  const cancelKey = `${VERIFY_PREFIX}cancel-${runId}`;
  const cancelled = await cancelAppointment({
    actorUserId: 'seed-user-frontdesk',
    appointmentId: firstBooking.appointment.id,
    cancellationReason: 'Verification cancellation',
    idempotencyKey: cancelKey,
  });
  assert.equal(cancelled.appointment.status, 'CANCELLED');

  const cancelReplay = await cancelAppointment({
    actorUserId: 'seed-user-frontdesk',
    appointmentId: firstBooking.appointment.id,
    cancellationReason: 'Verification cancellation',
    idempotencyKey: cancelKey,
  });
  assert.equal(cancelReplay.replayed, true);
  assert.equal(cancelReplay.appointment.status, 'CANCELLED');

  const afterCancellation = await bookAppointment({
    actorUserId: 'seed-user-frontdesk',
    patientId: 'seed-patient-005',
    doctorId,
    scheduledStart: at(14, 0),
    scheduledEnd: at(14, 20),
    reason: 'Reuse slot released by cancellation',
    notes,
    idempotencyKey: `${VERIFY_PREFIX}after-cancel-${runId}`,
  });
  assert.equal(afterCancellation.appointment.status, 'SCHEDULED');

  return {
    name: 'Idempotent appointment service and transactions',
    details: `Booked, replayed, rejected key reuse, rejected unavailable slot, rescheduled, cancelled, replayed cancellation, and reused the freed slot`,
  };
}
async function main(): Promise<void> {
  const results: CheckResult[] = [];

  await cleanupVerificationData();

  try {
    results.push(await checkServerAndMigrations());
    results.push(await checkSchemaObjects());
    results.push(await checkSeedData());
    results.push(await checkReferentialIntegrity());
    results.push(await checkCaseInsensitiveEmailUniqueness());
    results.push(await checkExclusionConstraint());
    results.push(await checkCheckConstraints());
    results.push(await checkIdempotencyAndAppointmentServices());
  } finally {
    await cleanupVerificationData();
  }

  process.stdout.write('Database verification completed successfully.\n\n');

  for (const result of results) {
    process.stdout.write(`PASS ${result.name}\n`);
    process.stdout.write(`  ${result.details}\n`);
  }

  process.stdout.write('\n');
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Database verification failed: ${errorMessage(error)}\n`);

    if (error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

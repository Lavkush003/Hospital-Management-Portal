# Relationships, Constraints, and Concurrency

This document explains the invariants enforced by the PostgreSQL schema and the
transactional behavior expected from application services.

## Design principles

1. **One encounter is the source of truth.** `Prescription`, `DiagnosticReport`, and
   `Invoice` reference `Visit`, not `Appointment` or `Patient` directly.
2. **Master records are retained.** Patients, doctors, departments, and users are
   deactivated with status fields instead of hard-deleted.
3. **Clinical and financial history is protected.** Foreign keys use `Restrict` for
   historical parents and `Cascade` only for owned child rows.
4. **The database enforces critical invariants.** Time ordering, invoice arithmetic,
   completed-state timestamps, and doctor appointment overlap are enforced in PostgreSQL,
   not only in application code.
5. **Mutations are auditable and deduplicated.** Appointment operations write `AuditLog`
   records and participate in idempotent transactions.

## Relationship and deletion policy

| Relationship                        | Required | Delete behavior | Rationale                                              |
| ----------------------------------- | -------- | --------------- | ------------------------------------------------------ |
| `User -> Doctor`                    | Yes      | `Restrict`      | A clinician account must be explicitly separated first |
| `User -> Staff`                     | Yes      | `Restrict`      | A staff account must be explicitly separated first     |
| `Department -> Doctor`              | Yes      | `Restrict`      | Doctors must be reassigned before department removal   |
| `Department -> Staff`               | No       | `SetNull`       | Staff may be unassigned without losing the record      |
| `Doctor -> DoctorSchedule`          | Yes      | `Cascade`       | Schedules are owned by a doctor                        |
| `DoctorSchedule -> ScheduleBreak`   | Yes      | `Cascade`       | Breaks are owned by their schedule                     |
| `Doctor -> DoctorLeave`             | Yes      | `Cascade`       | Leave records are owned by their doctor                |
| `Doctor -> DoctorUnavailability`    | Yes      | `Cascade`       | Unavailability records are owned by their doctor       |
| `Patient -> Appointment`            | Yes      | `Restrict`      | Appointment history must be retained                   |
| `Doctor -> Appointment`             | Yes      | `Restrict`      | Appointment history must be retained                   |
| `User -> Appointment.createdBy`     | No       | `SetNull`       | Keep appointment if an operator account is removed     |
| `User -> Appointment.cancelledBy`   | No       | `SetNull`       | Keep cancellation history if an operator is removed    |
| `User -> Appointment.rescheduledBy` | No       | `SetNull`       | Keep reschedule metadata if an operator is removed     |
| `Appointment -> Visit`              | No       | `SetNull`       | A visit may outlive a deleted appointment reference    |
| `Patient -> Visit`                  | Yes      | `Restrict`      | Clinical encounters must not be orphaned               |
| `Doctor -> Visit`                   | Yes      | `Restrict`      | Clinical encounters must not be orphaned               |
| `Visit -> Prescription`             | Yes      | `Restrict`      | Prescriptions must not be orphaned                     |
| `Prescription -> PrescriptionItem`  | Yes      | `Cascade`       | Items are owned by their prescription                  |
| `Visit -> DiagnosticReport`         | Yes      | `Restrict`      | Diagnostic history must be retained                    |
| `Visit -> Invoice`                  | Yes      | `Restrict`      | Financial history must be retained                     |
| `Invoice -> InvoiceItem`            | Yes      | `Cascade`       | Items are owned by their invoice                       |
| `Invoice -> Payment`                | Yes      | `Restrict`      | Payments must not disappear with an invoice            |
| `User -> Payment.receivedBy`        | No       | `SetNull`       | Keep payment even if the operator account is removed   |
| `User -> AuditLog.actor`            | No       | `SetNull`       | Audit entries survive account removal                  |
| `User -> IdempotencyKey.actor`      | Yes      | `Cascade`       | Keys are scoped to their actor                         |
| `User -> RefreshToken`              | Yes      | `Cascade`       | Sessions belong to their account                       |
| `RefreshToken -> replacedByToken`   | No       | `SetNull`       | Keep rotation history if a linked session is removed   |

`Visit.appointmentId` and `Invoice.visitId` are both unique. The schema therefore permits
at most one visit per appointment and exactly one invoice per visit. The application
creates invoices through a visit, which avoids duplicate billing records for the same
clinical encounter.

## Custom CHECK constraints

Prisma cannot express these rules in `schema.prisma`, so they are added by the
`20261110070100_appointment_integrity`, `20261110073328_auth_refresh_tokens`, and
`20261110080327_scheduling_availability` migrations.

| Constraint                                       | Rule                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `Doctor_consultation_fee_nonnegative_check`      | `consultationFee >= 0`                                                 |
| `DoctorSchedule_time_order_check`                | `endTime > startTime`                                                  |
| `DoctorSchedule_slot_duration_check`             | `slotDurationMinutes BETWEEN 5 AND 240`                                |
| `DoctorScheduleBreak_time_order_check`           | `endTime > startTime`                                                  |
| `DoctorLeave_time_order_check`                   | `endAt > startAt`                                                      |
| `DoctorUnavailability_time_order_check`          | `endAt > startAt`                                                      |
| `Appointment_time_order_check`                   | `scheduledEnd > scheduledStart`                                        |
| `Appointment_cancelled_at_check`                 | A cancelled appointment must have `cancelledAt`                        |
| `Appointment_no_doctor_overlap_active_excl`      | Active appointment ranges for the same doctor cannot overlap           |
| `Visit_time_order_check`                         | `endedAt IS NULL OR endedAt >= startedAt`                              |
| `Visit_completed_requires_end_check`             | A completed visit must have `endedAt`                                  |
| `Visit_vitals_nonnegative_check`                 | Height, weight, temperature, BP, pulse, and respiratory rate > 0       |
| `Visit_oxygen_saturation_check`                  | Oxygen saturation is between 0 and 100                                 |
| `Visit_blood_pressure_order_check`               | Systolic BP must exceed diastolic BP when both are present             |
| `PrescriptionItem_quantity_check`                | `quantity > 0`                                                         |
| `PrescriptionItem_duration_check`                | `durationDays > 0`                                                     |
| `DiagnosticReport_completion_time_check`         | `completedAt IS NULL OR completedAt >= orderedAt`                      |
| `DiagnosticReport_completed_requires_date_check` | A completed report must have `completedAt`                             |
| `Invoice_subtotal_nonnegative_check`             | `subtotal >= 0`                                                        |
| `Invoice_discount_range_check`                   | `0 <= discountAmount <= subtotal`                                      |
| `Invoice_tax_nonnegative_check`                  | `taxAmount >= 0`                                                       |
| `Invoice_total_calculation_check`                | `totalAmount = subtotal - discountAmount + taxAmount`                  |
| `Invoice_issued_at_check`                        | Non-draft, non-cancelled invoices must have `issuedAt`                 |
| `InvoiceItem_quantity_check`                     | `quantity > 0`                                                         |
| `InvoiceItem_unit_price_check`                   | `unitPrice >= 0`                                                       |
| `InvoiceItem_line_total_check`                   | `lineTotal = quantity * unitPrice`                                     |
| `Payment_amount_check`                           | `amount > 0`                                                           |
| `Payment_completed_requires_date_check`          | A completed payment must have `paidAt`                                 |
| `IdempotencyKey_expiry_check`                    | `expiresAt > createdAt`                                                |
| `IdempotencyKey_response_status_check`           | `responseStatusCode IS NULL OR responseStatusCode BETWEEN 100 AND 599` |
| `RefreshToken_expiry_check`                      | `expiresAt > createdAt`                                                |
| `RefreshToken_revocation_time_check`             | `revokedAt IS NULL OR revokedAt >= createdAt`                          |
| `RefreshToken_no_self_replacement_check`         | `replacedByTokenId IS NULL OR replacedByTokenId <> id`                 |

## Appointment overlap exclusion

`btree_gist` enables equality matching on `doctorId` alongside range overlap. The
constraint is:

```sql
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_doctor_overlap_active_excl"
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tstzrange("scheduledStart", "scheduledEnd", '[)') WITH &&
  )
  WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'));
```

The half-open interval `[start, end)` means one appointment may start exactly when another
ends. `CANCELLED`, `COMPLETED`, and `NO_SHOW` appointments are excluded, so cancelled
slots are immediately reusable and historical appointments do not block booking.

Application services map PostgreSQL SQLSTATE `23P01` to an
`APPOINTMENT_SLOT_CONFLICT` error. The database remains authoritative under concurrent
booking attempts.

## Case-insensitive email uniqueness

The schema keeps Prisma's exact unique constraints and adds database-level functional
indexes:

```sql
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));
CREATE UNIQUE INDEX "Doctor_email_lower_key" ON "Doctor" (LOWER("email"));
CREATE UNIQUE INDEX "Staff_email_lower_key" ON "Staff" (LOWER("email"));
```

This prevents `admin@example.test` and `ADMIN@EXAMPLE.TEST` from becoming separate login
or contact identities while preserving the original casing of stored addresses.

## Index strategy

| Table                  | Indexes                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                 | `(role, status)`, `(lastName, firstName)`, unique `lower(email)`                                                                                                           |
| `Patient`              | `(lastName, firstName)`, `(phone)`, `(status)`, `(createdAt)`                                                                                                              |
| `Department`           | `(isActive)`                                                                                                                                                               |
| `Doctor`               | `(departmentId, status)`, `(lastName, firstName)`, `(specialization)`, unique `lower(email)`                                                                               |
| `Staff`                | `(departmentId, status)`, `(lastName, firstName)`, unique `lower(email)`                                                                                                   |
| `DoctorSchedule`       | Unique `(doctorId, dayOfWeek, startTime)`, `(doctorId, dayOfWeek, isActive)`                                                                                               |
| `DoctorScheduleBreak`  | `(scheduleId)`                                                                                                                                                             |
| `DoctorLeave`          | `(doctorId, startAt, endAt)`                                                                                                                                               |
| `DoctorUnavailability` | `(doctorId, startAt, endAt)`                                                                                                                                               |
| `Appointment`          | `(doctorId, scheduledStart, scheduledEnd)`, `(patientId, scheduledStart)`, `(status, scheduledStart)`, `(scheduledStart)`, `(createdById)`, `(cancelledById, cancelledAt)` |
| `Visit`                | `(patientId, startedAt)`, `(doctorId, startedAt)`, `(status)`, `(startedAt)`                                                                                               |
| `Prescription`         | `(visitId, issuedAt)`, `(status)`, `(issuedAt)`                                                                                                                            |
| `PrescriptionItem`     | `(prescriptionId)`                                                                                                                                                         |
| `DiagnosticReport`     | `(visitId, orderedAt)`, `(status, orderedAt)`, `(type)`                                                                                                                    |
| `Invoice`              | `(status, issuedAt)`, `(dueAt)`                                                                                                                                            |
| `InvoiceItem`          | `(invoiceId)`                                                                                                                                                              |
| `Payment`              | `(invoiceId, status)`, `(paidAt)`, `(receivedById)`                                                                                                                        |
| `AuditLog`             | `(entityType, entityId, createdAt)`, `(actorUserId, createdAt)`, `(createdAt)`, `(requestId)`                                                                              |
| `IdempotencyKey`       | Unique `(actorUserId, scope, key)`, `(expiresAt)`, `(status, expiresAt)`, `(resourceType, resourceId)`                                                                     |
| `RefreshToken`         | Unique `(tokenHash)`, unique `(replacedByTokenId)`, `(userId, familyId)`, `(familyId)`, `(expiresAt)`, `(revokedAt, expiresAt)`                                            |

Indexes support the primary access paths: finding a patient by name or phone, listing a
doctor's schedule and appointments, loading a visit timeline, reconciling invoices and
payments, and auditing by actor or entity.

## Transaction and concurrency rules

### Booking

1. Validate start/end ordering and the future-time constraint.
2. In one idempotent transaction, acquire the doctor row with `SELECT ... FOR UPDATE`.
3. Verify the doctor is active and the patient exists and is active.
4. Regenerate availability for the requested range and require an exact slot match. The
   check excludes breaks, leave, unavailability, and active appointments.
5. Create the appointment and write an `APPOINTMENT_BOOKED` audit record.
6. Mark the idempotency record `COMPLETED` with the appointment ID.
7. If the exclusion constraint still rejects the slot, the whole transaction rolls back,
   including the idempotency record and audit entry.

### Rescheduling and cancellation

1. Acquire `SELECT ... FOR UPDATE` on the appointment.
2. Verify the appointment exists and is reschedulable or cancellable.
3. Rescheduling then locks the doctor row and revalidates the new exact slot.
4. Update the appointment and write before/after audit snapshots.
5. Commit the idempotency record with the operation.
6. If another transaction booked an overlapping active slot, PostgreSQL returns
   `23P01` and the service returns `APPOINTMENT_SLOT_CONFLICT`.

`FOR UPDATE` serializes competing booking and schedule mutations for the same doctor, and
competing reschedule/cancel operations on the same appointment. The exclusion constraint
remains the final database-level guard for overlapping active appointments.

### Idempotency

- Identity is `(actorUserId, scope, key)`.
- The request hash is a SHA-256 hash of a canonicalized payload. Reusing a key with a
  different payload returns `IDEMPOTENCY_KEY_REUSED`.
- A completed key replays the original resource ID without repeating the mutation.
- A pending key returns `IDEMPOTENCY_REQUEST_IN_PROGRESS`.
- Keys expire after 24 hours in the application service; expired records can be replaced.
- Failed mutations do not leave completed keys because the key and mutation share one
  transaction.

### Refresh-token rotation

1. Hash the presented opaque token and lock the matching row with `SELECT ... FOR UPDATE`.
2. Reject missing, expired, inactive-account, or already-revoked tokens.
3. If a revoked token is presented, revoke every still-active token in its family and
   record reuse detection.
4. Otherwise, insert a replacement token in the same family, then mark the previous token
   `ROTATED` and link it through `replacedByTokenId`.
5. Logout revokes the whole family. Password changes revoke every active token for the user
   and increment `User.authVersion`, invalidating outstanding access tokens.

Refresh-token values are never stored directly. Only an HMAC-SHA-256 hash keyed with
`JWT_REFRESH_SECRET` is persisted, so a database disclosure does not expose usable tokens.

## Time, date, and money rules

- All event timestamps use `timestamptz(3)`.
- Date of birth and hire date use `date`.
- Weekly schedule boundaries and breaks use `time(0)` and are recurring. They are evaluated
  in UTC and do not encode a date or doctor-specific time zone.
- Leave, unavailability, and appointment ranges use half-open intervals.
- Money uses exact `numeric(12,2)` arithmetic. The database enforces invoice and line-total
  formulas so floating-point drift cannot create inconsistent balances.

## Verification

Run the database checks against a migrated and seeded database:

```bash
npm run db:verify
```

The verification script checks:

- PostgreSQL connectivity and the four applied migrations.
- All 20 model tables, `btree_gist`, 33 custom constraints, and three lower-email indexes.
- Seeded row counts, including schedule breaks, leave, and unavailability, plus absence of
  orphan visits, invoices, payments, and prescription items.
- Case-insensitive email rejection.
- Overlap rejection, cancelled-overlap acceptance, and adjacent-slot acceptance.
- Representative CHECK constraint failures.
- Appointment service booking, idempotent replay, key reuse rejection, overlap rejection,
  rescheduling, cancellation, cancellation replay, and reuse of a freed slot.

The script cleans up all `verify-` records and service-created verification appointments in
a `finally` block.

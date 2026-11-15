# Business Rules

## Identity and access

- Roles are `ADMIN`, `RECEPTIONIST` and `DOCTOR`.
- `ADMIN` can manage doctors, departments, schedules, staff, reports and audit logs.
- `RECEPTIONIST` can manage patients, appointments and billing, and can read doctors and departments.
- `DOCTOR` can read assigned patients and manage their own encounters, prescriptions and diagnostic reports.
- Doctor patient access is derived from existing appointments and encounters. Unassigned patients return `403 PATIENT_NOT_ASSIGNED`.
- A doctor's appointment and clinical queries are automatically scoped to that doctor.
- Users authenticate with email and password. Passwords are bcrypt hashes; JWTs expire after `JWT_EXPIRES_IN` (8 hours by default).

## Patients

- Patient IDs use the `PAT-######` prefix.
- Required fields: first name, last name, date of birth, gender and phone.
- A patient must be `ACTIVE` to receive a new appointment.
- Only `ADMIN` can change patient status.
- Patient deletion is not supported.

## Doctors and departments

- Doctor IDs use `DOC-######`; staff IDs use `EMP-######`.
- Creating a doctor creates a linked `User` account and requires a department.
- A doctor has weekly working days, shift hours, slot duration and a consultation fee.
- Doctor status is `ACTIVE`, `ON_LEAVE` or `INACTIVE`.
- Only active doctors accept new appointments.
- A department with linked doctors, staff or appointment history cannot be deleted.
- Department codes are unique and uppercase.

## Schedules and availability

- A schedule block defines a doctor, day of week (`0` Sunday to `6` Saturday), start/end time, slot duration, room and active flag.
- Availability is generated from active schedule blocks for the requested date.
- Slots already reserved or occupied by an active appointment are excluded.
- Bookings must align exactly with the slot grid, fit within the schedule block, and not be in the past.

## Appointments

- Appointment numbers use the `APT-######` prefix.
- Allowed statuses: `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Allowed transitions:
  - `BOOKED → CONFIRMED | CHECKED_IN | CANCELLED | NO_SHOW`
  - `CONFIRMED → CHECKED_IN | CANCELLED | NO_SHOW`
  - `CHECKED_IN → IN_PROGRESS | CANCELLED | NO_SHOW`
  - `IN_PROGRESS → COMPLETED | CANCELLED`
  - `COMPLETED`, `CANCELLED`, `NO_SHOW` are terminal.
- A doctor cannot have overlapping non-cancelled appointments.
- A unique slot reservation on `(doctor, date, startTime)` prevents concurrent double booking.
- Cancellation records the actor, time and reason, and releases the slot reservation.
- Rescheduling validates the new slot, releases the old reservation and creates a new one.
- Patients and doctors can only access appointments they are assigned to through the role scope.

## Clinical records

- Encounter IDs use `ENC-######`, prescription IDs `RX-######`, report IDs `DR-######`.
- Only doctors can create encounters. The encounter is always owned by the authenticated doctor.
- An appointment can produce at most one encounter (unique sparse index).
- Creating an encounter for an appointment moves `BOOKED`, `CONFIRMED` or `CHECKED_IN` appointments to `IN_PROGRESS`.
- Completing an encounter moves its linked appointment to `COMPLETED`.
- Completed or cancelled encounters are read-only.
- Vitals are optional; clinical notes and treatment notes are recorded in text fields.
- A prescription requires an encounter owned by the prescribing doctor and a patient matching that encounter.
- A prescription requires at least one medicine with name, dosage, frequency and duration.
- Diagnostic reports can be linked to an encounter or created for an assigned patient.
- Doctors update their own reports; administrators can update any report.

## Billing

- Invoice numbers use `INV-######`; payment numbers use `PAY-######`.
- Invoice line items require a description, quantity (`>= 1`) and unit price (`>= 0`).
- The server recalculates subtotal, discount, tax and total; client totals are never trusted.
- Invoice statuses: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`, `CANCELLED`.
- Payments must be greater than zero and cannot exceed the outstanding balance.
- Successful payments atomically reduce `balanceDue` and increase `amountPaid`.
- A zero-total invoice is immediately `PAID`.
- Payment methods: `CASH`, `CARD`, `UPI`, `INSURANCE`, `OTHER`.
- The current payment gateway is simulated; payment records are marked `simulated: true`.
- An optional idempotency key prevents duplicate payment recording.

## Audit and traceability

- Audit entries record actor, role, action, resource type/ID, outcome, metadata, IP, user agent and request ID.
- Audit logs are immutable: update and delete operations are blocked at the model layer.
- Successful and failed logins are audited.
- Sensitive operations such as patient updates, appointment changes, clinical notes, prescriptions, payments and staff changes are audited.

## IDs and timestamps

- Human-readable IDs are generated through the `Counter` collection.
- Appointment dates are stored as `YYYY-MM-DD` keys; times are `HH:mm`.
- Most event timestamps are stored as `Date` values and rendered in the client's local timezone.
- Search is case-insensitive and uses escaped regular expressions.

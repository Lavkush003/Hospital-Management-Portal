# Relationships and Constraints

MongoDB does not enforce foreign keys. References are declared with Mongoose `ObjectId` and `ref`, and services validate them before writes. There are no cascading deletes.

## Relationship graph

```text
User 1 ─── 1 Doctor ─── * DoctorSchedule
  │           │
  │           ├── * Appointment ─── 1 Patient
  │           ├── * Encounter ───── 1 Patient
  │           │       ├── * Prescription
  │           │       └── * DiagnosticReport
  │           └── * DiagnosticReport
  │
  └── 1 Staff ─── 0..1 Department

Department 1 ─── * Doctor
Department 1 ─── * Staff
Department 1 ─── * Appointment
Department.head ── 0..1 Doctor

Appointment 1 ─── 0..1 Encounter
Appointment 1 ─── 0..1 AppointmentSlotReservation
Appointment 1 ─── * Invoice

Patient 1 ─── * Appointment
Patient 1 ─── * Encounter
Patient 1 ─── * Prescription
Patient 1 ─── * DiagnosticReport
Patient 1 ─── * Invoice

Invoice 1 ─── * Payment
```

## Referential rules

| Relation | Rule |
|---|---|
| Doctor → User | Required and unique; the linked user has role `DOCTOR` |
| Staff → User | Required and unique; role is `ADMIN` or `RECEPTIONIST` |
| Doctor → Department | Required; department must exist and be active on creation |
| Appointment → Patient | Patient must exist and be `ACTIVE` |
| Appointment → Doctor | Doctor must exist and be `ACTIVE` |
| Appointment → Department | Copied from the doctor at booking time |
| Encounter → Appointment | Optional, but at most one encounter per appointment; patient and doctor must match |
| Prescription → Encounter | Required; patient must match and the doctor must own the encounter |
| DiagnosticReport → Encounter | Optional; used for clinical context |
| Invoice → Patient | Required |
| Payment → Invoice | Invoice must exist and have sufficient outstanding balance |

## Unique indexes

| Collection | Unique key | Purpose |
|---|---|---|
| `users` | `email` | One login per email |
| `patients` | `patientId` | Human-readable patient ID |
| `departments` | `name`, `code` | Department identity |
| `doctors` | `doctorId`, `userId`, `email` | Doctor identity and one account |
| `staff` | `employeeId`, `userId`, `email` | Staff identity and one account |
| `doctorschedules` | `(doctor, dayOfWeek, startTime)` | Prevent duplicate schedule blocks |
| `appointments` | `appointmentNumber` | Human-readable booking ID |
| `appointmentslotreservations` | `(doctor, date, startTime)` | Race-safe slot ownership |
| `encounters` | `encounterId`, sparse `appointment` | One encounter per optional appointment |
| `prescriptions` | `prescriptionId` | Human-readable prescription ID |
| `diagnosticreports` | `reportId` | Human-readable report ID |
| `invoices` | `invoiceNumber` | Human-readable invoice ID |
| `payments` | `paymentNumber`, sparse `transactionRef`, sparse `idempotencyKey` | Payment identity and duplicate protection |
| `auditlogs` | none | Append-only event stream |
| `counters` | `_id` | Atomic sequence per entity |

## Performance indexes

- Appointments: doctor/date/start, patient/date, status/date and date.
- Encounters: patient/date, doctor/date, status.
- Prescriptions and reports: patient/date, doctor/date; reports also status and category.
- Invoices: patient/date, status, invoice date.
- Payments: invoice/status, paid date, idempotency key.
- Audit logs: actor/date, resource type/resource ID/date, created date.

## Application-level constraints

- Appointment transitions follow the state machine in `backend/src/constants/enums.js`.
- Appointment slot alignment, schedule membership, past-date checks and overlap checks are enforced in `appointment.service.js`.
- Slot reservation is the concurrency barrier; duplicate reservation keys surface as `409 SLOT_TAKEN`.
- Cancellation and rescheduling maintain reservations so availability remains accurate.
- Completed and cancelled encounters cannot be edited except for the completion operation.
- Invoice totals are recalculated from line items, discount and tax.
- Payments cannot exceed `balanceDue`; overpayment is rejected.
- Department deletion is blocked when doctors, staff or appointments reference it.
- Audit logs block update and delete middleware.
- There is no hard-delete endpoint for patients, doctors or staff.

## Date and time conventions

- Appointment `date` is a `YYYY-MM-DD` string.
- Times are `HH:mm` 24-hour strings.
- Query date filters use UTC day boundaries for `Date` fields.
- Availability uses the server's local clock for past-slot checks.

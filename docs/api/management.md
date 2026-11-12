# Management API

All routes are mounted under `/api` and require a Bearer access token. The management API covers patients, doctors, departments, staff, recurring schedules and
availability, appointment booking, clinical encounter records, and billing.

This document complements [authentication.md](authentication.md), which defines session
handling, CSRF, token errors, and the shared error envelope.

## Conventions

- Date-only fields use `YYYY-MM-DD` and are interpreted as UTC midnight.
- Timestamp fields use ISO 8601 with an explicit offset, for example
  `2026-11-16T09:00:00.000Z`.
- Recurring schedule times use 24-hour `HH:mm` strings in UTC.
- Availability ranges use half-open intervals: a slot starting at `10:30` may follow one
  ending at `10:30`.
- List endpoints accept `page` (default `1`) and `pageSize` (default `20`, maximum `100`).
- Request bodies are strict. Unknown fields return `400 VALIDATION_ERROR`.
- Mutating appointment routes accept an `Idempotency-Key` header, or an `idempotencyKey`
  body field, with at least 8 characters. Successful replays return the original resource.

Success responses use resource envelopes such as `{ "patient": { ... } }`,
`{ "doctors": [...], "pagination": { ... } }`, and
`{ "appointment": { ... }, "replayed": false }`.

## Role permissions

| Permission               | Admin | Front desk | Clinician |
| ------------------------ | ----- | ---------- | --------- |
| `patients:create`        | Yes   | Yes        | No        |
| `patients:read`          | Yes   | Yes        | Yes       |
| `patients:update`        | Yes   | Yes        | No        |
| `patients:clinical:read` | Yes   | No         | Yes       |
| `doctors:read`           | Yes   | Yes        | Yes       |
| `doctors:manage`         | Yes   | No         | No        |
| `departments:read`       | Yes   | Yes        | Yes       |
| `departments:manage`     | Yes   | No         | No        |
| `staff:read`             | Yes   | No         | No        |
| `staff:manage`           | Yes   | No         | No        |
| `appointments:read`      | Yes   | Yes        | Yes       |
| `appointments:manage`    | Yes   | Yes        | No        |
| `schedules:read`         | Yes   | Yes        | Yes       |
| `schedules:manage`       | Yes   | No         | No        |
| `clinical:read`         | Yes   | No         | Yes       |
| `clinical:manage`       | Yes   | No         | Yes       |
| `billing:read`          | Yes   | Yes        | No        |
| `billing:manage`        | Yes   | Yes        | No        |

Clinicians are additionally scoped to their own doctor profile for schedules and encounter
modifications, and to patients they are assigned to through appointments or visits.
Front-desk users cannot read or modify clinical encounter records.

## Patients

| Method and path           | Permission        | Notes                                                       |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| `GET /api/patients`       | `patients:read`   | Filters: `search`, `status`, `gender`, `bloodGroup`, `city`; clinicians only see assigned patients |
| `POST /api/patients`      | `patients:create` | Generates `patientNumber`; returns `201`                    |
| `GET /api/patients/:id`   | `patients:read`   | Clinicians receive `404 PATIENT_NOT_FOUND` when unassigned  |
| `PATCH /api/patients/:id` | `patients:update` | Partial update; at least one field required                 |

Create accepts demographics, contact fields, emergency contact, and optional `allergies` and
`notes`. Responses omit `allergies` and `notes` unless the caller holds
`patients:clinical:read`. A request without that permission that tries to set either clinical
field returns `403 CLINICAL_FIELDS_FORBIDDEN`. Admin and clinician reads return the complete
record subject to clinician assignment scoping, which also applies to the list endpoint.

Additional errors: `PATIENT_IDENTIFIER_CONFLICT`, `PATIENT_NOT_ACTIVE`, `VALIDATION_ERROR`.

## Departments

| Method and path                     | Permission           | Notes                               |
| ----------------------------------- | -------------------- | ----------------------------------- |
| `GET /api/departments`              | `departments:read`   | Filters: `search`, `isActive`       |
| `POST /api/departments`             | `departments:manage` | Codes are uppercased; returns `201` |
| `GET /api/departments/:id`          | `departments:read`   | Includes assigned doctors           |
| `PATCH /api/departments/:id`        | `departments:manage` | Partial update                      |
| `POST /api/departments/:id/doctors` | `departments:manage` | Body `{ "doctorIds": [...] }`       |

Assigning doctors moves them into the department in one transaction and writes
`DOCTOR_DEPARTMENT_ASSIGNED`. Conflicts use `DEPARTMENT_CODE_CONFLICT` and
`DEPARTMENT_NAME_CONFLICT`.

## Doctors

| Method and path                 | Permission       | Notes                                                         |
| ------------------------------- | ---------------- | ------------------------------------------------------------- |
| `GET /api/doctors`              | `doctors:read`   | Filters: `search`, `departmentId`, `specialization`, `status` |
| `POST /api/doctors`             | `doctors:manage` | Creates the clinician user and doctor profile                 |
| `GET /api/doctors/:id`          | `doctors:read`   | Includes department and schedule summary; clinicians viewing another doctor receive the directory profile without schedules, leave, and unavailability |
| `PATCH /api/doctors/:id`        | `doctors:manage` | Syncs linked user identity fields                             |
| `PATCH /api/doctors/:id/status` | `doctors:manage` | Body `{ "status", "reason?" }`                                |

Doctor creation requires `email`, a password of at least 12 characters, `employeeCode`,
`departmentId`, `licenseNumber`, and `specialization`. Clinician user accounts are created
with role `CLINICIAN`. Deactivating a doctor sets the linked user to `INACTIVE`, increments
its `authVersion`, and revokes active refresh tokens. Reactivating restores `ACTIVE`.

Conflicts: `DOCTOR_EMAIL_CONFLICT`, `DOCTOR_EMPLOYEE_CODE_CONFLICT`, `DOCTOR_LICENSE_CONFLICT`.
Inactive doctors cannot receive new appointments (`DOCTOR_NOT_ACTIVE`).

## Staff

| Method and path               | Permission     | Notes                                                 |
| ----------------------------- | -------------- | ----------------------------------------------------- |
| `GET /api/staff`              | `staff:read`   | Filters: `search`, `departmentId`, `status`, `role`   |
| `POST /api/staff`             | `staff:manage` | Creates a user and staff profile; returns `201`       |
| `GET /api/staff/:id`          | `staff:read`   | Includes linked user and department                   |
| `PATCH /api/staff/:id`        | `staff:manage` | Partial update                                        |
| `PATCH /api/staff/:id/status` | `staff:manage` | Body `{ "status", "reason?" }`                        |
| `PATCH /api/staff/:id/role`   | `staff:manage` | Body `{ "role": "ADMIN" \| "FRONT_DESK", "reason?" }` |

Staff roles are limited to `ADMIN` and `FRONT_DESK`. Role or status changes increment the
linked user's `authVersion`, so existing access tokens are rejected immediately and refresh
tokens are revoked. `TERMINATED`, `INACTIVE`, and `ON_LEAVE` staff map to an inactive user
account. Conflicts use `STAFF_EMAIL_CONFLICT` and `STAFF_EMPLOYEE_CODE_CONFLICT`.

## Schedules and availability

| Method and path                                       | Permission         | Notes                                |
| ----------------------------------------------------- | ------------------ | ------------------------------------ |
| `GET /api/doctors/:doctorId/schedule`                 | `schedules:read`   | Compatibility read of weekly blocks  |
| `GET /api/doctors/:doctorId/schedules`                | `schedules:read`   | Returns all recurring blocks         |
| `POST /api/doctors/:doctorId/schedules`               | `schedules:manage` | Creates a block with optional breaks |
| `PATCH /api/doctors/:doctorId/schedules/:scheduleId`  | `schedules:manage` | Replaces breaks when supplied        |
| `DELETE /api/doctors/:doctorId/schedules/:scheduleId` | `schedules:manage` | Returns `204`                        |
| `GET /api/doctors/:doctorId/leaves`                   | `schedules:read`   | Filters: `start`, `end`              |
| `POST /api/doctors/:doctorId/leaves`                  | `schedules:manage` | Body `{ startAt, endAt, reason? }`   |
| `DELETE /api/doctors/:doctorId/leaves/:leaveId`       | `schedules:manage` | Returns `204`                        |
| `GET /api/doctors/:doctorId/unavailability`           | `schedules:read`   | Filters: `start`, `end`              |
| `POST /api/doctors/:doctorId/unavailability`          | `schedules:manage` | Body `{ startAt, endAt, reason? }`   |
| `DELETE /api/doctors/:doctorId/unavailability/:id`    | `schedules:manage` | Returns `204`                        |

Schedule create body:

```json
{
  "dayOfWeek": "MONDAY",
  "startTime": "09:00",
  "endTime": "12:00",
  "slotDurationMinutes": 30,
  "breakTimes": [{ "startTime": "10:00", "endTime": "10:30" }],
  "room": "C-101"
}
```

Rules:

- Schedule slot duration must be between 5 and 240 minutes and cannot exceed the schedule window.
- Schedule end must be after start, and break end after break start.
- Breaks must lie inside the schedule and cannot overlap each other.
- A doctor cannot have two schedules with the same day and start time.
- Leave and unavailability ranges must not overlap existing ranges of the same kind.
- Schedule, break, leave, and unavailability mutations lock the doctor row so booking and
  availability checks see a consistent calendar.

Errors include `SCHEDULE_TIME_INVALID`, `SCHEDULE_DURATION_INVALID`,
`SCHEDULE_BREAK_TIME_INVALID`, `SCHEDULE_BREAK_OUT_OF_BOUNDS`,
`SCHEDULE_BREAK_OVERLAP`, `SCHEDULE_CONFLICT`, `DOCTOR_LEAVE_OVERLAP`,
`DOCTOR_UNAVAILABILITY_OVERLAP`, `SCHEDULE_NOT_FOUND`, `DOCTOR_LEAVE_NOT_FOUND`, and
`DOCTOR_UNAVAILABILITY_NOT_FOUND`.

## Appointment availability

| Method and path                           | Permission          | Query parameters                                                                  |
| ----------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `GET /api/appointments/available-slots`   | `appointments:read` | `doctorId`, `start`, `end`                                                        |
| `GET /api/appointments/available-doctors` | `appointments:read` | `start`, `end`, `search?`, `departmentId?`, `specialization?`, `page`, `pageSize` |

`available-slots` returns ordered 30-minute-style slots derived from the doctor's recurring
schedule and slot duration. Slots are removed when they intersect a schedule break, leave,
unavailability, or an active appointment. The range cannot exceed 31 days.

```json
{
  "doctorId": "doctor-id",
  "start": "2026-11-16T08:00:00.000Z",
  "end": "2026-11-16T12:00:00.000Z",
  "timezone": "UTC",
  "slots": [
    {
      "start": "2026-11-16T09:00:00.000Z",
      "end": "2026-11-16T09:30:00.000Z"
    }
  ]
}
```

`available-doctors` returns active doctors with `availableSlotCount` and
`nextAvailableSlot` for the requested range.

## Appointments

| Method and path                                    | Permission            | Notes                                                              |
| -------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `GET /api/appointments`                            | `appointments:read`   | Filters: `status`, `doctorId`, `patientId`, `from`, `to`, `search` |
| `POST /api/appointments`                           | `appointments:manage` | Books an exact available slot; returns `201`                       |
| `GET /api/appointments/:appointmentId`             | `appointments:read`   | Clinicians only see their own appointments                         |
| `POST /api/appointments/:appointmentId/reschedule` | `appointments:manage` | Requires a new available slot                                      |
| `POST /api/appointments/:appointmentId/cancel`     | `appointments:manage` | Requires `cancellationReason`                                      |
| `PATCH /api/appointments/:appointmentId/status`    | `appointments:manage` | Advances lifecycle status                                          |

Booking request:

```json
{
  "patientId": "patient-id",
  "doctorId": "doctor-id",
  "scheduledStart": "2026-11-16T09:00:00.000Z",
  "scheduledEnd": "2026-11-16T09:30:00.000Z",
  "reason": "Follow-up consultation"
}
```

Send `Idempotency-Key: <key>` with booking, reschedule, and cancel. A replay with the same key
and payload returns the original resource and `204`-style semantics via `replayed: true`.
Reusing a key with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.

The start must be in the future, the end must be after the start, and the range must exactly
match a generated slot. Booking and rescheduling lock the doctor row, then revalidate
availability inside the transaction. The database exclusion constraint remains the final
guard against concurrent overlaps.

### Status transitions

```text
SCHEDULED   -> CONFIRMED | NO_SHOW
CONFIRMED   -> CHECKED_IN | NO_SHOW
CHECKED_IN  -> IN_PROGRESS | NO_SHOW
IN_PROGRESS -> COMPLETED
```

Cancellation is a separate operation and is allowed only from `SCHEDULED` or `CONFIRMED`.
Rescheduling is allowed only from `SCHEDULED` or `CONFIRMED`. Completed, cancelled, and
no-show appointments are terminal for the status endpoint.

Appointment errors include `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_SLOT_UNAVAILABLE`,
`APPOINTMENT_SLOT_CONFLICT`, `APPOINTMENT_NOT_RESCHEDULABLE`, `APPOINTMENT_NOT_CANCELLABLE`,
`APPOINTMENT_STATUS_TRANSITION_INVALID`, `APPOINTMENT_STATUS_UNCHANGED`,
`APPOINTMENT_CANCELLATION_REQUIRED`, and `APPOINTMENT_REFERENCE_CONFLICT`.

## Clinical records

All clinical routes require authentication and `clinical:read` or `clinical:manage`.
Administrators have both permissions. Clinicians can access records only for patients
assigned through an appointment or encounter. Encounter writes require the responsible
clinician; clinical-note edits are restricted to the note author (or an administrator).
Front-desk users have neither permission. Clinical responses are not cacheable, and
cross-patient encounter reads return `404 VISIT_NOT_FOUND`.

| Method and path | Permission | Purpose |
| --------------- | ---------- | ------- |
| `GET /api/visits` | `clinical:read` | List encounters; supports patient, clinician, appointment, status, date range, and text filters |
| `POST /api/visits` | `clinical:manage` | Create an encounter linked to a patient, clinician, and optionally an appointment |
| `GET /api/visits/:visitId` | `clinical:read` | Read encounter and its clinical notes, prescriptions, and diagnostic reports |
| `PATCH /api/visits/:visitId` | `clinical:manage` | Update complaint, diagnosis, clinical text, vitals, and follow-up metadata |
| `PATCH /api/visits/:visitId/status` | `clinical:manage` | Apply an allowed encounter status transition |
| `GET/POST /api/visits/:visitId/notes` | `clinical:read` / `clinical:manage` | List or create notes |
| `GET/PATCH /api/visits/:visitId/notes/:noteId` | `clinical:read` / `clinical:manage` | Read a note with revision history or revise its content |
| `GET/POST /api/visits/:visitId/prescriptions` | `clinical:read` / `clinical:manage` | List or create prescriptions with one or more items |
| `GET /api/visits/:visitId/prescriptions/:prescriptionId` | `clinical:read` | Read a prescription and its items |
| `PATCH /api/visits/:visitId/prescriptions/:prescriptionId/status` | `clinical:manage` | Advance or cancel prescription status |
| `GET/POST /api/visits/:visitId/reports` | `clinical:read` / `clinical:manage` | List or create diagnostic report metadata |
| `GET/PATCH /api/visits/:visitId/reports/:reportId` | `clinical:read` / `clinical:manage` | Read a report or update its metadata/status |
| `GET /api/patients/:patientId/clinical-summary` | `clinical:read` | Read the patient's clinical history, prescriptions, reports, and notes |

Encounter creation requires `patientId`; clinicians are linked to their own doctor profile
automatically, while administrators must supply `doctorId`. `appointmentId` is optional and,
when supplied, must belong to the same patient and clinician. `startedAt` records the visit
date; `followUpAt` and `followUpNotes` capture follow-up details. Optional `vitals` include
height, weight, temperature, blood pressure, heart rate, respiratory rate, and oxygen
saturation. Visit status transitions are `PLANNED -> IN_PROGRESS -> COMPLETED`, with
cancellation permitted before completion.

Prescription items require `medicationName`, `dosage`, `frequency`, `durationDays` (1–730),
and `quantity` (1–10,000); `instructions` are optional. A prescription may contain 1–20
items and may specify `issuedAt` and prescription-level `notes`. Diagnostic reports record
`testName`, `type`, `orderedAt`, optional result summary/details, and optional file-reference
metadata; statuses progress from `ORDERED` to `COLLECTED`, `PROCESSING`, and `COMPLETED`,
with cancellation allowed before completion. This API stores file metadata only, not
uploaded file contents. Clinical notes accept `content`; updates also accept an optional
`editReason` and preserve each material revision, including previous and replacement
content, editor, timestamp, and reason. Status changes and clinical mutations are recorded
in the audit log. No automated diagnosis or medical recommendations are generated.

## Billing

Billing routes require `billing:read` or `billing:manage`. Administrators and front-desk
users receive both permissions; clinicians receive neither. Invoice and payment reads and
mutations are audited. Invoice edits are allowed only while an invoice is `DRAFT` and has no
payments; issued financial details are immutable, with changes preserved in invoice history.

| Method and path | Permission | Purpose |
| --------------- | ---------- | ------- |
| `GET /api/billing/invoices` | `billing:read` | Paginated invoice list; filter by patient, visit, appointment, status, and invoice date |
| `POST /api/billing/invoices` | `billing:manage` | Create a draft invoice with line items |
| `GET /api/billing/invoices/:invoiceId` | `billing:read` | Read invoice, patient/link details, items, and payments |
| `PATCH /api/billing/invoices/:invoiceId` | `billing:manage` | Update a draft invoice's links, dates, currency, notes, or complete item list |
| `PATCH /api/billing/invoices/:invoiceId/status` | `billing:manage` | Issue, mark overdue, or void an invoice using valid transitions |
| `GET /api/billing/invoices/:invoiceId/history` | `billing:read` | Read immutable audit history for the invoice and its payments |
| `GET /api/billing/invoices/:invoiceId/payments` | `billing:read` | List pending, successful, and failed payment attempts |
| `POST /api/billing/invoices/:invoiceId/payments` | `billing:manage` | Create a simulated pending payment attempt; requires an idempotency key |
| `GET /api/billing/payments/:paymentId` | `billing:read` | Read payment status and reference |
| `PATCH /api/billing/payments/:paymentId/status` | `billing:manage` | Process a pending payment as `SUCCESSFUL` or `FAILED` |

Invoice creation requires `patientId`, `dueAt`, and 1–100 `items`. `visitId` and
`appointmentId` are optional; each supplied link must belong to the same patient. Each item
requires `description`, positive integer `quantity` (up to 1,000,000), and `unitPrice`.
`discountAmount` and `taxAmount` are optional fixed currency amounts per line item (default
zero); discount cannot exceed that line's gross amount. Amounts accept decimal strings or
JSON numbers with at most two fractional digits. The backend calculates line totals and
invoice subtotal, discount, tax, and grand total using integer cents; client-supplied totals
are rejected. `invoiceDate` defaults to the current time, `currency` defaults to `USD`, and
the due date cannot precede the invoice date.

Invoice status transitions are `DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID`. An issued or
partially paid invoice may be marked `OVERDUE` only after its due date and while a balance
remains. Draft, issued, partially paid, or overdue invoices can be voided only when they
have no successful or pending payments. Partial and paid statuses are derived from successful
payments, never manually assigned.

Payment creation always records a `PENDING` attempt; it never charges a real payment
instrument. Supply `Idempotency-Key` (8–200 characters) to prevent duplicate payment
requests; replays return the original payment and `replayed: true`. `paymentNumber` is the
generated payment reference; an optional `externalReference` must be unique. Processing a
payment is a separate status update. Only a transition from `PENDING` to `SUCCESSFUL` records
`paidAt` and applies the payment to the invoice balance. A failed payment remains failed and
does not affect the balance. Pending amounts reserve balance; a new pending payment or
successful processing that exceeds the unreserved invoice total is rejected.

Invoice history includes invoice snapshots and related payment creation/status events. Audit
actions include `INVOICE_CREATED`, `INVOICE_UPDATED`, `INVOICE_STATUS_CHANGED`,
`INVOICE_PAYMENT_RECONCILED`, `PAYMENT_CREATED`, and `PAYMENT_STATUS_CHANGED`, plus
`INVOICE_READ`, `INVOICE_LIST_READ`, `INVOICE_HISTORY_READ`, `PAYMENT_READ`, and
`PAYMENT_LIST_READ`.

## Audit events

Management mutations write `AuditLog` records with request metadata:

- `PATIENT_CREATED`, `PATIENT_UPDATED`
- `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`
- `DOCTOR_CREATED`, `DOCTOR_UPDATED`, `DOCTOR_STATUS_CHANGED`,
  `DOCTOR_DEPARTMENT_ASSIGNED`
- `STAFF_CREATED`, `STAFF_UPDATED`, `STAFF_ACCESS_UPDATED`, `STAFF_STATUS_CHANGED`,
  `STAFF_ROLE_CHANGED`
- `DOCTOR_SCHEDULE_CREATED`, `DOCTOR_SCHEDULE_UPDATED`, `DOCTOR_SCHEDULE_DELETED`
- `DOCTOR_LEAVE_CREATED`, `DOCTOR_LEAVE_DELETED`
- `DOCTOR_UNAVAILABILITY_CREATED`, `DOCTOR_UNAVAILABILITY_DELETED`
- `APPOINTMENT_BOOKED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`,
  `APPOINTMENT_STATUS_CHANGED`
- `VISIT_CREATED`, `VISIT_UPDATED`, `VISIT_STATUS_CHANGED`, `VISIT_READ`, `VISIT_LIST_READ`
- `CLINICAL_NOTE_CREATED`, `CLINICAL_NOTE_READ`, `CLINICAL_NOTE_REVISED`,
  `CLINICAL_NOTES_LIST_READ`
- `PRESCRIPTION_CREATED`, `PRESCRIPTION_READ`, `PRESCRIPTION_STATUS_CHANGED`,
  `PRESCRIPTIONS_LIST_READ`
- `DIAGNOSTIC_REPORT_CREATED`, `DIAGNOSTIC_REPORT_READ`, `DIAGNOSTIC_REPORT_UPDATED`,
  `DIAGNOSTIC_REPORTS_LIST_READ`
- `PATIENT_CLINICAL_SUMMARY_READ`
- `PATIENT_CLINICAL_FIELDS_READ`, `PATIENT_CLINICAL_FIELDS_LIST_READ`

Audit snapshots and metadata never include password hashes or raw tokens.

## Analytics and audit log

These administrative endpoints require `users:manage` (administrator only):

| Method and path                  | Notes |
| -------------------------------- | ----- |
| `GET /api/admin/analytics`       | Dashboard totals, daily appointments, billing totals, and doctor utilization |
| `GET /api/admin/reports`         | Daily/monthly, department/doctor, billing, payment, and outstanding invoice reports |
| `GET /api/admin/audit-logs`      | Paginated audit events with outcome and resource/request metadata |

Analytics and report requests require ISO timestamps `from` and `to`; `to` must be on or
after `from`, and the interval cannot exceed 366 days. Reports also accept `page`,
`pageSize`, and `search` (for the outstanding invoice list). Audit log requests accept
`page`, `pageSize`, `from`, `to`, `action`, `entityType`, `actorUserId`, `search`, and
`outcome` (`SUCCESS` or `FAILURE`).

Dashboard and report totals are calculated from PostgreSQL records rather than client-side
page samples. Financial totals are separated by currency. Audit events record the actor,
action, resource, outcome, timestamp, and available request metadata. The audit-log listing
does not return raw before/after snapshots or metadata, preventing clinical content from
being exposed through the log UI. Authentication failure events omit attempted passwords,
tokens, and unknown-account email addresses. The Reports page exports aggregate summaries
to CSV; patient-level outstanding invoice rows are not included in that export.

## Verification

Management integration tests are in `backend/tests/management.test.ts` and run with the auth
suite:

```bash
npm test
```

The tests use isolated `mgmttest-` fixtures and remove them before and after the run. They
cover CRUD, RBAC, clinical field protection, doctor/staff session revocation, schedule and
availability computation, idempotent booking, concurrent booking, rescheduling,
cancellation, status transitions, filtering, and audit records.

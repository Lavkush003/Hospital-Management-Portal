# Management APIs

Administrative functionality is grouped into staff, doctor, department, schedule, reporting and audit endpoints. All routes below require authentication; the role column indicates the minimum privilege.

## Staff accounts

`/staff` is admin-only.

- `GET /staff` filters by `q`, `role`, `status`, `department` and sorts by `createdAt`, `firstName` or `lastName`.
- `POST /staff` creates a `User` with role `ADMIN` or `RECEPTIONIST`; the default password is the configured seed password if omitted.
- `PUT /staff/:id` updates profile, role, department, job title or status.
- `PATCH /staff/:id/status` sets `ACTIVE`, `ON_LEAVE`, `INACTIVE` or `TERMINATED`.
- The response never includes a password hash.
- Deleting staff is not exposed through the HTTP API; deactivate accounts instead.

## Doctors

- Everyone authenticated can list and read doctors.
- Only admins can create, edit or change doctor status.
- Creating a doctor also creates a linked login account. The email must be unique.
- Doctor records include department, specialization, qualification, experience, consultation fee, working days, working hours, appointment duration and bio.
- An inactive or on-leave doctor cannot receive new appointments.
- Deleting a doctor is not exposed; use status changes.

## Departments

- Everyone authenticated can list departments; admins manage them.
- Codes are unique. Names and codes are trimmed.
- A department can have a head doctor.
- Deletion is refused if doctors, staff or appointment history reference the department.

## Schedules

- Admin-only writes; all authenticated users can read.
- A schedule block stores the doctor, weekday, start/end time, slot duration, room and active state.
- Start time must be earlier than end time.
- Availability generation ignores inactive blocks and removes reserved or already-booked slots.
- Deleting a schedule block does not delete existing appointments.

## Reports

Admin-only read endpoints:

- `GET /reports/appointments` — appointment volumes and status breakdowns.
- `GET /reports/revenue` — paid revenue, outstanding balances and invoice totals.
- `GET /reports/patients` — registrations, demographics and new-patient trends.
- `GET /reports/departments` — activity and revenue grouped by department.

All accept `dateFrom`, `dateTo`, `department` and `doctor` filters where applicable.

## Audit logs

`GET /audit-logs` is admin-only and read-only. Filters include action, resource type, actor, outcome and date range.

Recorded events include logins and failed logins, patient changes, appointment transitions, encounters, prescriptions, reports, payments, staff changes and other privileged actions. Audit records are immutable at the model layer.

## Common management errors

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Invalid query, body or path parameter |
| `DUPLICATE_RESOURCE` | Email, department code, schedule slot or other unique value already exists |
| `NOT_FOUND` | Referenced record does not exist |
| `CONFLICT` | Operation would leave data in an invalid state |
| `DEPARTMENT_HAS_DEPENDENCIES` | Department still has doctors or staff |
| `DEPARTMENT_HAS_HISTORY` | Department has appointment history |
| `FORBIDDEN` | Role or ownership check failed |

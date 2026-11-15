# API Reference

Base URL: `http://localhost:4000/api`

Every endpoint except `POST /auth/login` requires authentication with a Bearer token or the `hms_token` cookie. Mutating endpoints validate bodies with Zod. List endpoints accept `page` (default 1) and `limit` (default 10, max 100) and return pagination metadata.

## Conventions

Success:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "email", "message": "Invalid email" }],
    "requestId": "…"
  }
}
```

Common status codes: `400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict or invalid state transition, `422` domain validation, `429` rate limited.

## Authentication

| Method | Path | Body |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/logout` | — |
| GET | `/auth/me` | — |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |

See [authentication.md](authentication.md).

## Patients

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/patients` | All | `q`, `status`, `gender`, `bloodGroup`, `sortBy` |
| POST | `/patients` | Admin, Receptionist | Create patient |
| GET | `/patients/:id` | All | Doctors must be assigned |
| PUT | `/patients/:id` | Admin, Receptionist | Partial update |
| PATCH | `/patients/:id/status` | Admin | `{ status: ACTIVE \| INACTIVE }` |
| GET | `/patients/:id/history` | All | Appointments, encounters, prescriptions, reports, invoices |

Create body: `{ firstName, lastName, dateOfBirth, gender, phone, email?, address?, emergencyContact?, bloodGroup? }`.

## Doctors

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/doctors` | All | `q`, `department`, `specialization`, `status`, `sortBy` |
| POST | `/doctors` | Admin | Creates a linked user account |
| GET | `/doctors/:id` | All | Doctor details |
| PUT | `/doctors/:id` | Admin | Partial update |
| PATCH | `/doctors/:id/status` | Admin | `{ status: ACTIVE \| ON_LEAVE \| INACTIVE }` |
| GET | `/doctors/:id/availability?date=YYYY-MM-DD` | All | Returns available slots |

Create body: `{ firstName, lastName, email, department, specialization, qualification, phone?, experienceYears?, consultationFee?, workingDays?, workingHours?, appointmentDuration?, bio?, password? }`.

## Departments

| Method | Path | Roles |
|---|---|---|
| GET | `/departments` | All |
| POST | `/departments` | Admin |
| GET | `/departments/:id` | All |
| PUT | `/departments/:id` | Admin |
| DELETE | `/departments/:id` | Admin |

Body: `{ name, code, description?, location?, phone?, head? }`. Delete is blocked when linked records exist.

## Staff

All staff routes require `ADMIN`.

| Method | Path |
|---|---|
| GET | `/staff` |
| POST | `/staff` |
| GET | `/staff/:id` |
| PUT | `/staff/:id` |
| PATCH | `/staff/:id/status` |

Body: `{ firstName, lastName, email, phone?, role: ADMIN|RECEPTIONIST, department?, jobTitle, joiningDate?, password? }`.

## Schedules

| Method | Path | Roles |
|---|---|---|
| GET | `/schedules` | All |
| POST | `/schedules` | Admin |
| PUT | `/schedules/:id` | Admin |
| DELETE | `/schedules/:id` | Admin |

Body: `{ doctor, dayOfWeek (0–6), startTime, endTime, slotDuration?, room?, isActive? }`.

## Appointments

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/appointments` | All | Doctors see only their own |
| POST | `/appointments` | Admin, Receptionist | `{ patient, doctor, date, startTime, appointmentType?, reason?, notes? }` |
| GET | `/appointments/:id` | All | Scoped for doctors |
| PUT | `/appointments/:id` | All | Update type, reason, notes |
| PATCH | `/appointments/:id/reschedule` | All | `{ date, startTime, reason? }` |
| PATCH | `/appointments/:id/cancel` | All | `{ reason? }` |
| PATCH | `/appointments/:id/status` | All | `{ status, notes? }` |

List filters: `status`, `doctor`, `patient`, `department`, `date`, `dateFrom`, `dateTo`, `upcomingOnly`, `sortBy`.

## Encounters

Requires `ADMIN` or `DOCTOR`. Creation and updates are doctor-only.

| Method | Path | Notes |
|---|---|---|
| GET | `/encounters` | `patient`, `doctor`, `status`, `dateFrom`, `dateTo`, `sortBy` |
| POST | `/encounters` | `{ patient, appointment?, encounterDate?, visitType?, chiefComplaint, clinicalNotes?, vitalSigns?, treatmentNotes?, followUpDate?, status? }` |
| GET | `/encounters/:id` | Scoped for doctors |
| PUT | `/encounters/:id` | Rejects completed or cancelled records |

## Prescriptions

Requires `ADMIN` or `DOCTOR`. Writes are doctor-only.

| Method | Path |
|---|---|
| GET | `/prescriptions` |
| POST | `/prescriptions` |
| GET | `/prescriptions/:id` |
| PUT | `/prescriptions/:id` |

Create body: `{ patient, encounter, prescriptionDate?, medicines: [{ name, dosage, frequency, duration, instructions? }], notes? }`.

## Diagnostic reports

Requires `ADMIN` or `DOCTOR`. Creation is doctor-only; administrators and the owning doctor can update.

| Method | Path |
|---|---|
| GET | `/diagnostic-reports` |
| POST | `/diagnostic-reports` |
| GET | `/diagnostic-reports/:id` |
| PUT | `/diagnostic-reports/:id` |

Body: `{ patient, encounter?, testName, testCategory, reportDate?, status?, notes?, fileReference? }`.

## Billing

Requires `ADMIN` or `RECEPTIONIST`.

| Method | Path | Notes |
|---|---|---|
| GET | `/invoices` | `patient`, `status`, `dateFrom`, `dateTo`, `sortBy` |
| POST | `/invoices` | `{ patient, appointment?, encounter?, invoiceDate?, dueDate?, lineItems, taxRate?, discount?, notes? }` |
| GET | `/invoices/:id` | Invoice with payments |
| POST | `/invoices/:id/payments` | `{ amount, method, transactionRef?, idempotencyKey?, notes? }` |
| GET | `/payments` | `invoice`, `method`, `status`, `dateFrom`, `dateTo`, `sortBy` |

Line items: `{ description, category?, quantity, unitPrice }`. Payment methods: `CASH`, `CARD`, `UPI`, `INSURANCE`, `OTHER`.

## Dashboards

| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard/admin` | Admin |
| GET | `/dashboard/receptionist` | Admin, Receptionist |
| GET | `/dashboard/doctor` | Doctor |

## Reports

Admin only.

| Method | Path | Query |
|---|---|---|
| GET | `/reports/appointments` | `dateFrom`, `dateTo`, `department`, `doctor` |
| GET | `/reports/revenue` | Same |
| GET | `/reports/patients` | Same |
| GET | `/reports/departments` | Same |

## Audit logs

`GET /audit-logs` is admin-only and accepts `action`, `resourceType`, `actor`, `outcome`, `dateFrom`, `dateTo` and `sortBy`.

## Health and documentation

| Method | Path | Description |
|---|---|---|
| GET | `/health` | API health and uptime |
| GET | `/docs` | Swagger UI |
| GET | `/docs/openapi.json` | OpenAPI 3.0 document |

# Authentication and Authorization

## Token model

Login returns both a JWT and an `httpOnly` cookie:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "…",
      "firstName": "Rachel",
      "lastName": "Moore",
      "email": "reception@hospital.demo",
      "role": "RECEPTIONIST",
      "status": "ACTIVE"
    },
    "accessToken": "eyJ…",
    "doctor": null
  }
}
```

- Cookie: `hms_token` by default, `httpOnly`, `sameSite=lax` in development and `none` + `secure` in production.
- Header: `Authorization: Bearer <accessToken>`.
- Either credential is accepted by the authentication middleware.
- The frontend stores the token in `localStorage` under `hms_token` and also sends cookies with `withCredentials: true`.
- The frontend redirects to `/login` and clears the local token on a `401` response.

## Endpoints

### `POST /api/auth/login`

Public. Body:

```json
{ "email": "admin@hospital.demo", "password": "…" }
```

Rate-limited by IP. Successful and failed attempts are written to the audit log. A doctor login also returns a minimal `doctor` profile.

### `GET /api/auth/me`

Requires authentication. Returns the current safe user object and, for doctors, the linked doctor profile.

### `POST /api/auth/logout`

Clears the auth cookie and audits the logout when a valid session exists. The frontend still clears local state if the request fails.

### `POST /api/auth/change-password`

Requires authentication.

```json
{ "currentPassword": "…", "newPassword": "at-least-8-characters" }
```

The current password must verify. Only a bcrypt hash is stored.

## Authorization matrix

| Resource | Admin | Receptionist | Doctor |
|---|:---:|:---:|:---:|
| Dashboard | Admin | Receptionist | Doctor |
| Patients list/get/history | Yes | Yes | Assigned only |
| Patient create/update | Yes | Yes | No |
| Patient status | Yes | No | No |
| Doctors read | Yes | Yes | Yes |
| Doctor create/update/status | Yes | No | No |
| Departments read | Yes | Yes | Yes |
| Department create/update/delete | Yes | No | No |
| Staff | Yes | No | No |
| Schedules read | Yes | Yes | Yes |
| Schedule create/update/delete | Yes | No | No |
| Appointments list/get | Yes | Yes | Own only |
| Appointment create | Yes | Yes | No |
| Appointment update/reschedule/status/cancel | Yes | Yes | Own only |
| Encounters | Read all | No | Own only / create |
| Prescriptions | Read all | No | Own only / create |
| Diagnostic reports | Read/update all | No | Own reports / create |
| Invoices/payments | Yes | Yes | No |
| Reports | Yes | No | No |
| Audit logs | Yes | No | No |

## Doctor scoping

Doctor access is enforced in services:

- Patient access is allowed only when the doctor has an appointment or encounter with that patient.
- Appointment, encounter, prescription and report lists are filtered by the authenticated doctor.
- Detail endpoints reject records owned by another doctor.
- Clinical writes always use the authenticated doctor, ignoring a spoofed doctor ID from the request.

## Session and security notes

- JWT secret must be at least 32 characters and is required outside tests.
- Login is rate-limited; repeated failures should be handled by waiting for the window to reset or restarting the local API.
- Cookies are `httpOnly`; the Bearer token exists for API clients and cross-origin development.
- Do not commit real env files. Rotate the JWT secret to invalidate existing sessions.

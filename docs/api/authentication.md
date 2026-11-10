# Authentication and Authorization API

All routes are mounted under `/api`. Authentication uses a short-lived Bearer access token
plus a rotating refresh token stored in an HTTP-only cookie. Protected resource access is
enforced by role permissions and, for clinicians, by resource ownership.

## Session model

| Credential    | Transport                                         | Lifetime                               | Notes                                                                     |
| ------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Access token  | `Authorization: Bearer <token>`                   | `JWT_ACCESS_EXPIRES_IN`, default `15m` | HS256 JWT; returned in login/refresh JSON                                 |
| Refresh token | `hms_refresh_token` cookie                        | `JWT_REFRESH_EXPIRES_IN`, default `7d` | Opaque 48-byte token; HTTP-only; path `/api/auth`; never returned in JSON |
| CSRF token    | `hms_csrf_token` cookie and `X-CSRF-Token` header | Same as refresh token                  | Readable by browser code; path `/` so SPA JavaScript can read it          |

Access-token claims include `sub`, `role`, `ver`, `type: "access"`, `jti`, `iss`, and
`aud`. The issuer is `hospital-management-api`; the audience is
`hospital-management-client`.

Both cookies use `SameSite=Lax`. They use `Secure` when `NODE_ENV=production`. The refresh
cookie is limited to `/api/auth`; the CSRF cookie is available at `/` so browser code on
normal application pages can echo it in the request header. Browser clients must send
credentials with API requests, and the API CORS policy allows credentialed requests from
configured origins.

The API reloads the user on every protected request. A token is rejected if the user no
longer exists, is not `ACTIVE`, has a different current role, or has a different
`authVersion`. A password change increments `authVersion`, so all previously issued access
tokens stop working immediately.

## Endpoints

### `POST /api/auth/login`

Request:

```json
{
  "email": "admin@example.test",
  "password": "your-password"
}
```

The body is strict. Email is trimmed and lowercased. Passwords must not exceed 72 bytes
because bcrypt ignores additional bytes.

Success: `200 OK`

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "csrfToken": "opaque-csrf-token",
  "user": {
    "id": "user-id",
    "email": "admin@example.test",
    "role": "ADMIN",
    "status": "ACTIVE",
    "firstName": "Ada",
    "lastName": "Admin",
    "phone": null,
    "lastLoginAt": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

The response sets a new refresh token, CSRF cookie, and refresh-token family. Invalid
email/password combinations and inactive accounts return the same generic
`401 INVALID_CREDENTIALS` response. Failed attempts are counted per IP and normalized email.
After `AUTH_LOGIN_RATE_LIMIT_MAX` failures within the configured window, the endpoint returns
`429 LOGIN_RATE_LIMITED` with `Retry-After`. A successful login resets the counter.

### `POST /api/auth/refresh`

Requires the refresh cookie and a matching `X-CSRF-Token` header. No request body is used.

Success: `200 OK` with the same shape as login. The refresh token is rotated: the previous
token is revoked with reason `ROTATED`, a new token is created in the same family, and a new
CSRF token is issued.

Errors:

| Status | Code                    | Meaning                                              |
| ------ | ----------------------- | ---------------------------------------------------- |
| `401`  | `INVALID_REFRESH_TOKEN` | Missing or unrecognized refresh token                |
| `401`  | `REFRESH_TOKEN_EXPIRED` | Token lifetime elapsed                               |
| `401`  | `REFRESH_TOKEN_REUSED`  | A revoked token was replayed; the family was revoked |
| `401`  | `ACCOUNT_INACTIVE`      | The account is no longer active                      |
| `403`  | `CSRF_TOKEN_INVALID`    | Missing or mismatched CSRF cookie/header             |
| `429`  | `REFRESH_RATE_LIMITED`  | Refresh/logout request limit exceeded                |

Any refresh failure clears both auth cookies.

### `POST /api/auth/logout`

Requires the refresh cookie and a matching `X-CSRF-Token` header. No request body is used.
The entire refresh-token family is revoked and both cookies are cleared.

Success: `204 No Content`, even when the presented refresh token no longer exists.

Logout does not revoke a stateless access token by itself. The access token remains valid
until expiry or until the user's `authVersion` changes. Clients should discard it
immediately.

### `GET /api/auth/me`

Requires `Authorization: Bearer <accessToken>`.

Success: `200 OK`

```json
{
  "user": {
    "id": "user-id",
    "email": "admin@example.test",
    "role": "ADMIN",
    "status": "ACTIVE",
    "firstName": "Ada",
    "lastName": "Admin",
    "phone": null,
    "lastLoginAt": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

A linked clinician or staff profile adds `doctorId` or `staffId`.

### `POST /api/auth/change-password`

Requires a Bearer access token. No CSRF header is needed because the operation does not rely
on ambient cookies.

Request:

```json
{
  "currentPassword": "current-password",
  "newPassword": "a-new-password-with-at-least-12-characters"
}
```

The body is strict. The new password must be at least 12 characters, at most 72 UTF-8 bytes,
and different from the current password.

Success: `204 No Content`. The password hash, `passwordChangedAt`, and `authVersion` are
updated, all active refresh tokens are revoked, and auth cookies are cleared.

Errors:

| Status | Code                       | Meaning                                   |
| ------ | -------------------------- | ----------------------------------------- |
| `400`  | `PASSWORD_UNCHANGED`       | New password matches the current password |
| `400`  | `VALIDATION_ERROR`         | Body does not satisfy the password schema |
| `401`  | `INVALID_CURRENT_PASSWORD` | Current password is wrong                 |
| `401`  | `AUTHENTICATION_REQUIRED`  | No Bearer token was supplied              |
| `401`  | `ACCESS_TOKEN_EXPIRED`     | Access token expired                      |
| `401`  | `ACCESS_TOKEN_REVOKED`     | Role or auth version changed              |
| `401`  | `ACCOUNT_INACTIVE`         | The account is not active                 |

## Access-token errors

Any protected endpoint may return:

| Status | Code                      | Meaning                                                             |
| ------ | ------------------------- | ------------------------------------------------------------------- |
| `401`  | `AUTHENTICATION_REQUIRED` | No `Authorization` header                                           |
| `401`  | `INVALID_ACCESS_TOKEN`    | Malformed token, invalid signature/issuer/audience, or deleted user |
| `401`  | `ACCESS_TOKEN_EXPIRED`    | Token expired                                                       |
| `401`  | `ACCESS_TOKEN_REVOKED`    | Token role or auth version no longer matches the user               |
| `401`  | `ACCOUNT_INACTIVE`        | User status is `INACTIVE` or `SUSPENDED`                            |
| `403`  | `FORBIDDEN`               | Authenticated role lacks the required permission                    |

All API errors use a stable shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Your role does not permit this operation",
    "requestId": "request-correlation-id"
  }
}
```

Validation failures also include `details`, an array of field paths and messages.

## Role permissions

| Permission               | Admin | Front desk | Clinician |
| ------------------------ | ----- | ---------- | --------- |
| `users:manage`           | Yes   | No         | No        |
| `patients:create`        | Yes   | Yes        | No        |
| `patients:read`          | Yes   | Yes        | Yes       |
| `patients:clinical:read` | Yes   | No         | Yes       |
| `appointments:read`      | Yes   | Yes        | Yes       |
| `schedules:read`         | Yes   | Yes        | Yes       |
| `billing:read`           | Yes   | Yes        | No        |

## Protected proof endpoints

| Method and path                                 | Permission               | Additional resource rule                                              |
| ----------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `GET /api/admin/users`                          | `users:manage`           | None                                                                  |
| `POST /api/patients`                            | `patients:create`        | Strict patient body; returns `201`                                    |
| `GET /api/patients/:patientId`                  | `patients:read`          | Clinicians only see patients assigned through an appointment or visit |
| `GET /api/patients/:patientId/clinical-summary` | `patients:clinical:read` | Same clinician assignment rule                                        |
| `GET /api/appointments`                         | `appointments:read`      | Clinicians only see appointments for their own doctor profile         |
| `GET /api/doctors/:doctorId/schedule`           | `schedules:read`         | Clinicians only see their own doctor schedule                         |
| `GET /api/billing/invoices/:invoiceId`          | `billing:read`           | None                                                                  |

Clinician probes for unrelated patients return `404 PATIENT_NOT_FOUND`. Probes for another
doctor's schedule return `404 DOCTOR_NOT_FOUND`. This avoids disclosing whether an unrelated
record exists.

Front-desk patient reads intentionally omit the sensitive `allergies` and `notes` fields.
Admin reads return the complete patient record. Clinical summaries include the patient's
allergy data, visit history, prescriptions, diagnostic reports, and a compact invoice
reference.

`POST /api/patients` accepts `firstName`, `lastName`, `dateOfBirth`, and optional demographic
and contact fields. `dateOfBirth` must use `YYYY-MM-DD`, be a real date, and not be in the
future. Unknown body fields are rejected.

## Client workflow

1. Send credentials to `POST /api/auth/login` with credentials enabled.
2. Keep the access token in memory and send it as a Bearer token.
3. Send the CSRF cookie value back as `X-CSRF-Token` for refresh and logout.
4. On `401 ACCESS_TOKEN_EXPIRED`, call `POST /api/auth/refresh`, then retry the original
   request once with the new access token.
5. On refresh failure, clear local session state and return to login.
6. Call logout before discarding the session so the refresh family is revoked.

## Audit events

Authentication events are written to `AuditLog`:

- `AUTH_LOGIN_SUCCEEDED`
- `AUTH_LOGIN_FAILED`
- `AUTH_LOGIN_BLOCKED`
- `AUTH_LOGOUT`
- `AUTH_REFRESH_ROTATED`
- `AUTH_REFRESH_REUSE_DETECTED`
- `AUTH_REFRESH_EXPIRED`
- `AUTH_REFRESH_BLOCKED`
- `AUTH_PASSWORD_CHANGED`
- `AUTH_PASSWORD_CHANGE_FAILED`

Audit metadata records reasons, roles, statuses, and token-family identifiers. Passwords,
raw refresh tokens, and CSRF tokens are never written to audit logs.

## Operational notes

Rate limiters are in-process fixed-window counters. They are appropriate for this
single-process assessment deployment but require a shared store such as Redis before running
multiple API instances behind a load balancer.

The integration suite is in `backend/tests/auth.test.ts` and runs with:

```bash
npm test
```

It requires a migrated database and `DATABASE_URL`. Test fixtures use the `authtest-` prefix
and are removed before and after the run.

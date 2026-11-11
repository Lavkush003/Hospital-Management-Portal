# Application Architecture

## Architectural style

The system uses a **modular monolith** with two independently built and deployed applications:

- `frontend`: a React single-page application served as static assets.
- `backend`: a single Express API process connected to PostgreSQL through Prisma.

There are no microservices, Firebase services, MongoDB stores, or simulated business APIs. Domain modules will be added vertically inside the existing API rather than as separate services.

```text
Browser
  |
  | HTTPS / JSON
  v
React + Vite (frontend)
  |
  | /api/* (Vite proxy in development)
  v
Express API (backend)
  |-- security and request middleware
  |-- module routers
  |-- services and Prisma
  v
PostgreSQL
```

## Frontend architecture

The frontend is organized by responsibility and by feature:

| Directory    | Responsibility                                                 |
| ------------ | -------------------------------------------------------------- |
| `components` | Shared, presentation-focused UI building blocks                |
| `features`   | Vertical slices that combine feature-specific UI and behavior  |
| `hooks`      | Reusable stateful React logic                                  |
| `layouts`    | Shared page shells and navigation                              |
| `pages`      | Route-level composition roots                                  |
| `routes`     | Router creation and route composition                          |
| `schemas`    | Runtime validation of external data                            |
| `services`   | HTTP and external integration boundaries                       |
| `styles`     | Global Tailwind entry point and design tokens                  |
| `types`      | Explicit frontend contracts                                    |
| `utils`      | Framework-independent helpers and validated environment access |

Feature code may depend on shared components, hooks, services, schemas, types, and utilities. Shared code must not import from a feature. Cross-feature reuse is promoted only after a second real use case exists.

The initial `system-status` feature is a thin vertical slice that verifies the frontend-to-API connection through the real `GET /api/health` endpoint. It demonstrates the intended layering:

```text
SystemStatus component
  -> useSystemHealth hook
  -> health service
  -> fetch
  -> health response schema validation
```

React Router owns top-level navigation. Unknown paths are rendered by a dedicated not-found page, and route rendering failures are caught by a route error page.

## Backend architecture

The backend is organized as a conventional layered modular monolith:

| Directory    | Responsibility                                                        |
| ------------ | --------------------------------------------------------------------- |
| `config`     | Validated environment, structured logger, and Prisma client lifecycle |
| `middleware` | Authentication, authorization, CSRF, validation, logging, and errors  |
| `modules`    | Vertical feature modules with their own routes and controllers        |
| `routes`     | Composition of module routers under the `/api` prefix                 |
| `services`   | Reusable application services independent of HTTP transport           |
| `tests`      | Isolated integration tests using the real API and database            |
| `types`      | API contracts and backend-owned types                                 |
| `utils`      | Typed error classes, auth helpers, and framework-independent helpers  |
| `validators` | Runtime schemas for configuration and request validation              |

### Request lifecycle

```text
Request
  -> Helmet security headers
  -> Request logger with correlation ID
  -> CORS allowlist
  -> JSON/urlencoded body parsing
  -> /api router
  -> Module middleware (authentication, permission, CSRF, validation)
  -> Module controller and service
  -> 404 handler or error handler
  -> Response
```

The health module follows this internal shape:

```text
modules/health/health.routes.ts
  -> modules/health/health.controller.ts
  -> services/health.service.ts
  -> typed health response
```

Authentication follows the same layering:

```text
modules/auth/auth.routes.ts
  -> rate limiting, CSRF, request validation, authentication
  -> modules/auth/auth.controller.ts
  -> modules/auth/auth.service.ts
  -> Prisma transaction and audit log
```

Additional modules should follow the same boundaries:

1. Define runtime validators.
2. Define transport-independent service functions.
3. Add a module controller that translates HTTP input and output.
4. Add a module router.
5. Register the router in `routes/index.ts`.
6. Add Prisma models, migrations, and tests as needed.

### Centralized errors

Operational errors use the `AppError` class. The final error middleware maps known errors to stable HTTP status codes and JSON responses. Prisma request errors, invalid JSON, validation errors, and unexpected failures are normalized there. Stack traces remain in logs and are never returned to clients.

Error response shape:

```json
{
  "error": {
    "message": "Route GET /api/unknown was not found",
    "code": "NOT_FOUND",
    "requestId": "correlation-id"
  }
}
```

### Logging and correlation

Pino provides structured JSON logs. Every request receives an `x-request-id` header and a correlated request log. Authorization, cookie, and set-cookie headers are redacted. Logs include method, path, status, response time, and request ID without logging request bodies, which may contain sensitive data.

### Configuration and validation

`backend/src/config/env.ts` loads dotenv and validates `process.env` with Zod before any other application module is created. Invalid configuration prevents startup instead of failing later at runtime. Allowed origins are parsed into an explicit CORS allowlist.

The frontend validates its public environment with Zod in `src/utils/env.ts`. Frontend environment values are never treated as secrets.

### Database and Prisma

Prisma reads `DATABASE_URL` from the backend environment. The client is created once and reused, with a development singleton guard to avoid duplicate clients during hot reload. The client is disconnected during graceful shutdown.

The schema defines 20 models, 17 enums, and four committed migrations. PostgreSQL enforces the critical invariants through a `btree_gist` appointment exclusion constraint, case-insensitive email indexes, and 33 CHECK constraints. Synthetic development data is loaded through `backend/prisma/seed.ts`.

Patient, doctor, department, staff, schedule, availability, and appointment modules expose management HTTP APIs. Appointment booking, rescheduling, cancellation, and status changes run in transactions with audit records and idempotency. The availability service derives exact schedule-aligned slots while excluding breaks, leave, unavailability, and active appointments. Booking and schedule mutations lock the doctor row, and database exclusion violations map to application conflicts.

The complete data-layer specification is maintained in the [ER diagram](database/er-diagram.md), [data dictionary](database/data-dictionary.md), and [relationships and constraints guide](database/relationships-and-constraints.md).

### Authentication and authorization

`modules/auth` implements bcrypt login, short-lived HS256 access JWTs, and opaque rotating
refresh tokens stored as HMAC-SHA-256 hashes. Refresh tokens are grouped into families so
reuse detection can revoke every descendant. Password changes increment `User.authVersion`,
which invalidates previously issued access tokens and revokes all active refresh tokens.

Access tokens are sent in the `Authorization: Bearer` header. The refresh token and CSRF
token use scoped cookies, and refresh/logout require a matching `X-CSRF-Token` header. The
authenticate middleware reloads the user on every protected request and rejects missing
accounts, inactive accounts, stale roles, and stale auth versions.

`modules/access` retains the admin-user, clinical-summary, and invoice-read proof endpoints.
Management modules implement patient, doctor, department, staff, schedule, availability, and
appointment APIs. Role permissions are centralized in `auth.permissions.ts`; resource-level
checks additionally limit clinicians to patients they are assigned to through appointments
or visits, to their own appointments, and to their own doctor schedules. Unauthorized
clinician resource probes return `404` instead of revealing whether an unrelated record
exists.

### Security

- Helmet sets HTTP security headers.
- CORS is restricted to configured origins and allows the `X-CSRF-Token` and
  `Idempotency-Key` headers.
- The Express fingerprint header is disabled.
- Request payloads are limited to 1 MB.
- Secrets are required, length-validated, and excluded from source control.
- Passwords use bcrypt; refresh tokens are stored only as keyed hashes.
- Access tokens are checked against current account status, role, and auth version.
- Refresh rotation, family revocation, CSRF double-submit checks, and rate limiting protect
  session renewal.
- Authentication events are audited without passwords or raw tokens.
- Error responses do not disclose internals.

### Graceful shutdown

The API handles `SIGINT` and `SIGTERM` by closing the HTTP server, disconnecting Prisma, and exiting. A bounded shutdown timeout prevents hung processes.

## Verification strategy

The foundational verification gate is:

```bash
npm run verify
```

It requires successful TypeScript compilation, ESLint, and production builds for both workspaces. The health endpoint can be checked at `http://localhost:4000/api/health` while the development server is running.

Authentication integration tests run against the real API and database:

```bash
npm test
```

The auth suite creates `authtest-` fixtures, exercises login, cookies, CSRF, refresh rotation
and reuse, logout, password changes, RBAC, resource scoping, rate limiting, and audit logging,
then removes its data. The management suite creates `mgmttest-` fixtures and covers CRUD,
permissions, doctor/staff session revocation, schedule and availability computation,
idempotent and concurrent booking, rescheduling, cancellation, status transitions, filtering,
and audit records.

The database gate is:

```bash
npm run db:verify
```

It requires a running, migrated, and seeded PostgreSQL database plus a valid backend environment. It checks migrations, tables, indexes, custom constraints, seed relationships, exclusion behavior, CHECK enforcement, and idempotent appointment transactions.

## Scope boundary

The foundation, data architecture, authentication, resource-scoped authorization, and
management APIs for patients, doctors, departments, staff, schedules, availability, and
appointments are complete. The hospital workflow UI, clinical mutation APIs, billing
mutations, and broader operational modules remain deferred. The architecture is ready for
those modules without introducing new deployables or changing the overall request lifecycle.

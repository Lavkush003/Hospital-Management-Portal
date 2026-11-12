# Hospital Management System

Production-oriented Hospital Management System for the Algions AI Labs Full-Stack Web Development assessment. The backend implements a complete PostgreSQL/Prisma data architecture, authentication, role-based authorization, patient/doctor/department/staff management, scheduling and availability, appointment booking, clinical records, and billing. The hospital business user interface remains intentionally deferred.

## Technology

| Layer          | Stack                                                     |
| -------------- | --------------------------------------------------------- |
| Frontend       | React, Vite, TypeScript, Tailwind CSS 4, React Router     |
| Backend        | Node.js, Express, TypeScript                              |
| Data           | PostgreSQL 18, Prisma ORM 6                               |
| Authentication | bcrypt, JWT access tokens, rotating opaque refresh tokens |
| Tooling        | ESLint, Prettier, npm workspaces, concurrent development  |

## Repository structure

```text
.
├── backend/                 Express API and Prisma data layer
│   ├── prisma/              Schema, migrations, and synthetic seed
│   ├── scripts/             Database verification scripts
│   ├── tests/               Authentication, management, clinical, and billing integration tests
│   └── src/
│       ├── config/          Environment, logger, and Prisma clients
│       ├── middleware/      Authentication, authorization, CSRF, and errors
│       ├── modules/         Health, auth, patients, doctors, departments, staff, schedules, appointments, clinical records, billing, and access
│       ├── routes/          API route composition
│       ├── services/        Reusable application services
│       ├── types/           Backend-owned types
│       ├── utils/           Framework-independent utilities
│       └── validators/      Runtime validation schemas
├── frontend/                React single-page application
│   ├── src/
│   │   ├── components/      Shared presentation components
│   │   ├── features/        Vertical feature slices
│   │   ├── hooks/           Reusable React hooks
│   │   ├── layouts/         Application shells
│   │   ├── pages/           Route-level pages
│   │   ├── routes/          Router configuration
│   │   ├── schemas/         Runtime response schemas
│   │   ├── services/        API clients
│   │   ├── styles/          Global Tailwind styles
│   │   ├── types/           Frontend-owned types
│   │   └── utils/           Framework-independent utilities
│   └── .env.example
├── docs/
│   ├── api/                 Authentication and authorization contracts
│   ├── architecture.md
│   └── database/            ER diagram, data dictionary, constraints
└── package.json             Workspace scripts
```

The application architecture is documented in [docs/architecture.md](docs/architecture.md). The authentication contract is documented in [docs/api/authentication.md](docs/api/authentication.md), and the management APIs are documented in [docs/api/management.md](docs/api/management.md). The data layer is documented in the [ER diagram](docs/database/er-diagram.md), [data dictionary](docs/database/data-dictionary.md), and [relationships and constraints guide](docs/database/relationships-and-constraints.md).

## Prerequisites

- Node.js 20.19 or newer
- npm 10.8 or newer
- PostgreSQL 14 or newer
- A local PostgreSQL database named `hospital_management` (or another name of your choice)

## Setup

1. Install all workspace dependencies:

   ```bash
   npm install
   ```

   The backend `postinstall` hook generates the Prisma client.

2. Create local environment files:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

   On macOS or Linux, use `cp` instead of `Copy-Item`.

3. Update `backend/.env`:
   - Set `DATABASE_URL` to your PostgreSQL connection string.
   - Replace both JWT secrets with independent random values.
   - Adjust `CORS_ORIGIN` if the frontend runs on a different origin.

   Generate a secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

4. Create the database if it does not already exist:

   ```bash
   createdb hospital_management
   ```

   Alternatively, create it with SQL:

   ```sql
   CREATE DATABASE hospital_management;
   ```

5. Validate the schema, apply migrations, and load synthetic data:

   ```bash
   npm run db:validate
   npm run db:deploy
   npm run db:seed
   ```

   Set `SEED_DEFAULT_PASSWORD` in `backend/.env` before seeding if you want deterministic
   development credentials. Otherwise the seed generates a random password and prints it
   once. All seeded accounts use synthetic `example.test` addresses.

6. Start both applications:

   ```bash
   npm run dev
   ```

The web application runs at `http://localhost:5173` and proxies `/api` requests to the API at `http://localhost:4000`.

Tailwind CSS uses its CSS-first configuration: design tokens and theme values live in `frontend/src/styles/index.css` rather than a separate JavaScript config file.

### Portable build tooling

The root `package.json` pins patched transitive versions of `deepmerge-ts` and `minimatch`. It also resolves Rollup to `@rollup/wasm-node`, which builds the Vite client bundles without native bindings on Windows hosts where those binaries are blocked by application-control policies.

## Environment variables

### Backend

| Variable                            | Required | Purpose                                                                                                                      |
| ----------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                          | No       | `development`, `test`, or `production`                                                                                       |
| `PORT`                              | No       | API port, defaults to `4000`                                                                                                 |
| `DATABASE_URL`                      | Yes      | PostgreSQL connection string                                                                                                 |
| `CORS_ORIGIN`                       | Yes      | Comma-separated list of allowed browser origins                                                                              |
| `JWT_ACCESS_SECRET`                 | Yes      | Access-token signing secret, minimum 32 characters                                                                           |
| `JWT_REFRESH_SECRET`                | Yes      | Refresh-token signing secret, minimum 32 characters                                                                          |
| `JWT_ACCESS_EXPIRES_IN`             | No       | Access-token lifetime, defaults to `15m`                                                                                     |
| `JWT_REFRESH_EXPIRES_IN`            | No       | Refresh-token lifetime, defaults to `7d`                                                                                     |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`   | No       | Failed-login rate-limit window, defaults to `900000` (15 minutes)                                                            |
| `AUTH_LOGIN_RATE_LIMIT_MAX`         | No       | Failed logins allowed per IP and email in the window, defaults to `10`                                                       |
| `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS` | No       | Refresh/logout rate-limit window, defaults to `900000`                                                                       |
| `AUTH_REFRESH_RATE_LIMIT_MAX`       | No       | Refresh/logout requests allowed per IP in the window, defaults to `60`                                                       |
| `BCRYPT_SALT_ROUNDS`                | No       | bcrypt cost factor, defaults to `12`                                                                                         |
| `LOG_LEVEL`                         | No       | Pino log level, defaults to `info`                                                                                           |
| `SEED_DEFAULT_PASSWORD`             | No       | Shared password for synthetic seed users; minimum 12 characters. If omitted, a random password is generated and printed once |
| `SEED_ALLOW_PRODUCTION`             | No       | Must be `true` to permit `db:seed` when `NODE_ENV=production`                                                                |

The API validates its environment at startup and exits with a readable error when configuration is invalid.

### Frontend

| Variable            | Required | Purpose                                                             |
| ------------------- | -------- | ------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | No       | Browser API base URL, defaults to `/api`                            |
| `VITE_APP_NAME`     | No       | Display name, defaults to `Hospital Management System`              |
| `VITE_PROXY_TARGET` | No       | Local dev/preview proxy target, defaults to `http://localhost:4000` |

Only variables prefixed with `VITE_` are exposed to browser code. Never place secrets in frontend environment files.

## Commands

All commands are available from the repository root.

| Command                    | Description                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`              | Run the API and web app together                                         |
| `npm run dev:backend`      | Run only the API in watch mode                                           |
| `npm run dev:frontend`     | Run only the web app                                                     |
| `npm run build`            | Build the API and web app                                                |
| `npm run typecheck`        | Type-check both workspaces                                               |
| `npm run lint`             | Lint both workspaces                                                     |
| `npm run lint:fix`         | Apply safe lint fixes                                                    |
| `npm test`                 | Run the backend authentication and management integration tests          |
| `npm run format`           | Format the repository with Prettier                                      |
| `npm run format:check`     | Verify formatting without writing files                                  |
| `npm run verify`           | Run typecheck, lint, and production builds                               |
| `npm run db:generate`      | Generate the Prisma client                                               |
| `npm run db:validate`      | Validate the Prisma schema                                               |
| `npm run db:migrate`       | Create and apply a development migration                                 |
| `npm run db:deploy`        | Apply committed migrations without generating a new one                  |
| `npm run db:seed`          | Load idempotent synthetic development data                               |
| `npm run db:reset`         | Drop, recreate, migrate, and reseed the database                         |
| `npm run db:verify`        | Run migrations, seed-count, constraint, relationship, and service checks |
| `npm run db:studio`        | Open Prisma Studio                                                       |
| `npm run start:backend`    | Start the compiled API                                                   |
| `npm run preview:frontend` | Preview the production frontend build                                    |

## Database architecture

The Prisma schema contains 22 models:

- **Identity and master data:** `User`, `Patient`, `Department`, `Doctor`, `Staff`
- **Scheduling:** `DoctorSchedule`, `DoctorScheduleBreak`, `DoctorLeave`,
  `DoctorUnavailability`, `Appointment`
- **Clinical encounter:** `Visit`, `Prescription`, `PrescriptionItem`,
  `DiagnosticReport`
- **Revenue cycle:** `Invoice`, `InvoiceItem`, `Payment`
- **Cross-cutting control:** `AuditLog`, `IdempotencyKey`, `RefreshToken`

Key invariants are enforced in PostgreSQL, not only in application code:

- Case-insensitive unique email addresses for users, doctors, and staff.
- A `btree_gist` exclusion constraint prevents overlapping active appointments for the
  same doctor. Cancelled, completed, and no-show appointments do not block a slot.
- CHECK constraints enforce time ordering, completed-state timestamps, nonnegative vitals
  and fees, invoice arithmetic, line totals, positive payment amounts, schedule break and
  leave time ordering, idempotency-key expiry and response status, and refresh-token
  expiry/revocation invariants.
- Clinical records attach to `Visit`; billing records attach to patients and may optionally
  reference a visit and/or appointment.
- Historical patient, doctor, and financial parents are protected with `Restrict` delete
  policies. Only owned child rows cascade.

The appointment service in `backend/src/modules/appointments/appointment.service.ts`
implements transactional booking, rescheduling, cancellation, status changes, and filtered
listing. The availability service derives exact schedule-aligned slots by excluding breaks,
leave, unavailability, and active appointments. Booking and schedule mutations lock the
doctor row with `SELECT ... FOR UPDATE`, and the database exclusion constraint remains the
final concurrency guard. Mutations combine audit logging with idempotency records; the shared
helper stores a canonical SHA-256 request hash and replays completed resource IDs for 24
hours.

See the [ER diagram](docs/database/er-diagram.md),
[data dictionary](docs/database/data-dictionary.md), and
[relationships and constraints guide](docs/database/relationships-and-constraints.md) for
the full model, field, index, and transaction specification.

### Synthetic seed data

The seed creates five departments, six users, six patients, three doctors, three staff
members, weekly schedules with breaks, doctor leave and unavailability records, appointments
in multiple states, encounters, prescriptions, diagnostic reports, invoices, payments, audit
logs, and an idempotency record. It is safe to rerun: seed-owned rows are removed and
recreated in a transaction.

Seed accounts use `@example.test` emails such as `admin@example.test`,
`frontdesk@example.test`, `evelyn.chen@example.test`, and `nurse@example.test`. Their
password comes from `SEED_DEFAULT_PASSWORD` or the generated password printed by the seed.
Production seeding is refused unless `SEED_ALLOW_PRODUCTION=true` is explicitly set.

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "hospital-management-api",
  "environment": "development",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 42.5
}
```

This is a liveness endpoint only. It does not expose database state or sensitive configuration.

### Authentication and authorization

The API exposes login, refresh, logout, current-session, and password-change endpoints under `/api/auth`. Access tokens are short-lived Bearer JWTs. Rotating refresh tokens and a readable CSRF token are stored in scoped cookies; refresh and logout require the `X-CSRF-Token` header. Protected endpoints enforce both role permissions and resource ownership, including clinician-only access to assigned patients, their own appointments, and their own doctor schedule.

Management endpoints cover patients, doctors, departments, staff, recurring schedules and breaks, leave, unavailability, availability search, appointments, clinical records, and billing. Booking, reschedule, cancel, and payment creation support the `Idempotency-Key` header.

See [docs/api/authentication.md](docs/api/authentication.md) for session contracts, cookie behavior, and token errors. See [docs/api/management.md](docs/api/management.md) for management, clinical, and billing request/response contracts, RBAC, scheduling rules, status transitions, and error codes.

## Deployment notes

Build both workspaces with `npm run build`, serve `frontend/dist` as static assets, and reverse-proxy `/api` to the backend. Alternatively, set `VITE_API_BASE_URL` at build time and allow the frontend origin through `CORS_ORIGIN`. Run `npm run db:deploy` before starting the API. The synthetic seed is development data and must not be loaded into production unless an operator deliberately enables it.

## Security baseline

- Environment variables are validated before the server starts.
- `.env` files are excluded from version control; only examples are committed.
- Helmet sets security headers.
- CORS uses an explicit allowlist.
- JSON request bodies are size-limited.
- Seed users receive bcrypt password hashes; seed passwords come from an environment
  variable or a generated value and are never hardcoded.
- JWT secrets and token lifetimes are validated configuration.
- Passwords use bcrypt; refresh tokens are stored only as HMAC-SHA-256 hashes.
- Access tokens are verified against the current user, account status, role, and auth
  version on every protected request.
- Refresh tokens rotate on use; reuse revokes the token family, and password changes
  revoke all active sessions.
- The refresh cookie is HTTP-only and scoped to `/api/auth`; the readable CSRF cookie is
  scoped to `/` so SPA code can read it. Cookies are `Secure` in production.
- CSRF double-submit protection is required for refresh and logout.
- Login and refresh endpoints are rate-limited.
- Authentication events are audited without recording passwords or raw tokens.
- Request logs redact authorization, cookie, and set-cookie headers.
- Error responses omit stack traces and internal details.
- No credentials or secret values are hardcoded.

## Current scope

The database, authentication, role-based authorization, management services, and management
HTTP APIs are implemented. The API exposes health, auth, admin-user, patient,
clinical-summary, department, doctor, staff, schedule/leave/unavailability, availability,
appointment, and invoice-read endpoints. The frontend remains the initialized application
shell. Business workflow UI, clinical mutation APIs, billing mutations, and broader hospital
operations remain deferred.

## Verification

```bash
npm run format:check
npm run verify
npm test
npm run db:verify
npm audit
```

`npm run verify` runs TypeScript checks, ESLint, and production builds for both workspaces.
`npm test` runs the backend integration suites against the configured test database. The
auth suite creates isolated `authtest-` fixtures and exercises authentication, CSRF, refresh
rotation and reuse detection, logout, password changes, RBAC, clinician resource scoping,
rate limiting, and audit logging. The management suite creates isolated `mgmttest-` fixtures
and exercises patient/doctor/department/staff CRUD, schedule and availability computation,
idempotent and concurrent booking, rescheduling, cancellation, status transitions, filtering,
and audit records. Both suites remove their data.
`npm run db:verify` requires a running, migrated, and seeded database with the backend
environment configured. It validates four migrations, all 20 tables, 33 custom constraints,
case-insensitive email uniqueness, referential integrity, the appointment exclusion
constraint, representative CHECK failures, and the idempotent booking/reschedule/cancel
transaction flow. Verification data is removed in a `finally` block.

The foundation health endpoint has also been smoke-tested at runtime, including security
headers, CORS allowlisting, request correlation, 404 handling, invalid-JSON handling, and
CORS preflight responses.

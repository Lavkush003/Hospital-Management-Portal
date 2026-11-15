# Architecture

## System shape

The application is a two-workspace monorepo:

```text
React SPA (Vite, port 5173)
  │  Axios, /api proxy in development
  ▼
Express API (port 4000)
  │  JWT auth, RBAC, Zod validation, rate limiting
  ▼
MongoDB (local or Atlas)
```

In production the frontend build is served by any static host or reverse proxy, and the API is deployed independently. The browser uses `VITE_API_BASE_URL`; the default `/api` works with the Vite proxy in development.

## Backend layers

| Layer | Responsibility |
|---|---|
| `src/app.js` | Express app, Helmet, CORS, body parsing, cookies, request ID, sanitization, Swagger, route mounting and error middleware |
| `src/routes/` | URL composition, authentication/authorization middleware and Zod validation |
| `src/controllers/` | Request/response translation and HTTP status codes |
| `src/services/` | Business rules, ownership checks, database access and audit writes |
| `src/models/` | Mongoose schemas, indexes and immutable-record guards |
| `src/validators/` | Zod schemas for bodies, queries and path parameters |
| `src/utils/` | IDs, money, dates, pagination, access checks, audit and API errors |
| `src/config/` | Environment parsing and MongoDB connection lifecycle |

Controllers are intentionally thin. Domain rules live in services so they can be reused by HTTP handlers and tests.

## Request lifecycle

1. Express applies Helmet, CORS, JSON/urlencoded parsing and cookie parsing.
2. A request ID is assigned; input is sanitized against prototype-pollution keys.
3. API rate limiting is applied under `/api`.
4. Route middleware authenticates the JWT from the Bearer header or `hms_token` cookie.
5. Role authorization and resource ownership checks run.
6. Zod validates and coerces request data.
7. The service executes domain logic and writes an audit record for sensitive mutations.
8. The controller sends `{ success, data, meta? }`.
9. Errors are normalized to `{ success: false, error: { code, message, details?, requestId? } }`.

## Frontend architecture

- `src/App.jsx` owns the route tree.
- `ProtectedRoute` restores the session through `GET /auth/me`; `RoleRoute` blocks unauthorized roles.
- `AuthContext` stores the user and doctor profile and manages login, logout and session refresh.
- `src/lib/api.js` is the Axios client. It attaches the Bearer token, sends cookies, handles 401 session expiry and normalizes API error messages.
- `src/components/ui.jsx` contains shared controls: buttons, inputs, modals, tables, pagination, badges and dialogs.
- `src/components/layout/AppLayout.jsx` renders role-aware navigation and the application shell.
- Feature pages use local state, debounced search, server-side pagination and modal forms.
- Recharts renders analytics; Sonner renders toast feedback.

## Data model

The database contains 15 Mongoose models:

- Identity and clinic: `User`, `Doctor`, `Staff`, `Department`
- Patients and scheduling: `Patient`, `DoctorSchedule`, `Appointment`, `AppointmentSlotReservation`
- Clinical: `Encounter`, `Prescription`, `DiagnosticReport`
- Revenue: `Invoice`, `Payment`
- Operations: `AuditLog`, `Counter`

`Counter` provides sequential human-readable IDs such as `PAT-000001`, `APT-000042` and `INV-000010`.

## Concurrency and correctness

- Appointment creation reserves a unique `(doctor, date, startTime)` slot before inserting the appointment.
- A second booking attempt for the same slot fails on the unique index and returns `409 SLOT_TAKEN`.
- After validation, existing appointments are checked for overlap, but the unique reservation is the authoritative race-condition barrier.
- Cancellation and rescheduling release or replace reservations.
- Invoice and payment arithmetic uses cent-rounded helpers and server-side recalculation.
- Payment updates use an atomic invoice update; a failed payment insert restores the invoice balance.

## Testing

- Backend: Jest + Supertest integration tests against `mongodb-memory-server`.
- Frontend: Vitest + React Testing Library with JSDOM.
- Lint: ESLint 9 flat config in both workspaces.
- Build: Vite production build for the frontend; backend runs directly from Node.js.

## Deployment considerations

- Use HTTPS and secure cookies in production.
- Set an explicit CORS origin allowlist.
- Use a managed MongoDB deployment with backups and least-privilege credentials.
- Replace in-memory rate limits with a shared store when running multiple API instances.
- Integrate a real payment provider before processing card data.

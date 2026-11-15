# Technical Report

## 1. Overview

This project implements a hospital management system as a JavaScript MERN application. It supports outpatient registration, scheduling, appointment booking, clinical documentation, prescriptions, diagnostic reports, billing, analytics and audit logging.

The implementation targets a clear separation between HTTP concerns, domain services and persistence, with role-aware access enforced on the server.

## 2. Objectives

- Provide a usable workflow for reception, doctors and administrators.
- Prevent double booking and invalid appointment transitions.
- Keep clinical and billing records consistent and traceable.
- Demonstrate secure authentication, validation and authorization.
- Deliver a responsive dashboard with operational reporting.
- Keep the codebase runnable with standard npm scripts and no external ORM.

## 3. Technology decisions

| Decision | Rationale |
|---|---|
| MongoDB + Mongoose | Flexible clinical documents and straightforward local/Atlas deployment |
| JWT cookie + Bearer token | Supports browser sessions and API clients |
| Zod | Shared request validation with coercion and clear errors |
| Service layer | Keeps domain rules out of controllers and testable |
| Unique slot reservation collection | Provides a database-level race barrier for booking |
| Atomic counters | Human-readable IDs without collisions |
| TanStack-free local state | Small, predictable pages without extra state libraries |
| Tailwind CSS 4 | Fast UI iteration with a consistent slate/teal design system |
| Recharts | Lightweight dashboard visualizations |
| Jest + Supertest | Full request lifecycle integration tests |
| Vitest + Testing Library | Fast component and utility tests in JSDOM |

TypeScript and Prisma were intentionally not used.

## 4. Backend design

### Middleware pipeline
Helmet, CORS, parsers, cookie parsing, request IDs, input sanitization, rate limiting, authentication, authorization and Zod validation run before controllers.

### Domain services
- `appointment.service.js` handles availability, slot validation, reservations, rescheduling, cancellation and state transitions.
- `clinical.service.js` handles encounter, prescription and diagnostic report ownership and workflow.
- `billing.service.js` recalculates invoices and applies payments.
- `dashboard.service.js` and `report.service.js` aggregate operational data.
- `audit.service.js` / `utils/audit.js` append immutable audit events.

### Data integrity
- Unique indexes on human-readable IDs and slot reservations.
- Unique sparse index on encounter/appointment.
- Unique sparse indexes on payment transaction references and idempotency keys.
- Model middleware blocks audit log mutation.
- Services validate referenced records and scope doctor access.

## 5. Frontend design

- React Router route tree with `ProtectedRoute` and `RoleRoute`.
- `AuthContext` restores sessions through `/auth/me` and supports logout.
- Axios client attaches the Bearer token, sends cookies, normalizes errors and redirects on 401.
- Shared UI primitives provide buttons, fields, modals, tables, pagination, badges and confirmation dialogs.
- Role-aware sidebar navigation hides unavailable modules.
- Pages use debounced search and server-side pagination.
- Dashboards and reports use Recharts; feedback uses Sonner toasts.
- Demo login buttons prefill seeded accounts.

## 6. Security

- bcrypt password hashing with a configurable cost.
- JWT with expiry and a required strong secret.
- `httpOnly` auth cookie; Bearer support for API clients.
- Helmet security headers and explicit CORS origins.
- Login and API rate limits.
- Zod validation and Mongoose schema validation.
- Server-side authorization and ownership checks.
- Input sanitization against prototype pollution.
- Generic invalid-credential messages.
- Audit logging for authentication and sensitive operations.
- No password hashes or raw secrets returned by APIs.

## 7. Testing and verification

```bash
npm test --workspace backend -- --runInBand
npm test --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
```

Current status:

- Backend: 6 Jest suites, 50 tests passing against `mongodb-memory-server`.
- Frontend: 3 Vitest suites, 14 tests passing.
- ESLint: backend and frontend both clean.
- Frontend production build: successful (Vite chunk-size warning only).

Backend test output may warn about open handles unless Jest is run with `--forceExit`; this is a test-runner lifecycle warning, not a failing assertion.

## 8. Known limitations

- Payment processing is simulated; no external gateway or refund workflow is integrated.
- Reminder notifications, SMS and email delivery are not implemented.
- File uploads are represented by `fileReference` metadata only.
- Rate limiting is in-memory and should be replaced with a shared store for multi-instance deployments.
- Reports are operational aggregates, not a full accounting or compliance suite.
- There is no hard-delete workflow for patients, doctors or staff.
- Seed data is for demonstration and is destructive.

## 9. Future work

- Real payment gateway and refunds.
- Appointment reminders and notification preferences.
- Document upload and secure object storage.
- Distributed rate limiting and refresh-token rotation.
- Comprehensive end-to-end browser tests.
- Accessibility audit and localization.
- Backup/restore automation and observability integration.
- Optional audit export and retention policies.

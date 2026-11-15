# Hospital Management System (MERN)

A full-stack hospital operations platform for patient registration, doctor and department administration, weekly scheduling, conflict-safe appointment booking, clinical encounters, prescriptions, diagnostic reports, billing, operational analytics and immutable audit logging.

Built with **MongoDB, Express, React and Node.js**. The frontend is JavaScript (no TypeScript), and the backend uses Mongoose (no Prisma).

---

## Features

### Front office
- Patient registration, search, demographic profiles, emergency contacts and status management.
- Patient history across appointments, encounters, prescriptions, diagnostic reports and invoices.
- Department and doctor directory with specialties, consultation fees and weekly availability.
- Appointment booking from live availability slots, rescheduling, cancellation and guarded status transitions.
- Invoice generation, partial or full payments, payment history and balance tracking.

### Clinical workflow
- Encounter documentation with chief complaint, clinical notes, vitals, treatment plan and follow-up date.
- Multi-item electronic prescriptions linked to encounters.
- Diagnostic orders and reports linked to patients and optional encounters.
- Doctors can only access patients assigned to them through appointments or encounters.

### Administration
- Role-based access for `ADMIN`, `RECEPTIONIST` and `DOCTOR`.
- Staff account management and department administration.
- Weekly doctor schedule management with generated booking slots.
- Appointment, revenue, patient and department analytics.
- Immutable audit log of authentication, clinical and billing activity.

### Security
- JWT in an `httpOnly` cookie and/or `Authorization: Bearer` token.
- bcrypt password hashing, Helmet headers, CORS allowlist, rate limiting, request IDs, Zod validation and Mongoose schema validation.
- Server-side authorization and resource scoping, including doctor-to-patient access checks.
- Payment amounts and invoice totals validated and calculated on the server.
- Unique slot reservation plus overlap checks prevent duplicate bookings.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS 4, Axios, Lucide, Recharts, Sonner |
| Backend | Node.js 20+, Express 4, Mongoose 8, Zod 3, JWT, bcryptjs |
| Database | MongoDB 6+ (local or Atlas) |
| Tests | Jest + Supertest + mongodb-memory-server (backend), Vitest + Testing Library (frontend) |
| API docs | Swagger UI + OpenAPI at `/api/docs` |

---

## Project structure

```text
HospitalManagementSystem/
├── backend/
│   ├── scripts/seed.js              # deterministic demo data
│   ├── src/
│   │   ├── config/                  # environment and MongoDB connection
│   │   ├── constants/enums.js       # roles, statuses, payment methods
│   │   ├── controllers/
│   │   ├── docs/openapi.js          # OpenAPI 3.0 specification
│   │   ├── middleware/              # auth, RBAC, validation, errors, rate limits
│   │   ├── models/                  # Mongoose models
│   │   ├── routes/
│   │   ├── services/                # domain and authorization logic
│   │   ├── utils/                   # money, dates, IDs, pagination, audit
│   │   ├── validators/              # Zod request schemas
│   │   ├── app.js
│   │   └── server.js
│   └── tests/                       # Jest integration suites
├── frontend/
│   ├── eslint.config.js
│   ├── vite.config.js
│   └── src/
│       ├── components/              # shared UI, charts, layout, route guards
│       ├── context/AuthContext.jsx
│       ├── lib/                     # API client, constants and formatters
│       ├── pages/                   # all application routes
│       ├── test/setup.js
│       ├── App.jsx
│       └── main.jsx
├── docs/                            # architecture, API, database and diagrams
└── package.json                     # npm workspaces and root scripts
```

---

## Quick start

### Prerequisites
- Node.js `20.19+`
- npm `10+`
- MongoDB running locally or a MongoDB Atlas connection string

### 1. Install dependencies
```bash
npm install
```

### 2. Configure the backend
```powershell
Copy-Item backend/.env.example backend/.env
```
On macOS/Linux: `cp backend/.env.example backend/.env`.

Edit `backend/.env`:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/hospital_management
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
JWT_EXPIRES_IN=8h
AUTH_COOKIE_NAME=hms_token
BCRYPT_SALT_ROUNDS=10
SEED_DEFAULT_PASSWORD=HospitalPass123!
LOG_LEVEL=info
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Seed demo data
```bash
npm run seed
```

The seed script is destructive and recreates demo departments, doctors, staff, schedules, patients, appointments, encounters, prescriptions, reports, invoices, payments and audit data.

### 4. Run both applications
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/api/docs`
- Health check: `http://localhost:4000/api/health`

Individual commands:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Demo accounts

The seed script creates these accounts with the `SEED_DEFAULT_PASSWORD` configured in `backend/.env`. The template uses `HospitalPass123!`, which is also prefilled by the login page demo buttons:

| Role | Email |
|---|---|
| Administrator | `admin@hospital.demo` |
| Receptionist | `reception@hospital.demo` |
| Doctor | `doctor@hospital.demo` |

Additional demo doctors and receptionists are created using `firstname.lastname@hospital.demo`. The login page includes one-click demo buttons that prefill the local seed password.

> If the demo login password does not match, use the current `SEED_DEFAULT_PASSWORD` from `backend/.env`, then re-run `npm run seed` if the database was seeded with a different value.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `4000` | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/hospital_management` | MongoDB connection string |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `JWT_SECRET` | required | Token signing secret, at least 32 characters |
| `JWT_EXPIRES_IN` | `8h` | Access token lifetime |
| `AUTH_COOKIE_NAME` | `hms_token` | Authentication cookie name |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost |
| `SEED_DEFAULT_PASSWORD` | `HospitalPass123!` | Password for seeded demo accounts |
| `LOG_LEVEL` | `info` | Log level configuration |

`DATABASE_URL` is also accepted as a fallback for `MONGODB_URI`.

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API base URL |
| `VITE_PROXY_TARGET` | `http://localhost:4000` | Vite development proxy target |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run backend and frontend concurrently |
| `npm run dev:backend` | Run Express with nodemon |
| `npm run dev:frontend` | Run Vite |
| `npm run seed` | Rebuild the demo database |
| `npm run build` | Production Vite build |
| `npm test` | Backend then frontend test suites |
| `npm run test:backend` | Jest + Supertest |
| `npm run test:frontend` | Vitest + Testing Library |
| `npm run lint` | ESLint for backend and frontend |
| `npm start --workspace backend` | Start the API without nodemon |

Backend tests use `mongodb-memory-server`; no local `mongod` is required. On Windows, `mongodb-memory-server` may need to download a MongoDB binary on first use.

---

## API overview

All API routes are mounted under `/api`.

| Resource | Routes |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Patients | `GET/POST /patients`, `GET/PUT /patients/:id`, `PATCH /patients/:id/status`, `GET /patients/:id/history` |
| Doctors | `GET/POST /doctors`, `GET/PUT /doctors/:id`, `PATCH /doctors/:id/status`, `GET /doctors/:id/availability` |
| Departments | `GET/POST /departments`, `GET/PUT/DELETE /departments/:id` |
| Staff | `GET/POST /staff`, `GET/PUT/DELETE /staff/:id`, `PATCH /staff/:id/status` |
| Schedules | `GET/POST /schedules`, `GET/PUT/DELETE /schedules/:id` |
| Appointments | List/create/get/update, `PATCH /:id/reschedule`, `PATCH /:id/status`, `PATCH /:id/cancel` |
| Clinical | `/encounters`, `/prescriptions`, `/diagnostic-reports` |
| Billing | `GET/POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/payments`, `GET /payments` |
| Dashboards | `GET /dashboard/admin`, `/dashboard/receptionist`, `/dashboard/doctor` |
| Reports | `GET /reports/appointments`, `/reports/revenue`, `/reports/patients`, `/reports/departments` |
| Audit | `GET /audit-logs` |

Successful responses use:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNextPage": false, "hasPreviousPage": false } }
```

Errors use:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [], "requestId": "…" } }
```

See [API reference](docs/api/api-reference.md) and [authentication](docs/api/authentication.md).

---

## Access control

| Area | Admin | Receptionist | Doctor |
|---|:---:|:---:|:---:|
| Dashboard | Yes | Yes | Yes |
| Patients | Manage | Manage | Assigned patients |
| Appointments | Manage | Manage | Own appointments |
| Billing | Manage | Manage | No |
| Clinical records | Read/manage reports | No | Own records |
| Doctors/departments | Manage | Read doctors/departments | No |
| Schedules | Manage | No | No |
| Staff | Manage | No | No |
| Reports | Yes | No | No |
| Audit logs | Read | No | No |

---

## Domain rules

- Appointment status transitions: `BOOKED → CONFIRMED/CHECKED_IN/CANCELLED/NO_SHOW`, `CONFIRMED → CHECKED_IN/CANCELLED/NO_SHOW`, `CHECKED_IN → IN_PROGRESS/CANCELLED/NO_SHOW`, `IN_PROGRESS → COMPLETED/CANCELLED`.
- A doctor cannot have overlapping active appointments; slot reservations enforce uniqueness.
- Appointments must align with an active weekly schedule, fit inside working hours and cannot be in the past.
- An appointment can produce at most one encounter.
- Prescriptions require an encounter owned by the prescribing doctor.
- Completed or cancelled encounters are locked against further edits, except completing a completed record.
- Invoices are calculated from line items, discount and tax on the server. Payments cannot exceed the outstanding balance.
- Audit logs are immutable and record successful and failed authentication attempts.

---

## Documentation

- [Architecture](docs/architecture.md)
- [Business rules](docs/business-rules.md)
- [API reference](docs/api/api-reference.md)
- [Authentication and authorization](docs/api/authentication.md)
- [Management API notes](docs/api/management.md)
- [Database data dictionary](docs/database/data-dictionary.md)
- [Relationships and constraints](docs/database/relationships-and-constraints.md)
- [System diagram](docs/diagrams/system-architecture.md)
- [ER diagram](docs/diagrams/database-er-diagram.md)
- [Data flow](docs/diagrams/data-flow-diagram.md)
- [Role/permission matrix](docs/diagrams/role-permission-matrix.md)
- [Appointment booking sequence](docs/diagrams/appointment-booking-sequence.md)
- [Technical report](docs/technical-report.md)

The running OpenAPI document is always available at `http://localhost:4000/api/docs/openapi.json`.

---

## Production notes

- Serve the frontend build behind HTTPS and set `VITE_API_BASE_URL` to the public API URL.
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, explicit `CORS_ORIGIN`, and TLS for cookies.
- Use MongoDB Atlas or a managed MongoDB deployment with backups and least-privilege credentials.
- Put the API behind a reverse proxy, WAF and distributed rate limiting for multi-instance deployments.
- The included payment flow is simulated; integrate a PCI-compliant payment provider before handling real card data.
- Do not commit `backend/.env` or production credentials.

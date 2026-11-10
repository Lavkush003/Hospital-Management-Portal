# Hospital Management System

Production-oriented foundation for the Algions AI Labs Full-Stack Web Development assessment. This phase establishes a secure, typed, maintainable full-stack baseline without implementing hospital business features.

## Technology

| Layer          | Stack                                                      |
| -------------- | ---------------------------------------------------------- |
| Frontend       | React, Vite, TypeScript, Tailwind CSS 4, React Router      |
| Backend        | Node.js, Express, TypeScript                               |
| Data           | PostgreSQL, Prisma ORM                                     |
| Authentication | JWT and bcrypt dependencies and configuration are in place |
| Tooling        | ESLint, Prettier, npm workspaces, concurrent development   |

## Repository structure

```text
.
├── backend/                 Express API and Prisma schema
│   ├── prisma/
│   └── src/
│       ├── config/          Environment, logger, and Prisma clients
│       ├── middleware/      Request logging and centralized errors
│       ├── modules/         Feature modules (health is the first module)
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
├── docs/architecture.md
└── package.json             Workspace scripts
```

The detailed architecture is documented in [docs/architecture.md](docs/architecture.md).

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

5. Validate Prisma and start both applications:

   ```bash
   npm run db:validate
   npm run dev
   ```

The web application runs at `http://localhost:5173` and proxies `/api` requests to the API at `http://localhost:4000`.

Tailwind CSS uses its CSS-first configuration: design tokens and theme values live in `frontend/src/styles/index.css` rather than a separate JavaScript config file.

### Portable build tooling

The root `package.json` pins patched transitive versions of `deepmerge-ts` and `minimatch`. It also resolves Rollup to `@rollup/wasm-node`, which builds the Vite client bundles without native bindings on Windows hosts where those binaries are blocked by application-control policies.

## Environment variables

### Backend

| Variable                 | Required | Purpose                                             |
| ------------------------ | -------- | --------------------------------------------------- |
| `NODE_ENV`               | No       | `development`, `test`, or `production`              |
| `PORT`                   | No       | API port, defaults to `4000`                        |
| `DATABASE_URL`           | Yes      | PostgreSQL connection string                        |
| `CORS_ORIGIN`            | Yes      | Comma-separated list of allowed browser origins     |
| `JWT_ACCESS_SECRET`      | Yes      | Access-token signing secret, minimum 32 characters  |
| `JWT_REFRESH_SECRET`     | Yes      | Refresh-token signing secret, minimum 32 characters |
| `JWT_ACCESS_EXPIRES_IN`  | No       | Access-token lifetime, defaults to `15m`            |
| `JWT_REFRESH_EXPIRES_IN` | No       | Refresh-token lifetime, defaults to `7d`            |
| `BCRYPT_SALT_ROUNDS`     | No       | bcrypt cost factor, defaults to `12`                |
| `LOG_LEVEL`              | No       | Pino log level, defaults to `info`                  |

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

| Command                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `npm run dev`              | Run the API and web app together                     |
| `npm run dev:backend`      | Run only the API in watch mode                       |
| `npm run dev:frontend`     | Run only the web app                                 |
| `npm run build`            | Build the API and web app                            |
| `npm run typecheck`        | Type-check both workspaces                           |
| `npm run lint`             | Lint both workspaces                                 |
| `npm run lint:fix`         | Apply safe lint fixes                                |
| `npm run format`           | Format the repository with Prettier                  |
| `npm run format:check`     | Verify formatting without writing files              |
| `npm run verify`           | Run typecheck, lint, and production builds           |
| `npm run db:generate`      | Generate the Prisma client                           |
| `npm run db:validate`      | Validate the Prisma schema                           |
| `npm run db:migrate`       | Create and apply a development migration             |
| `npm run db:deploy`        | Apply committed migrations in a deployed environment |
| `npm run db:studio`        | Open Prisma Studio                                   |
| `npm run start:backend`    | Start the compiled API                               |
| `npm run preview:frontend` | Preview the production frontend build                |

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

## Deployment notes

Build both workspaces with `npm run build`, serve `frontend/dist` as static assets, and reverse-proxy `/api` to the backend. Alternatively, set `VITE_API_BASE_URL` at build time and allow the frontend origin through `CORS_ORIGIN`. Run `npm run db:deploy` before starting the API once migrations exist.

## Security baseline

- Environment variables are validated before the server starts.
- `.env` files are excluded from version control; only examples are committed.
- Helmet sets security headers.
- CORS uses an explicit allowlist.
- JSON request bodies are size-limited.
- Passwords will use bcrypt; JWT secrets and token lifetimes are validated configuration.
- Request logs redact authorization, cookie, and set-cookie headers.
- Error responses omit stack traces and internal details.
- No credentials or secret values are hardcoded.

## Current scope

This phase intentionally contains no patient, appointment, billing, or authentication endpoints. The Prisma schema is connected and validated but has no domain models yet. The API exposes only the health endpoint plus centralized not-found and error handling. The authentication libraries and environment configuration are ready for the next phase, but no fake or placeholder business APIs have been created.

## Verification

```bash
npm run format:check
npm run verify
npm audit
```

`npm run verify` runs TypeScript checks, ESLint, and production builds for both workspaces. The health endpoint was also smoke-tested at runtime, including security headers, CORS allowlisting, request correlation, 404 handling, invalid-JSON handling, and CORS preflight responses.

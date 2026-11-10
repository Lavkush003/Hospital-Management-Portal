import { SystemStatusCard } from '@/features/system-status/components/SystemStatusCard';

const capabilities = [
  {
    number: '01',
    title: 'Strict TypeScript',
    description:
      'Both applications compile under strict settings with explicit contracts at their boundaries.',
  },
  {
    number: '02',
    title: 'Layered security',
    description:
      'Security headers, origin allowlisting, payload limits, redacted logs, and validated configuration.',
  },
  {
    number: '03',
    title: 'Centralized errors',
    description:
      'Operational, validation, and database failures resolve into predictable JSON responses.',
  },
  {
    number: '04',
    title: 'Modular monolith',
    description:
      'Clear frontend and backend boundaries without the operational cost of microservices.',
  },
];

const architectureLayers = [
  {
    title: 'Client application',
    stack: 'React + Vite',
    description:
      'Typed routes, a dedicated API service boundary, and runtime validation of external data.',
  },
  {
    title: 'Application API',
    stack: 'Express + TypeScript',
    description:
      'Feature modules, centralized errors, request correlation, and structured JSON logging.',
  },
  {
    title: 'Data layer',
    stack: 'Prisma + PostgreSQL',
    description:
      'Environment-driven connections, a single Prisma client lifecycle, and a schema ready for domain modules.',
  },
];

export function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-center lg:gap-14 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Foundation phase
          </span>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            A reliable foundation for modern{' '}
            <span className="text-brand-700">hospital operations.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            A production-oriented Hospital Management System built as a modular monolith. The
            foundation covers typed frontend and backend applications, secure API conventions,
            PostgreSQL access, and consistent operational tooling.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              href="#system-status"
            >
              Inspect system status
            </a>
            <a
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              href="/api/health"
              rel="noreferrer"
              target="_blank"
            >
              View health payload
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 17 17 7M9 7h8v8"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </a>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-6">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Deployables
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-950">2</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                API style
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-950">Modular</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Database
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-950">PostgreSQL</dd>
            </div>
          </dl>
        </div>

        <SystemStatusCard />
      </section>

      <section aria-labelledby="capabilities-heading" className="py-14 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Foundation capabilities
          </p>
          <h2
            className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
            id="capabilities-heading"
          >
            Production concerns handled from day one.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            The same conventions will support every future hospital domain module, from patient
            records to scheduling and billing.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((capability) => (
            <article
              className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
              key={capability.number}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
                {capability.number}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{capability.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="architecture-heading" className="pb-14 lg:pb-20">
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-card sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
                Application architecture
              </p>
              <h2
                className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
                id="architecture-heading"
              >
                One system. Clear responsibilities.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
                A modular monolith keeps deployment simple while preserving strong boundaries inside
                the API and across the frontend. Request context, validation, and error handling
                stay consistent as features are added.
              </p>
            </div>

            <div className="grid gap-3">
              {architectureLayers.map((layer, index) => (
                <div
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                  key={layer.title}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-sm font-semibold text-brand-200">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-sm font-semibold text-white">{layer.title}</h3>
                      <span className="text-xs font-medium text-brand-300">{layer.stack}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-300">{layer.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 lg:pb-24">
        <div className="rounded-3xl border border-brand-100 bg-brand-50/80 p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Deliberate scope
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Foundation first. Business features next.
            </h2>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 lg:mt-0">
            This release intentionally stops at infrastructure. No patient, appointment, billing, or
            authentication endpoints have been simulated. The service exposes only the real health
            endpoint and is ready for the next phase.
          </p>
        </div>
      </section>
    </div>
  );
}

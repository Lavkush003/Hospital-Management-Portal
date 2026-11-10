import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-card backdrop-blur sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Error {status}
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          The application could not render this page.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Try returning to the overview. If the problem persists, check the browser console and the
          API logs for more context.
        </p>
        <Link
          className="mt-7 inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          to="/"
        >
          Return to overview
        </Link>
      </div>
    </main>
  );
}

import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:py-32">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Error 404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        This page is outside the current foundation.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
        The address may be incorrect, or the requested feature has not been implemented yet.
      </p>
      <Link
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        to="/"
      >
        Return to overview
      </Link>
    </div>
  );
}

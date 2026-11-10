import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { formatDateTime, formatUptime } from '@/utils/format';

export function SystemStatusCard() {
  const { state, refresh } = useSystemHealth();
  const tone: StatusTone =
    state.status === 'online' ? 'healthy' : state.status === 'offline' ? 'unavailable' : 'checking';
  const label =
    state.status === 'online'
      ? 'API online'
      : state.status === 'offline'
        ? 'API unavailable'
        : 'Checking';

  return (
    <section
      aria-busy={state.status === 'loading'}
      aria-live="polite"
      className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8"
      id="system-status"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Live foundation check
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            System status
          </h2>
        </div>
        <StatusBadge label={label} tone={tone} />
      </div>

      {state.status === 'loading' ? (
        <div className="mt-6 space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : null}

      {state.status === 'online' ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Service</dt>
            <dd className="mt-1 break-words font-semibold text-slate-900">{state.data.service}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Environment
            </dt>
            <dd className="mt-1 font-semibold capitalize text-slate-900">
              {state.data.environment}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Uptime</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatUptime(state.data.uptime)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last checked
            </dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatDateTime(state.checkedAt)}</dd>
          </div>
        </dl>
      ) : null}

      {state.status === 'offline' ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">The API could not be reached.</p>
          <p className="mt-1 break-words text-rose-700">{state.message}</p>
          <p className="mt-3 text-xs text-rose-600">
            Checked {formatDateTime(state.checkedAt)}. Start the backend and try again.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <code className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">
          GET /api/health
        </code>
        <button
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state.status === 'loading'}
          onClick={refresh}
          type="button"
        >
          Refresh status
        </button>
      </div>
    </section>
  );
}

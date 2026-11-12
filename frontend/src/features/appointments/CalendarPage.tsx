import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Appointment } from '@/types/api';
import { appointmentsApi } from '@/services/hms';
import { useAuth } from '@/features/auth/auth-context';
import {
  addMonths,
  dayKey,
  endOfDay,
  isSameDay,
  isToday,
  monthGrid,
  monthLabel,
  startOfDay,
  startOfMonth,
  weekdayShort,
} from '@/utils/date';
import { formatDate, formatTime, formatTimeRange, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';

export function CalendarPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FRONT_DESK';
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const grid = useMemo(() => monthGrid(month), [month]);
  const rangeStart = startOfDay(grid[0] ?? month);
  const rangeEnd = endOfDay(grid[grid.length - 1] ?? month);

  const query = useQuery({
    queryKey: ['calendar', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () =>
      appointmentsApi.list({
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
        page: 1,
        pageSize: 100,
      }),
  });

  const appointments = useMemo(() => query.data?.appointments ?? [], [query.data]);
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = dayKey(appointment.scheduledStart);
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    }
    return map;
  }, [appointments]);

  const selectedAppointments = byDay.get(dayKey(selectedDay)) ?? [];

  function goToMonth(next: Date) {
    setMonth(startOfMonth(next));
    setSelectedDay(startOfMonth(next));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={canManage ? 'Front desk' : 'Clinical schedule'}
        title="Appointment calendar"
        description="A month view of scheduled patient visits. Select a day to see its appointments."
        actions={
          canManage ? (
            <Link to="/front-desk/appointments">
              <Button>Book appointment</Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)]">
        <Card padding="none">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <Button variant="outline" size="sm" onClick={() => goToMonth(addMonths(month, -1))}>
              Previous
            </Button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">{monthLabel(month)}</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const today = startOfDay(new Date());
                  setMonth(startOfMonth(today));
                  setSelectedDay(today);
                }}
              >
                Today
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => goToMonth(addMonths(month, 1))}>
              Next
            </Button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
            {grid.slice(0, 7).map((day) => (
              <div key={day.toISOString()} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {weekdayShort(day)}
              </div>
            ))}
          </div>

          {query.isError ? (
            <ErrorState
              message={query.error instanceof Error ? query.error.message : undefined}
              onRetry={() => void query.refetch()}
            />
          ) : (
            <div className="grid grid-cols-7">
              {grid.map((day) => {
                const items = byDay.get(dayKey(day)) ?? [];
                const outside = day.getMonth() !== month.getMonth();
                const selected = isSameDay(day, selectedDay);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(startOfDay(day))}
                    className={`min-h-24 border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-brand-50/40 ${
                      outside ? 'bg-slate-50/40' : 'bg-white'
                    } ${selected ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                  >
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                        isToday(day)
                          ? 'bg-brand-600 text-white'
                          : outside
                            ? 'text-slate-400'
                            : 'text-slate-700'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {items.slice(0, 2).map((appointment) => (
                        <div
                          key={appointment.id}
                          className="truncate rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-800"
                        >
                          {formatTime(appointment.scheduledStart)} {appointment.patient.lastName}
                        </div>
                      ))}
                      {items.length > 2 ? (
                        <p className="px-1 text-[10px] font-semibold text-slate-400">
                          +{items.length - 2} more
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={formatDate(selectedDay.toISOString())}
            description={`${selectedAppointments.length} appointment${selectedAppointments.length === 1 ? '' : 's'}`}
          />
          {query.isPending ? (
            <p className="mt-4 text-sm text-slate-500">Loading calendar…</p>
          ) : selectedAppointments.length === 0 ? (
            <EmptyState
              title="No appointments"
              description="No patient appointments are scheduled on this day."
              className="py-8"
            />
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {selectedAppointments.map((appointment) => (
                <li key={appointment.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {appointment.patient.firstName} {appointment.patient.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatTimeRange(appointment.scheduledStart, appointment.scheduledEnd)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                      </p>
                    </div>
                    <Badge tone={statusTone(appointment.status)}>{humanize(appointment.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <Link
              to="/front-desk/appointments"
              className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
            >
              Open appointment list
            </Link>
          ) : null}
          {query.data && query.data.pagination.total > appointments.length ? (
            <p className="mt-4 text-xs text-amber-700">
              Showing the first {appointments.length} appointments in this month view.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

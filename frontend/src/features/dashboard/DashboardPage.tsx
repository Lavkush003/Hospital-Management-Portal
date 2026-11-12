import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Appointment, AppointmentStatus, Invoice, Visit } from '@/types/api';
import { adminApi, appointmentsApi, billingApi, patientsApi, visitsApi } from '@/services/hms';
import { useAuth } from '@/features/auth/auth-context';
import { addDays, endOfDay, startOfDay, toDateInput, timeRangeLabel } from '@/utils/date';
import { formatMoney, formatTime, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/Display';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { NavIcon } from '@/components/layout/NavIcon';

function appointmentStatus(status: AppointmentStatus) {
  return (
    <Badge tone={statusTone(status)} dot>
      {humanize(status)}
    </Badge>
  );
}

function AppointmentList({ appointments, empty }: { appointments: Appointment[]; empty: string }) {
  if (appointments.length === 0) {
    return <EmptyState title="No appointments" description={empty} className="py-8" />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {appointments.slice(0, 6).map((appointment) => (
        <li key={appointment.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {formatTime(appointment.scheduledStart)} – {formatTime(appointment.scheduledEnd)} · Dr.{' '}
              {appointment.doctor.firstName} {appointment.doctor.lastName}
            </p>
          </div>
          {appointmentStatus(appointment.status)}
        </li>
      ))}
    </ul>
  );
}

function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return <EmptyState title="No invoices" description="No invoices were raised today." className="py-8" />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {invoices.slice(0, 5).map((invoice) => (
        <li key={invoice.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {invoice.patient.firstName} {invoice.patient.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {invoice.invoiceNumber} · balance {formatMoney(invoice.balanceDue, invoice.currency)}
            </p>
          </div>
          <Badge tone={statusTone(invoice.status)}>{humanize(invoice.status)}</Badge>
        </li>
      ))}
    </ul>
  );
}

function VisitList({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return <EmptyState title="No visits" description="No visit records yet." className="py-8" />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {visits.slice(0, 5).map((visit) => (
        <li key={visit.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {visit.visitNumber} · {formatTime(visit.startedAt)}
            </p>
          </div>
          <Badge tone={statusTone(visit.status)}>{humanize(visit.status)}</Badge>
        </li>
      ))}
    </ul>
  );
}

function AdminDashboard() {
  const now = new Date();
  const today = toDateInput(now);
  const dayStart = startOfDay(now).toISOString();
  const dayEnd = endOfDay(now).toISOString();
  const periodStart = startOfDay(addDays(now, -29)).toISOString();
  const periodEnd = endOfDay(now).toISOString();
  const analytics = useQuery({
    queryKey: ['dashboard', 'analytics', periodStart, periodEnd],
    queryFn: () => adminApi.analytics({ from: periodStart, to: periodEnd }),
  });
  const appointments = useQuery({
    queryKey: ['dashboard', 'appointments', today],
    queryFn: () => appointmentsApi.list({ from: dayStart, to: dayEnd, page: 1, pageSize: 100 }),
  });
  const analyticsData = analytics.data;
  const todayAppointments = appointments.data?.appointments ?? [];
  const metricValue = (value: number | null | undefined) =>
    analytics.isPending || value === null || value === undefined ? '—' : String(value);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator"
        title="Hospital overview"
        description="Live hospital analytics from operational, clinical and billing records."
        actions={
          <>
            <Link to="/admin/reports">
              <Button variant="outline">View reports</Button>
            </Link>
            <Link to="/admin/appointments">
              <Button>Manage appointments</Button>
            </Link>
          </>
        }
      />

      {analytics.isError ? (
        <Card>
          <ErrorState
            message={analytics.error instanceof Error ? analytics.error.message : undefined}
            onRetry={() => void analytics.refetch()}
          />
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registered patients"
          value={metricValue(analyticsData?.totals.registeredPatients)}
          hint="All patient records"
          icon={<NavIcon name="patients" className="h-4 w-4" />}
        />
        <StatCard
          label="Doctors"
          value={metricValue(analyticsData?.totals.doctors)}
          hint="All doctor records"
          tone="teal"
          icon={<NavIcon name="doctors" className="h-4 w-4" />}
        />
        <StatCard
          label="Appointments"
          value={metricValue(analyticsData?.totals.appointments)}
          hint="Selected 30-day period"
          tone="amber"
          icon={<NavIcon name="appointments" className="h-4 w-4" />}
        />
        <StatCard
          label="Completed appointments"
          value={metricValue(analyticsData?.totals.completedAppointments)}
          hint="Selected 30-day period"
          tone="teal"
          icon={<NavIcon name="visits" className="h-4 w-4" />}
        />
        <StatCard
          label="Cancelled appointments"
          value={metricValue(analyticsData?.totals.cancelledAppointments)}
          hint="Selected 30-day period"
          tone="rose"
          icon={<NavIcon name="appointments" className="h-4 w-4" />}
        />
        <StatCard
          label="Upcoming appointments"
          value={metricValue(analyticsData?.totals.upcomingAppointments)}
          hint="Next 7 days"
          tone="amber"
          icon={<NavIcon name="calendar" className="h-4 w-4" />}
        />
        <StatCard
          label="Completed visits"
          value={metricValue(analyticsData?.totals.completedVisits)}
          hint="Selected 30-day period"
          tone="violet"
          icon={<NavIcon name="visits" className="h-4 w-4" />}
        />
        <StatCard
          label="Doctor utilization"
          value={
            analyticsData?.totals.doctorUtilizationPercent === null ||
            analyticsData?.totals.doctorUtilizationPercent === undefined
              ? '—'
              : `${analyticsData.totals.doctorUtilizationPercent}%`
          }
          hint="Booked minutes / available minutes"
          tone="brand"
          icon={<NavIcon name="doctors" className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader
            title="Appointment trends"
            description="Daily bookings and completed appointments over the last 30 days."
            action={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/admin/appointments">
                View all
              </Link>
            }
          />
          <div className="mt-6 h-64">
            {analytics.isPending ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading analytics…</p>
            ) : analyticsData?.dailyAppointments.length === 0 ? (
              <EmptyState
                title="No appointments in this period"
                description="Appointment activity will appear here when available."
                className="h-full py-0"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData?.dailyAppointments ?? []} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="total" name="Appointments" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="completed" name="Completed" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Today's appointments"
            description="Appointments scheduled for today."
            action={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/admin/appointments">
                Open
              </Link>
            }
          />
          <div className="mt-2">
            <AppointmentList
              appointments={[...todayAppointments].sort(
                (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
              )}
              empty="No appointments are scheduled for today."
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Billing overview" description="Current-period financial totals grouped by currency." />
          {analyticsData?.financialsByCurrency.length ? (
            <div className="mt-4 space-y-3">
              {analyticsData.financialsByCurrency.map((item) => (
                <div key={item.currency} className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-800">{item.currency}</p>
                  <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-slate-500">Invoiced</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {formatMoney(item.invoicedAmount, item.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Successful payments</dt>
                      <dd className="mt-1 font-semibold text-emerald-700">
                        {formatMoney(item.successfulPaymentAmount, item.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Outstanding</dt>
                      <dd className="mt-1 font-semibold text-rose-600">
                        {formatMoney(item.outstandingBalance, item.currency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : analytics.isPending ? (
            <p className="mt-4 text-sm text-slate-500">Loading financial totals…</p>
          ) : (
            <EmptyState title="No billing data" description="No invoices are available for this period." className="py-6" />
          )}
        </Card>

        <Card>
          <CardHeader title="Doctor utilization" description="Booked time compared with scheduled availability." />
          {analyticsData?.doctorUtilization.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {analyticsData.doctorUtilization.slice(0, 6).map((doctor) => (
                <li key={doctor.doctorId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{doctor.doctorName}</p>
                    <p className="truncate text-xs text-slate-500">{doctor.departmentName} · {doctor.appointmentCount} appointments</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-800">
                    {doctor.utilizationPercent === null ? '—' : `${doctor.utilizationPercent}%`}
                  </p>
                </li>
              ))}
            </ul>
          ) : analytics.isPending ? (
            <p className="mt-4 text-sm text-slate-500">Loading utilization…</p>
          ) : (
            <EmptyState title="No utilization data" description="Doctor schedules will be summarized here." className="py-6" />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Financial period" description="Analytics are calculated for the most recent 30 calendar days." />
      </Card>
    </div>
  );
}

function FrontDeskDashboard() {
  const now = new Date();
  const today = toDateInput(now);
  const dayStart = startOfDay(now).toISOString();
  const dayEnd = endOfDay(now).toISOString();
  const weekEnd = endOfDay(addDays(now, 7)).toISOString();

  const patients = useQuery({
    queryKey: ['dashboard', 'front-desk', 'patients'],
    queryFn: () => patientsApi.list({ page: 1, pageSize: 1 }),
  });
  const appointments = useQuery({
    queryKey: ['dashboard', 'front-desk', 'appointments', today],
    queryFn: () => appointmentsApi.list({ from: dayStart, to: dayEnd, page: 1, pageSize: 100 }),
  });
  const invoices = useQuery({
    queryKey: ['dashboard', 'front-desk', 'invoices', today],
    queryFn: () => billingApi.list({ from: dayStart, to: dayEnd, page: 1, pageSize: 100 }),
  });
  const availableDoctors = useQuery({
    queryKey: ['dashboard', 'front-desk', 'available', today],
    queryFn: () =>
      appointmentsApi.availableDoctors({
        start: now.toISOString(),
        end: weekEnd,
        page: 1,
        pageSize: 100,
      }),
  });

  const todayAppointments = useMemo(
    () => appointments.data?.appointments ?? [],
    [appointments.data],
  );
  const todayInvoices = invoices.data?.invoices ?? [];
  const outstanding = todayInvoices.reduce((total, invoice) => total + Number(invoice.balanceDue), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Today at the front desk"
        description="Patient registration, appointment flow, doctor availability and billing in one place."
        actions={
          <>
            <Link to="/front-desk/register">
              <Button variant="outline">Register patient</Button>
            </Link>
            <Link to="/front-desk/availability">
              <Button>Find availability</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patient records"
          value={patients.data?.pagination.total ?? '—'}
          hint="Registered in the hospital"
          icon={<NavIcon name="patients" className="h-4 w-4" />}
        />
        <StatCard
          label="Appointments today"
          value={appointments.data?.pagination.total ?? '—'}
          hint={`${todayAppointments.filter((item) => item.status === 'CHECKED_IN').length} checked in`}
          tone="teal"
          icon={<NavIcon name="appointments" className="h-4 w-4" />}
        />
        <StatCard
          label="Doctors available"
          value={availableDoctors.data?.doctors.length ?? '—'}
          hint="With slots in the next 7 days"
          tone="violet"
          icon={<NavIcon name="availability" className="h-4 w-4" />}
        />
        <StatCard
          label="Outstanding today"
          value={formatMoney(outstanding)}
          hint="Balance on today's invoices"
          tone="amber"
          icon={<NavIcon name="billing" className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Card>
          <CardHeader
            title="Today's appointment flow"
            description="Patients scheduled to visit today."
            action={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/front-desk/appointments">
                Manage
              </Link>
            }
          />
          <div className="mt-2">
            <AppointmentList
              appointments={[...todayAppointments].sort(
                (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
              )}
              empty="No appointments are scheduled for today."
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="mt-4 grid gap-2">
              <Link to="/front-desk/register">
                <Button variant="outline" className="w-full justify-start">Register a new patient</Button>
              </Link>
              <Link to="/front-desk/appointments">
                <Button variant="outline" className="w-full justify-start">Book or reschedule a visit</Button>
              </Link>
              <Link to="/front-desk/calendar">
                <Button variant="outline" className="w-full justify-start">Open appointment calendar</Button>
              </Link>
              <Link to="/front-desk/billing">
                <Button variant="outline" className="w-full justify-start">Raise or settle an invoice</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Doctor availability" description="Next 7 days." />
            <div className="mt-4 space-y-3">
              {(availableDoctors.data?.doctors ?? []).slice(0, 4).map((doctor) => (
                <div key={doctor.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      Dr. {doctor.firstName} {doctor.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{doctor.specialization}</p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {doctor.availableSlotCount} slots
                  </span>
                </div>
              ))}
              {availableDoctors.data?.doctors.length === 0 ? (
                <EmptyState title="No availability" description="No doctor slots in the next 7 days." className="py-4" />
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Today's invoices"
          description="Recent billing activity from the front desk."
          action={
            <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/front-desk/billing">
              Open billing
            </Link>
          }
        />
        <div className="mt-2">
          <InvoiceList invoices={todayInvoices} />
        </div>
      </Card>
    </div>
  );
}

function ClinicianDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const today = toDateInput(now);
  const dayStart = startOfDay(now).toISOString();
  const dayEnd = endOfDay(now).toISOString();
  const weekEnd = endOfDay(addDays(now, 7)).toISOString();

  const appointments = useQuery({
    queryKey: ['dashboard', 'clinician', 'appointments', today],
    queryFn: () => appointmentsApi.list({ from: dayStart, to: dayEnd, page: 1, pageSize: 100 }),
  });
  const upcoming = useQuery({
    queryKey: ['dashboard', 'clinician', 'upcoming', today],
    queryFn: () => appointmentsApi.list({ from: now.toISOString(), to: weekEnd, page: 1, pageSize: 100 }),
  });
  const activeVisits = useQuery({
    queryKey: ['dashboard', 'clinician', 'active-visits'],
    queryFn: () => visitsApi.list({ status: 'IN_PROGRESS', page: 1, pageSize: 5 }),
  });
  const recentVisits = useQuery({
    queryKey: ['dashboard', 'clinician', 'visits'],
    queryFn: () => visitsApi.list({ page: 1, pageSize: 6 }),
  });
  const patients = useQuery({
    queryKey: ['dashboard', 'clinician', 'patients'],
    queryFn: () => patientsApi.list({ page: 1, pageSize: 1 }),
  });

  const todayAppointments = useMemo(
    () => appointments.data?.appointments ?? [],
    [appointments.data],
  );
  const upcomingAppointments = upcoming.data?.appointments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician"
        title={`Good day, Dr. ${user?.lastName ?? ''}`.trim()}
        description="Your schedule, active visits and recent clinical activity."
        actions={
          <>
            <Link to="/clinician/visits">
              <Button variant="outline">Open visits</Button>
            </Link>
            <Link to="/clinician/patients">
              <Button>My patients</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Appointments today"
          value={appointments.data?.pagination.total ?? '—'}
          hint={`${todayAppointments.filter((item) => item.status === 'COMPLETED').length} completed`}
          icon={<NavIcon name="appointments" className="h-4 w-4" />}
        />
        <StatCard
          label="Next 7 days"
          value={upcoming.data?.pagination.total ?? '—'}
          hint={`${upcomingAppointments.filter((item) => item.status === 'SCHEDULED').length} awaiting confirmation`}
          tone="teal"
          icon={<NavIcon name="calendar" className="h-4 w-4" />}
        />
        <StatCard
          label="Active visits"
          value={activeVisits.data?.pagination.total ?? '—'}
          hint="In progress now"
          tone="amber"
          icon={<NavIcon name="visits" className="h-4 w-4" />}
        />
        <StatCard
          label="Assigned patients"
          value={patients.data?.pagination.total ?? '—'}
          hint="Patients under your care"
          tone="violet"
          icon={<NavIcon name="patients" className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Today's schedule"
            description="Your appointment list for today."
            action={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/clinician/appointments">
                Full schedule
              </Link>
            }
          />
          <div className="mt-2">
            <AppointmentList
              appointments={[...todayAppointments].sort(
                (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
              )}
              empty="No appointments are scheduled for you today."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent visits"
            description="Latest patient encounters."
            action={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/clinician/visits">
                All visits
              </Link>
            }
          />
          <div className="mt-2">
            <VisitList visits={recentVisits.data?.visits ?? []} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Upcoming appointments" description="Next seven days, soonest first." />
          <div className="mt-2">
            <AppointmentList
              appointments={[...upcomingAppointments].sort(
                (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
              )}
              empty="No upcoming appointments in the next seven days."
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Quick links" />
          <div className="mt-4 grid gap-2">
            <Link to="/clinician/visits">
              <Button variant="outline" className="w-full justify-start">Record a visit</Button>
            </Link>
            <Link to="/clinician/notes">
              <Button variant="outline" className="w-full justify-start">Add a clinical note</Button>
            </Link>
            <Link to="/clinician/prescriptions">
              <Button variant="outline" className="w-full justify-start">Issue a prescription</Button>
            </Link>
            <Link to="/clinician/reports">
              <Button variant="outline" className="w-full justify-start">Review diagnostic reports</Button>
            </Link>
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Next appointment
            </p>
            {upcomingAppointments[0] ? (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {upcomingAppointments[0].patient.firstName} {upcomingAppointments[0].patient.lastName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {timeRangeLabel(upcomingAppointments[0].scheduledStart, upcomingAppointments[0].scheduledEnd)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No upcoming appointments.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'FRONT_DESK') return <FrontDeskDashboard />;
  if (user?.role === 'CLINICIAN') return <ClinicianDashboard />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your workspace is ready." />
      <Card>
        <EmptyState title="Nothing to show yet" description="Use the navigation to open your workspace." />
      </Card>
    </div>
  );
}

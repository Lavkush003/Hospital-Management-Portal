import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileHeart,
  HeartPulse,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AreaTrendChart, BarDistribution, ChartCard, DonutChart } from '../components/Charts';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  fullName,
  doctorName,
  titleCase,
} from '../lib/utils';

function AppointmentTable({ appointments, empty = 'No appointments scheduled.' }) {
  if (!appointments?.length) return <EmptyState title={empty} icon={CalendarDays} />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Patient</Th>
          <Th>Doctor</Th>
          <Th>Date & time</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appointment) => (
          <Tr key={appointment._id}>
            <Td>
              <div className="flex items-center gap-2.5">
                <Avatar firstName={appointment.patient?.firstName} lastName={appointment.patient?.lastName} size="sm" />
                <div>
                  <p className="font-semibold text-slate-800">{fullName(appointment.patient)}</p>
                  <p className="text-[11px] text-slate-400">{appointment.patient?.patientId || appointment.appointmentNumber}</p>
                </div>
              </div>
            </Td>
            <Td>{doctorName(appointment.doctor)}</Td>
            <Td>
              <p>{formatDate(appointment.date)}</p>
              <p className="text-[11px] text-slate-400">{formatTime(appointment.startTime)}</p>
            </Td>
            <Td><StatusBadge status={appointment.status} /></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function RecentPatients({ patients }) {
  if (!patients?.length) return <EmptyState title="No patients registered yet." icon={Users} />;
  return (
    <div className="divide-y divide-slate-100">
      {patients.map((patient) => (
        <div key={patient._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Avatar firstName={patient.firstName} lastName={patient.lastName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{fullName(patient)}</p>
            <p className="text-[11px] text-slate-400">{patient.patientId} · {patient.phone}</p>
          </div>
          <span className="text-[11px] text-slate-400">{formatDate(patient.createdAt || patient.registrationDate)}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ activities }) {
  if (!activities?.length) return <EmptyState title="No recent activity." icon={AlertCircle} />;
  return (
    <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-slate-100">
      {activities.map((activity) => (
        <div key={activity._id} className="relative flex gap-3">
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <Clock3 size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">{titleCase(activity.action)}</p>
            <p className="text-[11px] text-slate-400">
              {activity.actor ? `${activity.actor.firstName} ${activity.actor.lastName}` : 'System'} · {formatDateTime(activity.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const endpoint = user.role === 'ADMIN' ? '/dashboard/admin' : user.role === 'DOCTOR' ? '/dashboard/doctor' : '/dashboard/receptionist';
    try {
      const response = await api.get(endpoint);
      setData(response.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Could not load dashboard</p>
        <p className="mt-1">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={load}>Try again</Button>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const isDoctor = user.role === 'DOCTOR';
  const stats = data?.stats || {};

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.firstName}`}
        description={
          isAdmin
            ? 'A live view of hospital activity, clinical throughput and revenue.'
            : isDoctor
              ? 'Your schedule, patient queue and recent clinical activity.'
              : 'Today’s front-office activity and patient flow.'
        }
        actions={
          isDoctor ? (
            <Link to="/encounters"><Button><HeartPulse size={16} /> New encounter</Button></Link>
          ) : (
            <Link to="/appointments"><Button><CalendarDays size={16} /> Manage appointments</Button></Link>
          )
        }
      />

      {isAdmin ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Active patients" value={stats.totalPatients} icon={Users} tone="teal" hint="Registered and active" />
            <StatCard label="Doctors" value={stats.totalDoctors} icon={Stethoscope} tone="blue" hint={`${stats.totalDepartments} active departments`} />
            <StatCard label="Staff" value={stats.totalStaff} icon={Users} tone="violet" hint="Non-terminated accounts" />
            <StatCard label="Today's visits" value={stats.todaysAppointments} icon={CalendarClock} tone="amber" hint={`${stats.pendingAppointments} pending overall`} />
            <StatCard label="Revenue collected" value={formatCurrency(stats.totalRevenue)} icon={Wallet} tone="emerald" hint="Across all invoices" />
            <StatCard label="Outstanding" value={formatCurrency(stats.pendingPayments)} icon={Wallet} tone="rose" hint="Unpaid balances" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Appointments — last 7 days" description="Daily appointment volume">
              <AreaTrendChart data={data.charts?.appointmentsByDay || []} />
            </ChartCard>
            <ChartCard title="Revenue trend — last 6 months" description="Collected payments by month">
              <AreaTrendChart data={data.charts?.monthlyRevenue || []} color="#0ea5e9" valueFormatter={formatCurrency} />
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <ChartCard title="Appointment status mix">
              <DonutChart data={data.charts?.statusDistribution || []} />
            </ChartCard>
            <ChartCard title="Department workload" className="xl:col-span-2">
              <BarDistribution data={data.charts?.departmentDistribution || []} horizontal height={260} />
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Recent appointments</h2>
                <Link to="/appointments" className="text-xs font-semibold text-teal-700 hover:text-teal-800">View all</Link>
              </div>
              <AppointmentTable appointments={data.recent?.appointments || []} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Recent activity</h2>
              <ActivityFeed activities={data.recent?.activities || []} />
            </div>
          </div>
        </>
      ) : isDoctor ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today's appointments" value={stats.todaysAppointments} icon={CalendarDays} />
            <StatCard label="Upcoming queue" value={stats.upcomingAppointments} icon={CalendarClock} tone="blue" />
            <StatCard label="Completed visits" value={stats.completedVisits} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Pending notes" value={stats.pendingVisits} icon={FileHeart} tone="amber" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Today’s schedule</h2>
                <Link to="/appointments" className="text-xs font-semibold text-teal-700 hover:text-teal-800">Full schedule</Link>
              </div>
              <AppointmentTable appointments={data.todaySchedule || []} empty="No appointments scheduled for today." />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Upcoming patients</h2>
              {(data.upcomingPatients || []).length ? (
                <div className="space-y-3">
                  {data.upcomingPatients.map((appointment) => (
                    <div key={appointment._id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                      <Avatar firstName={appointment.patient?.firstName} lastName={appointment.patient?.lastName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{fullName(appointment.patient)}</p>
                        <p className="text-[11px] text-slate-400">{formatDate(appointment.date)} · {formatTime(appointment.startTime)}</p>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No upcoming patients." icon={CalendarClock} />}
            </div>
          </div>

          <div className="mt-5">
            <h2 className="mb-3 text-sm font-bold text-slate-800">Recent visits</h2>
            {(data.recentVisits || []).length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.recentVisits.map((visit) => (
                  <div key={visit._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{fullName(visit.patient)}</p>
                      <StatusBadge status={visit.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{visit.encounterId} · {formatDate(visit.encounterDate)}</p>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{visit.chiefComplaint}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No recent visits." icon={HeartPulse} />}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Today's appointments" value={stats.todaysAppointments} icon={CalendarDays} />
            <StatCard label="Upcoming" value={stats.upcomingAppointments} icon={CalendarClock} tone="blue" />
            <StatCard label="Checked in" value={stats.checkedInPatients} icon={CheckCircle2} tone="amber" />
            <StatCard label="Unpaid invoices" value={stats.unpaidInvoices} icon={CircleDollarSign} tone="rose" />
            <StatCard label="Outstanding" value={formatCurrency(stats.pendingPayments)} icon={Wallet} tone="emerald" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Today’s front-desk schedule</h2>
                <Link to="/appointments" className="text-xs font-semibold text-teal-700 hover:text-teal-800">Manage</Link>
              </div>
              <AppointmentTable appointments={data.todaySchedule || []} empty="No appointments scheduled for today." />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Recently registered</h2>
              <RecentPatients patients={data.recent?.patients || []} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold text-slate-800">Recent appointments</h2>
              <AppointmentTable appointments={data.recent?.appointments || []} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-800">Latest payments</h2>
              {(data.recent?.payments || []).length ? (
                <div className="divide-y divide-slate-100">
                  {data.recent.payments.map((payment) => (
                    <div key={payment._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wallet size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(payment.amount)} · {titleCase(payment.method)}</p>
                        <p className="text-[11px] text-slate-400">{payment.invoice?.invoiceNumber} · {formatDateTime(payment.paidAt)}</p>
                      </div>
                      <Badge tone="success">SUCCESS</Badge>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No payments recorded yet." icon={Wallet} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

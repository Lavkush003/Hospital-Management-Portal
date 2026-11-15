import { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, CalendarCheck2, DollarSign, RefreshCw, Users } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { AreaTrendChart, BarDistribution, ChartCard, DonutChart, MultiLineChart } from '../components/Charts';
import {
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { doctorName, daysAgoKey, formatCurrency, formatDate, formatNumber, fullName, titleCase, todayKey } from '../lib/utils';

const TABS = [
  { value: 'appointments', label: 'Appointments' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'patients', label: 'Patients' },
  { value: 'departments', label: 'Departments' },
];

const ENDPOINTS = {
  appointments: '/reports/appointments',
  revenue: '/reports/revenue',
  patients: '/reports/patients',
  departments: '/reports/departments',
};

export default function ReportsPage() {
  const [tab, setTab] = useState('appointments');
  const [dateFrom, setDateFrom] = useState(daysAgoKey(30));
  const [dateTo, setDateTo] = useState(todayKey());
  const [doctor, setDoctor] = useState('');
  const [department, setDepartment] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get('/doctors', { params: { limit: 100 } })
      .then((response) => setDoctors(response.data.data || []))
      .catch(() => {});
    api.get('/departments', { params: { limit: 100 } })
      .then((response) => setDepartments(response.data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(ENDPOINTS[tab], {
        params: { dateFrom, dateTo, doctor: tab === 'appointments' ? doctor : undefined, department: tab === 'appointments' ? department : undefined },
      });
      setData(response.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo, doctor, department]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Operational and financial performance across a selected period."
        actions={<Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={16} /> Refresh</Button>}
      />

      <Tabs tabs={TABS} active={tab} onChange={(value) => { setTab(value); setDoctor(''); setDepartment(''); }} />

      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date from"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
        <Field label="Date to"><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
        {tab === 'appointments' ? (
          <>
            <Field label="Doctor">
              <Select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                <option value="">All doctors</option>
                {doctors.map((item) => <option key={item._id} value={item._id}>{doctorName(item)}</option>)}
              </Select>
            </Field>
            <Field label="Department">
              <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </Select>
            </Field>
          </>
        ) : null}
      </div>

      {loading ? <Spinner label="Building report…" /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : !data ? null : (
        <div className="space-y-5">
          <p className="text-xs font-medium text-slate-400">Period: {formatDate(data.range?.dateFrom)} – {formatDate(data.range?.dateTo)}</p>
          {tab === 'appointments' ? <AppointmentsReport data={data} /> : null}
          {tab === 'revenue' ? <RevenueReport data={data} /> : null}
          {tab === 'patients' ? <PatientsReport data={data} /> : null}
          {tab === 'departments' ? <DepartmentsReport data={data} /> : null}
        </div>
      )}
    </div>
  );
}

function AppointmentsReport({ data }) {
  const summary = data.summary || {};
  const charts = data.charts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total appointments" value={formatNumber(summary.totalAppointments)} icon={CalendarCheck2} />
        <StatCard label="Completed" value={formatNumber(summary.completed)} icon={Activity} tone="emerald" />
        <StatCard label="Pending" value={formatNumber(summary.pending)} icon={CalendarCheck2} tone="amber" />
        <StatCard label="Cancelled" value={formatNumber(summary.cancelled)} icon={CalendarCheck2} tone="rose" />
        <StatCard label="No-show" value={formatNumber(summary.noShow)} icon={CalendarCheck2} tone="violet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Appointments by day"><AreaTrendChart data={charts.byDay || []} /></ChartCard>
        <ChartCard title="Status mix"><DonutChart data={charts.byStatus || []} /></ChartCard>
        <ChartCard title="Appointments by doctor"><BarDistribution data={charts.byDoctor || []} horizontal /></ChartCard>
        <ChartCard title="Appointments by department"><BarDistribution data={charts.byDepartment || []} color="#8b5cf6" horizontal /></ChartCard>
      </div>
      <Table>
        <thead><tr><Th>Date</Th><Th>Time</Th><Th>Patient</Th><Th>Doctor</Th><Th>Department</Th><Th>Status</Th></tr></thead>
        <tbody>
          {(data.rows || []).map((row) => (
            <Tr key={row._id}>
              <Td>{formatDate(row.date)}</Td>
              <Td>{row.startTime}–{row.endTime}</Td>
              <Td>{fullName(row.patient)}</Td>
              <Td>{doctorName(row.doctor)}</Td>
              <Td>{row.department?.name || '—'}</Td>
              <Td><StatusBadge status={row.status} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function RevenueReport({ data }) {
  const summary = data.summary || {};
  const charts = data.charts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total billed" value={formatCurrency(summary.totalBilled)} icon={DollarSign} />
        <StatCard label="Total collected" value={formatCurrency(summary.totalCollected)} icon={DollarSign} tone="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} icon={DollarSign} tone="rose" />
        <StatCard label="Tax collected" value={formatCurrency(summary.tax)} icon={DollarSign} tone="violet" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Billed vs collected" description="Daily totals across the selected period"><MultiLineChart data={charts.byDay || []} series={[{ key: 'billed', label: 'Billed', color: '#0d9488' }, { key: 'collected', label: 'Collected', color: '#0ea5e9' }]} valueFormatter={formatCurrency} /></ChartCard>
        <ChartCard title="Invoice status"><DonutChart data={charts.byStatus || []} /></ChartCard>
        <ChartCard title="Collections by method"><BarDistribution data={charts.byMethod || []} color="#10b981" valueFormatter={formatCurrency} /></ChartCard>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">Revenue breakdown</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-semibold text-slate-800">{formatCurrency(summary.subtotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Discounts</span><span className="font-semibold text-slate-800">−{formatCurrency(summary.discount)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Tax</span><span className="font-semibold text-slate-800">{formatCurrency(summary.tax)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-slate-500"><span>Total billed</span><span className="font-semibold text-slate-800">{formatCurrency(summary.totalBilled)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Collected</span><span className="font-semibold text-emerald-600">{formatCurrency(summary.totalCollected)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Outstanding</span><span className="font-semibold text-rose-600">{formatCurrency(summary.outstanding)}</span></div>
          </div>
        </div>
      </div>
      <Table>
        <thead><tr><Th>Invoice</Th><Th>Patient</Th><Th>Invoice date</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
        <tbody>
          {(data.rows || []).map((row) => (
            <Tr key={row._id}>
              <Td><Badge tone="neutral">{row.invoiceNumber}</Badge></Td>
              <Td>{fullName(row.patient)}</Td>
              <Td>{formatDate(row.invoiceDate)}</Td>
              <Td className="font-semibold text-slate-800">{formatCurrency(row.totalAmount)}</Td>
              <Td>{formatCurrency(row.amountPaid)}</Td>
              <Td>{formatCurrency(row.balanceDue)}</Td>
              <Td><StatusBadge status={row.status} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function PatientsReport({ data }) {
  const charts = data.charts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New patients" value={formatNumber(data.summary?.totalPatients)} icon={Users} />
        <StatCard label="Gender segments" value={formatNumber((charts.byGender || []).length)} icon={Users} tone="violet" />
        <StatCard label="Blood groups" value={formatNumber((charts.byBloodGroup || []).length)} icon={Activity} tone="rose" />
        <StatCard label="Status groups" value={formatNumber((charts.byStatus || []).length)} icon={Users} tone="emerald" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Registrations by month"><AreaTrendChart data={charts.byMonth || []} /></ChartCard>
        <ChartCard title="Gender distribution"><DonutChart data={charts.byGender || []} /></ChartCard>
        <ChartCard title="Blood group distribution"><BarDistribution data={charts.byBloodGroup || []} color="#f59e0b" /></ChartCard>
        <ChartCard title="Patient status"><DonutChart data={charts.byStatus || []} /></ChartCard>
      </div>
      <Table>
        <thead><tr><Th>Patient</Th><Th>Patient ID</Th><Th>Gender</Th><Th>Blood group</Th><Th>Registered</Th><Th>Status</Th></tr></thead>
        <tbody>
          {(data.rows || []).map((row) => (
            <Tr key={row._id}>
              <Td className="font-semibold text-slate-800">{fullName(row)}</Td>
              <Td>{row.patientId}</Td>
              <Td>{titleCase(row.gender)}</Td>
              <Td>{String(row.bloodGroup || '—').replace(/_/g, ' ')}</Td>
              <Td>{formatDate(row.registrationDate)}</Td>
              <Td><StatusBadge status={row.status} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function DepartmentsReport({ data }) {
  const summary = data.summary || {};
  const charts = data.charts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Departments" value={formatNumber(summary.totalDepartments)} icon={Building2} />
        <StatCard label="Appointments" value={formatNumber(summary.totalAppointments)} icon={CalendarCheck2} tone="violet" />
        <StatCard label="Revenue collected" value={formatCurrency(summary.totalRevenue)} icon={DollarSign} tone="emerald" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Appointments by department"><BarDistribution data={charts.byDepartment || []} horizontal /></ChartCard>
        <ChartCard title="Revenue by department"><BarDistribution data={charts.revenueByDepartment || []} color="#10b981" horizontal valueFormatter={formatCurrency} /></ChartCard>
      </div>
      <Table>
        <thead><tr><Th>Department</Th><Th>Code</Th><Th>Doctors</Th><Th>Appointments</Th><Th>Completed</Th><Th>Cancelled</Th><Th>Billed</Th><Th>Collected</Th></tr></thead>
        <tbody>
          {(data.rows || []).map((row) => (
            <Tr key={row.code}>
              <Td className="font-semibold text-slate-800">{row.department}</Td>
              <Td><Badge tone="info">{row.code}</Badge></Td>
              <Td>{row.doctors}</Td>
              <Td>{row.appointments}</Td>
              <Td>{row.completed}</Td>
              <Td>{row.cancelled}</Td>
              <Td>{formatCurrency(row.revenueBilled)}</Td>
              <Td className="font-semibold text-emerald-600">{formatCurrency(row.revenueCollected)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

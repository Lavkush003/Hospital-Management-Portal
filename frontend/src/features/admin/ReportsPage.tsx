import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AdminReports,
  AppointmentReportBucket,
  DepartmentAppointmentSummary,
  DoctorAppointmentSummary,
  OutstandingInvoiceReportItem,
  PaymentSummary,
} from '@/types/api';
import { adminApi } from '@/services/hms';
import { endOfDay, fromDateInput, startOfDay, toDateInput } from '@/utils/date';
import { formatMoney, formatDateTime, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { StatCard } from '@/components/ui/Display';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 25;
const MAX_RANGE_MS = 366 * 86_400_000;

function initialFrom(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadReportCsv(
  report: AdminReports,
  from: string,
  to: string,
) {
  const rows: Array<Array<string | number>> = [
    ['section', 'period_or_group', 'currency', 'status_or_method', 'total', 'completed', 'cancelled', 'no_show', 'successful_payments', 'invoiced', 'outstanding', 'utilization_percent'],
    ...report.dailyAppointments.map((item) => [
      'daily_appointments', item.date, '', '', item.total, item.completed, item.cancelled, item.noShow, '', '', '', '',
    ]),
    ...report.monthlyAppointments.map((item) => [
      'monthly_appointments', item.date, '', '', item.total, item.completed, item.cancelled, item.noShow, '', '', '', '',
    ]),
    ...report.departmentAppointments.map((item) => [
      'department_appointments', item.departmentName, '', '', item.total, item.completed, item.cancelled, item.noShow, '', '', '', '',
    ]),
    ...report.doctorAppointments.map((item) => [
      'doctor_appointments', item.doctorName, '', '', item.total, item.completed, item.cancelled, item.noShow, '', '', '',
      item.utilizationPercent ?? '',
    ]),
    ...report.financialsByCurrency.map((item) => [
      'billing_summary', '', item.currency, '', '', '', '', '', item.successfulPaymentAmount, item.invoicedAmount,
      item.outstandingBalance, '',
    ]),
    ...report.paymentSummary.map((item) => [
      'payment_summary', '', item.currency, `${item.status}_${item.method}`, item.count, '', '', '', item.amount, '', '', '',
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hospital-report-${from}-to-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function useReportData() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const range = useMemo(() => {
    const startDate = fromDateInput(from);
    const endDate = fromDateInput(to);
    if (!startDate || !endDate || startDate > endDate) return null;
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    if (end.getTime() - start.getTime() > MAX_RANGE_MS) return null;
    return { from: start.toISOString(), to: end.toISOString() };
  }, [from, to]);

  const query = useQuery({
    queryKey: ['reports', range, search, page],
    queryFn: () =>
      adminApi.reports({
        ...range!,
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
      }),
    enabled: range !== null,
  });

  return { from, setFrom, to, setTo, search, setSearch, page, setPage, range, query };
}

export function ReportsPage() {
  const { from, setFrom, to, setTo, search, setSearch, setPage, range, query } = useReportData();
  const report = query.data;
  const dailyRows = report?.dailyAppointments ?? [];
  const appointmentTotals = dailyRows.reduce(
    (totals, row) => ({
      total: totals.total + row.total,
      completed: totals.completed + row.completed,
      cancelled: totals.cancelled + row.cancelled,
      noShow: totals.noShow + row.noShow,
    }),
    { total: 0, completed: 0, cancelled: 0, noShow: 0 },
  );
  const monthlyColumns: Array<Column<AppointmentReportBucket>> = [
    { key: 'month', header: 'Month', render: (row) => <span className="text-sm font-medium">{row.date}</span> },
    { key: 'total', header: 'Appointments', render: (row) => row.total },
    { key: 'completed', header: 'Completed', render: (row) => row.completed },
    { key: 'cancelled', header: 'Cancelled', render: (row) => row.cancelled },
    { key: 'noShow', header: 'No-show', render: (row) => row.noShow },
  ];
  const departmentColumns: Array<Column<DepartmentAppointmentSummary>> = [
    { key: 'department', header: 'Department', render: (row) => row.departmentName },
    { key: 'total', header: 'Appointments', render: (row) => row.total },
    { key: 'completed', header: 'Completed', render: (row) => row.completed },
    { key: 'cancelled', header: 'Cancelled', render: (row) => row.cancelled },
    { key: 'noShow', header: 'No-show', render: (row) => row.noShow },
  ];
  const doctorColumns: Array<Column<DoctorAppointmentSummary>> = [
    {
      key: 'doctor',
      header: 'Doctor',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.doctorName}</p>
          <p className="text-xs text-slate-500">{row.specialization} · {row.departmentName}</p>
        </div>
      ),
    },
    { key: 'total', header: 'Appointments', render: (row) => row.total },
    { key: 'completed', header: 'Completed', render: (row) => row.completed },
    {
      key: 'utilization',
      header: 'Utilization',
      render: (row) => row.utilizationPercent === null ? '—' : `${row.utilizationPercent}%`,
    },
  ];
  const paymentColumns: Array<Column<PaymentSummary>> = [
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)} dot>{humanize(row.status)}</Badge>,
    },
    { key: 'method', header: 'Method', render: (row) => humanize(row.method) },
    { key: 'currency', header: 'Currency', render: (row) => row.currency },
    { key: 'count', header: 'Transactions', render: (row) => row.count },
    { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount, row.currency) },
  ];
  const invoiceColumns: Array<Column<OutstandingInvoiceReportItem>> = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.invoiceNumber}</p>
          <p className="text-xs text-slate-500">{row.patientNumber} · {row.firstName} {row.lastName}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={statusTone(row.status)} dot>{humanize(row.status)}</Badge>,
    },
    { key: 'date', header: 'Invoice date', render: (row) => formatDateTime(row.invoiceDate) },
    {
      key: 'due',
      header: 'Due date',
      render: (row) => row.dueAt ? formatDateTime(row.dueAt) : '—',
    },
    {
      key: 'balance',
      header: 'Outstanding',
      render: (row) => <span className="font-semibold">{formatMoney(row.balanceDue, row.currency)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Live PostgreSQL summaries for appointments, departments, doctors and billing."
        actions={
          <Button
            variant="outline"
            disabled={!report || query.isFetching}
            onClick={() => report && downloadReportCsv(report, from, to)}
          >
            Export summary CSV
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="report-from">From</label>
            <Input id="report-from" type="date" value={from} max={to} onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="report-to">To</label>
            <Input id="report-to" type="date" value={to} min={from} onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }} />
          </div>
          <Button variant="outline" disabled={!range || query.isFetching} onClick={() => void query.refetch()}>
            Refresh reports
          </Button>
        </div>
        {!range ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Select a valid date range of 366 days or less.
          </p>
        ) : null}
      </Card>

      {query.isError ? (
        <Card>
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Appointments" value={query.isPending ? '—' : String(appointmentTotals.total)} hint="Selected period" />
        <StatCard label="Completed" value={query.isPending ? '—' : String(appointmentTotals.completed)} hint="Appointments completed" tone="teal" />
        <StatCard label="Cancelled" value={query.isPending ? '—' : String(appointmentTotals.cancelled)} hint="Appointments cancelled" tone="rose" />
        <StatCard label="No-show rate" value={appointmentTotals.total ? `${((appointmentTotals.noShow / appointmentTotals.total) * 100).toFixed(1)}%` : '0.0%'} hint={`${appointmentTotals.noShow} no-show appointments`} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Daily appointment summary" description="Daily totals with completed appointments." />
          <div className="mt-4 h-72">
            {query.isPending ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading daily report…</p>
            ) : dailyRows.length === 0 ? (
              <EmptyState title="No appointment data" description="No appointments were found in this period." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="total" name="Appointments" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="completed" name="Completed" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card padding="none">
          <div className="px-4 pt-4 sm:px-5">
            <CardHeader title="Monthly appointment summary" description="Appointment outcomes by month." />
          </div>
          <DataTable
            columns={monthlyColumns}
            rows={report?.monthlyAppointments ?? []}
            getRowId={(row) => row.date}
            loading={query.isPending}
            empty={<EmptyState title="No monthly data" description="No appointments were found in this period." />}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padding="none">
          <div className="px-4 pt-4 sm:px-5">
            <CardHeader title="Department summary" description="Appointments grouped by department." />
          </div>
          <DataTable
            columns={departmentColumns}
            rows={report?.departmentAppointments ?? []}
            getRowId={(row) => row.departmentId}
            loading={query.isPending}
            empty={<EmptyState title="No department data" description="No appointments were found in this period." />}
          />
        </Card>
        <Card padding="none">
          <div className="px-4 pt-4 sm:px-5">
            <CardHeader title="Doctor summary" description="Workload and scheduled-time utilization." />
          </div>
          <DataTable
            columns={doctorColumns}
            rows={report?.doctorAppointments ?? []}
            getRowId={(row) => row.doctorId}
            loading={query.isPending}
            empty={<EmptyState title="No doctor data" description="No appointments were found in this period." />}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Billing summary" description="Invoice totals and successful collections, grouped by currency." />
          {report?.financialsByCurrency.length ? (
            <div className="mt-4 space-y-3">
              {report.financialsByCurrency.map((item) => (
                <dl key={item.currency} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-slate-500">Invoiced · {item.currency}</dt><dd className="mt-1 font-semibold">{formatMoney(item.invoicedAmount, item.currency)}</dd></div>
                  <div><dt className="text-slate-500">Successful payments</dt><dd className="mt-1 font-semibold text-emerald-700">{formatMoney(item.successfulPaymentAmount, item.currency)}</dd></div>
                  <div><dt className="text-slate-500">Outstanding</dt><dd className="mt-1 font-semibold text-rose-600">{formatMoney(item.outstandingBalance, item.currency)}</dd></div>
                </dl>
              ))}
            </div>
          ) : query.isPending ? (
            <p className="mt-4 text-sm text-slate-500">Loading billing summary…</p>
          ) : (
            <EmptyState title="No billing data" description="No invoices were found in this period." className="py-6" />
          )}
        </Card>
        <Card padding="none">
          <div className="px-4 pt-4 sm:px-5">
            <CardHeader title="Payment summary" description="Transaction totals by status, method and currency." />
          </div>
          <DataTable
            columns={paymentColumns}
            rows={report?.paymentSummary ?? []}
            getRowId={(row) => `${row.currency}-${row.status}-${row.method}`}
            loading={query.isPending}
            empty={<EmptyState title="No payments" description="No payment transactions were recorded in this period." />}
          />
        </Card>
      </div>

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Outstanding invoices</h3>
            <p className="text-sm text-slate-500">Unpaid balances for invoices issued during the selected period.</p>
          </div>
          <div className="w-full sm:max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="outstanding-search">Search invoices</label>
            <Input id="outstanding-search" value={search} placeholder="Invoice or patient" onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }} />
          </div>
        </div>
        <DataTable
          columns={invoiceColumns}
          rows={report?.outstandingInvoices.items ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState title="No outstanding invoices" description="All invoices in this period are paid or none were issued." />}
        />
        {report?.outstandingInvoices.pagination ? (
          <Pagination
            {...report.outstandingInvoices.pagination}
            onPageChange={setPage}
          />
        ) : null}
      </Card>
    </div>
  );
}

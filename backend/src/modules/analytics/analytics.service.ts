import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { paginationMeta, paginationWindow } from '../../utils/validation';
import type { AnalyticsQuery, ReportsQuery } from './analytics.validators';

interface AppointmentBucket {
  date: Date;
  total: number;
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface DepartmentBucket {
  departmentId: string;
  departmentName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface DoctorBucket {
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface CurrencyBucket {
  currency: string;
  amount: Prisma.Decimal;
  outstanding: Prisma.Decimal | null;
}

interface PaymentBucket {
  currency: string;
  status: string;
  method: string;
  count: number;
  amount: Prisma.Decimal;
}

interface OutstandingInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  totalAmount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  dueAt: Date | null;
  invoiceDate: Date;
  patientNumber: string;
  firstName: string;
  lastName: string;
}

interface BookedTimeRow {
  doctorId: string;
  appointmentCount: number;
  bookedMinutes: number;
}

interface MinuteInterval {
  start: number;
  end: number;
}

const dayNames = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

function timeInMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function mergedMinutes(segments: MinuteInterval[]): number {
  const sorted = segments.filter((segment) => segment.end > segment.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let active: MinuteInterval | undefined;

  for (const segment of sorted) {
    if (!active) {
      active = { ...segment };
    } else if (segment.start <= active.end) {
      active.end = Math.max(active.end, segment.end);
    } else {
      total += active.end - active.start;
      active = { ...segment };
    }
  }

  if (active) total += active.end - active.start;
  return total;
}

function availableSegments(
  start: number,
  end: number,
  blocked: MinuteInterval[],
): MinuteInterval[] {
  let segments: MinuteInterval[] = [{ start, end }];
  const sortedBlocks = blocked
    .map((block) => ({ start: Math.max(start, block.start), end: Math.min(end, block.end) }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  for (const block of sortedBlocks) {
    segments = segments.flatMap((segment) => {
      if (block.end <= segment.start || block.start >= segment.end) return [segment];
      return [
        ...(block.start > segment.start ? [{ start: segment.start, end: block.start }] : []),
        ...(block.end < segment.end ? [{ start: block.end, end: segment.end }] : []),
      ];
    });
  }

  return segments;
}

async function doctorUtilization(from: Date, to: Date) {
  const [doctors, bookedRows] = await Promise.all([
    prisma.doctor.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
        department: { select: { name: true } },
        schedules: {
          where: { isActive: true },
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            breaks: { select: { startTime: true, endTime: true } },
          },
        },
        leaves: {
          where: { startAt: { lte: to }, endAt: { gte: from } },
          select: { startAt: true, endAt: true },
        },
        unavailability: {
          where: { startAt: { lte: to }, endAt: { gte: from } },
          select: { startAt: true, endAt: true },
        },
      },
    }),
    prisma.$queryRaw<BookedTimeRow[]>(Prisma.sql`
      SELECT
        a."doctorId" AS "doctorId",
        COUNT(*) FILTER (WHERE a."status" NOT IN ('CANCELLED', 'NO_SHOW'))::int AS "appointmentCount",
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (LEAST(a."scheduledEnd", ${to}) - GREATEST(a."scheduledStart", ${from}))) / 60.0
        ) FILTER (WHERE a."status" NOT IN ('CANCELLED', 'NO_SHOW')), 0)::float8 AS "bookedMinutes"
      FROM "Appointment" a
      WHERE a."scheduledStart" < ${to} AND a."scheduledEnd" > ${from}
      GROUP BY a."doctorId"
    `),
  ]);
  const bookedByDoctor = new Map(bookedRows.map((row) => [row.doctorId, row]));
  const utilization = doctors.map((doctor) => {
    const segments: MinuteInterval[] = [];

    for (
      let day = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
      day <= to.getTime();
      day += 86_400_000
    ) {
      const date = new Date(day);
      const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      const dayEnd = dayStart + 86_400_000;

      for (const schedule of doctor.schedules) {
        if (schedule.dayOfWeek !== dayNames[date.getUTCDay()]) continue;

        const start = Math.max(dayStart + timeInMinutes(schedule.startTime) * 60_000, from.getTime());
        const end = Math.min(dayStart + timeInMinutes(schedule.endTime) * 60_000, to.getTime(), dayEnd);
        if (end <= start) continue;

        const blocked = schedule.breaks.map((breakTime) => ({
          start: dayStart + timeInMinutes(breakTime.startTime) * 60_000,
          end: dayStart + timeInMinutes(breakTime.endTime) * 60_000,
        }));
        for (const unavailable of [...doctor.leaves, ...doctor.unavailability]) {
          blocked.push({ start: unavailable.startAt.getTime(), end: unavailable.endAt.getTime() });
        }
        segments.push(...availableSegments(start, end, blocked));
      }
    }

    const availableMinutes = mergedMinutes(segments);
    const booked = bookedByDoctor.get(doctor.id);
    const bookedMinutes = booked?.bookedMinutes ?? 0;

    return {
      doctorId: doctor.id,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      specialization: doctor.specialization,
      departmentName: doctor.department.name,
      appointmentCount: booked?.appointmentCount ?? 0,
      bookedMinutes: Math.round(bookedMinutes * 100) / 100,
      availableMinutes: Math.round(availableMinutes),
      utilizationPercent:
        availableMinutes > 0 ? Math.round((bookedMinutes / availableMinutes) * 10_000) / 100 : null,
    };
  });

  const bookedTotal = utilization.reduce((total, doctor) => total + doctor.bookedMinutes, 0);
  const availableTotal = utilization.reduce((total, doctor) => total + doctor.availableMinutes, 0);

  return {
    doctors: utilization.sort(
      (a, b) => (b.utilizationPercent ?? -1) - (a.utilizationPercent ?? -1),
    ),
    utilizationPercent:
      availableTotal > 0 ? Math.round((bookedTotal / availableTotal) * 10_000) / 100 : null,
  };
}

async function billingTotals(from: Date, to: Date) {
  return prisma.$queryRaw<CurrencyBucket[]>(Prisma.sql`
    WITH successful_payments AS (
      SELECT "invoiceId", SUM("amount") AS "amountPaid"
      FROM "Payment"
      WHERE "status" = 'SUCCESSFUL'
      GROUP BY "invoiceId"
    )
    SELECT
      i."currency" AS "currency",
      COALESCE(SUM(i."totalAmount"), 0)::numeric AS "amount",
      COALESCE(SUM(GREATEST(i."totalAmount" - COALESCE(p."amountPaid", 0), 0)), 0)::numeric AS "outstanding"
    FROM "Invoice" i
    LEFT JOIN successful_payments p ON p."invoiceId" = i."id"
    WHERE i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to}
      AND i."status" NOT IN ('DRAFT', 'VOID', 'REFUNDED')
    GROUP BY i."currency"
    ORDER BY i."currency"
  `);
}

async function successfulPayments(from: Date, to: Date) {
  return prisma.$queryRaw<Array<{ currency: string; amount: Prisma.Decimal }>>(Prisma.sql`
    SELECT i."currency" AS "currency", COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
    FROM "Payment" p
    INNER JOIN "Invoice" i ON i."id" = p."invoiceId"
    WHERE p."status" = 'SUCCESSFUL'
      AND COALESCE(p."paidAt", p."createdAt") >= ${from}
      AND COALESCE(p."paidAt", p."createdAt") <= ${to}
    GROUP BY i."currency"
    ORDER BY i."currency"
  `);
}

function summarizeFinancials(
  billing: CurrencyBucket[],
  payments: Array<{ currency: string; amount: Prisma.Decimal }>,
) {
  const currencies = [...new Set([...billing.map((item) => item.currency), ...payments.map((item) => item.currency)])]
    .sort();

  return currencies.map((currency) => {
    const invoice = billing.find((item) => item.currency === currency);
    const paymentAmount = payments
      .filter((payment) => payment.currency === currency)
      .reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0));
    return {
      currency,
      invoicedAmount: (invoice?.amount ?? new Prisma.Decimal(0)).toFixed(2),
      outstandingBalance: (invoice?.outstanding ?? new Prisma.Decimal(0)).toFixed(2),
      successfulPaymentAmount: paymentAmount.toFixed(2),
    };
  });
}

export async function getDashboardAnalytics(query: AnalyticsQuery) {
  const { from, to } = query;
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000);
  const [registeredPatients, doctors, statusRows, upcomingAppointments, completedVisits, billing, payments, utilization] =
    await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { scheduledStart: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.appointment.count({
        where: {
          scheduledStart: { gte: now, lte: nextWeek },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
      }),
      prisma.visit.count({
        where: { status: 'COMPLETED', startedAt: { gte: from, lte: to } },
      }),
      billingTotals(from, to),
      successfulPayments(from, to),
      doctorUtilization(from, to),
    ]);

  const countForStatus = (status: string) =>
    statusRows.find((row) => row.status === status)?._count._all ?? 0;
  const totalAppointments = statusRows.reduce((total, row) => total + row._count._all, 0);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      registeredPatients,
      doctors,
      appointments: totalAppointments,
      completedAppointments: countForStatus('COMPLETED'),
      cancelledAppointments: countForStatus('CANCELLED'),
      upcomingAppointments,
      completedVisits,
      doctorUtilizationPercent: utilization.utilizationPercent,
    },
    financialsByCurrency: summarizeFinancials(billing, payments),
    dailyAppointments: await prisma.$queryRaw<AppointmentBucket[]>(Prisma.sql`
      SELECT
        date_trunc('day', a."scheduledStart") AS "date",
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE a."status" = 'SCHEDULED')::int AS "scheduled",
        COUNT(*) FILTER (WHERE a."status" = 'CONFIRMED')::int AS "confirmed",
        COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')::int AS "completed",
        COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')::int AS "cancelled",
        COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int AS "noShow"
      FROM "Appointment" a
      WHERE a."scheduledStart" >= ${from} AND a."scheduledStart" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `),
    doctorUtilization: utilization.doctors,
  };
}

export async function getAdminReports(query: ReportsQuery) {
  const { from, to } = query;
  const [dailyAppointments, monthlyAppointments, departmentAppointments, doctorAppointments, billing, paymentRows, outstandingInvoices, outstandingTotal] =
    await Promise.all([
      prisma.$queryRaw<AppointmentBucket[]>(Prisma.sql`
        SELECT
          date_trunc('day', a."scheduledStart") AS "date",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE a."status" = 'SCHEDULED')::int AS "scheduled",
          COUNT(*) FILTER (WHERE a."status" = 'CONFIRMED')::int AS "confirmed",
          COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')::int AS "completed",
          COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')::int AS "cancelled",
          COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int AS "noShow"
        FROM "Appointment" a
        WHERE a."scheduledStart" >= ${from} AND a."scheduledStart" <= ${to}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.$queryRaw<AppointmentBucket[]>(Prisma.sql`
        SELECT
          date_trunc('month', a."scheduledStart") AS "date",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE a."status" = 'SCHEDULED')::int AS "scheduled",
          COUNT(*) FILTER (WHERE a."status" = 'CONFIRMED')::int AS "confirmed",
          COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')::int AS "completed",
          COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')::int AS "cancelled",
          COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int AS "noShow"
        FROM "Appointment" a
        WHERE a."scheduledStart" >= ${from} AND a."scheduledStart" <= ${to}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.$queryRaw<DepartmentBucket[]>(Prisma.sql`
        SELECT
          dep."id" AS "departmentId",
          dep."name" AS "departmentName",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')::int AS "completed",
          COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')::int AS "cancelled",
          COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int AS "noShow"
        FROM "Appointment" a
        INNER JOIN "Doctor" d ON d."id" = a."doctorId"
        INNER JOIN "Department" dep ON dep."id" = d."departmentId"
        WHERE a."scheduledStart" >= ${from} AND a."scheduledStart" <= ${to}
        GROUP BY dep."id", dep."name"
        ORDER BY "total" DESC, dep."name" ASC
      `),
      prisma.$queryRaw<DoctorBucket[]>(Prisma.sql`
        SELECT
          d."id" AS "doctorId",
          d."firstName" || ' ' || d."lastName" AS "doctorName",
          d."specialization" AS "specialization",
          dep."name" AS "departmentName",
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')::int AS "completed",
          COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')::int AS "cancelled",
          COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int AS "noShow"
        FROM "Appointment" a
        INNER JOIN "Doctor" d ON d."id" = a."doctorId"
        INNER JOIN "Department" dep ON dep."id" = d."departmentId"
        WHERE a."scheduledStart" >= ${from} AND a."scheduledStart" <= ${to}
        GROUP BY d."id", d."firstName", d."lastName", d."specialization", dep."name"
        ORDER BY "total" DESC, "doctorName" ASC
      `),
      billingTotals(from, to),
      prisma.$queryRaw<PaymentBucket[]>(Prisma.sql`
        SELECT
          i."currency" AS "currency",
          p."status"::text AS "status",
          p."method"::text AS "method",
          COUNT(*)::int AS "count",
          COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
        FROM "Payment" p
        INNER JOIN "Invoice" i ON i."id" = p."invoiceId"
        WHERE COALESCE(p."paidAt", p."createdAt") >= ${from}
          AND COALESCE(p."paidAt", p."createdAt") <= ${to}
        GROUP BY i."currency", p."status", p."method"
        ORDER BY i."currency", p."status", p."method"
      `),
      getOutstandingInvoices(query),
      countOutstandingInvoices(query),
    ]);

  const financialsByCurrency = summarizeFinancials(
    billing,
    paymentRows
      .filter((payment) => payment.status === 'SUCCESSFUL')
      .map(({ currency, amount }) => ({ currency, amount })),
  );
  const utilization = await doctorUtilization(from, to);

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    dailyAppointments: serializeBuckets(dailyAppointments, 'day'),
    monthlyAppointments: serializeBuckets(monthlyAppointments, 'month'),
    departmentAppointments,
    doctorAppointments: doctorAppointments.map((doctor) => ({
      ...doctor,
      utilizationPercent:
        utilization.doctors.find((item) => item.doctorId === doctor.doctorId)?.utilizationPercent ?? null,
    })),
    doctorUtilization: utilization.doctors,
    financialsByCurrency,
    paymentSummary: paymentRows.map((payment) => ({
      ...payment,
      amount: payment.amount.toFixed(2),
    })),
    outstandingInvoices: {
      items: outstandingInvoices.map((invoice) => ({
        ...invoice,
        totalAmount: invoice.totalAmount.toFixed(2),
        amountPaid: invoice.amountPaid.toFixed(2),
        balanceDue: invoice.balanceDue.toFixed(2),
      })),
      pagination: paginationMeta(outstandingTotal, query.page, query.pageSize),
    },
  };
}

function serializeBuckets(rows: AppointmentBucket[], precision: 'day' | 'month') {
  return rows.map((row) => ({
    date: precision === 'month' ? row.date.toISOString().slice(0, 7) : row.date.toISOString().slice(0, 10),
    total: row.total,
    scheduled: row.scheduled,
    confirmed: row.confirmed,
    completed: row.completed,
    cancelled: row.cancelled,
    noShow: row.noShow,
  }));
}

function outstandingWhere(query: ReportsQuery) {
  const search = query.search ? `%${query.search}%` : undefined;
  return { search };
}

async function getOutstandingInvoices(query: ReportsQuery): Promise<OutstandingInvoiceRow[]> {
  const { search } = outstandingWhere(query);
  const { skip, take } = paginationWindow(query.page, query.pageSize);
  return prisma.$queryRaw<OutstandingInvoiceRow[]>(Prisma.sql`
    WITH successful_payments AS (
      SELECT "invoiceId", SUM("amount") AS "amountPaid"
      FROM "Payment"
      WHERE "status" = 'SUCCESSFUL'
      GROUP BY "invoiceId"
    )
    SELECT
      i."id" AS "id",
      i."invoiceNumber" AS "invoiceNumber",
      i."status"::text AS "status",
      i."currency" AS "currency",
      i."totalAmount" AS "totalAmount",
      COALESCE(p."amountPaid", 0)::numeric AS "amountPaid",
      GREATEST(i."totalAmount" - COALESCE(p."amountPaid", 0), 0)::numeric AS "balanceDue",
      i."dueAt" AS "dueAt",
      i."invoiceDate" AS "invoiceDate",
      patient."patientNumber" AS "patientNumber",
      patient."firstName" AS "firstName",
      patient."lastName" AS "lastName"
    FROM "Invoice" i
    INNER JOIN "Patient" patient ON patient."id" = i."patientId"
    LEFT JOIN successful_payments p ON p."invoiceId" = i."id"
    WHERE i."invoiceDate" >= ${query.from} AND i."invoiceDate" <= ${query.to}
      AND i."status" IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
      AND i."totalAmount" > COALESCE(p."amountPaid", 0)
      ${search ? Prisma.sql`AND (
        i."invoiceNumber" ILIKE ${search}
        OR patient."patientNumber" ILIKE ${search}
        OR patient."firstName" ILIKE ${search}
        OR patient."lastName" ILIKE ${search}
      )` : Prisma.empty}
    ORDER BY i."dueAt" ASC NULLS LAST, i."invoiceDate" DESC, i."id" ASC
    OFFSET ${skip} LIMIT ${take}
  `);
}

async function countOutstandingInvoices(query: ReportsQuery): Promise<number> {
  const { search } = outstandingWhere(query);
  const result = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
    WITH successful_payments AS (
      SELECT "invoiceId", SUM("amount") AS "amountPaid"
      FROM "Payment"
      WHERE "status" = 'SUCCESSFUL'
      GROUP BY "invoiceId"
    )
    SELECT COUNT(*)::int AS "total"
    FROM "Invoice" i
    INNER JOIN "Patient" patient ON patient."id" = i."patientId"
    LEFT JOIN successful_payments p ON p."invoiceId" = i."id"
    WHERE i."invoiceDate" >= ${query.from} AND i."invoiceDate" <= ${query.to}
      AND i."status" IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
      AND i."totalAmount" > COALESCE(p."amountPaid", 0)
      ${search ? Prisma.sql`AND (
        i."invoiceNumber" ILIKE ${search}
        OR patient."patientNumber" ILIKE ${search}
        OR patient."firstName" ILIKE ${search}
        OR patient."lastName" ILIKE ${search}
      )` : Prisma.empty}
  `);
  return result[0]?.total ?? 0;
}

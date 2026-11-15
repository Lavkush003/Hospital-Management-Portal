const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Encounter = require('../models/Encounter');
const AuditLog = require('../models/AuditLog');
const { toDateKey } = require('../utils/dates');

const PENDING_STATUSES = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function lastDays(count) {
  const days = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return days;
}

function lastMonths(count) {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }
  return months;
}

function fillSeries(keys, rows, valueKey = 'count') {
  const map = new Map(rows.map((row) => [row._id, row[valueKey] || 0]));
  return keys.map((key) => ({ name: key, value: map.get(key) || 0 }));
}

function populateRecentAppointments(limit, extraFilter = {}) {
  return Appointment.find(extraFilter)
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName specialization')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function getAdminDashboard() {
  const today = toDateKey();
  const dayKeys = lastDays(7);
  const monthKeys = lastMonths(6);
  const startDay = dayKeys[0];
  const startMonthDate = new Date(`${monthKeys[0]}-01T00:00:00.000Z`);

  const [
    totalPatients,
    totalDoctors,
    totalStaff,
    totalDepartments,
    todaysAppointments,
    completedAppointments,
    pendingAppointments,
    cancelledAppointments,
    revenueAgg,
    pendingAgg,
    appointmentsByDay,
    monthlyRevenue,
    statusDistribution,
    departmentDistribution,
    patientTrends,
    recentAppointments,
    recentPatients,
    recentPayments,
    recentActivities,
    upcomingAppointments,
  ] = await Promise.all([
    Patient.countDocuments({ status: 'ACTIVE' }),
    Doctor.countDocuments({ status: { $ne: 'INACTIVE' } }),
    Staff.countDocuments({ status: { $ne: 'TERMINATED' } }),
    Department.countDocuments({ status: 'ACTIVE' }),
    Appointment.countDocuments({ date: today }),
    Appointment.countDocuments({ status: 'COMPLETED' }),
    Appointment.countDocuments({ status: { $in: PENDING_STATUSES } }),
    Appointment.countDocuments({ status: 'CANCELLED' }),
    Invoice.aggregate([
      { $match: { status: { $nin: ['CANCELLED'] } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $nin: ['CANCELLED', 'PAID', 'REFUNDED'] } } },
      { $group: { _id: null, total: { $sum: '$balanceDue' } } },
    ]),
    Appointment.aggregate([
      { $match: { date: { $gte: startDay } } },
      { $group: { _id: '$date', count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { invoiceDate: { $gte: startMonthDate }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: '$amountPaid' } } },
    ]),
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$department.name', 'Unassigned'] }, value: '$count' } },
    ]),
    Patient.aggregate([
      { $match: { registrationDate: { $gte: startMonthDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$registrationDate' } }, count: { $sum: 1 } } },
    ]),
    populateRecentAppointments(5),
    Patient.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName patientId phone createdAt').lean(),
    Payment.find({ status: 'SUCCESS' })
      .populate({ path: 'invoice', select: 'invoiceNumber patient', populate: { path: 'patient', select: 'firstName lastName' } })
      .populate('receivedBy', 'firstName lastName')
      .sort({ paidAt: -1 })
      .limit(5)
      .lean(),
    AuditLog.find().populate('actor', 'firstName lastName role').sort({ createdAt: -1 }).limit(8).lean(),
    Appointment.find({ date: { $gte: today }, status: { $in: ['BOOKED', 'CONFIRMED'] } })
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: 1, startTime: 1 })
      .limit(5)
      .lean(),
  ]);

  return {
    stats: {
      totalPatients,
      totalDoctors,
      totalStaff,
      totalDepartments,
      todaysAppointments,
      completedAppointments,
      pendingAppointments,
      cancelledAppointments,
      totalRevenue: revenueAgg[0]?.total || 0,
      pendingPayments: pendingAgg[0]?.total || 0,
    },
    charts: {
      appointmentsByDay: fillSeries(dayKeys, appointmentsByDay),
      monthlyRevenue: fillSeries(monthKeys, monthlyRevenue, 'total'),
      statusDistribution: statusDistribution.map((row) => ({ name: row._id, value: row.count })),
      departmentDistribution: departmentDistribution.sort((a, b) => b.value - a.value),
      patientTrends: fillSeries(monthKeys, patientTrends),
    },
    recent: {
      appointments: recentAppointments,
      patients: recentPatients,
      payments: recentPayments,
      activities: recentActivities,
      upcomingAppointments,
    },
  };
}

async function getReceptionistDashboard() {
  const today = toDateKey();
  const nextWeek = toDateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [
    todaysAppointments,
    upcomingCount,
    checkedIn,
    pendingPaymentsAgg,
    unpaidInvoices,
    totalInvoices,
    recentAppointments,
    todaySchedule,
    recentPatients,
    recentPayments,
  ] = await Promise.all([
    Appointment.countDocuments({ date: today }),
    Appointment.countDocuments({ date: { $gte: today, $lte: nextWeek }, status: { $in: PENDING_STATUSES } }),
    Appointment.countDocuments({ date: today, status: { $in: ['CHECKED_IN', 'IN_PROGRESS'] } }),
    Invoice.aggregate([
      { $match: { status: { $nin: ['CANCELLED', 'PAID', 'REFUNDED'] } } },
      { $group: { _id: null, total: { $sum: '$balanceDue' } } },
    ]),
    Invoice.countDocuments({ status: { $in: ['UNPAID', 'PARTIALLY_PAID'] } }),
    Invoice.countDocuments({ status: { $ne: 'CANCELLED' } }),
    populateRecentAppointments(6),
    Appointment.find({ date: today })
      .populate('patient', 'firstName lastName patientId phone')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ startTime: 1 })
      .lean(),
    Patient.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName patientId phone createdAt').lean(),
    Payment.find({ status: 'SUCCESS' })
      .populate({ path: 'invoice', select: 'invoiceNumber patient', populate: { path: 'patient', select: 'firstName lastName' } })
      .sort({ paidAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return {
    stats: {
      todaysAppointments,
      upcomingAppointments: upcomingCount,
      checkedInPatients: checkedIn,
      pendingPayments: pendingPaymentsAgg[0]?.total || 0,
      unpaidInvoices,
      totalInvoices,
    },
    todaySchedule,
    recent: { appointments: recentAppointments, patients: recentPatients, payments: recentPayments },
  };
}

async function getDoctorDashboard(req) {
  const today = toDateKey();
  const doctorId = req.doctor._id;
  const [
    todaysAppointments,
    upcomingAppointments,
    completedVisits,
    pendingVisits,
    todaysSchedule,
    upcomingPatients,
    recentVisits,
  ] = await Promise.all([
    Appointment.countDocuments({ doctor: doctorId, date: today }),
    Appointment.countDocuments({ doctor: doctorId, date: { $gte: today }, status: { $in: PENDING_STATUSES } }),
    Encounter.countDocuments({ doctor: doctorId, status: 'COMPLETED' }),
    Encounter.countDocuments({ doctor: doctorId, status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    Appointment.find({ doctor: doctorId, date: today })
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .sort({ startTime: 1 })
      .lean(),
    Appointment.find({ doctor: doctorId, date: { $gte: today }, status: { $in: PENDING_STATUSES } })
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .sort({ date: 1, startTime: 1 })
      .limit(8)
      .lean(),
    Encounter.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName patientId')
      .sort({ encounterDate: -1 })
      .limit(6)
      .lean(),
  ]);
  return {
    stats: { todaysAppointments, upcomingAppointments, completedVisits, pendingVisits },
    todaySchedule: todaysSchedule,
    upcomingPatients,
    recentVisits,
  };
}

module.exports = { getAdminDashboard, getReceptionistDashboard, getDoctorDashboard };

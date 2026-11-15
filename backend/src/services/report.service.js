const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const { toDateKey } = require('../utils/dates');

function defaultRange(query) {
  const dateTo = query.dateTo || toDateKey();
  const dateFrom = query.dateFrom || toDateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  return { dateFrom, dateTo };
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function appointmentReport(query) {
  const { dateFrom, dateTo } = defaultRange(query);
  const match = { date: { $gte: dateFrom, $lte: dateTo } };
  if (query.department) match.department = new (require('mongoose').Types.ObjectId)(query.department);
  if (query.doctor) match.doctor = new (require('mongoose').Types.ObjectId)(query.doctor);

  const [byDay, byStatus, byDoctor, byDepartment, total, rows] = await Promise.all([
    Appointment.aggregate([{ $match: match }, { $group: { _id: '$date', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$doctor', count: { $sum: 1 } } },
      { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $concat: [{ $ifNull: ['$doctor.firstName', 'Unknown'] }, ' ', { $ifNull: ['$doctor.lastName', ''] }] }, value: '$count' } },
      { $sort: { value: -1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ['$department.name', 'Unassigned'] }, value: '$count' } },
      { $sort: { value: -1 } },
    ]),
    Appointment.countDocuments(match),
    Appointment.find(match)
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName specialization')
      .populate('department', 'name code')
      .sort({ date: -1, startTime: 1 })
      .limit(500)
      .lean(),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  return {
    range: { dateFrom, dateTo },
    summary: {
      totalAppointments: total,
      completed: statusMap.COMPLETED || 0,
      cancelled: statusMap.CANCELLED || 0,
      noShow: statusMap.NO_SHOW || 0,
      pending: (statusMap.BOOKED || 0) + (statusMap.CONFIRMED || 0) + (statusMap.CHECKED_IN || 0) + (statusMap.IN_PROGRESS || 0),
    },
    charts: {
      byDay: byDay.map((row) => ({ name: row._id, value: row.count })),
      byStatus: byStatus.map((row) => ({ name: row._id, value: row.count })),
      byDoctor,
      byDepartment,
    },
    rows,
  };
}

async function revenueReport(query) {
  const { dateFrom, dateTo } = defaultRange(query);
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T23:59:59.999Z`);
  const match = { invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' } };

  const [summaryAgg, byDay, byStatus, byMethod, rows] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
          discount: { $sum: '$discount' },
          billed: { $sum: '$totalAmount' },
          collected: { $sum: '$amountPaid' },
          outstanding: { $sum: '$balanceDue' },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } }, billed: { $sum: '$totalAmount' }, collected: { $sum: '$amountPaid' } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }]),
    Payment.aggregate([
      { $match: { status: 'SUCCESS', paidAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Invoice.find(match)
      .populate('patient', 'firstName lastName patientId')
      .sort({ invoiceDate: -1 })
      .limit(500)
      .lean(),
  ]);

  const summary = summaryAgg[0] || { subtotal: 0, tax: 0, discount: 0, billed: 0, collected: 0, outstanding: 0 };
  return {
    range: { dateFrom, dateTo },
    summary: {
      subtotal: round(summary.subtotal),
      tax: round(summary.tax),
      discount: round(summary.discount),
      totalBilled: round(summary.billed),
      totalCollected: round(summary.collected),
      outstanding: round(summary.outstanding),
    },
    charts: {
      byDay: byDay.map((row) => ({ name: row._id, billed: round(row.billed), collected: round(row.collected) })),
      byStatus: byStatus.map((row) => ({ name: row._id, value: row.count, amount: round(row.amount) })),
      byMethod: byMethod.map((row) => ({ name: row._id, value: round(row.amount), count: row.count })),
    },
    rows,
  };
}

async function patientReport(query) {
  const { dateFrom, dateTo } = defaultRange(query);
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T23:59:59.999Z`);
  const match = { registrationDate: { $gte: start, $lte: end } };

  const [total, byGender, byBloodGroup, byMonth, byStatus, rows] = await Promise.all([
    Patient.countDocuments(match),
    Patient.aggregate([{ $match: match }, { $group: { _id: '$gender', count: { $sum: 1 } } }]),
    Patient.aggregate([{ $match: match }, { $group: { _id: '$bloodGroup', count: { $sum: 1 } } }]),
    Patient.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$registrationDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Patient.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Patient.find(match).sort({ registrationDate: -1 }).limit(500).lean(),
  ]);

  return {
    range: { dateFrom, dateTo },
    summary: { totalPatients: total },
    charts: {
      byGender: byGender.map((row) => ({ name: row._id, value: row.count })),
      byBloodGroup: byBloodGroup.map((row) => ({ name: row._id, value: row.count })),
      byMonth: byMonth.map((row) => ({ name: row._id, value: row.count })),
      byStatus: byStatus.map((row) => ({ name: row._id, value: row.count })),
    },
    rows,
  };
}

async function departmentReport(query) {
  const { dateFrom, dateTo } = defaultRange(query);
  const departments = await Department.find().lean();
  const rows = [];
  for (const department of departments) {
    const appointmentMatch = { department: department._id, date: { $gte: dateFrom, $lte: dateTo } };
    const [appointments, doctors, statusAgg] = await Promise.all([
      Appointment.countDocuments(appointmentMatch),
      Doctor.countDocuments({ department: department._id }),
      Appointment.aggregate([{ $match: appointmentMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const departmentAppointments = await Appointment.find(appointmentMatch).select('_id').lean();
    const revenueAgg = await Invoice.aggregate([
      { $match: { appointment: { $in: departmentAppointments.map((a) => a._id) }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, billed: { $sum: '$totalAmount' }, collected: { $sum: '$amountPaid' } } },
    ]);
    const statusMap = Object.fromEntries(statusAgg.map((row) => [row._id, row.count]));
    rows.push({
      department: department.name,
      code: department.code,
      doctors,
      appointments,
      completed: statusMap.COMPLETED || 0,
      cancelled: statusMap.CANCELLED || 0,
      revenueBilled: round(revenueAgg[0]?.billed || 0),
      revenueCollected: round(revenueAgg[0]?.collected || 0),
    });
  }
  return {
    range: { dateFrom, dateTo },
    summary: {
      totalDepartments: departments.length,
      totalAppointments: rows.reduce((sum, row) => sum + row.appointments, 0),
      totalRevenue: round(rows.reduce((sum, row) => sum + row.revenueCollected, 0)),
    },
    charts: {
      byDepartment: rows.map((row) => ({ name: row.department, value: row.appointments })),
      revenueByDepartment: rows.map((row) => ({ name: row.department, value: row.revenueCollected })),
    },
    rows,
  };
}

module.exports = { appointmentReport, revenueReport, patientReport, departmentReport };

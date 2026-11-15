const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Encounter = require('../models/Encounter');
const ApiError = require('../utils/ApiError');
const { nextId } = require('../utils/ids');
const { getPagination, buildMeta, buildSort } = require('../utils/pagination');
const { calculateInvoice, roundMoney } = require('../utils/money');
const { auditFromRequest } = require('../utils/audit');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateRangeFilter(field, query) {
  if (!query.dateFrom && !query.dateTo) return {};
  const filter = {};
  if (query.dateFrom) filter.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
  if (query.dateTo) filter.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  return { [field]: filter };
}

async function createInvoice(data, req) {
  const patient = await Patient.findById(data.patient);
  if (!patient) throw ApiError.badRequest('Patient does not exist', 'INVALID_PATIENT');
  if (data.appointment) {
    const appointment = await Appointment.findById(data.appointment);
    if (!appointment) throw ApiError.badRequest('Appointment does not exist', 'INVALID_APPOINTMENT');
    if (String(appointment.patient) !== String(patient._id)) {
      throw ApiError.badRequest('Appointment does not belong to this patient', 'PATIENT_MISMATCH');
    }
  }
  if (data.encounter) {
    const encounter = await Encounter.findById(data.encounter);
    if (!encounter) throw ApiError.badRequest('Encounter does not exist', 'INVALID_ENCOUNTER');
    if (String(encounter.patient) !== String(patient._id)) {
      throw ApiError.badRequest('Encounter does not belong to this patient', 'PATIENT_MISMATCH');
    }
  }

  const totals = calculateInvoice({
    lineItems: data.lineItems,
    taxRate: data.taxRate,
    discount: data.discount,
  });
  if (totals.totalAmount < 0) throw ApiError.badRequest('Invoice total cannot be negative', 'INVALID_TOTAL');

  const invoiceNumber = await nextId('invoice', 'INV');
  const invoice = await Invoice.create({
    invoiceNumber,
    patient: patient._id,
    appointment: data.appointment || undefined,
    encounter: data.encounter || undefined,
    invoiceDate: data.invoiceDate || new Date(),
    dueDate: data.dueDate || undefined,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    taxRate: totals.taxRate,
    tax: totals.tax,
    discount: totals.discount,
    totalAmount: totals.totalAmount,
    amountPaid: 0,
    balanceDue: totals.totalAmount,
    status: totals.totalAmount === 0 ? 'PAID' : 'UNPAID',
    notes: data.notes,
    createdBy: req.user._id,
  });

  await auditFromRequest(req, {
    action: 'INVOICE_GENERATED',
    resourceType: 'Invoice',
    resourceId: invoice.invoiceNumber,
    metadata: { patient: patient.patientId, totalAmount: invoice.totalAmount },
  });

  return Invoice.findById(invoice._id).populate('patient', 'firstName lastName patientId phone').lean();
}

async function listInvoices(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.patient) filter.patient = query.patient;
  if (query.status) filter.status = query.status;
  Object.assign(filter, dateRangeFilter('invoiceDate', query));
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    const patients = await Patient.find({ $or: [{ firstName: regex }, { lastName: regex }, { patientId: regex }] }).select('_id').limit(200).lean();
    filter.$or = [{ invoiceNumber: regex }, { patient: { $in: patients.map((p) => p._id) } }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'invoiceDate', 'totalAmount', 'balanceDue'], { invoiceDate: -1 });
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate('patient', 'firstName lastName patientId phone')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

async function getInvoice(id, _req) {
  const invoice = await Invoice.findById(id)
    .populate('patient', 'firstName lastName patientId phone email address')
    .populate('appointment', 'appointmentNumber date startTime status')
    .populate('encounter', 'encounterId encounterDate')
    .populate('createdBy', 'firstName lastName role')
    .lean();
  if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
  const payments = await Payment.find({ invoice: id, status: 'SUCCESS' })
    .populate('receivedBy', 'firstName lastName')
    .sort({ paidAt: -1 })
    .lean();
  return { ...invoice, payments };
}

async function createPayment(invoiceId, data, req) {
  const amount = roundMoney(data.amount);
  if (amount <= 0) throw ApiError.badRequest('Payment amount must be greater than zero', 'INVALID_PAYMENT_AMOUNT');

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
  if (invoice.status === 'CANCELLED') throw ApiError.conflict('Cannot pay a cancelled invoice', 'INVOICE_CANCELLED');
  if (invoice.status === 'REFUNDED') throw ApiError.conflict('Invoice has been refunded', 'INVOICE_REFUNDED');
  if (invoice.balanceDue <= 0) throw ApiError.conflict('Invoice is already fully paid', 'INVOICE_ALREADY_PAID');

  if (data.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) {
      return { payment: existing, invoice: await Invoice.findById(invoiceId).populate('patient', 'firstName lastName patientId').lean(), idempotent: true };
    }
  }

  if (amount > invoice.balanceDue) {
    throw ApiError.badRequest(
      `Payment amount exceeds the outstanding balance of ${invoice.balanceDue.toFixed(2)}`,
      'PAYMENT_EXCEEDS_BALANCE'
    );
  }

  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      status: { $nin: ['CANCELLED', 'REFUNDED', 'PAID'] },
      balanceDue: { $gte: amount },
    },
    [
      {
        $set: {
          amountPaid: { $round: [{ $add: ['$amountPaid', amount] }, 2] },
          balanceDue: { $round: [{ $subtract: ['$balanceDue', amount] }, 2] },
        },
      },
      {
        $set: {
          status: {
            $cond: [{ $lte: ['$balanceDue', 0] }, 'PAID', 'PARTIALLY_PAID'],
          },
        },
      },
    ],
    { new: true }
  );

  if (!updated) {
    throw ApiError.conflict('Invoice balance changed. Refresh and try again.', 'PAYMENT_CONFLICT');
  }

  try {
    const paymentNumber = await nextId('payment', 'PAY');
    const payment = await Payment.create({
      paymentNumber,
      invoice: invoice._id,
      amount,
      method: data.method,
      status: 'SUCCESS',
      transactionRef: data.transactionRef || `SIM-${Date.now()}-${paymentNumber}`,
      idempotencyKey: data.idempotencyKey || undefined,
      receivedBy: req.user._id,
      paidAt: new Date(),
      notes: data.notes,
      simulated: true,
    });
    await auditFromRequest(req, {
      action: 'PAYMENT_RECORDED',
      resourceType: 'Payment',
      resourceId: payment.paymentNumber,
      metadata: { invoice: invoice.invoiceNumber, amount, method: data.method },
    });
    const populatedInvoice = await updated.populate('patient', 'firstName lastName patientId');
    return { payment, invoice: populatedInvoice };
  } catch (error) {
    await Invoice.updateOne(
      { _id: invoice._id },
      [
        {
          $set: {
            amountPaid: { $round: [{ $subtract: ['$amountPaid', amount] }, 2] },
            balanceDue: { $round: [{ $add: ['$balanceDue', amount] }, 2] },
          },
        },
        {
          $set: {
            status: { $cond: [{ $lte: ['$amountPaid', 0] }, 'UNPAID', 'PARTIALLY_PAID'] },
          },
        },
      ]
    );
    if (error?.code === 11000) {
      if (data.idempotencyKey) {
        const existing = await Payment.findOne({ idempotencyKey: data.idempotencyKey });
        if (existing) return { payment: existing, invoice: await Invoice.findById(invoiceId).lean(), idempotent: true };
      }
      throw ApiError.conflict('Duplicate payment detected', 'DUPLICATE_PAYMENT');
    }
    throw error;
  }
}

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.invoice) filter.invoice = query.invoice;
  if (query.method) filter.method = query.method;
  if (query.status) filter.status = query.status;
  Object.assign(filter, dateRangeFilter('paidAt', query));
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ paymentNumber: regex }, { transactionRef: regex }];
  }
  const sort = buildSort(query.sortBy, query.sortOrder, ['createdAt', 'paidAt', 'amount'], { paidAt: -1 });
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate({ path: 'invoice', select: 'invoiceNumber totalAmount balanceDue patient', populate: { path: 'patient', select: 'firstName lastName patientId' } })
      .populate('receivedBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit, total }) };
}

module.exports = { createInvoice, listInvoices, getInvoice, createPayment, listPayments };

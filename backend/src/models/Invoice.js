const mongoose = require('mongoose');
const { INVOICE_STATUS, LINE_ITEM_CATEGORIES } = require('../constants/enums');

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: LINE_ITEM_CATEGORIES, default: 'OTHER' },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    lineItems: {
      type: [lineItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one line item is required',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.UNPAID },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.index({ patient: 1, invoiceDate: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

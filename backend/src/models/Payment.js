const mongoose = require('mongoose');
const { PAYMENT_STATUS, PAYMENT_METHODS } = require('../constants/enums');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.SUCCESS },
    transactionRef: { type: String, unique: true, sparse: true },
    idempotencyKey: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500 },
    simulated: { type: Boolean, default: true },
  },
  { timestamps: true }
);

paymentSchema.index({ invoice: 1, status: 1 });
paymentSchema.index({ paidAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);

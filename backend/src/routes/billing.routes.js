const express = require('express');
const controller = require('../controllers/billing.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createInvoiceSchema, listInvoiceQuery, createPaymentSchema, listPaymentQuery } = require('../validators/billing.validators');
const { idParam } = require('../validators/common');

const invoices = express.Router();
invoices.use(authenticate, authorize('ADMIN', 'RECEPTIONIST'));
invoices.get('/', validate({ query: listInvoiceQuery }), controller.listInvoices);
invoices.post('/', validate({ body: createInvoiceSchema }), controller.createInvoice);
invoices.get('/:id', validate({ params: idParam }), controller.getInvoice);
invoices.post('/:id/payments', validate({ params: idParam, body: createPaymentSchema }), controller.createPayment);

const payments = express.Router();
payments.use(authenticate, authorize('ADMIN', 'RECEPTIONIST'));
payments.get('/', validate({ query: listPaymentQuery }), controller.listPayments);

module.exports = { invoices, payments };

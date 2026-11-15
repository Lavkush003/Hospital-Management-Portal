const billingService = require('../services/billing.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');

const listInvoices = asyncHandler(async (req, res) => {
  const { items, meta } = await billingService.listInvoices(req.query, req);
  return sendSuccess(res, items, 200, meta);
});
const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await billingService.createInvoice(req.body, req);
  return sendCreated(res, invoice);
});
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await billingService.getInvoice(req.params.id, req);
  return sendSuccess(res, invoice);
});
const createPayment = asyncHandler(async (req, res) => {
  const result = await billingService.createPayment(req.params.id, req.body, req);
  return sendCreated(res, result);
});
const listPayments = asyncHandler(async (req, res) => {
  const { items, meta } = await billingService.listPayments(req.query);
  return sendSuccess(res, items, 200, meta);
});

module.exports = { listInvoices, createInvoice, getInvoice, createPayment, listPayments };

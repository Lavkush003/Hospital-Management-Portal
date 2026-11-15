function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toCents(value) {
  return Math.round(roundMoney(value) * 100);
}

function fromCents(cents) {
  return roundMoney(cents / 100);
}

function calculateInvoice({ lineItems, taxRate = 0, discount = 0 }) {
  const normalizedItems = (lineItems || []).map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = roundMoney(item.unitPrice);
    return {
      description: String(item.description || '').trim(),
      category: item.category || 'OTHER',
      quantity,
      unitPrice,
      amount: roundMoney(quantity * unitPrice),
    };
  });

  const subtotalCents = normalizedItems.reduce((sum, item) => sum + toCents(item.amount), 0);
  const discountCents = Math.max(0, toCents(discount));
  const taxableCents = Math.max(0, subtotalCents - discountCents);
  const rate = Math.max(0, Number(taxRate) || 0);
  const taxCents = Math.round((taxableCents * rate) / 100);
  const totalCents = taxableCents + taxCents;

  return {
    lineItems: normalizedItems,
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    taxRate: rate,
    tax: fromCents(taxCents),
    totalAmount: fromCents(totalCents),
  };
}

function paymentStatusFor(totalAmount, amountPaid) {
  const total = toCents(totalAmount);
  const paid = toCents(amountPaid);
  if (paid <= 0) return 'UNPAID';
  if (paid < total) return 'PARTIALLY_PAID';
  return 'PAID';
}

module.exports = { roundMoney, toCents, fromCents, calculateInvoice, paymentStatusFor };

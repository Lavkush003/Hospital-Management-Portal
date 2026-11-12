import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { CreateInvoiceBody } from './billing.validators';

const MAX_AMOUNT_CENTS = 999_999_999_999n;

export interface CalculatedItem {
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedInvoice {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: CalculatedItem[];
}

export function moneyToCents(value: string | number): bigint {
  const [whole = '0', fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function centsToString(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function toDecimal(cents: bigint): Prisma.Decimal {
  return new Prisma.Decimal(centsToString(cents));
}

export function dbAmountToCents(amount: Prisma.Decimal): bigint {
  return BigInt(amount.mul(100).toFixed(0));
}

function ensureDatabaseAmount(cents: bigint): void {
  if (cents < 0n || cents > MAX_AMOUNT_CENTS) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'Calculated amount exceeds the supported currency range',
      'INVOICE_AMOUNT_OUT_OF_RANGE',
    );
  }
}

export function calculateInvoice(items: CreateInvoiceBody['items']): CalculatedInvoice {
  let subtotalCents = 0n;
  let discountCents = 0n;
  let taxCents = 0n;
  const calculatedItems = items.map((item) => {
    const unitPriceCents = moneyToCents(item.unitPrice);
    const grossCents = unitPriceCents * BigInt(item.quantity);
    const itemDiscountCents = moneyToCents(item.discountAmount);
    const itemTaxCents = moneyToCents(item.taxAmount);

    ensureDatabaseAmount(grossCents);
    if (itemDiscountCents > grossCents) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'An item discount cannot exceed its pre-discount amount',
        'INVOICE_ITEM_DISCOUNT_EXCEEDS_SUBTOTAL',
      );
    }

    const lineTotalCents = grossCents - itemDiscountCents + itemTaxCents;
    ensureDatabaseAmount(lineTotalCents);
    subtotalCents += grossCents;
    discountCents += itemDiscountCents;
    taxCents += itemTaxCents;

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: toDecimal(unitPriceCents),
      discountAmount: toDecimal(itemDiscountCents),
      taxAmount: toDecimal(itemTaxCents),
      lineTotal: toDecimal(lineTotalCents),
    };
  });

  const totalCents = subtotalCents - discountCents + taxCents;
  ensureDatabaseAmount(subtotalCents);
  ensureDatabaseAmount(discountCents);
  ensureDatabaseAmount(taxCents);
  ensureDatabaseAmount(totalCents);

  return {
    subtotal: toDecimal(subtotalCents),
    discountAmount: toDecimal(discountCents),
    taxAmount: toDecimal(taxCents),
    totalAmount: toDecimal(totalCents),
    items: calculatedItems,
  };
}

ALTER TYPE "InvoiceStatus" RENAME VALUE 'CANCELLED' TO 'VOID';
ALTER TYPE "InvoiceStatus" ADD VALUE 'OVERDUE';
ALTER TYPE "PaymentStatus" RENAME VALUE 'COMPLETED' TO 'SUCCESSFUL';

ALTER TABLE "Invoice"
  ADD COLUMN "patientId" TEXT,
  ADD COLUMN "appointmentId" TEXT,
  ADD COLUMN "invoiceDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Invoice" AS invoice
SET "patientId" = visit."patientId",
    "appointmentId" = visit."appointmentId",
    "invoiceDate" = COALESCE(invoice."issuedAt", invoice."createdAt")
FROM "Visit" AS visit
WHERE invoice."visitId" = visit."id";

ALTER TABLE "Invoice" ALTER COLUMN "patientId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "visitId" DROP NOT NULL;
DROP INDEX "Invoice_visitId_key";

CREATE INDEX "Invoice_patientId_invoiceDate_idx" ON "Invoice"("patientId", "invoiceDate");
CREATE INDEX "Invoice_visitId_idx" ON "Invoice"("visitId");
CREATE INDEX "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_line_total_check";
ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_discount_range_check"
  CHECK ("discountAmount" >= 0 AND "discountAmount" <= ("quantity" * "unitPrice"));
ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_tax_nonnegative_check"
  CHECK ("taxAmount" >= 0);
ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_line_total_check"
  CHECK ("lineTotal" = ("quantity" * "unitPrice" - "discountAmount" + "taxAmount"));

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_completed_requires_date_check";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_successful_requires_date_check"
  CHECK (
    "status" NOT IN ('SUCCESSFUL', 'PENDING', 'FAILED')
    OR (("status" = 'SUCCESSFUL') = ("paidAt" IS NOT NULL))
  );

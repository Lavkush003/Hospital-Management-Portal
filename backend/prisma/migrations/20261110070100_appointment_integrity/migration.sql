-- Enforce case-insensitive uniqueness for login and contact email addresses.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));
CREATE UNIQUE INDEX "Doctor_email_lower_key" ON "Doctor" (LOWER("email"));
CREATE UNIQUE INDEX "Staff_email_lower_key" ON "Staff" (LOWER("email"));

-- Required by the GiST equality operator for the Appointment exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Domain checks that Prisma cannot express in the schema language.
ALTER TABLE "Doctor"
  ADD CONSTRAINT "Doctor_consultation_fee_nonnegative_check"
  CHECK ("consultationFee" >= 0);

ALTER TABLE "DoctorSchedule"
  ADD CONSTRAINT "DoctorSchedule_time_order_check"
  CHECK ("endTime" > "startTime");

ALTER TABLE "DoctorSchedule"
  ADD CONSTRAINT "DoctorSchedule_slot_duration_check"
  CHECK ("slotDurationMinutes" BETWEEN 5 AND 240);

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_time_order_check"
  CHECK ("scheduledEnd" > "scheduledStart");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_cancelled_at_check"
  CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL);

-- A doctor cannot have two active appointments whose time ranges overlap.
-- Cancelled, completed, and no-show appointments are excluded from the constraint.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_doctor_overlap_active_excl"
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tstzrange("scheduledStart", "scheduledEnd", '[)') WITH &&
  )
  WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'));

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_time_order_check"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_completed_requires_end_check"
  CHECK ("status" <> 'COMPLETED' OR "endedAt" IS NOT NULL);

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_vitals_nonnegative_check"
  CHECK (
    ("heightCm" IS NULL OR "heightCm" > 0)
    AND ("weightKg" IS NULL OR "weightKg" > 0)
    AND ("temperatureC" IS NULL OR "temperatureC" > 0)
    AND ("systolicBp" IS NULL OR "systolicBp" > 0)
    AND ("diastolicBp" IS NULL OR "diastolicBp" > 0)
    AND ("heartRate" IS NULL OR "heartRate" > 0)
    AND ("respiratoryRate" IS NULL OR "respiratoryRate" > 0)
  );

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_oxygen_saturation_check"
  CHECK ("oxygenSaturation" IS NULL OR "oxygenSaturation" BETWEEN 0 AND 100);

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_blood_pressure_order_check"
  CHECK (
    "systolicBp" IS NULL
    OR "diastolicBp" IS NULL
    OR "systolicBp" > "diastolicBp"
  );

ALTER TABLE "PrescriptionItem"
  ADD CONSTRAINT "PrescriptionItem_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "PrescriptionItem"
  ADD CONSTRAINT "PrescriptionItem_duration_check"
  CHECK ("durationDays" > 0);

ALTER TABLE "DiagnosticReport"
  ADD CONSTRAINT "DiagnosticReport_completion_time_check"
  CHECK ("completedAt" IS NULL OR "completedAt" >= "orderedAt");

ALTER TABLE "DiagnosticReport"
  ADD CONSTRAINT "DiagnosticReport_completed_requires_date_check"
  CHECK ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_subtotal_nonnegative_check"
  CHECK ("subtotal" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_discount_range_check"
  CHECK ("discountAmount" >= 0 AND "discountAmount" <= "subtotal");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_tax_nonnegative_check"
  CHECK ("taxAmount" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_total_calculation_check"
  CHECK ("totalAmount" = ("subtotal" - "discountAmount" + "taxAmount"));

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_issued_at_check"
  CHECK ("status" IN ('DRAFT', 'CANCELLED') OR "issuedAt" IS NOT NULL);

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_unit_price_check"
  CHECK ("unitPrice" >= 0);

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_line_total_check"
  CHECK ("lineTotal" = ("quantity" * "unitPrice"));

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_check"
  CHECK ("amount" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_completed_requires_date_check"
  CHECK ("status" <> 'COMPLETED' OR "paidAt" IS NOT NULL);

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_expiry_check"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_response_status_check"
  CHECK ("responseStatusCode" IS NULL OR "responseStatusCode" BETWEEN 100 AND 599);

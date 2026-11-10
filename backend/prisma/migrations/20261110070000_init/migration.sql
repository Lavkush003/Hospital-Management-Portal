-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FRONT_DESK', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ISSUED', 'DISPENSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiagnosticReportType" AS ENUM ('LABORATORY', 'IMAGING', 'PATHOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "DiagnosticReportStatus" AS ENUM ('ORDERED', 'COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(32),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientNumber" VARCHAR(32) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "bloodGroup" "BloodGroup" NOT NULL DEFAULT 'UNKNOWN',
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "country" VARCHAR(100),
    "emergencyContactName" VARCHAR(200),
    "emergencyContactPhone" VARCHAR(32),
    "allergies" TEXT,
    "notes" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(160),
    "phone" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" VARCHAR(32) NOT NULL,
    "departmentId" TEXT NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(32),
    "licenseNumber" VARCHAR(64) NOT NULL,
    "specialization" VARCHAR(120) NOT NULL,
    "qualifications" TEXT,
    "consultationFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DoctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "bio" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" VARCHAR(32) NOT NULL,
    "departmentId" TEXT,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(32),
    "jobTitle" VARCHAR(120) NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiredAt" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "room" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentNumber" VARCHAR(32) NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMPTZ(3) NOT NULL,
    "scheduledEnd" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "rescheduledById" TEXT,
    "rescheduledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "visitNumber" VARCHAR(32) NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'PLANNED',
    "chiefComplaint" TEXT,
    "diagnosis" TEXT,
    "clinicalNotes" TEXT,
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "temperatureC" DECIMAL(4,1),
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "oxygenSaturation" INTEGER,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "prescriptionNumber" VARCHAR(32) NOT NULL,
    "visitId" TEXT NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicationName" VARCHAR(200) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticReport" (
    "id" TEXT NOT NULL,
    "reportNumber" VARCHAR(32) NOT NULL,
    "visitId" TEXT NOT NULL,
    "type" "DiagnosticReportType" NOT NULL,
    "status" "DiagnosticReportStatus" NOT NULL DEFAULT 'ORDERED',
    "testName" VARCHAR(200) NOT NULL,
    "resultSummary" TEXT,
    "resultDetails" TEXT,
    "orderedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiagnosticReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" VARCHAR(32) NOT NULL,
    "visitId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3),
    "dueAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNumber" VARCHAR(32) NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "receivedById" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "externalReference" VARCHAR(120),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "requestId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "resourceType" VARCHAR(100),
    "resourceId" VARCHAR(64),
    "responseStatusCode" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_lastName_firstName_idx" ON "User"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientNumber_key" ON "Patient"("patientNumber");

-- CreateIndex
CREATE INDEX "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE INDEX "Patient_createdAt_idx" ON "Patient"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_employeeCode_key" ON "Doctor"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_email_key" ON "Doctor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_licenseNumber_key" ON "Doctor"("licenseNumber");

-- CreateIndex
CREATE INDEX "Doctor_departmentId_status_idx" ON "Doctor"("departmentId", "status");

-- CreateIndex
CREATE INDEX "Doctor_lastName_firstName_idx" ON "Doctor"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Doctor_specialization_idx" ON "Doctor"("specialization");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_employeeCode_key" ON "Staff"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_departmentId_status_idx" ON "Staff"("departmentId", "status");

-- CreateIndex
CREATE INDEX "Staff_lastName_firstName_idx" ON "Staff"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "DoctorSchedule_doctorId_dayOfWeek_isActive_idx" ON "DoctorSchedule"("doctorId", "dayOfWeek", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_dayOfWeek_startTime_key" ON "DoctorSchedule"("doctorId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentNumber_key" ON "Appointment"("appointmentNumber");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledStart_scheduledEnd_idx" ON "Appointment"("doctorId", "scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE INDEX "Appointment_patientId_scheduledStart_idx" ON "Appointment"("patientId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Appointment_status_scheduledStart_idx" ON "Appointment"("status", "scheduledStart");

-- CreateIndex
CREATE INDEX "Appointment_scheduledStart_idx" ON "Appointment"("scheduledStart");

-- CreateIndex
CREATE INDEX "Appointment_createdById_idx" ON "Appointment"("createdById");

-- CreateIndex
CREATE INDEX "Appointment_cancelledById_cancelledAt_idx" ON "Appointment"("cancelledById", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_visitNumber_key" ON "Visit"("visitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_appointmentId_key" ON "Visit"("appointmentId");

-- CreateIndex
CREATE INDEX "Visit_patientId_startedAt_idx" ON "Visit"("patientId", "startedAt");

-- CreateIndex
CREATE INDEX "Visit_doctorId_startedAt_idx" ON "Visit"("doctorId", "startedAt");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- CreateIndex
CREATE INDEX "Visit_startedAt_idx" ON "Visit"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_prescriptionNumber_key" ON "Prescription"("prescriptionNumber");

-- CreateIndex
CREATE INDEX "Prescription_visitId_issuedAt_idx" ON "Prescription"("visitId", "issuedAt");

-- CreateIndex
CREATE INDEX "Prescription_status_idx" ON "Prescription"("status");

-- CreateIndex
CREATE INDEX "Prescription_issuedAt_idx" ON "Prescription"("issuedAt");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticReport_reportNumber_key" ON "DiagnosticReport"("reportNumber");

-- CreateIndex
CREATE INDEX "DiagnosticReport_visitId_orderedAt_idx" ON "DiagnosticReport"("visitId", "orderedAt");

-- CreateIndex
CREATE INDEX "DiagnosticReport_status_orderedAt_idx" ON "DiagnosticReport"("status", "orderedAt");

-- CreateIndex
CREATE INDEX "DiagnosticReport_type_idx" ON "DiagnosticReport"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_visitId_key" ON "Invoice"("visitId");

-- CreateIndex
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_dueAt_idx" ON "Invoice"("dueAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalReference_key" ON "Payment"("externalReference");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_receivedById_idx" ON "Payment"("receivedById");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_status_expiresAt_idx" ON "IdempotencyKey"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_resourceType_resourceId_idx" ON "IdempotencyKey"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_actorUserId_scope_key_key" ON "IdempotencyKey"("actorUserId", "scope", "key");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledById_fkey" FOREIGN KEY ("rescheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReport" ADD CONSTRAINT "DiagnosticReport_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

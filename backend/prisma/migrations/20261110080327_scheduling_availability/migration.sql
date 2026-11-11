-- CreateTable
CREATE TABLE "DoctorScheduleBreak" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorScheduleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorLeave" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorUnavailability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorScheduleBreak_scheduleId_idx" ON "DoctorScheduleBreak"("scheduleId");

-- CreateIndex
CREATE INDEX "DoctorLeave_doctorId_startAt_endAt_idx" ON "DoctorLeave"("doctorId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "DoctorUnavailability_doctorId_startAt_endAt_idx" ON "DoctorUnavailability"("doctorId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "DoctorScheduleBreak" ADD CONSTRAINT "DoctorScheduleBreak_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DoctorSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorLeave" ADD CONSTRAINT "DoctorLeave_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorUnavailability" ADD CONSTRAINT "DoctorUnavailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom integrity checks
ALTER TABLE "DoctorScheduleBreak"
  ADD CONSTRAINT "DoctorScheduleBreak_time_order_check"
  CHECK ("endTime" > "startTime");

ALTER TABLE "DoctorLeave"
  ADD CONSTRAINT "DoctorLeave_time_order_check"
  CHECK ("endAt" > "startAt");

ALTER TABLE "DoctorUnavailability"
  ADD CONSTRAINT "DoctorUnavailability_time_order_check"
  CHECK ("endAt" > "startAt");

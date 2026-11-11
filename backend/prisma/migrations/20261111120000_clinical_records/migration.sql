-- Visit follow-up details.
ALTER TABLE "Visit" ADD COLUMN "followUpAt" TIMESTAMPTZ(3);
ALTER TABLE "Visit" ADD COLUMN "followUpNotes" VARCHAR(1000);

-- Diagnostic report optional file reference metadata.
ALTER TABLE "DiagnosticReport" ADD COLUMN "fileMetadata" JSONB;

-- Clinical notes attached to visit encounters.
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- Immutable revision history that preserves material clinical note edits.
CREATE TABLE "ClinicalNoteRevision" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "previousContent" TEXT NOT NULL,
    "newContent" TEXT NOT NULL,
    "editReason" VARCHAR(500),
    "editedById" TEXT,
    "editedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClinicalNoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalNote_visitId_createdAt_idx" ON "ClinicalNote"("visitId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_patientId_createdAt_idx" ON "ClinicalNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_authorId_createdAt_idx" ON "ClinicalNote"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteRevision_noteId_revisionNumber_key" ON "ClinicalNoteRevision"("noteId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ClinicalNoteRevision_noteId_editedAt_idx" ON "ClinicalNoteRevision"("noteId", "editedAt");

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteRevision" ADD CONSTRAINT "ClinicalNoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteRevision" ADD CONSTRAINT "ClinicalNoteRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks that Prisma cannot express in the schema language.
ALTER TABLE "ClinicalNoteRevision"
  ADD CONSTRAINT "ClinicalNoteRevision_number_check"
  CHECK ("revisionNumber" > 0);

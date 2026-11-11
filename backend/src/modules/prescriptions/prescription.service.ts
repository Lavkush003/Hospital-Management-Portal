import { randomBytes } from 'node:crypto';
import type { Prescription, PrescriptionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import {
  assertVisitWriteAccess,
  loadVisitForRead,
} from '../visits/visit-access';
import type {
  CreatePrescriptionBody,
  PrescriptionStatusBody,
} from './prescription.validators';

const PRESCRIPTION_STATUS_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  ISSUED: ['DISPENSED', 'CANCELLED'],
  DISPENSED: [],
  CANCELLED: [],
};

function createPrescriptionNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `RX-${timestamp}-${randomSuffix}`;
}

function prescriptionNotFoundError(): AppError {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    'Prescription not found',
    'PRESCRIPTION_NOT_FOUND',
  );
}

function prescriptionSnapshot(prescription: Prescription): Prisma.InputJsonObject {
  return {
    prescriptionNumber: prescription.prescriptionNumber,
    visitId: prescription.visitId,
    status: prescription.status,
    notes: prescription.notes,
    issuedAt: prescription.issuedAt.toISOString(),
  };
}

export async function listVisitPrescriptions(
  visitId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown[]> {
  const visit = await loadVisitForRead(visitId, actor);

  const prescriptions = await prisma.prescription.findMany({
    where: { visitId },
    orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
    include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'PRESCRIPTIONS_LIST_READ',
    entityType: 'Visit',
    entityId: visitId,
    metadata: { patientId: visit.patientId, recordCount: prescriptions.length },
    request,
  });

  return prescriptions;
}

export async function getVisitPrescription(
  visitId: string,
  prescriptionId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);

  const prescription = await prisma.prescription.findFirst({
    where: { id: prescriptionId, visitId },
    include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  });

  if (!prescription) {
    throw prescriptionNotFoundError();
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'PRESCRIPTION_READ',
    entityType: 'Prescription',
    entityId: prescriptionId,
    metadata: {
      visitId,
      patientId: visit.patientId,
      prescriptionNumber: prescription.prescriptionNumber,
    },
    request,
  });

  return { prescription };
}

export async function createVisitPrescription(
  visitId: string,
  input: CreatePrescriptionBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const prescription = await transaction.prescription.create({
      data: {
        prescriptionNumber: createPrescriptionNumber(),
        visitId,
        status: 'ISSUED',
        notes: input.notes ?? null,
        issuedAt: input.issuedAt ?? new Date(),
        items: {
          create: input.items.map((item) => ({
            medicationName: item.medicationName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            instructions: item.instructions ?? null,
          })),
        },
      },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'PRESCRIPTION_CREATED',
        entityType: 'Prescription',
        entityId: prescription.id,
        after: {
          ...prescriptionSnapshot(prescription),
          items: prescription.items.map((item) => ({
            medicationName: item.medicationName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            instructions: item.instructions,
          })),
          patientId: visit.patientId,
        },
        request,
      },
      transaction,
    );

    return { prescription };
  });
}

export async function updatePrescriptionStatus(
  visitId: string,
  prescriptionId: string,
  input: PrescriptionStatusBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Prescription"
      WHERE "id" = ${prescriptionId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw prescriptionNotFoundError();
    }

    const current = await transaction.prescription.findFirst({
      where: { id: prescriptionId, visitId },
    });

    if (!current) {
      throw prescriptionNotFoundError();
    }

    if (current.status === input.status) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The prescription is already in this status',
        'PRESCRIPTION_STATUS_UNCHANGED',
      );
    }

    if (!PRESCRIPTION_STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Prescription status cannot transition from ${current.status} to ${input.status}`,
        'PRESCRIPTION_STATUS_TRANSITION_INVALID',
      );
    }

    const updated = await transaction.prescription.update({
      where: { id: prescriptionId },
      data: { status: input.status },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'PRESCRIPTION_STATUS_CHANGED',
        entityType: 'Prescription',
        entityId: prescriptionId,
        before: prescriptionSnapshot(current),
        after: prescriptionSnapshot(updated),
        metadata: {
          reason: input.reason ?? null,
          patientId: visit.patientId,
        },
        request,
      },
      transaction,
    );

    return { prescription: updated };
  });
}

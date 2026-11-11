import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DiagnosticReport, DiagnosticReportStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import {
  assertVisitWriteAccess,
  loadVisitForRead,
} from '../visits/visit-access';
import type { CreateReportBody, UpdateReportBody } from './report.validators';

const REPORT_STATUS_TRANSITIONS: Record<DiagnosticReportStatus, DiagnosticReportStatus[]> = {
  ORDERED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function createReportNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `RPT-${timestamp}-${randomSuffix}`;
}

function reportNotFoundError(): AppError {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    'Diagnostic report not found',
    'DIAGNOSTIC_REPORT_NOT_FOUND',
  );
}

function reportSnapshot(report: DiagnosticReport): Prisma.InputJsonObject {
  return {
    reportNumber: report.reportNumber,
    visitId: report.visitId,
    type: report.type,
    status: report.status,
    testName: report.testName,
    resultSummary: report.resultSummary,
    resultDetails: report.resultDetails,
    fileMetadata: report.fileMetadata ?? null,
    orderedAt: report.orderedAt.toISOString(),
    completedAt: report.completedAt?.toISOString() ?? null,
  };
}

export async function listVisitReports(
  visitId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown[]> {
  const visit = await loadVisitForRead(visitId, actor);

  const reports = await prisma.diagnosticReport.findMany({
    where: { visitId },
    orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'DIAGNOSTIC_REPORTS_LIST_READ',
    entityType: 'Visit',
    entityId: visitId,
    metadata: { patientId: visit.patientId, recordCount: reports.length },
    request,
  });

  return reports;
}

export async function getVisitReport(
  visitId: string,
  reportId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);

  const report = await prisma.diagnosticReport.findFirst({
    where: { id: reportId, visitId },
  });

  if (!report) {
    throw reportNotFoundError();
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'DIAGNOSTIC_REPORT_READ',
    entityType: 'DiagnosticReport',
    entityId: reportId,
    metadata: {
      visitId,
      patientId: visit.patientId,
      reportNumber: report.reportNumber,
    },
    request,
  });

  return { report };
}

export async function createVisitReport(
  visitId: string,
  input: CreateReportBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const report = await transaction.diagnosticReport.create({
      data: {
        reportNumber: createReportNumber(),
        visitId,
        type: input.type,
        status: 'ORDERED',
        testName: input.testName,
        resultSummary: input.resultSummary ?? null,
        resultDetails: input.resultDetails ?? null,
        fileMetadata: input.fileMetadata ?? undefined,
        orderedAt: input.orderedAt ?? new Date(),
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'DIAGNOSTIC_REPORT_CREATED',
        entityType: 'DiagnosticReport',
        entityId: report.id,
        after: {
          ...reportSnapshot(report),
          patientId: visit.patientId,
        },
        request,
      },
      transaction,
    );

    return { report };
  });
}

export async function updateVisitReport(
  visitId: string,
  reportId: string,
  input: UpdateReportBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "DiagnosticReport"
      WHERE "id" = ${reportId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw reportNotFoundError();
    }

    const current = await transaction.diagnosticReport.findFirst({
      where: { id: reportId, visitId },
    });

    if (!current) {
      throw reportNotFoundError();
    }

    const metadataFields: (keyof UpdateReportBody)[] = [
      'testName',
      'type',
      'resultSummary',
      'resultDetails',
      'fileMetadata',
    ];
    const changedMetadataFields = metadataFields.filter((field) => input[field] !== undefined);

    if (changedMetadataFields.length > 0 && ['COMPLETED', 'CANCELLED'].includes(current.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'Completed and cancelled diagnostic reports are final and cannot be edited',
        'DIAGNOSTIC_REPORT_FINALIZED',
      );
    }

    let statusTransition: { from: DiagnosticReportStatus; to: DiagnosticReportStatus } | undefined;

    if (input.status !== undefined) {
      if (current.status === input.status) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'The diagnostic report is already in this status',
          'DIAGNOSTIC_REPORT_STATUS_UNCHANGED',
        );
      }

      if (!REPORT_STATUS_TRANSITIONS[current.status].includes(input.status)) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          `Diagnostic report status cannot transition from ${current.status} to ${input.status}`,
          'DIAGNOSTIC_REPORT_STATUS_TRANSITION_INVALID',
        );
      }

      statusTransition = { from: current.status, to: input.status };
    }

    const updated = await transaction.diagnosticReport.update({
      where: { id: reportId },
      data: {
        ...(input.testName !== undefined ? { testName: input.testName } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.resultSummary !== undefined ? { resultSummary: input.resultSummary } : {}),
        ...(input.resultDetails !== undefined ? { resultDetails: input.resultDetails } : {}),
        ...(input.fileMetadata !== undefined
          ? {
              fileMetadata:
                input.fileMetadata === null ? Prisma.JsonNull : input.fileMetadata,
            }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'DIAGNOSTIC_REPORT_UPDATED',
        entityType: 'DiagnosticReport',
        entityId: reportId,
        before: reportSnapshot(current),
        after: reportSnapshot(updated),
        metadata: {
          reason: input.reason ?? null,
          statusTransition: statusTransition ?? null,
          changedFields: [
            ...changedMetadataFields,
            ...(statusTransition ? ['status' as const] : []),
          ],
          patientId: visit.patientId,
        },
        request,
      },
      transaction,
    );

    return { report: updated };
  });
}

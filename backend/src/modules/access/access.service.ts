import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { paginationMeta, paginationWindow } from '../../utils/validation';
import { hasPermission, PERMISSIONS } from '../auth/auth.permissions';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { assertPatientAccess, patientNotFoundError } from '../patients/patient-access';
import type { AuditLogListQuery } from './access.validators';

export async function listUsers(
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      doctor: { select: { id: true } },
      staff: { select: { id: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 500,
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'USER_ACCOUNTS_LIST_READ',
    entityType: 'UserQuery',
    entityId: actor.id,
    metadata: { resultCount: users.length },
    request,
  });

  return users;
}

export async function listAuditLogs(
  query: AuditLogListQuery,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<{
  logs: unknown[];
  pagination: ReturnType<typeof paginationMeta>;
}> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.outcome ? { outcome: query.outcome } : {}),
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
    ...(query.entityType ? { entityType: { contains: query.entityType, mode: 'insensitive' } } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.search
      ? {
          OR: [
            { action: { contains: query.search, mode: 'insensitive' } },
            { entityType: { contains: query.search, mode: 'insensitive' } },
            { entityId: { contains: query.search, mode: 'insensitive' } },
            { requestId: { contains: query.search, mode: 'insensitive' } },
            {
              actor: {
                is: {
                  OR: [
                    { firstName: { contains: query.search, mode: 'insensitive' } },
                    { lastName: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        outcome: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationWindow(query.page, query.pageSize),
    }),
    prisma.auditLog.count({ where }),
  ]);

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'AUDIT_LOGS_READ',
    entityType: 'AuditLogQuery',
    entityId: actor.id,
    metadata: { resultCount: logs.length, page: query.page, pageSize: query.pageSize },
    request,
  });

  return {
    logs,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

export async function getClinicalSummary(
  patientId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      bloodGroup: true,
      allergies: true,
      status: true,
    },
  });

  if (!patient) {
    throw patientNotFoundError();
  }

  await assertPatientAccess(actor, patientId);

  const canReadBilling = hasPermission(actor.role, PERMISSIONS.BILLING_READ);
  const visitSelect = {
    id: true,
    visitNumber: true,
    status: true,
    chiefComplaint: true,
    diagnosis: true,
    clinicalNotes: true,
    heightCm: true,
    weightKg: true,
    temperatureC: true,
    systolicBp: true,
    diastolicBp: true,
    heartRate: true,
    respiratoryRate: true,
    oxygenSaturation: true,
    startedAt: true,
    endedAt: true,
    doctor: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
      },
    },
    prescriptions: {
      select: {
        id: true,
        prescriptionNumber: true,
        status: true,
        notes: true,
        issuedAt: true,
        items: true,
      },
      orderBy: { issuedAt: 'desc' },
    },
    diagnosticReports: {
      orderBy: { orderedAt: 'desc' },
    },
    notes: {
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    },
    ...(canReadBilling
      ? {
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              totalAmount: true,
              currency: true,
            },
          },
        }
      : {}),
  } satisfies Prisma.VisitSelect;

  const visits = await prisma.visit.findMany({
    where: { patientId },
    select: visitSelect,
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'PATIENT_CLINICAL_SUMMARY_READ',
    entityType: 'Patient',
    entityId: patientId,
    metadata: {
      visitCount: visits.length,
      noteCount: visits.reduce((count, visit) => count + visit.notes.length, 0),
      prescriptionCount: visits.reduce((count, visit) => count + visit.prescriptions.length, 0),
      reportCount: visits.reduce((count, visit) => count + visit.diagnosticReports.length, 0),
    },
    request,
  });

  return {
    patient,
    visits: visits.map((visit) => {
      const invoices = 'invoices' in visit ? visit.invoices : [];
      return {
        ...visit,
        ...(canReadBilling ? { invoice: invoices[0] ?? null, invoices } : {}),
      };
    }),
  };
}

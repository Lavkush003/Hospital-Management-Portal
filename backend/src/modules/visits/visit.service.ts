import { randomBytes } from 'node:crypto';
import type { Prisma, VisitStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { isForeignKeyConstraintError, isUniqueConstraintError } from '../../utils/database-errors';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { assertPatientAccess, patientNotFoundError } from '../patients/patient-access';
import {
  assertVisitWriteAccess,
  loadVisitForRead,
  visitAccessInclude,
  visitNotFoundError,
  type VisitWithRelations,
} from './visit-access';
import type { CreateVisitBody, UpdateVisitBody, VisitListQuery, VisitStatusBody } from './visit.validators';

const VISIT_STATUS_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const VISIT_LINKABLE_APPOINTMENT_STATUSES = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
]);

interface VisitListResult {
  visits: VisitWithRelations[];
  pagination: PaginationMeta;
}

function createVisitNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `VIS-${timestamp}-${randomSuffix}`;
}

function visitNotActiveError(): AppError {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    'Encounters can only be recorded for active patients',
    'PATIENT_NOT_ACTIVE',
  );
}

async function resolveVisitDoctor(
  transaction: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  requestedDoctorId: string | undefined,
): Promise<string> {
  if (actor.role === 'CLINICIAN') {
    const ownDoctor = await transaction.doctor.findUnique({
      where: { userId: actor.id },
      select: { id: true, status: true },
    });

    if (!ownDoctor) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The clinician does not have a doctor profile',
        'CLINICIAN_PROFILE_MISSING',
      );
    }

    if (requestedDoctorId && requestedDoctorId !== ownDoctor.id) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        'Clinicians can only record encounters for their own doctor profile',
        'VISIT_DOCTOR_MISMATCH',
      );
    }

    if (ownDoctor.status !== 'ACTIVE') {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'Encounters can only be recorded by active doctors',
        'DOCTOR_NOT_ACTIVE',
      );
    }

    return ownDoctor.id;
  }

  if (!requestedDoctorId) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'doctorId is required when creating an encounter as an administrator',
      'VISIT_DOCTOR_REQUIRED',
    );
  }

  const doctor = await transaction.doctor.findUnique({
    where: { id: requestedDoctorId },
    select: { id: true, status: true },
  });

  if (!doctor) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  if (doctor.status !== 'ACTIVE') {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'Encounters can only be recorded by active doctors',
      'DOCTOR_NOT_ACTIVE',
    );
  }

  return doctor.id;
}

async function assertAppointmentLinkable(
  transaction: Prisma.TransactionClient,
  appointmentId: string,
  patientId: string,
  doctorId: string,
): Promise<void> {
  const appointment = await transaction.appointment.findUnique({
    where: { id: appointmentId },
    select: { patientId: true, doctorId: true, status: true },
  });

  if (!appointment) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }

  if (appointment.patientId !== patientId || appointment.doctorId !== doctorId) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'The appointment does not match the encounter patient and doctor',
      'VISIT_APPOINTMENT_MISMATCH',
    );
  }

  if (!VISIT_LINKABLE_APPOINTMENT_STATUSES.has(appointment.status)) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'Cancelled and no-show appointments cannot be linked to encounters',
      'VISIT_APPOINTMENT_NOT_LINKABLE',
    );
  }
}

export async function createVisit(
  input: CreateVisitBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<VisitWithRelations> {
  await assertPatientAccess(actor, input.patientId);

  try {
    const visitId = await prisma.$transaction(async (transaction) => {
      const patient = await transaction.patient.findUnique({
        where: { id: input.patientId },
        select: { id: true, status: true },
      });

      if (!patient) {
        throw patientNotFoundError();
      }

      if (patient.status !== 'ACTIVE') {
        throw visitNotActiveError();
      }

      const doctorId = await resolveVisitDoctor(transaction, actor, input.doctorId);

      if (input.appointmentId) {
        await assertAppointmentLinkable(transaction, input.appointmentId, input.patientId, doctorId);
      }

      const visit = await transaction.visit.create({
        data: {
          visitNumber: createVisitNumber(),
          patientId: input.patientId,
          doctorId,
          appointmentId: input.appointmentId ?? null,
          status: 'PLANNED',
          chiefComplaint: input.chiefComplaint ?? null,
          diagnosis: input.diagnosis ?? null,
          clinicalNotes: input.clinicalNotes ?? null,
          followUpAt: input.followUpAt ?? null,
          followUpNotes: input.followUpNotes ?? null,
          startedAt: input.startedAt ?? new Date(),
          ...(input.vitals ?? {}),
        },
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: 'VISIT_CREATED',
          entityType: 'Visit',
          entityId: visit.id,
          metadata: { status: visit.status },
          request,
        },
        transaction,
      );

      return visit.id;
    });

    return prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: visitAccessInclude,
    });
  } catch (error) {
    if (isUniqueConstraintError(error, ['visitNumber'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'A visit identifier collision occurred; retry the request',
        'VISIT_IDENTIFIER_CONFLICT',
      );
    }

    if (isUniqueConstraintError(error, ['appointmentId'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'This appointment is already linked to an encounter',
        'VISIT_APPOINTMENT_ALREADY_LINKED',
      );
    }

    if (isForeignKeyConstraintError(error)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The encounter references a patient, doctor, or appointment that does not exist',
        'VISIT_REFERENCE_CONFLICT',
      );
    }

    throw error;
  }
}

export async function getVisit(
  visitId: string,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  const visit = await loadVisitForRead(visitId, actor);

  const [notes, prescriptions, diagnosticReports] = await prisma.$transaction([
    prisma.clinicalNote.findMany({
      where: { visitId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    }),
    prisma.prescription.findMany({
      where: { visitId },
      orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }],
      include: { items: true },
    }),
    prisma.diagnosticReport.findMany({
      where: { visitId },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'VISIT_READ',
    entityType: 'Visit',
    entityId: visitId,
    metadata: {
      patientId: visit.patientId,
      visitNumber: visit.visitNumber,
      clinicalDataAccessed: true,
    },
    request,
  });

  return {
    visit: {
      id: visit.id,
      visitNumber: visit.visitNumber,
      appointmentId: visit.appointmentId,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      status: visit.status,
      chiefComplaint: visit.chiefComplaint,
      diagnosis: visit.diagnosis,
      clinicalNotes: visit.clinicalNotes,
      heightCm: visit.heightCm === null ? null : visit.heightCm.toNumber(),
      weightKg: visit.weightKg === null ? null : visit.weightKg.toNumber(),
      temperatureC: visit.temperatureC === null ? null : visit.temperatureC.toNumber(),
      systolicBp: visit.systolicBp,
      diastolicBp: visit.diastolicBp,
      heartRate: visit.heartRate,
      respiratoryRate: visit.respiratoryRate,
      oxygenSaturation: visit.oxygenSaturation,
      startedAt: visit.startedAt,
      endedAt: visit.endedAt,
      followUpAt: visit.followUpAt,
      followUpNotes: visit.followUpNotes,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      patient: visit.patient,
      doctor: visit.doctor,
      appointment: visit.appointment,
      notes,
      prescriptions,
      diagnosticReports,
    },
  };
}

export async function updateVisit(
  visitId: string,
  input: UpdateVisitBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<VisitWithRelations> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Visit"
      WHERE "id" = ${visitId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw visitNotFoundError();
    }

    await transaction.visit.update({
      where: { id: visitId },
      data: {
        ...(input.chiefComplaint !== undefined ? { chiefComplaint: input.chiefComplaint } : {}),
        ...(input.diagnosis !== undefined ? { diagnosis: input.diagnosis } : {}),
        ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes } : {}),
        ...(input.followUpAt !== undefined ? { followUpAt: input.followUpAt } : {}),
        ...(input.followUpNotes !== undefined ? { followUpNotes: input.followUpNotes } : {}),
        ...(input.vitals ?? {}),
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'VISIT_UPDATED',
        entityType: 'Visit',
        entityId: visitId,
        metadata: { changedFields: Object.keys(input) },
        request,
      },
      transaction,
    );

    return transaction.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: visitAccessInclude,
    });
  });
}

export async function updateVisitStatus(
  visitId: string,
  input: VisitStatusBody,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<VisitWithRelations> {
  const visit = await loadVisitForRead(visitId, actor);
  await assertVisitWriteAccess(actor, visit);

  return prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Visit"
      WHERE "id" = ${visitId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw visitNotFoundError();
    }

    const current = await transaction.visit.findUniqueOrThrow({ where: { id: visitId } });

    if (current.status === input.status) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'The encounter is already in this status',
        'VISIT_STATUS_UNCHANGED',
      );
    }

    if (!VISIT_STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        `Encounter status cannot transition from ${current.status} to ${input.status}`,
        'VISIT_STATUS_TRANSITION_INVALID',
      );
    }

    const endedAt = input.status === 'COMPLETED' || input.status === 'CANCELLED' ? new Date() : null;

    const updated = await transaction.visit.update({
      where: { id: visitId },
      data: {
        status: input.status,
        ...(endedAt !== null ? { endedAt } : {}),
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'VISIT_STATUS_CHANGED',
        entityType: 'Visit',
        entityId: visitId,
        metadata: { fromStatus: current.status, toStatus: updated.status },
        request,
      },
      transaction,
    );

    return transaction.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: visitAccessInclude,
    });
  });
}

export async function listVisits(
  query: VisitListQuery,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<VisitListResult> {
  const conditions: Prisma.VisitWhereInput[] = [
    ...(query.patientId ? [{ patientId: query.patientId }] : []),
    ...(query.doctorId ? [{ doctorId: query.doctorId }] : []),
    ...(query.appointmentId ? [{ appointmentId: query.appointmentId }] : []),
    ...(query.status ? [{ status: query.status }] : []),
    ...(query.from || query.to
      ? [
          {
            startedAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          },
        ]
      : []),
    ...(query.search
      ? [
          {
            OR: [
              { visitNumber: { contains: query.search, mode: 'insensitive' as const } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: query.search, mode: 'insensitive' as const } },
                      { lastName: { contains: query.search, mode: 'insensitive' as const } },
                      { patientNumber: { contains: query.search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          },
        ]
      : []),
  ];

  if (actor.role === 'CLINICIAN') {
    conditions.push({
      OR: [
        { doctor: { userId: actor.id } },
        {
          patient: {
            appointments: { some: { doctor: { userId: actor.id } } },
          },
        },
        {
          patient: {
            visits: { some: { doctor: { userId: actor.id } } },
          },
        },
      ],
    });
  }

  const where: Prisma.VisitWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [total, visits] = await prisma.$transaction([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      include: visitAccessInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
    }),
  ]);

  await writeAuditLog({
    actorUserId: actor.id,
    action: 'VISIT_LIST_READ',
    entityType: 'VisitQuery',
    entityId: actor.id,
    metadata: {
      resultCount: visits.length,
      visitIds: visits.map((visit) => visit.id),
      patientIds: [...new Set(visits.map((visit) => visit.patientId))],
      page: query.page,
      pageSize: query.pageSize,
    },
    request,
  });

  return {
    visits,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

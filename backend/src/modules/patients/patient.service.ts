import { randomBytes } from 'node:crypto';
import type { Patient, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import { hasPermission, PERMISSIONS } from '../auth/auth.permissions';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { assertPatientAccess, patientNotFoundError } from './patient-access';
import type {
  PatientCreateInput,
  PatientListQuery,
  PatientUpdateInput,
} from './patient.validators';

export interface PatientListResult {
  patients: ReturnType<typeof serializePatient>[];
  pagination: PaginationMeta;
}

function createPatientNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `PAT-${timestamp}-${randomSuffix}`;
}

export function serializePatient(patient: Patient, actor: AuthenticatedUser): unknown {
  const base = {
    id: patient.id,
    patientNumber: patient.patientNumber,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    phone: patient.phone,
    email: patient.email,
    addressLine1: patient.addressLine1,
    addressLine2: patient.addressLine2,
    city: patient.city,
    state: patient.state,
    postalCode: patient.postalCode,
    country: patient.country,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    status: patient.status,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };

  if (!hasPermission(actor.role, PERMISSIONS.PATIENTS_CLINICAL_READ)) {
    return base;
  }

  return {
    ...base,
    allergies: patient.allergies,
    notes: patient.notes,
  };
}

function patientAuditSnapshot(patient: Patient): Prisma.InputJsonObject {
  return {
    patientNumber: patient.patientNumber,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    phone: patient.phone,
    email: patient.email,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    allergies: patient.allergies,
    notes: patient.notes,
    status: patient.status,
  };
}

function assertClinicalFieldPermission(
  actor: AuthenticatedUser,
  input: PatientCreateInput | PatientUpdateInput,
): void {
  if (hasPermission(actor.role, PERMISSIONS.PATIENTS_CLINICAL_READ)) {
    return;
  }

  if (input.allergies !== undefined || input.notes !== undefined) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'Clinical patient fields require clinical permission',
      'CLINICAL_FIELDS_FORBIDDEN',
    );
  }
}

export async function createPatient(
  input: PatientCreateInput,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  assertClinicalFieldPermission(actor, input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const patient = await transaction.patient.create({
        data: {
          patientNumber: createPatientNumber(),
          ...input,
          allergies: input.allergies ?? null,
          notes: input.notes ?? null,
        },
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: 'PATIENT_CREATED',
          entityType: 'Patient',
          entityId: patient.id,
          after: patientAuditSnapshot(patient),
          request,
        },
        transaction,
      );

      return serializePatient(patient, actor);
    });
  } catch (error) {
    if (isUniqueConstraintError(error, ['patientNumber'])) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'A patient identifier collision occurred; retry the request',
        'PATIENT_IDENTIFIER_CONFLICT',
      );
    }

    throw error;
  }
}

export async function getPatient(patientId: string, actor: AuthenticatedUser): Promise<unknown> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  if (!patient) {
    throw patientNotFoundError();
  }

  await assertPatientAccess(actor, patientId);
  return serializePatient(patient, actor);
}

export async function updatePatient(
  patientId: string,
  input: PatientUpdateInput,
  actor: AuthenticatedUser,
  request: RequestMetadata,
): Promise<unknown> {
  assertClinicalFieldPermission(actor, input);
  await assertPatientAccess(actor, patientId);

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.patient.findUnique({ where: { id: patientId } });

    if (!current) {
      throw patientNotFoundError();
    }

    const updated = await transaction.patient.update({
      where: { id: patientId },
      data: input,
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'PATIENT_UPDATED',
        entityType: 'Patient',
        entityId: patientId,
        before: patientAuditSnapshot(current),
        after: patientAuditSnapshot(updated),
        request,
      },
      transaction,
    );

    return serializePatient(updated, actor);
  });
}

export async function listPatients(
  query: PatientListQuery,
  actor: AuthenticatedUser,
): Promise<PatientListResult> {
  const conditions: Prisma.PatientWhereInput[] = [];

  if (query.search) {
    conditions.push({
      OR: [
        { patientNumber: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (actor.role === 'CLINICIAN') {
    conditions.push({
      OR: [
        { appointments: { some: { doctor: { userId: actor.id } } } },
        { visits: { some: { doctor: { userId: actor.id } } } },
      ],
    });
  }

  const where: Prisma.PatientWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.gender ? { gender: query.gender } : {}),
    ...(query.bloodGroup ? { bloodGroup: query.bloodGroup } : {}),
    ...(query.city ? { city: { contains: query.city, mode: 'insensitive' as const } } : {}),
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };

  const [total, patients] = await prisma.$transaction([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    patients: patients.map((patient) => serializePatient(patient, actor)),
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

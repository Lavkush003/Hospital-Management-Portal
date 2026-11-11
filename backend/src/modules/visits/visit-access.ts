import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser } from '../auth/auth.types';
import { isClinicianAssignedToPatient } from '../patients/patient-access';

export function visitNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Visit not found', 'VISIT_NOT_FOUND');
}

export const visitAccessInclude = {
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      bloodGroup: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  doctor: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialization: true,
      status: true,
      department: {
        select: { id: true, code: true, name: true },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      appointmentNumber: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
    },
  },
} satisfies Prisma.VisitInclude;

export type VisitWithRelations = Prisma.VisitGetPayload<{
  include: typeof visitAccessInclude;
}>;

export async function loadVisitForRead(
  visitId: string,
  actor: AuthenticatedUser,
): Promise<VisitWithRelations> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: visitAccessInclude,
  });

  if (!visit) {
    throw visitNotFoundError();
  }

  if (actor.role === 'CLINICIAN') {
    const assigned = await isClinicianAssignedToPatient(actor.id, visit.patientId);

    if (!assigned) {
      throw visitNotFoundError();
    }
  }

  return visit;
}

export async function assertVisitWriteAccess(
  actor: AuthenticatedUser,
  visit: Pick<VisitWithRelations, 'doctorId' | 'patientId'>,
): Promise<void> {
  if (actor.role !== 'CLINICIAN') {
    return;
  }

  const ownDoctor = await prisma.doctor.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });

  if (!ownDoctor || ownDoctor.id !== visit.doctorId) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'Only the clinician responsible for this encounter can modify it',
      'VISIT_WRITE_FORBIDDEN',
    );
  }
}

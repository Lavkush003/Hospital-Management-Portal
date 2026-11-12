import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser } from '../auth/auth.types';

export function patientNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Patient not found', 'PATIENT_NOT_FOUND');
}

export async function isClinicianAssignedToPatient(
  actorUserId: string,
  patientId: string,
): Promise<boolean> {
  const [appointment, visit] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId, doctor: { userId: actorUserId } },
      select: { id: true },
    }),
    prisma.visit.findFirst({
      where: { patientId, doctor: { userId: actorUserId } },
      select: { id: true },
    }),
  ]);

  return appointment !== null || visit !== null;
}

export async function assertPatientAccess(
  actor: AuthenticatedUser,
  patientId: string,
): Promise<void> {
  if (actor.role === 'PATIENT') {
    if (actor.patientId !== patientId) throw patientNotFoundError();
    return;
  }

  if (actor.role !== 'CLINICIAN') {
    return;
  }

  if (!(await isClinicianAssignedToPatient(actor.id, patientId))) {
    throw patientNotFoundError();
  }
}

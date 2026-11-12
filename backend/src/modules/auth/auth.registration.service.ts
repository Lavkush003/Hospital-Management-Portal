import { hash } from 'bcryptjs';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { createPatientNumber } from '../patients/patient-number';
import type { RequestMetadata } from './auth.types';
import type { RegisterPatientInput } from './auth.validators';

function registrationConflictError(): AppError {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    'An account or patient record already uses this email. Contact the hospital for assistance.',
    'REGISTRATION_CONFLICT',
  );
}

export async function registerPatientAccount(
  input: RegisterPatientInput,
  request: RequestMetadata,
): Promise<void> {
  const passwordHash = await hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    await prisma.$transaction(async (transaction) => {
      const existingPatient = await transaction.patient.findFirst({
        where: { email: { equals: input.email, mode: 'insensitive' } },
        select: { id: true },
      });

      if (existingPatient) throw registrationConflictError();

      const user = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'PATIENT',
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
        },
        select: { id: true },
      });

      const patient = await transaction.patient.create({
        data: {
          userId: user.id,
          patientNumber: createPatientNumber(),
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          phone: input.phone ?? null,
          email: input.email,
        },
        select: { id: true, patientNumber: true },
      });

      await writeAuditLog(
        {
          action: 'PATIENT_ACCOUNT_REGISTERED',
          entityType: 'Patient',
          entityId: patient.id,
          after: { patientNumber: patient.patientNumber },
          request,
        },
        transaction,
      );
    });
  } catch (error) {
    if (isUniqueConstraintError(error, ['email'])) throw registrationConflictError();
    throw error;
  }
}

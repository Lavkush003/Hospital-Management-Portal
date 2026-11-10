import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import type { CreatePatientInput } from './access.validators';

function patientNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Patient not found', 'PATIENT_NOT_FOUND');
}

function createPatientNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
  return `PAT-${timestamp}-${randomSuffix}`;
}

async function isClinicianAssignedToPatient(
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

async function assertPatientAccess(actor: AuthenticatedUser, patientId: string): Promise<void> {
  if (actor.role !== 'CLINICIAN') {
    return;
  }

  if (!(await isClinicianAssignedToPatient(actor.id, patientId))) {
    throw patientNotFoundError();
  }
}

export async function listUsers(): Promise<unknown[]> {
  return prisma.user.findMany({
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
}

export async function createPatient(
  input: CreatePatientInput,
  actor: AuthenticatedUser,
  requestMetadata: RequestMetadata,
): Promise<unknown> {
  return prisma.$transaction(async (transaction) => {
    const patient = await transaction.patient.create({
      data: {
        patientNumber: createPatientNumber(),
        ...input,
      },
    });

    await writeAuditLog(
      {
        actorUserId: actor.id,
        action: 'PATIENT_CREATED',
        entityType: 'Patient',
        entityId: patient.id,
        after: {
          patientNumber: patient.patientNumber,
          firstName: patient.firstName,
          lastName: patient.lastName,
          status: patient.status,
        },
        request: requestMetadata,
      },
      transaction,
    );

    return patient;
  });
}

export async function getPatient(patientId: string, actor: AuthenticatedUser): Promise<unknown> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    throw patientNotFoundError();
  }

  await assertPatientAccess(actor, patientId);

  if (actor.role === 'FRONT_DESK') {
    return {
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
  }

  return patient;
}

export async function listAppointments(actor: AuthenticatedUser): Promise<unknown[]> {
  const where: Prisma.AppointmentWhereInput =
    actor.role === 'CLINICIAN' ? { doctor: { userId: actor.id } } : {};

  return prisma.appointment.findMany({
    where,
    select: {
      id: true,
      appointmentNumber: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      reason: true,
      patient: {
        select: {
          id: true,
          patientNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
        },
      },
    },
    orderBy: { scheduledStart: 'asc' },
    take: 500,
  });
}

export async function getDoctorSchedule(
  doctorId: string,
  actor: AuthenticatedUser,
): Promise<unknown> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      specialization: true,
      status: true,
      schedules: {
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!doctor || (actor.role === 'CLINICIAN' && doctor.userId !== actor.id)) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  return doctor;
}

export async function getClinicalSummary(
  patientId: string,
  actor: AuthenticatedUser,
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

  const visits = await prisma.visit.findMany({
    where: { patientId },
    select: {
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
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  return { patient, visits };
}

export async function getInvoice(invoiceId: string): Promise<unknown> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      currency: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      issuedAt: true,
      dueAt: true,
      notes: true,
      createdAt: true,
      items: true,
      payments: true,
      visit: {
        select: {
          id: true,
          visitNumber: true,
          patient: {
            select: {
              id: true,
              patientNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, 'Invoice not found', 'INVOICE_NOT_FOUND');
  }

  return invoice;
}

import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { assertPatientAccess, patientNotFoundError } from '../patients/patient-access';

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

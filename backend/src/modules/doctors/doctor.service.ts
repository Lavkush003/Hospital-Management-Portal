import { hash } from 'bcryptjs';
import type { Doctor, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isForeignKeyConstraintError, isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { serializeSchedule } from '../schedules/schedule.serializer';import type {
  DoctorCreateInput,
  DoctorListQuery,
  DoctorStatusUpdateInput,
  DoctorUpdateInput,
} from './doctor.validators';

const doctorListInclude = {
  department: {
    select: { id: true, code: true, name: true, location: true, isActive: true },
  },
} satisfies Prisma.DoctorInclude;

const doctorDetailInclude = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  },
  department: true,
  schedules: {
    include: {
      breaks: {
        select: { id: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' as const },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
  },
  leaves: {
    orderBy: { startAt: 'desc' as const },
    take: 20,
  },
  unavailability: {
    orderBy: { startAt: 'desc' as const },
    take: 20,
  },
} satisfies Prisma.DoctorInclude;

type DoctorDetail = Prisma.DoctorGetPayload<{ include: typeof doctorDetailInclude }>;

export interface DoctorListResult {
  doctors: Prisma.DoctorGetPayload<{ include: typeof doctorListInclude }>[];
  pagination: PaginationMeta;
}

export function doctorNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Doctor not found', 'DOCTOR_NOT_FOUND');
}

function doctorSnapshot(doctor: Doctor): Prisma.InputJsonObject {
  return {
    employeeCode: doctor.employeeCode,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    departmentId: doctor.departmentId,
    licenseNumber: doctor.licenseNumber,
    specialization: doctor.specialization,
    status: doctor.status,
  };
}

function serializeDoctorDetail(doctor: DoctorDetail): unknown {
  return {
    ...doctor,
    schedules: doctor.schedules.map((schedule) => serializeSchedule(schedule)),
  };
}

function serializeDoctorDirectoryDetail(doctor: DoctorDetail): unknown {
  const {
    schedules: _schedules,
    leaves: _leaves,
    unavailability: _unavailability,
    ...directory
  } = doctor;

  return directory;
}

function mapDoctorWriteError(error: unknown): unknown {
  if (isUniqueConstraintError(error, ['email'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A user or doctor with this email already exists',
      'DOCTOR_EMAIL_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error, ['employeeCode'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A doctor with this employee code already exists',
      'DOCTOR_EMPLOYEE_CODE_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error, ['licenseNumber'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A doctor with this license number already exists',
      'DOCTOR_LICENSE_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A doctor or user with these unique details already exists',
      'DOCTOR_UNIQUE_CONFLICT',
    );
  }

  if (isForeignKeyConstraintError(error)) {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      'The selected department was not found',
      'DEPARTMENT_NOT_FOUND',
    );
  }

  return error;
}

async function loadDoctorDetail(doctorId: string): Promise<unknown> {
  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: { id: doctorId },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(doctor);
}

export async function createDoctor(
  input: DoctorCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  const passwordHash = await hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    const doctorId = await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true, isActive: true },
      });

      if (!department) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Department not found', 'DEPARTMENT_NOT_FOUND');
      }

      if (!department.isActive) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          'Doctors cannot be assigned to an inactive department',
          'DEPARTMENT_INACTIVE',
        );
      }

      const user = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'CLINICIAN',
          status: input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
        },
      });

      const doctor = await transaction.doctor.create({
        data: {
          userId: user.id,
          employeeCode: input.employeeCode,
          departmentId: input.departmentId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          licenseNumber: input.licenseNumber,
          specialization: input.specialization,
          qualifications: input.qualifications ?? null,
          consultationFee: input.consultationFee,
          status: input.status,
          bio: input.bio ?? null,
        },
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DOCTOR_CREATED',
          entityType: 'Doctor',
          entityId: doctor.id,
          after: doctorSnapshot(doctor),
          metadata: { departmentId: input.departmentId },
          request,
        },
        transaction,
      );

      return doctor.id;
    });

    return loadDoctorDetail(doctorId);
  } catch (error) {
    throw mapDoctorWriteError(error);
  }
}

export async function getDoctor(
  doctorId: string,
  actor: AuthenticatedUser,
): Promise<unknown> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: doctorDetailInclude,
  });

  if (!doctor) {
    throw doctorNotFoundError();
  }

  if (actor.role === 'CLINICIAN' && doctor.userId !== actor.id) {
    return serializeDoctorDirectoryDetail(doctor);
  }

  return serializeDoctorDetail(doctor);
}

async function updateDoctorRecord(
  doctorId: string,
  input: DoctorUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
  auditAction: string,
  auditReason?: string,
): Promise<unknown> {
  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.doctor.findUnique({
        where: { id: doctorId },
        include: {
          user: {
            select: { id: true, status: true, authVersion: true, email: true },
          },
        },
      });

      if (!current) {
        throw doctorNotFoundError();
      }

      if (input.departmentId) {
        const department = await transaction.department.findUnique({
          where: { id: input.departmentId },
          select: { id: true, isActive: true },
        });

        if (!department) {
          throw new AppError(HTTP_STATUS.NOT_FOUND, 'Department not found', 'DEPARTMENT_NOT_FOUND');
        }

        if (!department.isActive && input.departmentId !== current.departmentId) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            'Doctors cannot be assigned to an inactive department',
            'DEPARTMENT_INACTIVE',
          );
        }
      }

      const doctorData: Prisma.DoctorUncheckedUpdateInput = {};
      const userData: Prisma.UserUncheckedUpdateInput = {};

      if (input.email !== undefined) {
        doctorData.email = input.email;
        userData.email = input.email;
      }
      if (input.firstName !== undefined) {
        doctorData.firstName = input.firstName;
        userData.firstName = input.firstName;
      }
      if (input.lastName !== undefined) {
        doctorData.lastName = input.lastName;
        userData.lastName = input.lastName;
      }
      if (input.phone !== undefined) {
        doctorData.phone = input.phone;
        userData.phone = input.phone;
      }
      if (input.employeeCode !== undefined) doctorData.employeeCode = input.employeeCode;
      if (input.departmentId !== undefined) doctorData.departmentId = input.departmentId;
      if (input.licenseNumber !== undefined) doctorData.licenseNumber = input.licenseNumber;
      if (input.specialization !== undefined) doctorData.specialization = input.specialization;
      if (input.qualifications !== undefined) doctorData.qualifications = input.qualifications;
      if (input.consultationFee !== undefined) {
        doctorData.consultationFee = input.consultationFee;
      }
      if (input.bio !== undefined) doctorData.bio = input.bio;

      let userStatusChanged = false;

      if (input.status !== undefined) {
        doctorData.status = input.status;

        if (input.status === 'INACTIVE' && current.user.status !== 'INACTIVE') {
          userData.status = 'INACTIVE';
          userStatusChanged = true;
        } else if (input.status !== 'INACTIVE' && current.user.status === 'INACTIVE') {
          userData.status = 'ACTIVE';
          userStatusChanged = true;
        }
      }

      if (userStatusChanged) {
        userData.authVersion = current.user.authVersion + 1;
      }

      const updated = await transaction.doctor.update({
        where: { id: doctorId },
        data: doctorData,
      });

      if (Object.keys(userData).length > 0) {
        await transaction.user.update({
          where: { id: current.userId },
          data: userData,
        });
      }

      await writeAuditLog(
        {
          actorUserId,
          action: auditAction,
          entityType: 'Doctor',
          entityId: doctorId,
          before: doctorSnapshot(current),
          after: doctorSnapshot(updated),
          metadata: {
            ...(auditReason ? { reason: auditReason } : {}),
            ...(userStatusChanged ? { sessionsRevoked: true } : {}),
          },
          request,
        },
        transaction,
      );
    });

    return loadDoctorDetail(doctorId);
  } catch (error) {
    throw mapDoctorWriteError(error);
  }
}

export async function updateDoctor(
  doctorId: string,
  input: DoctorUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return updateDoctorRecord(
    doctorId,
    input,
    actorUserId,
    request,
    input.status === undefined ? 'DOCTOR_UPDATED' : 'DOCTOR_STATUS_CHANGED',
  );
}

export async function changeDoctorStatus(
  doctorId: string,
  input: DoctorStatusUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return updateDoctorRecord(
    doctorId,
    { status: input.status },
    actorUserId,
    request,
    'DOCTOR_STATUS_CHANGED',
    input.reason,
  );
}

export async function listDoctors(query: DoctorListQuery): Promise<DoctorListResult> {
  const where: Prisma.DoctorWhereInput = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.specialization
      ? { specialization: { contains: query.specialization, mode: 'insensitive' as const } }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' as const } },
            { lastName: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { employeeCode: { contains: query.search, mode: 'insensitive' as const } },
            { specialization: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, doctors] = await prisma.$transaction([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({
      where,
      include: doctorListInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    doctors,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

import type { Department, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { RequestMetadata } from '../auth/auth.types';
import type {
  AssignDoctorsInput,
  DepartmentCreateInput,
  DepartmentListQuery,
  DepartmentUpdateInput,
} from './department.validators';

const departmentDetailInclude = {
  doctors: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      specialization: true,
      status: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  },
  _count: { select: { doctors: true, staff: true } },
} satisfies Prisma.DepartmentInclude;

const departmentListInclude = {
  _count: { select: { doctors: true, staff: true } },
} satisfies Prisma.DepartmentInclude;

export interface DepartmentListResult {
  departments: Prisma.DepartmentGetPayload<{ include: typeof departmentListInclude }>[];
  pagination: PaginationMeta;
}

export function departmentNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Department not found', 'DEPARTMENT_NOT_FOUND');
}

function departmentSnapshot(department: Department): Prisma.InputJsonObject {
  return {
    code: department.code,
    name: department.name,
    location: department.location,
    phone: department.phone,
    isActive: department.isActive,
  };
}

function mapDepartmentWriteError(error: unknown): unknown {
  if (isUniqueConstraintError(error, ['code'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A department with this code already exists',
      'DEPARTMENT_CODE_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error, ['name'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A department with this name already exists',
      'DEPARTMENT_NAME_CONFLICT',
    );
  }

  return error;
}

export async function createDepartment(
  input: DepartmentCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const department = await transaction.department.create({
        data: {
          ...input,
          description: input.description ?? null,
        },
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DEPARTMENT_CREATED',
          entityType: 'Department',
          entityId: department.id,
          after: departmentSnapshot(department),
          request,
        },
        transaction,
      );

      return transaction.department.findUniqueOrThrow({
        where: { id: department.id },
        include: departmentDetailInclude,
      });
    });
  } catch (error) {
    throw mapDepartmentWriteError(error);
  }
}

export async function getDepartment(departmentId: string): Promise<unknown> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: departmentDetailInclude,
  });

  if (!department) {
    throw departmentNotFoundError();
  }

  return department;
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const current = await transaction.department.findUnique({
        where: { id: departmentId },
      });

      if (!current) {
        throw departmentNotFoundError();
      }

      const updated = await transaction.department.update({
        where: { id: departmentId },
        data: input,
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DEPARTMENT_UPDATED',
          entityType: 'Department',
          entityId: departmentId,
          before: departmentSnapshot(current),
          after: departmentSnapshot(updated),
          request,
        },
        transaction,
      );

      return transaction.department.findUniqueOrThrow({
        where: { id: departmentId },
        include: departmentDetailInclude,
      });
    });
  } catch (error) {
    throw mapDepartmentWriteError(error);
  }
}

export async function listDepartments(query: DepartmentListQuery): Promise<DepartmentListResult> {
  const where: Prisma.DepartmentWhereInput = {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { location: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, departments] = await prisma.$transaction([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      include: departmentListInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    departments,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

export async function assignDoctorsToDepartment(
  departmentId: string,
  input: AssignDoctorsInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return prisma.$transaction(async (transaction) => {
    const department = await transaction.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw departmentNotFoundError();
    }

    if (!department.isActive) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        'Doctors cannot be assigned to an inactive department',
        'DEPARTMENT_INACTIVE',
      );
    }

    const doctors = await transaction.doctor.findMany({
      where: { id: { in: input.doctorIds } },
      select: { id: true, departmentId: true, employeeCode: true },
    });

    if (doctors.length !== input.doctorIds.length) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        'One or more doctors were not found',
        'DOCTOR_NOT_FOUND',
      );
    }

    for (const doctor of doctors) {
      const previousDepartmentId = doctor.departmentId;
      const updated = await transaction.doctor.update({
        where: { id: doctor.id },
        data: { departmentId },
        select: { id: true, departmentId: true },
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'DOCTOR_DEPARTMENT_ASSIGNED',
          entityType: 'Doctor',
          entityId: doctor.id,
          before: { departmentId: previousDepartmentId },
          after: { departmentId: updated.departmentId },
          metadata: { employeeCode: doctor.employeeCode },
          request,
        },
        transaction,
      );
    }

    return transaction.department.findUniqueOrThrow({
      where: { id: departmentId },
      include: departmentDetailInclude,
    });
  });
}

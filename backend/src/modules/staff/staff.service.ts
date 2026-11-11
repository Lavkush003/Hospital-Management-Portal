import { hash } from 'bcryptjs';
import type { Prisma, Staff } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { writeAuditLog } from '../../utils/audit';
import { isForeignKeyConstraintError, isUniqueConstraintError } from '../../utils/database-errors';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import { paginationMeta, paginationWindow, type PaginationMeta } from '../../utils/validation';
import type { RequestMetadata } from '../auth/auth.types';
import type {
  StaffCreateInput,
  StaffListQuery,
  StaffRoleUpdateInput,
  StaffStatusUpdateInput,
  StaffUpdateInput,
} from './staff.validators';

const staffInclude = {
  department: {
    select: { id: true, code: true, name: true, location: true, isActive: true },
  },
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
} satisfies Prisma.StaffInclude;

export interface StaffListResult {
  staff: Prisma.StaffGetPayload<{ include: typeof staffInclude }>[];
  pagination: PaginationMeta;
}

export function staffNotFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'Staff member not found', 'STAFF_NOT_FOUND');
}

function staffSnapshot(staff: Staff, role: string): Prisma.InputJsonObject {
  return {
    employeeCode: staff.employeeCode,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    jobTitle: staff.jobTitle,
    departmentId: staff.departmentId,
    status: staff.status,
    role,
    hiredAt: staff.hiredAt?.toISOString().slice(0, 10) ?? null,
  };
}

function mapStaffWriteError(error: unknown): unknown {
  if (isUniqueConstraintError(error, ['email'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A user or staff member with this email already exists',
      'STAFF_EMAIL_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error, ['employeeCode'])) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A staff member with this employee code already exists',
      'STAFF_EMPLOYEE_CODE_CONFLICT',
    );
  }

  if (isUniqueConstraintError(error)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      'A staff member or user with these unique details already exists',
      'STAFF_UNIQUE_CONFLICT',
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

function userStatusForStaffStatus(status: Staff['status']): 'ACTIVE' | 'INACTIVE' {
  return status === 'ACTIVE' || status === 'ON_LEAVE' ? 'ACTIVE' : 'INACTIVE';
}

async function loadStaff(staffId: string): Promise<unknown> {
  return prisma.staff.findUniqueOrThrow({
    where: { id: staffId },
    include: staffInclude,
  });
}

export async function createStaff(
  input: StaffCreateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  const passwordHash = await hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    const staffId = await prisma.$transaction(async (transaction) => {
      if (input.departmentId) {
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
            'Staff cannot be assigned to an inactive department',
            'DEPARTMENT_INACTIVE',
          );
        }
      }

      const user = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: input.role,
          status: userStatusForStaffStatus(input.status),
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
        },
      });

      const staff = await transaction.staff.create({
        data: {
          userId: user.id,
          employeeCode: input.employeeCode,
          departmentId: input.departmentId ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone ?? null,
          jobTitle: input.jobTitle,
          status: input.status,
          hiredAt: input.hiredAt ?? null,
        },
      });

      await writeAuditLog(
        {
          actorUserId,
          action: 'STAFF_CREATED',
          entityType: 'Staff',
          entityId: staff.id,
          after: staffSnapshot(staff, input.role),
          metadata: { role: input.role, departmentId: input.departmentId ?? null },
          request,
        },
        transaction,
      );

      return staff.id;
    });

    return loadStaff(staffId);
  } catch (error) {
    throw mapStaffWriteError(error);
  }
}

export async function getStaff(staffId: string): Promise<unknown> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: staffInclude,
  });

  if (!staff) {
    throw staffNotFoundError();
  }

  return staff;
}

async function updateStaffRecord(
  staffId: string,
  input: StaffUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
  auditAction: string,
  auditReason?: string,
): Promise<unknown> {
  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.staff.findUnique({
        where: { id: staffId },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              status: true,
              authVersion: true,
            },
          },
        },
      });

      if (!current) {
        throw staffNotFoundError();
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
            'Staff cannot be assigned to an inactive department',
            'DEPARTMENT_INACTIVE',
          );
        }
      }

      const staffData: Prisma.StaffUncheckedUpdateInput = {};
      const userData: Prisma.UserUncheckedUpdateInput = {};
      let sessionsRevoked = false;

      if (input.email !== undefined) {
        staffData.email = input.email;
        userData.email = input.email;
      }
      if (input.firstName !== undefined) {
        staffData.firstName = input.firstName;
        userData.firstName = input.firstName;
      }
      if (input.lastName !== undefined) {
        staffData.lastName = input.lastName;
        userData.lastName = input.lastName;
      }
      if (input.phone !== undefined) {
        staffData.phone = input.phone;
        userData.phone = input.phone;
      }
      if (input.employeeCode !== undefined) staffData.employeeCode = input.employeeCode;
      if (input.departmentId !== undefined) staffData.departmentId = input.departmentId;
      if (input.jobTitle !== undefined) staffData.jobTitle = input.jobTitle;
      if (input.hiredAt !== undefined) staffData.hiredAt = input.hiredAt;

      if (input.status !== undefined) {
        staffData.status = input.status;
        const nextUserStatus = userStatusForStaffStatus(input.status);
        if (nextUserStatus !== current.user.status) {
          userData.status = nextUserStatus;
          sessionsRevoked = true;
        }
      }

      if (input.role !== undefined && input.role !== current.user.role) {
        userData.role = input.role;
        sessionsRevoked = true;
      }

      if (sessionsRevoked) {
        userData.authVersion = current.user.authVersion + 1;
      }

      const updated = await transaction.staff.update({
        where: { id: staffId },
        data: staffData,
      });

      if (Object.keys(userData).length > 0) {
        await transaction.user.update({
          where: { id: current.userId },
          data: userData,
        });
      }

      const previousRole = current.user.role;
      const nextRole = input.role !== undefined ? input.role : previousRole;

      await writeAuditLog(
        {
          actorUserId,
          action: auditAction,
          entityType: 'Staff',
          entityId: staffId,
          before: staffSnapshot(current, previousRole),
          after: staffSnapshot(updated, nextRole),
          metadata: {
            ...(auditReason ? { reason: auditReason } : {}),
            ...(sessionsRevoked ? { sessionsRevoked: true } : {}),
          },
          request,
        },
        transaction,
      );
    });

    return loadStaff(staffId);
  } catch (error) {
    throw mapStaffWriteError(error);
  }
}

export async function updateStaff(
  staffId: string,
  input: StaffUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return updateStaffRecord(
    staffId,
    input,
    actorUserId,
    request,
    input.status === undefined && input.role === undefined
      ? 'STAFF_UPDATED'
      : 'STAFF_ACCESS_UPDATED',
  );
}

export async function changeStaffStatus(
  staffId: string,
  input: StaffStatusUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return updateStaffRecord(
    staffId,
    { status: input.status },
    actorUserId,
    request,
    'STAFF_STATUS_CHANGED',
    input.reason,
  );
}

export async function changeStaffRole(
  staffId: string,
  input: StaffRoleUpdateInput,
  actorUserId: string,
  request: RequestMetadata,
): Promise<unknown> {
  return updateStaffRecord(
    staffId,
    { role: input.role },
    actorUserId,
    request,
    'STAFF_ROLE_CHANGED',
    input.reason,
  );
}

export async function listStaff(query: StaffListQuery): Promise<StaffListResult> {
  const where: Prisma.StaffWhereInput = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { user: { role: query.role } } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' as const } },
            { lastName: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { employeeCode: { contains: query.search, mode: 'insensitive' as const } },
            { jobTitle: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, staff] = await prisma.$transaction([
    prisma.staff.count({ where }),
    prisma.staff.findMany({
      where,
      include: staffInclude,
      ...paginationWindow(query.page, query.pageSize),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    staff,
    pagination: paginationMeta(total, query.page, query.pageSize),
  };
}

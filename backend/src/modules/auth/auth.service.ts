import { compare, hash } from 'bcryptjs';
import type { Prisma, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { writeAuditLog, writeAuditLogSafely } from '../../utils/audit';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateCsrfToken,
  generateFamilyId,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
} from '../../utils/auth-tokens';
import { AppError } from '../../utils/errors';
import { HTTP_STATUS } from '../../utils/http-status';
import type { ChangePasswordInput, LoginInput } from './auth.validators';
import type { PublicUser, RequestMetadata } from './auth.types';

const DUMMY_PASSWORD_HASH = '$2b$12$BgjedBfF3W6pMt924Ooz1ePv6PpsnZKm.QVwe3v8dCHt3T5XD6s92';

interface PublicUserSource {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  doctor?: { id: string } | null;
  staff?: { id: string } | null;
  patient?: { id: string } | null;
}

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  firstName: true,
  lastName: true,
  phone: true,
  lastLoginAt: true,
  createdAt: true,
  authVersion: true,
  doctor: { select: { id: true } },
  staff: { select: { id: true } },
  patient: { select: { id: true } },
} satisfies Prisma.UserSelect;

const refreshTokenUserInclude = {
  user: { select: publicUserSelect },
} satisfies Prisma.RefreshTokenInclude;

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  csrfToken: string;
  user: PublicUser;
}

interface RefreshFailure {
  kind: 'missing' | 'reused' | 'expired' | 'inactive';
}

interface RefreshSuccess {
  kind: 'ok';
  user: PublicUserSource & { authVersion: number };
}

type RefreshTransactionResult = RefreshFailure | RefreshSuccess;

export function toPublicUser(user: PublicUserSource): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    ...(user.doctor ? { doctorId: user.doctor.id } : {}),
    ...(user.staff ? { staffId: user.staff.id } : {}),
    ...(user.patient ? { patientId: user.patient.id } : {}),
  };
}

function invalidCredentialsError(): AppError {
  return new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password', 'INVALID_CREDENTIALS');
}

export async function login(
  input: LoginInput,
  requestMetadata: RequestMetadata,
): Promise<AuthSession> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
    select: {
      ...publicUserSelect,
      passwordHash: true,
      authVersion: true,
    },
  });

  if (!user) {
    await compare(input.password, DUMMY_PASSWORD_HASH);
    await writeAuditLogSafely({
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'User',
      entityId: 'unauthenticated',
      outcome: 'FAILURE',
      metadata: { reason: 'UNKNOWN_EMAIL' },
      request: requestMetadata,
    });
    throw invalidCredentialsError();
  }

  const passwordMatches = await compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    await writeAuditLogSafely({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      outcome: 'FAILURE',
      metadata: { reason: 'INVALID_PASSWORD' },
      request: requestMetadata,
    });
    throw invalidCredentialsError();
  }

  if (user.status !== 'ACTIVE') {
    await writeAuditLogSafely({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_BLOCKED',
      entityType: 'User',
      entityId: user.id,
      outcome: 'FAILURE',
      metadata: { reason: 'ACCOUNT_INACTIVE', status: user.status },
      request: requestMetadata,
    });
    throw invalidCredentialsError();
  }

  const now = new Date();
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const csrfToken = generateCsrfToken();
  const familyId = generateFamilyId();
  const accessToken = signAccessToken(user);

  await prisma.$transaction(async (transaction) => {
    await transaction.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        expiresAt: refreshTokenExpiresAt,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    });

    await transaction.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: 'AUTH_LOGIN_SUCCEEDED',
        entityType: 'User',
        entityId: user.id,
        metadata: { role: user.role },
        request: requestMetadata,
      },
      transaction,
    );
  });

  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt,
    csrfToken,
    user: toPublicUser({ ...user, lastLoginAt: now }),
  };
}

export interface RefreshInput {
  refreshToken: string | undefined;
  requestMetadata: RequestMetadata;
}

function revocationTimestamp(now: Date, createdAt: Date): Date {
  return new Date(Math.max(now.getTime(), createdAt.getTime()));
}

export async function refreshSession(input: RefreshInput): Promise<AuthSession> {
  if (!input.refreshToken) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'A refresh token is required',
      'INVALID_REFRESH_TOKEN',
    );
  }

  const now = new Date();
  const tokenHash = hashRefreshToken(input.refreshToken);
  const nextRefreshToken = generateRefreshToken();
  const nextRefreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  const result = await prisma.$transaction<RefreshTransactionResult>(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "RefreshToken"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

    if (lockedRows.length === 0) {
      return { kind: 'missing' };
    }

    const token = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      include: refreshTokenUserInclude,
    });

    if (!token) {
      return { kind: 'missing' };
    }

    if (token.revokedAt) {
      await transaction.$executeRaw`
        UPDATE "RefreshToken"
        SET
          "revokedAt" = GREATEST(${now}, "createdAt"),
          "revokedReason" = 'REUSE_DETECTED',
          "updatedAt" = GREATEST(${now}, "createdAt")
        WHERE "familyId" = ${token.familyId} AND "revokedAt" IS NULL
      `;

      await writeAuditLog(
        {
          actorUserId: token.userId,
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          entityType: 'RefreshToken',
          entityId: token.id,
          outcome: 'FAILURE',
          metadata: { familyId: token.familyId },
          request: input.requestMetadata,
        },
        transaction,
      );

      return { kind: 'reused' };
    }

    if (token.expiresAt.getTime() <= now.getTime()) {
      await transaction.refreshToken.update({
        where: { id: token.id },
        data: {
          revokedAt: revocationTimestamp(now, token.createdAt),
          revokedReason: 'EXPIRED',
        },
      });

      await writeAuditLog(
        {
          actorUserId: token.userId,
          action: 'AUTH_REFRESH_EXPIRED',
          entityType: 'RefreshToken',
          entityId: token.id,
          outcome: 'FAILURE',
          metadata: { familyId: token.familyId },
          request: input.requestMetadata,
        },
        transaction,
      );

      return { kind: 'expired' };
    }

    if (token.user.status !== 'ACTIVE') {
      await transaction.refreshToken.update({
        where: { id: token.id },
        data: {
          revokedAt: revocationTimestamp(now, token.createdAt),
          revokedReason: 'ACCOUNT_INACTIVE',
        },
      });

      await writeAuditLog(
        {
          actorUserId: token.userId,
          action: 'AUTH_REFRESH_BLOCKED',
          entityType: 'RefreshToken',
          entityId: token.id,
          outcome: 'FAILURE',
          metadata: { reason: 'ACCOUNT_INACTIVE', status: token.user.status },
          request: input.requestMetadata,
        },
        transaction,
      );

      return { kind: 'inactive' };
    }

    const nextToken = await transaction.refreshToken.create({
      data: {
        userId: token.userId,
        tokenHash: hashRefreshToken(nextRefreshToken),
        familyId: token.familyId,
        expiresAt: nextRefreshTokenExpiresAt,
        ipAddress: input.requestMetadata.ipAddress,
        userAgent: input.requestMetadata.userAgent,
      },
      select: { id: true },
    });

    await transaction.refreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: revocationTimestamp(now, token.createdAt),
        revokedReason: 'ROTATED',
        replacedByTokenId: nextToken.id,
      },
    });

    await writeAuditLog(
      {
        actorUserId: token.userId,
        action: 'AUTH_REFRESH_ROTATED',
        entityType: 'RefreshToken',
        entityId: nextToken.id,
        metadata: { familyId: token.familyId, previousTokenId: token.id },
        request: input.requestMetadata,
      },
      transaction,
    );

    return { kind: 'ok', user: token.user };
  });

  if (result.kind === 'missing') {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'The refresh token is invalid',
      'INVALID_REFRESH_TOKEN',
    );
  }

  if (result.kind === 'reused') {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Refresh token reuse was detected; the token family has been revoked',
      'REFRESH_TOKEN_REUSED',
    );
  }

  if (result.kind === 'expired') {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'The refresh token has expired',
      'REFRESH_TOKEN_EXPIRED',
    );
  }

  if (result.kind === 'inactive') {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'This account is not active', 'ACCOUNT_INACTIVE');
  }

  if (result.kind !== 'ok') {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'The refresh token is invalid',
      'INVALID_REFRESH_TOKEN',
    );
  }

  return {
    accessToken: signAccessToken(result.user),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: nextRefreshTokenExpiresAt,
    csrfToken: generateCsrfToken(),
    user: toPublicUser(result.user),
  };
}

export interface LogoutInput {
  refreshToken: string | undefined;
  requestMetadata: RequestMetadata;
}

export async function logout(input: LogoutInput): Promise<void> {
  if (!input.refreshToken) {
    return;
  }

  const tokenHash = hashRefreshToken(input.refreshToken);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "RefreshToken"
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      return;
    }

    const token = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true },
    });

    if (!token) {
      return;
    }

    await transaction.$executeRaw`
      UPDATE "RefreshToken"
      SET
        "revokedAt" = GREATEST(${now}, "createdAt"),
        "revokedReason" = 'LOGOUT',
        "updatedAt" = GREATEST(${now}, "createdAt")
      WHERE "familyId" = ${token.familyId} AND "revokedAt" IS NULL
    `;

    await writeAuditLog(
      {
        actorUserId: token.userId,
        action: 'AUTH_LOGOUT',
        entityType: 'RefreshToken',
        entityId: token.id,
        metadata: { familyId: token.familyId },
        request: input.requestMetadata,
      },
      transaction,
    );
  });
}

export interface ChangePasswordInputWithActor extends ChangePasswordInput {
  actorUserId: string;
  requestMetadata: RequestMetadata;
}

export async function changePassword(input: ChangePasswordInputWithActor): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.actorUserId },
    select: { id: true, passwordHash: true, authVersion: true },
  });

  if (!user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'Authentication is required',
      'AUTHENTICATION_REQUIRED',
    );
  }

  const currentPasswordMatches = await compare(input.currentPassword, user.passwordHash);

  if (!currentPasswordMatches) {
    await writeAuditLogSafely({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_CHANGE_FAILED',
      entityType: 'User',
      entityId: user.id,
      outcome: 'FAILURE',
      metadata: { reason: 'INVALID_CURRENT_PASSWORD' },
      request: input.requestMetadata,
    });

    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      'The current password is incorrect',
      'INVALID_CURRENT_PASSWORD',
    );
  }

  const passwordIsUnchanged = await compare(input.newPassword, user.passwordHash);

  if (passwordIsUnchanged) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'The new password must be different from the current password',
      'PASSWORD_UNCHANGED',
    );
  }

  const passwordHash = await hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);
  const changedAt = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: changedAt,
        authVersion: { increment: 1 },
      },
    });

    const revokedSessions = await transaction.$executeRaw`
      UPDATE "RefreshToken"
      SET
        "revokedAt" = GREATEST(${changedAt}, "createdAt"),
        "revokedReason" = 'PASSWORD_CHANGED',
        "updatedAt" = GREATEST(${changedAt}, "createdAt")
      WHERE "userId" = ${user.id} AND "revokedAt" IS NULL
    `;

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          authVersion: user.authVersion + 1,
          revokedSessions,
        },
        request: input.requestMetadata,
      },
      transaction,
    );
  });
}

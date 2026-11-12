import type { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import type { RequestMetadata } from '../modules/auth/auth.types';

export interface AuditEventInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonObject;
  request: RequestMetadata;
}

export async function writeAuditLog(
  input: AuditEventInput,
  transaction?: Prisma.TransactionClient,
): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    outcome: input.outcome ?? 'SUCCESS',
    ipAddress: input.request.ipAddress,
    userAgent: input.request.userAgent,
    requestId: input.request.requestId,
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
  };

  if (transaction) {
    await transaction.auditLog.create({ data });
    return;
  }

  await prisma.auditLog.create({ data });
}

export async function writeAuditLogSafely(input: AuditEventInput): Promise<void> {
  try {
    await writeAuditLog(input);
  } catch (error) {
    logger.warn({ err: error, action: input.action }, 'Failed to write audit log');
  }
}

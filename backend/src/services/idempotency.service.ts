import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { isUniqueConstraintError } from '../utils/database-errors';
import { AppError } from '../utils/errors';
import { HTTP_STATUS } from '../utils/http-status';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

interface IdempotencyOptions {
  actorUserId: string;
  scope: string;
  key: string;
  payload: unknown;
  resourceType: string;
  responseStatusCode: number;
  operation: (transaction: Prisma.TransactionClient) => Promise<string>;
}

export interface IdempotentOperationResult {
  resourceId: string;
  replayed: boolean;
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeForHash(nestedValue)]),
    );
  }

  return value;
}

function hashPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeForHash(payload)))
    .digest('hex');
}

function findIdempotencyKey(
  actorUserId: string,
  scope: string,
  key: string,
): Promise<{
  id: string;
  requestHash: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  resourceId: string | null;
  expiresAt: Date;
} | null> {
  return prisma.idempotencyKey.findUnique({
    where: {
      actorUserId_scope_key: {
        actorUserId,
        scope,
        key,
      },
    },
    select: {
      id: true,
      requestHash: true,
      status: true,
      resourceId: true,
      expiresAt: true,
    },
  });
}

async function resolveExistingKey(
  existing: NonNullable<Awaited<ReturnType<typeof findIdempotencyKey>>>,
  requestHash: string,
): Promise<IdempotentOperationResult | null> {
  if (existing.expiresAt.getTime() <= Date.now()) {
    await prisma.idempotencyKey.delete({ where: { id: existing.id } });
    return null;
  }

  if (existing.requestHash !== requestHash) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      'The idempotency key was already used with a different request payload',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }

  if (existing.status === 'COMPLETED' && existing.resourceId) {
    return {
      resourceId: existing.resourceId,
      replayed: true,
    };
  }

  throw new AppError(
    HTTP_STATUS.CONFLICT,
    'A request with this idempotency key is still being processed',
    'IDEMPOTENCY_REQUEST_IN_PROGRESS',
  );
}

export async function runIdempotentOperation(
  options: IdempotencyOptions,
): Promise<IdempotentOperationResult> {
  const requestHash = hashPayload(options.payload);
  const existing = await findIdempotencyKey(options.actorUserId, options.scope, options.key);

  if (existing) {
    const replay = await resolveExistingKey(existing, requestHash);
    if (replay) {
      return replay;
    }
  }

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const idempotencyRecord = await transaction.idempotencyKey.create({
          data: {
            actorUserId: options.actorUserId,
            scope: options.scope,
            key: options.key,
            requestHash,
            status: 'PENDING',
            resourceType: options.resourceType,
            expiresAt,
          },
          select: { id: true },
        });

        const resourceId = await options.operation(transaction);

        await transaction.idempotencyKey.update({
          where: { id: idempotencyRecord.id },
          data: {
            status: 'COMPLETED',
            resourceId,
            responseStatusCode: options.responseStatusCode,
            responseBody: { resourceId },
          },
        });

        return { resourceId, replayed: false };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error, ['actorUserId', 'scope', 'key']) || attempt === 1) {
        throw error;
      }

      const concurrentRecord = await findIdempotencyKey(
        options.actorUserId,
        options.scope,
        options.key,
      );

      if (concurrentRecord) {
        const replay = await resolveExistingKey(concurrentRecord, requestHash);
        if (replay) {
          return replay;
        }
      }
    }
  }

  throw new AppError(
    HTTP_STATUS.CONFLICT,
    'The idempotent operation could not be completed',
    'IDEMPOTENCY_CONFLICT',
  );
}

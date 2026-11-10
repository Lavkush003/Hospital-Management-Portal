import { Prisma } from '@prisma/client';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getPrismaErrorCode(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  return undefined;
}

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return getPrismaErrorCode(error) === code;
}

export function isUniqueConstraintError(error: unknown, fields?: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  if (!fields) {
    return true;
  }

  const target = error.meta?.target;
  return (
    Array.isArray(target) &&
    fields.every((field) => target.includes(field)) &&
    target.length === fields.length
  );
}

export function isExclusionConstraintError(error: unknown, constraintName: string): boolean {
  const message = getErrorMessage(error);
  return message.includes('23P01') || message.includes(constraintName);
}

export function isCheckConstraintError(error: unknown, constraintName?: string): boolean {
  const message = getErrorMessage(error);

  if (constraintName && message.includes(constraintName)) {
    return true;
  }

  return hasPrismaErrorCode(error, 'P2004') || message.includes('23514');
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return hasPrismaErrorCode(error, 'P2003') || getErrorMessage(error).includes('23503');
}

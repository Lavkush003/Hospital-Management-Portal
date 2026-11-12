import { randomBytes } from 'node:crypto';

export function createPatientNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `PAT-${timestamp}-${randomSuffix}`;
}

import { healthResponseSchema } from '@/schemas/health.schema';
import type { HealthResponse } from '@/types/health';
import { env } from '@/utils/env';

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${env.VITE_API_BASE_URL}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();

  return healthResponseSchema.parse(payload);
}

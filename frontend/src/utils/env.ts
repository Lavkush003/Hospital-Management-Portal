import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().trim().min(1).default('/api'),
  VITE_APP_NAME: z.string().trim().min(1).default('Hospital Management System'),
});

const parsedEnvironment = envSchema.safeParse(import.meta.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.map(String).join('.') || 'environment'}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid frontend environment configuration: ${issues}`);
}

const normalizedApiBaseUrl = parsedEnvironment.data.VITE_API_BASE_URL.replace(/\/+$/, '') || '/api';

export const env = Object.freeze({
  ...parsedEnvironment.data,
  VITE_API_BASE_URL: normalizedApiBaseUrl,
});

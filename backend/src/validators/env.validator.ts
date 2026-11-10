import { z } from 'zod';

const jwtExpirySchema = z
  .string()
  .regex(/^\d+[smhd]$/, 'Must be a duration such as 15m, 1h, or 7d');

const corsOriginsSchema = z
  .string()
  .min(1, 'CORS_ORIGIN must contain at least one origin')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url('Each CORS origin must be a valid URL')).min(1));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(
        (value) => /^postgres(ql)?:\/\//i.test(value),
        'DATABASE_URL must use the postgresql:// or postgres:// scheme',
      ),
    CORS_ORIGIN: corsOriginsSchema,
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: jwtExpirySchema.default('15m'),
    JWT_REFRESH_EXPIRES_IN: jwtExpirySchema.default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(15 * 60_000),
    AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
    AUTH_REFRESH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(15 * 60_000),
    AUTH_REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .refine((value) => value.JWT_ACCESS_SECRET !== value.JWT_REFRESH_SECRET, {
    message: 'JWT access and refresh secrets must be different',
    path: ['JWT_REFRESH_SECRET'],
  });

export type Environment = z.infer<typeof envSchema>;

export function formatEnvironmentError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.') || 'environment';
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');
}

import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { envSchema, formatEnvironmentError } from '../validators/env.validator';

loadDotenv({ path: resolve(__dirname, '../../.env'), quiet: true });

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  process.stderr.write(
    `Invalid environment configuration:\n${formatEnvironmentError(parsedEnvironment.error)}\n`,
  );
  process.exit(1);
}

export const env = Object.freeze(parsedEnvironment.data);

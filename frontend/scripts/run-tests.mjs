import { spawnSync } from 'node:child_process';
import process from 'node:process';

const env = {
  ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --experimental-require-module`.trim(),
};

const result = spawnSync('npx', ['vitest', 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 0);


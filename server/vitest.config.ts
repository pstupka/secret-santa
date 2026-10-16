import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Reuse tsconfig "paths" so tests resolve the same aliases as tsc/tsx.
const { compilerOptions } = JSON.parse(
  readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf8'),
);
const alias = Object.entries(
  compilerOptions.paths as Record<string, string[]>,
).map(([key, [target]]) => {
  const absolute = fileURLToPath(new URL(target.replace('/*', '/'), import.meta.url));
  return key.endsWith('/*')
    ? { find: new RegExp(`^${key.replace('/*', '/')}`), replacement: absolute }
    : { find: new RegExp(`^${key}$`), replacement: absolute };
});

process.loadEnvFile(fileURLToPath(new URL('./.env.local', import.meta.url)));

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { NODE_ENV: 'development' },
  },
});

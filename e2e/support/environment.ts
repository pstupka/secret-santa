import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Where e2e/compose.yaml publishes the app and Mailpit's API.
export const APP_URL = 'http://localhost:18080';
export const MAILPIT_URL = 'http://localhost:18025';

const composeFile = fileURLToPath(new URL('../compose.yaml', import.meta.url));

// Set to reuse an already running environment (`yarn e2e` then only runs
// the tests), e.g. while writing a spec. Keep it running with E2E_KEEP=1.
export const reuseEnvironment = process.env.E2E_REUSE === '1';
export const keepEnvironment = process.env.E2E_KEEP === '1';

export const compose = (...args: string[]): void => {
  execFileSync('docker', ['compose', '-f', composeFile, ...args], {
    stdio: 'inherit',
  });
};

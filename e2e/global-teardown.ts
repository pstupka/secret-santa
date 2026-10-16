import {
  compose,
  keepEnvironment,
  reuseEnvironment,
} from './support/environment';

export default async function globalTeardown(): Promise<void> {
  if (reuseEnvironment || keepEnvironment) return;
  compose('down', '--volumes', '--remove-orphans');
}

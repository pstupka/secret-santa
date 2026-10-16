import { compose, reuseEnvironment } from './support/environment';
import { deleteAllEmails } from './support/mailpit';

// Builds the production image and starts it with Mailpit on a scratch
// database; `--wait` returns once the app's health check passes.
export default async function globalSetup(): Promise<void> {
  if (!reuseEnvironment) {
    try {
      compose('up', '--detach', '--build', '--wait', '--force-recreate');
    } catch (error) {
      compose('down', '--volumes', '--remove-orphans');
      throw error;
    }
  }
  await deleteAllEmails();
}

import { Server } from 'http';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import createApp from '@app';
import config from '@config/config';
import { migrateToLatest, openDatabase } from '@db/database';
import { createSmtpMailer } from '@email/mailer';
import { createEmailSender, EmailSender } from '@email/sender';
import { systemClock } from '@shared/clock';
import logger from '@core/utils/logger';
import errorHandler from 'core/utils/errorHandler';

const {
  port,
  projectName,
  databasePath,
  publicUrl,
  smtpUrl,
  mailFrom,
  clientDistPath,
  emailSendIntervalMs,
  emailThrottleMs,
} = config;

let server: Server | undefined;
let emailSender: EmailSender | undefined;

const start = async (): Promise<void> => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = openDatabase(databasePath);
  await migrateToLatest(db);
  logger.info(`Database ready at ${databasePath}`);

  emailSender = createEmailSender({
    db,
    clock: systemClock,
    mailer: createSmtpMailer(smtpUrl, mailFrom),
    publicUrl,
    throttleMs: emailThrottleMs,
  });
  emailSender.start(emailSendIntervalMs);

  // In dev the client is served by Vite; only serve a build that exists.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const clientDir = existsSync(join(clientDistPath, 'index.html'))
    ? clientDistPath
    : undefined;
  logger.info(
    clientDir
      ? `Serving client from ${clientDir}`
      : `No client build at ${clientDistPath}, serving the API only`,
  );

  const app = createApp({ db, clock: systemClock }, { clientDir });
  server = app.listen(port, (): void => {
    logger.info(`Application '${projectName}' listens on PORT: ${port}`);
  });
};

const exitHandler = (): void => {
  if (!server) {
    process.exitCode = 1;
    return;
  }
  server.close(() => {
    logger.info('Server closed');
    process.exitCode = 1;
  });
};

const unexpectedErrorHandler = (error: Error): void => {
  errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) {
    exitHandler();
  }
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', (reason: Error) => {
  throw reason;
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  emailSender?.stop();
  if (server) {
    server.close();
  }
});

start().catch(unexpectedErrorHandler);

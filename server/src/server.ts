import { Server } from 'http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import createApp from '@app';
import config from '@config/config';
import { migrateToLatest, openDatabase } from '@db/database';
import { systemClock } from '@shared/clock';
import logger from '@core/utils/logger';
import errorHandler from 'core/utils/errorHandler';

const { port, projectName, databasePath } = config;

let server: Server | undefined;

const start = async (): Promise<void> => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = openDatabase(databasePath);
  await migrateToLatest(db);
  logger.info(`Database ready at ${databasePath}`);

  const app = createApp({ db, clock: systemClock });
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
  if (server) {
    server.close();
  }
});

start().catch(unexpectedErrorHandler);

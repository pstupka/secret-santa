import { Server } from 'http';
import app from '@app';
import config from '@config/config';
import logger from '@core/utils/logger';
import errorHandler from 'core/utils/errorHandler';

const { port, ptojectName } = config;

const server: Server = app.listen(port, (): void => {
  logger.info(`Aapplication '${ptojectName}' listens on PORT: ${port}`);
});

const exitHandler = (): void => {
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

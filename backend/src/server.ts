import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';

const app = createApp();

const server = app.listen(env.PORT);

server.on('listening', () => {
  logger.info({ port: env.PORT }, 'Hospital Management API is running');
});

server.on('error', (error) => {
  logger.fatal({ err: error }, 'HTTP server failed to start');
  process.exit(1);
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down Hospital Management API');

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((serverError) => {
    void prisma
      .$disconnect()
      .catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, 'Failed to disconnect Prisma');
      })
      .finally(() => {
        clearTimeout(forceExitTimer);

        if (serverError) {
          logger.error({ err: serverError }, 'HTTP server closed with an error');
          process.exit(1);
        }

        logger.info('Shutdown complete');
        process.exit(0);
      });
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.once('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

const app = require('./app');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function start() {
  try {
    await connectDatabase();
    const server = app.listen(env.port, () => {
      console.log(`[api] Hospital Management System API listening on http://localhost:${env.port}`);
      console.log(`[api] Swagger docs available at http://localhost:${env.port}/api/docs`);
    });

    const shutdown = async (signal) => {
      console.log(`[api] ${signal} received, shutting down...`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[api] failed to start', error);
    process.exit(1);
  }
}

start();

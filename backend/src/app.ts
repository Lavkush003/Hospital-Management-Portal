import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './routes';
import { AppError } from './utils/errors';
import { HTTP_STATUS } from './utils/http-status';

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGIN.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new AppError(
        HTTP_STATUS.FORBIDDEN,
        'Origin is not allowed by the CORS policy',
        'CORS_ORIGIN_DENIED',
      ),
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86_400,
};

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(requestLogger);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

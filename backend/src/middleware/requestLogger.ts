import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';

export const requestLogger = pinoHttp({
  logger,
  genReqId(request, response) {
    const existingRequestId = request.headers['x-request-id'];
    const requestId =
      typeof existingRequestId === 'string' && existingRequestId.length > 0
        ? existingRequestId
        : randomUUID();

    response.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel(_request, response, error) {
    if (error || response.statusCode >= 500) {
      return 'error';
    }

    if (response.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
});

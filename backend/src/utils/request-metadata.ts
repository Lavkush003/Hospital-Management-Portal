import type { Request, Response } from 'express';
import type { RequestMetadata } from '../modules/auth/auth.types';

export function getClientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

export function getRequestMetadata(request: Request, response: Response): RequestMetadata {
  const requestIdHeader = response.getHeader('x-request-id');
  const userAgent = request.get('user-agent');

  return {
    ipAddress: getClientIp(request).slice(0, 45),
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
    requestId: typeof requestIdHeader === 'string' ? requestIdHeader : null,
  };
}

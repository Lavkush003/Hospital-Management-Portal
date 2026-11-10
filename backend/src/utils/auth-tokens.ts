import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { parseDurationToMs } from './duration';

export const ACCESS_TOKEN_ISSUER = 'hospital-management-api';
export const ACCESS_TOKEN_AUDIENCE = 'hospital-management-client';
export const ACCESS_TOKEN_TTL_MS = parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN);
export const REFRESH_TOKEN_TTL_MS = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN);
export const ACCESS_TOKEN_TTL_SECONDS = Math.floor(ACCESS_TOKEN_TTL_MS / 1_000);

const USER_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'FRONT_DESK', 'CLINICIAN']);

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  role: UserRole;
  ver: number;
  type: 'access';
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

interface AccessTokenSubject {
  id: string;
  role: UserRole;
  authVersion: number;
}

export function signAccessToken(user: AccessTokenSubject): string {
  return jwt.sign(
    {
      role: user.role,
      ver: user.authVersion,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: user.id,
      jwtid: randomUUID(),
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  });

  if (typeof decoded === 'string') {
    throw new Error('Access token payload is invalid');
  }

  const { sub, role, ver, type, jti, exp, iat } = decoded;

  if (
    typeof sub !== 'string' ||
    sub.length === 0 ||
    typeof role !== 'string' ||
    !USER_ROLES.has(role) ||
    typeof ver !== 'number' ||
    !Number.isInteger(ver) ||
    ver < 0 ||
    type !== 'access' ||
    typeof jti !== 'string' ||
    jti.length === 0 ||
    typeof exp !== 'number' ||
    typeof iat !== 'number'
  ) {
    throw new Error('Access token payload is invalid');
  }

  return decoded as AccessTokenClaims;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateFamilyId(): string {
  return randomUUID();
}

export function timingSafeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

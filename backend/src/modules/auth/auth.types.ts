import type { UserRole, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  doctorId: string | null;
  staffId: string | null;
  patientId: string | null;
  authVersion: number;
}

export interface AuthContext {
  user: AuthenticatedUser;
  tokenId: string;
  tokenExpiresAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  doctorId?: string;
  staffId?: string;
  patientId?: string;
}

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

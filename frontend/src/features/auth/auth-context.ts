import { createContext, useContext } from 'react';
import type { SessionUser } from '@/types/api';

export type { SessionUser };

export interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

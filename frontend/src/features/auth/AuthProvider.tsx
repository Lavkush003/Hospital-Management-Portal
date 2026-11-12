import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  errorMessage,
  readCsrfCookie,
  setAccessToken,
  setUnauthorizedHandler,
} from '@/services/api';
import type { SessionUser } from '@/types/api';
import { AuthContext } from './auth-context';

interface SessionResponse {
  accessToken: string;
  csrfToken: string;
  user: SessionUser;
}

let restoreSessionPromise: Promise<SessionResponse | null> | null = null;

function restoreSession(): Promise<SessionResponse | null> {
  if (!restoreSessionPromise) {
    restoreSessionPromise = (async () => {
      const csrfToken = readCsrfCookie();
      if (!csrfToken) return null;

      try {
        return await apiRequest<SessionResponse>(
          '/auth/refresh',
          { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } },
          false,
        );
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status?: number }).status;
          if (status === 401 || status === 403) return null;
        }
        throw error;
      }
    })();
  }

  return restoreSessionPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    void restoreSession()
      .then((session) => {
        if (session) {
          setAccessToken(session.accessToken);
          setUser(session.user);
        }
      })
      .catch((error: unknown) => {
        setAuthError(errorMessage(error));
      })
      .finally(() => setLoading(false));

    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiRequest<SessionResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    );
    setAccessToken(session.accessToken);
    setUser(session.user);
    setAuthError(null);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    const csrfToken = readCsrfCookie();
    try {
      if (csrfToken) {
        await apiRequest<void>(
          '/auth/logout',
          { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } },
          false,
        );
      }
    } catch {
      // Clear the local session even if the server session was already gone.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({ user, loading, authError, login, logout, clearAuthError }),
    [user, loading, authError, login, logout, clearAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

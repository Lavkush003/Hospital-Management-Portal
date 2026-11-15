import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('hms_token')));

  const clearSession = useCallback(() => {
    localStorage.removeItem('hms_token');
    setUser(null);
    setDoctor(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('hms_token')) {
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      setDoctor(data.data.doctor || null);
      return data.data.user;
    } catch {
      clearSession();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => clearSession();
    window.addEventListener('hms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hms:unauthorized', onUnauthorized);
  }, [refresh, clearSession]);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('hms_token', data.data.accessToken);
    setUser(data.data.user);
    setDoctor(data.data.doctor || null);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Session is cleared locally even if the server cannot be reached.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, doctor, loading, login, logout, refresh, isAuthenticated: Boolean(user) }),
    [user, doctor, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

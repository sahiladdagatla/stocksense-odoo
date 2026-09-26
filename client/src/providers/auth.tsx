import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api';
import { queryClient } from '@/lib/query';
import type { AuthResponse, User } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  user: User | null;
  status: Status;
  isManager: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(() => (tokenStore.get() ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setUserState(null);
    setStatus('anonymous');
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api
      .get<User>('/auth/me')
      .then((u) => {
        if (cancelled) return;
        setUserState(u);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      toast.error('Your session has expired. Please sign in again.');
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const start = useCallback((res: AuthResponse, remember: boolean) => {
    tokenStore.set(res.token, remember);
    setUserState(res.user);
    setStatus('authenticated');
    return res.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isManager: user?.role === 'MANAGER',
      login: async (email, password, remember) =>
        start(await api.post<AuthResponse>('/auth/login', { email, password }), remember),
      signup: async (name, email, password) =>
        start(await api.post<AuthResponse>('/auth/signup', { name, email, password }), true),
      logout,
      setUser: setUserState,
    }),
    [user, status, start, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

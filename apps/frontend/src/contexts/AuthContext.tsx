import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import type { AuthUser } from '../types/api.types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setMustChangePassword: (required: boolean) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const performLogout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore API errors on logout
    }
    performLogout();
  }, [performLogout]);

  const login = useCallback(
    async (loginStr: string, password: string) => {
      const result = await authApi.login(loginStr, password);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      setUser(result.user);
      navigate(result.user.mustChangePassword ? '/change-password' : '/settings', {
        replace: true,
      });
    },
    [navigate],
  );

  const setMustChangePassword = useCallback((required: boolean) => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: required } : prev));
  }, []);

  // Bootstrap: check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setLoading(false));
  }, []);

  // Global 401 listener
  useEffect(() => {
    const handler = () => performLogout();
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [performLogout]);

  useEffect(() => {
    const handler = () => {
      setUser((prev) => (prev ? { ...prev, mustChangePassword: true } : prev));
      navigate('/change-password', { replace: true });
    };
    window.addEventListener('auth:password-change-required', handler);
    return () => window.removeEventListener('auth:password-change-required', handler);
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        setMustChangePassword,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

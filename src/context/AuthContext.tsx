import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../types';
import { authApi, clearLegacyAuthStorage } from '../services/api';
import { AuthContext } from '../hooks';

const isExpiryValid = (expiresAt: string | null | undefined): boolean => {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed > Date.now();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const userRef = useRef<User | null>(null);
  const expiresAtRef = useRef<string | null>(null);

  useEffect(() => {
    userRef.current = user;
    expiresAtRef.current = expiresAt;
  }, [user, expiresAt]);

  const clearSessionState = useCallback(() => {
    clearLegacyAuthStorage();
    userRef.current = null;
    expiresAtRef.current = null;
    setUser(null);
    setExpiresAt(null);
  }, []);

  const verifySession = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const me = await authApi.getMe(signal);
        if (signal?.aborted) return;
        const { expires_at, ...userData } = me;
        if (!isExpiryValid(expires_at)) {
          clearSessionState();
          return;
        }
        setUser(userData as User);
        setExpiresAt(expires_at || null);
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) return;
        clearSessionState();
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [clearSessionState]
  );

  useEffect(() => {
    const controller = new AbortController();
    clearLegacyAuthStorage();

    authApi
      .getMe(controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        const { expires_at, ...userData } = me;
        if (!isExpiryValid(expires_at)) {
          clearSessionState();
          return;
        }
        setUser(userData as User);
        setExpiresAt(expires_at || null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        clearSessionState();
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [clearSessionState]);

  useEffect(() => {
    const handleFocus = () => {
      if (expiresAtRef.current && !isExpiryValid(expiresAtRef.current)) {
        clearSessionState();
        return;
      }
      if (userRef.current) {
        verifySession();
      }
    };

    const handleUnauthorized = () => {
      clearSessionState();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('foodie:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('foodie:unauthorized', handleUnauthorized);
    };
  }, [clearSessionState, verifySession]);

  const login = async (email: string, password: string, rememberMe = true): Promise<boolean> => {
    const res = await authApi.login(email, password, rememberMe);
    if (!isExpiryValid(res.expires_at)) {
      clearSessionState();
      throw new Error('Authentication session did not return a valid expiration.');
    }
    setUser(res.user);
    setExpiresAt(res.expires_at || null);
    setIsLoading(false);
    return true;
  };

  const logout = useCallback(
    (reason?: 'manual' | 'session_expired') => {
      if (reason === 'session_expired' || sessionStorage.getItem('foodie_session_expired') === 'true') {
        sessionStorage.setItem('foodie_session_expired', 'true');
        sessionStorage.removeItem('foodie_signed_out');
      } else {
        sessionStorage.removeItem('foodie_session_expired');
        sessionStorage.removeItem('foodie_expired_email');
        sessionStorage.setItem('foodie_signed_out', 'true');
      }
      authApi.logout();
      clearSessionState();
    },
    [clearSessionState]
  );

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updatedFields });
    }
  };

  const isAuthenticated = Boolean(user && isExpiryValid(expiresAt));
  const isLoginRoute = typeof window !== 'undefined' && window.location.pathname.includes('/login');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {isLoading && !isLoginRoute ? (
        <div className="min-h-screen flex items-center justify-center bg-white text-sm text-foreground-muted">
          Verifying session...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

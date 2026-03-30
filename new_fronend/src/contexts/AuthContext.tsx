import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  sub: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; message?: string }>;
  refreshToken: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  hasRole: (role: string) => boolean;
  getAccessToken: () => string | null;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  USER: 'kc_user',
  TOKENS: 'kc_tokens',
} as const;

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const persistSession = useCallback((user: AuthUser, tokens: AuthTokens) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
    setState({ user, tokens, isAuthenticated: true, isLoading: false });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKENS);
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  }, []);

  // ── Token auto-refresh ─────────────────────────────────────────────────────

  const scheduleRefresh = useCallback(
    (expiresIn: number, currentRefreshToken: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const refreshAt = Math.max((expiresIn - 60) * 1000, 30_000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const resp = await apiPost('/auth/token/refresh/', { refreshToken: currentRefreshToken });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success) {
              setState((prev) => {
                if (!prev.user) return prev;
                const newTokens: AuthTokens = {
                  accessToken: data.accessToken,
                  refreshToken: data.refreshToken,
                  idToken: data.idToken,
                  expiresIn: data.expiresIn,
                };
                persistSession(prev.user, newTokens);
                scheduleRefresh(data.expiresIn, data.refreshToken);
                return prev;
              });
            } else {
              clearSession();
            }
          } else {
            clearSession();
          }
        } catch {
          // Network error during refresh – keep session until next load
        }
      }, refreshAt);
    },
    [persistSession, clearSession],
  );

  // ── Initialise from localStorage ──────────────────────────────────────────

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      const storedTokens = localStorage.getItem(STORAGE_KEYS.TOKENS);
      if (storedUser && storedTokens) {
        const user: AuthUser = JSON.parse(storedUser);
        const tokens: AuthTokens = JSON.parse(storedTokens);
        setState({ user, tokens, isAuthenticated: true, isLoading: false });
        if (tokens.refreshToken && tokens.expiresIn) {
          scheduleRefresh(tokens.expiresIn, tokens.refreshToken);
        }
        return;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.TOKENS);
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, [scheduleRefresh]);

  // ── Auth actions ───────────────────────────────────────────────────────────

  const login = useCallback(
    async (usernameOrEmail: string, password: string) => {
      try {
        const resp = await apiPost('/auth/login/', { username: usernameOrEmail, password });
        const data = await resp.json();
        if (data.success) {
          persistSession(data.user, data.tokens);
          scheduleRefresh(data.tokens.expiresIn, data.tokens.refreshToken);
          return { success: true };
        }
        return { success: false, error: data.error || 'Login failed.' };
      } catch {
        return { success: false, error: 'Network error. Please try again.' };
      }
    },
    [persistSession, scheduleRefresh],
  );

  const logout = useCallback(async () => {
    const currentTokens = state.tokens;
    clearSession();
    if (currentTokens?.refreshToken) {
      try {
        await apiPost('/auth/logout/', { refreshToken: currentTokens.refreshToken });
      } catch {
        // Silent – client-side session is already cleared
      }
    }
  }, [state.tokens, clearSession]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const resp = await apiPost('/auth/register/', data);
      const json = await resp.json();
      if (json.success) return { success: true, message: json.message };
      return { success: false, error: json.error || 'Registration failed.' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const rt = state.tokens?.refreshToken;
    if (!rt) return false;
    try {
      const resp = await apiPost('/auth/token/refresh/', { refreshToken: rt });
      const data = await resp.json();
      if (data.success && state.user) {
        const newTokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          idToken: data.idToken,
          expiresIn: data.expiresIn,
        };
        persistSession(state.user, newTokens);
        scheduleRefresh(data.expiresIn, data.refreshToken);
        return true;
      }
      clearSession();
      return false;
    } catch {
      return false;
    }
  }, [state.tokens, state.user, persistSession, scheduleRefresh, clearSession]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const resp = await apiPost('/auth/forgot-password/', { email });
      const data = await resp.json();
      if (data.success) return { success: true, message: data.message };
      return { success: false, error: data.error || 'Failed to send reset email.' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    try {
      const resp = await apiPost('/auth/resend-verification/', { email });
      const data = await resp.json();
      if (data.success) return { success: true, message: data.message };
      return { success: false, error: data.error || 'Failed to resend email.' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const hasRole = useCallback(
    (role: string) => {
      const userRoles = state.user?.roles?.map((r) => r.toLowerCase()) ?? [];
      const rl = role.toLowerCase();
      if (rl === 'admin') return userRoles.includes('admin') || userRoles.includes('super_admin');
      return userRoles.includes(rl);
    },
    [state.user],
  );

  const getAccessToken = useCallback(() => state.tokens?.accessToken ?? null, [state.tokens]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        register,
        refreshToken,
        forgotPassword,
        resendVerification,
        hasRole,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

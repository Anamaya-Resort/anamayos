'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SSOUser } from '@/types/sso';
import type { Locale } from '@/config/app';

interface AuthState {
  user: SSOUser | null;
  personId: string | null;
  accessLevel: number;
  roleSlugs: string[];
  locale: Locale;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  hasMinAccess: (level: number) => boolean;
  hasRole: (slug: string) => boolean;
  setLocale: (locale: Locale) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    personId: null,
    accessLevel: 0,
    roleSlugs: [],
    locale: 'en',
    isLoading: true,
  });
  const router = useRouter();

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setState({
              user: data.user,
              personId: data.personId,
              accessLevel: data.accessLevel,
              roleSlugs: data.roleSlugs ?? [],
              locale: data.locale ?? 'en',
              isLoading: false,
            });
            return;
          }
        }
      } catch {
        // Session fetch failed
      }
      setState({ user: null, personId: null, accessLevel: 0, roleSlugs: [], locale: 'en', isLoading: false });
    }

    loadSession();
  }, []);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, personId: null, accessLevel: 0, roleSlugs: [], locale: 'en', isLoading: false });
    router.push('/login');
    router.refresh();
  }

  const setLocale = useCallback(async (newLocale: Locale) => {
    await fetch('/api/auth/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    });
    // Full page reload so the server layout re-reads the updated session cookie
    window.location.reload();
  }, []);

  const hasMinAccess = useCallback(
    (level: number) => state.accessLevel >= level,
    [state.accessLevel],
  );

  const hasRole = useCallback(
    (slug: string) => state.roleSlugs.includes(slug),
    [state.roleSlugs],
  );

  return (
    <AuthContext.Provider value={{ ...state, signOut, hasMinAccess, hasRole, setLocale }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

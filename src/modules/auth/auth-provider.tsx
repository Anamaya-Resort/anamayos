'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SSOUser } from '@/types/sso';
import type { Locale } from '@/config/app';

interface AuthState {
  user: SSOUser | null;
  personId: string | null;
  displayName: string;
  topRole: string;
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

const EMPTY: AuthState = {
  user: null,
  personId: null,
  displayName: '',
  topRole: '',
  accessLevel: 0,
  roleSlugs: [],
  locale: 'en',
  isLoading: false,
};

/**
 * `initial` comes from the server layout, which has already read and
 * verified the same session cookie that `/api/auth/session` reads. Seeding
 * from it does two things: the first paint knows the access level, so the
 * sidebar renders its real items instead of popping them in a moment
 * later and shifting whatever is under the cursor, and the client skips an
 * HTTP round trip on every page load for data it was handed for free.
 * The fetch is kept only for the unseeded case.
 */
export function AuthProvider({
  children, initial,
}: {
  children: React.ReactNode;
  initial?: Omit<AuthState, 'isLoading'> | null;
}) {
  const [state, setState] = useState<AuthState>(
    initial ? { ...initial, isLoading: false } : { ...EMPTY, isLoading: true },
  );
  const router = useRouter();

  useEffect(() => {
    if (initial) return;
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setState({
              user: data.user,
              personId: data.personId,
              displayName: data.displayName ?? '',
              topRole: data.topRole ?? '',
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
      setState(EMPTY);
    }

    loadSession();
  }, [initial]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState(EMPTY);
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

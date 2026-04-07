'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SSOUser } from '@/types/sso';

interface AuthState {
  user: SSOUser | null;
  personId: string | null;
  accessLevel: number;
  roleSlugs: string[];
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  hasMinAccess: (level: number) => boolean;
  hasRole: (slug: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    personId: null,
    accessLevel: 0,
    roleSlugs: [],
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
              isLoading: false,
            });
            return;
          }
        }
      } catch {
        // Session fetch failed
      }
      setState({ user: null, personId: null, accessLevel: 0, roleSlugs: [], isLoading: false });
    }

    loadSession();
  }, []);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, personId: null, accessLevel: 0, roleSlugs: [], isLoading: false });
    router.push('/login');
    router.refresh();
  }

  const hasMinAccess = useCallback(
    (level: number) => state.accessLevel >= level,
    [state.accessLevel],
  );

  const hasRole = useCallback(
    (slug: string) => state.roleSlugs.includes(slug),
    [state.roleSlugs],
  );

  return (
    <AuthContext.Provider value={{ ...state, signOut, hasMinAccess, hasRole }}>
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

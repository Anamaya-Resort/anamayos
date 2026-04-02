'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SSOUser } from '@/types/sso';
import type { UserRole } from '@/types';

interface AuthState {
  user: SSOUser | null;
  role: UserRole;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Map SSO roles to local app roles */
function mapRole(ssoRole: string): UserRole {
  switch (ssoRole) {
    case 'superadmin': return 'owner';
    case 'admin': return 'admin';
    default: return 'guest';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: 'guest',
    isLoading: true,
  });
  const router = useRouter();

  useEffect(() => {
    // Read session from cookie via a lightweight API call
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setState({
              user: data.user,
              role: mapRole(data.user.role),
              isLoading: false,
            });
            return;
          }
        }
      } catch {
        // Session fetch failed — treat as logged out
      }
      setState({ user: null, role: 'guest', isLoading: false });
    }

    loadSession();
  }, []);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, role: 'guest', isLoading: false });
    router.push('/login');
    router.refresh();
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
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

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: 'guest',
    isLoading: true,
  });

  const supabase = createClient();

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data as Profile | null;
  }

  async function refreshProfile() {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    if (profile) {
      setState((prev) => ({
        ...prev,
        profile,
        role: profile.role,
      }));
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          role: profile?.role ?? 'guest',
          isLoading: false,
        });
      } else {
        setState({
          user: null,
          profile: null,
          role: 'guest',
          isLoading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signOut, refreshProfile }}
    >
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

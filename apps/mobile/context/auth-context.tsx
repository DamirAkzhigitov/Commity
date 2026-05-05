import type { Session, User } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { clearCachedEntitlement } from '../lib/entitlement-cache';
import { getAppConfig, isSupabaseConfigured } from '../lib/config';
import { syncPurchasesWithAuthUser } from '../lib/revenuecat-session';
import { supabaseAuth } from '../lib/supabase-auth';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const configured = useMemo(() => isSupabaseConfigured(getAppConfig()), []);

  useEffect(() => {
    let cancelled = false;

    void supabaseAuth.getSession().then(({ data: { session: next } }) => {
      if (!cancelled) {
        setSession(next);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabaseAuth.onAuthStateChange((_event, next) => {
      setSession(next);
      void syncPurchasesWithAuthUser(next?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void syncPurchasesWithAuthUser(session?.user?.id ?? null);
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isSupabaseConfigured: configured,
      signInWithPassword: async (email, password) => {
        const { error } = await supabaseAuth.signInWithPassword({ email, password });
        return { error: error ? new Error(error.message) : null };
      },
      signOut: async () => {
        await supabaseAuth.signOut();
        await clearCachedEntitlement();
        await syncPurchasesWithAuthUser(null);
      },
    }),
    [session, isLoading, configured],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { getAuthRedirectTo } from './authRedirect';
import {
  getUserDisplayName,
  type AppAuthRole,
  type AuthState,
} from './authTypes';
import { syncLeagueMemberForUser } from './syncLeagueMember';
import { maybeNotifyTelegramVisit } from './notifyTelegramVisit';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  /** Role after league_members sync; null while anonymous or sync pending. */
  const [role, setRole] = useState<AppAuthRole>(null);
  const syncingUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error && import.meta.env.DEV) {
        console.warn('[RunItBack] auth getSession failed:', error.message);
      }
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsLoading(false);
      if (!next?.user) {
        setRole(null);
        syncingUserIdRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = session?.user ?? null;
    if (!supabase || !user) {
      if (!user) setRole(null);
      return;
    }

    let cancelled = false;
    const userId = user.id;
    syncingUserIdRef.current = userId;

    // Role comes only from league_members (server allowlist). No client email list.
    setRole(null);

    syncLeagueMemberForUser(supabase, user)
      .then((syncedRole) => {
        if (cancelled || syncingUserIdRef.current !== userId) return;
        setRole(syncedRole);
        if (import.meta.env.DEV) {
          console.info('[RunItBack] league_members synced', {
            role: syncedRole,
          });
        }
        void maybeNotifyTelegramVisit(user, {
          isAdmin: syncedRole === 'admin',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(
          '[RunItBack] league_members sync failed; treating as non-admin until retry:',
          err instanceof Error ? err.message : err
        );
        setRole('user');
        void maybeNotifyTelegramVisit(user, { isAdmin: false });
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectTo(),
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRole(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const user: User | null = session?.user ?? null;
    const isAuthenticated = Boolean(user);
    return {
      isLoading,
      session,
      user,
      role,
      isAuthenticated,
      isAdmin: role === 'admin',
      signInWithGoogle,
      signOut,
    };
  }, [isLoading, session, role, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export { getUserDisplayName };

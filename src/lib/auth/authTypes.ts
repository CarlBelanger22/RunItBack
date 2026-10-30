import type { Session, User } from '@supabase/supabase-js';

export type AppAuthRole = 'admin' | 'user' | null;

export interface AuthState {
  /** True until the first getSession() resolves. */
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  /**
   * From `league_members` after sync. Null while anonymous or sync pending.
   * Never derived from a client email allowlist (emails must not ship in JS).
   */
  role: AppAuthRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function getUserDisplayName(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    '';
  return fromMeta.trim() || user.email || '';
}

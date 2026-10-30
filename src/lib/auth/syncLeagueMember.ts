import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AppAuthRole } from './authTypes';

/** Matches `DEFAULT_LEAGUE_ID` in supabaseData (keep in sync). */
const LEAGUE_ID = 'league-default';

export type DbLeagueMemberRole = 'admin' | 'member';

export function appRoleFromDbRole(
  dbRole: string | null | undefined
): AppAuthRole {
  if (dbRole === 'admin') return 'admin';
  if (dbRole === 'member') return 'user';
  return null;
}

/**
 * Upsert the signed-in user into league_members.
 * Client always requests `member`; migration 008’s
 * `league_members_enforce_role` trigger overwrites role from
 * server-side `admin_email_allowlist` (client cannot self-promote).
 */
export async function syncLeagueMemberForUser(
  client: SupabaseClient,
  user: User,
  leagueId: string = LEAGUE_ID
): Promise<AppAuthRole> {
  const email = user.email ?? null;

  const { data, error } = await client
    .from('league_members')
    .upsert(
      {
        league_id: leagueId,
        user_id: user.id,
        email,
        role: 'member' satisfies DbLeagueMemberRole,
      },
      { onConflict: 'league_id,user_id' }
    )
    .select('role')
    .maybeSingle();

  if (error) {
    throw new Error(`league_members sync: ${error.message}`);
  }

  return appRoleFromDbRole(data?.role) ?? 'user';
}

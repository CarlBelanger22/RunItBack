/**
 * Client-side Admin emails (UX / pre-sync role).
 * Source of truth after migration 008 is `public.admin_email_allowlist`
 * (DB trigger forces `league_members.role`). Keep both in sync when adding Admins.
 */
export const ADMIN_EMAIL_ALLOWLIST: readonly string[] = [
  'carl.yiwei.belanger@gmail.com',
];

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;
  return ADMIN_EMAIL_ALLOWLIST.some((allowed) => allowed === normalized);
}

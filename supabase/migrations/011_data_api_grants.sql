-- 011: Explicit Data API table grants (Supabase post–30 Oct 2026).
--
-- Context: New public tables no longer receive automatic PostgREST grants.
-- Existing projects keep prior grants on already-created tables; this migration
-- makes grants explicit for reset/preview/future creates and documents intent.
--
-- Convention for future CREATE TABLE in public:
--   - Client-facing (public SELECT + admin writes via RLS):
--       GRANT SELECT ON … TO anon;
--       GRANT SELECT, INSERT, UPDATE, DELETE ON … TO authenticated, service_role;
--   - Service-only (no client policies):
--       REVOKE ALL ON … FROM anon, authenticated;
--       GRANT ALL ON … TO service_role;
-- Default privileges below match the client-facing pattern; service-only tables
-- must revoke anon/authenticated in the same migration that creates them.

-- ---------------------------------------------------------------------------
-- Client-facing tables (RLS still gates writes to league Admin)
-- ---------------------------------------------------------------------------
grant select on table
  public.leagues,
  public.teams,
  public.players,
  public.tournaments,
  public.tournament_teams,
  public.games,
  public.app_preferences,
  public.team_players,
  public.tournament_rosters
to anon;

grant select, insert, update, delete on table
  public.leagues,
  public.teams,
  public.players,
  public.tournaments,
  public.tournament_teams,
  public.games,
  public.app_preferences,
  public.team_players,
  public.tournament_rosters
to authenticated, service_role;

-- league_members: authenticated sync only (policies require auth.uid())
grant select, insert, update, delete on table
  public.league_members
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Service-role only (no client Data API access)
-- ---------------------------------------------------------------------------
revoke all on table public.admin_email_allowlist from anon, authenticated;
grant all on table public.admin_email_allowlist to service_role;

revoke all on table public.telegram_notify_dedupe from anon, authenticated;
grant all on table public.telegram_notify_dedupe to service_role;

-- ---------------------------------------------------------------------------
-- Future tables created by migration roles
-- ---------------------------------------------------------------------------
-- Migrations typically run as postgres (hosted) or the connecting role.
alter default privileges for role postgres in schema public
  grant select on tables to anon;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- Also cover objects created by the role running this migration (local/CI).
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

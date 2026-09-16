-- 008: Replace open `dev_all_*` RLS with public SELECT + Admin-only writes.
-- Role source: league_members.role, forced from admin_email_allowlist on upsert
-- (client cannot self-promote to admin).
--
-- Pragmatic v1 (Designer lock):
--   SELECT: anon + authenticated (UI still gates sensitive tabs)
--   INSERT/UPDATE/DELETE: league Admin only
--   Storage team-assets writes: Admin only; public read unchanged

-- ---------------------------------------------------------------------------
-- Admin email allowlist (server-side; no client policies)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_email_allowlist (
  email text primary key
);

alter table public.admin_email_allowlist enable row level security;

-- Seed current Admin (idempotent). Add more emails here later via SQL Editor.
insert into public.admin_email_allowlist (email)
values ('carl.yiwei.belanger@gmail.com')
on conflict (email) do nothing;

-- No SELECT/INSERT/UPDATE/DELETE policies → PostgREST cannot touch this table.
-- SECURITY DEFINER functions below can still read it.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_league_admin(
  p_league_id text default 'league-default'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

revoke all on function public.is_league_admin(text) from public;
grant execute on function public.is_league_admin(text) to anon, authenticated;

create or replace function public.league_members_enforce_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_email text;
begin
  -- When called from a signed-in client, bind row to that user + JWT email.
  if auth.uid() is not null then
    new.user_id := auth.uid();
    jwt_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
    if jwt_email is not null then
      new.email := jwt_email;
    end if;
  end if;

  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;

  if new.email is not null
     and exists (
       select 1
       from public.admin_email_allowlist a
       where a.email = new.email
     )
  then
    new.role := 'admin';
  else
    new.role := 'member';
  end if;

  return new;
end;
$$;

drop trigger if exists league_members_enforce_role on public.league_members;
create trigger league_members_enforce_role
  before insert or update on public.league_members
  for each row execute function public.league_members_enforce_role();

-- Re-apply allowlist to existing rows (e.g. Carl already synced as admin).
update public.league_members m
set role = case
  when m.email is not null
       and exists (
         select 1 from public.admin_email_allowlist a
         where a.email = lower(trim(m.email))
       )
  then 'admin'
  else 'member'
end;

-- ---------------------------------------------------------------------------
-- league_members: own-row sync for signed-in users; Admin can read all
-- ---------------------------------------------------------------------------
drop policy if exists "dev_all_league_members" on public.league_members;

drop policy if exists "league_members_select_own_or_admin" on public.league_members;
create policy "league_members_select_own_or_admin"
  on public.league_members for select
  using (
    auth.uid() = user_id
    or public.is_league_admin(league_id)
  );

drop policy if exists "league_members_insert_own" on public.league_members;
create policy "league_members_insert_own"
  on public.league_members for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "league_members_update_own" on public.league_members;
create policy "league_members_update_own"
  on public.league_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "league_members_delete_admin" on public.league_members;
create policy "league_members_delete_admin"
  on public.league_members for delete
  to authenticated
  using (public.is_league_admin(league_id));

-- ---------------------------------------------------------------------------
-- Data tables: public read, Admin write
-- ---------------------------------------------------------------------------
-- leagues
drop policy if exists "dev_all_leagues" on public.leagues;
drop policy if exists "leagues_select_all" on public.leagues;
drop policy if exists "leagues_insert_admin" on public.leagues;
drop policy if exists "leagues_update_admin" on public.leagues;
drop policy if exists "leagues_delete_admin" on public.leagues;
create policy "leagues_select_all" on public.leagues for select using (true);
-- Insert uses default-league admin check (row id may be brand-new).
create policy "leagues_insert_admin" on public.leagues for insert with check (public.is_league_admin());
create policy "leagues_update_admin" on public.leagues for update using (public.is_league_admin(id)) with check (public.is_league_admin(id));
create policy "leagues_delete_admin" on public.leagues for delete using (public.is_league_admin(id));

-- teams
drop policy if exists "dev_all_teams" on public.teams;
drop policy if exists "teams_select_all" on public.teams;
drop policy if exists "teams_insert_admin" on public.teams;
drop policy if exists "teams_update_admin" on public.teams;
drop policy if exists "teams_delete_admin" on public.teams;
create policy "teams_select_all" on public.teams for select using (true);
create policy "teams_insert_admin" on public.teams for insert with check (public.is_league_admin(league_id));
create policy "teams_update_admin" on public.teams for update using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy "teams_delete_admin" on public.teams for delete using (public.is_league_admin(league_id));

-- players
drop policy if exists "dev_all_players" on public.players;
drop policy if exists "players_select_all" on public.players;
drop policy if exists "players_insert_admin" on public.players;
drop policy if exists "players_update_admin" on public.players;
drop policy if exists "players_delete_admin" on public.players;
create policy "players_select_all" on public.players for select using (true);
create policy "players_insert_admin" on public.players for insert with check (public.is_league_admin(league_id));
create policy "players_update_admin" on public.players for update using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy "players_delete_admin" on public.players for delete using (public.is_league_admin(league_id));

-- tournaments
drop policy if exists "dev_all_tournaments" on public.tournaments;
drop policy if exists "tournaments_select_all" on public.tournaments;
drop policy if exists "tournaments_insert_admin" on public.tournaments;
drop policy if exists "tournaments_update_admin" on public.tournaments;
drop policy if exists "tournaments_delete_admin" on public.tournaments;
create policy "tournaments_select_all" on public.tournaments for select using (true);
create policy "tournaments_insert_admin" on public.tournaments for insert with check (public.is_league_admin(league_id));
create policy "tournaments_update_admin" on public.tournaments for update using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy "tournaments_delete_admin" on public.tournaments for delete using (public.is_league_admin(league_id));

-- tournament_teams (no league_id — gate via default league admin)
drop policy if exists "dev_all_tournament_teams" on public.tournament_teams;
drop policy if exists "tournament_teams_select_all" on public.tournament_teams;
drop policy if exists "tournament_teams_insert_admin" on public.tournament_teams;
drop policy if exists "tournament_teams_update_admin" on public.tournament_teams;
drop policy if exists "tournament_teams_delete_admin" on public.tournament_teams;
create policy "tournament_teams_select_all" on public.tournament_teams for select using (true);
create policy "tournament_teams_insert_admin" on public.tournament_teams for insert with check (public.is_league_admin());
create policy "tournament_teams_update_admin" on public.tournament_teams for update using (public.is_league_admin()) with check (public.is_league_admin());
create policy "tournament_teams_delete_admin" on public.tournament_teams for delete using (public.is_league_admin());

-- games
drop policy if exists "dev_all_games" on public.games;
drop policy if exists "games_select_all" on public.games;
drop policy if exists "games_insert_admin" on public.games;
drop policy if exists "games_update_admin" on public.games;
drop policy if exists "games_delete_admin" on public.games;
create policy "games_select_all" on public.games for select using (true);
create policy "games_insert_admin" on public.games for insert with check (public.is_league_admin(league_id));
create policy "games_update_admin" on public.games for update using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy "games_delete_admin" on public.games for delete using (public.is_league_admin(league_id));

-- app_preferences (PK = league_id)
drop policy if exists "dev_all_app_preferences" on public.app_preferences;
drop policy if exists "app_preferences_select_all" on public.app_preferences;
drop policy if exists "app_preferences_insert_admin" on public.app_preferences;
drop policy if exists "app_preferences_update_admin" on public.app_preferences;
drop policy if exists "app_preferences_delete_admin" on public.app_preferences;
create policy "app_preferences_select_all" on public.app_preferences for select using (true);
create policy "app_preferences_insert_admin" on public.app_preferences for insert with check (public.is_league_admin(league_id));
create policy "app_preferences_update_admin" on public.app_preferences for update using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy "app_preferences_delete_admin" on public.app_preferences for delete using (public.is_league_admin(league_id));

-- team_players
drop policy if exists "dev_all_team_players" on public.team_players;
drop policy if exists "team_players_select_all" on public.team_players;
drop policy if exists "team_players_insert_admin" on public.team_players;
drop policy if exists "team_players_update_admin" on public.team_players;
drop policy if exists "team_players_delete_admin" on public.team_players;
create policy "team_players_select_all" on public.team_players for select using (true);
create policy "team_players_insert_admin" on public.team_players for insert with check (public.is_league_admin());
create policy "team_players_update_admin" on public.team_players for update using (public.is_league_admin()) with check (public.is_league_admin());
create policy "team_players_delete_admin" on public.team_players for delete using (public.is_league_admin());

-- tournament_rosters
drop policy if exists "dev_all_tournament_rosters" on public.tournament_rosters;
drop policy if exists "tournament_rosters_select_all" on public.tournament_rosters;
drop policy if exists "tournament_rosters_insert_admin" on public.tournament_rosters;
drop policy if exists "tournament_rosters_update_admin" on public.tournament_rosters;
drop policy if exists "tournament_rosters_delete_admin" on public.tournament_rosters;
create policy "tournament_rosters_select_all" on public.tournament_rosters for select using (true);
create policy "tournament_rosters_insert_admin" on public.tournament_rosters for insert with check (public.is_league_admin());
create policy "tournament_rosters_update_admin" on public.tournament_rosters for update using (public.is_league_admin()) with check (public.is_league_admin());
create policy "tournament_rosters_delete_admin" on public.tournament_rosters for delete using (public.is_league_admin());

-- ---------------------------------------------------------------------------
-- Storage: team-assets — public read, Admin write
-- ---------------------------------------------------------------------------
drop policy if exists "team_assets_dev_insert" on storage.objects;
drop policy if exists "team_assets_dev_update" on storage.objects;
drop policy if exists "team_assets_dev_delete" on storage.objects;
drop policy if exists "team_assets_admin_insert" on storage.objects;
drop policy if exists "team_assets_admin_update" on storage.objects;
drop policy if exists "team_assets_admin_delete" on storage.objects;

create policy "team_assets_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'team-assets' and public.is_league_admin());

create policy "team_assets_admin_update"
  on storage.objects for update
  using (bucket_id = 'team-assets' and public.is_league_admin())
  with check (bucket_id = 'team-assets' and public.is_league_admin());

create policy "team_assets_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'team-assets' and public.is_league_admin());

-- Keep public read policy from 006 (recreate if missing)
drop policy if exists "team_assets_public_read" on storage.objects;
create policy "team_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'team-assets');

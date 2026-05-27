-- RunItBack — initial schema (paste into Supabase → SQL → New query → Run)
-- Matches types in src/App.tsx. Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists "pgcrypto";

create table if not exists public.leagues (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  league_id text not null references public.leagues (id) on delete cascade,
  name text not null,
  abbreviation text not null,
  icon text,
  description text,
  current_tournament_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id text primary key,
  team_id text not null references public.teams (id) on delete cascade,
  name text not null,
  number integer not null check (number >= 0 and number <= 99),
  position text not null,
  secondary_position text,
  picture text,
  height text not null default '',
  weight text not null default '',
  age integer not null default 0,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on public.players (team_id);

create table if not exists public.tournaments (
  id text primary key,
  league_id text not null references public.leagues (id) on delete cascade,
  name text not null,
  icon text,
  description text,
  year integer not null,
  month text not null,
  standings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_teams (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  primary key (tournament_id, team_id)
);

create table if not exists public.games (
  id text primary key,
  league_id text not null references public.leagues (id) on delete cascade,
  tournament_id text references public.tournaments (id) on delete set null,
  home_team_id text not null references public.teams (id),
  away_team_id text not null references public.teams (id),
  date date not null,
  current_period integer not null default 1,
  current_game_time text not null default '12:00',
  track_both_teams boolean not null default true,
  is_active boolean not null default false,
  is_completed boolean not null default false,
  final_score_home integer,
  final_score_away integer,
  home_starters jsonb not null default '[]'::jsonb,
  away_starters jsonb not null default '[]'::jsonb,
  game_stats jsonb not null default '[]'::jsonb,
  team_stats jsonb not null default '{}'::jsonb,
  shots jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  lineup_stints jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_league_id_idx on public.games (league_id);
create index if not exists games_tournament_id_idx on public.games (tournament_id);

create table if not exists public.app_preferences (
  league_id text primary key references public.leagues (id) on delete cascade,
  dark_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.games enable row level security;
alter table public.app_preferences enable row level security;
alter table public.league_members enable row level security;

drop policy if exists "dev_all_leagues" on public.leagues;
create policy "dev_all_leagues" on public.leagues for all using (true) with check (true);
drop policy if exists "dev_all_teams" on public.teams;
create policy "dev_all_teams" on public.teams for all using (true) with check (true);
drop policy if exists "dev_all_players" on public.players;
create policy "dev_all_players" on public.players for all using (true) with check (true);
drop policy if exists "dev_all_tournaments" on public.tournaments;
create policy "dev_all_tournaments" on public.tournaments for all using (true) with check (true);
drop policy if exists "dev_all_tournament_teams" on public.tournament_teams;
create policy "dev_all_tournament_teams" on public.tournament_teams for all using (true) with check (true);
drop policy if exists "dev_all_games" on public.games;
create policy "dev_all_games" on public.games for all using (true) with check (true);
drop policy if exists "dev_all_app_preferences" on public.app_preferences;
create policy "dev_all_app_preferences" on public.app_preferences for all using (true) with check (true);
drop policy if exists "dev_all_league_members" on public.league_members;
create policy "dev_all_league_members" on public.league_members for all using (true) with check (true);

insert into public.leagues (id, name)
values ('league-default', 'My League')
on conflict (id) do nothing;

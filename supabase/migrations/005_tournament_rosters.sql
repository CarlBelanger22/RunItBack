-- R0: Tournament-scoped rosters (player membership per team per tournament season)
-- Run after 004_allow_duplicate_jersey_numbers.sql

create table if not exists public.tournament_rosters (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  number integer not null check (number >= 0 and number <= 99),
  position text not null default '',
  secondary_position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, team_id, player_id),
  unique (tournament_id, player_id)
);

create index if not exists tournament_rosters_team_idx
  on public.tournament_rosters (tournament_id, team_id);

create index if not exists tournament_rosters_player_idx
  on public.tournament_rosters (player_id);

alter table public.tournament_rosters enable row level security;

drop policy if exists "dev_all_tournament_rosters" on public.tournament_rosters;
create policy "dev_all_tournament_rosters" on public.tournament_rosters
  for all using (true) with check (true);

drop trigger if exists tournament_rosters_set_updated_at on public.tournament_rosters;
create trigger tournament_rosters_set_updated_at
  before update on public.tournament_rosters
  for each row execute function public.set_updated_at();

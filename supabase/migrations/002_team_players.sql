-- C10: Global players + multi-team rosters (team_players junction)
-- Run after 001_initial_schema.sql
-- Safe to re-run if a previous attempt failed mid-way.

-- 1) League-scoped player identity
alter table public.players
  add column if not exists league_id text references public.leagues (id);

update public.players p
set league_id = t.league_id
from public.teams t
where p.team_id = t.id
  and p.league_id is null;

update public.players
set league_id = 'league-default'
where league_id is null;

-- 2) Roster links (jersey + position per team)
create table if not exists public.team_players (
  team_id text not null references public.teams (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  number integer not null check (number >= 0 and number <= 99),
  position text not null,
  secondary_position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

create index if not exists team_players_player_id_idx
  on public.team_players (player_id);

-- Unique jersey per team is added AFTER backfill + duplicate cleanup (see step 3b).

-- 3a) Backfill from legacy players.team_id rows (skip if team_id already dropped)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'team_id'
  ) then
    insert into public.team_players (team_id, player_id, number, position, secondary_position)
    select team_id, id, number, position, secondary_position
    from public.players
    where team_id is not null
    on conflict (team_id, player_id) do update
      set number = excluded.number,
          position = excluded.position,
          secondary_position = excluded.secondary_position;
  end if;
end $$;

-- 3b) Legacy data may have duplicate jersey numbers on one team; pick next free #.
do $$
declare
  r record;
  keep_id text;
  pid text;
  next_num int;
begin
  loop
    select team_id, number into r
    from public.team_players
    group by team_id, number
    having count(*) > 1
    limit 1;

    exit when not found;

    select player_id into keep_id
    from public.team_players
    where team_id = r.team_id and number = r.number
    order by player_id
    limit 1;

    for pid in
      select player_id
      from public.team_players
      where team_id = r.team_id
        and number = r.number
        and player_id <> keep_id
      order by player_id
    loop
      select n into next_num
      from generate_series(0, 99) as n
      where not exists (
        select 1
        from public.team_players tp
        where tp.team_id = r.team_id and tp.number = n
      )
      order by n
      limit 1;

      if next_num is null then
        raise exception 'No free jersey number on team %', r.team_id;
      end if;

      update public.team_players
      set number = next_num
      where team_id = r.team_id and player_id = pid;
    end loop;
  end loop;
end $$;

drop index if exists public.team_players_team_number_uidx;
create unique index team_players_team_number_uidx
  on public.team_players (team_id, number);

-- 4) Drop roster columns from players (profile-only)
drop index if exists public.players_team_id_idx;

alter table public.players drop constraint if exists players_team_id_fkey;
alter table public.players drop column if exists team_id;
alter table public.players drop column if exists number;
alter table public.players drop column if exists position;
alter table public.players drop column if exists secondary_position;

alter table public.players alter column league_id set not null;

-- 5) RLS + updated_at trigger
alter table public.team_players enable row level security;

drop policy if exists "dev_all_team_players" on public.team_players;
create policy "dev_all_team_players" on public.team_players
  for all using (true) with check (true);

drop trigger if exists team_players_set_updated_at on public.team_players;
create trigger team_players_set_updated_at
  before update on public.team_players
  for each row execute function public.set_updated_at();

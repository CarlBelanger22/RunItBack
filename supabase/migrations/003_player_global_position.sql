-- C11: Global player position (jersey # stays per team on team_players)
-- Run after 002_team_players.sql
-- Safe to re-run.

alter table public.players
  add column if not exists position text;

alter table public.players
  add column if not exists secondary_position text;

-- Backfill from team_players (one row per player, deterministic by team_id)
update public.players p
set
  position = coalesce(nullif(p.position, ''), src.position),
  secondary_position = coalesce(p.secondary_position, src.secondary_position)
from (
  select distinct on (player_id)
    player_id,
    position,
    secondary_position
  from public.team_players
  where position is not null
  order by player_id, team_id
) src
where p.id = src.player_id;

update public.players
set position = 'PG'
where position is null or trim(position) = '';

alter table public.players alter column position set not null;

alter table public.team_players drop column if exists position;
alter table public.team_players drop column if exists secondary_position;

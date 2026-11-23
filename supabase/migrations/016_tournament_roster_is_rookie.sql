-- Manual ROTY tags when series history is incomplete (rookie_mode = manual).
-- Admin checks players on Awards → Mark rookies; stored per tournament roster row.

alter table public.tournament_rosters
  add column if not exists is_rookie boolean not null default false;

comment on column public.tournament_rosters.is_rookie is
  'When tournament.rookie_mode is manual, true = eligible for Rookie of the Year.';

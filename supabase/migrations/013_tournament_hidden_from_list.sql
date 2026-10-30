-- Admin can hide tournaments from browse lists (Tournaments page / Dashboard).
-- Rows remain selectable so deep links (player badges, games) still work.

alter table public.tournaments
  add column if not exists hidden_from_list boolean not null default false;

comment on column public.tournaments.hidden_from_list is
  'When true, omit from non-admin tournament browse lists; tournament still reachable by id.';

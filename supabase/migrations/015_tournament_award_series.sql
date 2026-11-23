-- Award series linking for ROTY / MIP across progressive seasons.
-- Standalone tournaments leave both columns null (no ROTY/MIP).

alter table public.tournaments
  add column if not exists award_series_id text null;

alter table public.tournaments
  add column if not exists rookie_mode text null;

comment on column public.tournaments.award_series_id is
  'Shared id for progressive seasons of one league variant (e.g. NBL Div 1). Null = standalone.';

comment on column public.tournaments.rookie_mode is
  'ROTY eligibility: off | manual | auto. Null when standalone / unset.';

alter table public.tournaments
  drop constraint if exists tournaments_rookie_mode_check;

alter table public.tournaments
  add constraint tournaments_rookie_mode_check
  check (
    rookie_mode is null
    or rookie_mode in ('off', 'manual', 'auto')
  );

create index if not exists tournaments_award_series_id_idx
  on public.tournaments (award_series_id)
  where award_series_id is not null;

-- LE-95: opt-in multi-stage tournament structure (groups / classification).
alter table public.tournaments
  add column if not exists structure jsonb;

comment on column public.tournaments.structure is
  'Optional tournament stages/groups/brackets JSON (LE-95). Null/empty = unstructured.';

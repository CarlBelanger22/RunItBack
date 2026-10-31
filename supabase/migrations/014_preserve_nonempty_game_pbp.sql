-- Refuse silent PBP wipes: if a row already has events/shots, an UPDATE that
-- sends [] must not destroy them (ITE–NYP 2026-10-31 failure mode).
-- Intentional clears require a future explicit repair path (not used by the app).

create or replace function public.games_preserve_nonempty_pbp()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if jsonb_typeof(coalesce(old.events, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(old.events, '[]'::jsonb)) > 0
       and jsonb_array_length(coalesce(new.events, '[]'::jsonb)) = 0 then
      new.events := old.events;
    end if;

    if jsonb_typeof(coalesce(old.shots, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(old.shots, '[]'::jsonb)) > 0
       and jsonb_array_length(coalesce(new.shots, '[]'::jsonb)) = 0 then
      new.shots := old.shots;
    end if;

    if jsonb_typeof(coalesce(old.lineup_stints, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(old.lineup_stints, '[]'::jsonb)) > 0
       and jsonb_array_length(coalesce(new.lineup_stints, '[]'::jsonb)) = 0 then
      new.lineup_stints := old.lineup_stints;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists games_preserve_nonempty_pbp on public.games;

create trigger games_preserve_nonempty_pbp
  before update on public.games
  for each row
  execute function public.games_preserve_nonempty_pbp();

comment on function public.games_preserve_nonempty_pbp() is
  'Keep non-empty games.events/shots/lineup_stints when an UPDATE would replace them with [].';

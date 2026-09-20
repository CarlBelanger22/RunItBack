-- Telegram notify dedupe: at most one signup ever per user; one app_open per SGT day.
create table if not exists public.telegram_notify_dedupe (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('signup', 'app_open')),
  -- signup uses fixed sentinel date so PK enforces one row forever
  day_sgt date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_type, day_sgt)
);

create index if not exists telegram_notify_dedupe_user_idx
  on public.telegram_notify_dedupe (user_id);

alter table public.telegram_notify_dedupe enable row level security;

-- No client policies: only service role (Edge Function) reads/writes.
drop policy if exists "telegram_notify_dedupe_no_client" on public.telegram_notify_dedupe;

comment on table public.telegram_notify_dedupe is
  'Dedupe log for Telegram auth/visit pings; written only by notify-telegram Edge Function.';

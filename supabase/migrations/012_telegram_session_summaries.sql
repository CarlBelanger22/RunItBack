-- Session browse summaries for Telegram (first-party usage telemetry).
-- Written/updated by notify-telegram Edge Function (service role only).

create table if not exists public.telegram_session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_session_id text not null,
  summary_text text not null,
  session_started_at timestamptz,
  active_duration_ms integer,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique (user_id, client_session_id)
);

create index if not exists telegram_session_summaries_pending_idx
  on public.telegram_session_summaries (status, created_at)
  where status = 'pending';

create index if not exists telegram_session_summaries_user_idx
  on public.telegram_session_summaries (user_id, created_at desc);

alter table public.telegram_session_summaries enable row level security;

drop policy if exists "telegram_session_summaries_no_client"
  on public.telegram_session_summaries;

revoke all on table public.telegram_session_summaries from anon, authenticated;
grant all on table public.telegram_session_summaries to service_role;

comment on table public.telegram_session_summaries is
  'End-of-session browse summaries for admin Telegram; service role only.';

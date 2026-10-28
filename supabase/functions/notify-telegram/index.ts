/**
 * Telegram notify for RunItBack auth/visit + session browse summaries.
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID          (group chat id, usually negative)
 *   ADMIN_NOTIFY_SKIP_EMAILS  (comma-separated, lowercase ok)
 *
 * Body:
 *   { eventType: "signup" | "app_open" }
 *   { eventType: "session_summary", clientSessionId, summaryText,
 *     sessionStartedAt?, activeDurationMs? }
 *   { eventType: "session_summary_retry" }
 *
 * Auth: caller JWT (verify_jwt). Fail-open: always 200 with { ok/skipped/error }.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SIGNUP_DAY_SENTINEL = '1970-01-01';
const PENDING_RETRY_LIMIT = 10;

type EventType =
  | 'signup'
  | 'app_open'
  | 'session_summary'
  | 'session_summary_retry';

interface Body {
  eventType?: string;
  clientSessionId?: string;
  summaryText?: string;
  sessionStartedAt?: string;
  activeDurationMs?: number;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sgtDateString(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

/** e.g. "28 Oct 2026, 3:40 PM SGT" */
function sgtTimestampLabel(d = new Date()): string {
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Singapore',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}, ${time} SGT`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseSkipEmails(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  for (const part of (raw ?? '').split(',')) {
    const e = part.trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    '';
  return fromMeta.trim() || user.email || 'Unknown';
}

function isRecentSignup(createdAt: string | undefined, maxAgeMs: number): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= maxAgeMs;
}

async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  parseMode?: 'HTML'
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) payload.parse_mode = parseMode;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
}

async function flushPendingSummaries(
  admin: SupabaseClient,
  botToken: string,
  chatId: string,
  userId: string
): Promise<number> {
  const { data: rows, error } = await admin
    .from('telegram_session_summaries')
    .select('id, summary_text')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(PENDING_RETRY_LIMIT);
  if (error) {
    console.error('[notify-telegram] pending select', error);
    return 0;
  }
  let sent = 0;
  for (const row of rows ?? []) {
    try {
      // Summaries include <b> titles; always HTML
      await sendTelegram(
        botToken,
        chatId,
        row.summary_text as string,
        'HTML'
      );
      await admin
        .from('telegram_session_summaries')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send_failed';
      await admin
        .from('telegram_session_summaries')
        .update({ status: 'pending', last_error: msg })
        .eq('id', row.id);
      console.error('[notify-telegram] pending send', msg);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return json(200, { ok: false, error: 'method_not_allowed' });
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')?.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();

    if (!botToken || !chatId || !supabaseUrl || !serviceKey || !anonKey) {
      console.error('[notify-telegram] missing env');
      return json(200, { ok: false, error: 'misconfigured' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(200, { ok: false, error: 'no_auth' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json(200, { ok: false, error: 'invalid_user' });
    }

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const eventType = body.eventType as EventType;
    const allowed: EventType[] = [
      'signup',
      'app_open',
      'session_summary',
      'session_summary_retry',
    ];
    if (!allowed.includes(eventType)) {
      return json(200, { ok: false, error: 'bad_event' });
    }

    const email = (user.email ?? '').trim().toLowerCase();
    const skip = parseSkipEmails(Deno.env.get('ADMIN_NOTIFY_SKIP_EMAILS'));
    if (email && skip.has(email)) {
      return json(200, { ok: true, skipped: true, reason: 'admin' });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Session summary / retry ---
    if (
      eventType === 'session_summary' ||
      eventType === 'session_summary_retry'
    ) {
      if (eventType === 'session_summary') {
        const clientSessionId = (body.clientSessionId ?? '').trim();
        const summaryText = (body.summaryText ?? '').trim();
        if (!clientSessionId || !summaryText) {
          return json(200, { ok: false, error: 'missing_summary_fields' });
        }

        const { data: existing } = await admin
          .from('telegram_session_summaries')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('client_session_id', clientSessionId)
          .maybeSingle();

        if (existing?.status === 'sent') {
          const retried = await flushPendingSummaries(
            admin,
            botToken,
            chatId,
            user.id
          );
          return json(200, {
            ok: true,
            skipped: true,
            reason: 'already_sent',
            retried,
          });
        }

        if (!existing) {
          const { error: insErr } = await admin
            .from('telegram_session_summaries')
            .insert({
              user_id: user.id,
              client_session_id: clientSessionId,
              summary_text: summaryText,
              session_started_at: body.sessionStartedAt ?? null,
              active_duration_ms: body.activeDurationMs ?? null,
              status: 'pending',
            });
          if (insErr) {
            console.error('[notify-telegram] summary insert', insErr);
            return json(200, { ok: false, error: 'summary_insert_failed' });
          }
        } else {
          await admin
            .from('telegram_session_summaries')
            .update({ summary_text: summaryText, status: 'pending' })
            .eq('id', existing.id);
        }
      }

      const retried = await flushPendingSummaries(
        admin,
        botToken,
        chatId,
        user.id
      );
      return json(200, {
        ok: true,
        sent: retried > 0,
        retried,
        eventType,
      });
    }

    // --- Signup / app_open (unchanged behavior) ---
    if (eventType === 'signup') {
      const maxAgeMs = 30 * 60 * 1000;
      if (!isRecentSignup(user.created_at, maxAgeMs)) {
        return json(200, { ok: true, skipped: true, reason: 'not_recent_signup' });
      }
    }

    const daySgt =
      eventType === 'signup' ? SIGNUP_DAY_SENTINEL : sgtDateString();

    const { error: insertErr } = await admin.from('telegram_notify_dedupe').insert({
      user_id: user.id,
      event_type: eventType,
      day_sgt: daySgt,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return json(200, { ok: true, skipped: true, reason: 'deduped' });
      }
      console.error('[notify-telegram] dedupe insert', insertErr);
      return json(200, { ok: false, error: 'dedupe_failed' });
    }

    const name = displayNameFromUser(user);
    const title = eventType === 'signup' ? 'Sign Up' : 'Login';
    const text = [
      `<b>${title}</b>`,
      escapeHtml(name),
      escapeHtml(email || '(no email)'),
      escapeHtml(sgtTimestampLabel()),
    ].join('\n');

    await sendTelegram(botToken, chatId, text, 'HTML');

    // Opportunistic retry of any pending session summaries for this user
    const retried = await flushPendingSummaries(
      admin,
      botToken,
      chatId,
      user.id
    );

    return json(200, { ok: true, sent: true, eventType, retried });
  } catch (e) {
    console.error('[notify-telegram]', e);
    return json(200, {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
});

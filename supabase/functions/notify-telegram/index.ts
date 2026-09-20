/**
 * Telegram notify for RunItBack auth/visit events.
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID          (group chat id, usually negative)
 *   ADMIN_NOTIFY_SKIP_EMAILS  (comma-separated, lowercase ok)
 *
 * Body: { eventType: "signup" | "app_open" }
 * Auth: caller JWT (verify_jwt). Fail-open: always 200 with { ok/skipped/error }.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SIGNUP_DAY_SENTINEL = '1970-01-01';

type EventType = 'signup' | 'app_open';

interface Body {
  eventType?: string;
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

function sgtTimestampLabel(d = new Date()): string {
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
  text: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
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
    if (eventType !== 'signup' && eventType !== 'app_open') {
      return json(200, { ok: false, error: 'bad_event' });
    }

    const email = (user.email ?? '').trim().toLowerCase();
    const skip = parseSkipEmails(Deno.env.get('ADMIN_NOTIFY_SKIP_EMAILS'));
    if (email && skip.has(email)) {
      return json(200, { ok: true, skipped: true, reason: 'admin' });
    }

    // Signup only if account was created recently (avoids false signup on first deploy open).
    if (eventType === 'signup') {
      const maxAgeMs = 30 * 60 * 1000; // 30 minutes
      if (!isRecentSignup(user.created_at, maxAgeMs)) {
        return json(200, { ok: true, skipped: true, reason: 'not_recent_signup' });
      }
    }

    const daySgt =
      eventType === 'signup' ? SIGNUP_DAY_SENTINEL : sgtDateString();

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin.from('telegram_notify_dedupe').insert({
      user_id: user.id,
      event_type: eventType,
      day_sgt: daySgt,
    });

    if (insertErr) {
      // Unique violation → already notified
      if (insertErr.code === '23505') {
        return json(200, { ok: true, skipped: true, reason: 'deduped' });
      }
      console.error('[notify-telegram] dedupe insert', insertErr);
      return json(200, { ok: false, error: 'dedupe_failed' });
    }

    const name = displayNameFromUser(user);
    const label = eventType === 'signup' ? 'signup' : 'app open';
    const text = [
      `<b>${escapeHtml(name)}</b>`,
      escapeHtml(email || '(no email)'),
      escapeHtml(label),
      escapeHtml(sgtTimestampLabel()),
    ].join('\n');

    await sendTelegram(botToken, chatId, text);
    return json(200, { ok: true, sent: true, eventType });
  } catch (e) {
    console.error('[notify-telegram]', e);
    return json(200, {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
});

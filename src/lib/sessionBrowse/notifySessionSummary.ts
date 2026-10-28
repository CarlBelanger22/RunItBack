import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from '../auth/adminAllowlist';
import {
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from '../supabase';
import { getUserDisplayName } from '../auth/authTypes';
import { formatSessionSummaryText } from './formatSessionSummary';
import type { SessionFlush } from './sessionBrowseEngine';

function isProductionClient(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }
  return true;
}

export type SessionSummaryNotifyBody = {
  eventType: 'session_summary';
  clientSessionId: string;
  summaryText: string;
  sessionStartedAt: string;
  activeDurationMs: number;
};

export function buildSessionSummaryNotifyBody(
  user: User,
  flush: SessionFlush
): SessionSummaryNotifyBody {
  return {
    eventType: 'session_summary',
    clientSessionId: flush.clientSessionId,
    summaryText: formatSessionSummaryText({
      displayName: getUserDisplayName(user),
      email: user.email ?? '',
      startedAt: flush.startedAt,
      activeDurationMs: flush.activeDurationMs,
      blocks: flush.blocks,
    }),
    sessionStartedAt: flush.startedAt.toISOString(),
    activeDurationMs: flush.activeDurationMs,
  };
}

/** Request shape for unload keepalive fetch (testable). */
export function buildSessionSummaryKeepaliveRequest(
  accessToken: string,
  body: SessionSummaryNotifyBody,
  opts?: { supabaseUrl?: string | null; publishableKey?: string | null }
): { url: string; init: RequestInit } | null {
  const base = (opts?.supabaseUrl ?? supabaseUrl)?.replace(/\/$/, '');
  const key = opts?.publishableKey ?? supabasePublishableKey;
  if (!base || !key) return null;
  const url = `${base}/functions/v1/notify-telegram`;
  return {
    url,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: key,
      },
      body: JSON.stringify(body),
      keepalive: true,
    },
  };
}

/**
 * Send a completed browse session summary to Telegram (prod, non-admin).
 * Never throws. Use for idle / midnight while the tab is still alive.
 */
export async function notifySessionSummary(
  user: User,
  flush: SessionFlush
): Promise<void> {
  if (!supabase || !isProductionClient()) return;
  if (isAdminEmail(user.email)) return;

  try {
    await supabase.functions.invoke('notify-telegram', {
      body: buildSessionSummaryNotifyBody(user, flush),
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] session summary notify failed:', e);
    }
  }
}

/**
 * Fire-and-forget summary on tab/browser close.
 * Uses fetch keepalive so the browser can finish the POST after unload.
 * Must not await auth — pass a cached accessToken.
 */
export function notifySessionSummaryKeepalive(
  user: User,
  flush: SessionFlush,
  accessToken: string | null | undefined
): void {
  if (!isProductionClient()) return;
  if (isAdminEmail(user.email)) return;
  if (!accessToken) return;

  const body = buildSessionSummaryNotifyBody(user, flush);
  const req = buildSessionSummaryKeepaliveRequest(accessToken, body);
  if (!req) return;

  try {
    void fetch(req.url, req.init);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] session summary keepalive failed:', e);
    }
  }
}

/** Ask Edge Function to retry any pending summaries for this user. */
export async function retryPendingSessionSummaries(user: User): Promise<void> {
  if (!supabase || !isProductionClient()) return;
  if (isAdminEmail(user.email)) return;
  try {
    await supabase.functions.invoke('notify-telegram', {
      body: { eventType: 'session_summary_retry' },
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] session summary retry failed:', e);
    }
  }
}

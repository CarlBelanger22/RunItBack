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
import {
  listSessionSummaryDrafts,
  removeSessionSummaryDraft,
  saveSessionSummaryDraft,
  type DraftStoreOptions,
} from './sessionSummaryDraftStore';

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

/** Sync local draft so a dropped keepalive can still be sent on next open. */
export function persistNotifyBodyAsDraft(
  userId: string,
  body: SessionSummaryNotifyBody,
  opts?: DraftStoreOptions
): void {
  if (!userId || !body.clientSessionId) return;
  saveSessionSummaryDraft(
    userId,
    {
      clientSessionId: body.clientSessionId,
      summaryText: body.summaryText,
      sessionStartedAt: body.sessionStartedAt,
      activeDurationMs: body.activeDurationMs,
    },
    opts
  );
}

/**
 * Stash a live session snapshot as a local draft (no network).
 * Prod / non-admin only — same gates as notify.
 */
export function persistSessionFlushDraft(
  user: User,
  flush: SessionFlush,
  opts?: DraftStoreOptions
): void {
  if (!isProductionClient()) return;
  if (isAdminEmail(user.email)) return;
  const body = buildSessionSummaryNotifyBody(user, flush);
  persistNotifyBodyAsDraft(user.id, body, opts);
}

/**
 * Send a completed browse session summary to Telegram (prod, non-admin).
 * Never throws. Use for idle / midnight while the tab is still alive.
 * Clears any local draft for this session after a successful invoke.
 */
export async function notifySessionSummary(
  user: User,
  flush: SessionFlush
): Promise<void> {
  if (!supabase || !isProductionClient()) return;
  if (isAdminEmail(user.email)) return;

  const body = buildSessionSummaryNotifyBody(user, flush);
  try {
    const { error } = await supabase.functions.invoke('notify-telegram', {
      body,
    });
    if (!error) {
      removeSessionSummaryDraft(user.id, flush.clientSessionId);
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] session summary notify failed:', e);
    }
  }
}

/**
 * Fire-and-forget summary on tab/browser close.
 * Writes a sync local draft first, then fetch keepalive.
 * Must not await auth — pass a cached accessToken.
 */
export function notifySessionSummaryKeepalive(
  user: User,
  flush: SessionFlush,
  accessToken: string | null | undefined,
  opts?: { draftStorage?: Storage }
): void {
  if (!isProductionClient()) return;
  if (isAdminEmail(user.email)) return;

  const body = buildSessionSummaryNotifyBody(user, flush);
  // Sync write before network — survives full quit if pagehide ran
  persistNotifyBodyAsDraft(
    user.id,
    body,
    opts?.draftStorage ? { storage: opts.draftStorage } : undefined
  );

  if (!accessToken) return;
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

export type FlushLocalDraftsOptions = DraftStoreOptions & {
  /**
   * Test seam: return true to clear the draft.
   * When omitted, uses supabase.functions.invoke (prod only).
   */
  send?: (body: SessionSummaryNotifyBody) => Promise<boolean>;
};

/**
 * Send any local session-summary drafts left after a dropped keepalive / full quit.
 * Clears each draft when send succeeds (including Edge `already_sent`).
 * Returns how many drafts were cleared.
 */
export async function flushLocalSessionSummaryDrafts(
  user: User,
  opts?: FlushLocalDraftsOptions
): Promise<number> {
  if (isAdminEmail(user.email)) return 0;

  const send =
    opts?.send ??
    (async (body: SessionSummaryNotifyBody) => {
      if (!supabase || !isProductionClient()) return false;
      const { error } = await supabase.functions.invoke('notify-telegram', {
        body,
      });
      return !error;
    });

  // Allow tests with injected send without requiring prod hostname
  if (!opts?.send && (!supabase || !isProductionClient())) return 0;

  const drafts = listSessionSummaryDrafts(user.id, opts);
  let cleared = 0;
  for (const draft of drafts) {
    const body: SessionSummaryNotifyBody = {
      eventType: 'session_summary',
      clientSessionId: draft.clientSessionId,
      summaryText: draft.summaryText,
      sessionStartedAt: draft.sessionStartedAt,
      activeDurationMs: draft.activeDurationMs,
    };
    try {
      const ok = await send(body);
      if (ok) {
        removeSessionSummaryDraft(user.id, draft.clientSessionId, opts);
        cleared += 1;
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[RunItBack] local draft flush failed:', e);
      }
    }
  }
  return cleared;
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

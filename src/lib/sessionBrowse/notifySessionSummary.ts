import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from '../auth/adminAllowlist';
import { supabase } from '../supabase';
import { formatSessionSummaryText } from './formatSessionSummary';
import type { SessionFlush } from './sessionBrowseEngine';
import { getUserDisplayName } from '../auth/authTypes';

function isProductionClient(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }
  return true;
}

/**
 * Send a completed browse session summary to Telegram (prod, non-admin).
 * Never throws.
 */
export async function notifySessionSummary(
  user: User,
  flush: SessionFlush
): Promise<void> {
  if (!supabase || !isProductionClient()) return;
  if (isAdminEmail(user.email)) return;

  const summaryText = formatSessionSummaryText({
    displayName: getUserDisplayName(user),
    email: user.email ?? '',
    startedAt: flush.startedAt,
    activeDurationMs: flush.activeDurationMs,
    blocks: flush.blocks,
  });

  try {
    await supabase.functions.invoke('notify-telegram', {
      body: {
        eventType: 'session_summary',
        clientSessionId: flush.clientSessionId,
        summaryText,
        sessionStartedAt: flush.startedAt.toISOString(),
        activeDurationMs: flush.activeDurationMs,
      },
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] session summary notify failed:', e);
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

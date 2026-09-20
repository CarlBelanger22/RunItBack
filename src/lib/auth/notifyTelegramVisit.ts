import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from './adminAllowlist';
import { supabase } from '../supabase';

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
 * Fire-and-forget Telegram pings (prod only).
 * - signup: only if account created recently + never notified (server dedupe)
 * - app_open: once per user per SGT calendar day (server dedupe)
 * Never throws; never blocks auth UX.
 */
export async function maybeNotifyTelegramVisit(user: User): Promise<void> {
  if (!supabase || !isProductionClient()) return;
  if (isAdminEmail(user.email)) return;

  try {
    // Signup attempt first (Edge Function no-ops unless recent + not yet logged).
    await supabase.functions.invoke('notify-telegram', {
      body: { eventType: 'signup' },
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] telegram signup notify failed:', e);
    }
  }

  try {
    await supabase.functions.invoke('notify-telegram', {
      body: { eventType: 'app_open' },
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[RunItBack] telegram app_open notify failed:', e);
    }
  }
}

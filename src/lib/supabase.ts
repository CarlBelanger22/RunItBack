import { createClient, SupabaseClient } from '@supabase/supabase-js';

const nodeEnv =
  typeof process !== 'undefined' ? process.env : undefined;

const url =
  import.meta.env?.VITE_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL;
const publishableKey =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  nodeEnv?.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasUrl = Boolean(url?.trim());
const hasKey = Boolean(publishableKey?.trim());

if (!hasUrl || !hasKey) {
  console.warn(
    '[RunItBack] Supabase not configured in this build.',
    { hasUrl, hasKey },
    import.meta.env?.PROD
      ? 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel → Settings → Environment Variables, then Redeploy (env vars are baked in at build time).'
      : 'Add them to .env.local and restart npm run dev.'
  );
} else if (import.meta.env?.DEV) {
  console.info('[RunItBack] Supabase configured:', url);
}

/** null when env vars were missing at build time */
export const supabase: SupabaseClient | null =
  hasUrl && hasKey ? createClient(url!, publishableKey!) : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local'
    );
  }
  return supabase;
}

export const isSupabaseConfigured = Boolean(supabase);

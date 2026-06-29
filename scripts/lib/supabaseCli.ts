import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from '../loadEnvLocal';

export function requireSupabaseCliClient(): SupabaseClient {
  loadEnvLocalIntoProcess();

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local'
    );
  }

  return createClient(url, key);
}

export function requireDbUrl(): string {
  loadEnvLocalIntoProcess();
  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    '';
  if (!dbUrl) {
    throw new Error(
      'Missing SUPABASE_DB_URL in .env.local (Supabase → Settings → Database → URI)'
    );
  }
  return dbUrl;
}

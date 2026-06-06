/**
 * One-time: enroll Kai Xuan in NBL Div 2 2023 only.
 * Usage: npx tsx scripts/enroll-kx-nbl2023.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1780425044074';
const KX_TEAM_ID = 'team-1780252086140';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  }

  const supabase = createClient(url, key);

  const { data: existing, error: fetchError } = await supabase
    .from('tournament_teams')
    .select('team_id')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('team_id', KX_TEAM_ID)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (existing) {
    console.log('Kai Xuan already enrolled in NBL Div 2 2023 — no DB change.');
    return;
  }

  const { error: insertError } = await supabase
    .from('tournament_teams')
    .insert({ tournament_id: TOURNAMENT_ID, team_id: KX_TEAM_ID });

  if (insertError) throw new Error(insertError.message);
  console.log('Enrolled Kai Xuan (team-1780252086140) in NBL Div 2 2023.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

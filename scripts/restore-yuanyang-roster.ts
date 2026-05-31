/**
 * Restore Yuanyang Tan (player-sunig-ntu-12) to NTU roster at #12.
 * Requires migration 004 (duplicate jersey numbers allowed).
 *
 * Usage: npx tsx scripts/restore-yuanyang-roster.ts
 *        npx tsx scripts/restore-yuanyang-roster.ts --dry-run
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const TEAM_ID = 'team-sunig-ntu';
const PLAYER_ID = 'player-sunig-ntu-12';
const JERSEY_NUMBER = 12;

const dryRun = process.argv.includes('--dry-run');

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // no .env.local
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const url =
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, name, position, secondary_position')
    .eq('id', PLAYER_ID)
    .maybeSingle();

  if (playerError) {
    console.error('Player lookup failed:', playerError.message);
    process.exit(1);
  }
  if (!player) {
    console.error(`Player ${PLAYER_ID} not found in players table.`);
    process.exit(1);
  }

  const { data: existing, error: rosterError } = await supabase
    .from('team_players')
    .select('team_id, player_id, number')
    .eq('team_id', TEAM_ID)
    .eq('player_id', PLAYER_ID)
    .maybeSingle();

  if (rosterError) {
    console.error('Roster lookup failed:', rosterError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(
      `${player.name} is already on NTU roster (jersey #${existing.number}). Nothing to do.`
    );
    return;
  }

  const positionProbe = await supabase.from('players').select('position').limit(1);
  const schema =
    positionProbe.error == null ? 'global_position' : 'team_players';

  const row: Record<string, unknown> = {
    team_id: TEAM_ID,
    player_id: PLAYER_ID,
    number: JERSEY_NUMBER,
  };
  if (schema === 'team_players') {
    row.position = player.position ?? 'C';
    row.secondary_position = player.secondary_position ?? null;
  }

  console.log(`Will restore ${player.name} (${PLAYER_ID}) to NTU at #${JERSEY_NUMBER}.`);
  console.log('Schema:', schema);

  if (dryRun) {
    console.log('Dry run — no row inserted.');
    return;
  }

  const { error: upsertError } = await supabase
    .from('team_players')
    .upsert(row, { onConflict: 'team_id,player_id' });

  if (upsertError) {
    if (upsertError.message.includes('team_players_team_number_uidx')) {
      console.error(
        'Insert blocked by unique jersey index. Run migration 004 first:\n  npm run db:migrate:004'
      );
    } else {
      console.error('Upsert failed:', upsertError.message);
    }
    process.exit(1);
  }

  console.log('Done. Hard-refresh RunItBack to see Yuanyang on the NTU roster.');
}

main();

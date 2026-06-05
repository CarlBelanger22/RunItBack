/**
 * Rebuild team-sunig-ntu club roster from canonical import JSON only.
 * Does NOT touch any other team — use rebuild:club-rosters for full league repair.
 *
 * Usage:
 *   npx tsx scripts/repair-rosters.ts --dry-run
 *   npx tsx scripts/repair-rosters.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LEAGUE_ID = 'league-default';
const NTU_TEAM_ID = 'team-sunig-ntu';

const SUNIG_ROSTER_JSON = resolve(
  process.cwd(),
  'Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json'
);
const IVP_ROSTER_JSON = resolve(
  process.cwd(),
  'Importingboxscores/ivp 2026/game-2026-01-13-ntu-np.json'
);

const dryRun = process.argv.includes('--dry-run');

interface JsonPlayer {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string;
  height?: string;
  weight?: string;
  age?: number;
  dateOfBirth?: string;
}

interface JsonBundle {
  teams: Array<{ id: string; players: JsonPlayer[] }>;
}

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

function loadNtuRosterFromJson(): JsonPlayer[] {
  const sunig = JSON.parse(readFileSync(SUNIG_ROSTER_JSON, 'utf8')) as JsonBundle;
  const ivp = JSON.parse(readFileSync(IVP_ROSTER_JSON, 'utf8')) as JsonBundle;
  const sunigNtu = sunig.teams.find((t) => t.id === NTU_TEAM_ID)?.players ?? [];
  const ivpNtu = ivp.teams.find((t) => t.id === NTU_TEAM_ID)?.players ?? [];
  const byId = new Map<string, JsonPlayer>();
  for (const p of [...sunigNtu, ...ivpNtu]) {
    byId.set(p.id, p);
  }
  return [...byId.values()];
}

async function detectSchema(
  supabase: SupabaseClient
): Promise<'global_position' | 'team_players'> {
  const positionProbe = await supabase.from('players').select('position').limit(1);
  return positionProbe.error == null ? 'global_position' : 'team_players';
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
  const schema = await detectSchema(supabase);
  const ntuRoster = loadNtuRosterFromJson();

  console.log('RunItBack — repair NTU roster only');
  console.log(`Schema: ${schema}`);
  console.log(`Canonical NTU roster: ${ntuRoster.length} players from JSON`);
  console.log('Other teams are NOT modified. Use npm run rebuild:club-rosters for full repair.\n');

  const { data: existingNtu } = await supabase
    .from('team_players')
    .select('player_id, number')
    .eq('team_id', NTU_TEAM_ID);
  console.log(`Current NTU team_players: ${existingNtu?.length ?? 0}`);
  console.log(`Will replace with ${ntuRoster.length} players`);

  if (dryRun) {
    console.log('\nDry run — no writes performed.');
    return;
  }

  const { data: existingProfiles } = await supabase
    .from('players')
    .select('id, height, weight, picture, date_of_birth, age, position, secondary_position')
    .in('id', ntuRoster.map((p) => p.id));

  const existingById = new Map((existingProfiles ?? []).map((p) => [p.id, p]));

  for (const player of ntuRoster) {
    const existing = existingById.get(player.id);
    const profileRow: Record<string, unknown> = {
      id: player.id,
      league_id: DEFAULT_LEAGUE_ID,
      name: player.name,
      picture: existing?.picture ?? null,
      height: player.height || existing?.height || '',
      weight: player.weight || existing?.weight || '',
      age: player.age ?? existing?.age ?? 0,
      date_of_birth: player.dateOfBirth ?? existing?.date_of_birth ?? null,
    };
    if (schema === 'global_position') {
      profileRow.position = player.position || existing?.position || 'PG';
      profileRow.secondary_position =
        player.secondaryPosition ?? existing?.secondary_position ?? null;
    }
    const { error } = await supabase.from('players').upsert(profileRow, { onConflict: 'id' });
    if (error) throw new Error(`players upsert ${player.id}: ${error.message}`);
  }

  const { error: deleteError } = await supabase
    .from('team_players')
    .delete()
    .eq('team_id', NTU_TEAM_ID);
  if (deleteError) throw new Error(`delete NTU links: ${deleteError.message}`);

  for (const player of ntuRoster) {
    const row: Record<string, unknown> = {
      team_id: NTU_TEAM_ID,
      player_id: player.id,
      number: player.number,
    };
    if (schema === 'team_players') {
      row.position = player.position || 'PG';
      row.secondary_position = player.secondaryPosition ?? null;
    }
    const { error } = await supabase
      .from('team_players')
      .upsert(row, { onConflict: 'team_id,player_id' });
    if (error) throw new Error(`insert NTU ${player.id}: ${error.message}`);
  }

  console.log('\nNTU repair complete. Hard-refresh RunItBack.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Repair team_players contamination from C13.4 enrich bug.
 *
 * - Clears opponent team rosters (preserves Kai Xuan user team)
 * - Rebuilds team-sunig-ntu from canonical import JSON
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
const KAI_XUAN_TEAM_ID = 'team-1780252086140';
const KAI_XUAN_CARL_PLAYER_ID = 'player-sunig-ntu-22';
const KAI_XUAN_CARL_NUMBER = 88;

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

interface JsonTeam {
  id: string;
  players: JsonPlayer[];
}

interface JsonBundle {
  teams: JsonTeam[];
}

interface TeamPlayerLink {
  team_id: string;
  player_id: string;
  number: number;
  position?: string;
  secondary_position?: string | null;
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

function isPreservedOpponentTeam(teamId: string): boolean {
  return teamId === KAI_XUAN_TEAM_ID;
}

async function detectSchema(
  supabase: SupabaseClient
): Promise<'global_position' | 'team_players'> {
  const positionProbe = await supabase.from('players').select('position').limit(1);
  return positionProbe.error == null ? 'global_position' : 'team_players';
}

async function loadTeamPlayerLinks(
  supabase: SupabaseClient,
  schema: 'global_position' | 'team_players'
): Promise<TeamPlayerLink[]> {
  const select =
    schema === 'team_players'
      ? 'team_id, player_id, number, position, secondary_position'
      : 'team_id, player_id, number';
  const { data, error } = await supabase.from('team_players').select(select);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamPlayerLink[];
}

async function printRosterCounts(supabase: SupabaseClient, label: string): Promise<void> {
  const { data: rows, error } = await supabase
    .from('team_players')
    .select('team_id, player_id');
  if (error) throw new Error(`team_players read: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
  }

  console.log(`\n${label}  team_players counts:`);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [teamId, count] of sorted) {
    console.log(`  ${teamId}: ${count}`);
  }
  console.log(`  TOTAL: ${rows?.length ?? 0}`);
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

  console.log('RunItBack  repair rosters (C15.2)');
  console.log(`Schema: ${schema}`);
  console.log(`Canonical NTU roster: ${ntuRoster.length} players from JSON`);

  await printRosterCounts(supabase, 'BEFORE');

  const allLinks = await loadTeamPlayerLinks(supabase, schema);
  const playerIds = [...new Set(allLinks.map((r) => r.player_id))];

  const { data: playerRows, error: playersError } = await supabase
    .from('players')
    .select('id, name, height, weight, picture, date_of_birth, age, position, secondary_position')
    .in('id', playerIds.length ? playerIds : ['__none__']);
  if (playersError) throw new Error(playersError.message);

  const nameById = new Map((playerRows ?? []).map((p) => [p.id, p.name as string]));

  const preserveTeamIds = new Set([KAI_XUAN_TEAM_ID]);

  const preserveRows = allLinks.filter(
    (row) =>
      row.team_id !== NTU_TEAM_ID && preserveTeamIds.has(row.team_id)
  );
  const preserveKeys = new Set(
    preserveRows.map((r) => `${r.team_id}:${r.player_id}`)
  );
  const preserveRowsUnique = allLinks.filter((row) =>
    preserveKeys.has(`${row.team_id}:${row.player_id}`)
  );

  if (preserveRowsUnique.length > 0) {
    console.log('\nPreserving opponent roster link(s):');
    for (const row of preserveRowsUnique) {
      console.log(
        `  ${nameById.get(row.player_id)} ? ${row.team_id} #${row.number}`
      );
    }
  } else {
    console.log('\nNo opponent roster links to preserve.');
  }

  const deleteNonNtu = allLinks.filter(
    (row) =>
      row.team_id !== NTU_TEAM_ID &&
      !preserveKeys.has(`${row.team_id}:${row.player_id}`)
  );
  const deleteNtu = allLinks.filter((row) => row.team_id === NTU_TEAM_ID);

  console.log(`\nWill delete ${deleteNonNtu.length} contaminated non-NTU link(s)`);
  console.log(`Will delete ${deleteNtu.length} NTU link(s) (rebuilt from JSON)`);
  console.log(`Will insert ${ntuRoster.length} NTU link(s)`);

  if (dryRun) {
    console.log('\nDry run  no writes performed.');
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

  for (const { team_id, player_id } of [
    ...deleteNonNtu.map((r) => ({ team_id: r.team_id, player_id: r.player_id })),
    ...deleteNtu.map((r) => ({ team_id: r.team_id, player_id: r.player_id })),
  ]) {
    const { error } = await supabase
      .from('team_players')
      .delete()
      .eq('team_id', team_id)
      .eq('player_id', player_id);
    if (error) throw new Error(`delete ${team_id}/${player_id}: ${error.message}`);
  }

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

  for (const row of preserveRowsUnique) {
    const upsertRow: Record<string, unknown> = {
      team_id: row.team_id,
      player_id: row.player_id,
      number: row.number,
    };
    if (schema === 'team_players') {
      upsertRow.position = row.position ?? 'PG';
      upsertRow.secondary_position = row.secondary_position ?? null;
    }
    const { error } = await supabase
      .from('team_players')
      .upsert(upsertRow, { onConflict: 'team_id,player_id' });
    if (error) throw new Error(`preserve ${row.team_id}: ${error.message}`);
  }

  const kaiXuanCarl: Record<string, unknown> = {
    team_id: KAI_XUAN_TEAM_ID,
    player_id: KAI_XUAN_CARL_PLAYER_ID,
    number: KAI_XUAN_CARL_NUMBER,
  };
  const { error: kaiCarlError } = await supabase
    .from('team_players')
    .upsert(kaiXuanCarl, { onConflict: 'team_id,player_id' });
  if (kaiCarlError) {
    throw new Error(`ensure Carl on Kai Xuan: ${kaiCarlError.message}`);
  }

  await printRosterCounts(supabase, 'AFTER');
  console.log('\nRepair complete. Hard-refresh RunItBack.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

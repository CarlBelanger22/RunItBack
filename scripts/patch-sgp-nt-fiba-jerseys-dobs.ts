/**
 * Singapore NT: FIBA Pre-Q + club jersey #s, DOB fixes.
 * Does NOT touch Indonesia Training Trip tournament_rosters.
 *
 *   npx tsx scripts/patch-sgp-nt-fiba-jerseys-dobs.ts --dry-run
 *   npx tsx scripts/patch-sgp-nt-fiba-jerseys-dobs.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const SGP_TEAM_ID = 'team-1786634408294';
const FIBA_TOURNAMENT_ID = 'tournament-1787937458049';
const TRAINING_TRIP_ID = 'tournament-1786724699692';
const dryRun = process.argv.includes('--dry-run');

type SgpPatch = {
  id: string;
  name: string;
  fibaNumber: number;
  /** Only set when correcting a DOB mismatch vs FIBA sheet. */
  dateOfBirth?: string;
};

const ROSTER: SgpPatch[] = [
  { id: 'player-1786719720297', name: 'Jay Shay Lin', fibaNumber: 1 },
  { id: 'player-1786719611267', name: 'Zachary Helzer', fibaNumber: 3 },
  { id: 'player-sunig-ntu-4', name: 'Louis Ho', fibaNumber: 4 },
  {
    id: 'player-1787024206829',
    name: 'Bryant Tan',
    fibaNumber: 7,
    dateOfBirth: '2005-03-29',
  },
  {
    id: 'player-sunig-ntu-8',
    name: 'Chengshan Tan',
    fibaNumber: 8,
    dateOfBirth: '2000-04-17',
  },
  { id: 'player-1786719502718', name: 'Lavin Raj', fibaNumber: 10 },
  { id: 'player-1786804530745', name: 'Akash Ganeshram', fibaNumber: 13 },
  { id: 'player-1787024264973', name: 'Jeryl Gan', fibaNumber: 14 },
  { id: 'player-1787024297348', name: 'Jackson Mah', fibaNumber: 18 },
  { id: 'player-sunig-ntu-22', name: 'Carl Belanger', fibaNumber: 22 },
  { id: 'player-1786720346120', name: 'John Ng', fibaNumber: 24 },
  {
    id: 'player-1786719974252',
    name: 'Minhan Chong',
    fibaNumber: 27,
    dateOfBirth: '2003-06-18',
  },
];

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );

  const ids = ROSTER.map((r) => r.id);

  const { data: trainBefore, error: trainErr } = await supabase
    .from('tournament_rosters')
    .select('player_id,number')
    .eq('tournament_id', TRAINING_TRIP_ID)
    .eq('team_id', SGP_TEAM_ID)
    .in('player_id', ids);
  if (trainErr) throw trainErr;
  const trainBeforeMap = new Map(
    (trainBefore ?? []).map((r) => [r.player_id as string, r.number as number])
  );

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Patching ${ROSTER.length} SGP players (FIBA Pre-Q + club; Training Trip untouched)…`
  );

  for (const row of ROSTER) {
    console.log(
      `  #${row.fibaNumber} ${row.name}` +
        (row.dateOfBirth ? ` | DOB → ${row.dateOfBirth}` : '') +
        ` | Training Trip keep #${trainBeforeMap.get(row.id) ?? 'n/a'}`
    );

    if (dryRun) continue;

    if (row.dateOfBirth) {
      const { error } = await supabase
        .from('players')
        .update({ date_of_birth: row.dateOfBirth })
        .eq('id', row.id);
      if (error) throw new Error(`players DOB ${row.id}: ${error.message}`);
    }

    const { error: clubError } = await supabase.from('team_players').upsert(
      {
        team_id: SGP_TEAM_ID,
        player_id: row.id,
        number: row.fibaNumber,
      },
      { onConflict: 'team_id,player_id' }
    );
    if (clubError) throw new Error(`team_players ${row.id}: ${clubError.message}`);

    const { error: fibaError } = await supabase
      .from('tournament_rosters')
      .update({ number: row.fibaNumber })
      .eq('tournament_id', FIBA_TOURNAMENT_ID)
      .eq('team_id', SGP_TEAM_ID)
      .eq('player_id', row.id);
    if (fibaError) {
      throw new Error(`tournament_rosters FIBA ${row.id}: ${fibaError.message}`);
    }
  }

  if (!dryRun) {
    const { data: trainAfter, error: afterErr } = await supabase
      .from('tournament_rosters')
      .select('player_id,number')
      .eq('tournament_id', TRAINING_TRIP_ID)
      .eq('team_id', SGP_TEAM_ID)
      .in('player_id', ids);
    if (afterErr) throw afterErr;

    for (const row of ROSTER) {
      const before = trainBeforeMap.get(row.id);
      const after = (trainAfter ?? []).find((r) => r.player_id === row.id)?.number;
      if (before === undefined && after === undefined) continue;
      if (before !== after) {
        throw new Error(
          `Training Trip number changed for ${row.id}: ${before} → ${after}`
        );
      }
    }

    const { data: fibaRows, error: fibaCheckErr } = await supabase
      .from('tournament_rosters')
      .select('player_id,number')
      .eq('tournament_id', FIBA_TOURNAMENT_ID)
      .eq('team_id', SGP_TEAM_ID)
      .in('player_id', ids);
    if (fibaCheckErr) throw fibaCheckErr;
    for (const row of ROSTER) {
      const n = (fibaRows ?? []).find((r) => r.player_id === row.id)?.number;
      if (n !== row.fibaNumber) {
        throw new Error(
          `FIBA Pre-Q number for ${row.id} is ${n}, expected ${row.fibaNumber}`
        );
      }
    }
  }

  console.log(
    dryRun
      ? '\nDry run complete. Training Trip rows would not be written.'
      : '\nSGP FIBA jerseys + club #s + DOBs updated. Training Trip unchanged.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

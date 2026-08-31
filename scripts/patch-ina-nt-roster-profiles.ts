/**
 * Patch Indonesia NT roster profiles (FIBA official bios).
 *
 *   npx tsx scripts/patch-ina-nt-roster-profiles.ts --dry-run
 *   npx tsx scripts/patch-ina-nt-roster-profiles.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const INA_TEAM_ID = 'team-ina-mens-nt-2026';
const LEAGUE_ID = 'league-default';
const dryRun = process.argv.includes('--dry-run');

type RosterPatch = {
  id: string;
  number: number;
  name: string;
  dateOfBirth: string;
  height: string;
  position: string;
  secondaryPosition?: string;
};

/** Guard → SG primary, PG secondary. */
const ROSTER: RosterPatch[] = [
  {
    id: 'player-ina-nt-2026-18-erga',
    number: 2,
    name: 'Antoni Erga',
    dateOfBirth: '2000-05-06',
    height: '179',
    position: 'SG',
    secondaryPosition: 'PG',
  },
  {
    id: 'player-ina-nt-2026-13-bagir',
    number: 6,
    name: 'Ali Bagir Alhadar',
    dateOfBirth: '2000-07-04',
    height: '195',
    position: 'PF',
  },
  {
    id: 'player-ina-nt-2026-08-saputera',
    number: 8,
    name: 'Yudha Saputera',
    dateOfBirth: '1998-11-21',
    height: '175',
    position: 'PG',
  },
  {
    id: 'player-ina-nt-2026-10-disi',
    number: 9,
    name: 'Didi Rio',
    dateOfBirth: '1992-12-04',
    height: '185',
    position: 'SG',
  },
  {
    id: 'player-ina-nt-2026-14-sanyudy',
    number: 10,
    name: 'Argus Sanyudy',
    dateOfBirth: '2000-08-01',
    height: '192',
    position: 'PF',
  },
  {
    id: 'player-ina-nt-2026-19-reza',
    number: 19,
    name: 'Muhammad Guntara',
    dateOfBirth: '1996-01-24',
    height: '195',
    position: 'SF',
  },
  {
    id: 'player-asg19-indonesia-hendrix-xavi-yonga',
    number: 21,
    name: 'Hendrick Xavi Yonga',
    dateOfBirth: '2002-08-07',
    height: '184',
    position: 'SG',
  },
  {
    id: 'player-ina-nt-2026-22-sanjaya',
    number: 27,
    name: 'Kelvin Sanjaya',
    dateOfBirth: '2000-11-27',
    height: '200',
    position: 'C',
  },
  {
    id: 'player-ina-nt-2026-12-diagne',
    number: 29,
    name: 'Dame Diagne',
    dateOfBirth: '2005-07-29',
    height: '194',
    position: 'PF',
  },
  {
    id: 'player-ina-nt-2026-11-wiguna',
    number: 34,
    name: 'Pandu Wiguna',
    dateOfBirth: '1995-10-06',
    height: '194',
    position: 'C',
  },
  {
    id: 'player-ina-nt-2026-77-maulana',
    number: 77,
    name: 'Muhammad Maulana',
    dateOfBirth: '1998-02-09',
    height: '180',
    position: 'SF',
  },
  {
    id: 'player-ina-nt-2026-03-beane',
    number: 88,
    name: 'Anthony Beane',
    dateOfBirth: '1994-05-06',
    height: '188',
    position: 'SG',
    secondaryPosition: 'PG',
  },
];

function loadEnv(): { url: string; key: string } {
  loadEnvLocalIntoProcess();
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
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
    /* optional */
  }
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials in .env.local');
  }
  return { url, key };
}

async function main(): Promise<void> {
  const { url, key } = loadEnv();
  const supabase = createClient(url, key);

  console.log(`${dryRun ? '[dry-run] ' : ''}Patching ${ROSTER.length} Indonesia NT players…`);

  for (const row of ROSTER) {
    const playerUpdate = {
      name: row.name,
      height: row.height,
      date_of_birth: row.dateOfBirth,
      position: row.position,
      secondary_position: row.secondaryPosition ?? null,
    };

    const teamPlayerUpdate = {
      team_id: INA_TEAM_ID,
      player_id: row.id,
      number: row.number,
    };

    console.log(
      `  #${row.number} ${row.name} | ${row.position}${
        row.secondaryPosition ? ` / ${row.secondaryPosition}` : ''
      } | ${row.height} cm | DOB ${row.dateOfBirth}`
    );

    if (dryRun) continue;

    const { error: playerError } = await supabase
      .from('players')
      .update(playerUpdate)
      .eq('id', row.id);
    if (playerError) {
      throw new Error(`players ${row.id}: ${playerError.message}`);
    }

    const { error: linkError } = await supabase.from('team_players').upsert(teamPlayerUpdate, {
      onConflict: 'team_id,player_id',
    });
    if (linkError) {
      throw new Error(`team_players ${row.id}: ${linkError.message}`);
    }

    // Keep FIBA jersey numbers on every Indonesia tournament roster row.
    const { error: rosterError } = await supabase
      .from('tournament_rosters')
      .update({ number: row.number })
      .eq('team_id', INA_TEAM_ID)
      .eq('player_id', row.id);
    if (rosterError) {
      throw new Error(`tournament_rosters ${row.id}: ${rosterError.message}`);
    }
  }

  if (!dryRun) {
    // Ensure all 12 are linked to the INA team (upsert may miss players not yet on roster).
    for (const row of ROSTER) {
      const { data, error } = await supabase
        .from('team_players')
        .select('player_id')
        .eq('team_id', INA_TEAM_ID)
        .eq('player_id', row.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        const { error: insertError } = await supabase.from('team_players').insert({
          team_id: INA_TEAM_ID,
          player_id: row.id,
          number: row.number,
        });
        if (insertError) throw new Error(`insert team_players ${row.id}: ${insertError.message}`);
      }
    }
  }

  console.log(dryRun ? '\nDry run complete.' : '\nIndonesia NT roster profiles updated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

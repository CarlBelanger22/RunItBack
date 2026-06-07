/**
 * Surgical patch: ASG 2019 team_coach + official reb/to/foul totals on team_stats only.
 *
 * Usage:
 *   npx tsx scripts/patch-asg2019-team-coach.ts --dry-run
 *   npx tsx scripts/patch-asg2019-team-coach.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { EMPTY_TEAM_COACH } from '../src/utils/teamCoachStats';
import {
  ASG2019_SCORE_ONLY_GAME_IDS,
  ASG2019_TEAM_COACH_PATCHES,
  type SideTeamCoachPatch,
} from './asg2019-team-coach-data';

loadEnvLocalIntoProcess();

type TeamStatsSide = Record<string, unknown>;

function applySidePatch(
  side: TeamStatsSide,
  patch: SideTeamCoachPatch
): TeamStatsSide {
  return {
    ...side,
    team_coach: { ...patch.team_coach },
    orb: patch.orb,
    drb: patch.drb,
    turnovers: patch.turnovers,
    fouls: patch.fouls,
    total_rebounds: patch.orb + patch.drb,
  };
}

function applyZeros(side: TeamStatsSide): TeamStatsSide {
  return { ...side, team_coach: { ...EMPTY_TEAM_COACH } };
}

function findAsgJsonDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n: string) => /asg\s*2019/i.test(n));
  if (!entry) throw new Error('ASG 2019 folder not found');
  return join(base, entry, 'json');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const allIds = [
    ...Object.keys(ASG2019_TEAM_COACH_PATCHES),
    ...ASG2019_SCORE_ONLY_GAME_IDS,
  ];

  let dbPatched = 0;
  let jsonPatched = 0;
  const jsonDir = findAsgJsonDir();

  for (const gameId of allIds) {
    const { data, error } = await supabase
      .from('games')
      .select('id, team_stats')
      .eq('id', gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      console.warn(`  skip ${gameId} — not in DB`);
      continue;
    }

    const raw = data.team_stats as { home?: TeamStatsSide; away?: TeamStatsSide };
    const fullPatch = ASG2019_TEAM_COACH_PATCHES[gameId];
    const merged = fullPatch
      ? {
          ...raw,
          home: applySidePatch(raw.home ?? {}, fullPatch.home),
          away: applySidePatch(raw.away ?? {}, fullPatch.away),
        }
      : {
          ...raw,
          home: applyZeros(raw.home ?? {}),
          away: applyZeros(raw.away ?? {}),
        };

    console.log(`  ${gameId} | ${fullPatch ? 'FULL patch' : 'zeros only'}`);
    dbPatched++;

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('games')
        .update({ team_stats: merged })
        .eq('id', gameId);
      if (updateError) throw new Error(updateError.message);

      const jsonPath = join(jsonDir, `${gameId}.json`);
      try {
        const bundle = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
          game: { teamStats: unknown };
        };
        bundle.game.teamStats = merged;
        writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
        jsonPatched++;
      } catch {
        console.warn(`    JSON not updated: ${jsonPath}`);
      }
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] would patch' : 'Patched'} ${dbPatched} ASG game(s) in DB` +
      (dryRun ? '' : `; ${jsonPatched} JSON file(s) updated.`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

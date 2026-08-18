/**
 * Import SUniG 2026 men's scheduled fixtures + 5th–7th RR stage structure.
 *
 * Usage:
 *   npx tsx scripts/import-sunig-2026-fixtures.ts
 *   npx tsx scripts/import-sunig-2026-fixtures.ts --dry-run
 *   npx tsx scripts/import-sunig-2026-fixtures.ts --with-placing
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  GROUP_FIXTURES,
  PLACING_FIXTURES,
  STAGE,
  GROUP,
  TOURNAMENT_ID,
} from './sunig-2026-schedule-data';
import {
  applyBracketSlotSchedule,
} from '../src/utils/sunig2026BracketSchedule';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';
import type { TournamentStructure } from '../src/utils/tournamentStructure';
import { defaultPlacingPoolSeedMatchups } from '../src/utils/groupMatchRows';

const PLACING_SEED_LABELS = ['A3', 'B3', 'B4'] as const;

const LEAGUE_ID = 'league-default';

function loadEnv() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
      })
  );
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

function emptyTeamStats(teamId: string) {
  return {
    teamId,
    total_points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
  };
}

function mergePlacingStage(structure: unknown) {
  const normalized = normalizeTournamentStructure(structure);
  if (!normalized) throw new Error('Tournament has no structure');
  const seedMatchups = defaultPlacingPoolSeedMatchups([...PLACING_SEED_LABELS]);
  const hasPlacing = normalized.stages.some((s) => s.id === STAGE.placing);
  if (hasPlacing) {
    let patched = false;
    const stages = normalized.stages.map((s) => {
      if (s.id !== STAGE.placing) return s;
      const groups = (s.groups ?? []).map((g) => {
        if (g.id !== GROUP.placing) return g;
        if (g.seedMatchups?.length) return g;
        patched = true;
        return {
          ...g,
          seedLabels: g.seedLabels ?? [...PLACING_SEED_LABELS],
          seedMatchups,
        };
      });
      return { ...s, groups };
    });
    return patched ? { ...normalized, stages } : normalized;
  }
  const finalsOrder =
    normalized.stages.find((s) => s.id === STAGE.finals)?.order ?? 3;
  const placingStage = {
    id: STAGE.placing,
    name: '5th–7th Placing',
    kind: 'round_robin' as const,
    order: finalsOrder,
    groups: [
      {
        id: GROUP.placing,
        name: 'Placing pool',
        teamIds: [] as string[],
        seedLabels: [...PLACING_SEED_LABELS],
        seedFromStageId: STAGE.group,
        seedMatchups,
      },
    ],
  };
  const stages = normalized.stages.map((s) =>
    s.order >= finalsOrder ? { ...s, order: s.order + 1 } : s
  );
  stages.push({ ...placingStage, order: finalsOrder });
  stages.sort((a, b) => a.order - b.order);
  return { ...normalized, stages };
}

function mergeBracketSlotDates(structure: TournamentStructure): TournamentStructure {
  let patched = false;
  const stages = structure.stages.map((stage) => {
    if (stage.kind !== 'classification' || !stage.bracket) return stage;
    const rounds = stage.bracket.rounds.map((round) => ({
      ...round,
      slots: round.slots.map((slot) => {
        const next = applyBracketSlotSchedule(slot);
        if (next === slot) return slot;
        patched = true;
        return next;
      }),
    }));
    return { ...stage, bracket: { rounds } };
  });
  return patched ? { ...structure, stages } : structure;
}

function mergeTournamentStructure(structure: unknown) {
  const withPlacing = mergePlacingStage(structure);
  return mergeBracketSlotDates(withPlacing);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const withPlacing = process.argv.includes('--with-placing');
  const supabase = loadEnv();

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, structure')
    .eq('id', TOURNAMENT_ID)
    .single();
  if (tErr || !tournament) throw new Error(`Tournament ${TOURNAMENT_ID} not found`);

  const { data: existingGames } = await supabase
    .from('games')
    .select('id')
    .eq('tournament_id', TOURNAMENT_ID);
  const existingIds = new Set((existingGames ?? []).map((g) => g.id));

  const fixtures = [
    ...GROUP_FIXTURES,
    ...(withPlacing ? PLACING_FIXTURES : []),
  ];

  for (const f of fixtures) {
    if (existingIds.has(f.id)) {
      console.log(`Skip existing ${f.id}`);
      continue;
    }
    const row = {
      id: f.id,
      league_id: LEAGUE_ID,
      tournament_id: TOURNAMENT_ID,
      home_team_id: f.homeTeamId,
      away_team_id: f.awayTeamId,
      date: f.date,
      current_period: 1,
      current_game_time: '12:00',
      track_both_teams: true,
      is_active: false,
      is_completed: false,
      final_score_home: null,
      final_score_away: null,
      home_starters: [],
      away_starters: [],
      game_stats: [],
      team_stats: {
        home: emptyTeamStats(f.homeTeamId),
        away: emptyTeamStats(f.awayTeamId),
        __meta: {
          startTime: f.startTime,
          stageId: f.stageId,
          groupId: f.groupId,
        },
      },
      shots: [],
      events: [],
      lineup_stints: [],
    };
    if (dryRun) {
      console.log('[dry-run] insert game', f.id, f.date, f.startTime);
    } else {
      const { error } = await supabase.from('games').insert(row);
      if (error) throw new Error(`Insert ${f.id}: ${error.message}`);
      console.log('Inserted', f.id);
    }
  }

  const nextStructure = mergeTournamentStructure(tournament.structure);
  if (dryRun) {
    console.log('[dry-run] update tournament structure (placing + bracket dates)');
  } else {
    const { error } = await supabase
      .from('tournaments')
      .update({ structure: nextStructure })
      .eq('id', TOURNAMENT_ID);
    if (error) throw new Error(`Structure update: ${error.message}`);
    console.log('Updated tournament structure (placing stage + bracket slot dates)');
  }

  console.log(
    `\nDone. Imported ${fixtures.length} fixture(s).` +
      (withPlacing ? '' : ' (placing pool games: run with --with-placing after finalize)')
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Build Carl-only NSG A Division 2019 import JSON (7 games, ACJC home).
 *
 * Usage:
 *   npx tsx scripts/build-adiv-2019-carl-only-imports.ts
 *   npx tsx scripts/build-adiv-2019-carl-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const ACJC_TEAM_ID = 'team-1781859943592';
const CARL_PLAYER_ID = 'player-sunig-ntu-22';
const TOURNAMENT_ID = 'tournament-1781859881010';
const RNG_SEED = 20190408;

interface CarlGameDef {
  id: string;
  date: string;
  opponentId: string;
  acjcScore: number;
  oppScore: number;
  minutesPlayed: number;
  fouls: number;
  points: number;
  rebTotal: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
}

interface GameTemplate {
  id: string;
  date: string;
  opponentId: string;
  acjcScore: number;
  oppScore: number;
  minRange: [number, number];
  fouls: number | [number, number];
  toRange: [number, number];
  turnovers?: number;
  points: number;
  rebTotal: number;
  assists: number;
  steals: number;
  blocks: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
}

const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: 'game-adiv19-2019-04-08-njc',
    date: '2019-04-08',
    opponentId: 'team-1781859982205',
    acjcScore: 42,
    oppScore: 36,
    minRange: [25, 30],
    fouls: 1,
    toRange: [0, 2],
    turnovers: 1,
    points: 6,
    rebTotal: 17,
    assists: 2,
    steals: 5,
    blocks: 1,
    fgMade: 3,
    fgAttempted: 7,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-adiv19-2019-04-10-yijc',
    date: '2019-04-10',
    opponentId: 'team-1781860040900',
    acjcScore: 55,
    oppScore: 26,
    minRange: [25, 30],
    fouls: [1, 4],
    toRange: [0, 2],
    points: 13,
    rebTotal: 13,
    assists: 0,
    steals: 2,
    blocks: 1,
    fgMade: 5,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 3,
    ftAttempted: 5,
  },
  {
    id: 'game-adiv19-2019-04-15-nyjc',
    date: '2019-04-15',
    opponentId: 'team-1781860086595',
    acjcScore: 44,
    oppScore: 58,
    minRange: [25, 30],
    fouls: [1, 4],
    toRange: [0, 2],
    points: 9,
    rebTotal: 7,
    assists: 0,
    steals: 4,
    blocks: 1,
    fgMade: 4,
    fgAttempted: 7,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
    ftAttempted: 3,
  },
  {
    id: 'game-adiv19-2019-04-22-sji',
    date: '2019-04-22',
    opponentId: 'team-1781860116158',
    acjcScore: 52,
    oppScore: 34,
    minRange: [25, 30],
    fouls: [1, 4],
    toRange: [0, 2],
    points: 18,
    rebTotal: 11,
    assists: 1,
    steals: 1,
    blocks: 2,
    fgMade: 8,
    fgAttempted: 11,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 2,
    ftAttempted: 4,
  },
  {
    id: 'game-adiv19-2019-05-06-asrjc',
    date: '2019-05-06',
    opponentId: 'team-1781860173004',
    acjcScore: 31,
    oppScore: 32,
    minRange: [25, 30],
    fouls: 1,
    toRange: [0, 2],
    turnovers: 0,
    points: 3,
    rebTotal: 9,
    assists: 1,
    steals: 3,
    blocks: 1,
    fgMade: 1,
    fgAttempted: 3,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
    ftAttempted: 4,
  },
  {
    id: 'game-adiv19-2019-05-08-tmjc',
    date: '2019-05-08',
    opponentId: 'team-1781860310555',
    acjcScore: 35,
    oppScore: 59,
    minRange: [25, 30],
    fouls: [1, 4],
    toRange: [0, 2],
    points: 8,
    rebTotal: 7,
    assists: 0,
    steals: 1,
    blocks: 1,
    fgMade: 3,
    fgAttempted: 5,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 2,
    ftAttempted: 4,
  },
  {
    id: 'game-adiv19-2019-05-13-ri',
    date: '2019-05-13',
    opponentId: 'team-1781860245664',
    acjcScore: 38,
    oppScore: 28,
    minRange: [25, 30],
    fouls: [1, 4],
    toRange: [0, 2],
    points: 6,
    rebTotal: 11,
    assists: 0,
    steals: 0,
    blocks: 2,
    fgMade: 3,
    fgAttempted: 6,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 2,
  },
];

function hashSeed(str: string): number {
  let h = RNG_SEED;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function resolveSyntheticStats(template: GameTemplate): {
  minutesPlayed: number;
  fouls: number;
  turnovers: number;
} {
  const rng = mulberry32(hashSeed(template.id));
  const [minLo, minHi] = template.minRange;
  const minutesPlayed = round1(minLo + rng() * (minHi - minLo));
  const fouls =
    typeof template.fouls === 'number'
      ? template.fouls
      : randomInt(rng, template.fouls[0], template.fouls[1]);
  const turnovers =
    typeof template.turnovers === 'number'
      ? template.turnovers
      : randomInt(rng, template.toRange[0], template.toRange[1]);
  return { minutesPlayed, fouls, turnovers };
}

const GAMES: CarlGameDef[] = GAME_TEMPLATES.map((template) => {
  const { minutesPlayed, fouls, turnovers } = resolveSyntheticStats(template);
  return { ...template, minutesPlayed, fouls, turnovers };
});

function findAdivDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => /a division/i.test(n));
  if (entry) return join(base, entry);
  return join(base, 'A Division 2019');
}

function splitRebounds(total: number): { orb: number; drb: number } {
  const orb = Math.round(total * 0.3);
  return { orb, drb: total - orb };
}

function emptyTeamStats(teamId: string, totalPoints: number) {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: totalPoints,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  };
}

function buildCarlStat(game: CarlGameDef) {
  const { orb, drb } = splitRebounds(game.rebTotal);
  return {
    playerId: CARL_PLAYER_ID,
    points: game.points,
    fg_made: game.fgMade,
    fg_attempted: game.fgAttempted,
    three_made: game.threeMade,
    three_attempted: game.threeAttempted,
    ft_made: game.ftMade,
    ft_attempted: game.ftAttempted,
    orb,
    drb,
    assists: game.assists,
    steals: game.steals,
    blocks: game.blocks,
    turnovers: game.turnovers,
    fouls: game.fouls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    // Easy Stats had no FD/+/- — zeros are placeholders; UI uses statRecordingCoverage denylist.
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: game.minutesPlayed,
  };
}

interface TeamMeta {
  id: string;
  name: string;
  abbreviation: string;
}

function buildBundle(
  game: CarlGameDef,
  tournament: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
  },
  acjcTeam: TeamMeta,
  opponentTeam: TeamMeta
) {
  return {
    version: '1',
    tournament: {
      id: tournament.id,
      name: tournament.name,
      year: tournament.year,
      month: tournament.month,
      teamIds: tournament.teamIds,
    },
    teams: [
      {
        id: acjcTeam.id,
        name: acjcTeam.name,
        abbreviation: acjcTeam.abbreviation,
        currentTournamentId: tournament.id,
        players: [],
      },
      {
        id: opponentTeam.id,
        name: opponentTeam.name,
        abbreviation: opponentTeam.abbreviation,
        currentTournamentId: tournament.id,
        players: [],
      },
    ],
    game: {
      id: game.id,
      homeTeamId: ACJC_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: tournament.id,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.acjcScore, away: game.oppScore },
      homeStarters: [CARL_PLAYER_ID],
      awayStarters: [],
      gameStats: [buildCarlStat(game)],
      teamStats: {
        home: emptyTeamStats(ACJC_TEAM_ID, game.acjcScore),
        away: emptyTeamStats(game.opponentId, game.oppScore),
      },
      shots: [],
      events: [],
      lineupStints: [],
    },
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const allowExisting = process.argv.includes('--allow-existing');
  loadEnvLocalIntoProcess();

  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament) {
    throw new Error(`Tournament ${TOURNAMENT_ID} not found in Supabase`);
  }

  const teamsById = new Map<string, TeamMeta>();
  for (const team of data.teams) {
    teamsById.set(team.id, {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
    });
  }

  const acjcTeam = teamsById.get(ACJC_TEAM_ID);
  if (!acjcTeam) throw new Error(`ACJC team ${ACJC_TEAM_ID} not found`);

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  if (!allowExisting) {
    for (const game of GAMES) {
      if (existingGameIds.has(game.id)) {
        throw new Error(
          `Game ${game.id} already exists in Supabase — aborting to avoid overwrite (use --allow-existing to rewrite JSON)`
        );
      }
    }
  }

  const outDir = join(findAdivDir(), 'json');
  mkdirSync(outDir, { recursive: true });

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  console.log(
    `Building ${GAMES.length} Carl-only NSG A Division 2019 game bundles (seed ${RNG_SEED})…\n`
  );

  for (const game of GAMES) {
    const opponent = teamsById.get(game.opponentId);
    if (!opponent) {
      throw new Error(`Opponent team ${game.opponentId} not found for ${game.id}`);
    }

    const bundle = buildBundle(game, tournamentMeta, acjcTeam, opponent);
    const outPath = join(outDir, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    const stat = bundle.game.gameStats[0];
    console.log(
      `${game.id} | ${game.date} | ACJC ${game.acjcScore}-${game.oppScore} vs ${opponent.abbreviation} | Carl ${stat.points}p ${stat.minutes_played}min ${stat.fouls}pf ${stat.turnovers}to`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
  } else {
    console.log(`\nWrote ${GAMES.length} files to ${outDir}`);
    console.log('Import: npm run import:boxscore -- --file "<path>" --stats-only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

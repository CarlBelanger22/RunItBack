/**
 * Build Carl-only NSG B Division 2018 import JSON (18 games, Fairfield home).
 *
 * Usage:
 *   npx tsx scripts/build-bdiv-2018-carl-only-imports.ts
 *   npx tsx scripts/build-bdiv-2018-carl-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const FAIRFIELD_TEAM_ID = 'team-1782331628631';
const CARL_PLAYER_ID = 'player-sunig-ntu-22';
const TOURNAMENT_ID = 'tournament-1782331320905';
const RNG_SEED = 20180115;

const OPPONENTS = [
  { id: 'team-bdiv18-mayflower', name: 'Mayflower', abbreviation: 'MFSS' },
  { id: 'team-bdiv18-queensway', name: 'Queensway', abbreviation: 'QSW' },
  { id: 'team-bdiv18-bartley', name: 'Bartley', abbreviation: 'BART' },
  { id: 'team-bdiv18-bukit-merah', name: 'Bukit Merah', abbreviation: 'BKM' },
  { id: 'team-bdiv18-kent-ridge', name: 'Kent Ridge', abbreviation: 'KRSS' },
  { id: 'team-bdiv18-yuying', name: 'Yuying', abbreviation: 'YUY' },
  { id: 'team-bdiv18-acs-barker', name: 'ACS Barker', abbreviation: 'ACSB' },
  { id: 'team-bdiv18-st-andrew', name: 'St Andrew', abbreviation: 'SASS' },
  { id: 'team-bdiv18-ngee-ann', name: 'Ngee Ann', abbreviation: 'NASS' },
  { id: 'team-bdiv18-jurong-west', name: 'Jurong West', abbreviation: 'JWSS' },
  { id: 'team-bdiv18-north-vista', name: 'North Vista', abbreviation: 'NVSS' },
  { id: 'team-bdiv18-presbyterian', name: 'Presbyterian High', abbreviation: 'PRES' },
  { id: 'team-bdiv18-dunman', name: 'Dunman', abbreviation: 'DMSS' },
  { id: 'team-bdiv18-bukit-panjang', name: 'Bukit Panjang', abbreviation: 'BPSS' },
  { id: 'team-bdiv18-unity', name: 'Unity', abbreviation: 'UNI' },
] as const;

const OPPONENT_BY_ID = new Map(OPPONENTS.map((o) => [o.id, o]));

interface CarlGameDef {
  id: string;
  date: string;
  opponentId: string;
  fairfieldScore: number;
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
  fairfieldScore: number;
  oppScore: number;
  minRange: [number, number];
  pfRange: [number, number];
  toRange: [number, number];
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
    id: 'game-bdiv18-2018-01-15-mayflower',
    date: '2018-01-15',
    opponentId: 'team-bdiv18-mayflower',
    fairfieldScore: 46,
    oppScore: 47,
    minRange: [15, 25],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 7,
    rebTotal: 9,
    assists: 0,
    steals: 0,
    blocks: 1,
    fgMade: 2,
    fgAttempted: 4,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 3,
    ftAttempted: 6,
  },
  {
    id: 'game-bdiv18-2018-01-17-queensway',
    date: '2018-01-17',
    opponentId: 'team-bdiv18-queensway',
    fairfieldScore: 53,
    oppScore: 17,
    minRange: [10, 20],
    pfRange: [0, 3],
    toRange: [0, 3],
    points: 3,
    rebTotal: 7,
    assists: 0,
    steals: 1,
    blocks: 0,
    fgMade: 1,
    fgAttempted: 6,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
    ftAttempted: 6,
  },
  {
    id: 'game-bdiv18-2018-01-29-bartley',
    date: '2018-01-29',
    opponentId: 'team-bdiv18-bartley',
    fairfieldScore: 118,
    oppScore: 2,
    minRange: [5, 12],
    pfRange: [0, 3],
    toRange: [0, 2],
    points: 11,
    rebTotal: 7,
    assists: 1,
    steals: 2,
    blocks: 2,
    fgMade: 5,
    fgAttempted: 9,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-01-31-bukit-merah',
    date: '2018-01-31',
    opponentId: 'team-bdiv18-bukit-merah',
    fairfieldScore: 81,
    oppScore: 29,
    minRange: [10, 20],
    pfRange: [0, 3],
    toRange: [0, 3],
    points: 12,
    rebTotal: 15,
    assists: 2,
    steals: 3,
    blocks: 2,
    fgMade: 6,
    fgAttempted: 14,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-bdiv18-2018-02-06-kent-ridge',
    date: '2018-02-06',
    opponentId: 'team-bdiv18-kent-ridge',
    fairfieldScore: 57,
    oppScore: 30,
    minRange: [15, 25],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 12,
    rebTotal: 6,
    assists: 1,
    steals: 0,
    blocks: 0,
    fgMade: 5,
    fgAttempted: 7,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 2,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-02-13-yuying',
    date: '2018-02-13',
    opponentId: 'team-bdiv18-yuying',
    fairfieldScore: 64,
    oppScore: 34,
    minRange: [15, 20],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 16,
    rebTotal: 12,
    assists: 2,
    steals: 1,
    blocks: 3,
    fgMade: 8,
    fgAttempted: 11,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-bdiv18-2018-02-20-acs-barker',
    date: '2018-02-20',
    opponentId: 'team-bdiv18-acs-barker',
    fairfieldScore: 53,
    oppScore: 67,
    minRange: [20, 30],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 10,
    rebTotal: 9,
    assists: 3,
    steals: 2,
    blocks: 2,
    fgMade: 4,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 2,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-02-22-st-andrew',
    date: '2018-02-22',
    opponentId: 'team-bdiv18-st-andrew',
    fairfieldScore: 62,
    oppScore: 35,
    minRange: [15, 20],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 8,
    rebTotal: 11,
    assists: 0,
    steals: 1,
    blocks: 2,
    fgMade: 3,
    fgAttempted: 5,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 2,
    ftAttempted: 3,
  },
  {
    id: 'game-bdiv18-2018-02-26-semis-mayflower',
    date: '2018-02-26',
    opponentId: 'team-bdiv18-mayflower',
    fairfieldScore: 75,
    oppScore: 57,
    minRange: [20, 30],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 14,
    rebTotal: 15,
    assists: 0,
    steals: 4,
    blocks: 2,
    fgMade: 2,
    fgAttempted: 10,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 10,
    ftAttempted: 14,
  },
  {
    id: 'game-bdiv18-2018-03-01-finals-acs-barker',
    date: '2018-03-01',
    opponentId: 'team-bdiv18-acs-barker',
    fairfieldScore: 72,
    oppScore: 89,
    minRange: [25, 35],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 21,
    rebTotal: 17,
    assists: 2,
    steals: 2,
    blocks: 4,
    fgMade: 8,
    fgAttempted: 14,
    threeMade: 0,
    threeAttempted: 1,
    ftMade: 5,
    ftAttempted: 6,
  },
  {
    id: 'game-bdiv18-2018-03-20-ngee-ann',
    date: '2018-03-20',
    opponentId: 'team-bdiv18-ngee-ann',
    fairfieldScore: 56,
    oppScore: 52,
    minRange: [23, 32],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 14,
    rebTotal: 16,
    assists: 0,
    steals: 2,
    blocks: 3,
    fgMade: 3,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 8,
    ftAttempted: 10,
  },
  {
    id: 'game-bdiv18-2018-03-22-jurong-west',
    date: '2018-03-22',
    opponentId: 'team-bdiv18-jurong-west',
    fairfieldScore: 53,
    oppScore: 36,
    minRange: [20, 30],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 10,
    rebTotal: 8,
    assists: 1,
    steals: 0,
    blocks: 3,
    fgMade: 5,
    fgAttempted: 9,
    threeMade: 0,
    threeAttempted: 1,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-bdiv18-2018-03-26-north-vista',
    date: '2018-03-26',
    opponentId: 'team-bdiv18-north-vista',
    fairfieldScore: 49,
    oppScore: 60,
    minRange: [25, 30],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 12,
    rebTotal: 8,
    assists: 0,
    steals: 0,
    blocks: 2,
    fgMade: 6,
    fgAttempted: 7,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-bdiv18-2018-03-29-presbyterian',
    date: '2018-03-29',
    opponentId: 'team-bdiv18-presbyterian',
    fairfieldScore: 46,
    oppScore: 61,
    minRange: [25, 35],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 14,
    rebTotal: 11,
    assists: 1,
    steals: 0,
    blocks: 1,
    fgMade: 6,
    fgAttempted: 11,
    threeMade: 0,
    threeAttempted: 1,
    ftMade: 2,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-04-02-dunman',
    date: '2018-04-02',
    opponentId: 'team-bdiv18-dunman',
    fairfieldScore: 57,
    oppScore: 40,
    minRange: [5, 15],
    pfRange: [0, 3],
    toRange: [0, 2],
    points: 3,
    rebTotal: 7,
    assists: 0,
    steals: 0,
    blocks: 0,
    fgMade: 1,
    fgAttempted: 6,
    threeMade: 0,
    threeAttempted: 1,
    ftMade: 1,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-04-04-bukit-panjang',
    date: '2018-04-04',
    opponentId: 'team-bdiv18-bukit-panjang',
    fairfieldScore: 69,
    oppScore: 55,
    minRange: [25, 30],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 17,
    rebTotal: 19,
    assists: 2,
    steals: 0,
    blocks: 5,
    fgMade: 8,
    fgAttempted: 15,
    threeMade: 1,
    threeAttempted: 2,
    ftMade: 0,
    ftAttempted: 2,
  },
  {
    id: 'game-bdiv18-2018-04-06-semis-north-vista',
    date: '2018-04-06',
    opponentId: 'team-bdiv18-north-vista',
    fairfieldScore: 47,
    oppScore: 70,
    minRange: [25, 35],
    pfRange: [0, 4],
    toRange: [0, 4],
    points: 14,
    rebTotal: 18,
    assists: 1,
    steals: 0,
    blocks: 1,
    fgMade: 5,
    fgAttempted: 13,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 4,
    ftAttempted: 9,
  },
  {
    id: 'game-bdiv18-2018-04-09-34th-unity',
    date: '2018-04-09',
    opponentId: 'team-bdiv18-unity',
    fairfieldScore: 57,
    oppScore: 66,
    minRange: [5, 15],
    pfRange: [0, 3],
    toRange: [0, 2],
    points: 5,
    rebTotal: 5,
    assists: 0,
    steals: 1,
    blocks: 1,
    fgMade: 2,
    fgAttempted: 3,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
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
  const fouls = randomInt(rng, template.pfRange[0], template.pfRange[1]);
  const turnovers = randomInt(rng, template.toRange[0], template.toRange[1]);
  return { minutesPlayed, fouls, turnovers };
}

const GAMES: CarlGameDef[] = GAME_TEMPLATES.map((template) => {
  const { minutesPlayed, fouls, turnovers } = resolveSyntheticStats(template);
  return { ...template, minutesPlayed, fouls, turnovers };
});

function findBdivDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => /b division/i.test(n));
  if (entry) return join(base, entry);
  return join(base, 'B Division 2018');
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
  fairfieldTeam: TeamMeta,
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
        id: fairfieldTeam.id,
        name: fairfieldTeam.name,
        abbreviation: fairfieldTeam.abbreviation,
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
      homeTeamId: FAIRFIELD_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: tournament.id,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.fairfieldScore, away: game.oppScore },
      homeStarters: [CARL_PLAYER_ID],
      awayStarters: [],
      gameStats: [buildCarlStat(game)],
      teamStats: {
        home: emptyTeamStats(FAIRFIELD_TEAM_ID, game.fairfieldScore),
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

  const fairfieldTeam = data.teams.find((t) => t.id === FAIRFIELD_TEAM_ID);
  if (!fairfieldTeam) {
    throw new Error(`Fairfield team ${FAIRFIELD_TEAM_ID} not found`);
  }

  const fairfieldMeta: TeamMeta = {
    id: fairfieldTeam.id,
    name: fairfieldTeam.name,
    abbreviation: fairfieldTeam.abbreviation,
  };

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  if (!allowExisting) {
    for (const game of GAMES) {
      if (existingGameIds.has(game.id)) {
        throw new Error(
          `Game ${game.id} already exists in Supabase — aborting (use --allow-existing to rewrite JSON)`
        );
      }
    }
  }

  const outDir = join(findBdivDir(), 'json');
  mkdirSync(outDir, { recursive: true });

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: [FAIRFIELD_TEAM_ID, ...(tournament.teams ?? [])],
  };

  console.log(
    `Building ${GAMES.length} Carl-only NSG B Division 2018 game bundles (seed ${RNG_SEED})…\n`
  );

  for (const game of GAMES) {
    const opponent = OPPONENT_BY_ID.get(game.opponentId);
    if (!opponent) {
      throw new Error(`Unknown opponent ${game.opponentId} for ${game.id}`);
    }

    const gameTournamentMeta = {
      ...tournamentMeta,
      teamIds: [...new Set([...tournamentMeta.teamIds, game.opponentId])],
    };

    const bundle = buildBundle(game, gameTournamentMeta, fairfieldMeta, opponent);
    const outPath = join(outDir, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    const stat = bundle.game.gameStats[0];
    console.log(
      `${game.id} | ${game.date} | FMSS ${game.fairfieldScore}-${game.oppScore} vs ${opponent.abbreviation} | Carl ${stat.points}p ${stat.minutes_played}min ${stat.fouls}pf ${stat.turnovers}to`
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

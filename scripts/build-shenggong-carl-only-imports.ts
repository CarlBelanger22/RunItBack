/**
 * Build Carl-only Shenggong Cup 2019 import JSON (5 games, Kai Xuan home).
 *
 * Usage:
 *   npx tsx scripts/build-shenggong-carl-only-imports.ts
 *   npx tsx scripts/build-shenggong-carl-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const KX_TEAM_ID = 'team-1780252086140';
const CARL_PLAYER_ID = 'player-sunig-ntu-22';
const TOURNAMENT_ID = 'tournament-1780771500232';
const RNG_SEED = 20191119;

interface CarlGameDef {
  id: string;
  date: string;
  opponentId: string;
  kxScore: number;
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
  kxScore: number;
  oppScore: number;
  minRange: [number, number];
  fouls: number | [number, number];
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

const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: 'game-shenggong19-2019-11-19-novu-blaze',
    date: '2019-11-19',
    opponentId: 'team-1780771604986',
    kxScore: 51,
    oppScore: 79,
    minRange: [20, 28],
    fouls: [1, 2],
    points: 7,
    rebTotal: 5,
    assists: 2,
    steals: 0,
    blocks: 3,
    turnovers: 0,
    fgMade: 3,
    fgAttempted: 3,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 1,
    ftAttempted: 1,
  },
  {
    id: 'game-shenggong19-2019-11-20-safsa',
    date: '2019-11-20',
    opponentId: 'team-kx-div2-safsa',
    kxScore: 38,
    oppScore: 71,
    minRange: [13, 18],
    fouls: 4,
    points: 4,
    rebTotal: 3,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fgMade: 2,
    fgAttempted: 3,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-shenggong19-2019-11-26-dt-sports',
    date: '2019-11-26',
    opponentId: 'team-1780771652992',
    kxScore: 58,
    oppScore: 70,
    minRange: [20, 28],
    fouls: [1, 2],
    points: 4,
    rebTotal: 12,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 2,
    fgMade: 2,
    fgAttempted: 6,
    threeMade: 0,
    threeAttempted: 2,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-shenggong19-2019-11-27-sba',
    date: '2019-11-27',
    opponentId: 'team-1780430810123',
    kxScore: 70,
    oppScore: 77,
    minRange: [30, 38],
    fouls: [2, 3],
    points: 24,
    rebTotal: 14,
    assists: 0,
    steals: 2,
    blocks: 1,
    turnovers: 2,
    fgMade: 11,
    fgAttempted: 16,
    threeMade: 0,
    threeAttempted: 2,
    ftMade: 2,
    ftAttempted: 3,
  },
  {
    id: 'game-shenggong19-2019-11-30-sba-warriors',
    date: '2019-11-30',
    opponentId: 'team-1780771829979',
    kxScore: 62,
    oppScore: 53,
    minRange: [30, 38],
    fouls: [2, 3],
    points: 12,
    rebTotal: 18,
    assists: 1,
    steals: 2,
    blocks: 1,
    turnovers: 2,
    fgMade: 6,
    fgAttempted: 12,
    threeMade: 0,
    threeAttempted: 2,
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

function resolveMinutesAndFouls(template: GameTemplate): { minutesPlayed: number; fouls: number } {
  const rng = mulberry32(hashSeed(template.id));
  const [minLo, minHi] = template.minRange;
  const minutesPlayed = round1(minLo + rng() * (minHi - minLo));
  const fouls =
    typeof template.fouls === 'number'
      ? template.fouls
      : randomInt(rng, template.fouls[0], template.fouls[1]);
  return { minutesPlayed, fouls };
}

const GAMES: CarlGameDef[] = GAME_TEMPLATES.map((template) => {
  const { minutesPlayed, fouls } = resolveMinutesAndFouls(template);
  return { ...template, minutesPlayed, fouls };
});

function findShenggongDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => /sheng/i.test(n));
  if (entry) return join(base, entry);
  return join(base, 'Shenggong Cup 2019');
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
  kxTeam: TeamMeta,
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
        id: kxTeam.id,
        name: kxTeam.name,
        abbreviation: kxTeam.abbreviation,
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
      homeTeamId: KX_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: tournament.id,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.kxScore, away: game.oppScore },
      homeStarters: [CARL_PLAYER_ID],
      awayStarters: [],
      gameStats: [buildCarlStat(game)],
      teamStats: {
        home: emptyTeamStats(KX_TEAM_ID, game.kxScore),
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

  const kxTeam = teamsById.get(KX_TEAM_ID);
  if (!kxTeam) throw new Error(`Kai Xuan team ${KX_TEAM_ID} not found`);

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  for (const game of GAMES) {
    if (existingGameIds.has(game.id)) {
      throw new Error(
        `Game ${game.id} already exists in Supabase — aborting to avoid overwrite`
      );
    }
  }

  const outDir = join(findShenggongDir(), 'json');
  mkdirSync(outDir, { recursive: true });

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  console.log(`Building ${GAMES.length} Carl-only Shenggong Cup game bundles (seed ${RNG_SEED})…\n`);

  for (const game of GAMES) {
    const opponent = teamsById.get(game.opponentId);
    if (!opponent) {
      throw new Error(`Opponent team ${game.opponentId} not found for ${game.id}`);
    }

    const bundle = buildBundle(game, tournamentMeta, kxTeam, opponent);
    const outPath = join(outDir, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    const stat = bundle.game.gameStats[0];
    console.log(
      `${game.id} | ${game.date} | KX ${game.kxScore}-${game.oppScore} vs ${opponent.name} | Carl ${stat.points}p ${stat.minutes_played}min ${stat.fouls}pf`
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

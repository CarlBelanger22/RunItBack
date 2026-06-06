/**
 * Build Carl-only SAFSA NBL Div 2 2023 import JSON (6 games).
 *
 * Usage:
 *   npx tsx scripts/build-safsa-carl-only-imports.ts
 *   npx tsx scripts/build-safsa-carl-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const SAFSA_TEAM_ID = 'team-kx-div2-safsa';
const CARL_PLAYER_ID = 'player-sunig-ntu-22';
const TOURNAMENT_ID = 'tournament-1780425044074';

interface CarlGameDef {
  id: string;
  date: string;
  opponentId: string;
  safsaScore: number;
  oppScore: number;
  minutesPlayed: number;
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

/** Locked table — seed 20230607 minutes + spreadsheet stats */
const GAMES: CarlGameDef[] = [
  {
    id: 'game-safsa23-2023-04-25-macpherson',
    date: '2023-04-25',
    opponentId: 'team-1780430756170',
    safsaScore: 48,
    oppScore: 62,
    minutesPlayed: 25.3,
    points: 8,
    rebTotal: 6,
    assists: 0,
    steals: 1,
    blocks: 0,
    turnovers: 1,
    fgMade: 4,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-safsa23-2023-05-05-chong-ghee',
    date: '2023-05-05',
    opponentId: 'team-kx-div2-chong-ghee',
    safsaScore: 45,
    oppScore: 66,
    minutesPlayed: 27.2,
    points: 6,
    rebTotal: 8,
    assists: 1,
    steals: 0,
    blocks: 1,
    turnovers: 1,
    fgMade: 3,
    fgAttempted: 7,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-safsa23-2023-05-14-clementi',
    date: '2023-05-14',
    opponentId: 'team-kx-div2-clementi',
    safsaScore: 45,
    oppScore: 62,
    minutesPlayed: 26.9,
    points: 8,
    rebTotal: 13,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fgMade: 4,
    fgAttempted: 11,
    threeMade: 0,
    threeAttempted: 4,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-safsa23-2023-05-16-sinkee',
    date: '2023-05-16',
    opponentId: 'team-kx-div2-skc',
    safsaScore: 84,
    oppScore: 76,
    minutesPlayed: 27.7,
    points: 12,
    rebTotal: 12,
    assists: 1,
    steals: 1,
    blocks: 2,
    turnovers: 3,
    fgMade: 4,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 4,
    ftAttempted: 6,
  },
  {
    id: 'game-safsa23-2023-05-21-sba',
    date: '2023-05-21',
    opponentId: 'team-1780430810123',
    safsaScore: 55,
    oppScore: 92,
    minutesPlayed: 23.7,
    points: 8,
    rebTotal: 11,
    assists: 1,
    steals: 0,
    blocks: 2,
    turnovers: 2,
    fgMade: 4,
    fgAttempted: 8,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  },
  {
    id: 'game-safsa23-2023-05-23-kai-xuan',
    date: '2023-05-23',
    opponentId: 'team-1780252086140',
    safsaScore: 57,
    oppScore: 85,
    minutesPlayed: 25.5,
    points: 23,
    rebTotal: 15,
    assists: 1,
    steals: 0,
    blocks: 1,
    turnovers: 2,
    fgMade: 9,
    fgAttempted: 17,
    threeMade: 3,
    threeAttempted: 4,
    ftMade: 2,
    ftAttempted: 2,
  },
];

function findSafsaDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => n.startsWith('SAFSA Div2'));
  if (!entry) throw new Error('SAFSA Div2 folder not found under Importingboxscores');
  return join(base, entry);
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
    fouls: 1,
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
  safsaTeam: TeamMeta,
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
        id: safsaTeam.id,
        name: safsaTeam.name,
        abbreviation: safsaTeam.abbreviation,
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
      homeTeamId: SAFSA_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: tournament.id,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.safsaScore, away: game.oppScore },
      homeStarters: [CARL_PLAYER_ID],
      awayStarters: [],
      gameStats: [buildCarlStat(game)],
      teamStats: {
        home: emptyTeamStats(SAFSA_TEAM_ID, game.safsaScore),
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

  const safsaTeam = teamsById.get(SAFSA_TEAM_ID);
  if (!safsaTeam) throw new Error(`SAFSA team ${SAFSA_TEAM_ID} not found`);

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  for (const game of GAMES) {
    if (existingGameIds.has(game.id)) {
      throw new Error(
        `Game ${game.id} already exists in Supabase — aborting to avoid overwrite`
      );
    }
  }

  const safsaDir = findSafsaDir();
  const outDir = join(safsaDir, 'json');
  mkdirSync(outDir, { recursive: true });

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  console.log(`Building ${GAMES.length} Carl-only SAFSA game bundles…\n`);

  for (const game of GAMES) {
    const opponent = teamsById.get(game.opponentId);
    if (!opponent) {
      throw new Error(`Opponent team ${game.opponentId} not found for ${game.id}`);
    }

    const bundle = buildBundle(game, tournamentMeta, safsaTeam, opponent);
    const outPath = join(outDir, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    const stat = bundle.game.gameStats[0];
    console.log(
      `${game.id} | ${game.date} | SAFSA ${game.safsaScore}-${game.oppScore} vs ${opponent.name} | Carl ${stat.points}p ${stat.minutes_played}min`
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

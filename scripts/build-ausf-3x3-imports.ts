/**
 * Build AUSF 3x3 NTU import JSON (4 games, 3–4 players per game).
 *
 * Usage:
 *   npx tsx scripts/build-ausf-3x3-imports.ts
 *   npx tsx scripts/build-ausf-3x3-imports.ts --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  compute3x3Points,
  parseMmSsMinutes,
} from '../src/utils/basketball3x3Scoring';

const NTU_TEAM_ID = 'team-sunig-ntu';
const TOURNAMENT_ID = 'tournament-1782412204083';

const PLAYER_BY_NUMBER: Record<number, string> = {
  22: 'player-sunig-ntu-22',
  4: 'player-sunig-ntu-4',
  30: 'player-1781194731488',
  21: 'player-sunig-ntu-21',
};

interface GameDef {
  id: string;
  date: string;
  opponentId: string;
  ntuScore: number;
  oppScore: number;
  csvFile: string;
  minutesKey: string;
}

const GAMES: GameDef[] = [
  {
    id: 'game-ausf3x3-2026-06-12-ntu-macau',
    date: '2026-06-12',
    opponentId: 'team-1782412934842',
    ntuScore: 12,
    oppScore: 19,
    csvFile: 'Macau vs NTU 3x3 box-scores-21 Jun 2026.csv',
    minutesKey: 'macau',
  },
  {
    id: 'game-ausf3x3-2026-06-12-ntu-moratuwa',
    date: '2026-06-12',
    opponentId: 'team-1782412977862',
    ntuScore: 21,
    oppScore: 11,
    csvFile: 'Sri Lanka vs NTU 3x3 box-scores-22 Jun 2026.csv',
    minutesKey: 'moratuwa',
  },
  {
    id: 'game-ausf3x3-2026-06-13-ntu-tribhuwan',
    date: '2026-06-13',
    opponentId: 'team-1782413009033',
    ntuScore: 17,
    oppScore: 21,
    csvFile: 'Nepal vs NTU 3x3 box-scores-22 Jun 2026.csv',
    minutesKey: 'tribhuwan',
  },
  {
    id: 'game-ausf3x3-2026-06-13-ntu-iau',
    date: '2026-06-13',
    opponentId: 'team-1782413061536',
    ntuScore: 15,
    oppScore: 17,
    csvFile: 'Iran vs NTU 3x3 box-scores-22 Jun 2026.csv',
    minutesKey: 'iau',
  },
];

/** User-provided minutes (MM.SS). Kovan omitted vs Moratuwa = DNP. */
const MINUTES: Record<string, Record<number, string>> = {
  macau: { 22: '7.24', 4: '8.25', 30: '9.08', 21: '5.03' },
  moratuwa: { 22: '10', 4: '10', 30: '10' },
  tribhuwan: { 22: '7.33', 4: '8.27', 30: '7.13', 21: '2.17' },
  iau: { 22: '8.24', 4: '9.42', 30: '9.17', 21: '2.37' },
};

interface ParsedPlayerLine {
  number: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  orb: number;
  drb: number;
  fouls: number;
  steals: number;
  turnovers: number;
  blocks: number;
  assists: number;
}

function findAusfDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => /ausf.*3x3/i.test(n));
  if (entry) return join(base, entry);
  return join(base, 'AUSF 3x3');
}

function parseCsvFields(line: string): string[] {
  const matches = line.match(/"([^"]*)"/g);
  if (!matches) return [];
  return matches.map((s) => s.slice(1, -1).trim());
}

function parseMadeAttempted(raw: string): { made: number; attempted: number } | null {
  const t = raw.trim();
  if (!t || t === '-') return null;
  const m = t.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  return { made: parseInt(m[1], 10), attempted: parseInt(m[2], 10) };
}

function parseIntField(raw: string): number {
  const t = raw.trim();
  if (!t || t === '-') return 0;
  return parseInt(t, 10) || 0;
}

function parseNtuPlayerLines(csvPath: string): ParsedPlayerLine[] {
  const content = readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim());
  const out: ParsedPlayerLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvFields(lines[i]);
    if (fields.length < 15) continue;

    const playerCell = fields[0];
    const numMatch = playerCell.match(/#\s*(\d+)/);
    if (!numMatch) continue;

    const number = parseInt(numMatch[1], 10);
    if (!(number in PLAYER_BY_NUMBER)) continue;

    const fg = parseMadeAttempted(fields[1]);
    if (!fg) continue;

    const three = parseMadeAttempted(fields[3]) ?? { made: 0, attempted: 0 };
    const ft = parseMadeAttempted(fields[5]) ?? { made: 0, attempted: 0 };

    out.push({
      number,
      fgMade: fg.made,
      fgAttempted: fg.attempted,
      threeMade: three.made,
      threeAttempted: three.attempted,
      ftMade: ft.made,
      ftAttempted: ft.attempted,
      orb: parseIntField(fields[7]),
      drb: parseIntField(fields[8]),
      fouls: parseIntField(fields[9]),
      steals: parseIntField(fields[10]),
      turnovers: parseIntField(fields[11]),
      blocks: parseIntField(fields[12]),
      assists: parseIntField(fields[13]),
    });
  }

  return out;
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

interface TeamMeta {
  id: string;
  name: string;
  abbreviation: string;
}

function buildGameStat(
  playerId: string,
  line: ParsedPlayerLine,
  minutesPlayed: number
) {
  return {
    playerId,
    points: compute3x3Points(line.fgMade, line.threeMade, line.ftMade),
    fg_made: line.fgMade,
    fg_attempted: line.fgAttempted,
    three_made: line.threeMade,
    three_attempted: line.threeAttempted,
    ft_made: line.ftMade,
    ft_attempted: line.ftAttempted,
    orb: line.orb,
    drb: line.drb,
    assists: line.assists,
    steals: line.steals,
    blocks: line.blocks,
    turnovers: line.turnovers,
    fouls: line.fouls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: minutesPlayed,
  };
}

function buildBundle(
  game: GameDef,
  playerLines: ParsedPlayerLine[],
  tournament: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
  },
  ntuTeam: TeamMeta,
  opponentTeam: TeamMeta
) {
  const minutesMap = MINUTES[game.minutesKey] ?? {};
  const gameStats = playerLines.map((line) => {
    const playerId = PLAYER_BY_NUMBER[line.number];
    const rawMin = minutesMap[line.number];
    if (!rawMin) {
      throw new Error(
        `Missing minutes for #${line.number} in ${game.id} (${game.minutesKey})`
      );
    }
    return buildGameStat(playerId, line, parseMmSsMinutes(rawMin));
  });

  const ntuPointsFromStats = gameStats.reduce((s, r) => s + r.points, 0);
  if (ntuPointsFromStats !== game.ntuScore) {
    throw new Error(
      `${game.id}: 3x3 player pts sum ${ntuPointsFromStats} !== screenshot NTU ${game.ntuScore}`
    );
  }

  const starters = gameStats.map((s) => s.playerId);

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
        id: ntuTeam.id,
        name: ntuTeam.name,
        abbreviation: ntuTeam.abbreviation,
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
      homeTeamId: NTU_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: tournament.id,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.ntuScore, away: game.oppScore },
      homeStarters: starters,
      awayStarters: [],
      gameStats,
      teamStats: {
        home: emptyTeamStats(NTU_TEAM_ID, game.ntuScore),
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

  const ausfDir = findAusfDir();
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

  const ntuTeam = teamsById.get(NTU_TEAM_ID);
  if (!ntuTeam) throw new Error(`NTU team ${NTU_TEAM_ID} not found`);

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  for (const game of GAMES) {
    if (existingGameIds.has(game.id)) {
      throw new Error(
        `Game ${game.id} already exists in Supabase — aborting to avoid overwrite`
      );
    }
  }

  const outDir = join(ausfDir, 'json');
  mkdirSync(outDir, { recursive: true });

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  console.log(`Building ${GAMES.length} AUSF 3x3 NTU game bundles…\n`);

  for (const game of GAMES) {
    const opponent = teamsById.get(game.opponentId);
    if (!opponent) {
      throw new Error(`Opponent ${game.opponentId} not found for ${game.id}`);
    }

    const csvPath = join(ausfDir, game.csvFile);
    const playerLines = parseNtuPlayerLines(csvPath);
    const bundle = buildBundle(game, playerLines, tournamentMeta, ntuTeam, opponent);
    const outPath = join(outDir, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    const pts = bundle.game.gameStats.map(
      (s) => `${s.playerId.split('-').pop()}=${s.points}`
    );
    console.log(
      `${game.id} | ${game.date} | NTU ${game.ntuScore}-${game.oppScore} vs ${opponent.abbreviation} | ${bundle.game.gameStats.length} players | ${pts.join(' ')}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
  } else {
    console.log(`\nWrote ${GAMES.length} files to ${outDir}`);
    console.log('Import each: npm run import:boxscore -- --file "<path>" --stats-only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

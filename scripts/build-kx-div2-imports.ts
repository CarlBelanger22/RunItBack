/**
 * Build KX Div2 '24 import JSON bundles from Easy Stats HTML + minutes spreadsheet.
 *
 * Usage:
 *   npx tsx scripts/build-kx-div2-imports.ts
 *   npx tsx scripts/build-kx-div2-imports.ts --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const KX_TEAM_ID = 'team-1780252086140';
const TOURNAMENT_ID = 'tournament-1780251377063';
const TOURNAMENT_NAME = 'National Basketball League (Men) Division 2 2024';

/** HTML first-name / nickname → existing player_id */
const PLAYER_ID_BY_HTML_NAME: Record<string, string> = {
  Ram: 'player-1780304603336',
  Jeremy: 'player-sunig-ntu-10',
  Chenbin: 'player-1780304739111',
  Atif: 'player-1780304716969',
  Haniel: 'player-ivp-ntu-12',
  Enmao: 'player-1780304645177',
  Vernen: 'player-1780304779628',
  Vernon: 'player-1780304779628',
  Stuwat: 'player-1780304796452',
  Sean: 'player-1780304751492',
  Wilbur: 'player-1780304864245',
  Zhanxian: 'player-1780304849666',
  Russell: 'player-1780304765434',
  Carl: 'player-sunig-ntu-22',
  Liam: 'player-1780304831954',
  Bryan: 'player-1780304627049',
};

const OPPONENTS = [
  { id: 'team-kx-div2-amity', name: 'Amity', abbreviation: 'AMT' },
  { id: 'team-kx-div2-kts', name: 'KTS', abbreviation: 'KTS' },
  { id: 'team-kx-div2-police', name: 'Police', abbreviation: 'POL' },
  { id: 'team-kx-div2-gmac', name: 'GMAC', abbreviation: 'GMAC' },
  { id: 'team-kx-div2-chong-ghee', name: 'Chong Ghee', abbreviation: 'CG' },
  { id: 'team-kx-div2-safsa', name: 'SAFSA', abbreviation: 'SAFSA' },
  { id: 'team-kx-div2-tungsan', name: 'Tungsan', abbreviation: 'TGS' },
  { id: 'team-kx-div2-loaded', name: 'Loaded', abbreviation: 'LOAD' },
  { id: 'team-kx-div2-tampines-east', name: 'Tampines East', abbreviation: 'TPE' },
  { id: 'team-kx-div2-clementi', name: 'Clementi', abbreviation: 'CLEM' },
  { id: 'team-kx-div2-skc', name: 'SinKee', abbreviation: 'SKC' },
] as const;

interface GameDef {
  id: string;
  date: string;
  opponentId: string;
  kxScore: number;
  oppScore: number;
  htmlFile?: string;
  walkover?: boolean;
}

const GAMES: GameDef[] = [
  {
    id: 'game-kx-div2-2024-04-03-amity',
    date: '2024-04-03',
    opponentId: 'team-kx-div2-amity',
    kxScore: 68,
    oppScore: 42,
    htmlFile: 'KX vs Amity 010424.html',
  },
  {
    id: 'game-kx-div2-2024-04-06-kts',
    date: '2024-04-06',
    opponentId: 'team-kx-div2-kts',
    kxScore: 56,
    oppScore: 47,
    htmlFile: 'KX vs KTS 050424.html',
  },
  {
    id: 'game-kx-div2-2024-04-14-police',
    date: '2024-04-14',
    opponentId: 'team-kx-div2-police',
    kxScore: 59,
    oppScore: 67,
    htmlFile: 'KX vs Police 100424.html',
  },
  {
    id: 'game-kx-div2-2024-04-15-gmac',
    date: '2024-04-15',
    opponentId: 'team-kx-div2-gmac',
    kxScore: 67,
    oppScore: 56,
    htmlFile: 'KX vs GMAC 140424.html',
  },
  {
    id: 'game-kx-div2-2024-04-27-chong-ghee',
    date: '2024-04-27',
    opponentId: 'team-kx-div2-chong-ghee',
    kxScore: 55,
    oppScore: 51,
    htmlFile: 'KX vs Chong Ghee 210424.html',
  },
  {
    id: 'game-kx-div2-2024-05-01-safsa',
    date: '2024-05-01',
    opponentId: 'team-kx-div2-safsa',
    kxScore: 50,
    oppScore: 58,
    htmlFile: 'KX vs SAFSA 280424.html',
  },
  {
    id: 'game-kx-div2-2024-05-06-tungsan',
    date: '2024-05-06',
    opponentId: 'team-kx-div2-tungsan',
    kxScore: 54,
    oppScore: 69,
    htmlFile: 'KX vs Tungsan 020524.html',
  },
  {
    id: 'game-kx-div2-2024-05-04-loaded',
    date: '2024-05-04',
    opponentId: 'team-kx-div2-loaded',
    kxScore: 61,
    oppScore: 67,
    htmlFile: 'KX vs Loaded 040524.html',
  },
  {
    id: 'game-kx-div2-2024-05-07-tampines-east',
    date: '2024-05-07',
    opponentId: 'team-kx-div2-tampines-east',
    kxScore: 20,
    oppScore: 0,
    walkover: true,
  },
  {
    id: 'game-kx-div2-2024-05-12-clementi',
    date: '2024-05-12',
    opponentId: 'team-kx-div2-clementi',
    kxScore: 52,
    oppScore: 41,
    htmlFile: 'KX vs Clementi 110524.html',
  },
  {
    id: 'game-kx-div2-2024-05-30-skc',
    date: '2024-05-30',
    opponentId: 'team-kx-div2-skc',
    kxScore: 71,
    oppScore: 67,
    htmlFile: 'KX vs SinKee 150524.html',
  },
  {
    id: 'game-kx-div2-2024-06-03-tungsan',
    date: '2024-06-03',
    opponentId: 'team-kx-div2-tungsan',
    kxScore: 45,
    oppScore: 87,
    htmlFile: 'Tungsan vs KaiXuan box-scores-18 may 2024.html',
  },
  {
    id: 'game-kx-div2-2024-05-31-clementi',
    date: '2024-05-31',
    opponentId: 'team-kx-div2-clementi',
    kxScore: 57,
    oppScore: 56,
    htmlFile: 'KX vs Clementi 3:4 200524.html',
  },
];

function findKxDiv2Dir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => n.startsWith('KX Div2'));
  if (!entry) throw new Error('KX Div2 folder not found under Importingboxscores');
  return join(base, entry);
}

function parseMadeAttempted(raw: string): { made: number; attempted: number } {
  if (!raw || raw === '-' || raw.trim() === '') return { made: 0, attempted: 0 };
  const [m, a] = raw.split('-').map((s) => parseInt(s.trim(), 10));
  return {
    made: Number.isFinite(m) ? m : 0,
    attempted: Number.isFinite(a) ? a : 0,
  };
}

function parseIntCell(raw: string): number {
  if (!raw || raw === '-') return 0;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function hmsToDecimalMinutes(hms: string): number {
  const parts = hms.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  return 0;
}

interface ParsedPlayerStat {
  htmlName: string;
  number: number;
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  fouls: number;
  steals: number;
  turnovers: number;
  blocks: number;
  assists: number;
}

function parseHtmlStats(htmlPath: string): ParsedPlayerStat[] {
  const html = readFileSync(htmlPath, 'utf8');
  const rows = [...html.matchAll(/<tr><td>#(\d+)\s+([^<]+)<\/td>(.*?)<\/tr>/gs)];
  const stats: ParsedPlayerStat[] = [];

  for (const row of rows) {
    const number = parseInt(row[1], 10);
    const htmlName = row[2].trim().split(/\s+/)[0];
    const cells = [...row[3].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1].trim());
    if (cells.length < 14) continue;

    const htmlNameLower = htmlName.toLowerCase();
    if (htmlNameLower === 'kaixuan' || htmlNameLower === 'kai') continue;

    const ptsIdx = cells.length >= 15 ? 14 : 13;
    const pts = parseIntCell(cells[ptsIdx]);
    if (cells[0] === '-' && pts === 0) continue;

    const fg = parseMadeAttempted(cells[0]);
    const three = parseMadeAttempted(cells[2]);
    const ft = parseMadeAttempted(cells[4]);

    stats.push({
      htmlName,
      number,
      points: pts,
      fg_made: fg.made,
      fg_attempted: fg.attempted,
      three_made: three.made,
      three_attempted: three.attempted,
      ft_made: ft.made,
      ft_attempted: ft.attempted,
      orb: parseIntCell(cells[6]),
      drb: parseIntCell(cells[7]),
      fouls: parseIntCell(cells[8]),
      steals: parseIntCell(cells[9]),
      turnovers: parseIntCell(cells[10]),
      blocks: parseIntCell(cells[11]),
      assists: parseIntCell(cells[Math.min(12, cells.length - 2)]),
    });
  }

  return stats;
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

function buildGameStat(
  playerId: string,
  parsed: ParsedPlayerStat,
  minutesPlayed: number
) {
  return {
    playerId,
    points: parsed.points,
    fg_made: parsed.fg_made,
    fg_attempted: parsed.fg_attempted,
    three_made: parsed.three_made,
    three_attempted: parsed.three_attempted,
    ft_made: parsed.ft_made,
    ft_attempted: parsed.ft_attempted,
    orb: parsed.orb,
    drb: parsed.drb,
    assists: parsed.assists,
    steals: parsed.steals,
    blocks: parsed.blocks,
    turnovers: parsed.turnovers,
    fouls: parsed.fouls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: minutesPlayed,
  };
}

function topStarters(
  gameStats: { playerId: string; minutes_played: number }[]
): string[] {
  return [...gameStats]
    .sort((a, b) => b.minutes_played - a.minutes_played)
    .slice(0, 5)
    .map((s) => s.playerId);
}

function buildBundle(
  game: GameDef,
  minutesByGame: Record<string, Record<string, string>>,
  kxDir: string
) {
  const opponent = OPPONENTS.find((o) => o.id === game.opponentId)!;
  const teamIds = [KX_TEAM_ID, ...OPPONENTS.map((o) => o.id)];

  let gameStats: ReturnType<typeof buildGameStat>[] = [];

  if (!game.walkover && game.htmlFile) {
    const parsed = parseHtmlStats(join(kxDir, game.htmlFile));
    const minutesForGame = minutesByGame[game.id] ?? {};

    for (const row of parsed) {
      const playerId = PLAYER_ID_BY_HTML_NAME[row.htmlName];
      if (!playerId) {
        throw new Error(`No player_id for HTML name "${row.htmlName}" in ${game.id}`);
      }
      const hms = minutesForGame[row.htmlName];
      if (!hms) {
        throw new Error(`No minutes for ${row.htmlName} in ${game.id}`);
      }
      gameStats.push(buildGameStat(playerId, row, hmsToDecimalMinutes(hms)));
    }
  }

  const homeStarters = topStarters(gameStats);

  return {
    version: '1',
    tournament: {
      id: TOURNAMENT_ID,
      name: TOURNAMENT_NAME,
      year: 2024,
      month: 'Apr',
      teamIds,
    },
    teams: [
      {
        id: KX_TEAM_ID,
        name: 'Kai Xuan',
        abbreviation: 'KX',
        currentTournamentId: TOURNAMENT_ID,
        players: [],
      },
      ...OPPONENTS.map((o) => ({
        id: o.id,
        name: o.name,
        abbreviation: o.abbreviation,
        currentTournamentId: TOURNAMENT_ID,
        players: [],
      })),
    ],
    game: {
      id: game.id,
      homeTeamId: KX_TEAM_ID,
      awayTeamId: game.opponentId,
      tournamentId: TOURNAMENT_ID,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.kxScore, away: game.oppScore },
      homeStarters,
      awayStarters: [],
      gameStats,
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

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const kxDir = findKxDiv2Dir();
  const minutesPath = join(kxDir, 'kx-div2-minutes.json');
  const minutesByGame = JSON.parse(readFileSync(minutesPath, 'utf8')) as Record<
    string,
    Record<string, string>
  >;

  const outDir = join(kxDir, 'json');
  if (!dryRun) mkdirSync(outDir, { recursive: true });

  console.log('KX Div2 import bundle builder');
  console.log(`Source: ${kxDir}\n`);

  for (const game of GAMES) {
    const bundle = buildBundle(game, minutesByGame, kxDir);
    const outPath = join(outDir, `${game.id}.json`);
    const statCount = bundle.game.gameStats.length;
    const pts = bundle.game.gameStats.reduce((s, r) => s + r.points, 0);

    console.log(
      `${game.id}: ${statCount} KX stat lines, ${pts} pts (expected ${game.kxScore})${
        game.walkover ? ' [walkover]' : ''
      }`
    );

    if (!dryRun) {
      writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n');
    }
  }

  console.log(dryRun ? '\nDry run — no files written.' : `\nWrote ${GAMES.length} JSON files to ${outDir}`);
}

main();

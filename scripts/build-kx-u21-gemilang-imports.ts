/**
 * Build Kai Xuan U21 Gemilang Cup import JSON from Easy Stats HTML.
 *
 * Usage:
 *   npx tsx scripts/build-kx-u21-gemilang-imports.ts
 *   npx tsx scripts/build-kx-u21-gemilang-imports.ts --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const KX_TEAM_ID = 'team-1780252086140';
const TOURNAMENT_ID = 'tournament-1780333884144';
const TOURNAMENT_NAME = 'Gemilang Cup U21';

/** Normalized first name → player_id (match by name on KX roster) */
const PLAYER_ID_BY_NAME: Record<string, string> = {
  Joseph: 'player-1780334094539',
  Haniel: 'player-ivp-ntu-12',
  Andre: 'player-1780334746693',
  Carl: 'player-sunig-ntu-22',
  Jeremy: 'player-sunig-ntu-10',
  Bryan: 'player-1780304627049',
  Jeffers: 'player-1780334394024',
  Jacque: 'player-1780334187237',
  Leyang: 'player-1780333982323',
  Liam: 'player-1780304831954',
  William: 'player-1780334415628',
  Jaiganesh: 'player-1780334160259',
  Russell: 'player-1780304765434',
  Scott: 'player-1780334235067',
  Siuchun: 'player-1780334320731',
  Clarence: 'player-1780334349882',
  Terrell: 'player-1780334301157',
  Collin: 'player-1780334256782',
  Mingyao: 'player-1780334203592',
};

const OPPONENTS = [
  { id: 'team-kx-u21-skudai', name: 'Skudai', abbreviation: 'SKD' },
  { id: 'team-kx-u21-xinshinai', name: '新士乃', abbreviation: 'XSN' },
  { id: 'team-kx-u21-gemilang', name: 'Gemilang', abbreviation: 'GEM' },
  { id: 'team-kx-u21-sunway', name: 'Sunway', abbreviation: 'SUN' },
  { id: 'team-kx-u21-dianfeng', name: 'DianFeng', abbreviation: 'DF' },
] as const;

interface GameDef {
  id: string;
  date: string;
  opponentId: string;
  kxScore: number;
  oppScore: number;
  htmlFile: string;
}

const GAMES: GameDef[] = [
  {
    id: 'game-kx-u21-2023-06-04-skudai',
    date: '2023-06-04',
    opponentId: 'team-kx-u21-skudai',
    kxScore: 86,
    oppScore: 41,
    htmlFile: 'Kaixuan U21 vs Skudai 030623.html',
  },
  {
    id: 'game-kx-u21-2023-06-12-xinshinai',
    date: '2023-06-12',
    opponentId: 'team-kx-u21-xinshinai',
    kxScore: 69,
    oppScore: 71,
    htmlFile: 'Kaixuan U21 vs 新士乃 110623.html',
  },
  {
    id: 'game-kx-u21-2023-06-13-gemilang',
    date: '2023-06-13',
    opponentId: 'team-kx-u21-gemilang',
    kxScore: 92,
    oppScore: 75,
    htmlFile: 'Kaixuan U21 vs Gemilang 110623.html',
  },
  {
    id: 'game-kx-u21-2023-06-19-sunway',
    date: '2023-06-19',
    opponentId: 'team-kx-u21-sunway',
    kxScore: 99,
    oppScore: 30,
    htmlFile: 'Kaixuan U21 vs Sunway 180623.html',
  },
  {
    id: 'game-kx-u21-2023-06-26-dianfeng',
    date: '2023-06-26',
    opponentId: 'team-kx-u21-dianfeng',
    kxScore: 61,
    oppScore: 62,
    htmlFile: 'Kaixuan U21 vs DianFeng 240623.html',
  },
];

interface GameConfig {
  kxIsHome: boolean;
  starters: string[];
  omit: string[];
}

function findU21Dir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => n.includes('U21 Gemilang'));
  if (!entry) throw new Error('U21 Gemilang Cup folder not found under Importingboxscores');
  return join(base, entry);
}

function normalizeName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  const first = parts[0];
  if (first === 'Ming' && parts[1]?.toLowerCase().startsWith('yao')) return 'Mingyao';
  if (first === 'Siu' && parts[1]?.toLowerCase().startsWith('chun')) return 'Siuchun';
  if (first === 'Ming') return 'Mingyao';
  return first;
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

interface ParsedPlayerStat {
  htmlName: string;
  normalizedName: string;
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

function hasBoxScoreActivity(parsed: ParsedPlayerStat): boolean {
  return (
    parsed.points > 0 ||
    parsed.fg_attempted > 0 ||
    parsed.three_attempted > 0 ||
    parsed.ft_attempted > 0 ||
    parsed.orb + parsed.drb > 0 ||
    parsed.assists > 0 ||
    parsed.steals > 0 ||
    parsed.blocks > 0 ||
    parsed.turnovers > 0
  );
}

function parseHtmlStats(htmlPath: string, htmlFile: string): ParsedPlayerStat[] {
  const html = readFileSync(htmlPath, 'utf8');
  const rows = [...html.matchAll(/<tr><td>#(\d+)\s+([^<]+)<\/td>(.*?)<\/tr>/gs)];
  const stats: ParsedPlayerStat[] = [];

  for (const row of rows) {
    const number = parseInt(row[1], 10);
    const rawName = row[2].trim();
    const normalizedName = normalizeName(rawName);
    const htmlName = rawName.split(/\s+/)[0];

    if (normalizedName.toLowerCase() === 'kaixuan' || htmlName.toLowerCase() === 'kai') {
      continue;
    }

    // Liam #16 on Skudai only — wrong jersey, DNP
    if (number === 16 && normalizedName === 'Liam' && htmlFile.includes('Skudai')) {
      continue;
    }

    const cells = [...row[3].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1].trim());
    if (cells.length < 14) continue;

    const ptsIdx = cells.length >= 15 ? 14 : 13;
    const pts = parseIntCell(cells[ptsIdx]);
    const fg = parseMadeAttempted(cells[0]);
    const three = parseMadeAttempted(cells[2]);
    const ft = parseMadeAttempted(cells[4]);

    const parsed: ParsedPlayerStat = {
      htmlName,
      normalizedName,
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
    };

    if (!hasBoxScoreActivity(parsed)) continue;

    stats.push(parsed);
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

function buildGameStat(playerId: string, parsed: ParsedPlayerStat, minutesPlayed: number) {
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

function resolvePlayerId(normalizedName: string): string {
  const id = PLAYER_ID_BY_NAME[normalizedName];
  if (!id) {
    throw new Error(`No player_id for "${normalizedName}"`);
  }
  return id;
}

function buildBundle(
  game: GameDef,
  gameConfig: GameConfig,
  mpgByName: Record<string, number>,
  u21Dir: string
) {
  const teamIds = [KX_TEAM_ID, ...OPPONENTS.map((o) => o.id)];
  const omitSet = new Set(gameConfig.omit);
  const parsed = parseHtmlStats(join(u21Dir, game.htmlFile), game.htmlFile);

  const gameStats: ReturnType<typeof buildGameStat>[] = [];

  for (const row of parsed) {
    if (omitSet.has(row.normalizedName)) continue;

    const playerId = resolvePlayerId(row.normalizedName);
    const mpg = mpgByName[row.normalizedName];
    if (mpg === undefined) {
      throw new Error(`No tournament MPG for ${row.normalizedName} in ${game.id}`);
    }
    gameStats.push(buildGameStat(playerId, row, mpg));
  }

  const starterIds = gameConfig.starters.map((name) => {
    const id = PLAYER_ID_BY_NAME[name];
    if (!id) throw new Error(`Unknown starter name "${name}" in ${game.id}`);
    return id;
  });

  const kxIsHome = gameConfig.kxIsHome;
  const homeTeamId = kxIsHome ? KX_TEAM_ID : game.opponentId;
  const awayTeamId = kxIsHome ? game.opponentId : KX_TEAM_ID;
  const homeScore = kxIsHome ? game.kxScore : game.oppScore;
  const awayScore = kxIsHome ? game.oppScore : game.kxScore;

  return {
    version: '1',
    tournament: {
      id: TOURNAMENT_ID,
      name: TOURNAMENT_NAME,
      year: 2023,
      month: 'Jun',
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
      homeTeamId,
      awayTeamId,
      tournamentId: TOURNAMENT_ID,
      date: game.date,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: homeScore, away: awayScore },
      homeStarters: kxIsHome ? starterIds : [],
      awayStarters: kxIsHome ? [] : starterIds,
      gameStats,
      teamStats: {
        home: emptyTeamStats(homeTeamId, homeScore),
        away: emptyTeamStats(awayTeamId, awayScore),
      },
      shots: [],
      events: [],
      lineupStints: [],
    },
  };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const u21Dir = findU21Dir();
  const mpgByName = JSON.parse(
    readFileSync(join(u21Dir, 'kx-u21-gemilang-mpg.json'), 'utf8')
  ) as Record<string, number>;
  const gameConfigById = JSON.parse(
    readFileSync(join(u21Dir, 'kx-u21-game-config.json'), 'utf8')
  ) as Record<string, GameConfig>;

  const outDir = join(u21Dir, 'json');
  if (!dryRun) mkdirSync(outDir, { recursive: true });

  console.log('KX U21 Gemilang import bundle builder');
  console.log(`Source: ${u21Dir}\n`);

  for (const game of GAMES) {
    const cfg = gameConfigById[game.id];
    if (!cfg) throw new Error(`Missing game config for ${game.id}`);

    const bundle = buildBundle(game, cfg, mpgByName, u21Dir);
    const outPath = join(outDir, `${game.id}.json`);
    const statCount = bundle.game.gameStats.length;
    const pts = bundle.game.gameStats.reduce((s, r) => s + r.points, 0);
    const side = cfg.kxIsHome ? 'home' : 'away';

    console.log(
      `${game.id}: ${statCount} KX stat lines, ${pts} pts (expected ${game.kxScore}), KX ${side}`
    );

    if (!dryRun) {
      writeFileSync(outPath, JSON.stringify(bundle, null, 2));
    }
  }

  if (!dryRun) {
    console.log(`\nWrote ${GAMES.length} JSON files to ${outDir}`);
  }
}

main();

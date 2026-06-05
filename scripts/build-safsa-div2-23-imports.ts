/**
 * Build SAFSA NBL Div 2 2023 import JSON from Easy Stats HTML + synthetic minutes.
 *
 * Usage:
 *   npx tsx scripts/build-safsa-div2-23-imports.ts
 *   npx tsx scripts/build-safsa-div2-23-imports.ts --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const SAFSA_TEAM_ID = 'team-kx-div2-safsa';
const TOURNAMENT_ID = 'tournament-1780425044074';
const TOTAL_TEAM_MINUTES = 200;
const CROSS_CLUB_FALLBACK_MPG = 18;

const CROSS_CLUB_PLAYER_IDS = new Set([
  'player-sunig-ntu-22',
  'player-sunig-ntu-1',
  'player-ivp-ntu-11',
]);

/** Full HTML nickname (after jersey #) → player_id */
const PLAYER_ID_BY_HTML_NAME: Record<string, string> = {
  'Jing Jie': 'player-sunig-ntu-1',
  Jerel: 'player-1780430969043',
  'Jun Wei': 'player-1780430866865',
  Glen: 'player-ivp-ntu-11',
  Andy: 'player-1780482964172',
  Carl: 'player-sunig-ntu-22',
  'Zhi Kang': 'player-1780483061760',
  Albert: 'player-1780431036739',
  Abel: 'player-1780431067944',
  Kynan: 'player-1780483138222',
  Ernest: 'player-1780482931133',
  Eldridge: 'player-1780482892675',
  Jonah: 'player-1780483098031',
  Javier: 'player-1780431100788',
  'Wee Kong': 'player-1780483029327',
};

const SKIP_STAT_NAMES = new Set(
  [
    'SAFSA Arion',
    'SAFSA',
    'MOB Basketball',
    'KTS Black',
    'Police SA 2',
    'PoliceSA 2',
    'Tungsan YH',
    'TungsanYH',
  ].map((n) => n.toLowerCase())
);

interface GameDef {
  id: string;
  date: string;
  opponentId: string;
  safsaScore: number;
  oppScore: number;
  htmlFile: string;
}

const GAMES: GameDef[] = [
  {
    id: 'game-safsa23-2023-03-22-kts',
    date: '2023-03-22',
    opponentId: 'team-kx-div2-kts',
    safsaScore: 65,
    oppScore: 61,
    htmlFile: 'SAFSA vs KTS Black 220323.html',
  },
  {
    id: 'game-safsa23-2023-04-02-police',
    date: '2023-04-02',
    opponentId: 'team-kx-div2-police',
    safsaScore: 69,
    oppScore: 53,
    htmlFile: 'SAFSA vs PoliceSA 2 020423.html',
  },
  {
    id: 'game-safsa23-2023-04-16-tungsan',
    date: '2023-04-16',
    opponentId: 'team-kx-div2-tungsan',
    safsaScore: 63,
    oppScore: 48,
    htmlFile: 'SAFSA vs TungsanYH 160423.html',
  },
  {
    id: 'game-safsa23-2023-04-18-mob',
    date: '2023-04-18',
    opponentId: 'team-1780430691078',
    safsaScore: 103,
    oppScore: 64,
    htmlFile: 'MOB Basketball vs SAFSA Arion box-scores-18 Apr 2023.html',
  },
];

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

function findSafsaDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => n.startsWith('SAFSA Div2'));
  if (!entry) throw new Error('SAFSA Div2 folder not found under Importingboxscores');
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

function resolvePlayerId(htmlName: string): string {
  const id = PLAYER_ID_BY_HTML_NAME[htmlName];
  if (!id) {
    throw new Error(`No player_id for HTML name "${htmlName}"`);
  }
  return id;
}

function parseHtmlStats(htmlPath: string): ParsedPlayerStat[] {
  const html = readFileSync(htmlPath, 'utf8');
  const rows = [...html.matchAll(/<tr><td>#(\d+)\s+([^<]+)<\/td>(.*?)<\/tr>/gs)];
  const stats: ParsedPlayerStat[] = [];

  for (const row of rows) {
    const number = parseInt(row[1], 10);
    const htmlName = row[2].trim();
    if (SKIP_STAT_NAMES.has(htmlName.toLowerCase())) continue;

    const cells = [...row[3].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1].trim());
    if (cells.length < 14) continue;

    const ptsIdx = cells.length >= 15 ? 14 : 13;
    const pts = parseIntCell(cells[ptsIdx]);
    const fg = parseMadeAttempted(cells[0]);
    const three = parseMadeAttempted(cells[2]);
    const ft = parseMadeAttempted(cells[4]);

    const parsed: ParsedPlayerStat = {
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
    };

    if (!hasBoxScoreActivity(parsed)) continue;
    stats.push(parsed);
  }

  return stats;
}

function hashSeed(str: string): number {
  let h = 0;
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

function computeCareerMpg(
  playerId: string,
  games: { isCompleted?: boolean; gameStats?: { playerId: string; minutes_played: number }[] }[]
): number {
  let total = 0;
  let count = 0;
  for (const game of games) {
    if (!game.isCompleted) continue;
    const stat = (game.gameStats ?? []).find((s) => s.playerId === playerId);
    if (stat && stat.minutes_played > 0) {
      total += stat.minutes_played;
      count++;
    }
  }
  return count > 0 ? total / count : CROSS_CLUB_FALLBACK_MPG;
}

function allocateMinutes(
  gameId: string,
  rows: { playerId: string; htmlName: string; points: number }[],
  mpgByPlayerId: Record<string, number>
): Record<string, number> {
  const rng = mulberry32(hashSeed(gameId));
  const out: Record<string, number> = {};
  let fixedSum = 0;
  const variable: typeof rows = [];

  for (const row of rows) {
    if (CROSS_CLUB_PLAYER_IDS.has(row.playerId)) {
      const mpg = mpgByPlayerId[row.playerId] ?? CROSS_CLUB_FALLBACK_MPG;
      out[row.playerId] = round1(mpg);
      fixedSum += out[row.playerId];
    } else {
      variable.push(row);
    }
  }

  let remaining = TOTAL_TEAM_MINUTES - fixedSum;
  if (remaining < 0) {
    const scale = TOTAL_TEAM_MINUTES / fixedSum;
    for (const id of Object.keys(out)) {
      out[id] = round1(out[id] * scale);
    }
    return out;
  }

  if (variable.length === 0) {
    const ids = Object.keys(out);
    const drift = round1(TOTAL_TEAM_MINUTES - Object.values(out).reduce((a, b) => a + b, 0));
    if (ids.length > 0) out[ids[0]] = round1(out[ids[0]] + drift);
    return out;
  }

  const weights = variable.map((row) => {
    const base = Math.max(row.points, 1);
    const jitter = 1 + (rng() * 0.3 - 0.15);
    return { playerId: row.playerId, w: base * jitter };
  });
  const weightSum = weights.reduce((s, w) => s + w.w, 0);

  for (const { playerId, w } of weights) {
    out[playerId] = round1((remaining * w) / weightSum);
  }

  const total = Object.values(out).reduce((a, b) => a + b, 0);
  const drift = round1(TOTAL_TEAM_MINUTES - total);
  const adjustId = [...rows].sort((a, b) => b.points - a.points)[0]?.playerId;
  if (adjustId) {
    out[adjustId] = round1((out[adjustId] ?? 0) + drift);
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

function topStarters(gameStats: { playerId: string; minutes_played: number }[]): string[] {
  return [...gameStats]
    .sort((a, b) => b.minutes_played - a.minutes_played)
    .slice(0, 5)
    .map((s) => s.playerId);
}

interface TeamMeta {
  id: string;
  name: string;
  abbreviation: string;
}

function buildBundle(
  game: GameDef,
  safsaDir: string,
  tournament: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
  },
  teamsById: Map<string, TeamMeta>,
  mpgByPlayerId: Record<string, number>
) {
  const parsed = parseHtmlStats(join(safsaDir, game.htmlFile));
  const rowMeta = parsed.map((row) => ({
    row,
    playerId: resolvePlayerId(row.htmlName),
  }));

  const minutesMap = allocateMinutes(
    game.id,
    rowMeta.map(({ row, playerId }) => ({
      playerId,
      htmlName: row.htmlName,
      points: row.points,
    })),
    mpgByPlayerId
  );

  const gameStats = rowMeta.map(({ row, playerId }) =>
    buildGameStat(playerId, row, minutesMap[playerId])
  );

  const pts = gameStats.reduce((s, r) => s + r.points, 0);
  if (pts !== game.safsaScore) {
    throw new Error(
      `${game.id}: SAFSA points ${pts} !== expected ${game.safsaScore} (${game.htmlFile})`
    );
  }

  const minTotal = round1(gameStats.reduce((s, r) => s + r.minutes_played, 0));
  if (minTotal !== TOTAL_TEAM_MINUTES) {
    throw new Error(`${game.id}: minutes sum ${minTotal} !== ${TOTAL_TEAM_MINUTES}`);
  }

  const homeStarters = topStarters(gameStats);
  const teamIds = tournament.teamIds;

  return {
    version: '1',
    tournament: {
      id: tournament.id,
      name: tournament.name,
      year: tournament.year,
      month: tournament.month,
      teamIds,
    },
    teams: teamIds.map((teamId) => {
      const team = teamsById.get(teamId);
      if (!team) throw new Error(`Missing team metadata for ${teamId}`);
      return {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        currentTournamentId: tournament.id,
        players: [],
      };
    }),
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
      homeStarters,
      awayStarters: [],
      gameStats,
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

  const playerNameById = new Map<string, string>();
  for (const team of data.teams) {
    for (const player of team.players ?? []) {
      playerNameById.set(player.id, player.name);
    }
  }

  const mpgByPlayerId: Record<string, number> = {};
  for (const playerId of CROSS_CLUB_PLAYER_IDS) {
    const mpg = computeCareerMpg(playerId, data.games);
    mpgByPlayerId[playerId] = round1(mpg);
    console.log(
      `Cross-club MPG: ${playerNameById.get(playerId) ?? playerId} = ${mpgByPlayerId[playerId]} min/game`
    );
  }

  const safsaDir = findSafsaDir();
  const outDir = join(safsaDir, 'json');
  if (!dryRun) mkdirSync(outDir, { recursive: true });

  console.log('\nSAFSA Div2 2023 import bundle builder');
  console.log(`Source: ${safsaDir}`);
  console.log(`Tournament: ${tournament.name}\n`);

  const tournamentPayload = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  for (const game of GAMES) {
    const bundle = buildBundle(game, safsaDir, tournamentPayload, teamsById, mpgByPlayerId);
    const outPath = join(outDir, `${game.id}.json`);
    const statCount = bundle.game.gameStats.length;
    const pts = bundle.game.gameStats.reduce((s, r) => s + r.points, 0);
    const mins = round1(bundle.game.gameStats.reduce((s, r) => s + r.minutes_played, 0));

    console.log(
      `${game.id}: ${statCount} SAFSA lines, ${pts} pts (expected ${game.safsaScore}), ${mins} min`
    );

    if (!dryRun) {
      writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n');
    }
  }

  console.log(
    dryRun ? '\nDry run — no files written.' : `\nWrote ${GAMES.length} JSON files to ${outDir}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

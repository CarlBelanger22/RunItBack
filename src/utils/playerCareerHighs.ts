import type { Game, GameStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isFriendlyGame } from './friendlyGame';

/** Scalar single-game career highs (each links to a game). */
export type CareerHighScalarKey =
  | 'pts'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'fgm'
  | 'tpm'
  | 'ftm'
  | 'pf'
  | 'to'
  | 'gmsc';

export type CareerHighScalar = {
  key: CareerHighScalarKey;
  label: string;
  value: number;
  gameId: string;
  gameDate: string;
};

export type PlayerCareerHighs = {
  scalars: CareerHighScalar[];
  doubleDoubles: number;
  tripleDoubles: number;
};

const SCALAR_DEFS: Array<{
  key: CareerHighScalarKey;
  label: string;
  value: (stats: GameStats) => number;
}> = [
  { key: 'pts', label: 'PTS', value: (s) => s.points },
  {
    key: 'reb',
    label: 'REB',
    value: (s) => MetricsCalculator.getTotalRebounds(s),
  },
  { key: 'ast', label: 'AST', value: (s) => s.assists },
  { key: 'stl', label: 'STL', value: (s) => s.steals },
  { key: 'blk', label: 'BLK', value: (s) => s.blocks },
  { key: 'fgm', label: 'FGM', value: (s) => s.fg_made },
  { key: 'tpm', label: '3PM', value: (s) => s.three_made },
  { key: 'ftm', label: 'FTM', value: (s) => s.ft_made },
  { key: 'pf', label: 'PF', value: (s) => s.fouls },
  { key: 'to', label: 'TO', value: (s) => s.turnovers },
  {
    key: 'gmsc',
    label: 'GmSc',
    value: (s) => MetricsCalculator.calculateGameScore(s),
  },
];

/** Counting categories for DD/TD (standard box-score 10+). */
export function countDoubleDoubleCategories(stats: GameStats): number {
  const cats = [
    stats.points,
    MetricsCalculator.getTotalRebounds(stats),
    stats.assists,
    stats.steals,
    stats.blocks,
  ];
  return cats.filter((n) => n >= 10).length;
}

export function isDoubleDouble(stats: GameStats): boolean {
  return countDoubleDoubleCategories(stats) >= 2;
}

export function isTripleDouble(stats: GameStats): boolean {
  return countDoubleDoubleCategories(stats) >= 3;
}

function gameDateMs(game: Pick<Game, 'date'>): number {
  const t = Date.parse(game.date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Single-game career highs for a player.
 * Caller should pass games already scoped by format (and optionally tournament).
 * Friendlies excluded unless `includeFriendlies` is true.
 * Ties → most recent game by date.
 */
export function computePlayerCareerHighs(
  playerId: string,
  games: Game[] | undefined,
  options?: { includeFriendlies?: boolean }
): PlayerCareerHighs {
  const includeFriendlies = options?.includeFriendlies === true;

  const eligible: Array<{ game: Game; stats: GameStats }> = [];
  for (const game of games ?? []) {
    if (!game.isCompleted) continue;
    if (!includeFriendlies && isFriendlyGame(game)) continue;
    const stats = (game.gameStats ?? []).find((s) => s.playerId === playerId);
    if (!stats) continue;
    eligible.push({ game, stats });
  }

  // Oldest → newest so later equal values win (most recent).
  eligible.sort((a, b) => gameDateMs(a.game) - gameDateMs(b.game));

  const best = new Map<
    CareerHighScalarKey,
    { value: number; gameId: string; gameDate: string }
  >();

  let doubleDoubles = 0;
  let tripleDoubles = 0;

  for (const { game, stats } of eligible) {
    for (const def of SCALAR_DEFS) {
      const value = def.value(stats);
      const prev = best.get(def.key);
      if (!prev || value >= prev.value) {
        best.set(def.key, {
          value,
          gameId: game.id,
          gameDate: game.date,
        });
      }
    }
    if (isDoubleDouble(stats)) doubleDoubles += 1;
    if (isTripleDouble(stats)) tripleDoubles += 1;
  }

  const scalars: CareerHighScalar[] = [];
  for (const def of SCALAR_DEFS) {
    const hit = best.get(def.key);
    if (!hit) continue;
    scalars.push({
      key: def.key,
      label: def.label,
      value: hit.value,
      gameId: hit.gameId,
      gameDate: hit.gameDate,
    });
  }

  return { scalars, doubleDoubles, tripleDoubles };
}

export function formatCareerHighValue(
  key: CareerHighScalarKey,
  value: number
): string {
  if (key === 'gmsc') return value.toFixed(1);
  return String(Math.round(value));
}

/**
 * Clutch window + clutch box aggregation from play-by-play events.
 *
 * Window (clock-independent for Q4):
 * - Regulation final period: last floor(n/2) chronological *action* PBP events
 *   (shot / FT / rebound / turnover / foul) — workaround for stale sub clocks.
 * - Overtime: every action event.
 * - Always require score margin ≤ 5 before the event.
 */
import type { EventType, Game, GameEvent, GameStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { resolveGameClockSettings } from './gameClock';
import { isGameCompleted } from './scheduledGames';

export const CLUTCH_MARGIN_MAX = 5;

/** Events that define the Q4 half / OT clutch pool (not subs/timeouts/period markers). */
export const CLUTCH_ACTION_TYPES: ReadonlySet<EventType> = new Set([
  'shot_attempt',
  'free_throw',
  'rebound',
  'turnover',
  'foul',
]);

export interface ClutchPlayerAggregate {
  playerId: string;
  /** Box rebuilt from clutch-window events only. */
  totalStats: GameStats;
  /** Completed games where the player recorded a clutch box event. */
  clutchGames: number;
}

function emptyStats(playerId: string): GameStats {
  return MetricsCalculator.getEmptyStats(playerId);
}

function ensure(
  map: Map<string, { stats: GameStats; games: Set<string> }>,
  playerId: string
): { stats: GameStats; games: Set<string> } {
  let row = map.get(playerId);
  if (!row) {
    row = { stats: emptyStats(playerId), games: new Set() };
    map.set(playerId, row);
  }
  return row;
}

function touch(
  map: Map<string, { stats: GameStats; games: Set<string> }>,
  playerId: string | undefined | null,
  gameId: string,
  apply: (s: GameStats) => void
): void {
  if (!playerId || playerId === 'team') return;
  const row = ensure(map, playerId);
  apply(row.stats);
  row.games.add(gameId);
}

export function isClutchActionType(type: EventType): boolean {
  return CLUTCH_ACTION_TYPES.has(type);
}

/** Points this event added to the scoreboard (0 if non-scoring / miss). */
export function pointsAddedByEvent(event: GameEvent): number {
  if (event.type === 'shot_attempt' && event.details?.made) {
    return event.details.isThree ? 3 : 2;
  }
  if (event.type === 'free_throw') {
    if (typeof event.details?.made === 'boolean') {
      return event.details.made ? 1 : 0;
    }
    const attempts = (event.details?.attempts as boolean[] | undefined) || [];
    return attempts.filter(Boolean).length;
  }
  return 0;
}

export function scoresBeforeEvent(
  event: GameEvent,
  homeTeamId: string
): { home: number; away: number } {
  let home = Number(event.homeScore) || 0;
  let away = Number(event.awayScore) || 0;
  const pts = pointsAddedByEvent(event);
  if (pts > 0) {
    if (event.teamId === homeTeamId) home -= pts;
    else away -= pts;
  }
  return { home, away };
}

export function meetsClutchMargin(
  event: GameEvent,
  homeTeamId: string
): boolean {
  const { home, away } = scoresBeforeEvent(event, homeTeamId);
  return Math.abs(home - away) <= CLUTCH_MARGIN_MAX;
}

/**
 * Last half of a chronological list: start at floor(n/2).
 * 100 → last 50; 4 → last 2; 1 → that 1 event.
 */
export function lastHalfChronological<T>(items: readonly T[]): T[] {
  if (items.length === 0) return [];
  return items.slice(Math.floor(items.length / 2));
}

/**
 * Clutch-window action events for one game (margin already applied).
 */
export function selectClutchEventsForGame(game: Game): GameEvent[] {
  const events = game.events ?? [];
  if (events.length === 0) return [];
  const homeTeamId = game.homeTeamId || game.homeTeam?.id;
  if (!homeTeamId) return [];
  const reg = resolveGameClockSettings(game).regulationPeriods;

  const sorted = [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return 0;
  });

  const q4Action = sorted.filter(
    (e) => e.period === reg && isClutchActionType(e.type)
  );
  const q4Half = lastHalfChronological(q4Action);
  const otAction = sorted.filter(
    (e) => e.period > reg && isClutchActionType(e.type)
  );

  return [...q4Half, ...otAction].filter((e) =>
    meetsClutchMargin(e, homeTeamId)
  );
}

function applyClutchEvent(
  map: Map<string, { stats: GameStats; games: Set<string> }>,
  event: GameEvent,
  gameId: string
): void {
  switch (event.type) {
    case 'shot_attempt': {
      const made = !!event.details?.made;
      const isThree = !!event.details?.isThree;
      const pts = made ? (isThree ? 3 : 2) : 0;
      touch(map, event.playerId, gameId, (s) => {
        s.fg_attempted += 1;
        if (isThree) s.three_attempted += 1;
        if (made) {
          s.fg_made += 1;
          s.points += pts;
          if (isThree) s.three_made += 1;
        }
      });
      if (made && event.details?.assistedBy) {
        touch(map, event.details.assistedBy as string, gameId, (s) => {
          s.assists += 1;
        });
      }
      if (!made && event.details?.blockedBy) {
        touch(map, event.details.blockedBy as string, gameId, (s) => {
          s.blocks += 1;
        });
        touch(map, event.playerId, gameId, (s) => {
          s.blocks_received += 1;
        });
      }
      break;
    }
    case 'free_throw': {
      let madeCount = 0;
      let totalCount = 1;
      if (typeof event.details?.made === 'boolean') {
        madeCount = event.details.made ? 1 : 0;
      } else {
        const attempts = (event.details?.attempts as boolean[]) || [];
        madeCount = attempts.filter(Boolean).length;
        totalCount = Math.max(1, attempts.length);
      }
      touch(map, event.playerId, gameId, (s) => {
        s.ft_attempted += totalCount;
        s.ft_made += madeCount;
        s.points += madeCount;
      });
      break;
    }
    case 'rebound': {
      const rt = event.details?.reboundType as string | undefined;
      if (rt === 'team_offensive' || rt === 'team_defensive') break;
      const isOff = rt === 'offensive' || rt === 'team_offensive';
      touch(map, event.playerId, gameId, (s) => {
        if (isOff) s.orb += 1;
        else s.drb += 1;
      });
      break;
    }
    case 'turnover': {
      if (!event.details?.isTeamTurnover) {
        touch(map, event.playerId, gameId, (s) => {
          s.turnovers += 1;
        });
      }
      const stolenBy = event.details?.stolenBy as string | undefined;
      if (stolenBy && stolenBy !== 'team') {
        touch(map, stolenBy, gameId, (s) => {
          s.steals += 1;
        });
      }
      break;
    }
    case 'foul': {
      touch(map, event.playerId, gameId, (s) => {
        s.fouls += 1;
      });
      break;
    }
    default:
      break;
  }
}

/** True when any completed game has PBP we can use for clutch. */
export function tournamentHasClutchPbpCoverage(games: Game[]): boolean {
  return games
    .filter(isGameCompleted)
    .some((g) => (g.events?.length ?? 0) > 0);
}

/**
 * Aggregate clutch-only GameStats per player across completed games.
 */
export function aggregateClutchStatsByPlayer(
  games: Game[]
): Map<string, ClutchPlayerAggregate> {
  const map = new Map<string, { stats: GameStats; games: Set<string> }>();

  for (const game of games.filter(isGameCompleted)) {
    for (const event of selectClutchEventsForGame(game)) {
      applyClutchEvent(map, event, game.id);
    }
  }

  const out = new Map<string, ClutchPlayerAggregate>();
  for (const [playerId, row] of map) {
    out.set(playerId, {
      playerId,
      totalStats: row.stats,
      clutchGames: row.games.size,
    });
  }
  return out;
}

export function clutchGmscPerGame(row: ClutchPlayerAggregate): number {
  if (row.clutchGames <= 0) return 0;
  return (
    MetricsCalculator.calculateGameScore(row.totalStats) / row.clutchGames
  );
}

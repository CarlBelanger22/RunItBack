import type { Game, Player } from '../App';
import {
  clockForPeriod,
  elapsedCountdownSeconds,
  isValidSubstitutionClock,
  resolveGameClockSettings,
} from './gameClock';
import { getTournamentGameFormat } from './gameFormat';
import { minutesToDisplay } from '../liveEntry/minutesEngine';

export interface AggregatedLineupUnit {
  teamId: string;
  /** Side relative to the game. */
  side: 'home' | 'away';
  /** Five player IDs in stable sort order (for keys); display order may differ. */
  playerIds: string[];
  /** Key: teamId + sorted player ids. */
  key: string;
  /** Total minutes as decimal (same as minutes_played). */
  minutes: number;
  plusMinus: number;
}

export interface AggregatedLineupUnitView extends AggregatedLineupUnit {
  minutesDisplay: string;
  plusMinusDisplay: string;
  /** Jersey# Name labels in jersey order when available. */
  playerLabels: string[];
}

function lineupKey(teamId: string, playerIds: string[]): string {
  return `${teamId}::${[...playerIds].sort().join('|')}`;
}

function creditUnit(
  map: Map<string, AggregatedLineupUnit>,
  teamId: string,
  side: 'home' | 'away',
  players: string[],
  elapsedSeconds: number,
  plusMinus: number
): void {
  if (elapsedSeconds <= 0) return;
  const ids = players.filter(Boolean).slice(0, 5);
  if (ids.length < 5) return;

  const key = lineupKey(teamId, ids);
  const minutesDelta = elapsedSeconds / 60;
  const existing = map.get(key);
  if (existing) {
    existing.minutes += minutesDelta;
    existing.plusMinus += plusMinus;
    return;
  }
  map.set(key, {
    teamId,
    side,
    playerIds: [...ids].sort(),
    key,
    minutes: minutesDelta,
    plusMinus,
  });
}

function creditBothSides(
  map: Map<string, AggregatedLineupUnit>,
  game: Game,
  onCourtHome: string[],
  onCourtAway: string[],
  fromClock: string,
  toClock: string,
  scoreAtCheckpoint: { home: number; away: number },
  scores: { home: number; away: number }
): void {
  const elapsed = elapsedCountdownSeconds(fromClock, toClock);
  if (elapsed <= 0) return;
  const homeDelta = scores.home - scoreAtCheckpoint.home;
  const awayDelta = scores.away - scoreAtCheckpoint.away;
  const homePm = homeDelta - awayDelta;
  const awayPm = awayDelta - homeDelta;

  creditUnit(map, game.homeTeamId, 'home', onCourtHome, elapsed, homePm);
  creditUnit(map, game.awayTeamId, 'away', onCourtAway, elapsed, awayPm);
}

function applyRosterChange(
  onCourtHome: string[],
  onCourtAway: string[],
  teamId: string,
  homeTeamId: string,
  outIds: string[],
  inIds: string[]
): { onCourtHome: string[]; onCourtAway: string[] } {
  if (teamId === homeTeamId) {
    return {
      onCourtHome: onCourtHome.filter((id) => !outIds.includes(id)).concat(inIds),
      onCourtAway: [...onCourtAway],
    };
  }
  return {
    onCourtHome: [...onCourtHome],
    onCourtAway: onCourtAway.filter((id) => !outIds.includes(id)).concat(inIds),
  };
}

/**
 * True when this game can show Lineups (5v5 + usable lineup timeline).
 * Prefer calling after deriving; this is a cheap pre-check.
 */
export function gameHasLineupUnitData(
  game: Game,
  tournamentFormat?: '5v5' | '3x3'
): boolean {
  const format =
    tournamentFormat ??
    getTournamentGameFormat(game.tournamentId, undefined);
  if (format !== '5v5') return false;

  const events = game.events ?? [];
  if (events.length === 0) return false;

  const hasPeriodLineups = events.some((e) => {
    if (e.type !== 'period_start') return false;
    const home = e.details?.homeLineup;
    const away = e.details?.awayLineup;
    return (
      Array.isArray(home) &&
      home.length >= 5 &&
      Array.isArray(away) &&
      away.length >= 5
    );
  });

  const hasStarters =
    (game.homeStarters?.length ?? 0) >= 5 &&
    (game.awayStarters?.length ?? 0) >= 5;
  const hasSubs = events.some((e) => e.type === 'substitution');

  return hasPeriodLineups || (hasStarters && hasSubs);
}

/**
 * Derive aggregated unique 5-man units (per team) from the event score/lineup timeline.
 * Sorted by minutes descending.
 */
export function deriveAggregatedLineupUnits(game: Game): AggregatedLineupUnit[] {
  if (!gameHasLineupUnitData(game)) return [];

  const settings = resolveGameClockSettings(game);
  const map = new Map<string, AggregatedLineupUnit>();

  let checkpointClock = clockForPeriod(1, settings);
  let onCourtHome = [...(game.homeStarters ?? [])].slice(0, 5);
  let onCourtAway = [...(game.awayStarters ?? [])].slice(0, 5);
  let scoreAtCheckpoint = { home: 0, away: 0 };
  let scores = { home: 0, away: 0 };
  let currentPeriod = 1;

  for (const event of game.events ?? []) {
    if (event.type === 'period_start') {
      const period =
        (event.details.period as number) ?? currentPeriod + 1;
      const clock =
        (event.details.clockTime as string) ||
        clockForPeriod(period, settings);
      // Match minutesEngine: replace state without flushing (period_end should precede).
      checkpointClock = clock;
      onCourtHome = [...((event.details.homeLineup as string[]) ?? [])].slice(
        0,
        5
      );
      onCourtAway = [...((event.details.awayLineup as string[]) ?? [])].slice(
        0,
        5
      );
      scoreAtCheckpoint = { ...scores };
      currentPeriod = period;
      continue;
    }

    if (event.type === 'period_end') {
      creditBothSides(
        map,
        game,
        onCourtHome,
        onCourtAway,
        checkpointClock,
        '0:00',
        scoreAtCheckpoint,
        scores
      );
      checkpointClock = '0:00';
      scoreAtCheckpoint = { ...scores };
      continue;
    }

    if (event.type === 'substitution') {
      const clockTime =
        (event.details.clockTime as string) ??
        (event.details.checkpointTo as string) ??
        event.gameTime;
      const stintScores = {
        home: event.homeScore,
        away: event.awayScore,
      };

      if (isValidSubstitutionClock(checkpointClock, clockTime)) {
        creditBothSides(
          map,
          game,
          onCourtHome,
          onCourtAway,
          checkpointClock,
          clockTime,
          scoreAtCheckpoint,
          stintScores
        );
        const next = applyRosterChange(
          onCourtHome,
          onCourtAway,
          event.teamId,
          game.homeTeamId,
          (event.details.playersOut as string[]) ?? [],
          (event.details.playersIn as string[]) ?? []
        );
        onCourtHome = next.onCourtHome;
        onCourtAway = next.onCourtAway;
        checkpointClock = clockTime;
        scoreAtCheckpoint = { ...stintScores };
      }
    }

    scores = { home: event.homeScore, away: event.awayScore };
  }

  return [...map.values()]
    .filter((u) => u.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || b.plusMinus - a.plusMinus);
}

/** Max players selectable for the Lineups “includes” filter (full 5-man unit). */
export const LINEUP_INCLUDES_PLAYER_MAX = 5;

export function filterAggregatedLineupUnits(
  units: AggregatedLineupUnit[],
  options: {
    team: 'both' | 'home' | 'away';
    /** AND: unit must include every listed player. Empty = no player filter. */
    playerIds: string[];
  }
): AggregatedLineupUnit[] {
  const required = options.playerIds.filter(Boolean);
  return units.filter((u) => {
    if (options.team === 'home' && u.side !== 'home') return false;
    if (options.team === 'away' && u.side !== 'away') return false;
    if (required.length > 0 && !required.every((id) => u.playerIds.includes(id))) {
      return false;
    }
    return true;
  });
}

function playerById(game: Game, playerId: string): Player | undefined {
  return (
    game.homeTeam.players.find((p) => p.id === playerId) ||
    game.awayTeam.players.find((p) => p.id === playerId)
  );
}

function formatPlayerLabel(game: Game, playerId: string): string {
  const p = playerById(game, playerId);
  if (!p) return playerId.slice(-6);
  const num = p.number != null ? `#${p.number} ` : '';
  return `${num}${p.name}`;
}

/** Order players by jersey number for display. */
export function toLineupUnitViews(
  game: Game,
  units: AggregatedLineupUnit[]
): AggregatedLineupUnitView[] {
  return units.map((u) => {
    const ordered = [...u.playerIds].sort((a, b) => {
      const na = playerById(game, a)?.number ?? 999;
      const nb = playerById(game, b)?.number ?? 999;
      if (na !== nb) return na - nb;
      return (playerById(game, a)?.name ?? '').localeCompare(
        playerById(game, b)?.name ?? ''
      );
    });
    const pm = Math.round(u.plusMinus);
    return {
      ...u,
      playerIds: ordered,
      minutesDisplay: minutesToDisplay(u.minutes),
      plusMinusDisplay: pm > 0 ? `+${pm}` : String(pm),
      playerLabels: ordered.map((id) => formatPlayerLabel(game, id)),
    };
  });
}

export function formatLineupPlusMinus(plusMinus: number): string {
  const pm = Math.round(plusMinus);
  return pm > 0 ? `+${pm}` : String(pm);
}

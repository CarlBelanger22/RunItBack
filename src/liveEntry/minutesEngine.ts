import type { Game, GameEvent, GameStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  clockForPeriod,
  elapsedCountdownSeconds,
  isValidSubstitutionClock,
  parseGameClockSeconds,
  resolveGameClockSettings,
} from '../utils/gameClock';

export interface MinutesTrackingState {
  checkpointClock: string;
  onCourtHome: string[];
  onCourtAway: string[];
  scoreAtCheckpoint: { home: number; away: number };
  currentPeriod: number;
}

export interface SubstitutionCheckpointInput {
  teamId: string;
  outIds: string[];
  inIds: string[];
  clockTime: string;
  onCourtHome: string[];
  onCourtAway: string[];
}

function cloneGameStats(game: Game): Game {
  return {
    ...game,
    gameStats: game.gameStats.map((s) => ({ ...s })),
  };
}

function getOrCreateStats(game: Game, playerId: string): GameStats {
  let stats = game.gameStats.find((s) => s.playerId === playerId);
  if (!stats) {
    stats = MetricsCalculator.getEmptyStats(playerId);
    game.gameStats.push(stats);
  }
  return stats;
}

function resetMinutesAndPlusMinus(game: Game): Game {
  return {
    ...game,
    gameStats: game.gameStats.map((s) => ({
      ...s,
      minutes_played: 0,
      plus_minus: 0,
    })),
  };
}

function creditStint(
  game: Game,
  onCourtHome: string[],
  onCourtAway: string[],
  elapsedSeconds: number,
  homeScoreDelta: number,
  awayScoreDelta: number
): Game {
  if (elapsedSeconds <= 0) return game;

  const g = cloneGameStats(game);
  const minutesDelta = elapsedSeconds / 60;
  const homePm = homeScoreDelta - awayScoreDelta;
  const awayPm = awayScoreDelta - homeScoreDelta;

  for (const playerId of onCourtHome) {
    const stats = getOrCreateStats(g, playerId);
    stats.minutes_played += minutesDelta;
    stats.plus_minus += homePm;
  }
  for (const playerId of onCourtAway) {
    const stats = getOrCreateStats(g, playerId);
    stats.minutes_played += minutesDelta;
    stats.plus_minus += awayPm;
  }

  return g;
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

export function initialMinutesState(game: Game): MinutesTrackingState {
  const settings = resolveGameClockSettings(game);
  const period = game.currentPeriod || 1;
  const periodClock = clockForPeriod(period, settings);
  return {
    checkpointClock: game.currentGameTime || periodClock,
    onCourtHome: [...game.homeStarters].slice(0, 5),
    onCourtAway: [...game.awayStarters].slice(0, 5),
    // Period starts at 0–0; cumulative score is tracked separately during replay.
    scoreAtCheckpoint: { home: 0, away: 0 },
    currentPeriod: period,
  };
}

function createQ1ReplayState(game: Game): MinutesTrackingState {
  const settings = resolveGameClockSettings(game);
  return {
    checkpointClock: clockForPeriod(1, settings),
    onCourtHome: [...game.homeStarters].slice(0, 5),
    onCourtAway: [...game.awayStarters].slice(0, 5),
    scoreAtCheckpoint: { home: 0, away: 0 },
    currentPeriod: 1,
  };
}

export function flushStintToClock(
  game: Game,
  state: MinutesTrackingState,
  toClock: string,
  scores: { home: number; away: number }
): { game: Game; state: MinutesTrackingState } {
  const elapsed = elapsedCountdownSeconds(state.checkpointClock, toClock);
  const homeDelta = scores.home - state.scoreAtCheckpoint.home;
  const awayDelta = scores.away - state.scoreAtCheckpoint.away;

  const updatedGame = creditStint(
    game,
    state.onCourtHome,
    state.onCourtAway,
    elapsed,
    homeDelta,
    awayDelta
  );

  return {
    game: { ...updatedGame, currentGameTime: toClock },
    state: {
      ...state,
      checkpointClock: toClock,
      scoreAtCheckpoint: { ...scores },
    },
  };
}

export function applySubstitutionCheckpoint(
  game: Game,
  state: MinutesTrackingState,
  input: SubstitutionCheckpointInput,
  scores: { home: number; away: number }
): { game: Game; state: MinutesTrackingState } {
  if (!isValidSubstitutionClock(state.checkpointClock, input.clockTime)) {
    throw new Error(
      `Substitution clock ${input.clockTime} must be at or before ${state.checkpointClock}`
    );
  }

  const flushed = flushStintToClock(game, state, input.clockTime, scores);
  const rosters = applyRosterChange(
    input.onCourtHome,
    input.onCourtAway,
    input.teamId,
    game.homeTeamId,
    input.outIds,
    input.inIds
  );

  return {
    game: flushed.game,
    state: {
      ...flushed.state,
      onCourtHome: rosters.onCourtHome,
      onCourtAway: rosters.onCourtAway,
    },
  };
}

export function startPeriodLineups(
  game: Game,
  period: number,
  homeLineup: string[],
  awayLineup: string[]
): { game: Game; state: MinutesTrackingState } {
  const settings = resolveGameClockSettings(game);
  const clock = clockForPeriod(period, settings);
  const scores = {
    home: game.teamStats.home.total_points,
    away: game.teamStats.away.total_points,
  };

  return {
    game: {
      ...game,
      currentPeriod: period,
      currentGameTime: clock,
    },
    state: {
      checkpointClock: clock,
      onCourtHome: [...homeLineup],
      onCourtAway: [...awayLineup],
      scoreAtCheckpoint: { ...scores },
      currentPeriod: period,
    },
  };
}

/** Replay minutes/+/- from period and substitution events onto game stats. */
export function replayMinutesOntoGame(game: Game): {
  game: Game;
  state: MinutesTrackingState;
} {
  const settings = resolveGameClockSettings(game);
  let g = resetMinutesAndPlusMinus(game);
  let state = createQ1ReplayState(game);
  let scores = { home: 0, away: 0 };

  for (const event of game.events) {
    if (event.type === 'period_start') {
      const period = (event.details.period as number) ?? state.currentPeriod + 1;
      const clock =
        (event.details.clockTime as string) || clockForPeriod(period, settings);
      state = {
        checkpointClock: clock,
        onCourtHome: [...(event.details.homeLineup as string[])],
        onCourtAway: [...(event.details.awayLineup as string[])],
        scoreAtCheckpoint: { ...scores },
        currentPeriod: period,
      };
      g = { ...g, currentPeriod: period, currentGameTime: clock };
      continue;
    }

    if (event.type === 'period_end') {
      const flushed = flushStintToClock(g, state, '0:00', scores);
      g = flushed.game;
      state = flushed.state;
      continue;
    }

    if (event.type === 'substitution') {
      const clockTime =
        (event.details.clockTime as string) ??
        (event.details.checkpointTo as string) ??
        event.gameTime;
      const outIds = (event.details.playersOut as string[]) ?? [];
      const inIds = (event.details.playersIn as string[]) ?? [];
      const stintScores = { home: event.homeScore, away: event.awayScore };
      const result = applySubstitutionCheckpoint(
        g,
        state,
        {
          teamId: event.teamId,
          outIds,
          inIds,
          clockTime,
          onCourtHome: state.onCourtHome,
          onCourtAway: state.onCourtAway,
        },
        stintScores
      );
      g = result.game;
      state = result.state;
    }

    scores = { home: event.homeScore, away: event.awayScore };
  }

  g = {
    ...g,
    currentGameTime: state.checkpointClock,
    currentPeriod: state.currentPeriod,
  };

  return { game: g, state };
}

/**
 * On-court lineups (and checkpoint clock) immediately before `eventId`.
 * Used when editing a past substitution so Out/In lists match that moment.
 */
export function getLineupStateBeforeEvent(
  game: Game,
  eventId: string
): MinutesTrackingState | null {
  const idx = game.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;

  const settings = resolveGameClockSettings(game);
  let state = createQ1ReplayState(game);
  let scores = { home: 0, away: 0 };
  // Replay with a lightweight game shell — only lineup/clock state matters here.
  let g: Game = { ...game, events: [] };

  for (let i = 0; i < idx; i++) {
    const event = game.events[i];
    if (event.type === 'period_start') {
      const period = (event.details.period as number) ?? state.currentPeriod + 1;
      const clock =
        (event.details.clockTime as string) || clockForPeriod(period, settings);
      state = {
        checkpointClock: clock,
        onCourtHome: [...(event.details.homeLineup as string[])],
        onCourtAway: [...(event.details.awayLineup as string[])],
        scoreAtCheckpoint: { ...scores },
        currentPeriod: period,
      };
      continue;
    }

    if (event.type === 'period_end') {
      state = {
        ...state,
        checkpointClock: '0:00',
        scoreAtCheckpoint: { ...scores },
      };
      continue;
    }

    if (event.type === 'substitution') {
      const clockTime =
        (event.details.clockTime as string) ??
        (event.details.checkpointTo as string) ??
        event.gameTime;
      const outIds = (event.details.playersOut as string[]) ?? [];
      const inIds = (event.details.playersIn as string[]) ?? [];
      const stintScores = { home: event.homeScore, away: event.awayScore };
      const result = applySubstitutionCheckpoint(
        g,
        state,
        {
          teamId: event.teamId,
          outIds,
          inIds,
          clockTime,
          onCourtHome: state.onCourtHome,
          onCourtAway: state.onCourtAway,
        },
        stintScores
      );
      g = result.game;
      state = result.state;
    }

    scores = { home: event.homeScore, away: event.awayScore };
  }

  return state;
}

export function minutesToDisplay(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function displayToMinutesSeconds(display: string): number {
  return parseGameClockSeconds(display) / 60;
}

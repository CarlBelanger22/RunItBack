import type { Game } from '../App';
import { getTournamentGameFormat, type GameFormat } from './gameFormat';

export interface GameClockSettings {
  regulationPeriods: number;
  regulationPeriodMinutes: number;
  overtimePeriodMinutes: number;
}

export function defaultClockForFormat(format: GameFormat): GameClockSettings {
  if (format === '3x3') {
    return {
      regulationPeriods: 1,
      regulationPeriodMinutes: 10,
      overtimePeriodMinutes: 5,
    };
  }
  return {
    regulationPeriods: 4,
    regulationPeriodMinutes: 10,
    overtimePeriodMinutes: 5,
  };
}

export function defaultClockForTournament(
  tournamentId: string | undefined,
  tournament?: { id: string; gameFormat?: GameFormat } | null
): GameClockSettings {
  return defaultClockForFormat(getTournamentGameFormat(tournamentId, tournament));
}

export function formatPeriodClock(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  return `${m}:00`;
}

/** Parse `M:SS` or `MM:SS` countdown clock to total seconds. */
export function parseGameClockSeconds(clock: string): number {
  const parts = clock.trim().split(':');
  if (parts.length !== 2) return 0;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return Math.max(0, minutes * 60 + seconds);
}

export function formatGameClockFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Elapsed playing time on a countdown clock (from → to). */
export function elapsedCountdownSeconds(fromClock: string, toClock: string): number {
  return parseGameClockSeconds(fromClock) - parseGameClockSeconds(toClock);
}

export function isValidSubstitutionClock(
  currentClock: string,
  subClock: string
): boolean {
  return parseGameClockSeconds(subClock) <= parseGameClockSeconds(currentClock);
}

export function resolveGameClockSettings(game: Game): GameClockSettings {
  if (game.clockSettings) return game.clockSettings;
  return defaultClockForTournament(game.tournamentId);
}

/** Clock display for a period number (1-based). */
export function clockForPeriod(period: number, settings: GameClockSettings): string {
  if (period <= settings.regulationPeriods) {
    return formatPeriodClock(settings.regulationPeriodMinutes);
  }
  return formatPeriodClock(settings.overtimePeriodMinutes);
}

export function periodLabel(period: number, settings: GameClockSettings): string {
  if (period <= settings.regulationPeriods) {
    return `Q${period}`;
  }
  return `OT${period - settings.regulationPeriods}`;
}

export type EndPeriodButtonLabel = 'End Q' | 'End Game';

/** Scoreboard period-end button — End Game when the game can finish; otherwise End Q. */
export function endPeriodButtonLabel(
  game: Game,
  homeScore: number,
  awayScore: number
): EndPeriodButtonLabel {
  return shouldCompleteGameOnPeriodEnd(game, homeScore, awayScore) ? 'End Game' : 'End Q';
}

/** True when period end should complete the game (ahead at end of regulation or OT). */
export function shouldCompleteGameOnPeriodEnd(
  game: Game,
  homeScore: number,
  awayScore: number
): boolean {
  if (homeScore === awayScore) return false;
  const settings = resolveGameClockSettings(game);
  const period = game.currentPeriod;
  const isFinalRegPeriod = period === settings.regulationPeriods;
  const inOvertime = period > settings.regulationPeriods;
  return isFinalRegPeriod || inOvertime;
}

/** True when period end should open the quarter/OT lineup picker. */
export function shouldPromptLineupAfterPeriodEnd(
  game: Game,
  homeScore: number,
  awayScore: number
): boolean {
  if (shouldCompleteGameOnPeriodEnd(game, homeScore, awayScore)) return false;
  const settings = resolveGameClockSettings(game);
  const period = game.currentPeriod;
  if (period < settings.regulationPeriods) return true;
  return homeScore === awayScore;
}

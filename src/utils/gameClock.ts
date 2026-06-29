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

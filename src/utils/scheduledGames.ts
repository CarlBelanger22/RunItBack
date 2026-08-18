import type { Game } from '../App';

/** Scheduled fixture: tagged tournament game, both teams set, not started. */
export function isScheduledTournamentGame(game: Game): boolean {
  return Boolean(
    game.tournamentId &&
      game.homeTeamId &&
      game.awayTeamId &&
      !game.isCompleted &&
      !game.isActive &&
      !game.finalScore
  );
}

export function isGameLive(game: Game): boolean {
  return Boolean(game.isActive && !game.isCompleted);
}

export function isGameCompleted(game: Game): boolean {
  return Boolean(game.isCompleted || game.finalScore);
}

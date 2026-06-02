import type { Game } from '../App';
import type { GameFormValues } from '../components/forms/GameForm';
import { resolveTeamScore } from './gameDisplay';

export function buildGameMetadataPatch(
  game: Game,
  values: GameFormValues
): Game {
  const next: Game = {
    ...game,
    date: values.date,
    startTime: values.startTime,
    tournamentId: values.tournamentId,
  };

  if (game.isCompleted && values.finalScoreHome != null && values.finalScoreAway != null) {
    next.finalScore = {
      home: values.finalScoreHome,
      away: values.finalScoreAway,
    };
  }

  return next;
}

export function getFinalScoreMismatchWarning(game: Game): string | null {
  if (!game.isCompleted || !game.finalScore) return null;
  const computedHome = resolveTeamScore(game, game.homeTeamId);
  const computedAway = resolveTeamScore(game, game.awayTeamId);
  if (
    computedHome === game.finalScore.home &&
    computedAway === game.finalScore.away
  ) {
    return null;
  }
  return `Player stat totals are ${computedHome}-${computedAway}. Override only if the imported final score is correct.`;
}

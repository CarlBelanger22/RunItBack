import type { Game } from '../App';
import type { GameFormValues } from '../components/forms/GameForm';
import { resolveTeamScore } from './gameDisplay';
import { isFriendlyGame } from './friendlyGame';

export function buildGameMetadataPatch(
  game: Game,
  values: GameFormValues
): Game {
  const nextFlipped = values.courtSidesFlipped ?? false;
  const next: Game = {
    ...game,
    date: values.date,
    startTime: values.startTime,
    courtSidesFlipped: nextFlipped,
  };

  // Tip-off orientation: keep in sync with the form while still in the first half.
  if ((game.currentPeriod ?? 1) <= 2) {
    next.courtSidesFlippedAtTip = nextFlipped;
  } else if (game.courtSidesFlippedAtTip === undefined) {
    // Do not invent tip-off from second-half camera state.
  } else {
    next.courtSidesFlippedAtTip = game.courtSidesFlippedAtTip;
  }

  // Friendlies stay tournament-less (no convert official ↔ friendly).
  if (isFriendlyGame(game)) {
    next.tournamentId = undefined;
    next.isFriendly = true;
    next.stageId = undefined;
    next.groupId = undefined;
    next.bracketSlotId = undefined;
  } else if (values.tournamentId) {
    next.tournamentId = values.tournamentId;
    next.stageId = values.stageId;
    next.groupId = values.groupId;
    if (!values.stageId) {
      next.bracketSlotId = undefined;
    }
  }

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

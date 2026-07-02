import type { Game, GameEvent } from '../App';

export interface PossessionContext {
  secondChance?: boolean;
  offTurnover?: boolean;
}

export interface PossessionSnapshot {
  offenseTeamId: string;
  /** Team that earns second-chance credit on next score. */
  secondChanceTeamId: string | null;
  /** Team that earns points-off-turnover credit on next score. */
  offTurnoverTeamId: string | null;
}

function opponentTeamId(game: Game, teamId: string): string {
  return teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
}

function isScoringEvent(event: GameEvent): boolean {
  if (event.type === 'shot_attempt' && event.details.made) return true;
  if (event.type === 'free_throw') {
    if (typeof event.details.made === 'boolean') return event.details.made;
    const attempts = event.details.attempts as boolean[] | undefined;
    return attempts?.some(Boolean) ?? false;
  }
  return false;
}

function isMadeBasket(event: GameEvent): boolean {
  return event.type === 'shot_attempt' && !!event.details.made;
}

function isDefensiveRebound(event: GameEvent): boolean {
  if (event.type !== 'rebound') return false;
  const rt = event.details.reboundType as string;
  return rt === 'defensive' || rt === 'team_defensive';
}

function isOffensiveRebound(event: GameEvent): boolean {
  if (event.type !== 'rebound') return false;
  const rt = event.details.reboundType as string;
  return rt === 'offensive' || rt === 'team_offensive';
}

function isTurnover(event: GameEvent): boolean {
  return event.type === 'turnover';
}

function isJumpBallPossessionChange(event: GameEvent): boolean {
  if (event.type !== 'jump_ball') return false;
  return event.details.possessionChanged === true;
}

function isTerminalFreeThrowEnd(event: GameEvent, events: GameEvent[], index: number): boolean {
  if (event.type !== 'free_throw') return false;
  const isFinal = event.details.isFinal === true;
  if (isFinal) return true;
  // Legacy batch: last in sequence if followed by non-FT
  const attempts = event.details.attempts as boolean[] | undefined;
  if (attempts && attempts.length > 0) {
    const next = events[index + 1];
    return !next || next.type !== 'free_throw';
  }
  return false;
}

/**
 * Replay events to derive possession snapshot *before* the next event is applied.
 */
export function derivePossessionSnapshot(
  game: Game,
  events: GameEvent[]
): PossessionSnapshot {
  let offenseTeamId = game.homeTeamId;
  let secondChanceTeamId: string | null = null;
  let offTurnoverTeamId: string | null = null;

  events.forEach((event, index) => {
    if (isScoringEvent(event)) {
      const defenseId = opponentTeamId(game, event.teamId);
      if (offTurnoverTeamId && offTurnoverTeamId !== event.teamId) {
        offTurnoverTeamId = null;
      }
      if (secondChanceTeamId && secondChanceTeamId !== event.teamId) {
        secondChanceTeamId = null;
      }
      if (isMadeBasket(event)) {
        offenseTeamId = defenseId;
        secondChanceTeamId = null;
        offTurnoverTeamId = null;
      }
    }

    if (isOffensiveRebound(event)) {
      secondChanceTeamId = event.teamId;
      offTurnoverTeamId = null;
    }

    if (isDefensiveRebound(event)) {
      offenseTeamId = event.teamId;
      secondChanceTeamId = null;
      offTurnoverTeamId = null;
    }

    if (isTurnover(event)) {
      const recovering = opponentTeamId(game, event.teamId);
      offenseTeamId = recovering;
      offTurnoverTeamId = recovering;
      secondChanceTeamId = null;
    }

    if (event.type === 'jump_ball') {
      const kind = event.details.kind as string;
      if (kind === 'opening') {
        offenseTeamId = event.details.winnerTeamId as string;
        secondChanceTeamId = null;
        offTurnoverTeamId = null;
      } else if (isJumpBallPossessionChange(event)) {
        const awardedTeamId = event.details.awardedTeamId as string;
        offenseTeamId = awardedTeamId;
        if (event.details.stealPlayerId) {
          offTurnoverTeamId = awardedTeamId;
        }
        secondChanceTeamId = null;
      }
    }

    if (isTerminalFreeThrowEnd(event, events, index)) {
      offenseTeamId = opponentTeamId(game, event.teamId);
      secondChanceTeamId = null;
      offTurnoverTeamId = null;
    }
  });

  return { offenseTeamId, secondChanceTeamId, offTurnoverTeamId };
}

/** Context flags to stamp on a scoring event for the given team. */
export function possessionContextForScoringTeam(
  game: Game,
  eventsBefore: GameEvent[],
  scoringTeamId: string
): PossessionContext {
  const snap = derivePossessionSnapshot(game, eventsBefore);
  return {
    secondChance: snap.secondChanceTeamId === scoringTeamId,
    offTurnover: snap.offTurnoverTeamId === scoringTeamId,
  };
}

export function defenseTeamId(game: Game, offenseTeamId: string): string {
  return opponentTeamId(game, offenseTeamId);
}

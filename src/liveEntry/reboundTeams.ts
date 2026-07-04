import type { Game } from '../App';
import type { PendingShot } from './liveEntryStateMachine';
import { opponentTeamId } from './possessionArrow';

export function teamIdForPlayer(game: Game, playerId: string): string | null {
  if (game.homeTeam.players.some((p) => p.id === playerId)) return game.homeTeamId;
  if (game.awayTeam.players.some((p) => p.id === playerId)) return game.awayTeamId;
  return null;
}

/** Shooting / defending teams for a missed or blocked FGA. */
export function deriveReboundTeamsForMissedShot(
  game: Game,
  pending: PendingShot,
  fallbackOffenseTeamId: string
): { shootingTeamId: string; defendingTeamId: string } {
  if (pending.outcome === 'block' && pending.blockerId) {
    const blockerTeam = teamIdForPlayer(game, pending.blockerId);
    if (blockerTeam) {
      return {
        shootingTeamId: opponentTeamId(game, blockerTeam),
        defendingTeamId: blockerTeam,
      };
    }
  }

  if (pending.shooterId) {
    const shooterTeam = teamIdForPlayer(game, pending.shooterId);
    if (shooterTeam) {
      return {
        shootingTeamId: shooterTeam,
        defendingTeamId: opponentTeamId(game, shooterTeam),
      };
    }
  }

  return {
    shootingTeamId: fallbackOffenseTeamId,
    defendingTeamId: opponentTeamId(game, fallbackOffenseTeamId),
  };
}

/** Last missed/blocked FGA on the event log — fallback when rebound ctx is empty. */
export function deriveReboundTeamsFromEvents(
  game: Game
): { shootingTeamId: string; defendingTeamId: string } | null {
  for (let i = game.events.length - 1; i >= 0; i--) {
    const event = game.events[i];
    if (event.type !== 'shot_attempt' || event.details.made) continue;

    const blockedBy = event.details.blockedBy as string | undefined;
    if (blockedBy) {
      const blockerTeam = teamIdForPlayer(game, blockedBy);
      if (blockerTeam) {
        return {
          shootingTeamId: opponentTeamId(game, blockerTeam),
          defendingTeamId: blockerTeam,
        };
      }
    }

    return {
      shootingTeamId: event.teamId,
      defendingTeamId: opponentTeamId(game, event.teamId),
    };
  }
  return null;
}

export function resolveReboundTeams(
  game: Game,
  reboundShootingTeamId: string | null,
  reboundDefendingTeamId: string | null
): { shootingTeamId: string; defendingTeamId: string } | null {
  if (reboundShootingTeamId && reboundDefendingTeamId) {
    return {
      shootingTeamId: reboundShootingTeamId,
      defendingTeamId: reboundDefendingTeamId,
    };
  }
  return deriveReboundTeamsFromEvents(game);
}

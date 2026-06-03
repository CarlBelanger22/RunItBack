import type { Game } from '../App';
import { isGameInProgress } from './activeGame';

export type PlayerRemovalBlockReason = 'has_games' | 'active_game';

export interface PlayerRemovalEvaluation {
  allowed: boolean;
  reason?: PlayerRemovalBlockReason;
  gameCount?: number;
}

function gameInvolvesTeam(game: Game, teamId: string): boolean {
  return game.homeTeamId === teamId || game.awayTeamId === teamId;
}

function playerHasStatsInGame(game: Game, playerId: string): boolean {
  return (game.gameStats ?? []).some((stat) => stat.playerId === playerId);
}

function playerOnActiveGameSnapshot(game: Game, teamId: string, playerId: string): boolean {
  const snapshot = game.homeTeamId === teamId ? game.homeTeam : game.awayTeam;
  return (snapshot?.players ?? []).some((p) => p.id === playerId);
}

/** Whether a player can be removed from a team's club template. */
export function evaluatePlayerRemovalFromTeam(
  teamId: string,
  playerId: string,
  games: Game[]
): PlayerRemovalEvaluation {
  let statGameCount = 0;

  for (const game of games) {
    if (!gameInvolvesTeam(game, teamId)) continue;
    if (!playerHasStatsInGame(game, playerId)) continue;

    statGameCount++;
    if (isGameInProgress(game)) {
      return {
        allowed: false,
        reason: 'active_game',
        gameCount: statGameCount,
      };
    }
  }

  if (statGameCount > 0) {
    return {
      allowed: false,
      reason: 'has_games',
      gameCount: statGameCount,
    };
  }

  for (const game of games) {
    if (!isGameInProgress(game) || !gameInvolvesTeam(game, teamId)) continue;
    if (playerOnActiveGameSnapshot(game, teamId, playerId)) {
      return { allowed: false, reason: 'active_game', gameCount: 0 };
    }
  }

  return { allowed: true };
}

export function playerRemovalBlockMessage(
  evaluation: PlayerRemovalEvaluation,
  playerName: string,
  teamName: string
): { title: string; description: string } {
  if (evaluation.reason === 'active_game') {
    return {
      title: 'Cannot remove player',
      description: `${playerName} is on an in-progress game for ${teamName}. Finish or delete that game before removing them from the roster.`,
    };
  }

  const count = evaluation.gameCount ?? 0;
  const gameLabel = count === 1 ? 'game' : 'games';
  return {
    title: 'Cannot remove player',
    description: `${playerName} has played in ${count} ${gameLabel} for ${teamName}. Players with game history cannot be removed from the club roster.`,
  };
}

export function playerRemovalConfirmMessage(
  playerName: string,
  teamName: string
): { title: string; description: string } {
  return {
    title: `Remove ${playerName}?`,
    description: `Remove ${playerName} from ${teamName}? They can be re-added later from Add Player.`,
  };
}

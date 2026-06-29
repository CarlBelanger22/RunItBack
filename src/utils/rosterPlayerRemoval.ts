import type { Game, Team } from '../App';
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

export interface PlayerDeletionEvaluation {
  allowed: boolean;
  reason?: PlayerRemovalBlockReason;
  gameCount?: number;
  teamIds: string[];
}

function teamIdsForPlayer(playerId: string, teams: Team[]): string[] {
  const ids: string[] = [];
  for (const team of teams) {
    if ((team.players ?? []).some((p) => p.id === playerId)) {
      ids.push(team.id);
    }
  }
  return ids;
}

/** Whether a player profile can be permanently deleted from the league. */
export function evaluatePlayerDeletion(
  playerId: string,
  games: Game[],
  teams: Team[]
): PlayerDeletionEvaluation {
  const teamIds = teamIdsForPlayer(playerId, teams);
  let statGameCount = 0;

  for (const game of games) {
    if (!playerHasStatsInGame(game, playerId)) continue;
    statGameCount++;
    if (isGameInProgress(game)) {
      return {
        allowed: false,
        reason: 'active_game',
        gameCount: statGameCount,
        teamIds,
      };
    }
  }

  if (statGameCount > 0) {
    return {
      allowed: false,
      reason: 'has_games',
      gameCount: statGameCount,
      teamIds,
    };
  }

  for (const game of games) {
    if (!isGameInProgress(game)) continue;
    const onSnapshot =
      (game.homeTeam?.players ?? []).some((p) => p.id === playerId) ||
      (game.awayTeam?.players ?? []).some((p) => p.id === playerId);
    if (onSnapshot) {
      return { allowed: false, reason: 'active_game', gameCount: 0, teamIds };
    }
  }

  return { allowed: true, teamIds };
}

export function playerDeletionBlockMessage(
  evaluation: PlayerDeletionEvaluation,
  playerName: string
): { title: string; description: string } {
  if (evaluation.reason === 'active_game') {
    return {
      title: 'Cannot delete player',
      description: `${playerName} is on an in-progress game. Finish or delete that game before deleting this player.`,
    };
  }

  const count = evaluation.gameCount ?? 0;
  const gameLabel = count === 1 ? 'game' : 'games';
  return {
    title: 'Cannot delete player',
    description: `${playerName} appears in ${count} completed ${gameLabel}. Historical box scores must be preserved, so this player cannot be deleted.`,
  };
}

export function playerDeletionConfirmMessage(
  playerName: string,
  teamCount: number
): { title: string; description: string } {
  const teamNote =
    teamCount === 0
      ? 'They are not on any team roster.'
      : teamCount === 1
        ? 'They will be removed from 1 team.'
        : `They will be removed from ${teamCount} teams.`;
  return {
    title: `Delete ${playerName}?`,
    description: `Permanently delete this player from your league. ${teamNote} This cannot be undone.`,
  };
}

export function teamDeletionConfirmMessage(
  teamName: string,
  gameCount: number
): { title: string; description: string } {
  const gameNote =
    gameCount === 0
      ? 'This team has no games.'
      : gameCount === 1
        ? '1 game will be permanently deleted.'
        : `${gameCount} games will be permanently deleted.`;
  return {
    title: `Delete ${teamName}?`,
    description: `${gameNote} Players on this team are not deleted — they remain in the league if they are on other teams, or become available as existing players when adding to a roster.`,
  };
}

export function tournamentRosterRemoveConfirmMessage(
  playerName: string,
  tournamentName: string,
  gameCount: number
): { title: string; description: string } {
  if (gameCount === 0) {
    return {
      title: `Remove from ${tournamentName}?`,
      description: `Remove ${playerName} from this tournament's season roster? They stay on the club roster.`,
    };
  }
  const gameLabel = gameCount === 1 ? 'game' : 'games';
  return {
    title: `Remove from ${tournamentName}?`,
    description: `${playerName} has played in ${gameCount} ${gameLabel} for this team in this tournament. Removing them from the tournament roster will not delete past box scores, but they will no longer appear on this season's roster.`,
  };
}

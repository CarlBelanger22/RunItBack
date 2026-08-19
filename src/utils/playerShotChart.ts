import type { Game, Shot } from '../App';
import { gameHasShotChartData } from './gameDisplay';
import {
  tournamentMatchesSelection,
  type TournamentIdSet,
} from './tournamentSelection';

export interface PlayerShotChartAggregation {
  shots: Shot[];
  gamesInScope: number;
  gamesWithShotData: number;
}

export function playerAppearedInGame(game: Game, playerId: string): boolean {
  if (game.gameStats?.some((stat) => stat.playerId === playerId)) return true;
  return (game.shots ?? []).some((shot) => shot.playerId === playerId);
}

export function collectPlayerShotChartData(
  playerId: string,
  games: Game[],
  selectedTournamentIds: TournamentIdSet
): PlayerShotChartAggregation {
  const scoped = (games ?? []).filter(
    (game) =>
      playerAppearedInGame(game, playerId) &&
      tournamentMatchesSelection(game.tournamentId, selectedTournamentIds)
  );

  const shots: Shot[] = [];
  for (const game of scoped) {
    for (const shot of game.shots ?? []) {
      if (shot.playerId === playerId) shots.push(shot);
    }
  }

  return {
    shots,
    gamesInScope: scoped.length,
    gamesWithShotData: scoped.filter((game) => gameHasShotChartData(game)).length,
  };
}

/** Muted coverage copy; null when every in-scope game has locations (or there are no games). */
export function playerShotChartCoverageNote(
  aggregation: PlayerShotChartAggregation
): string | null {
  const { gamesInScope, gamesWithShotData } = aggregation;
  if (gamesInScope === 0) return null;
  if (gamesWithShotData === 0) {
    return `None of these ${gamesInScope} games have shot locations.`;
  }
  if (gamesWithShotData < gamesInScope) {
    return `Chart uses shot locations from ${gamesWithShotData} of ${gamesInScope} games in this view.`;
  }
  return null;
}

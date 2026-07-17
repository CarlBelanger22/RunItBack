import type { Game, GameStats, Tournament } from '../App';
import { getTournamentGameFormat } from './gameFormat';

/**
 * FIBA foul-out (disqualification) thresholds. A player is disqualified when
 * ANY of these hold — see {@link isPlayerFouledOut}.
 */
export const FOUL_OUT_TOTAL = 5; // total personal fouls (incl. tech/unsportsmanlike)
export const TECH_FOUL_OUT = 2; // technical fouls
export const UNSPORTSMANLIKE_FOUL_OUT = 2; // unsportsmanlike fouls

type FoulCounts = Pick<GameStats, 'fouls' | 'tech_fouls' | 'unsportsmanlike_fouls'>;

/**
 * FIBA disqualification — a player fouls out on any of 4 triggers:
 *   (a) 5 total fouls (the total already includes any tech/unsportsmanlike),
 *   (b) 2 technical fouls,
 *   (c) 2 unsportsmanlike fouls,
 *   (d) 1 technical + 1 unsportsmanlike (combined).
 */
export function isPlayerFouledOut(stats: FoulCounts | null | undefined): boolean {
  if (!stats) return false;
  const total = stats.fouls ?? 0;
  const tech = stats.tech_fouls ?? 0;
  const unsportsmanlike = stats.unsportsmanlike_fouls ?? 0;
  return (
    total >= FOUL_OUT_TOTAL ||
    tech >= TECH_FOUL_OUT ||
    unsportsmanlike >= UNSPORTSMANLIKE_FOUL_OUT ||
    (tech >= 1 && unsportsmanlike >= 1)
  );
}

/**
 * Foul-out only applies to 5v5. 3×3 has no individual foul-out (team-foul
 * penalties instead), so it is skipped entirely.
 */
export function isFoulOutEnabled(
  game: Pick<Game, 'tournamentId'> | null | undefined,
  tournament?: Pick<Tournament, 'id' | 'gameFormat'> | null
): boolean {
  if (!game) return false;
  return getTournamentGameFormat(game.tournamentId, tournament) === '5v5';
}

export interface FouledOutPlayer {
  playerId: string;
  teamId: string;
}

/**
 * Returns the on-court players (either team) who are currently fouled out,
 * gated to foul-out-enabled (5v5) games. On-court ids are passed in because
 * the live session owns lineup state.
 */
export function getFouledOutOnCourt(
  game: Game | null | undefined,
  onCourtHomeIds: string[],
  onCourtAwayIds: string[],
  tournament?: Pick<Tournament, 'id' | 'gameFormat'> | null
): FouledOutPlayer[] {
  if (!game || !isFoulOutEnabled(game, tournament)) return [];

  const statsByPlayer = new Map(game.gameStats.map((s) => [s.playerId, s]));
  const result: FouledOutPlayer[] = [];

  const scan = (ids: string[], teamId: string) => {
    for (const playerId of ids) {
      if (isPlayerFouledOut(statsByPlayer.get(playerId))) {
        result.push({ playerId, teamId });
      }
    }
  };

  scan(onCourtHomeIds, game.homeTeamId);
  scan(onCourtAwayIds, game.awayTeamId);

  return result;
}

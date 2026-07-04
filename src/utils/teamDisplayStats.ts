import type { Game } from '../App';
import {
  getPersistedTeamStats,
  resolveSideScore,
  resolveTeamTotals,
  teamHasPlayerBoxScore,
  type TeamSide,
} from './gameDisplay';

export interface TeamDisplayStats {
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  rebounds: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  assistToTurnoverRatio: number;
  effectiveFieldGoalPercentage: number;
  trueShootingPercentage: number;
  scoreOnly: boolean;
}

export function buildTeamDisplayStats(
  game: Game,
  side: TeamSide
): TeamDisplayStats {
  const totals = resolveTeamTotals(game, side);
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const fromPlayers = teamHasPlayerBoxScore(game, team);

  const rebounds = totals.scoreOnly
    ? 0
    : fromPlayers
      ? totals.orb + totals.drb
      : getPersistedTeamStats(game, side)?.total_rebounds ??
        totals.orb + totals.drb;
  const drb = totals.drb;

  const assistToTurnoverRatio =
    totals.turnovers > 0 ? totals.assists / totals.turnovers : totals.assists;
  const effectiveFieldGoalPercentage =
    totals.fg_attempted > 0
      ? ((totals.fg_made + 0.5 * totals.three_made) / totals.fg_attempted) * 100
      : 0;
  const trueShootingPercentage =
    totals.fg_attempted + 0.44 * totals.ft_attempted > 0
      ? (totals.points / (2 * (totals.fg_attempted + 0.44 * totals.ft_attempted))) *
        100
      : 0;

  return {
    points: resolveSideScore(game, side),
    fg_made: totals.fg_made,
    fg_attempted: totals.fg_attempted,
    three_made: totals.three_made,
    three_attempted: totals.three_attempted,
    ft_made: totals.ft_made,
    ft_attempted: totals.ft_attempted,
    rebounds,
    drb,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    assistToTurnoverRatio,
    effectiveFieldGoalPercentage,
    trueShootingPercentage,
    scoreOnly: totals.scoreOnly,
  };
}

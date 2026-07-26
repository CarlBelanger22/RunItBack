import type { TeamStats } from '../App';

function pctLabel(made: number, attempted: number): string {
  return attempted > 0 ? `${Math.round((made / attempted) * 100)}%` : '—';
}

/** Live single-team Opp strip — reads teamStats.away directly (not score-only resolve). */
export interface OppTeamTotalsStripModel {
  fgMade: number;
  fgAttempted: number;
  fgPctLabel: string;
  threeMade: number;
  threeAttempted: number;
  threePctLabel: string;
  ftMade: number;
  ftAttempted: number;
  ftPctLabel: string;
  points: number;
  reb: number;
  turnovers: number;
  fouls: number;
}

export function buildOppTeamTotalsStrip(stats: TeamStats): OppTeamTotalsStripModel {
  const fgMade = stats.fg_made ?? 0;
  const fgAttempted = stats.fg_attempted ?? 0;
  const threeMade = stats.three_made ?? 0;
  const threeAttempted = stats.three_attempted ?? 0;
  const ftMade = stats.ft_made ?? 0;
  const ftAttempted = stats.ft_attempted ?? 0;
  const reb =
    typeof stats.total_rebounds === 'number'
      ? stats.total_rebounds
      : (stats.orb ?? 0) + (stats.drb ?? 0) + (stats.team_rebounds ?? 0);

  return {
    fgMade,
    fgAttempted,
    fgPctLabel: pctLabel(fgMade, fgAttempted),
    threeMade,
    threeAttempted,
    threePctLabel: pctLabel(threeMade, threeAttempted),
    ftMade,
    ftAttempted,
    ftPctLabel: pctLabel(ftMade, ftAttempted),
    points: stats.total_points ?? 0,
    reb,
    turnovers: stats.turnovers ?? 0,
    fouls: stats.fouls ?? 0,
  };
}

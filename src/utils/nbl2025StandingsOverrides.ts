/**
 * One-off NBL Div 1 2025 standings presentation for Adroit DQ:
 * keep W–L/stats, pin demoted club to the bottom of its table, footnote
 * on Standings (same pattern as REKT SGKR withdrawals).
 */

export const NBL_D1_2025_TOURNAMENT_ID = 'tournament-nbl-d1-2025';
export const NBL_D1_2025_DEMOTED_TEAM_ID = 'team-nbl-d1-2025-adroit';
export const NBL_D1_2025_STANDINGS_FOOTNOTE =
  'Adroit were disqualified for fielding suspended players in the semi-final.';

type StandingsOverride = {
  demotedTeamIds: readonly string[];
  footnote: string;
};

const OVERRIDES: Record<string, StandingsOverride> = {
  [NBL_D1_2025_TOURNAMENT_ID]: {
    demotedTeamIds: [NBL_D1_2025_DEMOTED_TEAM_ID],
    footnote: NBL_D1_2025_STANDINGS_FOOTNOTE,
  },
};

function overrideFor(
  tournamentId: string | undefined | null
): StandingsOverride | null {
  if (!tournamentId) return null;
  return OVERRIDES[tournamentId] ?? null;
}

export function isNbl2025StandingsOverride(
  tournamentId: string | undefined | null
): boolean {
  return overrideFor(tournamentId) !== null;
}

export function isNbl2025DemotedTeam(
  tournamentId: string | undefined | null,
  teamId: string | undefined | null
): boolean {
  const o = overrideFor(tournamentId);
  if (!o || !teamId) return false;
  return o.demotedTeamIds.includes(teamId);
}

export function nbl2025StandingsFootnote(
  tournamentId: string | undefined | null
): string | null {
  return overrideFor(tournamentId)?.footnote ?? null;
}

/** Stable: move demoted team(s) to the end; leave others' relative order. */
export function applyNbl2025StandingsOrder<T extends { team: { id: string } }>(
  tournamentId: string | undefined | null,
  rows: T[]
): T[] {
  const o = overrideFor(tournamentId);
  if (!o) return rows;
  const demotedIds = new Set(o.demotedTeamIds);
  const kept: T[] = [];
  const demoted: T[] = [];
  for (const row of rows) {
    if (demotedIds.has(row.team.id)) demoted.push(row);
    else kept.push(row);
  }
  if (demoted.length === 0) return rows;
  return [...kept, ...demoted];
}

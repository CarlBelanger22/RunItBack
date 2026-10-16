/**
 * One-off REKT standings presentation for mid-season withdrawals:
 * keep W–L/stats, pin demoted club to the bottom of its table, footnote
 * on Standings (not a silent rewrite of games).
 */

export const REKT_S3_TOURNAMENT_ID = 'tournament-rekt-s3-2026';
export const REKT_S3_DEMOTED_TEAM_ID = 'team-rekt-s1-sgkr';
export const REKT_S3_STANDINGS_FOOTNOTE =
  'SGKR withdrew from the season and were replaced by MGM.';

export const REKT_GLEAGUE_S3_TOURNAMENT_ID = 'tournament-rekt-gleague-s3-2026';
export const REKT_GLEAGUE_S3_DEMOTED_TEAM_ID = 'team-rekt-gl-s3-sgkr';
export const REKT_GLEAGUE_S3_STANDINGS_FOOTNOTE =
  'SGKR (G-league) withdrew from the season and were replaced by APEX Basketball.';

type StandingsOverride = {
  demotedTeamIds: readonly string[];
  footnote: string;
};

const OVERRIDES: Record<string, StandingsOverride> = {
  [REKT_S3_TOURNAMENT_ID]: {
    demotedTeamIds: [REKT_S3_DEMOTED_TEAM_ID],
    footnote: REKT_S3_STANDINGS_FOOTNOTE,
  },
  [REKT_GLEAGUE_S3_TOURNAMENT_ID]: {
    demotedTeamIds: [REKT_GLEAGUE_S3_DEMOTED_TEAM_ID],
    footnote: REKT_GLEAGUE_S3_STANDINGS_FOOTNOTE,
  },
};

function overrideFor(
  tournamentId: string | undefined | null
): StandingsOverride | null {
  if (!tournamentId) return null;
  return OVERRIDES[tournamentId] ?? null;
}

export function isRektS3StandingsOverride(
  tournamentId: string | undefined | null
): boolean {
  return overrideFor(tournamentId) !== null;
}

export function isRektS3DemotedTeam(
  tournamentId: string | undefined | null,
  teamId: string | undefined | null
): boolean {
  const o = overrideFor(tournamentId);
  if (!o || !teamId) return false;
  return o.demotedTeamIds.includes(teamId);
}

export function rektS3StandingsFootnote(
  tournamentId: string | undefined | null
): string | null {
  return overrideFor(tournamentId)?.footnote ?? null;
}

/** Stable: move demoted team(s) to the end; leave others' relative order. */
export function applyRektS3StandingsOrder<T extends { team: { id: string } }>(
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

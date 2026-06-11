import type { Team } from '../App';

/** Opponent placeholder with no roster (typical score-only / single-track away team). */
export function isGhostTeam(team: Team): boolean {
  return team.players.length === 0;
}

export function partitionTeams(teams: Team[]): {
  realTeams: Team[];
  ghostTeams: Team[];
} {
  const realTeams: Team[] = [];
  const ghostTeams: Team[] = [];
  for (const team of teams) {
    if (isGhostTeam(team)) {
      ghostTeams.push(team);
    } else {
      realTeams.push(team);
    }
  }
  return { realTeams, ghostTeams };
}

export function countGhostTeams(teams: Team[]): number {
  return partitionTeams(teams).ghostTeams.length;
}

export function countRealTeams(teams: Team[]): number {
  return partitionTeams(teams).realTeams.length;
}

/** Most players first; name A–Z when tied. */
export function sortTeamsByPlayerCountDesc(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const byPlayers = b.players.length - a.players.length;
    if (byPlayers !== 0) return byPlayers;
    return a.name.localeCompare(b.name);
  });
}

import type { TeamCoachStats, TeamStats } from '../App';

export type { TeamCoachStats };

export const EMPTY_TEAM_COACH: TeamCoachStats = {
  orb: 0,
  drb: 0,
  turnovers: 0,
  fouls: 0,
};

export function resolveTeamCoach(
  stats: TeamStats | undefined
): TeamCoachStats {
  const raw = stats?.team_coach;
  if (!raw) return { ...EMPTY_TEAM_COACH };
  return {
    orb: raw.orb ?? 0,
    drb: raw.drb ?? 0,
    turnovers: raw.turnovers ?? 0,
    fouls: raw.fouls ?? 0,
  };
}

export function addTeamCoachToPlayerSums(
  fromPlayers: {
    orb: number;
    drb: number;
    turnovers: number;
    fouls: number;
  },
  coach: TeamCoachStats
): Pick<TeamCoachStats, 'orb' | 'drb' | 'turnovers' | 'fouls'> {
  return {
    orb: fromPlayers.orb + coach.orb,
    drb: fromPlayers.drb + coach.drb,
    turnovers: fromPlayers.turnovers + coach.turnovers,
    fouls: fromPlayers.fouls + coach.fouls,
  };
}

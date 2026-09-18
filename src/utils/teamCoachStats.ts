import type { Game, TeamCoachStats, TeamStats } from '../App';

export type { TeamCoachStats };

export const EMPTY_TEAM_COACH: TeamCoachStats = {
  orb: 0,
  drb: 0,
  turnovers: 0,
  fouls: 0,
};

export function teamCoachHasValues(coach: TeamCoachStats): boolean {
  return (
    coach.orb > 0 ||
    coach.drb > 0 ||
    coach.turnovers > 0 ||
    coach.fouls > 0
  );
}

/** Rebuild Team/Coach credits from the event log (live-entry source of truth). */
export function deriveTeamCoachFromEvents(
  game: Pick<Game, 'events'>,
  teamId: string
): TeamCoachStats {
  const coach: TeamCoachStats = { ...EMPTY_TEAM_COACH };

  for (const event of game.events ?? []) {
    if (event.teamId !== teamId) continue;
    const details = event.details ?? {};

    if (event.type === 'rebound') {
      const rt = details.reboundType as string | undefined;
      if (rt === 'team_offensive') coach.orb += 1;
      else if (rt === 'team_defensive') coach.drb += 1;
      continue;
    }

    if (event.type === 'turnover' && details.isTeamTurnover) {
      coach.turnovers += 1;
      continue;
    }

    if (
      event.type === 'foul' &&
      (details.isTeamFoul || details.isCoachFoul)
    ) {
      coach.fouls += 1;
    }
  }

  return coach;
}

export function resolveTeamCoach(
  stats: TeamStats | undefined,
  game?: Pick<Game, 'events'>,
  teamId?: string
): TeamCoachStats {
  const persisted: TeamCoachStats = (() => {
    const raw = stats?.team_coach;
    if (!raw) return { ...EMPTY_TEAM_COACH };
    return {
      orb: raw.orb ?? 0,
      drb: raw.drb ?? 0,
      turnovers: raw.turnovers ?? 0,
      fouls: raw.fouls ?? 0,
    };
  })();

  if (game && teamId) {
    const fromEvents = deriveTeamCoachFromEvents(game, teamId);
    // Prefer event log when it has Team/Coach activity (fixes lost team_coach on save).
    if (teamCoachHasValues(fromEvents)) return fromEvents;
  }

  return persisted;
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

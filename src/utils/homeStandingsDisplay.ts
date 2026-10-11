/**
 * Home Standings card: finish-place order when a champion is locked,
 * otherwise all-games W–L (existing behaviour).
 */
import type { Game, Team } from '../App';
import {
  buildTeamProgressionPlaces,
  type TeamProgressionPlace,
} from './tournamentProgression';
import type { StandingRow } from './tournamentStandings';
import type { TournamentStructure } from './tournamentStructure';

export type HomeStandingMedal = 'gold' | 'silver' | 'bronze';

export interface HomeStandingDisplayRow {
  team: Team;
  wins: number;
  losses: number;
  winPercentage: number;
  /** Finish place (progression) or W–L rank. */
  place: number;
  locked: boolean;
  medal: HomeStandingMedal | null;
  source: 'progression' | 'record';
}

function medalForPlace(place: number): HomeStandingMedal | null {
  if (place === 1) return 'gold';
  if (place === 2) return 'silver';
  if (place === 3) return 'bronze';
  return null;
}

function hasLockedChampion(
  progression: Map<string, TeamProgressionPlace>
): boolean {
  for (const row of progression.values()) {
    if (row.place === 1 && row.locked) return true;
  }
  return false;
}

/**
 * Build Home card rows. When progression has a locked place-1 champion,
 * sort by finish place; else keep W–L order from `standings`.
 */
export function buildHomeStandingDisplayRows(input: {
  structure: TournamentStructure | null | undefined;
  games: Game[];
  teams: Team[];
  /** All-games W–L standings (current Home calculateHomeStandings). */
  standings: StandingRow[];
}): HomeStandingDisplayRow[] {
  const progression = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });

  if (!hasLockedChampion(progression)) {
    return input.standings.map((row, index) => ({
      team: row.team,
      wins: row.wins,
      losses: row.losses,
      winPercentage: row.winPercentage,
      place: index + 1,
      locked: false,
      medal: null,
      source: 'record' as const,
    }));
  }

  const rows: HomeStandingDisplayRow[] = input.standings.map((row) => {
    const prog = progression.get(row.team.id);
    const place = prog?.place ?? 999;
    return {
      team: row.team,
      wins: row.wins,
      losses: row.losses,
      winPercentage: row.winPercentage,
      place,
      locked: prog?.locked ?? false,
      medal: medalForPlace(place),
      source: 'progression' as const,
    };
  });

  rows.sort(
    (a, b) =>
      a.place - b.place ||
      b.wins - a.wins ||
      b.winPercentage - a.winPercentage ||
      a.team.name.localeCompare(b.team.name)
  );

  return rows;
}

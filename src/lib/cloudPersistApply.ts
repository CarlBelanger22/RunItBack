/**
 * LE-101 — Avoid applying a finished cloud save over newer local edits.
 */
import type { Team, Tournament } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';

export function fingerprintPersistSlice(args: {
  teams: Team[];
  tournaments: Tournament[];
  tournamentRosters: TournamentRosterEntry[];
}): string {
  return JSON.stringify({
    teams: args.teams,
    tournaments: args.tournaments,
    tournamentRosters: args.tournamentRosters,
  });
}

/** True when optimistic local state moved on while a save was in flight. */
export function localPersistSliceDiverged(args: {
  savedTeams: Team[];
  savedTournaments: Tournament[];
  savedRosters: TournamentRosterEntry[];
  localTeams: Team[];
  localTournaments: Tournament[];
  localRosters: TournamentRosterEntry[];
}): boolean {
  return (
    fingerprintPersistSlice({
      teams: args.savedTeams,
      tournaments: args.savedTournaments,
      tournamentRosters: args.savedRosters,
    }) !==
    fingerprintPersistSlice({
      teams: args.localTeams,
      tournaments: args.localTournaments,
      tournamentRosters: args.localRosters,
    })
  );
}

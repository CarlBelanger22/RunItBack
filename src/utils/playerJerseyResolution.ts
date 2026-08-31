import type { Game, Team, Tournament } from '../App';
import type { TournamentRosterEntry } from './tournamentRosters';
import {
  buildClubRosterByTeam,
  resolvePlayerTeamSideInGame,
} from './tournamentRosters';
import { getPlayerRosterEntries } from './rosterPlayers';
import type { JerseyTeamEntry } from './playerJerseyGroups';
import { getTournamentDateMs } from './tournamentSort';

export interface PlayerJerseyEditorTeamGroup {
  team: Team;
  clubNumber: number;
  tournaments: Array<{
    tournamentId: string;
    tournamentName: string;
    number: number;
  }>;
}

export interface TournamentJerseyUpdate {
  tournamentId: string;
  teamId: string;
  number: number;
}

function playerAppearedForTeamInGame(
  game: Game,
  playerId: string,
  teamId: string,
  teams: Team[]
): boolean {
  if (!(game.gameStats ?? []).some((stat) => stat.playerId === playerId)) {
    return false;
  }
  const clubRosterByTeam = buildClubRosterByTeam(teams);
  return resolvePlayerTeamSideInGame(playerId, game, clubRosterByTeam) === teamId;
}

function countCompletedGamesForPlayerTeamInTournament(
  games: Game[],
  tournamentId: string,
  playerId: string,
  teamId: string,
  teams: Team[]
): number {
  let count = 0;
  for (const game of games) {
    if (!game.isCompleted || game.tournamentId !== tournamentId) continue;
    if (!playerAppearedForTeamInGame(game, playerId, teamId, teams)) continue;
    count++;
  }
  return count;
}

/** Max completed game.date for this player+team in the tournament (ms). */
function maxCompletedGameDateMsForPlayerTeamInTournament(
  games: Game[],
  tournamentId: string,
  playerId: string,
  teamId: string,
  teams: Team[]
): number {
  let maxMs = 0;
  for (const game of games) {
    if (!game.isCompleted || game.tournamentId !== tournamentId) continue;
    if (!playerAppearedForTeamInGame(game, playerId, teamId, teams)) continue;
    const ms = Date.parse(game.date ?? '');
    if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  return maxMs;
}

function compareTournamentRowsForPlayer(
  a: TournamentRosterEntry,
  b: TournamentRosterEntry,
  playerId: string,
  teamId: string,
  tournaments: Tournament[],
  games: Game[],
  teams: Team[]
): number {
  const tournamentA = tournaments.find((t) => t.id === a.tournamentId);
  const tournamentB = tournaments.find((t) => t.id === b.tournamentId);
  const dateDiff =
    getTournamentDateMs(tournamentB ?? { month: '', year: 0 }) -
    getTournamentDateMs(tournamentA ?? { month: '', year: 0 });
  if (dateDiff !== 0) return dateDiff;

  const latestGameA = maxCompletedGameDateMsForPlayerTeamInTournament(
    games,
    a.tournamentId,
    playerId,
    teamId,
    teams
  );
  const latestGameB = maxCompletedGameDateMsForPlayerTeamInTournament(
    games,
    b.tournamentId,
    playerId,
    teamId,
    teams
  );
  if (latestGameB !== latestGameA) return latestGameB - latestGameA;

  const countA = countCompletedGamesForPlayerTeamInTournament(
    games,
    a.tournamentId,
    playerId,
    teamId,
    teams
  );
  const countB = countCompletedGamesForPlayerTeamInTournament(
    games,
    b.tournamentId,
    playerId,
    teamId,
    teams
  );
  if (countB !== countA) return countB - countA;

  const nameA = tournamentA?.name ?? a.tournamentId;
  const nameB = tournamentB?.name ?? b.tournamentId;
  return nameA.localeCompare(nameB);
}

export function resolveLatestJerseyNumber(
  teamId: string,
  playerId: string,
  tournamentRosters: TournamentRosterEntry[],
  tournaments: Tournament[],
  games: Game[],
  teams: Team[],
  clubFallback: number
): number {
  const rows = tournamentRosters.filter(
    (row) => row.teamId === teamId && row.playerId === playerId
  );
  if (rows.length === 0) return clubFallback;

  const sorted = [...rows].sort((a, b) =>
    compareTournamentRowsForPlayer(a, b, playerId, teamId, tournaments, games, teams)
  );

  return sorted[0]?.number ?? clubFallback;
}

/** Distinct (team, number) pairs for profile jersey icons — tournament rows drive icons. */
export function buildPlayerJerseyScopeEntries(
  playerId: string,
  teams: Team[],
  games: Game[],
  tournamentRosters: TournamentRosterEntry[]
): JerseyTeamEntry[] {
  const entries: JerseyTeamEntry[] = [];
  const seen = new Set<string>();

  for (const row of tournamentRosters.filter((entry) => entry.playerId === playerId)) {
    const team = teams.find((t) => t.id === row.teamId);
    if (!team) continue;
    const key = `${row.teamId}:${row.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ team, number: row.number });
  }

  for (const { team, player } of getPlayerRosterEntries(playerId, teams, games)) {
    const hasTournamentRow = tournamentRosters.some(
      (row) => row.playerId === playerId && row.teamId === team.id
    );
    if (hasTournamentRow) continue;
    const key = `${team.id}:${player.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ team, number: player.number });
  }

  return entries;
}

export function buildPlayerJerseyEditorGroups(
  playerId: string,
  teams: Team[],
  tournaments: Tournament[],
  games: Game[],
  tournamentRosters: TournamentRosterEntry[]
): PlayerJerseyEditorTeamGroup[] {
  return getPlayerRosterEntries(playerId, teams, games).map(({ team, player }) => {
    const tournamentRows = tournamentRosters
      .filter((row) => row.playerId === playerId && row.teamId === team.id)
      .map((row) => ({
        tournamentId: row.tournamentId,
        tournamentName:
          tournaments.find((t) => t.id === row.tournamentId)?.name ??
          row.tournamentId,
        number: row.number,
        row,
      }))
      .sort((a, b) =>
        compareTournamentRowsForPlayer(
          a.row,
          b.row,
          playerId,
          team.id,
          tournaments,
          games,
          teams
        )
      )
      .map(({ tournamentId, tournamentName, number }) => ({
        tournamentId,
        tournamentName,
        number,
      }));

    return {
      team,
      clubNumber: resolveLatestJerseyNumber(
        team.id,
        playerId,
        tournamentRosters,
        tournaments,
        games,
        teams,
        player.number
      ),
      tournaments: tournamentRows,
    };
  });
}

export function collectTournamentJerseyUpdates(
  playerId: string,
  groups: PlayerJerseyEditorTeamGroup[],
  tournamentNumbers: Record<string, string>
): TournamentJerseyUpdate[] {
  const updates: TournamentJerseyUpdate[] = [];

  for (const group of groups) {
    for (const tournament of group.tournaments) {
      const key = `${group.team.id}:${tournament.tournamentId}`;
      const raw = tournamentNumbers[key] ?? String(tournament.number);
      const parsed = parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99) continue;
      updates.push({
        tournamentId: tournament.tournamentId,
        teamId: group.team.id,
        number: parsed,
      });
    }
  }

  return updates;
}

/**
 * Option B: when tournament rows exist, club = latest tournament jersey (draft),
 * ignoring clubNumbers draft. Otherwise fall back to club draft / group.clubNumber.
 * `groups.tournaments` must already be sorted newest-first.
 */
export function resolveClubJerseyByTeamId(
  groups: PlayerJerseyEditorTeamGroup[],
  clubNumbers: Record<string, string>,
  tournamentNumbers: Record<string, string> = {}
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const group of groups) {
    if (group.tournaments.length > 0) {
      const latest = group.tournaments[0];
      const key = `${group.team.id}:${latest.tournamentId}`;
      const raw = tournamentNumbers[key] ?? String(latest.number);
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 99) {
        result[group.team.id] = parsed;
      }
      continue;
    }

    const raw = clubNumbers[group.team.id] ?? String(group.clubNumber);
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 99) {
      result[group.team.id] = parsed;
    }
  }
  return result;
}

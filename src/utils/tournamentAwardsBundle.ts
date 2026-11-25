/**
 * Single-pass Awards inputs: one aggregate + shared TeamDef/TSI maps for
 * Individual / All-Teams / All-Defensive (identical outputs to separate builds).
 */
import type { Game, Team, Tournament } from '../App';
import type { TournamentStructure } from './tournamentStructure';
import type { TournamentRosterEntry } from './tournamentRosters';
import {
  aggregateTournamentAwardPlayers,
  buildAwardTeamWinPctMap,
  buildRookieAndMostImprovedSections,
  buildTeamDefMultiplierMap,
  buildTournamentAwardSections,
  spliceAfterSixthMan,
  tournamentHasPlusMinusCoverage,
  type TournamentAwardSection,
} from './tournamentAwards';
import {
  buildAllTournamentTeams,
  type AllTournamentTeamsResult,
} from './tournamentAllTeams';
import {
  buildAllDefensiveTeams,
  type AllDefensiveTeamsResult,
} from './tournamentAllDefensive';
import {
  buildTeamProgressionPlaces,
  countTournamentTeamsForProgression,
} from './tournamentProgression';
import {
  buildTeamDef01Map,
  buildTeamSuccessIndexMap,
} from './tournamentAwardScoring';
import {
  aggregateClutchStatsByPlayer,
  tournamentHasClutchPbpCoverage,
} from './tournamentClutch';
import { buildFinalsMvpContenders } from './tournamentFinalsMvp';

export type TournamentAwardsBundle = {
  sections: TournamentAwardSection[];
  allTeams: AllTournamentTeamsResult;
  allDefensive: AllDefensiveTeamsResult;
};

export function buildTournamentAwardsBundle(input: {
  tournamentId: string;
  tournamentName: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  structure?: TournamentStructure | null;
  tournament?: Pick<
    Tournament,
    'id' | 'year' | 'createdAt' | 'awardSeriesId' | 'rookieMode' | 'structure'
  >;
  allTournaments?: Tournament[];
  allGames?: Game[];
}): TournamentAwardsBundle {
  const players = aggregateTournamentAwardPlayers({
    tournamentId: input.tournamentId,
    games: input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
  });

  const progressionByTeamId = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });
  const nTeamsForProgression = countTournamentTeamsForProgression(
    input.teams,
    input.games,
    progressionByTeamId
  );
  const teamWinPctByTeamId = buildAwardTeamWinPctMap(input.games, input.teams);
  const tsiByTeamId = buildTeamSuccessIndexMap({
    games: input.games,
    teams: input.teams,
    progression: progressionByTeamId,
    nTeams: nTeamsForProgression,
    winPctByTeamId: teamWinPctByTeamId,
  });
  const includePlusMinus = tournamentHasPlusMinusCoverage(input.games);
  const teamDef01ByTeamId = buildTeamDef01Map(input.games, input.teams);

  const includeClutch = tournamentHasClutchPbpCoverage(input.games);
  const finalsMvpContenders = buildFinalsMvpContenders({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
  });

  const sectionsBase = buildTournamentAwardSections(players, {
    includePlusMinus,
    includeClutch,
    clutchByPlayerId: includeClutch
      ? aggregateClutchStatsByPlayer(input.games)
      : undefined,
    teamDef01ByTeamId,
    teamDefMultiplierByTeamId: buildTeamDefMultiplierMap(
      input.games,
      input.teams
    ),
    teamWinPctByTeamId,
    tsiByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    finalsMvpContenders,
  });

  const currentMeta = input.tournament ?? {
    id: input.tournamentId,
    year: 0,
    awardSeriesId: undefined,
    rookieMode: undefined,
  };
  const rookieMip = buildRookieAndMostImprovedSections({
    current: currentMeta,
    allTournaments: input.allTournaments ?? [],
    allGames: input.allGames ?? input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
    currentPlayers: players,
    currentTsiByTeamId: tsiByTeamId,
  });
  const sections = spliceAfterSixthMan(sectionsBase, rookieMip);

  const allTeams = buildAllTournamentTeams({
    tournamentName: input.tournamentName,
    players,
    teamWinPctByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    tsiByTeamId,
    includePlusMinus,
  });

  const allDefensive = buildAllDefensiveTeams({
    tournamentName: input.tournamentName,
    players,
    teamWinPctByTeamId,
    teamDef01ByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    tsiByTeamId,
    includePlusMinus,
  });

  return { sections, allTeams, allDefensive };
}

/**
 * LE-95 — Assign stageId / groupId on games from tournament structure.
 * Group games: both teams in the same RR group.
 * Classification: both teams finished the same place in their groups
 * (1st → Semis & Finals, 2nd → 5th–8th Placement, …).
 */

import type { Game } from '../App';
import type {
  TournamentGroup,
  TournamentStage,
  TournamentStructure,
} from './tournamentStructure';
import { findStage, normalizeTournamentStructure } from './tournamentStructure';
import {
  filterGamesForGroup,
  calculateTeamStandings,
} from './tournamentStandings';
import { matchupGamesSorted, matchupPairKey } from './matchupGamePick';
import type { Team } from '../App';
import {
  resolveGroupTeamIds,
  roundRobinStages,
} from './groupMembers';

export interface RetagReport {
  groupTagged: number;
  classificationTagged: number;
  skipped: number;
  details: string[];
}

export interface RetagResult {
  games: Game[];
  report: RetagReport;
}

function teamGroupMapForStage(
  stage: TournamentStage,
  structure: TournamentStructure
): Map<string, TournamentGroup> {
  const map = new Map<string, TournamentGroup>();
  for (const group of stage.groups ?? []) {
    for (const teamId of resolveGroupTeamIds(group, structure)) {
      map.set(teamId, group);
    }
  }
  return map;
}

function findGroupStageId(
  structure: TournamentStructure,
  groupId: string
): string | undefined {
  for (const stage of structure.stages) {
    if (stage.groups?.some((g) => g.id === groupId)) return stage.id;
  }
  return undefined;
}

/** Rank within a group from group-only games (1 = best). */
export function computeGroupFinishPlaces(
  group: TournamentGroup,
  games: Game[],
  structure?: TournamentStructure
): Map<string, number> {
  const stageId = structure ? findGroupStageId(structure, group.id) : undefined;
  const groupGames = filterGamesForGroup(games, group, structure, stageId);
  const memberIds = resolveGroupTeamIds(group, structure);
  const stubTeams: Team[] = memberIds.map((id) => ({
    id,
    name: id,
    abbreviation: id,
    players: [],
  }));
  const ordered = calculateTeamStandings(stubTeams, groupGames, {
    h2hTiebreak: true,
  });
  const places = new Map<string, number>();
  ordered.forEach((row, index) => places.set(row.team.id, index + 1));
  return places;
}

function classificationStageForPlace(
  stages: TournamentStage[],
  place: number
): TournamentStage | undefined {
  const classification = stages
    .filter((s) => s.kind === 'classification')
    .sort((a, b) => a.order - b.order);
  return classification[place - 1];
}

/** Placement / rematch stage: last classification by order (or only one). */
function placementClassificationStage(
  stages: TournamentStage[]
): TournamentStage | undefined {
  const classification = stages
    .filter((s) => s.kind === 'classification')
    .sort((a, b) => a.order - b.order);
  if (classification.length === 0) return undefined;
  return classification[classification.length - 1];
}

/**
 * Retag tournament games. Clears previous stage/group tags on games in this
 * tournament, then assigns from structure.
 * LE-116: same-group rematches (later H2H) → classification, not RR.
 */
export function retagTournamentGames(
  allGames: Game[],
  tournamentId: string,
  structureInput: TournamentStructure | undefined
): RetagResult {
  const structure = normalizeTournamentStructure(structureInput);
  const report: RetagReport = {
    groupTagged: 0,
    classificationTagged: 0,
    skipped: 0,
    details: [],
  };

  if (!structure) {
    return { games: allGames, report };
  }

  const rrStages = roundRobinStages(structure);
  if (rrStages.length === 0) {
    report.details.push('No round_robin stage — nothing to retag from groups.');
    return { games: allGames, report };
  }

  const primaryRr = rrStages[0];
  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);
  const primaryGroupByTeam = teamGroupMapForStage(primaryRr, structure);
  const placesByTeam = new Map<string, number>();
  for (const group of primaryRr.groups ?? []) {
    const places = computeGroupFinishPlaces(group, tournamentGames, structure);
    for (const [teamId, place] of places) {
      placesByTeam.set(teamId, place);
    }
  }

  /** Earliest game id per unordered pair within an RR stage (rematch detection). */
  const earliestByPairByStage = new Map<string, Map<string, string>>();
  for (const rrStage of rrStages) {
    const stageGames = tournamentGames.filter(
      (g) => g.stageId === rrStage.id || (!g.stageId && rrStage.id === primaryRr.id)
    );
    const byPair = new Map<string, string>();
    for (const game of stageGames) {
      const key = matchupPairKey(game.homeTeamId, game.awayTeamId);
      const sorted = matchupGamesSorted(
        stageGames,
        game.homeTeamId,
        game.awayTeamId
      );
      if (sorted[0]) byPair.set(key, sorted[0].id);
    }
    earliestByPairByStage.set(rrStage.id, byPair);
  }

  const placementStage = placementClassificationStage(structure.stages);

  const games = allGames.map((game) => {
    if (game.tournamentId !== tournamentId) return game;

    // Keep bracket-linked games, but repair orphan stageId to the slot's stage.
    if (game.bracketSlotId) {
      let stageId = game.stageId;
      if (!stageId || !findStage(structure, stageId)) {
        for (const stage of structure.stages) {
          for (const round of stage.bracket?.rounds ?? []) {
            if (round.slots.some((s) => s.id === game.bracketSlotId)) {
              stageId = stage.id;
            }
          }
        }
      }
      return stageId && stageId !== game.stageId
        ? { ...game, stageId, groupId: undefined }
        : { ...game, groupId: undefined };
    }

    const homeId = game.homeTeamId;
    const awayId = game.awayTeamId;

    // LE-147 — try each RR stage (latest order first so secondary pools win ties).
    for (let i = rrStages.length - 1; i >= 0; i -= 1) {
      const rrStage = rrStages[i];
      const groupByTeam = teamGroupMapForStage(rrStage, structure);
      const homeGroup = groupByTeam.get(homeId);
      const awayGroup = groupByTeam.get(awayId);

      if (homeGroup && awayGroup && homeGroup.id === awayGroup.id) {
        const pairKey = matchupPairKey(homeId, awayId);
        const earliestId = earliestByPairByStage.get(rrStage.id)?.get(pairKey);
        const isRematch =
          rrStage.id === primaryRr.id &&
          earliestId != null &&
          game.id !== earliestId;

        if (isRematch && placementStage) {
          report.classificationTagged += 1;
          report.details.push(
            `Same-group rematch ${game.id} → ${placementStage.name} (earliest RR is ${earliestId})`
          );
          return {
            ...game,
            stageId: placementStage.id,
            groupId: undefined,
            bracketSlotId: undefined,
          };
        }

        report.groupTagged += 1;
        return {
          ...game,
          stageId: rrStage.id,
          groupId: homeGroup.id,
          bracketSlotId: undefined,
        };
      }
    }

    const homeGroup = primaryGroupByTeam.get(homeId);
    const awayGroup = primaryGroupByTeam.get(awayId);

    if (homeGroup && awayGroup && homeGroup.id !== awayGroup.id) {
      const homePlace = placesByTeam.get(homeId);
      const awayPlace = placesByTeam.get(awayId);
      if (homePlace != null && awayPlace != null && homePlace === awayPlace) {
        const stage = classificationStageForPlace(structure.stages, homePlace);
        if (stage) {
          report.classificationTagged += 1;
          return {
            ...game,
            stageId: stage.id,
            groupId: undefined,
            bracketSlotId: undefined,
          };
        }
      }
      report.skipped += 1;
      report.details.push(
        `Skip classification ${game.id}: places ${homePlace ?? '?'}/${awayPlace ?? '?'} (${homeGroup.name} vs ${awayGroup.name})`
      );
      return {
        ...game,
        stageId: undefined,
        groupId: undefined,
        bracketSlotId: undefined,
      };
    }

    report.skipped += 1;
    report.details.push(`Skip ${game.id}: team(s) not in any RR group roster`);
    return {
      ...game,
      stageId: undefined,
      groupId: undefined,
      bracketSlotId: undefined,
    };
  });

  return { games, report };
}

export function describeGameStageTag(
  game: Game,
  structure: TournamentStructure | undefined
): string | null {
  if (!game.stageId) return null;
  const stage = findStage(structure, game.stageId);
  // LE-116: never show raw orphan stage ids in the UI
  if (!stage) return null;
  if (game.groupId) {
    const group = stage.groups?.find((g) => g.id === game.groupId);
    return group ? `${stage.name} · ${group.name}` : stage.name;
  }
  return stage.name;
}

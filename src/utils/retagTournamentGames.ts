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
import { filterGamesForGroup, calculateTeamStandings } from './tournamentStandings';
import { matchupGamesSorted, matchupPairKey } from './matchupGamePick';
import type { Team } from '../App';

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

function teamGroupMap(
  stage: TournamentStage
): Map<string, TournamentGroup> {
  const map = new Map<string, TournamentGroup>();
  for (const group of stage.groups ?? []) {
    for (const teamId of group.teamIds) {
      map.set(teamId, group);
    }
  }
  return map;
}

/** Rank within a group from group-only games (1 = best). */
export function computeGroupFinishPlaces(
  group: TournamentGroup,
  games: Game[],
  structure?: TournamentStructure
): Map<string, number> {
  const groupGames = filterGamesForGroup(games, group, structure);
  const stubTeams: Team[] = group.teamIds.map((id) => ({
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

  const rrStage = structure.stages.find((s) => s.kind === 'round_robin');
  if (!rrStage) {
    report.details.push('No round_robin stage — nothing to retag from groups.');
    return { games: allGames, report };
  }

  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);
  const groupByTeam = teamGroupMap(rrStage);
  const placesByTeam = new Map<string, number>();
  for (const group of rrStage.groups ?? []) {
    const places = computeGroupFinishPlaces(
      group,
      tournamentGames,
      structure
    );
    for (const [teamId, place] of places) {
      placesByTeam.set(teamId, place);
    }
  }

  /** Earliest game id per unordered pair (for same-group rematch detection). */
  const earliestByPair = new Map<string, string>();
  for (const game of tournamentGames) {
    const key = matchupPairKey(game.homeTeamId, game.awayTeamId);
    const sorted = matchupGamesSorted(
      tournamentGames,
      game.homeTeamId,
      game.awayTeamId
    );
    if (sorted[0]) earliestByPair.set(key, sorted[0].id);
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

    // LE-116: do NOT keep floating classification tags (e.g. after rematch
    // upgrade unlinked the earlier H2H). Re-assign from structure below.

    const homeId = game.homeTeamId;
    const awayId = game.awayTeamId;
    const homeGroup = groupByTeam.get(homeId);
    const awayGroup = groupByTeam.get(awayId);

    if (homeGroup && awayGroup && homeGroup.id === awayGroup.id) {
      const pairKey = matchupPairKey(homeId, awayId);
      const earliestId = earliestByPair.get(pairKey);
      const isRematch = earliestId != null && game.id !== earliestId;

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
    report.details.push(
      `Skip ${game.id}: team(s) not in group stage roster`
    );
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

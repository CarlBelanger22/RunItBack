/**
 * LE-114 — Finalize group seedings: freeze places, fill bracket slots, auto-link.
 */

import type { Game, Team } from '../App';
import { resolveSeedTeamId } from './autoLinkIubitBracket';
import { linkGameToBracketSlot } from './bracketGameLink';
import { autoLinkBracketByResolvedTeams } from './resolveBracketFeeders';
import { pickGameForMatchup } from './matchupGamePick';
import { computeGroupFinishPlaces, retagTournamentGames } from './retagTournamentGames';
import {
  roundRobinStages,
  syncSeedGroupsFromSnapshot,
} from './groupMembers';
import type {
  BracketSlot,
  TournamentGroup,
  TournamentStructure,
} from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';
import {
  normalizeSeedCode,
  parseSeedMatchupLabel,
} from './seedCodes';

export interface FinalizeSeedingsReport {
  seeds: number;
  slotsFilled: number;
  gamesLinked: number;
  details: string[];
}

export interface FinalizeSeedingsResult {
  structure: TournamentStructure;
  games: Game[];
  report: FinalizeSeedingsReport;
}

function groupLetter(group: TournamentGroup): string | null {
  const fromName = group.name.match(/\b([A-Z])\b/i)?.[1];
  if (fromName) return fromName.toUpperCase();
  const fromId = group.id.match(/(?:^|[-_])([a-z])(?:$|[-_])/i)?.[1];
  return fromId ? fromId.toUpperCase() : null;
}

function parseSeedMatchup(label: string | undefined): [string, string] | null {
  return parseSeedMatchupLabel(label);
}

function seedCodesForSlot(slot: BracketSlot): {
  home: string | null;
  away: string | null;
} {
  const fromLabel = parseSeedMatchup(slot.label);
  if (fromLabel) {
    return { home: fromLabel[0], away: fromLabel[1] };
  }
  return {
    home: normalizeSeedCode(slot.homeSeedLabel),
    away: normalizeSeedCode(slot.awaySeedLabel),
  };
}

/** Build A1/B2… → teamId map from an RR stage's current group standings. */
export function buildSeedSnapshot(
  structure: TournamentStructure,
  tournamentGames: Game[],
  stageId?: string
): Record<string, string> {
  const rrStages = roundRobinStages(structure);
  const rr = stageId
    ? rrStages.find((s) => s.id === stageId)
    : rrStages[0];
  if (!rr) return {};
  const snap: Record<string, string> = {};
  for (const group of rr.groups ?? []) {
    const letter = groupLetter(group);
    if (!letter) continue;
    const places = computeGroupFinishPlaces(group, tournamentGames, structure);
    for (const [teamId, place] of places) {
      if (place < 1 || place > 16) continue;
      snap[`${letter}${place}`] = teamId;
    }
  }
  return snap;
}

function resolveFromSnapshot(
  code: string | null,
  snapshot: Record<string, string>,
  groups: TournamentGroup[],
  placesByTeam: Map<string, number>
): string | null {
  if (!code) return null;
  if (snapshot[code]) return snapshot[code];
  return resolveSeedTeamId(code, groups, placesByTeam);
}

function fillSeedTeamsOnStructure(
  structure: TournamentStructure,
  snapshot: Record<string, string>,
  groups: TournamentGroup[],
  placesByTeam: Map<string, number>
): { structure: TournamentStructure; slotsFilled: number } {
  let slotsFilled = 0;
  const next: TournamentStructure = {
    ...structure,
    stages: structure.stages.map((stage) => {
      if (stage.kind !== 'classification' || !stage.bracket) return stage;
      return {
        ...stage,
        bracket: {
          rounds: stage.bracket.rounds.map((round) => ({
            ...round,
            slots: round.slots.map((slot) => {
              const codes = seedCodesForSlot(slot);
              let homeTeamId = slot.homeTeamId ?? null;
              let awayTeamId = slot.awayTeamId ?? null;
              let changed = false;

              if (!slot.homeFromSlotId && codes.home) {
                const id = resolveFromSnapshot(
                  codes.home,
                  snapshot,
                  groups,
                  placesByTeam
                );
                if (id && id !== homeTeamId) {
                  homeTeamId = id;
                  changed = true;
                }
              }
              if (!slot.awayFromSlotId && codes.away) {
                const id = resolveFromSnapshot(
                  codes.away,
                  snapshot,
                  groups,
                  placesByTeam
                );
                if (id && id !== awayTeamId) {
                  awayTeamId = id;
                  changed = true;
                }
              }

              if (changed) slotsFilled += 1;

              return {
                ...slot,
                homeTeamId,
                awayTeamId,
                homeSeedLabel: codes.home ?? slot.homeSeedLabel,
                awaySeedLabel: codes.away ?? slot.awaySeedLabel,
              };
            }),
          })),
        },
      };
    }),
  };
  return { structure: next, slotsFilled };
}

/**
 * Lock group places into seedSnapshot, fill seed-based bracket slots with
 * team ids, and auto-link existing games that match those teams.
 * LE-147 — optional stageId finalizes one RR stage (default: first RR stage).
 */
export function finalizeGroupSeedings(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  tournamentId: string,
  _teams: Team[] = [],
  stageId?: string
): FinalizeSeedingsResult {
  const structure = normalizeTournamentStructure(structureInput);
  const report: FinalizeSeedingsReport = {
    seeds: 0,
    slotsFilled: 0,
    gamesLinked: 0,
    details: [],
  };
  if (!structure) {
    return {
      structure: { stages: [] },
      games: allGames,
      report: { ...report, details: ['No structure'] },
    };
  }

  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);
  const rrStages = roundRobinStages(structure);
  const rr = stageId
    ? rrStages.find((s) => s.id === stageId)
    : rrStages[0];
  if (!rr || (rr.groups?.length ?? 0) === 0) {
    report.details.push('No round-robin groups to seed from');
    return { structure, games: allGames, report };
  }

  const stageSnapshot = buildSeedSnapshot(structure, tournamentGames, rr.id);
  const snapshot = {
    ...(structure.seedSnapshot ?? {}),
    ...stageSnapshot,
  };
  report.seeds = Object.keys(stageSnapshot).length;
  if (report.seeds === 0) {
    report.details.push('No seed places computed (need group games)');
    return { structure, games: allGames, report };
  }

  const placesByTeam = new Map<string, number>();
  for (const [code, teamId] of Object.entries(snapshot)) {
    const place = Number(code.slice(1));
    if (Number.isFinite(place)) placesByTeam.set(teamId, place);
  }
  const primaryGroups = rrStages[0]?.groups ?? [];

  let nextStructure = syncSeedGroupsFromSnapshot({
    ...structure,
    groupStageLocked: true,
    seedSnapshot: snapshot,
  }) ?? {
    ...structure,
    groupStageLocked: true,
    seedSnapshot: snapshot,
  };

  const filled = fillSeedTeamsOnStructure(
    nextStructure,
    snapshot,
    primaryGroups,
    placesByTeam
  );
  report.slotsFilled = filled.slotsFilled;
  nextStructure = filled.structure;
  let nextGames = allGames;

  const usedGameIds = new Set<string>();
  for (const stage of nextStructure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      for (const slot of round.slots) {
        if (slot.gameId) usedGameIds.add(slot.gameId);
      }
    }
  }

  for (const stage of nextStructure.stages) {
    if (stage.kind !== 'classification' || !stage.bracket) continue;
    for (const round of stage.bracket.rounds) {
      for (const slot of round.slots) {
        if (slot.gameId || !slot.homeTeamId || !slot.awayTeamId) continue;
        const match = pickGameForMatchup(
          tournamentGames,
          slot.homeTeamId,
          slot.awayTeamId,
          'latest',
          usedGameIds
        );
        if (!match) continue;
        const linked = linkGameToBracketSlot(
          nextStructure,
          nextGames,
          slot.id,
          match.id
        );
        nextStructure = linked.structure;
        nextGames = linked.games;
        usedGameIds.add(match.id);
        report.gamesLinked += 1;
        report.details.push(`Linked ${match.id} → ${slot.label ?? slot.id}`);
      }
    }
  }

  // LE-116 / LE-115 — feeder sides (Winner/Loser) resolve in memory; link those too
  const feederLinked = autoLinkBracketByResolvedTeams(
    nextStructure,
    nextGames,
    tournamentId
  );
  nextStructure = feederLinked.structure;
  nextGames = feederLinked.games;
  report.gamesLinked += feederLinked.report.linked;
  for (const line of feederLinked.report.details) {
    if (line.startsWith('Linked')) report.details.push(line);
  }

  // Re-tag RR vs rematch after links (earliest stays group)
  const { games: retagged, report: retagReport } = retagTournamentGames(
    nextGames,
    tournamentId,
    nextStructure
  );
  nextGames = retagged;
  if (retagReport.classificationTagged > 0 || retagReport.groupTagged > 0) {
    report.details.push(
      `Retag after finalize: ${retagReport.groupTagged} group + ${retagReport.classificationTagged} classification`
    );
  }

  nextStructure = {
    ...(normalizeTournamentStructure(nextStructure) ?? nextStructure),
    groupStageLocked: true,
    seedSnapshot: snapshot,
  };

  report.details.unshift(
    `Locked ${report.seeds} seeds: ${Object.keys(snapshot).sort().join(', ')}`
  );

  return { structure: nextStructure, games: nextGames, report };
}

/** Clear lock flag (optionally clear snapshot / unfilled seed team ids). */
export function unlockGroupSeedings(
  structureInput: TournamentStructure | undefined,
  options?: { clearSnapshot?: boolean; clearSeedTeamIds?: boolean }
): TournamentStructure | undefined {
  const structure = normalizeTournamentStructure(structureInput);
  if (!structure) return undefined;

  let next: TournamentStructure = {
    ...structure,
    groupStageLocked: undefined,
  };
  if (options?.clearSnapshot) {
    next = { ...next, seedSnapshot: undefined };
  }
  if (options?.clearSeedTeamIds) {
    next = {
      ...next,
      stages: next.stages.map((stage) => {
        if (!stage.bracket) return stage;
        return {
          ...stage,
          bracket: {
            rounds: stage.bracket.rounds.map((round) => ({
              ...round,
              slots: round.slots.map((slot) => {
                if (slot.gameId) return slot;
                const codes = seedCodesForSlot(slot);
                if (!codes.home && !codes.away) return slot;
                return {
                  ...slot,
                  homeTeamId: codes.home ? null : slot.homeTeamId,
                  awayTeamId: codes.away ? null : slot.awayTeamId,
                };
              }),
            })),
          },
        };
      }),
    };
  }
  return normalizeTournamentStructure(next) ?? next;
}

/**
 * LE-147 — Resolve group membership (direct team ids vs upstream seed codes).
 */

import type { Team } from '../App';
import { normalizeSeedCode } from './seedCodes';
import type {
  TournamentGroup,
  TournamentStage,
  TournamentStructure,
} from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';

export function roundRobinStages(
  structure: TournamentStructure | undefined
): TournamentStage[] {
  if (!structure) return [];
  return structure.stages
    .filter((s) => s.kind === 'round_robin')
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function findGroupStage(
  structure: TournamentStructure | undefined,
  groupId: string
): TournamentStage | undefined {
  if (!structure) return undefined;
  for (const stage of structure.stages) {
    if (stage.groups?.some((g) => g.id === groupId)) return stage;
  }
  return undefined;
}

export function groupUsesSeedLabels(group: TournamentGroup): boolean {
  return (group.seedLabels?.length ?? 0) > 0;
}

/** Normalized seed codes configured on a group (may be unresolved). */
export function groupSeedLabels(group: TournamentGroup): string[] {
  if (!group.seedLabels?.length) return [];
  return group.seedLabels
    .map((raw) => normalizeSeedCode(raw))
    .filter((code): code is string => code != null);
}

/** RR stage that seedLabels refer to (explicit or immediately previous RR stage). */
export function seedSourceStage(
  structure: TournamentStructure | undefined,
  group: TournamentGroup,
  owningStage?: TournamentStage
): TournamentStage | undefined {
  const normalized = normalizeTournamentStructure(structure);
  if (!normalized) return undefined;
  if (group.seedFromStageId) {
    return normalized.stages.find((s) => s.id === group.seedFromStageId);
  }
  const rr = roundRobinStages(normalized);
  if (rr.length === 0) return undefined;
  if (!owningStage) {
    owningStage = findGroupStage(normalized, group.id);
  }
  if (!owningStage) return rr[0];
  const idx = rr.findIndex((s) => s.id === owningStage!.id);
  if (idx <= 0) return rr[0];
  return rr[idx - 1];
}

function groupLetter(group: TournamentGroup): string | null {
  const fromName = group.name.match(/\b([A-Z])\b/i)?.[1];
  if (fromName) return fromName.toUpperCase();
  const fromId = group.id.match(/(?:^|[-_])([a-z])(?:$|[-_])/i)?.[1];
  return fromId ? fromId.toUpperCase() : null;
}

/** Seed codes available from an RR stage's groups (A1… based on group letter + team count). */
export function availableSeedCodesForStage(stage: TournamentStage): string[] {
  const codes: string[] = [];
  for (const group of stage.groups ?? []) {
    const letter = groupLetter(group);
    if (!letter) continue;
    const count = Math.max(group.teamIds.length, group.seedLabels?.length ?? 0, 1);
    for (let place = 1; place <= count; place += 1) {
      codes.push(`${letter}${place}`);
    }
  }
  return codes.sort();
}

/** Team ids for standings/games: explicit teamIds plus seeds resolved via seedSnapshot. */
export function resolveGroupTeamIds(
  group: TournamentGroup,
  structure?: TournamentStructure
): string[] {
  const normalized = normalizeTournamentStructure(structure);
  const seeds = groupSeedLabels(group);
  if (seeds.length === 0) {
    return [...group.teamIds];
  }
  const snap = normalized?.seedSnapshot ?? {};
  const fromSnapshot = seeds
    .map((code) => snap[code])
    .filter((id): id is string => Boolean(id));
  const merged = new Set([...group.teamIds, ...fromSnapshot]);
  return [...merged];
}

export const SEED_PLACEHOLDER_TEAM_PREFIX = 'seed-placeholder-';

export function isSeedPlaceholderTeamId(teamId: string): boolean {
  return teamId.startsWith(SEED_PLACEHOLDER_TEAM_PREFIX);
}

/** Standings row for an unresolved seed code (e.g. A3 before group finalize). */
export function seedPlaceholderTeam(seedCode: string): Team {
  const code = normalizeSeedCode(seedCode) ?? seedCode.toUpperCase();
  return {
    id: `${SEED_PLACEHOLDER_TEAM_PREFIX}${code}`,
    name: code,
    abbreviation: code,
    players: [],
  };
}

/**
 * Teams to show in a group standings table — real teams when resolved,
 * seed-code placeholders (A3, B3, …) when not.
 */
export function resolveGroupStandingsTeams(
  group: TournamentGroup,
  structure: TournamentStructure | undefined,
  teamById: Map<string, Team>
): Team[] {
  const seeds = groupSeedLabels(group);
  if (seeds.length === 0) {
    return resolveGroupTeamIds(group, structure)
      .map((id) => teamById.get(id))
      .filter((t): t is Team => t != null);
  }
  const snap = normalizeTournamentStructure(structure)?.seedSnapshot ?? {};
  return seeds.map((code) => {
    const resolvedId = snap[code];
    if (resolvedId) {
      const live = teamById.get(resolvedId);
      if (live) return live;
    }
    return seedPlaceholderTeam(code);
  });
}

/** Apply seedSnapshot onto seed-based groups (writes resolved teamIds). */
export function syncSeedGroupsFromSnapshot(
  structureInput: TournamentStructure | undefined
): TournamentStructure | undefined {
  const structure = normalizeTournamentStructure(structureInput);
  if (!structure?.seedSnapshot) return structure;

  let changed = false;
  const stages = structure.stages.map((stage) => {
    if (stage.kind !== 'round_robin' || !stage.groups?.length) return stage;
    const groups = stage.groups.map((group) => {
      const seeds = groupSeedLabels(group);
      if (seeds.length === 0) return group;
      const resolved = seeds
        .map((code) => structure.seedSnapshot![code])
        .filter((id): id is string => Boolean(id));
      if (resolved.length === 0) return group;
      const nextIds = [...new Set(resolved)];
      const same =
        nextIds.length === group.teamIds.length &&
        nextIds.every((id) => group.teamIds.includes(id));
      if (same) return group;
      changed = true;
      return { ...group, teamIds: nextIds };
    });
    return { ...stage, groups };
  });

  if (!changed) return structure;
  return { ...structure, stages };
}

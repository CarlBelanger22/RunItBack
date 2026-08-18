/**
 * LE-95 — Opt-in multi-stage tournament structure (groups + classification brackets).
 * Unstructured tournaments omit `structure` and keep today's single standings table.
 */

import { normalizeSeedCode } from './seedCodes';

export type TournamentStageKind = 'round_robin' | 'classification' | 'custom';

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
  /** LE-147 — When set, membership comes from these seed codes until resolved via seedSnapshot. */
  seedLabels?: string[];
  /** LE-147 — RR stage the seed codes refer to (default: previous RR stage by order). */
  seedFromStageId?: string;
  /** LE-147 — Scheduled seed-vs-seed fixtures for Matches tab before games exist. */
  seedMatchups?: GroupSeedMatchup[];
}

/** One scheduled RR leg in a seed-based group (e.g. A3 vs B4 on 28 Sep). */
export interface GroupSeedMatchup {
  homeSeed: string;
  awaySeed: string;
  date?: string;
  startTime?: string;
  gameId?: string;
}

export type BracketFromOutcome = 'winner' | 'loser';

export interface BracketSlot {
  id: string;
  /** Display label e.g. "SF1", "Final", "13/14". */
  label?: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  gameId?: string | null;
  /** Optional "winner/loser of …" wiring for display / later helpers. */
  homeFromSlotId?: string | null;
  awayFromSlotId?: string | null;
  /** When set with homeFromSlotId — which outcome advances (default: winner). */
  homeFromOutcome?: BracketFromOutcome | null;
  awayFromOutcome?: BracketFromOutcome | null;
  /** Seed placeholder e.g. "B3", "A1" when no team/game yet. */
  homeSeedLabel?: string | null;
  awaySeedLabel?: string | null;
  /**
   * Finish place for the winner/loser of this slot (medals).
   * When omitted, display may infer from label (Final → 1/2, 3rd → 3/4, …).
   * Editor can override explicit values.
   */
  winnerPlace?: number | null;
  loserPlace?: number | null;
  /**
   * LE-125 — Soft-removed first-round leg (bye into next round).
   * Slot stays in the round for layout/restore; tree hides the box.
   */
  inactive?: boolean | null;
  /** When inactive: next-round slot this leg used to feed (restore). */
  inactiveFeedSlotId?: string | null;
  inactiveFeedSide?: 'home' | 'away' | null;
  /** LE-146 — Scheduled date/time for Games tab fixture card. */
  date?: string | null;
  startTime?: string | null;
}

export interface BracketRound {
  id: string;
  name: string;
  slots: BracketSlot[];
}

export interface TournamentStage {
  id: string;
  name: string;
  kind: TournamentStageKind;
  /** Sort order ascending (group stage first). */
  order: number;
  /** Round-robin pools (unequal sizes allowed). */
  groups?: TournamentGroup[];
  /** Classification / placement bracket rounds. */
  bracket?: {
    rounds: BracketRound[];
  };
}

export interface TournamentStructure {
  stages: TournamentStage[];
  /**
   * LE-114 — When true, group finish places are frozen in seedSnapshot.
   * Bracket seed fills use the snapshot until unlocked.
   */
  groupStageLocked?: boolean;
  /** Seed code → teamId, e.g. { A1: "team-…", B3: "team-…" }. */
  seedSnapshot?: Record<string, string>;
}

const STAGE_KINDS = new Set<TournamentStageKind>([
  'round_robin',
  'classification',
  'custom',
]);

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * LE-123 — Stage/group titles: keep spaces while typing; allow "" (do not
 * drop the entity). Missing/non-string still invalid.
 */
function asDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((id): id is string => id != null);
}

function normalizeSeedMatchup(raw: unknown): GroupSeedMatchup | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const homeSeed = normalizeSeedCode(asString(row.homeSeed) ?? undefined);
  const awaySeed = normalizeSeedCode(asString(row.awaySeed) ?? undefined);
  if (!homeSeed || !awaySeed) return null;
  const matchup: GroupSeedMatchup = { homeSeed, awaySeed };
  const date = asString(row.date);
  const startTime = asString(row.startTime);
  const gameId = asString(row.gameId);
  if (date) matchup.date = date;
  if (startTime) matchup.startTime = startTime;
  if (gameId) matchup.gameId = gameId;
  return matchup;
}

function normalizeGroup(raw: unknown): TournamentGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asDisplayName(row.name);
  if (!id || name === undefined) return null;
  const group: TournamentGroup = { id, name, teamIds: asStringList(row.teamIds) };
  const seedLabels = Array.isArray(row.seedLabels)
    ? row.seedLabels
        .map((item) => normalizeSeedCode(asString(item) ?? undefined))
        .filter((code): code is string => code != null)
    : [];
  if (seedLabels.length > 0) group.seedLabels = seedLabels;
  const seedFromStageId = asString(row.seedFromStageId);
  if (seedFromStageId) group.seedFromStageId = seedFromStageId;
  const seedMatchups = Array.isArray(row.seedMatchups)
    ? row.seedMatchups
        .map(normalizeSeedMatchup)
        .filter((m): m is GroupSeedMatchup => m != null)
    : [];
  if (seedMatchups.length > 0) group.seedMatchups = seedMatchups;
  return group;
}

function asOutcome(value: unknown): BracketFromOutcome | null {
  const s = asString(value)?.toLowerCase();
  if (s === 'winner' || s === 'loser') return s;
  return null;
}

function asPlace(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return null;
}

function normalizeSlot(raw: unknown): BracketSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    label: asDisplayName(row.label),
    homeTeamId: asString(row.homeTeamId),
    awayTeamId: asString(row.awayTeamId),
    gameId: asString(row.gameId),
    homeFromSlotId: asString(row.homeFromSlotId),
    awayFromSlotId: asString(row.awayFromSlotId),
    homeFromOutcome: asOutcome(row.homeFromOutcome),
    awayFromOutcome: asOutcome(row.awayFromOutcome),
    homeSeedLabel: asString(row.homeSeedLabel),
    awaySeedLabel: asString(row.awaySeedLabel),
    winnerPlace: asPlace(row.winnerPlace),
    loserPlace: asPlace(row.loserPlace),
    inactive: row.inactive === true ? true : null,
    inactiveFeedSlotId: asString(row.inactiveFeedSlotId),
    inactiveFeedSide:
      row.inactiveFeedSide === 'home' || row.inactiveFeedSide === 'away'
        ? row.inactiveFeedSide
        : null,
    date: asString(row.date),
    startTime: asString(row.startTime),
  };
}

function normalizeRound(raw: unknown): BracketRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asDisplayName(row.name);
  if (!id || name === undefined) return null;
  const slots = Array.isArray(row.slots)
    ? row.slots.map(normalizeSlot).filter((s): s is BracketSlot => s != null)
    : [];
  return { id, name, slots };
}

function normalizeStage(raw: unknown): TournamentStage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asDisplayName(row.name);
  const kindRaw = asString(row.kind);
  if (
    !id ||
    name === undefined ||
    !kindRaw ||
    !STAGE_KINDS.has(kindRaw as TournamentStageKind)
  ) {
    return null;
  }
  const order =
    typeof row.order === 'number' && Number.isFinite(row.order) ? row.order : 0;
  const groups = Array.isArray(row.groups)
    ? row.groups.map(normalizeGroup).filter((g): g is TournamentGroup => g != null)
    : undefined;
  const bracketRaw =
    row.bracket && typeof row.bracket === 'object'
      ? (row.bracket as Record<string, unknown>)
      : null;
  const rounds = bracketRaw && Array.isArray(bracketRaw.rounds)
    ? bracketRaw.rounds
        .map(normalizeRound)
        .filter((r): r is BracketRound => r != null)
    : [];
  const stage: TournamentStage = {
    id,
    name,
    kind: kindRaw as TournamentStageKind,
    order,
  };
  if (groups && groups.length > 0) stage.groups = groups;
  if (rounds.length > 0) stage.bracket = { rounds };
  return stage;
}

/** Parse unknown JSON into a structure, or undefined if empty/invalid. */
export function normalizeTournamentStructure(
  raw: unknown
): TournamentStructure | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const stagesRaw = Array.isArray(row.stages) ? row.stages : [];
  const stages = stagesRaw
    .map(normalizeStage)
    .filter((s): s is TournamentStage => s != null)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  if (stages.length === 0) return undefined;

  const structure: TournamentStructure = { stages };
  if (row.groupStageLocked === true) {
    structure.groupStageLocked = true;
  }
  if (row.seedSnapshot && typeof row.seedSnapshot === 'object') {
    const snap: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      row.seedSnapshot as Record<string, unknown>
    )) {
      const code = asString(key)?.toUpperCase();
      const teamId = asString(value);
      if (code && teamId) snap[code] = teamId;
    }
    if (Object.keys(snap).length > 0) structure.seedSnapshot = snap;
  }
  return structure;
}

export function tournamentHasStructure(structure?: TournamentStructure | null): boolean {
  return (structure?.stages?.length ?? 0) > 0;
}

export function findStage(
  structure: TournamentStructure | undefined,
  stageId: string | undefined
): TournamentStage | undefined {
  if (!structure || !stageId) return undefined;
  return structure.stages.find((s) => s.id === stageId);
}

export function findGroup(
  structure: TournamentStructure | undefined,
  groupId: string | undefined
): TournamentGroup | undefined {
  if (!structure || !groupId) return undefined;
  for (const stage of structure.stages) {
    const hit = stage.groups?.find((g) => g.id === groupId);
    if (hit) return hit;
  }
  return undefined;
}

export function findBracketSlot(
  structure: TournamentStructure | undefined,
  slotId: string | undefined
): BracketSlot | undefined {
  if (!structure || !slotId) return undefined;
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      const hit = round.slots.find((s) => s.id === slotId);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Group id → team ids for a round-robin stage (or all RR stages if stageId omitted). */
export function groupTeamIdsByGroupId(
  structure: TournamentStructure | undefined,
  stageId?: string
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!structure) return map;
  for (const stage of structure.stages) {
    if (stage.kind !== 'round_robin') continue;
    if (stageId && stage.id !== stageId) continue;
    for (const group of stage.groups ?? []) {
      map.set(group.id, [...group.teamIds]);
    }
  }
  return map;
}

export function newStructureId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

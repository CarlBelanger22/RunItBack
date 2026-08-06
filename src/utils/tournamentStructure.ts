/**
 * LE-95 — Opt-in multi-stage tournament structure (groups + classification brackets).
 * Unstructured tournaments omit `structure` and keep today's single standings table.
 */

export type TournamentStageKind = 'round_robin' | 'classification' | 'custom';

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export interface BracketSlot {
  id: string;
  /** Display label e.g. "SF1", "Final", "13/14". */
  label?: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  gameId?: string | null;
  /** Optional "winner of …" wiring for display / later helpers. */
  homeFromSlotId?: string | null;
  awayFromSlotId?: string | null;
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
}

const STAGE_KINDS = new Set<TournamentStageKind>([
  'round_robin',
  'classification',
  'custom',
]);

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((id): id is string => id != null);
}

function normalizeGroup(raw: unknown): TournamentGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  return { id, name, teamIds: asStringList(row.teamIds) };
}

function normalizeSlot(raw: unknown): BracketSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    label: asString(row.label) ?? undefined,
    homeTeamId: asString(row.homeTeamId),
    awayTeamId: asString(row.awayTeamId),
    gameId: asString(row.gameId),
    homeFromSlotId: asString(row.homeFromSlotId),
    awayFromSlotId: asString(row.awayFromSlotId),
  };
}

function normalizeRound(raw: unknown): BracketRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  const slots = Array.isArray(row.slots)
    ? row.slots.map(normalizeSlot).filter((s): s is BracketSlot => s != null)
    : [];
  return { id, name, slots };
}

function normalizeStage(raw: unknown): TournamentStage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const name = asString(row.name);
  const kindRaw = asString(row.kind);
  if (!id || !name || !kindRaw || !STAGE_KINDS.has(kindRaw as TournamentStageKind)) {
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
  return { stages };
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

/**
 * LE-95.5 — IUBIT 2026 classification bracket slot templates.
 * Labels use draw finishers (A1 = 1st in Group A, etc.). Teams stay empty until seeding/link.
 */

import type {
  BracketRound,
  BracketSlot,
  TournamentStage,
  TournamentStructure,
} from './tournamentStructure';

const IUBIT_CLASSIFICATION_STAGE_IDS = new Set([
  'iubit-stage-1-4',
  'iubit-stage-5-8',
  'iubit-stage-9-12',
  'iubit-stage-13-14',
]);

function slot(
  id: string,
  label: string,
  opts?: Partial<Pick<BracketSlot, 'homeFromSlotId' | 'awayFromSlotId'>>
): BracketSlot {
  return {
    id,
    label,
    homeTeamId: null,
    awayTeamId: null,
    gameId: null,
    homeFromSlotId: opts?.homeFromSlotId ?? null,
    awayFromSlotId: opts?.awayFromSlotId ?? null,
  };
}

function round(id: string, name: string, slots: BracketSlot[]): BracketRound {
  return { id, name, slots };
}

/** Stable bracket tree for one IUBIT classification stage id. */
export function iubitClassificationBracketForStage(
  stageId: string
): { rounds: BracketRound[] } | null {
  switch (stageId) {
    case 'iubit-stage-1-4': {
      const sfAd = 'iubit-slot-1-4-sf-ad';
      const sfBc = 'iubit-slot-1-4-sf-bc';
      return {
        rounds: [
          round('iubit-r-1-4-sf', 'Semis', [
            slot(sfAd, 'A1 vs D1'),
            slot(sfBc, 'B1 vs C1'),
          ]),
          round('iubit-r-1-4-finals', 'Finals', [
            slot('iubit-slot-1-4-final', 'Final', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
            slot('iubit-slot-1-4-3rd', '3rd Place', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
          ]),
        ],
      };
    }
    case 'iubit-stage-5-8': {
      const sfAd = 'iubit-slot-5-8-sf-ad';
      const sfBc = 'iubit-slot-5-8-sf-bc';
      return {
        rounds: [
          round('iubit-r-5-8-sf', 'Semis', [
            slot(sfAd, 'A2 vs D2'),
            slot(sfBc, 'B2 vs C2'),
          ]),
          round('iubit-r-5-8-place', 'Placement', [
            slot('iubit-slot-5-8-5th', '5th Place', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
            slot('iubit-slot-5-8-7th', '7th Place', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
          ]),
        ],
      };
    }
    case 'iubit-stage-9-12': {
      const sfAd = 'iubit-slot-9-12-sf-ad';
      const sfBc = 'iubit-slot-9-12-sf-bc';
      return {
        rounds: [
          round('iubit-r-9-12-sf', 'Semis', [
            slot(sfAd, 'A3 vs D3'),
            slot(sfBc, 'B3 vs C3'),
          ]),
          round('iubit-r-9-12-place', 'Placement', [
            slot('iubit-slot-9-12-9th', '9th Place', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
            slot('iubit-slot-9-12-11th', '11th Place', {
              homeFromSlotId: sfAd,
              awayFromSlotId: sfBc,
            }),
          ]),
        ],
      };
    }
    case 'iubit-stage-13-14':
      return {
        rounds: [
          round('iubit-r-13-14', 'Placement', [
            slot('iubit-slot-13-14', 'C4 vs D4'),
          ]),
        ],
      };
    default:
      return null;
  }
}

export function isIubitClassificationStageId(stageId: string): boolean {
  return IUBIT_CLASSIFICATION_STAGE_IDS.has(stageId);
}

/** True if any classification stage is missing bracket slots. */
export function classificationStagesNeedBracketSlots(
  structure: TournamentStructure | undefined
): boolean {
  if (!structure) return false;
  return structure.stages.some(
    (s) =>
      s.kind === 'classification' &&
      isIubitClassificationStageId(s.id) &&
      (s.bracket?.rounds?.length ?? 0) === 0
  );
}

function mergeSlot(existing: BracketSlot | undefined, template: BracketSlot): BracketSlot {
  if (!existing) return { ...template };
  return {
    ...template,
    homeTeamId: existing.homeTeamId ?? template.homeTeamId,
    awayTeamId: existing.awayTeamId ?? template.awayTeamId,
    gameId: existing.gameId ?? template.gameId,
    label: existing.label ?? template.label,
    homeFromSlotId: existing.homeFromSlotId ?? template.homeFromSlotId,
    awayFromSlotId: existing.awayFromSlotId ?? template.awayFromSlotId,
  };
}

function mergeRounds(
  existing: BracketRound[] | undefined,
  template: BracketRound[]
): BracketRound[] {
  const byId = new Map((existing ?? []).map((r) => [r.id, r]));
  return template.map((tRound) => {
    const prev = byId.get(tRound.id);
    const prevSlots = new Map((prev?.slots ?? []).map((s) => [s.id, s]));
    return {
      id: tRound.id,
      name: prev?.name ?? tRound.name,
      slots: tRound.slots.map((tSlot) => mergeSlot(prevSlots.get(tSlot.id), tSlot)),
    };
  });
}

/**
 * Idempotent: add IUBIT classification bracket slots where missing.
 * Preserves linked gameId / team ids on existing slots.
 */
export function ensureIubitClassificationBrackets(
  structure: TournamentStructure
): TournamentStructure {
  let changed = false;
  const stages = structure.stages.map((stage) => {
    if (stage.kind !== 'classification') return stage;
    const template = iubitClassificationBracketForStage(stage.id);
    if (!template) return stage;
    const nextBracket = {
      rounds: mergeRounds(stage.bracket?.rounds, template.rounds),
    };
    const same =
      JSON.stringify(stage.bracket?.rounds ?? []) ===
      JSON.stringify(nextBracket.rounds);
    if (same) return stage;
    changed = true;
    return { ...stage, bracket: nextBracket };
  });
  return changed ? { stages } : structure;
}

export function countBracketSlots(structure: TournamentStructure): number {
  let n = 0;
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      n += round.slots.length;
    }
  }
  return n;
}

export function classificationStagesWithBrackets(
  structure: TournamentStructure
): TournamentStage[] {
  return structure.stages
    .filter((s) => s.kind === 'classification' && (s.bracket?.rounds?.length ?? 0) > 0)
    .sort((a, b) => a.order - b.order);
}

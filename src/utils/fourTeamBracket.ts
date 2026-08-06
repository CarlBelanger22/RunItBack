/**
 * LE-103 — Generic Format A classification bracket: Semis → Final + 3rd.
 * Used for any classification stage that is not an IUBIT template id.
 */

import {
  ensureIubitClassificationBrackets,
  isIubitClassificationStageId,
} from './iubit2026Bracket';
import type {
  BracketRound,
  BracketSlot,
  TournamentStructure,
} from './tournamentStructure';

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

/**
 * Cross-group semis for a 2-group tournament (A1 vs B2, B1 vs A2).
 * Slot ids are scoped to `stageId` so multiple classification stages stay unique.
 */
export function buildFourTeamBracket(stageId: string): {
  rounds: BracketRound[];
} {
  const sfAb = `${stageId}-sf-a1b2`;
  const sfBa = `${stageId}-sf-b1a2`;
  return {
    rounds: [
      round(`${stageId}-r-sf`, 'Semis', [
        slot(sfAb, 'A1 vs B2'),
        slot(sfBa, 'B1 vs A2'),
      ]),
      round(`${stageId}-r-finals`, 'Finals', [
        slot(`${stageId}-final`, 'Final', {
          homeFromSlotId: sfAb,
          awayFromSlotId: sfBa,
        }),
        slot(`${stageId}-3rd`, '3rd Place', {
          homeFromSlotId: sfAb,
          awayFromSlotId: sfBa,
        }),
      ]),
    ],
  };
}

/** True if any classification stage has no bracket rounds yet. */
export function classificationStagesNeedBracketSlots(
  structure: TournamentStructure | undefined
): boolean {
  if (!structure) return false;
  return structure.stages.some(
    (s) =>
      s.kind === 'classification' && (s.bracket?.rounds?.length ?? 0) === 0
  );
}

/**
 * Idempotent: IUBIT templates first, then Format A for any other empty
 * classification stage. Preserves linked game/team ids on existing slots.
 */
export function ensureClassificationBrackets(
  structure: TournamentStructure
): TournamentStructure {
  const withIubit = ensureIubitClassificationBrackets(structure);
  let changed = false;
  const stages = withIubit.stages.map((stage) => {
    if (stage.kind !== 'classification') return stage;
    if ((stage.bracket?.rounds?.length ?? 0) > 0) return stage;
    if (isIubitClassificationStageId(stage.id)) return stage;
    changed = true;
    return { ...stage, bracket: buildFourTeamBracket(stage.id) };
  });
  return changed ? { stages } : withIubit;
}

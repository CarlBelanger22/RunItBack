/**
 * LE-103 / LE-118 / LE-122 / LE-127 — Classification bracket templates:
 * 4-Team, 8-Team, 12-Team, and Last 16 (16-Team menu).
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
  opts?: Partial<
    Pick<
      BracketSlot,
      | 'homeFromSlotId'
      | 'awayFromSlotId'
      | 'homeFromOutcome'
      | 'awayFromOutcome'
      | 'winnerPlace'
      | 'loserPlace'
      | 'homeSeedLabel'
      | 'awaySeedLabel'
    >
  >
): BracketSlot {
  return {
    id,
    label,
    homeTeamId: null,
    awayTeamId: null,
    gameId: null,
    homeFromSlotId: opts?.homeFromSlotId ?? null,
    awayFromSlotId: opts?.awayFromSlotId ?? null,
    homeFromOutcome: opts?.homeFromOutcome ?? null,
    awayFromOutcome: opts?.awayFromOutcome ?? null,
    homeSeedLabel: opts?.homeSeedLabel ?? null,
    awaySeedLabel: opts?.awaySeedLabel ?? null,
    winnerPlace: opts?.winnerPlace ?? null,
    loserPlace: opts?.loserPlace ?? null,
  };
}

function round(id: string, name: string, slots: BracketSlot[]): BracketRound {
  return { id, name, slots };
}

function seedMatch(
  id: string,
  label: string,
  homeSeed: string,
  awaySeed: string
): BracketSlot {
  return slot(id, label, {
    homeSeedLabel: homeSeed,
    awaySeedLabel: awaySeed,
  });
}

/**
 * 4-Team bracket: 2 Semis → Final + 3rd (places 1–4).
 * Cross-group seeds A1 vs B2, B1 vs A2.
 */
export function buildFourTeamBracket(stageId: string): {
  rounds: BracketRound[];
} {
  const sfAb = `${stageId}-sf-a1b2`;
  const sfBa = `${stageId}-sf-b1a2`;
  return {
    rounds: [
      round(`${stageId}-r-sf`, 'Semis', [
        seedMatch(sfAb, 'SF1', 'A1', 'B2'),
        seedMatch(sfBa, 'SF2', 'B1', 'A2'),
      ]),
      round(`${stageId}-r-finals`, 'Finals', [
        slot(`${stageId}-final`, 'Final', {
          homeFromSlotId: sfAb,
          awayFromSlotId: sfBa,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
          winnerPlace: 1,
          loserPlace: 2,
        }),
        slot(`${stageId}-3rd`, '3rd Place', {
          homeFromSlotId: sfAb,
          awayFromSlotId: sfBa,
          homeFromOutcome: 'loser',
          awayFromOutcome: 'loser',
          winnerPlace: 3,
          loserPlace: 4,
        }),
      ]),
    ],
  };
}

/**
 * 8-Team bracket: 4 Quarters → 2 Semis → Final + 3rd (places 1–4).
 * Default QF seeds: A1 vs C2, D1 vs B2, C1 vs A2, B1 vs D2.
 */
export function buildEightTeamBracket(stageId: string): {
  rounds: BracketRound[];
} {
  const qf1 = `${stageId}-qf1`;
  const qf2 = `${stageId}-qf2`;
  const qf3 = `${stageId}-qf3`;
  const qf4 = `${stageId}-qf4`;
  const sf12 = `${stageId}-sf-qf12`;
  const sf34 = `${stageId}-sf-qf34`;

  return {
    rounds: [
      round(`${stageId}-r-qf`, 'Quarters', [
        seedMatch(qf1, 'QF1', 'A1', 'C2'),
        seedMatch(qf2, 'QF2', 'D1', 'B2'),
        seedMatch(qf3, 'QF3', 'C1', 'A2'),
        seedMatch(qf4, 'QF4', 'B1', 'D2'),
      ]),
      round(`${stageId}-r-sf`, 'Semis', [
        slot(sf12, 'SF1', {
          homeFromSlotId: qf1,
          awayFromSlotId: qf2,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(sf34, 'SF2', {
          homeFromSlotId: qf3,
          awayFromSlotId: qf4,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
      ]),
      round(`${stageId}-r-finals`, 'Finals', [
        slot(`${stageId}-final`, 'Final', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
          winnerPlace: 1,
          loserPlace: 2,
        }),
        slot(`${stageId}-3rd`, '3rd Place', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'loser',
          awayFromOutcome: 'loser',
          winnerPlace: 3,
          loserPlace: 4,
        }),
      ]),
    ],
  };
}

/**
 * Last 16: 8 R16 → 4 QF → 2 SF → Final + 3rd (places 1–4).
 * Default seeds: 4 groups × places 1–4 — top half A/C, bottom half B/D
 * (A1–C4, C2–A3, C1–A4, A2–C3 / B1–D4, D2–B3, D1–B4, B2–D3).
 * Round display name is "Last 16"; Templates menu label is "16-Team".
 */
export function buildLast16Bracket(stageId: string): {
  rounds: BracketRound[];
} {
  const r16 = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${stageId}-r16-${n}`);
  const qf = [1, 2, 3, 4].map((n) => `${stageId}-qf${n}`);
  const sf12 = `${stageId}-sf-qf12`;
  const sf34 = `${stageId}-sf-qf34`;

  const r16Seeds: Array<[string, string]> = [
    // Top half — Groups A & C
    ['A1', 'C4'],
    ['C2', 'A3'],
    ['C1', 'A4'],
    ['A2', 'C3'],
    // Bottom half — Groups B & D
    ['B1', 'D4'],
    ['D2', 'B3'],
    ['D1', 'B4'],
    ['B2', 'D3'],
  ];

  return {
    rounds: [
      round(
        `${stageId}-r-r16`,
        'Last 16',
        r16Seeds.map(([home, away], i) =>
          seedMatch(r16[i], `R16-${i + 1}`, home, away)
        )
      ),
      round(`${stageId}-r-qf`, 'Quarters', [
        slot(qf[0], 'QF1', {
          homeFromSlotId: r16[0],
          awayFromSlotId: r16[1],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(qf[1], 'QF2', {
          homeFromSlotId: r16[2],
          awayFromSlotId: r16[3],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(qf[2], 'QF3', {
          homeFromSlotId: r16[4],
          awayFromSlotId: r16[5],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(qf[3], 'QF4', {
          homeFromSlotId: r16[6],
          awayFromSlotId: r16[7],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
      ]),
      round(`${stageId}-r-sf`, 'Semis', [
        slot(sf12, 'SF1', {
          homeFromSlotId: qf[0],
          awayFromSlotId: qf[1],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(sf34, 'SF2', {
          homeFromSlotId: qf[2],
          awayFromSlotId: qf[3],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
      ]),
      round(`${stageId}-r-finals`, 'Finals', [
        slot(`${stageId}-final`, 'Final', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
          winnerPlace: 1,
          loserPlace: 2,
        }),
        slot(`${stageId}-3rd`, '3rd Place', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'loser',
          awayFromOutcome: 'loser',
          winnerPlace: 3,
          loserPlace: 4,
        }),
      ]),
    ],
  };
}

/**
 * 12-Team: 4 L16 (2nd vs 3rd) → 4 QF (group winners bye in) → 2 SF → Final + 3rd.
 * L16 halves BC/AD (cross): C2–B3, B2–C3 / D2–A3, A2–D3.
 * QF halves AD/BC (winners): A1 vs W(R16-1), W(R16-2) vs D1 / B1 vs W(R16-3), W(R16-4) vs C1.
 */
export function buildTwelveTeamBracket(stageId: string): {
  rounds: BracketRound[];
} {
  const r16 = [1, 2, 3, 4].map((n) => `${stageId}-r16-${n}`);
  const qf = [1, 2, 3, 4].map((n) => `${stageId}-qf${n}`);
  const sf12 = `${stageId}-sf-qf12`;
  const sf34 = `${stageId}-sf-qf34`;

  const r16Seeds: Array<[string, string]> = [
    // Top — Groups B & C
    ['C2', 'B3'],
    ['B2', 'C3'],
    // Bottom — Groups A & D
    ['D2', 'A3'],
    ['A2', 'D3'],
  ];

  return {
    rounds: [
      round(
        `${stageId}-r-r16`,
        'Last 16',
        r16Seeds.map(([home, away], i) =>
          seedMatch(r16[i], `R16-${i + 1}`, home, away)
        )
      ),
      round(`${stageId}-r-qf`, 'Quarters', [
        slot(qf[0], 'QF1', {
          homeSeedLabel: 'A1',
          awayFromSlotId: r16[0],
          awayFromOutcome: 'winner',
        }),
        slot(qf[1], 'QF2', {
          homeFromSlotId: r16[1],
          homeFromOutcome: 'winner',
          awaySeedLabel: 'D1',
        }),
        slot(qf[2], 'QF3', {
          homeSeedLabel: 'B1',
          awayFromSlotId: r16[2],
          awayFromOutcome: 'winner',
        }),
        slot(qf[3], 'QF4', {
          homeFromSlotId: r16[3],
          homeFromOutcome: 'winner',
          awaySeedLabel: 'C1',
        }),
      ]),
      round(`${stageId}-r-sf`, 'Semis', [
        slot(sf12, 'SF1', {
          homeFromSlotId: qf[0],
          awayFromSlotId: qf[1],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
        slot(sf34, 'SF2', {
          homeFromSlotId: qf[2],
          awayFromSlotId: qf[3],
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
        }),
      ]),
      round(`${stageId}-r-finals`, 'Finals', [
        slot(`${stageId}-final`, 'Final', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'winner',
          awayFromOutcome: 'winner',
          winnerPlace: 1,
          loserPlace: 2,
        }),
        slot(`${stageId}-3rd`, '3rd Place', {
          homeFromSlotId: sf12,
          awayFromSlotId: sf34,
          homeFromOutcome: 'loser',
          awayFromOutcome: 'loser',
          winnerPlace: 3,
          loserPlace: 4,
        }),
      ]),
    ],
  };
}

/** Minimal editable tree — one round, one slot. */
export function buildEmptyClassificationBracket(stageId: string): {
  rounds: BracketRound[];
} {
  return {
    rounds: [
      round(`${stageId}-r1`, 'Round 1', [
        slot(`${stageId}-m1`, 'Match 1'),
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
 * Idempotent: IUBIT templates first, then 4-Team for any other empty
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

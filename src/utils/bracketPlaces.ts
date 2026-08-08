/**
 * LE-111 — Finish-place medals for classification bracket slots.
 * Explicit slot places win; otherwise infer from common labels (Final, 3rd, …).
 * LE-117 — Do not show a place when that outcome still feeds another match.
 */

import type { BracketRound, BracketSlot } from './tournamentStructure';

export function formatFinishPlace(place: number): string {
  const n = Math.floor(place);
  if (n <= 0) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Infer winner/loser places from a display label when places are not stored.
 * Handles "13th Place", "5th", "3rd Place", "Final", "13/14", "13th–14th", etc.
 */
export function inferPlacesFromLabel(
  label: string | undefined
): { winner: number; loser: number } | null {
  const t = (label ?? '').toLowerCase().trim();
  if (!t) return null;

  // "13th–14th" / "13th-14th Placement"
  const band = t.match(
    /\b(\d+)(?:st|nd|rd|th)\s*[-–—/]\s*(\d+)(?:st|nd|rd|th)\b/
  );
  if (band) {
    const a = Number(band[1]);
    const b = Number(band[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b === a + 1) {
      return { winner: a, loser: b };
    }
  }

  // "13/14", "5-6"
  const slash = t.match(/\b(\d+)\s*[\/\-–—]\s*(\d+)\b/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b === a + 1 && a >= 1) {
      return { winner: a, loser: b };
    }
  }

  // "13th Place", "11th Place", "5th", "3rd Place"
  const ordinal = t.match(/\b(\d+)(?:st|nd|rd|th)(?:\s+place)?\b/);
  if (ordinal) {
    const n = Number(ordinal[1]);
    if (Number.isFinite(n) && n >= 1) {
      return { winner: n, loser: n + 1 };
    }
  }

  if (/third/.test(t)) return { winner: 3, loser: 4 };

  if (
    /^final$/.test(t) ||
    t.startsWith('final ') ||
    t.endsWith(' final') ||
    /championship|grand final/.test(t)
  ) {
    return { winner: 1, loser: 2 };
  }

  return null;
}

export function resolveSlotPlaces(
  slot: BracketSlot,
  hintLabels: Array<string | undefined | null> = []
): {
  winner: number | null;
  loser: number | null;
} {
  let inferred = inferPlacesFromLabel(slot.label);
  if (!inferred) {
    for (const hint of hintLabels) {
      inferred = inferPlacesFromLabel(hint ?? undefined);
      if (inferred) break;
    }
  }
  return {
    winner:
      slot.winnerPlace != null && slot.winnerPlace >= 1
        ? slot.winnerPlace
        : (inferred?.winner ?? null),
    loser:
      slot.loserPlace != null && slot.loserPlace >= 1
        ? slot.loserPlace
        : (inferred?.loser ?? null),
  };
}

/**
 * True when some later slot takes this slot's winner or loser as a feeder.
 */
export function outcomeFeedsFurther(
  rounds: BracketRound[],
  fromSlotId: string,
  outcome: 'winner' | 'loser'
): boolean {
  for (const round of rounds) {
    for (const slot of round.slots) {
      const homeOutcome = slot.homeFromOutcome ?? 'winner';
      const awayOutcome = slot.awayFromOutcome ?? 'winner';
      if (
        slot.homeFromSlotId === fromSlotId &&
        homeOutcome === outcome
      ) {
        return true;
      }
      if (
        slot.awayFromSlotId === fromSlotId &&
        awayOutcome === outcome
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Place medal for a match row after the game is decided. */
export function placeForMatchSide(
  slot: BracketSlot,
  isWinner: boolean,
  isLoser: boolean,
  hintLabels: Array<string | undefined | null> = [],
  rounds?: BracketRound[]
): number | null {
  if (!isWinner && !isLoser) return null;

  // LE-117: if this outcome still plays another match, place is not final yet
  if (rounds && rounds.length > 0) {
    if (isWinner && outcomeFeedsFurther(rounds, slot.id, 'winner')) {
      return null;
    }
    if (isLoser && outcomeFeedsFurther(rounds, slot.id, 'loser')) {
      return null;
    }
  }

  const places = resolveSlotPlaces(slot, hintLabels);
  if (isWinner) return places.winner;
  if (isLoser) return places.loser;
  return null;
}

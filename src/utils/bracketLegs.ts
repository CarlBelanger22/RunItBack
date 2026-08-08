/**
 * LE-125 — Soft-remove first-round bracket legs (byes into the next round).
 */

import type { BracketRound, BracketSlot } from './tournamentStructure';

export function isSlotInactive(slot: BracketSlot | undefined | null): boolean {
  return slot?.inactive === true;
}

/** First round only (R16 on Last 16, Quarters on 8-Team, Semis on 4-Team). */
export function isFirstRoundSlot(
  rounds: BracketRound[],
  slotId: string
): boolean {
  return rounds[0]?.slots.some((s) => s.id === slotId) ?? false;
}

function mapSlots(
  rounds: BracketRound[],
  mapSlot: (slot: BracketSlot, roundIndex: number) => BracketSlot
): BracketRound[] {
  return rounds.map((round, roundIndex) => ({
    ...round,
    slots: round.slots.map((slot) => mapSlot(slot, roundIndex)),
  }));
}

function findFeederConsumer(
  rounds: BracketRound[],
  fromSlotId: string
): { slotId: string; side: 'home' | 'away' } | null {
  for (const round of rounds) {
    for (const slot of round.slots) {
      if (slot.homeFromSlotId === fromSlotId) {
        return { slotId: slot.id, side: 'home' };
      }
      if (slot.awayFromSlotId === fromSlotId) {
        return { slotId: slot.id, side: 'away' };
      }
    }
  }
  return null;
}

export function canRemoveBracketLeg(
  rounds: BracketRound[],
  slotId: string
): boolean {
  if (!isFirstRoundSlot(rounds, slotId)) return false;
  const slot = rounds[0]?.slots.find((s) => s.id === slotId);
  if (!slot || isSlotInactive(slot)) return false;
  return findFeederConsumer(rounds, slotId) != null;
}

export function canRestoreBracketLeg(
  rounds: BracketRound[],
  slotId: string
): boolean {
  if (!isFirstRoundSlot(rounds, slotId)) return false;
  const slot = rounds[0]?.slots.find((s) => s.id === slotId);
  return isSlotInactive(slot);
}

/**
 * Hide a first-round match; clear the downstream feeder to an empty seed side.
 * Remembers feed target for restore.
 */
export function removeBracketLeg(
  rounds: BracketRound[],
  slotId: string
): BracketRound[] {
  if (!canRemoveBracketLeg(rounds, slotId)) return rounds;
  const consumer = findFeederConsumer(rounds, slotId);
  if (!consumer) return rounds;

  return mapSlots(rounds, (slot) => {
    if (slot.id === slotId) {
      return {
        ...slot,
        inactive: true,
        inactiveFeedSlotId: consumer.slotId,
        inactiveFeedSide: consumer.side,
      };
    }
    if (slot.id !== consumer.slotId) return slot;
    if (consumer.side === 'home') {
      return {
        ...slot,
        homeFromSlotId: null,
        homeFromOutcome: null,
        homeSeedLabel: null,
        homeTeamId: null,
      };
    }
    return {
      ...slot,
      awayFromSlotId: null,
      awayFromOutcome: null,
      awaySeedLabel: null,
      awayTeamId: null,
    };
  });
}

/** Show the leg again and rewire winner → remembered next-round side. */
export function restoreBracketLeg(
  rounds: BracketRound[],
  slotId: string
): BracketRound[] {
  if (!canRestoreBracketLeg(rounds, slotId)) return rounds;
  const source = rounds[0]?.slots.find((s) => s.id === slotId);
  if (!source) return rounds;
  const feedSlotId = source.inactiveFeedSlotId;
  const feedSide = source.inactiveFeedSide;
  if (!feedSlotId || (feedSide !== 'home' && feedSide !== 'away')) {
    return mapSlots(rounds, (slot) =>
      slot.id === slotId
        ? {
            ...slot,
            inactive: null,
            inactiveFeedSlotId: null,
            inactiveFeedSide: null,
          }
        : slot
    );
  }

  return mapSlots(rounds, (slot) => {
    if (slot.id === slotId) {
      return {
        ...slot,
        inactive: null,
        inactiveFeedSlotId: null,
        inactiveFeedSide: null,
      };
    }
    if (slot.id !== feedSlotId) return slot;
    if (feedSide === 'home') {
      return {
        ...slot,
        homeFromSlotId: slotId,
        homeFromOutcome: 'winner',
        homeSeedLabel: null,
        homeTeamId: null,
      };
    }
    return {
      ...slot,
      awayFromSlotId: slotId,
      awayFromOutcome: 'winner',
      awaySeedLabel: null,
      awayTeamId: null,
    };
  });
}

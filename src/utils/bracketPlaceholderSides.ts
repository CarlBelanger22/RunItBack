/**
 * Display labels for bracket slot sides before teams/games are linked.
 */

import type { BracketRound, BracketSlot } from './tournamentStructure';

export function parseSeedSides(label: string | undefined): [string, string] | null {
  if (!label) return null;
  const m = label.match(/^(.+?)\s+vs\s+(.+)$/i);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

export function findSlotLabel(rounds: BracketRound[], slotId: string): string | null {
  for (const round of rounds) {
    const hit = round.slots.find((s) => s.id === slotId);
    if (hit) return hit.label ?? hit.id;
  }
  return null;
}

export function isLoserPlacementLabel(label: string | undefined): boolean {
  const t = (label ?? '').toLowerCase();
  return t.includes('3rd') || t.includes('7th') || t.includes('11th');
}

function feederLabel(
  rounds: BracketRound[],
  fromSlotId: string | null | undefined,
  outcome: 'winner' | 'loser' | null | undefined
): string | null {
  if (!fromSlotId) return null;
  const label = findSlotLabel(rounds, fromSlotId);
  if (!label) return null;
  const prefix = outcome === 'loser' ? 'Loser' : 'Winner';
  return `${prefix} · ${label}`;
}

/** Home/away display strings for a bracket slot (seeds, feeders, or TBD). */
export function bracketPlaceholderSides(
  slot: BracketSlot,
  rounds: BracketRound[]
): [string, string] {
  const homeSeed = slot.homeSeedLabel?.trim();
  const awaySeed = slot.awaySeedLabel?.trim();
  const homeFeeder = feederLabel(rounds, slot.homeFromSlotId, slot.homeFromOutcome);
  const awayFeeder = feederLabel(rounds, slot.awayFromSlotId, slot.awayFromOutcome);

  if (homeSeed || awaySeed || homeFeeder || awayFeeder) {
    return [
      homeSeed || homeFeeder || 'TBD',
      awaySeed || awayFeeder || 'TBD',
    ];
  }

  const seeds = parseSeedSides(slot.label);
  if (seeds) return seeds;
  const losers = isLoserPlacementLabel(slot.label);
  const prefix = losers ? 'Loser' : 'Winner';
  const a = slot.homeFromSlotId
    ? findSlotLabel(rounds, slot.homeFromSlotId)
    : null;
  const b = slot.awayFromSlotId
    ? findSlotLabel(rounds, slot.awayFromSlotId)
    : null;
  return [
    a ? `${prefix} · ${a}` : 'TBD',
    b ? `${prefix} · ${b}` : 'TBD',
  ];
}

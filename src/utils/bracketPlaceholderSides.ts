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

/** SF1 → "Semi-final 1". Other slot labels stay as stored. */
export function clarifyBracketSlotLabel(label: string): string {
  const semi = label.trim().match(/^SF\s*(\d+)$/i);
  if (semi) return `Semi-final ${semi[1]}`;
  return label;
}

/**
 * Games-list tag for a bracket fixture. The stage is often named "Finals"
 * for the whole knockout, so the badge must name the round itself:
 * Semi-final 1, Final, 3rd place.
 */
export function bracketFixtureStageTag(
  stageName: string,
  slotLabel?: string
): string {
  if (!slotLabel?.trim()) return stageName;
  const label = slotLabel.trim();
  const clarified = clarifyBracketSlotLabel(label);
  if (clarified !== label) return clarified;
  if (/^final$/i.test(label)) return 'Final';
  if (/place$/i.test(label)) return label;
  return `${stageName} · ${label}`;
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
  return `${prefix} · ${clarifyBracketSlotLabel(label)}`;
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
    a ? `${prefix} · ${clarifyBracketSlotLabel(a)}` : 'TBD',
    b ? `${prefix} · ${clarifyBracketSlotLabel(b)}` : 'TBD',
  ];
}

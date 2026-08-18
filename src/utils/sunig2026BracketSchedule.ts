/**
 * SUniG 2026 men's knockout schedule (PDF V5) — keyed by bracket slot label.
 */

export type BracketSlotScheduleEntry = {
  date: string;
  startTime: string;
};

/** Games 23–24 (Oct 1) and 30–31 (Oct 8) from the fixtures spreadsheet. */
export const SUNIG_2026_BRACKET_SCHEDULE: Record<string, BracketSlotScheduleEntry> =
  {
    SF1: { date: '2026-10-01', startTime: '19:15' },
    SF2: { date: '2026-10-01', startTime: '20:40' },
    '3rd Place': { date: '2026-10-08', startTime: '19:15' },
    Final: { date: '2026-10-08', startTime: '20:40' },
  };

export function resolveBracketSlotDateTime(
  slot: { label?: string; date?: string | null; startTime?: string | null },
  schedule: Record<string, BracketSlotScheduleEntry> = SUNIG_2026_BRACKET_SCHEDULE
): { date?: string; startTime?: string } {
  const fromLabel = slot.label ? schedule[slot.label] : undefined;
  return {
    date: slot.date ?? fromLabel?.date,
    startTime: slot.startTime ?? fromLabel?.startTime,
  };
}

export function applyBracketSlotSchedule<
  T extends { label?: string; date?: string | null; startTime?: string | null },
>(
  slot: T,
  schedule: Record<string, BracketSlotScheduleEntry> = SUNIG_2026_BRACKET_SCHEDULE
): T {
  const fromLabel = slot.label ? schedule[slot.label] : undefined;
  if (!fromLabel) return slot;
  if (slot.date === fromLabel.date && slot.startTime === fromLabel.startTime) {
    return slot;
  }
  return {
    ...slot,
    date: fromLabel.date,
    startTime: fromLabel.startTime,
  };
}

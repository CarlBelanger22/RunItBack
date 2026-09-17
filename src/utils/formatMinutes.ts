/** Decimal minutes (e.g. 5.5) → display string "5:30". Unknown/blank (≤0) → "-". */
export function formatDecimalMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  if (secs === 60) {
    return `${mins + 1}:00`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

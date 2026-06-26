/**
 * FIBA 3×3 scoring: 1pt inside FG, 2pt from 3, 1pt FT.
 * Box scores store fg_made including 3-pointers as a subset.
 */
export function compute3x3Points(
  fgMade: number,
  threeMade: number,
  ftMade: number
): number {
  return fgMade + threeMade + ftMade;
}

/** MM.SS or M:SS → decimal minutes (e.g. 7.24 → 7:24 → 7.40). */
export function parseMmSsMinutes(raw: string | number): number {
  const s = String(raw).trim();
  if (!s || s === '-') return 0;

  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    return roundMinutes(parseInt(m, 10) + parseInt(sec || '0', 10) / 60);
  }

  if (s.includes('.')) {
    const [m, sec] = s.split('.');
    return roundMinutes(parseInt(m, 10) + parseInt(sec || '0', 10) / 60);
  }

  return roundMinutes(parseFloat(s));
}

function roundMinutes(n: number): number {
  return Math.round(n * 100) / 100;
}

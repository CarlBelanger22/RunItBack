/** Live-entry UI team accents — not used for court floor / lines (see figmaHorizontalCourtSvg). */
export type LiveTeamSide = 'home' | 'away';

export const LIVE_TEAM_HEX = {
  home: '#3b82f6',
  away: '#f97316',
} as const;

export function getLiveTeamColor(side: LiveTeamSide): string {
  return LIVE_TEAM_HEX[side];
}

/** `#RRGGBB` + 2-digit hex alpha suffix for inline tints. */
export function liveTeamTint(side: LiveTeamSide, alphaHex: string): string {
  return `${LIVE_TEAM_HEX[side]}${alphaHex}`;
}

export const LIVE_SEMANTIC = {
  muted: 'var(--muted-foreground)',
  foreground: 'var(--foreground)',
  destructive: 'var(--destructive)',
  success: 'var(--live-success)',
  inactive: 'var(--muted)',
} as const;

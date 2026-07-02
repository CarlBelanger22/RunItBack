/** Live-entry UI team accents — not used for court floor wood (see fibaCourtSvg LIVE_COURT_COLORS). */
export type LiveTeamSide = 'home' | 'away';

/** Courtside Dark Mode — Option 1 palette (LE-19). */
export const LIVE_PALETTE = {
  canvas: '#12141C',
  surface: '#1E2230',
  borderStrong: '#3A3F55',
  home: '#00D2FF',
  away: '#FF9F00',
  success: '#00E676',
  danger: '#FF3838',
  text: '#F8F9FA',
} as const;

export const LIVE_TEAM_HEX = {
  home: LIVE_PALETTE.home,
  away: LIVE_PALETTE.away,
} as const;

export function getLiveTeamColor(side: LiveTeamSide): string {
  return LIVE_TEAM_HEX[side];
}

/** `#RRGGBB` + 2-digit hex alpha suffix for inline tints. */
export function liveTeamTint(side: LiveTeamSide, alphaHex: string): string {
  return `${LIVE_TEAM_HEX[side]}${alphaHex}`;
}

export const LIVE_SEMANTIC = {
  muted: 'var(--live-text-muted)',
  foreground: 'var(--live-text)',
  destructive: 'var(--live-danger)',
  success: 'var(--live-success)',
  inactive: 'var(--live-border-strong)',
} as const;

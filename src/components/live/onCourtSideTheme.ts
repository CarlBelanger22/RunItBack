export type OnCourtSide = 'home' | 'away';

export const ON_COURT_SIDE_THEME = {
  home: {
    header: 'var(--live-home-header)',
    cardBorder: 'var(--live-home-border)',
    cardBorderHover: 'var(--live-home-border-hover)',
    cardBorderSelected: 'var(--live-home)',
    number: 'var(--live-home)',
    possessionAccent: 'var(--live-home)',
  },
  away: {
    header: 'var(--live-away-header)',
    cardBorder: 'var(--live-away-border)',
    cardBorderHover: 'var(--live-away-border-hover)',
    cardBorderSelected: 'var(--live-away)',
    number: 'var(--live-away)',
    possessionAccent: 'var(--live-away)',
  },
} as const satisfies Record<
  OnCourtSide,
  {
    header: string;
    cardBorder: string;
    cardBorderHover: string;
    cardBorderSelected: string;
    number: string;
    possessionAccent: string;
  }
>;

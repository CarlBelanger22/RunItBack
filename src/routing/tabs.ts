export type TournamentTab = 'home' | 'teams' | 'standings' | 'players' | 'games' | 'awards';
export type TeamTab = 'overview' | 'roster' | 'stats' | 'players' | 'games';
export type PlayerTab = 'overview' | 'stats' | 'advanced' | 'gamelog';

const TOURNAMENT_TABS: TournamentTab[] = [
  'home',
  'standings',
  'teams',
  'players',
  'games',
  'awards',
];
const TEAM_TABS: TeamTab[] = ['overview', 'roster', 'stats', 'players', 'games'];
/** Display order: Overview → Player Stats → Advanced Stats → Game Log */
const PLAYER_TABS: PlayerTab[] = ['overview', 'stats', 'advanced', 'gamelog'];

export function parseTournamentTab(value: string | null): TournamentTab {
  // LE-96 — Structure tab removed; old ?tab=structure deep links → Standings.
  if (value === 'structure') return 'standings';
  if (value && TOURNAMENT_TABS.includes(value as TournamentTab)) {
    return value as TournamentTab;
  }
  return 'home';
}

/** Awards tab is admin-only; non-admins landing on ?tab=awards go Home. */
export function resolveTournamentTabForViewer(
  tab: TournamentTab,
  canEditLeague: boolean
): TournamentTab {
  if (tab === 'awards' && !canEditLeague) return 'home';
  return tab;
}

export function parseTeamTab(value: string | null): TeamTab {
  if (value && TEAM_TABS.includes(value as TeamTab)) {
    return value as TeamTab;
  }
  return 'overview';
}

export function parsePlayerTab(value: string | null): PlayerTab {
  if (value && PLAYER_TABS.includes(value as PlayerTab)) {
    return value as PlayerTab;
  }
  return 'overview';
}

export function withTabQuery(path: string, tab: string, defaultTab: string): string {
  if (tab === defaultTab) return path;
  return `${path}?tab=${encodeURIComponent(tab)}`;
}

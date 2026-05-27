export type TournamentTab = 'home' | 'teams' | 'standings' | 'players' | 'games';
export type TeamTab = 'overview' | 'roster' | 'stats' | 'games';
export type PlayerTab = 'overview' | 'gamelog' | 'stats' | 'advanced';

const TOURNAMENT_TABS: TournamentTab[] = ['home', 'teams', 'standings', 'players', 'games'];
const TEAM_TABS: TeamTab[] = ['overview', 'roster', 'stats', 'games'];
const PLAYER_TABS: PlayerTab[] = ['overview', 'gamelog', 'stats', 'advanced'];

export function parseTournamentTab(value: string | null): TournamentTab {
  if (value && TOURNAMENT_TABS.includes(value as TournamentTab)) {
    return value as TournamentTab;
  }
  return 'home';
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

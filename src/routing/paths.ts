import { buildSlugId } from './slugs';
import type { TournamentTab, TeamTab, PlayerTab } from './tabs';
import { withTabQuery } from './tabs';

export const paths = {
  home: '/',
  tournaments: '/tournaments',
  teams: '/teams',
  games: '/games',
  statsEntry: '/stats-entry',
} as const;

export function tournamentPath(
  tournament: { id: string; name: string },
  tab: TournamentTab = 'home'
): string {
  const base = `/tournaments/${buildSlugId(tournament.name, tournament.id)}`;
  return withTabQuery(base, tab, 'home');
}

export function teamPath(team: { id: string; name: string }, tab: TeamTab = 'overview'): string {
  const base = `/teams/${buildSlugId(team.name, team.id)}`;
  return withTabQuery(base, tab, 'overview');
}

export function playerPath(
  player: { id: string; name: string },
  tab: PlayerTab = 'overview'
): string {
  const base = `/players/${buildSlugId(player.name, player.id)}`;
  return withTabQuery(base, tab, 'overview');
}

export function gamePath(gameId: string): string {
  return `/games/${encodeURIComponent(gameId)}`;
}

export function liveGamePath(gameId: string): string {
  return `/live/${encodeURIComponent(gameId)}`;
}

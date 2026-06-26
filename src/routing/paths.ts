import { buildSlugId } from './slugs';
import type { GameFormatScope } from '../utils/gameFormat';
import { DEFAULT_GAME_FORMAT_SCOPE } from '../utils/gameFormat';
import type { TournamentIdSet } from '../utils/tournamentSelection';
import { serializeTournamentSelection } from '../utils/tournamentSelection';
import type { TournamentTab, TeamTab, PlayerTab } from './tabs';
import { withTabQuery } from './tabs';

export interface StatsRouteQuery {
  gameFormatScope?: GameFormatScope;
  tournamentIds?: TournamentIdSet;
}

function withStatsQuery(
  path: string,
  tab: string,
  defaultTab: string,
  query?: StatsRouteQuery
): string {
  const params = new URLSearchParams();
  if (tab !== defaultTab) {
    params.set('tab', tab);
  }
  const format = query?.gameFormatScope;
  if (format && format !== DEFAULT_GAME_FORMAT_SCOPE) {
    params.set('format', format);
  }
  const tournaments =
    query && 'tournamentIds' in query
      ? serializeTournamentSelection(query.tournamentIds ?? null)
      : undefined;
  if (tournaments) {
    params.set('tournaments', tournaments);
  }
  const qs = params.toString();
  if (!qs) return path;
  return `${path}?${qs}`;
}

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

export function teamPath(
  team: { id: string; name: string },
  tab: TeamTab = 'overview',
  query?: StatsRouteQuery
): string {
  const base = `/teams/${buildSlugId(team.name, team.id)}`;
  return withStatsQuery(base, tab, 'overview', query);
}

export function playerPath(
  player: { id: string; name: string },
  tab: PlayerTab = 'overview',
  query?: StatsRouteQuery
): string {
  const base = `/players/${buildSlugId(player.name, player.id)}`;
  return withStatsQuery(base, tab, 'overview', query);
}

export function gamePath(gameId: string): string {
  return `/games/${encodeURIComponent(gameId)}`;
}

export function liveGamePath(gameId: string): string {
  return `/live/${encodeURIComponent(gameId)}`;
}

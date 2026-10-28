import { parseSlugId } from '../../routing/slugs';
import {
  parsePlayerTab,
  parseTeamTab,
  parseTournamentTab,
  type PlayerTab,
  type TeamTab,
  type TournamentTab,
} from '../../routing/tabs';
import type { ClassifiedLocation, EntityLookup } from './types';

const TOURNAMENT_TAB_LABEL: Record<TournamentTab, string> = {
  home: 'Home',
  standings: 'Standings',
  teams: 'Teams',
  players: 'Players',
  games: 'Games',
  awards: 'Awards',
};

const TEAM_TAB_LABEL: Record<TeamTab, string> = {
  overview: 'Overview',
  roster: 'Roster',
  stats: 'Stats',
  players: 'Players',
  games: 'Games',
};

const PLAYER_TAB_LABEL: Record<PlayerTab, string> = {
  overview: 'Overview',
  stats: 'Player Stats',
  advanced: 'Advanced Stats',
  gamelog: 'Game Log',
};

function filterNoteFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const parts: string[] = [];
  const format = params.get('format');
  if (format) parts.push(`format=${format}`);
  const tournaments = params.get('tournaments');
  if (tournaments) parts.push(`tournaments=${tournaments}`);
  const friendlies = params.get('friendlies');
  if (friendlies) parts.push(`friendlies=${friendlies}`);
  if (parts.length === 0) return undefined;
  return parts.join(', ');
}

/**
 * Map pathname + search into a browse location for session tracking.
 * Returns null for paths we intentionally ignore (none currently — legal tracked).
 */
export function classifyLocation(
  pathname: string,
  search: string,
  lookup: EntityLookup = {}
): ClassifiedLocation | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const filterNote = filterNoteFromSearch(search);
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const tabParam = params.get('tab');

  if (path === '/') {
    return { key: 'main:home', title: 'Main (Home)' };
  }
  if (path === '/tournaments') {
    return { key: 'main:tournaments', title: 'Main (Tournaments)' };
  }
  if (path === '/teams') {
    return { key: 'main:teams', title: 'Main (Teams)' };
  }
  if (path === '/games') {
    return { key: 'main:games', title: 'Main (Games)' };
  }
  if (path === '/stats-entry') {
    return { key: 'stats-entry', title: 'Stats entry' };
  }
  if (path === '/account') {
    return { key: 'account', title: 'Account' };
  }
  if (path.startsWith('/legal/')) {
    const leaf = path.slice('/legal/'.length) || 'legal';
    return { key: `legal:${leaf}`, title: `Legal (${leaf})` };
  }

  const tournamentMatch = path.match(/^\/tournaments\/([^/]+)$/);
  if (tournamentMatch) {
    const parsed = parseSlugId(decodeURIComponent(tournamentMatch[1]));
    const id = parsed?.id ?? tournamentMatch[1];
    const name = lookup.tournamentName?.(id) ?? parsed?.slug ?? id;
    const tab = parseTournamentTab(tabParam);
    return {
      key: `tournament:${id}:${tab}`,
      title: name,
      tabKey: tab,
      tabLabel: TOURNAMENT_TAB_LABEL[tab],
    };
  }

  const teamMatch = path.match(/^\/teams\/([^/]+)$/);
  if (teamMatch) {
    const parsed = parseSlugId(decodeURIComponent(teamMatch[1]));
    const id = parsed?.id ?? teamMatch[1];
    const name = lookup.teamName?.(id) ?? parsed?.slug ?? id;
    const tab = parseTeamTab(tabParam);
    return {
      key: `team:${id}:${tab}`,
      title: name,
      tabKey: tab,
      tabLabel: TEAM_TAB_LABEL[tab],
      filterNote,
    };
  }

  const playerMatch = path.match(/^\/players\/([^/]+)$/);
  if (playerMatch) {
    const parsed = parseSlugId(decodeURIComponent(playerMatch[1]));
    const id = parsed?.id ?? playerMatch[1];
    const name = lookup.playerName?.(id) ?? parsed?.slug ?? id;
    const tab = parsePlayerTab(tabParam);
    return {
      key: `player:${id}:${tab}`,
      title: name,
      tabKey: tab,
      tabLabel: PLAYER_TAB_LABEL[tab],
      filterNote,
    };
  }

  const gameMatch = path.match(/^\/games\/([^/]+)$/);
  if (gameMatch) {
    const id = decodeURIComponent(gameMatch[1]);
    const matchup = lookup.gameMatchup?.(id) ?? `Game ${id}`;
    return {
      key: `game:${id}`,
      title: matchup,
    };
  }

  // Unknown routes: still track so we learn about them
  return {
    key: `other:${path}`,
    title: path,
  };
}

/** Page identity without tab — for grouping consecutive tabs under one block. */
export function pageGroupKey(locationKey: string): string {
  if (locationKey.startsWith('tournament:')) {
    const parts = locationKey.split(':');
    return `tournament:${parts[1]}`;
  }
  if (locationKey.startsWith('team:')) {
    const parts = locationKey.split(':');
    return `team:${parts[1]}`;
  }
  if (locationKey.startsWith('player:')) {
    const parts = locationKey.split(':');
    return `player:${parts[1]}`;
  }
  return locationKey;
}

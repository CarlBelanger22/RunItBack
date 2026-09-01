import type { Game, Player, Team, Tournament } from '../App';
import { getLeaguePlayerPool } from './rosterPlayers';

export type GlobalSearchResultType = 'tournament' | 'team' | 'player' | 'game';

export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  score: number;
  tournament?: Tournament;
  team?: Team;
  player?: Player;
  teamNames?: string[];
  game?: Game;
}

export const GLOBAL_SEARCH_TYPE_LABELS: Record<GlobalSearchResultType, string> = {
  tournament: 'Tournament',
  team: 'Team',
  player: 'Player',
  game: 'Game',
};

const TIER_EXACT = 4;
const TIER_FIRST_WORD_PREFIX = 3;
const TIER_WORD_PREFIX = 2;
const TIER_SUBSTRING = 1;

/** Score how well `text` matches `query` (higher = better). Returns 0 if no match. */
export function scoreSearchMatch(text: string, query: string): number {
  const normalizedText = text.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || !normalizedText) return 0;

  const words = normalizedText.split(/\s+/).filter(Boolean);

  if (normalizedText === normalizedQuery) {
    return TIER_EXACT * 1000 + 100;
  }

  const firstWord = words[0] ?? '';
  if (firstWord.startsWith(normalizedQuery)) {
    const ratio = normalizedQuery.length / firstWord.length;
    return TIER_FIRST_WORD_PREFIX * 1000 + ratio * 100;
  }

  const wordPrefixMatch = words.find((word) => word.startsWith(normalizedQuery));
  if (wordPrefixMatch) {
    const ratio = normalizedQuery.length / wordPrefixMatch.length;
    return TIER_WORD_PREFIX * 1000 + ratio * 100;
  }

  if (normalizedText.includes(normalizedQuery)) {
    const ratio = normalizedQuery.length / normalizedText.length;
    return TIER_SUBSTRING * 1000 + ratio * 100;
  }

  return 0;
}

export function scoreSearchFields(fields: string[], query: string): number {
  let best = 0;
  for (const field of fields) {
    const score = scoreSearchMatch(field, query);
    if (score > best) best = score;
  }
  return best;
}

/** Primary label drives ranking; secondary fields help inclusion but cannot outrank stronger name matches. */
export function scoreWithPrimaryField(
  primary: string,
  secondaryFields: string[],
  query: string
): number {
  const primaryScore = scoreSearchMatch(primary, query);
  let best = primaryScore;
  for (const field of secondaryFields) {
    const secondaryScore = scoreSearchMatch(field, query);
    if (secondaryScore > 0) {
      const discounted = secondaryScore * 0.85;
      if (discounted > best) best = discounted;
    }
  }
  return best;
}

function compareSearchResults(a: GlobalSearchResult, b: GlobalSearchResult): number {
  if (b.score !== a.score) return b.score - a.score;

  const aLabel = getSearchResultLabel(a);
  const bLabel = getSearchResultLabel(b);
  return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
}

export function getSearchResultLabel(result: GlobalSearchResult): string {
  switch (result.type) {
    case 'tournament':
      return result.tournament?.name ?? '';
    case 'team':
      return result.team?.name ?? '';
    case 'player':
      return result.player?.name ?? '';
    case 'game':
      if (result.game) {
        return `${result.game.homeTeam.abbreviation} vs ${result.game.awayTeam.abbreviation}`;
      }
      return '';
    default:
      return '';
  }
}

export interface GlobalSearchInput {
  tournaments: Tournament[];
  teams: Team[];
  games: Game[];
  orphanPlayers?: Player[];
}

export function buildGlobalSearchResults(
  query: string,
  input: GlobalSearchInput,
  limit = 15
): GlobalSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const { tournaments, teams, games, orphanPlayers = [] } = input;
  const results: GlobalSearchResult[] = [];

  for (const tournament of tournaments) {
    const score = scoreWithPrimaryField(
      tournament.name,
      [
        tournament.description ?? '',
        String(tournament.year),
        tournament.month,
      ],
      trimmedQuery
    );
    if (score > 0) results.push({ type: 'tournament', score, tournament });
  }

  for (const team of teams) {
    const score = scoreWithPrimaryField(
      team.name,
      [team.abbreviation ?? '', team.description ?? ''],
      trimmedQuery
    );
    if (score > 0) results.push({ type: 'team', score, team });
  }

  const playerPool = getLeaguePlayerPool(teams, orphanPlayers);
  for (const { player, teamNames } of playerPool) {
    const score = scoreWithPrimaryField(
      player.name,
      [String(player.number), player.position ?? ''],
      trimmedQuery
    );
    if (score > 0) results.push({ type: 'player', score, player, teamNames });
  }

  for (const game of games) {
    const homeName = game.homeTeam?.name ?? '';
    const awayName = game.awayTeam?.name ?? '';
    const score = scoreWithPrimaryField(
      `${homeName} vs ${awayName}`,
      [
        homeName,
        awayName,
        game.homeTeam?.abbreviation ?? '',
        game.awayTeam?.abbreviation ?? '',
        game.date ?? '',
      ],
      trimmedQuery
    );
    if (score > 0) results.push({ type: 'game', score, game });
  }

  return results.sort(compareSearchResults).slice(0, limit);
}

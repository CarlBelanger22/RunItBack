import type { Game } from '../App';

/** Display label for lists (tournament name slot). */
export const FRIENDLY_GAME_LABEL = 'Friendly';

/** Header / meta copy on game + live surfaces. */
export const FRIENDLY_GAME_META = 'Friendly game';

/** Player Stats tab summary row under All Time. */
export const FRIENDLIES_SCOPE_LABEL = 'Friendlies';
export const FRIENDLIES_SCOPE_ID = 'friendlies';

const INCLUDE_FRIENDLIES_PARAM = 'friendlies';

/** URL `?friendlies=1` — merge friendlies into All Time on player stats. */
export function parseIncludeFriendliesInStats(
  raw: string | null | undefined
): boolean {
  return raw === '1' || raw === 'true';
}

export function serializeIncludeFriendliesInStats(value: boolean): string | undefined {
  return value ? '1' : undefined;
}

export const INCLUDE_FRIENDLIES_SEARCH_PARAM = INCLUDE_FRIENDLIES_PARAM;

export function isFriendlyGame(game: Pick<Game, 'isFriendly'> | null | undefined): boolean {
  return game?.isFriendly === true;
}

/** Competitive season / tournament / all-time scopes — exclude friendlies. */
export function isCompetitiveGame(game: Pick<Game, 'isFriendly'> | null | undefined): boolean {
  return !isFriendlyGame(game);
}

export function excludeFriendlyGames<T extends Pick<Game, 'isFriendly'>>(games: T[] | undefined): T[] {
  return (games ?? []).filter(isCompetitiveGame);
}

export function onlyFriendlyGames<T extends Pick<Game, 'isFriendly'>>(games: T[] | undefined): T[] {
  return (games ?? []).filter(isFriendlyGame);
}

/**
 * List / tournament-column text. Friendly → "Friendly"; else official tournament name.
 * Not a link target for friendlies.
 */
export function resolveGameListLabel(
  game: Pick<Game, 'isFriendly'> | null | undefined,
  tournamentName?: string | null
): string | undefined {
  if (isFriendlyGame(game)) return FRIENDLY_GAME_LABEL;
  const name = tournamentName?.trim();
  return name || undefined;
}

/** Game page / live header / banner meta. Friendly → "Friendly game". */
export function resolveGameMetaLabel(
  game: Pick<Game, 'isFriendly'> | null | undefined,
  tournamentName?: string | null
): string | undefined {
  if (isFriendlyGame(game)) return FRIENDLY_GAME_META;
  const name = tournamentName?.trim();
  return name || undefined;
}

/** Tournament id to persist when marking a game final. Friendlies stay untournamented. */
export function resolveCompletedGameTournamentId(
  game: Pick<Game, 'isFriendly' | 'tournamentId'>
): string | undefined {
  if (isFriendlyGame(game)) return game.tournamentId;
  return game.tournamentId || 'tournament-summer-2024';
}

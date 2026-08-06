import type { Location, NavigateFunction, NavigateOptions } from 'react-router-dom';
import type { Game, Tournament } from '../App';
import { paths, tournamentPath } from './paths';

export type NavigationFromState = { from?: string };

export function currentLocationPath(location: Location): string {
  return `${location.pathname}${location.search}`;
}

export function getReturnToFromState(location: Location): string | undefined {
  const from = (location.state as NavigationFromState | null)?.from;
  return typeof from === 'string' && from.length > 0 ? from : undefined;
}

/** Navigate to a detail page, recording where the user came from. */
export function navigateWithReturnTo(
  navigate: NavigateFunction,
  target: string,
  returnTo: string
): void {
  navigate(target, { state: { from: returnTo } satisfies NavigationFromState });
}

/**
 * Same-document navigates (tabs, search params, slug canonical) must keep
 * `location.state` or in-app Back loses `from` and hits the cold-link fallback.
 */
export function navigatePreservingState(
  navigate: NavigateFunction,
  location: Location,
  to: string,
  options?: Pick<NavigateOptions, 'replace'>
): void {
  navigate(to, {
    replace: options?.replace,
    state: location.state,
  });
}

/** Options for setSearchParams that keep return-to (and any other) state. */
export function searchParamsOptionsPreservingState(
  location: Location,
  options?: { replace?: boolean }
): { replace?: boolean; state: unknown } {
  return {
    replace: options?.replace,
    state: location.state,
  };
}

/** Back: use recorded `from`, else fallback (e.g. /teams). */
export function navigateBack(
  navigate: NavigateFunction,
  location: Location,
  fallback: string
): void {
  const from = getReturnToFromState(location);
  if (from && from !== currentLocationPath(location)) {
    navigate(from);
    return;
  }
  navigate(fallback);
}

/** Cold-link fallback for a game summary: tournament page if tagged, else Games. */
export function gameSummaryBackFallback(
  game: Pick<Game, 'tournamentId'>,
  tournaments: Tournament[]
): string {
  if (game.tournamentId) {
    const tournament = tournaments.find((t) => t.id === game.tournamentId);
    if (tournament) return tournamentPath(tournament);
  }
  return paths.games;
}

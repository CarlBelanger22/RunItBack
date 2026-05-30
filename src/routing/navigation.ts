import type { Location, NavigateFunction } from 'react-router-dom';

export type NavigationFromState = { from?: string };

export function currentLocationPath(location: Location): string {
  return `${location.pathname}${location.search}`;
}

/** Navigate to a detail page, recording where the user came from. */
export function navigateWithReturnTo(
  navigate: NavigateFunction,
  target: string,
  returnTo: string
): void {
  navigate(target, { state: { from: returnTo } satisfies NavigationFromState });
}

/** Back: use recorded `from`, else fallback (e.g. /teams). */
export function navigateBack(
  navigate: NavigateFunction,
  location: Location,
  fallback: string
): void {
  const from = (location.state as NavigationFromState | null)?.from;
  if (from) {
    navigate(from);
    return;
  }
  navigate(fallback);
}

/**
 * LE-100 — return-to / Back navigation helpers.
 * Run: npx tsx scripts/test-navigation-return-to.ts
 */
import {
  currentLocationPath,
  gameSummaryBackFallback,
  getReturnToFromState,
  navigateBack,
  navigatePreservingState,
  navigateWithReturnTo,
  searchParamsOptionsPreservingState,
} from '../src/routing/navigation';
import { paths } from '../src/routing/paths';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  const calls: Array<{ to: string; state?: unknown; replace?: boolean }> = [];
  const navigate = ((to: string, opts?: { state?: unknown; replace?: boolean }) => {
    calls.push({ to, state: opts?.state, replace: opts?.replace });
  }) as never;

  const locFromTournament = {
    pathname: '/teams/ntu--team-1',
    search: '',
    hash: '',
    state: { from: '/tournaments/iubit--t1?tab=standings' },
    key: 'k1',
  } as never;

  navigateBack(navigate, locFromTournament, paths.teams);
  assert(
    calls[0]?.to === '/tournaments/iubit--t1?tab=standings',
    'Back uses state.from'
  );

  calls.length = 0;
  const locCold = {
    pathname: '/teams/ntu--team-1',
    search: '',
    hash: '',
    state: null,
    key: 'k2',
  } as never;
  navigateBack(navigate, locCold, paths.teams);
  assert(calls[0]?.to === paths.teams, 'cold link falls back to /teams');

  calls.length = 0;
  navigateWithReturnTo(navigate, '/teams/x', '/tournaments/y');
  assert(
    (calls[0]?.state as { from?: string })?.from === '/tournaments/y',
    'navigateWithReturnTo records from'
  );

  calls.length = 0;
  navigatePreservingState(navigate, locFromTournament, '/teams/ntu--team-1?tab=roster');
  assert(
    (calls[0]?.state as { from?: string })?.from ===
      '/tournaments/iubit--t1?tab=standings',
    'tab navigate preserves from'
  );

  const opts = searchParamsOptionsPreservingState(locFromTournament, {
    replace: true,
  });
  assert(opts.replace === true, 'search params replace');
  assert(
    (opts.state as { from?: string })?.from ===
      '/tournaments/iubit--t1?tab=standings',
    'search params keep from'
  );

  assert(
    getReturnToFromState(locFromTournament) ===
      '/tournaments/iubit--t1?tab=standings',
    'getReturnToFromState'
  );
  assert(
    currentLocationPath({
      pathname: '/a',
      search: '?x=1',
      hash: '',
      state: null,
      key: 'k',
    } as never) === '/a?x=1',
    'currentLocationPath'
  );

  const tournament = {
    id: 't1',
    name: 'IUBIT',
    year: 2026,
    month: 'July',
    teams: [],
    games: [],
  };
  assert(
    gameSummaryBackFallback({ tournamentId: 't1' }, [tournament]).includes(
      'tournaments/'
    ),
    'game fallback → tournament'
  );
  assert(
    gameSummaryBackFallback({ tournamentId: undefined }, [tournament]) ===
      paths.games,
    'game fallback → /games'
  );

  console.log('PASS: test-navigation-return-to');
}

main();

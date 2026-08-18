/**
 * LE-146 — scheduled fixtures are not orphans.
 * Run: npm run test:scheduled-games
 */
import type { Game } from '../src/App';
import { isOrphanedIncompleteGame } from '../src/utils/activeGame';
import { isScheduledTournamentGame } from '../src/utils/scheduledGames';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function scheduledGame(): Game {
  return {
    id: 'game-fixture',
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    homeTeam: { id: 'team-a', name: 'A', abbreviation: 'A', players: [] },
    awayTeam: { id: 'team-b', name: 'B', abbreviation: 'B', players: [] },
    tournamentId: 't1',
    date: '2026-09-07',
    gameStats: [],
    teamStats: {
      home: { teamId: 'team-a', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'team-b', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '12:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: false,
  };
}

function main() {
  const g = scheduledGame();
  assert(isScheduledTournamentGame(g), 'scheduled');
  assert(!isOrphanedIncompleteGame(g), 'not orphan');

  const junk = { ...g, tournamentId: undefined };
  assert(isOrphanedIncompleteGame(junk), 'untagged junk is orphan');

  console.log('PASS: test-scheduled-games');
}

main();

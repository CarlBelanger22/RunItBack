/**
 * LE-96 — Tournament tab routing (Structure tab removed).
 * Run: npm run test:tournament-tabs
 */
import { parseTournamentTab } from '../src/routing/tabs';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(parseTournamentTab(null) === 'home', 'default home');
  assert(parseTournamentTab('standings') === 'standings', 'standings');
  assert(parseTournamentTab('structure') === 'standings', 'legacy structure → standings');
  assert(parseTournamentTab('games') === 'games', 'games');
  assert(parseTournamentTab('nope') === 'home', 'unknown → home');
  console.log('PASS: test-tournament-tabs');
}

main();

/**
 * LE-95.5 — Bracket slot link / unlink.
 * Run: npm run test:bracket-game-link
 */
import type { Game } from '../src/App';
import {
  gamesAvailableForBracketSlot,
  linkGameToBracketSlot,
  unlinkGameFromBracketSlot,
} from '../src/utils/bracketGameLink';
import { buildIubit2026Structure, IUBIT_2026_GROUPS } from '../src/utils/iubit2026Structure';
import { findBracketSlot } from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function stubGame(partial: Partial<Game> & { id: string }): Game {
  return {
    homeTeam: {} as Game['homeTeam'],
    awayTeam: {} as Game['awayTeam'],
    homeTeamId: 'h',
    awayTeamId: 'a',
    date: '2026-01-01',
    gameStats: [],
    teamStats: { home: {} as Game['teamStats']['home'], away: {} as Game['teamStats']['away'] },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 70, away: 65 },
    ...partial,
  } as Game;
}

function main(): void {
  const teams = IUBIT_2026_GROUPS.flatMap((g) =>
    g.abbreviations.map((abbreviation) => ({
      id: `id-${abbreviation}`,
      abbreviation,
    }))
  );
  const structure = buildIubit2026Structure(teams)!;
  const slotId = 'iubit-slot-1-4-sf-ad';
  const stageId = 'iubit-stage-1-4';

  const g1 = stubGame({
    id: 'g1',
    stageId,
    tournamentId: 't1',
    groupId: 'iubit-g-a',
  });
  const g2 = stubGame({ id: 'g2', stageId, tournamentId: 't1' });
  let games = [g1, g2];

  let linked = linkGameToBracketSlot(structure, games, slotId, 'g1');
  assert(findBracketSlot(linked.structure, slotId)?.gameId === 'g1', 'slot linked');
  assert(linked.games.find((g) => g.id === 'g1')?.bracketSlotId === slotId, 'game tagged');
  assert(linked.games.find((g) => g.id === 'g1')?.groupId == null, 'LE-104: groupId cleared');
  assert(linked.games.find((g) => g.id === 'g1')?.stageId === stageId, 'classification stage');

  // Relink different game to same slot
  linked = linkGameToBracketSlot(linked.structure, linked.games, slotId, 'g2');
  assert(findBracketSlot(linked.structure, slotId)?.gameId === 'g2', 'slot g2');
  assert(linked.games.find((g) => g.id === 'g1')?.bracketSlotId == null, 'g1 cleared');
  assert(linked.games.find((g) => g.id === 'g2')?.bracketSlotId === slotId, 'g2 tagged');

  // Move g2 to another slot
  const other = 'iubit-slot-1-4-sf-bc';
  linked = linkGameToBracketSlot(linked.structure, linked.games, other, 'g2');
  assert(findBracketSlot(linked.structure, slotId)?.gameId == null, 'old slot clear');
  assert(findBracketSlot(linked.structure, other)?.gameId === 'g2', 'new slot');

  const available = gamesAvailableForBracketSlot(
    linked.games,
    linked.structure,
    stageId,
    slotId
  );
  assert(available.some((g) => g.id === 'g1'), 'g1 available');
  assert(!available.some((g) => g.id === 'g2'), 'g2 linked elsewhere');

  const unlinked = unlinkGameFromBracketSlot(linked.structure, linked.games, other);
  assert(findBracketSlot(unlinked.structure, other)?.gameId == null, 'unlinked slot');
  assert(unlinked.games.find((g) => g.id === 'g2')?.bracketSlotId == null, 'unlinked game');

  console.log('PASS: test-bracket-game-link');
}

main();

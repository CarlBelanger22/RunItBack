/**
 * LE-115 — Resolve Winner/Loser feeders into team ids.
 * Run: npm run test:resolve-bracket-feeders
 */
import type { Game } from '../src/App';
import { buildFourTeamBracket } from '../src/utils/fourTeamBracket';
import {
  autoLinkBracketByResolvedTeams,
  resolveBracketSlotTeamIds,
  winnerLoserTeamIds,
} from '../src/utils/resolveBracketFeeders';
import type { TournamentStructure } from '../src/utils/tournamentStructure';
import { findBracketSlot } from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function stubGame(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number
): Game {
  return {
    id,
    homeTeam: { id: homeTeamId } as Game['homeTeam'],
    awayTeam: { id: awayTeamId } as Game['awayTeam'],
    homeTeamId,
    awayTeamId,
    tournamentId: 't1',
    date: '2025-10-01',
    gameStats: [],
    teamStats: {
      home: { total_points: home } as Game['teamStats']['home'],
      away: { total_points: away } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home, away },
  } as Game;
}

function formatAStructure(): TournamentStructure {
  const stageId = 'stage-finals';
  return {
    stages: [
      {
        id: stageId,
        name: 'Finals',
        kind: 'classification',
        order: 1,
        bracket: buildFourTeamBracket(stageId),
      },
    ],
  };
}

function testWinnerLoser(): void {
  const g = stubGame('g1', 'nus', 'sim', 72, 64);
  const wl = winnerLoserTeamIds(g)!;
  assert(wl.winnerId === 'nus', 'winner nus');
  assert(wl.loserId === 'sim', 'loser sim');
  assert(winnerLoserTeamIds(stubGame('t', 'a', 'b', 50, 50)) == null, 'tie');
}

function testResolveFinalFromSemis(): void {
  const structure = formatAStructure();
  const sfAb = 'stage-finals-sf-a1b2';
  const sfBa = 'stage-finals-sf-b1a2';

  // Link semis into structure
  structure.stages[0].bracket!.rounds[0].slots[0].gameId = 'sf1';
  structure.stages[0].bracket!.rounds[0].slots[1].gameId = 'sf2';

  const games = [
    stubGame('sf1', 'sim', 'nus', 64, 72), // nus wins (A1 vs B2 path)
    stubGame('sf2', 'ntu', 'suss', 86, 41), // ntu wins
  ];
  const gameById = new Map(games.map((g) => [g.id, g]));
  const rounds = structure.stages[0].bracket!.rounds;

  const final = findBracketSlot(structure, 'stage-finals-final')!;
  const third = findBracketSlot(structure, 'stage-finals-3rd')!;

  const finalIds = resolveBracketSlotTeamIds(final, rounds, gameById);
  assert(finalIds.homeTeamId === 'nus', `final home=${finalIds.homeTeamId}`);
  assert(finalIds.awayTeamId === 'ntu', `final away=${finalIds.awayTeamId}`);

  const thirdIds = resolveBracketSlotTeamIds(third, rounds, gameById);
  assert(thirdIds.homeTeamId === 'sim', `3rd home=${thirdIds.homeTeamId}`);
  assert(thirdIds.awayTeamId === 'suss', `3rd away=${thirdIds.awayTeamId}`);

  void sfAb;
  void sfBa;
}

function testUndecidedFeeder(): void {
  const structure = formatAStructure();
  // semis not linked
  const gameById = new Map<string, Game>();
  const rounds = structure.stages[0].bracket!.rounds;
  const final = findBracketSlot(structure, 'stage-finals-final')!;
  const ids = resolveBracketSlotTeamIds(final, rounds, gameById);
  assert(ids.homeTeamId == null && ids.awayTeamId == null, 'undecided');
}

function testMixedSeedAndFeeder(): void {
  const structure: TournamentStructure = {
    stages: [
      {
        id: 'place',
        name: '5th-7th',
        kind: 'classification',
        order: 1,
        bracket: {
          rounds: [
            {
              id: 'r-sf',
              name: 'Semis',
              slots: [
                {
                  id: 'sf-b3b4',
                  label: '5th Place',
                  homeTeamId: 'sit',
                  awayTeamId: 'sutd',
                  gameId: 'g-sf',
                },
              ],
            },
            {
              id: 'r-f',
              name: 'Finals',
              slots: [
                {
                  id: 'f-6th',
                  label: '6th Place',
                  homeFromSlotId: 'sf-b3b4',
                  homeFromOutcome: 'loser',
                  awayTeamId: 'smu',
                  awaySeedLabel: 'A3',
                  gameId: null,
                  homeTeamId: null,
                },
              ],
            },
          ],
        },
      },
    ],
  };
  const games = [stubGame('g-sf', 'sit', 'sutd', 85, 44)];
  const gameById = new Map(games.map((g) => [g.id, g]));
  const rounds = structure.stages[0].bracket!.rounds;
  const slot = rounds[1].slots[0];
  const ids = resolveBracketSlotTeamIds(slot, rounds, gameById);
  assert(ids.homeTeamId === 'sutd', `loser=${ids.homeTeamId}`);
  assert(ids.awayTeamId === 'smu', `seed=${ids.awayTeamId}`);
}

function testAutoLinkFinal(): void {
  const structure = formatAStructure();
  structure.stages[0].bracket!.rounds[0].slots[0].gameId = 'sf1';
  structure.stages[0].bracket!.rounds[0].slots[1].gameId = 'sf2';

  const games = [
    stubGame('sf1', 'sim', 'nus', 64, 72),
    stubGame('sf2', 'ntu', 'suss', 86, 41),
    stubGame('final', 'nus', 'ntu', 45, 80),
    stubGame('third', 'sim', 'suss', 58, 64),
  ];

  const { structure: next, report } = autoLinkBracketByResolvedTeams(
    structure,
    games,
    't1'
  );
  assert(report.linked >= 2, `linked=${report.linked}`);
  const final = findBracketSlot(next, 'stage-finals-final');
  const third = findBracketSlot(next, 'stage-finals-3rd');
  assert(final?.gameId === 'final', `final game=${final?.gameId}`);
  assert(third?.gameId === 'third', `third game=${third?.gameId}`);
}

function testAutoLinkPrefersLatestRematch(): void {
  const structure = formatAStructure();
  structure.stages[0].bracket!.rounds[0].slots[0].gameId = 'sf1';
  structure.stages[0].bracket!.rounds[0].slots[1].gameId = 'sf2';
  // Unlinked final — two NUS-NTU games; later should win
  const games = [
    stubGame('sf1', 'sim', 'nus', 64, 72),
    stubGame('sf2', 'ntu', 'suss', 86, 41),
    { ...stubGame('early-final', 'nus', 'ntu', 40, 50), date: '2025-09-01' },
    { ...stubGame('final', 'nus', 'ntu', 45, 80), date: '2025-10-03' },
    stubGame('third', 'sim', 'suss', 58, 64),
  ];

  const { structure: next, report } = autoLinkBracketByResolvedTeams(
    structure,
    games,
    't1'
  );
  assert(report.linked >= 1, `linked=${report.linked}`);
  const final = findBracketSlot(next, 'stage-finals-final');
  assert(final?.gameId === 'final', `final game=${final?.gameId} (want latest)`);
}

function testAutoLinkCascadesRoundsInOneCall(): void {
  // Semis start unlinked; Final needs SF gameIds from the same auto-link run.
  const structure = formatAStructure();
  structure.stages[0].bracket!.rounds[0].slots[0].homeTeamId = 'sim';
  structure.stages[0].bracket!.rounds[0].slots[0].awayTeamId = 'nus';
  structure.stages[0].bracket!.rounds[0].slots[1].homeTeamId = 'ntu';
  structure.stages[0].bracket!.rounds[0].slots[1].awayTeamId = 'suss';

  const games = [
    stubGame('sf1', 'sim', 'nus', 64, 72),
    stubGame('sf2', 'ntu', 'suss', 86, 41),
    stubGame('final', 'nus', 'ntu', 45, 80),
    stubGame('third', 'sim', 'suss', 58, 64),
  ];

  const { structure: next, report } = autoLinkBracketByResolvedTeams(
    structure,
    games,
    't1'
  );
  assert(report.linked >= 4, `linked cascade=${report.linked}`);
  assert(
    findBracketSlot(next, 'stage-finals-sf-a1b2')?.gameId === 'sf1',
    'sf1 linked'
  );
  assert(
    findBracketSlot(next, 'stage-finals-final')?.gameId === 'final',
    'final linked in same call'
  );
  assert(
    findBracketSlot(next, 'stage-finals-3rd')?.gameId === 'third',
    '3rd linked in same call'
  );
}

function main(): void {
  testWinnerLoser();
  testResolveFinalFromSemis();
  testUndecidedFeeder();
  testMixedSeedAndFeeder();
  testAutoLinkFinal();
  testAutoLinkPrefersLatestRematch();
  testAutoLinkCascadesRoundsInOneCall();
  console.log('PASS: test-resolve-bracket-feeders');
}

main();

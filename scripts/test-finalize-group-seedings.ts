/**
 * LE-114 — Finalize group seedings.
 * Run: npm run test:finalize-group-seedings
 */
import type { Game } from '../src/App';
import { buildFourTeamBracket } from '../src/utils/fourTeamBracket';
import {
  buildSeedSnapshot,
  finalizeGroupSeedings,
  unlockGroupSeedings,
} from '../src/utils/finalizeGroupSeedings';
import { findBracketSlot, normalizeTournamentStructure } from '../src/utils/tournamentStructure';
import type { TournamentStructure } from '../src/utils/tournamentStructure';

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
    tournamentId: 't-sunig',
    date: '2025-09-20',
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

function sampleStructure(): TournamentStructure {
  const stageId = 'stage-finals';
  return {
    stages: [
      {
        id: 'stage-group',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [
          {
            id: 'g-a',
            name: 'Group A',
            teamIds: ['ntu', 'nus', 'sim'],
          },
          {
            id: 'g-b',
            name: 'Group B',
            teamIds: ['sit', 'sutd', 'smu'],
          },
        ],
      },
      {
        id: stageId,
        name: 'Finals',
        kind: 'classification',
        order: 2,
        bracket: buildFourTeamBracket(stageId),
      },
    ],
  };
}

function groupGames(): Game[] {
  // A: ntu > nus > sim
  return [
    stubGame('rr-a1', 'ntu', 'nus', 80, 70),
    stubGame('rr-a2', 'ntu', 'sim', 90, 60),
    stubGame('rr-a3', 'nus', 'sim', 75, 70),
    // B: sit > sutd > smu
    stubGame('rr-b1', 'sit', 'sutd', 80, 70),
    stubGame('rr-b2', 'sit', 'smu', 85, 60),
    stubGame('rr-b3', 'sutd', 'smu', 72, 68),
  ];
}

function testSnapshot(): void {
  const structure = normalizeTournamentStructure(sampleStructure())!;
  const snap = buildSeedSnapshot(structure, groupGames());
  assert(snap.A1 === 'ntu', `A1=${snap.A1}`);
  assert(snap.A2 === 'nus', `A2=${snap.A2}`);
  assert(snap.B1 === 'sit', `B1=${snap.B1}`);
  assert(snap.B2 === 'sutd', `B2=${snap.B2}`);
}

function testFinalizeFillsAndLinks(): void {
  const structure = sampleStructure();
  const ko = stubGame('sf1', 'ntu', 'sutd', 78, 65); // A1 vs B2
  const games = [...groupGames(), ko];

  const { structure: next, games: nextGames, report } =
    finalizeGroupSeedings(structure, games, 't-sunig');

  assert(next.groupStageLocked === true, 'locked');
  assert(next.seedSnapshot?.A1 === 'ntu', 'snapshot A1');
  assert(report.slotsFilled >= 2, `slotsFilled=${report.slotsFilled}`);

  const sfAb = findBracketSlot(next, 'stage-finals-sf-a1b2');
  assert(sfAb?.homeTeamId === 'ntu', `home=${sfAb?.homeTeamId}`);
  assert(sfAb?.awayTeamId === 'sutd', `away=${sfAb?.awayTeamId}`);
  assert(sfAb?.gameId === 'sf1', `linked game=${sfAb?.gameId}`);

  const linked = nextGames.find((g) => g.id === 'sf1');
  assert(linked?.bracketSlotId === 'stage-finals-sf-a1b2', 'game slot');
  assert(linked?.stageId === 'stage-finals', 'game stage');
  assert(report.gamesLinked >= 1, `gamesLinked=${report.gamesLinked}`);
}

function testUnlockClearsLock(): void {
  const structure = sampleStructure();
  const { structure: locked } = finalizeGroupSeedings(
    structure,
    groupGames(),
    't-sunig'
  );
  assert(locked.groupStageLocked === true, 'was locked');

  const unlocked = unlockGroupSeedings(locked, {
    clearSnapshot: true,
    clearSeedTeamIds: true,
  });
  assert(unlocked?.groupStageLocked !== true, 'unlocked');
  assert(!unlocked?.seedSnapshot, 'snapshot cleared');

  const sfAb = findBracketSlot(unlocked!, 'stage-finals-sf-a1b2');
  assert(!sfAb?.homeTeamId && !sfAb?.awayTeamId, 'seed team ids cleared');
}

function testNormalizeRoundTrip(): void {
  const raw = {
    groupStageLocked: true,
    seedSnapshot: { A1: 'ntu', B2: 'sutd' },
    stages: [
      {
        id: 'stage-group',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [{ id: 'g-a', name: 'Group A', teamIds: ['ntu'] }],
      },
    ],
  };
  const n = normalizeTournamentStructure(raw)!;
  assert(n.groupStageLocked === true, 'lock round-trip');
  assert(n.seedSnapshot?.A1 === 'ntu', 'snap round-trip');
  assert(n.seedSnapshot?.B2 === 'sutd', 'snap B2');
}

function testFinalizeFillsA10(): void {
  const stageId = 'stage-finals';
  const structure: TournamentStructure = {
    stages: [
      {
        id: 'stage-group',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [
          {
            id: 'g-a',
            name: 'Group A',
            teamIds: Array.from({ length: 12 }, (_, i) => `t${i + 1}`),
          },
        ],
      },
      {
        id: stageId,
        name: 'Finals',
        kind: 'classification',
        order: 2,
        bracket: {
          rounds: [
            {
              id: `${stageId}-sf`,
              name: 'Semis',
              slots: [
                {
                  id: `${stageId}-sf2`,
                  label: 'SF2',
                  homeTeamId: null,
                  awayTeamId: null,
                  gameId: null,
                  homeFromSlotId: null,
                  awayFromSlotId: null,
                  homeFromOutcome: null,
                  awayFromOutcome: null,
                  homeSeedLabel: 'A10',
                  awaySeedLabel: 'A2',
                },
              ],
            },
          ],
        },
      },
    ],
  };

  // Round-robin: higher index loses so t1=1st … t12=12th
  const games: Game[] = [];
  const ids = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      games.push(
        stubGame(`rr-${i}-${j}`, ids[i], ids[j], 80, 60) // lower index wins
      );
    }
  }

  const { structure: next, report } = finalizeGroupSeedings(
    structure,
    games,
    't-sunig'
  );
  assert(next.seedSnapshot?.A10 === 't10', `A10=${next.seedSnapshot?.A10}`);
  assert(next.seedSnapshot?.A16 == null, 'no A16');
  const sf2 = findBracketSlot(next, `${stageId}-sf2`);
  assert(sf2?.homeTeamId === 't10', `SF2 home=${sf2?.homeTeamId}`);
  assert(sf2?.awayTeamId === 't2', `SF2 away=${sf2?.awayTeamId}`);
  assert(report.slotsFilled >= 1, 'filled A10 slot');
}

function main(): void {
  testSnapshot();
  testFinalizeFillsAndLinks();
  testFinalizeFillsA10();
  testUnlockClearsLock();
  testNormalizeRoundTrip();
  console.log('PASS: test-finalize-group-seedings');
}

main();

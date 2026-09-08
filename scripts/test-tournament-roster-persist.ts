/**
 * Tournament roster cloud persist: no delete-all, merge, skipSave gate.
 * Run: npm run test:tournament-roster-persist
 */

import {
  collectTournamentRosterRemovals,
  mergeLocalAndCloudTournamentRosters,
  planTournamentRosterCloudWrite,
  resolvePostRevalidateSaveGate,
  tournamentRosterSetsEqual,
} from '../src/lib/tournamentRosterCloudWrite';
import {
  reconcileTournamentRostersFromGames,
  type TournamentRosterEntry,
} from '../src/utils/tournamentRosters';
import type { Game, Player, Team } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function entry(
  tournamentId: string,
  teamId: string,
  playerId: string,
  number = 1
): TournamentRosterEntry {
  return {
    tournamentId,
    teamId,
    playerId,
    number,
    position: 'G',
  };
}

function makePlayer(id: string, name: string, number: number): Player {
  return {
    id,
    name,
    number,
    position: 'G',
    height: '',
    weight: '',
    age: 0,
  };
}

function testPlanNeverWipesUnknownRows(): void {
  const ethPlayed = entry('nbl', 'eth', 'russel', 5);
  const ethUnused = entry('nbl', 'eth', 'justin', 0);
  const sbaImport = entry('nbl', 'sba', 'ww', 1);

  const plan = planTournamentRosterCloudWrite({
    clientRows: [ethPlayed, ethUnused],
  });

  assert(plan.deletes.length === 0, 'no deletes when user removed nobody');
  assert(
    plan.upsert.some((r) => r.playerId === 'justin'),
    'upsert includes unused player still on tournament roster'
  );
  assert(
    !plan.upsert.some((r) => r.playerId === 'ww'),
    'client does not invent other-team import rows'
  );
  assert(
    !plan.deletes.some((d) => d.playerId === 'ww'),
    'missing import row is not scheduled for delete (no delete-all)'
  );
}

function testPlanDeletesOnlyExplicitRemovals(): void {
  const keep = entry('nbl', 'eth', 'russel', 5);
  const removed = entry('nbl', 'eth', 'justin', 0);
  const plan = planTournamentRosterCloudWrite({
    clientRows: [keep],
    pendingDeletes: [
      { tournamentId: 'nbl', teamId: 'eth', playerId: 'justin' },
    ],
  });
  assert(plan.deletes.length === 1, 'one explicit delete');
  assert(plan.deletes[0].playerId === 'justin', 'delete targets removed player');
  assert(
    !plan.upsert.some((r) => r.playerId === 'justin'),
    'removed player is not upserted'
  );
  assert(plan.upsert.some((r) => r.playerId === 'russel'), 'kept player upserted');
}

function testCollectRemovals(): void {
  const prev = [
    entry('nbl', 'eth', 'a'),
    entry('nbl', 'eth', 'b'),
  ];
  const next = [entry('nbl', 'eth', 'a')];
  const removals = collectTournamentRosterRemovals(prev, next);
  assert(removals.length === 1, 'one removal');
  assert(removals[0].playerId === 'b', 'removed b');
}

function testMergeKeepsLocalAddsAndCloudImports(): void {
  const localAdd = entry('nbl', 'eth', 'justin', 0);
  const localPlayed = entry('nbl', 'eth', 'russel', 5);
  const cloudPlayed = entry('nbl', 'eth', 'russel', 5);
  const cloudImport = entry('nbl', 'sba', 'ww', 1);

  const merged = mergeLocalAndCloudTournamentRosters(
    [localPlayed, localAdd],
    [cloudPlayed, cloudImport]
  );

  assert(
    merged.some((r) => r.playerId === 'justin'),
    'local unused add survives merge with smaller cloud set'
  );
  assert(
    merged.some((r) => r.playerId === 'ww'),
    'cloud import for another team survives merge'
  );
  assert(
    merged.some((r) => r.playerId === 'russel'),
    'shared played row kept'
  );
}

function testMergeHonorsExplicitDeletes(): void {
  const local = [entry('nbl', 'eth', 'russel', 5)];
  const cloud = [
    entry('nbl', 'eth', 'russel', 5),
    entry('nbl', 'eth', 'justin', 0),
  ];
  const merged = mergeLocalAndCloudTournamentRosters(local, cloud, [
    { tournamentId: 'nbl', teamId: 'eth', playerId: 'justin' },
  ]);
  assert(
    !merged.some((r) => r.playerId === 'justin'),
    'explicit remove is not resurrected from cloud'
  );
}

function testSkipSaveAlwaysReenabled(): void {
  const editedDuringFetch = resolvePostRevalidateSaveGate({
    cloudApplied: false,
    hadCache: true,
    hadLocalEdits: true,
  });
  assert(editedDuringFetch.enableSaves, 'saves re-enabled after edit-during-fetch');
  assert(
    editedDuringFetch.persistKind === 'rosters-only',
    'persist local roster edits that cloud apply skipped'
  );

  const staleOldBehaviorWouldDisable = resolvePostRevalidateSaveGate({
    cloudApplied: false,
    hadCache: true,
    hadLocalEdits: false,
    rostersAheadOfCloud: true,
  });
  assert(
    staleOldBehaviorWouldDisable.enableSaves,
    'saves enabled even when snapshot was used and cloud was not applied'
  );
  assert(
    staleOldBehaviorWouldDisable.persistKind === 'rosters-only',
    'snapshot-ahead rosters get persisted'
  );
}

function testReconcileDoesNotAutoAddUnusedClubPlayers(): void {
  const club = Array.from({ length: 15 }, (_, i) =>
    makePlayer(`p${i}`, `P${i}`, i)
  );
  const eth: Team = {
    id: 'eth',
    name: 'Eng Tat',
    abbreviation: 'ETH',
    players: club,
  };
  const opp: Team = {
    id: 'tgs',
    name: 'Tungsan',
    abbreviation: 'TGS',
    players: [makePlayer('opp1', 'Opp', 1)],
  };
  const playedIds = ['p5', 'p9', 'p12', 'p13'];
  const played = club.filter((p) => playedIds.includes(p.id));
  const unusedOnRoster = [club[0], club[1], club[4]];
  const game: Game = {
    id: 'g2',
    homeTeam: opp,
    awayTeam: eth,
    homeTeamId: opp.id,
    awayTeamId: eth.id,
    tournamentId: 'nbl',
    date: '2026-09-05',
    gameStats: played.map((p) => ({
      playerId: p.id,
      points: 1,
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: 0,
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 0,
    })),
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: [],
    awayStarters: playedIds.slice(0, 1),
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 65, away: 81 },
  };

  const stored: TournamentRosterEntry[] = [
    ...played.map((p) => entry('nbl', 'eth', p.id, p.number)),
    ...unusedOnRoster.map((p) => entry('nbl', 'eth', p.id, p.number)),
  ];

  const reconciled = reconcileTournamentRostersFromGames([game], [eth, opp], stored);
  const ethRows = reconciled.filter((r) => r.teamId === 'eth');

  assert(
    ethRows.length === played.length + unusedOnRoster.length,
    `keep played + explicit unused only, got ${ethRows.length}`
  );
  assert(
    unusedOnRoster.every((p) =>
      ethRows.some((r) => r.playerId === p.id)
    ),
    'unused players already on roster are not removed'
  );
  assert(
    !ethRows.some((r) => r.playerId === 'p10'),
    'other unused club players are not auto-added'
  );
}

function testSetsEqual(): void {
  const a = [entry('nbl', 'eth', 'a'), entry('nbl', 'eth', 'b')];
  const b = [entry('nbl', 'eth', 'b'), entry('nbl', 'eth', 'a')];
  assert(tournamentRosterSetsEqual(a, b), 'order-insensitive equal');
  assert(
    !tournamentRosterSetsEqual(a, [entry('nbl', 'eth', 'a')]),
    'different length not equal'
  );
}

function main(): void {
  testPlanNeverWipesUnknownRows();
  testPlanDeletesOnlyExplicitRemovals();
  testCollectRemovals();
  testMergeKeepsLocalAddsAndCloudImports();
  testMergeHonorsExplicitDeletes();
  testSkipSaveAlwaysReenabled();
  testReconcileDoesNotAutoAddUnusedClubPlayers();
  testSetsEqual();
  console.log('PASS: test-tournament-roster-persist');
}

main();

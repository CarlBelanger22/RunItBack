/**
 * Unit tests for live entry state machine reducer.
 * Run: npm run test:live-entry-state-machine
 */

import {
  initialLiveEntryContext,
  liveEntryReducer,
  type LiveEntryState,
} from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseState(): LiveEntryState {
  return {
    phase: { kind: 'idle' },
    ctx: initialLiveEntryContext('home', ['p1', 'p2'], ['p3', 'p4']),
  };
}

function testCourtClickStartsShotFlow(): void {
  const next = liveEntryReducer(baseState(), {
    type: 'COURT_CLICK',
    point: { xM: 7.5, yM: 2 },
    zone: {
      zone: 'paint',
      isPaint: true,
      shotValue: 2,
      distanceFromHoopM: 2,
    },
  });
  assert(next.phase.kind === 'shot', 'court click → shot phase');
  assert(
    next.phase.kind === 'shot' && next.phase.step === 'await_outcome',
    'await outcome'
  );
  assert(next.ctx.pendingShot?.isPaint === true, 'paint flagged');
}

function testMakeOutcomePicksShooter(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'COURT_CLICK',
    point: { xM: 7.5, yM: 2 },
    zone: {
      zone: 'paint',
      isPaint: true,
      shotValue: 2,
      distanceFromHoopM: 2,
    },
  });
  state = liveEntryReducer(state, { type: 'SHOT_OUTCOME', outcome: 'make' });
  assert(state.phase.kind === 'shot' && state.phase.step === 'pick_shooter', 'make → shooter');
}

function testMissOutcomePicksShooter(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'COURT_CLICK',
    point: { xM: 7.5, yM: 8 },
    zone: {
      zone: 'three',
      isPaint: false,
      shotValue: 3,
      distanceFromHoopM: 8,
    },
  });
  state = liveEntryReducer(state, { type: 'SHOT_OUTCOME', outcome: 'miss' });
  assert(state.phase.kind === 'shot' && state.phase.step === 'pick_shooter', 'miss → shooter');
}

function testResetClearsPending(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'COURT_CLICK',
    point: { xM: 7.5, yM: 2 },
    zone: {
      zone: 'paint',
      isPaint: true,
      shotValue: 2,
      distanceFromHoopM: 2,
    },
  });
  state = liveEntryReducer(state, { type: 'RESET' });
  assert(state.phase.kind === 'idle', 'reset → idle');
  assert(state.ctx.pendingShot === null, 'pending cleared');
}

function main(): void {
  testCourtClickStartsShotFlow();
  testMakeOutcomePicksShooter();
  testMissOutcomePicksShooter();
  testResetClearsPending();
  console.log('All live entry state machine tests passed.');
}

main();

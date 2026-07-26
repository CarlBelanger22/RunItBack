/**
 * Court overlay visibility helper tests.
 * Run: npm run test:court-overlay-active
 */

import { courtOverlayActive } from '../src/liveEntry/courtOverlayActive';
import { initialLiveEntryContext } from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const baseCtx = {
  pending: null,
  pendingReboundType: null,
  trackBoth: true,
  turnoverPlayerId: undefined,
  showShotOverlay: false,
};

function testIdleInactive(): void {
  assert(
    !courtOverlayActive({
      ...baseCtx,
      phase: { kind: 'idle' },
    }),
    'idle → no overlay'
  );
}

function testAwaitOutcomeActive(): void {
  assert(
    courtOverlayActive({
      ...baseCtx,
      phase: { kind: 'shot', step: 'await_outcome' },
      showShotOverlay: true,
      pending: {
        point: { xM: 1, yM: 1 },
        zone: 'paint',
        isPaint: true,
        isThree: false,
        shotValue: 2,
      },
    }),
    'await_outcome shot overlay active'
  );
}

function testFreeThrowNotInFlowOverlayHelper(): void {
  assert(
    !courtOverlayActive({
      ...baseCtx,
      phase: {
        kind: 'free_throw',
        playerId: 'p1',
        shootingTeamId: 'home',
        ftTotal: 2,
        ftIndex: 1,
        retainPossession: false,
        offendedTeamId: 'home',
        possessionTeamAfterFt: 'home',
      },
    }),
    'free_throw → flow overlay helper false (FT mounted directly in workspace)'
  );
}

function testPickShooterInactive(): void {
  assert(
    !courtOverlayActive({
      ...baseCtx,
      phase: { kind: 'shot', step: 'pick_shooter' },
      pending: {
        point: { xM: 1, yM: 1 },
        zone: 'paint',
        isPaint: true,
        isThree: false,
        shotValue: 2,
        outcome: 'make',
      },
    }),
    'pick_shooter → roster only, no court overlay'
  );
}

function testFoulEntityActive(): void {
  assert(
    courtOverlayActive({
      ...baseCtx,
      phase: { kind: 'foul', step: 'entity' },
    }),
    'foul entity → overlay active'
  );
}

function main(): void {
  testIdleInactive();
  testAwaitOutcomeActive();
  testFreeThrowNotInFlowOverlayHelper();
  testPickShooterInactive();
  testFoulEntityActive();
  console.log('All court overlay active tests passed.');
}

main();

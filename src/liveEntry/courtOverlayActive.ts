import type { LiveEntryPhase, PendingShot } from './liveEntryStateMachine';

export interface CourtOverlayContext {
  phase: LiveEntryPhase;
  pending: PendingShot | null;
  pendingReboundType: string | null;
  trackBoth: boolean;
  turnoverPlayerId: string | undefined;
  showShotOverlay: boolean;
}

/** True when a court-relative overlay (shot outcome or flow panel) should be mounted. */
export function courtOverlayActive(ctx: CourtOverlayContext): boolean {
  const {
    phase,
    pending,
    pendingReboundType,
    trackBoth,
    turnoverPlayerId,
    showShotOverlay,
  } = ctx;

  if (showShotOverlay) return true;

  if (phase.kind === 'shot') {
    if (phase.step === 'fastbreak' && pending) return true;
    if (phase.step === 'pick_assist' && pending) return true;
    if (phase.step === 'pick_blocker' && !trackBoth) return true;
  }

  if (phase.kind === 'rebound' && phase.step === 'pick_type') {
    if (
      pendingReboundType &&
      pendingReboundType !== 'offensive' &&
      pendingReboundType !== 'defensive'
    ) {
      return false;
    }
    return true;
  }

  if (phase.kind === 'turnover') {
    if (phase.step === 'entity') return true;
    if (phase.step === 'pick_stealer' && turnoverPlayerId && !trackBoth) return true;
  }

  if (phase.kind === 'foul') {
    if (phase.step === 'entity' || phase.step === 'category') return true;
    if (phase.step === 'committer' && phase.foulCategory === 'technical') return true;
    if (phase.step === 'ft_count') return true;
  }

  return false;
}

import type { LiveEntryPhase, PendingShot } from './liveEntryStateMachine';

export interface CourtOverlayContext {
  phase: LiveEntryPhase;
  pending: PendingShot | null;
  pendingReboundType: string | null;
  trackBoth: boolean;
  turnoverPlayerId: string | undefined;
  showShotOverlay: boolean;
  /** When set, used to distinguish Opp-unit blocker overlay vs home-blocked-by-Opp. */
  offenseTeamId?: string;
  awayTeamId?: string;
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
    offenseTeamId,
    awayTeamId,
  } = ctx;

  if (showShotOverlay) return true;

  if (phase.kind === 'shot') {
    if (phase.step === 'fastbreak' && pending) return true;
    if (phase.step === 'pick_assist' && pending) return true;
    // Home blocked by Opp (skip individual) OR hint while picking home blocker on Opp shot
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
    // Opp TO+steal: hint while picking home stealer (no team-steal button)
    if (
      phase.step === 'pick_stealer' &&
      !trackBoth &&
      offenseTeamId != null &&
      awayTeamId != null &&
      offenseTeamId === awayTeamId
    ) {
      return true;
    }
  }

  if (phase.kind === 'foul') {
    if (phase.step === 'entity' || phase.step === 'category') return true;
    if (phase.step === 'committer' && phase.foulCategory === 'technical') return true;
    if (
      phase.step === 'committer' &&
      !trackBoth &&
      phase.foulCategory !== 'technical' &&
      phase.foulEntity !== 'team'
    ) {
      return true;
    }
    if (phase.step === 'ft_count') return true;
  }

  if (phase.kind === 'jumpball' && !trackBoth) {
    if (phase.step === 'pick_to' && offenseTeamId === awayTeamId) return true;
    if (phase.step === 'pick_steal') return true;
  }

  return false;
}

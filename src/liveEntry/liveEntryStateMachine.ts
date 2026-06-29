import type { CourtPointM, ResolvedShotZone, ShotZone } from '../lib/fibaCourtGeometry';

export type ShotOutcome = 'make' | 'miss' | 'block';

export interface PendingShot {
  point: CourtPointM;
  zone: ShotZone;
  isPaint: boolean;
  isThree: boolean;
  shotValue: 2 | 3;
  outcome?: ShotOutcome;
  shooterId?: string;
  assistId?: string | null;
  blockerId?: string;
  isTransition?: boolean;
}

export type LiveEntryPhase =
  | { kind: 'idle' }
  | { kind: 'shot'; step: 'await_outcome' | 'pick_shooter' | 'pick_assist' | 'fastbreak' | 'pick_blocker' }
  | { kind: 'rebound'; step: 'pick_type' | 'pick_player' }
  | { kind: 'turnover'; step: 'entity' | 'steal' | 'pick_stealer' }
  | {
      kind: 'foul';
      step: 'category' | 'committer' | 'recipient' | 'ft_count' | 'ft_attempt';
      foulCategory?: 'personal' | 'technical' | 'unsportsmanlike' | 'double';
      committerId?: string;
      recipientId?: string;
      ftTotal?: number;
      ftIndex?: number;
    }
  | { kind: 'substitution'; step: 'pick_out' | 'pick_in' | 'confirm'; outIds?: string[]; inIds?: string[] }
  | { kind: 'and1'; recipientId: string; pendingShot: PendingShot }
  | { kind: 'free_throw'; playerId: string; ftTotal: number; ftIndex: number };

export interface CourtMarker {
  point: CourtPointM;
  color: 'green' | 'red' | 'orange';
}

export interface LiveEntryContext {
  offenseTeamId: string;
  onCourtHome: string[];
  onCourtAway: string[];
  pendingShot: PendingShot | null;
  markers: CourtMarker[];
  clockRunning: boolean;
  clockStartedAt: number | null;
}

export type LiveEntryAction =
  | { type: 'RESET' }
  | { type: 'SET_OFFENSE'; teamId: string }
  | { type: 'COURT_CLICK'; point: CourtPointM; zone: ResolvedShotZone }
  | { type: 'SHOT_OUTCOME'; outcome: ShotOutcome }
  | { type: 'PICK_SHOOTER'; playerId: string }
  | { type: 'PICK_ASSIST'; playerId: string | null }
  | { type: 'SET_FASTBREAK'; value: boolean }
  | { type: 'PICK_BLOCKER'; playerId: string }
  | { type: 'SKIP_BLOCKER' }
  | { type: 'ADD_MARKER'; marker: CourtMarker }
  | { type: 'CLEAR_MARKERS' }
  | { type: 'START_REBOUND' }
  | { type: 'REBOUND_TYPE'; reboundType: string }
  | { type: 'START_TURNOVER' }
  | { type: 'TURNOVER_ENTITY'; isTeam: boolean; playerId?: string }
  | { type: 'TURNOVER_STEAL'; hasSteal: boolean }
  | { type: 'PICK_STEALER'; playerId: string | null }
  | { type: 'START_FOUL' }
  | { type: 'FOUL_CATEGORY'; category: 'personal' | 'technical' | 'unsportsmanlike' | 'double' }
  | { type: 'PICK_FOUL_COMMITTER'; playerId: string }
  | { type: 'PICK_FOUL_RECIPIENT'; playerId: string }
  | { type: 'SET_FT_COUNT'; count: number }
  | { type: 'START_FT'; playerId: string; ftTotal: number }
  | { type: 'START_SUBSTITUTION' }
  | { type: 'SUB_PICK_OUT'; playerId: string }
  | { type: 'SUB_PICK_IN'; playerId: string }
  | { type: 'START_AND1'; recipientId: string; pendingShot: PendingShot }
  | { type: 'TOGGLE_CLOCK' }
  | { type: 'APPLY_SUBSTITUTION'; outIds: string[]; inIds: string[]; teamId: string };

export interface LiveEntryState {
  phase: LiveEntryPhase;
  ctx: LiveEntryContext;
}

export function initialLiveEntryContext(
  homeTeamId: string,
  onCourtHome: string[],
  onCourtAway: string[]
): LiveEntryContext {
  return {
    offenseTeamId: homeTeamId,
    onCourtHome,
    onCourtAway,
    pendingShot: null,
    markers: [],
    clockRunning: false,
    clockStartedAt: null,
  };
}

export function liveEntryReducer(
  state: LiveEntryState,
  action: LiveEntryAction
): LiveEntryState {
  switch (action.type) {
    case 'RESET':
      return {
        ...state,
        phase: { kind: 'idle' },
        ctx: {
          ...state.ctx,
          pendingShot: null,
          markers: [],
        },
      };

    case 'SET_OFFENSE':
      return { ...state, ctx: { ...state.ctx, offenseTeamId: action.teamId } };

    case 'COURT_CLICK':
      return {
        phase: { kind: 'shot', step: 'await_outcome' },
        ctx: {
          ...state.ctx,
          pendingShot: {
            point: action.point,
            zone: action.zone.zone,
            isPaint: action.zone.isPaint,
            isThree: action.zone.shotValue === 3,
            shotValue: action.zone.shotValue,
          },
        },
      };

    case 'SHOT_OUTCOME':
      if (!state.ctx.pendingShot) return state;
      const pending = { ...state.ctx.pendingShot, outcome: action.outcome };
      if (action.outcome === 'block') {
        return {
          phase: { kind: 'shot', step: 'pick_blocker' },
          ctx: { ...state.ctx, pendingShot: pending },
        };
      }
      return {
        phase: { kind: 'shot', step: 'pick_shooter' },
        ctx: { ...state.ctx, pendingShot: pending },
      };

    case 'PICK_BLOCKER':
      if (!state.ctx.pendingShot) return state;
      return {
        phase: { kind: 'shot', step: 'pick_shooter' },
        ctx: {
          ...state.ctx,
          pendingShot: { ...state.ctx.pendingShot, blockerId: action.playerId },
        },
      };

    case 'SKIP_BLOCKER':
      return {
        phase: { kind: 'shot', step: 'pick_shooter' },
        ctx: state.ctx,
      };

    case 'PICK_SHOOTER':
      if (!state.ctx.pendingShot) return state;
      const shot = { ...state.ctx.pendingShot, shooterId: action.playerId };
      if (shot.outcome === 'make') {
        return {
          phase: { kind: 'shot', step: 'pick_assist' },
          ctx: { ...state.ctx, pendingShot: shot },
        };
      }
      return {
        phase: { kind: 'rebound', step: 'pick_type' },
        ctx: { ...state.ctx, pendingShot: shot },
      };

    case 'PICK_ASSIST':
      if (!state.ctx.pendingShot) return state;
      return {
        phase: { kind: 'shot', step: 'fastbreak' },
        ctx: {
          ...state.ctx,
          pendingShot: { ...state.ctx.pendingShot, assistId: action.playerId },
        },
      };

    case 'SET_FASTBREAK':
      if (!state.ctx.pendingShot) return state;
      return {
        ...state,
        ctx: {
          ...state.ctx,
          pendingShot: { ...state.ctx.pendingShot, isTransition: action.value },
        },
      };

    case 'ADD_MARKER':
      return {
        ...state,
        ctx: { ...state.ctx, markers: [...state.ctx.markers, action.marker] },
      };

    case 'CLEAR_MARKERS':
      return { ...state, ctx: { ...state.ctx, markers: [] } };

    case 'START_REBOUND':
      return { ...state, phase: { kind: 'rebound', step: 'pick_type' } };

    case 'REBOUND_TYPE':
      if (action.reboundType.startsWith('team_')) {
        return { ...state, phase: { kind: 'idle' } };
      }
      return { ...state, phase: { kind: 'rebound', step: 'pick_player' } };

    case 'START_TURNOVER':
      return { ...state, phase: { kind: 'turnover', step: 'entity' } };

    case 'TURNOVER_STEAL':
      return {
        ...state,
        phase: {
          kind: 'turnover',
          step: action.hasSteal ? 'pick_stealer' : 'entity',
        },
      };

    case 'START_FOUL':
      return { ...state, phase: { kind: 'foul', step: 'category' } };

    case 'FOUL_CATEGORY':
      return {
        ...state,
        phase: { kind: 'foul', step: 'committer', foulCategory: action.category },
      };

    case 'PICK_FOUL_COMMITTER':
      return {
        phase: {
          kind: 'foul',
          step: 'recipient',
          foulCategory:
            state.phase.kind === 'foul' ? state.phase.foulCategory : 'personal',
          committerId: action.playerId,
        },
        ctx: state.ctx,
      };

    case 'PICK_FOUL_RECIPIENT':
      return {
        phase: {
          kind: 'foul',
          step: 'ft_count',
          foulCategory:
            state.phase.kind === 'foul' ? state.phase.foulCategory : 'personal',
          committerId:
            state.phase.kind === 'foul' ? state.phase.committerId : undefined,
          recipientId: action.playerId,
        },
        ctx: state.ctx,
      };

    case 'SET_FT_COUNT':
      return {
        phase: {
          kind: 'foul',
          step: 'ft_attempt',
          foulCategory:
            state.phase.kind === 'foul' ? state.phase.foulCategory : 'personal',
          committerId:
            state.phase.kind === 'foul' ? state.phase.committerId : undefined,
          recipientId:
            state.phase.kind === 'foul' ? state.phase.recipientId : undefined,
          ftTotal: action.count,
          ftIndex: 1,
        },
        ctx: state.ctx,
      };

    case 'START_FT':
      return {
        phase: {
          kind: 'free_throw',
          playerId: action.playerId,
          ftTotal: action.ftTotal,
          ftIndex: 1,
        },
        ctx: state.ctx,
      };

    case 'START_SUBSTITUTION':
      return { ...state, phase: { kind: 'substitution', step: 'pick_out', outIds: [], inIds: [] } };

    case 'START_AND1':
      return {
        phase: { kind: 'and1', recipientId: action.recipientId, pendingShot: action.pendingShot },
        ctx: { ...state.ctx, pendingShot: null },
      };

    case 'TOGGLE_CLOCK':
      return {
        ...state,
        ctx: {
          ...state.ctx,
          clockRunning: !state.ctx.clockRunning,
          clockStartedAt: !state.ctx.clockRunning ? Date.now() : null,
        },
      };

    case 'APPLY_SUBSTITUTION': {
      const isHome = action.teamId === state.ctx.onCourtHome.join('') ? false : true;
      const onCourtHome =
        action.teamId === state.ctx.offenseTeamId || true
          ? state.ctx.onCourtHome
          : state.ctx.onCourtHome;
      // Updated in hook with teamId check
      let home = [...state.ctx.onCourtHome];
      let away = [...state.ctx.onCourtAway];
      if (action.teamId === home[0] || home.includes(action.outIds[0] ?? '')) {
        home = home.filter((id) => !action.outIds.includes(id)).concat(action.inIds);
      } else {
        away = away.filter((id) => !action.outIds.includes(id)).concat(action.inIds);
      }
      return {
        phase: { kind: 'idle' },
        ctx: { ...state.ctx, onCourtHome: home, onCourtAway: away },
      };
    }

    default:
      return state;
  }
}

export function defenseTeamIdFor(gameHomeId: string, gameAwayId: string, offenseId: string): string {
  return offenseId === gameHomeId ? gameAwayId : gameHomeId;
}

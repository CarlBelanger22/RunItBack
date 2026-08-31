import type { Game } from '../App';

export type FoulCategory =
  | 'personal'
  | 'technical'
  | 'unsportsmanlike'
  | 'double'
  | 'offensive';
export type FoulEntity = 'player' | 'team';

export interface FoulCommitParams {
  foulingTeamId: string;
  foulCategory: FoulCategory;
  foulEntity: FoulEntity;
  committerId?: string;
  recipientId?: string;
  /** Defender credited with a foul drawn on an offensive foul (charge). */
  chargeDrawnBy?: string;
  isCoachFoul?: boolean;
  ftCount: number;
  ftShooterId?: string;
  /** When set (and no ftShooterId), team-only FTs for this side (Opp unit). */
  ftShootingTeamId?: string;
  retainPossession?: boolean;
  offendedTeamId?: string;
  /** Team that receives the ball after the final FT (may differ from offended team on technicals). */
  possessionTeamAfterFt?: string;
  doublePartnerPlayerId?: string;
  doublePartnerTeamId?: string;
}

export interface FtSessionState {
  /** Undefined = team-only FTs (Opp unit). */
  playerId?: string;
  ftTotal: number;
  ftIndex: number;
  retainPossession: boolean;
  offendedTeamId: string;
}

export function opponentTeamId(game: Game, teamId: string): string {
  return teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
}

export function defaultRetainForCategory(category: FoulCategory): boolean {
  return category === 'unsportsmanlike';
}

export function ftCountOptionsForCategory(category: FoulCategory): number[] {
  if (category === 'unsportsmanlike') return [1, 2, 3];
  if (category === 'technical' || category === 'double') return [1];
  if (category === 'offensive') return [0];
  return [0, 1, 2, 3];
}

/**
 * Single-team: Opp has no roster — skip fouled-player pick when home commits
 * a personal or unsportsmanlike foul (Opp team FTs instead).
 */
export function shouldSkipFoulRecipient(params: {
  trackBoth: boolean;
  foulingTeamId: string;
  homeTeamId: string;
  foulCategory: string | undefined;
  and1RecipientId?: string | null;
  and1OppTeamFt?: boolean;
}): boolean {
  if (params.trackBoth) return false;
  if (params.foulingTeamId !== params.homeTeamId) return false;
  if (params.and1RecipientId || params.and1OppTeamFt) return false;
  const cat = params.foulCategory ?? 'personal';
  return cat === 'personal' || cat === 'unsportsmanlike';
}

/**
 * Single-team: home technical → Opp shoots team FT (no individual shooter pick).
 */
export function shouldSkipTechShooterPick(params: {
  trackBoth: boolean;
  foulingTeamId: string;
  homeTeamId: string;
}): boolean {
  return !params.trackBoth && params.foulingTeamId === params.homeTeamId;
}

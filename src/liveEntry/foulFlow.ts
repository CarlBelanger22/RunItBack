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
  isCoachFoul?: boolean;
  ftCount: number;
  ftShooterId?: string;
  retainPossession?: boolean;
  offendedTeamId?: string;
  /** Team that receives the ball after the final FT (may differ from offended team on technicals). */
  possessionTeamAfterFt?: string;
  doublePartnerPlayerId?: string;
  doublePartnerTeamId?: string;
}

export interface FtSessionState {
  playerId: string;
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
